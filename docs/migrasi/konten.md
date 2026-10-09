# Konten — inventaris migrasi

Status: ⚠️ selesai dengan celah
Terakhir diperbarui: 2026-09-29

> **Triase 2026-09-29** — status di tabel E yang bertentangan dengan catatan ini: catatan ini yang berlaku.
> Rincian: [`_pertanyaan.md`](_pertanyaan.md), [`_gap-api.md`](_gap-api.md).
> - Restore JSON → K-01. Hapus performa satu platform → G-01 ✅ (API #177, `metrics: null`).
> - Titipan `designReqOpsi` → T-07. Default `perms` → T-08. Roster → U2.

## Ringkasan
- Jumlah layar: 20 (19 di `NAV` + `profile` di luar menu; `kol` punya 2 sub-tab `db`/`visit`; + panel detail konten drawer & layar login tersembunyi) · Aksi backend lama: `getAll`, `saveAll` (2), `receipt`/`uploadReceipt` (tak dipanggil) + 4 panggilan lintas modul · Gap v1: 0 ❌ · 2 ⚠️ (whole-state `saveAll` → CRUD per-baris, restore backup)
- Konten adalah studio produksi konten Laksamana Muda: perencanaan (kalender, pipeline, bank ide), produksi (shooting, design, editing), kontrol (approval, publishing, input & laporan performa), promosi (KOL/Medpar, Ads, Report Percakapan), master Brand, jejak aktivitas, dan pengaturan (kru + matriks hak akses). Penggunanya seluruh tim konten dengan role berjenjang; sebagian halaman khusus admin.
- Identitas **dari Office (SSO)**: tak ada login/PIN lokal yang dipakai (layar login lama di-CSS `display:none`), sesi dari `localStorage['lm_session']`, roster kru ditarik dari Office.
- Risiko terbesar saat migrasi: (1) legacy menyimpan **seluruh state sebagai satu blob** lewat `saveAll` dengan penjaga bentrok `baseUpdatedAt` → `bentrok[]`; v1 memakai CRUD per-baris + `version` (`If-Match`), jadi pola `stampChanges`/`buildPayload`/`refreshSnapshot` harus dibongkar; (2) **rumus performa** (ER, Virality, CTA, pillar) hidup di berkas bersama `deploy/assets/performa-konten.js`, BUKAN di `index.html` — harus dipindah apa adanya; (3) peta **role & matriks izin** di dalam modul (`ROLES`, `PERM_*`, `VIEW_PERM`) adalah data yang diterapkan UI (v1 menyimpannya di `documents/perms`).

## A. Sumber
| jenis | path | baris |
|---|---|---|
| frontend lama | laksamana-office/deploy/konten/index.html | 4691 |
| backend lama | laksamana-office/konten-mysql/api.php (+ lib_konten_mysql.php, schema.sql, README.md) | — |
| kontrak v1 | laksamana-api/docs/api/konten.md | — |
| spec port | laksamana-api/docs/modules/konten.md | — |
| rute v1 | laksamana-api/app/Modules/Konten/routes/v1.php | — |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:6548-6636 "Konten: yang selesai otomatis diarsipkan"; :6638-6854 "Performa Konten & Performa Desain — dua modul, satu mesin"; :6856-7082 "Konten: empat revisi menu" | 6548-7082 |
| aset bersama | laksamana-office/deploy/assets/performa-konten.js (dipakai `analytics` & `designperf`) | — |

## B. Akses
- Kunci Modul di launcher: `konten` (`laksamana-office/deploy/index.html`, daftar modul Office; gerbang halaman `readLmSession()` butuh `lm_session` valid dengan modul `*` atau `konten`, `index.html:1303-1310`).
- Gerbang halaman: `if(!readLmSession()){ location.replace('../'); return; }` (`index.html:662-663`). Sesi kedaluwarsa → kembali ke Office.
- **Admin modul** = sesi Office `adminModules` memuat `*` atau `konten`; mengangkat user ke akses penuh sesi ini (`OFFICE_IS_ADMIN`, `index.html:757`, `:1247`). Bukan berasal dari role internal tersimpan.
- **Role internal** `ROLES` (`index.html:808-818`): `super_admin` (Super Admin/Nahkoda Agung), `content_director`, `content_planner`, `account_manager`, `designer`, `video_editor`, `photographer`, `ads_specialist`, `analyst`.
- **Rangkap kerja**: `userModPerm` = level TERLONGGAR di antara seluruh role user (`index.html:1249`); `can(module)` butuh `>= PERM_EDIT` (2) (`:1250-1253`); `canView(view)` butuh `>= PERM_VIEW` (1) lewat `VIEW_PERM` (`:1255-1265`). `super_admin` selalu `PERM_EDIT` (`:864`).
- Matriks izin per halaman (`VIEW_PERM`, `index.html:868-882`): `planning`/`pipeline`/`calendar`→`content`; `approval`→`approve`; `assets`→`assets`; `shooting`/`design`/`editing`→ modul masing-masing; `publishing`→`publish`; `perfinput`/`analytics`/`designperf`→`analytics`; `ads`/`chats`→`ads`; `kol`→`kol`; `activity`→`activity`; `settings`→`settings`; `brands`→`brands`. `dashboard` & `profile` = view umum (boleh semua yang login).
- Default matriks `PERM_ROLES_LEGACY` (`index.html:841-854`): mis. `approve` = `content_director`+`account_manager`; `settings` = `super_admin`; `team` = `super_admin`+`content_director`; `content` = 6 role. `PERM_OPT` (`:835`): `0 Tak Terlihat/None`, `1 Lihat/Lihat`, `2 Boleh Ubah/Ubah`.
- `canView('settings')` juga meloloskan pemegang kunci `team` (`index.html:1262`) agar Content Director tidak kehilangan daftar kru; isi layar disaring per-kartu (`:4488-4489`).
- Aksi khusus admin: Editor Hak Akses di Pengaturan (hanya `isSuper`), kelola kru (`OFFICE_IS_ADMIN`), kelola brand/ads/KOL/asset (per `can()` masing-masing).
- v1: `module:konten` di middleware; matriks izin dalam modul adalah **data** yang diterapkan UI (`docs/api/konten.md:6,30,36`).

## C. Daftar layar (dari NAV + VIEW_META)
Sumber menu `NAV` `index.html:1432-1458`; judul/subjudul `VIEW_META` `:1539-1560`; dispatcher `route()` `:1562-1575`.

| key | judul | subjudul | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| dashboard | Dashboard | "Ringkasan operasional real-time" | semua | tidak | `:1434`, `:1540` |
| planning | Content Planning | "Semua unit konten dari ide sampai tayang" | `content` (lihat) | tidak | `:1435`, `:1541` |
| pipeline | Content Pipeline (menu: "Pipeline") | "Papan alur produksi drag & drop" | `content` | tidak | `:1436`, `:1542` |
| calendar | Content Calendar (menu: "Calendar") | "Jadwal tayang lintas brand" | `content` | tidak | `:1437`, `:1543` |
| shooting | Shooting Schedule | "Jadwal produksi foto & video" | `shooting` | tidak | `:1439`, `:1544` |
| design | Design Queue | "Antrian pekerjaan desain" | `design` | tidak | `:1440`, `:1545` |
| editing | Editing Queue | "Antrian pekerjaan video" | `editing` | tidak | `:1441`, `:1546` |
| assets | Asset Management | "Pustaka file produksi" | `assets` | tidak | `:1442`, `:1547` |
| approval | Approval | "Alur persetujuan konten berjenjang" | `approve` | tidak | `:1444`, `:1548` |
| publishing | Publishing (judul menu) | "Catatan publikasi aktual" | `publish` | tidak | `:1445`, `:1549` |
| perfinput | Input Performa | "Angka insight tiap platform untuk konten yang sudah tayang" | `analytics` | tidak | `:1446`, `:1550` |
| analytics | Performa Konten | "Reach, Engagement Rate, Virality Index, CTA Click Rate & Content Pillar" | `analytics` | tidak | `:1447`, `:1551` |
| designperf | Performa Desain | "Virality konten berdesain & jumlah desain selesai per kategori" | `analytics` | tidak | `:1448`, `:1552` |
| kol | KOL & Medpar Management | "Database KOL & Media Partner + planning kunjungan event" | `kol` | tidak | `:1450`, `:1553` |
| ads | Ads Management | "Kelola & pantau Meta / Google / TikTok Ads" | `ads` | tidak | `:1451`, `:1554` |
| chats | Report Percakapan | "Rekap chat / percakapan hasil dari iklan" | `ads` | tidak | `:1452`, `:1555` |
| brands | Brand Management | "Master data & pedoman brand" | `brands` | tidak | `:1454`, `:1556` |
| activity | Activity Log | "Jejak audit seluruh aktivitas" | `activity` | tidak | `:1456`, `:1557` |
| settings | Pengaturan | "Konfigurasi sistem, daftar kru & hak akses" | `settings`/`team` | tidak | `:1457`, `:1558` |
| profile | Profil Saya | "Akun & preferensi" | semua | **ya** (bukan di NAV; lewat chip user) | `:1559` |

Tab bar HP: TIDAK DITEMUKAN (dicari: `tabbar|bottom-nav` di index.html konten). Sub-tab di layar `kol`: `📇 Database KOL & Medpar` / `📅 Planning Kunjungan` (`:3214-3217`). Layar login lama ada di DOM tapi `display:none` (`:750`, `:775`).

## D. Detail per layar

### D.1 dashboard — Dashboard
- **Tampilan:** sapaan "Selamat datang, <nama> 👋" + "Berikut kondisi anjungan hari ini - <tanggal>" (`:1670-1671`); 4 kartu statistik: **Total Konten** (`cs.length`, sub "<n> tayang"), **Perlu Dikerjakan** (`pending.length`, sub "<n> terjadwal"), **Terlambat** (`overdue.length`), **Tayang Hari Ini** (`todayPub.length`) (`:1673-1678`); kartu "🗓️ Today's Schedule" (`:1681`); kartu "⏳ Menunggu Approval" (`:1690`); kartu "Tugas Saya" (`:1702`); kartu "Top Konten Minggu Ini" (`:1719`).
- **Filter:** `brandBar()` — tombol "Semua Brand" + satu tombol per `DB.brands` (`:1578-1583`, `setBrand` `:1584`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | Buka Halaman Approval → | `route('approval')` (hanya bila `can('approve')`) | (lokal) | — | `:1696` |
  | klik baris agenda | `calOpenEvent` | (lokal) | — | `:1683` |
  | klik baris approval / tugas / top konten | `openContent(id)` | (lokal) | — | `:1692`, `:1711`, `:1721` |
- **Perhitungan:** `pending` = status ∉ `['Posted','Cancelled','Scheduled']` (`:1656`); `overdue` = `daysDiff(deadline)<0` & status ∉ selesai (`:1657`); `todayPub` = `publishDate===todayISO()` (`:1658`); `top` = 5 `Posted` diurut `metrics.reach` desc (`:1664`, bentuk lama — lihat §F.4); `tugasSaya()` (`:1613-1648`) menggabungkan 3 sumber (konten PIC saya, sub-tugas `c.prod[k]`, `prodTasks` PIC saya), diurut `sisa` ascending (tanpa deadline di bawah), `DEADLINE_DEKAT=3` (`:1612`).
- **Catatan:** kartu "Tugas Saya" menonjolkan jumlah terlambat: "<n> terlambat · <m> ≤3 hari" (`:1707-1709`).

### D.2 planning — Content Planning
- **Tampilan:** kepala "<total> total konten - <n> tayang · <n> diarsipkan (tayang/batal)" (`:1744-1748`); baris penyaring (kartu); tabel kolom **Konten / Brand / Platform / Pillar / PIC / Status / Prioritas / Deadline / Tayang** (`:1802-1803`); pager `pgBar`.
- **Filter (`planFilters` `:1740`):** input "Cari judul / caption..." (`q`); select arsip "Aktif (belum tayang)" / "Arsip (tayang/batal)" / "Semua" (`arsip`); "Semua Status" (`STATUS`); "Semua Platform" (`PLATFORMS`); "Semua Pillar" (`PILLARS`); dropdown PIC (`picOptions`); tombol "Reset" → `planReset()` mengembalikan ke `arsip:'aktif'` (`:1768`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | ＋ Konten Baru | `openContentForm()` (bila `can('content')`) | (lokal) | `POST /content` | `:1749` |
  | Reset | `planReset()` | (lokal) | — | `:1759` |
  | klik baris | `openContent(id)` | (lokal) | — | `:1805` |
- **Perhitungan:** `filteredContent()` (`:1780-1796`) — tapis arsip DILEWATI bila status terpilih ∈ `STATUS_ARSIP`; urut `deadline` (kosong → `'2099'`). `STATUS_ARSIP=['Posted','Cancelled']` (`:1735`). `planHitungPic(id)` menghitung tanpa tapis PIC sendiri (`:1775-1779`).
- **Catatan:** pencarian mencocokkan `title + contentDetail(c)` (`:1794`).

### D.3 pipeline — Content Pipeline
- **Tampilan:** Kanban kolom `PIPELINE=['Idea','Research','Script','Design','Shooting','Editing','Revision','Approval','Scheduled','Posted']` (`:899`, render `:2367-2372`); kartu `contentCard()` menampilkan brand, platform (maks 2), judul, deadline (merah bila lewat), avatar PIC / "Belum ada PIC" (`:1585-1594`).
- **Filter:** dropdown PIC (`picOptions(pipeFilters.pic, pipeHitung)`), tombol "Reset"; keterangan "<n> konten aktif" (`:2363-2365`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | ＋ Konten Baru | `openContentForm()` | (lokal) | `POST /content` | `:2359` |
  | drag kartu antar kolom | `kDrop` → `c.status=col` | `saveAll` | `PATCH /content/{id}` | `:2381-2384` |
- **Perhitungan:** `pipeHitung(id)` menghitung konten status ≠ `Cancelled`; `__none__` = tanpa PIC (`:2342-2346`). `picCocok()` satu aturan (`:2334-2337`).
- **Catatan:** `kDrop` butuh `can('content')`, pesan "Tidak punya akses ubah status" (`:2382`); pindah ke `Approval` memicu notifikasi (`:2383`).

### D.4 calendar — Content Calendar
- **Tampilan:** judul bulan (`id-ID`), navigasi `‹ ›` + "Hari Ini", legenda/filter jenis (Tayang, Rekam Video, Desain, Editing, Kunjungan KOL & Medpar), grid mingguan Sen–Min 6 baris dengan maks 3 event/sel + "+n lagi" (`:2424-2462`).
- **Filter (`calFilter` `:2388`):** toggle per jenis event (`publish`/`shoot`/`design`/`edit`/`visit`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | ‹ / › / Hari Ini | `calNav`/`calToday` | (lokal) | — | `:2445-2448` |
  | legenda | `calToggle(k)` | (lokal) | — | `:2442` |
  | drag event ke sel | `calCellDrop` → `moveCalEvent` (ubah `publishDate`/`prod[k].date`/shooting/prodTask/visit) | `saveAll` | `PATCH /content/{id}` / `PATCH /prod-tasks/{id}` / `PATCH /shootings/{id}` / `PATCH /visits/{id}` | `:2471-2483` |
  | klik event | `calOpenEvent` | (lokal) | — | `:2485` |
  | +n lagi | `calDay(ds)` modal daftar event hari itu | (lokal) | — | `:2488-2493` |
- **Perhitungan:** `collectCalEvents()` (`:2390-2423`) menggabungkan: publish (status ≠ Cancelled), `c.prod[k].date`, `DB.shootings` tanpa `contentId`, `DB.prodTasks`, `DB.visits`; `visitInvitees` + jumlah undangan.
- **Catatan:** hak ubah jadwal: publish butuh `can('content')`, visit butuh `can('kol')`; pesan "Tidak punya akses ubah jadwal" (`:2475`, `:2480`).

### D.5 shooting — Shooting Schedule (antrian produksi `prodQueue('shoot',…)`)
- **Tampilan:** baris penyaring + tabel kolom **Prioritas / Pekerjaan / Brand / Talent|Platform / PIC / Deadline Shoot / Status / (aksi)** (`:3062`); pager; kepala "<n> / <total> pekerjaan · <n> diarsipkan" (`:3023-3026`); pita peringatan bila Marketing tidak terbaca (hanya design/edit).
- **Filter (`queueState.shoot`, `QUEUE_BAWAAN` `:2740`):** cari "Cari pekerjaan...", status "Aktif (belum selesai)"/"Arsip (sudah selesai)"/"Semua" (default `todo`), prioritas, "Reset"; header klik untuk urut (`queueSort`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | ＋ Tambah Shoot | `openTaskForm('shoot')` (bila `can('shoot')`) | (lokal) | `POST /prod-tasks` | `:3030` |
  | ✓ Selesai / ↺ Buka | `toggleProdDone(cid,kind)` atau `toggleTaskDone(tid)` | `saveAll` | `PATCH /content/{id}` / `PATCH /prod-tasks/{id}` | `:3080`, `:3084-3096`, `:3126-3128` |
  | klik baris | `openContent`/`openTaskForm` | (lokal) | — | `:3071` |
- **Perhitungan:** `prodRows(kind)` menggabungkan konten (`c.prod[kind]`) + tugas mandiri (`prodTasks kind`) + request Marketing (`design`/`edit` saja) (`:2988-3019`); urut default `date` ascending, tie-break prioritas lalu tanggal (`:3009-3012`); `doneAt` dicap saat ditandai selesai, dibuang saat dibuka ulang (`:3091`).
- **Catatan:** default menampilkan ARSIP TERSEMBUNYI (`status:'todo'`), jumlah arsip disebut (`:2737-2739`, `:3025`).

### D.6 design — Design Queue (`prodQueue('design',…)`)
- Sama struktur dengan D.5; perbedaan: `AFTER.design=()=>renderQueueTable('design')` (`:3135`); `muatReqMkt()` dipanggil untuk menarik **Request Design dari Marketing** (`:3029`); label "+ Tambah Design"; kolom Platform.
- **Aksi tambahan:** baris sumber `mkt` → `reqMktLihat`/`reqMktSelesai` (lihat D.21b).
- **Bukti:** `:3143`.

### D.7 editing — Editing Queue (`prodQueue('edit',…)`)
- Sama struktur; `AFTER.editing` (`:3136`); `muatReqMkt()` juga (`:3029`); label "+ Tambah Editing"; "Antrian video - konten yang ditandai butuh editing. Tandai selesai bila video final siap." (`:3144`).
- **Bukti:** `:3144`.

### D.8 assets — Asset Management
- **Tampilan:** kepala "<n> asset tersimpan - foto, video, desain, template" (`:4085`); chip kategori ("Semua" + kategori yang ada); grid kartu (ikon per kategori, nama, kategori - versi, tag, brand, pengunggah, waktu) (`:4090-4099`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | ＋ Tambah Asset | `openAssetForm()` (bila `can('assets')`) | (lokal) | `POST /assets` | `:4086` |
  | ✎ Edit | `openAssetForm(id)` | (lokal) | `PUT /assets/{id}` | `:4098` |
  | klik kartu | `window.open(a.link)` | (lokal) | — | `:4091` |
- **Form & field Asset** (`openAssetForm` `:4102-4112`, `saveAsset` `:4113`):
  | field (nama data) | label UI | tipe | wajib | default / pilihan |
  |---|---|---|---|---|
  | name | Nama Asset | text | ya ("Nama wajib") | — |
  | category | Kategori | select | tidak | `['Photo','Video','RAW','Edited','Logo','Font','Music','Motion Template','PSD','AI','Canva']` |
  | brand | Brand | select | tidak | `DB.brands` |
  | version | Versi | text | tidak | `v1` |
  | tags | Tags (pisah koma) | text | tidak | [] |
  | link | Link (Drive / Dropbox / Frame.io) | text | tidak | '' |
  - `delAsset` konfirmasi "Hapus asset?" (`:4118`).

### D.9 approval — Approval
- **Tampilan:** pita keterangan "✅ Approval sekali - cukup review **hasil akhir/final** lalu setujui. Tidak ada approval bertahap." (`:4124`); grid kartu konten status `Approval` (brand, platform, badge "Menunggu Approval", judul, 140 char pertama `contentDetail`, tanggal tayang, PIC) (`:4125-4144`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | ✅ Approve Final & Jadwalkan | `approveFinal(id)` → push approval `Final Review`, status `Scheduled` | `saveAll` | `PATCH /content/{id}` | `:4142`, `:4147-4149` |
  | ↻ Tolak / Revisi | `reqRevision(id)` | `saveAll` | `PATCH /content/{id}` | `:4143`, `:2278-2284` |
  | 👁 Lihat detail final | `openContent(id)` | (lokal) | — | `:4139` |
- **Hak:** tombol approve hanya bila `can('approve')`; selain itu "Menunggu persetujuan dari Account Manager / Content Director." (`:4143`).

### D.10 publishing — Publishing (Tracker)
- **Tampilan:** 2 kartu kolom: "🗓️ Terjadwal (<n>)" (status `Scheduled`, urut `publishDate`) (`:4156`) dan "✅ Sudah Tayang (<n>)" (status `Posted` + `publishRecord`, urut `publishRecord.at` desc, maks 10) (`:4164`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | Tayang ✓ | `markPublished(id)` (bila `can('publish')`) | (lokal) | — | `:4162` |
  | ↗ | buka `publishRecord.url` | (lokal) | — | `:4169` |
  | klik baris | `openContent(id)` | (lokal) | — | `:4158`, `:4165` |
- **Modal "Tandai Sudah Tayang"** (`markPublished` `:2286-2290`, `submitPublish` `:2291-2293`): field `URL Konten` (text, placeholder `https://...`), `Waktu Tayang Aktual` (datetime-local, default sekarang); simpan `publishRecord={platform,platforms,url:url||'-',at,pic}`, status `Posted`.
- **Perhitungan:** badge keterlambatan `daysDiff(publishDate)` (`:4157-4161`).

### D.11 perfinput — Input Performa
- **Tampilan:** pita "📊 Angka insight tiap platform — reach, impression, likes, komentar, share, save, dan klik CTA. Yang tampil hanya konten berstatus **Posted**." (`:4267-4270`); tab segmen "Belum lengkap (<n>)"/"Sudah lengkap (<n>)"/"Semua (<n>)" (default `belum`); input "Cari judul konten..."; peringatan bila ada konten tayang tanpa platform (`:4278-4280`); tabel kolom **Konten / Brand / Platform / Content Pillar / Tayang / Terisi / (aksi)** (`:4303-4304`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | Isi / Ubah | `openPerf(id)` (bila `can('analytics')`) | (lokal) | — | `:4316` |
  | Reset | `perfReset()` | (lokal) | — | `:4275` |
  | Simpan Performa | `savePerf(id)` | `saveAll` | `PUT /content/{id}/performance` | `:4356`, `:4358-4393` |
- **Form performa** (`openPerf` `:4321-4357`): per platform yang ada di `contentPlatforms(c)`, kotak angka dari `window.PK_FIELD` (mesin `performa-konten.js`); label tanggal pengisi "<nama> · <waktu>" atau "belum pernah diisi".
- **Perhitungan:** `perfRows` (`:4240-4251`) — hanya `Posted`; `lengkap` bila semua platform terisi (kecuali warisan); `perfHitung` menghitung tanpa tapis tab sendiri (`:4256-4262`). `savePerf`: seluruh kotak kosong → catatan platform DIHAPUS, dengan konfirmasi menyebut platform (`:4368-4372`); jejak `at/by` + `firstAt/firstBy` yang tak tertimpa (`:4382-4383`).
- **Catatan:** angka hanya bisa diisi bila `pkSiap()` (aset `performa-konten.js` termuat); tanpa itu toast "Mesin analisa belum termuat — muat ulang halaman" (`:4323`).

### D.12 analytics — Performa Konten
- **Tampilan:** bila `pkSiap()` → `window.pkPanelKonten()` dari aset `deploy/assets/performa-konten.js`; bila tidak → pita "Mesin analisa belum termuat" (`:4198-4203`, `:4210-4213`).
- **Ketergantungan:** data dikirim tersaring brand: `{content:filterByBrand(DB.content), prodTasks:filterByBrand(DB.prodTasks)}` (`:4206-4208`).
- **Catatan:** rumus ER/Virality/CTA/pillar TIDAK di `index.html` — ada di `performa-konten.js` (lihat §F.4 & G). Halaman yang sama juga dipakai modul `analytics` (`deploy/analytics/`).

### D.13 designperf — Performa Desain
- **Tampilan:** `window.pkPanelDesain()` dari aset yang sama; pita mesin bila tak termuat (`:4215-4219`).
- **Catatan:** sumber "desain selesai" = `c.prod.design.status==='done'` + `prodTasks kind design`; `doneAt` dicap sejak 18 Sep 2026; request Marketing **tidak** dihitung (disebut di layar) (`CLAUDE.md:6765-6797`).

### D.14 kol — KOL & Medpar Management (2 sub-tab)
- **Sub-tab `db` — "📇 Database KOL & Medpar":**
  - **Tampilan:** kepala "<n> KOL - <n> Media Partner - database talent & partner"; tabel kolom **Nama / Tipe / WhatsApp / Instagram / TikTok / Rate Card / Starting Price / Niche / (aksi)** (`:3254-3255`).
  - **Filter (`kolFilters` `:3150`):** "Cari nama / IG / TikTok / WA / niche...", "Semua Tipe" (`KOL_TYPES`), "Semua Niche" (`KOL_CATEGORIES`), "Reset".
  - **Aksi:** ＋ Tambah KOL / Medpar (`openKolForm`), ✎ edit, 🗑 hapus (`delKol`); badge riwayat harga → `viewKolRateHist`; klik rate card → `viewKolRate`.
  - **Form & field KOL** (`openKolForm` `:3260-3284`, `saveKol` `:3294-3309`):
    | field (nama data) | label UI | tipe | wajib | default / pilihan |
    |---|---|---|---|---|
    | name | Nama KOL / Media Partner * | text | ya ("Nama wajib diisi") | — |
    | type | Kategori Tipe * | select | tidak | `KOL_TYPES=['KOL','Media Partner']` |
    | whatsapp | Nomor WhatsApp | text | tidak | '' |
    | instagram | Username Instagram | text | tidak | tanpa @ |
    | tiktok | Username TikTok | text | tidak | tanpa @ |
    | categories | Kategori Konten / Niche | checkbox multi | tidak | `KOL_CATEGORIES` (17) |
    | rateImage | Rate Card - Upload Gambar (maks 10 MB) | file→base64 | tidak | — |
    | rateValue | Starting Price (Rp) | number | tidak | — |
    | note | Catatan | textarea | tidak | '' |
  - **Perhitungan:** `rateHistUpdate` mencatat `{value,prev,at,by}` hanya bila nominal berbeda, maks 60 entri (`:3176-3182`); `rateHist` di-seed di `initAPI` untuk data lama (`:705-708`). `waLink` menormalkan 0→62 (`:3160-3161`).
- **Sub-tab `visit` — "📅 Planning Kunjungan":**
  - **Tampilan:** kepala "<n> event - kunjungan KOL & Medpar masuk ke Kalender"; tabel kolom **Event / Undangan / Brand / Tanggal / Lokasi / PIC / Status Kehadiran / (aksi)** (`:3438-3439`).
  - **Filter (`visitFilters` `:3151`):** cari, "Semua Status" (`VISIT_STATUS`), "Semua KOL / Medpar", "Reset".
  - **Aksi:** ＋ Buat Kunjungan (Event) (`openVisitForm`), select status kehadiran inline (`setVisitStatus`), "✓ Hadir"/"✕" pada hari-H, DM undangan `dmInvitee` (WhatsApp/Instagram/TikTok).
  - **Form & field Kunjungan** (`openVisitForm` `:3444-3488`, `saveVisit` `:3490-3504`):
    | field (nama data) | label UI | tipe | wajib | default / pilihan |
    |---|---|---|---|---|
    | title | Event / Campaign * | text | ya ("Event / Campaign wajib diisi") | — |
    | date | Tanggal Event | date | tidak | hari ini+3 |
    | time | Jam | time | tidak | `13:00` |
    | location | Lokasi | select | tidak | `VISIT_LOCATIONS` (8) |
    | brand | Brand | select | tidak | `DB.brands` |
    | desc | Deskripsi Event | textarea | tidak | '' |
    | invitees | Undang KOL & Media Partner | checkbox multi (dengan filter tipe/niche + jumlah) | tidak | — |
    | pic | PIC Pendamping | select | tidak | — |
    | status | Status Kehadiran | select | tidak | `VISIT_STATUS`, default `planned` |
    | objective | Objective / Deliverables | text | tidak | '' |
  - **Perhitungan:** `visitInvitees(v)` mendukung bentuk lama `kolId` (`:3391`); `visitMsg(v,name)` template undangan (`:3394-3396`); countdown `relDay`.
  - **Validasi:** tanpa data KOL → "Tambahkan KOL / Medpar di Database dulu" (`:3447`); konfirmasi hapus "Hapus rencana kunjungan ini?" (`:3505`).

### D.15 ads — Ads Management
- **Tampilan:** 4 kartu statistik **Iklan Aktif / Total Dana Masuk / Total Dana Keluar (incl. PPN 11%) / Sisa Dana (brand ini)** (`:3588-3590`); kartu **🏦 Sisa Dana Keseluruhan (Akumulatif - Semua Brand)** (`:3592-3595`); kartu **📆 Report Dana Masuk & Keluar per Bulan** (kolom Bulan/Dana Masuk/Dana Keluar/Sisa (bulan)/Reporting + "⬇️ Export") (`:3606-3609`); kartu **📉 Dana Keluar (Buat Iklan)** dengan tabel iklan (kolom Nama Iklan/Brand/Platform/Target/Usia Range/Video/Hasil (Chats)/Dana Keluar/Periode/Status/(aksi)) (`:3670-3672`); kartu **💰 Dana Masuk (Budget)** (Tanggal/Brand/Nominal/Sumber / Catatan/(aksi)) (`:3620-3622`).
- **Filter (`adsFilters` `:3514`):** cari nama/objective/target, "Semua Platform" (`ADS_PLATFORMS`), "Semua Status" (`ADS_STATUS`), "Reset".
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | 💰 Tambah Dana Masuk | `openFundForm()` | (lokal) | `POST /ad-funds` | `:3585` |
  | 📉 Buat Iklan (Dana Keluar) | `openAdForm()` | (lokal) | `POST /ads` | `:3586` |
  | ⬇️ Export | `exportAdsMonth(ym)` (CSV) | (lokal) | — | `:3604` |
  | ✎ / 🗑 | edit/hapus dana masuk atau iklan | (lokal) | `PUT`/`DELETE` | `:3618`, `:3667` |
  | select status | `setAdStatus` | `saveAll` | `PATCH /ads/{id}` | `:3666` |
- **Form & field Iklan** (`openAdForm` `:4006-4043`, `saveAd` `:4045-4073`):
  | field (nama data) | label UI | tipe | wajib | default / pilihan |
  |---|---|---|---|---|
  | name | Nama Iklan / Kampanye * | text | ya ("Nama iklan wajib diisi") | — |
  | brand | Brand | select | tidak | `DB.brands` |
  | platform | Platform | select | tidak | `ADS_PLATFORMS` (6) |
  | objective | Objective | select | tidak | `ADS_OBJECTIVES` (8) |
  | status | Status | select | tidak | `ADS_STATUS`, default `draft` |
  | target | Target (pilih / ketik manual) | text + datalist | tidak | `ADS_TARGETS` |
  | ageRange | Usia Range (pilih / ketik manual) | text + datalist | tidak | `ADS_AGE_RANGES` |
  | startDate | Mulai * | date | tidak | dijatuhkan ke `todayISO()` (`:4069`) |
  | endDate | Selesai | date | tidak | '' |
  | chats | Hasil - Chats | number | tidak | 0 |
  | videoUrl | Link Video yang Dipromosikan | text | tidak | divalidasi `videoRapi()` |
  | expenses[] | 📉 Dana Keluar (Penggunaan Ads) rincian | baris {date,purpose,amount} | tidak | — |
  | note | Catatan | textarea | tidak | '' |
- **Form & field Dana Masuk** (`openFundForm` `:3967-3978`, `saveFund` `:3979-3985`): `Brand` (select), `Tanggal` (date, default `todayISO()`), `Nominal Dana Masuk (Rp) *` (number, wajib "Nominal dana masuk wajib diisi"), `Sumber / Catatan` (text).
- **Perhitungan di browser:**
  - `adSpendTotal(a)` = (ada `expenses[]` ? Σamount + round(Σamount×`ADS_TAX`) : `a.spend`), `ADS_TAX=0.11` (`:1095`, `:1101`).
  - `adsMonthly(brandScoped)` menjumlahkan dana masuk per bulan `f.date` dan SELURUH dana keluar 1 iklan ke bulan `adBulan(a)` (`:3548-3559`).
  - `adTglDana(a)` berjenjang: `startDate` → `createdDate` → `createdAt` → tanggal rincian pertama (`:3538-3545`); `adBulan` → `YYYY-MM` atau `ADS_TANPA_TGL='0000-00'` (`:3537`, `:3547`).
  - `videoRapi(u)` menambah `https://` / menolak non-tautan (`:3697-3709`); `videoPlat(u)` membaca host (`:3714-3729`).
- **Auto status:** `autoUpdateStatuses()` — `endDate` lewat → `ended`; `startDate<=hari` → `active`; `<hari` → `draft`; `paused` manual tak diganggu (`:1488-1505`).

### D.16 chats — Report Percakapan
- **Tampilan:** filter bulan (dari `adBulan`, sama dengan Ads Management) (`:3841-3844`); 4 kartu **Total Percakapan / Dana Keluar / Biaya per Chat / Iklan Menghasilkan Chat** (`:3849-3854`); kartu **🏆 Yang Paling Top** (Chat Terbanyak / Biaya per Chat Termurah / Video Paling Banyak Chat) (`:3856-3872`); pita peringatan "<n> iklan punya chat tapi dana keluarnya belum diisi" (`:3874-3878`); kartu **💬 Peringkat Iklan** dengan segmen urut "Chat Terbanyak"/"Biaya per Chat Termurah"/"Dana Keluar Terbesar" (`:3767-3771`, `:3882`); tabel **▶ Per Video yang Dipromosikan** dan **📊 Per Platform Iklan** (`:3905-3936`).
- **Aksi:** klik baris → `openAdForm(id)`; tombol segmen → `chatsF('urut',k)` (`:3766`).
- **Perhitungan:** `adBiayaChat(a)` = `adSpendTotal(a)/(+a.chats)`; **null** bila `chats<=0` atau `dana<=0` (`:3751-3763`); `chatsUrut` menaruh nilai null selalu di bawah (`:3772-3784`); `bpc` gabungan hanya dari iklan berchat (`:3796-3797`); `perVideo` digabung per tautan yang sudah dirapikan (`:3809-3820`).

### D.17 brands — Brand Management
- **Tampilan:** kepala "<n> brand dikelola"; grid kartu per brand: nama, deskripsi, 4 angka (KONTEN / TAYANG / FOLLOWERS / KE TARGET), daftar platform (username, followers / target), pillar, PIC, tone (`:2510-2535`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | ＋ Brand Baru | `openBrandForm()` | (lokal) | `POST /brands` | `:2511` |
  | ✎ | `openBrandForm(id)` | (lokal) | `PUT /brands/{id}` | `:2519` |
  | Hapus | `delBrand(id)` konfirmasi "Hapus brand? Konten terkait tidak ikut terhapus." | `saveAll` | `DELETE /brands/{id}` | `:2553`, `:2561` |
- **Form & field Brand** (`openBrandForm` `:2537-2553`, `saveBrand` `:2554-2560`):
  | field (nama data) | label UI | tipe | wajib | default / pilihan |
  |---|---|---|---|---|
  | name | Nama Brand | text | ya ("Nama wajib") | — |
  | color | Warna (kalender) | color | tidak | `#E5A823` |
  | desc | Deskripsi | textarea | tidak | '' |
  | pic | PIC (Account Manager) | select | tidak | `DB.users` |
  | website | Website | text | tidak | '' |
  | audience | Target Audience | text | tidak | '' |
  | tone | Tone of Voice | text | tidak | '' |
  | kpiReach | Target Reach | number | tidak | 0 |
  | kpiFollowers | Target Followers | number | tidak | 0 |
  | freq | Frekuensi Posting | text | tidak | '' |
  | pillars | Content Pillars (pisah koma) | text | tidak | [] |
  | hashtags | Hashtag Wajib (pisah koma) | text | tidak | [] |
- **Perhitungan:** "KE TARGET" = `pct(Σfollowers, Σtarget)` dari `b.platforms[]` (`:2514`, `:2525`, `:1173`).

### D.18 activity — Activity Log
- **Tampilan:** kepala "<n> aktivitas tercatat - jejak audit"; timeline 80 entri terakhir `DB.logs` (nama, aksi, target, waktu) (`:4418-4422`).
- **Catatan:** `logAct` menyimpan maks 300 di klien (`:1429`); backend legacy menyimpan `logs` append-only (`schema.sql:232-233`).

### D.19 settings — Pengaturan
- **Tampilan:** kartu **Organisasi** (Nama Organisasi + Simpan) — hanya `settings`; kartu **Manajemen Data** (Ekspor Konten/Performa/Tim CSV, Backup JSON, Restore JSON) — hanya `settings`; kartu **Kru & Rangkap Kerja** (tabel) — `team`; kartu **Katalog Role & Hak Akses** (non-super) atau **Editor Hak Akses** (super) (`:4485-4513`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | Simpan (Organisasi) | `saveSettings()` → `DB.settings.orgName` | `saveAll` | `PUT /documents/settings` | `:4492` |
  | 📄 Ekspor Konten (CSV) | `exportCSV('content')` | (lokal) | — | `:4496` |
  | 📊 Ekspor Performa (CSV) | `exportCSV('performance')` | (lokal) | — | `:4497` |
  | 👥 Ekspor Tim (CSV) | `exportCSV('team')` | (lokal) | — | `:4498` |
  | 💾 Backup (JSON) | `backupJSON()` | (lokal, dari DB) | `GET /state` | `:4499` |
  | 📂 Restore (JSON) | `restoreJSON()` — ganti SELURUH DB dari berkas | `saveAll` | ⚠️ tidak ada (whole-state) | `:4500`, `:4603` |
  | ✎ Kelola (per kru) | `openUserForm(id)` (bila `OFFICE_IS_ADMIN`) | (lokal) | `PUT /users/{id}` | `:2670` |
  | 💾 Simpan Hak Akses | `savePerms()` → `DB.perms` | `saveAll` | `PUT /documents/perms` | `:4573`, `:4584-4595` |
  | ↺ Kembalikan Default | `resetPerms()` konfirmasi "Kembalikan semua hak akses ke pengaturan default?" | `saveAll` | `PUT /documents/perms` | `:4574`, `:4596-4601` |
  | 👁/klik sel matriks | `cyclePerm` None→Lihat→Ubah | (lokal) | — | `:4578-4583` |
- **Tabel Kru** (`kartuKru` `:2612-2637`, `gambarTeamTabel` `:2638-2676`): kolom **Kru / Divisi / Email / Role / (Kelola)**; filter cari "Cari nama, divisi, email..." + "Semua Role (<n>)".
- **Form Kelola Kru** (`openUserForm` `:2677-2701`, `saveUser` `:2706-2714`): `Nama` (disabled — "Nama & login dikelola di Office"), `Divisi`, `Email`, `Kapasitas Task` (default 24), `Jam Kerja` (default `09.00-18.00`), `Ketersediaan` (`available`/`busy`), `Skill (pisah koma)`, Role multi-pilih via `roleGrid`. Validasi: "Kru tidak ditemukan", "Pilih minimal 1 role" (`:2708`).
- **Editor Hak Akses** (`permEditorCard` `:4552-4576`): matriks Modul × Role, siklus None/Lihat/Ubah; modul pensiun `PERM_MODULES_PENSIUN=['bank','reports']` disaring (`:4533-4534`); label `MODULE_LABELS` (`:4520-4525`).
- **Catatan:** tanpa hak apa pun → kartu "Tidak ada yang bisa kamu buka di sini" (`:4509-4511`).

### D.20 profile — Profil Saya (di luar menu)
- **Tampilan:** nama, divisi - email, daftar role ("rangkap kerja" bila >1), 3 statistik **Total Task** / **Selesai** (status `Posted`) / **Kapasitas**, catatan PIN (`:4605-4622`).
- **Aksi:** "⎋ Keluar" → `logout()` (hapus `SES_KEY`, kembali ke Office tanpa menghapus `lm_session`) (`:4608`, `:1420-1427`).
- **Bukti:** `:4605-4622`.

### D.21 Panel detail konten (drawer, bukan menu)
- **Tampilan** (`openContent` `:2059-2174`): header brand/platform/pillar/judul; stepper 10 status `PIPELINE`; kartu **Alur Status**, **Referensi**, **Detailing** (+ "Salin"), **Kebutuhan Produksi** (shoot/design/edit + status), **Checklist Produksi** (progress `chkDone/length`), performa konten (`renderPerfBlock`), **Publishing Record**, **Approval Trail**, **💬 Diskusi Tim** (mention `@`), **Riwayat Revisi**, footer "Dibuat ...".
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | ← Mundur / Lanjut ke <status> → | `moveStatus(id,±1)` | `saveAll` | `PATCH /content/{id}` | `:2091-2092`, `:2261-2264` |
  | ↻ Minta Revisi | `reqRevision` | `saveAll` | `PATCH /content/{id}` | `:2093` |
  | Batalkan | `cancelContent` konfirmasi "Batalkan konten \"<judul>\"?" | `saveAll` | `PATCH /content/{id}` | `:2094`, `:2285` |
  | Salin | `copyText(detail)` | (lokal) | — | `:2110` |
  | ✓ / ↺ (kebutuhan produksi) | `toggleProdDone` | `saveAll` | `PATCH /content/{id}` | `:2122` |
  | checklist klik / ＋ / ✕ | `toggleChk`/`addChk`/`rmChk` | `saveAll` | `PATCH /content/{id}` | `:2129-2133` |
  | ✅ Tandai Sudah Tayang | `markPublished` (status `Scheduled` + `can('publish')`) | (lokal) | — | `:2142` |
  | Kirim (komentar) | `addComment` + mention | `saveAll` | `PATCH /content/{id}` + `POST /notifications` | `:2157`, `:2268-2277` |
  | Hapus | `deleteContent` konfirmasi "Hapus permanen \"<judul>\"?" | `saveAll` | `DELETE /content/{id}` | `:2170`, `:2294` |
  | ✎ Edit | `openContentForm(id)` | (lokal) | `PUT /content/{id}` | `:2171` |
- **Form Konten** (`openContentForm` `:1827-1896`, `saveContent` `:2015-2050`):
  | field (nama data) | label UI | tipe | wajib | default / pilihan |
  |---|---|---|---|---|
  | title | Judul / Hook | text | ya ("Judul wajib diisi") | — |
  | brand | Brand | select | tidak | `DB.brands` |
  | platforms | Platform (bisa pilih lebih dari satu) | checkbox | **ya** ("Pilih minimal satu platform") | `PLATFORMS` (7) |
  | pillar | Content Pillar | select | tidak | `PILLARS` (10) |
  | contentTypes | Content Type (bisa lebih dari satu) | checkbox | **ya** ("Pilih minimal satu Content Type") | `CONTENT_TYPES` (10) |
  | printTypes | Print Type (bisa lebih dari satu, kosongkan bila tidak dicetak) | checkbox | tidak | `PRINT_TYPES` (9) |
  | detail | Detailing | textarea | tidak | `contentDetail(c)` |
  | refs[] | Referensi (link & foto) | link + file→base64 | tidak | maks 3 MB/foto, total 9 MB |
  | pic | PIC | select | tidak | "- Belum ditentukan -" + `DB.users` |
  | priority | Prioritas | select | tidak | `PRIORITY`, default `medium` |
  | status | Status | select | tidak | `STATUS`, default `Idea` |
  | deadline | Deadline Produksi | date | tidak | '' |
  | publishDate | Tanggal Tayang | date | tidak | '' |
  | publishTime | Jam Tayang | time | tidak | `20:00` |
  | prod{shoot,design,edit} | Kebutuhan Produksi | checkbox + date | tidak | `PROD_TYPES` |
  - `saveContent` menulis bentuk tunggal lama juga: `platform=platforms[0]`, `contentType=ctypes[0]`, `printType=ptypes[0]` (`:2032-2033`); `keyword/caption/hashtags/script` TIDAK ditulis agar data lama tak terhapus (`:2034-2039`).
  - **Perhitungan:** `recommendProdDate(k)` = `publishDate − PROD_OFFSET[k]` (`shoot:5, design:4, edit:2`); tanpa publishDate = `hari ini + (7 − offset)` (`:1995-2003`); `onPublishDateChange` mengisi deadline produksi = H-1 tayang bila kosong (`:2007-2014`).
- **Form Tugas mandiri** (`openTaskForm` `:3099-3113`, `saveTask` `:3115-3120`): `Judul Pekerjaan` (wajib) / `Brand` / `Prioritas` / `PIC` / `Deadline` (default hari+3) / `Catatan / Brief`; `status` default `todo`; hapus `delTask` konfirmasi "Hapus tugas ini?".
- **Modal Minta Revisi** (`:2278-2284`): `Catatan revisi untuk "<judul>"` (wajib "Tulis catatan revisi") → status `Revision`.
- **Mention `@`** (`:2186-2251`): `mentionScan`/`renderMentionPop`/`pickMention`; nama terpanjang diuji dulu; panah/Enter/Tab/Escape.
- **Notifikasi** (`toggleNotif` `:4624-4632`): panel 40 terakhir, "Tandai dibaca", ikon per `type` (`deadline`/`approval`/`revision`/`publish`/`ads`).
- **Pencarian global** (`initSearch` `:4634-4643`): konten (title+detail, 5), brand (3), kru (3); client-side.

### D.22 Layar login (tersembunyi) & logout
- Layar login lama masih di DOM tetapi `display:none` (`:750`, `:775`); identitas dari Office SSO. `readLmSession()` (`:1303-1310`) butuh `lm_session` valid + modul `*`/`konten`. Login lama `doLogin`/`pickLogin` ada (`:1380-1416`) tapi tak dipakai.
- Logout: `logout()` menghapus `SES_KEY` lalu `location.replace('../')`; `lm_session` SENGAJA tidak dihapus (`:1420-1427`).

### D.23b Request Design/Video dari Marketing (baris lintas modul di Design/Editing Queue)
- Baris READ-ONLY dari `marketing-api-mysql?action=designReqs&aktif=1` muncul di Design & Editing Queue saja (`:2876-2899`); tombol "✓ Tandai Selesai" → `designReqSet{status:'done',picNama}` (`:2953-2970`); brief + referensi diambil belakangan via `designReq&id` (`:2901-2948`).
- Kiriman opsi brand/kru/platform ke Marketing via `designReqOpsi` sekali per sesi, dari `bootApp` dan saat antrian dimuat (`:2846-2872`, `:1515-1518`).
- **Bukti:** `:2771-2971`.

## E. Pemetaan backend

Legacy: `getAll` (GET `?action=getAll`), `saveAll` (POST `text/plain`, blob + `baseUpdatedAt`), `receipt`/`uploadReceipt` (tak dipanggil frontend), `ping`/`stats` (`konten-mysql/api.php:47-75`; `docs/modules/konten.md:20-31`). Frontend memanggil `getAll` (`index.html:668`) dan `saveAll` (`:631-634`), ditambah lintas modul Marketing (`:2797-2970`) & Office roster (`:1345-1363`).

| action lama | dipakai di layar | baca/tulis | endpoint v1 | status | catatan |
|---|---|---|---|---|---|
| `getAll` | boot SEMUA layar | baca | `GET /state` (+ `GET /{resource}` granular) | ✅ | `/state` bootstrap; resource granular untuk filter/paginasi |
| `saveAll` (content) | planning, pipeline, calendar, approval, publishing, antrian, panel detail, perfinput, activity | tulis | `POST/PUT/PATCH/DELETE /content[/{id}]` | ⚠️ | v1 granular + `version` (`If-Match`), bukan blob; `hapus_yang_hilang` legacy tak ada di v1 |
| `saveAll` (users) | settings (Kelola Kru) | tulis | `PUT /users/{id}` | ⚠️ | per-baris; nama/login dari Office |
| `saveAll` (brands) | brands | tulis | `POST/PUT/DELETE /brands[/{id}]` | ⚠️ | |
| `saveAll` (prodTasks) | shooting/design/editing (tugas mandiri) | tulis | `POST/PUT/DELETE /prod-tasks[/{id}]` | ⚠️ | nama resource v1 `prod-tasks` (legacy key `prodTasks`) |
| `saveAll` (shootings) | calendar (sisa data lama) | tulis | `/shootings` | ⚠️ | jarang dipakai; shooting aktif di `content.prod.shoot` |
| `saveAll` (assets) | assets | tulis | `/assets` | ⚠️ | |
| `saveAll` (bank) | — (layar dicabut) | tulis | `/bank` | ✅ | koleksi tetap ada di v1 (`docs/api/konten.md:34`) |
| `saveAll` (kols) | kol (db) | tulis | `/kols` | ⚠️ | |
| `saveAll` (visits) | kol (visit), calendar | tulis | `/visits` | ⚠️ | |
| `saveAll` (ads) | ads, chats | tulis | `/ads` | ⚠️ | |
| `saveAll` (adFunds) | ads | tulis | `/ad-funds` | ⚠️ | nama resource v1 `ad-funds` (legacy key `adFunds`) |
| `saveAll` (campaigns) | — (layar dicabut) | tulis | `/campaigns` | ✅ | data tetap ada |
| `saveAll` (notifs) | notifikasi | tulis | `/notifications` | ⚠️ | nama resource v1 `notifications` (legacy key `notifs`) |
| `saveAll` (logs) | `logAct` di hampir semua aksi | tulis | `POST /logs` | ✅ | v1 append-only, trim 5000 (`docs/api/konten.md:74-79`) |
| `saveAll` (settings) | settings (orgName) | tulis | `PUT /documents/settings` | ✅ | hash sebagai version |
| `saveAll` (perms) | settings (Editor Hak Akses) | tulis | `PUT /documents/perms` | ✅ | whole-object, content-hash |
| `saveAll` (seeded) | seed awal | tulis | `PUT /documents/seeded` | ✅ | |
| `saveAll` (content.perf) | perfinput/perf panel | tulis | `PUT /content/{id}/performance` | ✅ | merge per platform; `metrics: null` menghapus catatan satu platform (G-01, laksamana-api#177) |
| `receipt` / `uploadReceipt` | TIDAK dipanggil frontend (foto referensi disimpan base64 di record) | baca/tulis | `GET /files/{key}` / `POST /files` | ✅ | v1 ada; legacy frontend tak memakainya |
| `ping` / `stats` | diagnostik (tak dipanggil frontend) | baca | `GET /stats` | ✅ | |
| `listModuleRoster` (account) | boot (roster kru) | baca lintas | `/api/v1/account/*` (roster Office) | ⚠️ | legacy `account-api-mysql?action=listModuleRoster{module:'konten'}` (`:1345-1363`) |
| `designReqs` (marketing) | design & editing queue | baca lintas | `GET /api/v1/marketing/design-queue?active=1` | ✅ | baris read-only |
| `designReq` (marketing) | modal brief (referensi) | baca lintas | `GET /api/v1/marketing/design-requests/{id}` | ✅ | |
| `designReqSet` (marketing) | tombol "✓ Tandai Selesai" | tulis lintas | `PUT /api/v1/marketing/design-requests/{id}/progress` | ✅ | |
| `designReqOpsi` (marketing) | boot + queue (titip opsi brand/kru/platform) | tulis lintas | `PUT /api/v1/marketing/design-options` | ⚠️ | v1 whole-document, bukan per-kiriman; arah Konten→Marketing |
| (Restore JSON massal) | settings | tulis | ⚠️ tidak ada | ⚠️ | `restoreJSON` mengganti SELURUH DB (`:4603`); v1 tak punya endpoint whole-state |

Konkurensi: legacy menstempel `updatedAt=sekarang` + `baseUpdatedAt=versi server` per baris, baris basi ditolak ke `bentrok[]` (pesan UI "Sebagian perubahan tidak tersimpan — N data sudah diubah kru lain. Muat ulang halaman.", `:644-645`); `saveAll` tetap `ok:true` (`api.php:13-15`, `README.md:51-58`). v1 memakai `updatedAt` (ms) sebagai version, `428 version_required`, `409 version_conflict` (record hidup di `error.details.current`; isi identik → sukses no-op); **berbagi lock `konten_save`** sehingga versi v1 valid sebagai `baseUpdatedAt` lama (`docs/api/konten.md:51-57`). Kode error UI: `unauthenticated`, `module_not_granted`, `not_found`, `version_required`, `version_conflict`, `already_exists` (`docs/api/konten.md`, `docs/modules/konten.md`).

## F. Aturan bisnis yang wajib dibawa
1. **`STATUS_ARSIP=['Posted','Cancelled']` satu daftar** — dipakai tapis arsip & penghitung; menambah status selesai baru cukup di satu tempat — bukti: `index.html:1735-1736`, `CLAUDE.md:6557-6559`.
2. **Status arsip terpilih MENANG atas tapis arsip** — memilih status `Posted` saat tapis arsip `aktif` dulu memulangkan tabel KOSONG (terbaca "belum ada yang tayang") — bukti: `index.html:1787-1789`, `CLAUDE.md:6560-6564`.
3. **Reset mengembalikan ke AKTIF, bukan Semua** (planning & antrian) — bukti: `index.html:1766-1768`, `:2752-2755`, `CLAUDE.md:6565-6566`.
4. **`c.metrics` lama TIDAK PERNAH punya penulis**; angka performa sebenarnya di `c.perf` per platform (diisi Input Performa) — halaman yang membaca `metrics` selalu nol; bentuk lama tetap digambar sebagai "catatan lama" — bukti: `:4399-4416`, `CLAUDE.md:6665-6680`.
5. **Rumus performa di `deploy/assets/performa-konten.js`, satu sumber** untuk Konten & Analytics; jangan disalin — bukti: `:4178-4188`, `CLAUDE.md:6646-6649`.
6. **Satu penyebut untuk 3 rasio**: `reach` bila ada, else `impression`, else null (bukan nol); Virality = (share+save)÷dasar (tanpa like/komentar) — bukti: `CLAUDE.md:6682-6702`.
7. **Agregat = jumlahkan pembilang & penyebut dulu baru bagi**, bukan rata-rata persen — bukti: `CLAUDE.md:6704-6710`.
8. **Konten tayang di 2 platform ≠ 2 konten** (kartu/pillar menghitung konten, tabel per platform menghitung baris) — bukti: `CLAUDE.md:6721-6723`.
9. **Bulan tayang dibaca dari `publishRecord.at` DULU**, baru `publishDate` — bukti: `CLAUDE.md:6740-6743`.
10. **Mengosongkan SELURUH kotak performa 1 platform = menghapus catatannya**, dengan konfirmasi menyebut platform — bukti: `:4368-4372`, `CLAUDE.md:6757-6759`.
11. **Jejak pengisi performa** (`at/by` + `firstAt/firstBy`) disimpan — bukti: `:4378-4383`.
12. **"Tugas Saya" dari 3 sumber** (konten PIC, sub-tugas produksi, tugas mandiri), urut paling lewat tenggat di atas, tanpa deadline tetap ikut — bukti: `:1613-1648`, `CLAUDE.md:6622-6636`.
13. **Angka PIC/role dihitung TANPA tapis dirinya sendiri**; "Belum ada PIC" = `__none__`, bukan `''` — bukti: `:1775-1779`, `:2615-2619`, `CLAUDE.md:6612-6620`, `:6901-6904`.
14. **Impression dibuang dari form Ads** (tak ada yang mengisi; kolomnya salah terbaca nol) — bukti: `:3649-3651`.
15. **Tanggal iklan MULAI menentukan bulan pengeluaran**; ada cadangan berjenjang `startDate→createdDate→createdAt→rincian`; tanpa tanggal masuk keranjang `ADS_TANPA_TGL='0000-00'` "Belum ada tanggal mulai" (jangan dibuang) — bukti: `:3516-3565`.
16. **Dana keluar termasuk PPN 11%** (`ADS_TAX=0.11`), satu fungsi `adSpendTotal` untuk tabel & Report Percakapan — bukti: `:1095`, `:1101`, `CLAUDE.md:6930-6936`.
17. **Biaya per chat DITAHAN (`—`)** bila chat 0 atau dana 0; iklan tanpa dana dikeluarkan dari peringkat termurah & jumlahnya disebut — bukti: `:3751-3763`, `:3874-3878`, `CLAUDE.md:6938-6946`.
18. **Per video: tautan sama digabung** sesudah dirapikan; tanpa link berdiri sendiri (tidak ditebak) — bukti: `:3804-3820`, `CLAUDE.md:6955-6959`.
19. **Tautan video tanpa protokol dirapikan, bukan tautan ditolak** — bukti: `:3697-3709`, `CLAUDE.md:6916-6920`.
20. **Platform materi iklan dibaca dari HOST** (`videoPlat`), bukan kolom Platform iklan — bukti: `:3710-3729`, `CLAUDE.md:6921-6925`.
21. **Request Design dari Marketing DIBACA, tidak disalin**; hanya design/edit; baris read-only kecuali "Tandai Selesai"; kegagalan tidak boleh memblok antrian (`REQ_MKT.st` menahan reload) — bukti: `:2771-2827`.
22. **Opsi brand/kru dititipkan ke Marketing sekali per sesi** dari Konten (bukan ditarik Marketing) — bukti: `:2828-2872`.
23. **Content Bank & Workload & Reports dicabut: layarnya, bukan datanya**; `DB.bank` tetap ada di seed/KT_COLS/guard; `perms.bank`/`perms.reports` disaring dari matriks — bukti: `:2495-2507`, `:4526-4534`, `CLAUDE.md:6869-6888`, `:6990-7001`.
24. **Workload: tak ada layar pun menyebut utilisasi kru**; `capacity` masih tersimpan — bukti: `:2716-2724`, `CLAUDE.md:7008-7015`.
25. **Skill/Beban/Ketersediaan dicabut dari tabel Kru, datanya tetap** (bisa disunting lewat Kelola, ikut Ekspor Tim) — bukti: `:2585-2588`, `CLAUDE.md:7003-7006`.
26. **Halaman Pengaturan: kartu disaring sendiri-sendiri** (`settings` vs `team`) supaya Content Director tidak kehilangan daftar kru — bukti: `:4478-4488`, `CLAUDE.md:7021-7028`.
27. **Toggle platform/contentType/printType multi-pilih**, bentuk tunggal lama ikut ditulis (untuk kalender/queue/CSV lama) — bukti: `:908-940`, `:2028-2033`.
28. **`contentDetail` membaca dua arah** (data lama keyword/caption/hashtags/script disusun ulang bila `detail` kosong); kolom lama tidak ditimpa — bukti: `:947-973`, `:2034-2039`.
29. **Referensi = satu larik campuran link & gambar** (urutan penting), maks 3 MB/foto & total 9 MB (×1.37 base64) — bukti: `:941-946`, `:1825-1826`, `:1957-1972`.
30. **Mode notifikasi `type`** (`deadline`/`approval`/`revision`/`publish`/`ads`), `read` flag — bukti: `:4626`.
31. **Kru datang dari Office**; `openUserForm` tak punya mode tambah ("Kru tidak ditemukan"); nama disabled "Nama & login diatur di Office" — bukti: `:2680`, `:2685`.
32. **`logAct`/`notify` ikut menyimpan** (`save()` di dalamnya) — setiap aksi berjejak — bukti: `:1429-1430`.

## G. Ketergantungan lintas modul
- **Office (account)** — identitas & roster: sesi `lm_session` (`index.html:1303-1310`), `autoSyncOfficeRoster` menarik roster ber-grant `konten` via `account-api-mysql?action=listModuleRoster{module:'konten'}` dengan cadangan Apps Script (`:1345-1363`). `adminModules` menentukan `OFFICE_IS_ADMIN` (`:757`).
- **Marketing → Konten (Request Design/Video)** — Konten MEMBACA `designReqs`/`designReq` dan menulis balik progres `designReqSet` ke modul Marketing (bukan disalin) (`:2771-2971`). Konten juga MENITIP opsi brand/kru/platform via `designReqOpsi` (`:2846-2872`). v1: `GET /marketing/design-queue`, `GET/PUT /marketing/design-requests/{id}`, `PUT /marketing/design-options` (`docs/api/marketing.md:20,70`).
- **Konten → Analytics** — modul Analytics membaca blob modul Konten lewat `konten-api?action=getAll` (`CLAUDE.md:6799-6811`); halaman Performa Konten/Desain yang sama dipakai `deploy/analytics/`.
- **Aset bersama** `deploy/assets/performa-konten.js` dipakai Konten (`analytics`/`designperf`/`perfinput`) DAN Analytics; wajib dipindah apa adanya (`:4174-4208`, `CLAUDE.md:6646-6655`). Aset lain di §2 brief (`performa-bonus.js`, dst.) TIDAK dipakai di frontend konten (TIDAK DITEMUKAN (dicari: `performa-bonus|kwitansi-sheet|cocok-bri|hpp-mesin|venue-layouts|xlsx-baca` di `deploy/konten/index.html`)).
- **HR → Akademi** (bukan konten) tercatat di modul lain; tidak ada ketergantungan konten↔HR.
- Logo `../assets/laksamanamuda-warna.jpg` (`:571-572`).

## H. Catatan untuk implementasi Vue
- Halaman: `app/pages/konten/index.vue` (Dashboard) + `konten/planning.vue`, `konten/pipeline.vue`, `konten/calendar.vue`, `konten/shooting.vue`, `konten/design.vue`, `konten/editing.vue`, `konten/assets.vue`, `konten/approval.vue`, `konten/publishing.vue`, `konten/performa/input.vue`, `konten/performa/konten.vue`, `konten/performa/desain.vue`, `konten/kol.vue`, `konten/ads.vue`, `konten/chats.vue`, `konten/brands.vue`, `konten/activity.vue`, `konten/pengaturan.vue`, `konten/profil.vue`. `definePageMeta({ access: ['konten'] })`; sembunyikan menu Kontrol/ads/KOL sesuai matriks `perms` dari `documents/perms`.
- Composable `useKonten.ts` (fungsi → endpoint):
  - `useKontenState()` → `GET /state`; `useKontenResource(res, filters)` → `GET /{resource}`; `useKontenStats()` → `GET /stats`.
  - `createRecord(res, body)` → `POST /{resource}`; `updateRecord(res, id, body, version)` → `PUT /{resource}/{id}`; `patchRecord` → `PATCH`; `deleteRecord(res, id, version)` → `DELETE`.
  - `savePerformance(id, platform, metrics)` → `PUT /content/{id}/performance`.
  - `useDocument(doc)` → `GET /documents/{doc}`; `saveDocument(doc, value, hash)` → `PUT /documents/{doc}` (menyimpan `settings`, `perms`, `seeded`).
  - `logActivity(action, target)` → `POST /logs`; `useLogs(refId)` → `GET /logs`.
  - `uploadFile(file)` → `POST /files` (≤8 MB, gambar/PDF) → simpan `key` di record; `fileUrl(key)` → `GET /files/{key}`.
  - Kirim version sebagai `If-Match: "<version>"`; tangani `409 version_conflict` (muat ulang dari `error.details.current`) & `428 version_required`.
- HP vs desktop: Kanban Pipeline → `AppList` berkelompok per status di HP (drag-drop tak andal di sentuh), `UTable` di desktop; tabel (Planning, antrian, KOL, Ads, Kru, Performa) → `AppList` di HP, `UTable` di `lg+`; form (Konten, Tugas, Brand, KOL, Kunjungan, Ads, Dana Masuk, Asset, Performa) → `ResponsiveSheet`; panel detail konten → halaman/sheet dengan satu `AppFocus`.
- Widget Beranda yang cocok: "Tugas Saya (terlambat & ≤3 hari)", "Menunggu Approval", "Today's Schedule", "Top Konten" (dari `c.perf`).
- Elemen lama yang melanggar DESIGN.md → padanannya:
  - **Grid kartu angka besar** (Dashboard, brand, Ads, Report Percakapan) → `AppList` berkelompok + satu `AppFocus`.
  - **Gradien** (`sisaAllCard` `:3592` `linear-gradient(135deg,…)`) → `bg-default` flat.
  - **Emoji sebagai ikon** (📅📹🎨🎬📊👋🚀⚓🔗🖼, dst.) → Lucide (`i-lucide-*`).
  - **Label huruf kapital mono** ("KONTEN", "TAYANG", "FOLLOWERS", "PERSONAL") → `text-muted` sentence case.
  - **Warna hex/gradien di record** (`STATUS[].c`, `PLATFORMS[].c`, `b.color`, `tint()`) → token warna DESIGN.md; kuning hanya aksi utama.
  - **Tombol hapus merah penuh** (`btn-danger`) → aksi neutral/outline + konfirmasi.
  - **Pill berwarna penuh** (`statusPill`, `prioBadge` dengan 🔴🟠🔵⚪) → `AppStatus` (titik + kata).
- Simpan: hilangkan `saveAll`+`stampChanges`+`buildPayload`+`refreshSnapshot` + `localStorage`; tulis per-record dengan version; tampilkan `version_conflict`. Pertahankan pola "gambar ulang hanya tabel" (jangan remount input saat mengetik) dengan `computed`/`v-model` reaktif — bukan mengganti strategi.
- Notifikasi: v1 `GET/POST /notifications` — panel notifikasi bisa jadi bagian Beranda, bukan lagi panel topbar terpisah.

## I. Pertanyaan terbuka
- [ ] **konten / settings — Restore JSON massal** — v1 tidak punya endpoint "ganti seluruh dokumen" (`restoreJSON` mengganti SELURUH DB dari satu berkas), sementara v1 memakai CRUD per-record + version. Haruskah tombol "📂 Restore (JSON)" dibawa ke Vue? Konteks: data konten menyimpan caption/script/komentar/approval; restore massal bisa menimpa pekerjaan kru lain. Bukti: `laksamana-office/deploy/konten/index.html:4500,4603`; `laksamana-api/docs/api/konten.md` (tak menyebut restore). Opsi: A) buang tombolnya; B) loop POST/PUT/DELETE per record; C) minta endpoint khusus whole-state.
- [x] **konten / perfinput — hapus catatan performa satu platform** — ✅ **Selesai (G-01, laksamana-api#177):** v1 menerima `metrics: null` untuk menghapus satu platform; `KontenPerfForm` menanyakan (menyebut platform) lalu mengirimnya. Bukti: `index.html:4364-4372`; `laksamana-api/docs/api/konten.md:59-65`. Opsi: A) tambah field/aksi hapus di endpoint; B) perlakukan kosong sebagai nol di UI (tapi melanggar aturan §F.10); C) minta endpoint terpisah.
- [ ] **konten / design & editing queue — kiriman opsi ke Marketing** — legacy mengirim `designReqOpsi` dua kali sumber (boot + queue); v1 memakai `PUT /marketing/design-options` whole-document. Perlukah Konten tetap menitipkan opsi brand/kru/platform, atau Marketing menariknya sendiri di v1? Bukti: `index.html:2846-2872`; `laksamana-api/docs/api/marketing.md:20`. Opsi: A) Konten kirim sekali per sesi; B) Marketing tarik dari endpoint Office; C) buang titipan (isi bebas).
- [ ] **konten / semua layar — peta role internal vs matriks `perms`** — role internal (`super_admin`…`analyst`) dan matriks `PERM_ROLES_LEGACY` adalah data yang diterapkan UI; v1 menyimpannya di `documents/perms` tapi tidak menyebut default-nya untuk instalasi baru. Perlukah Vue memuat default yang sama, dan dari mana `OFFICE_IS_ADMIN` (admin modul Office) dipetakan ke izin v1? Bukti: `index.html:808-891,1246-1265`; `laksamana-api/docs/api/konten.md:30,36`. Opsi: A) seed `perms` default di Vue; B) API menyediakan default; C) admin Office menentukan semuanya.

## Konsolidasi untuk README & berkas bersama

### Baris README (siap tempel)
`| konten | [konten.md](konten.md) | ⚠️ selesai dengan celah | 20 (1 di luar menu; 2 sub-tab KOL) | 0 ❌ · 2 ⚠️ | 4 | 4691 baris; blob saveAll → CRUD per-baris; rumus performa di assets/performa-konten.js |`

### Pertanyaan terbuka (format `_pertanyaan.md`)
- [ ] **konten / settings — Restore JSON massal** — v1 tidak punya endpoint "ganti seluruh dokumen" (`restoreJSON` mengganti SELURUH DB dari satu berkas), sementara v1 memakai CRUD per-record + version. Haruskah tombol "📂 Restore (JSON)" dibawa ke Vue? Konteks: data konten menyimpan caption/script/komentar/approval; restore massal bisa menimpa pekerjaan kru lain. Bukti: `laksamana-office/deploy/konten/index.html:4500,4603`; `laksamana-api/docs/api/konten.md` (tak menyebut restore). Opsi: A) buang tombolnya; B) loop POST/PUT/DELETE per record; C) minta endpoint khusus whole-state.
- [x] **konten / perfinput — hapus catatan performa satu platform** — ✅ **Selesai (G-01, laksamana-api#177):** v1 menerima `metrics: null` untuk menghapus satu platform; `KontenPerfForm` menanyakan (menyebut platform) lalu mengirimnya. Bukti: `laksamana-office/deploy/konten/index.html:4364-4372`; `laksamana-api/docs/api/konten.md:59-65`. Opsi: A) tambah field/aksi hapus di endpoint; B) perlakukan kosong sebagai nol di UI (melanggar aturan §F.10); C) minta endpoint terpisah.
- [ ] **konten / design & editing queue — kiriman opsi ke Marketing** — legacy mengirim `designReqOpsi` dari dua sumber (boot + queue); v1 memakai `PUT /marketing/design-options` whole-document. Perlukah Konten tetap menitipkan opsi brand/kru/platform, atau Marketing menariknya sendiri di v1? Bukti: `laksamana-office/deploy/konten/index.html:2846-2872`; `laksamana-api/docs/api/marketing.md:20`. Opsi: A) Konten kirim sekali per sesi; B) Marketing tarik dari endpoint Office; C) buang titipan (isi bebas).
- [ ] **konten / semua layar — peta role internal vs matriks `perms`** — role internal (`super_admin`…`analyst`) dan matriks `PERM_ROLES_LEGACY` adalah data yang diterapkan UI; v1 menyimpannya di `documents/perms` tapi tidak menyebut default-nya untuk instalasi baru. Perlukah Vue memuat default yang sama, dan dari mana `OFFICE_IS_ADMIN` (admin modul Office) dipetakan ke izin v1? Bukti: `laksamana-office/deploy/konten/index.html:808-891,1246-1265`; `laksamana-api/docs/api/konten.md:30,36`. Opsi: A) seed `perms` default di Vue; B) API menyediakan default; C) admin Office menentukan semuanya.

