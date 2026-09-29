# Jadwal (Roster · Jadwal Shift · Daily Worker) — inventaris migrasi

Status: ⚠️ selesai dengan celah
Terakhir diperbarui: 2026-09-29

> **Triase 2026-09-29** — status di tabel E yang bertentangan dengan catatan ini: catatan ini yang berlaku.
> Rincian: [`_pertanyaan.md`](_pertanyaan.md), [`_gap-api.md`](_gap-api.md).
> - Roster → U2. Blok DW → G-03. `setting.manajemen` → G-04. Pax tamu → G-05. Matriks akses DW → T-10. Heads → T-11.

## Ringkasan
- Jumlah layar: 20 (1 pemilih Roster + 8 layar Jadwal Shift + 11 layar Daily Worker; 0 tersembunyi) · Aksi backend lama: 10 (jadwal) + 16 (dw) + 4 (account, lintas modul) · Gap v1: 3 ❌ · 5 ⚠️
- Modul `jadwal` di Vue adalah **satu kartu launcher untuk DUA backend**: Jadwal Shift (kru tetap, izin `jadwal`) dan Daily Worker (part time, izin `dw`), perantara `deploy/roster/index.html`.
- Jadwal Shift = lembar jadwal bulanan/mingguan per divisi + pengajuan off/izin/tukar shift + rekap pegawai + Data Pegawai (HRD) + Pengaturan (shift, head, penempatan).
- Daily Worker = talent pool part-timer (bukan user Office), permintaan head → approve HRD → masuk kalender Jadwal Shift sebagai blok terpisah; kehadiran + pembayaran mingguan dihitung **di browser** (tidak ada tarif di PHP).
- Risiko terbesar saat migrasi: (1) jadwal Vue perlu membaca baris DW tanpa punya modul `dw`; (2) dua kunci izin yang sengaja TIDAK digabung; (3) rumus uang DW (hadir/tarif/tambahan) seluruhnya di klien; (4) divisi kru dikodekan ganda (`DIVISI` kembar di dua berkas + sinonim kata di kolom Tim Office).

## A. Sumber
| jenis | path | baris |
|---|---|---|
| frontend lama (pemilih) | laksamana-office/deploy/roster/index.html | 275 |
| frontend lama (Jadwal Shift) | laksamana-office/deploy/jadwal/index.html | 6.265 |
| frontend lama (Daily Worker) | laksamana-office/deploy/dw/index.html | 8.540 |
| launcher (kartu) | laksamana-office/deploy/index.html (kartu `key:'jadwal'`) | ±1230-1300 |
| backend lama Jadwal | laksamana-office/jadwal-mysql/api.php (+ lib_jadwal_mysql.php, lib_sesi.php, schema.sql) | — |
| backend lama DW | laksamana-office/dw-mysql/api.php (+ lib_dw_mysql.php, lib_sesi.php, schema.sql) | — |
| kontrak v1 Jadwal | laksamana-api/docs/api/jadwal.md | 58 |
| kontrak v1 DW | laksamana-api/docs/api/dw.md | 111 |
| spec port Jadwal | laksamana-api/docs/modules/jadwal.md | 66 |
| spec port DW | laksamana-api/docs/modules/dw.md | 69 |
| rute v1 | laksamana-api/app/Modules/Jadwal/routes/v1.php, app/Modules/Dw/routes/v1.php | — |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:7192-7720 "dw ↔ jadwal…"; :7251, :7271, :7343, :7356, :7419; :7587, :7613, :7630, :7656, :7675, :7684, :7730, :7786, :7907, :7995, :8110; :2707 "Impor jadwal dari Excel" | — |

## B. Akses
- Kunci Modul di launcher: kartu `key:'jadwal'`, `access:['jadwal','dw']`, `bawaan:['jadwal']`, `href:'./roster/'` (`deploy/index.html:1252-1262`). Label akses: `jadwal:'Roster · Jadwal Shift'`, `dw:'Roster · Daily Worker (khusus HR)'` (`deploy/index.html:1254`). `jadwal` **bawaan** untuk tiap akun Office; `dw` TIDAK bawaan — alat HR yang memuat nomor HP talent pool (`deploy/index.html:1240-1252`).
- Pemilih panel membalikkan sesi `lm_session`; kalau hanya `jadwal` → `location.replace('../jadwal/')` tanpa menampilkan pemilih (`deploy/roster/index.html:110-149`). Bila hanya `dw` (hampir selalu salah setel) pemilih TETAP tampil, kartu Jadwal dikunci + menyebut centang yang kurang (`:127-142`, `:257-267`).
- **Jadwal Shift** — akses modul otomatis untuk Tim Kitchen/Bar/Floor/Cashier/HRD/CEO + admin modul (`CLAUDE.md:7245`). Siapa yang **menyusun** ditentukan di Pengaturan → Head Divisi (`bolehUbah(div)`, `deploy/jadwal/index.html:1370`). Admin modul `jadwal` = HRD (`CLAUDE.md:7684`). `bolehBuka(k)` (`:1780`): `pegawai`/`pengaturan` = admin; `rekap` = `bolehRekap()` (admin/manajemen/head, `:1344`); sisanya terbuka.
- **Daily Worker** — peran dihitung server & dikirim `data.peran{hrd,head,lihat,admin}` (`dw.md:36`; `deploy/dw/index.html:1860-1866`). Head hanya melihat/menandai divisinya; HRD memutuskan segalanya; head **tidak melihat angka uang** (`bolehLihatUang()`, `deploy/dw/index.html:1831`, `CLAUDE.md:7613`).
- Matriks halaman × peran DW dapat disunting admin modul (`setting.akses`) kecuali `HALAMAN_KUNCI=['akses']` (`deploy/dw/index.html:2264-2272`, `:2341`, `:8003`).
- Aksi khusus admin: Jadwal — `simpanSetting`, `kosongkanSemua` (`deploy/jadwal/index.html:5134`, `:5297`); DW — `kosongkanSemua`, `simpanSetting` untuk `hr`/`akses`, halaman Hak Akses (`deploy/dw/index.html:7988-8025`).

## C. Daftar layar (dari NAV_DEF / TITLES)

### C.1 Pemilih Roster — `deploy/roster/index.html`
| key | judul | subjudul | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| `jadwal` | Jadwal Shift | "Lembar shift kru tetap per divisi" | pemegang `jadwal` | tidak (terkunci bila tidak berhak) | `:183-187`, `:257-267` |
| `dw` | Daily Worker | "Pekerja harian & part time" | pemegang `dw` | tidak (disembunyikan bila tidak berhak) | `:193-197`, `:268` |

Dikelilingi panel promo "Roster Kru & Daily Worker" / "Satu lembar untuk semua yang masuk hari itu." (`:161-163`).

### C.2 Jadwal Shift — `deploy/jadwal/index.html` (`NAV_DEF:882-905`, `TITLES:1823-1828`)
| key | judul | subjudul | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| dashboard | Dashboard | "Siapa masuk dan siapa libur hari ini" | semua | tidak | `:884`, `:1824` |
| bulanan | Jadwal Bulanan | "Lembar sebulan penuh per divisi" | semua | tidak | `:885`, `:1825` |
| minggu | Input Mingguan | "Susun jadwal satu minggu" | head (divisiLihat) | tidak | `:886`, `:1826` |
| rekap | Rekap Pegawai | "Jadwal sebulan dan jam kerja satu orang" | `bolehRekap()` | tidak | `:887`, `:1827` |
| saya | Jadwal Saya | "Shift saya bulan ini" | semua | tidak | `:889`, `:1828` |
| pengajuan | Pengajuan | "Off, izin, cuti, dan tukar shift" | semua (yang bisa melihat aju) | tidak | `:890`, `:1829` |
| pegawai | Data Pegawai | "Tambah kru baru, ubah data diri, nonaktifkan yang keluar" | `bolehBuka('pegawai')` = admin | tidak | `:894`, `:1830` |
| pengaturan | Pengaturan | "Definisi shift, head divisi, penempatan kru" | admin | tidak | `:895`, `:1831` |

