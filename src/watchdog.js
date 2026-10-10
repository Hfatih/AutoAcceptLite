// AutoAccept Lite — olu adam anahtari (dead man's switch).
// Tek sorumluluk: denetleyici surec ortadan kaybolursa tiklamayi durdurmak.

/**
 * Enjekte edilen gozlemci sayfanin kendi belleginde yasar; Node sureci olse bile
 * MutationObserver'i calismaya devam eder. Windows'ta bir sureci oldurmek
 * (`taskkill`, konsol penceresini kapatmak, oturum kapanmasi) SIGTERM
 * isleyicisini CALISTIRMAZ — duzgun temizlik garanti edilemez.
 *
 * Iki katmanli koruma kurulur:
 *
 * 1. **Kilit katman — `__AA_PAUSED` getter'i.** Gozlemci her taramanin ILK
 *    satirinda `window.__AA_PAUSED` degerini okur. Bu ozellik bir getter'a
 *    cevrilir: kalp atisi bayatladiginda `true` doner ve gozlemci hicbir seye
 *    basmadan geri doner. Senkron okundugu ve MutationObserver ile tetiklendigi
 *    icin tarayici zamanlayici kisitlamalarindan ETKILENMEZ.
 *
 * 2. **Yedek katman — aralikli tam sokme.** Bayatlik surerse gozlemci
 *    tamamen kaldirilir. Arka plandaki pencerelerde Chromium `setInterval`'i
 *    dakikada bire kadar kistigi icin bu katman tek basina yeterli degildir;
 *    sadece temizligi tamamlar.
 *
 * Gozlemcinin kendi `window.__AA_PAUSED = false` atamasi setter'a duser ve
 * elle duraklatma bayragini temizler — bu yuzden bu betik gozlemciden ONCE
 * enjekte edilmelidir.
 *
 * @param {number} timeoutMs Kalp atisi bu sureden eskiyse tiklama durur
 * @returns {string} Sayfada calistirilacak JavaScript ifadesi
 */
function buildWatchdogScript(timeoutMs) {
    return `
(function() {
    var TIMEOUT = ${JSON.stringify(timeoutMs)};
    window.__AA_HEARTBEAT = Date.now();
    if (window.__AA_PAUSED_MANUAL === undefined) window.__AA_PAUSED_MANUAL = false;

    function isStale() {
        return (Date.now() - (window.__AA_HEARTBEAT || 0)) > TIMEOUT;
    }

    // Gozlemcinin tarama basindaki kontrolunu ele geciren getter.
    try {
        Object.defineProperty(window, '__AA_PAUSED', {
            configurable: true,
            get: function() { return window.__AA_PAUSED_MANUAL === true || isStale(); },
            set: function(v) { window.__AA_PAUSED_MANUAL = (v === true); }
        });
    } catch (e) {
        return 'watchdog-failed: ' + e.message;
    }

    if (window.__AA_WATCHDOG) clearInterval(window.__AA_WATCHDOG);
    window.__AA_WATCHDOG = setInterval(function() {
        if (!isStale()) return;
        try { if (typeof window.__AA_CLEANUP === 'function') window.__AA_CLEANUP(); } catch (e) {}
        window.__AA_OBSERVER_ACTIVE = false;
        window.__AA_SCRIPT_ID = null;
        clearInterval(window.__AA_WATCHDOG);
        window.__AA_WATCHDOG = null;
        console.log('[AA] Denetleyici yanit vermiyor — gozlemci sokuldu.');
    }, 2000);

    return 'watchdog-armed';
})()
`;
}

/** Denetleyicinin her turda calistirdigi kalp atisi tazeleme ifadesi. */
const HEARTBEAT_EXPR = 'window.__AA_HEARTBEAT = Date.now(); "ok"';

/**
 * Bekciyi ve getter'i tamamen kaldirir; `__AA_PAUSED` yeniden sade bir
 * veri ozelligi olur. Temizlik sirasinda kullanilir.
 */
const DISARM_EXPR = `(function(){
    if (window.__AA_WATCHDOG) { clearInterval(window.__AA_WATCHDOG); window.__AA_WATCHDOG = null; }
    try { delete window.__AA_PAUSED; } catch (e) {}
    window.__AA_PAUSED = false;
    window.__AA_PAUSED_MANUAL = false;
    return 'ok';
})()`;

module.exports = { buildWatchdogScript, HEARTBEAT_EXPR, DISARM_EXPR };
