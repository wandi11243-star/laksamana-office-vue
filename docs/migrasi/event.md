# Event — inventaris migrasi

Status: ⚠️ selesai dengan celah
Terakhir diperbarui: 2026-09-29

> **Triase 2026-09-29** — status di tabel E yang bertentangan dengan catatan ini: catatan ini yang berlaku.
> Rincian: [`_pertanyaan.md`](_pertanyaan.md), [`_gap-api.md`](_gap-api.md).
> - Roster: ❌ → ✅ `GET /api/v1/account/modules/event/members` (U2, T-01). `ujiEmail` → U3.
> - Matriks izin → K-08. Batal check-in → K-09. Reset → K-01. Grafik demo → T-22. Performa → T-23.
> - Toko ticketing publik di luar cakupan (T-26).

> Modul ini mencakup **dua panel**: `event` (EMS — manajemen event, talent, jadwal,
> tiket internal) dan **`ticketing`** (situs publik jual tiket). Keduanya berbagi
> database `lakk5493_db_ems` (`laksamana-api/docs/modules/event.md:7`).

## Ringkasan
- Jumlah layar: 28 (17 layar `event`, 2 di antaranya tersembunyi; 11 layar publik `ticketing`) · Aksi backend lama: 7 (`event`) + 20 (`ticketing`) · Gap v1: 4 ❌ · 7 ⚠️
- EMS adalah panel operasional event: dashboard, kalender terpadu, talent + jadwal manggung (anti double-booking), fee & pembayaran talent, pipeline/approval rencana event, pengelolaan event (rundown/vendor/budget/sponsor/task), ticketing internal (kelas tiket, denah, jual, penjualan & refund), check-in hari-H (scan QR + denah live), dan hak akses per halaman.
- `ticketing` adalah situs publik (pembeli umun, bukan User Office): daftar event, pilih kursi di denah, tahan kursi, checkout + bayar Xendit, e-ticket QR, akun Buyer, tiket saya, bantuan.
- Risiko terbesar saat migrasi: (1) legacy menyimpan **seluruh state lewat satu `saveAll`** dan menghitung semua agregat (omset, bonus, keterisian, okupansi) **di browser**; v1 memakai CRUD per-record + version, jadi pola simpan/perhitungan harus dibongkar. (2) Matriks Hak Akses (`DB.perm`) **tidak pernah tersimpan** — backend lama hanya menyimpan `entertainmentRules`, `role`, `layoutTemplates` (`event-mysql/lib_event_mysql.php:431-433`); v1 juga tak punya endpoinnya. (3) Denah/seat-map adalah editor kanvas besar di klien (2 lantai, template, drag) yang datanya (`seats`) kini lewat `/seats`. (4) QR digambar di klien di dua tempat dan harus tetap identik dengan QR PDF server. (5) Beberapa angka dashboard legacy masih **data demo tertulis-mati** (bar chart 6 bulan, `event/index.html:2405`).

## A. Sumber
| jenis | path | baris |
|---|---|---|
| frontend lama (EMS) | laksamana-office/deploy/event/index.html | 11.385 |
| frontend lama (publik) | laksamana-office/deploy/ticketing/index.html | 3.032 |
| backend lama EMS | laksamana-office/event-mysql/api.php (+ lib_event_mysql.php 620, config.sample.php) | — |
| backend lama publik | laksamana-office/ticketing-mysql/api.php (+ lib_ticketing.php 1.941, lib_pdf.php 232, lib_qr.php 292, schema-tambahan.sql 112, README.md 135) | — |
| kontrak v1 | laksamana-api/docs/api/event.md | 123 |
| kontrak v1 | laksamana-api/docs/api/ticketing.md | 87 |
| spec port | laksamana-api/docs/modules/event.md | — |
| spec port | laksamana-api/docs/modules/ticketing.md | — |
| aset bersama | laksamana-office/deploy/assets/performa-bonus.js | — |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:1008-1043 "Daftar Event berhalaman" | 1008-1043 |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:1044-1130 "Bonus Event: empat skema di Performa Event" | 1044-1130 |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:12292-12450 "Performa Omset & Bonus di modul Event" | 12292-12450 |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:2581-2610 "Modul Event: tema diselaraskan, CSS SAJA" | 2581-2610 |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:2417-2470 "Analytics: Performa Talent — omset di JAM TAMPILNYA (11 Sep 2026)" | 2417-2470 |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:13704-13740 "Modul Event: bedanya satu, dan itu menentukan bentuk kolomnya" | 13704-13740 |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:1553-1660 "DP wajib berbukti & berekening" (Finance/Marketing, menyentuh DP event) | 1553-1660 |

## B. Akses
- Kunci Modul di launcher: `event` (`laksamana-office/deploy/index.html`, kartu Event; modul Vue `modul.ts:35`, `access:['event']`). Ticketing publik **bukan** modul Office — ia situs di domain utama, tanpa Sesi (`laksamana-api/docs/api/ticketing.md:3,10`).
- Gerbang halaman EMS: membutuhkan sesi Office + grant `event`; tanpa grant → `location.replace('../')` (pola gate di `event/index.html`; bukti guard head + `function logout(){ location.replace('../'); }` `event/index.html:11355`).
- v1: `module:event` (`docs/api/event.md:6`). Ticketing publik: tanpa `auth:sanctum`; hold via hold token, order via ref+access token, aksi Buyer via Buyer session (`docs/api/ticketing.md:10-15`).
- **Matriks izin di dalam modul**: 4 peran `EMS_PERAN = {manajemen:'Manajemen', event:'Tim Event', kasir:'Kasir / Ticketing', lihat:'Hanya Lihat'}` (`event/index.html:4507-4512`) × 16 halaman `EMS_HALAMAN` (`:4513-4530`); tingkat `EMS_IZIN = [[0,'Tak Terlihat'],[1,'Lihat'],[2,'Boleh Ubah']]` (`:4505`). Bawaan `emsPermBawaan()` (`:4531-4541`) menyetel `planning.kasir=0`, `fee.kasir=0`, `fee.lihat=0`, `akses={manajemen:2, event:0, kasir:0, lihat:0}`, `ticketing.kasir=2`, `checkin.kasir=2`.
- Peran diturunkan dari roster Office (`account-api-mysql?action=listModuleRoster{module:'event'}`, `event/index.html:4652`), dari kolom Tim (`EMS_PERAN_TIM`, `:4584-4593`); admin modul Event selalu `manajemen` (`:4611-4614`); jk tidak terbaca → `event` (`:4614`). Aksi tulis butuh `bisaUbah(h)` = tingkat ≥2 (`:4677`). Menyetujui rencana hanya `bisaSetujui()` = peran `manajemen` (`:4680`).
- Aksi khusus admin: matriks izin (`setIzin`, `:6061`, butuh `bisaUbah('akses')`), `resetIzin` (`:6073`). Penjaga: manajemen tidak boleh mengunci dirinya dari halaman Hak Akses (`:6066-6069`).

## C. Daftar layar (dari NAV_DEF / TITLES)

### C.1 Panel `event` (EMS)
Sumber `NAV` `event/index.html:2006-2046`, `TITLES` `:2047`, dispatcher `router` `:2114-2158`.

| key | judul | subjudul (crumb) | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| dashboard | Dashboard | Ringkasan operasional · <tanggal panjang> | semua (izin) | tidak | `:2009`, `:2311` |
| calendar | Event Calendar | Kalender terpadu multi-sumber | semua | tidak | `:2010`, `:10925` |
| talents | Talent Management | Kelola profil, jadwal & fee talent | semua | tidak | `:2012`, `:2495` |
| schedule | Talent Schedule | Kalender jadwal · anti double-booking | semua | tidak | `:2013`, `:2703` |
| fee | Fee & Pembayaran | Rekap otomatis show Done × fee | semua | tidak | `:2014`, `:4044` |
| pipeline | Event Pipeline | Geser kartu antar tahap saat statusnya berubah | semua | tidak | `:2020`, `:4762` |
| planning | Perencanaan Event | Rencana yang belum disetujui manajemen | semua | tidak | `:2021`, `:5869` |
| events | Event Management | Event yang sudah disetujui manajemen | semua | tidak | `:2022`, `:6077` |
| ticketing | Ticketing | Event ber-tiket yang sudah disetujui | semua | tidak | `:2023`, `:6697` |
| checkin | Check-In | Scan QR · kursi terisi langsung | semua | tidak | `:2024`, `:10086` |
| approval | Approval Flow | Meja putusan manajemen | semua (putusan: manajemen) | tidak | `:2028`, `:5686` |
| performa | Event Performance | Ukur hasil event & talent secara objektif | semua | tidak | `:2032`, `:5505` |
| perfomset | Performa Omset & Bonus | Omset yang diakui tiap PIC event berikut skema bonusnya | semua (tim: Head) | tidak | `:2034`, `:5302` |
| report | Report & Analytics | Laporan omzet, tiket & kehadiran | semua | tidak | `:2035`, `:5605` |
| akses | Hak Akses | Siapa berperan apa, dan peran itu boleh membuka apa | manajemen/`bisaUbah('akses')` | tidak | `:2039`, `:5963` |
| ideas | Event Idea Bank | Database ide event + evaluasi | semua | **ya** (dicabut dari NAV; rute `#/ideas` dipertahankan) | `:2047`, `:11203`; catatan `:2036`, `:5845-5850` |
| history | Event History | Arsip event selesai (read-only) | semua | **ya** (kini tab di Perencanaan; rute `#/history` dipertahankan) | `:2047`, `:11203`; catatan `:2036`, `:5852-5856` |

Sub-layar rincian (bukan menu, argumen rute `router` `:2135-2152`):
`#/talents/<id>` → `renderTalentDetail` (`:2596`), `#/events/<id>` → `renderEventDetail` (`:6369`), `#/ticketing/<event>` → `renderTicketDetail` (`:6755`), `#/ticketing/<event>/<kelas>` → `renderKategoriDetail` (`:6982`), `#/history/<id>` → `renderHistoryDetail` (`:11276`).

### C.2 Situs publik `ticketing`
`Layar.<nama>` = rute hash (`ticketing/index.html:1101-1110`, `dariHash` `:1129`). `NAV_SEKSI` `:948`.

| key | judul | keterangan | bukti |
|---|---|---|---|
| events | Beranda / daftar event | hero + pita angka + perkenalan + daftar kartu event + cara beli + jaminan + hari-H + FAQ + kontak | `:1474`, `:948-949` |
| event | Detail event | kategori, deskripsi, sisa tempat, tombol beli / pilih kursi | `:1659` |
| denah | Pilih tempat | denah interaktif (zoom, geser), pilih kursi/tabel, atau pilih jumlah tiket reguler | `:1881` |
| checkout | Data pemesan | nama/email/HP, syarat & ketentuan, ringkasan, lanjut bayar | `:2339` |
| masuk | Masuk / Daftar | satu layar dua mode | `:2435` |
| lupa | Lupa password | kirim tautan reset | `:2490` |
| reset | Reset password | form password baru | `:2515` |
| tiketsaya | Tiket Saya | riwayat pesanan akun + tiket di perangkat ini | `:2540` |
| tiket | E-ticket / status pesanan | status + tiket QR + upgrade + unduh | `:2574` |
| simbayar | Konfirmasi simulasi (dev) | halaman konfirmasi Xendit mock | `:2748` |
| gagal | Pembayaran gagal | kembali ke pesanan | `:2761` |
| bantuan | Pusat Bantuan | 12 tanya-jawab + hari-H + aturan + kontak | `:1456`, `:1452-1455` |

