// AutoAccept Lite — CDP port bulucu.
// Tek sorumluluk: calisan Antigravity'nin Chrome DevTools Protocol portunu bulmak.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

/**
 * Chromium, uzaktan hata ayiklama acikken secilen portu kullanici veri
 * dizinine `DevToolsActivePort` dosyasinin ILK satirina yazar.
 * Antigravity bu ozelligi varsayilan olarak acik birakir
 * (app.asar/dist/main.js: remote-debugging-port=0 → rastgele bos port),
 * bu yuzden kisayola bayrak eklemeye gerek yoktur.
 */
function candidateDirs() {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const home = os.homedir();
    if (process.platform === 'win32') {
        return [
            path.join(appData, 'Antigravity'),
            path.join(appData, 'Antigravity IDE'),
        ];
    }
    if (process.platform === 'darwin') {
        return [
            path.join(home, 'Library', 'Application Support', 'Antigravity'),
            path.join(home, 'Library', 'Application Support', 'Antigravity IDE'),
        ];
    }
    return [
        path.join(home, '.config', 'Antigravity'),
        path.join(home, '.config', 'Antigravity IDE'),
    ];
}

/**
 * Bir portta gercek bir CDP uc noktasi olup olmadigini dogrular.
 * Hayalet soketler TCP kabul edip gecerli JSON dondurmez; bu yuzden
 * govde icerigi de kontrol edilir.
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function probe(port) {
    return new Promise((resolve) => {
        const req = http.get(
            { hostname: '127.0.0.1', port, path: '/json/version', timeout: 1500 },
            (res) => {
                let data = '';
                res.on('data', (c) => (data += c));
                res.on('end', () => resolve(data.includes('{') && data.length > 5));
            }
        );
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
    });
}

/**
 * Kullanilabilir CDP portunu bulur.
 * Sira: elle verilen port → DevToolsActivePort dosyalari → yaygin sabit portlar.
 * @param {number|null} preferred config.json'daki port (null ise otomatik)
 * @returns {Promise<{port: number, source: string}|null>}
 */
async function discoverPort(preferred) {
    if (preferred) {
        if (await probe(preferred)) return { port: preferred, source: 'config.json' };
        return null; // Elle port verilmisse sessizce baska porta kaymayalim.
    }

    for (const dir of candidateDirs()) {
        const file = path.join(dir, 'DevToolsActivePort');
        try {
            if (!fs.existsSync(file)) continue;
            const port = parseInt(fs.readFileSync(file, 'utf8').split('\n')[0].trim(), 10);
            if (!port) continue;
            if (await probe(port)) {
                return { port, source: `DevToolsActivePort (${path.basename(dir)})` };
            }
        } catch (e) { /* dosya kilitli/okunamaz — sonraki adaya gec */ }
    }

    for (const port of [9333, 9222]) {
        if (await probe(port)) return { port, source: 'sabit port' };
    }

    return null;
}

module.exports = { discoverPort, probe };
