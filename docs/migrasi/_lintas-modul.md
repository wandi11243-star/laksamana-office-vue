# Temuan lintas modul

Temuan yang menyangkut lebih dari satu modul: widget bersama, alur silang, aset bersama,
konvensi backend. Diisi sambil modul dikerjakan.

## Aset bersama `deploy/assets/*.js`

Diisi setelah modul-modul pemakainya dipetakan (lihat §"Pemakai aset" di bawah).

## Konvensi backend lama (berlaku semua modul)

Dari `laksamana-api/docs/modules/README.md:49-71`:

- Body POST = JSON dikirim sebagai `text/plain`, `action` dibaca dari body. GET pakai `?action=`.
- Setiap backend mengirim `Access-Control-Allow-Origin: *`, OPTIONS dijawab 204.
- Sebagian backend menerima `?token=` / `body.token` (`API_TOKEN`), kosong = terbuka.
- Bentuk baris umum: kolom terindeks + kolom `data` LONGTEXT JSON (JSON = sumber kebenaran).
- Tabel `settings(k, v)` menyimpan key top-level tak dikenal sebagai `extra:<key>`.
- DDL runtime (`*_pastikan()`) TIDAK diport; tabel sudah ada.
- Panggilan antar-modul lama (HTTP) menjadi service call langsung di Laravel.

## Gate sesi (lib_sesi.php)

Pesan error yang di-branch frontend (`docs/modules/README.md:60-71`):
`sesi_tidak_sah:` · `tanpa_modul:` · `tidak_berhak:`.
Nama user pelaku SELALU dari sesi, bukan body.

## Peta silang antar modul (diisi sambil jalan)

