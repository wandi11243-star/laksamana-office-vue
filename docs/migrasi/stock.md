# Stock — inventaris migrasi

Status: ⚠️ selesai dengan celah
Terakhir diperbarui: 2026-09-29

> **Triase 2026-09-29** — status di tabel E yang bertentangan dengan catatan ini: catatan ini yang berlaku.
> Rincian: [`_pertanyaan.md`](_pertanyaan.md), [`_gap-api.md`](_gap-api.md).
> - Roster ordering: ❌ → ✅ `GET /api/v1/account/modules/ordering/members` (U2, T-01).
> - Forecast → K-06. Gate usage-only → K-07. Ekspor xlsx → K-05. Barang Online → T-16. HPP pager → T-17. Tree → T-18.

## Ringkasan
- Jumlah layar: 26 (1 pemilih + 1 tab legacy dihapus) · Aksi backend lama: 48 · Gap v1: 2 ❌ · 11 ⚠️
- Modul **Stock** adalah satu Backend (`stock-mysql/`) yang melayani **5 Panel** dengan
  **kunci akses masing-masing**: `ordering`, `purchasing`, `tree`, `usage`, `hpp`
  (`laksamana-office/deploy/stock/index.html:113-142`, `:248-271`).
- Penggunanya: kru dapur/gudang (Ordering: order belanja + pengajuan Central Kitchen +
  check-in penerimaan), purchasing (monitor order, jemput/online, database vendor &
  bahan, CK, rekap), kru Floor/Bar/Kitchen (Usage: Daily SO, pemakaian, waste, serah
  terima), dan admin/pengurus (HPP: harga bahan, resep, COGS).
- Paling berisiko saat migrasi: **(1)** rumus modal/COGS HPP berjenjang + *spare buffer*
  yang dihitung di browser (`modalResep`/`modalMenu`/`cogsOf`); **(2)** Daily SO
  (buku stok `awal + masuk − keluar`, konversi satuan per barang); **(3)** saldo Central
  Kitchen = SUM(masuk) − SUM(keluar) tanpa baris saldo tersimpan; **(4)** sumber
  prakiraan/restock masih Google Apps Script di luar v1; **(5)** aturan "satu nama di
  dua sisi" bahan vs resep (`sisi_harga` beli/resep).

## A. Sumber
| jenis | path | baris |
|---|---|---|
| frontend lama (pemilih panel) | laksamana-office/deploy/stock/index.html | 298 |
| frontend lama (Ordering) | laksamana-office/deploy/stock/ordering/index.html | 5.586 |
| frontend lama (Purchasing) | laksamana-office/deploy/stock/purchasing/index.html | 7.725 |
| frontend lama (Pohon Resep) | laksamana-office/deploy/stock/tree/index.html | 452 |
| frontend lama (Usage) | laksamana-office/deploy/stock/usage/index.html | 3.329 |
| frontend lama (HPP & Resep) | laksamana-office/deploy/stock/hpp/index.html | 3.502 |
| frontend bersama | laksamana-office/deploy/stock/catat-common.js | 426 |
| frontend (modul prakiraan) | laksamana-office/deploy/stock/ordering/laksamana-forecast.js | 620-an (`:1-560`) |
| frontend (data prakiraan tertanam) | laksamana-office/deploy/stock/ordering/forecast_export.js | 62.478 B |
| backend lama | laksamana-office/stock-mysql/ (19 berkas .php + `lib_stock_*.php`) | — |
| kontrak v1 | laksamana-api/docs/api/stock.md | 189 |
| spec port | laksamana-api/docs/modules/stock.md | 96 |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:88-95 "Modul berpanel: stock dan finance" | |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:5733 "HPP: SPARE MODAL, sekali dan hanya di menu jadi" | |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:5898 "HPP: ekspor & impor Daftar Resep lewat Excel" | |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:6021 "HPP: tab Prasmanan, dan COGS 2403% yang lahir dari yield" | |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:6412 "Pemakaian Bahan Baku: pemilih bulan di KETIGA report" | |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:7112 "Master Vendor: di PURCHASING, dibaca Finance & BD" | |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:13441 "Ordering: rekap konfirmasi Central Kitchen" | |
| aset bersama | laksamana-office/deploy/assets/hpp-mesin.js — **DIPAKAI marketing, BUKAN stock** | 8.467 B |
| aset bersama | laksamana-office/deploy/assets/cocok-bri.js — cashier, finance/kas, reservasi | 128.105 B |
| aset bersama | laksamana-office/deploy/assets/xlsx-baca.js — analytics, cashier, finance/kas, jadwal, konten | 16.483 B |

> **Koreksi §3 tugas (1):** backend lama **bukan** satu `api.php`; tiap endpoint adalah
> berkas `.php` sendiri (`items.php`, `orders.php`, `ck.php`, …, `training.php`) —
> `laksamana-api/docs/modules/stock.md:31-32`. Ini sudah tercatat di README.
>
> **Koreksi §3 tugas (2) — aset bersama:** **TIDAK ADA panel stock yang memuat
> `deploy/assets/*.js`.** `grep -rn "assets/" deploy/stock/` kosong. `hpp-mesin.js`
> dipakai `deploy/marketing/index.html`; `cocok-bri.js` dipakai cashier/finance-kas/reservasi;
> `xlsx-baca.js` dipakai analytics/cashier/finance-kas/jadwal/konten. Stock memuat
> SheetJS dari CDN sendiri (`hpp/index.html:2219`, `purchasing/index.html:3874`,
> `ordering/index.html:73`) dan satu-satunya berkas bersama yang benar-benar dimuat
> stock adalah `deploy/stock/catat-common.js` (oleh `usage/index.html:860`;
> `hpp/index.html` hanya **menyebut** namanya di komentar `:340`, `:1734`).

## B. Akses
- **Kunci Modul di launcher (5, terverifikasi dari kode):**
  - `ordering` — `deploy/stock/index.html:123`, `:258`; gate panel `ordering/index.html:1484-1489`.
  - `purchasing` — `deploy/stock/index.html:124`, `:259`.
  - `tree` — `deploy/stock/index.html:127`, `:264`; gate `tree/index.html:20-23`.
  - `usage` — `deploy/stock/index.html:137`, `:269`; gate `catat-common.js:22-32` (`sesiOffice('usage')`, dipanggil `usage/index.html:879`).
  - `hpp` — `deploy/stock/index.html:142`, `:271`; gate `hpp/index.html:498-502`.
- **Gate pemilih panel** (`deploy/stock/index.html:106-162`): dijalankan blocking di `<head>`,
  membaca `lm_session` (localStorage, bukan login PIN). Jika user berhak **satu** panel,
  pemilih langsung di-`location.replace` ke panel itu (`:149-159`). Jika **>1** panel,
  pemilih ditampilkan (`:160`).
- **`ordering` punya role internal** (`resolveOfficeUser`/`enterApp`,
  `ordering/index.html:1489-1513`): `admin` · `full` ("Order + Check-in") · `checkin`
  ("Check-in Saja") (`:1568-1582`, label `:1515`). `admin` = role Office `owner`/`admin`
  **atau** `adminModules` memuat `*`/`ordering` (`:1479`, `:1484-1489`). Tab admin
  (`Daftar Restock`, `Data Forecast`, `Kelola Akses`) hanya untuk admin (`:1576-1579`).
- **`purchasing` punya matriks izin per halaman** (`PERM_PAGES`, `purchasing/index.html:1637-1671`):
  Monitor Order, Jemput Hari Ini, Barang Online, Central Kitchen, Rekap Per Bulan,
  Database & Vendor, Kelola Akses. Nilai per role `admin`/`full`/`view` → `PERM_EDIT`/`PERM_VIEW`/`PERM_NONE`.
  `role === 'admin'` selalu `PERM_EDIT` (`:1665`). Disimpan di `purchasing-settings.php`
  (`{perms, templates}`, `:1688-1706`, `:7281-7290`).
- **`usage` punya matriks izin via `adminModules`** — `sayaAdmin()` = `*` atau `usage`
  (`usage/index.html:999-1001`); pemilih Divisi di report hanya admin (`:1385-1388`, `:1790-1793`).
  Pembatasan tim ditegakkan server (`STOCK_BATAS_PER_TIM`).
- **`hpp` punya flag admin** — `bacaSesi().isAdmin` = `adminModules` memuat `*`/`hpp`
  (`hpp/index.html:498-502`).
- **`tree` tanpa role internal** — read-only, hanya gate sesi (`tree/index.html:20-23`).

## C. Daftar layar (dari navigasi panel)
Tiap panel adalah satu halaman dengan tab/section internal (bukan `NAV_DEF`, kecuali HPP).

**Pemilih** `deploy/stock/index.html`
| key | judul | subjudul | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| — | Pilih Panel | "Anda sudah masuk lewat Office. Pilih panel yang ingin dibuka." | punya >1 panel | pemilih sendiri disembunyikan sampai >1 panel (`<head>`), kartu difilter JS | `index.html:86-91,184-227,290-292` |

**Panel `ordering`** (`ordering/index.html`)
| key tab | judul | subjudul/internal | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| order | Form Order Belanja — "Pengajuan Order Barang Baru" | "Tahap 1" | admin+full | tidak | `:164-166,262-329` |
| ck | Central Kitchen — "Pengajuan ke Central Kitchen" | sub: Stok CK Sekarang / Minta dari CK / Kirim ke CK / Riwayat Kiriman | admin+full | tidak | `:173-175,344-487` |
| checkin | Check-in Penerimaan | kartu per nomor PO + mode 1 Hari/Rentang | semua | tidak | `:176-178,492-646` |
| restock | Daftar Restock | — | **admin** | tidak (blok `nav-admin-sec` hidden bila bukan admin) | `:193-200,648-707` |
| forecast | Data Forecast | ringkasan + Keandalan Prakiraan (tier/WAPE) | **admin** | tidak (dalam `nav-admin-sec`) | `:201-202,708-826` |
| users | Kelola Akses | daftar kru + pilih role | **admin** | tidak (dalam `nav-admin-sec`) | `:204-206,827-893` |