### C.3 Daily Worker — `deploy/dw/index.html` (`NAV_DEF:1254-1300`, `TITLES:2429-2440`)
| key | judul | subjudul | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| dashboard | Dashboard | "Daily worker yang masuk hari ini" | lihat (HRD+head), disaring divisi | tidak | `:1256`, `:2431` |
| hadir | Konfirmasi Kehadiran | "Siapa yang benar-benar datang — inilah dasar pembayarannya" | HRD + head (`bolehBukaBawaan`) | tidak | `:1257-1258`, `:2432` |
| tamu | Kalender Tamu | "Pax dari Marketing, Event & Reservasi — klik hari untuk ajukan DW" | lihat | tidak | `:1259-1260`, `:2433` |
| kalender | Kalender DW | "Sebulan penuh per divisi" | lihat | tidak | `:1264`, `:2435` |
| permintaan | Permintaan DW | "Permintaan divisi Anda & putusannya" | head + HRD | tidak | `:1265`, `:2434` |
| antrean | Antrean Pengajuan | "Setujui atau tolak permintaan & pengajuan DW" | HRD | tidak | `:1266`, `:2436` |
| rekap | Rekap Pegawai | "Jadwal sebulan, jam kerja & upah satu DW" | lihat | tidak | `:1272`, `:2438` |
| bayar | Pembayaran | "Rekap mingguan & daftar transfer" | HRD (`HALAMAN_HR`) | tidak | `:1273`, `:2439` |
| pekerja | Database DW | "Talent pool daily worker" | lihat | tidak | `:1275`, `:2437` |
| pengaturan | Pengaturan | "Tarif, posisi, jam bawaan, panduan jumlah DW" | admin + HRD | tidak | `:1276`, `:2440` |
| akses | Hak Akses | "Siapa yang berhak memutuskan di modul ini" | admin | tidak | `:1284`, `:2441` |

> Catatan `TITLES`: kunci halaman WAJIB punya baris di `TITLES`, kalau tidak alamat `#/`-nya memantul ke Dashboard tanpa galat (kasus nyata `hadir`, `CLAUDE.md:8063` area "TITLES yang hilang"). Vue harus menghasilkan daftar rute dari satu sumber.

## D. Detail per layar

### D.1 Roster — pemilih panel (pemilih, `deploy/roster/index.html`)
- **Tampilan:** dua kartu panel (Jadwal Shift / Daily Worker), nama pengguna dari sesi (`:270-271`), tautan "← Kembali ke Office" (`:200`).
- **Aksi:** `openPanel('jadwal')` → `../jadwal/`; `openPanel('dw')` → `../dw/` (`:234-236`). Bila hanya `dw`, kartu Jadwal dikunci: `disabled`, teks diganti `"Belum diberi akses — minta admin mencentang \"Roster · Jadwal Shift\" di Kelola Akses Office"`, panah jadi `🔒` (`:257-266`).
- **Catatan:** ini murni pengalih; di Vue cukup satu halaman `app/pages/jadwal/index.vue` yang menyajikan tab/segmen "Jadwal Shift" & "Daily Worker" sesuai `access:['jadwal','dw']`, tanpa perlu pemilih terpisah.

### D.2 dashboard — Dashboard (Jadwal Shift)
- **Tampilan:** pemilih tanggal + segmen divisi (Semua + 4), tiga statistik (Masuk / Off-Cuti / belum?), tabel **Masuk** (No, Nama+jabatan, Divisi, Shift, Jam) & tabel **Tidak Masuk** (No, Nama, Shift), pager 10 baris/halaman, chip rincian per shift. Panduan 3 langkah muncul hanya bila belum ada satu sel terisi (`panduanAwalHTML`, `:2498`).
- **Perhitungan browser:** `dashKru()` menyaring `divisiDari(u)!==DIV_NONSHIFT` (`:2474`); urut `jam|nama|divisi` (`:2555-2565`); `jamSel(c)` menurunkan jam shift.
- **Aksi:** klik sel → `bukaEditor(uid,tgl)` bila `bolehUbah(div)` (`:2579`); navigasi tanggal `dashGeser/dashSet/dashHariIni` (`:2733-2735`); ganti divisi `dashDiv` (`:2736`); urut `dashUrut` (`:2728`).
- **Bukti:** `:2539-2740`.

### D.3 bulanan — Jadwal Bulanan
- **Tampilan:** satu baris per orang, sebulan penuh menyamping (`table.sched.bulanan.lurus`), kolom NAMA + BEBAN BULAN INI (`<b>N</b> masuk` / `N off · N jam`), tab divisi + **Semua** (`DIV='ALL'` menggambar `divhdr` per divisi). Blok DAILY WORKER ditempel di bawah kru tiap divisi (`blokDW`, `:1545`).
- **Aksi:** klik sel → editor (per divisi, `bisaDiv`); `gantiDiv`, `geserBulanAktif(+/-1)`, `bulanIni` (`:3315-3317`); kotak cari nama (muncul bila ≥8 kru, `setCariBulan` `:2768`); ekspor (lihat D.9).
- **Perhitungan browser:** `bebanKru(u,mk)` → `{masuk, libur, kosong, jam}` (`:3067`); `rekapBulan` (`:3104`); `luarBulan`/`pitaBulan`.
- **Bukti:** `:2773-2980`.

### D.4 minggu — Input Mingguan
- **Tampilan:** satu tabel per divisi, kolom 7 tanggal (Senin–Minggu), baris per kru, tombol **Input Mingguan** per baris (isi satu minggu), blok DAILY WORKER (read-only); tab divisi + **Semua**. Alat massal hanya saat satu divisi dipilih & head-nya.
- **Aksi (teks persis):** `📋 Salin Minggu Lalu`, `⚡ Isi Jadwal` (dulu "Isi Sel Kosong", `CLAUDE.md:7343`), `📥 Impor dari Excel`, `🧹 Kosongkan`, `📗 Excel Seminggu`, `🖼️ PNG Seminggu`, `💬 Teks WA`, `🖨️ Print / PDF` (`:3400-3456`). `gantiDivMinggu`, `geserMinggu`, `mingguIni` (`:3458-3463`).
- **Editor sel** (`bukaEditor` `:3469`, `gambarEditor` `:3487`): pilihan shift (tombol berwarna + jam), `Jam Masuk`/`Jam Pulang` (kosongkan = balik ke jam bawaan), `Catatan di dalam sel` (maxlength 20, teks ini menggantikan nama shift). Sel kosong dibuka **tanpa** shift terpilih; Simpan mati sampai dipilih. `simpanSel` (`:3534`), `hapusSel` → toast `'Sel dikosongkan'` (`:3545`).
- **Alat massal:** `salinMingguLalu` (`:3615`), `isiSisa`/`gambarIsiSisa`/`isiSisaPilih` (`:3702-3857`) — `timpa` bawaan `true`, tiap bentrok didaftar `htmlTimpa` (`:3586`), `konfirmasi` (`:3600`); `isiBaris` satu orang 7 hari (`:4206`); `kosongkanMinggu` (`:4342`).
- **Impor Excel:** `imporTempel` (`:3991`), `imporParse` (`:3925`, murni) membaca 5 bentuk tanggal (`impTgl` `:3873`), nama dicocokkan `impCocokNama` (`:3910`), pratinjau `imporPratinjauHtml` (`:4111`), simpan `imporSimpan` (`:4175`) lewat `tulisSel` yang sama.
- **Perhitungan browser:** `durasiJam(m,s)` (`:4465`), `jedaKeBesok` (`:3084`), `salinBulanJalan`.
- **Bukti:** `:3324-4370`; aturan di `CLAUDE.md:7356-7418` (tempel Excel), `:7343-7355` (Isi Jadwal).

