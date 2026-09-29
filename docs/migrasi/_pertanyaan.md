# Pertanyaan migrasi — hasil triase

Triase 2026-09-29 atas 63 pertanyaan dari inventaris (salinan asli:
[`_arsip/pertanyaan-awal-2026-09-29.md`](_arsip/pertanyaan-awal-2026-09-29.md)).
Setiap pertanyaan asli masuk ke SATU dari tiga kelompok:

| kelompok | isi | siapa yang bertindak |
|---|---|---|
| **K — Keputusan owner** | pilihan produk yang tidak bisa diambil dari kode | owner mengisi kolom "Keputusan" |
| **G — Gap API** | kontrak v1 memang kurang → issue di `laksamana-api` | lihat [`_gap-api.md`](_gap-api.md) |
| **T — Terjawab** | sudah ada jawabannya di kode/kontrak, atau cukup aturan paritas | agen pembangun langsung ikuti |

## Aturan umum (berlaku untuk semua modul, menjawab banyak pertanyaan sekaligus)

- **U1 — Paritas.** Kalau tidak ada keputusan lain di file ini, Vue meniru perilaku
  Office lama (layar, filter, rumus, izin). Fitur BARU (yang tidak ada di lama) tidak dibuat.
- **U2 — Roster Office.** Semua pengganti `account-api-mysql?action=listModuleRoster{module:X}`
  adalah `GET /api/v1/account/modules/{X}/members`; pengganti `listDivisiRoster` adalah
  `GET /api/v1/account/roster`. Terbuka untuk setiap user yang login
  (`laksamana-api/app/Modules/Account/routes/v1.php:16-18`). Dipakai lewat `useRoster()` (fondasi F3).
- **U3 — Diagnostik.** `ping` / `stats` / `ujiEmail` TIDAK dibawa ke Vue. Tidak ada layar yang memakainya.
- **U4 — Simpan.** Tidak ada `saveAll` di Vue. Setiap tulisan memakai endpoint granular v1 dengan
  versi (`If-Match` / `version`), konflik ditangani oleh helper fondasi F2
  (`428 version_required`, `409 version_conflict` + `error.details.current`).
- **U5 — Iframe/embed lama** (`?embed=finance`) menjadi komponen Vue bersama, bukan iframe.

---

## K — Keputusan owner

Semua keputusan diisi owner pada 2026-09-29. "Rek." = rekomendasi Claude (arsip); yang berlaku kolom **Keputusan**.
Modul yang bergantung pada keputusan yang masih kosong **tidak boleh** mengerjakan bagian itu —
agen menunda layar/tombol tersebut dan menandainya di PR.