**Panel `purchasing`** (`purchasing/index.html`)
| key tab | judul | subjudul/internal | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| dashboard | Monitor Order ("Antrean Pesanan Bahan Baku") | sub-tab: 📋 Per Item / 📦 Gabung per Vendor / 🗄️ Arsip Selesai | sesuai `PERM_DEFAULT.dashboard` | tidak | `:161-162,283-285,973-980` |
| jemput | Jemput Hari Ini ("Jemput Sendiri") | — | `PERM_DEFAULT.jemput` | tidak | `:168-169,380-424` |
| online | Barang Online | — | `PERM_DEFAULT` (tak ada entri → default?) | tidak | `:181-182,425-483` |
| ck | Central Kitchen | stok, mutasi, dashboard CK | `PERM_DEFAULT.ck` | tidak | `:184-185,484-` |
| overview | Rekap Per Bulan ("Rekap & Analitik Order Bulanan") | KPI + 4 grafik + tabel | `PERM_DEFAULT.overview` | tidak | `:188-189,660-710` |
| database | Database & Vendor | Vendor (tabel) + "Aturan Distribusi Bahan Baku & Produk" + Kustomisasi Format Chat | `PERM_DEFAULT.database` | tidak | `:191-192,820-965` |
| users | Kelola Akses | matriks izin + daftar user | **admin** | tidak (dalam `nav-admin-sec`) | `:202-203,1059-` |
| log | Log Aktivitas | — | **admin** | tidak (dalam `nav-admin-sec`) | `:208-209,1000-` |
| (integration) | Panduan & PWA | — | — | **DIHAPUS/dipertahankan hidden** agar `switchTab`/`applyPagePerms` lama tak error | `:194-199,970` |

**Panel `tree`** (`tree/index.html`) — satu layar statis:
| key | judul | subjudul | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| (satu-satunya) | "Laksamana Pohon Resep" | "Rincian tiap menu makanan yang aktif, turun lewat WIP sampai ke bahan mentah…" | `tree` | tidak | `:215-260` |

**Panel `usage`** (`usage/index.html`, menu dibentuk `pasangCangkang` `:1024-1032`)
| key menu | judul | sub-tab | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| opname | Daily SO | — | `usage` | tidak | `:376-419` |
| pemakaian | Pemakaian Bahan | Catat Pemakaian / Report Pemakaian | `usage` | tidak | `:427-588` |
| waste | Waste Produk | Catat Waste / Report Waste | `usage` | tidak | `:595-721` |
| serah | Serah Terima | Catat Serah Terima / Report Serah Terima | `usage` | tidak | `:726-853` |

**Panel `hpp`** (`hpp/index.html`, `JUDUL` `:831-841`)
| key | judul | subjudul | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| dash | Dashboard HPP | "COGS, menu paling boros, dan bahan yang paling menggerakkan modal" | `hpp` | tidak | `:212,832` |
| resep | Daftar Resep | "Semua resep base & menu jadi berikut modalnya" (tab Menu Jadi · Base & Olahan · Prasmanan) | `hpp` | tidak | `:216,833` |
| bahan | Bahan & Harga | "Harga beli tiap bahan — sumber semua angka modal di modul ini" | `hpp` | tidak | `:220,834` |
| floor | Barang Floor | "Barang berarea Floor di purchasing — dibeli & berharga, tapi tidak masuk resep" | `hpp` | tidak | `:228,835` |
| pakai | Pemakaian & Selisih | "Stok awal, belanja, pemakaian, dan opname — selisihnya jadi lampu" | `hpp` | tidak | `:243,836` |
| kalk | Kalkulator HPP | "Hitung modal & harga jual sebuah menu tanpa menyimpan apa pun" | `hpp` | tidak | `:244,837` |
| atur | Pengaturan | "Target COGS, buffer, dan ambang lampu selisih" | `hpp` | tidak | `:245,838` |

## D. Detail per layar

### D.1 PEMILIH — `stock/index.html`
- **Tampilan:** kartu "Pilih Panel" berisi Ordering 🍳, Purchasing 📋, Pohon Resep 🌳,
  Pemakaian Bahan Baku 🍽️, HPP & Resep 🧮 (`:194-226`). Hanya kartu yang haknya
  ditampilkan (`:290-292`).
- **Aksi:** klik kartu → `openPanel(key)` → `window.location.href` ke `./ordering/`,
  `./purchasing/`, `./tree/`, `./usage/`, `./hpp/` (`:275-280`).
- **Catatan:** user berhak satu panel diarahkan langsung (`:149-159`). **Temuan bug**:
  gate `<head>` (`:113-115`) **tidak** memuat `usage`, walau daftar panel (`:137`) dan
  komentarnya menyebut kru yang hanya punya `usage`. Lihat I.

### D.2 `ordering` › order — Form Order Belanja
- **Tampilan:** kartu "Pengajuan Order Barang Baru" (Tahap 1): PIC Pemesan (dari user
  login, read-only), Tgl Rencana Kedatangan (widget kalender kustom + pintasan Hari Ini/Besok/Lusa);
  daftar baris bahan; ringkasan "N Item siap dikirim". Mode batch: **Baru** vs **Gabung** ke batch (`:274-328`, `:894-899`).
- **Filter/cari:** autocomplete bahan dari master `items.php`; jumlah baris = `batch-rows-wrapper`.
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | Tambah Baris Bahan | tambah baris input | — (klien) | — | `:302` |
  | Simpan Draft | simpan draf lokal (`simpanDraf('belanja')`) | — (localStorage) | — | `:319-321` |
  | Cek & Submit Pesanan | validasi + cek duplikat server + pre-submit | — (klien) | — | `:323-325,4250` |
  | (pre-submit) Kirim | POST batch | `batchOrder` | `POST /orders/batches` ✅ | `:4594-4601` |
  | edit qty (modal) | promptEditQty → submitEditQty | `updateOrderQty` | `PATCH /orders/{nomor}` (`qty`) ⚠️ | `:5520-5535` |
  | hapus baris (modal) | promptDeleteOrder → submitDeleteOrder | `deleteRow` | `DELETE /orders/{nomor}` ✅ | `:5546-5560` |
- **Form & field:**
  | field (nama data) | label UI | tipe | wajib | default / pilihan | validasi & pesan |
  |---|---|---|---|---|---|
  | pic | 👤 PIC (Pemesan) | hidden text | ya (dari sesi) | nama user login | PIC = user login (`:1515-1526`) |
  | tglDatang | 🗓️ Tgl Rencana Kedatangan | date | ya | default besok | `setTomorrowAsDefaultDate()` |
  | item | (autocomplete) | text | ya | dari `items.php` | pilih dari saran |
  | qty | jumlah | number | ya | — | `Math.max(1, …)` (`:3670`) |
  | unit | satuan | select | ya | `SATUAN_TERSEDIA` atau satuan barang | `SATUAN_TERSEDIA` `:1146-1147` |
  | note | Catatan (opsional) | text | tidak | `'-'` dikirim bila kosong | `:4600` |
  | batchId/batchName | Nama batch (opsional) | text | tidak | maxlength 60 | `:894` |
- **Validasi & pesan (persis):** "Batch Belum Dipilih","Pilih batch tujuan, atau kirim sebagai batch baru." (`:4585`); "Pengiriman Gagal","Pastikan internet stabil & coba lagi." (`:4645`).
- **Cek duplikat:** bila item+satuan sudah ada → modal menampilkan **jumlah** ("sudah X, akan jadi Y"),
  bukan hanya nama (`:4653-4660`). Server juga mengembalikan `serverDuplicates` (`:4535`).
- **Perhitungan di browser:** normalisasi tanggal `tglDatang` `YYYY-MM-DD` dari `new Date(date)` (`:4562-4565`).
- **Real-time/polling:** badge koneksi `online`/`offline` (`:236-239`, `updateNetworkStatus` `:1680`).