### D.5 rekap — Rekap Pegawai (Jadwal)
- **Tampilan:** pemilih kru per divisi (optgroup), kalender bulan, statistik (Hari Masuk, Off/Cuti, Total Jam, Rata Jam/Hari, Beruntun Terpanjang, Masuk Akhir Pekan, Jeda Tersingkat, Belum Diatur), alarm beban (`maksBeruntun` bawaan 6, `jedaMin` bawaan 10 — `:3291-3294`), chip rincian shift, daftar pengajuan bulan itu.
- **Perhitungan browser:** `bebanKru` (`:3067`), `rekapDetail` (`:3166`), `rincianShift` (`:3157`), `rekapKandidat` (`:3148`).
- **Aksi:** `pilihRekap`, `bukaEditor`, `geserBulanAktif`, `🖨️ Print / PDF` (`:3296`). `bolehRekap()` = admin/manajemen/head (`:1344`).
- **Bukti:** `:3179-3305`.

### D.6 saya — Jadwal Saya
- **Tampilan:** kalender bulan pribadi (shift per tanggal + jam), empat statistik (Hari Masuk, Off/Cuti, Total Jam, Pengajuan Menunggu), panel "Pengajuan menunggu", petunjuk "👆 Klik tanggal mana pun …" di ATAS kalender.
- **Aksi:** `+ Ajukan Off / Izin` → `bukaAjukan()` (`:4370`, `:4850`); klik tanggal → `bukaAjukan(d)`; `bukaAjukan` form (D.8).
- **Perhitungan:** loop harian menghitung `masuk/libur/jam`; `ajuSaya()` menyaring `userId===ME.id` (`:4470`); `ajuPeta` menandai tanggal yang sedang diajukan (MENUNGGU menang).
- **Bukti:** `:4370-4464`.

### D.7 pengajuan — Pengajuan
- **Tampilan:** 3 tab selalu ada + angka: **Antri / Riwayat / Semua** (`AJU_TAB`, `:4564`), baris tabel (jenis, nama, divisi, rentang, shift, alasan, status, jejak penyetuju, tombol), pager `AJU_TAMPIL`/halaman, kotak cari nama (`setCariAju`).
- **Aksi (teks persis):** langkah head → `✓ Teruskan ke HRD`; langkah HRD → `✓ Sahkan`; `✕ Tolak`; kru/batal → tarik pengajuan (`batalAju` `:5122`). `putuskan(id,status)` (`:5019`), `tanyaAlasanTolak` (`:5069`, default `'Tidak disetujui head divisi'`), `kirimPutusan` (`:5088`).
- **Ajukan (form):** `bukaAjukan` (`:4831`): field `Jenis` (`JENIS_AJU_PILIH`), `Tanggal` (satu tanggal), keterangan shift sekarang (`gambarShiftSekarang` `:4882`), pilihan `Shift yang diminta` (untuk TUKAR), `Alasan / Keterangan`. `kirimAju` (`:4943`) mengirim `{id, userId, jenis, dari, sampai=dari, alasan, shift, jamMulai:'', jamSelesai:''}`; validasi: `'Kru belum dipilih'`, `'Tanggal belum diisi'`, `'Isi alasannya dulu'`, `'Pilih shift yang diminta dulu'`; tombol dikunci (`'Mengirim…'`) cegah dobel.
- **Dua langkah persetujuan:** `MENUNGGU --head--> MENUNGGU_HRD --HRD--> DISETUJUI` (DITOLAK di kedua langkah); sel jadwal ditulis hanya saat DISETUJUI (`kirimPutusan` `:5088-5120`); head tidak bisa melangkah pertama bila divisi punya head; HRD tidak bisa langkah pertama (`CLAUDE.md:7271-7342`).
- **Bukti:** `:4595-5132`.

### D.8 pegawai — Data Pegawai (Jadwal)
- **Tampilan:** tapis Aktif/Nonaktif/Semua + angka, filter divisi (termasuk "Tidak dijadwalkan" = `DIV_NONSHIFT`), kotak cari (nama, Tim, HP, Employee ID, jabatan) dengan sorot `<mark>`, tabel (Nama, Tim Office, Divisi, No HP, Employee ID, Status, Aksi), penanda "penempatan manual".
- **Aksi (teks persis):** `+ Tambah Kru`; per baris `Ubah`, `Nonaktifkan`/`Aktifkan`, `Hapus` (hanya muncul bila sudah nonaktif). `pegBersih` (bersihkan semua saringan), `pegSetTapis`, `pegCari` (`:2146-2166`).
- **Form data diri** (`bukaFormPegawai` `:2168`, `gambarFormPegawai` `:2185`): `Nama *` (wajib, `'Nama wajib diisi'`), `Tim / Divisi` (+ tombol cepat Bar/Kitchen/Floor/Cashier/Office), `Nomor HP`, `Employee ID Talenta`, `Branch`, `Organization`, `Job Position`, `Job Level`, `Employment Status`, `Tanggal Masuk`. PIN/username/hak akses TIDAK tersentuh (`:2246`). Akun baru → **PIN 1111** (`:2244`).
- **Aksi server:** `rosterSaveUser`, `rosterSetActive`, `rosterHapusUser` ke **account-api** (`:2254`, `:2353`, `:2338`), pesan galat dipetakan `pesanGagalRoster` (`:1999`): `forbidden`, `missing_fields`, `name_taken`, `talenta_taken`, `not_found`, `cannot_deactivate_self`, `cannot_deactivate_admin`, `cannot_delete_self`, `cannot_delete_admin`, `must_deactivate_first`. Hapus permanen hanya untuk akun yang sudah nonaktif (`CLAUDE.md:7419-7500`).
- **Bukti:** `:2048-2380`.

### D.9 pengaturan — Pengaturan (Jadwal)
- **Tampilan:** panel **Definisi Shift** (nama, jam, warna, centang "tidak masuk"; tombol `🗑` hanya untuk shift buatan sendiri), **Head Divisi** (centang per divisi + tombol `💾 Simpan` & pita "belum disimpan"), **Penempatan Kru** (select divisi per kru + `📈 Rekap` + shift kebiasaan), **🧹 Mulai Dari Nol**.
- **Perhitungan/perilaku:** setting = satu blob; perubahan panel Head & Kru **menumpuk sampai Simpan**, lalu `simpanSetting` menggabungkan blob server dengan bagian yang disunting (`KUNCI_SETTING`/`SETTING_KOTOR`, `:1677-1735`, `:953-970`). `beforeunload` mengingatkan bila ada yang belum disimpan.
- **Aksi:** `tambahShift` (`:5343`), `hapusShift` (`:5382`), `ubahShift` (`:5401`), `ubahHead` (`:5406`), `ubahManajemen` (`:5413`), `ubahDivisi` (`:5420`), `ubahShiftKru` (`:5442`), `toggleKantor` (`:5335`), `bukaKosongkan`/`kosongkanSemua` (`:5297`, `:5323`, sandi `'HAPUS SEMUA'`).
- **Bukti:** `:5133-5345`.

