# Tanggal kalender + pintasan (reservasi/input & edit-cepat) — short design

## Intent & why
Field "Tanggal reservasi" di `/reservasi/input` sekarang input tanggal bawaan browser:
tampilan beda per browser/HP, tanpa pintasan cepat, tanggal lampau baru ditolak saat
submit. Aplikasi lama memakai date-picker kalender popup + pintasan Hari Ini/Besok/Lusa
(`deploy/reservasi/index.html:4087-4149`) karena alasan yang sama. Kita tiru 1:1
dengan komponen Nuxt UI (keputusan user 2026-11-03), termasuk quick-edit
(`ReservasiEditCepat`, yang di lama masih native — user memilih termasuk).

## Goals / non-goals / anti-goals
- Goals: kalender popup grid bulanan label Indonesia; tanggal lampau tidak bisa diklik
  (min = hari ini; mode edit dengan tanggal lampau: tanggal itu tetap bisa dipilih,
  parity lama); pintasan Hari Ini / Besok / Lusa; format simpan tetap `YYYY-MM-DD`.
- Non-goals: mengubah aturan cek bentrok, denah per tanggal, atau validasi backend;
  bagian jam di edit-cepat tidak disentuh.
- Anti-goals: menambah dependensi; mengubah picker tanggal di luar reservasi.

## Constraints
- `laksamana-office/` read-only; backend tidak diubah.
- Tanpa hex/gradient, tanpa style `dark:`, ikon Lucide, copy Indonesia sentence case,
  komentar Inggris.
- Cek visual 390px & 1366px di browser; tanpa lint/typecheck/test/commit sampai user
  bilang selesai (mode perbaikan visual).

## Approaches
- Dipilih: `UCalendar` Nuxt UI v4 (reka-ui Calendar, `@internationalized/date` sudah
  terbundel — tanpa install) dalam `ResponsiveSheet` (pola repo untuk form; konsisten
  dengan panel jam Task 3; nol pemakaian `UPopover` di repo) + deretan tombol pintasan.
  Wiring string `YYYY-MM-DD` ↔ `DateValue` via `parseDate` saat baca/tulis.
  `minValue` = hari ini (atau tanggal lama bila edit-tanggal-lampau).
- Ditolak: native `type="date"` tetap (masalah lama berulang); `UPopover` (sempit di 390px,
  nol preseden repo); `UInputDate` tersegmen (ketik, bukan kalender klik seperti lama).

## Yang sudah diputuskan
- Cakupan: form utama + quick-edit (keputusan user).
- Presentasi: `ResponsiveSheet` + `UCalendar` (`locale="id"`) + tombol Hari Ini/Besok/Lusa
  (keputusan user untuk pintasan; sheet adalah my call — konsisten panel jam).
- Edit tanggal lampau: min mengikuti tanggal lama bila lebih tua dari hari ini (parity
  lama `min: r.date < today ? r.date : today`); validasi submit tidak berubah.
- Label tombol: format Indonesia panjang ("Sen, 3 Nov 2026") — my call, pakai helper
  tanggal yang sudah ada bila cocok.

## Diserahkan ke builder
- Prop `UCalendar` persis (`minValue` sebagai `DateValue`, `locale`) + konversi
  `parseDate`/`toString` (cek `.d.vue.ts` saat implementasi).
- Pintasan menulis `form.date` langsung (tetap string) agar watcher denah/cek bentrok
  yang sudah ada ikut terpicu.
- Di edit-cepat: hanya bagian tanggal yang diganti; bagian jam dan logika simpan
  tidak disentuh.
