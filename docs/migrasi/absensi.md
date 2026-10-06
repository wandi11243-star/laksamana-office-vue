# Absensi — inventaris migrasi (AUDIT)

Status: ⚠️ selesai dengan celah
Terakhir diperbarui: 2026-09-29

> **Triase 2026-09-29** — status di tabel E yang bertentangan dengan catatan ini: catatan ini yang berlaku.
> Rincian: [`_pertanyaan.md`](_pertanyaan.md), [`_gap-api.md`](_gap-api.md).
> - 7 ❌ di tabel E adalah halaman Vue yang belum dibuat, BUKAN gap API — semua endpoint ✅.
> - Deteksi HR: pakai `siapa.hr` dari `GET /absensi/context` (T-05). Riwayat → T-06. Punch/wajah → K-02, Antrean/Atur → K-03.

> **Ringkasan jenis pekerjaan: Audit kelengkapan halaman Vue.**
> Halaman `app/pages/absensi/index.vue` SUDAH ada. Dokumen ini bukan inventaris
> untuk membangun dari nol, melainkan perbandingan: untuk tiap layar/fitur
> aplikasi lama `absensi/index.html`, apa yang lama lakukan (bukti), apakah
> halaman Vue + `useAbsensi.ts` + widget `AbsenHariIni.vue` mencakupnya, dan
> celah/beda perilaku yang tersisa.

## Ringkasan
- Jumlah layar lama: **5 layar** di `HALAMAN` (`absen`, `riwayat`, `antrean`, `wajah`, `atur`) + **1 layar Masuk** (`viewMasuk`); 0 tersembunyi, 2 khusus HR (`antrean`, `atur`). Aksi backend lama: **14**. Aksi yang benar-benar dipanggil `useAbsensi.ts`: **2** (`context`, `recap`).
- **Audit:** dari 6 layar, Vue baru mencakup **1 layar penuh** (`riwayat` = recap) + **1 ringkasan sebagian** (`absen` hanya lewat kartu "Hari ini"). **4 layar belum ada** di Vue: punch (`absen`), `antrean` (HR), `wajah`, `atur` (HR). Celah: **7 ❌ · 5 ⚠️**.
- Modul ini adalah **PWA berdiri sendiri di subdomain** (`absensi.laksamanamuda.id`); login-nya diteruskan server-ke-server ke akun Office, dan semua ketukan absen dibubuhi **wajah (descriptor 128 angka) + GPS + foto**, dicocokkan **di server**.
- Pencocokan wajah, validasi area, dan perhitungan telat/lembur/durasi **tidak boleh dipindah ke browser**: lama sengaja menyimpannya di server (`absensi/index.html:373-378`, `:1027-1029`). Yang mudah hilang saat migrasi adalah **aturan antrean** (`LUAR_AREA`/`TANPA_SHIFT`/`HARI_LIBUR`/`LUAR_SHIFT`/`WAJAH`/`WAJAH_KOSONG`) dan **shift yang dibaca ulang dari modul jadwal/DW**, bukan disalin (`:380-383`).
- Risiko terbesar: halaman Vue sekarang hanya menampilkan **riwayat**, sehingga punch, antrean HR, pendaftaran wajah, dan pengaturan HR **tidak punya UI di Office Vue**; komentar halaman menyatakan punch sengaja tetap di PWA (`app/pages/absensi/index.vue:6`).

## A. Sumber
| jenis | path | baris |
|---|---|---|
| frontend lama | laksamana-office/absensi/index.html | 1.883 |
| backend lama | laksamana-office/absensi-mysql/api.php (+ lib_absensi_mysql.php, schema.sql, README.md) | 209 / 918 |
| kontrak v1 | laksamana-api/docs/api/absensi.md | 81 |
| spec port | laksamana-api/docs/modules/absensi.md | 87 |
| implementasi v1 | laksamana-api/app/Modules/Absensi/routes/v1.php · Http/V1/AbsensiController.php · Services/AbsensiService.php | 23 / 289 / 1.041+ |
| halaman Vue | laksamana-office-vue/app/pages/absensi/index.vue | 108 |
| composable Vue | laksamana-office-vue/app/composables/useAbsensi.ts | 63 |
| widget Vue | laksamana-office-vue/app/widgets/absensi/AbsenHariIni.vue | 42 |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:11127-11180 "Dua situs yang TIDAK di bawah `deploy/`: `absensi` dan `investor`" | 11127-11180 |

Sumber daya PWA lama: `vendor/face-api.min.js` (`:360`), model di `models/` (`:1056-1058`), Leaflet di `vendor/leaflet.{css,js}` (`:898-906`), `sw.js` service worker (`:1875-1879`).

## B. Akses
- Kunci Modul di launcher: **`absensi`** — `deploy/index.html:1384` (`key:'absensi', grup:'tim', access:['absensi']`), kartu "Absensi", tag `Absen Masuk & Pulang`, `scope:['Absen','Antrean','Rekap']` (`:1390-1392`).
- Vue: `MODUL` memakai `access: ['absensi']` (`app/utils/modul.ts:26-27`); halaman `definePageMeta({ access: ['absensi'] })` (`app/pages/absensi/index.vue:11`). Gate modul sebenarnya di server (`module:absensi`, `routes/v1.php:9`).
- Role / matriks izin di dalam modul: hanya **HR** (bukan matriks berlapis). Dua layar bertanda `hr:1` disembunyikan dari non-HR (`HALAMAN` `:1108-1114`, `bolehBuka` `:1115-1120`). Server: HR = admin modul `absensi` **atau** id-nya di `setting.hr`; `hr` kosong = admin modul saja (`docs/modules/absensi.md:35`, `lib_absensi_mysql.php:461`).
- Aksi khusus admin/HR: menyetujui/menolak pengajuan (`putusAbsen`), menghapus wajah (`hapusWajah`), CRUD titik kerja (`simpanLokasi`/`hapusLokasi`), menyimpan aturan (`simpanSetting`).
- Vue memakai identitas bersama: `useMe()` (`modules`, `adminModules`) dari `GET /me` (`app/composables/useMe.ts:2-13`); tidak ada `HR`-flag di `/me`.

## C. Daftar layar (dari `HALAMAN` + masuk)
`HALAMAN` didefinisikan `absensi/index.html:1108-1114`; dispatcher `gambar()` `:1196-1202`; tab bawah `gambarTab()` `:1121-1137`.

