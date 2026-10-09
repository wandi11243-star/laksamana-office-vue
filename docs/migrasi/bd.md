# BD OS — inventaris migrasi

Status: ⚠️ selesai dengan celah
Terakhir diperbarui: 2026-09-29

> **Triase 2026-09-29** — status di tabel E yang bertentangan dengan catatan ini: catatan ini yang berlaku.
> Rincian: [`_pertanyaan.md`](_pertanyaan.md), [`_gap-api.md`](_gap-api.md).
> - Roster Office: ❌ `listModuleRoster` → ✅ `GET /api/v1/account/modules/bd/members` (U2, T-01).
> - `ping` ❌ → tidak dibawa (U3). Master vendor tanpa modul stock → G-02.

## Ringkasan
- Jumlah layar: 11 (2 layar detail tersembunyi dari menu: `projectDetail`, `prDetail`; Purchasing punya 3 sub-tab) · Aksi backend lama: 7 (`getAll`, `saveAll`, `stats`, `ping`, `addPo`, `setRealisasi`, + `listModuleRoster` ke account) · Gap v1: 2 ❌ (`ping`, sinkron roster `listModuleRoster`), 1 ⚠️ (bentuk simpan whole-state → CRUD per-record)
- BD OS adalah papan kerja tim Business Development, Project & Purchasing: task (Eisenhower), project + milestone, kalender, koordinasi antar-divisi, routine, daftar promo, purchasing (request order, PO, lembar PR mingguan bertanda tangan), dan Kru BD. Penggunanya pemegang kunci `bd`; di dalam modul tidak ada matriks izin per-halaman — hanya admin modul yang boleh mengubah susunan Penyetuju (`adminModul()`).
- Data disimpan sebagai satu blob state (8 koleksi + `focus` + `approverSets` + `promos`) lewat `getAll`/`saveAll` (debounce 800 ms). v1 menggantinya dengan CRUD per-record + `GET /state` + dokumen `settings`, jadi seluruh pola "sunting lalu simpan seluruh state" harus dirombak jadi per-record dengan version-check.
- Dua ketergantungan lintas modul yang harus diingat: **daftar kru `people` lahir dari roster Office** (`account-api-mysql?action=listModuleRoster`), dan **kolom Vendor PO membaca master vendor Purchasing** (`stock-api-mysql/vendors.php`) — keduanya hanya-pembaca, tidak ada penulisan balik.
- Risiko terbesar saat migrasi: (1) banyak perhitungan penting hidup di browser (kuadran Eisenhower, progress project, overbudget, kepatuhan routine, status promo) dan harus ikut pindah persis; (2) `saveAll` merekonsiliasi (baris yang tidak ikut dikirim DIHAPUS) — v1 tidak punya operasi itu, jadi penghapusan harus jadi DELETE per-record; (3) halaman Purchasing menjalankan dua alur (request vs dokumen PR) yang saling menunjuk lewat `prId`.

## A. Sumber
| jenis | path | baris |
|---|---|---|
| frontend lama | laksamana-office/deploy/bd/index.html | 4.936 |
| backend lama | laksamana-office/bd-mysql/api.php + lib_bd_mysql.php + README.md + schema.sql + migrasi-2026-07-23-pr-mingguan.sql | api.php 97 |
| kontrak v1 | laksamana-api/docs/api/bd.md | — |
| spec port | laksamana-api/docs/modules/bd.md | — |
| rute v1 | laksamana-api/app/Modules/Bd/routes/v1.php | 27 |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:671-694 "BD OS: saveAll hanya menghapus baris yang PERNAH DILIHAT tab itu (24 Sep 2026)" | 671-694 |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:7112-7180 "Master Vendor: di PURCHASING, dibaca Finance & BD (28 Agustus 2026)" | 7112-7180 |

## B. Akses
- Kunci Modul di launcher: `bd`. Gerbang di `<head>` SEBELUM apa pun digambar: butuh `lm_session` dengan `expiry` belum lewat dan `modules` memuat `bd` atau `*`; kalau tidak → `location.replace('../')` (`deploy/bd/index.html:6-12`).
- Identitas: dari `lm_session` (localStorage), **bukan** dari API (`:1157`, `:1249-1256`). `AKU` = baris `people` dengan `officeUserId === s.userId`, cadangan cocok nama (`:1249-1255`).
- Admin modul: `adminModules` memuat `*` atau `bd` (`adminModul()`, `:1258-1261`). Hanya admin yang boleh mengubah susunan Penyetuju (`:3894`, `:4783-4824`). Admin melihat seluruh data (`lingkup()` mengembalikan `null` = semua, `:1275-1280`).
- Lingkup visibilitas (bukan pagar keamanan, hanya fokus): `saya` = baris yang salah satu PIC-nya saya; `tim` = saya + seluruh anak buah; `semua` = seisi papan (`:1562-1594`, `:1275-1295`). "semua" tersedia untuk siapa pun (`:1566-1572`).
- Di dalam modul TIDAK ada role/matriks izin per-halaman lain. Hak masuk ditentukan grant Office, bukan tabel `people` (`:1266-1274`).
- Aksi khusus: susun set penanda tangan PR (`tambahSet`/`hapusSet`/`setNamaSet`/`jadikanSetBawaan`/`tambahKeSet`/`hapusDariSet`), semuanya dijaga `adminModul()` (`:4783-4824`).
- v1: `module:bd` (`routes/v1.php:6`, `docs/api/bd.md:6`). Gate sesi lama (`lib_sesi.php`) tidak ada di backend BD; access control lama "terbuka atau `API_TOKEN`" (`docs/modules/bd.md:28`, `api.php:46-49`).

## C. Daftar layar (dari NAV / SUB)
Sumber menu: `const NAV` (`:1333-1345`) + `const SUB` (`:1347-1357`) + dispatcher `peta` di `render()` (`:1380-1381`) + `HALAMAN_ALAMAT` (`:1394`).

| key | judul | subjudul | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| dashboard | Dashboard | Kondisi hari ini — BD, Project & Purchasing | semua (lingkup task/project) | tidak | `:1335`, `:1347` |
| tasks | Tasks | Prioritas ala Eisenhower — Penting × Mendesak | semua | tidak | `:1336`, `:1349` |
| projects | Projects | Pekerjaan besar berjangka + milestone | semua | tidak | `:1337`, `:1350` |
| projectDetail | Project | Detail project | via klik kartu | ya (bukan menu) | `:1351`, `bukaProject:1947` |
| calendar | Calendar | Deadline, milestone & agenda | semua | tidak | `:1338`, `:1355` |
| coord | Koordinasi | Request & follow-up ke divisi lain | semua | tidak | `:1340`, `:1352` |
| routine | Routine | Task berulang & kepatuhannya | semua | tidak | `:1341`, `:1353` |
| promo | Promotion | Promo yang berjalan & akan datang — otomatis terbaca seluruh kru di modul Radar | semua | tidak | `:1342`, `:1354` |
| purchasing | Purchasing | Purchase request mingguan, vendor & status pembelian | semua | tidak | `:1343`, `:1355` |
| prDetail | Purchase Request | Lembar mingguan siap cetak | via `bukaPr` | ya (bukan menu) | `:1356`, `bukaPr:3576` |
| tim | Kru BD | Siapa mengerjakan apa, dan siapa atasannya | semua | tidak | `:1345`, `:1357` |

Catatan halaman:
- `prDetail` sengaja TIDAK bisa dituju lewat hash karena butuh `prAktif`; alamat yang menyebut dokumen terhapus akan membuka layar kosong (`:1386-1392`).
- Purchasing punya 3 sub-tab internal (bukan view key): **PR & Rekap Mingguan** (`vPrList` `:3418` + `poRekapMingguan` `:3290`), **Semua Item** (`poDaftar` `:3180`), **Penyetuju** (`vPenyetuju` `:3879`); variabel `poMode` (`:3116`). `poMode` lama `'minggu'` tanpa tombol tetap jatuh ke PR (`:3166-3176`).

## D. Detail per layar