- Cashier memuat **Dana Masuk (DP)** dari Reservasi (`deploy/index.html:1299`).
- Marketing → **Request Design** ke Konten (disebut di §5 tugas; verifikasi saat modul dikerjakan).
- finance `omset/` = bekas `deploy/kompas/` (izin `kompas`); `kas/` = bekas `deploy/finance/`.
- Reservasi VIP & DP event → Dana Masuk Cashier/Finance (lihat `CLAUDE.md` bagian "Dana Masuk").
- Kompas membaca brankas Finance (`docs/modules/README.md:42`).
- Absensi membaca jadwal shift & DW (`deploy/index.html:1391`).
- HR/DW: DW disetujui HR muncul di kalender Jadwal Shift (`deploy/index.html:1243-1244`).
- Radar membaca Marketing, Event, Reservasi, BD (tanpa DB sendiri, `deploy/index.html:1159-1163`).
- Analytics membaca POS stock/hpp, konten, marketing, kompas, event (`CLAUDE.md:86-89`).
- HR → **Akademi**: komponen Training People Score dibaca dari Akademi; legacy `GET akademi-api-mysql?action=trainingStats` (`deploy/hr/index.html:352-377`), v1 jadi `GET /api/v1/hr/training-stats` (dibaca in-process dari layanan akademi, `docs/api/hr.md:52`). Profil kru menaut balik ke `../akademi/` (`deploy/hr/index.html:2502`).
- HR → **Office/Account**: `autoSyncOfficeRoster` menarik roster ber-grant `hr` lewat `account-api-mysql?action=listModuleRoster{module:'hr'}` (`deploy/hr/index.html:378-427`); identitas sesi + `adminModules` (gate admin `manageOps`) juga dari Office (`:714-737`). Tidak ada padanan di kontrak v1 `hr`.
- Marketing → **Konten (Request Design & Video)**: Konten MEMBACA `designReqs&aktif=1`/`designReq&id` dari `marketing-api-mysql` dan menulis balik progres `designReqSet{status:'done',picNama}` — hanya di Design & Editing Queue, TIDAK di Shooting. v1: `GET /api/v1/marketing/design-queue?active=1`, `GET /api/v1/marketing/design-requests/{id}`, `PUT /api/v1/marketing/design-requests/{id}/progress` (`deploy/konten/index.html:2771-2971`; `docs/api/marketing.md:20,70`).
- Konten → Marketing: menitipkan `designReqOpsi` (brand/kru/platform) sekali per sesi dari `bootApp` + saat antrian produksi dimuat; v1 `PUT /api/v1/marketing/design-options` (whole-document) (`deploy/konten/index.html:2846-2872`; `docs/api/marketing.md:20`).
- **Analytics ← Konten**: `deploy/analytics/` tanpa DB sendiri, membaca blob Konten via `konten-api?action=getAll` dan memakai aset bersama `deploy/assets/performa-konten.js` (Performa Konten & Performa Desain) (`laksamana-office/CLAUDE.md:6646-6663,6799-6806`).
- **Aset bersama `deploy/assets/performa-konten.js`**: dipakai `deploy/konten/` (perfinput/analytics/designperf) DAN `deploy/analytics/` — rumus ER/Virality Index/CTA Click Rate/pillar wajib dipindah apa adanya ke satu sumber (`deploy/konten/index.html:4174-4208`; `CLAUDE.md:6638-6649`).
- Office/Account → **Konten**: sesi `lm_session` + roster ber-grant `konten` (`account-api-mysql?action=listModuleRoster{module:'konten'}`, cadangan Apps Script) — v1 dari `/api/v1/account/*` (`deploy/konten/index.html:1303-1363`).
- **BD → Office/Account**: BD mengisi tabel `people` dari roster Office (`account-api-mysql?action=listModuleRoster{module:'bd'}`, `deploy/bd/index.html:1155`,`:1168-1193`); tak ada endpoint roster di v1 `bd` — sama seperti HR.
- **Stock/Purchasing → BD**: kolom Vendor PO membaca master vendor Purchasing (`../stock-api-mysql/vendors.php`, `deploy/bd/index.html:2417-2445`); v1 = `GET /api/v1/stock/vendors` (`docs/api/stock.md:22`). BD hanya membaca.
- Marketing → **BD**: Marketing mengirim PO ke BD lewat `addPo` (`deploy/marketing/index.html:13842-13847`,`:13939`; v1 `POST /api/v1/bd/purchase-orders/batch`), lalu membaca balik status dari papan BD.
- Finance → Kas Kecil → **BD**: `setRealisasi` (`finance/kas/index.html:5391`,`:5603`; v1 `PUT /api/v1/bd/purchase-orders/{id}/realisasi`) menulis `realisasi` + penanda proses ke baris PO.
- **BD → Radar** (daftar promo, `radar/index.html:603-609`,`:2346-2362`,`:2415`) dan **BD → Kompas** (`getAll` server-side, `docs/modules/bd.md:24`,`:67`). BD **TIDAK** membaca Marketing/Konten/Event.
- **Absensi → Jadwal/DW** (VERIFIED): `absensi-mysql/lib_absensi_mysql.php:523` (`dw-api-mysql?action=jadwalDW`), `:560` (`jadwal-api-mysql?action=shiftHari`); v1 service call langsung (`docs/modules/absensi.md:75-76`). Status `shift_hari`: array = ada shift (`ROSTER`/`DW`), `null` = tidak dijadwalkan (`NONE`), `false` = tak terjawab (`TAK_TERBACA`, tidak mengantre).
- **Absensi → Office/Account**: login `masuk` diteruskan server-ke-server (`absensi-mysql/api.php:83-89`, `lib_absensi_mysql.php:431`); v1 `AccountService::login` in-process + wajib modul `absensi` (`docs/modules/absensi.md:43`). Absensi tidak menulis ke DB modul lain; asetnya sendiri (`vendor/face-api.min.js`, `models/`, `vendor/leaflet.*`, `sw.js`) — TIDAK memakai `deploy/assets/*.js`.
- **Jadwal ⇄ DW (VERIFIED, satu arah):** DW `DISETUJUI` dibaca Jadwal lewat `?action=jadwalDW` dan digambar sebagai blok terpisah di bawah kru tetap — **tidak** disalin ke `jadwal_sel`; baris DW read-only di Jadwal. Kode divisi `bar|kitchen|floor|cashier` wajib identik (`deploy/jadwal/index.html:1478,1545`; `CLAUDE.md:7192-7210`; `deploy/index.html:1243-1244`).
- **Jadwal → DW:** DW menanyakan kepala divisi ke `jadwal-api?action=headIds` untuk halaman Hak Akses (`deploy/dw/index.html:2156`).
- **DW → Marketing/Event/Reservasi:** Kalender Tamu menjumlahkan pax tiga modul (`deploy/dw/index.html:971-979`,`:2179-2193`); `satukan()` kembar dengan `deploy/radar/index.html`.
- **Jadwal & DW → Office/Account:** roster + tulis data pegawai; Tim HRD otomatis admin `jadwal`+`dw` (`CLAUDE.md:7684`). Tak ada endpoint roster di kontrak `jadwal.md`/`dw.md` (ada di `Account`).
- **Cashier → Reservasi (DP):** iframe `../reservasi/?embed=finance` (`deploy/cashier/index.html:3945`; `deploy/index.html:1299`); guard SSO reservasi menerima modul `cashier` lewat pintu embed dan mengunci `navigate()` ke `'finance'` (`cashier/index.html:3920-3924`). DP sama muncul di Finance > Kas Kecil (`docs/api/reservasi.md:46`).
- **Cashier ↔ Kompas:** tanpa DB sendiri — blob Kompas (`../kompas-api-mysql/api.php`, `daily/reports/compliments/piutang/rokok/employees`, `cashier/index.html:484`,`:834`); Office/Account hanya identitas (`:1896`,`:3886`,`:4016-4018`); menulis balik DP Reservasi saat cocok QRIS BRI (`reservasi-api-mysql?action=saveAll`, `cocok-bri.js:432`).
- **Aset bersama `deploy/assets/cocok-bri.js`** (QRIS BRI, 2.240 baris) dipakai `deploy/cashier/` dan `deploy/finance/kas/` — **KOREKSI: BUKAN `deploy/reservasi/`** (reservasi hanya menyebut kembarannya `cbBlobUrl()` di komentar, `reservasi/index.html:8110-8112`); v1 `GET/POST /api/v1/kompas/bri*` (`docs/api/kompas.md:94-104`).
- **Cashier ↔ Kompas ↔ finance/omset (berkas kembar):** Report Daily & Compliment menulis objek SAMA (`DB.reports[tgl].pay`, `DB.compliments[]`); `PAYS`, `porsiPic`, `potonganHari`, `obTotal`/`openBillList` kembar dengan `deploy/kompas/` & `deploy/finance/omset/` (`cashier/index.html:460-469,585-610,2315-2364`; `CLAUDE.md:2880-2902`). Cashier pernah tertinggal dua perbaikan (`CLAUDE.md:2611-2637`) — keputusan uang `porsiPic` tertunda (`CLAUDE.md:2638-2670`).
- **Finance › Kas → BD (VERIFIED):** `setRealisasi` (`finance/kas/index.html:5391`,`:5597-5603`; v1 `PUT /api/v1/bd/purchase-orders/{id}/realisasi`).
- **Kompas → Brankas Finance (VERIFIED):** investor Kompas membaca vault via `Brankas::read()` / legacy `brankasGet` (`docs/modules/README.md:42`, `docs/modules/finance.md:76`).
- **Finance › Kas → Reservasi (DP):** halaman `dp` = `<iframe src="../../reservasi/?embed=finance">` (`finance/kas/index.html:6431-6440`; `CLAUDE.md:10872-10886`).
- **Finance › Kas ↔ Cashier (blob omset bersama):** satu baris `app_state`; penjaga `baseTs` (v1 `If-Match` di `PUT /kompas/state`) (`omset:887-1010`; `CLAUDE.md:11762-11820`).
- **Aset bersama `deploy/assets/performa-bonus.js`** dipakai `deploy/finance/kas/` (Performa Marketing/Event) DAN modul Marketing & Event (`kas:4385-4388`).
- **Finance › Brankas → Stock/Purchasing:** master vendor `stock-api-mysql/vendors.php` untuk nama penerima & no rekening (`brankas:638,898-905`; v1 `GET /api/v1/stock/vendors`).
- **Finance › Brankas → Cashier/Kompas:** Piutang & setoran cash dibaca (`KP.piutang`, `KP.rekap_setoran`), `brankas:1018-1080,1293-1296`.
- **Stock → Office/Account:** ordering menarik roster ber-akses `ordering` via `account-api-mysql?action=listModuleRoster` (`stock/ordering/index.html:1318-1330`); tak ada padanan di kontrak v1 stock (sama seperti HR & BD).
- **Stock (Ordering) → Apps Script prakiraan:** `appScriptUrlForecast` (`stock/ordering/index.html:1049,3686`); model "proses terpisah" (`docs/api/stock.md:177`) — tak ada endpoint v1.
- **Stock (Ordering) ↔ Stock (Purchasing/CK):** satu `batchOrder`; pengajuan CK `batchName='Central Kitchen'`; check-in penerimaan memotong stok CK (`docs/api/stock.md:94`).
- **Stock (Usage) → Stock (items.php):** daftar bahan & autocomplete (`stock/catat-common.js:156-171`); Daily SO baca `usage.php`+`waste.php`+`serah.php` (`stock/usage/index.html:1935-1937`).
- **Stock (HPP) → Stock (Purchasing):** `addProduct`/`di_purchasing`, `tarikProduk`, `samakanNama` (`stock/hpp/index.html:1879-1896,2100-2130`).
- **Stock ← Stock vendors:** BD (`bd/index.html:2417-2445` → `GET /api/v1/stock/vendors`, `docs/api/stock.md:22`) & Finance/Brankas (`CLAUDE.md:7112`).
- **Aset bersama — KOREKSI:** panel stock **tidak** memuat `deploy/assets/*.js`. `hpp-mesin.js` → `deploy/marketing/index.html`; `cocok-bri.js` → cashier/finance-kas/reservasi; `xlsx-baca.js` → analytics/cashier/finance-kas/jadwal/konten. Stock memuat SheetJS dari CDN + satu berkas sendiri `deploy/stock/catat-common.js` (`stock/usage/index.html:860`).
- **Reservasi ⇄ Service Excellent (satu backend, satu master blob):** dua Panel, dua kunci (`reservasi` `deploy/index.html:1133`, `service_excellent` `:1139`), satu `reservasi-mysql`; gate v1 menerima `reservasi|service_excellent` (`app/Modules/Reservasi/routes/v1.php:8`).
- **Reservasi → Cashier & Finance (Dana Masuk/DP):** `cashier/index.html:3945` & `finance/kas/index.html:6431` menyematkan `../reservasi/?embed=finance`; guard SSO menerima `cashier`/`finance` lewat pintu itu (`reservasi/index.html:21-42`,`:3771`).
- **VIP & DP Event → Dana Masuk Cashier/Finance (VERIFIED):** VIP disalin ke `rec.dps` (`vipDpsUntukReservasi`), tab `🎉 DP Event (Marketing)` read-only; penanda `resId` "jangan dihitung dua kali" (`reservasi/index.html:9358`; `CLAUDE.md:1275-1317`,`:1484-1512`).
- **Reservasi → Finance (kwitansi):** `mintaKwitansi()`/`invFetch("invMinta"|"invPutus")`; kwitansi ditahan sampai SEMUA DP terverifikasi (`reservasi/index.html:7217-7253`,`:7142`; `CLAUDE.md:9749-9789`).
- **Aset bersama `venue-layouts.js`:** `reservasi` (`:12`) & `service_excellent` (`:11`), juga analytics/konten/marketing — denah meja lintas modul. **`kwitansi-sheet.js`:** `reservasi` (`:15`).
- **KOREKSI `_lintas-modul.md:59`:** `cocok-bri.js` **TIDAK** dimuat `deploy/reservasi/` (hanya komentar kembarannya `cbBlobUrl()` `reservasi/index.html:8110-8112`). Pemakai nyata: `cashier/`, `finance/kas/`.
- **Reservasi ← Radar & DW:** `radar/index.html:602` & `dw/index.html:979` membaca `../reservasi-api-mysql/api.php`.
- **Service Excellent → HR/Finance?** papan Reward menghitung bonus per kru tetapi TIDAK menulis ke HR/Finance — TIDAK DITEMUKAN (dicari: `payroll|gaji|penggajian`).
- **Event → Marketing (satu arah, TIDAK balik, KOREKSI):** Kalender EMS membaca event Marketing (`marketing-api-mysql?action=getAll`, buang `status==='Lost'`, `event/index.html:10753-10793`); `grep event-api` di `deploy/marketing/index.html` NIHIL → klaim "Marketing↔Event" tidak akurat: arahnya Event→Marketing saja.
- **Event → Reservasi (baca):** buang `Cancelled`/`No-show`, popup read-only + tautan "Buka Modul Reservasi" (`event/index.html:10825-10901`).
- **Event → Kompas (baca):** Performa Omset & Bonus `performaDivisi{divi:'event'}` (`event/index.html:5271-5299`); v1 = `GET /api/v1/kompas/performa/event` (`app/Modules/Kompas/routes/v1.php:21`). `docs/api/event.md:32` keliru menyebut "marketing module".
- **Event → Finance (dibaca Finance):** Finance › Omset › Breakdown Sumber memanggil `eventsHari` (`event-mysql/api.php:67-70`; v1 `GET /events-on/{date}`).
- **Event → DW / Radar / Analytics (dibaca):** DW Kalender Tamu (`dw/index.html:973`), Radar (`radar/index.html:601`), Analytics (`analytics/index.html:797`).
- **DP event (Finance/Marketing → Cashier):** DP event di modul Marketing melahirkan baris `payments` di Dana Masuk Cashier/Finance (`CLAUDE.md:1553-1660`) — bukan fitur modul Event.
- **Aset bersama `performa-bonus.js`:** `event/index.html:1312`, `marketing/`, `finance/kas/` (`CLAUDE.md:12310-12316`).
- **Event ↔ Ticketing (satu DB `lakk5493_db_ems`):** ticketing menulis `orders`/`tickets`/`seats` milik EMS + tabelnya sendiri; lock berbeda (`ems_save` vs `tix`); QR/token identik QR klien & PDF server (`docs/modules/ticketing.md:13-22,45,54-77`).
- **Event → Office/Account (roster):** `account-api-mysql?action=listModuleRoster` (`event/index.html:4633-4664`) — tak ada padanan di kontrak v1 `event` (sama seperti HR/BD/stock).
- **Marketing → Konten (Request Design/Video, VERIFIED):** dikonfirmasi dari sisi Marketing (`marketing/index.html:15551`); Marketing juga membaca `konten-api-mysql?action=getAll` untuk Brand/PIC (`:15626-15643`).
- **Marketing → BD (PO, VERIFIED):** `addPo` status Diajukan, baca balik papan BD (`marketing/index.html:13847`,`:14083-14100`,`:13980-13998`; v1 `POST /api/v1/bd/purchase-orders/batch`).
- **Marketing ↔ Event (VERIFIED):** Kalender Marketing membaca acara EMS via `event-api-mysql?action=getAll` sebagai pita terpisah (`marketing/index.html:12062-12075`,`:12310-12314`).
- **Marketing ↔ Reservasi (VERIFIED):** VIP mengunci meja lewat `reservasi-api-mysql?action=saveAll` (baris `ev-<id>`/`vip-<id>`); denah `venue-layouts.js`; lock H-3 jam (`marketing/index.html:14941-15060`; `CLAUDE.md:6461-6500`); hapus event melepas kunci (`:6423-6438`).
- **Marketing → Finance:** `eventsHari` (`GET /events-on/{date}`) untuk Finance Omset Breakdown Sumber (`docs/api/marketing.md:68`).
- **Marketing ← Kompas:** Performa Omset & Bonus `performaDivisi{divi:'marketing'}` + mesin `performa-bonus.js` (`marketing/index.html:14410-14706`).
- **Aset bersama `hpp-mesin.js`:** modul Marketing (Menu Kalkulator) — rumus modal HPP dibangkitkan dari modul HPP (`marketing/index.html:12`,`:18939-18970`). `venue-layouts.js` & `kwitansi-sheet.js` juga dipakai Marketing (`:6`,`:9`,`:16774`). Marketing TIDAK memuat `performa-konten.js`/`cocok-bri.js`/`xlsx-baca.js`.
- **Analytics (KOREKSI: BUKAN "tanpa DB"):** menyimpan ke backend **Kompas** (`an_state`/`an_akses`/`an_peran`, `kompas-mysql/lib_kompas_mysql.php:1470-1494`); v1 `GET/PUT /api/v1/kompas/analytics`, `PUT /analytics/access` (`docs/api/kompas.md:121-127`). Membaca blob omset Kompas, resep/bahan HPP, event & marketing, konten (malas).
- **Radar ← Marketing, Event, Reservasi, BD (VERIFIED, read-only):** `radar/index.html:598-613,722`; lampiran event `GET /marketing/files/{key}`; auto-refresh 5 menit (`:2561,2687`).
- **Help ← Office/Account + `modul.ts`:** penyaring bab dari `lm_session.modules` (`help/index.html:313-320`); registri `panduan/daftar.js` **menyalin** `access` dari `BRANCHES` (`daftar.js:8-18`) — di Vue harus menyalin `app/utils/modul.ts` + dijaga uji. Tema `deploy/assets/laksamana.css` tanpa `:root` sendiri (`help/index.html:29`). Tanpa backend/DB.
- **Investor (KOREKSI: punya backend):** memakai backend **Kompas + Account** (`investor/index.html:674,707,731,1141,1650,1686,1713`); gerbang baca `sesi_punya_modul($u,'investor')`, unggah/hapus `sesi_admin_modul` (`kompas-mysql/api.php:148,171,185,209,226`); v1 `GET /kompas/investor/summary`,`/agenda`,`/reports*` (`docs/api/kompas.md:108-119`). Angka = `netSales` (tagihan − compliment), bukan `net`/`tagihan` (`CLAUDE.md:11213-11247`). Kartu `investor` wajib ada di `BRANCHES` (`deploy/index.html:1186-1194`). Komentar lama "tanpa backend" (`CLAUDE.md:11140-11141`) sudah usang.
