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
  tolak yang sama dengan kasir. **Koreksi build 2026-09-29:** di Vue tidak ada iframe (U5/T-12),
  jadi permintaannya berubah bentuk: `DanaMasukPanel` memanggil `/reservasi/reservations` dari
  halaman Cashier/Kas, sedangkan kontrak itu digate `module:reservasi|service_excellent`
  (`laksamana-api/app/Modules/Reservasi/routes/v1.php:9`) → **G-14**.
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

## J. Progres build

Branch: `migrasi/fondasi` (fondasi F1–F5) lalu `migrasi/reservasi` · Mulai: 2026-09-29
LANJUTKAN DARI: Tahap 5 — Service Excellent (`pages/service_excellent/`: capaian, review, feedback, peran, setelan). Baca D.8–D.12 di bagian H, F12–F18, bagian G (embed), dan kontrak sections `reviews`/`feedbacks`/`reviewCfg`/`seCrew`/`sePerms` + `useServiceExcellent.ts`. Baca D.4–D.7 di bagian H, F19 (baris EKSTRA hapus ikut dibangun di master), dan kontrak `GET /reservations` + `GET /audit` + `PUT /master/{section}`. Regarkan G-08 (paging klien) dan G-14 (Cashier/Kas menampilkan "Segera" sampai API dilonggarkan).

Legend: ✅ selesai · 🟡 sedang · ⬜ belum · ⏸ ditunda (sebut ID K/G di kolom terakhir)

| layar (key) | panel | file | status | endpoint dipakai | ditunda karena |
|---|---|---|---|---|---|
| dashboard | reservasi | `pages/reservasi/dashboard.vue` | ✅ | `GET /reservasi/reservations`, `GET/PATCH/POST/DELETE /reservations`, `GET/POST /audit`, `GET/PUT/DELETE /master/{dineEstMin,clashLeadMin,waitlist,waTargets,layouts,layoutOverrides,layoutOverrides2,layoutTanggal}` | tipe tamu G-07 · drag ganti bulan tidak dibangun |
| input | reservasi | `pages/reservasi/input.vue` | ✅ | `GET/POST/PATCH/DELETE /reservations`, `GET /reservations/{id}`, `GET /files/*` | autofill profil tamu → G-07 |
| finance | reservasi | `pages/reservasi/finance.vue` + `components/DanaMasukPanel.vue` + `components/KwitansiSlot.vue` | ✅ | `GET /reservations`, `GET/PATCH/DELETE /reservations/{id}`, `GET /files/{key}`, `GET /marketing/dp`, `POST /finance/invoices/requests`, `GET /finance/invoices/status`, `GET /finance/invoices/file/{resId}`, `POST /audit` | paging klien (G-08) · tipe tamu G-07 · DP Event 403 → G-15 · terbit-langsung manajer ditunda (sesi finance) |
| riwayat | reservasi | `pages/reservasi/riwayat.vue` + `utils/riwayat.ts` | ✅ | `GET /reservations?from&to` (+ tanpa batas untuk mode Semua) | paging + ekspor di browser (G-08) · profil dari data termuat (G-07) · bawaan Bulan ini, bukan Semua |
| analitik | reservasi | `pages/reservasi/analitik.vue` + `utils/analitik.ts` | ✅ | `GET /reservations` (tanpa batas — keseluruhan butuh semua) | grafik div tanpa lib (K-05 CSV) · ringkasan butuh seluruh tabel (G-08) |
| master | reservasi | `pages/reservasi/master.vue` | ✅ | `GET/PUT /master/{dineEstMin,categories,dpMethods,infoSources,waTargets,users,perms}` + `GET /reservations` + `GET /master` (backup) | Restore/Hapus Semua → K-11 · waTargets tampil saja (seperti lama) |
| audit | reservasi | `pages/reservasi/audit.vue` | ✅ | `GET /reservasi/audit` | paging di browser (G-08) · tautan hanya bila bawa id reservasi |
| capaian | service_excellent | `pages/service_excellent/index.vue` (menu) | ⬜ | `GET /master/reviews`, `/master/reviewCfg`, `/master/seCrew` | reward hanya tampilan (T-19) |
| review | service_excellent | `pages/service_excellent/review.vue` | ⬜ | `GET/PUT/DELETE /master/reviews/{id}`, `/files/rv:*` | — |
| feedback | service_excellent | `pages/service_excellent/feedback.vue` | ⬜ | `GET/PUT/DELETE /master/feedbacks/{id}`, `/files/fb:*` | — |
| peran | service_excellent | `pages/service_excellent/peran.vue` | ⬜ | `GET/PUT /master/seCrew`, `/master/sePerms` | — |
| setelan | service_excellent | `pages/service_excellent/setelan.vue` | ✅ | `GET/PUT /master/reviewCfg` + `POST /audit` | — |

Tahap 0 (fondasi) ✅ di branch `migrasi/fondasi`: `app/utils/versi.ts` (F1), `app/composables/useRoster.ts`
(F2), `app/utils/format.ts` (F3), `app/utils/layar.ts` + `app/components/ModulMenu.vue` (F4),
`CONTRIBUTING.md` (F5). `tglPendek` pindah dari `useAbsensi.ts` ke `utils/format.ts`.

Tahap 1 ✅ di branch `migrasi/reservasi`: pelacak tabel ini, `useReservasi.ts`, `useServiceExcellent.ts`,
`app/utils/layar/reservasi.ts` + `app/utils/layar/service_excellent.ts` (matriks role enam peran & tiga
tingkat), `pages/reservasi/index.vue`, `pages/service_excellent/index.vue`, kartu `service_excellent`
terpisah di `utils/modul.ts` (`deploy/index.html:1133-1141`), `nuxt.config` `imports.dirs: ['utils/layar']`.

Catatan implementasi:
- `GET /reservations` tidak mengirim versi per baris (`ReservasiRecords::list` mengembalikan `data` mentah,
  `ApiResponse::ok($rows, ['total','ver'])`). Versi sebuah baris = `updatedAt`-nya, jadi sebelum menulis
  baris dari daftar, kirim `updatedAt` itu sebagai `If-Match`; `GET /reservations/{id}` mengembalikan yang
  otoritatif di `meta.version` (`laksamana-api/app/Modules/Reservasi/Http/V1/ReservasiController.php:34-39`).
- `OFFICE_TO_RESERVASI_ROLE` (`deploy/reservasi/index.html:3548`) tidak dibangun: sesi Office v3 sudah
  tidak membawa `role` sama sekali (`deploy/index.html:1435-1436`), jadi peta itu tidak punya input — orang
  yang belum ada di `master.users` sudah sejak itu menjadi `host` di Office lama juga.
