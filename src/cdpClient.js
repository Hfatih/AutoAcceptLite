// AutoAccept Lite — minimal Chrome DevTools Protocol istemcisi.
// Tek sorumluluk: hedef listesini cekmek ve tek bir hedefe Runtime.evaluate gondermek.

const http = require('http');
const WebSocket = require('ws');

/**
 * 127.0.0.1:<port>/json/list uzerinden acik CDP hedeflerini getirir.
 * @param {number} port
 * @returns {Promise<Array<{id:string,type:string,title:string,url:string,webSocketDebuggerUrl:string}>>}
 */
function listTargets(port) {
    return new Promise((resolve, reject) => {
        const req = http.get(
            { hostname: '127.0.0.1', port, path: '/json/list', timeout: 3000 },
            (res) => {
                let data = '';
                res.on('data', (c) => (data += c));
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(new Error('hedef listesi cozulemedi')); }
                });
            }
        );
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('hedef listesi zaman asimi')); });
    });
}

/**
 * Tek bir CDP hedefine kalici WebSocket baglantisi.
 * Istekler id ile eslestirilir; her istegin kendi zaman asimi vardir.
 */
class CdpSession {
    /** @param {string} wsUrl Hedefin webSocketDebuggerUrl degeri */
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.dead = false;
        this._id = 0;
        this._pending = new Map();
        this.ws = new WebSocket(wsUrl, { maxPayload: 64 * 1024 * 1024 });

        this.ready = new Promise((resolve, reject) => {
            const t = setTimeout(() => { this._kill(new Error('baglanti zaman asimi')); reject(new Error('baglanti zaman asimi')); }, 5000);
            this.ws.on('open', () => { clearTimeout(t); resolve(); });
            this.ws.on('error', (err) => { clearTimeout(t); this._kill(err); reject(err); });
        });

        this.ws.on('message', (raw) => {
            let msg;
            try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
            const h = msg.id && this._pending.get(msg.id);
            if (!h) return;
            this._pending.delete(msg.id);
            clearTimeout(h.timer);
            if (msg.error) h.reject(new Error(msg.error.message || 'CDP hatasi'));
            else h.resolve(msg.result);
        });

        this.ws.on('close', () => this._kill(new Error('baglanti kapandi')));
    }

    _kill(err) {
        if (this.dead) return;
        this.dead = true;
        for (const h of this._pending.values()) { clearTimeout(h.timer); h.reject(err); }
        this._pending.clear();
        try { this.ws.terminate(); } catch (e) { /* zaten kapali */ }
    }

    /**
     * Ham CDP metodu gonderir.
     * @param {string} method ornegin 'Runtime.evaluate'
     * @param {object} params
     * @param {number} timeoutMs
     */
    send(method, params = {}, timeoutMs = 10000) {
        if (this.dead) return Promise.reject(new Error('baglanti olu'));
        return new Promise((resolve, reject) => {
            const id = ++this._id;
            const timer = setTimeout(() => {
                this._pending.delete(id);
                reject(new Error(`zaman asimi: ${method}`));
            }, timeoutMs);
            this._pending.set(id, { resolve, reject, timer });
            try { this.ws.send(JSON.stringify({ id, method, params })); }
            catch (e) { this._pending.delete(id); clearTimeout(timer); reject(e); }
        });
    }

    /**
     * Sayfa baglaminda JavaScript calistirir ve donen degeri cozer.
     * @param {string} expression
     * @param {number} timeoutMs
     * @returns {Promise<any>} ifadenin degeri (JS istisnasi olursa hata firlatir)
     */
    async evaluate(expression, timeoutMs = 10000) {
        const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeoutMs);
        if (res.exceptionDetails) {
            const d = res.exceptionDetails;
            throw new Error(d.exception?.description || d.text || 'sayfa istisnasi');
        }
        return res.result?.value;
    }

    close() { this._kill(new Error('kapatildi')); }
}

module.exports = { listTargets, CdpSession };
