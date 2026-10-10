// AutoAccept Lite — tek ornek kilidi.
// Tek sorumluluk: ayni anda birden fazla denetleyicinin calismasini engellemek.

const net = require('net');

/** Kilit olarak kullanilan localhost portu. Veri tasimaz, sadece yer tutar. */
const LOCK_PORT = 47311;

/**
 * Iki denetleyici ayni anda calisirsa birbirinin kalp atisini tazeler ve
 * "olu adam anahtari" hicbir zaman devreye girmez; ustelik ayni dugmeye iki
 * kez basilir. Kilit dosyasi yerine TCP portu kullanilir: surec nasil olurse
 * olsun (taskkill dahil) isletim sistemi portu birakir, bu yuzden bayat kilit
 * sorunu yoktur.
 *
 * @returns {Promise<{acquired: boolean, release: () => void}>}
 *   `acquired` false ise baska bir ornek zaten calisiyordur.
 */
function acquireLock() {
    return new Promise((resolve) => {
        const server = net.createServer();

        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') resolve({ acquired: false, release: () => {} });
            else resolve({ acquired: true, release: () => {} }); // Beklenmedik hata: kilidi engel yapma.
        });

        server.once('listening', () => {
            server.unref(); // Kilit, surecin kapanmasini geciktirmesin.
            resolve({ acquired: true, release: () => { try { server.close(); } catch (e) {} } });
        });

        server.listen(LOCK_PORT, '127.0.0.1');
    });
}

module.exports = { acquireLock, LOCK_PORT };