- `divisi` tidak ada di `GET /account/roster` (hanya `GET /jadwal/roster`, terkunci modul `jadwal`).
  Papan capaian memakai `DIVISI_REVIEW`; kalau butuh divisi per kru, catat sebagai G baru.

### J.1 Tahap 2 — Denah bersama (selesai 2026-09-29, `feat(reservasi): venue-layouts.ts, kunci-meja.ts, dan DenahPeta` + `feat(reservasi): DenahEditor, seksi denah, contoh styleguide`)

**API publik — `app/utils/venue-layouts.ts`** (fungsi murni; `master` selalu argumen, tidak ada state & tidak ada fetch):

| kelompok | ekspor |
|---|---|
| data | `SEAT_W` (1600), `SEAT_H` (1160), `VENUE_LAYOUTS` (4 denah), `BUILTIN_LAYOUT_KEYS`, `LAYOUT_LABEL`, `LT_CFG`, `ltCfg`, `ZONA_MEJA`, `LABEL_ZONA` |
| tipe | `LayoutDenah`, `MejaDenah`, `FixDenah`, `MasterDenah`, `ZonaMeja` |
| pembaca master | `customLayouts(master)`, `layoutTanggal(master)`, `ovLantai(master, lt)`, `allLayoutKeys(master)` |
| kunci | `keyTanggal(date, lt)`, `parseKeyTanggal(key)`, `adaDenahTanggal(master, date, lt)` |
| memilih denah | `getLayout(master, key)`, `layoutName(master, key)`, `isBuiltinLayout(key)`, `lantaiLayout(master, key)`, `lantaiMap(master)`, `hariAkhirPekan(date)`, `defaultDayTypeLt(date, lt)`, `dayTypeLayoutLt(master, date, lt)`, `dayTypeLayout`, `dayTypeLayout2`, `defaultDayType`, `hasOverrideLt`, `hasLayoutOverride` |
| kapasitas | `capMax(cap)`, `capMin(cap)`, `kapasitasLayout(layout)`, `kapasitasTanggal(master, date)`, `cariMeja(master, id)` |
| editor | `capDenah(data, nama, at)`, `jejakDenah(data)` (F23), `denahTanggalBaru(data, date, lt)` |

Marketing (VIP) cukup: `dayTypeLayoutLt` + `getLayout` + `keyTanggal` + `parseKeyTanggal` + `capMax` + `lantaiMap` — persis yang dipakai `vipDenah()`/`vipKeyTanggal()` di `deploy/marketing/index.html:17643-17668`.

**API publik — `app/utils/kunci-meja.ts`** (fungsi murni, `now` bisa diberi):

| kelompok | ekspor |
|---|---|
| konstanta | `LOCK_LEAD_MIN` 180, `MEPET_MIN` 60, `TUMPANG_MEPET_MIN` 120 |
| waktu absolut | `dayNo`, `toMin`, `hhmm`, `absMin`, `ymdOf`, `absOfTs`, `absNow`, `fmtMenit` |
| reservasi | `tablesOf`, `mejaAsliOf`, `sedangDialihkan`, `arrivalsOf`, `arrivedPax`, `remainingPax`, `paxFull`, `canAddArrival`, `isSeated`, `STATUS_BEBAS` |
| jendela kunci | `dineEstOf(master)`, `clashLeadOf(master)`, `lockStart`, `seatStart`, `lockEnd`, `locksRange`, `locksAt`, `locksTable`, `dudukMenempati`, `overStay`, `overStayMin`, `menitMenuju`, `lockStartText`, `lockWindowText` |
| mepet | `mepetKah`, `bedaMenitRes`, `mepetTerhadap` |
| isi meja | `isJoinable`, `paxDiMeja`, `takenPaxAt`, `tableFill`, `hasRoom`, `roomText` |
| peta | `occupiedMap(list, {date, time, exceptId, realita, dineEst})`, `partiesAt`, `harihOccupancy(list, {date, hariIni, saring?, dineEst})` → `{occ, later}`, `nextBookingAt`, `perluDialihkan` |
| izin tumpang | `izinTumpangBerlaku(r)`, `buatIzinTumpang(meja, date, time, lawan, nama)` |
| bentrok | `OpsiCek`, `opsiCekOf(r)`, `conflictCheck(list, {date, table, time, exceptId?, sharing?, loose?, dineEst?, now?})`, `periksaTumpang(lawan, meja, date, time, dineEst?)` → `KeputusanTumpang` |
| status meja | `StateMeja`, `StatusMeja`, `statusMeja(meja, {...})` |

`loose: true` = jalur walk-in / izin (hanya tamu yang SEDANG DUDUK + mepet ≤60 mnt yang menahan). Tanpa `loose` = menjual kursi untuk nanti (jendela H±3 jam). `periksaTumpang()` hanya MEMPUTUSKAN; dialognya tugas pemanggil (`ResponsiveSheet`).

**Komponen**

| file | props | emit |
|---|---|---|
| `DenahPeta.vue` | `layout` (wajib), `reservasi`, `tanggal`, `jam?`, `mode?: 'tampil'\|'pilih'`, `terpilih?`, `dipaksa?`, `kecualiId?`, `hariIni?`, `saringAktif?`, `master?`, `timer?`, `nunggu?`, `legenda?` | `pilih(meja)`, `buka(resId)`, `tumpang({meja, tanggal, jam, lawan, kunci, mepet, pesan})` |
| `DenahEditor.vue` | `layout`, `konteks?`, `tanggal?`, `templateTanggal?`, `bisaUbah?`, `jejak?` | `simpanTemplat(data)`, `simpanTanggal(data)` |
| `DenahLegenda.vue` | `zona?` | — |

Komponen tidak memanggil API dan tidak menyimpan state modul. Penulisan section tetap di pemanggil: `useReservasi.ts` menambah `SECTION_LAYOUT`, `useDenah()` (4 section + versi masing-masing), `putDenah(section, value, versi)` → `PUT /master/{section}` dengan `If-Match` + `tanganiKonflik()`.

**Keputusan tampilan (tidak ada di kode lama)**
- **Warna isi meja = ZONA, bukan status.** Zona adalah bahasa lapangan kru ("yang di area kayu"), dan Marketing sudah mewarnai denah VIP per zona. Status dibawa sebagai **titik + kata** sesuai DESIGN.md, jadi dua hal tidak berebut saluran yang sama. Status jadi 9 state: `kosong`, `terpilih`, `sharing`, `pending`, `confirmed`, `datang`, `terkunci`, `mepet`, `dipesan`. Legenda di `DenahLegenda`.
- Token baru `--color-seat-{green,blue,wood,vip,dark,diamond,ext}` di `main.css` (terang + `.dark`). Tidak ada hex di komponen.
- **Meja terkunci diredupkan, bukan diwarnai ulang** — zona harus tetap terbaca; "terpilih" memakai cincin kuning di LUAR kotak (bukan isian), supaya zona tetap terlihat justru saat sedang diperiksa sebelum menyimpan.
- **Editor read-only di bawah `lg`** dengan pesan "Buka di layar lebar untuk mengubah denah" (prompt §3). Alasannya: denah yang bergeser dari jari adalah kerusakan yang sulitUndo.
- Komponen bernama `DenahPeta.vue`, bukan `Denah.vue`: `vue/multi-word-component-names` melarang nama satu kata.