## D. Detail per layar

### D.1 dashboard — Dashboard
- **Tampilan:** kartu perhatian (`kartuPerhatian`, `:2293`); pita saringan periode `dashPeriode` `[['','Semua'],['hari','Hari ini'],['minggu','Minggu ini'],['bulan','Bulan ini']]` (`:2308`); 4 kartu Status Event (Planning/Prospect/Approval/Upcoming; `Event Done` sengaja dibuang, `:2357-2366`); 8 kartu statistik: `Upcoming Events`, `Event Hari Ini`, `Talent Hari Ini`, `Uang Masuk Tiket`, `Attendance`, `Keterisian`, `Avg Ticket Price`, `Total Talent` (`:2368-2383`); kartu Insight (`Best Selling Event`, `Most Active Talent`, `Event Paling Banyak Masuk`, `Tiket Terjual yang Hadir`); bar chart "Uang Masuk per Event (6 bulan)"; tabel `Event Terdekat` (kolom Event/Tanggal/Venue/PIC/Status/Tiket) (`:2404-2413`).
- **Perhitungan di browser:** `upcoming` = count status `Upcoming`; `ticketRev` = Σ `orders[payment_status==='Paid'].total`; `ticketsSold` = Σ `ticketClasses.sold`; `attendance` = count `checkins[result==='Valid']`; `occ = round(attendance/paidTickets*100)`, `paidTickets = tickets.length`; `avgPrice = round(ticketRev/ticketsSold)`; best event per `event_id` omzet; top talent per `schedules[status==='Done']` (`:2313-2347`).
- **Catatan:** bar chart memakai **data demo tertulis-mati** `[['Ags',22],['Sep',31],['Okt',18],['Nov',26],['Des',210],['Jan',8]]` (`:2405`) — bukan dihitung dari data; Vue harus menghitung dari `omzetPerBulanEms` (`:4975`). Judul kartu memakai emoji (`💡`,`📈`,`🎪`) → langgar DESIGN.md.

### D.2 calendar — Event Calendar
- **Tampilan:** navigasi ‹ bulan › + "Hari Ini"; dropdown tipe `['all','Event','Entertainment','Reservation','Marketing','Holiday','Birthday']` (`:11045`); legenda 3 warna (EMS ungu, Talent merah, Marketing emas, Reservasi teal — meski komentar menyebut "tiga warna" ada 4 item legenda); pita "N pax bulan ini" dengan rincian `title="EMS … · Marketing … · Reservasi …"` (`:11047`); kisi bulan (`:11049`) dengan maks 4 item + "+N lagi".
- **Sumber (lintas modul):** `DB.events` (ungu), `DB.schedules` (label "🎤 nama", merah), `DB.calendarExtra` (libur/ulang tahun; tipe `Reservation` dibuang, `:10993`), **Marketing dibaca** via `MKT_URL='../marketing-api-mysql/api.php'?action=getAll` filter `status!=='Lost'` (`:10753,10759-10793`), **Reservasi dibaca** via `RSV_API_EMS='../reservasi-api-mysql/api.php'?action=getAll` membuang `cancelled|no-show|noshow|batal` (`:10825,10830-10865`).
- **Aksi:** klik item → `calEventPopup` (`:11060`), `calJadwalPopup` (`:11082`), `calMktPopup` (`:11103`, read-only), `rsvHariPopupEms` (`:10878`, read-only + tombol "Buka Modul Reservasi").
- **Perhitungan di browser:** `paxEventEms(e)` = Σ `ticketClasses.sold` bila ada, else `+e.capacity` ("tiket terjual" vs "kapasitas rencana", `:10902-10907`); `calTotalPaxEms(y,m)` menjumlah tiga sumber mengikuti `calFilter` (`:10912-10921`).
- **Real-time:** `muatEventMarketing`/`muatReservasiEms` fetch sekali, timeout 8 dtk; gagal → baris peringatan + tombol "Coba lagi" (bukan layar kosong).

