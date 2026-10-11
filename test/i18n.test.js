// Calistir: node test/i18n.test.js
// Ceviri tablosunun iki dilde de eksiksiz ve yer tutuculari tutarli oldugunu dogrular.

const assert = require('assert');
const { t, setLanguage, MESSAGES } = require('../src/i18n');

const holes = (s) => (s.match(/\{\d+\}/g) || []).sort().join();

for (const [key, pair] of Object.entries(MESSAGES)) {
    assert.strictEqual(pair.length, 2, `${key}: iki dil olmali`);
    assert.ok(pair[0] && pair[1], `${key}: bos ceviri`);
    assert.strictEqual(holes(pair[0]), holes(pair[1]), `${key}: yer tutucular uyusmuyor`);
}

setLanguage('tr');
assert.strictEqual(t('connected', 9222, 'x'), 'Bağlandı: 127.0.0.1:9222  [x]');
setLanguage('en');
assert.strictEqual(t('connected', 9222, 'x'), 'Connected: 127.0.0.1:9222  [x]');
setLanguage('auto'); // bilinmeyen deger secili dili degistirmez
assert.strictEqual(t('resumed'), 'RESUMED');
assert.strictEqual(t('yok-boyle-anahtar'), 'yok-boyle-anahtar');

console.log(`i18n ok — ${Object.keys(MESSAGES).length} metin, 2 dil`);