### D.1 dashboard — Dashboard
- **Tampilan:** 5 kartu angka (`stat`): "Task aktif", "Overdue", "Project jalan", "Koordinasi pending", "PO berjalan" (`:1503-1507`); baris "★ Fokus utama hari ini" (input auto-save); grid: Prioritas teratas (6 task terurut overdue→kuadran→deadline), Overdue (6 pertama), Kesehatan project (`projMini`), Agenda hari ini (`:1504-1536`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | (ikon) Task baru | `taskModal()` | `saveAll` | `POST /tasks` | `:1491` |
  | Semua task › | `APP.go('tasks')` | — | — | `:1519` |
  | Buka › | `APP.go('projects')` | — | — | `:1524` |
  | Coba lagi / Segarkan / Buka Kru BD | `segarkanKru()` / `go('tim')` pada pita peringatan | `listModuleRoster` / — | — | `:1459-1470` |
- **Form & field:** Fokus harian `fokusInp` → `DB.focus[catIniAku()]={teks,tgl}` (disimpan BERSAMA tanggal, `:1542-1551`).
- **Perhitungan di browser:** urutan prioritas = overdue dulu, lalu `(important?2:0)+(urgent?1:0)` desc, lalu deadline asc (`:1481-1487`). `agHariIni = DB.agenda.filter(e.date===todayISO())` (`:1478`).
- **Real-time / polling:** seluruh halaman digambar ulang tiap polling 20 detik (`:1128-1140`).
- **Catatan:** Dashboard memakai lingkup yang sama dengan Tasks (`tasksTerlihat`) tapi Coord/PO dihitung global (`:1472-1479`).

### D.2 tasks — Tasks
- **Tampilan:** 4 mode: **Matrix** (Eisenhower DO/SCHEDULE/DELEGATE/DELETE), **Hari ini & overdue**, **Minggu ini** ("7 hari ke depan"), **Per Divisi** (`:1646-1688`). Baris task: nama, deskripsi, tag kuadran, divisi, project, avStack PIC, tipe, deadline (`taskRow` `:1430-1452`).
- **Filter / cari / urut / pager:** lingkup `Tim saya`/`Ditugaskan ke saya`/`Semua` (`:1581-1594`); `Semua divisi`, `Semua project`, `Semua tipe`; filter PIC banyak (chip) (`:1601-1613`); tombol `Reset`. Tidak ada pager.
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | Matrix / Hari ini / Minggu ini / Per Divisi | `setTaskMode(m)` | — | — | `:1618-1624` |
  | Task | `taskModal()` | `saveAll` | `POST /tasks` | `:1627` |
  | chk (ikon centang) | `toggleTask(id)` → Done/To Do, progress 100/0 | `saveAll` | `PATCH /tasks/{id}` | `:1700-1707` |
  | Edit / Hapus (ikon) | `taskModal` / `hapusTask` (konfirmasi "Hapus task ini? Semua kru ikut kehilangan datanya.") | `saveAll` | `PUT /tasks/{id}`, `DELETE /tasks/{id}` | `:1445-1448`, `:1710-1714` |
  | drag kartu antar kotak | `dropTask(imp,urg)` | `saveAll` | `PATCH /tasks/{id}` | `:1692-1698` |
- **Form & field (`taskModal` `:1770-1806`):**
  | field (nama data) | label UI | tipe | wajib | default / pilihan | validasi & pesan |
  |---|---|---|---|---|---|
  | name | Nama task | text | ya | — | `'Nama task wajib diisi.'` (`:1818`) |
  | desc | Deskripsi | textarea | tidak | — | — |
  | div | Divisi | select | ya | OWNER_DIVS (`:713`) | — |
  | pics | PIC — boleh lebih dari satu | picPicker | tidak | `[AKU.id]` | — |
  | status | Status | select | ya | STATUS_FLOW (`:719`) | Done → progress=100 (`:1833`) |
  | priority | Prioritas | select | ya | PRIORITAS (`:721`) | — |
  | type | Tipe | select | ya | `['Ad-hoc','Rutin','Project']` | — |
  | deadline | Deadline | date | tidak | `todayISO()` | — |
  | project | Project (opsional) | select | tidak | `opsiProject` | Completed tidak ditawarkan (`:1853-1864`) |
  | important / urgent | Penting / Mendesak | toggle | ya | `true`/`false` | pratinjau kuadran `qprev()` (`:1809-1815`) |
- **Perhitungan di browser:** status Done = `status==='Done'` (`:1324`); lewat = deadline & bukan Done & `sisaHari<0` (`:1325`); kuadran = turunan `important+urgent`, TIDAK disimpan (`:1316-1322`).
- **Catatan:** task berubah PIC → `setPics()` selalu menulis `pic`+`pics` bersamaan (`:1036-1041`, `:1836`).

### D.3 projects — Projects
- **Tampilan:** kanban 5 kolom `PROJ_STAGES` = Idea/Planning/Running/Review/Completed (`:723`, `:1898-1905`); kartu `projCard` (`:1907-1917`).
- **Filter:** lingkup + divisi + PIC (sama seperti Tasks) (`:1893-1897`); penanda `"N dari M project"`.
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | Project | `projModal()` | `saveAll` | `POST /projects` | `:1894` |
  | drag antar kolom | `dropProj(st)`; ke `Completed` memanggil `tuntaskanTaskProject` | `saveAll` | `PATCH /projects/{id}` + `PATCH` task | `:1936-1946` |
  | klik kartu | `bukaProject(id)` → projectDetail | — | — | `:1947` |
- **Form & field (`projModal` `:1995-2033`):** `name` (Nama project, wajib, `'Nama project wajib diisi.'` `:2047`), `desc`, `div`, `type` (default `'Internal'`), `stage` (PROJ_STAGES), `pics`, `start`, `end` (default `inDays(30)`), `budget`/`spent` (rpInput, disimpan `int`), `health` (`on-track`/`at-risk`/`off-track`), `milestones` (textarea, satu per baris `nama | YYYY-MM-DD`, `bacaMilestone` `:2035-2040`).
- **Perhitungan di browser:** `projProgress` = % task selesai; kalau tak ada task → % milestone; kalau kosong → 0 (`:1883-1888`). `sisaBudget = budget - spent`; negatif → "LEWAT" (`:1958`, `:1973`).
- **Catatan:** mengubah stage ke `Completed` menutup semua task-nya (`:2058-2062`, `:1872-1880`).

### D.4 projectDetail — Project (tersembunyi)
- **Tampilan:** 4 kartu (`Health`, `Progress`, `Budget terpakai`, `PIC`); daftar task project; Milestone (klik centang); Deskripsi; Koordinasi divisi lain; Purchase order terkait (`:1948-1989`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | Semua project | `go('projects')` | — | — | `:1960` |
  | Edit | `projModal(pid)` | `saveAll` | `PUT /projects/{id}` | `:1961` |
  | Task | `taskModal(null, pid)` (preset project) | `saveAll` | `POST /tasks` | `:1962` |
  | Milestone (item) | `toggleMilestone(pid,i)` | `saveAll` | `PATCH /projects/{id}` | `:2033-2038` |
- **Catatan:** `hapusProject` melepas tautan task/PO/coord (set `project=null`), tidak menghapusnya (`:2064-2074`).

### D.5 calendar — Calendar
- **Tampilan:** grid Senin-pertama, navigasi bulan, legenda 5 warna (Deadline task / Milestone / PO / Koordinasi / Agenda tim) (`:4389-4444`).
- **Filter:** lingkup + divisi + PIC SAMA dengan Projects (`pScope`/`pDiv`/`fPics`) (`:4416-4423`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | ‹ › | `geserBulan(-1/1)` | — | — | `:4404-4406` |
  | Bulan ini | `bulanIni()` | — | — | `:4407` |
  | Agenda | `agendaModal()` | `saveAll` | `POST /agenda` | `:4408` |
  | drag "deadline task" | `dropCal(iso)` (hanya task yang bisa diseret) | `saveAll` | `PATCH /tasks/{id}` | `:4359-4385`, `:4348-4356` |
- **Form agenda (`agendaModal` `:4456-4480`):** `title` (Judul agenda, wajib, `'Judul agenda wajib diisi.'` `:4482`), `date` (Tanggal), `type` (`Meeting`/`Vendor`/`Internal`/`Deadline`), `div` (OWNER_DIVS). **Field data = `date`**, sedangkan kolom SQL = `tanggal` (`lib_bd_mysql.php:194-197`).
- **Perhitungan:** `calItems()` menggabungkan task (merah), milestone (violet), PO belum beres (teal), koordinasi belum Selesai (warn), agenda (gold) (`:4329-4357`).

### D.6 coord — Koordinasi
- **Tampilan:** mode Board (kanban `COORD_FLOW` Diminta/Diproses/Review/Selesai) atau Tabel (`:2086-2148`); pita penjelasan "Ini catatan permintaan kita, bukan task divisi tujuan" (`:2097-2099`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | Board / Tabel | `setCoordMode` | — | — | `:2092-2093` |
  | Request | `coordModal()` | `saveAll` | `POST /coord-requests` | `:2094` |
  | drag antar kolom | `dropCoord(st)` | `saveAll` | `PATCH /coord-requests/{id}` | `:2121-2127` |
  | Hapus | `hapusCoord` (konfirmasi "Hapus request koordinasi ini?") | `saveAll` | `DELETE /coord-requests/{id}` | `:2142`, `:2189-2194` |
- **Form (`coordModal` `:2145-2186`):** `title` (Judul request, wajib, `'Judul request wajib diisi.'` `:2182`), `desc` (Detail), `fromDiv` (Divisi peminta, OWNER_DIVS), `toDiv` (Divisi tujuan, COORD_DIVS `:714`), **`to` = "PIC di divisi tujuan" teks bebas** (bukan dropdown, `:2163-2165`), `status` (COORD_FLOW), `priority` (PRIORITAS), `due` (Due, default `inDays(3)`), `project` (opsiProject).
- **Catatan:** koordinasi tidak ikut disaring PIC (tidak punya PIC sisi BD) (`:4290-4295`).

### D.7 routine — Routine
- **Tampilan:** 3 kartu ("Routine aktif", "Kepatuhan", "Terlewat") + tabel routine (`:2196-2235`).
- **Aksi:** `Routine` → `routineModal()`; klik baris → modal; Hapus (`hapusRoutine`, konfirmasi "Hapus routine ini beserta catatan kepatuhannya?") (`:2228-2234`, `:2270-2275`).
- **Form (`routineModal` `:2226-2262`):** `name` (Nama routine, wajib, `'Nama routine wajib diisi.'` `:2261`), `div` (default `'Purchasing'`), `pic` (PIC tunggal, `picOptions`), `freq` (`Daily`/`Weekly`/`Monthly`/`Custom`), `time` (Waktu / jadwal, teks bebas), `done`/`total`/`missed` (number), `important`/`urgent` (toggles), `active` (toggle Aktif).
- **Perhitungan di browser:** kepatuhan rata-rata = `Math.round(Σ(total? done/total : 1) / aktif.length × 100)` (`:2197-2198`); kepatuhan baris = `total? round(done/total*100) : 100` (`:2212`).

### D.8 promo — Promotion
- **Tampilan:** 4 kartu status ("Berlangsung", "Akan datang", "Dijeda", "Selesai"); chip filter status; filter tipe; kotak cari `promo_cari`; tabel promo (`:2484-2545`). Detail modal + poster (`promoDetail` `:2547-2578`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | ⬇ Export Excel | `promoExport()` unduh `promo_<YYYY-MM-DD>.csv` | (lokal) | — | `:2491`, `:2955-2968` |
  | ⬆ Import Excel | `promoImportPilih()` → baca CSV → pratinjau | (lokal) | — | `:2492`, `:2970-3113` |
  | Promo | `promoModal()` | `saveAll` | `POST`/`PUT settings/promos` | `:2493` |
  | Jeda promo / Aktifkan lagi | `togglePromo(id)` | `saveAll` | `PUT settings/promos` | `:2571`, `:2797-2802` |
  | Ubah | `promoModal(id)` | `saveAll` | `PUT settings/promos` | `:2572` |
  | Hapus | `hapusPromo` (konfirmasi `Hapus promo "<nama>"?\n\nIa juga akan hilang dari modul Radar…`) | `saveAll` | `PUT settings/promos` | `:2803-2810` |
- **Form (`promoModal` `:2580-2694`):**
  | field (nama data) | label UI | tipe | wajib | default / pilihan | validasi & pesan |
  |---|---|---|---|---|---|
  | nama | Nama promo * | text | ya | — | `'Nama promo wajib diisi.'` (`:2761`) |
  | tipe | Tipe promo | select | ya | `PROMO_TIPE` (in_house default) | — |
  | kategori | Kategori | select | tidak | `PROMO_KAT` (diskon/free_item) | — |
  | benefit | Benefit / nilai diskon | text | tidak | — | — |
  | mulai / selesai | Tanggal mulai * / Tanggal selesai * | date | ya | — | `'Tanggal mulai & selesai wajib diisi.'`; `'Tanggal selesai tidak boleh sebelum tanggal mulai.'` (`:2762`, `:2767`) |
  | jamMulai/jamSelesai | Jam mulai / Jam selesai | time | tidak | di balik centang "Berlaku pada jam tertentu saja" | dimatikan → dikosongkan (`:2675-2680`) |
  | hari | Hari berlaku | checkbox 0–6 | tidak | `[]` = setiap hari | legacy teks ditampilkan apa adanya (`:2622-2628`) |
  | outlet | Outlet / cabang | select | ya | `PROMO_OUTLET_BAWAAN` + "Lainnya (ketik sendiri)…" | `'Nama outlet barunya belum diisi.'` (`:2772`) |
  | kode | Kode / voucher | text | tidak | di-`toUpperCase()` | — |
  | partner/partnerPIC/partnerKontak | Kerjasama dengan / PIC partner / Kontak partner | text | tidak | — | — |
  | lmPIC | PIC Laksamana | text | tidak | nama sesi | — |
  | kuota | Kuota (0 = tanpa batas) | number | tidak | 0 | `Math.max(0,…)` |
  | ketentuan | Syarat & ketentuan | textarea | tidak | — | — |
  | poster | Poster promo | file `image/*` | tidak | — | bukan gambar → `'Berkasnya bukan gambar.'`; >400 KB → `'Gambarnya masih terlalu besar…'` (`:2726-2752`) |
- **Perhitungan di browser:** `promoStatus` = paused / upcoming / ended / running dari tanggal, TIDAK disimpan (`:2365-2371`); `promoSisa` (`:2372-2378`); urutan `PROMO_URUT` running→upcoming→paused→ended (`:2389-2394`).
- **Import CSV:** kolom `PROMO_CSV_KOL` (`:2840-2858`), hanya `nama/mulai/selesai/benefit` yang dibaca; tanggal `17-08-2026` dibaca hari-dulu (`promoCsvTgl` `:2875-2891`); promo baru default "Promo Laksamana", setiap hari, outlet "Laksamana Muda", tanpa kategori & ketentuan (`:3079-3106`).
- **Catatan:** status/kategori/poster/ketentuan promo dibaca juga oleh Radar — jangan ganti nama field (`:2306-2312`).

### D.9 purchasing — Purchasing (3 sub-tab)
- **Tampilan ringkasan:** 3 kartu ("Total PO", "Perlu approval", "Nilai berjalan") (`:3154-3158`).
- **Sub-tab:**
  - **PR & Rekap Mingguan** (`:3167-3177`): daftar "N request menunggu dijadikan lembar PR" + tabel `vPrList` (`:3418-3539`); di bawahnya "Rekap kebutuhan mingguan" (`poRekapMingguan` `:3290-3416`) dengan navigasi minggu dan ringkasan "Enam minggu terdekat".
  - **Semua Item** (`poDaftar` `:3180-3190`): filter status (`PO_FLOW`), tabel `poTabel` (`:3241-3288`).
  - **Penyetuju** (`vPenyetuju` `:3879-3952`) — lihat D.11.
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | PR & Rekap Mingguan / Semua Item / Penyetuju | `setPoMode(m)` | — | — | `:3148-3150` |
  | Request Order | `requestModal()` | `saveAll` | `POST /purchase-orders` | `:3159` |
  | Buat PR dari N item | `buatPr()` (konfirmasi dulu, `:3553-3558`) | `saveAll` | `POST /purchase-requests` + `PATCH` PO `prId` | `:3432`, `:3541-3568` |
  | ‹ › / Minggu ini / baris minggu | `geserMingguPo`/`pilihMinggu` | — | — | `:3307-3311`, `:3342` |
  | ✓ Done / Belum | `togglePoProses(id)` | `saveAll` | `PATCH /purchase-orders/{id}` (atau `PUT …/realisasi`) | `:3222-3247` |
  | klik baris | `poModal(id)` | `saveAll` | `PUT /purchase-orders/{id}` | `:3252` |
  | Hapus | `hapusPo` (konfirmasi "Hapus purchase order ini?") | `saveAll` | `DELETE /purchase-orders/{id}` | `:3467`, `:4301-4305` |
- **Form Request Order (`requestModal` `:4175-4238`):** sekali duduk banyak baris. Header: `q_div` Divisi peminta (OWNER_DIVS), `q_need` Dibutuhkan tanggal (default `akhirMinggu(todayISO())`), `q_proj` Project (opsional). Per baris: `q-item` Nama barang/jasa, `q-qty` (default 1), `q-unit` (default `Unit`), `q-note` Alasan/kebutuhan, `q-by` Request (PIC peminta, per baris), `q-amount` Perkiraan harga (boleh kosong). Baris tanpa `item` diabaikan (`:4218`). Pita: "Semua baris masuk berstatus **Diajukan**" (`:4179-4182`).
- **Form PO penuh (`poModal` `:4240-4284`):** pita "Diajukan oleh <nama> pada <tgl> · N hari lalu" (`:4260-4262`); `o_item` (wajib, `'Nama item wajib diisi.'` `:4291`), `o_vendor` (datalist dari master Purchasing, `:4263-4269`), `o_amount` (rpInput), `o_qty`, `o_unit`, `o_need`, `o_div`, `o_pic`, `o_status` (PO_FLOW), `o_proj`, `o_note`.
- **Perhitungan di browser:** `poBeres` = `!!proses || status==='Diterima'` (`:3211`); `poRequester` = `by`→`byName`→`pic` (`:3135-3140`); rekap mingguan dikelompokkan menurut `needBy` (`:3290-3296`); `prTotal` = grand total + jumlah item tanpa harga (`:3383`); `prNoBerikut` = angka TERTINGGI + 1 (`:3392-3398`).
- **Catatan:** request & PO adalah baris YANG SAMA, bukan dua tabel; `prId` menunjuk dokumen (`:3106-3116`).

### D.10 prDetail — Purchase Request (tersembunyi)
- **Tampilan:** lembar siap cetak `.doc` (kop "Laksamana Muda / COFFEE & LIVE SPACE / Jl. Soekarno Hatta No. 39, Payung Sekaki, Pekanbaru", judul `PURCHASE REQUEST PR-<no>`, meta PR No/Name/Department/Request Date) + tabel item dengan kolom **Harga**, **Realisasi** (input), **Overbudget** (hitung), **Proses** (no-print); blok APPROVE BY; catatan kaki; kartu "Tambahkan request lain ke lembar ini" (`:3593-3745`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | Semua dokumen PR | `go('purchasing')` | — | — | `:3618` |
  | Kepala surat | `prModal(id)` | `saveAll` | `PUT /purchase-requests/{id}` | `:3620` |
  | Cetak / Simpan PDF | `cetakPr()` (`window.print()`, judul → `Purchase Order PR-<no>`) | (lokal) | — | `:3621`, `:4843-4864` |
  | Kunci & ajukan / Kembalikan ke Draft | `statusPr('Diajukan'|'Draft')` | `saveAll` | `PATCH /purchase-requests/{id}` | `:3622-3624`, `:3786-3792` |
  | Setujui / ✕ (batalkan) | `setujuPr(k, batal)` | `saveAll` | `PATCH /purchase-requests/{id}` | `:3739-3744`, `:4058-4078` |
  | Masukkan | `masukkanKePr(poId)` | `saveAll` | `PATCH /purchase-orders/{id}` (`prId`) | `:3762`, `:3778-3784` |
  | ✕ (Keluarkan dari PR ini) | `lepasDariPr(poId)` | `saveAll` | `PATCH /purchase-orders/{id}` | `:3684`, `:3770-3776` |
  | isi kotak Realisasi | `isiRealisasi(id,val)` (debounce 500 ms) | `saveAll` | `PUT /purchase-orders/{id}/realisasi` | `:3851-3877` |
- **Form kepala surat (`prModal` `:4082-4107`):** `r_no` (PR No, dicek duplikat `'PR nomor <no> sudah ada. Pakai nomor lain.'` `:4117`), `r_tgl` (Request date), `r_nama` (Name penyusun), `r_dept` (Department), `r_ap_<id>` (Nama penyetuju, dicopy ke dokumen), `r_cat` (Catatan kaki).
- **Perhitungan di browser:** `realisasiNum` = null kalau kosong (bukan 0) (`:3806-3808`); `overbudget = amount − realisasi`, positif = hemat (`:3810-3812`); total realisasi & overbudget hanya baris yang sudah terisi (`:3696-3711`); `prBeres` = semua item beres DAN minimal satu item (`:3379-3382`); `rzFormat` titik ribuan (`:3847-3850`).
- **Hak setuju:** hanya orang yang bersangkutan atau admin (`bolehSetuju` `:4031-4042`); alasan tombol mati `'Hanya <nama> atau admin BD yang bisa menekan ini.'` / `'<nama> belum terdaftar di User Database Office — mintakan akunnya dibuat dulu.'` (`:4045-4049`). Ini jejak, BUKAN otorisasi (dicek di browser) (`:4050-4057`).

### D.11 penyetuju — sub-tab Purchasing (Penyetuju)
- **Tampilan:** daftar set penanda tangan (`{id,nama,orang:[personId],bawaan}`); tabel per set: `#`, Nama, "Jabatan (dari Office)", aksi (`:3879-3952`). Jabatan = `ket` Office → fallback `role` → `'—'` (`jabatanOrang` `:3976-3980`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | + Set penyetuju baru | `tambahSet()` | `saveAll` | `PUT settings/approverSets` | `:3950`, `:4783-4787` |
  | Jadikan bawaan | `jadikanSetBawaan(id)` | `saveAll` | `PUT settings/approverSets` | `:4803-4807` |
  | Hapus set | `hapusSet(id)` | `saveAll` | `PUT settings/approverSets` | `:4788-4797` |
  | + Tambah penanda tangan | `tambahKeSet(id)` | `saveAll` | `PUT settings/approverSets` | `:4808-4817` |
  | ✕ (Keluarkan) | `hapusDariSet(id,pid)` | `saveAll` | `PUT settings/approverSets` | `:4818-4823` |
  | input nama set | `setNamaSet(id,v)` | `saveAll` | `PUT settings/approverSets` | `:4798-4802` |
- **Catatan:** hanya admin BD (`:3894`, `adminModul:1258`). Set bawaan dibuat dari `PENYETUJU_BIBIT` (`['Dina Mariana','Howandi Chandra','Wandi Pranata']`, `:755`) HANYA sekali saat belum ada set (`setBawaan` `:3956-3967`). Setelan disimpan di tabel `settings` key `approverSets`, bukan koleksi bertabel sendiri (`:3938-3948`).

### D.12 tim — Kru BD
- **Tampilan:** hierarki atasan→anak buah (indentasi), tabel Nama/Jabatan/Divisi/Atasan/Task aktif/Akses; penanda `kamu`, `dicabut`, `nonaktif` (`:4500-4553`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | Segarkan dari Office | `segarkanKru()` → `sinkronRoster(false)` | `listModuleRoster` | ❌ (tidak ada di v1) | `:4502`, `:4867-4873` |
  | klik baris | `orangModal(id)` | — | — | `:4548` |
  | Hapus dari daftar (ikon) | `hapusOrang(id)` — hanya untuk akses dicabut & tanpa task aktif | `saveAll` | `DELETE /people/{id}` | `:4550`, `:4611-4632` |
- **Form (`orangModal` `:4554-4586`):** hanya 3 field milik BD OS: `k_role` (Jabatan), `k_div` (Divisi, OWNER_DIVS + "— belum diatur —"), `k_boss` (Atasan langsung). Nama & hak akses dari Office, tidak bisa diedit (`:4561-4566`).
- **Perhitungan di browser:** jumlah task aktif & lewat per orang (`:4531-4532`). Cegah atasan melingkar (`simpanOrang` `:4588-4609`, pesan `'Atasan melingkar — orang ini sudah jadi atasan dari kru tersebut.'`).
- **Catatan:** TIDAK ADA tombol tambah kru; siapa yang boleh masuk ditentukan Office (`:4499-4505`).

## E. Pemetaan backend
Sumber aksi: `laksamana-office/bd-mysql/api.php` (`getAll` `:52`, `stats` `:55`, `ping` `:58`, `addPo` `:62`, `setRealisasi` `:72`, `saveAll` `:84`). Frontend BD sendiri hanya memanggil `getAll` (`:4919`, polling `:1128`) dan `saveAll` (`:1108`).

| action lama | dipakai di layar | baca/tulis | endpoint v1 | status ✅/⚠️/❌ | catatan |
|---|---|---|---|---|---|
| `getAll` (GET default) | boot + polling 20 s semua layar | baca | `GET /api/v1/bd/state` | ✅ | bentuk sama (8 koleksi + focus + approverSets + promos + `_serverTs`), `docs/api/bd.md:31-36` |
| `saveAll` | SEMUA mutasi (debounce 800 ms) | tulis | per-resource `POST/PUT/PATCH/DELETE /api/v1/bd/{resource}` + `PUT /settings/{key}` | ⚠️ | legacy mengirim SELURUH state & merekonsiliasi (menghapus yang tak dikirim); v1 per-record + version wajib, `docs/api/bd.md:44-49`,`:70-75` |
| `addPo` | bukan frontend BD; dipanggil Marketing | tulis | `POST /api/v1/bd/purchase-orders/batch` | ✅ | insert-only, id selalu dibuat server (`po<10 hex>`), `status` default `Diajukan` (`docs/api/bd.md:57`) |
| `setRealisasi` | bukan frontend BD; dipakai Finance → Kas Kecil | tulis | `PUT /api/v1/bd/purchase-orders/{id}/realisasi` | ✅ | `prosesBy` dari sesi, bukan body (`docs/api/bd.md:58`) |
| `stats` | tidak dipanggil frontend BD | baca | `GET /api/v1/bd/stats` | ✅ | row counts, blob size, env, db, versi (`docs/api/bd.md:37`) |
| `ping` | tidak dipanggil frontend BD | baca | — | ❌ | v1 tidak punya `/ping`; `GET /stats` sudah membawa `versi`/`env`/`db` — lihat I |
| `listModuleRoster` (ke `account-api-mysql`) | boot + Kru BD "Segarkan" | baca | — | ❌ | v1 `bd` tidak punya padanan roster; mengisi tabel `people` (`:1168-1193`, `:1236-1247`) — lihat I |
| (vendor master, bukan action) | form PO — kolom Vendor | baca | `GET /api/v1/stock/vendors` | ✅ | legacy baca `../stock-api-mysql/vendors.php` (`:2417-2445`); v1 ada di modul Stock (`docs/api/stock.md:22`,`:49`) |

Konkurensi: legacy `saveAll` hanya punya penjaga urutan `updated_at` (baris kiriman yang lebih lama tidak menimpa baris server yang lebih baru) dan menghapus `NOT IN` ids dengan batas `sinceTs` + daftar `dikenal` (`docs/modules/bd.md:39-47`, `CLAUDE.md:671-694`). v1: record version = `updated_at` (ms), dokumen = 16 hex pertama `sha1`; kirim via `If-Match: "<version>"` atau `?version=` — kosong → `428 version_required`, basi → `409 version_conflict` (`error.details.current`) (`docs/api/bd.md:70-75`). Semua tulis memakai `GET_LOCK('<db>:bd_save')`, pesan sibuk legacy: `Server sedang sibuk menyimpan, coba lagi sebentar.` (`docs/modules/bd.md:69`, `lib_bd_mysql.php:74`).
Kode error yang wajib ditangani UI (`docs/api/bd.md:77-86`): `401 unauthenticated`, `403 module_not_granted`, `404 not_found`, `409 already_exists`/`version_conflict`, `422 validation_failed`/`invalid_request`, `428 version_required`.

## F. Aturan bisnis yang wajib dibawa
1. **Kuadran Eisenhower adalah TURUNAN** dari `important`+`urgent`, tidak pernah disimpan; menyimpan turunan = dua kebenaran bisa menyimpang — bukti: `deploy/bd/index.html:1316-1322`.
2. **Progress project DIHITUNG dari task** (fallback milestone), bukan angka manual — bukti: `:1883-1888`.
3. **Menutup project (stage → Completed) menutup semua task-nya** (`status='Done'`, `progress=100`); dipanggil HANYA saat stage berpindah, bukan tiap render — bukti: `:1872-1880`, `:1936-1946`, `:2058-2062`.
4. **Menghapus project tidak menghapus task/PO/koordinasi**; tautannya dilepas (`project=null`) supaya penyaring tidak menampilkan baris hantu — bukti: `:2064-2074`.
5. **PIC banyak; `pic` = `pics[0]`** dan keduanya selalu ditulis bersamaan lewat `setPics()`; tidak ada "PIC utama" — bukti: `:1026-1041`, `:1743-1747`.
6. **PIC yang aksesnya dicabut tetap muncul** kalau dia PIC baris yang sedang dibuka, supaya simpan tidak diam-diam menghapus PIC — bukti: `:1715-1727`.
7. **`saveAll` menghapus baris yang tidak ikut dikiriman**, dibatasi `sinceTs` + daftar `dikenal` (id yang pernah dilihat tab); insiden PR-11 hilang (24 Sep 2026) — bukti: `CLAUDE.md:671-694`, `:1066-1085`, `README.md` bd-mysql.
8. **Penanda "Sudah diproses" MENGGERAKKAN status ke `Diterima`** dan menyimpan `statusSebelum`; membatalkan mengembalikan status itu saja — bukti: `:3222-3247`, `docs/modules/bd.md:49-53`.
9. **Realisasi kosong ≠ 0**; `overbudget = amount − realisasi` DIHITUNG, positif = hemat; total realisasi hanya dari baris terisi ("N dari M item") — bukti: `:3806-3812`, `:3696-3711`.
10. **Lembar PR SELESAI dihitung, bukan penanda tersimpan**; lembar KOSONG tidak pernah dianggap selesai — bukti: `:3379-3382`.
11. **Nomor PR dari yang TERTINGGI +1**, tidak boleh dipakai ulang; nomor ganda ditolak — bukti: `:3392-3398`, `:4117-4118`.
12. **Menyetujui hanya boleh orangnya sendiri atau admin BD**; ini rekam jejak, BUKAN otorisasi (dicek di browser; yang mengikat tetap PDF bertanda tangan) — bukti: `:4031-4057`.
13. **Jabatan penanda tangan diambil dari Tim/Keterangan Office** (`ket`), fallback `role`, lalu `'—'`; TIDAK pernah dikarang — bukti: `:3976-3980`, `:3896-3898`.
14. **Susunan penanda tangan bisa lebih dari satu set**, disimpan di tabel `settings` key `approverSets` (bukan tabel sendiri, agar tak perlu migrasi manual) — bukti: `:3938-3948`, `:3949-3954`.
15. **Status promo DIHITUNG dari tanggal tiap kali dibaca**, tidak pernah disimpan (basi tiap tengah malam); urutan running→upcoming→paused→ended dipakai bersama Radar — bukti: `:2361-2376`, `:2389-2394`.
16. **Promo dengan tanggal selesai < mulai DITOLAK** (form & impor), supaya tidak hilang dari Radar tanpa pesan — bukti: `:2767`, `:3020`.
17. **`paused` tidak ikut field form promo**, supaya memperbaiki nama tidak mengaktifkan promo yang sengaja dijeda — bukti: `:2787-2794`.
18. **Hari berlaku disimpan sebagai array indeks 0–6**; teks warisan tetap digambar apa adanya, tidak ditebak — bukti: `:2325-2338`.
19. **Poster dikecilkan di peramban** (maks 800 px, diturunkan sampai <400 KB); gagal di tahap mana pun HARUS bersuara — bukti: `:2726-2752`.
20. **Master vendor ada di Purchasing, BD hanya PEMBACA**; yang disimpan NAMA vendor; nama tak dikenal tetap boleh disimpan (diberi tanda) — bukti: `:2405-2460`, `CLAUDE.md:7112-7180`.
21. **Roster kru dari Office; sinkron TIDAK PERNAH menghapus**, kru yang aksesnya dicabut ditandai `tanpaAkses` (jejak historis) — bukti: `:1194-1234`, `:1213-1215`.
22. **Tidak ada tombol tambah kru**; nama & hak akses milik Office, hanya `role/div/boss` milik BD OS — bukti: `:4499-4505`, `:4561-4566`.
23. **Atasan menentukan visibilitas** (atasan melihat task seluruh anak buah, langsung/tidak); cegah atasan melingkar — bukti: `:1263-1273`, `:4588-4609`.
24. **Menghapus kru hanya bila akses dicabut DAN tidak memegang pekerjaan apa pun** — bukti: `:4611-4632`.
25. **Tanggal SELALU lewat helper lokal (`isoOf`/`todayISO`), tidak pernah `toISOString()`** — WIB vs UTC membuat task tertuduh overdue tiap pagi — bukti: `:767-772`.
26. **Fokus harian disimpan BERSAMA tanggalnya** agar tidak menempel selamanya — bukti: `:1542-1551`.
27. **Baris kosong Request Order diabaikan**, bukan ditolak; harga boleh kosong, semua baris berstatus `Diajukan` — bukti: `:4179-4182`, `:4218`.
28. **Rekap mingguan dikelompokkan menurut `needBy`** (kapan barang dipakai), bukan tanggal request — bukti: `:3290-3296`.
29. **Item PR SELALU bisa diubah**, termasuk sesudah diajukan; setiap revisi sesudah "Diajukan" perlu kirim ulang PDF — bukti: `:3600-3613`, `:3625-3630`.
30. **Simpan di-debounce 800 ms; polling 20 s hanya saat idle** (tidak menyimpan, tidak ada perubahan menggantung, tab terlihat, tidak ada modal) — bukti: `:1099`, `:1128-1140`.
31. **Tidak ada data contoh**; papan kosong lebih jujur daripada papan ramai pekerjaan karangan — bukti: `:694-710`.
32. **Kolom `payment` (CASH/ONLINE/CREDIT) dihapus dari UI** tapi kolom DB dibiarkan — bukti: `:736-739`; backend masih memetakannya (`lib_bd_mysql.php:179`).
33. **Penghapusan task selalu lewat konfirmasi dan modal edit tidak ditutup oleh tombol Batal-nya** — bukti: `:1706-1714`.

## G. Ketergantungan lintas modul
- **Office/Account → BD (roster):** BD memanggil `POST ../account-api-mysql/api.php {action:'listModuleRoster',module:'bd'}` saat boot & tombol "Segarkan dari Office" (`:1155`, `:1168-1193`); mengisi/menyegarkan tabel `people`. Tidak ada padanan di kontrak v1 `bd`.
- **Stock/Purchasing → BD (master vendor):** kolom Vendor PO membaca `../stock-api-mysql/vendors.php` (`:2417-2445`); v1 = `GET /api/v1/stock/vendors`. BD tidak pernah menulis ke vendor.
- **Marketing → BD (PO):** Marketing mengirim kebutuhan pembelian lewat `addPo` ke `../bd-api-mysql/api.php` (`marketing/index.html:13842-13847`, `:13939`), lalu membaca balik statusnya ("Dibaca langsung dari papan Purchasing BD OS", `:13949-13958`). v1 = `POST /api/v1/bd/purchase-orders/batch`. Tautan "Buka BD OS · Purchasing" DIHAPUS atas permintaan tim (`:13895-13901`).
- **Finance → Kas Kecil → BD (realisasi):** `setRealisasi` menulis balik `realisasi` + penanda proses ke baris PO (`finance/kas/index.html:5391`, `:5603`); v1 = `PUT /api/v1/bd/purchase-orders/{id}/realisasi`.
- **BD → Radar (promo):** Radar membaca `../bd-api-mysql/api.php` HANYA untuk daftar promo (`radar/index.html:603-609`, `:2346-2362`, `:2415`). Kalau backend BD mati, yang kosong cuma tab Promo (`:606-607`).
- **BD → Kompas:** Kompas membaca BD `getAll` server-side; `BdState::read()` jadi pintu in-process (`docs/modules/bd.md:24`,`:67`). `settings/promos` dibaca radar & kompas (`docs/modules/bd.md:24`).
- **BD TIDAK membaca Marketing/Konten/Event.** `COORD_DIVS` hanya daftar tujuan request teks (`:714`); agenda internal BD sengaja terpisah — acara perusahaan dikelola Marketing/Event dan jadwal gabungannya dibaca Radar (`:4471-4473`).

## H. Catatan untuk implementasi Vue
- Halaman: `app/pages/bd/index.vue` (Dashboard), `.../tasks.vue`, `.../projects.vue`, `.../projects/[id].vue`, `.../calendar.vue`, `.../coord.vue`, `.../routine.vue`, `.../promotion.vue`, `.../purchasing/index.vue` (3 tab: PR & Rekap / Semua Item / Penyetuju), `.../purchasing/pr-[id].vue`, `.../tim.vue`. `definePageMeta({ access: ['bd'] })`.
- Composable `useBd.ts` (fungsi → endpoint):
  - `getState()` → `GET /state`; `getStats()` → `GET /stats`.
  - `list(resource, updatedSince?)` → `GET /{resource}`; `get(resource,id)` → `GET /{resource}/{id}`; `create/update/patch/remove` → `POST/PUT/PATCH/DELETE /{resource}/{id}` (selalu kirim version).
  - `getSettings()` / `putSetting(key,value)` → `GET/PUT /settings/{key}` untuk `focus|approverSets|promos`.
  - `addPurchaseOrders(items)` → `POST /purchase-orders/batch`; `setRealisasi(id,realisasi)` → `PUT /purchase-orders/{id}/realisasi`.
  - Vendor list → `GET /api/v1/stock/vendors` (modul Stock); roster kru → endpoint Office/Account (belum ada, lihat I).
- HP vs desktop: `UTable` hanya `lg+`; di HP daftar task/PO/PR/routine/promo/Kru jadi `AppList`/`AppListRow`. Kanban Projects/Coord di HP jadi satu kolom per stage (scroll horizontal) + aksi "pindah stage" lewat sheet (drag-drop HTML5 tidak andal di sentuh). Kalender: grid penuh di desktop, daftar harian di HP.
- Form → `ResponsiveSheet`: `taskModal`, `projModal`, `coordModal`, `routineModal`, `promoModal`, `agendaModal`, `orangModal`, `poModal`, `prModal`, `requestModal` (tabel banyak baris), pratinjau Import Promo.
- Satu `AppFocus` per layar: Dashboard (fokus harian), Tasks (filter/mode), Purchasing (PR vs Semua Item vs Penyetuju). Status via `AppStatus` (`STATUS_COLOR`/`PO_COLOR`/`PR_COLOR`/`COORD_COLOR`/`PRIO_COLOR` → warna semantik).
- Widget Beranda yang cocok: ringkasan BD (task aktif/overdue, PO perlu approval, koordinasi pending) + daftar promo berjalan (data sama dengan Radar).
- Perhitungan browser yang WAJIB dipindah persis ke composable/util: kuadran Eisenhower (`:1316-1322`), `sisaHari`/`fDue`/`fTgl` (`:776-783`), `projProgress` (`:1883`), `overbudget`/`realisasiNum` (`:3806-3812`), kepatuhan routine (`:2197`, `:2212`), `prBeres`/`prTotal`/`prNoBerikut` (`:3379-3398`), `promoStatus`/`promoSisa`/`promoSort` (`:2365-2394`), `poBeres` (`:3211`), `fRp`/`fRpPenuh`/`rzFormat`/`fmtRp` (`:784-800`, `:3847-3850`, `:4686-4696`).
- Elemen lama yang melanggar DESIGN.md → padanannya: (a) kartu angka besar `stats` (5+3+3+4 kartu, mis. `:1503-1507`) → ringkasan teks/`AppList`; (b) gradien/emoji pada `PROMO_TIPE` (`💳🎓🎵🍽️🕒🎉`, `:2306-2317`), poster & tombol "⬇ Export Excel"/"⬆ Import Excel" (`:2491-2492`), ikon 🔒 pada tombol setujui (`:3744`) → ikon Nuxt UI; (c) header huruf kapital/letter-spacing ("★ Fokus utama hari ini" `:1511`, "APPROVE BY" `:3730`) → label sentence case; (d) `head()` "page-head" + subjudul deskriptif → `UPageHeader`; (e) tombol `pill` sebagai toggle proses (`:3212-3220`) → `UBadge`/`USwitch`.

## I. Pertanyaan terbuka
- [ ] **bd / Kru BD — sinkron roster Office** — legacy mengisi tabel `people` dari `account-api-mysql?action=listModuleRoster{module:'bd'}` saat boot & tombol "Segarkan dari Office"; kontrak v1 `bd` tidak punya padanannya, dan tak jelas siapa pembuat baris `people` saat kru baru diberi akses. Bukti: `laksamana-office/deploy/bd/index.html:1168-1247`, `laksamana-api/docs/api/bd.md` (tak menyebut roster). Opsi: A) Vue cukup CRUD `people`; B) sediakan endpoint roster di modul Office/Account; C) minta endpoint di `bd`.
- [ ] **bd / diagnostik — `ping`** — legacy punya `action=ping` (membawa `LIB_VERSI`, env, db); v1 hanya punya `GET /stats` yang sudah membawa `versi`/`env`/`db`. Perlu endpoint `ping` terpisah atau cukup `/stats`? Bukti: `laksamana-office/bd-mysql/api.php:58-60`, `laksamana-api/docs/api/bd.md:33-37`. Opsi: A) pakai `/stats`; B) tambah `GET /bd/ping`.
- [ ] **bd / Purchasing — baca master vendor** — kartu PO membaca `GET /api/v1/stock/vendors`, tapi pengguna BD belum tentu punya akses modul Stock/Purchasing. Perlu jalur baca lintas-modul (endpoint publik/proxy) atau cukup andalkan sering-sama-pemilik? Bukti: `laksamana-office/deploy/bd/index.html:2417-2445`, `laksamana-api/docs/api/stock.md:22`,`:49`. Opsi: A) `GET /api/v1/stock/vendors` cukup; B) endpoint ringkas khusus BD.
- [ ] **bd / semua layar — bentuk simpan dari whole-state ke per-record** — legacy menulis SELURUH state lewat `saveAll` (merekonsiliasi/menghapus baris yang tak dikirim) dan polling membandingkan blob; v1 per-record dengan version wajib. Perlu keputusan pola: satu composable "state cache" yang meng-CRUD tiap perubahan, atau refactor tiap form menjadi operasi per-record? Bukti: `laksamana-office/deploy/bd/index.html:1099-1140`, `laksamana-api/docs/api/bd.md:44-49`,`:70-75`. Opsi: A) per-record penuh (rekomendasi kontrak); B) pertahankan cache + `PATCH` per baris.