### D.3 talents — Talent Management
- **Tampilan:** filter: input "🔍 Cari nama talent...", dropdown `Semua kategori` (`TAL_CATS` `:2419`), `Semua status talent` (bawaan `Active`), `Semua kontrak`, pill jumlah (`:2497-2501`). Tabel kolom Talent (avatar inisial + nama + Instagram), Kategori (badge), Kontak (WhatsApp + email), Manager, Default Fee, Status Kontrak, Status Talent, kolom hapus (`:2503-2515`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | + Talent Baru | buka `talentForm()` | `saveAll` | `POST /talents` | `:2495,2522` |
  | (baris) | buka `renderTalentDetail` | `getAll` | `GET /talents/{id}` | `:2504` |
  | (tong sampah) | `hapusTalent(id)` | `saveAll` | `DELETE /talents/{id}` | `:2513,3018` |
- **Form & field Talent** (`talentForm` `:2522-2538`, simpan `saveTalent` `:2542`):
  | field (nama data) | label UI | tipe | wajib | default / pilihan | validasi & pesan |
  |---|---|---|---|---|---|
  | name | Nama * | text | ya | — | `Nama & phone wajib diisi.` |
  | category | Kategori | select | tidak | `TAL_CATS` | — |
  | phone | Phone * | text | ya | — | (idem) |
  | whatsapp | WhatsApp | text | tidak | — | — |
  | instagram | Instagram | text | tidak | — | — |
  | email | Email | text | tidak | — | `Email tidak valid.` regex `^[^@\s]+@[^@\s]+\.[^@\s]+$` |
  | manager_name | Manager | text | tidak | — | — |
  | default_fee | Default Fee (IDR) | uang | tidak | 1000000 (baru) | — |
  | bank_name | Bank | text | tidak | — | — |
  | bank_account | No. Rekening | text | tidak | — | — |
  | account_holder | (tersembunyi = name) | — | tidak | nama | — |
  | contract_status | Status Kontrak | select | tidak | `None` (`Tanpa Kontrak`/`Kontrak Berjalan`/`Kontrak Habis`) | — |
  | status | Status Talent | select | tidak | `Active` (`Aktif — masih dipakai`/`Nonaktif — tidak dijadwalkan lagi`) | menandai Inactive dengan jadwal aktif → `⚠ Talent punya jadwal aktif — jadwal tetap disimpan.` |
  | notes | Notes | textarea | tidak | — | — |
- **Catatan:** dua status berbeda (`status` talent vs `contract_status`) sengaja dibedakan (`:2470-2486`).

### D.4 (rincian) talents — Talent Detail
- **Tampilan:** `Basic Information` (dapat disunting di tempat via `talentEditInline`, `:2659`), `Pembayaran`, `Documents` (KTP/NPWP/Contract/Portfolio; portfolio multi-berkas; unggah ≤8MB JPG/PNG/WEBP/GIF/PDF), `Performance History` (Tanggal/Jenis Show/Jam/Fee/Status Bayar), `Monthly Income` (Bulan/Jumlah Show/Total Fee) (`:2596-2657`).
- **Aksi:** "Edit Lengkap" (`talentForm`), "← Kembali", "Edit"/"Simpan"/"Batal" inline, "Unggah"/"Ganti"/"Hapus" dokumen, pratinjau berkas (`pratinjauBerkas`).
- **Perhitungan:** `income[bulan]` = count & Σ fee dari `schedules[status==='Done']` (`:2604`); status bayar per show dicocokkan lewat `rentangPeriodeBayar(p.period_month)` (`:2618-2625`).
- **Validasi inline:** `Phone wajib diisi.`, `Email tidak valid.` (`talentSimpanInline` `:2686`).
- **Dokumen field:** `t.docs = {ktp,npwp,contract,portfolio[]}`, tiap nilai `{key,name,size,at}` (`:2556`).

### D.5 schedule — Talent Schedule
- **Tampilan:** kalender bulan; chip talent diwarnai **per kategori** `TAL_WARNA` (`:2441-2450`), teks kontras `talTeks` (`:2465`); legenda hanya kategori yang dipakai (`legendaTalentHTML` `:3200`). Tombol atas: `📆 Input Mingguan`, `🔁 Recurring`, `📅 Generate Bulanan`, `+ Jadwal` (`:2703`).
- **Aksi:** klik chip → `schedInfo` (`:2856`) (ubah status/`setSchedStatus` `:2888`, hapus `delSched` `:3100`), klik sel → `scheduleForm(tgl)`.
- **Form "Tambah Jadwal"** (`scheduleForm` `:3412`, `gambarTambahJadwal` `:3445`, simpan `saveSchedule` `:3497`): pilih talent (tombol multi), field: Tanggal * (date), Tipe Performance (select `TAL_CATS`), Jam Mulai (time, default `20:00`), Jam Selesai (time, default `23:00`), fee per talent (input uang per baris). Validasi: `Pilih minimal satu talent dulu.`; `Jam selesai harus > jam mulai.`; bentrok → `Bentrok di <tgl>: <nama,...>`.
- **Input Mingguan** (`mgBuka` `:3225`, simpan `mgSimpan` `:3364`): 7 kolom hari, tombol talent, drag-drop; field Jam Mulai/Selesai/Tipe; tombol `Kosongkan hari ini`, `Batal`, `Simpan N Jadwal`; validasi `Jam selesai harus lebih dari jam mulai.`, `Belum ada baris baru untuk disimpan.`; satu talent tidak boleh dua kali di hari yang sama (`:3262-3266`).
- **Recurring** (`recurringModal` `:3539`, simpan `genRecurring` `:3604`): field Talent (multi: dropdown + `+ Tambah` + `Pilih Banyak`), Hari (checkbox `DOW`), Tipe, Fee / show (0 = fee bawaan masing-masing), Jam Mulai/Selesai, Dari/Sampai. Validasi `Pilih minimal satu hari.`, `Pilih minimal satu talent.`; simpan ke `recurringRules` + generate `schedules` (idempotent via `hasConflict`).
- **Generate Bulanan** (`monthlyGenModal` `:3657`, simpan `genMonthly` `:3766`): 7 kolom **hari dalam minggu** ("tiap Jumat sepanjang bulan"); field Jam Mulai/Selesai/Tipe; pill "N tanggal · M jadwal akan dibuat".
- **Daily Entertainment Rules** (`dailyRulesModal` `:3811`) — **KODE TERTIDUR**: `ruleHari()` selalu memulangkan kosong dan tidak ada pemanggil (`:3848-3869`). Tombolnya tidak ada di NAV/topbar. Jangan dihidupkan tanpa keputusan owner.
- **Perhitungan:** `hasConflict(talent_id,date,st,et,ignoreId)` = ada jadwal lain talent sama, tanggal sama, status ≠ Cancelled, dan `overlaps` (`:3101`, `overlaps` `:1687`); `talentUrut` mengurut talent: frekuensi 90 hari terakhir → tanggal tampil terakhir → abjad (`:3156-3170`).
- **Real-time:** tidak ada polling khusus; `autoSelesaikanJadwal` dijalankan tiap `router()` (`:2129`).

### D.6 fee — Fee & Pembayaran Talent
- **Tampilan:** mode `[['minggu','Mingguan'],['bulan','Bulanan'],['rentang','Rentang']]` (`:4050`); pemilih periode + panah geser; pill "Total hari tampil" & "Total fee"; tabel per talent: Talent, Bank, Hari Tampil, Total Fee, Status, Aksi (`:4075-4090`).
- **Aksi:** `Bayar` (`payAction`), `Detail` (`payHistory`), `Generate Payment` (`genPayment` `:4097`), `Reject` (`rejectPay`), `Set Paid` (→ `markPaid` `:4403`), unggah/ganti bukti (`pilihBuktiTransfer`), `Periksa ulang bukti` (`periksaUlangBukti`), "Kembali".
- **Form:** Proses Pembayaran → Bank Tujuan, Bukti Transfer, Nominal pada Bukti, PIC Finance (`:4131-4145`).
- **Perhitungan di browser:** `feeRentang()` (minggu = Senin–Minggu; bulan = tanggal 1–akhir; rentang bebas) (`:3876-3891`); `feeKunci()` = `'YYYY-MM'` untuk bulanan, else `'YYYY-MM-DD..YYYY-MM-DD'` (`:3901`); rekap = Σ fee tiap jadwal **status Done** (`:4045-4049`); `feeAngka(s)` membersihkan teks ribuan → angka (`:3972-3987`).
- **Aturan:** fee adalah **fee per hari tampil** dan disimpan **per baris jadwal**, bukan diambil ulang dari profil (`:3865-3869`).
- **Real-time/OCR:** pemeriksaan bukti transfer otomatis memakai Tesseract.js dari CDN `https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js` (`OCR_SRC` `:4166`), peta bank `OCR_BANKS` (`:4220`), skor & nominal (`ocrAmount` `:4245`, `buktiSkor` `:4276`).

### D.7 pipeline — Event Pipeline
- **Tampilan:** toggle `Kanban Pipeline` / `Tabel Event` (`:4763`); pita ringkasan jumlah per tahap (tanpa nominal) + Total Event; Kanban 5 kolom `EVT_STATUS = ['Planning','Prospect','Approval','Upcoming','Event Done']` (`:4490`), warna `PIPE_WARNA` (`:4757`); kartu `kcard` draggable.
- **Aksi:** drag kartu antar kolom → konfirmasi `Pindahkan ke <tahap>?` (`pindahTahapEms` `:4847`) → `setEventStatus` (`:4861`); klik kartu → `#/events/<id>`.
- **Aturan:** `Planning → Upcoming` **dilarang** lewat sini (`Rencana hanya naik ke Upcoming lewat persetujuan manajemen.`, `:4868-4872`); hanya manajemen yang bisa menarik event kembali ke `Planning` (`Hanya manajemen yang bisa menarik event kembali ke Perencanaan.`, `:4873-4876`); `Event Done` mengunci data.
- **Auto:** `autoSelesaikanEvent()` (`:4887`) memindah `Upcoming` yang tanggalnya sudah lewat → `Event Done`, kecuali status diubah manusia setelah selesai (`e.statusAt > selesai`).

### D.8 planning — Perencanaan Event
- **Tampilan:** pita tab `planTabsHTML()` = `Perencanaan` / `Event History` (`:5845`; tab `Event Idea Bank` **dicabut**); chip saringan `Semua` / `Belum diajukan` / `Menunggu keputusan` / `Ditolak` dengan jumlah (`planFilter` `:5863-5874`); catatan `N rencana menunggu keputusanmu.` untuk manajemen (`:5878`); grid kartu (`:5888-5927`).
- **Aksi:** `+ Rencana Baru` (bila `bisaUbah('planning')`) → `eventForm(null,{status:'Planning'})`; `Buka`; `Ajukan ke manajemen` (`ajukanRencana` `:4689`); `Setujui` (`setujuiRencana` `:4705`) / `Tolak` (`tolakRencana` `:4723`); hapus rencana (`hapusEvent` `:2948`).
- **Status pengajuan:** `statusPengajuan(e)` dari `e.pengajuan = {status,oleh,pada,alasan}` (`:4687-4688`); `ajukanRencana` validasi `Hanya rencana yang bisa diajukan.` dan `Lengkapi dulu judul, tanggal, dan venue sebelum diajukan.` (`:4691-4699`).
- **Catatan:** tab `riwayat` memanggil `renderHistory` apa adanya (`:5866-5870`).

### D.9 events — Event Management
- **Tampilan:** tab status `EVT_STATUS` minus Planning/Prospect + `Semua` (di ujung, `:6084`); toggle periode `Semua/Hari ini/Minggu ini/Bulan ini`; input "🔍 Cari event, venue, atau PIC..."; pill "N dari M event"; tabel kolom Event (poster mini + judul + kategori), Tanggal, Venue, PIC, Tiket (`sold / quota`), Omzet, Status, kolom hapus (`:6102-6132`).
- **Aksi:** `Lihat Perencanaan` (bila izin); klik baris → `#/events/<id>`; tong sampah → `hapusEvent` (`:6128`).
- **Form & field Event** (`eventForm` `:6284`, simpan `saveEvent` `:6313`):
  | field (nama data) | label UI | tipe | wajib | default / pilihan | validasi & pesan |
  |---|---|---|---|---|---|
  | title | Judul * | text | ya | — | `Judul wajib.` |
  | poster_img | Gambar Poster | upload | tidak | — | harus gambar; `Poster harus berupa gambar (jpg/png/webp/gif).` |
  | category | Kategori | select | tidak | `EVT_CATS` (`:4450`) | — |
  | theme | Theme | text | tidak | — | — |
  | venue | Venue | text | tidak | — | — |
  | capacity | Kapasitas | number | tidak | 100 | — |
  | start_datetime | Mulai * | datetime-local | ya | — | `Tanggal & jam mulai wajib diisi.` |
  | end_datetime | Selesai | datetime-local | tidak | — | `⛔ Waktu selesai tidak boleh sebelum waktu mulai.` |
  | pic | PIC | text/readonly | tidak | terkunci ke akun pembuat (`fieldPicEvent` `:6271`) | — |
  | description | Deskripsi | textarea | tidak | — | — |
  | is_ticketed | Ticketed event (aktifkan modul ticketing) | checkbox | tidak | unchecked | — |
  | createdBy / createdById | (tersembunyi) | — | tidak | nama+id akun saat lahir | tidak ditulis ulang saat disunting (`:6352-6367`) |
- **Aturan PIC:** PIC terkunci ke akun yang menginput event (`:6271-6283`); event lama tanpa jejak tetap bisa diketik (`:6278-6282`); event baru `status:'Draft'` + `eventDetails` default dengan 2 task template ("Design poster"→Marketing, "Book talent"→Ent. Coord) (`:6358-6362`).

### D.10 (rincian) events — Event Detail
- **Tampilan:** banner; `ℹ️ Informasi Dasar`; `⏱️ Timeline Event` (checklist 8 fase `TIMELINE_PHASES` `:4451`); lima seksi tabel isian-langsung lewat satu mesin `SEKSI` (`:6567-6600`): `🗓️ Rundown`, `🤝 Vendor`, `💰 Budget`, `🏷️ Sponsor`, `✅ Task Internal`; kartu budget 3 statistik `Income (Actual)/Expense (Actual)/Profit` (`budgetStatHTML` `:6683`); kartu `🎟️ Ticketing` dengan `Kelola Ticketing →` bila `is_ticketed` (`:6419`).
- **Aksi header:** dropdown status (`setEventStatusDetail` `:6424`), `✎ Edit`, tong sampah `Hapus` (`hapusEvent`).
- **Kolom seksi:** Rundown `[time,endtime,activity,pic,notes]`; Vendor `[name,pic,phone,cost,status]` (status `Pending/Confirmed/Paid`); Task `[title,assignee,due,done]`; Budget `[item,type,budget,actual]` (tipe `Expense/Income`); Sponsor `[name,package,nominal,agreement,status]` (`Pending/Confirmed/Paid`), tfoot "Total sponsor masuk".
- **Perhitungan:** `totalSponsor(d)` = Σ nominal sponsor non-Cancelled (`:6601`); variance budget per baris = `actual-budget` (hijau<0/merah>0, `:6544`); `budgetStatHTML` = Income/Expense/Profit dari `sumA` (`:6683`).
- **Aturan:** rundown baru berawal dari jam selesai baris terakhir (`:6625-6640`); nilai status warisan tetap jadi pilihan (`selStatus` `:6497`); event `Event Done` mengunci semua isian (`:6376`).

### D.11 ticketing (EMS) — Ticketing
- **Tampilan:** toggle `Upcoming` / `Riwayat Event`; kisi kartu event ber-tiket (status ≠ Planning) dengan `sold/quota (pct%)`, omzet, progress bar, rincian 4 kategori teratas (`kartuKategoriHTML` `:6736`), peringatan `⚠ Tiket hampir habis!` bila pct≥90 (`:6712`). Daftar hanya `is_ticketed && status!=='Planning'` (`:6701`).
- **Sub-layar `renderTicketDetail(id)`** (`:6755`): 4 tab `Kelas Tiket` / `Denah & Booking` / `Jual Tiket` / `Penjualan & Refund` (`:6798-6801`).
  - **Kelas Tiket:** tabel kelas (Nama+benefit, Harga, Kuota, Terjual, Masa Jual, Tempat Duduk `Kursi bernomor`/`Bebas berdiri`); tombol `+ Kelas Tiket Baru`; edit `✎`/hapus `×` (`delTicketClass` `:9518`).
  - **Denah & Booking:** pemilih lantai, `✎ Mode Desain`, `🎟️ Mode Jual`, `Denah Bawaan LM`, `Hapus Denah Template Lama (N)`; editor kanvas `renderL1` (`:7417`)/`renderL2Hall` (`:9446`) + `layoutBody` (`:9421`); palet objek, copy/paste, undo/redo, align/distribute, zoom, background, tier warna.
  - **Jual Tiket** (`jualBody` `:6808`): pilih tiket (drop-down kelas; habis → disabled "(HABIS)"), Nama *, No. HP * (default `+628`), Email *, tombol `Simpan & Tandai Lunas` (`doPurchase` `:9802`); denah `#pf_seatwrap`.
  - **Penjualan & Refund** (`salesBody` `:7187`): ringkasan per kategori (`salesRingkas` `:6919`), tabel pembeli, refund (`requestRefund`/`submitRefund`/`approveRefund`/`tolakRefund` `:9981-10074`), e-ticket (`showETicket` `:9876`, `kirimWA` `:9937`, `unduhQR` `:9957`).
- **Sub-layar `renderKategoriDetail(eid,clsId)`** (`:6982`): denah kategori disorot + daftar penjualan kategori; pager `KAT_PER_HAL=8` (`:6981`).
- **Perhitungan:** `salesRingkas(eid)` (`:6919-6976`): per kategori n & rp; pembeli unik per pesanan; omzet = Σ harga tiket non-Refunded; `dikembalikan` = Σ harga tiket Refunded; `tiketSah`; `per[nama].pembeli` diurut jumlah terbanyak.
- **Aturan (CLAUDE.md):** `porsiPic()` = `amount/2 + Open Bill` untuk event (dasar bonus **NET `amount`**, bukan porsi) (`laksamana-office/CLAUDE.md:1044-1130`). Empat skema bonus event dihitung `deploy/assets/performa-bonus.js` — lihat D.12.

### D.12 perfomset — Performa Omset & Bonus
- **Tampilan:** memakai aset `deploy/assets/performa-bonus.js` (dimuat sebelum skrip halaman, `event/index.html:1312`); tanggal bulan, tombol pindah PIC, kartu-kartu skema bonus, daftar event berhalaman `PF_PER_HAL=5` (`laksamana-office/CLAUDE.md:1008-1043`), grafik `Omset per Event` (Chart.js).
- **Data:** `POST` ke `PEV_API = '../kompas-api-mysql/api.php'` `{action:'performaDivisi',divi:'event',dari,sampai,sesi}` (`:5271-5299`).
- **Hak lihat:** `pevBolehSemua()` = `pevAkuHead()` (kata "Head" di roster) atau `pevAdmin()` (`peranSaya()==='manajemen'`) (`:5252-5263`); gerbang di penggambar `gambar()`, bukan di tombol (`laksamana-office/CLAUDE.md:12330-12336`).
- **Perhitungan (aset bersama):** realisasi, potongan compliment, empat skema bonus — `pbAgregasi()`, `bonusEvent()`, `kartuBonusEv()`; modul ini **tidak boleh** memuat salinan rumus (`laksamana-office/CLAUDE.md:12310-12316`). Skema 1+2+4 diakumulasi, Skema 3 berdiri sendiri (`laksamana-office/CLAUDE.md:1056`).
- **Kolom "Nominal" di Daftar Event** lahir kosong & diketik orangnya, disimpan di `event.nominal` (bukan dihitung) (`laksamana-office/CLAUDE.md:13704-13740`).
- **Catatan:** modul Event **tidak menyimpan nilai rupiah event**; yang ada hanya penjualan tiket.

### D.13 performa — Event Performance
- **Tampilan:** kartu + tabel hasil per event/talent; sumber satu fungsi `angkaEms(rentang)` (`:4925`) agar Performance & Report tidak berbeda.
- **Perhitungan:** hanya event berstatus `Approval/Upcoming/Event Done` (`EVT_STATUS_HASIL` `:4495`); `omzet` = Σ orders Paid; `terjual` = Σ `ticketClasses.sold`; `kuota` = Σ quota; `tiket` = jumlah e-ticket terbit (sengaja beda dari `terjual`); `hadir` = tiket status `Checked-In`; `isi = round(terjual/kuota*100)`; `hadirPct = round(hadir/tiket*100)` (`:4925-4974`).
- **Bantuan:** `breakdownEventEms` (`:5563`) & `breakdownEventHTML` (`:5580`).

### D.14 report — Report & Analytics
- **Tampilan:** pita periode (`repPeriode`, `:5602`), omzet per bulan `omzetPerBulanEms(n)` = pesanan **Paid** saja, dipetakan ke bulan tanggal mulai event, dalam **juta** (`:4975-4987`).

### D.15 approval — Approval Flow
- **Tampilan:** 3 kartu ringkas: `Rencana Menunggu`, `Refund Menunggu`, `Nilai Refund Tertahan`; toggle `Semua` / `Rencana Event (n)` / `Refund E-Ticket (n)` (`:5716-5720`); tab `Antrian` / `Riwayat Approval` (`:5726`); dua tabel berjudul `📋 Rencana Event` & `💸 Refund E-Ticket` (`:5735-5740`).
- **Aksi:** `Setujui`/`Tolak` (rencana: `setujuiRencana`/`tolakRencana` `:5760`; refund: `approveRefund`/`tolakRefund` `:5799`), `Buka` (`:5764`).
- **Aturan:** lencana menu `emsAntriApproval()` = jumlah rencana Menunggu + refund Pending (`:2089-2095`); antrean refund diurut **terlama di atas** (`:5697`); `Semua` jadi bawaan agar angka menu & isi halaman sama (`:5708-5714`).

### D.16 checkin — Check-In (Hari H)
- **Tampilan:** pemilih Event (hanya `is_ticketed`, `:10087`); 3 kartu statistik `Total Tiket` / `Checked-In` / `Keterisian` (`ciStatHTML` `:10372`); kartu `🪑 Kursi Terisi Langsung` dengan denah live + zoom `−/Pas/+` (`:10099-10108`); kartu `📷 Scanner QR` (nyalakan kamera, tempel token, `Cek token ini`); `🧾 Daftar Tamu` dengan chip `Belum datang`/`Sudah datang`/`Semua`, filter kategori, pencarian, pager `CI_PER_HAL=10` (`:10146-10334`).
- **Aksi:** `Nyalakan Kamera`/`Matikan Kamera` (`toggleKamera` `:10554`), `Cek token ini` (`doScan`), `Check-in` (`checkinDariDenah` `:10693`), `Batalkan` (`batalCheckin` `:10707` → konfirmasi `batalCheckinYakin` `:10717`), unduh/salin QR.
- **Perhitungan:** occupancy `occ = round(masuk/tickets.length*100)` (`:10374`).
- **Real-time:** polling `setInterval(…, 20000)` (`:1596`); di halaman Check-In memakai `segarkanCheckin()` parsial (kartu angka, denah, tabel) supaya kamera tidak mati & scroll tidak lompat (`:1623-1643`).
- **Perubahan v1:** checkin `POST /checkins` mencatat `staff` = **nama user sesi** (body tidak bisa menyetel); legacy memakai `staff: DB.role` yang selalu `'Director'` (`event/index.html:10548`).
- **Aturan:** check-in append-only (tidak bisa diubah/dihapus di v1, `docs/api/event.md:85`); pembatalan legacy menghapus baris `checkins` (`:10722`).

### D.17 ideas — Event Idea Bank (tersembunyi)
- **Tampilan:** filter kategori `IDEA_CATS` (`Music,Community,Food,Competition,Family,Kids,Education,Business,Religious,Festival`) & frekuensi `FREQS` (`Weekly,Biweekly,Monthly,Quarterly,Yearly,One Time`) (`:11119-11120`); kisi kartu ide dengan ROI `round((potential_revenue-budget)/budget*100)` (`:11130`).
- **Aksi:** `+ Ide Baru` (`ideaForm` `:11137`), `→ Buat Event` (`spawnEvent` `:11189`, prefill form, `window._dariIde`), `+ Evaluasi` (`evalIdea` `:11155`, simpan `simpanEval` `:11171`), `Hapus` (`hapusIde` `:3053`).
- **Form Ide:** Nama (wajib, `Nama wajib.`), Kategori, Target Market, Frekuensi, Budget (default 10.000.000), Potensi Uang Masuk (default 20.000.000), Difficulty (`Easy/Medium/Hard`), Deskripsi.
- **Form Evaluasi:** Tanggal Pelaksanaan, Omzet, Jumlah Hadir, Biaya Aktual (default budget), Skor Keseluruhan (1–10, `Skor harus 1–10.`), Layak Diulang? (`Ya/Perlu perbaikan/Tidak`), Yang Berjalan Baik, Yang Perlu Diperbaiki; evaluasi disimpan ke `i.evaluations[]` dengan `profit=omzet-biaya`.

### D.18 history — Event History (tersembunyi / tab)
- **Tampilan:** filter `Semua tahun` / `Semua kategori`; kisi kartu arsip dengan omzet/terjual/hadir; tombol `↺ Buat Event Serupa` (`buatEventLagi` `:11263`, hanya `bisaUbah('planning')`) (`:11202-11260`).
- **Rincian `renderHistoryDetail`** (`:11276`): banner + `ℹ️ Informasi Dasar` + `📊 Pencapaian` (Omzet Tiket, Tiket Terjual, Hadir Hari-H, Kategori Terlaku) + `💰 P/L` bila ada budget. Evaluasi **dicabut** (sebelumnya dua kalimat hardcoded) (`:11281-11288`).
- **Aturan:** arsip = status `Event Done` atau `Finished` (`:11214`); `Buat Event Serupa` menyalin bentuk acara (judul+kategori+tema+venue+kapasitas+PIC+deskripsi+is_ticketed) **tanpa** tanggal/kelas tiket/denah/penjualan; status selalu `Planning` (`:11263-11275`).

### D.19 akses — Hak Akses
- **Tampilan:** kartu `Orang & Perannya` (roster Office ditarik otomatis `segarkanRosterOtomatis` `:6053`; kolom Pengguna, Tim / Keterangan, Status, Peran EMS `:6001-6009`); kartu `Matriks Izin` (baris `EMS_HALAMAN` × kolom `EMS_PERAN`, select `Tak Terlihat/Lihat/Boleh Ubah`) (`:6034-6048`).
- **Aksi:** `Kembalikan ke bawaan` (`resetIzin` `:6073`); `setIzin` (`:6061`, butuh `bisaUbah('akses')`).
- **Catatan:** perubahan matriks `save()` tapi **tidak tersimpan di server** (lihat §F.6 dan §I).

### D.20 Lapisan API EMS (semua layar)
- `API_URL = "../event-api-mysql/api.php"` (`:1320`); GET `?action=` + `t=timestamp`; POST JSON `text/plain` (`:1340-1363`); semua panggilan lewat satu antrian `apiQueue` (`:1338-1363`).
- Simpan: `save()` debounce 800 ms → `syncNow()` `apiPost('saveAll',DB)`; gagal → `Gagal simpan: <pesan>`, retry 2000 ms (`:1556-1580`); status sidebar `Menyimpan...`/`Tersimpan`/`Menunggu...`/`Gagal simpan` (`:1545-1553`).
- Polling: `setInterval` 20 dtk, hanya saat idle (tidak dirty/saving, tab terlihat, tidak ada modal, tidak ada fokus di input) (`:1596-1621`).
- Unggah berkas: `uploadBerkas` (≤8MB, TIDAK lewat antrian) → `POST ?action=upload`; `fileUrl(key)` = `?action=file&key=` (`:1367-1395`).
- **Konkurensi:** legacy hanya punya penjaga `updated_at` (`>=` menang), **tanpa** `baseUpdatedAt` (`docs/modules/event.md:41`). v1 memakai version (epoch ms) + `If-Match`/`?version` (`docs/api/event.md:108-112`).

### D.21 Publik — Beranda / daftar event
- **Tampilan:** hero "Kursi Terbaik Selalu Habis Duluan", pita angka (Event dibuka / Tiket tersedia / Akan datang / Event terdekat), lalu bagian perkenalan (`tentangHTML`), daftar kartu event (`kartuEvent` `:1630`), cara beli (`langkahHTML2`), pembayaran (`bayarCaraHTML`), jaminan (`jaminanHTML`), hari-H (`hariHHTML`), FAQ (`tanyaTautanHTML`), kontak (`kontakHTML`), ajakan (`ajakanHTML`) (`:1474-1575`).
- **Sumber:** `GET ?action=events` (`:1477`); angka hero dihitung dari daftar: `totalSisa`, `akanDatang`, `terdekat` (`:1523-1529`).
- **Header:** nav `Beranda` + `NAV_SEKSI` + `Bantuan`; akun: `Masuk`/`Daftar` atau profil (`:960-983`).

### D.22 Publik — Detail event
- **Tampilan:** `GET ?action=event&id=` + `GET ?action=denah&id=` (`:1667-1668`); info: tanggal/jam/hitung mundur, kategori (`kelasHTML` `:1828`), deskripsi (dibersihkan `bersihTeks` `:881`), sisa tempat (`sisaEvent`/`totalEvent`), legenda, tombol beli/pilih kursi (`punyaDenah` `:1822`).

### D.23 Publik — Denah (pilih tempat)
- **Tampilan:** `GET ?action=denah&id=&hold=` (`:1886`); kanvas interaktif: zoom, geser, pemilih lantai; warna status `labelStatus`: `available:'tersedia'`, `mine:'pilihanmu'`, `held:'sedang dipilih orang lain'` (+ `sold`, `checked`) (`:2204`); bar HP sticky (`gambarBarHp` `:2302`).
- **Aksi:** ketuk tempat → `hold` (`POST ?action=hold`, maks 20 kursi, `:1105-1110`); tiket reguler tanpa nomor → `Beli.setUmum` (qty) (`:1046-1060`); auto-refresh denah (`mulaiSegarDenah` `:1918`); waktu tahan habis → `Beli.waktuHabis()` melepas kursi + `POST release` (`:1090-1099`).
- **Perhitungan:** `Beli.total()` = Σ `items.price` + Σ `umum.price*qty`; `Beli.pax()` = Σ max(1,pax) + Σ qty (`:1043-1048`).

### D.24 Publik — Checkout (data pemesan)
- **Tampilan:** `Nama lengkap *`, `Email *`, `Nomor HP / WhatsApp *`, checkbox `Saya menyetujui syarat & ketentuan dan kebijakan refund Laksamana Muda.`, keterangan pembayaran, ringkasan (`ringkasHTML` `:2270`), tombol `Lanjut ke pembayaran` (`:2339-2366`).
- **Aksi:** `kirimCheckout()` → validasi `Lengkapi nama, email, dan nomor HP.`, `Format email belum benar.`, `Setujui syarat & ketentuan dulu.`; `POST checkout` `{event_id,hold_token,name,email,phone,sesi,umum:[{class_id,qty}]}`; sukses → simpan tautan lokal (`simpanTiketku`) → `location.href=r.invoice_url` (`:2381-2420`).
- **Aturan:** wajib masuk sebelum membeli (`Masuk dulu, ya` `:2345-2349`); harga **selalu dihitung server** (`README.md:26-29`); kursi ditahan 10 menit.

### D.25 Publik — Masuk / Daftar / Lupa / Reset
- **Masuk/Daftar** (`:2435`): satu layar dua mode `modeDaftar`; `POST masuk` / `POST daftar` (`kirimAkun` `:2462`); sesi disimpan `localStorage['lmtix_sesi']` (`:928-934`).
- **Lupa** (`:2490`): `POST lupaPassword` {email}.
- **Reset** (`:2515`): `POST resetPassword` {token,password}.

### D.26 Publik — Tiket Saya
- **Tampilan:** `GET ?action=tiketSaya&sesi=` (`:2544`) + tiket lokal perangkat `lmtix_saya` (`:2421`).

### D.27 Publik — E-ticket / pesanan
- **Tampilan:** `GET ?action=order&ref=&token=` (`:2588`); status + tiket QR (digambar `qrMatrix`/`qrSvg` di klien `:2865,3018`, harus identik PDF server); `unduhQR`, upgrade (`ketukUpgrade` `:2669` → `POST upgradeMulai`).

### D.28 Publik — Simbayar / Gagal / Bantuan
- **Simbayar** (`:2748`) dev-only (`POST simbayar`), **Gagal** (`:2761`), **Bantuan** (`:1456`, statis 12 tanya-jawab + hari-H + aturan + kontak).

## E. Pemetaan backend

### E.1 Backend lama EMS (`event-mysql/api.php`)
Aksi (`api.php:40-85`): `getAll` (GET default), `stats`, `ping`, `saveAll`, `eventsHari`, `file`, `upload`. Frontend memanggil: `saveAll` (`:1566`), `getAll` (`:1583,1601`), `upload` (`:1389`), `file` (`fileUrl` `:1371`); serta lintas modul `listModuleRoster` (`:4652`), `performaDivisi` (`:5278`).

| action lama | dipakai di layar | baca/tulis | endpoint v1 | status | catatan |
|---|---|---|---|---|---|
| `getAll` | boot semua layar; polling 20 dtk | baca | `GET /state` (+ koleksi granular) | ✅ | `/state` sama bentuknya + `checkins` (2000 terbaru), `eventDetails`, 3 settings (`docs/api/event.md:40`) |
| `saveAll` | SEMUA tulis | tulis | `POST/PUT/PATCH/DELETE /{resource}[/{id}]` + `PUT /event-details/{id}` + `PUT /settings/{key}` | ⚠️ | v1 **granular + version-check**; bukan blob. Setiap layar harus dipecah; debounce-blob dihapus. Kirim `If-Match`/`?version` |
| `upload` | dokumen talent, bukti transfer, poster | tulis | `POST /files` | ✅ | `{dataBase64,fileName,mimeType}`, ≤8MB, `ev_<hex>.<ext>`; error persis: `file kosong`,`hanya gambar (jpg/png/webp/gif) atau PDF`,`base64 tidak valid`,`file melebihi 8MB` |
| `file` | pratinjau semua berkas | baca | `GET /files/{key}` | ✅ | 404 bila hilang |
| `eventsHari` | Finance > Omset > Breakdown Sumber | baca | `GET /events-on/{date}` | ✅ | buang status Planning/Draft/Cancelled; `{id,nama,status,venue,picName,inputOleh,inputOlehId,mulai}` |
| `ping` | diagnostik | baca | — (`GET /stats`) | ⚠️ | v1 tak punya `/ping` event; `/stats` membawa `versi` |
| `stats` | diagnostik | baca | `GET /stats` | ✅ | |
| (lintas modul) `listModuleRoster` | Hak Akses (roster Office) | baca | — | ❌ | v1 `event` tak punya endpoint roster (sama seperti HR/BD/stock). Lihat §I |
| (lintas modul) `performaDivisi` | Performa Omset & Bonus | baca | `GET /api/v1/kompas/performa/{divisi}` (`divisi=event`) | ⚠️ | TIDAK di modul event — ada di modul **kompas** (`KompasController.php:194`, `routes/v1.php:21`). Kontrak `docs/api/event.md:32` keliru menyebut "marketing module" |
| (lintas modul) `marketing getAll` / `reservasi getAll` | Event Calendar | baca | — (panggil endpoint modul masing-masing) | ⚠️ | v1 event tak punya agregat; Vue harus memanggil `/api/v1/marketing/...` & `/api/v1/reservasi/...` lalu menyatukan sendiri (`event/index.html:10759,10830`) |
| (matriks izin `DB.perm`) | Hak Akses `setIzin`/`resetIzin` | tulis | — | ❌ | backend lama tak menyimpan `perm` (`event-mysql/lib_event_mysql.php:430-433`); v1 "client-side"; lihat §F.6, §I |
| (checkins delete) | Check-In "Batalkan" | tulis (hapus) | — | ⚠️ | v1 check-in **append-only tanpa delete** (`docs/api/event.md:85`); legacy menghapus baris `checkins` (`event/index.html:10717-10728`). Lihat §I |
| (Reset data) | resetData | tulis (hapus massal) | — | ❌ | `resetData` (`:1646`) mengosongkan semua koleksi (`Ketik KOSONGKAN`); v1 tak punya reset massal |

### E.2 Backend lama Ticketing (`ticketing-mysql/api.php`)
Aksi (`api.php:104-200`). Pemetaan:

| action lama | dipakai di layar | baca/tulis | endpoint v1 | status | catatan |
|---|---|---|---|---|---|
| `ping` | diagnostik | baca | — | ⚠️ | v1 publik tak punya ping; `/events` sebagai health |
| `events` | Beranda | baca | `GET /api/v1/tickets/events` | ✅ | `sisa` dihitung server |
| `event&id` | Detail event | baca | `GET /api/v1/tickets/events/{id}` | ✅ | |
| `poster&id` | poster event | baca | `GET /api/v1/tickets/events/{id}/poster` | ✅ | |
| `denah&id[&hold]` | Denah | baca | `GET /api/v1/tickets/events/{id}/seatmap?hold=` | ✅ | status `available/mine/held/sold/checked/area/perabot` |
| `hold` | Denah | tulis | `POST /api/v1/tickets/holds` | ✅ | maks 20 kursi; `ditolak[[seat,reason]]` = data, bukan error |
| `release` | waktu habis / batal | tulis | `DELETE /api/v1/tickets/holds/{token}?seats=` | ✅ | |
| `checkout` | Checkout | tulis | `POST /api/v1/tickets/checkout` | ✅ | harga server-side; order menunggu `TIX_BAYAR_MENIT` menit |
| `upgradeMulai` | E-ticket | tulis | `POST /api/v1/tickets/upgrades` | ✅ | bayar selisih; downgrade ditolak |
| `order&ref&token` | E-ticket | baca | `GET /api/v1/tickets/orders/{ref}?token=` | ✅ | |
| `webhook` | Xendit | tulis | tetap jalur lama `/ticketing-api/api.php` | ✅ | 401 token salah / 500 retry / 503 maintenance (`docs/api/ticketing.md:41-47`) |
| `simbayar` (dev) | Simbayar | tulis | `POST /api/v1/tickets/orders/{ref}/simulate-payment` | ✅ | dev only (`XENDIT_MOCK`) |
| `daftar` | Masuk/Daftar | tulis | `POST /api/v1/tickets/buyers` | ✅ | password ≥8; email di-lowercase; `409 already_exists` |
| `masuk` | Masuk | tulis | `POST /api/v1/tickets/sessions` | ✅ | `401 invalid_credentials`; throttle 429 |
| `keluar` | Profil | tulis | `DELETE /api/v1/tickets/sessions` | ✅ | |
| `lupaPassword` | Lupa | tulis | `POST /api/v1/tickets/password/forgot` | ✅ | jawaban selalu sama; tautan 1 jam sekali pakai |
| `resetPassword` | Reset | tulis | `POST /api/v1/tickets/password/reset` | ✅ | semua sesi lama diputus |
| `saya&sesi` | Header/profil | baca | `GET /api/v1/tickets/me` | ✅ | `buyer_required` bila sesi mati |
| `tiketSaya&sesi` | Tiket Saya | baca | `GET /api/v1/tickets/me/orders` | ✅ | termasuk pesanan via email |
| `ujiEmail` (dev) | — | tulis | — | ❌ | tak ada padanan v1. Lihat §I |
| (QR klien) | Denah, E-ticket | — | `GET /tickets/orders/{ref}/eticket.pdf` | ⚠️ | QR digambar di klien (`qrMatrix` `ticketing/index.html:2865`); wajib identik dengan QR PDF server (bukan gap API, tapi syarat uji) |

Konkurensi: legacy ticketing tiap tulis `GET_LOCK('<db>:tix',10)` (`docs/modules/ticketing.md:45`); v1 sama lock. Kode error yang wajib ditangani UI: `buyer_required/not_found/payload_too_large/validation_failed/rejected/too_many_attempts/busy/module_maintenance` (`docs/api/ticketing.md:50-59`). EMS: `unauthenticated/module_not_granted/not_found/already_exists/duplicate/version_conflict/validation_failed/invalid_file/version_required` (`docs/api/event.md:114-123`).

**Rumus browser-ticketing yang gampang hilang:** `qrMatrix()` (`ticketing/index.html:2865`) harus byte-identik dengan QR PDF server (`tests/Fixtures/ticketing/`, `docs/modules/ticketing.md:54-77`).

## F. Aturan bisnis yang wajib dibawa
1. **Event tidak bisa dijual sebelum disetujui manajemen** — kenapa: tiket dijual untuk acara yang mungkin tidak jadi berarti menagih uang orang — bukti: `event/index.html:6691-6696` (`e.status!=='Planning'`), `:4867-4872`, `:12292` (serah-terima).
2. **`Planning → Upcoming` hanya lewat persetujuan, bukan tombol status** — kenapa: kalau siapa pun bisa menggeser statusnya, "sudah disetujui" berhenti berarti apa-apa — bukti: `event/index.html:4867-4872`, `:4470-4489`.
3. **Empat status pengajuan**: `Belum diajukan` → `Menunggu` → disetujui/ditolak; tahap `Prospect` saat diajukan, `Approval` saat disetujui — bukti: `:4687-4756`.
4. **Anti double-booking talent**: satu talent tidak boleh dua jadwal tumpang tindih di hari sama; seluruh lembar diperiksa SEBELUM satu pun ditulis — bukti: `hasConflict` `:3101`, `mgSimpan` `:3364-3410`, `saveSchedule` `:3497-3537`.
5. **Satu talent tidak boleh dua kali di hari yang sama** pada lembar mingguan — kenapa: fee terhitung dobel & dianggap bentrok — bukti: `:3262-3266`.
6. **Matriks Hak Akses (`DB.perm`) tidak pernah tersimpan di server** — backend lama hanya menyimpan `entertainmentRules`/`role`/`layoutTemplates` (`event-mysql/lib_event_mysql.php:430-433`); `setIzin` `save()` tapi `perm` dibuang. Akibatnya perubahan izin hilang tiap muat ulang. v1 juga tak punya endpointnya — bukti: `event/index.html:6061-6073`, `docs/api/event.md:33,89` (hanya 3 kunci settings). Lihat §I.
7. **PIC event terkunci ke akun penginput** — kenapa: seluruh event produksi terisi jabatan "Event Manager" sehingga omset tidak diakui siapa pun di Finance — bukti: `fieldPicEvent` `:6271-6283`, `saveEvent` `:6352-6367`, `CLAUDE.md:1275-1650`.
8. **`eventsHari` membuang Planning/Draft/Cancelled dengan daftar-yang-dibuang** — kenapa: baris lama masih berstatus `Today`/`Finished` dua generasi — bukti: `docs/modules/event.md:48-52`, `CLAUDE.md:13704` (penyaring status `['Planning','Draft','Cancelled']`).
9. **Harga tiket selalu dihitung server** — kenapa: mengubah angka di DevTools tak boleh bisa membeli VIP seharga seribu — bukti: `ticketing-mysql/README.md:26-29`, `docs/api/ticketing.md:19`.
10. **Lunas hanya lewat webhook Xendit + `x-callback-token`** — kenapa: tidak ada tombol "saya sudah bayar"; tanpa token siapa pun bisa melunaskan — bukti: `README.md:30-33`, `api.php:71-74,194-198`.
11. **Kursi baru `Sold` setelah uang masuk** — kenapa: denah tidak boleh penuh oleh pesanan yang tak dibayar — bukti: `README.md:34-36`; hold di tabel terpisah `seat_holds` (UNIQUE `seat_id`) agar `saveAll` EMS tak menghapusnya (`docs/modules/ticketing.md:16-17`).
12. **Check-in append-only & `staff` dari sesi** — kenapa: kehadiran tidak pernah ditulis ulang, dan nama pelaku tak boleh dari body — bukti: `docs/api/event.md:78-85`, `:10548` (legacy pakai `DB.role`).
13. **Pembatalan check-in legacy MENGHAPUS baris `checkins`** (bukan menandai batal) — kenapa: laporan menghitung baris checkins — bukti: `event/index.html:10717-10728`; v1 tak punya delete check-in (`docs/api/event.md:85`) → UI v1 tidak bisa membatalkan check-in seperti legacy.
14. **`tickets.qr_token` unik**: v1 menolak token ganda `409 duplicate`; legacy justru menimpa tiket lain (bug #100, sengaja diperbaiki) — bukti: `docs/api/event.md:65`, `docs/modules/event.md:42`.
15. **Fee adalah fee per hari tampil, disimpan per baris jadwal** — kenapa: menaikkan fee profil bulan ini tidak boleh mengubah tagihan lampau — bukti: `event/index.html:3865-3869`.
16. **Periode gaji bisa mingguan**; kunci tagihan `'YYYY-MM'` atau `'YYYY-MM-DD..YYYY-MM-DD'`, dan `labelPeriodeBayar`/`rentangPeriodeBayar` menangani keduanya — kenapa: tagihan mingguan pernah terbaca "undefined 2026" & berstatus Waiting selamanya — bukti: `:3901-3934`, `:2618-2625`.
17. **Rundown berantai**: baris baru mulai dari jam selesai baris terakhir, else jam mulai acara — bukti: `:6625-6640`.
18. **Budget: `Var = actual - budget`** (hijau<0 / merah>0); Profit = Σ Income Actual - Σ Expense Actual — bukti: `:6544`, `:6683-6692`.
19. **Refund antrean diurut terlama di atas**; lencana menu = jumlah rencana Menunggu + refund Pending — bukti: `:5697`, `:2089-2095`.
20. **Buat Event Serupa tidak menyalin penjualan/kelas/denah** — kenapa: acara baru tak boleh lahir dengan penjualan acara lama — bukti: `:11263-11275`.
21. **Tema/CSS pernah "diselaraskan" ke Konten, CSS saja, tanpa menyentuh struktur/JS** — kenapa: modul 667 KB semuanya string HTML — bukti: `CLAUDE.md:2581-2610` (jangan dianggap struktur lama boleh diubah).
22. **Performa Omset & Bonus memakai aset SUMBER TUNGGAL `performa-bonus.js`**; aset WAJIB dimuat sebelum skrip halaman — bukti: `event/index.html:1312`, `CLAUDE.md:12310-12316`.
23. **Portal & Runtime**: parameter `action` dari body (POST) atau query (GET); `GET` tanpa `action` = `getAll`; `?action=` kosong = aksi tak dikenal — bukti: `docs/modules/event.md:37`.
24. **Occurrence `eventsHari` tanpa nominal**: modul Event tidak menyimpan nilai rupiah event; Finance yang mengisi `nominal` — bukti: `CLAUDE.md:13704-13740`, `event-mysql/lib_event_mysql.php:472-476`.

## G. Ketergantungan lintas modul
- **Event → Marketing (baca):** Kalender EMS membaca event Marketing via `marketing-api-mysql?action=getAll`, buang `status==='Lost'` (`event/index.html:10753-10793`). **Marketing TIDAK membaca Event** (`grep event-api` di `deploy/marketing/index.html` nihil) — jadi "Marketing↔Event" sebenarnya **satu arah** (Event→Marketing). Koreksi untuk `_lintas-modul.md`.
- **Event → Reservasi (baca):** Kalender EMS membaca reservasi via `reservasi-api-mysql?action=getAll`, buang `Cancelled`/`No-show` (`:10825-10865`); popup read-only + tombol "Buka Modul Reservasi" (`:10878-10901`).
- **Event → Office/Account:** Hak Akses menarik roster ber-grant `event` via `account-api-mysql?action=listModuleRoster` (`:4633-4664`); identitas sesi (`lm_session`) + `adminModules` (`:4571-4582,4666-4675`). Tak ada padanan di v1 `event`.
- **Event → Kompas (baca):** Performa Omset & Bonus `POST kompas-api-mysql {action:'performaDivisi',divi:'event'}` (`:5271-5299`); v1 `GET /api/v1/kompas/performa/event`. Komentar lama menyebut "marketing module" (`docs/api/event.md:32`) — keliru, ada di kompas.
- **Event → DW (dibaca DW):** DW Kalender Tamu menjumlahkan pax Event/Marketing/Reservasi (`deploy/dw/index.html:971-979`) lewat `event-api-mysql` (`:973`). Jadi endpoint baca Event dipakai DW; `_lintas-modul.md:24` sudah mencatatnya.
- **Event → Radar (dibaca Radar):** `radar/index.html:601` (`{id:'evt',url:'../event-api-mysql/api.php'}`).
- **Event → Analytics (dibaca Analytics):** `analytics/index.html:797` (`API_EVENT='../event-api-mysql/api.php'`), untuk Performa Talent (jam tampil) & pengaruh event (`CLAUDE.md:2417-2470,4989`).
- **Event → Finance (dibaca Finance):** Finance > Omset > Breakdown Sumber memanggil `eventsHari` (`event-mysql/api.php:67-70`; v1 `GET /events-on/{date}`); PIC event mengakui omset per orang (`CLAUDE.md:1275-1650`).
- **Event → Finance (DP event, arah balik Finance→):** DP event di modul **Marketing** melahirkan baris `payments` yang masuk ke **Dana Masuk Cashier/Finance** (`CLAUDE.md:1553-1660`, `_lintas-modul.md:33`). DP event **bukan** milik modul Event; catat saja.
- **Ticketing ↔ Event (satu DB):** `lakk5493_db_ems` dibagi; ticketing menulis `orders`,`tickets`,`seats` milik EMS; tabel sendiri `seat_holds`,`tix_users`,`tix_sessions`,`tix_reset`,`tix_gagal` (`docs/modules/ticketing.md:13-22`); v1 & legacy memakai lock berbeda? EMS `ems_save` (`docs/api/event.md:13`), tix `tix` (`docs/modules/ticketing.md:45`).
- **Ticketing → Event (baca berkas poster):** poster diambil dari `<EVENT_DATA_DIR>/files` (`docs/modules/ticketing.md:94`).
- **Aset bersama `deploy/assets/performa-bonus.js`:** dipakai `deploy/finance/kas/` (Performa Marketing/Event), `deploy/marketing/`, DAN `deploy/event/` (`event/index.html:1312`; `_lintas-modul.md:65`).

## H. Catatan untuk implementasi Vue
- Halaman: `app/pages/event/index.vue` (Dashboard) + sub-halaman `event/calendar.vue`, `event/talents.vue`, `event/talents/[id].vue`, `event/schedule.vue`, `event/fee.vue`, `event/pipeline.vue`, `event/planning.vue`, `event/events.vue`, `event/events/[id].vue`, `event/ticketing.vue`, `event/ticketing/[id].vue`, `event/ticketing/[id]/[kelas].vue`, `event/checkin.vue`, `event/approval.vue`, `event/performa.vue`, `event/perfomset.vue`, `event/report.vue`, `event/akses.vue`, `event/ideas.vue`, `event/history.vue`, `event/history/[id].vue`. `definePageMeta({ access: ['event'] })`.
- Situs publik ticketing kemungkinan **halaman publik terpisah** (tanpa Sesi Office): `ticketing/index.vue` (daftar), `ticketing/event/[id].vue`, `ticketing/denah/[id].vue`, `ticketing/checkout.vue`, `ticketing/masuk.vue`, `ticketing/tiket/[ref].vue`, `ticketing/tiket-saya.vue`, `ticketing/bantuan.vue`. Karena v1 publik tanpa `auth:sanctum`, `useApi` perlu mendukung request tanpa token + header hold/order token.
- Composable `useEvent.ts` (fungsi → endpoint):
  - `useEventState()` → `GET /state`; `stats()` → `GET /stats`; `eventsOn(date)` → `GET /events-on/{date}`.
  - CRUD generik: `list(res, filters)`, `get(res,id)`, `create(res,body)` → `POST /{res}`, `update(res,id,body,version)` → `PUT`, `patch` → `PATCH`, `remove(res,id,version)` → `DELETE`; `res ∈ talents,events,schedules,recurring-rules,talent-payments,ticket-classes,seats,orders,tickets,ideas,refunds,calendar-extra`.
  - `eventDetail(eventId)` → `GET/PUT/DELETE /event-details/{eventId}`; `setupSetting(key,value,version)` → `PUT /settings/{key}` untuk `entertainmentRules|role|layoutTemplates`.
  - `uploadFile({dataBase64,fileName,mimeType})` → `POST /files`; `fileUrl(key)` → `GET /files/{key}`.
  - `checkins({ticket_id,gate,result})` → `GET/POST /checkins` (append-only; **tidak ada delete** → tombol "Batalkan" legacy tak bisa dibawa apa adanya).
  - Kirim version sebagai `If-Match: "<version>"` / `?version=`; tangani `409 version_conflict` (muat ulang dari `error.details.current`), `428 version_required`, `409 duplicate` (qr_token ganda), `422 invalid_file`.
  - Performa: `performaDivisi('event', from, to)` → `GET /api/v1/kompas/performa/event` (modul kompas, gated `event`).
- Composable `useTicketing.ts`:
  - `events()` → `GET /tickets/events`; `event(id)` → `GET /tickets/events/{id}`; `seatmap(id,hold)` → `GET /tickets/events/{id}/seatmap`; `posterUrl(id)`.
  - `hold({event_id,seats,hold_token})` → `POST /tickets/holds`; `release(token,seats)` → `DELETE /tickets/holds/{token}`.
  - `checkout(body)` → `POST /tickets/checkout`; `order(ref,token)` → `GET /tickets/orders/{ref}`; `upgrade` → `POST /tickets/upgrades`; `eticketPdf(ref,token)` → `GET /tickets/orders/{ref}/eticket.pdf`.
  - Buyer: `register/login/logout/me/meOrders/forgot/reset` → `/tickets/buyers|sessions|me|me/orders|password/*`.
- HP vs desktop: Kanban Pipeline & editor denah tidak boleh drag-drop di sentuh — Pipeline jadi `AppList` berkelompok per tahap di HP; editor denah tetap kanvas (pinch/pan) tapi sediakan pemilih lantai + daftar objek. Tabel besar (Talent, Events, Fee, Penjualan, Daftar Tamu) → `UTable` di `lg+`, `AppList` di HP. Semua form (Talent, Event, Jadwal, Kategori Tiket, Ide, Evaluasi, Tagihan, Bukti Transfer, Check-in manual) → `ResponsiveSheet`. Satu `AppFocus` per layar: Dashboard → "rencana menunggu keputusan"/"check-in hari ini"; Approval → jumlah antrean; Check-In → statistik keterisian.
- Widget Beranda yang cocok: "Rencana menunggu keputusan" (dari `/state` → `events[].pengajuan`), "Event terdekat", "Uang masuk tiket (Paid)", "Antrean refund", "Talent hari ini".
- Elemen lama yang melanggar DESIGN.md → padanannya:
  - **Grid kartu berisi angka besar** (8 kartu statistik Dashboard, `event/index.html:2368-2383`) → `AppList` + satu `AppFocus`.
  - **Emoji sebagai ikon** (`💡 📈 🎪 📆 🔁 📅 🎤 🎟️ 📷 🪑 🧾 📊 💰 ⏱️ 🤝 🏷️ ✅ 📋 💸 ⚓`) → Lucide (`i-lucide-*`).
  - **Label eyebrow huruf kapital** (`.eyebrow` "Status Event", `:2353`) → label `text-muted` sentence case.
  - **Warna per kategori talent & per status denah** (banyak hex di JS, `TAL_WARNA` `:2441`, `LDZ_WARNA` `:7520`) → token warna/`AppStatus`; jangan hex di komponen.
  - **Badge berwarna penuh** (`badge b-green/…`, `statusBadge` `:2200`) → `AppStatus color=...` (titik + kata).
  - **Progress bar & bar chart tinggi tetap** (`.bar-chart`, `.progress`) → komponen chart Nuxt UI/`AppList` ringkas; hindari gradien.
  - **Teks kuning di latar terang** (`.stat .val` gradasi emas, lihat `CLAUDE.md:12430-12433`) → `text-highlighted`.
  - **Data demo tertulis-mati** (bar chart Dashboard) → dihitung dari data.
- Simpan: hilangkan debounce `saveAll` 800 ms; simpan per-record saat sheet ditutup/field blur, dengan version. Polling 20 dtk legacy diganti refetch saat fokus/interval yang lebih jarang.

## I. Pertanyaan terbuka
- [ ] **event / akses — Matriks izin tidak tersimpan** — haruskah matriks `EMS_HALAMAN × EMS_PERAN` dibawa ke Vue, dan di mana disimpan? Konteks: legacy `setIzin()` `save()` tapi backend hanya menyimpan `entertainmentRules`,`role`,`layoutTemplates` — `perm` dibuang sehingga izin reset tiap muat ulang; v1 tak punya endpoinnya (Hak Akses "client-side"). Bukti: `laksamana-office/deploy/event/index.html:6061-6073`; `laksamana-office/event-mysql/lib_event_mysql.php:430-433`; `laksamana-api/docs/api/event.md:33,89`. Opsi: A) buang layar izin, cukup `module:event` di server; B) simpan matriks di `settings` baru (tambah kunci v1); C) simpan di UI store per perangkat saja.
- [ ] **event / akses — roster Office tanpa padanan v1** — Vue `event` butuh daftar kru ber-grant `event` + peran turunan Tim; v1 `event` tak punya endpoint roster. Bukti: `event/index.html:4633-4664`; `laksamana-api/docs/api/event.md` (tak menyebut roster). Opsi: A) Vue memakai `/api/v1/account/roster*` (butuh scope `account`); B) tambah endpoint roster di `event`; C) hitung peran hanya dari `/me` sesi.
- [ ] **event / checkin — membatalkan check-in** — legacy "Batalkan" **menghapus** baris `checkins`; v1 append-only tanpa delete. Haruskah UI v1 tetap punya tombol pembatalan? Bukti: `event/index.html:10717-10728`; `laksamana-api/docs/api/event.md:78-85`. Opsi: A) buang tombol, salah pindai ditangani di luar sistem; B) tambah `DELETE /checkins/{id}` (melanggar "append-only"); C) simpan baris koreksi (event kedua).
- [ ] **event / resetData — kosongkan semua data** — tombol "KOSONGKAN SEMUA DATA" (`resetData`) tak punya padanan v1 (blob → per-record). Bukti: `event/index.html:1646-1663`. Opsi: A) buang; B) loop DELETE per record (berisiko, lintas DB); C) endpoint khusus.
- [ ] **ticketing / dev — `ujiEmail`** — aksi uji SMTP dev-only legacy tak ada di v1. Perlukah di Vue (dev) atau cukup CLI/mailer? Bukti: `ticketing-mysql/api.php:169-181`; `laksamana-api/docs/api/ticketing.md` (tak menyebut). Opsi: A) buang; B) expose di non-produksi.
- [ ] **event / dashboard — data demo** — bar chart "Uang Masuk per Event (6 bulan)" memakai angka tertulis-mati; konfirmasi Vue menghitung dari `omzetPerBulanEms`. Bukti: `event/index.html:2405`. Opsi: A) hitung dari data (disarankan); B) buang grafik.
- [ ] **event / performa — lokasi endpoint** — kontrak `docs/api/event.md:32` menyebut Performa Omset "served by the marketing module", padahal v1 ada di `GET /api/v1/kompas/performa/event`. Konfirmasi Vue memanggil modul kompas. Bukti: `laksamana-api/app/Modules/Kompas/routes/v1.php:21`; `docs/api/kompas.md:61`.

