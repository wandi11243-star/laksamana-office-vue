# Jam datang panel JAM|MENIT (reservasi/input) — short design

## Intent & why
Field "Jam datang" di `/reservasi/input` sekarang teks bebas + datalist yang tidak mengikat:
ketikan menit ganjil lolos, nilai mustahil di-clamp diam-diam (25:99 → 23:59), HP tidak
dapat keypad jam, validasi baru muncul saat simpan. Aplikasi lama mengunci ke kelipatan
5 menit lewat panel popup dua kolom JAM | MENIT. Kita tiru panel itu 1:1 (keputusan user
2026-11-03, menggantikan segmen `UInputTime` dari Task 1 — snap/validasi helper Task 1
tetap dipakai sebagai penjamin).

## Goals / non-goals / anti-goals
- Goals: selalu 24 jam (tanpa AM/PM); nilai selalu kelipatan 5 menit; default 19:00 untuk
  booking baru seperti di lama; data lama non-kelipatan ikut dibulatkan dengan pemberitahuan,
  bukan diam-diam; tidak ada flash error saat ganti jam (cek bentrok tetap jalan).
- Non-goals: mengubah aturan cek bentrok meja, jam operasional, atau format simpan backend
  (tetap string `HH:MM` mentah).
- Anti-goals: menambah dependensi; mengubah 30 titik `type="time"` lain di repo.

## Constraints
- `laksamana-office/` read-only (acuan perilaku saja); backend tidak diubah.
- Tanpa hex/gradient, tanpa style `dark:`, ikon Lucide, copy Indonesia sentence case.
- Cek visual 390px & 1366px di browser; tanpa lint/typecheck/test sampai user bilang selesai
  (mode perbaikan visual yang disepakati).

## Approaches
- A (digantikan): `UInputTime` Nuxt UI v4 tersegmentasi — dikerjakan di Task 1 dan
  direview bersih, tapi user memilih panel klik seperti lama.
- B (dipilih — keputusan user 2026-11-03): panel popup JAM | MENIT 1:1 aplikasi lama
  (`timePickerHtml`, `deploy/reservasi/index.html:4067-4088`): tombol field membuka
  `UPopover` dua kolom — JAM 00–23 | MENIT 00, 05, …, 55 — klik langsung mengisi.
  Dibangun dari komponen Nuxt UI yang sudah ada (tanpa dependensi baru); di HP popup
  selebar field. Nilai tetap mengalir lewat `jamValue`/`snapJamKeLima`/`bagiJamMentah`;
  validasi dan format simpan tidak berubah.
- C (ditolak): native `type="time" step=300` — murah tapi tampilan tergantung browser/locale
  (alasan lama menghindarinya: AM/PM).

## Yang sudah diputuskan
- Kunci kelipatan 5 menit (keputusan user).
- Panel JAM | MENIT sebagai presentasi (keputusan user 2026-11-03).
- Default 19:00 untuk booking baru (parity lama) — my call, bisa dikoreksi.
- Nilai lama non-kelipatan: bulatkan ke kelipatan 5 terdekat + toast/info ke user — my call.
  (Disempurnakan final review: toleransi detik `HH:MM:SS`; toast hanya bila menit berubah.)
- Datalist 288 opsi + normalisasi toleran `normTime` di field ini dihapus; `normTime` tetap
  dipakai jalur lain (edit-cepat, cek bentrok).

## Diserahkan ke builder
- Panel popup: `UPopover` (atau `ResponsiveSheet` bila lebih cocok di HP — pilih yang
  konsisten dengan repo) berisi dua kolom tombol 00–23 dan 00–55; klik set nilai dan
  tutup (atau tetap buka sampai kedua kolom dipilih — ikuti perilaku lama: pilih jam
  lalu menit).
- Kolom yang sedang aktif ditandai (variant solid vs soft, tanpa hex); grid tetap rapi
  390px & 1366px.
- Teruskan perubahan jam ke pemicu cek bentrok yang sudah ada.