**Tabel uji rumus** — dijalankan berdampingan dengan fungsi lama yang diambil **verbatim** dari `deploy/reservasi/index.html` (dieksekusi ulang di luar browser, harness sekali pakai lalu dihapus; repo tidak menambah dependensi). Hasil: **45/45 identik**, 4 denah **deep-equal** dengan `deploy/assets/venue-layouts.js`. Tanggal dasar 2026-09-29; `r.duduk` = Dimas, meja 12, 18:30, status `Datang`, `checkinAt` 18:40, 4 dari 6 pax; `r.nanti` = Rani, meja 12, 23:00, `Pending`.

| # | kasus (masuk → keluar) | hasil lama = baru |
|---|---|---|
| 1 | `absMin(29 Sep, 00:30)` (lewat tengah malam) | hari × 1440 + 30, tetap bisa dibandingkan |
| 2 | `hhmm(1500)` | `01:00` |
| 3 | `lockStart(booking 19:00)` | 16:00 (H−3 jam) |
| 4 | `lockEnd(booking 19:00, belum datang)` | 22:00 |
| 5 | `lockEnd(tamu duduk 18:30, dineEst 180)` | 21:30 (18:30 + estimasi) |
| 6 | `seatStart(tamu datang lebih awal)` | `max(jamBooking, checkinAt)` — datang lebih awal tidak melepas meja lebih cepat |
| 7 | `locksTable(19:00, 21:00)` / `(…, 23:00)` | bentrok / bebas |
| 8 | `locksAt(r, null)` | `true` (tanpa jam = dianggap terkunci) |
| 9 | `mepetKah(60)` / `mepetKah(61)` | `true` / `false` |
| 10 | `bedaMenitRes(lawan 23:00, jam diisi 22:30)` | 30 (absolut, bukan 210) |
| 11 | `dudukMenempati(tamu duduk, besok 10:00 / besok 19:00)` | `false` / `false` (sudah pulang) |
| 12 | `occupiedMap(29 Sep, realita)` | meja 12 → [duduk, nanti] (duduk lebih dulu) |
| 13 | `occupiedMap(29 Sep, jam 15:00)` | meja 12 tidak terisi |
| 14 | `occupiedMap` dengan `leftAt` | meja bebas |
| 15 | `conflictCheck` ketat meja 12 jam 20:00 | `Dimas` (duduk) |
| 16 | `conflictCheck` longgar (walk-in) meja 12 jam 20:00 | `Dimas` |
| 17 | `conflictCheck` longgar meja 12 jam 23:10 | `Rani` (mepet ≤60 mnt) |
| 18 | `conflictCheck` dengan `exceptId` sendiri | tidak menyangkut dirinya |
| 19 | `isJoinable` dua-duanya sharing / salah satu tidak | `true` / `false` |
| 20 | `capMax`/`capMin("10-12")` | 12 / 10 |
| 21 | `arrivedPax` dari `arrivals[]` vs `actualPax` lama | 5 / 4 |
| 22 | `izinTumpangBerlaku` dengan meja/jam berubah | `false` (izin sekali pakai) |
| 23 | `periksaTumpang` tamu sedang duduk | `kunci: true` — tidak pernah bisa dilewati |
| 24 | `periksaTumpang` beda 30 mnt | `kunci: true` (≤ `MEPET_MIN`) |
| 25 | `periksaTumpang` beda 100 mnt | `mepet: true` (≤ `TUMPANG_MEPET_MIN`) |
| 26 | `periksaTumpang` beda 200 mnt | `mepet: false`, boleh lewat konfirmasi |
| 27 | `hariAkhirPekan` Jumat/Sab/Min/Minggu–Kamis | weekend / weekday |
| 28 | `kapasitasTanggal` Lt.1 + Lt.2 | 45+63 meja, `pax` = Σ `capMax` per denah yang berlaku |
| 29 | `getLayout` dengan override tidak dikenal | jatuh ke bawaan hari, bukan `null` |

**Perilaku lama yang ambigu (dicatat, tidak ditebak)**
- **`R1`/`R3`/`R5` weekend Lt.1 tidak ada** (`:99-103` weekday punya R1–R6, weekend hanya R1,R2,R3,R5,R4,R6) — pertahankan persis, Edit denialah yang memperbaiki.
- **`EXT 12` & `EXT 13` tidak pernah ada** di denah weekend (loncat 11 → 14). Slot itu dulu dipakai untuk meja yang dipindah; jangan dibuat oleh Editor.
- **`lantai2_weekend` salinan identik `lantai2`** dan sengaja begitu (`:134-141`). Kalau suatu saat diisi berbeda, itu perubahan disengaja, bukan bug port.
- **Meja kembar dalam satu denah**: `kapasitasTanggal()` melompat id kembar (`:5863-5865`), `tableFill` menghitung dua kali. Editor memberi tanda "ada nomor meja kembar" tetapi tidak memperbaiki sendiri — data lama bisa saja memang begitu. **Tahap 3/4: putuskan** apakah penyimpanan template baru menolak nomor kembar.
- **`tableAsli` tidak ikut disalin** oleh pembangun record form lama (`:4850-4890`) — berbeda dari `izinTumpang` dan `log` yang sengaja dijaga. Field-nya sudah masuk tipe `Reservasi`; **Tahap 3** harus ikut menyalinnya, kalau tidak "pulang ke meja asal" hilang begitu reservasi disunting.
- **`absOfTs` memakai jam lokal** untuk `checkinAt` (`:1592`) — jadi jam duduk ikut zona waktu browser. Di produksi (WIB) sama; tidak diubah.
- **`statusMeja` untuk tabel non-GET di luar rentang**: `occupiedMap` hanya memeriksa `dd` dalam −1..+1, dan `harihOccupancy` menyembunyikan booking besok yang belum datang. Sudah mengikuti.

**Catatan API**
- `GET /master/{section}` mengembalikan versi section sendiri di `meta.version` + header `ETag`; `useDenah()` menyimpan amplopnya utuh karena `useAsyncData` membuang `meta` (versi tidak akan terlihat kalau tidak).
- Override per tanggal = 4 section terpisah: `layouts`, `layoutOverrides` (Lt.1), `layoutOverrides2` (Lt.2), `layoutTanggal` (denah utuh per tanggal). Semuanya harus ditulis sebagai **section**, bukan `PUT /master` blob penuh.