## J. Progres build
Branch: migrasi/event · Mulai: 2026-10-08
LANJUTKAN DARI: —
(koreksi build 2026-10-08: halaman daftar memakai `<nama>/index.vue`, bukan
`<nama>.vue` — file+dir se-nama menjadi nested route tanpa outlet sehingga
rincian [id] tidak pernah tampil. Lihat laporan Lane B 2026-10-08.)

| layar (key) | file | status | endpoint dipakai | ditunda karena |
|---|---|---|---|---|
| dashboard | app/pages/event/dashboard.vue | ✅ | GET /state | — |
| calendar | app/pages/event/calendar.vue | ✅ | GET /state; GET /marketing/events; GET /reservasi/reservations (pita + Coba lagi bila gagal) | — |
| talents | app/pages/event/talents/index.vue | ✅ | GET/POST/PUT/DELETE /talents | — |
| talents rincian | app/pages/event/talents/[id].vue | ✅ | GET/PUT /talents/{id}; POST /files | — |
| schedule | app/pages/event/schedule.vue | ✅ | GET/POST/PATCH/DELETE /schedules; POST /recurring-rules | — |
| fee | app/pages/event/fee.vue | ✅ | GET /schedules; GET/POST/PATCH /talent-payments; POST /files | OCR otomatis Segera (K-05 belum dipasang; verifikasi manual jalan) |
| checkin | app/pages/event/checkin.vue | ✅ | GET /events; GET /tickets; GET /seats; GET /ticket-classes; GET/POST /checkins | tombol Batalkan Segera (G-10); pindai kamera Segera (butuh pustaka QR) |
| pipeline | app/pages/event/pipeline.vue | ✅ | GET/PATCH /events | — |
| planning | app/pages/event/planning.vue | ✅ | GET/POST/PATCH/DELETE /events | — |
| events | app/pages/event/events/index.vue | ✅ | GET/POST/PUT/DELETE /events; GET /orders | — |
| events rincian | app/pages/event/events/[id].vue | ✅ | GET/PATCH/DELETE /events/{id}; GET/PUT /event-details/{id} | — |
| ticketing | app/pages/event/ticketing/index.vue | ✅ | GET /events; GET /ticket-classes; GET /tickets | — |
| ticketing rincian | app/pages/event/ticketing/[id]/index.vue | ✅ | GET /events/{id}; GET/POST/PATCH/DELETE /ticket-classes; POST /orders; POST /tickets; PATCH /ticket-classes; GET/PATCH /refunds; GET /seats | editor denah kanvas Segera (build tersendiri) |
| ticketing kategori | app/pages/event/ticketing/[id]/[kelas].vue | ✅ | GET /events/{id}; GET /ticket-classes; GET /tickets | — |
| approval | app/pages/event/approval.vue | ✅ | GET/PATCH /events; GET/PATCH /refunds | — |
| performa | app/pages/event/performa.vue | ✅ | GET /state | — |
| perfomset | app/pages/event/perfomset.vue | ✅ | GET /kompas/performa/event; GET /account/modules/event/members; GET/PATCH /events (nominal) | impor performa-bonus.ts, tanpa salin |
| report | app/pages/event/report.vue | ✅ | GET /state | — |
| akses | app/pages/event/akses.vue | ✅ | GET /account/modules/event/members | matriks in-memory, reset saat muat ulang (K-08) |
| ideas | app/pages/event/ideas.vue | ✅ | GET/POST/PATCH/DELETE /ideas; POST /events (spawn) | — |
| history | app/pages/event/history/index.vue | ✅ | GET /events; GET /ticket-classes; GET /tickets; POST /events (serupa) | — |
| history rincian | app/pages/event/history/[id].vue | ✅ | GET /events/{id}; GET /event-details/{id}; GET /checkins | — |