### D.3 `ordering` › ck — Central Kitchen
- **Tampilan:** header "Pengajuan ke Central Kitchen" (PIC Pemohon, Tgl Dibutuhkan);
  sub-tab **📦 Stok CK Sekarang / 📥 Minta dari CK / 📤 Kirim ke CK / 🧾 Riwayat Kiriman** (`:384-388`).
  - Stok CK: sisa per barang, "Angka besar = jumlah pack, angka kecil = satuan dasarnya" (`:405-419`).
  - Minta: baris barang + sisa stok di saran autocomplete; "0 Baris siap dikirim".
  - Kirim: "Stok CK langsung bertambah begitu dicatat di sini…" (`:454-457`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | Kirim Pengajuan | POST batch CK (batchName 'Central Kitchen') | `batchOrder` | `POST /orders/batches` ✅ | `:2557-2810` |
  | Catat Kiriman | POST kirim barang outlet→CK (per baris) | `kirim` | `POST /ck/deliveries` ✅ | `:2959-3060` |
  | Tambah Baris / Tambah item | tambah baris | — | — | `:425-427,450-452` |
  | segarkan stok | GET saldo CK | (GET `ck.php`) | `GET /ck/balance` ✅ | `:2115,414-416` |
- **Perhitungan browser:** duplikat CK dicek via `cekDuplikatCK` (GET semua order, rekap per item+satuan) (`:2762-2790`).
- **Catatan:** pengajuan CK & form belanja memakai `batchOrder` SAMA; pengajuan CK selalu `batchId:''` (`:2804`);
  barang CK = master `sumber='ck'` (`:2330`, `renderStokCKOrder`).

### D.4 `ordering` › checkin — Check-in Penerimaan
- **Tampilan:** daftar kartu per **nomor PO**; mode tanggal **1 Hari** / **Rentang** (`:504-558`);
  filter PO status (`poFilter`: all/progress/partial/complete) dan tim (`timFilter`) (`:4717-4719`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | (toggle "Datang") | tandai barang datang | `updateKedatangan` | `PATCH /orders/{nomor}` (`kedatangan`,`catatanAktual`) ✅ | `:5440-5490` |
  | Simpan (btn-save-checkin) | kirim semua perubahan | `updateKedatangan` | idem ✅ | `:5473` |
- **Form & field:**
  | field | label UI | tipe | wajib | default | validasi |
  |---|---|---|---|---|---|
  | kedatangan | (checkbox) | checkbox | — | — | `Datang` / `''` (`:5452`) |
  | catatanAktual | (input) | number | tidak | "Kosongkan jika pas (qty)" | placeholder `:5409` |
- **Perhitungan browser:** carry-over PO tertunda berlaku hanya jika rentang menyentuh hari ini/ke depan;
  PO "In Progress/Partially complete" ≤ `CHECKIN_TERTUNDA_MAKS_HARI = 14` hari ikut dibawa **seluruh barisnya**
  (`:4721-4732`, `:4821-4843`).
- **Catatan:** mencentang barang CK memotong stok CK server-side → `muatSaldoCK()` diulang setelah simpan (`:5485-5488`).

### D.5 `ordering` › restock — Daftar Restock (admin)
- **Tampilan:** tabel: Bahan (tier), Status, Stok sekarang, Reorder point, Saran pesan, Cukup(?); ringkasan
  kartu "Pesan sekarang / Segera siapkan / Aman / Belum ada stok"; batas 80 baris (`RESTOCK_LIMIT = 80`, `:3757-3824`).
- **Aksi:** checkbox "hanya yang perlu ditindak" (`restock-only-act`), cari, unduh CSV (`unduhRestockCsv`, `:3833-3845`).
- **Perhitungan (klien, `laksamana-forecast.js`):**
  - `status`: `stockBase<0`→check; `≤reorder`→order; `≤reorder*1.5`→soon; lain→safe (`laksamana-forecast.js:200-203`).
  - `suggestOrderPacks = ceil(needBase/pack)` (`:213`).
  - Tier label: `A:"Andal", B:"Cukup", C:"Perlu dicek"` (`:38`).
- **Sumber data:** payload prakiraan dari **Google Apps Script** (`appScriptUrlForecast`, `ordering/index.html:1049`, `:3686`),
  fallback cache localStorage, fallback `window.LAKSAMANA_FORECAST` (`forecast_export.js`) (`:3681-3725`).

### D.6 `ordering` › forecast — Data Forecast (admin)
- **Tampilan:** status "Data prakiraan termuat — N bahan" / "Stok hari ini termuat — N bahan (per …)"
  (`:3741-3750`); tabel **Keandalan Prakiraan (tier + WAPE)** (`:3847-3868`); unggah data latih
  ke arsip (`TRAINING_URL`, `:3926`, `:3958`).
- **Perhitungan:** `healthRows`/`healthTally` di `laksamana-forecast.js:424-462`; urutan tier/WAPE/usage/nama.

### D.7 `ordering` › users — Kelola Akses (admin)
- **Tampilan:** daftar kru + dropdown role (`Admin` / `Order + Check-in` / `Check-in Saja`) (`:1622-1638`).
- **Aksi:** `setUserRole` → `saveUser` (`:1640-1652`); seed awal `bulkSeed` bila daftar kosong (`:1310`).
- **Validasi:** tidak bisa menurunkan akun sendiri; minimal 1 Admin (`:1644-1646`).
- **Catatan:** daftar kru kini murni dari `ordering-users.php` (roster Office via Apps Script dicabut;
  `:1288-1312`).

### D.8 `purchasing` › dashboard — Monitor Order
- **Tampilan:** antrean kartu per nomor PO ("Antrean Pesanan Bahan Baku"), sub-tab **📋 Per Item /
  📦 Gabung per Vendor / 🗄️ Arsip Selesai** dengan lonceng jumlah (`:283-285`, `updateSubTabCounts` `:2936-2960`).
  Kartu per-item & konsolidasi per vendor (`renderIndividualCard:3374`, `renderConsolidatedCard:3524`).
- **Filter:** cari (nomor PO/vendor/barang), tanggal submit, tanggal datang, divisi, filter status (`:2964-…`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | Arsipkan | POST arsip batch | `archive` | `POST /orders/archive` ✅ | `:5530` |
  | Buka Arsip / Batal Arsip | unarchive | `unarchive` | `POST /orders/unarchive` ✅ | `:5461` |
  | isi Tgl Jemput | set tgl jemput | `updateTglJemput` | `PATCH /orders/{nomor}` (`tglJemput`) ✅ | `:3370` |
  | WA (draf chat) | buka WhatsApp pratinjau | — (klien) | — | `:4559-` |
  | update kedatangan | tandai datang | `updateKedatangan` | `PATCH /orders/{nomor}` ✅ | `:5457` |
- **Perhitungan browser:** `pesananCK(o)` mengecualikan baris CK dari Monitor Order
  (batchName 'Central Kitchen' **atau** `sumber==='ck'`) (`:2908-2926`).
- **Catatan:** "Gabung per Vendor" mengabaikan filter divisi (`:2975-2980`).

### D.9 `purchasing` › jemput — Jemput Hari Ini ("Jemput Sendiri")
- **Tampilan:** daftar barang `caraBeli==='jemput'` yang belum dijemput (`renderJemput:5021`).
- **Aksi:** tutup/isi tanggal jemput; "Tandai semua" (`:5056-5058`). Endpoint `PATCH /orders/{nomor}` (`tglJemput`) ✅.

### D.10 `purchasing` › online — Barang Online
- **Tampilan:** daftar barang `caraBeli==='online'` (belum datang / riwayat) (`renderOnline:5261`).
- **Aksi:** "Tandai semua" → `updateKedatangan` (`tglTerima`, `catatanTerima`) (`:5300-5401`).
  Endpoint `PATCH /orders/{nomor}` ✅.

### D.11 `purchasing` › ck — Central Kitchen
- **Tampilan:** stok CK (`renderCKSaldo:5884`), dashboard CK (sering diambil, tren harian, rincian,
  `:6031-6349`), mutasi (`renderCKMutasi:6349`), pilih barang/satuan/padanan.
- **Aksi:**
  | tombol | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | Simpan (mutasi) | POST mutasi manual | `simpan` | `POST /ck/movements` ✅ | `:6311` |
  | Hapus (mutasi) | DELETE mutasi | `hapus` | `DELETE /ck/movements/{id}` ✅ | `:6408` |
  | Ambil dari CK | GET saldo/mutasi | (GET `ck.php`) | `GET /ck/balance`, `/ck/movements` ✅ | `:5708` |
- **Perhitungan browser:** dashboard CK dihitung dari daftar mutasi klien (`hitungRekapCK`, tren harian) (`:6031-6216`).

### D.12 `purchasing` › overview — Rekap Per Bulan
- **Tampilan:** KPI total qty / baris order / item unik / vendor aktif / perhatian (`:675-703`);
  grafik tren bulanan, DOW, vendor, tim (`renderTrendChart:2655`, `renderDowChart:2688`, `renderVendorChart:2719`, `renderTeamChart:2747`);
  tabel rekap + sparkline 4 bulan + badge "Naik/Turun/Baru/Stabil" (`renderRecapTable:2823-2895`).
- **Perhitungan browser:** kicki total dari `appState.orders` per bulan; delta vs bulan lalu; sparkline 4 bulan (`:2843-2870`); pemilih bulan (`:2823`).

### D.13 `purchasing` › database — Database & Vendor
- **Tampilan:** dua blok: **Daftar Kontak Vendor** (tabel, semua kolom termasuk kosong, cari + pager,
  `:820-882`) dan **Aturan Distribusi Bahan Baku & Produk** (tabel, `:908-964`), plus
  **Kustomisasi Format Chat (Item)** + **(Gabungan)** (`:884-904`).
- **Aksi vendor:** Excel/CSV export, Import (`importVendors`), Tambah/Edit/Hapus Vendor
  (`addVendor`/`deleteVendor`), format chat. Endpoint: `GET/POST/PATCH/DELETE /vendors`, `POST /vendors-import` ✅.
- **Aksi produk:** Excel/CSV export, Import (`importProducts`), "Tambah Aturan Baru"/Edit
  (`addProduct`/`deleteProduct`). Endpoint: `GET/POST/PATCH/DELETE /products`, `POST /products-import` ✅.
- **Form & field — Vendor (modal "Tambah Vendor Baru"/edit, `:1129-1206`):**
  | field | label UI | tipe | wajib | default/pilihan |
  |---|---|---|---|---|
  | name | Nama Vendor | text | ya | — |
  | whatsapp | Nomor WhatsApp | text | ya | auto-format 62 |
  | perluJadwalJemput | "Barang tidak bisa dijemput di hari yang sama" | checkbox | tidak | mengunci Arsipkan sampai tgl jemput diisi |
  | penerima | Nama Penerima | text | tidak | "persis seperti di buku rekening" |
  | bank | Bank | select | tidak | dari daftar + `cekBank` |
  | norek | No. Rekening | text | tidak | cek rekening kembar (`cekNorekKembar`) |
  | tutupHari | Hari Tutup | checkbox 7 hari | tidak | 0 Minggu … 6 Sabtu |
- **Form & field — Produk (modal "Atur Distribusi Produk (Live)", `:1225-1517`):**
  | field | label UI | tipe | wajib | default/pilihan |
  |---|---|---|---|---|
  | nama | Nama Bahan Baku | text | ya | peringatan ganti nama `:1242-1247` |
  | sumber | Sumber Barang | tombol | ya | `''` Beli dari Vendor / `ck` Central Kitchen / `both` Vendor & CK |
  | satuanDasar | Satuan Dasar | select | ya (untuk ck/both) | |
  | dipack / isi | Bentuk Simpanan (Dipack/Curah) + 1 Pack = | tombol+number | ya | default Dipack |
  | diOutlet | Disimpan Di | tombol | ya (ck) | CK saja / CK & Outlet |
  | utama | Vendor Utama | select | tidak | |
  | cadangan | Vendor Alternatif / Cadangan | checkbox list | tidak | |
  | satuan | Satuan Bahan Ini | checkbox list | tidak | boleh >1 + satuan sendiri |
  | isi (ukuran) | Ukuran Satuan (wajib) | select+number | ya | ikut satuan dicentang |
  | kategori | Kategori (untuk Daily SO) | text+datalist | tidak | 14 opsi `:1454-1460` |
  | area | Area | checkbox (boleh >1) | tidak | tidak dicentang = Umum |
  | caraBeli | Cara Beli | select | tidak | `''` Diantar vendor / `online` / `jemput` |
  | aktif | "Bahan ini masih dipakai" | checkbox | — | default true |
- **Catatan:** kategori **harus sama persis** dengan `SO_KATEGORI` di usage (`:1444-1453`); `caraBeli` `''` = Diantar vendor (`:1498-1508`).

### D.14 `purchasing` › users — Kelola Akses (admin)
- **Tampilan:** matriks izin `renderPermMatrix:2079` (`PERM_PAGES` × role) + daftar user (`renderUserList:2146`).
- **Aksi:** simpan `savePerms` (`:1703-1712`), `saveUserAdd/Update/Delete` via `users.php` (`:1902-1928`).
  Endpoint v1: `PUT /settings/purchasing` (⚠️ 503 bila tabel hilang) + `GET/POST/PATCH/DELETE /users` ✅.
- **Catatan:** `users.php` mengembalikan PIN (legacy, frozen); v1 tidak pernah mengembalikan PIN (`docs/modules/stock.md:8`).

### D.15 `purchasing` › log — Log Aktivitas (admin)
- **Tampilan:** daftar log (waktu, aktor, aksi, ringkas), filter `dari/ke/modul/q/limit` (`:2440-2490`).
- **Endpoint v1:** `GET /logs?from=&to=&modul=&q=&limit=` ✅.

### D.16 `tree` — Pohon Resep
- **Tampilan:** sidebar cari menu + cari bahan; pohon per menu (root = bahan mentah, wip = olahan,
  storebought = beli jadi, flag = data belum lengkap); statistik Menu/Bahan mentah/Sambungan/Takaran belum ada;
  drawer "Dipakai di menu" (`:215-272`, `:378-446`).
- **Sumber data:** **seluruh data tertanam di berkas** `const DATA = {"menus":[…], "whereused":…, "stats":…}`
  (`tree/index.html:275`) + `tree_template.html` (template generator). **TIDAK ada panggilan backend sama sekali**
  (`docs/modules/stock.md:12`). Karena itu v1 menyediakan `/hpp/ingredients` + `/hpp/recipes` **read-only** untuk
  modul `tree` agar pohon dapat dibangun ulang di Vue.
- **Aksi:** klik bahan → drawer where-used; klik menu → render pohon; Escape menutup. Tanggal data
  "Data per 20 Juli 2026, 15:53" (`:220`).

### D.17 `usage` › opname — Daily SO
- **Tampilan:** filter Tanggal + Tim + Cari item; ringkasan; daftar item per kategori
  (`SO_KATEGORI` 14 + "Belum dikategori"); riwayat opname (`:376-419`, `:1837-1840`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | Tambah item baru | tambah item + daftar ke produk | `addProduct` (items.php) | `POST /products` (modul purchasing/hpp) ⚠️ beda modul | `:406-409,2443-2444` |
  | Simpan Opname Hari Ini / Simpan Perubahan Opname | POST/PATCH opname | `simpan`/`hapus` | `POST /opname`, `PATCH/DELETE /opname/{id}` ✅ | `:410,2326-2343` |
- **Form & field:** Tanggal, Tim, Cari item, per baris: Stok fisik (number), Masuk (number) (`:2200-2230`).
- **Perhitungan browser (buku stok, `soHitung` `:2116-2124`):**
  - `opening = soKemarin(nama,tgl,tim)` (closing kemarin, entri terbaru `< tgl` dengan `fisik` terisi) (`:2058-2070`).
  - `keluar = SO_KELUAR[nama]` = Σ pemakaian + waste + serah terima tanggal+tim sama, dikonversi ke satuan dasar (`soMuatKeluar` `:1910-1953`).
  - `seharusnya = baru ? null : opening + masuk − keluar` (`baru` = opening null).
  - `selisih = (closing===null || seharusnya===null) ? null : closing − seharusnya`.
  - **`selisih` TIDAK disimpan**; yang disimpan `{item, unit, sistem, fisik}` (`:1822-1825`), `sistem` = stok tercatat sebelumnya.
- **Konversi satuan:** `SO_SATUAN` (Kg/Gram/Liter/ML) + tabel ukuran per barang (`satuanDasar`+`isi`) +
  tandai "satuan campur" bila tak terkonversi (`:1955-2055`).
- **Validasi:** 0 vs kosong dibedakan (`soAngka` null bila kosong, `:1976-1980`).

### D.18 `usage` › pemakaian — Pemakaian Bahan
- **Tampilan:** sub **Catat Pemakaian** dan **Report Pemakaian** (dashboard: ringkasan, sebaran per jenis/tim,
  rekap per bahan, daftar satu per satu) (`:427-588`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | 💾 Simpan sebagai Rencana | POST status Rencana | `simpan` | `POST /usage` ✅ | `:487,1185-1199` |
  | ✅ Simpan & Tandai Sudah Dipakai | POST status Selesai | `simpan` | idem ✅ | `:488` |
  | (di report) ubah status | PATCH status | `status` | `PATCH /usage/{id}` (`status`) ✅ | `:1219,1505` |
  | (di report, ikon) Ubah / Hapus | edit / delete | `hapus` | `DELETE /usage/{id}` ✅ | `:1228,1507-1508` |
- **Form & field:** Tanggal Pakai, Jenis Kegiatan (Prasmanan/Training/RND/Lainnya),
  Tim (eksplisit), Nama/Keterangan Kegiatan (`namaEvent`), Catatan, baris bahan `{item,qty,unit,note}` (`:443-483`).
- **Validasi:** "Bahan kosong","Isi minimal satu bahan yang dipakai." (`:1186`); Tersimpan N bahan (`:1196`).
- **Filter:** cari, periode (Hari Ini/7 Hari/Bulan Ini/Semua), laci (Bulan Tertentu/Jenis/Divisi admin) (`:515-561`).

### D.19 `usage` › waste — Waste Produk
- **Tampilan:** sub **Catat Waste** / **Report Waste** (ringkasan, Sebab Terbanyak, Produk Terbanyak, rekap) (`:595-721`).
- **Aksi:**
  | tombol | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | 🗑️ Simpan Catatan Waste | POST | `simpan` | `POST /waste` ✅ | `:653,1708-1745` |
  | lihat foto | GET foto | `foto` | `GET /waste/{id}/photo` ✅ | `:2858,3083` |
  | Ubah / Hapus | edit / delete | `hapus` | `PATCH/DELETE /waste/{id}` ✅ | `:1748,3084-3085` |
- **Form & field:** Tanggal, Sebab (`SEBAB_OPSI` = Kadaluarsa/Rusak/Tumpah/Salah Olah/Sisa Produksi/Lainnya, `:1554`),
  Tim, Jumlah (qty number default 1), satuan (+ "+ Satuan lain…"), Produk/Bahan yang Terbuang (autocomplete,
  boleh di luar daftar), Catatan (kenapa terbuang), Foto (opsional) (`:610-651`).
- **Validasi:** "Produk kosong"; "Jumlah kosong"; "Satuan kosong","Tulis satuannya, atau pilih dari daftar." (`:1709-1717`).
- **Foto:** hanya dikirim bila berubah (`FOTO_WASTE !== null`); `''` = hapus (`:1730-1731`).

### D.20 `usage` › serah — Serah Terima
- **Tampilan:** sub **Catat Serah Terima** / **Report Serah Terima** (Arah Perpindahan, Barang Terbanyak, rekap) (`:726-853`).
- **Aksi:**
  | tombol | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | Simpan Serah Terima | POST | `simpan` | `POST /handovers` ✅ | `:796,2569-2600` |
  | Buka Kamera / Upload Foto | ambil foto (dua input: capture & file) | — | — | `:769-780` |
  | lihat foto / Ubah / Hapus | foto/edit/delete | `foto`/`hapus` | `GET /handovers/{id}/photo`, `PATCH/DELETE` ✅ | `:2640,2999-3001` |
- **Form & field:** Tanggal, Diserahkan ke (Kitchen/Bar), Dari tim (stok), Penerima, **Foto bukti *wajib***,
  barang `{item,qty,unit}`, Catatan (`:741-794`).
- **Validasi:** "Tanggal kosong"; "Pilih tim","Tentukan tim stok asalnya."; "Belum ada barang","Isi minimal satu item + jumlah.";
  "Foto wajib","Buka kamera atau upload foto bukti dulu." (`:2572-2578`).

### D.21 `hpp` › dash — Dashboard HPP
- **Tampilan:** ringkasan COGS, menu paling boros, bahan paling menggerakkan modal; uraian bahan (`uraiBahan`).
- **Perhitungan:** memakai `modalMenu`/`cogsOf` (lihat D.24 & F).

### D.22 `hpp` › resep — Daftar Resep
- **Tampilan:** tab **Menu Jadi · Base & Olahan · Prasmanan** (`prasmananKah` `:928`); kolom kode POS, yield,
  harga jual, Modal, per unit, COGS; pager terpisah `F`/`FBS`/`FPR`; ekspor/impor Excel; cetak massal PDF.
- **Aksi:**
  | tombol | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | 💾 Simpan | simpan resep | `simpanResep` | `POST/PATCH /hpp/recipes` ✅ | `:1414-1416` |
  | Hapus | hapus resep | `hapusResep` | `DELETE /hpp/recipes/{id}` ✅ | `:1422` |
  | (toggle aktif) | ubah `aktif` | `simpanResep` | `PATCH` ✅ | `:956` |
  | Impor Excel | impor resep | `imporResep` | `POST /hpp/recipes-import` ⚠️ | `:2934` |
  | Ekspor Excel/CSV, Cetak PDF | klien | — | — | `:2597-2642` |
- **Perhitungan:** `cogsOf(r) = modalPorsi(r)/hargaJual(r)`; `modalPorsi = modalMenu.total/porsiYield` (`:668-670`).

### D.23 `hpp` › bahan & floor — Bahan & Harga / Barang Floor
- **Tampilan:** `layarBahan(floor)` dipakai dua halaman (`:1485`); kolom harga beli, per1, vendor, produk,
  kategori, `sisi_harga`; bendera bayangan/`tabrakan`.
- **Aksi:**
  | tombol | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | 💾 Simpan (bahan) | simpan bahan | `simpanBahan` | `POST/PATCH /hpp/ingredients` ✅ | `:1879-1896` |
  | Hapus | hapus bahan | `hapusBahan` | `DELETE /hpp/ingredients/{nama}` ✅ | `:1953` |
  | 🗑 Hapus N bayangan itu | hapus bahan sama-resep | `hapusBahanSamaResep` | `POST /hpp/remove-shadows` ✅ | `:1905-1919` |
  | 🔤 Samakan nama dengan purchasing | rename pairing | `samakanNama` | `POST /hpp/align-names` ✅ | `:2126-2130` |
  | ⬇ Tarik N bahan dari Purchasing | pull produk | `tarikProduk` | `POST /hpp/pull-products` ✅ | `:2100-2104` |
  | Gabungkan | gabung bahan | `gabungBahan` | `POST /hpp/ingredients-merge` ✅ | `:2071-2075` |
  | Impor/Ekspor Excel | | `imporBahan` | `POST /hpp/ingredients-import` ✅ | `:2575` |
- **Sisi harga:** `sisi_harga` `''|'beli'|'resep'`; `''` disimpulkan dari tipe resep bertabrakan
  (base→resep; menu jadi yang dipakai→beli) (`:735-800`).

### D.24 `hpp` › pakai / kalk / atur — Pemakaian & Selisih / Kalkulator / Pengaturan
- **pakai:** `GET/PATCH /hpp/usage/{YYYY-MM}` (`simpanPakai` `:3204`); `daftarBulan`, `penjualan`, `catatan`.
- **kalk:** `kartuKalk` menghitung modal & harga jual tanpa menyimpan; membagi modal dengan jumlah porsi
  SEBELUM COGS (`:6127-6160` CLAUDE.md).
- **atur:** `simpanSetting` → `PATCH /hpp/settings` ✅ (`:3336`); `{targetFood,targetDrink,buffer,lampuKuning,lampuMerah}`.
- **impor (one-time):** `action:'impor'` → `POST /hpp/import` (HPP admins) ✅ (`:3469`); all-or-nothing di v1.

## E. Pemetaan backend
| action lama | dipakai di layar | baca/tulis | endpoint v1 | status ✅/⚠️/❌ | catatan |
|---|---|---|---|---|---|
| GET `items.php` | ordering (autocomplete), usage, hpp | baca | `GET /products` | ✅ | bentuk `{products:{Nama:{…}}}` → `{data, meta.versions}` |
| `batchOrder` (orders.php) | ordering: order & CK; purchasing import? | tulis | `POST /orders/batches` | ✅ | `pic` dari sesi; `merged`/`mergedItems` |
| `updateKedatangan` (orders.php) | ordering: checkin; purchasing: online | tulis | `PATCH /orders/{nomor}` (`kedatangan`,`catatanAktual`,`tglTerima`,`catatanTerima`) | ⚠️ | legacy batch `updates[]`; v1 per nomor |
| `updateOrderQty` (orders.php) | ordering: edit qty | tulis | `PATCH /orders/{nomor}` (`qty`) | ⚠️ | legacy `rowIndex`; v1 `nomorOrder` |
| `updateTglJemput` (orders.php) | purchasing: dashboard/jemput | tulis | `PATCH /orders/{nomor}` (`tglJemput`) | ⚠️ | idem |
| `deleteRow` (orders.php) | ordering: hapus baris | tulis | `DELETE /orders/{nomor}` | ✅ | legacy `rowIndex` |
| `archive`/`unarchive` (orders.php) | purchasing: dashboard | tulis | `POST /orders/archive`, `/orders/unarchive` | ✅ | `{orderIds}` → `{updated}` |
| `import` (orders.php) | (tidak dipanggil frontend) | tulis | `POST /orders/import` | ✅ | alat migrasi |
| GET `orders.php` | ordering: checkin; purchasing: semua | baca | `GET /orders`, `/orders/batches`, `/orders/stats` | ✅ | filter exact |
| GET/PUT `stock.php` | ordering/purchasing: Stock Today (xlsx) | baca/tulis | `GET/PUT /stock-today` | ✅ | PUT whole snapshot; kosong ditolak |
| GET `ck.php` | ordering: saldo/stok; purchasing: CK | baca | `GET /ck/balance`, `GET /ck/movements` | ✅ | balance = SUM(masuk)−SUM(keluar) |
| `simpan` (ck.php) | purchasing: CK mutasi | tulis | `POST /ck/movements` | ✅ | `qtyInput` dikonversi packIsi |
| `hapus` (ck.php) | purchasing: CK mutasi | tulis | `DELETE /ck/movements/{id}` | ✅ | baris check-in ditolak 422 |
| `kirim` (ck.php) | ordering: Kirim ke CK | tulis | `POST /ck/deliveries` | ✅ | hanya barang `diOutlet` |
| `catat` (log.php) | ordering & purchasing | tulis | `POST /logs` | ✅ | server set `waktu`, `aktor` dari sesi |
| GET `log.php` | purchasing: Log Aktivitas | baca | `GET /logs` | ✅ | admin; `limit` default 300 max 2000 |
| GET/POST `ordering-users.php` (`saveUser`/`bulkSeed`) | ordering: Kelola Akses | baca/tulis | `GET/POST/PATCH/DELETE /ordering-users`, `POST /ordering-users-import` | ⚠️ | `bulkSeed` → `ordering-users-import` (upsert id) |
| `deleteUser` (ordering-users.php) | ordering: Kelola Akses | tulis | `DELETE /ordering-users/{id}` | ✅ | tak dipakai UI legacy |
| GET/POST `purchasing-settings.php` (`savePerms`,`saveTemplates`) | purchasing: Kelola Akses + format chat | baca/tulis | `GET/PUT /settings/purchasing` | ⚠️ | **503 settings_unavailable** (tabel `stock_settings` hilang) |
| GET/POST `ordering-settings.php` (`savePerms`) | (tidak dipakai UI ordering) | baca/tulis | `GET/PUT /settings/ordering` | ⚠️ | idem; UI ordering tak pakai |
| GET `users.php`, `add`/`update`/`delete` | purchasing: Kelola Akses | baca/tulis | `GET/POST/PATCH/DELETE /users` | ✅ | PIN tak pernah dikembalikan v1 |
| GET `vendors.php` | purchasing: Database Vendor; BD | baca | `GET /vendors` | ✅ | tanpa `ok` di legacy |
| `addVendor`/`deleteVendor`/`importVendors` | purchasing: Database Vendor | tulis | `POST/PATCH/DELETE /vendors`, `POST /vendors-import` | ⚠️ | preserve-if-null legacy untuk penerima/bank/norek |
| `addProduct`/`deleteProduct`/`importProducts` | purchasing: Aturan Distribusi; usage: tambah item; hpp: simpanBahan | tulis | `POST/PATCH/DELETE /products`, `POST /products-import` | ⚠️ | v1 `PATCH /products/{nama}`; rename cascade HPP |
| GET/POST `usage.php` (`simpan`,`status`,`hapus`) | usage: Pemakaian | baca/tulis | `GET/POST /usage`, `PATCH/DELETE /usage/{id}` | ✅ | `status` = field PATCH |
| GET/POST `waste.php` (`simpan`,`hapus`,`foto`) | usage: Waste | baca/tulis | `GET /waste`, `POST/PATCH/DELETE /waste/{id}`, `GET /waste/{id}/photo` | ✅ | foto `""` hapus, tak dikirim = pertahankan |
| GET/POST `serah.php` (`simpan`,`hapus`,`foto`) | usage: Serah Terima | baca/tulis | `GET/POST /handovers`, `PATCH/DELETE /handovers/{id}`, `GET /handovers/{id}/photo` | ✅ | foto wajib untuk baris baru |
| GET/POST `opname.php` (`simpan`,`hapus`) | usage: Daily SO | baca/tulis | `GET/POST /opname`, `PATCH/DELETE /opname/{id}` | ✅ | `selisih` tak disimpan |
| GET `hpp.php?action=all`; `pakai` | hpp: semua layar | baca | `GET /hpp/ingredients`, `/hpp/recipes`, `/hpp/settings`, `/hpp/usage/{bulan}` | ✅ | payload flat → dipecah per resource |
| `simpanBahan`/`hapusBahan`/`imporBahan` | hpp: Bahan & Floor | tulis | `POST/PATCH/DELETE /hpp/ingredients`, `POST /hpp/ingredients-import` | ⚠️ | v1 PATCH per nama; rename cascade |
| `hapusBahanSamaResep` | hpp: Bahan & Floor | tulis | `POST /hpp/remove-shadows` | ✅ | server yang menentukan |
| `gabungBahan` | hpp: Bahan | tulis | `POST /hpp/ingredients-merge` | ✅ | If-Match = versi `from` |
| `tarikProduk` | hpp: Bahan | tulis | `POST /hpp/pull-products` | ✅ | |
| `samakanNama` | hpp: Bahan | tulis | `POST /hpp/align-names` | ✅ | |
| `simpanResep`/`hapusResep` | hpp: Daftar Resep | tulis | `POST/PATCH/DELETE /hpp/recipes`, `/hpp/recipes/{id}` | ✅ | `kode` di-upper, yield 0→1 |
| `imporResep` | hpp: Daftar Resep | tulis | `POST /hpp/recipes-import` | ✅ | upsert by id |
| `impor` (`timpa`) | hpp: (one-time) | tulis | `POST /hpp/import` | ⚠️ | v1 all-or-nothing; legacy wipe dulu |
| `simpanPakai` | hpp: Pemakaian & Selisih | tulis | `PATCH /hpp/usage/{YYYY-MM}` | ✅ | upsert baris by bahan |
| `simpanSetting` | hpp: Pengaturan | tulis | `PATCH /hpp/settings` | ✅ | hanya 5 kunci |
| GET `training.php` summary | ordering: Data Forecast | baca | `GET /training` | ✅ | `{usage, sales_detail}` |
| `{type:'training', target, filename, content_b64}` | ordering: Data Forecast | tulis | `POST /training` | ✅ | v1 + cek ≤12MB & magic bytes |
| `?action=list/get&target=` (training.php) | ordering: arsip | baca | `GET /training/{target}`, `/training/{target}/{name}` | ✅ | legacy butuh API_TOKEN |
| `listModuleRoster` (account-api-mysql) | ordering: roster Office | baca | — | ❌ | **tidak ada di v1 stock** (lihat I) |
| payload prakiraan (Google Apps Script `appScriptUrlForecast`) | ordering: Daftar Restock & Data Forecast | baca | — | ❌ | **model prakiraan proses terpisah** (`docs/api/stock.md:177`); lihat I |
| GET `hpp.php`/`items.php` untuk pohon | tree (tidak dipakai legacy) | baca | `GET /hpp/ingredients`, `/hpp/recipes` (modul `tree`) | ⚠️ | legacy tree = data tertanam, bukan API |

**Konkurensi:** tabel stock **tidak punya kolom versi**; `version` tiap record = hash isi
(`docs/api/stock.md:10`). Kirim sebagai `If-Match` atau `?version=`. Stale ⇒ `409 version_conflict`
dengan `details.current`. Legacy tidak punya ini (last-write-wins lewat `text/plain` POST).
`ck_stock` punya UNIQUE(`ref`,`arah`) agar sinkron kedatangan idempoten (`docs/modules/stock.md:84`).

**Kode error yang wajib ditangani UI (`docs/api/stock.md:179-189`):**
`401 unauthenticated` · `403 module_not_granted` · `404 not_found` · `409 already_exists`/`batch_not_found`/`hpp_not_empty`/`last_admin`/`version_conflict` ·
`422 validation_failed` (pesan legacy lewat: `nama produk kosong`, `newQty bukan angka`, `format tanggal jemput harus YYYY-MM-DD`, `stock kosong`, `tanggal wajib diisi`, `foto bukti wajib diunggah`, `barang bukan barang Central Kitchen: …`, `Hanya berkas .xlsx/.xls.`, `Isi berkas tidak terbaca.`) ·
`428 version_required` · `503 settings_unavailable`.

## F. Aturan bisnis yang wajib dibawa
1. **Spare/buffer modal dikenakan SEKALI, hanya di menu jadi (`tipe==='dish'`)** — kenapa: kalau base ikut dipadding, menu yang memakai base kena 5% di atas 5%; resep bertingkat 3 kena 3×. Rumus: `modalMenu(r) = modalDasar(r) + (kenaSpare(r) ? modalDasar.total * buffer : 0)`; `kenaSpare(r)=tipe==='dish'`. `perUnitResep` memakai `modalDasar`, bukan `modalMenu`. Bukti: `laksamana-office/deploy/stock/hpp/index.html:610-645`, `CLAUDE.md:5733-5782`.
2. **`modalResep()` memoize hasil dan memulangkan referensi yang sama; `modalMenu()` selalu objek baru** — kenapa: menambah spare ke objek memo membuat modal naik tiap render (uji: 3 render 7.293→11.879). Bukti: `hpp/index.html:615-630`, `CLAUDE.md:5760-5770`.
3. **Buffer negatif diabaikan, nol tetap sah** — kenapa: negatif MENGURANGI modal; nol = cara mematikan spare. Bukti: `hpp/index.html:633-638`.
4. **`COGS = modalMenu(r).total / porsiYield(r) / hargaJual(r)`** — `Harga Jual` selalu harga **satu yield**; jangan "perbaiki" dengan mengali harga jual × yield. Bukti: `hpp/index.html:668-670`, `CLAUDE.md:6048-6080`, `:6127-6160`.
5. **Resep "tanpa bahan" = tidak punya baris bahan BERNAMA**; baris `{catatan}` (tanpa `nama`) tidak menghitung apa pun dan **tidak** membuat `modal_manual` berhenti dipakai. Bukti: `hpp/index.html:567-596`.
6. **Satu nama boleh ada di dua sisi (bahan vs resep)** — `sisi_harga`: `'beli'` dari baris bahan, `'resep'` dari resep bernama sama; `''` disimpulkan dari tipe resep bertabrakan (base→resep; menu jadi yang dipakai→beli; sisanya "bayangan?"). Bukti: `hpp/index.html:700-820`; `CLAUDE.md` blok "SATU NAMA DI DUA SISI".
7. **Base olahan buatan sendiri tetap berdiri di Purchasing/CK** (Ayam Karage dll) — harganya modal resep, bukan harga beli. Bukti: `hpp/index.html:705-720`.
8. **Ekspor/impor resep: satu baris = satu baris BAHAN**; kolom resep hanya di baris pertama; baris CATATAN ditandai `Ref=Catatan`; pencocokan NAMA **+ JENIS**; ejaan tersimpan menang; baris digabung dengan data lama sebelum kirim; resep non-aktif tetap diekspor; baris bahan resep yang ikut **diganti utuh**. Bukti: `hpp/index.html:2597-2934`, `CLAUDE.md:5898-6010`.
9. **Impor Excel bahan/resep tidak pernah menghapus & tidak pernah mengganti nama**; baris yang tidak ada di berkas dibiarkan. Bukti: `hpp/index.html:2555-2565`, `:2613`.
10. **Daily SO = buku stok**: `opening = closing kemarin (per tim, entri terbaru < tgl)`; `keluar = pemakaian + waste + serah terima` (tanggal+tim sama, dikonversi ke satuan dasar); `seharusnya = opening + masuk − keluar`; `selisih = fisik − seharusnya`. **Hitungan pertama (belum pernah dihitung) tidak punya seharusnya/selisih.** `selisih` TIDAK disimpan. Bukti: `usage/index.html:1822-1825`, `:2058-2124`.
11. **0 ≠ kosong** di Daily SO/opname; angka kosong disimpan `null` ("belum dihitung" bukan 0). Bukti: `usage/index.html:1976-1980`, `docs/api/stock.md:114`.
12. **Konversi satuan hanya yang rasionya pasti** (Kg↔Gram, Liter↔ML); satuan diskrit (Pcs/Dus/Pack) TIDAK ditebak — ditandai "satuan campur". Ukuran per barang diisi di Purchasing (`satuanDasar`+`isi`). Bukti: `usage/index.html:1955-2055`.
13. **Saldo Central Kitchen tidak pernah disimpan** = SUM(masuk) − SUM(keluar); tiap qty dalam satuan dasar; `Pack` dikonversi `packIsi` saat **tulis**, bukan saat baca. Mutasi barang yang tak lagi CK tetap tampil `hilang:true`. Bukti: `docs/api/stock.md:80-92`.
14. **Pengajuan CK & form belanja = `batchOrder` yang sama**; pengajuan CK selalu `batchId:''` (`batchName='Central Kitchen'`). Barang CK dikenali dari `batchName` **atau** `sumber==='ck'`. Bukti: `ordering/index.html:2804`, `purchasing/index.html:2908-2926`.
15. **Barang CK & `both` satuannya dipaksa `[Pack, packSatuan]`**; `isi` hanya angka positif & butuh `satuanDasar`; satuan yang punya ukuran ikut masuk daftar satuan. Bukti: `docs/api/stock.md:57`, `purchasing/index.html:1286-1403`.
16. **Check-in carry-over**: PO belum datang (bukan `Datang`) dari sebelum rentang ikut dibawa **seluruh barisnya**, dibatasi `CHECKIN_TERTUNDA_MAKS_HARI = 14` hari, hanya bila rentang menyentuh hari ini/ke depan. Bukti: `ordering/index.html:4721-4732`, `:4821-4843`.
17. **Tim dipilih eksplisit** di form Usage; keterangan akun (`Office`) dipakai server untuk scope (`pur_tim_pemanggil`), boleh beberapa tim. `tim` direkam SAAT mencatat. Bukti: `usage/index.html:897-910`, `catat-common.js:39-46`, `docs/api/stock.md:116`.
18. **Foto serah terima WAJIB untuk catatan baru**; saat edit tidak memilih ulang = pakai lama. Foto dikecilkan sebelum kirim (1280px, mutu 0.72, maks 12MB). Bukti: `usage/index.html:2577`, `catat-common.js:398-425`.
19. **Log aktivitas tidak boleh menggagalkan pekerjaan** — fire-and-forget, server mengisi `waktu`, `aktor` dari sesi; hanya tindakan yang MENGUBAH yang dicatat. Bukti: `ordering/index.html:1201-1218`, `docs/api/stock.md:124`.
20. **Waktu eksplisit WIB** (`Asia/Jakarta`) untuk nomor order, batch id, `waktu`, id CK — legacy `date()` mengikuti zona hosting. Bukti: `CLAUDE.md:7180-7200`, `docs/modules/stock.md:26`.
21. **`stock_settings` HILANG di prod & dev** — legacy `ordering-settings.php`/`purchasing-settings.php` menjawab `500 kesalahan server`; v1 baca default `meta.available:false`, tulis `503 settings_unavailable`. **Jangan mengarang tabel.** Bukti: `docs/modules/stock.md:6`, `docs/api/stock.md:175`.
22. **HPP admins-only untuk `POST /hpp/import`** (satu kali dari Excel, all-or-nothing). Bukti: `docs/api/stock.md:38,152`.

## G. Ketergantungan lintas modul
- **Tree (Pohon Resep)** tidak punya backend sendiri — data tertanam di `tree/index.html:275`; v1 membuka `/hpp/ingredients` & `/hpp/recipes` read-only untuk modul `tree` (`docs/modules/stock.md:12`).
- **Ordering → Office/Account**: roster kru ber-akses `ordering` via `account-api-mysql?action=listModuleRoster` (`ordering/index.html:1318-1330`); penggantinya di v1 sebagian lewat `ordering-users`. **Tidak ada di kontrak v1 stock.**
- **Ordering → Apps Script prakiraan** (`appScriptUrlForecast`, `ordering/index.html:1049`) — di luar v1.
- **Ordering ↔ CK**: pengajuan CK jadi baris order biasa; check-in memotong stok CK (`ordering/index.html:5485-5488`; `docs/api/stock.md:94`).
- **Usage → items.php** untuk daftar bahan & autocomplete (`catat-common.js:156-171`); Daily SO membaca `usage.php`+`waste.php`+`serah.php` sendiri (`usage/index.html:1935-1937`).
- **Usage (usage/waste/serah) saling baca** untuk `keluar` Daily SO.
- **HPP → Purchasing**: `addProduct`/`put` saat simpan bahan & `di_purchasing`; `tarikProduk`; `samakanNama` (`hpp/index.html:1879-1896,2100-2130`).
- **HPP ← Analytics**: Analytics membaca POS stock/hpp (bukan sebaliknya) — catat di `_lintas-modul.md`.
- **Purchasing ↔ BD/Finance**: master vendor Purchasing dibaca BD (`GET /api/v1/stock/vendors`) dan Finance/Brankas (`CLAUDE.md:7112`).
- **Purchasing → Office/Account**: sesi `lm_session` + `adminModules` (gate admin Ordering `officeAdminsModule`, `ordering/index.html:1484-1489`).
- **Aset bersama:** stock **tidak** memakai `deploy/assets/*.js`; satu-satunya berkas bersama stock adalah `deploy/stock/catat-common.js` (dipakai `usage/index.html:860` untuk sesi/toast/tanggal/satuan/autocomplete/foto). `cocok-bri.js`/`xlsx-baca.js`/`hpp-mesin.js` milik modul lain — lihat `_lintas-modul.md`.

## H. Catatan untuk implementasi Vue
- **Halaman:** `app/pages/stock/index.vue` (pemilih) + `app/pages/stock/ordering/index.vue`,
  `.../purchasing/index.vue`, `.../tree/index.vue`, `.../usage/index.vue`, `.../hpp/index.vue`.
  `definePageMeta({ access: ['ordering'|'purchasing'|'tree'|'usage'|'hpp'] })`.
- **Composable `useStock.ts`** (satu untuk 5 panel, atau pecah `useStockOrdering/UseStockHpp`):
  - products/vendors: `listProducts`, `saveProduct`, `deleteProduct`, `importProducts`, `listVendors`, `saveVendor`, `importVendors`.
  - orders: `listOrders`, `joinableBatches`, `createBatch`, `patchOrder`, `deleteOrder`, `archiveOrders`, `orderStats`.
  - ck: `ckBalance`, `ckMovements`, `createMovement`, `patchMovement`, `deleteMovement`, `deliverToCk`.
  - usage: `listUsage/createUsage/patchUsage/deleteUsage`, idem `waste/handovers/opname`, `wastePhoto/handoverPhoto`.
  - hpp: `hppIngredients`, `saveIngredient`, `mergeIngredients`, `pullProducts`, `removeShadows`, `alignNames`,
    `hppRecipes`, `saveRecipe`, `recipeImport`, `hppImport`, `hppUsage(month)`, `patchHppUsage`, `hppSettings`.
  - admin: `users`, `orderingUsers`, `settings(ordering|purchasing)`, `training` (list/upload).
- **HP vs desktop:** Ordering order/checkin & Usage catat/report → `AppList`/`AppListRow` di HP,
  `UTable` di `lg+` (daftar item, rekap bahan, mutasi CK, tabel vendor/produk/rekap). Form
  (order, CK, waste, serah, opname, vendor, produk, resep, bahan, pengaturan) → `ResponsiveSheet`.
- **Widget Beranda yang cocok:** "Order hari ini" (jumlah baris aktif), "Stok CK menipis",
  "Waste minggu ini", "COGS menu" — satu `AppFocus` per layar, hindari kartu angka besar.
- **Elemen lama yang melanggar DESIGN.md → padanannya:**
  - kartu gradien besar (`ordering/index.html:263,345,504`, `purchasing:257,380`) → header teks + `AppFocus`/`AppStatus`.
  - emoji di judul/label (🍳 📋 🧮 🗑️ … di `stock/index.html:195-225`, `hpp/index.html:212-245`) → ikon Nuxt UI, tanpa emoji.
  - kartu KPI angka besar (purchasing `:675-703`) → baris ringkas `AppStatus`.
- **Forecast/restock** perlu sumber data di Vue: `laksamana-forecast.js` (rumus) dipindah apa adanya,
  **tetapi sumber payload belum ada di v1** (lihat I).

## I. Pertanyaan terbuka
- [ ] **stock / ordering — sumber prakiraan/restock belum ada di v1.** Kontrak v1 tidak punya endpoint
  payload prakiraan (status, reorder point, saran qty, tier/WAPE); legacy membaca Google Apps Script
  (`ordering/index.html:1049,3686`) dan modelnya "proses terpisah" (`docs/api/stock.md:177`). Jadi
  Daftar Restock & Data Forecast tidak punya sumber di Vue. Opsi: A) v1 menyediakan endpoint payload prakiraan;
  B) Vue langsung memanggil Apps Script; C) simpan hasil prakiraan sebagai file `training` dan dihitung di klien.
- [ ] **stock / ordering — roster Office tanpa padanan v1.** Legacy menarik kru ber-akses `ordering`
  via `account-api-mysql?action=listModuleRoster` agar muncul di Kelola Akses sebelum login
  (`ordering/index.html:1318-1330`); kontrak v1 stock tak memuatnya. Opsi: A) cukup CRUD `ordering-users`;
  B) endpoint roster di Office/Account; C) endpoint di stock.
