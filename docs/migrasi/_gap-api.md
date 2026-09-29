# Gap API — draf issue untuk `laksamana-api`

Hal yang dibutuhkan Vue tetapi belum ada di kontrak v1. Setiap butir siap disalin
menjadi issue GitHub `dwipapap/laksamana-api` (label `needs-triage`).

**Aturan untuk agen pembangun Vue:** jangan menunggu gap ini. Bangun layar tanpa bagian
yang terblokir, tampilkan bagian itu sebagai "Segera" (`text-dimmed`), dan sebut ID gap di PR.
Jangan pernah memanggil URL legacy (`*-api-mysql/api.php`) dari Vue sebagai jalan pintas.

Status: ⬜ belum diajukan · 📨 issue dibuat (tulis nomornya) · ✅ ada di v1

| ID | status | issue |
|---|---|---|
| G-01 | 📨 | [laksamana-api#177](https://github.com/dwipapap/laksamana-api/issues/177) |
| G-02 | 📨 | [laksamana-api#178](https://github.com/dwipapap/laksamana-api/issues/178) |
| G-03 | 📨 | [laksamana-api#179](https://github.com/dwipapap/laksamana-api/issues/179) |
| G-04 | ✅ | sudah didukung API; hanya dokumentasi → G-12 |
| G-05 | 📨 | [laksamana-api#180](https://github.com/dwipapap/laksamana-api/issues/180) |
| G-06 | 📨 | [laksamana-api#181](https://github.com/dwipapap/laksamana-api/issues/181) |
| G-07 | 📨 | [laksamana-api#182](https://github.com/dwipapap/laksamana-api/issues/182) |
| G-08 | 📨 | [laksamana-api#183](https://github.com/dwipapap/laksamana-api/issues/183) |
| G-09 | 📨 | [laksamana-api#184](https://github.com/dwipapap/laksamana-api/issues/184) |
| G-10 | 📨 | [laksamana-api#185](https://github.com/dwipapap/laksamana-api/issues/185) |
| G-11 | 📨 | [laksamana-api#186](https://github.com/dwipapap/laksamana-api/issues/186) |
| G-12 | 📨 | [laksamana-api#188](https://github.com/dwipapap/laksamana-api/issues/188) |
| G-13 | 📨 | [laksamana-api#187](https://github.com/dwipapap/laksamana-api/issues/187) |
| G-14 | 📨 | [laksamana-api#189](https://github.com/dwipapap/laksamana-api/issues/189) |

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
`[{tgl, sumber, pax}]`, dipakai juga oleh Radar.

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

**Sampai salah satu ada:** komponen `DanaMasukPanel` menampilkan 403 apa adanya dengan teks
"Belum punya akses ke Data Reservasi" beserta ID gap **G-14**, dan modul cashier/finance menampilkan
bagian itu sebagai "Segera" (`text-dimmed`) — bukan halaman kosong.
