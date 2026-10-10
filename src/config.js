// AutoAccept Lite — Ayar yükleyici ve güvenlik ön tanımları.
// Tek sorumluluk: config.json'u oku, eksikleri varsayılanla doldur, doğrula.

const fs = require('fs');
const path = require('path');

/**
 * Tehlikeli komut kalıpları. Bir "Run" düğmesinin yanındaki <pre>/<code>
 * bloğu bu kalıplardan biriyle eşleşirse düğmeye BASILMAZ; düğme
 * "Blocked by Filter" olarak işaretlenir ve kullanıcının kendi onayını bekler.
 * Kaynak: upstream AntiGravity AutoAccept dashboard "Safety Presets" listesi.
 */
const SAFETY_PRESETS = [
    'rm -rf /', 'rm -rf /*', 'rm -rf ~', 'rm -rf .*', 'rm -rf .git',
    'rmdir /s /q c:\\', 'rmdir /s /q d:\\', 'rd /s /q c:\\', 'rd /s /q d:\\',
    'del /f /s /q c:\\', 'del /f /s /q d:\\',
    'remove-item -recurse -force c:\\', 'remove-item -recurse -force d:\\',
    'format c:', 'format d:', 'diskpart', 'clear-disk', 'format-volume',
    'remove-partition', 'initialize-disk',
    'dd if=/dev/zero', 'dd if=/dev/urandom', 'dd if=/dev/random',
    'mkfs.', 'wipefs', 'shred ', 'vssadmin delete shadows', 'reg delete hk',
    'chmod -r 777 /', 'chown -r root /', 'sudo su', 'su -',
    '| bash', '| sh', '| zsh', '| pwsh',
    'invoke-expression', 'iex (', 'set-executionpolicy bypass',
    'drop database', 'drop table', 'truncate table', 'db.dropdatabase()',
    'docker system prune -a --volumes', 'docker volume prune', 'docker volume rm',
    'git push --force', 'git push -f', 'git clean -fdx',
    ':(){ :|:& };:', 'shutdown ', 'stop-computer',
];

/** config.json bulunamazsa kullanılan varsayılanlar. */
const DEFAULTS = {
    port: null,                 // null = DevToolsActivePort dosyasından otomatik bul
    autoAcceptFileEdits: true,  // "Accept" (dosya düzenlemesi) düğmelerine bas
    autoRetryEnabled: true,     // "Retry" / "Continue" düğmelerine bas
    customButtonTexts: [],      // ek düğme metinleri (ör. Türkçe UI için)
    useSafetyPresets: true,     // yukarıdaki 48 kalıbı blokla
    blockedCommands: [],        // kullanıcının kendi ek yasak kalıpları
    allowedCommands: [],        // doluysa SADECE bunlar çalıştırılır (blok listesi önceliklidir)
    heartbeatMs: 2000,          // hedef tarama, kalp atisi ve durtme araligi
    maxConcurrentTargets: 12,   // ayni anda denetlenecek sohbet/pencere sayisi
    autoCycleActiveConversations: true, // tek sayfadaki calisan sohbetler arasynda dolaş
    conversationSwitchMs: 1500, // iki aktif sohbet gecisi arasindaki en kisa sure
    verbose: false,             // her taramayı yazdır
};

/**
 * config.json'u okur ve tam bir ayar nesnesi döndürür.
 * Dosya yoksa varsayılanlarla devam eder — hata fırlatmaz.
 * @param {string} rootDir Proje kök dizini
 * @returns {typeof DEFAULTS & {blockedCommands: string[]}}
 */
function loadConfig(rootDir) {
    const file = path.join(rootDir, 'config.json');
    let user = {};
    if (fs.existsSync(file)) {
        try {
            user = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (e) {
            console.error(`[config] config.json okunamadi (${e.message}) — varsayilanlar kullaniliyor`);
        }
    }

    const cfg = { ...DEFAULTS, ...user };

    // Güvenlik ön tanımları kullanıcının kendi listesinin ÖNÜNE eklenir.
    const blocked = [];
    if (cfg.useSafetyPresets) blocked.push(...SAFETY_PRESETS);
    for (const p of cfg.blockedCommands || []) {
        if (!blocked.includes(p)) blocked.push(p);
    }
    cfg.blockedCommands = blocked;

    if (!Array.isArray(cfg.allowedCommands)) cfg.allowedCommands = [];
    if (!Array.isArray(cfg.customButtonTexts)) cfg.customButtonTexts = [];
    if (typeof cfg.heartbeatMs !== "number" || cfg.heartbeatMs < 1000) cfg.heartbeatMs = 2000;
    if (!Number.isInteger(cfg.maxConcurrentTargets)) cfg.maxConcurrentTargets = DEFAULTS.maxConcurrentTargets;
    // CDP tarafinda yuzlerce hedef (eklenti, DevTools vb.) gorunebilir. Hem sistemin
    // rahat kalmasi hem de acik sohbetlerin birbirini beklememesi icin makul bir sinir.
    cfg.maxConcurrentTargets = Math.max(1, Math.min(64, cfg.maxConcurrentTargets));
    if (typeof cfg.autoCycleActiveConversations !== 'boolean') cfg.autoCycleActiveConversations = true;
    if (typeof cfg.conversationSwitchMs !== 'number' || cfg.conversationSwitchMs < 500) {
        cfg.conversationSwitchMs = DEFAULTS.conversationSwitchMs;
    }
    cfg.conversationSwitchMs = Math.min(30000, Math.round(cfg.conversationSwitchMs));

    return cfg;
}

module.exports = { loadConfig, SAFETY_PRESETS, DEFAULTS };