## Konsolidasi untuk README & berkas bersama

### Baris README.md
```
| event | [event.md](event.md) | ⚠️ selesai dengan celah | 28 (17 EMS, 2 tersembunyi + 11 publik ticketing) | 4 ❌ · 7 ⚠️ | 7 | event + ticketing; `saveAll`→CRUD per-record; matriks izin tak tersimpan |
```

### Bullet untuk `_pertanyaan.md`
```
- [ ] **event / akses — Matriks izin tidak tersimpan** — haruskah matriks `EMS_HALAMAN × EMS_PERAN` dibawa ke Vue, dan di mana disimpan? Konteks: legacy `setIzin()` `save()` tapi backend hanya menyimpan `entertainmentRules`,`role`,`layoutTemplates` — `perm` dibuang sehingga izin reset tiap muat ulang; v1 tak punya endpoinnya (Hak Akses "client-side"). Bukti: `laksamana-office/deploy/event/index.html:6061-6073`; `laksamana-office/event-mysql/lib_event_mysql.php:430-433`; `laksamana-api/docs/api/event.md:33,89`. Opsi: A) buang layar izin, cukup `module:event`; B) tambah kunci settings v1; C) simpan per perangkat saja.
- [ ] **event / akses — roster Office tanpa padanan v1** — Vue `event` butuh daftar kru ber-grant `event` + peran turunan Tim; v1 `event` tak punya endpoint roster. Bukti: `laksamana-office/deploy/event/index.html:4633-4664`; `laksamana-api/docs/api/event.md`. Opsi: A) pakai `/api/v1/account/roster*` (butuh scope `account`); B) tambah endpoint roster di `event`; C) hitung peran hanya dari `/me` sesi.
- [ ] **event / checkin — membatalkan check-in** — legacy "Batalkan" MENGHAPUS baris `checkins`; v1 append-only tanpa delete. Haruskah UI v1 tetap punya tombol pembatalan? Bukti: `laksamana-office/deploy/event/index.html:10717-10728`; `laksamana-api/docs/api/event.md:78-85`. Opsi: A) buang tombol; B) tambah `DELETE /checkins/{id}` (melanggar append-only); C) simpan baris koreksi.
- [ ] **event / resetData — kosongkan semua data** — tombol "KOSONGKAN SEMUA DATA" (`resetData`) tak punya padanan v1. Bukti: `laksamana-office/deploy/event/index.html:1646-1663`. Opsi: A) buang; B) loop DELETE per record; C) endpoint khusus.
- [ ] **ticketing / dev — `ujiEmail`** — aksi uji SMTP dev-only legacy tak ada di v1. Bukti: `laksamana-office/ticketing-mysql/api.php:169-181`; `laksamana-api/docs/api/ticketing.md`. Opsi: A) buang; B) expose di non-produksi.
- [ ] **event / dashboard — data demo** — bar chart "Uang Masuk per Event (6 bulan)" memakai angka tertulis-mati; konfirmasi Vue menghitung dari data. Bukti: `laksamana-office/deploy/event/index.html:2405`. Opsi: A) hitung dari data (disarankan); B) buang grafik.
- [ ] **event / performa — lokasi endpoint** — kontrak `docs/api/event.md:32` menyebut Performa Omset "served by the marketing module", padahal v1 ada di `GET /api/v1/kompas/performa/event`. Bukti: `laksamana-api/app/Modules/Kompas/routes/v1.php:21`; `laksamana-api/docs/api/kompas.md:61`.
```