| key | judul | subjudul (judul di dalam layar) | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| masuk | Absensi Laksamana Muda | "Masuk dengan akun Office yang sama." | belum login | n/a (bukan tab) | `:525-549`, `:1158-1193` |
| absen | Absen | — (kartu jam + shift + syarat + ringkasan) | semua | tidak | `:1109`, `:1226-1252` |
| riwayat | Riwayat | "Riwayat Absensi" | semua | tidak | `:1110`, `:1463-1514` |
| antrean | Antrean | "Antrean Pengajuan" | HR saja | tidak (tapi `hr:1`) | `:1111`, `:1118`, `:1519-1573` |
| wajah | Wajah | "Wajah Terdaftar" (+ "Daftar Kru" untuk HR) | semua; daftar kru HR | tidak | `:1112`, `:1578-1638` |
| atur | Atur | "Titik Kerja" + "Aturan" | HR saja | tidak (tapi `hr:1`) | `:1113`, `:1118`, `:1643-1691` |

Catatan: `HALAMAN` tidak punya field subjudul; teks di atas diambil dari `<h2>` masing-masing `view*`.

## D. Detail per layar (perbandingan lama → Vue)

Ringkas dulu peta cakupan:

| # | layar lama | cakupan di Vue sekarang | di mana |
|---|---|---|---|
| D.1 | absen (punch) | ❌ tidak ada (hanya ringkasan "Hari ini") | `app/pages/absensi/index.vue:24-29` |
| D.2 | riwayat (recap) | ⚠️ ada, beda bentuk | `app/pages/absensi/index.vue:17-20`, `:64-106` |
| D.3 | antrean (HR) | ❌ tidak ada | — |
| D.4 | wajah | ❌ tidak ada | — |
| D.5 | atur (HR) | ❌ tidak ada | — |
| D.6 | masuk | ⚠️ pakai `/auth/login` bersama | `app/composables/useMe.ts:21-28` |

### D.1 absen — Absen (punch masuk/pulang)
- **Yang lama tampilkan (`viewAbsen` `:1226-1252`):** kartu jam besar `jamStr(sekarang())` + `tglPanjang(now)` + label "jam server" (`:1232-1236`); kartu shift (`shiftKartuHTML` `:1207-1224`) — tiga keadaan: "Tidak dijadwalkan hari ini" / "Hari ini <kode>" (libur) / "<mulai> – <selesai> · Shift <kode>" (+ " · pekerja harian" bila `sumber==='DW'`); dua keping syarat (`gambarSyarat` `:1255-1311`): lokasi ("Di <nama>" / "Di luar area kerja" / "Mencari sinyal GPS…" / "Lokasi belum disetel") dan wajah ("Wajah terdaftar" / "Wajah belum didaftarkan"); kartu ringkasan (`gambarRingkas` `:1313-1334`) Masuk/Pulang/Durasi + lencana `Telat <durasi>` / `Lembur <durasi>` / `Menunggu persetujuan` / `Tepat waktu`.
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | `Absen Masuk` | `bukaAbsen('MASUK')` → lembar kamera + `kirimAbsen()` | `absen` | `POST /absensi/punches` | `:1242-1244`, `:1338-1371`, `:1418-1453` |
  | `Sudah masuk` (disabled) | tombol mati bila `h.masuk` ada | — | — | `:1242-1244` |
  | `Absen Pulang` | `bukaAbsen('PULANG')`; disabled sampai ada MASUK | `absen` | `POST /absensi/punches` | `:1245-1249` |
  | `Ubah jam pulang` | PULANG kedua (last wins) | `absen` | `POST /absensi/punches` | `:1245-1247` |
  | `Rekam Absen Masuk` / `Rekam Absen Pulang` | kirim descriptor+foto+lat/lng+akurasi+alasan | `absen` | `POST /absensi/punches` | `:1366-1367`, `:1434-1439` |
  | `Batal` | `tutupSheet()` | — | — | `:1368` |
- **Form & field (`kirimAbsen` `:1434-1439`):**
  | field (nama data) | label UI | tipe | wajib | default / pilihan | validasi & pesan |
  |---|---|---|---|---|---|
  | `arah` | (dari tombol) | MASUK\|PULANG | ya | MASUK/PULANG | — |
  | `lat`,`lng`,`akurasi` | — | number | tidak | 0 bila `POS` null | dipakai server untuk area |
  | `descriptor` | — | array[128] | hanya bila wajah wajib/terdaftar | `null` | `Wajah belum terbaca. Dekatkan wajah ke kamera dan pastikan ruangan cukup terang.` `:1429-1430` |
  | `foto` | — | data URI JPEG 0.7 | tidak | '' | diambil 320×320 (`:1097-1102`) |
  | `alasan` | `Alasan (wajib)` | textarea | ya bila perlu persetujuan | '' | `Alasannya diisi dulu ya.` `:1422` |
- **Perhitungan/proses di browser:** `luarJamShift()` (`:1375-1389`) memperkirakan di layar apakah sekarang di luar `shift ± awalMenit/akhirMenit` (memahami lewat tengah malam); `jarakTerdekat()` (`:1030-1042`) haversine untuk menampilkan "di dalam/di luar" — **keduanya hanya pemberi tahu, penentu tetap server** (`:1027-1029`, `:1372-1374`). Kamera: model `tinyFaceDetector`+`faceLandmark68TinyNet`+`faceRecognitionNet` dimuat malas (`:1050-1065`), deteksi tiap 900 ms (`:1402-1414`).
- **Real-time/polling:** jam berdetak `setInterval` 1 s (`:1161-1164`); `watchPosition` GPS terus-menerus (`:664-665`), di-restart saat tab kembali terlihat (`:671-673`).
- **Vue sekarang:** TIDAK ada layar punch. Halaman hanya menampilkan `AppFocus` "Hari ini" (`app/pages/absensi/index.vue:47-53`) dengan nilai dari `/absensi/context`.
- **Gap / beda:** ❌ seluruh alur punch (kamera wajah, GPS, unggah descriptor+foto, alasan, sheet, tombol MASUK/PULANG, kartu shift, keping syarat, kartu ringkasan + lencana) belum ada di Vue — sengaja "stays in the Absensi PWA for now" (`app/pages/absensi/index.vue:6`). ⚠️ Ringkasan "Hari ini" di Vue hanya satu baris (`Masuk <jam>` / `<jam> – <jam>` + hint shift/durasi) sehingga **Masuk, Pulang, Durasi terpisah dan lencana `Telat`/`Lembur`/`Menunggu persetujuan` tidak tampil** (`index.vue:24-29` vs `:1313-1334`).

