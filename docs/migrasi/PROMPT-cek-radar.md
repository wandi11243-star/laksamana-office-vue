# Prompt: verifikasi Radar sesudah merge (untuk agen lain)

Salin blok di bawah ke sesi agen lain yang punya akses ke salinan database lokal
(Laragon + `tools/restore-dumps.sh`) dan ke browser dengan data dev.

---

Kamu memeriksa modul **Radar** yang baru di-merge ke `main` di dua repo:
`laksamana-api` (PR #194) dan `laksamana-office-vue` (PR #3). Baca dulu
`laksamana-api/CLAUDE.md`, `laksamana-api/docs/api/radar.md`,
`laksamana-office-vue/AGENTS.md`, dan `laksamana-office-vue/docs/migrasi/radar.md`.
Spesifikasi perilakunya ada di `laksamana-office/deploy/radar/index.html`
(READ-ONLY, jangan disunting). Jangan menyentuh data live — semua di salinan lokal.

Kerjakan, lalu laporkan hasil tiap nomor (lulus / gagal + buktinya):

1. **Feature test yang belum pernah dijalankan.** Di laksamana-api jalankan sekali
   masing-masing: `php artisan test tests/Feature/Radar`, `tests/Feature/Account`,
   `tests/Feature/Reservasi`, `tests/Feature/Marketing`. Laporkan baris `Tests:`.
   Kalau ada yang merah, perbaiki di branch baru dan buka PR.
2. **Bentuk data sungguhan.** `RadarBoard`/`RadarRules` ditulis dari membaca kode
   legacy, bukan dari data. Dengan dump lokal, panggil `GET /api/v1/radar/board`
   untuk rentang bulan berjalan dan bandingkan dengan Radar lama
   (`laksamana-office/deploy/radar`, lewat `tools/devproxy`): jumlah agenda per
   sumber, pax Marketing/Event/VIP, jumlah reservasi, dan tanggal acara Event yang
   start_datetime-nya lewat tengah malam UTC (harus digeser ke WIB).
3. **Penyaring uang.** Login sebagai user yang keterangannya TIDAK memuat kata utuh
   "Head" dan bukan admin radar: pastikan `bolehUang=false`, tidak ada `dpAmount`/
   `dpStatus` di reservasi, dan `mkt.detail` di endpoint detail tidak memuat kunci
   harga/deal/DP/pelunasan/biaya. Lalu ulangi sebagai Head: kuncinya muncul.
4. **Lampiran.** `GET /api/v1/radar/files/{key}` untuk (a) lampiran event Marketing
   yang ada di papan → 200, (b) kunci bukti bayar Marketing → 404.
5. **Vue di browser dengan API dev lokal** (bukan produksi): buka `/radar`,
   `/radar/kalender`, `/radar/agenda`, `/radar/reservasi`, `/radar/reservasi?tgl=<hari ini>`,
   `/radar/promo`, dan satu `/radar/detail/mkt/<id>`, di 390px dan 1366px, terang & gelap.
   Catat galat konsol, gulir mendatar, dan angka yang tidak cocok dengan nomor 2.
6. **Akses bawaan.** Pastikan akun biasa tanpa grant apa pun melihat kartu Radar di
   beranda Vue, dan akun dengan grant `radar` access=0 tidak.

Pertanyaan terbuka yang perlu kamu jawab dari data (bukan menebak), lalu tuliskan
jawabannya di `laksamana-office-vue/docs/migrasi/radar.md` §J:

- Apakah ada acara Marketing berstatus selain Deal/Confirmed/Event Done yang di Radar
  lama tetap tampil? (API memakai daftar putih itu.)
- Apakah `fbFormats` di state Marketing produksi berisi daftar sungguhan, atau null
  sehingga Vue jatuh ke daftar bawaan?
- Apakah ada Reservasi VIP tanpa `paxMax` maupun `paxMin`? (Kartu lalu menulis 0 pax.)
- Rentang bawaan `/radar/board` (hari ini −31 s.d. +62) cukup untuk Kalender, atau
  bulan yang jauh memicu banyak request? (Vue meminta per 6 minggu kisi.)

Aturan: satu PR per repo untuk perbaikan, jangan merge sendiri kecuali diminta,
laporkan singkat dalam bahasa Indonesia.