### Baris untuk `_lintas-modul.md`
```
- **Event → Marketing (satu arah, TIDAK balik):** Kalender EMS membaca event Marketing lewat `marketing-api-mysql?action=getAll`, membuang `status==='Lost'` (`laksamana-office/deploy/event/index.html:10753-10793`). `grep event-api` di `deploy/marketing/index.html` NIHIL → klaim "Marketing↔Event" di tabel tugas tidak akurat: arahnya Event→Marketing saja.
- **Event → Reservasi (baca):** Kalender EMS membaca `reservasi-api-mysql?action=getAll`, membuang `Cancelled`/`No-show`; popup read-only + tautan "Buka Modul Reservasi" (`event/index.html:10825-10901`).
- **Event → Kompas (baca):** Performa Omset & Bonus `POST kompas-api-mysql {action:'performaDivisi',divi:'event'}` (`event/index.html:5271-5299`); v1 = `GET /api/v1/kompas/performa/event` (`app/Modules/Kompas/routes/v1.php:21`). `docs/api/event.md:32` keliru menyebut "marketing module".
- **Event → Finance (dibaca Finance):** Finance › Omset › Breakdown Sumber memanggil `eventsHari` (`event-mysql/api.php:67-70`; v1 `GET /events-on/{date}`); PIC event mengakui omset per orang (`CLAUDE.md:1275-1650`).
- **Event → DW / Radar / Analytics (dibaca):** DW Kalender Tamu menjumlahkan pax Event/Marketing/Reservasi via `event-api-mysql` (`deploy/dw/index.html:973,971-979`); Radar (`radar/index.html:601`) & Analytics (`analytics/index.html:797`) membaca `event-api-mysql` (Analytics: Performa Talent per jam tampil, `CLAUDE.md:2417-2470`).
- **DP event (Finance/Marketing → Cashier):** DP event di modul Marketing melahirkan baris `payments` yang masuk ke Dana Masuk Cashier/Finance (`CLAUDE.md:1553-1660`) — bukan fitur modul Event.
- **Aset bersama `deploy/assets/performa-bonus.js` (VERIFIED):** dipakai `deploy/event/index.html:1312`, `deploy/marketing/`, dan `deploy/finance/kas/` — sumber tunggal rumus bonus; dimuat sebelum skrip halaman (`CLAUDE.md:12310-12316`).
- **Event ↔ Ticketing (satu DB `lakk5493_db_ems`):** ticketing publik menulis `orders`,`tickets`,`seats` milik EMS + tabelnya sendiri `seat_holds`,`tix_users`,`tix_sessions`,`tix_reset`,`tix_gagal`; lock berbeda (`ems_save` vs `tix`) (`docs/modules/ticketing.md:13-22,45`). QR/token harus identik antara QR klien & QR PDF server (`docs/modules/ticketing.md:54-77`).
- **Event → Office/Account (roster):** Hak Akses menarik roster ber-grant `event` via `account-api-mysql?action=listModuleRoster` (`event/index.html:4633-4664`) — tak ada padanan di kontrak v1 `event` (sama seperti HR/BD/stock).
```