- [ ] **stock / pemilih — gate `<head>` tidak memuat `usage`.** `deploy/stock/index.html:113-115`
  menolak sesi yang hanya punya `usage`, padahal `:137` dan komentarnya menyebut kru yang HANYA ber-`usage`.
  Apakah ini bug yang harus diperbaiki di Vue (usage-only tetap boleh masuk), atau memang disengaja?
  Bukti: `index.html:113-115` vs `:137`.
- [ ] **stock / purchasing — `Barang Online` tanpa entri `PERM_DEFAULT`.** `PERM_PAGES` memuat `online`
  (`purchasing/index.html:1637-1645`) tetapi `PERM_DEFAULT` tidak punya kunci `online`
  (`:1647-1663`), jadi non-admin selalu `PERM_NONE`. Salah tulis atau disengaja (hanya admin)?
- [ ] **stock / hpp — pembagian state pager & tab Prasmanan.** Legacy punya 3 state pager
  (`F`/`FBS`/`FPR`, `CLAUDE.md:6021-6046`) dan `prasmananKah` dari seksi teks
  (`hpp/index.html:928`). Apakah Vue harus mereplikasi pemisahan tab dari `seksi` (bukan kolom baru)?
- [ ] **stock / tree — data tertanam vs API.** Legacy `tree/index.html:275` memuat seluruh pohon
  sebagai snapshot statis bertanggal "20 Juli 2026"; v1 menyediakan `GET /hpp/ingredients` + `/hpp/recipes`
  read-only. Konfirmasi Vue harus **membangun ulang** pohon dari API v1 (termasuk flag gap
  `wip_noyield`/`mismatch`/`unmapped`/`implausible`), bukan memakai snapshot lama.
