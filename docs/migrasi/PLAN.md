# Rencana migrasi laksamana-office → laksamana-office-vue

Dokumen induk. Dikerjakan oleh agen (satu tugas per sesi) dan diawasi owner.
Semua file lain di folder ini adalah rinciannya.

| file | isi |
|---|---|
| [README.md](README.md) | indeks inventaris per modul (hasil riset) |
| `<modul>.md` | inventaris satu modul: layar, aksi, field, rumus, pemetaan endpoint |
| [_pertanyaan.md](_pertanyaan.md) | aturan umum U1–U5, keputusan owner (K), jawaban (T) |
| [_gap-api.md](_gap-api.md) | yang kurang di laksamana-api (G) |
| [_lintas-modul.md](_lintas-modul.md) | ketergantungan antarmodul & aset bersama |
| [00-fondasi.md](00-fondasi.md) | Fase 1: kode bersama sebelum modul |
| [cutover.md](cutover.md) | Fase 3: memindahkan user per modul |
| [PROMPT-fondasi.md](PROMPT-fondasi.md) · [PROMPT-modul.md](PROMPT-modul.md) | prompt siap-kirim untuk agen |
| [TIM-A.md](TIM-A.md) | **kerja paralel Tim A**: issue, branch, jalur, kepemilikan file |

## 1. Prinsip

1. **laksamana-office adalah spesifikasi, bukan kode yang disalin.** Vue meniru perilakunya
   (paritas, U1) **dan tata letaknya** (keputusan mentor 29 September 2026): susunan layar, kolom tabel,
   kartu statistik, dan warna Office lama, dibangun ulang dengan blok `DESIGN.md` (ikon Lucide pengganti
   emoji, kontras dibetulkan, daftar kartu di HP). Contoh jadi: modul Reservasi. Usulan "padanan DESIGN.md"
   di bagian H inventaris yang menyuruh membuang kartu angka/label kapital sudah tidak berlaku.
2. **Vue hanya bicara dengan `/api/v1`.** Tidak pernah memanggil `*-api-mysql/api.php`.
   Satu-satunya pengecualian: prakiraan Stock/Ordering memanggil Google Apps Script seperti lama (K-06).
3. **Office lama tetap hidup selama migrasi.** Menurut ADR-0005 laksamana-api (production)
   melayani v1 dari database legacy yang SAMA, dengan lock yang sama. Jadi user bisa memakai
   modul lama dan Vue bersamaan tanpa data terbelah.
4. **Satu issue = satu branch = satu PR.** Sejak 2026-10-06 modul dikerjakan paralel per jalur oleh Tim A;
   aturan klaim issue, branch, dan kepemilikan file ada di [TIM-A.md](TIM-A.md).
5. **Tidak menunggu gap API.** Bagian yang terblokir tampil "Segera" dan dicatat di PR (lihat `_gap-api.md`).
6. **Keputusan owner (K) yang masih kosong = bagian itu ditunda**, bukan ditebak.

## 2. Fase

| fase | apa | hasil |
|---|---|---|
| 0 | Riset & triase | ✅ inventaris 17 modul, `_pertanyaan.md`, `_gap-api.md` |
| 1 | Fondasi (`00-fondasi.md`) | helper versi/konflik, roster, format, konvensi layar |
| 2 | Bangun per modul (urutan §3) | halaman Vue per modul, satu PR per modul |
| 3 | Cutover per modul (`cutover.md`) | user pindah ke Vue, layar lama dipensiunkan |

Fase 2 dan 3 berjalan berdampingan: modul yang sudah di-merge bisa masuk cutover
sementara modul berikutnya dibangun.

## 3. Urutan bangun (Fase 2)

Urutan mempertimbangkan ukuran, risiko, dan **siapa yang membangun komponen bersama lebih dulu**.

