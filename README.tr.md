# AutoAccept Lite

Antigravity masaüstü uygulamasındaki `Run`, `Accept`, `Always Allow`, `Retry`, `Continue` ve seçili özel düğmelere basan Windows aracı.

**[English](README.en.md) · [Türkçe](README.tr.md)**

## Windows uygulaması

`AutoAcceptLite-Kurulum-1.1.3.exe` dosyasını çalıştırıp kurulumu tamamlayın. Node.js ve `ws` paketi kurulum dosyasına dahildir. Antigravity açıkken **AutoAccept Lite** kısayolunu başlatın. Uygulama konsol açmadan bildirim alanında çalışır.

En yeni kaynak sürümü 1.1.3'tür: Antigravity arka plandayken (başka pencerenin arkasında ya da küçültülmüş) onayların gecikmesi ya da hiç yapılmaması giderildi. Chromium gizli sayfada zamanlayıcıları kısıp çizimi durdurduğu için uygulama artık sayfayı uyanık tutar; kapatmak için `config.json` içinde `"keepActiveInBackground": false` yazın. 1.1.2'de tepsi başlatıcısının motoru donduran günlük hatası giderildi, arayüz Windows diline göre Türkçe ya da İngilizce açılır. Kaynaktan kurulum üretmek için [`packaging/windows/README.md`](packaging/windows/README.md) yönergelerini izleyin.

Sağ alttaki bildirim alanında AutoAccept Lite simgesine sağ tıklayın:

- **Günlüğü göster:** durum ve hata satırlarını gösterir. Simgeye çift tıklamak da günlük penceresini açar.
- **Duraklat / Devam et:** otomatik tıklamaları geçici olarak durdurur veya sürdürür.
- **Motoru yeniden başlat:** ayar değişikliğinden sonra ya da motor durduğunda motoru yeniden başlatır.
- **Çıkış:** gözlemciyi Antigravity sayfalarından kaldırıp uygulamayı kapatır.

Windows simgeyi gizli simgeler okunun arkasına alırsa oku açıp AutoAccept Lite simgesini bulabilirsiniz. Günlük penceresi ilk açılışta gizlidir; pencerenin X düğmesi yalnızca pencereyi gizler. Uygulama Windows açılışında kendiliğinden başlamaz.

Dil, Windows görüntüleme diline göre seçilir: Türkçe ise Türkçe, diğer dillerde İngilizce. Sabitlemek için `config.json` içinde `"language"` değerini `"tr"` ya da `"en"` yapın. Görev Yöneticisi'nde uygulama **AutoAccept Lite** (bildirim alanı) ve **Node.js JavaScript Runtime** (motor) olarak iki satır görünür.

## Geliştirici kullanımı

Node.js 22 veya uyumlu güncel bir sürüm ile proje klasöründe:

```powershell
npm install
npm start
```

Geliştirici modunda terminalde `P` duraklatır/devam ettirir, `Ctrl+C` çıkar. Windows kurulum paketini üretme adımları [`packaging/windows/README.md`](packaging/windows/README.md) dosyasındadır.

## Nasıl çalışır

Araç Antigravity'nin kendi yerel Chrome DevTools Protocol (CDP) uç noktasını bulur, açık renderer pencerelerini izler ve sayfa içindeki düğmeleri `MutationObserver` ile takip eder. Uygulama Antigravity'ye, VS Code'a veya bir eklentiye kurulmaz. Kendi CDP portunu açmaz. Ağ üzerinden başka bir makineye bağlanmaz; CDP bağlantısı `127.0.0.1` üzerindedir.

## Güvenlik sınırları

- Başlangıçta bazı bilinen yıkıcı komut kalıpları filtrelenir. Liste `src/config.js` içindedir; `config.json` üzerinden ek yasak ve izinli kalıplar tanımlanabilir.
- Komut metni okunamıyorsa filtre riskli işlemi tanıyamayabilir. Güvenlik filtresi tam bir karantina değildir.
- `customButtonTexts` varsayılanı `submit` içerir. Bu düğme soru yanıtı olmadan devam edebilir. Bu davranışı istemiyorsanız `config.json` listesinden `submit` değerini kaldırın.
- `autoAcceptFileEdits` varsayılan olarak açıktır. Dosya değişikliklerini kendiniz incelemek için `false` yapın.
- Kaynak kodunu ve varsayılan ayarları yayınlamadan önce gözden geçirin; kullanıma uygun ayarları siz seçin.

## Lisanslar

Bu projenin kodu MIT lisansı altındadır (`LICENSE`). `src/DOMObserver.js`, MIT lisanslı [AntiGravity-AutoAccept](https://github.com/yazanbaker94/AntiGravity-AutoAccept) projesinden alınmıştır; özgün lisans ve telif bildirimi `LICENSE.upstream` içinde korunur.

Windows paketindeki Node.js çalışma zamanı OpenJS Foundation lisans koşullarına tabidir; bildirim `LICENSE.node.txt` dosyasındadır.