- [ ] **stock / pengganti SheetJS & Excel** — legacy memuat SheetJS dari CDN (`hpp/index.html:2219`,
  `purchasing/index.html:3874`, `ordering/index.html:73`) untuk ekspor/impor Excel. Kontrak v1 punya
  endpoint impor (`/products-import`, `/vendors-import`, `/hpp/ingredients-import`, `/hpp/recipes-import`),
  tetapi **tidak** punya endpoint ekspor. Apakah Vue menyusun `.xlsx` di klien (butuh dependensi baru —
  `AGENTS.md` melarang dependensi tanpa izin) atau ekspor dijatuhkan jadi CSV?
  Opsi: A) minta izin menambah pustaka xlsx; B) ekspor CSV saja; C) endpoint ekspor di v1.

## Konsolidasi untuk README & berkas bersama

> Bagian ini adalah bahan siap-tempel untuk berkas bersama. `stock.md` sengaja **tidak**
> menyunting `README.md`/`_pertanyaan.md`/`_lintas-modul.md` (aturan tugas: tulis hanya di `stock.md`).

### Baris untuk `README.md`
```markdown
| stock | [stock.md](stock.md) | ⚠️ selesai dengan celah | 26 (1 pemilih) | 2 ❌ · 11 ⚠️ | 7 | 5 panel: ordering/purchasing/tree/usage/hpp |
```