## K. Daftar uji cutover

Konvensi: Vue ↔ Office lama dibuka berdampingan dengan data yang sama
(API lokal dari DB hasil restore). Tulis memakai akun uji, bukan akun kru.

1. Dashboard: status Planning/Prospect/Approval/Upcoming sama dengan lama;
   8 kartu statistik cocok dengan hitungan lama; bar chart dihitung dari
   data (bukan angka mati); tabel Event Terdekat = Upcoming terurut tanggal.
2. Calendar: event, jadwal talent & calendarExtra tampil; Marketing (tanpa
   Lost) & Reservasi (tanpa Cancelled/No-show) tampil; matikan API
   marketing/reservasi → pita peringatan + Coba lagi, bukan layar kosong.
3. Talents: filter kategori/status/kontrak + cari; tambah (validasi nama,
   phone, email); sunting; hapus. Rincian: inline edit, unggah/ganti/hapus
   dokumen (≤8MB), performance history & monthly income dari show Done.
4. Schedule: tambah (multi-talent, fee per baris), mingguan, recurring,
   generate bulanan; bentrok ditolak SEBELUM satu pun ditulis; ubah status,
   hapus. Coba jadwal tumpang tindih di lama & Vue → sama-sama menolak.
5. Fee: ganti mode minggu/bulan/rentang; rekap = show Done × fee baris;
   generate payment; bayar (bukti + nominal + PIC); detail; set paid/reject.