| ID | modul | pertanyaan | opsi | Rek. | Keputusan |
|---|---|---|---|---|---|
| K-01 | hlife, hr, konten, event | Tombol operasi massal: `resetAll` (hlife, hr), `importJson` (hr), `restoreJSON` (konten), `resetData` "KOSONGKAN SEMUA DATA" (event). v1 tidak punya padanannya. | A) buang dari Vue · B) loop per record · C) minta endpoint khusus | **A** — berisiko menghapus data, dan backup sudah ditangani di level DB | **C** — minta endpoint khusus (G-13). Sampai ada: tombol tampil "Segera". |
| K-02 | absensi | Punch (kamera wajah + GPS) dan daftar wajah: dibawa ke Vue atau tetap di PWA `absensi.laksamanamuda.id`? | A) tetap PWA + tautan dari Vue · B) pindah ke Vue (butuh face-api + kamera) | **A** | **B** — pindah ke Vue, tapi dikerjakan **paling akhir** (setelah semua modul, `PLAN.md` §3 #15). Dependensi face-api diizinkan untuk tugas itu. Sampai saat itu: tautan ke PWA. |
| K-03 | absensi | Layar HR **Antrean** dan **Atur** (lokasi + aturan): dibangun di Vue? Atur memakai peta Leaflet. | A) bangun keduanya (Atur tanpa peta: input koordinat + tautan Google Maps) · B) bangun keduanya + Leaflet (dependensi baru) · C) tetap PWA | **A** | **A** — bangun Antrean + Atur, tanpa peta (koordinat + tautan Google Maps). |
| K-04 | cashier | `porsiPic()` Cashier masih `r.tiket ? amount×0.5 : amount`, sedangkan omset/kas sudah `amount+tax+service+obTotal` (`laksamana-office/CLAUDE.md:2638-2670`). Vue ikut yang mana? | A) versi Kompas baru, satu rumus untuk semua · B) pertahankan versi Cashier | **A** | **B** — pertahankan versi Cashier. Dua rumus sengaja berbeda (lihat `PLAN.md` §4). |
| K-05 | lintas | Dependensi baru. `AGENTS.md` melarang tanpa izin. Kebutuhan: (1) **ekspor .xlsx** (stock, lainnya) — lama pakai SheetJS CDN; (2) **baca .xlsx** (jadwal, hr Talenta, konten, cashier, finance) — lama pakai pembaca sendiri `deploy/assets/xlsx-baca.js` (tanpa library); (3) **OCR** bukti transfer (reservasi, `tesseract.js`). | per butir: izinkan / ganti / buang | (1) ekspor **CSV** dulu, xlsx nanti · (2) **port `xlsx-baca.js`** ke `app/utils/` (tanpa dependensi) · (3) **buang OCR** dulu (hanya "saran") | (1) **CSV** · (2) **port `xlsx-baca.js`** · (3) **izinkan `tesseract.js`**, dimuat lazy hanya saat dipakai. |
| K-06 | stock | Daftar Restock & Data Forecast di Ordering datang dari Google Apps Script (`appScriptUrlForecast`); tidak ada di v1. | A) Vue memanggil Apps Script seperti lama · B) endpoint v1 baru · C) layar ditunda | **C** dulu, lalu B | **A** — Vue memanggil Apps Script seperti lama (pengecualian dari aturan "hanya /api/v1", `PLAN.md` §1). |
| K-07 | stock | Gate pemilih panel menolak sesi yang HANYA punya `usage` (`deploy/stock/index.html:113-115` vs `:137`). Bug? | A) Vue izinkan usage-only · B) tiru lama | **A** (Vue memakai `access` dari `utils/modul.ts` yang sudah memuat `usage`) | **A** — izinkan usage-only. |
| K-08 | event | Matriks izin `EMS_HALAMAN × EMS_PERAN` tidak pernah tersimpan di backend lama (reset tiap muat ulang, `event-mysql/lib_event_mysql.php:430-433`). | A) buang layar izin, cukup modul `event` · B) simpan di settings v1 (gap API) | **A** | **Ikuti lama** — layar matriks dibawa dengan perilaku sama: default dari kode, TIDAK disimpan ke server (reset saat muat ulang). |
| K-09 | event | "Batalkan check-in" lama MENGHAPUS baris; v1 `checkins` append-only. | A) buang tombol · B) `DELETE /checkins/{id}` (gap API) · C) baris koreksi | **C** bila API mendukung, jika tidak **A** | **C** — baris koreksi (G-10). |
| K-10 | dw | Fitur di luar paritas: `maksBeruntun`/`jedaMin` bisa disetel, dan snapshot tarif pembayaran DW. | A) backlog (tidak dikerjakan migrasi) · B) kerjakan | **A** | **A** — backlog. |

---

## T — Sudah terjawab (agen langsung ikuti)