### D.2 riwayat — Riwayat (recap)
- **Yang lama tampilkan (`viewRiwayat` `:1463-1473`, `muatRiwayat` `:1477-1498`):** input `Dari`/`Sampai` (default `bulanIni()` = awal bulan s.d. hari ini, `:1459-1462`), tombol `Tampilkan`; kartu ringkasan tiga angka **Hari kerja** (`totHari`), **Total telat** (`durasi(totTelat)`), **Total lembur** (`durasi(totLembur)`) (`:1489-1497`); daftar per hari (`hariBarisHTML` `:1499-1514`): tanggal + `masuk → pulang` + `HARI[d.getDay()]` + `· <shift>` + `· durasi` + lencana `Menunggu` / `Telat <durasi>` / `Lembur <durasi>` / `Tepat waktu` / `Belum pulang`. Diurutkan **menurun** `b.tgl.localeCompare(a.tgl)` di klien (`:1483`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | `Tampilkan` | set `RIW_DARI/RIW_SAMPAI` lalu `muatRiwayat()` | `rekap` | `GET /absensi/recap?from&to` | `:1470`, `:1474-1476`, `:1481` |
- **Form & field:** `Dari`,`Sampai` → `input type="date"` (`:1468-1469`).
- **Vue sekarang:** `useAbsensiRecap(from, to)` → `GET /absensi/recap` (`useAbsensi.ts:37-42`); `from`/`to` **hard-coded**: `to` = hari ini, `from` = 13 hari lalu → "Riwayat 14 hari terakhir" (`index.vue:14-15`, `:45`). Tabel desktop `UTable` (`:94-105`) + `AppList` HP (`:64-90`); kolom `Tanggal`/`Nama`(bila ada baris orang lain)/`Shift`/`Masuk`/`Pulang`/`Durasi`/`Status` (`:31-39`). Status dari `statusHari()` (`useAbsensi.ts:52-58`): `Menunggu HR` / `Ditolak` / `Telat <durasi>` / `Belum pulang` / `Tepat waktu`.
- **Perhitungan:** tetap di server. Vue `menit(n)`: `95 -> "1 j 35 m"`, `0 -> "—"` (`useAbsensi.ts:44-49`); `tglPendek` = `"Sab, 27 Sep"` (`:60-63`).
- **Gap / beda:**
  - ❌ **tidak ada pemilih rentang `Dari`/`Sampai`** di Vue (lama `bulanIni()` bisa diganti; Vue tetap 14 hari).
  - ❌ **tidak ada kartu ringkasan total** `Hari kerja` / `Total telat` / `Total lembur`.
  - ⚠️ **lencana `Lembur` hilang** — `statusHari()` hanya melihat `hitung.telat`/`menunggu`/`masuk.status`/`pulang`, tidak `hitung.lembur` (`useAbsensi.ts:52-58`).
  - ⚠️ Vue **menambah** status `Ditolak` (`:54`) yang tidak ditampilkan lama (`hariBarisHTML` tidak punya lencana tolak; `:1502-1507`).
  - ⚠️ Vue **menambah kolom `Nama`** untuk HR (`index.vue:22`, `:33`) — lama tidak menampilkan nama sama sekali di Riwayat (`hariBarisHTML` tidak memuat `nama`).
  - ⚠️ Deteksi "HR" di Vue dari isinya: `others = rows.some(h => h.uid !== me.id)` (`index.vue:22`), bukan dari `siapa.hr`.
  - ⚠️ Format durasi beda: lama `durasi()` → `"1j 25m"` / `0 → "0m"` (`:450-455`); Vue `menit()` → `"1 j 25 m"` / `0 → "—"`.
  - Catatan: `useAbsensiRecap` mengirim **hanya** `from`,`to` — komentarnya bilang "HR may pass `user`" tetapi parameternya tidak menerima `user` (`useAbsensi.ts:36-42`); kontrak v1 mendukung `user`/`tipe` (`docs/api/absensi.md:51`, controller `:133-138`).

### D.3 antrean — Antrean Pengajuan (HR) ❌ tidak ada di Vue
- **Yang lama tampilkan (`viewAntrean` `:1519-1528`, `ajuBarisHTML` `:1538-1560`):** header "Antrean Pengajuan" + "Yang paling lama menunggu di atas."; tiap kartu: foto (atau blok abu), `nama||uid`, `Masuk|Pulang <jam> · <tanggal> <bulan>`, lencana sebab (`SEBAB_TEKS` `:1529-1537`), `jarak m dari titik`, `Shift <kode> <m>–<s>` atau `Tanpa shift`, `Wajah cocok` bila `wajahOk`; `alasan`; tombol `Setujui`/`Tolak`. Kosong → `Tidak ada yang menunggu. 👌` (`:1526`).
- **Aksi:** `Setujui`/`Tolak` → `putus(id,'VALID'|'DITOLAK')` (`:1557-1558`, `:1561-1573`) memanggil `putusAbsen` (`nota:''`); bila `berubah:0` → `Pengajuan ini sudah diputus orang lain lebih dulu.`.
- **Terjemahan sebab (`SEBAB_TEKS` `:1529-1537`):** `LUAR_AREA:'Di luar area kerja'`, `LUAR_SHIFT:'Di luar jam shift'`, `TANPA_SHIFT:'Tidak dijadwalkan'`, `HARI_LIBUR:'Dijadwalkan libur'`, `WAJAH:'Wajah TIDAK COCOK'`, `WAJAH_KOSONG:'Wajah belum didaftarkan'`.
- **Vue sekarang:** TIDAK ada. ❌ Kontrak v1 menyediakan `GET /absensi/queue` + `POST /absensi/punches/{id}/decision` (`docs/api/absensi.md:53-58`, `routes/v1.php:13-14`); `useAbsensi.ts` tidak memanggil keduanya.

### D.4 wajah — Wajah (enrol + daftar HR) ❌ tidak ada di Vue
- **Yang lama tampilkan (`viewWajah` `:1578-1597`):** kartu status "Wajahmu sudah/belum terdaftar" + tombol `Daftarkan Ulang` / `Daftarkan Wajah Saya`; untuk HR, "Daftar Kru" (`muatDaftarWajah` `:1598-1611`) berisi `nama||id`, `Pekerja harian|Kru · didaftarkan <oleh>`, lencana `Terdaftar`/`Kosong`, tombol `Hapus`.
- **Aksi/form:** `Simpan Sidik Wajah` → `simpanWajahSaya()` `api('daftarWajah',{tipe:'USER', id:KTX.siapa.id, nama:KTX.siapa.nama, descriptor:WAJAH, foto:FOTO})` (`:1628-1638`); `Hapus` → `hapusWajah(tipe,id)` dengan konfirmasi `Hapus sidik wajah orang ini? Ia harus mendaftar ulang sebelum bisa absen dengan wajah.` (`:1612-1616`).
- **Vue sekarang:** TIDAK ada. ❌ Kontrak v1: `GET /faces`, `POST /faces`, `DELETE /faces` (`docs/api/absensi.md:62-66`, `routes/v1.php:15-17`); tidak dipanggil `useAbsensi.ts`.

### D.5 atur — Titik Kerja + Aturan (HR) ❌ tidak ada di Vue
- **Yang lama tampilkan (`viewAtur` `:1643-1691`):** kotak status GPS (`gpsKotakHTML` `:757-778`), tombol `Ambil lokasi lagi`/`Ambil lokasi saya` (`:1653-1654`), tombol `Kenapa lokasi belum terbaca?` → panel diagnosa (`diagnosaHTML` `:797-837`); daftar titik kerja (`lokBarisHTML` `:1701-1710`) dengan koordinat, `Radius <n> m`, jarak & "di dalam/di luar", tombol `Ubah`; tombol `Tambah titik kerja`; blok "Aturan": `Toleransi telat`, `Lembur diabaikan di bawah`, `Boleh absen sebelum shift`, `…dan sesudah shift`, `Ambang kemiripan wajah`, saklar `Wajah wajib cocok`, saklar `Boleh absen tanpa jadwal shift`, tombol `Simpan Aturan`.
- **Form titik kerja (`bukaLokasi` `:1720-1794`):** `Nama titik`, tiga cara koordinat — **Peta** (Leaflet, cari Nominatim `:983-1007`, penanda tengah, `Pakai titik di penanda` `:1012-1017`), **Dari GPS** (`Ambil lokasi saya` + `Pakai koordinat ini`), **Tempel** (`Baca koordinat` dari `bacaKoordinat` `:853-870`); `Radius` (`input min=30 max=2000`, quick `80/120/200/400 m`); `Simpan Titik Kerja`; `Hapus titik ini` (konfirmasi `Hapus titik kerja ini? Absen di sana akan mulai masuk antrean pengajuan.` `:1845`).
- **Form aturan (`simpanAturan` `:1850-1864`):** payload `{toleransiTelat, lemburMinMenit, awalMenit, akhirMenit, wajahAmbang, wajahWajib, tanpaShiftBoleh, hr}` (batas input: telat 0-60, lembur 0-120, awal 0-360, akhir 0-720, ambang 0.2-0.8).
- **Perhitungan di browser:** `jarakKe(l)` haversine (`:1711-1717`); `tolakPos()` menerjemahkan kode GPS 1/2/3 (`:686-700`); radius clamp saat gambar peta (`:950-953`).
- **Vue sekarang:** TIDAK ada. ❌ Kontrak v1: `GET/POST/DELETE /locations`, `GET/PUT /settings` (`docs/api/absensi.md:68-81`, `routes/v1.php:18-22`); tidak dipanggil `useAbsensi.ts`. Diagnosa GPS & peta Leaflet/Nominatim tidak punya padanan.

### D.6 masuk — Layar Masuk ⚠️ beda mekanisme
- **Yang lama (`viewMasuk` `:525-549`, `kirimMasuk` `:550-586`):** `Nama atau username` + `PIN`, tombol `Masuk`, teks "Lupa PIN? Minta admin mengaturnya ulang di Office."; `api('masuk',{nama,pin})`; galat ditampilkan lewat `toast(e.message,'err')` (`:584`). Validasi klien `Nama dan PIN diisi dulu.` (`:552`). Sesi disimpan 30 hari di `localStorage['lm_absensi_sesi']` (`:409`, `:506-515`).
- **Vue sekarang:** login lewat `POST /auth/login` bersama (`app/composables/useMe.ts:21-28`), bukan `POST /absensi/session`. ⚠️ `POST /absensi/session` tetap ada di v1 untuk PWA (`routes/v1.php:7`); `useAbsensi.ts` tidak memanggilnya. Ini **penggantian mekanisme yang disengaja** untuk Office Vue, bukan celah fungsi.

## E. Pemetaan backend (action lama → v1 → dipanggil `useAbsensi.ts`?)
Aksi lama dari `absensi-mysql/api.php:80-206`. Kolom terakhir = apakah **`useAbsensi.ts` benar-benar memanggilnya**.

| action lama | dipakai di layar | baca/tulis | endpoint v1 | status ✅/⚠️/❌ | dipanggil useAbsensi.ts? | catatan |
|---|---|---|---|---|---|---|
| `masuk` (`nama`,`pin`) | masuk | tulis | `POST /absensi/session` | ✅ | ❌ tidak | Vue pakai `POST /auth/login` (`useMe.ts:21-28`, kontrak `docs/api/absensi.md:31`) |
| `konteks` | konteks boot semua layar | baca | `GET /absensi/context` | ✅ | ✅ ya (`useAbsensi.ts:33-34`) | satu panggilan bootstrap |
| `absen` | absen | tulis | `POST /absensi/punches` | ✅ | ❌ tidak | alur punch belum ada di Vue |
| `daftarWajah` | wajah | tulis | `POST /absensi/faces` | ✅ | ❌ tidak | |
| `hapusWajah` | wajah (HR) | tulis | `DELETE /absensi/faces` | ✅ | ❌ tidak | |
| `wajahDaftar` | wajah (HR) | baca | `GET /absensi/faces` | ✅ | ❌ tidak | |
| `antrean` | antrean (HR) | baca | `GET /absensi/queue` | ✅ | ❌ tidak | |
| `putusAbsen` | antrean (HR) | tulis | `POST /absensi/punches/{id}/decision` | ✅ | ❌ tidak | balasan `{berubah: 0|1}` |
| `rekap` | riwayat | baca | `GET /absensi/recap` | ✅ | ✅ ya (`useAbsensi.ts:37-42`) | non-HR dipaksa ke baris sendiri |
| `simpanLokasi` | atur (HR) | tulis | `POST /absensi/locations` | ✅ | ❌ tidak | payload lama `{row}` → v1 field datar |
| `hapusLokasi` | atur (HR) | tulis | `DELETE /absensi/locations/{id}` | ✅ | ❌ tidak | |
| `simpanSetting` | atur (HR) | tulis | `PUT /absensi/settings` | ✅ | ❌ tidak | |
| `ping` | diagnostik | baca | — | ❌ | ❌ tidak | v1 `AbsensiService::ping()` ada (`:1028`) tapi **tidak dirutekan** di `routes/v1.php` |
| `stats` | diagnostik | baca | — | ❌ | ❌ tidak | idem (`AbsensiService::stats()` `:1034`, tidak dirutekan) |

Konkurensi: **tidak ada** `version`/ETag/`If-Match` di Absensi (lama maupun v1). Aturannya: `MASUK` **yang pertama menang** (kedua → `200 {duplikat:true}`), `PULANG` **yang terakhir menang** (`ON DUPLICATE KEY UPDATE` + reset `putus_*`), dan keputusan hanya boleh selagi `MENUNGGU` (`berubah:0` bila sudah diputus orang lain). Bukti: `lib_absensi_mysql.php:702-711`, `:734-748`, `:775-789`; kontrak `docs/api/absensi.md:14`, `:38`, `:58`.

Kode error yang wajib ditangani UI (kontrak + controller): `403 forbidden` (pelanggaran aturan, `AbsensiController::run():49-51`), `422 rejected` (arah salah, alasan kosong, keputusan tak dikenal, data wajah/ tanggal salah, `:53`), plus `401` (ditangani otomatis `useApi()` → `/login`, `app/composables/useApi.ts:52-58`). Pesan lama yang harus sama: `Sesi tidak dikenali. Masuk lagi ya.`, `Akun ini tidak punya akses modul Absensi.`, `Hanya HR/admin modul yang boleh melakukan ini.`, `Arah absen harus MASUK atau PULANG.`, `Absen ini di luar ketentuan, jadi harus disertai alasan untuk diajukan.`, `Keputusan hanya boleh VALID atau DITOLAK.` (`absensi-mysql/api.php:65`, `:71`, `:76`; `lib_absensi_mysql.php:608`, `:698`, `:779`).

## F. Aturan bisnis yang wajib dibawa
1. **Wajah yang sudah terdaftar WAJIB cocok, tanpa menyalakan setelan apa pun** — salah cocok → `MENUNGGU` (`WAJAH`); yang belum terdaftar hanya dihalangi bila `wajahWajib` menyala (`WAJAH_KOSONG`). — kenapa: dulu bergantung `wajahWajib` (default mati) sehingga wajah orang lain tetap `VALID`; sudah diuji tembus. — bukti: `absensi-mysql/lib_absensi_mysql.php:650-667`, `:686-693`.
2. **Subjek SELALU dari token, waktu SELALU dari server** — admin memperbaiki absensi orang lewat `putusAbsen`, bukan dengan mengabsenkan; jam HP bisa diputar mundur. — bukti: `absensi-mysql/api.php:118-122`, `lib_absensi_mysql.php:611-614`.
3. **`MASUK` pertama menang; `PULANG` terakhir menang** (dan PULANG baru mereset jejak keputusan `putus_*`). — bukti: `lib_absensi_mysql.php:702-711`, `:734-748`; kontrak `docs/api/absensi.md:38`.
4. **Tanggal kerja PULANG = tanggal MASUK dalam 18 jam terakhir** (shift malam) — bukti: `lib_absensi_mysql.php:583-598`, kontrak `:45`.
5. **Jadwal tak terbaca (`TAK_TERBACA`) TIDAK pernah mengantre** — area & wajah tetap diperiksa; menebak "tanpa shift" akan melempar seluruh perusahaan ke antrean gara-gara modul tetangga. — bukti: `lib_absensi_mysql.php:670-685`, `docs/modules/absensi.md:73`.
6. **`WAJAH` (tidak cocok) berbeda dari `WAJAH_KOSONG` (belum didaftarkan)** — yang pertama harus dicurigai HR, yang kedua tugas admin. — bukti: `lib_absensi_mysql.php:686-693`, `absensi/index.html:1532-1536`.
7. **Ketukan `MENUNGGU` wajib disertai `alasan`** — `Absen ini di luar ketentuan...` — bukti: `lib_absensi_mysql.php:696-698`, `absensi/index.html:1363-1364`, `:1422`.
8. **Belum ada lokasi terdaftar sama sekali = semua orang "di dalam area"** (jangan mengirim seluruh absensi hari pertama ke antrean) — bukti: `lib_absensi_mysql.php:625-628`, `absensi/index.html:1260-1262`, `:1663-1665`.
9. **Shift tidak disimpan di absensi; dibaca ulang dari jadwal/DW tiap ketukan** — head yang merapikan jadwal kemarin harus ikut berubah di absensi. — bukti: `absensi/index.html:380-383`, `lib_absensi_mysql.php:513-563`.
10. **Pencocokan wajah dikerjakan di server; descriptor terdaftar TIDAK pernah dikirim ke browser** — HP hanya mengubah wajah jadi 128 angka (descriptor) untuk dibandingkan server; kalau dibalik, siapa pun bisa membalas "cocok" dari Developer Tools. — bukti: `absensi/index.html:373-378`, `docs/modules/absensi.md:17`. (Sisi lain: `shift` & `lokasi` memang dikirim ke browser untuk tampilan, tetapi penentunya tetap server.)
11. **`telat`/`lembur`/`cepat`/`durasi`/`lengkap` dihitung saat dibaca, tidak disimpan**; `DITOLAK` = nol, `MENUNGGU` tetap menampilkan angka dan ditandai. — bukti: `lib_absensi_mysql.php:798-852`, `:794-797`; kontrak `:15`.
12. **Jam pulang dihitung dari lama kerja sungguhan**, bukan tebakan jam dinding (shift pagi yang lewat tengah malam = lembur, bukan pulang cepat). — bukti: `lib_absensi_mysql.php:824-849`.
13. **Radius titik kerja dijepit 30–2000 m** (di bawah 30 m tak berguna karena akurasi GPS dalam ruangan). — bukti: `lib_absensi_mysql.php:291`, `absensi/index.html:1780-1781`.
14. **Sesi absensi 30 hari** — aplikasi dibuka tiap pagi; memaksa login ulang tiap minggu = orang terlambat karena lupa PIN. Token tetap bisa dicabut server. — bukti: `absensi/index.html:506-515`, `:398-408`.
15. **Penentu "sah/area/jam shift" adalah server; angka di browser hanya pemberi tahu** — kalau berbeda, yang benar server. — bukti: `absensi/index.html:1027-1029`, `:1372-1374`.
16. **`/absensi/session` cek modul `absensi`** (akun tanpa modul → pesan `Akun ini belum diberi akses modul Absensi...`) — bukti: `docs/api/absensi.md:31`, `docs/modules/absensi.md:34-35`.

## G. Ketergantungan lintas modul
- **Absensi → Jadwal (roster) & DW (daily worker).** `shift_hari()` memanggil `jadwal-api-mysql?action=shiftHari` dan `dw-api-mysql?action=jadwalDW` (`absensi-mysql/lib_absensi_mysql.php:513-563`, khususnya `:523`, `:560`); di v1 jadi service call langsung (`docs/modules/absensi.md:75-76`). Deskripsi kartu launcher pun menyebut "tersambung ke jadwal shift dan daily worker" (`deploy/index.html:1391`). Ini melengkapi `_lintas-modul.md:35` (yang mengutip `deploy/index.html:1391`) — **terverifikasi**; tambahan bukti kode: `lib_absensi_mysql.php:523`, `:560`.
- **Absensi → Office/Account.** Login `masuk` diteruskan server-ke-server ke account-api (`absensi-mysql/api.php:83-89`, `lib_absensi_mysql.php:431`), lalu v1 memanggil `AccountService::login` in-process + wajib modul `absensi` (`docs/modules/absensi.md:43`). Identitas & daftar modul Office juga sumber `siapa{boleh,admin,hr}` (`lib_absensi_mysql.php:405-461`).
- **Absensi tidak menulis** ke database modul lain (hanya membaca shift). Tidak ada panel modul lain yang disematkan.
- Aset bersama: logo `../assets/LaksamanaMudaLogo.jpeg` (`absensi/index.html:530`, `:9-10`); bukan `deploy/assets/*.js`.

## H. Catatan untuk implementasi Vue (sudah ada — yang perlu ditambah)
- Halaman: `app/pages/absensi/index.vue` (Riwayat) SUDAH ada. Untuk paritas penuh: `absensi/antrean.vue` (HR), `absensi/wajah.vue`, `absensi/atur.vue` (HR), plus punch sebagai `ResponsiveSheet`/halaman terpisah bila diputuskan dibawa ke web. `definePageMeta({ access: ['absensi'] })`; sembunyikan `antrean`/`atur` dengan `isAdminOf(me,'absensi')` — **catatan**: `/me` memakai `adminModules`, sedangkan HR lama = admin **atau** `setting.hr`; perlu endpoint/flag HR dari server.
- Composable `useAbsensi.ts`: sudah punya `useAbsensiContext()`, `useAbsensiRecap()`, `menit()`, `statusHari()`, `tglPendek()`. Yang perlu ditambah: `punch()`→`POST /punches`; `useAbsensiQueue()`→`GET /queue`; `decidePunch(id,status,nota)`→`POST /punches/{id}/decision`; `useAbsensiFaces()`/`saveFace()`/`deleteFace()`→`/faces`; `useAbsensiLocations()`/`saveLocation()`/`deleteLocation()`→`/locations`; `useAbsensiSettings()`/`saveSettings()`→`/settings`.
- HP vs desktop: Riwayat sudah `AppList` (HP) + `UTable` (`lg+`) dari baris yang sama (`index.vue:64-106`) — pola yang benar, pertahankan. Antrean/Wajah/Atur: `AppList` di HP, `UTable`/daftar di desktop; form titik kerja & form wajah di `ResponsiveSheet`.
- Widget Beranda: `AbsenHariIni.vue` sudah ada (`widgets/absensi/AbsenHariIni.vue`, terdaftar `modul.ts:27`); menampilkan `Masuk`/`Pulang` + shift dari `useAbsensiContext()` (`:3`, `:5-10`).
- Elemen lama yang melanggar DESIGN.md → padanannya:
  - **Emoji** `Tidak ada yang menunggu. 👌` (`absensi/index.html:1526`) → buang emoji / kalimat biasa.
  - **Kartu angka besar** (jam `:1232-1236`, ringkasan Masuk/Pulang/Durasi ukuran 22px `:1325-1331`, ringkasan total 21px `:1491-1495`) → `AppFocus` tunggal + `AppListRow` (`DESIGN.md`: tanpa kartu grid angka besar).
  - **Lencana berwarna penuh** (`lencana l-telat/l-lembur/l-ok/l-tunggu/l-tolak`) → `AppStatus` (titik + kata).
  - **Warna kuning sebagai teks** di `--gold:#A9791F` (mis. `.sv` "jam server", garis shift) → kuning hanya sebagai isi tombol utama / penanda "now".
  - **Kotak centang kecil** disembunyikan dalam baris saklar (`saklarHTML` `:1695-1700`) → sudah benar (baris bisa diketuk); pertahankan sebagai `USwitch` baris.
- Peta & kamera: Leaflet + ubin OSM (vendor lokal, `:898-906`) dan `face-api` (`:360`, model `models/`) adalah aset PWA; bila fitur ini dibawa ke Vue perlu keputusan (bundle vs tetap PWA).

## I. Pertanyaan terbuka
- [ ] **absensi / absen — Punch (wajah + GPS) di Vue?** — 4 layar lama (punch, antrean, wajah, atur) belum ada di Vue; komentar halaman menyatakan punch sengaja tetap di PWA. Apakah Office Vue harus menyediakan punch/kamera, atau cukup menaut ke PWA? Konteks: `absensi/index.html` seluruhnya punch di browser; Vue hanya punya Riwayat. Bukti: `app/pages/absensi/index.vue:6`, `laksamana-api/docs/api/absensi.md:17-25`. Opsi: A) tetap PWA saja (Vue hanya riwayat); B) pindahkan punch ke Vue dengan `getUserMedia` + face-api; C) tautkan ke `absensi.laksamanamuda.id`.
- [ ] **absensi / antrean — Layar Antrean (HR) di Vue?** — kontrak v1 punya `GET /queue` + `POST /punches/{id}/decision`, tetapi `useAbsensi.ts` tidak memanggilnya dan tidak ada halaman; HR kini tak bisa memutus pengajuan dari Office Vue. Bukti: `useAbsensi.ts:1-63`, `laksamana-api/docs/api/absensi.md:53-58`, `absensi/index.html:1519-1573`. Opsi: A) buat `absensi/antrean.vue`; B) tetap di PWA.
- [ ] **absensi / wajah & atur — Pendaftaran wajah + pengaturan HR di Vue?** — sama: endpoint ada, UI tidak. Form wajah butuh kamera; form titik kerja butuh peta (Leaflet) atau tempel koordinat. Bukti: `laksamana-api/docs/api/absensi.md:60-81`, `absensi/index.html:1578-1864`. Opsi: A) pindahkan hanya "Atur" (lokasi+aturan, tanpa kamera); B) pindahkan semuanya; C) tetap PWA.
- [ ] **absensi / riwayat — Kembalikan pemilih rentang & ringkasan total?** — Vue mengunci 14 hari dan membuang kartu `Hari kerja`/`Total telat`/`Total lembur` milik lama. Bukti: `app/pages/absensi/index.vue:14-15`, `absensi/index.html:1459-1497`. Opsi: A) tambah pemilih `Dari`/`Sampai` + ringkasan; B) tetap 14 hari tanpa total; C) keduanya opsional.
- [ ] **absensi / HR detection & ping — `siapa.hr` vs `adminModules`, dan endpoint diagnostik?** — Vue menebak HR dari isi baris (`others`, `index.vue:22`) karena `/me` tidak membawa flag HR; selain itu `ping`/`stats` v1 tidak dirutekan. Bukti: `app/composables/useMe.ts:2-13`, `app/pages/absensi/index.vue:22`, `laksamana-api/app/Modules/Absensi/routes/v1.php:1-23`. Opsi: A) tambah flag HR di `/me`/`/absensi/context`; B) cukup admin modul; C) `ping`/`stats` tidak perlu.