### Butir untuk `_pertanyaan.md` (7, format persis)
```markdown
- [ ] **stock / ordering — sumber prakiraan/restock belum ada di v1** — Daftar Restock & Data Forecast butuh payload prakiraan (status/reorder/saran qty/tier/WAPE) yang di legacy datang dari Google Apps Script dan modelnya "proses terpisah"; kontrak v1 tak punya endpointnya. Bukti: `laksamana-office/deploy/stock/ordering/index.html:1049,3686`, `laksamana-api/docs/api/stock.md:177`. Opsi: A) v1 menyediakan endpoint payload prakiraan; B) Vue memanggil Apps Script; C) simpan hasil prakiraan sebagai berkas arsip `training` lalu hitung di klien.
- [ ] **stock / ordering — roster Office tanpa padanan v1** — legacy menarik kru ber-akses `ordering` via `account-api-mysql?action=listModuleRoster` agar muncul di Kelola Akses sebelum login; tak ada di kontrak v1 stock. Bukti: `laksamana-office/deploy/stock/ordering/index.html:1318-1330`. Opsi: A) cukup CRUD `ordering-users`; B) endpoint roster di Office/Account; C) endpoint di stock.
- [ ] **stock / pemilih — gate `<head>` tidak memuat `usage`** — sesi yang HANYA ber-`usage` ditolak gate pemilih walau daftar panel & komentarnya menyebut mereka. Bug atau disengaja? Bukti: `laksamana-office/deploy/stock/index.html:113-115` vs `:137`. Opsi: A) Vue memperbolehkan usage-only masuk; B) pertahankan perilaku legacy.
- [ ] **stock / purchasing — `Barang Online` tanpa entri `PERM_DEFAULT`** — `PERM_PAGES` memuat `online` tetapi `PERM_DEFAULT` tidak, sehingga non-admin selalu `PERM_NONE`. Bukti: `laksamana-office/deploy/stock/purchasing/index.html:1637-1645` vs `:1647-1663`. Opsi: A) tambah default (view/edit); B) biarkan admin-only.
- [ ] **stock / hpp — pager & tab Prasmanan** — legacy memakai 3 state pager (`F`/`FBS`/`FPR`) dan mengenali Prasmanan dari `seksi` berawalan "PRASMANAN" (bukan kolom baru). Apakah Vue mereplikasi ini? Bukti: `laksamana-office/deploy/stock/hpp/index.html:928`, `laksamana-office/CLAUDE.md:6021-6046`. Opsi: A) replikasi penuh; B) sederhanakan jadi satu tab tanpa pager terpisah.
- [ ] **stock / tree — snapshot vs API** — legacy `tree/index.html` memuat pohon sebagai snapshot statis bertanggal "20 Juli 2026"; v1 menyediakan `GET /hpp/ingredients` + `/hpp/recipes` read-only. Konfirmasi Vue harus membangun ulang pohon dari API v1 termasuk flag gap (`wip_noyield`/`mismatch`/`unmapped`/`implausible`). Bukti: `laksamana-office/deploy/stock/tree/index.html:275`, `laksamana-api/docs/api/stock.md:39`. Opsi: A) bangun dari API; B) pertahankan snapshot.
- [ ] **stock / semua panel — ekspor Excel/SheetJS** — legacy menyusun `.xlsx` di klien dengan SheetJS dari CDN; v1 hanya punya endpoint impor, bukan ekspor, dan `AGENTS.md` melarang dependensi baru tanpa izin. Bukti: `laksamana-office/deploy/stock/hpp/index.html:2219`, `purchasing/index.html:3874`, `ordering/index.html:73`. Opsi: A) minta izin menambah pustaka xlsx; B) ekspor CSV saja; C) endpoint ekspor di v1.
```