| ID | asal pertanyaan | jawaban |
|---|---|---|
| T-01 | hr, bd, stock/ordering, event, marketing, jadwal·dw — roster Office | **U2.** Sinkron "kru ber-akses yang belum punya record" (hr `autoSyncOfficeRoster`, bd `people`, stock `ordering-users`, cashier `syncPicOffice`) tetap dilakukan di klien seperti lama: bandingkan `members` dengan record modul, buat yang belum ada lewat `POST` modul itu. |
| T-02 | bd, absensi, finance+kompas, reservasi, marketing, ticketing — `ping`/`stats`/`ujiEmail` | **U3.** |
| T-03 | bd, marketing, cashier — `saveAll` whole-state | **U4.** Cashier memakai part endpoint Kompas per layar (`laksamana-api/docs/api/kompas.md:41-49`), bukan `PUT /state`. |
| T-04 | marketing — `hapus_yang_hilang` / `_sejak` | Hapus per baris: `DELETE /marketing/{resource}/{id}` dengan versi. |
| T-05 | absensi — deteksi HR | `GET /absensi/context` sudah mengirim `siapa{boleh,admin,hr}` (`laksamana-api/docs/api/absensi.md:21`). Pakai itu, bukan menebak dari isi baris. |
| T-06 | absensi — Riwayat dikunci 14 hari | **U1**: kembalikan pemilih `Dari`/`Sampai` + total hari kerja/telat/lembur (`laksamana-office/absensi/index.html:1459-1497`). |
| T-07 | konten — titipan `designReqOpsi` | Ikuti kontrak: Konten memanggil `PUT /api/v1/marketing/design-options` sekali per sesi saat antrian dibuka (`laksamana-api/docs/api/marketing.md:20`). |
| T-08 | konten — default `perms` | **U1**: bila `documents/perms` kosong, Vue memakai default `PERM_ROLES_LEGACY` yang sama (disalin ke konstanta). Admin modul Office = `isAdminOf(me,'konten')`. |
| T-09 | hr — audit tanpa batas | Tampilkan 200 terbaru di UI (seperti lama). Retensi/paging server = G-11 (opsional, tidak memblokir). |
| T-10 | dw — matriks `setting.akses` | UI-only, seperti lama (kontrak v1 memperlakukan matriks role sebagai data yang diterapkan UI). |
| T-11 | jadwal — bentuk `GET /jadwal/heads` | v1 = `{uid:[div]}` (sama dengan `headIds` lama), `GET /jadwal/settings` → `heads{div:[uid]}`. Pakai sesuai kebutuhan, jangan ditukar. |
| T-12 | cashier, finance/kas — halaman Dana Masuk (DP) | **U5**: satu komponen `DanaMasukPanel` dibangun di modul reservasi, dipakai ulang oleh cashier & finance. |
| T-13 | finance — daftar metode bayar/MDR | Pakai daftar dari server; tampilkan pesan `takDikenal` dari API apa adanya. |
| T-14 | finance/kas — Void | **U1**: read-only di Kas Kecil (seperti lama). |
| T-15 | finance/kas — Pembanding POS Void | Sembunyikan kartu itu bila user tidak punya modul `analytics`. |
| T-16 | stock/purchasing — `Barang Online` tanpa `PERM_DEFAULT` | **U1**: admin-only seperti lama. |
| T-17 | stock/hpp — pager & tab Prasmanan | **U1**: replikasi (3 pager, Prasmanan dari `seksi` berawalan "PRASMANAN"). |
| T-18 | stock/tree — snapshot statis | Bangun dari `GET /hpp/ingredients` + `/hpp/recipes` termasuk flag gap (`wip_noyield`/`mismatch`/`unmapped`/`implausible`). |
| T-19 | service_excellent — Reward | **U1**: tampilan saja, tanpa tulis ke HR/Finance. |
| T-20 | reservasi — denah | **U1**: port penuh `venue-layouts.js` + Editor Denah + override per tanggal, sebagai komponen bersama (dipakai marketing VIP juga). |
| T-21 | reservasi — kunci `review` di `ROLE_NAV` | Tidak dibuat. Review & feedback hanya di Service Excellent. |
| T-22 | event — grafik "Uang Masuk per Event" berisi angka mati | Hitung dari data. |
| T-23 | event — lokasi Performa Omset | `GET /api/v1/kompas/performa/event` (`laksamana-api/app/Modules/Kompas/routes/v1.php:21`). Salah tulis di `docs/api/event.md:32` → G-12. |
| T-24 | service_excellent — embed di cashier/finance | Tidak ada di kode; spesifikasi API yang keliru → G-12. Vue tidak membuat embed SE. |
| T-25 | bd — pola simpan | **U4** (per-record penuh). |
| T-26 | event — 11 layar toko ticketing publik | Di luar cakupan Office Vue: Office hanya untuk User ber-Sesi (`laksamana-api/CONTEXT.md`); toko publik memakai sesi Buyer. Hanya layar staf Event yang dibangun. |

---

## G — Gap API

Daftar lengkap + draf issue: [`_gap-api.md`](_gap-api.md). Ringkas:

| ID | modul | gap | memblokir |
|---|---|---|---|
| G-01 | konten | hapus satu platform di `PUT /content/{id}/performance` | 1 aksi di Input Performa |
| G-02 | bd, finance/brankas | baca master vendor tanpa modul stock | kolom Vendor PO, nama penerima |
| G-03 | jadwal | baris DW disetujui untuk pemegang `jadwal` tanpa `dw` | blok "DAILY WORKER" |
| G-04 | jadwal | `setting.manajemen` (penerima akses Rekap) | layar Pengaturan |
| G-05 | dw | pax harian gabungan marketing/event/reservasi | Kalender Tamu |
| G-06 | finance/kas | saldo wallet untuk modul `finance` | Planning Pembayaran |
| G-07 | reservasi | `ringkasTamu` (Loyal/blacklist/auto-isi) | autofill di Input Reservasi |
| G-08 | reservasi | paging server + ekspor riwayat (`halRecap`/`halDana`/`halAudit`/`riwayat`) | kinerja layar besar |
| G-09 | marketing | dokumen `kalkHistori` | riwayat Menu Kalkulator |
| G-10 | event | baris koreksi check-in (K-09 = C) | tombol Batalkan |
| G-13 | hlife, hr, konten, event | endpoint reset/impor/restore whole-document (K-01 = C) | tombol operasi massal |
| G-11 | hr | retensi/paging audit | tidak memblokir |
| G-12 | docs | salah tulis `docs/api/event.md:32` & `docs/modules/reservasi.md:7` | tidak memblokir |
