#!/usr/bin/env node
// AutoAccept Lite — giris noktasi.
// Tek sorumluluk: ayarlari yukle, dongusu baslat, klavye/kapanis olaylarini yonet.

const path = require('path');
const { loadConfig } = require('./src/config');
const { Injector } = require('./src/injector');
const { acquireLock } = require('./src/singleInstance');

const C = {
    reset: '\x1b[0m', dim: '\x1b[90m', red: '\x1b[31m', green: '\x1b[32m',
    yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m',
};

function stamp() {
    return new Date().toTimeString().substring(0, 8);
}

/** Seviyeye gore renklendirilmis, zaman damgali satir yazar. */
function log(msg, level) {
    const t = `${C.dim}${stamp()}${C.reset}`;
    switch (level) {
        case 'ok':    return console.log(`${t} ${C.green}✓${C.reset} ${msg}`);
        case 'warn':  return console.log(`${t} ${C.yellow}!${C.reset} ${msg}`);
        case 'err':   return console.log(`${t} ${C.red}✗${C.reset} ${msg}`);
        case 'click': return console.log(`${t} ${C.cyan}➜${C.reset} ${msg}`);
        case 'block': return console.log(`${t} ${C.red}⛔${C.reset} ${msg}`);
        case 'dim':   return console.log(`${t} ${C.dim}· ${msg}${C.reset}`);
        default:      return console.log(`${t}   ${msg}`);
    }
}

function banner(cfg) {
    // Sira DOMObserver.buildDOMObserverScript ile birebir ayni olmali,
    // yoksa banner gercekte basilacak dugmeleri yanlis gosterir.
    const texts = ['run'];
    if (cfg.autoAcceptFileEdits) texts.push('accept');
    texts.push('always allow', 'allow this conversation', 'allow');
    if (cfg.autoRetryEnabled) texts.push('retry', 'continue');
    texts.push(...cfg.customButtonTexts);

    console.log('');
    console.log(`${C.bold}  AutoAccept Lite${C.reset} ${C.dim}— Antigravity icin, IDE gerekmez${C.reset}`);
    console.log(`${C.dim}  ─────────────────────────────────────────────${C.reset}`);
    console.log(`  Basilacak dugmeler : ${texts.join(', ')}`);
    console.log(`  Guvenlik filtresi  : ${cfg.blockedCommands.length} yasak kalip` +
        (cfg.allowedCommands.length ? `, ${cfg.allowedCommands.length} izinli kalip` : ''));
    console.log(`  CDP portu          : ${cfg.port || 'otomatik bulunacak'}`);
    console.log(`  Eszamanli sohbet   : ${cfg.maxConcurrentTargets} hedef`);
    console.log(`  Aktif sohbet turu  : ${cfg.autoCycleActiveConversations ? `${cfg.conversationSwitchMs} ms` : 'kapali'}`);
    console.log(`${C.dim}  ─────────────────────────────────────────────${C.reset}`);
    console.log(`${C.dim}  [P] duraklat/devam    [Ctrl+C] cikis${C.reset}`);
    console.log('');
}

async function main() {
    // Iki ornek ayni anda calisirsa birbirinin kalp atisini tazeler ve
    // olu adam anahtari devre disi kalir — bu yuzden kilit ZORUNLU.
    const lock = await acquireLock();
    if (!lock.acquired) {
        console.log('');
        log('AutoAccept Lite zaten calisiyor. Ikinci pencere kapaniyor.', 'warn');
        log('Calisan pencereyi bulamiyorsan: Gorev Yoneticisi → node.exe → gorevi sonlandir.', 'dim');
        console.log('');
        process.exit(0);
    }

    const cfg = loadConfig(__dirname);
    banner(cfg);

    const injector = new Injector(cfg, log);
    injector.start();

    // Ham klavye modu yalnizca gercek bir terminalde vardir (borulanmis
    // cikti veya arka plan servisinde yoktur) — bu yuzden korumali.
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', async (key) => {
            const k = key.toString();
            if (k === '') return shutdown();  // Ctrl+C
            if (k.toLowerCase() === 'p') {
                const paused = await injector.togglePause();
                log(paused ? 'DURAKLATILDI — hicbir dugmeye basilmiyor' : 'DEVAM EDIYOR', paused ? 'warn' : 'ok');
            }
        });
    }

    let closing = false;
    async function shutdown() {
        if (closing) return;
        closing = true;
        console.log('');
        log(`Kapaniyor — bu oturumda ${injector.totalClicks} tiklama yapildi.`, 'ok');
        // Gozlemcinin sayfadan sokulmesini BEKLE; yoksa surec olur ama
        // sayfadaki tikla motoru arkada calismaya devam eder.
        try { await injector.stop(); } catch (e) { /* baglanti zaten kopmus */ }
        lock.release();
        log('Gozlemci sayfalardan kaldirildi.', 'ok');
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.exit(0);
    }

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Windows tray host sends newline-delimited commands over a hidden pipe.
    // Keep the regular interactive terminal behavior above unchanged.
    if (process.env.AUTOACCEPT_TRAY === '1' && !process.stdin.isTTY) {
        let pending = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', async (chunk) => {
            pending += chunk;
            const lines = pending.split(/\r?\n/);
            pending = lines.pop();
            for (const line of lines) {
                const command = line.trim().toLowerCase();
                if (command === 'p') {
                    const paused = await injector.togglePause();
                    log(paused ? 'DURAKLATILDI — hicbir dugmeye basilmiyor' : 'DEVAM EDIYOR', paused ? 'warn' : 'ok');
                } else if (command === 'q') {
                    await shutdown();
                    return;
                }
            }
        });
        process.stdin.resume();
    }
}

main().catch((e) => {
    log(`Baslatilamadi: ${e.message}`, 'err');
    process.exit(1);
});