### J.2 Tahap 3 — `input` (selesai 2026-09-29, `feat(reservasi): input`)

Semua field D.2 ada, dengan pesan validasinya apa adanya. Yang dibangun di layar ini:

| bagian | cara |
|---|---|
| pilih meja | `DenahPeta mode="pilih"` + `pilihMeja()`; denah mengikuti tanggal lewat `dayTypeLayoutLt()` + `master` dari `useDenah()`; tombol Weekday/Weekend/Lantai 2 **hanya mengubah yang digambar**, tidak disimpan (paritas `:4391-4393`, `:4618-4625`) |
| izin tumpang (F6) | `@tumpang` dari DenahPeta → `ResponsiveSheet`; "tetap pakai meja" menambah meja ke `dipaksa`, dan `bangunRecord()` menulis `izinTumpang` ke baris. Expired sendiri saat tanggal/jam berubah (`:2204-2207`) |
| cek meja sebelum simpan (`:4637`) | `listReservations(dari-1, sampai+1)` lalu `conflictCheck(..., {loose: dipaksa.length>0, dineEst: dineEstOf})`; kalau bentrok, meja yang dipakai dibuang dari pilihan dan `galat` diisi |
| penjaga DP (F1–F3) | `cekDp()`: nominal > 0 **dan** bukti (baru atau tersimpan) **dalam satu pemeriksaan**; baris DP lama hanya ditanya sekali lewat sheet, tidak dikunci |
| bukti ≤ 5 MB (F1) | dicek sebelum dibaca jadi data URI; data URI dikirim inline di body baris (server yang memindahkannya ke berkas) |
| `status` baru | `dpStatus==='Sudah' ? 'Confirmed' : 'Pending'` (`:4869`); status lama tidak ditimpa saat edit |
| `dps[0]` | `pastikanDps()` + `dpBaru()` + `resetDpScan()` bila bukti baru (`:4915-4924`) |
| `normPhone` | `normPhone()` dari `utils/dp-reservasi.ts` → `62…` (`:3295`) |
| `pax >= 20` | peringatan "butuh approval manajer" (`:4628`), bukan blokir |
| "Samakan dengan jumlah pax" | hanya muncul kalau tercatat masuk > dipesan, dan **ditahan sampai Simpan** (`:4689-4703`) |
| hapus | hanya mode edit + `bolehAksi('deleteReservation', role)`, lewat `ResponsiveSheet` (`:8469`) |
| versi | edit: `meta.version` dari `GET /reservations/{id}`, atau `updatedAt`; `ifMatch()` + `tanganiKonflik()` (reload membaca ulang barisnya) |
| autofill profil tamu | blok "Segera · G-07" (text-dimmed); datalist nama/HP tetap diisi dari jendela yang dimuat, seperti mode berjendela lama |

**Pembangun record** — `bangunRecord()` menyalin seluruh field yang ditulis `:4850-4890`, termasuk dua yang **lupa ditulis** di sana dan koreksi build 2026-09-29:
- **`tableAsli`** — tanpa ini "pulang ke meja asal" hilang begitu reservasi disunting.
- **`tfName`** — ditulis Dana Masuk, dihapus form lama (pola sama seperti `izinTumpang` & `log` yang memang dijaga komentar).

**Koreksi build 2026-09-29 — tulisan setelah konflik tidak lagi menimpa data orang lain.** Temuan review owner:
- Simpan **edit** memakai `PATCH /reservations/{id}` (shallow merge), bukan `PUT` seluruh record. Yang dikirim hanya field milik form **dan hanya yang berubah** dibanding `lama` terbaru: `name`, `phone`, `date`, `time`, `pax`, `table`, `sharing`, `category`, `foodReq`, `drinkReq`, `source`, `member`, `memberNo`, `notes`, `dpStatus`, `dpMethod`, `dpAmount`, `lunas`, `dpProofData`/`dpProofName` (hanya bila ada unggahan baru), `docReqData`/`docReqName` (hanya bila ada unggahan baru), `izinTumpang` (hanya bila ada approval baru), `arrivals`/`actualPax` (hanya dari tombol "Samakan dengan jumlah pax"), dan `dps` — yang dikirim **utuh** (merge dangkal tidak bisa mengganti satu elemen) **hanya bila `dps[0]` benar-benar berubah**, dan dibangun dari `lama.dps` **terbaru** sehingga cicilan lain & status verifikasinya tetap.
- Field yang **tidak pernah** dikirim dari mode edit: `status`, `checkinAt`, `leftAt`, `datangDiasumsikan`, `log`, `followups`, `cancelReason`, `vip`, `createdBy`, `createdAt`, `tf*`. Konsekuensi yang disengaja: hasil scan (`tf*`) tidak lagi terhapus oleh form Input — field itu milik Dana Masuk.
- `lama` tidak pernah dimutasi: `fieldDP()` bekerja pada salinan (`{ ...asal, dps: salinDps(asal) }`).
- `muatUlangReservasi()` memuat ulang **baris yang ditulis** (`refreshIni()` → `watch(ini)` mengisi `lama`, `versi`, dan seluruh isian form) **lalu** jendela di sekitarnya (`refresh()`). Dipakai `simpan()` **dan** `hapus()`; sebelumnya `hapus()` memakai `refresh` saja sehingga `versi` tak pernah diperbarui dan Hapus akan 409 terus.
- Grep `tanganiKonflik(e, refresh)` di file lain: `dashboard.vue` (`patch()` aksi cepat denah, dan walk-in). Keduanya **benar** — data yang ditulisnya berasal dari daftar yang di-`refresh()` itu juga, dan walk-in memang tidak berversi (POST tanpa `If-Match`).

**Skenario uji manual (dijalankan owner saat cutover, bukan oleh agen)**
1. Buka `/reservasi/input?id=X` di tab A, lalu di tab B buka Dashboard → Denah meja → klik meja X → **Tandai datang** (atau verifikasi DP di tab Dana Masuk).
2. Kembali ke tab A, ubah satu field, tekan **Simpan perubahan** → harus muncul toast "Data sudah diubah orang lain" (409), bukan "tersimpan".
3. Form terisi ulang dari server: status/DP terbaru ikut berubah dan catatan kedatangan guest-B tetap ada.
4. Tekan **Simpan perubahan** lagi → berhasil, dan **verifikasi/kedatangan tab B masih ada** (lihat di Dashboard), tidak ikut terhapus.

**Pemanggilan fungsi kunci meja** (semua lewat master, tidak ada default 180/10 yang dipakai diam-diam):

| pemanggilan | args dari master |
|---|---|
| `conflictCheck()` di `cekMejaServer()` | `dineEst: dineEst.value` (= `dineEstOf(master)`) |
| `<DenahPeta :master="masterKunci">` | `dineEstMin` + `clashLeadMin` diteruskan ke `statusMeja()` |
| `perluDialihkan()` (di dalam `statusMeja`) | `clashLeadOf(master)` |

