// AutoAccept Lite — enjeksiyon dongusu.
// Tek sorumluluk: hedefleri izlemek, gozlemci betigini canli tutmak, tiklamalari raporlamak.

const crypto = require('crypto');
const { listTargets, CdpSession } = require('./cdpClient');
const { discoverPort } = require('./portDiscovery');
const { buildDOMObserverScript } = require('./DOMObserver');
const { buildWatchdogScript, HEARTBEAT_EXPR, DISARM_EXPR } = require('./watchdog');
const { t } = require('./i18n');

/**
 * Gozlemciyi sayfadan sokup atan ifade.
 * Enjeksiyondan once calistirilir; eski surumun MutationObserver'i ve
 * yedek zamanlayicisi boylece geride kalmaz.
 */
const CLEANUP_EXPR = `(function(){
    if (typeof window.__AA_CLEANUP === 'function') window.__AA_CLEANUP();
    window.__AA_OBSERVER_ACTIVE = false;
    window.__AA_SCRIPT_ID = null;
    // Onceki oturumun tiklama gecmisi yeni oturumda tekrar raporlanmasin.
    window.__AA_CLICK_LOG = [];
    return 'ok';
})()`;

/**
 * Gozlemciyi yeniden taramaya zorlayan durtme.
 *
 * Gozlemci tarama basina YALNIZCA BIR dugmeye basar ve yeni taramayi
 * MutationObserver tetikler. Ekranda ayni anda birden fazla dugme varsa
 * (ornegin birden fazla `Submit`), ilkine basildiktan sonra DOM degismezse
 * digerleri hic taranmaz — yedek zamanlayici 10 saniyede bir devreye girene
 * kadar beklerler.
 *
 * Bu ifade gecici bir dugum ekleyip kaldirarak childList mutasyonu uretir;
 * gozlemci her turda yeniden tarar ve bekleyen dugmeleri sirayla tuketir.
 * Her dugmenin kendi bekleme suresi oldugu icin farkli dugmeler birbirini
 * geciktirmez.
 */
const PULSE_EXPR = `(function(){
    var n = document.createElement('span');
    n.setAttribute('data-aa-pulse', '1');
    n.style.display = 'none';
    document.body.appendChild(n);
    n.remove();
    return 'ok';
})()`;

/** Tiklama kaydini okuyup temizleyen ifade (tek seferde tuketilir). */
const DRAIN_EXPR = `(function(){
    var log = window.__AA_CLICK_LOG || [];
    window.__AA_CLICK_LOG = [];
    return JSON.stringify({
        clicks: log,
        total: window.__AA_CLICK_COUNT || 0,
        blocked: document.querySelectorAll('[data-aa-blocked]').length
    });
})()`;

/**
 * Antigravity'nin yeni arayuzu tum sohbetleri tek bir SPA renderer'inda tutar:
 * CDP'de tek "page" gorunur ve secili olmayan sohbetteki onay dugmeleri DOM'a
 * hic yuklenmez. Bu ifade yalnizca halen calisan sohbetleri (satirinda
 * "Stop execution" bulunanlari) sirayla acar. Bitmis/gecmis sohbetlere ve
 * proje basliklarina dokunmaz.
 */
function buildConversationRotationExpr(switchMs) {
    return `(function(){
        if (window.__AA_PAUSED || window.__AA_SWARM_PAUSED) return '';
        var now = Date.now();
        if (now - (window.__AA_LAST_CONVERSATION_SWITCH || 0) < ${switchMs}) return '';

        var rows = Array.prototype.slice.call(document.querySelectorAll('[data-testid="conversation-row-sidebar"]'))
            .filter(function(row) {
                return row.querySelector('[aria-label="Stop execution"]') !== null;
            });
        if (rows.length < 2) return '';

        var ids = rows.map(function(row) { return row.getAttribute('data-cascade-id') || ''; });
        var selectedIndex = rows.findIndex(function(row) { return row.getAttribute('data-selected') === 'true'; });
        var lastIndex = ids.indexOf(window.__AA_LAST_ROTATED_CONVERSATION || '');
        var nextIndex = lastIndex >= 0 ? (lastIndex + 1) % rows.length : (selectedIndex + 1) % rows.length;
        if (nextIndex === selectedIndex) nextIndex = (nextIndex + 1) % rows.length;

        var next = rows[nextIndex];
        var link = next.querySelector('a[aria-label]');
        if (!link) return '';
        window.__AA_LAST_CONVERSATION_SWITCH = now;
        window.__AA_LAST_ROTATED_CONVERSATION = ids[nextIndex];
        link.click();
        return JSON.stringify({
            id: ids[nextIndex],
            title: link.getAttribute('aria-label') || (next.textContent || '').trim(),
            activeCount: rows.length
        });
    })()`;
}