### D.10 dashboard — Dashboard (Daily Worker)
- **Tampilan:** navigasi tanggal, pita panduan, statistik (DW Masuk [+ "N tidak hadir"], Menunggu (hari ini), Menunggu (semua), Permintaan Head, Belum dikonfirmasi, Total Jam, Est. Biaya khusus HRD), tabel DW (No, Daily Worker, Divisi, Posisi, Jam, Durasi, [Est. Biaya], [Kehadiran], aksi), panel "📋 Permintaan head yang menunggu" & "Menunggu keputusan Anda", peringatan lebih dari panduan.
- **Penyaringan:** seluruh daftar & angka disaring `divisiTampakDW()` (head hanya divisinya) kecuali HRD/admin (`:2650`, `CLAUDE.md:7995`).
- **Aksi:** baris klik → `bukaAjuan`; tombol per baris `💬 Chat` (`tombolWA`), `Tidak hadir`/`↩ Batal` (`tombolAlfa`), `Kehadiran` (`tombolKehadiran`) — semua `event.stopPropagation()`.
- **Perhitungan browser:** `biayaListDW`/`jamListDW`/`alfaListDW` (`:1157-1160`); `hadirTertunggak()` (`:6577`); `kuotaDiv`/`lampauiPanduan` (`:2828`, `:2848`).
- **Bukti:** `:2650-2816`.

### D.11 hadir — Konfirmasi Kehadiran
- **Tampilan:** navigasi tanggal (satu tanggal per layar), statistik (Disetujui, Hadir/Telat, Tidak hadir, Belum dikonfirmasi), tabel (No, Daily Worker+nota, Divisi/Posisi, Jam, Kehadiran+jejak, Tindakan). Head hanya melihat divisinya.
- **Aksi (teks persis):** `Hadir`, `Telat`, `Tidak hadir`, `↔ Ganti orang`, `💬 Chat`. `setHadir(id,nilai)` mengirim `simpanHadir` (`:6582`), `nilai=''` = reset. `bukaGantiOrang`/`gantiOrangKirim` → `gantiOrang` (`:6604`, `:6650`).
- **Aturan:** hanya baris `DISETUJUI`; tanggal belum lewat → tombol konfirmasi disembunyikan, Chat tetap ada (`:6697`, `:6732`); gerbang di fungsi + server `wajib_hadir` (`CLAUDE.md:7786-7906`).
- **Bukti:** `:6750-6849`.

### D.12 tamu — Kalender Tamu
- **Tampilan:** kisi 42 kotak (Senin mulai), tiap kotak = total pax + judul acara (max 2) + "N reservasi" + "N DW"; legenda Marketing/Event/Reservasi; statistik (Total Pax, Acara, Reservasi Meja, Hari Ada Tamu, Hari Tanpa DW); tombol `↻ Muat ulang`.
- **Sumber:** `TAMU_SUMBER` = Marketing + Event + Reservasi dibaca langsung dari API masing-masing (`deploy/dw/index.html:971-979`); `paxTgl = paxAcaraTgl + paxRsvTgl` (`:2193`); no-show = 0 pax (`:2182`).
- **Perhitungan browser:** `paxAcaraTgl` (`:2179`) dipakai `konteksHari()` (panduan kuota), BUKAN `paxTgl` (`CLAUDE.md:7675-7683`).
- **Aksi:** klik kotak → `ajukanTgl(iso)` (`:5471`) buka form Ajukan DW.
- **Bukti:** `:5340-5470`.

### D.13 kalender — Kalender DW
- **Tampilan:** satu baris per orang, sebulan penuh menyamping (kembar dengan Jadwal Bulanan), baris HARI (SEN..MIN), kolom BULAN INI "TERJADWAL"; tombol `+ Tambah DW` dan `Input Mingguan` per konteks; hanya DW yang punya ajuan/ ditambahkan.
- **Aksi:** klik sel → `isiSelDW` (`:4990`) menyusun pengajuan (menulis `simpanAjuan` `:5922`), `+ Tambah DW` (`lembarTambahOrang` `:4607`), `kalenderDiv`, `geserBulanAktif`, `bulanIni`, `simpanSelDW` (`:5135`), `kirimBarisDW` (`:5289`).
- **Aturan:** head boleh mengisi lembar divisinya → hasilnya pengajuan MENUNGGU, bukan jadwal jadi (`bolehIsiKalender` `:4978`); dw_ajuan divisi/posisi **tunggal** (csv_utama), `bentrokOrangJam` cek ±hari (`:5784`, `CLAUDE.md:7630`).
- **Bukti:** `:4716-5340`.

### D.14 permintaan — Permintaan DW
- **Tampilan:** dua tab (Antrian/Riwayat) di halaman head; baris permintaan (divisi, jumlah, tanggal, jam, posisi, usulan, status), tombol `Setujui`/`Batal`/`Hapus`.
- **Aksi:** `bukaMinta` (`:3256`, form Minta DW dengan centang "saya sudah tahu orangnya"), `kirimMinta` (`:3541`) → `simpanPermintaan`, `batalPermintaan` (`:3583`), `hapusPermintaan` (`:3632`), `tolakPermintaan` (`:3653`), `setujuiPermintaan` (`:3687`), `bukaTunjuk`/`gambarTunjuk`/`kirimTunjuk` (`:3707-3903`) → `tugaskanDW`.
- **Aturan:** form Minta punya tiga pintu (Minta DW, sel kalender, Ajukan DW) yang semuanya menuntut `Keterangan` untuk non-HRD (`catatanWajibDW` `:3205`, `tahanCatatanKosong` `:3244`, `CLAUDE.md:7907-7994`); `usulan` disaring server; kandidat diurut beda head (`'sering'`) vs HRD (`'lama'`) (`kandidatDW` `:3125`).
- **Bukti:** `:2963-3904`.

### D.15 antrean — Antrean Pengajuan
- **Tampilan:** tab Antrian/Riwayat, tabel gabungan permintaan head + pengajuan DW (kolom Jenis), pager, kotak cari; pemisah Antrian↔Riwayat berdasarkan **masih ada pekerjaan** (`entriPerluDikerjakan` `:2941`), bukan status (`CLAUDE.md:7730`).
- **Aksi (teks persis):** `Setujui`, `Setujui semua`, `Tolak`, `Setuju & Pilih DW`, `Kembalikan`. `setujuiAjuan`/`setujuiBanyak`/`putusAjuan` (`:4314`, `:4484`, `:4427`), `kembalikanAjuan`/`kembalikanPermintaan` (`:4366`, `:4395`).
- **Bukti:** `:3912-4560`.

### D.16 rekap — Rekap Pegawai (DW)
- **Tampilan:** pemilih DW (dikelompokkan per divisi yang ia pegang, + "• Tanpa divisi"), kalender bulan, statistik jam/upah, tabel ajuan bulan itu.
- **Perhitungan browser:** `rekapAjuanDW` (`:6963`), `rekapBebanDW` (`:6973`); hanya `DISETUJUI` dihitung terjadwal; `hadirDibayar` = `ALFA` tidak dibayar, `''`/`HADIR`/`TELAT` dibayar penuh (`:1137`).
- **Aksi:** `pilihRekapDW`, klik tanggal → `ajukanTgl(tgl,dwId)` (`CLAUDE.md:8110` area "estimasi mengikuti"), `🖨️ Print`.
- **Bukti:** `:7011-7195`.

