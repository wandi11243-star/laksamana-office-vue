# Analytics — inventaris migrasi

Status: ✅ selesai (inventaris ringkas — lihat §4.14 & §6: hanya bagian A, B, C, H)
Terakhir diperbarui: 2026-09-29

## Ringkasan
- Jumlah layar: 18 (0 tersembunyi; tampil/tidaknya diatur matriks hak akses per role) · Aksi backend lama: 5 action langsung + 5 pembacaan lintas modul · Gap v1: 0 ❌ (3 ⚠️, lihat catatan)
- Analytics mengolah berkas **Sales Recapitulation** dari POS: user mengunggah `.xlsx`/`.csv`, berkasnya **diurai di peramban** lalu ringkasannya disimpan. Halaman-halamannya menjawab menu terlaris, sebaran jam & hari, perkiraan bahan baku, performa meja/talent, error/void, promo, tren bulanan, serta pengaruh event, marketing dan konten.
- Penggunanya pemegang kunci modul `analytics` (staf analis/manajemen). Hal paling berisiko saat migrasi: (1) pembaca berkas POS — kolom dicari **menurut nama**, bukan posisi (`deploy/analytics/index.html:770-783`); (2) rumus-rumus lintas modul yang tidak boleh disalin (`assets/performa-konten.js`, `assets/performa-bonus.js`, `assets/venue-layouts.js`); (3) konvensi tiga omset (`net`/`tagihan`/`netSales`) yang mudah tertukar.
- **KOREKSI terhadap peta tugas:** Analytics **BUKAN** "tanpa DB sendiri / tidak ada kontrak". Ia menyimpan ke backend **Kompas** (tabel `an_state`, `an_akses`, `an_peran`) dan punya kontrak v1 sendiri di `docs/api/kompas.md:121-127`. Bukti: `laksamana-office/kompas-mysql/lib_kompas_mysql.php:1470-1494`, `kompas-mysql/api.php:236-247`, `laksamana-api/app/Modules/Kompas/routes/v1.php:45-47`.