### Baris untuk `_lintas-modul.md`
- **Stock → Office/Account**: sesi `lm_session`; ordering menarik roster ber-akses `ordering`
  via `account-api-mysql?action=listModuleRoster` (`laksamana-office/deploy/stock/ordering/index.html:1318-1330`) —
  tak ada padanan di kontrak v1 stock (sama seperti HR & BD).
- **Stock (Ordering) → Apps Script prakiraan**: `appScriptUrlForecast`
  (`laksamana-office/deploy/stock/ordering/index.html:1049,3686`); model prakiraan "proses terpisah"
  (`laksamana-api/docs/api/stock.md:177`) — tak ada endpoint v1.
- **Stock (Ordering) ↔ Stock (Purchasing/CK)**: satu `batchOrder`; pengajuan CK
  `batchName='Central Kitchen'`; check-in penerimaan memotong stok CK (`laksamana-api/docs/api/stock.md:94`).
- **Stock (Usage) → Stock (items.php)**: daftar bahan & autocomplete
  (`laksamana-office/deploy/stock/catat-common.js:156-171`); Daily SO membaca `usage.php`+`waste.php`+`serah.php`
  (`laksamana-office/deploy/stock/usage/index.html:1935-1937`).
- **Stock (HPP) → Stock (Purchasing)**: `addProduct`/`di_purchasing`; `tarikProduk`; `samakanNama`
  (`laksamana-office/deploy/stock/hpp/index.html:1879-1896,2100-2130`).