/**
 * Antigravity pencerelerine gozlemciyi enjekte eden ve canli tutan dongusel surec.
 * Uygulama kapanip acilsa bile portu yeniden bulur ve kaldigi yerden devam eder.
 */
class Injector {
    /**
     * @param {object} cfg loadConfig() ciktisi
     * @param {(msg: string, level?: string) => void} log ekrana yazan geri cagirim
     */
    constructor(cfg, log) {
        this.cfg = cfg;
        this.log = log;
        this.port = null;
        this.sessions = new Map();  // targetId -> { session, title }
        this.paused = false;
        this.totalClicks = 0;
        this._timer = null;
        this._running = false;
        this._warnedOffline = false;

        this.script = buildDOMObserverScript(
            cfg.customButtonTexts,
            cfg.blockedCommands,
            cfg.allowedCommands,
            cfg.autoAcceptFileEdits,
            cfg.autoRetryEnabled
        );

        // Betigin parmak izi. Enjekte edilen gozlemci sayfada YASAMAYA DEVAM ETTIGI
        // icin (surec olse bile), sadece "kurulu mu?" diye sormak yetmez — ayarlar
        // degistiginde eski gozlemci sonsuza dek kalirdi. Bu yuzden hangi SURUMUN
        // kurulu oldugu da karsilastirilir; parmak izi tutmazsa yenisi basilir.
        this.scriptId = crypto.createHash('sha1').update(this.script).digest('hex').substring(0, 12);
        this.probeExpr = `typeof window !== "undefined" && window.__AA_OBSERVER_ACTIVE === true && window.__AA_SCRIPT_ID === ${JSON.stringify(this.scriptId)}`;

        // Bekci, kalp atisi tur suresinin ~4 katindan uzun sessizlikte devreye girer.
        // Gecici ag/CPU tikanmalarinda bosuna sokmemesi icin en az 15 saniye.
        this.watchdogScript = buildWatchdogScript(Math.max(15000, cfg.heartbeatMs * 4));
        this.conversationRotationExpr = buildConversationRotationExpr(cfg.conversationSwitchMs);
    }

    /** Dongusu baslatir. Cagiran tarafin beklemesine gerek yoktur. */
    start() {
        if (this._running) return;
        this._running = true;
        this._tick();
    }

    /**
     * Dongusu durdurur, gozlemciyi sayfalardan SOKER ve baglantilari kapatir.
     * Sokme sart: gozlemci sayfanin kendi belleginde yasar, surec olse bile
     * tiklamaya devam ederdi — kullanici konsolu kapatinca durdugunu sanar.
     * @returns {Promise<void>}
     */
    async stop() {
        this._running = false;
        if (this._timer) clearTimeout(this._timer);
        await Promise.allSettled([...this.sessions.values()].map(async ({ session }) => {
            try {
                await session.evaluate(CLEANUP_EXPR, 2000);
                await session.evaluate(DISARM_EXPR, 2000);
            } catch (e) { /* oturum zaten olu — bekci zaten devrede */ }
            session.close();
        }));
        this.sessions.clear();
    }

    /**
     * Duraklat/devam et. Duraklatildiginda gozlemci sayfada kalir ama
     * hicbir dugmeye basmaz (window.__AA_PAUSED).
     * @returns {boolean} yeni duraklatma durumu
     */
    async togglePause() {
        this.paused = !this.paused;
        const val = this.paused ? 'true' : 'false';
        await Promise.allSettled([...this.sessions.values()].map(async ({ session }) => {
            try { await session.evaluate(`window.__AA_PAUSED = ${val}; "ok"`, 3000); } catch (e) { /* olu oturum */ }
        }));
        return this.paused;
    }