### Temuan lintas modul (format `_lintas-modul.md`)
- Marketing → **Request Design & Video** ke Konten: Konten MEMBACA `designReqs&aktif=1` / `designReq&id` dari `marketing-api-mysql` dan menulis balik progres `designReqSet{status:'done',picNama}` (baris READ-ONLY kecuali tombol Selesai) — hanya di Design & Editing Queue, TIDAK di Shooting. v1: `GET /api/v1/marketing/design-queue?active=1`, `GET /api/v1/marketing/design-requests/{id}`, `PUT /api/v1/marketing/design-requests/{id}/progress` (`laksamana-office/deploy/konten/index.html:2771-2971`; `laksamana-api/docs/api/marketing.md:20,70`). **YA, konten menerima "Request Design" dari Marketing.**
- Konten → Marketing: Konten MENITIPKAN opsi brand/kru/platform (`designReqOpsi`) sekali per sesi dari `bootApp` + saat antrian produksi dimuat; v1 `PUT /api/v1/marketing/design-options` (whole-document) (`laksamana-office/deploy/konten/index.html:2846-2872`; `laksamana-api/docs/api/marketing.md:20`).
- **Analytics ← Konten**: modul `deploy/analytics/` TIDAK punya DB sendiri; membaca blob Konten lewat `konten-api?action=getAll` dan memakai aset yang sama `deploy/assets/performa-konten.js` untuk halaman Performa Konten & Performa Desain (`laksamana-office/CLAUDE.md:6646-6663,6799-6806`). **YA, konten memasok Analytics** (reach/engagement/virality/CTA + `prod.design`).
- **Aset bersama**: `deploy/assets/performa-konten.js` dipakai `deploy/konten/` (perfinput/analytics/designperf) DAN `deploy/analytics/` — rumus ER/Virality Index/CTA Click Rate/pillar WAJIB dipindah apa adanya ke Vue (satu sumber) (`laksamana-office/deploy/konten/index.html:4174-4208`; `CLAUDE.md:6638-6649`).
- **Office/Account → Konten**: sesi `lm_session` + roster ber-grant `konten` (`account-api-mysql?action=listModuleRoster{module:'konten'}`, cadangan Apps Script) — v1 dari `/api/v1/account/*` (`laksamana-office/deploy/konten/index.html:1303-1363`).