## Konsolidasi untuk README & berkas bersama

### Baris README (siap tempel)
```
| absensi | [absensi.md](absensi.md) | ⚠️ selesai dengan celah | 5 layar (+1 masuk) | 7 ❌ · 5 ⚠️ | 5 | audit kelengkapan halaman Vue |
```

Catatan: karena ini audit, angka **7 ❌ · 5 ⚠️** bukan gap v1 melainkan **celah cakupan/format di halaman Vue** (lihat §D dan §E); semua endpoint yang dibutuhkan layar lama SUDAH ada di v1 kecuali `ping`/`stats`.

### Pertanyaan terbuka (format `_pertanyaan.md`, siap tempel)
```
- [ ] **absensi / absen** — Apakah punch (kamera wajah + GPS) harus dibawa ke Office Vue, atau tetap di PWA `absensi.laksamanamuda.id`? Konteks: halaman Vue hanya menu Riwayat; komentarnya menyatakan "Punching in (face + GPS) stays in the Absensi PWA for now". Bukti: `laksamana-office-vue/app/pages/absensi/index.vue:6`, `laksamana-api/docs/api/absensi.md:17-25`. Opsi: A) tetap PWA; B) pindahkan ke Vue (getUserMedia + face-api); C) cukup tautkan ke PWA.
- [ ] **absensi / antrean** — Layar Antrean Pengajuan (HR) belum ada di Vue padahal `GET /queue` + `POST /punches/{id}/decision` sudah ada; HR tak bisa memutus pengajuan dari Office Vue. Bukti: `laksamana-office-vue/app/composables/useAbsensi.ts:1-63`, `laksamana-api/docs/api/absensi.md:53-58`, `laksamana-office/absensi/index.html:1519-1573`. Opsi: A) buat `absensi/antrean.vue`; B) tetap di PWA.
- [ ] **absensi / wajah & atur** — Pendaftaran wajah (kamera) dan pengaturan HR (titik kerja + peta Leaflet + aturan) belum ada di Vue. Bukti: `laksamana-api/docs/api/absensi.md:60-81`, `laksamana-office/absensi/index.html:1578-1864`. Opsi: A) pindahkan hanya Atur (lokasi + aturan); B) pindahkan semuanya; C) tetap PWA.
- [ ] **absensi / riwayat** — Vue mengunci "Riwayat 14 hari terakhir" dan membuang pemilih `Dari`/`Sampai` serta kartu `Hari kerja`/`Total telat`/`Total lembur`. Bukti: `laksamana-office-vue/app/pages/absensi/index.vue:14-15`, `laksamana-office/absensi/index.html:1459-1497`. Opsi: A) kembalikan rentang + total; B) tetap 14 hari; C) buat opsional.
- [ ] **absensi / HR & diagnostik** — Vue mendeteksi HR dari isi baris (`others`) karena `/me` tak punya flag HR; dan `ping`/`stats` v1 tidak dirutekan. Bukti: `laksamana-office-vue/app/pages/absensi/index.vue:22`, `laksamana-office-vue/app/composables/useMe.ts:2-13`, `laksamana-api/app/Modules/Absensi/routes/v1.php:1-23`. Opsi: A) tambah flag HR di `/me` atau `/absensi/context`; B) cukup admin modul; C) `ping`/`stats` tidak perlu.
```