`masterKunci` menggabungkan `useDenah().master` dengan `dineEstMin`/`clashLeadMin` dari section masing-masing, jadi tidak pernah ada jalur yang menghitung kunci dengan default lama.

### J.3 Tahap 3 — `dashboard` (bagian 1 & 2, 2026-09-29)

**Bagian 1** (`feat(reservasi): dashboard bagian 1`) — ringkasan, filter, tab Tabel. Ringkasan = `AppFocus` (jumlah reservasi + pax) + `AppList` (empat barisa angka), bukan grid kartu. Tab Tabel: `UTable` di `lg+` dan `AppList` di HP dari baris yang sama, urut per kolom (Tombol sort, bukan klik header — sorting lewat tombol di bawah tabel, bukan klik header (klik header pada UTable tidak bisa di-style dan tidak konsisten)), paging 10/25/50 di browser dengan catatan **G-08** di layar. "Tipe tamu" **Segera · G-07** (butuh `ringkasTamu`).

## Tahap 5 — Service Excellent

**Setelan** (`feat(se): setelan`) — `app/pages/service_excellent/setelan.vue`: link, saklar WA (+ pita bila mati), reward min + tangga tambah/hapus (baris lokal — + tidak mengubah cfg; yang jumlah 0 dibuang saat simpan), Simpan (`reviewCfg` + versi termuat + audit). Di bawah manager: "Setelan diatur oleh manager."

**Peran** (`feat(se): peran`) — `app/pages/service_excellent/peran.vue` (+ `seedPermsSE()`): daftar kru (pengurus dulu, hanya Kasir/Host/Floor/Office + hitungan tersaring), ubah tingkat langsung di baris (penjaga pengurus-terakhir; `roleSetAt/By` mengunci pilihan manusia; tanpa tambah — seperti lama), Segarkan (sinkron roster → tulis bila berubah), peringatan F20 APA ADANYA (belum ada pengurus → semua Admin Sistem), matriks `sePerms` via komponen bersama **`MatriksIzin.vue`** (juga dipakai `master.vue` Reservasi — ekstraksi, bukan salinan), Default + Simpan + audit. Tulis: `PUT /master/seCrew` / `PUT /master/sePerms` + versi section termuat + `tanganiKonflik(refresh)`. `sePerms` section sendiri — tak pernah menyentuh `perms` Reservasi.

**Capaian** (`feat(se): capaian`) — `app/pages/service_excellent/index.vue` (beranda SE + layar capaian, sesuai `LAYAR_SERVICE_EXCELLENT`): periode bersama, progres tim + 7 baris ringkas (AppFocus kehadiran), papan Reward HANYA TAMPILAN (T-19 — tanpa satu pun tulis uang), tabel tangga (sudah/menuju dihitung di SATU tangga yang dibayarkan), Perolehan per Kru + catatan selisih Office/Admin (F17), Atur Target per nama (F13 — tim = jumlah host, 0 = tak dinilai; put `reviewCfg` + versi termuat + audit). Satu baris per kru termasuk yang nol. Divisi dari `GET /account/roster` (`keterangan`, sama dengan `listDivisiRoster` lama — TANPA G-16); roster belum tiba → kru modul + catatan. Yang dinilai hanya DIVISI_REVIEW (F18).

**Feedback** (`feat(se): feedback`) — `app/pages/service_excellent/feedback.vue`: rekap per status & kategori (`FB_CATS` persis, `other:nama` digabung) + bar kategori, filter status/kategori/cari (cari mencakup ISI catatan), daftar, Catat (multi-item, `other` wajib disebut, tone negatif/positif, status + tindakan langsung di form — kasus beres di tempat tak perlu dua langkah, foto opsional ≤5MB, direktori tamu dari reservasi termuat), Proses / Selesai + tindakan (sheet, bukan prompt), WA tindak lanjut (`waKirim`), ubah, hapus (`hapusCatatan`). Tulis: `PUT/DELETE /master/feedbacks/{id}` + versi section termuat + `tanganiKonflik(refresh)`; sheet isi-ulang setelah konflik. Bukti via `fb:`.

**Review** (`feat(se): review`) — `app/pages/service_excellent/review.vue`: periode Harian/Mingguan/Bulanan bersama (`usePeriodeReview`), panel Tamu belum diminta (datang + ber-nomor + belum tercatat; panel tampil hanya bila saklar WA hidup DAN divisi office/ceo/cfo/host atau admin — F-divisi `:7720-7738`), Minta review (WA via `waKirim` + catatan `diminta` dengan `askedAt` sendiri; link wajib; penjaga ganda di tombol DAN fungsi), Salin link, Catat review (Foto 1 wajib, Foto 2 menyusul, host = yang login dan dipertahankan saat edit, penjaga klaim ganda lintas waktu — F16), Daftar review [Saya] (mine kecuali admin/office/verifikator — agar tombol verifikasi bisa ditekan, `:7780-7798`), Verifikasi (Foto 2 WAJIB — F15 — + dialog), Tolak + alasan, ubah, hapus (`hapusCatatan`), bukti via `rv:/rv2:` + sheet. Hanya `terverifikasi` dihitung ke target (F14). Tulis: `PUT /master/reviews/{id}` + versi section termuat + `tanganiKonflik(refresh)`; sheet klaim isi-ulang setelah konflik. Foto ≤5MB.

## Tahap 4b — riwayat, analitik, master, audit

**Audit** (`feat(reservasi): audit`) — `app/pages/reservasi/audit.vue`: 500 terakhir (server), kolom `Waktu, User, Role, Aksi, Detail`, cari (user/role/aksi/detail), paging browser (G-08), baris ber-`res` → `/reservasi/input?id=` — TANPA tebakan nama (tautan menebak bisa membuka reservasi orang lain, `:10728-10753`). Tanpa tulisan di layar ini.

**Master** (`feat(reservasi): master`) — `app/pages/reservasi/master.vue` (+ `seedPermsReservasi()` di `utils/layar/reservasi.ts`, cermin `DEFAULT_PERMS` `:1109-1129`): estimasi duduk (min 30, pills, contoh jam — put `dineEstMin` + audit), 3 daftar dropdown per section (tulis langsung per tambah/hapus seperti lama, masing-masing versi sectionnya + audit), waTargets tampil saja + hint (seperti lama — tidak ada edit di sana), Role Kru (ganti role, put `users`; tanpa tambah — seperti lama), matriks View/Ubah (klik geser, viewer 2 keadaan, baris ekstra terkunci bila induk tak terlihat, admin terkunci Ubah, Simpan menjepit viewer ≤1 + admin =2, Default = konfirmasi → seed; put `perms` + audit; F19), Backup JSON (`GET /reservations` tanpa batas + `GET /master`, unduh saja — tanpa audit seperti lama), Restore/Hapus = "Segera · K-11" (baru, ⬜). Tiap tulis section: `putSection(key, value, versiDari(sectionYangDimuat))` + `tanganiKonflik(refreshSection)` (§2.7).

