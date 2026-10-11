// AutoAccept Lite — dil secimi ve metin tablosu.
// Tek sorumluluk: kullaniciya gorunen metinleri Turkce ya da Ingilizce dondurmek.

/** Her anahtar icin [Turkce, Ingilizce]. `{0}`, `{1}`... yer tutuculari t() doldurur. */
const MESSAGES = {
    alreadyRunning:   ['AutoAccept Lite zaten çalışıyor. İkinci pencere kapanıyor.', 'AutoAccept Lite is already running. Closing this second instance.'],
    alreadyRunningHint: ['Çalışan pencereyi bulamıyorsan: Görev Yöneticisi → node.exe → görevi sonlandır.', 'If you cannot find the running one: Task Manager → node.exe → End task.'],
    bannerSubtitle:   ['— Antigravity için, IDE gerekmez', '— for Antigravity, no IDE required'],
    bannerButtons:    ['Basılacak düğmeler', 'Buttons to click   '],
    bannerFilter:     ['Güvenlik filtresi ', 'Safety filter      '],
    bannerPort:       ['CDP portu         ', 'CDP port           '],
    bannerTargets:    ['Eşzamanlı sohbet  ', 'Concurrent chats   '],
    bannerCycle:      ['Aktif sohbet turu ', 'Active chat cycle  '],
    bannerBlocked:    ['{0} yasak kalıp', '{0} blocked patterns'],
    bannerAllowed:    ['{0} izinli kalıp', '{0} allowed patterns'],
    bannerPortAuto:   ['otomatik bulunacak', 'auto-detect'],
    bannerTargetUnit: ['{0} hedef', '{0} targets'],
    bannerOff:        ['kapalı', 'off'],
    bannerKeys:       ['[P] duraklat/devam    [Ctrl+C] çıkış', '[P] pause/resume    [Ctrl+C] exit'],
    paused:           ['DURAKLATILDI — hiçbir düğmeye basılmıyor', 'PAUSED — no buttons are being clicked'],
    resumed:          ['DEVAM EDİYOR', 'RESUMED'],
    closing:          ['Kapanıyor — bu oturumda {0} tıklama yapıldı.', 'Shutting down — {0} clicks this session.'],
    observerRemoved:  ['Gözlemci sayfalardan kaldırıldı.', 'Observer removed from the pages.'],
    startFailed:      ['Başlatılamadı: {0}', 'Failed to start: {0}'],
    configUnreadable: ['[config] config.json okunamadı ({0}) — varsayılanlar kullanılıyor', '[config] could not read config.json ({0}) — using defaults'],
    loopError:        ['döngü hatası: {0}', 'loop error: {0}'],
    notFound:         ['Antigravity bulunamadı — uygulamayı aç, otomatik bağlanacağım.', 'Antigravity not found — open the app and I will connect automatically.'],
    connected:        ['Bağlandı: 127.0.0.1:{0}  [{1}]', 'Connected: 127.0.0.1:{0}  [{1}]'],
    connectionLost:   ['Bağlantı koptu — Antigravity kapandı mı? Yeniden aranacak.', 'Connection lost — was Antigravity closed? Searching again.'],
    windowClosed:     ['Pencere kapandı: {0}', 'Window closed: {0}'],
    targetSkipped:    ['hedef atlandı: {0}', 'target skipped: {0}'],
    untitled:         ['isimsiz', 'untitled'],
    windowFound:      ['Pencere bulundu: {0}', 'Window found: {0}'],
    observerInstalled: ['Gözlemci kuruldu → {0}', 'Observer installed → {0}'],
    observerReplied:  ['Gözlemci yanıt verdi "{0}" → {1}', 'Observer replied "{0}" → {1}'],
    clicked:          ['TIKLANDI  "{0}"  →  {1}', 'CLICKED  "{0}"  →  {1}'],
    blocked:          ['ENGELLENDİ  {0} komut güvenlik filtresine takıldı → {1}', 'BLOCKED  {0} command(s) stopped by the safety filter → {1}'],
    activeChat:       ['AKTİF SOHBET → {0}  ({1} çalışan)', 'ACTIVE CHAT → {0}  ({1} running)'],
    cdpListParse:     ['hedef listesi çözülemedi', 'could not parse the target list'],
    cdpListTimeout:   ['hedef listesi zaman aşımı', 'target list timed out'],
    cdpConnectTimeout: ['bağlantı zaman aşımı', 'connection timed out'],
    cdpError:         ['CDP hatası', 'CDP error'],
    cdpClosed:        ['bağlantı kapandı', 'connection closed'],
    cdpDead:          ['bağlantı ölü', 'connection is dead'],
    cdpTimeout:       ['zaman aşımı: {0}', 'timed out: {0}'],
    cdpPageException: ['sayfa istisnası', 'page exception'],
    cdpShutdown:      ['kapatıldı', 'closed'],
};

/**
 * Bilgisayarin dilini bulur. Tepsi baslaticisi Windows goruntuleme dilini
 * AUTOACCEPT_LANG ile iletir; dogrudan `node index.js` calistirildiginda
 * isletim sisteminin yerel ayarina bakilir. Turkce disindaki her dil Ingilizce'ye duser.
 * @returns {'tr'|'en'}
 */
function detectLanguage() {
    const raw = process.env.AUTOACCEPT_LANG || Intl.DateTimeFormat().resolvedOptions().locale || '';
    return raw.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

let index = detectLanguage() === 'tr' ? 0 : 1;

/**
 * Dili elle sabitler (config.json `language`). 'tr' ve 'en' disindaki her
 * deger (ornegin 'auto' ya da tanimsiz) otomatik algilamayi korur.
 * @param {string} [lang]
 */
function setLanguage(lang) {
    if (lang === 'tr') index = 0;
    else if (lang === 'en') index = 1;
}

/**
 * Anahtarin secili dildeki metnini dondurur ve yer tutuculari doldurur.
 * Bilinmeyen anahtar oldugu gibi doner; boylece eksik ceviri sessizce kaybolmaz.
 * @param {string} key MESSAGES anahtari
 * @param {...any} args `{0}`, `{1}`... yerine konacak degerler
 * @returns {string}
 */
function t(key, ...args) {
    const entry = MESSAGES[key];
    if (!entry) return key;
    return entry[index].replace(/\{(\d+)\}/g, (match, n) => (n in args ? String(args[n]) : match));
}

module.exports = { t, setLanguage, detectLanguage, MESSAGES };