| # | modul (`key` Vue) | cakupan | butuh keputusan | dibangun di sini untuk dipakai ulang | status |
|---|---|---|---|---|---|
| 1 | absensi | lengkapi: Riwayat penuh (T-06), Antrean, Atur (K-03). Punch & wajah BELUM (lihat §3 baris 15) | — | — | ✅ (K-02 punch & daftar wajah menyusul di §3 baris 15) |
| 2 | akademi | 13 layar | — | — | ⚠️ (gelombang 1, 2026-10-01; cek visual #19 2026-10-09; 3 tombol sync/restore "Segera", G-16/G-17/G-18 menunggu owner di `laksamana-api#228`) |
| 3 | hlife | 14 layar | K-01 (G-13) | — | ⚠️ (gelombang 1, 2026-10-01; cek visual #19 2026-10-09; Reset data "Segera" K-01/G-13 `laksamana-api#187`) |
| 4 | konten | 20 layar | K-01 (G-13), K-05 | `performa-konten.ts`, `xlsx-baca.ts` | ✅ (20 layar digabung 2026-10-08, #66–#69; G-01 hapus performa per platform #110; antrean desain lintas modul G-20 #112; impor/reset massal "Segera" G-13) |
| 5 | bd | 11 layar | — (G-02) | — | ✅ (gelombang 1, 2026-10-01; cek visual #19 2026-10-09; master vendor G-02 tersambung #109) |
| 6 | hr | 17 layar | K-01 (G-13), K-05 | `people-score.ts` | ✅ (dibangun 2026-10-07 + cek visual mock 1366/390 sebagai HRD & kru; impor/reset massal "Segera" G-13; sinkron roster subset aman) |
| 7 | jadwal | jadwal + dw + roster, 20 layar | K-10 (G-03/05) | `pax-harian.ts` (`satukan()`) | ✅ (dibangun 2026-10-07; cek visual mock 1366/390 untuk bagian 1, 4–5; bagian 2–3 Jadwal Shift dilewati atas persetujuan owner; blok DW G-03 & pax tamu G-05 tersambung 2026-10-09, #108) |
| 8 | reservasi | reservasi + service_excellent, 12 layar | K-05: OCR `tesseract.js` diizinkan, lazy (G-07/08) | `DanaMasukPanel`, `Denah` + `venue-layouts.ts`, `kwitansi.ts` | ✅ (ringkasTamu G-07 + paging/ekspor server G-08 tersambung #113, 2026-10-09) |
| 9 | cashier | 11 layar | K-04 | `cocok-bri.ts`, `porsi-pic.ts` | ✅ (11/11 layar digabung ke main 2026-10-07; sisa gap G-19 di `laksamana-api#233`) |
| 10 | finance | omset + kas + brankas + rekap, 29 layar | K-04 (G-06) | `performa-bonus.ts` | ✅ (4/4 sub-issue digabung ke main 2026-10-07: #38, #39, #40 kas 15/15, #41 brankas 7/7; cek visual mock 1366/390; saldo wallet G-06 tersambung #109; master vendor untuk finance G-21 di api PR #262) |
| 11 | stock | 5 panel, 26 layar | K-05 (ekspor CSV), K-06 (Apps Script), K-07 | — | ✅ (5 panel digabung 2026-10-08, #17 bagian 1–5 s.d. #72) |
| 12 | event | 17 layar staf | K-01 (G-13), K-08, K-09 (G-10) | — | ✅ (17 layar staf #73, 2026-10-08; koreksi check-in G-10 #107; impor/reset "Segera" G-13) |
| 13 | marketing | 23 layar + detail event | K-05 (G-09) | `hpp-mesin.ts` | ✅ (23 layar + detail event, #59–#63 digabung s.d. #98, 2026-10-09; kalkHistori G-09 #111; Request Design G-20 #112) |
| 14 | analytics, radar, investor, help | modul yang belum ada di `utils/modul.ts` | — | — | ✅ radar, help, analytics (18 layar, #93–#95), investor (#74) |
| 15 | absensi (punch) | punch kamera wajah + GPS, daftar wajah (K-02). Paling akhir; face-api diizinkan untuk tugas ini | K-02 | — | ⬜ |
| 16 | homepage (greenfield) | 5 layar: Ringkasan, Menu, Berita, Event, Promo — panel website (katalog menu, berita, saklar event & slider promo) | — | — | 🟡 Menu & Berita ✅; Event baru 2026-09-30, Promo baru 2026-09-30 (visual belum dicek) |

Catatan cakupan:
- **Ticketing publik (toko & sesi Buyer) BUKAN bagian Office Vue.** Office hanya untuk User ber-Sesi
  (`laksamana-api/CONTEXT.md`). Hanya layar staf Event yang dibangun.
- Modul besar (≥ 20 layar) boleh dipecah jadi beberapa PR per kelompok layar, tetap berurutan.
- **Urutan §3 bukan urutan kerja.** Reservasi (#8) dikerjakan lebih dulu atas permintaan owner 2026-09-29,
  jadi `venue-layouts.ts`, `Denah` dan `DanaMasukPanel` tersedia lebih awal untuk marketing, cashier,
  finance, analytics, dan konten. Modul lain tetap boleh mulai lebih dulu dari modul yang*cuma* tidak
  butuh aset bersama itu.

## 4. Logika bersama — pemilik tunggal

Dipindah oleh modul pemilik ke `app/utils/<nama>.ts` (fungsi murni, tanpa panggilan API, tanpa Vue).
Modul lain mengimpor. **Menyalin rumus ke file kedua adalah pelanggaran** — insiden "berkas kembar
tertinggal" di Office lama (`laksamana-office/CLAUDE.md:2611-2637`) persis karena ini.

| file Vue | sumber lama | pemilik | pemakai lain |
|---|---|---|---|
| `performa-konten.ts` | `deploy/assets/performa-konten.js` | konten | analytics |
| `xlsx-baca.ts` | `deploy/assets/xlsx-baca.js` (bergantung K-05) | jalur fondasi (dulu konten, TIM-A.md §3) | jadwal, cashier, finance, analytics |
| `people-score.ts` | mesin skor di `deploy/hr/index.html` | hr | — |
| `pax-harian.ts` | `satukan()` di `deploy/dw/` & `deploy/radar/` | jadwal | radar |
| `venue-layouts.ts` + komponen `Denah` | `deploy/assets/venue-layouts.js` + Editor Denah | reservasi | marketing (VIP), analytics, konten |
| komponen `DanaMasukPanel` | `deploy/reservasi` mode `?embed=finance` | reservasi | cashier, finance |
| `kwitansi.ts` | `deploy/assets/kwitansi-sheet.js` | reservasi | marketing |
| `cocok-bri.ts` | `deploy/assets/cocok-bri.js` | cashier | finance |
| `kompas.ts` | turunan baris harian `grossOf`/`netOf`/`tagihanOf`/`avgSpendOf`/`itemsOf` + `validasiHarian` | finance (omset) | kas, brankas, dashboard — satu rumus untuk satu angka |
| `porsi-pic.ts` | `porsiPic`/`potonganHari`/`obTotal` (cashier, omset, kas) | cashier | finance. **K-04: dua rumus SENGAJA berbeda** — ekspor `porsiPicCashier` (versi cashier) dan `porsiPicKompas` (versi omset/kas) dari file yang sama, dengan komentar yang menyebut K-04. Jangan disatukan. |
| `performa-bonus.ts` | `deploy/assets/performa-bonus.js` | jalur fondasi (dulu finance, TIM-A.md §3) | event, marketing |
| `hpp-mesin.ts` | `deploy/assets/hpp-mesin.js` | marketing | — |
| `promo.ts` | `promoTipe`/`promoKat`/`promoHariTeks`/`promoStatus`/`promoSisa` (kembar di `deploy/bd` & `deploy/radar`) | bd | radar. Teks sisa waktu: K-12 |
| `format.ts` (`HARI`, `BULAN`, `BLN`, `fTgl`, `fTglP`) | nama hari/bulan & format tanggal (kembar di bd, radar) | fondasi | semua modul. `BLN` sengaja "Ags", bukan "Agu" dari Intl |

## 5. Definition of Done — satu modul

- [ ] Setiap layar di bagian C `<modul>.md` punya halaman, atau ditandai "Segera" dengan alasan (ID K/G).
- [ ] Setiap baris ✅/⚠️ di tabel E dipakai lewat `use<Modul>.ts`; tidak ada URL legacy.
- [ ] Semua aturan bisnis bagian F diterapkan, atau alasannya dicatat.
- [ ] Rumus bersama diimpor dari `app/utils/` (§4), bukan disalin.
- [ ] Tulisan memakai `ifMatch` + `tanganiKonflik` (F1).
- [ ] Menu modul terdaftar (`utils/modul.ts`, `utils/layar/<modul>.ts`).
- [ ] `npm run lint && npm run typecheck && npm run build` hijau.
- [ ] Dicek di 390px dan 1366px, terang dan gelap — atau PR menyebut "belum dicek visual".
- [ ] Bagian **J. Progres build** di `<modul>.md` terisi; status di §3 file ini diperbarui.

## 6. Yang TIDAK dikerjakan agen

- Mengubah `laksamana-office/` atau `laksamana-api/` (keduanya read-only dari sisi Vue).
  Gap API diajukan sebagai issue oleh owner dari `_gap-api.md`.
- Melakukan tulisan (POST/PUT/PATCH/DELETE) ke API dev atau production.
- Menambah dependensi npm selain yang diizinkan: `tesseract.js` (reservasi, K-05) dan face-api (absensi, §3 baris 15, K-02).
- Merge atau deploy. Agen boleh push branch issue-nya sendiri dan membuka draft PR (TIM-A.md §2);
  owner/reviewer yang me-merge.
