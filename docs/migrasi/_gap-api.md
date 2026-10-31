# Gap API — draf issue untuk `laksamana-api`

Hal yang dibutuhkan Vue tetapi belum ada di kontrak v1. Setiap butir siap disalin
menjadi issue GitHub `dwipapap/laksamana-api` (label `needs-triage`).

**Aturan untuk agen pembangun Vue:** jangan menunggu gap ini. Bangun layar tanpa bagian
yang terblokir, tampilkan bagian itu sebagai "Segera" (`text-dimmed`), dan sebut ID gap di PR.
Jangan pernah memanggil URL legacy (`*-api-mysql/api.php`) dari Vue sebagai jalan pintas.

Status: ⬜ belum diajukan · 📨 issue dibuat (tulis nomornya) · ✅ ada di v1

| ID | status | issue |
|---|---|---|
| G-01 | ✅ | [laksamana-api#177](https://github.com/dwipapap/laksamana-api/issues/177) → [PR #249](https://github.com/dwipapap/laksamana-api/pull/249) |
| G-02 | ✅ | [laksamana-api#178](https://github.com/dwipapap/laksamana-api/issues/178) → [PR #255](https://github.com/dwipapap/laksamana-api/pull/255) |
| G-03 | ✅ | [laksamana-api#179](https://github.com/dwipapap/laksamana-api/issues/179) → [PR #258](https://github.com/dwipapap/laksamana-api/pull/258) |
| G-04 | ✅ | sudah didukung API; hanya dokumentasi → G-12 |
| G-05 | ✅ | [laksamana-api#180](https://github.com/dwipapap/laksamana-api/issues/180) → [PR #254](https://github.com/dwipapap/laksamana-api/pull/254) |
| G-06 | ✅ | [laksamana-api#181](https://github.com/dwipapap/laksamana-api/issues/181) → [PR #250](https://github.com/dwipapap/laksamana-api/pull/250) |
| G-07 | ✅ | [laksamana-api#182](https://github.com/dwipapap/laksamana-api/issues/182) → [PR #256](https://github.com/dwipapap/laksamana-api/pull/256) |
| G-08 | ✅ | [laksamana-api#183](https://github.com/dwipapap/laksamana-api/issues/183) → [PR #259](https://github.com/dwipapap/laksamana-api/pull/259) |
| G-09 | ✅ | [laksamana-api#184](https://github.com/dwipapap/laksamana-api/issues/184) → [PR #251](https://github.com/dwipapap/laksamana-api/pull/251) |
| G-10 | ✅ | [laksamana-api#185](https://github.com/dwipapap/laksamana-api/issues/185) → [PR #248](https://github.com/dwipapap/laksamana-api/pull/248) |
| G-11 | ✅ | [laksamana-api#186](https://github.com/dwipapap/laksamana-api/issues/186) → [PR #252](https://github.com/dwipapap/laksamana-api/pull/252) |
| G-12 | ✅ | [laksamana-api#188](https://github.com/dwipapap/laksamana-api/issues/188) → [PR #253](https://github.com/dwipapap/laksamana-api/pull/253) |
| G-13 | 📨 | [laksamana-api#187](https://github.com/dwipapap/laksamana-api/issues/187) |
| G-14 | ✅ | [laksamana-api#189](https://github.com/dwipapap/laksamana-api/issues/189) → [PR #193](https://github.com/dwipapap/laksamana-api/pull/193) |
| G-15 | ✅ | tanpa issue → [laksamana-api PR #193](https://github.com/dwipapap/laksamana-api/pull/193) |
| G-16 | 📨 | [laksamana-api#228](https://github.com/dwipapap/laksamana-api/issues/228) (satu issue untuk G-16..G-18; menunggu keputusan owner) |
| G-17 | 📨 | [laksamana-api#228](https://github.com/dwipapap/laksamana-api/issues/228) (satu issue untuk G-16..G-18; menunggu keputusan owner) |
| G-18 | 📨 | [laksamana-api#228](https://github.com/dwipapap/laksamana-api/issues/228) (satu issue untuk G-16..G-18; menunggu keputusan owner) |
| G-19 | 📨 | [laksamana-api#233](https://github.com/dwipapap/laksamana-api/issues/233) |
| G-20 | ✅ | [laksamana-api#190](https://github.com/dwipapap/laksamana-api/issues/190) → [PR #257](https://github.com/dwipapap/laksamana-api/pull/257) (Vue PR #112 menyebutnya "G-16") |
| G-21 | ✅ | [laksamana-api#260](https://github.com/dwipapap/laksamana-api/issues/260) → [PR #262](https://github.com/dwipapap/laksamana-api/pull/262) |
| G-22 | ✅ | [laksamana-api#261](https://github.com/dwipapap/laksamana-api/issues/261) → [PR #263](https://github.com/dwipapap/laksamana-api/pull/263) |
| G-23 | ⬜ | — |
| G-24 | ⬜ | — |
| G-25 | 📨 | [laksamana-api#364](https://github.com/dwipapap/laksamana-api/issues/364) → [PR #365](https://github.com/dwipapap/laksamana-api/pull/365) (menunggu CI hijau) |

---

### G-01 — konten: hapus catatan performa satu platform
Legacy menghapus `c.perf[platform]` bila semua kotaknya dikosongkan
(`laksamana-office/deploy/konten/index.html:4364-4372`). v1
`PUT /api/v1/konten/content/{id}/performance` hanya MERGE (`laksamana-api/docs/api/konten.md:59-65`).
**Usul:** nilai `null` untuk sebuah platform berarti hapus platform itu.

### G-02 — stock: baca master vendor untuk bd dan brankas
`GET /api/v1/stock/vendors` digate modul stock mana pun (`laksamana-api/app/Modules/Stock/routes/v1.php:12-14`).
BD (kolom Vendor PO, `laksamana-office/deploy/bd/index.html:2417-2445`) dan Finance › Brankas
(nama penerima & no rekening, `finance/brankas/index.html:638,898-905`) membacanya tanpa punya modul stock.
**Usul:** izinkan GET vendors untuk `bd|brankas` juga (read-only), atau endpoint ringkas `{nama, bank, rekening}`.

### G-03 — jadwal: baris DW disetujui untuk pemegang `jadwal`
Jadwal menggambar blok "DAILY WORKER" dari `jadwalDW` yang di legacy OPEN
(`laksamana-office/deploy/jadwal/index.html:1478`). v1 `GET /api/v1/dw/schedule` menuntut modul `dw`
(`laksamana-api/app/Modules/Dw/routes/v1.php:6-8`). **Usul:** `GET /api/v1/jadwal/dw-schedule?from&to`
(modul `jadwal`) yang memanggil `DwService::scheduleRange`, read-only.

### G-04 — jadwal: `setting.manajemen`
Penerima akses Rekap disimpan di `setting.manajemen` (`laksamana-office/deploy/jadwal/index.html:5413`).
`GET/PUT /api/v1/jadwal/settings` hanya mendokumentasikan `shifts, heads, divOverride, jabatan, shiftKru, template`
(`laksamana-api/docs/api/jadwal.md:56`). **Dicek 2026-09-29: BUKAN gap.** `JadwalService::saveSetting` sudah menyimpan `manajemen`, `maksBeruntun`, `jedaMin`
(`laksamana-api/app/Modules/Jadwal/Services/JadwalService.php:787`). Vue memakai `PUT /jadwal/settings` apa adanya;
kontraknya saja yang belum menyebut kunci itu (masuk G-12).

### G-05 — dw: pax harian gabungan
Kalender Tamu DW menjumlahkan pax Marketing + Event + Reservasi (`laksamana-office/deploy/dw/index.html:971-979`,
fungsi `satukan()` kembar dengan `deploy/radar/`). Tiga endpoint sumbernya digate modul masing-masing,
padahal pemegang `dw` belum tentu punya ketiganya. **Usul:** `GET /api/v1/dw/guests?from&to` →
`[{tgl, sumber, pax}]`. (Radar TIDAK lagi menunggu ini: ia punya `GET /api/v1/radar/board` sendiri sejak 2026-09-30.)

### G-06 — finance: saldo wallet untuk Kas Kecil
Planning Pembayaran menghitung saldo wallet (`laksamana-office/deploy/finance/kas/index.html:7057-7070`), tetapi
`/api/v1/finance/vault` digate `brankas` (`laksamana-api/app/Modules/Finance/routes/v1.php:38`).
**Usul:** `GET /api/v1/finance/petty-cash/wallet-balances` (modul `finance`), hanya saldo per wallet.

### G-07 — reservasi: ringkasan tamu (`ringkasTamu`)
Profil Loyal/blacklist/auto-isi dihitung dari SELURUH riwayat (`laksamana-office/reservasi-mysql/api.php:85-87`,
`lib:713-748`). Vue memuat berjendela sehingga tidak bisa menghitungnya.
**Usul:** `GET /api/v1/reservasi/guests/summary?phone=` (atau `?before=`) dengan bentuk yang sama.

### G-08 — reservasi: paging server & ekspor
Legacy memakai `halRecap`/`halDana`/`halAudit`/`riwayat` (paging + saring + `ekspor=1`) dan `ver`
(`laksamana-office/deploy/reservasi/index.html:3122,5205-5261,10041-10070`; alasan kinerja:
`laksamana-office/CLAUDE.md:526-544`, "Muat berjendela"). v1 `GET /reservations?from&to` tanpa paging.
**Usul:** `page`/`perPage`/`q`/`status` + `meta.total` pada `GET /reservations` dan `GET /audit`,
plus `GET /reservations/export` (CSV).

### G-09 — marketing: dokumen `kalkHistori`
Riwayat Menu Kalkulator disimpan sebagai `extra:kalkhistori` (`laksamana-office/deploy/marketing/index.html:2322,19315`),
tetapi `MarketingRecords::DOCUMENTS` tidak memuatnya (`laksamana-api/app/Modules/Marketing/Services/MarketingRecords.php:46`).
**Usul:** tambahkan `kalkHistori` ke daftar dokumen.

### G-10 — event: koreksi check-in (keputusan K-09 = baris koreksi)
Legacy "Batalkan" menghapus baris `checkins` (`laksamana-office/deploy/event/index.html:10717-10728`); v1 append-only.
**Usul:** `POST /api/v1/event/checkins` menerima baris pembatalan (mis. `{batalDari: <id>}`), dan bacaan check-in
menghitung tiket sebagai belum hadir bila check-in terakhirnya dibatalkan. Jejak tetap utuh.

### G-11 — hr: retensi/paging audit (opsional)
Legacy memotong audit di 800 baris di klien (`laksamana-office/deploy/hr/index.html:692`). v1 `GET /api/v1/hr/audit`
tanpa batas. **Usul:** `?limit=` + `meta.total`.

### G-13 — operasi whole-document: reset, impor, restore (keputusan K-01)
Owner memilih endpoint khusus untuk tombol massal Office lama:
- hlife `resetAll` — kosongkan 13 koleksi, pertahankan `auth` (`laksamana-office/deploy/howandi_life/index.html:829`);
- hr `importJson` + `resetAll` (`laksamana-office/deploy/hr/index.html:2668-2688`);
- konten `restoreJSON` — ganti seluruh DB dari satu berkas (`laksamana-office/deploy/konten/index.html:4500,4603`);
- event `resetData` "KOSONGKAN SEMUA DATA", konfirmasi ketik `KOSONGKAN` (`laksamana-office/deploy/event/index.html:1646-1663`).
**Usul:** `POST /api/v1/<modul>/admin/reset` dan `POST /api/v1/<modul>/admin/import`, **admin modul saja**, dengan
konfirmasi di body, satu transaksi + lock modul, dan entri audit. Pola yang sudah ada: `POST /api/v1/dw/admin/clear`
(`laksamana-api/app/Modules/Dw/routes/v1.php:32`).

### G-12 — perbaikan dokumen API
- `laksamana-api/docs/api/event.md:32` menyebut Performa Omset "served by the marketing module";
  yang benar `GET /api/v1/kompas/performa/event` (`app/Modules/Kompas/routes/v1.php:21`).
- `laksamana-api/docs/modules/reservasi.md:7` menyebut Service Excellent di-embed di cashier & finance/kas;
  di kode hanya Dana Masuk Reservasi yang di-embed.

### G-14 — reservasi: Dana Masuk untuk pemegang `cashier`/`finance` tanpa modul `reservasi`
Seluruh kontrak Reservasi digate `module:reservasi|service_excellent`
(`laksamana-api/app/Modules/Reservasi/routes/v1.php:9`). Office lama membuka pintu kedua justru untuk
pemegang `cashier` dan `finance`: guard SSO menerima `*`, `reservasi`, atau `?embed=finance` milik
`cashier`/`finance` (`laksamana-office/deploy/reservasi/index.html:21-42`), lalu mengunci navigasinya
ke halaman Dana Masuk saja. Cashier dan panel Kas Kecil Finance menyematkan halaman itu apa adanya
(`deploy/cashier/index.html:3945`, `deploy/finance/kas/index.html:6431`), jadi **`finance` masuk dengan
hak yang sama dengan kasir: ia memverifikasi dan menolak, bukan cuma membaca** (baris 36-40).
T-12 (U5) sudah memutuskan Dana Masuk jadi satu komponen `DanaMasukPanel` milik modul reservasi, bukan
iframe — jadi Vue punya masalah yang sama, lebih besar: komponen itu memanggil `/reservasi/reservations`
dari halaman Cashier/Kas, yang pemegang `cashier`/`finance` tanpa modul `reservasi` akan jawab **403
`module_not_granted`**.

**Usul:** tambahkan modul `reservasi` otomatis kepada pemegang `cashier`/`finance`, atau longgarkan
gerbang modul untuk endpoint DP saja (`GET /reservations`, `PATCH /reservations/{id}`,
`GET/PUT /files/{key}`). Yang kedua lebih sempit dan lebih sesuai perilakunya: Master Data, Audit, dan
Input tetap tertutup untuk mereka, persis seperti keadaan lama.

**✅ Selesai (laksamana-api PR #193, 2026-09-30) — jalan yang kedua.** Endpoint yang dipakai Dana Masuk
(`GET /reservations`, `GET`/`PATCH /reservations/{id}`, `GET /master/{section}`, `POST /audit`,
`GET /files/{key}`) terbuka juga untuk `cashier|finance`. Untuk yang tidak memegang `reservasi` maupun
`service_excellent`, API mempersempitnya: PATCH hanya field DP (`dps`, `dp*`) dan transfer (`tf*`) plus
`status` Pending → Confirmed (selain itu 403 `forbidden` + `details.fields`); master hanya `dpMethods`;
tanpa DELETE, tanpa Input, Master Data, maupun Audit Log. Karena itu `DanaMasukPanel` menyembunyikan
**Hapus Data Demo** untuk mereka, apa pun yang dikirim halaman induknya. Kontrak:
`laksamana-api/docs/api/reservasi.md` ("Dana Masuk door").

### G-15 — marketing: tab DP Event untuk pemegang `reservasi`/`cashier`/`finance` tanpa modul `marketing`
Tab "DP Event (Marketing)" di Dana Masuk dibaca Office lama lewat `GET marketing-api-mysql/api.php?action=dpMasuk`
(`laksamana-office/deploy/reservasi/index.html:9108-9136`) — endpoint sempit TANPA gate modul (hanya `API_TOKEN`
opsional; `laksamana-office/marketing-mysql/api.php:64-90`). Kasir lewat `?embed=finance` membukanya tanpa modul
marketing. v1 `GET /api/v1/marketing/dp` digate `module:marketing`
(`laksamana-api/app/Modules/Marketing/routes/v1.php:6`) → pemegang `reservasi`/`cashier`/`finance` tanpa
`marketing` kena 403 `module_not_granted`.

**Usul:** longgarkan gate untuk `GET /marketing/dp` saja (read-only, tanpa CRM/pipeline — alasan endpoint
sempit ini lahir), atau sertakan modul `marketing` pada pemegang `cashier`/`finance`.

**✅ Selesai (laksamana-api PR #193, 2026-09-30) — jalan yang pertama.** `GET /marketing/dp` terbuka untuk
`marketing|reservasi|cashier|finance`; endpoint Marketing lainnya tetap `marketing` saja.

### G-16 — akademi: operasi whole-state (kirim / ambil / pulihkan dari backup)
Layar `sync` lama punya `pushToServer` (`deploy/akademi/index.html:1662-1690`), `ambilDariServer`
(`:1736-1742`), dan `importJSON`/`doImportJSON` (`:1785-1799`) yang mengganti/menimpa SELURUH database.
v1 hanya punya `GET /state`; tidak ada tulis whole-state.
**Usul:** endpoint `POST /akademi/admin/import` (pola K-01/G-13) atau nyatakan tombol itu tidak dibawa.
Gelombang 1: tiga tombol tampil **"Segera"**.

### G-17 — akademi: hapus materi/program tidak menghapus progress terkait
F8 (`docs/migrasi/akademi.md:179`) mewajibkan hapus materi/program ikut menghapus progress-nya, tetapi
`DELETE /akademi/materials/{id}` / `/programs/{id}` tidak melakukannya (`AkademiRecords::delete`,
`laksamana-api/app/Modules/Akademi/Services/AkademiRecords.php:220-235`).
Gelombang 1 mengerjakannya di klien: `GET /progress?material=` / `GET /program-progress?program=` lalu
`DELETE` per sel (`hapusProgresMateri` / `hapusProgProgProgram`).
**Usul:** cascade di server, atau dokumentasikan aturan klien.

### G-18 — akademi: sinkron roster Office hanya jalan untuk admin
Legacy menjalankan `autoSyncOfficeRoster()` untuk SETIAP klien (`deploy/akademi/index.html:657-727`, T-01/F5),
tetapi v1 menulis record hanya untuk **admin modul** (`laksamana-api/app/Modules/Akademi/routes/v1.php:41-46`).
Akibatnya kru baru tidak punya baris `users` sampai seorang admin membuka modul.
**Usul:** izinkan pembuatan baris `users` dari roster Office bagi pemegang modul (bukan hanya admin), atau
sinkronkan di server saat roster Office berubah.

### G-19 — cashier: `GET /kompas/bri` tidak memulangkan `dipakai[]`
Mesin BRI lama memakai `dipakai` — dpId yang sudah dipegang baris **mana pun, lintas bulan** — supaya DP yang
sudah dicatat di September tidak ditagih lagi di Agustus (`cocok-bri.js:203-207`, `:454-467`). v1 hanya
memulangkan `{baris,total,maks,abai}` (`VoidBri::briList`, `laksamana-api/app/Modules/Kompas/Services/VoidBri.php:863-886`).
Vue #30 memakai daftar baris bulan berjalan (perilaku sebelum 23 Sep 2026): benar untuk bulan yang dibuka,
salah untuk bulan lain.
**Usul:** tambahkan `dipakai: [dpId…]` ke balasan `GET /kompas/bri` (dan `briList` legacy, karena PHP lama sudah memulangkannya).
Koreksi 2026-10-09: query lama yang sebenarnya `SELECT DISTINCT dp_id FROM bri_mutasi WHERE dp_id <> '' AND batal_at = 0`
— tanpa saringan `cara` (`laksamana-office/kompas-mysql/lib_kompas_mysql.php` `bri_list()`, :2918-2934).

### G-20 — marketing/konten: antrean Request Design dan pemilih brand/kru lintas modul
Layar Request Design di Marketing butuh antrean desain Konten dan daftar brand + kru produksi, sementara
pemegang `marketing` tidak memegang `konten` (dan sebaliknya).
**✅ Selesai (laksamana-api PR #257, 2026-10-09).** Antrean desain terbuka untuk `marketing|konten`, plus
`GET /marketing/design-requests/{id}` dan pemilih sempit `{brands:[{id,name}], pics:[{id,name,roles}]}`
(kru aktif saja, peran produksi di depan — `KontenQueries::designOptions`). Catatan: PR API, kode, dan Vue PR #112
menyebut gap ini "G-16" karena ID itu sudah dipakai akademi; ID resminya **G-20**.

### G-21 — finance: baca master vendor
Layar Finance (pembayaran vendor) membaca master vendor Stock, tetapi `GET /stock/vendors` hanya terbuka untuk
`stock|bd|brankas` (G-02).
**✅ Selesai (laksamana-api PR #262, 2026-10-09).** Gate baca vendor ditambah `finance`; tulis tetap `stock`.

### G-22 — konten: `perf` kosong harus objek `{}`, bukan array `[]`
Setelah platform performa terakhir dihapus (G-01), PHP men-encode `perf` kosong sebagai `[]`; klien yang
memperlakukannya sebagai peta (`perf[platform]`) jadi salah tipe.
**✅ Selesai (laksamana-api PR #263, 2026-10-09).** `perf` kosong selalu `{}` di list, `find()`, dan getAll;
`setPerformance` menyimpan `{}` saat platform terakhir dihapus. Perbedaan disengaja dari legacy, dicatat di
`docs/api/konten.md`.

### G-23 — finance: baris otomatis Breakdown untuk pemegang `kompas` tanpa modul `marketing`/`event`
Breakdown Sumber Omset menyerap baris otomatis (deal event, Reservasi VIP Assisted, event internal) dari
`GET /marketing/events-on/{date}` + `GET /event/events-on/{date}`
(`laksamana-office/deploy/finance/omset/index.html:3125-3155`). Legacy `eventsHari` tanpa gate modul, tetapi v1
digate `module:marketing` (`laksamana-api/app/Modules/Marketing/routes/v1.php:14-17`) dan `module:event`
(`laksamana-api/app/Modules/Event/routes/v1.php:9-12`) → pemegang `kompas` (kasir/finance pengisi breakdown
tiap malam) tanpa kedua modul itu kena 403 `module_not_granted` di keduanya.
**Vue sudah lapang (pola lama `allSettled`):** satu modul mati tidak menghapus hasil satunya; keduanya gagal
→ pita galat + baris manual (`app/pages/finance/omset/breakdown.vue`, `app/utils/breakdown-sumber.ts`).
**Usul (sekelas G-15):** longgarkan gate untuk kedua `events-on` saja (read-only, tanpa CRM/pipeline/rincian
event — alasan pola G-15), atau sertakan modul `marketing`+`event` pada pemegang `kompas`.

### G-24 — konten (campaign analytics): Google Review
Menu Google Review di panel Campaign Analytics (`laksamana-office/deploy/konten/analytics/index.html#greview`,
17 Okt 2026; `konten-mysql/lib_greview.php`, `campaign-google.php`) menarik ulasan Google tamu lewat dua jalur:
**Google Business Profile** (OAuth pemilik/manager, scope `business.manage` — SELURUH review + bisa DIBALAS
dari sistem) dan **Places API** (API key — 5 review per tarikan, baca saja, tanpa balas). 11 aksi
`campaignGoogle*`: `campaignGoogle` (baca), `campaignGoogleSync`, `campaignGoogleMulai` (OAuth start),
`campaignGoogleLokasi`, `campaignGoogleBalas`, `campaignGoogleBalasHapus`, `campaignGoogleTangani`,
`campaignGoogleAI` (analisa + draf, **hanya saat diminta**), `campaignGoogleDraf` (draf per review, hanya saat
diminta), `campaignGoogleCari` (cari Place ID), `campaignGooglePutus` (token dihapus, review tersimpan tetap).
3 tabel: `cg_gtempat` (profil tempat), `cg_gtempat_harian` (potret rating harian → tren naik/turun),
`cg_greview` (review + balasan + penanda `ditangani`). Profil yang ditandai Google sebagai **duplikat dilewati**
(akun Laksamana: 1 terverifikasi + 2 duplikat). Prioritas "perlu ditangani" DIHITUNG di layar (`grSkor`:
bintang rendah + keluhan panjang + terbaru + penanda AI, sudah dibalas turun), bukan disimpan.
**Usul:** port ke `/api/v1/konten/analytics/google*` (gate `konten|campaign`, admin campaign untuk tulis —
sekelas endpoint OAuth TikTok/Instagram yang sudah ada), atau nyatakan menu ini tidak dibawa.
**Vue sudah lapang:** `app/pages/konten/greview.vue` + `app/composables/useGoogleReview.ts` menampilkan pola
"Segera" (`idle/muat/ok/galat` + Coba lagi, deep-link `#greview`) sampai API ada; tidak ada URL legacy yang
dipanggil. Inventaris: `docs/migrasi/konten.md` D.24.

### G-25 — BD: dokumen setelan `tagWarna` (warna tag, delta BD Okt 2026)
Status: 📨 diajukan — [laksamana-api#364](https://github.com/dwipapap/laksamana-api/issues/364) → [PR #365](https://github.com/dwipapap/laksamana-api/pull/365) (menunggu CI hijau; belum bisa tes lokal, tidak ada PHP di mesin ini).
Klien lama menyimpan warna tag di `DB.tagWarna` (`{lowercaseTag: '#rrggbb'}`, palet
tertutup 12 warna, kunci lowercase, `deploy/bd/index.html:2312-2360`) sebagai bagian dari
blob `saveAll`. Vue sudah membaca/menulisnya lewat `PUT /bd/settings/tagWarna`
(`BdSetting` + `BdSettings.tagWarna`, `BdTaskSheet`, chip `BdTagChip`) — tanpa kunci ini
`PUT` kena 404 (rute `where('key', 'focus|approverSets|promos')`) dan warna pilihan user
tidak tersimpan (chip tetap tampil via hash nama yang stabil, jadi layar tidak rusak).
**Usul:** tambah `tagWarna` (object, default `{}`) ke `BdRecords::DOCUMENTS`, regex rute
`$docs` (`app/Modules/Bd/routes/v1.php:23`), `GET /settings` + `GET /state`
(`BdState.php:154`), dan `docs/api/bd.md:62-68`. Validasi nilai sekelas `focus` (peta
`{string: '#rrggbb'}`).
**Vue sudah lapang:** tanpa dokumen, `warnaTag` memakai hash nama yang stabil; `PUT`
hanya dicoba saat ada perubahan warna draf, dan gagalnya bersuara tanpa menggagalkan
simpanan task.