### `_lintas-modul.md` (siap tempel / koreksi)
- **Terverifikasi** (sudah ada di `_lintas-modul.md:35`): *Absensi membaca jadwal shift & DW (`deploy/index.html:1391`)*. Bukti kode: `laksamana-office/absensi-mysql/lib_absensi_mysql.php:523` (`dw-api-mysql?action=jadwalDW`), `:560` (`jadwal-api-mysql?action=shiftHari`); di v1 jadi service call langsung (`laksamana-api/docs/modules/absensi.md:75-76`). Status di `shift_hari`: array = ada shift (`ROSTER`/`DW`), `null` = tidak dijadwalkan (`NONE`), `false` = jadwal/DW tak menjawab (`TAK_TERBACA`, **tidak** mengantre).
- **Tambahan:** Absensi → Office/Account: login `masuk` diteruskan server-ke-server (`absensi-mysql/api.php:83-89`, `lib_absensi_mysql.php:431`); v1 `AccountService::login` in-process + wajib modul `absensi` (`laksamana-api/docs/modules/absensi.md:43`). Identitas `siapa{boleh,admin,hr}` juga dari akun Office. Absensi **tidak menulis** ke DB modul lain.
- **Catatan aset:** Absensi **tidak** memakai `deploy/assets/*.js`; asetnya milik subdomain sendiri (`vendor/face-api.min.js`, `models/`, `vendor/leaflet.*`, `sw.js`) — `absensi/index.html:360`, `:898-906`, `:1056-1058`, `:1875-1879`.