- **Analytics ← Stock/HPP**: Analytics (POS) membaca stock/hpp, bukan sebaliknya
  (`laksamana-office/CLAUDE.md:86-89`).
- **BD ← Stock vendors** (VERIFIED): `laksamana-office/deploy/bd/index.html:2417-2445` →
  `GET /api/v1/stock/vendors` (`laksamana-api/docs/api/stock.md:22`); BD hanya baca.
- **Finance/Brankas ← Stock vendors**: master vendor Purchasing dibaca Finance
  (`laksamana-office/CLAUDE.md:7112`).
- **Aset bersama — KOREKSI klaim tugas**: panel stock **tidak** memuat `deploy/assets/*.js`.
  `hpp-mesin.js` → `deploy/marketing/index.html`; `cocok-bri.js` → cashier, finance/kas, reservasi;
  `xlsx-baca.js` → analytics, cashier, finance/kas, jadwal, konten. Stock memuat SheetJS dari CDN
  (`hpp/index.html:2219`, `purchasing/index.html:3874`, `ordering/index.html:73`). Satu-satunya berkas
  bersama stock = `deploy/stock/catat-common.js` (dimuat `usage/index.html:860`; `hpp/index.html:340,1734`
  hanya menyebut namanya di komentar, tidak memuatnya).

## J. Progres build
Branch: migrasi/stock-pohon (bagian 1/5) · Mulai: 2026-10-07
LANJUTKAN DARI: panel usage (Daily SO, Pemakaian, Waste) — butuh sub-issue + izin user; lalu ordering, purchasing, hpp.

| layar (key) | file | status | endpoint dipakai | ditunda karena |
|---|---|---|---|---|
| pemilih | `app/pages/stock/index.vue` | ✅ | — (kartu panel; auto-redirect bila satu panel jadi) | — |
| tree/pohon | `app/pages/stock/tree/index.vue` + `app/utils/pohon-resep.ts` | ✅ | `GET /stock/hpp/ingredients`, `GET /stock/hpp/recipes` (modul `tree`, read-only) | — |

Catatan build stock-pohon (pemilih + tree):
- **K-07**: sesi usage-only dibiarkan masuk (gate lama menolaknya — bug). Launcher memfilter 5 kartu per kunci; auto-redirect hanya bila satu panel DAN halamannya sudah ada.
- **T-18**: pohon dibangun ulang live dari API (menu = resep `dish` aktif; base hanya sebagai anak WIP), bukan snapshot 20 Juli 2026. Flag gap (`wip_noyield`/`mismatch`/`unmapped`/`implausible`) diturunkan di klien (`pohon-resep.ts`, terdokumentasi di komentar) — API tidak mengembalikannya.
- `useStock.ts` dimulai (tree dulu; panel lain menyusul di branch-nya). `LAYAR_STOCK` + shell `// ── stock ──` + `peranStock`.
- Cek visual 2026-10-07 (mock `/tmp/mock-api-stock.mjs` 4015, tulis 403) sebagai `gudang` (5 kunci, admin) & `koki` (ordering+usage): pemilih 5 kartu (1 Buka + 4 Segera), tree (4 menu, flag, WIP lipat-buka, laci where-used, saring flag, cari bahan) di 1366 & 390 overflow 0, console bersih; `koki` ke `/stock/tree` → "Belum ada akses".
- Insiden: login sempat macet — ternyata sisa state HMR dari `git stash -u` di tengah sesi (`Failed to reload .../stock/*.vue`); dev restart bersih + tab baru = 0 error. Kode tidak bersalah.

