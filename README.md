# TürkSohbet

Tamamen Türkçe arayüzlü, telefon ekranlarına uyumlu, Socket.IO ile gerçek zamanlı ortak sohbet uygulaması.

## İçindekiler

- `public/index.html` — ekran yapısı
- `public/style.css` — beyaz/mavi tasarım, mobil uyum ve animasyonlar
- `public/app.js` — giriş doğrulaması ve sohbet arayüzü
- `server.js` — gerçek zamanlı Node.js sunucusu

## Öne çıkanlar

- İsim: 3–16 karakter; Türkçe harfler ve rakamlar kabul edilir. Boşluk ve semboller kabul edilmez.
- Aynı isim aynı anda iki kullanıcı tarafından kullanılamaz.
- Mesaj sınırı 1000 karakterdir.
- Sunucu tarafında mesaj sıklığı sınırı vardır.
- Son 80 sohbet olayı sunucu belleğinde tutulur; sunucu yeniden başlarsa geçmiş silinir.
- Hesap/şifre ve kalıcı mesaj veritabanı yoktur.
- Mesajlar HTML olarak çalıştırılmaz; metin olarak gösterilir.

## 1. Bilgisayarda deneme

Node.js 20 veya daha yeni bir sürüm kurulu olmalı.

```bash
npm install
npm start
```

Tarayıcıda `http://localhost:3000` adresini aç. Birden fazla tarayıcı sekmesinde açarak gerçek zamanlı mesajlaşmayı deneyebilirsin. Sağlık kontrolü: `http://localhost:3000/health`.

## 2. Sunucuyu internete yayımlama (Render örneği)

Bir APK'nın tüm kullanıcılara aynı sohbeti göstermesi için sunucu herkese açık bir HTTPS adresinde sürekli çalışmalıdır. Kaynak kodu bu ZIP'te var; ancak bu proje ZIP'i tek başına internete yayımlanmış bir sunucu değildir. Barındırma hesabını senin oluşturup dağıtımı başlatman gerekir.

1. ZIP'i aç ve içindekileri yeni bir GitHub deposuna yükle.
2. Render panelinde **New → Web Service** seçip bu depoyu bağla.
3. **Root Directory** boş kalsın; **Build Command** alanına `npm install`, **Start Command** alanına `npm start` yaz.
4. Node çalışma zamanı seçili olsun ve dağıtımı başlat.
5. Servis hazır olunca verilen `https://...onrender.com` adresini aç. Ana ekran görünmeli; `/health` adresi JSON durum bilgisi döndürmeli.
6. Ücretsiz barındırma planlarının uyku/uyanma ve kaynak sınırları olabilir; uygulamanın ilk bağlantısı bu nedenle gecikebilir. Kesintisiz kullanım gerekiyorsa servis koşullarını ve uygun barındırma planını kontrol et.

Render adımlarının resmi kılavuzu: https://render.com/docs/deploy-node-express-app

## 3. APK yapıcıya bağlama

**En kolay yol:** APK yapıcın WebView/website URL desteği sunuyorsa yayımlanmış `https://...onrender.com` adresini uygulama ana sayfası olarak tanımla. Böylece `SERVER_URL` değiştirmene gerek kalmaz; web arayüzü ve Socket.IO aynı sunucudan gelir.

**APK yapıcı HTML/CSS/JS dosyalarını yerel pakete kopyalıyorsa:**

1. `public` klasöründeki `index.html`, `style.css`, `app.js` dosyalarını APK yapıcının istediği yere koy.
2. `public/app.js` dosyasının en üstündeki `SERVER_URL` satırına yayımlanmış adresini yaz. Örnek:

   ```js
   const SERVER_URL = 'https://senin-servis-adin.onrender.com';
   ```

3. `index.html` içindeki Socket.IO istemcisi HTTPS CDN'den yüklenir; uygulamanın internet erişimi açık olmalı. APK yapıcısında uzaktaki HTTPS/WebSocket bağlantılarına izin verildiğinden emin ol.
4. APK'yı oluşturduktan sonra iki farklı cihazdan bağlanıp mesajların karşılıklı geldiğini test et.

> `SERVER_URL` alanında örnek adresi değil, dağıtım sonrası sana verilen gerçek URL'yi kullan.

## 4. Önemli notlar

- **Gerçek zamanlı özellik için internet gerekir.** Yalnızca HTML dosyaları çevrimdışı paketlenirse kullanıcılar aynı sohbette buluşamaz; Node.js sunucusu ayrıca çalışmalıdır.
- Bu başlangıç projesinde sohbet genel ve herkese açıktır. Kullanıcı kimlik doğrulaması, yönetici/moderasyon paneli, şikâyet inceleme sistemi ve kalıcı veritabanı bulunmaz. Yaygın kullanıma açmadan önce moderasyon/şikâyet akışı, kötüye kullanım önlemleri, gizlilik metni ve yedekleme ihtiyacı ayrıca değerlendirilmelidir.
- İsimler sadece çevrimiçi oturum boyunca rezerve edilir. Sunucuda hesap açılmaz.
- Mesaj geçmişi RAM'de tutulur; yeniden başlatma veya servis yeniden dağıtımı geçmişi silebilir.
- Kullanıcıların gerçek kimlik, telefon, adres veya parola gibi özel bilgileri sohbette paylaşmaması gerektiğini arayüzü kullanan kişilere bildir.