### D.17 bayar — Pembayaran
- **Tampilan:** navigasi minggu, statistik (Daily Worker, Total Shift, Transfer Terkirim, Total Dibayar), pita sisa transfer & alfa/belum dikonfirmasi & nomor belum diisi & nominal Rp 0, segmen ALL/BANK/GOPAY/DANA, toggle **Per tujuan**/**Per orang**, tabel transfer dengan tombol `Tandai`/`✓ Batal`.
- **Perhitungan browser:** `rekapBayar(senin)` (`:7196`) mengelompokkan per tujuan (`kunciBayar` `:6931`); `tarifPosisi` (`:1781`), `tambahanJam` (`:1800`), `biayaSatuOrang = tarif + tambahan` (`:1812`), `bayarLunasPeta` dari setting (`:6880`); `toggleBayarLunas` → `tandaiBayar` (`:6886`).
- **Aksi:** `bayarFilter`, `bayarGabung`, `bayarGeser`/`bayarMingguIni`, `📋 Salin daftar` (`salinBayar` `:7398`), `🖨️ Print`.
- **Bukti:** `:7232-7422`.

### D.18 pekerja — Database DW
- **Tampilan:** segmen Semua/Aktif/Nonaktif + angka, kotak cari (nama/HP/skill), tabel (Nama+area, No HP, Divisi/Posisi, Kerja `N×`+jam, Status, Aksi), catatan "Daily worker tidak punya akun".
- **Form pekerja** (`bukaPekerja` `:6221`): `Nama lengkap *`, `No. HP *`, `Divisi` (multi, pertama = utama), `Posisi` (multi, mengikuti divisi), `Gender`, `Area tinggal`, `Bayar lewat` (BANK/GOPAY/DANA), `Nama bank` (datalist, hanya BANK), `No. rekening`/label sesuai jenis, `Skill`, `Status`, `Catatan HR`. Validasi: `'Nama wajib diisi'`, `'No. HP wajib diisi'`, `'Centang minimal satu divisi'`.
- **Aksi:** `+ DW Baru`, `Sunting`, `Hapus` (`hapusPekerja` `:6303`, peringatan riwayat), `Nonaktifkan`/`Aktifkan` (`ubahStatusPekerja` `:6332`), `Profil` (`bukaProfil` `:6468`), `simpanPekerja` (`:6355`).
- **Bukti:** `:6032-6460`.

### D.19 pengaturan — Pengaturan (DW)
- **Tampilan:** **Posisi per Divisi** (tarif per posisi, `+ Tambah`, `×` hapus), **Jam siap pakai**, **Shift dasar & shift panjang** (`Shift dasar (jam)`, `Tambahan shift panjang`, `Batas kewajaran (jam)`), **Panduan jumlah DW per hari** (kuota per divisi × biasa/weekend/event), **🧹 Mulai Dari Nol**.
- **Aksi:** `tambahPosisi` (`:8237`), `hapusPosisi` (`:8246`), `ubahTarif` (`:8169`), `tambahJam`/`ubahJam`/`hapusJam` (`:8270-8272`), `ubahAngkaShift` (`:8277`), `ubahKuota` (`:8294`), `bukaKosongkan`/`kosongkanSemua(ikutPekerja)` (`:7896`, `:7920`, sandi `'HAPUS SEMUA'`).
- **Aturan:** tarif dipakai bersama antar-divisi (kunci = string posisi, ejaan `Waiter/Waitress` & `Dishwasher` dipertahankan); `jamBatas` tidak mengubah harga (`CLAUDE.md:7656`).
- **Bukti:** `:7805-7900`, `:8160-8304`.

### D.20 akses — Hak Akses (DW)
- **Tampilan:** matriks Halaman × peran (Staf Office / Head Divisi / HRD / Admin Modul) yang bisa diklik admin modul, penanda `•` = "diubah dari bawaan", baris `terkunci — admin modul saja` untuk Hak Akses; daftar HRD (`toggleHR`); tombol `Kembalikan ke bawaan`.
- **Peran:** `peranOrangDW` = admin (dari Kelola Akses) + hrd (dicentang) + head (dari Jadwal Shift `headIds`) (`:8041`).
- **Aksi:** `toggleAkses` (`:8003`), `resetAkses` (`:8017`), `toggleHR` (`:8162`); pesan `'Hanya admin modul yang bisa mengubah hak akses'`, `'Halaman Hak Akses tidak bisa dibagikan — …'`, `'Tidak ada yang diubah dari bawaan'`.
- **Bukti:** `:7962-8161`.

## E. Pemetaan backend

### E.1 Jadwal Shift (`jadwal-api-mysql`, `/api/v1/jadwal`)
| action lama | dipakai di layar | baca/tulis | endpoint v1 | status | catatan |
|---|---|---|---|---|---|
| `getAll(dari,sampai)` | semua layar (boot) | baca | `GET /cells` + `GET /requests` + `GET /settings` | ⚠️ | kontrak memecahnya granular; legacy satu balasan `{setting, sel, pengajuan}` (`deploy/jadwal/index.html:1456`, `jadwal.md:27,41,56`) |
| `jadwalDW(dari,sampai)` (OPEN, dari modul DW) | dashboard/bulanan/minggu (blok DW) | baca | `GET /api/v1/dw/schedule` | ❌ | v1 butuh modul `dw`; pemegang `jadwal` saja tidak punya. `dw.md:109-111` menyebut route kompat lama tetap ada. Lihat I. |
| `shiftHari(user,dari,sampai)` (OPEN) | dipakai absensi, bukan layar ini | baca | `GET /shifts` | ✅ | `jadwal.md:61` |
| `headIds` (OPEN) | jadwal sendiri tidak; dipakai account/dw/absensi | baca | `GET /heads` | ⚠️ | bentuk legacy `{div:[uid]}` vs v1 `{uid:[div]}` (`jadwal.md:58`); `deploy/dw/index.html:2157` membaca `data.heads` |
| `simpanSel(rows,hapus)` | bulanan/minggu/dashboard/pengajuan disetujui | tulis | `PUT /cells` | ✅ | `jadwal.md:28`; legacy memeriksa tiap baris `jdw_wajib_boleh_baris` |
| `simpanSetting(data)` | pengaturan | tulis | `PUT /settings` (admin) | ✅ | `jadwal.md:57` |
| `simpanPengajuan(row)` | Ajukan (saya/rekap) | tulis | `POST /requests` | ✅ | `jadwal.md:42` |
| `putusPengajuan(id,status,nota)` | pengajuan | tulis | `POST /requests/{id}/decision` | ✅ | dua langkah; `jadwal.md:43` |
| `hapusPengajuan(id)` | pengajuan/saya | tulis | `DELETE /requests/{id}` | ✅ | `jadwal.md:44` |
| `kosongkanSemua('HAPUS SEMUA')` | pengaturan | tulis | `DELETE /cells` | ✅ | `jadwal.md:29` |
| `listDivisiRoster` (account-api) | boot roster | baca | `GET /api/v1/jadwal/roster` atau `GET /api/v1/account/roster` | ✅ | `jadwal.md:50`; `Account/routes/v1.php:17` |
| `rosterSaveUser`/`rosterSetActive`/`rosterHapusUser` (account-api) | pegawai | tulis | `POST /account/roster`, `PUT /account/roster/{id}/active`, `DELETE /account/roster/{id}` | ⚠️ | ada di kontrak **Account**, tidak disebut di `jadwal.md`; perlu cek scope/hak |
| `ping`/`stats` | diagnostik (tidak dipanggil layar ini) | baca | — (Laravel health) | — | bukan gap UI; tak ada pemanggil di frontend |

### E.2 Daily Worker (`dw-api-mysql`, `/api/v1/dw`)
| action lama | dipakai di layar | baca/tulis | endpoint v1 | status | catatan |
|---|---|---|---|---|---|
| `getAll(dari,sampai)` | semua layar | baca | `GET /overview` | ✅ | satu-call bootstrap + `peran` (`dw.md:20,36`) |
| `jadwalDW` (OPEN) | dipakai modul Jadwal, bukan di sini | baca | `GET /schedule` | ✅ | `dw.md:23,37` |
| `simpanPekerja(row)` | pekerja | tulis | `POST /workers`, `PUT /workers/{id}` | ✅ | `dw.md:46,48` |
| `hapusPekerja(id)` | pekerja | tulis | `DELETE /workers/{id}` | ✅ | `dw.md:49` |
| `simpanAjuan(row)` | kalender/tamu/rekap | tulis | `POST /assignments` | ✅ | `dw.md:72`; overlap → `409` |
| `simpanPermintaan(row)` | permintaan | tulis | `POST /requests` | ✅ | `dw.md:58` |
| `putusPermintaan(id,status,nota)` | permintaan | tulis | `POST /requests/{id}/decision` | ✅ | `dw.md:61` |
| `tugaskanDW(permintaanId,dwIds[])` | permintaan/antrean | tulis | `POST /requests/{id}/assign` | ✅ | `dw.md:62`; `tertahan[]` |
| `putusAjuan(id,status,nota)` | antrean | tulis | `POST /assignments/{id}/decision` | ✅ | `dw.md:74` |
| `putusBanyak(ids,status,nota)` | antrean | tulis | `POST /assignments/decisions` | ✅ | `dw.md:75` |
| `hapusAjuan(id)` | kalender/antrean | tulis | `DELETE /assignments/{id}` | ✅ | `dw.md:76` |
| `hapusPermintaan(id)` | permintaan | tulis | `DELETE /requests/{id}` | ✅ | `dw.md:63` |
| `simpanHadir(id,hadir,nota)` | hadir/dashboard | tulis | `POST /assignments/{id}/attendance` | ✅ | `dw.md:84` |
| `gantiOrang(id,dwBaru,nota)` | hadir | tulis | `POST /assignments/{id}/replace` | ✅ | `dw.md:85` |
| `tandaiBayar(senin,kunci,nyala)` | bayar | tulis | `POST /payments/marks` | ✅ | `dw.md:93` |
| `simpanSetting(data)` | pengaturan/akses | tulis | `PUT /settings` | ✅ | `dw.md:102`; `hr`/`akses` dipertahankan |
| `kosongkanSemua(konfirmasi,pekerja?)` | pengaturan | tulis | `POST /admin/clear` | ✅ | `dw.md:103` |
| `listModuleRoster{module:'dw'}` (account-api) | akses | baca | `GET /api/v1/account/modules/dw/members` | ⚠️ | ada di Account (`Account/routes/v1.php:18`), tidak disebut `dw.md` |
| `headIds` (jadwal) | akses (kolom Head) | baca | `GET /api/v1/jadwal/heads` | ⚠️ | lintas modul; bentuk terbalik (E.1) |
| sumber pax (marketing/event/reservasi) | tamu | baca | `GET /marketing/events?from&to`, `GET /marketing/events-on/{date}`, `GET /event/events-on/{date}`, `GET /reservasi/reservations` | ❌ | tidak ada endpoint agregat; `dw.md:22` menyatakan "No DW endpoint". `satukan()` legacy dipakai bersama Radar (`deploy/dw/index.html:971-979`) |
| `ping`/`stats` | diagnostik (tidak dipanggil layar ini) | baca | — (Laravel health) | — | bukan gap UI; tak ada pemanggil di frontend |

**Konkurensi:** kedua modul tanpa kolom versi — tulisan last-wins per baris; DW overlap dijaga `bentrok_ajuan_row` (`dw.md:107`); tick pembayaran diserialkan `SELECT … FOR UPDATE` (`dw.md:93`). Jadwal tidak punya penjaga bentrok (dua head bisa saling menimpa sel; alat massal mengonfirmasi daftar timpa di layar).
**Kode error yang wajib ditangani UI:** `unauthenticated`, `module_not_granted`, `forbidden` (403), `not_found` (404), `overlap` (409) + `error.details.bentrok`, `rejected` (422), serta pesan lama `sesi_tidak_sah:` / `tanpa_modul:` / `tidak_berhak:` (`deploy/jadwal/index.html:1432`, `deploy/dw/index.html:1907`, `dw.md:11-14`).

## F. Aturan bisnis yang wajib dibawa
1. **Divisi kru berasal dari kolom Tim Office (kata kunci) + `divOverride`** — kitchen/dapur, bar/bartender, floor/service/waiter/**foh**, cashier/kasir; `office`/`kantor` menang → `nonshift`. `foh` = `floor` (fix owner). Bukti: `jadwal.md:50-51`, `deploy/jadwal/index.html:1215-1260`.
2. **Kode divisi `bar|kitchen|floor|cashier` WAJIB identik di Jadwal & DW** — salah satu diubah membuat DW divisi itu hilang dari lembar tanpa error. Bukti: `CLAUDE.md:7192-7210`, `deploy/dw/index.html:997-1002`.
3. **Hak akses ditegakkan di SERVER** (dua modul ini beda dari yang lain) — tiap permintaan membawa `sesi` yang diverifikasi ke account-api. Bukti: `CLAUDE.md:7227-7245`, `deploy/jadwal/index.html:1428-1445`.
4. **Head hanya menyusun divisinya; belum ada head → semua boleh** (`adaHead()`), sepasang dengan `jdw_ada_head()`. Bukti: `deploy/jadwal/index.html:1366-1385`.
5. **Dua langkah persetujuan; sel ditulis hanya di langkah HRD** (`MENUNGGU→MENUNGGU_HRD→DISETUJUI`); HRD tidak boleh langkah pertama; divisi tanpa head dikecualikan. Bukti: `deploy/jadwal/index.html:5019-5130`, `CLAUDE.md:7271-7342`.
6. **Pengajuan SATU TANGGAL** (bukan rentang); `sampai` tetap dikirim = `dari`. Bukti: `deploy/jadwal/index.html:4860-4868`, `CLAUDE.md:7330`.
7. **"Isi Jadwal" tanpa hari tercentang, `timpa` bawaan `true`, bentrok dikonfirmasi satu per satu.** Bukti: `deploy/jadwal/index.html:3702-3777`, `CLAUDE.md:7343`.
8. **Impor Excel memakai template ekspor yang sama; tanggal dari tempelan tidak pernah ditebak; nama luar divisi dilewati.** Bukti: `deploy/jadwal/index.html:3925-4205`, `CLAUDE.md:7356`.
9. **Data Pegawai hanya mengurus DATA DIRI** — tidak menyentuh tabel `grants`/`admins`; `simpan_user_inti` selalu menulis `pin` & `active`; hapus permanen hanya setelah nonaktif. Bukti: `CLAUDE.md:7419-7500`.
10. **DW bukan user Office** (tidak login); head mengajukan → HRD menyetujui & menunjuk; orangnya dikabari WhatsApp. Bukti: `CLAUDE.md:7192`, `deploy/dw/index.html:6200`.
11. **DW satu orang boleh beberapa divisi/posisi (CSV, pertama = utama); `dw_ajuan.divisi/posisi` tetap tunggal.** Bukti: `CLAUDE.md:7587-7612`.
12. **Head tidak melihat angka uang** (`bolehLihatUang()`); hanya tampilan — `setting.tarif` tetap ikut balasan. Bukti: `deploy/dw/index.html:1831`, `CLAUDE.md:7613`.
13. **DW dobel shift sehari sah selama jam tidak bertindih; cek ±1 hari (lewat tengah malam).** Bukti: `deploy/dw/index.html:5784`, `CLAUDE.md:7630`.
14. **Tarif = harga satu shift dasar; shift > `jamDasar` dapat `tambahanPanjang`; `jamBatas` tidak mengubah harga.** Bukti: `deploy/dw/index.html:1800-1812`, `CLAUDE.md:7656`.
15. **Kalender Tamu membaca tiga modul; panduan jumlah DW memakai pax ACARA saja (`paxAcaraTgl`), bukan `paxTgl`.** Bukti: `deploy/dw/index.html:2179-2193`, `CLAUDE.md:7675`.
16. **Tim HRD otomatis admin modul `jadwal`+`dw`; CEO tidak.** Bukti: `CLAUDE.md:7684`.
17. **Satu formulir Minta DW dengan centang "saya sudah tahu orangnya"; nama jadi `usulan` (CSV), bukan ajuan.** Bukti: `CLAUDE.md:7692-7729`.
18. **Satu meja HRD (Antrean, HRD-only) & satu meja head (Permintaan DW); Antrian↔Riwayat dipisah menurut masih ada pekerjaan.** Bukti: `CLAUDE.md:7730-7774`, `deploy/dw/index.html:2941`.
19. **`KEDALUWARSA` ditulis saat DIBACA (bukan cron), hari dihitung WIB.** Bukti: `CLAUDE.md:7775`, `dw.md:36`.
20. **`hadirDibayar`: `ALFA` tak dibayar, `''`/`HADIR`/`TELAT` dibayar penuh; `''` = belum dikonfirmasi & tetap dibayar.** Bukti: `deploy/dw/index.html:1137`, `CLAUDE.md:7786`.
21. **Ganti orang melahirkan baris BARU (`DISETUJUI`+`HADIR`), baris lama → `ALFA` "Digantikan <nama>", `permintaan_id` ikut.** Bukti: `dw.md:85`, `CLAUDE.md:7786`.
22. **Keterangan WAJIB di tiap pengajuan DW (non-HRD), ditahan bukan diperingatkan, di ketiga pintu.** Bukti: `deploy/dw/index.html:3205-3255`, `CLAUDE.md:7907`.
23. **Dashboard DW disaring per divisi head; tombol Kehadiran/Tidak hadir/Chat ada di barisnya, bukan di modal Detail.** Bukti: `deploy/dw/index.html:2650-2660`, `:6697-6748`, `CLAUDE.md:7995-8110`.
24. **Halaman tanpa baris `TITLES` memantul ke Dashboard** — invarian: tiap kunci `NAV_DEF` wajib berjudul. Bukti: `deploy/dw/index.html:2420-2428`.

## G. Ketergantungan lintas modul
- **Jadwal ← DW**: blok DAILY WORKER membaca `GET ../dw-api-mysql/api.php?action=jadwalDW` (`deploy/jadwal/index.html:1478`); `muatDW()` sengaja **tidak pernah melempar**, kegagalan = baris peringatan (`panelGagalDW` `:1565`, `CLAUDE.md:7192`).
- **DW → Jadwal**: `headIds` untuk memetakan head (`deploy/dw/index.html:2156-2164`).
- **DW → Marketing + Event + Reservasi**: pax Kalender Tamu (`deploy/dw/index.html:971-979`, `CLAUDE.md:7675`).
- **Jadwal & DW → Office/Account**: roster (`listDivisiRoster` / `listModuleRoster`) + tulis data pegawai via `roster*` (`deploy/jadwal/index.html:1761`, `deploy/dw/index.html:2140`).
- **Absensi → Jadwal & DW**: `shiftHari` + `jadwalDW` (`_lintas-modul.md:51`, `absensi-mysql/lib_absensi_mysql.php`).
- **Jadwal/DW ← Office `admin_modul_untuk`**: Tim HRD otomatis admin `jadwal`+`dw`; akses `dw` otomatis untuk head divisi (`CLAUDE.md:7684`, `:7230`).
- **DW disetujui HR → kalender Jadwal Shift** (Verified; lihat verify di Konsolidasi bawah).

## H. Catatan untuk implementasi Vue
- Halaman: `app/pages/jadwal/index.vue` (Dashboard Jadwal), `jadwal/bulanan.vue`, `jadwal/minggu.vue`, `jadwal/rekap.vue`, `jadwal/saya.vue`, `jadwal/pengajuan.vue`, `jadwal/pegawai.vue`, `jadwal/pengaturan.vue`; submodul DW: `app/pages/dw/index.vue` (Dashboard), `dw/hadir.vue`, `dw/tamu.vue`, `dw/kalender.vue`, `dw/permintaan.vue`, `dw/antrean.vue`, `dw/rekap.vue`, `dw/bayar.vue`, `dw/pekerja.vue`, `dw/pengaturan.vue`, `dw/akses.vue`. `definePageMeta({ access: ['jadwal'] })` / `{ access: ['dw'] }`; kartu launcher `jadwal` menampilkan kedua bagian sesuai izin.
- Composable `useJadwal.ts`: `useJadwalCells(from,to)`→`GET /jadwal/cells`; `saveCells(cells,clear)`→`PUT /jadwal/cells`; `clearCells()`→`DELETE /jadwal/cells`; `useJadwalShifts`→`GET /jadwal/shifts`; `useJadwalRequests/filters`→`GET /jadwal/requests`; `createRequest`→`POST /requests`; `decideRequest`→`POST /requests/{id}/decision`; `deleteRequest`→`DELETE /requests/{id}`; `useJadwalSettings`→`GET/PUT /jadwal/settings`; `useJadwalHeads`→`GET /jadwal/heads`; `useJadwalRoster`→`GET /jadwal/roster`.
- Composable `useDw.ts`: `useDwOverview(from,to)`→`GET /dw/overview`; `useDwSchedule`→`GET /dw/schedule`; `useDwWorkers`→`GET /dw/workers`; `saveWorker`→`POST/PUT /workers`; `deleteWorker`→`DELETE`; `useDwRequests`→`GET /dw/requests`; `saveRequest`→`POST/PUT`; `decideRequest`→`/requests/{id}/decision`; `assignRequest`→`/requests/{id}/assign`; `useDwAssignments`→`GET /dw/assignments`; `saveAssignment`→`POST`; `decideAssignments`→`POST /assignments/decisions`; `setAttendance`→`POST /assignments/{id}/attendance`; `replaceWorker`→`POST /assignments/{id}/replace`; `markPaid`→`POST /dw/payments/marks`; `useDwSettings`→`GET/PUT /dw/settings`; `clearDw`→`POST /dw/admin/clear`.
- HP vs desktop: lembar bulanan/mingguan (tabel hari menyamping) di HP sulit → `AppList` per orang + pemilih tanggal; `UTable` hanya `lg+`; form shift/editor sel/pekerja/pengajuan/ajuan/permintaan/tunjuk/ganti orang/kosongkan semuanya `ResponsiveSheet`.
- Widget Beranda yang cocok: "Siapa masuk hari ini" (Jadwal) + "DW masuk hari ini / belum dikonfirmasi" + "Pengajuan menunggu keputusan saya".
- Elemen lama yang melanggar DESIGN.md → padanannya:
  - **Kartu angka besar** (`stat`/`statBox`, kuning/brass, `statUang`) → `AppList` ringkas; satu `AppFocus` per layar (mis. "Belum dikonfirmasi").
  - **Emoji sebagai ikon** (🗓️, 📋, ⚡, 📥, 📗, 🖼️, 💬, 🖨️, 🧹, 👑, 👥, 📈, 💸, 🍹, 🍳, 🍽️, 💵) → Lucide `i-lucide-*`.
  - **Gradien & bayangan** (`.login-promo`, `linear-gradient`, `--shadow-lg`) → token DESIGN.md.
  - **Warna aksen/hex shift** (`w:#A9791F`, `input type=color`) → simpan warna shift di setting (data lama) tapi tampilkan sebagai badge status DESIGN.md; jangan warna teks kuning.
  - **Label huruf kapital mono** ("NAMA", "BULAN INI", "SEN") → sentence case `text-muted`.
  - **Gate sisi-browser** (kartu terkunci roster) → `module_not_granted` + halaman info, bukan JS localStorage saja.
- Perhitungan uang & beban **wajib dipindah apa adanya** ke `useDw.ts`/`useJadwal.ts` (semua fungsi di §D) — jangan dihitung ulang di server.

## I. Pertanyaan terbuka
- [ ] **jadwal / bulanan·minggu·dashboard — membaca baris DW** — Jadwal Vue perlu `jadwalDW` tapi `GET /api/v1/dw/schedule` menuntut modul `dw`, sedangkan hampir seluruh kru hanya punya `jadwal`. Konteks: `dw.md:109-111` menyebut route kompat lama tetap ada sampai klien lama habis. Bukti: `deploy/jadwal/index.html:1478`, `laksamana-api/app/Modules/Dw/routes/v1.php:8`. Opsi: A) terus pakai route kompat `?action=jadwalDW`; B) tambah endpoint di `/api/v1/jadwal/*` yang memanggil `DwService::scheduleRange` in-process; C) beri modul `dw` read-only ke semua pemegang `jadwal`.
- [ ] **jadwal / pengaturan — kunci setting `manajemen`** — daftar penerima akses Rekap Pegawai ditulis ke `setting.manajemen` (centang `📈 Rekap`), tapi kontrak v1 `jadwal.md:56` tidak menyebutnya. Bukti: `deploy/jadwal/index.html:5413`, `jadwal.md:56`. Opsi: A) tambahkan `manajemen` ke blob v1; B) ganti dengan peran head/admin saja.
- [ ] **dw / tamu — sumber pax tiga modul** — tidak ada endpoint v1 agregat; `dw.md:22` menyatakan "No DW endpoint". Bukti: `deploy/dw/index.html:971-979`, `dw.md:22`. Opsi: A) Vue memanggil 3 endpoint modul lain (Marketing `/events-on/{date}`, Event `/events-on/{date}`, Reservasi `/reservations`) dan memindahkan `satukan()`; B) minta endpoint pax di dw.
- [ ] **jadwal·dw / roster — panggil endpoint Account langsung?** — roster dipakai jadwal (`listDivisiRoster`) & dw (`listModuleRoster`, tulis `roster*`), sedangkan `GET /api/v1/account/roster` + `POST/PATCH/PUT/DELETE /account/roster*` ada di kontrak Account. Bukti: `deploy/jadwal/index.html:1766,2260`, `deploy/dw/index.html:2140`, `Account/routes/v1.php:17-25`. Opsi: A) Vue `jadwal`/`dw` memanggil endpoint Account (perlu scope `account`); B) ekspos lewat `jadwal`/`dw`.
- [ ] **dw / akses — apakah matriks `setting.akses` ditegakkan server?** — legacy hanya menegakkan di server lewat peran (`dw_hrd`/`dw_head`), matriks halaman murni UI; `dw.md:97` mempertahankan `akses` apa adanya. Opsi: A) tetap UI-only seperti legacy; B) server menegakkan per halaman.
- [ ] **jadwal / heads — bentuk terbalik** — legacy `headIds` → `{heads:{uid:[div]}}`; v1 `GET /jadwal/heads` → `{uid:[div]}`. Perlukah konfirmasi pemetaan UI? Bukti: `jadwal.md:58`, `deploy/dw/index.html:2157`.
- [ ] **dw / pengaturan — setelan lama `maksBeruntun`/`jedaMin`** (Jadwal) tidak ada di kontrak v1; alarm beban memakai bawaan 6/10. Apakah perlu disetel lagi? Bukti: `deploy/jadwal/index.html:3291`, `jadwal.md:56`.
- [ ] **dw / pembayaran — tarif hanya di klien** — v1 tidak menyimpan tarif di server (`dw.md:89`); kalau tarif berubah, angka minggu lampau ikut berubah. Apakah perlu snapshot tarif? Bukti: `deploy/dw/index.html:7196`, `dw.md:89`.

## Konsolidasi untuk README & berkas bersama
- Baris README siap tempel:
  `| jadwal | [jadwal.md](jadwal.md) | ⚠️ selesai dengan celah | 20 (1 pemilih + 8 jadwal + 11 dw) | 3 ❌ · 5 ⚠️ | 8 | jadwal + dw + roster |`
- `_pertanyaan.md` (bullet, format baku):
  - [ ] **jadwal / bulanan·minggu·dashboard** — Bagaimana Vue `jadwal` membaca baris DW disetujui (blok "DAILY WORKER") tanpa pemegang `jadwal` punya modul `dw`? Konteks: `GET /api/v1/dw/schedule` menuntut modul `dw`, sedang `jadwalDW` lama OPEN. Bukti: `laksamana-office/deploy/jadwal/index.html:1478`, `laksamana-api/docs/api/dw.md:109-111`. Opsi: A) pakai route kompat `?action=jadwalDW`; B) endpoint di `/api/v1/jadwal/*` memanggil `DwService::scheduleRange`; C) beri read-only `dw` ke semua pemegang `jadwal`.
  - [ ] **jadwal / pengaturan** — Di mana menyimpan `setting.manajemen` (penerima akses Rekap) di v1? Bukti: `laksamana-office/deploy/jadwal/index.html:5413`, `laksamana-api/docs/api/jadwal.md:56`. Opsi: A) tambah kunci `manajemen`; B) cukup head/admin.
  - [ ] **dw / tamu** — Endpoint v1 mana yang menyediakan pax harian tiga sumber (Marketing/Event/Reservasi)? Bukti: `laksamana-office/deploy/dw/index.html:971-979`, `laksamana-api/docs/api/dw.md:22`. Opsi: A) panggil 3 endpoint modul lain + pindahkan `satukan()`; B) endpoint agregat di `dw`.
  - [ ] **jadwal·dw / roster** — Boleh Vue `jadwal`/`dw` memanggil `/api/v1/account/roster*` (dan `rosterSaveUser`) langsung? Bukti: `laksamana-office/deploy/jadwal/index.html:2260`, `laksamana-office/deploy/dw/index.html:2140`, `laksamana-api/app/Modules/Account/routes/v1.php:17-25`. Opsi: A) ya, dengan scope `account`; B) ekspos lewat `jadwal`/`dw`.
  - [ ] **dw / akses** — Apakah matriks `setting.akses` cukup di UI (seperti legacy) atau harus ditegakkan server? Bukti: `laksamana-api/docs/api/dw.md:97`, `laksamana-office/deploy/dw/index.html:2341`. Opsi: A) UI-only; B) server per halaman.
  - [ ] **jadwal / heads** — Konfirmasi pemetaan bentuk `GET /jadwal/heads` `{uid:[div]}` (legacy `{div:[uid]}`). Bukti: `laksamana-api/docs/api/jadwal.md:58`.
  - [ ] **dw / pengaturan** — Perlukah `maksBeruntun`/`jedaMin` bisa disetel di v1? Bukti: `laksamana-office/deploy/jadwal/index.html:3291`.
  - [ ] **dw / pembayaran** — Perlukah snapshot tarif agar minggu lampau tidak berubah saat tarif diubah? Bukti: `laksamana-api/docs/api/dw.md:89`.
- `_lintas-modul.md` (tambahan baris):
  - **Jadwal ⇄ DW (VERIFIED, satu arah):** DW `DISETUJUI` dibaca Jadwal lewat `?action=jadwalDW` dan digambar sebagai blok terpisah di bawah kru tetap — **tidak** disalin ke `jadwal_sel`; baris DW read-only di Jadwal. Kode divisi `bar|kitchen|floor|cashier` wajib identik (`deploy/jadwal/index.html:1478,1545`; `CLAUDE.md:7192-7210`). Konsisten dengan `deploy/index.html:1243-1244`.
  - **Jadwal → DW:** DW menanyakan kepala divisi ke `jadwal-api?action=headIds` untuk halaman Hak Akses (`deploy/dw/index.html:2156`).
  - **DW → Marketing/Event/Reservasi:** Kalender Tamu menjumlahkan pax dari tiga modul (`deploy/dw/index.html:971-979`, `:2179-2193`); peta bentuk data kembar dengan `deploy/radar/index.html` (`satukan()`), disiplin saat kolom berubah.
  - **Jadwal & DW → Office/Account:** roster + tulis data pegawai; Tim HRD otomatis admin `jadwal`+`dw` (`CLAUDE.md:7684`). Tidak ada endpoint roster di kontrak `jadwal.md`/`dw.md` (ada di `Account`).
  - **Absensi → Jadwal/DW:** `shiftHari` + `jadwalDW`; v1 service call langsung (`_lintas-modul.md:51`, `docs/modules/absensi.md:75-76`).