**Analitik** (`feat(reservasi): analitik`) — `app/pages/reservasi/analitik.vue` + `app/utils/analitik.ts` (murni, `// Source:`): Performa Harian/Bulanan (`performaPeriode()` — rumus persis `:10364-10403`: hadir/diharapkan, tepat/telat + rata telat, durasi rata, realisasi pax datang/dipesan, no-show, walk-in, hari tersibuk, tren harian, 5 paling telat, 5 duduk terlama) + Ringkasan Keseluruhan (`ringkasKeseluruhan()`: total, pax, rata, rasio no-show, unik, sumber, PIC per ORANG — bukan per peran — peak hour & hari = JUMLAH PAX, tren per bulan). Angka di baris ringkas + satu AppFocus (kehadiran), bukan kartu; grafik = div bar tanpa library (§2.8). Keseluruhan memuat seluruh tabel sekaligus (tanpa paging server tidak ada jalan lain — G-08).

**Riwayat** (`feat(reservasi): riwayat`) — `app/pages/reservasi/riwayat.vue` + `app/utils/riwayat.ts` (milik reservasi): kartu CRM saat mencari (profil dari baris TERMUAT saja — `ringkasTamu` = G-07 — dan kartunya menyebut itu), arsip `Tanggal, Tamu, Pax (datang/dipesan), Meja, Durasi, DP, Status`, filter D.4 (Cari, Periode Semua/Bulanan/Tahunan, Status Akhir), paging + Export CSV di browser (G-08; kolom = lama termasuk Lantai via `lantaiMap`, Rekening via `rekeningDp()` baru di `dp-reservasi.ts`), baris → `/reservasi/input?id=` (layar yang sudah ada). Rumus murni `// Source:`: `PUNCTUAL_TOL=10`, `keterlambatanDatang()`, `tepatWaktu()`, `durasiDuduk()`, `profilTamu()`, `barisArsip()` (lewat ATAU sudah-tutup), `urutArsip()`, `csvRiwayat()` + `unduhCsv()`. 15 kasus uji lolos (node strip-types). `fmtDur` tidak di-port — `fmtMenit()` kunci-meja sudah setara ("1j 5m" vs "1 j 20 m"). Bawaan = **Bulan ini** (penyimpangan disengaja dari `HIST_F.mode="all"`): tanpa paging server, "Semua" menarik seluruh tabel — buka layar harus tetap cepat, "Semua" tinggal satu ketukan.

## Tahap 4a — finance (Dana Masuk / DanaMasukPanel)

**Halaman finance** (`feat(reservasi): halaman finance`) — `app/pages/reservasi/finance.vue` tipis: `AppPage` + `DanaMasukPanel` dengan izin dari matriks (`finance` → verifikasi, `financeDelete` → hapus + demo, `master` → kwitansi langsung); tanpa itu "Tidak ada akses."

**Kwitansi** (`feat(reservasi): kwitansi`) — `app/utils/kwitansi.ts` (milik reservasi, dipakai Marketing nanti) + `app/components/KwitansiSlot.vue` + `app/composables/useFinance.ts` (3 call invoice; milik modul finance, reservasi hanya meminjam). Port `kwitansiData()` + `kwitansi-sheet.js` (`kwitansiHtml()`, `tulisLembar()` — jendela dibuka pemanggil sinkron, jeda 400ms; gaya cetak lembar dipertahankan supaya tak bisa dibedakan dari sebelumnya) + `kwiTertahan()`/`kwiTertahanTeks()` (F10: SEMUA transfer, rejected ikut menahan) + `kwitansiNo()` + `invRingkas()`. Alur: request → `POST /finance/invoices/requests` (`resId`, `jenis: 'KWITANSI'`); status → `GET /finance/invoices/status?res=` (tiga keadaan undefined/null/isi — gagal jaringan bukan null); cetak → `GET /finance/invoices/file/{resId}` (404 `not_issued` → pesan "belum terbit", bukan lembar tanpa tanda tangan). Tombol di detail reservasi (slot DP + kaki modal `:7879`,`:7913`), BUKAN tabel Dana Masuk — di Vue dipasang di sheet Cek/Edit (`KwitansiSlot`, prop `bolehKwitansiLangsung` dari matriks role). Logo base64 lama tidak ikut di-port (inline besar; lembar tetap tercetak tanpanya). DITUNDA ke sesi finance: penerbitan langsung manager/admin (old invMinta+invPutus) — memanggil endpoint decision + pilihan penanda milik modul finance; dari sini manajer tanpa modul finance mencetak lembar tanpa tanda tangan (perilaku jatuh yang sama dengan kode lama).