## A. Sumber
| jenis | path | baris |
|---|---|---|
| frontend lama | `laksamana-office/deploy/analytics/index.html` | 8.210 |
| backend lama (menumpang) | `laksamana-office/kompas-mysql/api.php` (`analyticsGet/Save/Akses/Peran`) | 236-247 |
| backend lama (tabel `an_*`) | `laksamana-office/kompas-mysql/lib_kompas_mysql.php` | 1470-1580 |
| kontrak v1 (satu file, bagian Analytics) | `laksamana-api/docs/api/kompas.md` | 33, 121-127 |
| rute v1 | `laksamana-api/app/Modules/Kompas/routes/v1.php` | 45-47 |
| controller v1 (service) | `laksamana-api/app/Modules/Kompas/Http/V1/InvestorAnalyticsController.php` | 83-138 |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:3133-3243` "Modul `analytics`: laporan POS diurai DI PERAMBAN" | 3133 |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:2417-2552` "Performa Talent — omset di JAM TAMPILNYA" | 2417 |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:3244-3280` "menu paket & Kategori Menu" | 3244 |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:4928-4970` "jembatan tiga layar & kolom Kontribusi" | 4928 |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:5587-5630` "Promotion Report → halaman Promo & Klaim" | 5587 |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:6799-6810` "dimuat MALAS, dan 'galat' ikut menahan" | 6799 |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:9807-9870` "peringatan resep menunjuk dirinya sendiri" + "tab Void & Cancel Menu" | 9807, 9847 |
| aset bersama | `laksamana-office/deploy/assets/xlsx-baca.js`, `performa-konten.js`, `performa-bonus.js`, `venue-layouts.js` | lihat `index.html:36,41,50,57` |
| pustaka grafik | Chart.js 4.4.1 dari CDN | `index.html:58` |

Sumber lintas modul yang dibaca langsung (const di `index.html:786-818`):
- Kompas: `../kompas-api-mysql/api.php` (`API_AN`) — blob omset + tabel `an_*` (`index.html:786,1126-1127`).
- Stock/HPP: `../stock-api-mysql/hpp.php` (`API_HPP`, `?action=all`, payload DATAR `{bahan,resep,setting,ts}`) (`index.html:793,1128,1150-1172`).
- Event: `../event-api-mysql/api.php` (`API_EVENT`, `?action=getAll`) (`index.html:795,1129`).
- Marketing: `../marketing-api-mysql/api.php` (`API_MKT`, `?action=getAll`) (`index.html:796,1130`).
- Konten: `../konten-api-mysql/api.php` (`API_KONTEN`, `?action=getAll`, dimuat malas) (`index.html:801,7882`).
- Office/Account: `../account-api-mysql/api.php` (`?action=listModuleRoster&module=analytics`) (`index.html:8088`).

## B. Akses
- Kunci Modul di launcher: `analytics` — `BRANCHES[].key:'analytics'`, `access:['analytics']` (`laksamana-office/deploy/index.html:1214`). Kartu berjudul **Analytics**, tag **Analisa Penjualan** (`deploy/index.html:1216-1218`). Komentar menegaskan kartunya harus ada di `BRANCHES` supaya `syncModules` mendaftarkan kuncinya ke Kelola Akses (`deploy/index.html:1204-1213`).
- Gate modul di frontend: membaca `localStorage['lm_session']`, lolos bila `modules` memuat `'*'` atau `'analytics'` (`deploy/analytics/index.html:26-28`).
- Hak akses halaman di dalam modul (matriks 3 tingkat): `PERM_NONE=0` "Tak Terlihat"/None, `PERM_VIEW=1` "Lihat", `PERM_EDIT=2` "Ubah" (`analytics/index.html:959`).
- Role: `ROLE_KEYS=['staf','manajemen','viewer']`; label `Staf`, `Manajemen`, `View Only` (`analytics/index.html:974-975`). `ROLE_BAWAAN='staf'` (`:981`).
- Bawaan **penuh untuk staf**; halaman yang punya isian hanya `unggah`, `pengaturan`, `akses` (`AKS_HAL_ISI`, `:972`); `DEFAULT_PERMS` di `:986-995`.
- Role `viewer` dijepit maksimum "Lihat" (`:1022-1024`); admin modul selalu penuh, tidak bisa diturunkan (`:1010-1020`).
- Aksi khusus admin: mengubah matriks = `bolehUbah('akses') && sayaAdmin()` (`:8095`); simpan matriks & role hanya admin (`:8149,8159,8169`). Badge: `'admin analytics'` (`:1046`).
- Pesan tolak: `bolehAksi()` → alert `'Tidak bisa dilakukan.…Hak akses kamu di halaman "…" cuma "…". Minta admin modul mengubahnya di Kelola Akses.'` (`:1033-1036`). Halaman kosong saat semua disembunyikan: `'Belum ada halaman yang boleh kamu buka.'` (`:7822-7825`).
- Daftar anggota untuk layar Akses: `listModuleRoster{module:'analytics'}` dari Office (`:8088`); bila kosong: `'Belum ada kru yang diberi kunci modul analytics di Kelola Akses Office.'` (`:8136`).

## C. Daftar layar (dari `TITLES`, `index.html:1268-1294`)
Nav dibagi 3 grup: **Analisa**, **Data**, **Sistem** (`index.html:698-724`). Semua layar terlihat default (visibility murni dari matriks role).

| key | judul | subjudul | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| ringkasan | Ringkasan | Angka pokok dari laporan POS yang diunggah | semua role (bawaan Lihat) | tidak | `index.html:1269`, `:987` |
| hari | Hari & Jam | Omset per hari dalam seminggu, dan sebaran jamnya | semua role (Lihat) | tidak | `index.html:1270` |
| menu | Menu & Bahan Baku | Menu terlaris dan perkiraan bahan yang seharusnya keluar | semua role (Lihat) | tidak | `index.html:1271` |
| kategori | Kategori Menu | Omset per kategori menu — termasuk EVENT, terpisah dari peringkat menu | semua role (Lihat) | tidak | `index.html:1272` |
| kunjungan | Metode Kunjungan | Rekap kanal, cara tamu datang, dan cara mereka membayar | semua role (Lihat) | tidak | `index.html:1273` |
| meja | Performa Meja | Omset tiap meja, kapasitasnya di denah Reservasi, dan omset per kursinya | semua role (Lihat) | tidak | `index.html:1274` |
| talent | Performa Talent | Kontribusi omset tiap penampil, dihitung dari jam tampilnya sendiri | semua role (Lihat) | tidak | `index.html:1275` |
| error | Error & Koreksi Bill | Bill yang ditandai error — sebabnya, nilainya, dan siapa yang memegangnya | semua role (Lihat) | tidak | `index.html:1276` |
| voidb | Void & Cancel Menu | Siapa yang membatalkan, alasannya, itemnya, nilainya, dan jamnya | semua role (Lihat) | tidak | `index.html:1277` |
| promo | Promo & Klaim | Promo mana yang paling banyak diklaim, barang apa, dan jam berapa | semua role (Lihat) | tidak | `index.html:1278` |
| tren | Tren Bulanan | Total omset bulan ke bulan, dan perbandingan dua bulan | semua role (Lihat) | tidak | `index.html:1279` |
| event | Pengaruh Event | Omset hari berevent dibanding hari biasa | semua role (Lihat) | tidak | `index.html:1287` |
| marketing | Pengaruh Marketing | Omset hari ada acara Marketing dibanding hari biasa | semua role (Lihat) | tidak | `index.html:1288` |
| konten | Performa Konten | Reach, Engagement Rate, Virality Index, CTA Click Rate & Content Pillar — semua platform | semua role (Lihat) | tidak | `index.html:1290` |
| desain | Performa Desain | Virality konten berdesain, dan jumlah desain selesai per kategori | semua role (Lihat) | tidak | `index.html:1291` |
| unggah | Unggah Laporan | Berkas Sales Recapitulation dari POS | Staf=Ubah, Manajemen=Lihat, View Only=None | tidak | `index.html:1292`, `:993` |
| pengaturan | Pengaturan | Batas jam shift dan pemetaan nama menu | Staf=Ubah, Manajemen=None, View Only=None | tidak | `index.html:1293`, `:994` |
| akses | Kelola Akses | Siapa boleh membuka dan mengubah halaman mana | semua role (Lihat); ubah hanya admin modul | tidak | `index.html:1294`, `:995` |

Catatan: `event` & `marketing` dulu satu halaman, dipisah 2 Sep 2026 (`index.html:1279-1286` komentar). `unggah` sengaja diberi hak "Ubah" paling penting karena bisa menimpa ringkasan bulan (`:969-971`).

## H. Catatan untuk implementasi Vue
- Halaman: satu halaman `app/pages/analytics/index.vue` dengan 18 layar. Karena 18 terlalu banyak untuk satu layar, usul: sub-rute/section bertab — `analytics/index.vue` (Ringkasan), `analytics/hari.vue`, `analytics/menu.vue`, `analytics/kategori.vue`, `analytics/kunjungan.vue`, `analytics/meja.vue`, `analytics/talent.vue`, `analytics/error.vue`, `analytics/voidb.vue`, `analytics/promo.vue`, `analytics/tren.vue`, `analytics/event.vue`, `analytics/marketing.vue`, `analytics/konten.vue`, `analytics/desain.vue`, `analytics/unggah.vue`, `analytics/pengaturan.vue`, `analytics/akses.vue`. Semua `definePageMeta({ access: ['analytics'] })`.
- Composable `useAnalytics.ts` (fungsi → endpoint):
  - `getAnalytics()` / `saveAnalytics(data, version)` → `GET`/`PUT /api/v1/kompas/analytics` (`docs/api/kompas.md:125-126`). PUT = **seluruh state**, wajib `If-Match: "<ts>"`; tangani `428 version_required` & `409 version_conflict` (`kompas.md:127,129-137`).
  - `saveAccess(matrix, roles, accessVersion)` → `PUT /api/v1/kompas/analytics/access` (admin modul; `If-Match` = `accessVersion`) (`kompas.md:127`).
  - `getVoids(from,to)` → `GET /api/v1/kompas/voids` (halaman Void & Cancel) (`kompas.md:82-88`).
  - Pembacaan lintas modul: `GET /api/v1/kompas/state` (blob omset), `GET /api/v1/stock/hpp/ingredients` & `/hpp/recipes` (`docs/api/stock.md:133,143`), `GET /api/v1/event/state` (`docs/api/event.md:40`), `GET /api/v1/marketing/state` (`docs/api/marketing.md:67`), `GET /api/v1/konten/state` (`docs/api/konten.md:18`), `GET /api/v1/account/modules/analytics/members` (`docs/api/account.md:26,73`).
- **Rumus jangan disalin** — pindahkan apa adanya ke modul Vue bersama: ER/Virality Index/CTA Click Rate/pillar dari `assets/performa-konten.js` (dipakai juga Konten, `index.html:7853-7860`); Open Bill dari `assets/performa-bonus.js` (`index.html:1094`); kapasitas/zona meja dari `assets/venue-layouts.js` (`index.html:4757,5082`); pembaca `.xlsx`/`.csv` dari `assets/xlsx-baca.js` (`index.html:1257,7579`).
- Validasi unggah yang harus dibawa: kolom POS dicari menurut **nama** bukan posisi (`index.html:770-783`); peringatan "berkas memuat lebih dari satu bulan — yang disimpan cuma bulan dengan baris terbanyak" (`index.html:7790-7800`); konfirmasi timpa bulan yang sudah ada (`index.html:7801-7807`); konfirmasi kehilangan hasil urai saat pindah halaman (`index.html:7820-7823`).
- Real-time: tidak ada polling; Konten dimuat malas saat tab konten/desain dibuka dengan status `idle/muat/ok/galat` + tombol "Coba lagi" (`index.html:7856-7935`).
- HP vs desktop: tabel-tabel analisa (menu, meja, error, void, promo) jadi `UTable` hanya `lg+`, di HP jadi `AppList` berkelompok; grafik boleh tetap chart (Chart.js → usul pustaka yang sudah diizinkan, jangan tambah dependensi tanpa tanya).
- Widget Beranda yang cocok: "Ringkasan bulan berjalan" (grand, bill, hari), "Top menu" dan "Performa konten" ringkas sebagai `AppList`.
- Elemen lama yang melanggar DESIGN.md → padanannya:
  - **Grid kartu angka besar** `grid g4` + `kartu(...)` (`index.html:1327,1336`) → `AppList` + satu `AppFocus`.
  - **Emoji sebagai penanda** (`ℹ`, `⚠`, `◔`, `🔒`, `⏳`) (`index.html:8096,8141,7823`) → Lucide (`i-lucide-*`).
  - **Label/eyebrow huruf kapital & gradien** → `text-muted` sentence case; ikuti `assets/css/main.css`.
  - **Matriks warna merah/kuning/hijau penuh** untuk hak akses (`PERM_OPT` `:959`) → `AppStatus` (titik + kata).
  - Tombol satu-klik bersiklus None→Lihat→Ubah (`:558-560`) → kontrol eksplisit (select/radio) agar tidak salah klik.

## Konsolidasi untuk README & berkas bersama
Baris README:
`| analytics | [analytics.md](analytics.md) | ✅ selesai (ringkas) | 18 | 0 ❌ · 3 ⚠️ | 0 | inventaris ringkas (belum ada di Vue); KOREKSI: pakai backend+CK Kompas, bukan "tanpa DB" |`

Baris `_lintas-modul.md` (tambahkan/dipertahankan):
- **Analytics → Kompas, Stock/HPP, Event, Marketing, Konten** (VERIFIED): tanpa DB sendiri di aplikasi, tetapi **menyimpan** ke backend Kompas (tabel `an_state`/`an_akses`/`an_peran`, `kompas-mysql/lib_kompas_mysql.php:1470-1494`); membaca blob omset Kompas (`index.html:1126-1127`), resep/bahan HPP (`index.html:1128,1150-1172`), event & marketing (`:1129-1130,1200-1235`), konten dimuat malas (`:7882`). v1: `GET/PUT /api/v1/kompas/analytics`, `PUT /analytics/access`, plus `GET /stock/hpp/*`, `/event/state`, `/marketing/state`, `/konten/state`.
- **Aset bersama `deploy/assets/performa-konten.js`** dipakai `deploy/konten/` DAN `deploy/analytics/` (sudah tercatat di `_lintas-modul.md:43-44`); `deploy/assets/xlsx-baca.js` dipakai analytics + cashier + finance-kas + jadwal + konten (sudah tercatat di `:74`). Tambahan: `venue-layouts.js` & `performa-bonus.js` juga dibaca analytics (`index.html:41,50,1094`).

Pertanyaan terbuka: **tidak ada** (aset bersama & sumber lintas modul sudah jelas; satu-satunya ⚠️ adalah bentuk PUT whole-state yang memang sudah jadi kontrak v1 — bukan celah).