## J. Progres build
Branch: migrasi/absensi · Mulai: 2026-09-29
LANJUTKAN DARI: —

| layar (key) | file | status | endpoint dipakai | ditunda karena |
|---|---|---|---|---|
| absen | `app/pages/absensi/index.vue` | ✅ | `GET /absensi/context` (+ `POST /absensi/session` di PWA) | punch kamera+GPS → K-02 (PLAN.md §3 baris 15) |
| riwayat | `app/pages/absensi/riwayat.vue` | ✅ | `GET /absensi/recap` | — |
| antrean | `app/pages/absensi/antrean.vue` | ✅ | `GET /absensi/queue`, `POST /absensi/punches/{id}/decision` | — |
| wajah | `app/pages/absensi/wajah.vue` | ✅ | `GET /absensi/context`, `GET /absensi/faces` | daftar/hapus wajah → K-02 (PLAN.md §3 baris 15) |
| atur | `app/pages/absensi/atur.vue` | ✅ | `GET/POST/DELETE /absensi/locations`, `GET/PUT /absensi/settings` | peta Leaflet → K-03 (tanpa peta) |

Catatan build: Absensi **tidak punya `version`/ETag/`If-Match`** (kontrak
`laksamana-api/docs/api/absensi.md:14`), jadi tulisan tidak berversi. Konkurensi ditangani aturan domain —
keputusan antrean hanya selagi `MENUNGGU`, yang kalah diberi tahu lewat `{berubah:0}`. `tanganiKonflik()`
tetap dipanggil sebagai pola (untuk Absensi ia selalu mengembalikan `false`, lalu pesan API ditampilkan).
Deteksi HR memakai `siapa.hr` dari `GET /absensi/context` (T-05), bukan dari isi baris.