## J. Progres build
Issue: #15, dipecah #47–#51 · Branch terakhir: `migrasi/konten-sistem` (#51, PR #69, ditumpuk #68 ← #67 ← #66) · Mulai: 2026-10-07
LANJUTKAN DARI: modul Konten (#15) lengkap — #47–#51 menunggu review/merge (PR #66–#69 bertumpuk). Restore JSON = Segera (K-01/G-13). Uji silang bagian K di dev saat cutover.

| layar (key) | file | status | endpoint dipakai | sub-issue |
|---|---|---|---|---|
| dashboard | `app/pages/konten/dashboard.vue` | ✅ | `GET /konten/state` | #47 — Top Konten dari angka per platform (`performa-konten.ts`, #49); `autoUpdateStatuses` = `useStatusIklanOtomatis` (#50) |
| planning | `app/pages/konten/planning.vue` | ✅ | `GET /konten/state` | #47 |
| pipeline | `app/pages/konten/pipeline.vue` | ✅ | `PATCH /konten/content/{id}` (status), `POST /konten/notifications` | #47 — HP: daftar per status (drag tak dibawa ke sentuh) |
| calendar | `app/pages/konten/calendar.vue` | ✅ | `PATCH /konten/content`, `/prod-tasks`, `/shootings`, `/visits` (geser tanggal) | #47 — (koreksi build 2026-10-07) tanggal sel & "hari ini" lokal; lama memakai toISOString sehingga sel WIB menampilkan acara sehari sebelumnya |
| panel detail + form konten (D.21) | `app/pages/konten/detail/[id].vue`, `app/components/KontenForm.vue` | ✅ | `POST/PUT/PATCH/DELETE /konten/content`, `DELETE /konten/shootings/{id}` (syncProdTasks), `POST /konten/notifications`, `POST /konten/logs` | #47 — blok performa = `KontenPerfBlok` (#49); lembar revisi & tayang = `KontenRevisiSheet`/`KontenTayangSheet` (dipakai bersama approval & publishing) |
| shooting | `app/pages/konten/shooting.vue` (+ `KontenAntrian`, `KontenTugasForm`) | ✅ | `PATCH /konten/content/{id}` (prod[kind]), `POST/PUT/DELETE /konten/prod-tasks` | #48 — tanpa baris Marketing, seperti lama |
| design | `app/pages/konten/design.vue` | ✅ | `PATCH /konten/content/{id}` (prod[kind]), `POST/PUT/DELETE /konten/prod-tasks`, `GET /marketing/design-queue?active=1`, `GET /marketing/design-requests/{id}`, `PUT /marketing/design-requests/{id}/progress`, `PUT /marketing/design-options` | #48 — 403 (laksamana-api#190) tidak memblokir: pita + Coba lagi |
| editing | `app/pages/konten/editing.vue` | ✅ | sama dengan design | #48 |
| assets | `app/pages/konten/assets.vue` (+ `KontenAssetForm`) | ✅ | `POST/PUT/DELETE /konten/assets` | #48 — tautan saja; `/files` tidak dipakai (lama pun tidak) |
| approval | `app/pages/konten/approval.vue` (+ `KontenRevisiSheet`) | ✅ | `PATCH /konten/content/{id}` (approvals + status), `POST /konten/notifications`, `POST /konten/logs` | #49 — lencana menu = jumlah status Approval (semua brand) |
| publishing | `app/pages/konten/publishing.vue` (+ `KontenTayangSheet`) | ✅ | `PATCH /konten/content/{id}` (publishRecord + status) | #49 |
| perfinput | `app/pages/konten/perfinput.vue` (+ `KontenPerfForm`) | ✅ | `PUT /konten/content/{id}/performance` (satu per platform; `metrics: null` menghapus) | #49 — hapus catatan 1 platform = konfirmasi menyebut platform lalu `metrics: null` (G-01, laksamana-api#177) |
| analytics | `app/pages/konten/analytics.vue` (+ `KontenPerformaPanel`) | ✅ | `GET /konten/state` | #49 — panel & rumus dipakai juga modul Analytics (#20) |
| designperf | `app/pages/konten/designperf.vue` (+ `KontenDesainPanel`) | ✅ | `GET /konten/state`, `GET /marketing/design-queue` (tanpa `active`) | #49 — 403 request Marketing: pita + Coba lagi, sisanya tetap jalan |
| kol | `app/pages/konten/kol.vue` (+ `KontenKolForm`, `KontenVisitForm`) | ✅ | `POST/PUT/DELETE /konten/kols`, `/konten/visits`, `PATCH /konten/visits/{id}` (status kehadiran) | #50 — sub-tab di `?tab=visit` |
| ads | `app/pages/konten/ads.vue` (+ `KontenIklanForm`, `KontenDanaForm`) | ✅ | `POST/PUT/DELETE/PATCH /konten/ads`, `POST/PUT/DELETE /konten/ad-funds` | #50 — ekspor CSV per bulan di browser (K-05) |
| chats | `app/pages/konten/chats.vue` | ✅ | `GET /konten/state` | #50 |
| brands | `app/pages/konten/brands.vue` (+ `KontenBrandForm`) | ✅ | `POST/PUT/DELETE /konten/brands` | #51 — kartu: Konten, Tayang, Followers, % ke target (Σfollowers ÷ Σtarget) |
| activity | `app/pages/konten/activity.vue` | ✅ | `GET /konten/state` (logs) | #51 — 80 terbaru |
| settings | `app/pages/konten/settings.vue` (+ `KontenKruForm`) | ✅ | `GET/PUT /konten/documents/settings`, `GET/PUT /konten/documents/perms`, `PUT /konten/users/{id}` | #51 — Restore JSON = **Segera** (K-01/G-13); ekspor CSV & backup JSON di browser |
| profile | `app/pages/konten/profile.vue` | ✅ | `GET /konten/state` | #51 — dibuka dari tombol kaki sidebar "Profil saya"; Keluar ke Office tanpa logout |

Catatan build:
- Fondasi #47: `app/utils/konten.ts` (konstanta & rumus murni), `app/utils/status-konten.ts`, `app/composables/useKonten.ts` (satu `GET /state` bersama, CRUD per record dengan If-Match = `updatedAt`), `app/utils/layar/konten.ts`, entri shell. Uji: `node tools/uji-konten.mjs` (28 cek pada #47; 10 mutasi tertangkap).
- Kru tanpa baris `users` dikenali di memori sebagai planner (super_admin bila admin modul Office), seperti `resolveKontenUser` lama; sinkron roster → `POST /users` ikut Kelola Kru (#51).
- Halaman detail konten di `/konten/detail/[id]` (lama: drawer).
- #48: antrian = `barisAntrian` + `saringAntrian` + `reqMktUntuk` di `konten.ts`, satu komponen `KontenAntrian` untuk tiga layar. Request Marketing dibaca sekali per sesi (kunci `konten-req-mkt`); opsi brand/kru/platform dititipkan ke Marketing SEKALI per sesi sesudah request DAN state Konten terbaca (T-07). Tandai Selesai menyembunyikan baris seketika dan memunculkannya lagi bila Marketing menolak, seperti lama. Uji: `node tools/uji-konten.mjs` (57 cek; 9 mutasi antrian tertangkap).
- (koreksi build) Deadline bawaan tugas mandiri = hari ini + 3 menurut tanggal lokal; lama memakai `toISOString()` (UTC) sehingga sebelum 07:00 WIB kurang sehari.
- Tombol Simpan/Hapus form tugas & asset hanya untuk yang boleh mengubah layar itu (lama: form tugas bisa disimpan siapa pun yang membukanya dari baris).
- #49: rumus performa = `app/utils/performa-konten.ts` (port `deploy/assets/performa-konten.js`, pemilik konten). Modul Analytics (#20) WAJIB mengimpor dari sini + memakai `KontenPerformaPanel`/`KontenDesainPanel` (prop `kunci` untuk keadaan sendiri, `tautan=false` bila tanpa akses Konten); jangan disalin. Platform/tipe memakai `contentPlatforms`/`contentTypes` dari `konten.ts` (salinan PK_ALIAS lama tidak perlu lagi). Uji: `node tools/uji-performa-konten.mjs` (50 cek; 18 mutasi rumus tertangkap).
- Input Performa: v1 menimpa `perf[platform]` dengan kiriman + `{at, by}`, jadi `firstAt/firstBy` dikirim dari klien (dipertahankan dari catatan lama). `by` v1 = NAMA pengguna (lama: id kru); tampilan membaca keduanya.
- Mengosongkan seluruh kotak satu platform yang sudah punya catatan MENGHAPUS catatan itu: form menanyakan dulu dengan menyebut platform, lalu mengirim `metrics: null` (G-01, laksamana-api#177). Platform yang belum pernah diisi dan tetap kosong tidak dikirim. Form performa hanya bisa disimpan pemegang izin ubah `analytics` (lama: judul baris membuka form untuk siapa pun).
- #50: rumus KOL/Ads/Chats di `app/utils/promosi-konten.ts` (bulan = tanggal MULAI dengan cadangan berjenjang + keranjang tanpa tanggal; PPN 11%; biaya per chat null bila chat/dana 0; per video digabung per tautan yang dirapikan). Uji: `node tools/uji-promosi-konten.mjs` (43 cek; 17 mutasi tertangkap).
- Status iklan otomatis (lama: tiap halaman dibuka, siapa pun) → sekali per sesi, hanya pemegang izin ubah `ads`, PATCH per iklan dengan versi, gagal diam (dicoba lagi sesi berikutnya). Dipanggil Ads Management & Dashboard.
- (koreksi build) Tanggal bawaan form kunjungan = hari ini + 3 menurut tanggal LOKAL (lama UTC). Ubah status kehadiran memakai PATCH `status` saja; simpan form KOL/kunjungan/iklan/dana = PUT seluruh baris (field lama seperti `rateDrive`, `rateTier`, `createdDate` tetap).
- #51: rumus brand/kru/matriks/ekspor di `app/utils/sistem-konten.ts`. Uji: `node tools/uji-sistem-konten.mjs` (25 cek; 20 mutasi tertangkap).
- Sinkron roster (`useSinkronKruKonten`, dipanggil Dashboard): sekali per sesi, hanya admin modul Office; anggota baru → `POST /konten/users` (planner, super_admin bila admin modul), nama ikut Office (`PATCH`). Baris lama yang cocok NAMA tapi beda id TIDAK di-rekey diam-diam: dilaporkan di kartu Tim (pita "kembar").
- Kelola Kru hanya admin modul Office; tidak ada "tambah kru" (baris datang dari roster Office). Nama & login dikelola Office.
- Matriks role: baris pensiun (`bank`, `reports`) disembunyikan tapi ikut tersimpan; super_admin selalu Ubah. Dokumen settings/perms disimpan dengan GET hash dulu lalu PUT (`simpanDokumenKonten`).
- Publishing: tautan ↗ tidak digambar bila URL tersimpan `-`; kolom reach "Sudah tayang" dari angka per platform (lama `metrics.reach`, tak pernah ditulis).

## K. Daftar uji cutover
Uji silang Vue ↔ Office lama pada data yang sama (dev). Bagian #47:

- [ ] **dashboard** — 4 kartu sama angkanya dengan lama; Today's Schedule, Menunggu Approval, Tugas Saya (3 sumber, terlambat di atas), Top Konten.
- [ ] **planning** — tiap saringan (arsip, status, platform, pillar, PIC + hitungan, cari judul+detailing) memberi baris yang sama; status Posted saat saringan Aktif tetap menampilkan baris (F.2); Reset → Aktif.
- [ ] **pipeline** — seret kartu → status berubah dan terlihat di Office lama; masuk Approval membuat notifikasi.
- [ ] **calendar** — acara jatuh di tanggal yang benar (bandingkan dengan tanggal di data, bukan dengan sel lama yang bergeser sehari); geser tayang/produksi/tugas/kunjungan tersimpan.
- [ ] **detail** — mundur/lanjut status, minta revisi, batalkan, hapus, toggle kebutuhan produksi (doneAt), checklist, komentar + @mention (notifikasi ke yang disebut), tandai tayang (publishRecord); tiap aksi tampil sama di Office lama.
- [ ] **antrian (shooting/design/editing)** — baris konten + tugas mandiri (+ request Marketing di design/editing) sama dengan lama; arsip tersembunyi & jumlahnya; urut tiap kolom; Selesai/Buka mencap/menghapus `doneAt` dan terlihat di Office lama; tambah/edit/hapus tugas mandiri.
- [ ] **request Marketing** — buka request: brief + referensi gambar/link; Tandai Selesai → hilang dari antrian dan Marketing melihat status done; kru yang hanya memegang Konten: pita "tidak terbaca" muncul dan antrian tetap jalan; `design-options` terkirim sekali per sesi (cek di form Request Design Marketing: brand/kru muncul).
- [ ] **assets** — chip kategori, saring brand, kartu membuka link, tambah/edit/hapus tersimpan sama dengan lama.
- [ ] **approval** — kartu sama dengan lama; Approve final → status Scheduled + jejak "Final Review" + notifikasi; Tolak / revisi → status Revision + catatan; role tanpa `approve` melihat kalimat tunggu; lencana menu = jumlah Approval.
- [ ] **publishing** — Terjadwal (urut tanggal, lewat = merah) & Sudah tayang (10 terbaru) sama dengan lama; Tayang → publishRecord + Posted terlihat di Office lama.
- [ ] **input performa** — tab & hitungan sama; isi angka beberapa platform → tampil di Office lama (panel detail & Performa); pengisi pertama tidak tertimpa; kosongkan seluruh kotak satu platform → konfirmasi menyebut platform, lalu catatan platform itu terhapus (platform lain tetap).
- [ ] **performa konten & desain** — bandingkan kartu, per platform, pillar, top konten, jumlah post, desain per kategori, dan request Marketing dengan halaman lama untuk bulan yang sama; ganti bulan & platform; kru tanpa modul Marketing: pita "tidak terbaca".
- [ ] **KOL** — tambah/edit/hapus KOL & Medpar sama dengan lama; riwayat starting price bertambah hanya saat harga berubah; rate card gambar tampil & bisa dibesarkan; kunjungan: undangan terpilih bertahan saat penyaring diganti, DM WhatsApp/IG/TikTok berisi template, status kehadiran & Hadir/✕ hari-H, muncul di Kalender.
- [ ] **ads** — 4 kartu, sisa keseluruhan, rekap per bulan (iklan masuk bulan tanggal mulai; tanpa tanggal ke "Belum ada tanggal mulai") sama dengan lama; ekspor CSV bulan itu sama isinya; buat/edit iklan dengan rincian + PPN; link video tanpa https dirapikan, bukan-link ditolak; status otomatis berjalan sekali dan tidak menyentuh "Dijeda".
- [ ] **chats** — kartu, yang paling top, pita "chat tapi dana belum diisi", peringkat 3 urutan, per video & per platform sama dengan lama untuk bulan yang sama.
- [ ] **brands** — kartu & angka sama dengan lama; tambah/edit (platform + followers/target, pillar, PIC, tone) & hapus brand terlihat di Office lama; konten brand terhapus tetap ada.
- [ ] **activity** — 80 log terbaru, urutan & teks sama dengan lama.
- [ ] **settings** — nama organisasi tersimpan; 3 CSV & backup JSON sama isinya dengan ekspor lama; matriks role tersimpan dan berlaku di Office lama (bank/reports tidak hilang); Kelola Kru (role rangkap, kapasitas, skill) terlihat di lama; anggota Office baru muncul sebagai kru sesudah admin membuka Dashboard; pita kembar muncul untuk baris lama beda id.
- [ ] **profile** — role, Total task/Selesai/Kapasitas sama dengan lama; Keluar ke Office kembali ke beranda tanpa logout.
- [ ] **form konten** — buat & edit: platform/content type/print type multi, field tunggal lama ikut tertulis, keyword/caption/script lama tidak terhapus, referensi link+foto, rekomendasi tanggal produksi; konflik versi (dua tab) memunculkan pesan "Data sudah diubah orang lain".
