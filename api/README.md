# vAdBlock SponsorSkip — Kendi Sunucu Kurulumu

Sponsor segment verileri kendi MySQL veritabanında (vade.pro) saklanır.
Eklenti kendi sunucundan çeker, boşsa açık SponsorBlock API'sine düşer.
Kullanıcılar "Segment Ekle" ile katkı yapar, veritabanın büyür.

## 1. Veritabanı tablosunu kur

1. cPanel → **phpMyAdmin** → `vadepro_adblock` veritabanını aç.
2. **Import** sekmesi → `api/schema.sql` dosyasını seç → Git.
3. `segments` tablosu oluşur.

## 2. API dosyalarını yükle

1. `api/` klasöründeki 2 PHP dosyasını FTP veya cPanel **File Manager** ile sitenin kök dizinine yükle:
   - `public_html/api/config.php`
   - `public_html/api/skipegments.php`
2. `config.php` içinde DB bilgileri zaten yazılı (vadepro_adblock).
   Bağlantı kurulmazsa cPanel'den veritabanının host adresini kontrol et
   (çoğu paylaşımlı hostingte `localhost`).

## 3. Test et

Tarayıcıda aç:

```
https://vade.pro/api/skipegments.php?videoID=dQw4w9WgXcQ
```

Boş dizi `[]` dönmeli (veri yok) — yani API çalışıyor.

Segment ekleme testi (PowerShell/curl):

```powershell
curl.exe -s -X POST https://vade.pro/api/skipegments.php -H "Content-Type: application/json" -d '{"videoID":"dQw4w9WgXcQ","startTime":10,"endTime":30,"category":"sponsor","userID":"test-user-123"}'
```

Ardından GET ile aynı videoID sorgulanınca segment dönmeli.

## 4. Eklentide ayarla

- **options.html → Genel → Sponsor Atlama**: API adresi varsayılan
  `https://vade.pro/api`. Farklı bir adres kullanıyorsan buradan değiştir.
- `sponsorAutoSkip` = otomatik atla / manuel buton seçimi
- `sponsorShowAdd` = "Segment Ekle" butonunu göster/gizle

## Notlar

- CORS zaten `config.php`'de açık (`Access-Control-Allow-Origin: *`).
- Aynı kullanıcıdan ±2 sn içinde aynı aralık tekrar gönderilirse kaydedilmez
  (çift katkı koruması).
- Veritabanı boşken eklenti otomatik olarak açık SponsorBlock API'sinden veri
  çeker; katkılar biriktikçe kendi verin öncelikli kullanılır.