## Konsolidasi untuk README & berkas bersama

### Baris README (siap tempel)
`| bd | [bd.md](bd.md) | ⚠️ selesai dengan celah | 11 (2 tersembunyi) | 2 ❌ · 1 ⚠️ | 4 | BD OS — task/project/purchasing/promo; promo dibaca Radar & Kompas |`

### Pertanyaan terbuka (format `_pertanyaan.md`)
- [ ] **bd / Kru BD** — sinkron roster Office: legacy mengisi `people` dari `account-api-mysql?action=listModuleRoster{module:'bd'}`; v1 `bd` tak punya padanannya. Konteks: siapa pembuat baris `people` saat kru baru diberi akses juga tak jelas. Bukti: `laksamana-office/deploy/bd/index.html:1168-1247`. Opsi: A) CRUD `people` saja; B) endpoint roster di Office/Account; C) endpoint di `bd`.
- [ ] **bd / diagnostik** — `ping` legacy (LIB_VERSI/env/db) tak ada di v1; `GET /stats` sudah membawa `versi`. Bukti: `laksamana-office/bd-mysql/api.php:58-60`, `laksamana-api/docs/api/bd.md:33-37`. Opsi: A) pakai `/stats`; B) tambah `GET /bd/ping`.
- [ ] **bd / Purchasing** — baca master vendor via `GET /api/v1/stock/vendors` padahal pengguna BD belum tentu punya akses modul Stock. Bukti: `laksamana-office/deploy/bd/index.html:2417-2445`, `laksamana-api/docs/api/stock.md:22`. Opsi: A) pakai endpoint Stock apa adanya; B) endpoint ringkas khusus BD.
- [ ] **bd / semua layar** — pola simpan whole-state (`saveAll`) → per-record v1 dengan version wajib. Bukti: `laksamana-office/deploy/bd/index.html:1099-1140`, `laksamana-api/docs/api/bd.md:44-49`,`:70-75`. Opsi: A) per-record penuh; B) cache + `PATCH` per baris.