## K. Daftar uji cutover
Format: [cutover.md](cutover.md) §"Daftar uji per modul". Dijalankan owner di Vue dev (data dev), lalu
disilang ke PWA lama. Punch & pendaftaran wajah **belum** di Vue; yang diuji di sini hanya layar yang sudah ada.

| # | layar | langkah | hasil yang diharapkan |
|---|---|---|---|
| K1 | Absen | Buka `/absensi` untuk kru yang punya shift hari ini | Kartu Shift/Masuk/Pulang/Durasi & Jam server terisi dari server; badge status hari ini benar. Tombol "Buka aplikasi absen" membuka PWA. |
| K2 | Absen | Buka sebagai kru tanpa shift / dengan jadwal tak terbaca | Shift menulis "Tidak dijadwalkan" (atau "Jadwal tak terbaca"), bukan crash. |
| K3 | Absen | Cek syarat lokasi & wajah | "N titik kerja" / "Belum disetel" dan "Wajah terdaftar" / "Belum didaftarkan" sesuai kondisi; tidak ada perhitungan area di browser. |
| K4 | Riwayat | Buka `/absensi/riwayat` (kru) | Default awal bulan s.d. hari ini; hanya baris sendiri; total Hari kerja/Telat/Lembur tampil. |
| K5 | Riwayat | Ubah Dari/Sampai → Tampilkan; coba chip Bulan ini / 7 hari / Hari ini | Rentang ikut berubah, total & daftar ikut; tidak ada geser samping di 1366px, kartu rapi di 390px. |
| K6 | Riwayat | Buka sebagai HR | Kolom Nama muncul dan berisi semua orang (bukan hanya diri sendiri); kru tidak melihat kolom Nama. |
| K7 | Riwayat | Bandingkan satu hari yang punya Telat & Lembur dengan PWA lama | Angka telat/lembur/durasi **sama** (dihitung server), termasuk shift malam yang lewat tengah malam. |
| K8 | Antrean (HR) | Buka `/absensi/antrean` | Daftar pengajuan menunggu, terlama di atas; sebab, jarak, shift, wajah, alasan tampil. Kru tidak melihat menu Antrean. |
| K9 | Antrean (HR) | Setujui satu pengajuan | Konfirmasi sheet, toast "Disetujui", baris hilang dari daftar; di PWA lama absen itu jadi `VALID`. |
| K10 | Antrean (HR) | Tolak satu pengajuan | Toast "Ditolak"; di PWA lama absen jadi `DITOLAK` dan angka telat/lembur jadi nol. |
| K11 | Antrean (HR) | Dua HR membuka bersamaan, putus baris yang sama | Yang kedua melihat "sudah diputus orang lain lebih dulu", daftar dimuat ulang; tidak ada penimpaan. |
| K12 | Wajah | Buka `/absensi/wajah` (kru) | "Wajahmu sudah/belum terdaftar" sesuai; tautan PWA untuk mendaftar. Tidak ada tombol daftar/hapus di Vue. |
| K13 | Wajah (HR) | Buka daftar kru | Daftar dari `GET /faces`: nama, tipe (Kru/Pekerja harian), oleh, status Terdaftar/Kosong. Cocok dengan PWA lama. |
| K14 | Atur (HR) | Buka `/absensi/atur` | Titik kerja tampil dengan koordinat & radius; Aturan terisi dari `GET /settings`. Kru tidak melihat menu Atur. |
| K15 | Atur (HR) | Tambah titik: ketik lat/lng, atau tempel `-0.5071, 101.4478` → Baca koordinat; simpan | Titik tersimpan (`POST /locations`); muncul di daftar Vue **dan** di PWA lama; "Buka di Google Maps" mengarah ke titik itu. |
| K16 | Atur (HR) | Ubah radius jadi 10 lalu simpan | Server menjepit ke 30 m (kontrak); jangan mengandalkan browser. |
| K17 | Atur (HR) | Ubah titik jadi Nonaktif lalu simpan | Status Nonaktif tampil; titik tidak lagi dihitung untuk absen di PWA lama. |
| K18 | Atur (HR) | Hapus titik (konfirmasi) | Titik hilang di Vue & PWA lama; absen di sana masuk antrean pengajuan. |
| K19 | Atur (HR) | Ubah Aturan → Simpan | `PUT /settings`; nilai baru terbaca di PWA lama (toleransi telat, lembur, awal/akhir, ambang, saklar). Daftar `hr` tidak hilang. |
| K20 | Beranda | Widget "Absensi hari ini" | Masuk/Pulang hari ini tampil; tautan "Riwayat" menuju `/absensi/riwayat`. |

Silang wajib: K9–K11, K15–K19 dijalankan dua arah — ubah di Vue, periksa di PWA `absensi.laksamanamuda.id`
(dan sebaliknya) sebelum modul dinyatakan lulus C1.