**DanaMasukPanel** (`feat(reservasi): DanaMasukPanel`) — `app/components/DanaMasukPanel.vue` (2200+ baris) + `app/composables/useMarketing.ts` (`GET /marketing/dp`). Props: `bolehVerifikasi`, `bolehHapus` (`financeDelete`, admin), `bolehHapusDemo` (admin), `sumberAwal`. Tanpa emits; tanpa asumsi halaman. Memuat datanya sendiri (jendela = filter, `listReservations`; `dpMethods`; DP Event manual dengan cache kunci + galat).
- Saklar sumber di kedua tab + catatan "tidak bisa dijumlahkan". DP Event read-only: ringkasan (total, event unik, 2 jenis terbesar), pita tanpaTanggal & vipTerkunci ("jangan dihitung dua kali"), catatan luar-rentang + tombol "Tampilkan", saring tanggal acara + cari, tabel `lg+` / daftar HP. `receiptUrl` warisan (`?action=receipt&key=`) tidak dibuka dari sini — hanya tautan http yang keluar. 403 → "Belum punya akses · G-15" (baru, ⬜).
- DP Reservasi: 6 baris ringkas (AppList, bukan kartu) + rekap per bank, pita demo & tgl-cadangan, filter basis/Dari/Sampai/Bank/Saring/Cari/pills (bawaan HARI INI basis reservasi), 3 tab verifikasi, tabel `lg+` / daftar HP (ketuk → Cek/Edit), paging browser (G-08), Export CSV browser (basis ikut di nama berkas).
- Aksi tulis — SETIAP tulis memakai versi YANG DILIHAT orangnya (koreksi build 2026-09-30; Office lama menolak simpanan basi lewat penjaga `baseVer`). Tiap sheet memotret barisnya saat dibuka (`dasarDari`: salinan + `updatedAt` tampilan); `dps` dibangun dari salinan itu, bukan objek daftar; kirim HANYA field DP (`tulisTransfer`: `dps` utuh + `cerminDp` + `cerminTfUtama` bila cicilan-0, + `status: Confirmed` hanya bila potret masih Pending saat Tambah). Perubahan di antara → 409 → `tanganiKonflik` → daftar muat ulang DAN sheet isi-ulang dari baris terbaru (pola `muatUlangReservasi` input.vue). Versi per aksi:
  - Cek/Edit: versi potret sheet (`tfDasar`, ditangkap `bukaTfEdit`); konflik → `muatUlangTf` (daftar + buka-ulang sheet dari baris terbaru).
  - Verifikasi: versi potret dialog (`ver.versi`; dari tabel = baris itu, dari sheet edit = versi sheet via `bukaVerifikasiDariForm`); dialog dari sheet menyatakan ketikan barusan (`:9846-9854`); konflik → daftar muat ulang (dialog sudah tertutup).
  - Tolak: versi potret dialog (`tolak.versi`; dari sheet edit = versi sheet); konflik → `muatUlangTf` bila dari sheet, daftar bila dari tabel.
  - Betulkan tanggal/jam: versi + isi dibekukan saat tombol diklik (`dasarDari(x)` sebelum konfirmasi); konflik → daftar muat ulang.
  - Tambah Bukti: versi potret sheet (`tambah.versi`, ditangkap `bukaTambah`); konflik → `muatUlangTambah` (daftar + potret-ulang `ke`/`sudahMasuk`, ketikan nominal/metode/berkas dipertahankan).
  - Hapus DP (admin): versi + isi dibekukan saat tombol diklik; konflik → daftar muat ulang.
  - Hapus Demo (admin): `DELETE` per baris dengan `updatedAt` daftar (memang versi tampilan) + satu audit.
  - Scan OCR: SATU-SATUNYA yang boleh baca-ulang versi terbaru — yang ditulis hanya saran `tfOcr*`, bukan keputusan.
- Skenario uji manual dua tab (dijalankan owner saat cutover, bukan oleh agen):
  1. Tab A (kasir): buka Dana Masuk, buka Cek/Edit baris X (atau dialog Verifikasi X) — biarkan terbuka.
  2. Tab B (host): buka `/reservasi/input?id=X`, ubah nominal DP / unggah bukti baru, Simpan.
  3. Kembali ke tab A, tekan Simpan/Verifikasi → harus 409 + toast "Data sudah diubah orang lain", daftar + sheet termuat-ulang menampilkan nominal/bukti baru dari tab B.
  4. Periksa ulang, tekan lagi → tersimpan; perubahan tab B tetap ada (tidak tertimpa).
- Scan: manual per baris (+audit rinci + buka edit), borongan "Ulangi Scan (n)" + autoscan 60ms saat dibuka (yang sudah discan tidak diulang, gagal tidak dicoba lagi sesi itu, satu audit ringkas). Penampil bukti di sheet (img/PDF inline, "memuat" dulu).
- 403 `module_not_granted` → "Belum punya akses ke Data Reservasi · G-14", bukan error mentah.
- Keterbatasan jendela (catat, bukan G baru — G-08): basis 'masuk' menemukan transfer lewat tanggal reservasinya; DP hari ini untuk reservasi bulan depan butuh rentang lebar/"Semua" (tanpa batas = seluruh tabel).

**OCR bukti lazy** (`feat(reservasi): OCR bukti lazy (tesseract.js)`) — `app/utils/ocr.ts`: worker tunggal `createWorker('eng')`, `siapkanGambarOcr()` (skala ≤1700px, grayscale + gamma 1.6, tanpa contrast stretch), `ocrBaca()`, `terapkanOcr()` (saran + `tfOcrAt` + `tfOcrText` ≤1200 char), `saranOcr()` per kolom (hanya bila ada isi & berbeda; tanggal = stempel Ref tidak digambar dua kali), `saranTampil()`. `tesseract.js@5.1.1` (sama dengan CDN lama) via dynamic import — tidak di bundle awal. Model bahasa tetap dari jaringan saat worker dibuat, seperti dulu: scan butuh internet.

**Parser OCR transfer** (`feat(reservasi): parser OCR transfer`) — port murni `:8575-8997` ke `app/utils/ocr-transfer.ts`: daftar bank + skor konteks (bank SUMBER, bukan acquirer), tanggal (ISO / "09 Jul 2026" / "01Agu 2026" BRImo tanpa spasi / garis miring), stempel Ref dengan jangkar jam + kalender sungguhan, jam (meridiem dulu, detik ikut, ragu → kosong + `jamRagu()` menyebut angkanya), `jamSeharusnya()`/`tglSeharusnya()` dari teks tersimpan, nominal (label menang, admin/saldo kalah, seri → terbesar), nama pengirim (tak pernah penerima). 14 kasus uji lolos via `node --experimental-strip-types` (bank sumber vs acquirer, 3 format tanggal, stempel ± jangkar, PM/WIB/ragu, nominal vs biaya admin, nama).

**Rumus dana masuk** (`feat(reservasi): rumus dana masuk di dp-reservasi.ts`) — port murni `:8997-9016`, `:9369-9391`, `:9175-9213`, `:1537-1553`: `TxDanaMasuk` (`{r, p, ke, dari}`), `txSemua()` (baris kosong tanpa nominal & bukti dilewati), `txTanggal/txJam/txBank/txNama/txNominal/txSudahScan/txBuktiGambar/txSelisih`, `ringkasDanaMasuk()` (total mengecualikan rejected; rekap per bank memakai seluruh rentang termasuk rejected — quirks lama dipertahankan), `saringDanaMasuk()` (basis Tgl Reservasi/Tgl Uang Masuk, tab verifikasi), `cerminDp()`/`cerminTfUtama()` (field datar cerminan `dps[]` untuk body PATCH, tanpa `updatedAt` — itu milik server). `dpsTampilan()` mengangkat DP datar jadi cicilan-0 READ-ONLY tanpa memutasi daftar (baca tidak boleh menulis ke state bersama); id sintetis stabil `<resId>#dp0`. Tipe `ReservasiDp` tambah `tfTanpaData?: string` (`:9894-9942`) dan `tfOcrSaran` diketik `{date,time,bank,name,amount} | null`.

