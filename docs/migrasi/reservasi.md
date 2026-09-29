# Reservasi (+ Service Excellent) — inventaris migrasi

Status: ⚠️ selesai dengan celah
Terakhir diperbarui: 2026-09-29

> **Triase 2026-09-29** — status di tabel E yang bertentangan dengan catatan ini: catatan ini yang berlaku.
> Rincian: [`_pertanyaan.md`](_pertanyaan.md), [`_gap-api.md`](_gap-api.md).
> - `ping`/`stats` ❌ → tidak dibawa (U3). `ringkasTamu` → G-07. Paging/ekspor → G-08.
> - Denah → T-20. OCR → K-05. Review → T-21. Reward SE → T-19. Embed SE → T-24.

## Ringkasan
- Jumlah layar: 12 (0 tersembunyi) · Aksi backend lama: 15 · Gap v1: 3 ❌ · 6 ⚠️
- Modul ini menaungi **dua Panel yang berbagi satu Backend dan satu master blob**: Reservasi
  (`deploy/reservasi/`) untuk reservasi meja, tamu, denah, DP, dan Service Excellent
  (`deploy/service_excellent/`) untuk Google Review, feedback customer, reward, dan kelola role.
  Keduanya dibuka oleh **kunci akses yang berbeda** (`reservasi` dan `service_excellent`) dan
  dua kartu terpisah di launcher.
- Penggunanya luas: host/captain & marketing (input + follow-up), cashier & finance (verifikasi
  DP/Dana Masuk), manager/admin (Master Data, hak akses, audit), dan staff Service Excellent
  (review/feedback). Cashier dan panel Kas Kecil Finance **menyematkan** halaman Dana Masuk
  reservasi lewat `<iframe …?embed=finance>`.
- Yang paling berisiko saat migrasi: (1) **protokol muat berjendela** (`_fitur`/`_jendela`/`dikenal`)
  dan penjaga versi `baseVer` — salah port berarti menghapus ribuan reservasi; (2) **denah meja**
  (`venue-layouts.js` bersama + logika konflik/kunci H-1 jam/izin tumpang sekali-pakai); (3) **alur
  DP bertahap + bukti wajib + OCR** yang menentukan kwitansi; (4) **rumus reward Service Excellent**
  (tangga tertinggi, syarat minimum menang atas tangga); (5) **blob saveAll** yang di v1 pecah jadi
  CRUD per-baris + section per-section.
- Catatan: `ringkasTamu` (profil tamu Loyal/blacklist/auto-isi untuk mode berjendela) dan diagnostik
  `stats`/`ping` tidak punya padanan v1; paginasi sisi-server (`halRecap`/`halDana`/`halAudit`) dan
  `riwayat`/`ver` di v1 berbentuk lain (jendela + paging klien).

