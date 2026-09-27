# Durum — aktas-mail

Güncelleme: 2026-09-26 22:00 | Son araç: claude

## Hedef

Telefonda "beni hatırla", aynı tarayıcıda çoklu hesap + geçiş, hızlı
çıkışların giderilmesi. Canlıda; `coklu-hesap-hatirla` dalında commit'li ve push'lu (cc6f9ac),
main'e birleştirilmedi.

## Yapıldı

- [x] Kök neden: oturum çerezlerinde `maxAge` yoktu → tarayıcı/uygulama
      kapanınca çerez siliniyordu. DB'deki oturumlar 30 gün geçerliydi,
      hiçbiri iptal edilmemişti (2026-09-25 sorgusu).
- [x] `sessions.remember` sütunu (`backend/sql/2026-09-25-beni-hatirla.sql`,
      canlı DB'ye uygulandı). Hatırlananlar kalıcı çerez + `/api/auth/me`'de
      kayan 30 gün (`extendSessions`).
- [x] Çoklu hesap: etkin hesap `am_session`'da, diğerleri `am_hesaplar`
      çerezinde (`routes/auth.ts`: `oturumuYerlestir`, `/api/auth/switch`,
      logout `{tumu}`; `/me` `hesaplar` döner). Arayüz: kenar çubuğunda
      hesap listesi, "Hesap ekle", "Tümünden çık".
- [x] "Tümünü okundu işaretle" artık klasörün okunmamış sayısına bakıyor;
      bildirim deneme düğmeleri herkese açık.
- [x] Canlıya çıktı; yedek `/root/aktas-mail-yedek-2026-09-25.tgz`.

- [x] **Arayüz (2026-09-26):** `claude/sweet-goodall-ex1c5q` (animasyonlar) bu dala birleştirildi (2588897);
      üstüne 8a5c7ef: SVG klasör/ataş simgeleri, okuyucuda ek listesi (indirme ucu YOK), telefonda liste
      alt boşluğu ("Yaz" son maili örtüyordu), arama "/" ipucu kbd'ye, mobil girişte tek logo + köşe tema
      düğmesi. Canlıda (yedek `/root/aktas-mail-frontend-yedek-2026-09-26.tgz`).

- [x] **Giden mail + imza (d220591, canlıda):** önceden yalnız düz metin gidiyordu, From'da ad yoktu.
      `backend/src/mail/sablon.ts` tek kaynak: HTML + düz metin, imza (settings.imza: ad, unvan, telefon,
      web, not, renk, acik), imza alıntının ÜSTÜNDE. `/api/messages/preview` (imza verilirse kayıtlı yerine).
      Ayarlar > İmza (canlı önizleme), yazma penceresinde Önizle/Düzenle. Testler `sablon.test.ts` (18).
      Yedek `/root/aktas-mail-yedek-2026-09-26b.tgz`.

- [x] **Hesap engelleme (b7a41ad, canlıda 2026-09-27):** teslimatta Dovecot Sieve. Sunucuya `dovecot-sieve`
      + `dovecot-managesieved` kuruldu; `/etc/dovecot/conf.d/99-akts-sieve.conf` (LMTP'de sieve, ManageSieve
      yalnız 127.0.0.1:4190, betikler `/var/mail/sieve/%d/%n/`), `local.conf`'ta `protocols = imap lmtp sieve`.
      Uygulama betiği kullanıcının parolasıyla ManageSieve'den yazıyor (`mail/engel.ts`); liste `settings.engellenenler`.
      `vacation :days 30` → "Engellendiniz", sonra `discard`. Gerçek teslimatla sınandı (geçici hesaplarla, silindi).
      Geri almak: 99-akts-sieve.conf sil, local.conf'tan `sieve` çıkar, `doveconf -n`, `systemctl reload dovecot`.
      Yedek: `/root/dovecot-yedek-2026-09-27.tgz`.
- [x] **CSS saldırıları (5ad753e):** <style>'da adres yükleyen her şey (url, image-set, @import…) siliniyor,
      kaçışlar çözülüp süzülüyor; Jarvis'e yalnız görünen metin.

## Sıradaki adım

Ek indirme ucu (`/api/messages/:uid/attachments/:i`) + okuyucudaki ek çiplerini bağlantı yapmak.
`coklu-hesap-hatirla`'yı main'e birleştirmek (Eymen isterse). Canlı bu dalla birebir aynı
(2026-09-25 `rsync -rcn` ile doğrulandı); main'den derleyip atma, değişiklikler geri gider.

## Bilinen tuzaklar

- Dağıtım elle: yerelde `npm run build` (backend) + `npx vite build` (frontend),
  `rsync -rc` ile `/opt/aktas-mail/{backend,frontend}/dist/`, sonra
  `chown -R aktasmail:aktasmail backend/dist` ve `pm2 restart aktas-mail`.
  macOS rsync'i `--chown` tanımıyor. `pm2 update` çalıştırma.
- Sunucudaki `/opt/aktas-mail` git geçmişi eski (force-push öncesi SHA'lar);
  oradaki git'e güvenme, dist'i karşılaştır (`rsync -rcn`).
- Yerel `.env` canlı DB'ye tünelle bağlanıyor. Test verisi için geçici PGlite
  (`@electric-sql/pglite-socket`) + `pg_dump -s` şeması kullanıldı.
- Browser pane ekran görüntüsü bir tur geride kalabiliyor; DOM'u JS ile ölç.
- Göz kontrolü için sahte veriyle önizleme: `frontend/mock.tsx` eski (yeni prop'lar yok). Geçici bir
  `onizleme.tsx` fetch'i taklit edip `<App>`'i çalıştırarak kullanıldı, commit'lenmedi.
- app.css'te temel kurallar (ör. `.login-top`, `.login-card`) dosyada medya bloklarından SONRA da
  tanımlı; medya içinde ezmek için özgüllük artır.
- `/etc/dovecot/local.conf` en son yükleniyor ve `protocols`'u sabitliyor; conf.d'deki `$protocols` eklemeleri ezilir.
- `sieve-test` root'la çalışmaz: `sudo -u vmail sieve-test -o mail_uid=vmail -o mail_gid=vmail -u <kullanıcı> …`.