    async _tick() {
        if (!this._running) return;
        try { await this._pass(); }
        catch (e) { if (this.cfg.verbose) this.log(t('loopError', e.message), 'warn'); }
        if (this._running) this._timer = setTimeout(() => this._tick(), this.cfg.heartbeatMs);
    }

    async _pass() {
        if (!this.port) {
            const found = await discoverPort(this.cfg.port);
            if (!found) {
                if (!this._warnedOffline) {
                    this.log(t('notFound'), 'warn');
                    this._warnedOffline = true;
                }
                return;
            }
            this.port = found.port;
            this._warnedOffline = false;
            this.log(t('connected', found.port, found.source), 'ok');
        }

        let targets;
        try {
            targets = await listTargets(this.port);
        } catch (e) {
            this.log(t('connectionLost'), 'warn');
            this._dropAll();
            this.port = null;
            return;
        }

        const candidates = targets.filter((t) => this._isCandidate(t));
        const alive = new Set(candidates.map((t) => t.id));

        // Her renderer hedefi (yani her acik sohbet/pencere) ayri bir CDP
        // oturumudur. Bunlari sirayla beklemek, takilan tek bir sohbetin diger
        // sohbetleri saniyelerce geciktirmesine neden olurdu. Isci havuzu ile
        // 2, 5, 10... acik sohbet ayni turda bagimsiz ele alinir.
        await this._forEachConcurrent(candidates, (target) => this._ensure(target));

        for (const [id, entry] of [...this.sessions]) {
            if (!alive.has(id)) {
                entry.session.close();
                this.sessions.delete(id);
                this.log(t('windowClosed', entry.title), 'dim');
            }
        }
    }

    /** Hedefleri sinirli sayida paralel isler; tek hedef hatasi digerlerini durdurmaz. */
    async _forEachConcurrent(items, work) {
        let cursor = 0;
        const workers = Math.min(this.cfg.maxConcurrentTargets, items.length);
        const runWorker = async () => {
            while (cursor < items.length) {
                const item = items[cursor++];
                try { await work(item); }
                catch (e) {
                    // _ensure kendi hatalarini kayda alir; bu son koruma, bir
                    // hedefin hicbir zaman tum tarama turunu kesmemesini saglar.
                    if (this.cfg.verbose) this.log(t('targetSkipped', e.message), 'warn');
                }
            }
        };
        await Promise.all(Array.from({ length: workers }, runWorker));
    }

    /**
     * Log satirlarinda pencereyi ayirt eden etiket.
     * Birden fazla Antigravity penceresi acikken hepsinin basligi ayni
     * ("Antigravity") oldugu icin hedef kimliginin ilk 4 hanesi eklenir.
     * @param {{id: string, title?: string}} target
     * @returns {string}
     */
    _label(target) {
        const title = (target.title || '').trim() || t('untitled');
        return `${title} #${target.id.substring(0, 4)}`;
    }

    /** Gozlemci enjekte edilebilecek hedef turleri. */
    _isCandidate(t) {
        if (!t.webSocketDebuggerUrl) return false;
        const url = t.url || '';
        return t.type === 'page' || t.type === 'iframe' || url.includes('webview');
    }