**Bagian 4c** (`feat(reservasi): dashboard bagian 4c`) — **WA Koordinasi** (`:7640-7712`, `:7762-7770`): sheet "Kirim koordinasi kedatangan" dengan rentang jam (30 menit, pilihan `USelect`), **dua format terpisah** seperti lama — `includeDP` pada target menentukan mana yang dikirim, bukan dua kartu yang dikodekan keras seperti di layar lama: format **koordinasi** (fokus seating: total pax, jumlah reservasi, jumlah meja, satu tamu satu baris) dan **kasir** (fokus DP: total DP dijumlah, jumlah sudah/belum, metode bayar). Ringkasan diletakkan di **atas**, bukan bawah (`:7669-7671`). Sumber daftarnya `semua` — list yang sama dengan denah, jadi yang direkap memang yang terlihat di layar. **Tidak ada API**: teks disusun di browser, "Salin pesan" (`waSalin()`, mengembalikan berhasil/tidak supaya tidakklaim sukses palsu) dan "Buka WhatsApp" (`waKirim()` → `wa.me` + papan klip). Grup tidak punya nomor, jadi teks masuk papan klip lalu `wa.me` dibuka — kreator tinggal pilih grup dan tempel; itu keterbatasan yang sama dengan yang lama hindari dengan tautan undangan yang disimpan per perangkat (`:7775-7779`). Audit `Kirim Koordinasi` dicatat. Emoji tetap di dalam pesan WhatsApp, tidak di UI.

**Bagian 4b** (`feat(reservasi): dashboard bagian 4b`) — **override layout per tanggal + `DenahEditor`** (`:5406-5416`, `:5938-6152`, `:6076-6106`): tombol "Layout: …" & "Editor denah: …" di atas denah, hanya untuk `CAN.master` (manager/admin). Sheet Layout offers bawaan hari / template **per lantai** (menawarkan denah Lt.1 sebagai jadwal Lt.2 menggambar meja lantai yang salah seharian penuh, dan gejalanya "meja saya hilang", bukan pesan galat — `:5955-5962`), "Terapkan ke banyak tanggal", daftar tanggal terjadwal (jadwal template + denah digeser digabung dalam satu daftar), dan "Kembalikan ke bawaan" yang membersihkan **kedua** bentuk penyimpangan sekaligus (`:6093-6101`). Semua tulis lewat `putDenah(section, value, versiSection)` — 4 section terpisah, bukan `PUT /master` blob. Jejak penyunting (F23) tampil di layar, di atas kanvas editor, bukan hanya di `title` tombol (`:6222-6229`). Editor memakai komponen `DenahEditor` milik Tahap 2: `simpanTemplat` (semua tanggal yang memakai template itu ikut) dan `simpanTanggal` (hanya tanggal ini, template tidak disentuh) tetap dua tombol terpisah.

**Bagian 4a** (`feat(reservasi): dashboard bagian 4a`) — tab **Waiting List** (`:1921-1996`): antrean tanggal denah (yang paling lama menunggu di atas) + antrean tanggal lain yang redup. Tambah (tanpa nama → "Walkin"), pax wajib, catatan, dan catatan "sudah diberi tahu". **Dudukkan** bikin reservasi walk-in `Datang` (gelombang kedatangan penuh) **lalu** menandai entri antrean `seated` + `table` + `resId` — urut itu disengaja: kalau reservasinya gagal, tamunya tetap menunggu, bukan ditandai duduk tanpa bukti. "Keluarkan" memakai `PUT` dengan `status: 'cancelled'`, bukan `DELETE`, supaya jejaknya tetap ada di section (meniru `:1958-1961`). Semua tulis lewat `putSectionItem('waitlist', …, versi section)`; section dibaca lewat `useSectionVersi()` yang menyimpan amplopnya, karena `useAsyncData` membuang `meta` sehingga versi section tidak terlihat. Peringatan kalau pax melebihi kapasitas meja yang dipilih, tapi tetap boleh didudukkan (`:1996`).
Helper baru **`app/utils/wa.ts`** (dipakai juga Service Excellent nanti): `waKirim()` membuka `wa.me/<no>?text=` **dan** menyalin teks ke papan klip, `waTautan()`, `teksPanggilAntrean()`. Perbedaan yang disengaja dari Office lama: `waOpen()` membuka `whatsapp://` (aplikasi saja, tanpa cadangan web — `:3285-3290`), dan di browser desktop tombolnya terasa mati. Teks pesan tetap mengikuti teks lama; emoji ada di dalam pesan WhatsApp, bukan di UI.

**Bagian 3** (`feat(reservasi): dashboard bagian 3`) — tab **Kalender** (`:5573-5630`): grid bulan dengan kolom Senin–Minggu, maksimal 3 acara per hari lalu "+n lagi", legenda saringan status, `‹ ›` + "Bulan ini", dan **klik satu tanggal** → pindah ke mode Harian tanggal itu DAN menggeser tanggal denah, lalu membuka tab Tabel (`:5608-5611`). Dibalik: `dari`/`sampai` ikut encompass bulan kalender saat tab itu terbuka (`:5296`), kalau tidak gridnya kosong. Di HP diganti daftar per hari (`AppList`) berisi tanggal yang punya reservasi + jumlah reservasi/pax — grid 7 kolom akan terpotong di 390px. Drag kiri/kanan ganti bulan **tidak** dibangun (bertabrakan dengan scroll layar sentuh; tombol `‹ ›` sudah ada).

**Bagian 2** (`feat(reservasi): dashboard bagian 2`) — tab **Denah Meja**:
- `DenahPeta mode="tampil"` untuk Lt.1 & Lt.2, timer duduk, jumlah antrean di header, plan yang berlaku dicetak namanya.
- Saringan aktif mengunci input (walk-in, pindah/tambah meja) dengan pesan yang menjelaskan alasannya — `:2090-2098`.
- **Aksi cepat** (`:6432-6465`): tandai datang, tamu datang lagi (batas atas 500/gelombang, `:7448-7465`), selesai (tamu pulang), kembali ke meja asli, jadi/batal sharing, pindah meja, tambah meja, batalkan (dengan alasan), buka & sunting.
- Semua aksi tulis = `PATCH /reservations/{id}` dengan `If-Match(updatedAt baris)` + `tanganiKonflik()`; baris yang berubah di luar `dps`/`arrivals` memakai `shallow merge` seperti kontrak.
- Gelombang kedatangan: tamu yang sudah pulang lalu ditandai datang lagi memulai **kunjungan baru** (`:7471-7473`) — ini koreksi 26 Sep 2026 yang kalau tidak ikut, mejanya terbaca kosong padahal tamunya duduk.
- **Walk-in** = `POST /reservations` dengan `source: 'Walk-in'`, `status: 'Datang'`, `arrivals` penuh, `picName` dari sesi.
- **Polling 15 dtk** (`POLL_JEDA = 15000`) **hanya saat tab Denah terlihat**, dan dilewati saat tab browser disembunyikan; `visibilitychange` menarik segera saat kembali. Tutup otomatis 04:00 **tidak** dibangun (F9, `AUTO_TUTUP_AKTIF=false`).
- Baris audit untuk aksi yang tidak tercatat di baris reservasi dikirim lewat `POST /audit`; kegagalannya sengaja ditelan (aksinya sendiri sudah berhasil).