### Baris `_lintas-modul.md` (temuan lintas modul)
- **BD → Office/Account:** BD mengisi tabel `people` dari roster Office (`account-api-mysql?action=listModuleRoster{module:'bd'}`, `deploy/bd/index.html:1155`,`:1168-1193`); tidak ada endpoint roster di v1 `bd` — sama seperti kasus HR.
- **Stock/Purchasing → BD:** kolom Vendor PO membaca master vendor Purchasing (`../stock-api-mysql/vendors.php`, `deploy/bd/index.html:2417-2445`); v1 = `GET /api/v1/stock/vendors` (`docs/api/stock.md:22`). BD hanya membaca.
- **Marketing → BD:** Marketing mengirim PO ke BD lewat `addPo` (`deploy/marketing/index.html:13842-13847`,`:13939`; v1 `POST /api/v1/bd/purchase-orders/batch`), lalu membaca balik status dari papan BD.
- **Finance → Kas Kecil → BD:** `setRealisasi` (finance/kas/index.html:5391`,`:5603`; v1 `PUT /api/v1/bd/purchase-orders/{id}/realisasi`) menulis `realisasi` + penanda proses ke baris PO.
- **BD → Radar:** Radar membaca daftar promo BD (`radar/index.html:603-609`,`:2346-2362`,`:2415`); **BD → Kompas:** Kompas membaca `getAll` server-side (`docs/modules/bd.md:24`,`:67`). **BD TIDAK membaca Marketing/Konten/Event** (hanya teks koordinasi & agenda internal).

## J. Progres build
Branch: migrasi/bd · Mulai: 2026-10-01
LANJUTKAN DARI: —
Status layar: **dibangun, belum dicek visual** — ✅ di kolom status berarti halamannya
sudah dibangun, **bukan** sudah dirender/dicek di browser (1366px/390px, tugas manusia).

### Cek visual 2026-10-08 (Refs #19, branch `fix/visual-bd`, mock read-only :4014 → dev :3014)
11/11 layar dibuka 1366px & 390px sebagai admin modul (Risa, `tok-admin`):
overflow 0 di semua lebar, console tanpa error. Semua sheet form dibuka
(task, project, koordinasi, routine, promo, agenda, request order, kru):
tidak ada crash. Kolom tabel, kartu stat, dan posisi tombol sama dengan Office
lama; saran master vendor tetap teks bebas ("Segera" G-02, sesuai spek).
Perbaikan di branch ini:
- 4 layar crash saat dibuka ("SelectItem value tidak boleh string kosong"):
  filter divisi/project/tipe/status di `tasks.vue`, `projects.vue`,
  `calendar.vue`, `promo.vue`, `purchasing/index.vue` memakai sentinel
  `PILIHAN_SEMUA` (baru di `app/utils/bd-rumus.ts`), perbandingan filter
  disesuaikan.
- Pilihan "tanpa project / belum diatur / tanpa atasan" di `opsiProject()`
  (`bd-rumus.ts`) dan `BdOrangSheet.vue` memakai `PILIHAN_TANPA`, dipetakan
  kembali ke `null`/`''` saat simpan; 4 sheet (`BdTaskSheet`,
  `BdCoordSheet`, `BdPoSheet`, `BdRequestSheet`) tadinya akan crash saat dibuka.
- `projects/[id].vue` tidak pernah tampil (kasus yang sama dengan hlife:
  Nuxt menyarangkan `[id]` di bawah `projects.vue` tanpa `<NuxtPage/>`):
  induk kini merender `<NuxtPage/>` dan menyembunyikan daftar saat rute anak aktif.
`npm run lint && npm run typecheck && npm run build` hijau 2026-10-08.

| layar (key) | file | status | endpoint dipakai | ditunda karena |
|---|---|---|---|---|
| dashboard | `app/pages/bd/dashboard.vue` | ✅ | `GET /bd/state`, `GET/PUT /bd/settings/focus` | — |
| tasks | `app/pages/bd/tasks.vue` | ✅ | `GET /bd/state`, `POST/PUT/PATCH/DELETE /bd/tasks` | — |
| projects | `app/pages/bd/projects.vue` | ✅ | `GET /bd/state`, `POST/PUT/PATCH /bd/projects`, `PATCH /bd/tasks` | — |
| projectDetail | `app/pages/bd/projects/[id].vue` | ✅ | `GET /bd/state`, `PATCH /bd/projects`, `/bd/tasks`, `/bd/coord-requests`, `/bd/purchase-orders` | — |
| calendar | `app/pages/bd/calendar.vue` | ✅ | `GET /bd/state`, `POST/PUT/DELETE /bd/agenda`, `PATCH /bd/tasks` | — |
| coord | `app/pages/bd/coord.vue` | ✅ | `GET /bd/state`, `POST/PUT/PATCH/DELETE /bd/coord-requests` | — |
| routine | `app/pages/bd/routine.vue` | ✅ | `GET /bd/state`, `POST/PUT/DELETE /bd/routines` | — |
| promo | `app/pages/bd/promo.vue` | ✅ | `GET/PUT /bd/settings/promos` | CSV ekspor/impor di browser, sesuai K-05 (1) |
| purchasing | `app/pages/bd/purchasing/index.vue` | ✅ | `GET /bd/state`, `POST /bd/purchase-orders/batch`, `PATCH/DELETE /bd/purchase-orders`, `POST /bd/purchase-requests`, `GET/PUT /bd/settings/approverSets`, `GET /stock/vendors` (G-02, saran Vendor) | — |
| prDetail | `app/pages/bd/purchasing/pr-[id].vue` | ✅ | `GET /bd/state`, `PATCH /bd/purchase-requests`, `PATCH /bd/purchase-orders`, `PUT /bd/purchase-orders/{id}/realisasi` | — |
| tim | `app/pages/bd/tim.vue` | ✅ | `GET /bd/state`, `POST/PATCH/DELETE /bd/people`, `GET /account/modules/bd/members` | — |

Catatan build (2026-10-01):
- **Tulisan per-record (T-25).** Tidak ada `saveAll`; tiap mutasi lewat `POST/PUT/PATCH/DELETE /bd/{resource}` dengan `If-Match` dari `versiBaris(row)` (`data.updatedAt`) + `tanganiKonflik`. Dokumen `settings` (`focus`, `approverSets`, `promos`) lewat `PUT /bd/settings/{key}` dengan versi dari `meta.versions`.
- **Rumus browser dipindah persis** ke `app/utils/bd-rumus.ts` (kuadran, `sisaHari`/tanggal, `projProgress`, `overbudget`/`realisasiNum`, kepatuhan routine, `prBeres`/`prTotal`/`prNoBerikut`, `poBeres`, `fRp`/`rzFormat`) dan `app/utils/bd-promo.ts` (`promoStatus`/`promoSisa`/urutan, CSV impor/ekspor). Warna/ikon status di `app/utils/status-bd.ts`.
- **Roster (T-01).** "Segarkan dari Office" membandingkan `GET /api/v1/account/modules/bd/members` dengan `/people` dan `POST /people` yang belum ada; tidak pernah menghapus (`tanpaAkses`). Tidak ada endpoint `bd` roster. `ping`/`stats` tidak dibawa (T-02/U3).
- **Vendor PO (G-02, #102).** Kolom Vendor form PO mengetik melawan master Purchasing (`GET /stock/vendors`, `<datalist>`); nama di luar master tetap bisa disimpan dan ditandai di bawah kotak (`… belum ada di master Purchasing`), master mati hanya menghilangkan saran. Kolom tetap teks bebas, yang tersimpan tetap nama.
- **Ditunda:** —
- **Perlu ditindak lead:** entri `bd` di `app/utils/modul-shell.ts` (layar sidebar, tombol `+`, lonceng, `siapkan`) belum ditambahkan — di luar kepemilikan berkas agen `bd`. Halaman tetap dapat dibuka lewat rute `/bd/...`.

## K. Daftar uji cutover

Daftar untuk **manusia** (agen tidak menjalankan app). Setiap butir **layar**: dibuka di
**1366px** dan **390px**, tanpa error runtime, susunan/kolom/kartu sama dengan Office lama
(rujukan D.x di atas), tabel/kanban muat di 1366px dan menjadi kartu/daftar di 390px.
Setiap butir **aksi tulis**: berhasil, dan versi basi memicu muat-ulang konflik (bukan
menimpa diam-diam). Tanda **[G-xx]** menandai butir yang menyentuh bagian "Segera"/gap.

### Layar (1366px & 390px)
- [ ] **dashboard** — Dashboard (D.1): 5 angka (Task aktif/Overdue/Project jalan/Koordinasi pending/PO berjalan), fokus harian, Prioritas teratas, Overdue, Kesehatan project, Agenda hari ini; pita roster bila ada.
- [ ] **tasks** — Tasks (D.2): 4 mode Matrix/Hari ini/Minggu ini/Per Divisi, filter lingkup/divisi/project/tipe/PIC, baris task + avStack PIC.
- [ ] **projects** — Projects (D.3): kanban 5 kolom (`Idea…Completed`), kartu dengan health/budget/PIC/progress.
- [ ] **projectDetail** — Project/route `[id]` (D.4): 4 kartu Health/Progress/Budget/PIC, milestone, task, koordinasi, PO terkait.
- [ ] **calendar** — Calendar (D.5): grid Senin-pertama, navigasi bulan, legenda 5 warna.
- [ ] **coord** — Koordinasi (D.6): mode Board (kanban `Diminta…Selesai`) & Tabel, pita penjelasan.
- [ ] **routine** — Routine (D.7): 3 kartu (aktif/kepatuhan/terlewat) + tabel routine.
- [ ] **promo** — Promotion (D.8): 4 kartu status, filter status/tipe, kotak cari, tabel promo, detail + poster.
- [ ] **purchasing** — Purchasing (D.9): 3 sub-tab (PR & Rekap Mingguan / Semua Item / Penyetuju), 3 kartu ringkasan, saran Vendor dari master Purchasing (nama luar master ditandai, tetap tersimpan).
- [ ] **prDetail** — Purchase Request/route `pr-[id]` (D.10): lembar siap cetak, kolom Harga/Realisasi/Overbudget/Proses, blok APPROVE BY.
- [ ] **tim** — Kru BD (D.12): hierarki atasan→anak buah, tabel Nama/Jabatan/Divisi/Atasan/Task/Akses, penanda kamu/dicabut/nonaktif.

### Aksi tulis (berhasil + konflik versi)
- [ ] dashboard: fokus harian (`PUT /settings/focus`, disimpan bersama tanggal), "Task baru" (`POST /tasks`), "Segarkan" roster (`POST /people` untuk kru baru).
- [ ] tasks: `POST/PUT/PATCH/DELETE /tasks`, toggle done, drag antar kuadran; hapus berkonfirmasi; `pic` & `pics` selalu bersama.
- [ ] projects: `POST/PUT/DELETE /projects`, drag stage; pindah ke `Completed` menutup semua task **hanya saat pindah**; hapus melepas task/PO/koordinasi (`project=null`).
- [ ] projectDetail: `PUT /projects/{id}`, centang milestone, task dari project.
- [ ] calendar: agenda `POST/PUT/DELETE /agenda`; geser deadline task hanya mengubah tanggal task.
- [ ] coord: `POST/PUT/PATCH/DELETE /coord-requests`, drag status; PIC tujuan teks bebas.
- [ ] routine: `POST/PUT/DELETE /routines`; kepatuhan dihitung, baris tanpa `total` = 100%.
- [ ] promo: `PUT /settings/promos` (tambah/ubah/jeda/hapus); tanggal selesai < mulai ditolak; status dihitung dari tanggal (paused menang); ekspor→impor CSV bolak-balik.
- [ ] purchasing: `POST /purchase-orders/batch` (baris kosong diabaikan, semua "Diajukan"); `PATCH`/`DELETE /purchase-orders`; "Sudah diproses" → Diterima + `statusSebelum`, batal mengembalikan; `POST /purchase-requests` + `PATCH` PO `prId`; `PUT /settings/approverSets` (admin); saran Vendor dari `GET /stock/vendors` (nama luar master ditandai, tetap tersimpan).
- [ ] prDetail: `PUT`/`PATCH /purchase-requests`; setujui hanya signer/admin (jejak, bukan otorisasi); `PUT /purchase-orders/{id}/realisasi` (realisasi kosong ≠ 0, overbudget dihitung); masukkan/keluarkan PO dari lembar.
- [ ] tim: "Segarkan dari Office" (`POST /people` yang belum ada, tidak pernah menghapus); edit `role/div/boss` (`PATCH /people/{id}`, tolak atasan melingkar); hapus hanya bila akses dicabut & tanpa pekerjaan.

### Silang Vue ↔ Office lama
- [ ] Promo yang ditambah di Vue muncul di Radar; request Marketing masuk sebagai PO "Diajukan"; realisasi Finance menggerakkan status PO; sunting dari kedua sisi tidak menimpa diam-diam (versi basi → konflik).