## A. Sumber
| jenis | path | baris |
|---|---|---|
| frontend lama (Reservasi) | `laksamana-office/deploy/reservasi/index.html` | 10.875 |
| frontend lama (Service Excellent) | `laksamana-office/deploy/service_excellent/index.html` | 9.589 |
| backend lama | `laksamana-office/reservasi-mysql/api.php` | 121 |
| backend lama (lib) | `laksamana-office/reservasi-mysql/lib_reservasi_mysql.php` | 37.299 B |
| backend lama (skema) | `laksamana-office/reservasi-mysql/schema.sql` | — |
| backend lama (README) | `laksamana-office/reservasi-mysql/README.md` | — |
| kontrak v1 | `laksamana-api/docs/api/reservasi.md` | 139 |
| spec port | `laksamana-api/docs/modules/reservasi.md` | 74 |
| rute v1 | `laksamana-api/app/Modules/Reservasi/routes/v1.php` | — |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:479-558` "Reservasi: polling tanya versi dulu…" | |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:1153-1248` "meja TIDAK lagi terkunci otomatis H-3 jam" | |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:1275-1450` "Dana Masuk: tab DP EVENT dari Marketing" | |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:1452-1552` "Disaring menurut TANGGAL ACARA, VIP ikut" | |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:1553-1757` "DP wajib berbukti & berekening" | |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:1874-2073` "Meja terkunci jadi KONFIRMASI" | |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:2339-2368` "Reservasi: bukti DP WAJIB" | |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:9749-9799` "kwitansi ditahan sampai dananya diverifikasi" | |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:11663-11703` "Service Excellent: papan Reward" | |
| aset bersama | `laksamana-office/deploy/assets/venue-layouts.js` | 7.562 B |
| aset bersama | `laksamana-office/deploy/assets/kwitansi-sheet.js` | 11.672 B |

`service_excellent` **tidak punya backend sendiri** — backend-nya `reservasi-mysql/` yang sama
(`laksamana-api/docs/modules/reservasi.md:7`). Tidak ditemukan folder `service_excellent-mysql/`
(TIDAK DITEMUKAN, dicari: `ls laksamana-office/*service* laksamana-office/*excellent*`).

## B. Akses
- **Kunci Modul di launcher**: `reservasi` (`laksamana-office/deploy/index.html:1133`, `access:['reservasi']`)
  dan `service_excellent` (`deploy/index.html:1139`, `access:['service_excellent']`) — **dua kartu terpisah**
  (`deploy/index.html:1133-1141`).
- **Guard SSO Reservasi** (`deploy/reservasi/index.html:18-42`): menerima `*`, `reservasi`, **atau**
  `?embed=finance` milik `cashier`/`finance` (baris 41). Tanpa embed, cashier/finance tidak membuka apa pun.
- **Guard SSO Service Excellent** (`deploy/service_excellent/index.html:13-17`): hanya `*` atau
  `service_excellent`. Guard kedua warisan Reservasi (`cashier`) sudah dihapus 6 Agustus 2026
  (`service_excellent/index.html:19-27`).
- **API URL** keduanya sama: `../reservasi-api-mysql/api.php`
  (`reservasi/index.html:914`, `service_excellent/index.html:843`). Identitas Office ditarik dari
  `../account-api-mysql/api.php` (`reservasi/index.html:919`, `service_excellent/index.html:848`).
- **Role/matriks Reservasi** (`reservasi/index.html`): `ROLE_NAV` 6 peran (`host`, `marketing`,
  `cashier`, `manager`, `viewer`, `admin`) di `:961-982`; `ROLE_LABEL` di `:958`; `CAN_DEFAULT`
  di `:985-998`; `ACTION_PAGE` di `:1013-1018`; baris izin EKSTRA `EXTRA_PERM_ROWS`
  (`inputDelete` "↳ Hapus Reservasi", `financeDelete` "↳ Hapus Catatan DP") di `:1021-1024`;
  `pagePerm()`/`canEdit()`/`pageAllowed()` di `:3523`,`:3532`,`:3621`; matriks View/Ubah
  `PERM_OPT`/`DEFAULT_PERMS` di `:1106-1130`.
- **Role/matriks Service Excellent** (`service_excellent/index.html`): **tiga tingkat** `staff`,
  `manager`, `admin` (bukan enam peran Reservasi) — `ROLE_LABEL` di `:894`, `roleSE()` memetakan
  peran database lama ke tingkat modul di `:899-904`; `ROLE_NAV` di `:916-921`; `CAN_DEFAULT` di
  `:929-943`; `ACTION_PAGE` di `:965-972`; baris EKSTRA `mintaReview`, `verifikasi`, `hapusCatatan`
  di `:984-993`; `DIVISI_REVIEW = ["kasir","cashier","host","floor"]` di `:7754`;
  `DIVISI_KRU = DIVISI_REVIEW + ["office"]` di `:7755`.
- **Aksi khusus admin**: Reservasi — `deleteReservation` manager/admin (`:988`), `master`/`audit`
  manager/admin (`:990-991`), `manageUsers` admin modul saja (`:992`), `deleteDp` **hanya admin**
  (`:997`). Service Excellent — `master`/`deleteReview`/`kelolaRole`/`manageUsers` manager/admin
  (`:937-940`).
- **Login**: pemilih kru + PIN default `1234`; 3× PIN salah → beku 1 menit (`MAX_FAILS=3`,
  `LOCK_MS=60*1000`) di `reservasi/index.html:933-941` & `service_excellent/index.html:862-870`.
- **Sesi disimpan di `sessionStorage` key `laksamana_session`** (`reservasi/index.html:936`);
  identitas Office di `localStorage` `lm_session` (`reservasi/index.html:16`, `service_excellent/index.html:13`).

## C. Daftar layar (dari NAV_DEF / TITLES)

Tidak ada konstanta `NAV_DEF`/`TITLES` di berkas ini; daftar menu berasal dari `NAV_SECTIONS`
(Reservasi `:1061-1089`, Service Excellent `:1049-1064`) dan `ROLE_NAV`.

### C.1 Panel Reservasi (`deploy/reservasi`, kunci `reservasi`)
| key | judul | subjudul | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| dashboard | Dashboard & Recap | "Satu halaman: data reservasi, denah meja, dan antrean. Klik meja untuk aksi cepat." | host, marketing, cashier, manager, viewer, admin | tidak | `:1074`, `:5367-5368` |
| input | Input Reservasi | "Isi data tamu. Field bertanda * wajib diisi. Target: selesai < 2 menit." | host, marketing, manager, admin | tidak | `:1075`, `:4330-4331` |
| finance | Dana Masuk (DP) | "Cek uang DP yang benar-benar masuk…" | cashier, manager, admin (+ cashier/finance via embed) | tidak | `:1078`, `:9411-9413` |
| riwayat | Riwayat | "Arsip reservasi yang sudah lewat, basis CRM dan evaluasi…" | host, marketing, cashier, manager, viewer, admin | tidak | `:1081`, `:10156` |
| analitik | Analitik | "Insight bisnis dari seluruh data reservasi…" | host, marketing, manager, viewer, admin | tidak | `:1082`, `:10464` |
| master | Master Data | "Kelola pilihan dropdown & pengaturan sistem." | manager, admin | tidak | `:1086`, `:10524` |
| audit | Audit Log | "Jejak seluruh aktivitas: siapa, kapan, apa yang diubah…" | manager, admin | tidak | `:1087`, `:10773` |
| review | _(halaman dihapus)_ | — | muncul di `ROLE_NAV` tapi **tidak ada di NAV_SECTIONS**; mesinnya pindah ke Service Excellent | ya (hantu) | `ROLE_NAV :962-981`; `:10501-10514` |
| hariH | _(alias)_ | dialihkan ke `dashboard` (HARIH_VIEW='map') | — | alias | `:3851-3855`, `:1070-1072` |

### C.2 Panel Service Excellent (`deploy/service_excellent`, kunci `service_excellent`)
| key | judul | subjudul | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| capaian | Dashboard | "Pencapaian Tim" + papan Reward | staff, manager, admin | tidak | `:1051`, `:9437` |
| review | Google Review | "Ajakan review ke tamu, klaim, dan verifikasinya." | staff, manager, admin | tidak | `:1052`, `:8717` |
| feedback | Catat Feedback | "Pujian & keluhan tamu, dikategorikan per divisi." | staff, manager, admin | tidak | `:1053`, `:8724` |
| peran | Kelola Role | "Kelola Role — Service Excellent" | manager, admin | tidak | `:1056`, `:9233` |
| setelan | Setelan | "Link Google Review, saklar ajakan WhatsApp, dan reward. Cukup diisi sekali." | manager, admin | tidak | `:1062`, `:8851-8853` |

Catatan: Service Excellent **menyalin utuh mesin Reservasi** (renderDashboard, renderRiwayat,
renderAnalitik, renderMaster, renderFinance, renderInput, renderCrew…) tetapi halaman itu
**tidak dapat dicapai** — tidak ada di `NAV`, tidak ada cabang di `navigate()`, dan
`allowedPages()` hanya memilih dari `NAV_PAGES` (`service_excellent/index.html:1039-1048`).
Jadi layar Reservasi yang disalin ke SE bukan layar untuk dimigrasi.

## D. Detail per layar

### D.1 dashboard — Dashboard & Recap
- **Tampilan:** 6 kartu ringkasan (bukan 11): `📋 Total Reservasi`, `👥 Pax Datang / Dipesan`,
  `🪑 Kapasitas Terisi`, `💰 Sudah DP`, `📞 Perlu Follow Up`, `🧍 Waiting List`
  (`:5380-5391`). Empat tab: `📋 Tabel`, `🗓️ Kalender`, `🗺️ Denah Meja`, `⏳ Waiting List (n)`
  (`:5394-5399`). Pencarian `Cari nama tamu, nomor HP, atau meja…` (`:5402`).
- **Filter / cari / urut / pager:** Periode (Harian/Bulanan/Tahunan/Rentang/Semua), Tanggal,
  Bulan, Tahun, Dari, Sampai, `🗺️ Tanggal Denah`, Jam Dari, Jam Sampai, Status, Jenis Reservasi,
  Lantai, Sisa Kursi, DP, PIC, Tipe Tamu (`:5424-5455`). Pills: Hari Ini/Besok/Lusa/7 Hari/Bulan
  Ini/`✕ Reset Filter` (`:5458-5463`). Tabel berhalaman (10/25/50, selalu tampil) — `tblPage`/
  `tblPageSrv` (`CLAUDE.md:546-558`). Klik header kolom untuk urut (delegasi global `:10830-10842`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | 📋 WA Koordinasi | modal koordinasi WA | getAll/saveAll (klien) | — (klien) | `:5370`,`:7711` |
  | ➕ Reservasi | `newReservation()` → halaman input | — | — | `:5371` |
  | ⚙️ Layout: … / ✏️ Editor Denah: … | override layout per tanggal / editor denah | saveAll (master.layouts) | `PUT /master/layouts`,`/master/layoutOverrides` | `:5406-5416` |
  | Per-meja (denah) | buka aksi cepat: check-in, pindah meja, walk-in, waiting list | saveAll | `PUT/PATCH /reservations/{id}` | `:2045-2242` |
- **Form & field:** tidak ada form tetap; modal-modal dari denah/waiting list.
- **Perhitungan di browser:** `totalPax` = Σ `pax` baris non-No-show (`:5339`); `paxDatang` = Σ
  `arrivedPax(r)` untuk status "Datang" (`:5340`); `dpYes` = jumlah `dpStatus==="Sudah"` (`:5341`);
  `pctKap` = `Math.round(paxTgl/kap.pax*100)` (`:5355`); `kap` = `kapasitasTanggal(HARIH_DATE)`
  (`:5351`). `arrivedPax(r)` = Σ `arrivals[].pax` atau `actualPax` (`:1373`).
- **Real-time / polling:** `pollRemote()` menarik `ver` dulu, `getAll` hanya bila `ver` berubah;
  hanya saat denah terlihat; `POLL_JEDA=15000` ms (`:3089-3156`). Timer count-up tiap detik
  (`updateSeatTimers`, `:10314-10325`). Bukti meja juga dicek ulang server sebelum simpan
  (`mejaMasihKosong`, `:4637`).

### D.2 input — Input Reservasi
- **Tampilan:** form satu halaman + denah pilih meja (`#seatMap`) + legenda 6 status meja
  (`:4399-4407`). Judul `Input Reservasi Baru` / `Edit Reservasi` (`:4330`).
- **Filter / cari / urut / pager:** tidak ada (form).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | 💾 Simpan Reservasi / 💾 Simpan Perubahan | validasi → cek meja server → simpan | saveAll (+getAll cek meja) | `POST /reservations`, `PUT/PATCH /reservations/{id}` | `:4497`,`:4705-4965` |
  | 🗑️ Hapus Reservasi | hapus (hanya di mode edit, `CAN.deleteReservation`) | saveAll | `DELETE /reservations/{id}` | `:4493-4494`,`:8469` |
  | Batal / ← Batal | kembali ke dashboard | — | — | `:4332`,`:4496` |
  | Weekday / Weekend / Lantai 2 | ganti layout denah | — (master.layouts) | — | `:4391-4393` |
  | Samakan dengan Jumlah Pax | siapkan koreksi gelombang kedatangan | saveAll | `PATCH /reservations/{id}` | `:4689-4703` |
- **Form & field:**
  | field (nama data) | label UI | tipe | wajib | default / pilihan | validasi & pesan |
  |---|---|---|---|---|---|
  | name | Nama Tamu * | text + datalist `guestNames` | ya | — | "Lengkapi field wajib: Nama Tamu" (`:4708-4710`) |
  | phone | No. HP / WhatsApp * | text numeric + datalist `guestPhones` | ya | — | idem |
  | date | Tanggal Reservasi * | date picker sendiri | ya | `todayStr()`; min hari ini (kecuali edit lama) | "Tanggal reservasi tidak boleh sebelum hari ini" (`:4718-4721`) |
  | time | Jam Datang * | time picker 24 jam, step 5 | ya | `00:00` | "Jam Datang tidak valid — pakai format 24 jam, mis. 19:00" (`:4712-4715`) |
  | pax | Jumlah Pax * | number min 1 | ya | — | "Lengkapi field wajib: Jumlah Pax" |
  | category | Jenis Reservasi * | select | ya | dari `master.categories` (`Tamu Umum` fallback) | — |
  | foodReq | Menu Makanan Request | text | tidak | — | — |
  | drinkReq | Menu Minuman Request | text | tidak | — | — |
  | table | Posisi Duduk / Meja * | hidden + denah | ya | — | "Meja wajib dipilih — klik meja pada denah" (`:4723-4727`) |
  | sharing | 🤝 Sharing table | checkbox | tidak | unchecked | `:4396` |
  | dpStatus | Status DP * | radio `Sudah`/`Belum` | ya | `Belum` bila baru | `:4414-4417` |
  | lunas | 💯 Lunas (bayar penuh) | checkbox | tidak | unchecked; hanya bila DP Sudah | kwitansi jadi `PELUNASAN` (`:4423-4424`) |
  | dpMethod | Metode / Tujuan Pembayaran | select | (ditampilkan bila DP Sudah) | dari `master.dpMethods`, default `dpMethodDefault()` | `:4429-4431` |
  | dpAmount | Nominal DP * | text rupiah (`fmtRupiahInput`) | **ya bila DP Sudah & belum ada** | — | "DP sudah masuk tapi nominal DP & bukti transfer belum diisi — dua-duanya wajib" (`:4783-4813`) |
  | dpProof | Upload Bukti DP (foto/pdf) * | file (≤5MB) | **ya bila DP Sudah & belum ada** | — | idem; "File terlalu besar (maks 5MB)" (`:4513`) |
  | source | Sumber Informasi (Tau dari mana) | select | tidak | dari `master.infoSources` | `:4454` |
  | picName | PIC Penanganan | hidden | ya | otomatis `SESSION.name` | `:4458-4461` |
  | picType | (hidden) | hidden | ya | `Marketing` bila role marketing, else `Host/Captain` | `:4460` |
  | member | Status Member | radio `ya`/`tidak` | tidak | `tidak` | `:4466-4467` |
  | memberNo | No. Member | text | tidak | — | `:4472` |
  | docReq | Upload Dokumen Special Request | file (opsional) | tidak | — | `:4476` |
  | notes | Catatan Khusus / Special Notes | textarea | tidak | — | `:4481` |
- **Perhitungan di browser:** `status` baru = `dpStatus==="Sudah" ? "Confirmed" : "Pending"` (`:4869`);
  `dps[0].amount = rupiahVal(dpAmount)`, `dps[0].method = dpMethod` (`:4915-4924`); `normPhone()`
  menormalkan ke `62…` (`:3295`); `checkBigEvent`: `pax >= 20` → "Butuh approval manajer" (`:4628`).
- **Real-time / polling:** `checkConflict()` merender ulang denah saat tanggal/jam/meja/sharing berubah
  (`:4609-4617`); `onDateChange()` ganti layout mengikuti tanggal (`:4618-4625`).
- **Catatan:** `mejaMasihKosong()` memasang overlay yang **harus** ditutup pemanggil — penjaga DP
  sengaja ditaruh di atasnya (`:4729-4746`). `izinTumpang` (izin pakai meja terkunci) harus ikut
  tersimpan di record (`:4886-4893`).

### D.3 finance — Dana Masuk (DP)
- **Tampilan:** saklar sumber `🍽️ DP Reservasi` / `🎉 DP Event (Marketing)` (`FIN_SUMBER`,
  `:9358` + `finSumberHTML()`); 6 kartu: `💰 Total Dana Masuk`, `✓ Total Terverifikasi`,
  `⏳ Total Belum Terverifikasi`, `⚠️ Dana Tidak Sama`, `📎 Tanpa Bukti`, `✕ Ditolak`
  (`:9428-9436`); rekap per Bank/Metode (`:9482-9485`); 3 tab `⏳ Perlu Diverifikasi`,
  `✓ Terverifikasi`, `✕ Ditolak` (`:9490-9492`).
- **Filter / cari / urut / pager:** `Saring tanggal menurut` = `📅 Tgl Reservasi` / `💸 Tgl Uang
  Masuk` (`:9451-9455`); Dari/Sampai; Bank; Saring (Bukti belum discan / Dana tidak sama);
  `Cari` (nama/no HP/bank); pills Hari Ini/7 Hari/Bulan Ini/Semua (`:9456-9474`). Tabel berhalaman
  server (`halDana`, `:9364`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | 🧹 Hapus Data Demo (n) | hapus 8 reservasi contoh (admin) | saveAll | `DELETE /reservations/{id}` | `:9415`,`:10809-10827` |
  | 🔍 Ulangi Scan (n) / 🔍 Scan | OCR bukti (tesseract.js) | saveAll | `PATCH /reservations/{id}` | `:9416`,`:9697` |
  | ⬇️ Export CSV | ekspor transaksi | klien | — | `:9417`,`:9976` |
  | ✏️ Cek / Edit | modal koreksi data transfer | saveAll | `PATCH /reservations/{id}` | `:9541`,`:9751` |
  | ✓ Verifikasi | tandai `tfStatus="verified"` | saveAll | `PATCH /reservations/{id}` | `:9542`,`:9894` |
  | ✕ Tolak | tandai `tfStatus="rejected"` | saveAll | `PATCH /reservations/{id}` | `:9543`,`:9963` |
  | 🗑️ | hapus satu catatan DP (admin) | saveAll | `PATCH /reservations/{id}` | `:9544`,`:8037` |
  | Betulkan | koreksi tanggal/jam dari nomor ref | saveAll | `PATCH /reservations/{id}` | `:9516`,`:9523` |
- **Form & field:** modal `Cek / Edit` (tanggal TF, jam, bank, nama pengirim, nominal, status,
  catatan); `Tambah Bukti TF DP` (`openAddDp`, `:7977-8005`) — `Nominal DP *`, `Metode / Tujuan
  Transfer`, `Upload Bukti Transfer (foto/pdf) *` (wajib **tanpa pengecualian**, `:8011-8018`).
- **Perhitungan di browser:** `total` = Σ `txAmount` kecuali `tfStatus==="rejected"` (`:9369`);
  `verified`/`rejected`/`belum` dari `tfStatus` (`:9370-9372`); `unscanned` = belum discan &
  bukti gambar (`:9373`); `noProof` (`:9374`); `mism` = `txMismatch` (`:9375`); `cicilan` =
  `x.dari>1` (`:9376`); `perBank` = Σ per `txBank(x)` (`:9389-9391`).
- **Real-time / polling:** `autoScanFinance()` memindai bukti otomatis saat halaman dibuka
  (`setTimeout(…,60)`, `:9549-9584`). OCR **adalah saran** (`tfOcrSaran`), bukan isian —
  `applyOcr()` (`:9637-9643`).
- **Catatan:** mode embed (`EMBED`) memaksa `CURRENT_PAGE='finance'` (`:3771`). `x` = `{r, p, ke, dari}`;
  satu baris = satu kali transfer (`dps[]`).

### D.4 riwayat — Riwayat
- **Tampilan:** kartu CRM bila ada hasil cari (`crmCard`, `:10181-10193`); tabel arsip kolom
  `Tanggal, Tamu, Pax, Meja, Durasi, DP, Status` (`:10134`).
- **Filter:** `Cari Pelanggan` (nama/no HP), Periode (Semua/Bulanan/Tahunan), Status Akhir
  (Datang/No-show/Cancelled) (`:10158-10162`). Pager sisi-server (`riwayat`, `:10041`).
- **Aksi:** `⬇️ Export CSV` (`riwEkspor`, `:10133`,`:10068`); baris diklik → `openDetail` (`:10169`).
- **Perhitungan:** `dineDuration(r)` = `(leftAt-checkinAt)/60000` (`:10208-10211`);
  `arrivalLateness` (`:10198-10203`); `PUNCTUAL_TOL=10` menit (`:10205`).
- **Catatan:** jalur cadangan `renderRiwayatLokal()` (`:10145-10179`) dipakai bila server tak
  mengenal `?action=riwayat` (`RIW_TAK_ADA`).

### D.5 analitik — Analitik
- **Tampilan:** panel `📊 Performa Harian/Bulanan` (`dailyPerfPanel`, `:10349-10428`) dengan kartu
  Kehadiran, Tepat Waktu, Rata² Durasi Duduk, Realisasi Pax, No-show, Walk-in, Hari Tersibuk;
  bar chart Tren Harian, Ketepatan Kedatangan, Durasi Duduk Terlama (`:10416-10425`). Bagian
  `📈 Ringkasan Keseluruhan`: Total Reservasi, Total Pax, Rata-rata Pax, Rasio No-show, Pelanggan
  Unik (`:10467-10473`); chart `📣 Sumber Reservasi Terefektif`, `🧭 Performa PIC`,
  `🕗 Jam Paling Ramai (Peak Hour)`, `📅 Hari Paling Ramai`, `📈 Tren Reservasi per Bulan`
  (`:10474-10482`).
- **Filter:** Harian/Bulanan + tanggal/bulan (`:10396-10399`).
- **Perhitungan di browser:** `attend = bookedArrived/expected*100` (`:10364`);
  `puncRate` (`:10369`); `avgDur` (`:10373`); `paxReal = paxActual/paxBooked*100` (`:10378`);
  peak hour & hari memakai **jumlah pax**, bukan jumlah baris (`:10440-10451`); `nsRatio` (`:10458`).
- **Aksi:** tidak ada (read-only). `[DUGAAN]` tidak ada ekspor PDF.

### D.6 master — Master Data
- **Tampilan:** `⏱️ Estimasi Lama Tamu Duduk` (input + pills 90/120/150/180/240/300 menit,
  `:10526-10538`); blok daftar `🏷️ Jenis Reservasi (Tag)` (`categories`), `💳 Metode DP`
  (`dpMethods`), `📣 Sumber Informasi` (`infoSources`), `💬 Tujuan WhatsApp` (`waTargets`)
  (`:10539-10544`); blok `⚓ Role Kru` + `🔑 Hak Akses per Role` bila `CAN.manageUsers`
  (`userAccessBlock`, `:10560-10626`).
- **Aksi:** `💾 Simpan` (dineEst, min 30 mnt), `+ Tambah` / `×` per tag, `✎ Atur Role`,
  `↺ Default`, `💾 Simpan Hak Akses`, `🛠️ Data & Backup` → `⬇️ Backup Semua Data (JSON)`,
  `⬆️ Restore dari Backup`, `🗑️ Hapus Semua Data` (`:10692-10706`).
- **Form & field:** `Lama duduk (menit)` number min 30 (`:10528-10529`); dropdown role per kru
  (`openUserForm`, `:10627-10644`).
- **Validasi:** "Estimasi lama duduk minimal 30 menit" (`:10550`); restore: "File backup tidak valid"
  (`:10705`); wipe: dua `confirm()` (`:10706`).
- **Catatan:** matriks izin 3 keadaan (0 Tak Terlihat / 1 Lihat / 2 Boleh Ubah); `viewer` dijepit
  maksimum Lihat (`:10593`,`:10682`).

### D.7 audit — Audit Log
- **Tampilan:** tabel kolom `Waktu, User, Role, Aksi, Detail` (`:10788`), hanya 500 baris terakhir
  (`:10784`).
- **Filter:** `Cari nama tamu, kru, aksi, atau keterangan…` (`auditCocok`, `:10717-10721`);
  pager server (`halAudit`, `:10771`).
- **Aksi:** aksi yang membawa `res` diklik → `bukaDariAudit` (buka detail reservasi, `:10737-10753`).
- **Catatan:** `logAudit(action, detail, resId)` (`:3209`); reservasi menyimpan `log[]` 20 entri
  terakhir (`tempelLogRes`, `:3220`).

### D.8 capaian — Dashboard (Service Excellent)
- **Tampilan:** `📈 Pencapaian Tim` + progress bar tim + 7 kartu: Diminta, Perlu Verifikasi,
  Terverifikasi, Ditolak, Cakupan Tamu, Feedback, Total Reward (`:9460-9472`); `🏅 Reward Review`
  (4 kartu + tabel tangga: Tangga/Bonus/Sudah Sampai/Sedang Menuju/Subtotal, `rewardPapanHtml`,
  `:7664-7714`); `👥 Perolehan per Kru` tabel kolom `Kru, Diminta, Diklaim, Terverifikasi, Ditolak,
  Feedback, Target, Capaian, Reward` (`:9483`).
- **Filter:** chips `Harian/Mingguan/Bulanan` (`setReviewMode`, `:9449-9453`).
- **Aksi:** `🎯 Atur Target` → modal `Atur Target per Nama` (input per host, `:8634-8678`).
- **Perhitungan:** `pctTim = min(100, round(sah/targetTim*100))` (`:9392`);
  `targetTim = Σ reviewCfg().targets` (`:7808-7810`); reward `rewardOf(sah)` (`:7614-7627`).
  Baris **Office & admin dikeluarkan** dari papan (`keluarDariPapan`, `:9376-9379`), jumlahnya
  disebut di bawah tabel (`:9505-9509`).
- **Real-time:** roster Office ditarik sekali `listDivisiRoster` lalu render ulang (`:9278-9289`,`:9383`).

### D.9 review — Google Review
- **Tampilan:** kepala periode (`kepalaPeriode`, `:8685-8704`); panel `📤 Tamu Belum Diminta Review`
  (tabel `Tanggal, Jam, Tamu, Pax, Meja, Aksi`; 3 kartu Belum Diminta/Sudah Diminta/Cakupan,
  `:8782-8819`); panel `📋 Daftar Review [Saya]` (tabel `Tamu, Nama Akun Google, Tanggal, Status,
  Nama, Aksi`, `:8832-8835`).
- **Filter:** pencarian terpisah per panel (`rvSearchHtml`); chips periode.
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | 📋 Salin Link Review | salin link ke clipboard | — | — | `:8718`,`:8262` |
  | ⭐ Catat Review | modal klaim review | saveAll | `PUT /master/reviews`, `PUT /files/rv:<id>` | `:8719`,`:8012` |
  | ⭐ Minta Review | kirim WA + buat catatan `diminta` | saveAll | `PUT /master/reviews`, `POST /audit` | `:8811`,`:7972` |
  | ✅ Verifikasi | sahkan klaim (wajib Foto 2) | saveAll | `PUT /master/reviews/{id}` | `:8770`,`:8145` |
  | ✖ | tolak klaim + alasan | saveAll | `PUT /master/reviews/{id}` | `:8771`,`:8156` |
  | ✏️ | catat/perbarui klaim | saveAll | `PUT /master/reviews/{id}` | `:8772` |
  | 🗑️ | hapus catatan review | saveAll | `DELETE /master/reviews/{id}` | `:8773`,`:8164` |
  | 🖼️ | lihat bukti | getFile | `GET /files/rv:<id>` | `:8769`,`:8172` |
- **Form & field (`⭐ Catat Google Review`):** `Nama Tamu *`, `No. WhatsApp`, `Nama Akun Google
  (reviewer) *`, `No. Meja / Bill (opsional)`, `Tanggal Review`, `1) Screenshot review tamu *`
  (`rv_proof`), `2) Bukti poin bertambah (menyusul)` (`rv_proof2`); host otomatis = yang login
  (`:8031-8078`).
- **Validasi & pesan:** "Nama tamu wajib diisi" (`:8085`); "Nama akun Google (reviewer) wajib
  diisi — ini kunci verifikasinya" (`:8086`); "Foto 1 (screenshot review tamu) wajib dilampirkan"
  (`:8096`); klaim ganda: "Akun Google … sudah pernah diklaim…" / "Nomor HP ini sudah pernah
  mengklaim review…" (`:8117-8122`); verifikasi tanpa Foto 2: "Belum bisa diverifikasi — Foto 2
  (bukti poin bertambah) belum dilampirkan…" (`:8150`).
- **Perhitungan:** `reviewRange()` harian/mingguan(Senin–Minggu)/bulanan (`:7862-7875`);
  hanya `status==="terverifikasi"` dihitung ke target (`:7829-7834`, `:8615-8618`).
- **Catatan:** review `diminta` WAJIB punya link (`:7990`); saklar WA global `waAktif` (`:7718`).

### D.10 feedback — Catat Feedback
- **Tampilan:** `📊 Rekap Tanggapan` (5 kartu: Total Feedback, Baru, Diproses, Selesai, Paling
  Sering + bar chart per kategori, `:8561-8570`); `📋 Daftar Feedback` tabel `Tamu, Kategori,
  Catatan & Tindakan, Tanggal, Status, Dicatat Oleh, Aksi` (`:8600`).
- **Filter:** chips Status (Semua/Baru/Diproses/Selesai) & Kategori (7 divisi) (`:8587-8597`);
  pencarian nama/no HP/isi catatan (`:8523-8527`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | ➕ Catat Feedback | modal feedback | saveAll | `PUT /master/feedbacks`, `PUT /files/fb:<id>` | `:8725`,`:8343` |
  | ➕ Tambah Catatan | tambah baris keluhan | — | — | `:8378` |
  | 💾 Simpan Feedback | simpan (dengan status) | saveAll | `PUT /master/feedbacks/{id}` | `:8406`,`:8414` |
  | 🔧 Proses | status → proses | saveAll | `PUT /master/feedbacks/{id}` | `:8548`,`:8462` |
  | ✅ Selesai | status → selesai + tindakan | saveAll | `PUT /master/feedbacks/{id}` | `:8549` |
  | 💬 | WA minta maaf/tindak lanjut | — | — | `:8547`,`:8487` |
  | 🖼️ | lihat foto bukti | getFile | `GET /files/fb:<id>` | `:8546` |
  | ✏️ | ubah | — | — | `:8550` |
  | 🗑️ | hapus feedback | saveAll | `DELETE /master/feedbacks/{id}` | `:8551`,`:8475` |
- **Form & field:** `Sifat Tanggapan` (`negatif`/`positif`), `Nama Tamu *`, `No. WhatsApp`,
  `Tanggal Kejadian`, `Foto Bukti (opsional)`, per-item `Kategori / Divisi *`, `Sebutkan
  kategorinya *` (bila `other`), `Isi Keluhan *`, `Status Penanganan`
  (`baru`/`proses`/`selesai`), `Tindakan yang Dilakukan` (`:8360-8402`).
- **Kategori (`FB_CATS`):** `bar` Bar, `kitchen` Kitchen, `floor` Floor, `kasir` Kasir,
  `hygiene` Hygiene, `system` System, `other` Other (`:8275-8283`).
- **Validasi:** "Nama tamu wajib diisi" (`:8418`); "Isi catatannya minimal satu" (`:8422`);
  'Kategori "Other" harus disebutkan namanya' (`:8424`).

### D.11 peran — Kelola Role
- **Tampilan:** `🛡️ Kelola Role — Service Excellent` (jumlah kru, `:9233`); daftar kru (urutan
  pengurus dulu) dengan `divisi` + tingkat; peringatan bila belum ada Manajer/Admin (`:9239-9242`);
  `userAccessBlock(bolehUbah)` berisi `⚓ Role Kru` + `🔑 Hak Akses per Role` (`:8952-9010`).
- **Filter:** tabel kru berpaginasi (`tblPage("kru")`, `:8965`).
- **Aksi:** ubah tingkat per kru (`setKruRole`, `:9062`); `↺ Default`, `💾 Simpan Hak Akses`
  (`savePerms`, `:9147`); sel matriks siklus 0/1/2 (`cyclePerm`).
- **Hak akses di dalam modul:** `pageAllowed("peran")` = boleh melihat; `CAN.kelolaRole` = boleh
  mengubah (`:9219-9224`).
- **Catatan:** bila `seCrew()` belum memuat Manajer/Admin, **semua orang masuk sebagai Admin
  Sistem** sampai satu orang ditetapkan (`:9225-9242`).

### D.12 setelan — Setelan
- **Tampilan:** `⚙️ Setelan` — `Link Google Review`, checkbox `Izinkan kru meminta review lewat
  WhatsApp`, blok `🏅 Reward Review` (`Minimal review untuk ikut program` + tangga
  `Jumlah review`/`Bonus (Rp)`), `➕ Tambah Tangga`, `💾 Simpan Setelan` (`:8850-8897`).
- **Form & field:** `rvcfg_link` (url), `rvcfg_wa` (checkbox), `rvcfg_rw_min` (number min 0),
  `rvcfg_tiers` (baris `data-tier-rv`/`data-tier-bonus`) (`:8860-8891`).
- **Aksi:** `➕ Tambah Tangga` (`rvTierTambah`), `✕` hapus tangga (`rvTierHapus`), `💾 Simpan Setelan`
  (`saveReviewCfg`, `:8215-8241`).
- **Perhitungan:** `normalisasiReward()` membuang tangga `rv<=0` dan mengurutkan naik
  (`:7594-7608`).
- **Catatan:** target tim **tidak** diatur di sini lagi — otomatis dari jumlah target host
  (`:8236-8237`); bila `!canCfg` panel menampilkan "Setelan diatur oleh manager." (`:8895`).

## E. Pemetaan backend

Aksi backend lama dari `laksamana-office/reservasi-mysql/api.php:48-118`; pemakaian frontend
diverifikasi dengan grep `apiGet(`/`apiPost(`/`apiGetPoll(`.

| action lama | dipakai di layar | baca/tulis | endpoint v1 | status ✅/⚠️/❌ | catatan |
|---|---|---|---|---|---|
| `getAll` | dashboard, input, finance, riwayat, analitik, master, audit | baca | `GET /api/v1/reservasi/reservations?from&to` + `GET /master` | ✅ | legacy mendukung `?dari=&sampai=` + `_fitur:['jendela','dikenal','ringkasTamu']` (`api.php:49-66`); v1 memakai `from`/`to` + `meta.total/meta.ver` (`docs/api/reservasi.md:117`) |
| `getFile` | finance/DP, review, feedback (bukti) | baca | `GET /api/v1/reservasi/files/{key}` | ✅ | key `r:<id>:dp`, `r:<id>:doc`, `p:<resId>:<dpId>`, `rv:<id>`, `rv2:<id>`, `fb:<id>` (`docs/api/reservasi.md:95-102`) |
| `saveAll` | SEMUA layar tulis | tulis | `POST/PUT/PATCH/DELETE /reservations/{id}`; `PUT/PATCH/DELETE /master/{section}[/{id}]`; `POST /audit` | ⚠️ | blob utuh (reservations+master+audit) → CRUD per-baris + section per-section. `baseVer` → `If-Match`/`?version=`; `dikenal` → `DELETE /reservations/{id}` per baris; `APP_LAWAS` → `428 version_required` (`docs/api/reservasi.md:105-111`,`:130-139`; lib `save_all` `:253-408`) |
| `putFile` | — (tidak dipanggil frontend; foto ditulis via `saveAll`) | tulis | `PUT /api/v1/reservasi/files/{key}` | ✅ | `docs/api/reservasi.md:103` |
| `ver` | polling denah (`:3122`) | baca | (tidak ada endpoint khusus; `meta.ver` dari `GET /reservations`) | ⚠️ | legacy hanya `read_ver()` 1 SELECT (`api.php:68-72`); v1 tak punya endpoint versi-saja — polling harus menarik seluruh jendela |
| `riwayat` | riwayat (`:10041`, `ekspor:1` `:10070`) | baca | `GET /reservations` (saring klien) | ⚠️ | legacy saring+urut+`LIMIT` di SQL + `&ekspor=1` untuk CSV (`api.php:74-76`, `CLAUDE.md:526-544`); v1 hanya daftar per rentang, tanpa paging/ekspor server |
| `ringkasTamu` | autofill tamu & profil di input (`:2771`) | baca | — | ❌ | ringkasan Loyal/blacklist/auto-isi **lintas seluruh riwayat** (`api.php:85-87`, `lib:713-748`); di mode berjendela tak bisa dihitung klien — GAP |
| `halRecap` | dashboard tabel (`:5330`) | baca | `GET /reservations?from&to` | ⚠️ | legacy memulangkan `{rows,total,hal,maxHal,per}` dari SQL (`SRVPG`, `:5205-5261`); v1 tak punya paging server |
| `halDana` | finance (`:9364`) | baca | `GET /reservations?from&to` | ⚠️ | legacy memulangkan baris-turunan per transfer (bank, mismatch, status); data sama ada di `dps[]`, dirakit klien |
| `halAudit` | audit (`:10771`) | baca | `GET /audit` | ⚠️ | legacy berhalaman; v1 `GET /audit` memulangkan 500 terbaru sekaligus (`docs/api/reservasi.md:68`,`:126`) |
| `stats` | — (diagnostik; tidak dipanggil frontend) | baca | — | ❌ | `api.php:94-95`, `lib:749+`; bukan fitur layar |
| `ping` | — (diagnostik; tidak dipanggil frontend) | baca | — | ❌ | `api.php:97-98`; bukan fitur layar |
| (Office `listModuleRoster`) | Reservasi `autoSyncOfficeRoster` (`:3584`) | baca | `GET /api/v1/account/modules/reservasi/members` | ✅ | `account/routes/v1.php:18`; identitas Office, bukan API modul |
| (Office `listDivisiRoster`) | SE `muatRosterTim` (`:9282`) | baca | `GET /api/v1/account/roster` | ✅ | `account/routes/v1.php:17` |

**Konkurensi:** legacy `saveAll` memakai `baseVer` (nomor `_ver` global) + `flock` + NamedLock;
satu tulisan yang kalah memulangkan `{conflict:true}` (`docs/modules/reservasi.md:45,52-55`).
v1 memakai `version` per reservasi (= `updatedAt` ms) lewat `If-Match`/`?version=`, section
memakai content-hash version, dan setiap tulis v1 tetap menaikkan `_ver` global
(`docs/api/reservasi.md:105-111`). **Mode berjendela** legacy menuntut `_fitur` sebelum klien
boleh beralih (kalau tidak, `getAll` penuh) dan `saveAll` selalu membawa `dikenal`
(`_:2545-2660`).

**Kode error yang wajib ditangani UI:** v1 `401 unauthenticated`, `403 module_not_granted`,
`404 not_found`, `409 already_exists`/`version_conflict` (`details.current`), `422 validation_failed`/
`invalid_request`, `428 version_required` (`docs/api/reservasi.md:130-139`). Legacy: `{ok:false,error}`
HTTP 200 + `APP_LAWAS` (klien terlalu tua) + `conflict:true` (`docs/modules/reservasi.md:33-45`).

## F. Aturan bisnis yang wajib dibawa
1. **Bukti DP wajib** — kenapa: DP tanpa lampiran tak bisa dicocokkan dengan mutasi bank — bukti:
   `CLAUDE.md:2339-2364`; kode `:4749-4813`.
2. **Nominal DP wajib (ikut)** — kenapa: Rp0 di Dana Masuk terbaca sebagai transfer gagal dibaca —
   bukti: `CLAUDE.md:1673-1688`; kode `:4433-4441`.
3. **Reservasi lama yang terlanjur tanpa bukti/nominal TIDAK dikunci**, cuma ditanya sekali via
   `confirm()` — bukti: `:4805-4812`, `CLAUDE.md:2354-2357`.
4. **Modal Tambah DP wajib bukti TANPA pengecualian** — bukti: `:8011-8018`, `CLAUDE.md:2359-2361`.
5. **Meja terkunci bertingkat:** tamu sedang duduk → tidak pernah; jarak ≤ `MEPET_MIN` (60 mnt) →
   terkunci sendiri; >60 mnt dalam H±3 jam → boleh lewat konfirmasi; di luar jendela → bebas —
   bukti: `CLAUDE.md:1886-2056`, kode `MEPET_MIN=60` `:1351`, `LOCK_LEAD_MIN=180` `:1328`.
6. **Izin tumpang sekali pakai & terikat meja+tanggal+jam** (`izinTumpang`), dan **wajib sampai ke
   penggabung data** — bukti: `CLAUDE.md:1963-1988`; kode `:4886-4893`.
7. **Ambang menjual kursi = `TUMPANG_MEPET_MIN=120` mnt**, beda dari ambang denah 60 mnt — bukti:
   `:3974`, `CLAUDE.md:1990-1997`.
8. **Walk-in hanya dihalangi tamu yang sedang duduk / ≤60 mnt** — bukti: `CLAUDE.md:1165-1198`;
   `opsi.walkin`.
9. **Tutup otomatis 04:00 DIMATIKAN** (26 Sep 2026) — `AUTO_TUTUP_AKTIF=false` — bukti:
   `:10252-10285`.
10. **Kwitansi ditahan sampai SEMUA DP terverifikasi** (termasuk `rejected` menahan) — bukti:
    `CLAUDE.md:9749-9789`; kode `kwiTertahan` `:7142`, `mintaKwitansi` `:7224-7229`.
11. **DP reservasi vs DP Event dipisah** (tidak boleh dijumlahkan); tab DP Event **read-only** &
    VIP ikut dengan penanda `resId` "jangan dihitung dua kali" — bukti: `CLAUDE.md:1275-1317`,
    `:1484-1512`; kode `FIN_SUMBER` `:9358`.
12. **Reward: dibayar SATU tangga tertinggi, syarat minimum menang atas tangga** — bukti:
    `CLAUDE.md:11663-11693`; kode `rewardOf` `:7614-7627`.
13. **Target review per NAMA, target tim = jumlah target host** — bukti: `:7802-7810`; form
    `:8634-8678`.
14. **Hanya review `terverifikasi` dihitung ke target**; klaim `diklaim` belum — bukti:
    `:8615-8621`.
15. **Foto 2 (bukti poin bertambah) wajib sebelum verifikasi** — bukti: `:8148-8150`.
16. **Satu akun Google = satu review; satu nomor HP = satu klaim** (penjaga klaim ganda) — bukti:
    `:8098-8123`.
17. **Papan capaian menyembunyikan Office & Admin Sistem** (dua penanda; manajer TIDAK
    disembunyikan) — bukti: `:9306-9348`, `:9376-9379`.
18. **Divisi yang dinilai review = Kasir/Host/Floor; Office mengatur tapi tidak dinilai** —
    bukti: `:7740-7755`.
19. **Akses halaman di dalam modul = matriks View/Ubah** (0/1/2), `viewer` dijepit maksimum Lihat;
    baris EKSTRA memisahkan hapus (hapus reservasi, hapus catatan DP, hapus catatan review/feedback) —
    bukti `:1013-1024`, `:10669-10684`; SE `:965-993`.
20. **Service Excellent: jika belum ada Manajer/Admin, semua orang masuk sebagai Admin Sistem**
    sampai satu orang ditetapkan — bukti: `:9225-9242`.
21. **3× PIN salah → beku 1 menit** — bukti: `:938-941`, `:3625+`.
22. **Audit append-only, 500 baris terakhir; `log[]` reservasi 20 entri (detail ≤180 char)** —
    bukti: `docs/api/reservasi.md:85`, `:3209-3220`.
23. **Jejak penyunting denah ditulis di layar** (siapa mengubah denah terakhir) — bukti:
    `:5408-5415`, `CLAUDE.md:7084`.
24. **Default master:** `dineEstMin:180`, `clashLeadMin:10`, `dpMethods:["QRIS BRI","Transfer
    UOB","Cash","QRIS BCA"]`, `categories:[…]`, `infoSources:[…]`, `waTargets` (Grup Cashier &
    Grup Koordinasi) — bukti: `:2406-2428`.

## G. Ketergantungan lintas modul
- **Reservasi → Cashier & Finance (embed Dana Masuk):** `deploy/cashier/index.html:3945` dan
  `deploy/finance/kas/index.html:6431` menyematkan `../reservasi/?embed=finance`; guard SSO
  menerima modul `cashier`/`finance` lewat pintu itu dan mengunci `navigate()` ke `'finance'`
  (`reservasi/index.html:21-42`,`:3771`). Dengan embed, pemegang `finance` punya hak verifikasi/
  tolak yang sama dengan kasir.
- **Reservasi → Finance (kwitansi):** `mintaKwitansi()` memanggil `invFetch("invMinta"|"invPutus"|
  …)` — Finance yang menerbitkan (`:7048-7253`); kwitansi ditahan sampai DP terverifikasi.
- **VIP & DP Event → Dana Masuk:** Marketing (Reservasi VIP) dan Event menyerahkan DP ke modul
  Reservasi (`vipDpsUntukReservasi` → `rec.dps`), dan tab `🎉 DP Event (Marketing)` memuat DP event
  read-only (`CLAUDE.md:1275-1317`,`:1484-1512`). **Verifikasi klaim brief: VIP & DP event → Dana
  Masuk Cashier/Finance — BENAR.**
- **Aset bersama `deploy/assets/venue-layouts.js`:** dimuat Reservasi (`reservasi/index.html:12`)
  dan Service Excellent (`service_excellent/index.html:11`) — denah meja + lantai. Dipakai juga
  `analytics`, `konten`, `marketing` (grep `venue-layouts`). **Logika denah harus dipindah ke Vue.**
- **Aset bersama `deploy/assets/kwitansi-sheet.js`:** dimuat Reservasi (`reservasi/index.html:15`);
  `kwitansiData()` memetakan record reservasi ke lembar yang **dipakai bersama Marketing** untuk
  Reservasi VIP (`:7261-7308`). Reservasi **tidak** memuat `cocok-bri.js` — hanya menyebut fungsi
  kembarnya `cbBlobUrl()` (`:8110-8112`). **KOREKSI** terhadap `_lintas-modul.md:59` (lihat bawah).
- **Reservasi ← Radar & DW:** `deploy/radar/index.html:602` dan `deploy/dw/index.html:979`
  membaca `../reservasi-api-mysql/api.php` (Reservasi VIP / Kalender Tamu pax).
- **Service Excellent ← Office/Account:** `autoSyncOfficeRoster` (Reservasi) &
  `muatRosterTim`/`listDivisiRoster` (SE) menarik roster Office (`reservasi/index.html:3576-3590`,
  `service_excellent/index.html:9278-9289`).
- **Service Excellent → ? (reward/payout):** papan Reward menghitung bonus per kru
  (`rewardPapanHtml`) tetapi **tidak ada** tulisan ke HR/Finance/penggajian di kode —
  TIDAK DITEMUKAN (dicari: `grep -n "reward.*hr\|payroll\|gaji\|penggajian"` di
  `service_excellent/index.html`). **Pertanyaan terbuka** (lihat I).
- **OCR/QRIS:** halaman Dana Masuk Reservasi memakai **tesseract.js dari CDN**
  (`reservasi/index.html:8515`); reservasi memuat `parse` bank/nama/tanggal sendiri (`:8578-8785`).
  Pencocokan QRIS BRI yang sebenarnya Ada di Cashier/Finance/omset memakai `assets/cocok-bri.js`.

## H. Catatan untuk implementasi Vue
- **Halaman:** `app/pages/reservasi/index.vue` (Dashboard & Recap), `input.vue`, `finance.vue`,
  `riwayat.vue`, `analitik.vue`, `master.vue`, `audit.vue`; `app/pages/service_excellent/index.vue`
  (Capaian), `review.vue`, `feedback.vue`, `peran.vue`, `setelan.vue`.
  `definePageMeta({ access: ['reservasi'] })` / `access: ['service_excellent']`.
- **Composable `useReservasi.ts`** (fungsi → endpoint):
  - `listReservations({from,to})` → `GET /reservasi/reservations`
  - `getReservation(id)`, `createReservation(body)`, `updateReservation(id,body)`,
    `patchReservation(id,fields)`, `deleteReservation(id)`
  - `getMaster()`, `putMaster(value)`, `getSection(sec)`, `putSection(sec,value)`,
    `putSectionItem(sec,id,value)`, `deleteSectionItem(sec,id)`
  - `getAudit()`, `postAudit({action,detail,res})`
  - `getFile(key)`, `putFile(key,data)`
  - `getRoster()` → `/account/roster`, `getModuleMembers('reservasi')` → `/account/modules/reservasi/members`
- **Composable `useServiceExcellent.ts`** (fungsi → endpoint):
  - review: `getSection('reviews')`, `putSectionItem('reviews',id,rv)`, `deleteSectionItem('reviews',id)`
  - feedback: `getSection('feedbacks')`, `putSectionItem('feedbacks',id,fb)`, `deleteSectionItem(...)`
  - setelan: `getSection('reviewCfg')`, `putSection('reviewCfg',cfg)`
  - peran: `getSection('seCrew')`, `putSection('seCrew',crew)`, `getSection('sePerms')`,
    `putSection('sePerms',perms)`
  - files: `getFile('rv:<id>')`, `putFile('rv:<id>',data)`, `fb:<id>` dst.
- **HP vs desktop:** tabel besar (Daftar Reservasi, Dana Masuk, Riwayat, Audit, Perolehan per Kru,
  Daftar Review, Daftar Feedback) → `AppList`/`AppListRow` di HP dan `UTable` hanya `lg+`.
  Form panjang (Input Reservasi, Catat Google Review, Catat Feedback, Setelan, Atur Target,
  Tambah Bukti TF DP, Cek/Edit transfer) → `ResponsiveSheet`. Satu `AppFocus` per layar
  (kartu ringkasan + tab/segmented).
- **Widget Beranda yang cocok:** reservasi hari ini & yang perlu follow-up; waiting list aktif;
  DP yang perlu diverifikasi (jumlah + nominal); review yang perlu dikonfirmasi; feedback
  `baru`; kapasitas terisi hari ini.
- **Elemen lama yang melanggar DESIGN.md → padanannya:**
  - kartu angka besar `.recap-grid`/`.recap` (banyak di dashboard/finance/analitik/capaian) →
    ganti `AppListRow`/statistik ringkas inline, bukan grid kartu besar.
  - **emoji di hampir semua label/tombol/kartu** (`📋 👥 💰 🍽️ …`) → ikon vektor (Nuxt UI `UIcon`).
  - gradien di latar login/boot (`radial-gradient`, `linear-gradient`) → permukaan solid/token.
  - teks kuning (`--gold`, `color:var(--gold)`) di judul seksi (`:10466`) → warna teks biasa;
    kuning hanya sebagai fill aksi utama.
  - header tabel huruf besar & gaya "eyebrow" → sentence case.
- **Berat payload:** jangan port `getAll` penuh; pakai `GET /reservations?from&to`. Untuk tabel
  dashboard/finance/riwayat/audit, tambahkan paging klien seperti v1 (tanpa `halRecap`/`halDana`/
  `halAudit`), dan pertimbangkan endpoint ringkas untuk `ringkasTamu`, `ver`, dan `riwayat`
  (lihat I).
- **Denah:** `venue-layouts.js` (koordinat meja + lantai 1/2) harus dipindah ke satu modul bersama
  (mis. `app/utils/venue-layouts.ts`) yang dipakai reservasi, service_excellent, marketing,
  konten, analytics — jangan disalin. Editor Denah (drag meja) dan override per-tanggal
  (`layoutOverrides`/`layoutOverrides2`/`layoutTanggal`) adalah fitur berat; usulkan jadi
  `ResponsiveSheet` + canvas/SVG.
- **OCR:** `tesseract.js` di CDN lama. Vue (SPA/PWA) harus memutuskan cara memuat OCR tanpa
  memblokir render (lazy import / worker) — catat sebagai keputusan.
- **Konkurensi:** pakai `If-Match` dari `meta.version`/`ETag`; tangani `409 version_conflict`
  (tarik ulang + merge) dan `428 version_required`.

## I. Pertanyaan terbuka
- [ ] **reservasi / input** — `ringkasTamu` (profil Loyal/blacklist/auto-isi) tidak punya endpoint v1,
  padahal mode berjendela membuatnya tidak bisa dihitung klien. Konteks: `reservasi/index.html:2762-2774`,
  `reservasi-mysql/api.php:85-87`. Opsi: A) tambah `GET /reservasi/guests/summary?before=` B) muat riwayat
  penuh khusus untuk direktori tamu C) hitung dari jendela (salah untuk tamu lama).
- [ ] **reservasi / dashboard-finance-audit** — paginasi sisi-server (`halRecap`/`halDana`/`halAudit`)
  tidak ada di v1; versi-saja `ver` juga tidak. Konteks: `reservasi/index.html:5205-5261`,`:3122`.
  Opsi: A) paging klien atas `GET /reservations?from&to` B) tambah `?page/limit` + `meta` C) endpoint
  `ver` ringan untuk polling.
- [ ] **reservasi / riwayat** — `riwayat` (saring+paging+`ekspor=1`) tidak ada di v1. Konteks:
  `reservasi/index.html:10041-10070`; `CLAUDE.md:526-544`. Opsi: A) paging klien B) port `riwayat_hal()`
  ke v1 C) endpoint ekspor CSV.
- [ ] **reservasi / diagnostik** — `stats` & `ping` tidak ada di v1. Konteks: `api.php:94-98`.
  Opsi: A) tidak perlu (bukan fitur UI) B) tambah `/ping` kesehatan.
- [ ] **service_excellent / reward** — papan Reward menghitung bonus per kru, tetapi tidak ada
  tulisan ke HR/Finance (gaji). Konteks: `service_excellent/index.html:7664-7714`. Opsi: A) reward
  hanya tampilan, dibayar manual B) integrasi ke HR/Finance (butuh desain baru).
- [ ] **service_excellent / embed** — spec modul menyebut Service Excellent "also embedded in
  cashier and finance/kas" (`docs/modules/reservasi.md:7`), tetapi tidak ditemukan `<iframe>`/
  `?embed` ke `service_excellent` di cashier/finance (TIDAK DITEMUKAN, dicari:
  `grep -rn "service_excellent/?embed" cashier finance`). Opsi: A) klaim spec usang (perbaiki spec)
  B) embed memang ada di tempat lain yang belum diperiksa.
- [ ] **reservasi / denah** — `venue-layouts.js` + `Editor Denah` + override per-tanggal harus jadi
  modul Vue bersama; apakah editor drag-meja dipindah apa adanya atau disederhanakan? Konteks:
  `reservasi/index.html:12`,`:5938-6152`. Opsi: A) port penuh SVG B) sederhanakan jadi pilih layout.
- [ ] **reservasi / finance** — OCR bukti TF memakai `tesseract.js` CDN (`reservasi/index.html:8515`)
  dan hasilnya kini "saran", bukan isian (`:9637-9643`). Di Vue, bolehkah memuat OCR dari CDN / worker?
  Opsi: A) lazy import worker lokal B) tetap saran manual tanpa OCR.
- [ ] **reservasi / nav** — kunci `review` masih ada di `ROLE_NAV` Reservasi tetapi halamannya sudah
  dihapus (`:10501-10514`). Konfirmasi: Vue tidak perlu membuat halaman `review` di Reservasi (cukup
  di Service Excellent).

## Konsolidasi untuk README & berkas bersama

### Baris README
```
| reservasi | [reservasi.md](reservasi.md) | ⚠️ selesai dengan celah | 12 (0 tersembunyi) | 3 ❌ · 6 ⚠️ | 9 | reservasi + service_excellent |
```

### `_pertanyaan.md` (bullet)
```
- [ ] **reservasi / input** — `ringkasTamu` (profil Loyal/blacklist/auto-isi) tidak punya endpoint v1; mode berjendela membuatnya tak bisa dihitung klien. Konteks: direktori tamu dipakai di form input & feedback. Bukti: `laksamana-office/deploy/reservasi/index.html:2762-2774`, `laksamana-office/reservasi-mysql/api.php:85-87`. Opsi: A) `GET /reservasi/guests/summary?before=` B) muat riwayat penuh untuk direktori C) hitung dari jendela (salah untuk tamu lama).
- [ ] **reservasi / dashboard-finance-audit** — `halRecap`/`halDana`/`halAudit` (paging server) & `ver` (versi-saja) tidak ada di v1. Bukti: `laksamana-office/deploy/reservasi/index.html:3122`,`:5205-5261`. Opsi: A) paging klien B) tambah `?page/limit`+`meta` C) endpoint `ver` ringan.
- [ ] **reservasi / riwayat** — `riwayat` (saring+paging+`ekspor=1`) tidak ada di v1. Bukti: `laksamana-office/deploy/reservasi/index.html:10041-10070`; `laksamana-office/CLAUDE.md:526-544`. Opsi: A) paging klien B) port `riwayat_hal()` C) endpoint ekspor CSV.
- [ ] **reservasi / diagnostik** — `stats` & `ping` tidak ada di v1 (bukan fitur UI). Bukti: `laksamana-office/reservasi-mysql/api.php:94-98`. Opsi: A) tidak perlu B) tambah `/ping`.
- [ ] **service_excellent / reward** — bonus Reward dihitung per kru tetapi tak ada tulisan ke HR/Finance. Bukti: `laksamana-office/deploy/service_excellent/index.html:7664-7714`. Opsi: A) tampilan saja, dibayar manual B) integrasi HR/Finance.
- [ ] **service_excellent / embed** — spec bilang SE di-embed cashier & finance/kas (`laksamana-api/docs/modules/reservasi.md:7`), tapi tak ada iframe/`?embed` di kode. Bukti: TIDAK DITEMUKAN (dicari: `grep -rn "service_excellent/?embed" cashier finance`). Opsi: A) perbaiki spec B) embed ada di tempat lain.
- [ ] **reservasi / denah** — `venue-layouts.js` + Editor Denah + override per-tanggal harus dipindah; seberapa penuh? Bukti: `laksamana-office/deploy/reservasi/index.html:12`,`:5938-6152`. Opsi: A) port penuh SVG B) sederhanakan pilih layout.
- [ ] **reservasi / finance** — OCR bukti TF via `tesseract.js` CDN, hasilnya "saran". Boleh OCR di Vue? Bukti: `laksamana-office/deploy/reservasi/index.html:8515`,`:9637-9643`. Opsi: A) worker lokal lazy B) tanpa OCR.
- [ ] **reservasi / nav** — kunci `review` masih di `ROLE_NAV` Reservasi padahal halamannya dihapus. Konfirmasi Vue cukup review di Service Excellent. Bukti: `laksamana-office/deploy/reservasi/index.html:10501-10514`.
```

### `_lintas-modul.md` (baris siap tambah)
```
- **Reservasi ⇄ Service Excellent (satu Backend, satu master blob):** dua Panel, dua kunci akses (`reservasi` `deploy/index.html:1133`, `service_excellent` `deploy/index.html:1139`), satu `reservasi-mysql` + master yang sama; gate v1 menerima `reservasi|service_excellent` (`laksamana-api/app/Modules/Reservasi/routes/v1.php:8`). Reviews/feedbacks/reviewCfg/seCrew/sePerms hidup di master yang sama.
- **Reservasi → Cashier & Finance (Dana Masuk / DP):** `deploy/cashier/index.html:3945` & `deploy/finance/kas/index.html:6431` menyematkan `../reservasi/?embed=finance`; guard SSO menerima `cashier`/`finance` lewat pintu itu dan mengunci ke `'finance'` (`deploy/reservasi/index.html:21-42`,`:3771`). v1: endpoint DP ada di `docs/api/reservasi.md`.
- **VIP & DP Event → Dana Masuk Cashier/Finance (VERIFIED):** VIP disalin ke `rec.dps` (`vipDpsUntukReservasi`), tab `🎉 DP Event (Marketing)` read-only; VIP ikut dengan penanda `resId` "jangan dihitung dua kali" (`deploy/reservasi/index.html:9358`; `CLAUDE.md:1275-1317`,`:1484-1512`).
- **Reservasi → Finance (kwitansi):** `mintaKwitansi()`/`invFetch("invMinta"|"invPutus")`; kwitansi ditahan sampai SEMUA DP terverifikasi (`deploy/reservasi/index.html:7217-7253`,`:7142`; `CLAUDE.md:9749-9789`).
- **Aset bersama `deploy/assets/venue-layouts.js`:** dimuat `deploy/reservasi/` (`:12`) & `deploy/service_excellent/` (`:11`), juga analytics/konten/marketing — denah meja lintas modul, satu sumber.
- **Aset bersama `deploy/assets/kwitansi-sheet.js`:** dimuat `deploy/reservasi/` (`:15`), lembar sama untuk Reservasi VIP Marketing (`deploy/reservasi/index.html:7261-7308`).
- **KOREKSI `_lintas-modul.md:59`:** `deploy/assets/cocok-bri.js` **TIDAK** dimuat `deploy/reservasi/` — hanya komentar menyebut kembarannya `cbBlobUrl()` (`deploy/reservasi/index.html:8110-8112`). Pemakai nyata: `deploy/cashier/`, `deploy/finance/kas/`.
- **Reservasi ← Radar & DW:** `deploy/radar/index.html:602` & `deploy/dw/index.html:979` membaca `../reservasi-api-mysql/api.php` (VIP / Kalender Tamu pax).
- **Service Excellent → HR/Finance?** papan Reward menghitung bonus per kru tapi TIDAK menulis ke HR/Finance — TIDAK DITEMUKAN (dicari: `payroll|gaji|penggajian` di `deploy/service_excellent/index.html`). Perlu keputusan owner.
```