    async _ensure(target) {
        let entry = this.sessions.get(target.id);

        if (entry && entry.session.dead) {
            this.sessions.delete(target.id);
            entry = null;
        }

        if (!entry) {
            const session = new CdpSession(target.webSocketDebuggerUrl);
            try { await session.ready; }
            catch (e) { session.close(); return; }
            entry = { session, title: this._label(target) };
            this.sessions.set(target.id, entry);
            await this._keepActive(session);
            this.log(t('windowFound', entry.title), 'dim');
        }

        entry.title = this._label(target);

        try {
            const active = await entry.session.evaluate(this.probeExpr, 5000);
            if (active !== true) {
                // Eski/yabanci bir gozlemci varsa once sokulur, sonra guncel surum basilir.
                await entry.session.evaluate(CLEANUP_EXPR, 5000);
                // Sayfa yeniden yuklendiyse odak emulasyonu da tazelensin.
                await this._keepActive(entry.session);
                // Bekci gozlemciden ONCE kurulur: gozlemcinin kurulum sirasindaki
                // `window.__AA_PAUSED = false` atamasi bekcinin setter'ina dusmeli.
                await entry.session.evaluate(this.watchdogScript, 5000);
                const res = await entry.session.evaluate(this.script, 15000);
                await entry.session.evaluate(`window.__AA_SCRIPT_ID = ${JSON.stringify(this.scriptId)}; "ok"`, 3000);
                if (this.paused) await entry.session.evaluate('window.__AA_PAUSED = true; "ok"', 3000);
                if (res === 'observer-installed') this.log(t('observerInstalled', entry.title), 'ok');
                else this.log(t('observerReplied', res, entry.title), 'warn');
            }
            // Kalp atisi: bu tazeleme kesilirse sayfadaki bekci gozlemciyi soker.
            await entry.session.evaluate(HEARTBEAT_EXPR, 3000);
            // Durtme: ekranda bekleyen ikinci/ucuncu dugmeler de taransin.
            if (!this.paused) await entry.session.evaluate(PULSE_EXPR, 3000);
            const scan = await this._drain(entry);
            // Bir dugmeye yeni basildiysa veya guvenlik filtresi devreye girdiyse
            // o sohbette kal. Diger durumlarda aktif sohbetlerden sonrakine gecip
            // onun DOM'unu yuklet; boylece tek renderer'daki tum aktif sohbetler
            // kendi siralarinda onaylanabilir.
            if (this.cfg.autoCycleActiveConversations && scan.clicks === 0 && scan.blocked === 0) {
                await this._rotateActiveConversation(entry);
            }
        } catch (e) {
            if (this.cfg.verbose) this.log(`${entry.title}: ${e.message}`, 'warn');
            entry.session.close();
            this.sessions.delete(target.id);
        }
    }

    /**
     * Antigravity penceresi baska bir pencerenin arkasinda kaldiginda ya da
     * kucultuldugunde Chromium sayfayi "gizli" sayar: zamanlayicilar saniyede
     * bire (5 dakika sonra dakikada bire) kisilir ve requestAnimationFrame hic
     * calismaz. Gozlemcinin taramasi ve arayuzun yeni dugmeleri cizmesi bu
     * yuzden gecikir ya da hic olmaz. Odak emulasyonu, CDP oturumu acik kaldigi
     * surece sayfayi gorunur ve odakli gosterir; oturum kapaninca kendiliginden
     * eski haline doner. Bedeli: Antigravity arka plandayken de cizim yapar.
     * @param {CdpSession} session
     */
    async _keepActive(session) {
        if (!this.cfg.keepActiveInBackground) return;
        try {
            await session.send('Emulation.setFocusEmulationEnabled', { enabled: true }, 3000);
        } catch (e) {
            if (!this._warnedKeepActive) {
                this._warnedKeepActive = true;
                this.log(t('keepActiveFailed', e.message), 'warn');
            }
        }
    }

    async _drain(entry) {
        const raw = await entry.session.evaluate(DRAIN_EXPR, 5000);
        if (!raw) return { clicks: 0, blocked: 0 };
        let data;
        try { data = JSON.parse(raw); } catch (e) { return { clicks: 0, blocked: 0 }; }

        for (const c of data.clicks || []) {
            this.totalClicks++;
            this.log(t('clicked', c.text, entry.title), 'click');
        }
        if (data.blocked > 0 && data.blocked !== entry.lastBlocked) {
            entry.lastBlocked = data.blocked;
            this.log(t('blocked', data.blocked, entry.title), 'block');
        }
        return { clicks: (data.clicks || []).length, blocked: data.blocked || 0 };
    }

    /** Yeni SPA arayuzunde calisan sohbetler arasinda bir sonraki sohbete gecer. */
    async _rotateActiveConversation(entry) {
        const raw = await entry.session.evaluate(this.conversationRotationExpr, 3000);
        if (!raw) return;
        let data;
        try { data = JSON.parse(raw); } catch (e) { return; }
        if (data && data.title) {
            this.log(t('activeChat', data.title, data.activeCount), 'dim');
        }
    }

    _dropAll() {
        for (const { session } of this.sessions.values()) session.close();
        this.sessions.clear();
    }
}

module.exports = { Injector };