6. Checkin: pilih event ber-tiket; statistik cocok; tempel token → cek;
   check-in dari daftar; polling 20 dtk tidak mematikan scroll. Batalkan =
   Segera (G-10).
7. Pipeline: pindah tahap via pilih & drag; Planning→Upcoming ditolak;
   tarik ke Planning hanya manajemen; Event Done terkunci.
8. Planning: ajukan (wajib judul+tanggal+venue) → Prospect/Menunggu;
   setujui → Approval; tolak → Planning/Ditolak; hapus. Tab history tampil.
9. Events: tab status + periode + cari; tambah/edit (PIC terkunci pembuat);
   hapus. Rincian: 8 fase timeline; 5 seksi simpan per dokumen; variance
   budget = actual−budget; kartu ticketing → kelola bila is_ticketed;
   Event Done mengunci semua isian.
10. Ticketing: hanya is_ticketed non-Planning; progres & omzet cocok;
    peringatan ≥90%. Rincian: CRUD kelas; jual (habis disabled, default
    +628, lunas); refund setujui/tolak; WA & unduh QR. Editor denah = Segera.
11. Approval: 3 kartu = isi antrean; refund terlama di atas; putusan hanya
    manajemen; angka lencana menu = antrean rencana + refund.
12. Performa & Report: angkaEms sama di dua layar; hanya
    Approval/Upcoming/Event Done; terjual ≠ tiket terbit.
13. Perfomset: agregasi pbAgregasi + skema bonusEvent dari
    GET /kompas/performa/event; kolom nominal diketik & tersimpan;
    non-head/manajemen hanya baris PIC-nya.
14. Akses: roster ber-grant event tampil; ubah matriks berlaku sampai muat
    ulang (K-08); manajemen tak bisa mengunci diri dari halaman akses.
15. Ideas & History: filter; tambah ide + evaluasi (skor 1–10, profit);
    buat event dari ide (prefill, tanpa tanggal); arsip read-only;
    buat serupa tanpa penjualan/kelas/denah, lahir Planning.
16. Konflik: sunting satu record di dua tab → tab kedua 409 → toast
    "Data sudah diubah orang lain" + muat ulang, tanpa menimpa.
