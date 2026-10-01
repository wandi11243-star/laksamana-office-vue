# Howandi Life OS — inventaris migrasi

Status: ⚠️ selesai dengan celah
Terakhir diperbarui: 2026-09-29

> **Triase 2026-09-29** — status di tabel E yang bertentangan dengan catatan ini: catatan ini yang berlaku.
> Rincian: [`_pertanyaan.md`](_pertanyaan.md), [`_gap-api.md`](_gap-api.md).
> - Reset data → K-01 (keputusan owner).

## Ringkasan
- Jumlah layar: 14 (2 layar detail tersembunyi dari menu: `projectDetail`, `bizDetail`) · Aksi backend lama: 4 (`ping`, `stats`, `getAll`, `saveAll`) · Gap v1: 0 ❌, 2 ⚠️ (bentuk simpan, reset massal)
- Howandi Life OS adalah OS pribadi Nahkoda (Howandi Chandra): satu dek berisi agenda, task, project, konten, goals, roadmap/mimpi, learning, evaluasi diri mingguan, kekayaan/aset, dan portofolio bisnis. Penggunanya hanya pemegang kunci `howandi_life` (sengaja TIDAK diberikan ke superadmin Howandi sendiri, `deploy/index.html:995`).
- Frontend lama menyimpan **seluruh state S sebagai satu blob** dan menyimpan lewat `saveAll` (debounce 400 ms) — tidak ada penjaga bentrok, "last save wins" (`howandi-life-mysql/README.md:94-101`).
- Risiko terbesar saat migrasi: (1) v1 tidak punya `saveAll`; setiap perubahan harus jadi CRUD per-record/`settings` dengan version-check, jadi pola simpan-debounce harus dibongkar; (2) `channels` dan `dump` adalah array string biasa (bukan objek ber-id) yang urutannya penting; (3) tombol Reset data massal tidak punya padanan satu-endpoint di v1.
- Kunci layar (lock-screen password) adalah gate sisi-browser murni; v1 menyimpannya di `settings/auth` tapi tidak menegakkannya.

## A. Sumber
| jenis | path | baris |
|---|---|---|
| frontend lama | laksamana-office/deploy/howandi_life/index.html | 1.000 |
| backend lama | laksamana-office/howandi-life-mysql/api.php (+ lib_hlife_mysql.php, README.md) | — |
| kontrak v1 | laksamana-api/docs/api/hlife.md | — |
| spec port | laksamana-api/docs/modules/hlife.md | — |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:14009-14014 "server menyajikan isi howandi_life/index.html — BERKASNYA TERTUKAR" | 14009-14014 |

## B. Akses
- Kunci Modul di launcher: `howandi_life`, dari `SUPER_BRANCHES` (bukan `BRANCHES`) di `deploy/index.html:2849`. Kartu khusus "Akses Nahkoda", `badge:'Akses Nahkoda'`.
- Gerbang modul di halaman: butuh grant `howandi_life`; SENGAJA bukan cek superadmin (`deploy/howandi_life/index.html:4-9`). Sesi kedaluwarsa / tanpa grant → `location.replace('../')`.
- Superadmin Howandi sendiri TIDAK diberi `howandi_life` (`deploy/index.html:995` — seed `u-howandi`, `modules: ALL_MODULE_KEYS_SEED().filter(k => k !== 'howandi_life')`).
- v1: `module:howandi_life`, superadmin tidak otomatis (`docs/api/hlife.md:6`).
- Di dalam modul tidak ada role/matriks izin: satu pengguna, semua boleh.
- Aksi khusus: aktifkan/nonaktifkan lock-screen (`settings/auth`), Reset data.

## C. Daftar layar (dari menu rail + openMoreMenu + dispatcher)

Sumber menu rail desktop `index.html:385-401`; tab bar HP `:832`; modal "Semua Modul" `openMoreMenu` `:833`; dispatcher `render()` `:584`.

| key | judul | subjudul | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| home | Command Center | "Satu halaman. Semua kondisi hari ini." | semua | tidak | `:386`, `:604` |
| calendar | Calendar | "Google Calendar = single source of truth untuk waktu." | semua | tidak | `:387`, `:735` |
| tasks | Tasks | "Task & Project tersambung — task yang sama, view berbeda. Filter per bisnis/project." | semua | tidak | `:389`, `:625` |
| projects | Project Center | "Klik project untuk lihat detail & task-nya. Drag kartu antar kolom." | semua | tidak | `:390`, `:646` |
| projectDetail | (nama project) | "… · Stage: … · … priority…" | via klik kartu | ya (bukan menu) | `:653-664`, `:584` |
| content | Content Pipeline | "Konten pribadi + side project. Pilih akun untuk fokus ke satu pipeline." | semua | tidak | `:391`, `:671` |
| goals | Goals <TAHUN> | "Target terukur (numerik) + deskripsi singkat." | semua | tidak | `:393`, `:684` |
| roadmap | Roadmap & Dreams | "Target karir & hidup per tahun, dan semua mimpi masa depan." | semua | tidak | `:394`, `:691` |
| learning | Learning & Refleksi | "Pelajaran dari buku, video, film, podcast — apa yang kamu ambil." | semua | tidak | `:395`, `:700` |
| reviews | Evaluasi Diri | "Review tiap minggu — recap otomatis per bulan." | semua | tidak | `:396`, `:709` |
| finance | Finance & Aset | "Kekayaan pribadi + bisnis, ledger bulanan, dan semua aset — di mana pun tersimpan." | semua | tidak | `:398`, `:748` |
| business | Businesses | "Howandi Chandra Inc. — klik untuk detail tiap anak perusahaan." | semua | tidak | `:399`, `:794` |
| bizDetail | (nama bisnis) | "… · berdiri … (… thn)" | via klik kartu | ya (bukan menu) | `:797-808`, `:584` |
| settings | Data, Sync & Login | "Penyimpanan, backup, integrasi Google Calendar, dan proteksi akses." | semua | tidak | `:401`, `:814` |

Tab bar HP hanya 5: Home, Kalender, Task, Content, Finance (`:832`). Sisanya lewat tombol "Menu" → `openMoreMenu` (`:833`).

## D. Detail per layar

### D.1 home — Command Center
- **Tampilan:** tanggal panjang (`dateStr`, `:602`); "◆ Fokus utama hari ini" (textarea auto-save `S.focus`); dua dial 5 segmen **Mood** & **Energi** (`:606`); panel Wealth Snapshot (Net Worth, Total Aset, Avg Rev/thn, Surplus bulan terakhir personal & bisnis, `:608`); Today's Calendar (event + deadline hari ini, `:609`); Target Minggu Ini (textarea `S.weeklyTarget` + gauge "Task selesai" `done/total`, `:610`); Top 5 Task (`:611`); Overdue (5 pertama, `:612`); Goal Progress (4 goal pertama, `:613`); Brain Dump / Quick Note (input + 6 item teratas, `:614`); Habit Hari Ini (tombol habit + streak api, `:615`); Roadmap <TAHUN> (milestone tahun ini, `:616`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | Task baru | buka modal Task | (lokal) | `POST /tasks` | `:604` |
  | Detail | pindah ke Finance | (lokal) | — | `:608` |
  | Buka | pindah ke Calendar | (lokal) | — | `:609` |
  | Semua task | pindah ke Tasks | (lokal) | — | `:611` |
  | Semua | pindah ke Goals | (lokal) | — | `:613` |
  | Simpan (Brain Dump) | `addDump()` → `S.dump.unshift(v)` | `saveAll` | `PUT /settings/dump` | `:614`, `:958` |
  | hapus (per item dump) | `rmDump(i)` → `S.dump.splice(i,1)` | `saveAll` | `PUT /settings/dump` | `:614`, `:959` |
  | habit (klik) | `toggleHabit()` | `saveAll` | `PUT /habits/{id}` | `:615`, `:960` |
  | Buka (Roadmap) | pindah ke Roadmap | (lokal) | — | `:616` |
  | segmen dial Mood/Energi | `setDial(k,v)` → `S[k]=v` | `saveAll` | `PUT /settings/{mood,energy}` | `:606`, `:957` |
- **Perhitungan di browser:** `netWorth()` = Σ aset bernilai (`liab ? -1 : 1` × value) (`:560`); `totalAssets()` = Σ value aset non-liab (`:561`); `totalLiab()` (`:562`); `bizRevTotal()` = Σ `business.revenue` (`:563`); `monthAgg(mk)` mengembalikan `{pi,pe,bi,be}` — personal bila `scope==='personal'`, sisanya dianggap bisnis (`:754`); surplus = `(pi-pe)*1e6` dan `(bi-be)*1e6` (angka ledger dalam JUTA rupiah, `:608`).
- **Catatan:** `focus` dan `weeklyTarget` disimpan pada event `input` (`:618-619`).

### D.2 calendar — Calendar
- **Tampilan:** banner integrasi Google Calendar + tombol Export .ics (`:736`); navigasi ‹ label › + "Hari ini" (`:737`); mode **1 Hari / 4 Hari / Minggu / Bulan** (`:738`); grid bulan (7 kolom Sen–Min) atau kolom hari (`:731-734`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | Event | buka modal Event | (lokal) | `POST /events` | `:735` |
  | Export .ics | `exportICS()` unduh `howandi-life-os.ics` | (lokal) | — | `:736`, `:574` |
  | Hari ini | `calRef=new Date()` | (lokal) | — | `:737` |
  | 1 Hari / 4 Hari / Minggu / Bulan | `setCalMode` | (lokal) | — | `:738` |
  | dblclick sel | `openEventModal(null, iso)` | (lokal) | `POST /events` | `:743` |
- **Perhitungan di browser:** `calItems(iso)` menggabungkan **event** + task ber-`due` belum selesai (prefiks "⏰ ") + konten ber-`date` yang belum `Posted` (prefiks "🎬 "), lalu diurutkan per jam (`:727`). Kalender dirakit **client-side** dari `events`, `tasks`, `content` (sesuai `docs/api/hlife.md`). `gcalDates`/`gcalLink` membangun URL Google Calendar (`:570-571`); `icsBlock`/`exportICS` membangun .ics (`:573-574`).
- **Catatan:** simpan event baru → `confirm('Event tersimpan. Tambahkan ke Google Calendar sekarang?')` (`:942`).

### D.3 tasks — Tasks
- **Tampilan:** 4 sub-view: **Matrix** (Eisenhower DO/SCHEDULE/DELEGATE/DELETE, `:633`), **Today** ("Hari ini & overdue", `:634`), **Minggu ini** ("7 hari ke depan"), **Per Bisnis** (`:635`). Filter dropdown "Semua bisnis" + "Semua project" (`:628-629`).
- **Aksi:** tombol "Task"/"Task baru" (`openTaskModal`); toggle done (klik `.chk`); edit; hapus; tombol Google Calendar per task ber-due (`:590`); Reset filter (`:630`).
- **Form & field Task** (`openTaskModal` `:859-867`, simpan `saveTask` `:870`):
  | field (nama data) | label UI | tipe | wajib | default / pilihan | validasi & pesan |
  |---|---|---|---|---|---|
  | name | Nama task | text | ya | — | `toast('Nama task wajib diisi')` |
  | desc | Detail / keterangan (opsional) | textarea | tidak | '' | — |
  | biz | Bisnis | select | tidak | "— Tanpa bisnis —" + `S.businesses[].name` | — |
  | project | Project | select | tidak | "— Tanpa project —" + `projOptions()` | — |
  | owner | Owner / PIC | text | tidak | '' | — |
  | due | Deadline | date | tidak | '' | — |
  | est | Estimasi (menit) | number | tidak | 0 | — |
  | important | Penting | toggle | tidak | **true** (task baru) | — |
  | urgent | Mendesak | toggle | tidak | false | — |
- **Perhitungan di browser:** `quadrant(t)` = important+urgent→DO, important→SCHEDULE, urgent→DELEGATE, else DELETE (`:553`); `isOverdue` = due & !done & due<hari ini (`:554`); `fmtDue` = "Hari ini"/"Besok"/"Kemarin"/"Nh lewat"/tanggal (`:555`).
- **Catatan aturan:** `projOptions(cur)` **menyembunyikan project stage 'Done'**, KECUALI project yang sedang terpasang di task yang disunting (ditandai "· selesai") — tanpa ini, membuka task lama melepas project-nya diam-diam (`:837-849`).

### D.4 projects — Project Center
- **Tampilan:** Kanban 8 kolom `STAGES = ['Idea','Planning','Research','Ready','Doing','Waiting','Review','Done']` (`:644`); kartu menampilkan bisnis, priority tag, due, jumlah task, PIC, mini-gauge progress (`:649`).
- **Aksi:** "Project" (modal baru); drag & drop kartu antar kolom → `dropProj` (set stage; bila `Done` → `progress=100`, `:652`); klik kartu → `projectDetail`.
- **Form & field Project** (`openProjModal` `:875-883`, `saveProj` `:884`):
  | field | label UI | tipe | wajib | default / pilihan | validasi |
  |---|---|---|---|---|---|
  | name | Nama project | text | ya | — | `toast('Nama wajib diisi')` |
  | desc | Deskripsi singkat | textarea | tidak | '' | — |
  | biz | Bisnis | select | tidak | "—" + businesses | — |
  | priority | Prioritas | select | tidak | High/Med/Low | — |
  | pic | PIC (penanggung jawab) | text | tidak | '' | — |
  | team | Tim terlibat | text | tidak | '' | — |
  | stage | Stage | select | tidak | STAGES | — |
  | due | Deadline | date | tidak | '' | — |
  | progress | Progress manual (0–100) | range | tidak | 0 | — |
- **Perhitungan:** `projProgress(p)` = bila ada task → `round(done/total*100)`, else `p.progress||0` (`:565`).
- **Catatan aturan:** stage **'Archive' DICABUT** 19 Agu 2026 dan dilebur ke 'Done' (project lama dipindah oleh `migrate()`, `:521-525`, `:638-643`).

### D.5 projectDetail — detail project (tersembunyi)
- **Tampilan:** deskripsi; PIC, Tim, Task selesai `done/total`; Progress (otomatis dari task bila ada); Deadline + tombol Google Calendar; daftar task project ini (`:657-664`).
- **Aksi:** "Semua project" (kembali); "Edit"; "Task ke project ini" (prefill `{project, biz}`); toggle/edit/hapus task.
- **Bukti:** `:654-665`.

### D.6 content — Content Pipeline
- **Tampilan:** chips filter akun ("Semua akun" + `S.channels`, `:672`); Kanban `CSTAGES = ['Idea','Script','Shoot','Editing','Scheduled','Posted']` (`:668`); kartu menampilkan platform, tanggal, channel (`:675`).
- **Aksi:** "Kelola akun" (modal channels); "Konten" (modal baru); drag antar kolom (`dropContent`); klik kartu → edit; hapus; "+ GCal" bila ada tanggal (`:894`).
- **Form & field Konten** (`openContentModal` `:888-894`, `saveContent` `:895`):
  | field | label UI | tipe | wajib | default / pilihan |
  |---|---|---|---|---|
  | title | Judul / ide | text | ya | — |
  | channel | Akun | select | tidak | `S.channels` |
  | platform | Platform | select | tidak | Instagram/TikTok/YouTube/LinkedIn/Threads/Newsletter/Podcast |
  | stage | Stage | select | tidak | CSTAGES |
  | date | Tanggal publish | date | tidak | '' |
  | notes | Catatan (hook / angle) | textarea | tidak | '' |
  - Validasi: `toast('Judul wajib diisi')`.
- **Form channels** (`openChannelsModal` `:897`, `saveChannels` `:898`): textarea "Satu akun per baris" → `split('\n').map(trim).filter(Boolean)`; bila filter aktif tidak lagi ada, `contentFilter='all'`.

### D.7 goals — Goals
- **Tampilan:** kartu per goal: nama, area tag, persen, deskripsi, tautan milestone (jika ada), gauge, Sekarang vs Target, tombol Update/hapus (`:685`).
- **Form & field Goal** (`openGoalModal` `:901-902`, `saveGoal` `:903`):
  | field | label UI | tipe | wajib | default / pilihan |
  |---|---|---|---|---|
  | name | Nama goal | text | ya | — |
  | desc | Deskripsi singkat | text | tidak | '' |
  | cur | Nilai sekarang | number | tidak | 0 |
  | target | Target | number | tidak | 100 |
  | unit | Satuan | text | tidak | '' |
  | area | Area | select | tidak | Finance/Health/Content/Learning/Business/Family/Spiritual/Travel/Relationship |
  | milestone | Terhubung ke milestone (Roadmap) | select | tidak | `roadmapOptions()` |
- **Perhitungan:** `goalPct(g)` = `clamp(0..100, round(cur/target*100))`; bila `g.invert` → `clamp(round((start-cur)/(start-target)*100))` (`:557`). Area Health/Learning memakai gauge hijau (`:591`).

### D.8 roadmap — Roadmap & Dreams
- **Tampilan:** toggle **Roadmap** (timeline per tahun) / **Dreams** (per kategori) (`:692`).
  - Timeline: tahun + `done/total`; per milestone: judul, deskripsi, persen (dari goal terkait), daftar goal terkait, tag mimpi terkait (`:695`).
  - Dreams: dikelompokkan `DREAM_CAT` = Travel/Education/Career/Experience/Other dengan ikon & warna (`:689`, `:696`).
- **Form Milestone** (`openMileModal` `:907-908`, `saveMile` `:909`): title "Milestone (target karir/hidup)" (wajib, pesan `toast('Isi milestone dulu')`), desc, year (default `THISYEAR+1`). Toggle done `toggleMile` (`:910`).
- **Form Mimpi** (`openDreamModal` `:912-913`, `saveDream` `:914`): title "Mimpi / bucket list" (wajib, `toast('Isi mimpinya dulu')`), cat (DREAM_CAT), status Someday/Planning/Done, year (opsional; disimpan sebagai angka atau string apa adanya), note, milestone. `toggleDream` membalik Planning↔Done (`:915`).
- **Perhitungan:** `milestoneProgress(r)` = rata-rata `goalPct` goal terkait, else `r.done?100:0` (`:724`).

### D.9 learning — Learning & Refleksi
- **Tampilan:** banner "N selesai · N total" (`:701`); kartu per catatan: judul, tipe·sumber·status, bintang rating, takeaway (`:702`).
- **Form & field** (`openLearnModal` `:919-920`, `saveLearn` `:921`):
  | field | label UI | tipe | wajib | default / pilihan |
  |---|---|---|---|---|
  | title | Judul | text | ya | — |
  | type | Tipe | select | tidak | Buku/Video/Film/Podcast/Artikel/Course |
  | source | Sumber / penulis | text | tidak | '' |
  | status | Status | select | tidak | Sedang/Selesai |
  | rating | Rating (0–5) | number | tidak | 0 (diklem 0..5) |
  | take | Key takeaway / refleksi | textarea | tidak | '' |
  | date | (tersembunyi) | — | tidak | `todayISO()` untuk baru; lama dipertahankan |
  - Validasi: `toast('Judul wajib diisi')`.

### D.10 reviews — Evaluasi Diri
- **Tampilan:** toggle **Mingguan** / **Recap Bulanan** (`:709`). Mingguan: per minggu 4 skor (Konten/Bisnis/Project/Personal) + "Yang berhasil" + "Perbaiki" (`:712`). Recap: rata-rata per bulan (1 desimal) + highlight + fokus perbaikan (`:713`).
- **Form & field** (`openReviewModal` `:925-927`, `saveReview` `:929`):
  | field | label UI | tipe | wajib | default |
  |---|---|---|---|---|
  | weekStart | Minggu (pilih tanggal mana saja di minggu itu) | date | ya | `weekKey(now)` |
  | sContent/sBusiness/sProject/sPersonal | Skor Konten/Bisnis/Project/Personal (1–5) | number | tidak | 3 (diklem 1..5 via `clamp5` `:928`) |
  | wins | Yang berhasil minggu ini | textarea | tidak | '' |
  | improve | Yang perlu diperbaiki | textarea | tidak | '' |
- **Perhitungan:** `weekStart(d)` → Senin minggu itu (`:717`); `weekKey(d)` → tanggal Senin `en-CA` (`:718`); `monthOfWeek(ws)` = 7 karakter pertama (`:719`); `fmtWeek` = "d Mmm – d Mmm YYYY" (`:720`). Recap `avg` = `round(Σ/n*10)/10` (`:713`).
- **Catatan:** menyimpan minggu yang sama menimpa baris yang ada (bukan menambah) — `saveReview` mencari `weekStart` yang sama (`:929`).

### D.11 finance — Finance & Aset
- **Tampilan:** toggle **Ringkasan** / **Bulanan** / **Aset & Utang** (`:749`).
  - Ringkasan: Net Worth, Total Aset, Total Utang; Komposisi Aset (per kategori, % dari total); Cashflow bulan terakhir (`:759-765`).
  - Bulanan: input per bulan — Personal (Pemasukan/Pengeluaran/Catatan) + per bisnis (masuk/keluar); tombol "Simpan <bulan>"; riwayat per bulan dengan tabel ledger (Untuk/Masuk/Keluar/Surplus) (`:768-784`).
  - Aset & Utang: daftar aset dengan kategori, qty/unit, lokasi, nilai; baris Net Worth di bawah (`:789-790`).
- **Form & field Aset** (`openAssetModal` `:933-934`, `saveAsset` `:936`):
  | field | label UI | tipe | wajib | default / pilihan |
  |---|---|---|---|---|
  | name | Nama aset | text | ya | — |
  | cat | Kategori | select | tidak | `ASSET_CATS` (`:746`) |
  | loc | Lokasi / di mana | text | tidak | '' |
  | qty | Jumlah / berat (opsional) | number | tidak | 0 |
  | unit | Satuan | text + datalist | tidak | gram/kg/hektar/m²/unit/% saham/lot/lembar/koin |
  | value | Nilai / total (Rp) | number | tidak | — |
  | liab | Jenis: Aset / Utang | toggle | tidak | false; memilih Utang memaksa kategori "Utang" (`setLiab` `:935`) |
  - Validasi: `toast('Nama wajib diisi')`.
- **Perhitungan di browser:** semua angka ledger dalam **JUTA Rupiah**; `upsertLed` menghapus baris bila income=0 & expense=0 & note kosong (`:786`); `monthAgg` (`:754`); `scopeLabel` memetakan `personal`→"Personal", `__umum`→"Bisnis (umum)", else nama bisnis (`:753`). `fmtRp` (`:556`).
- **Catatan:** bisnis dengan 0/0 tidak dicatat ("otomatis tidak dicatat", `:779`).

### D.12 business — Businesses
- **Tampilan:** kartu per bisnis: nama, bidang/area, tahun berdiri, Avg Rev/thn, jumlah Task & Project, umur berdiri (`:795`).
- **Form & field Bisnis** (`openBizModal` `:946-947`, `saveBiz` `:948`): name (wajib), field "Bidang / bergerak di", founded (number), desc, revenue "Avg Revenue / tahun (Rp)", area (Business/Content/Finance/Investment/CEO/Social/Travel). `delBiz` menegaskan task & project tidak ikut terhapus (`:949`).

### D.13 bizDetail — detail bisnis (tersembunyi)
- **Tampilan:** deskripsi, Avg Revenue/tahun, daftar Project + progress, daftar Task aktif (`:801-808`).
- **Aksi:** "Semua bisnis"; "Edit bisnis".

### D.14 settings — Data, Sync & Login
- **Tampilan:** panel Login & Password (status on/off, "Login aktif. App akan minta password tiap dibuka."); Penyimpanan & Backup; penjelasan 3 cara integrasi Google Calendar (`:816-825`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | Ganti password / Aktifkan login | `openPwModal` | `saveAll` | `PUT /settings/auth` | `:817`, `:952` |
  | Nonaktifkan login | `disableAuth()` → `S.auth={enabled:false,hash:''}` | `saveAll` | `PUT /settings/auth` | `:817`, `:954` |
  | Backup JSON | `exportJSON()` unduh `howandi-life-os-backup.json` | (lokal, dari S) | `GET /state` | `:820`, `:828` |
  | Export .ics | `exportICS()` | (lokal) | — | `:820` |
  | Reset data | `resetAll()` konfirmasi → `emptyState()` (auth dipertahankan) | `saveAll` | ⚠️ tidak ada 1 endpoint | `:820`, `:829` |
- **Form password** (`:952`): pw1 "Password baru" (min 4 → `toast('Password minimal 4 karakter')`), pw2 "Ulangi password" (harus sama → `toast('Password tidak sama')`). Hash SHA-256 via `crypto.subtle`, fallback djb2 berprefiks `f` (`:486`).
- **Catatan:** lock-screen bukan keamanan sungguhan — diakui di UI sendiri (`:818`: "kunci sisi-browser… tambahkan auth di server").

### D.15 Lock screen (di luar menu)
- Gate saat `S.auth.enabled`: `#lock` ditampilkan, `tryUnlock()` bandingkan hash; salah → `'Password salah. Coba lagi.'` (`:487`, `:998`). Password benar → `unlocked=true` → `bootApp()`.

## E. Pemetaan backend

Legacy hanya punya 4 action (`howandi-life-mysql/README.md:36-41`); frontend memanggil `getAll` (GET) & `saveAll` (POST `text/plain`) dengan `token` (`:461-482`). `saveAll` di-debounce 400 ms dan di-serialkan (tidak ada simpan berbarengan) (`:540-548`).

| action lama | dipakai di layar | baca/tulis | endpoint v1 | status | catatan |
|---|---|---|---|---|---|
| `ping` | — (diagnostik) | baca | — (Laravel health) | ✅ | `GET /api/v1/hlife/state`/`/stats` cukup |
| `stats` | — | baca | `GET /stats` | ✅ | |
| `getAll` | boot semua layar | baca | `GET /state` (+ resource granular) | ✅ | v1 `/state` mengembalikan state sama + default settings |
| `saveAll` | SEMUA tulis (task, project, konten, goal, milestone, mimpi, learning, review, event, aset, bisnis, ledger, channels, dump, auth, mood, energy, focus, weeklyTarget, habit) | tulis | `POST/PUT/PATCH/DELETE /{resource}[/{id}]` + `PUT /settings/{key}` | ⚠️ | v1 **granular + version-check**, bukan blob. Setiap layar harus dipecah jadi satu panggilan per record; debounce-blob dihapus. Perlu kirim `If-Match`/`?version` dari hash. |
| (Reset data) | settings | tulis (hapus massal) | ⚠️ tidak ada | ⚠️ | `resetAll` (`:829`) mengosongkan semua koleksi. Di v1 tak ada endpoint reset; harus DELETE per record. Lihat `_pertanyaan.md`. |

Konkurensi: legacy **tanpa** penjaga bentrok, last-write-wins (`howandi-life-mysql/README.md:94-101`). v1 memakai hash 16 hex pertama sha1 dari JSON tersimpan; `428 version_required` bila tak dikirim, `409 version_conflict` bila basi (dengan nilai hidup di `error.details.current`). Kode error v1 yang wajib ditangani UI: `unauthenticated`, `module_not_granted`, `not_found`, `version_required`, `version_conflict`, `already_exists` (`docs/api/hlife.md:70-77`).

## F. Aturan bisnis yang wajib dibawa
1. **`channels` & `dump` adalah array string, urutannya penting** — kenapa: `dump` newest-first (`unshift`), `channels` urutan tampil; kalau dipaksa jadi objek ber-id, isinya hilang — bukti: `howandi-life-mysql/README.md:75-79`, `index.html:958-959`.
2. **`finance` hanya pembungkus `{ledger:[…]}`** — yang punya tabel adalah `ledger` — bukti: `README.md:80-81`, `index.html:510`.
3. **Angka ledger dalam JUTA rupiah** — semua tampilan mengalikan `*1e6` — bukti: `index.html:608`, `:764`.
4. **`auth` = `{enabled, hash}` SHA-256**, tidak dipetakan ke kolom inti — bukti: `README.md:82-83`, `index.html:486`.
5. **Project stage 'Archive' dicabut, dilebur ke 'Done'** — project lama dipindah di `migrate()` — bukti: `index.html:521-525`, `:638-643`.
6. **Project 'Done' tidak menerima task baru**, kecuali project yang sedang terpasang di task yang disunting — kenapa: mencegah task lepas diam-diam saat membuka form — bukti: `index.html:837-849`.
7. **Menyimpan review minggu yang sama menimpa**, tidak menambah baris — bukti: `index.html:929`.
8. **JSON selalu di-decode tanpa assoc** (objek kosong tetap `{}`) — pelajaran dari modul HR — bukti: `README.md:85-92`.
9. **Simpan = menimpa seluruh state (last-write-wins), dua tab bisa saling menimpa** — perilaku LAMA yang SENGAJA diperbaiki di v1 (version-check) — bukti: `README.md:94-101`, `docs/api/hlife.md:16`.

## G. Ketergantungan lintas modul
- Gerbang sesi: membaca `localStorage['lm_session']` dari Office (`:7`, `:976`); tanpa grant → kembali ke Office (`:9`). Keluar = `location.replace('../')` tanpa menghapus sesi (`:966`).
- Token backend `HL-…` sama dengan `API_TOKEN` di `howandi-life-mysql/config.php` (`:462-467`).
- Tidak ada baca/tulis ke database modul lain. Modul ini mandiri (DB `lakk5493_db_hlife`).
- Ikon/logo memakai `../assets/LaksamanaMudaLogo.jpeg` (`:12`).

## H. Catatan untuk implementasi Vue
- Halaman: `app/pages/hlife/index.vue` (Command Center) + sub-halaman `hlife/tasks.vue`, `hlife/projects.vue`, `hlife/content.vue`, `hlife/goals.vue`, `hlife/roadmap.vue`, `hlife/learning.vue`, `hlife/reviews.vue`, `hlife/finance.vue`, `hlife/business.vue`, `hlife/settings.vue`, `hlife/calendar.vue`. `definePageMeta({ access: ['howandi_life'] })`.
- Composable `useHlife.ts` (fungsi → endpoint):
  - `useHlifeState()` → `GET /state`; `useHlifeResource(res)` → `GET /{res}`; `useHlifeStats()` → `GET /stats`.
  - `createRecord(res, body)` → `POST /{res}`; `updateRecord(res, id, body, version)` → `PUT /{res}/{id}`; `patchRecord` → `PATCH`; `deleteRecord(res, id, version)` → `DELETE`.
  - `useHlifeSetting(key)` → `GET /settings/{key}`; `saveSetting(key, value, version)` → `PUT /settings/{key}`.
  - Kirim version sebagai `If-Match: "<version>"` (atau `?version=`), tangani `409 version_conflict` dengan memuat ulang nilai dari `error.details.current`.
- HP vs desktop: ganti Kanban drag-drop jadi `AppList` berkelompok per stage di HP (drag-drop tidak andal di sentuh); `UTable` untuk tabel ledger di desktop. Form semua lewat `ResponsiveSheet` (Task, Project, Konten, Goal, Milestone, Mimpi, Learning, Review, Aset, Event, Bisnis, Channels, Password).
- Widget Beranda yang cocok: "Fokus & mood hari ini", "Top 5 task", "Overdue", "Habit hari ini", "Wealth snapshot" — sebagai `AppList` ringkas.
- Elemen lama yang melanggar DESIGN.md → padanannya:
  - **Grid kartu berisi angka besar** (Wealth Snapshot, dashboard) → `AppList` berkelompok + satu `AppFocus`.
  - **Label huruf kapital mono** ("PERSONAL (JUTA RP)", `:774`) → label `text-muted` sentence case.
  - **Emoji sebagai ikon** ("🎯", "🎬", "⏰", "✦", "🔥") → Lucide (`i-lucide-*`).
  - **Titik warna dekoratif** (`<span class="dot" style="background:…">`) → hapus; status pakai `AppStatus`.
  - **Aksen brass/emas + gauge berwarna** → token warna DESIGN.md; kuning hanya untuk aksi utama.
  - **Gate password sisi-browser** → hapus; v1 sudah Bearer + `module:howandi_life`.
- Simpan: hilangkan debounce `saveAll`; pakai simpan per-record dengan version (mis. simpan saat sheet ditutup).

## I. Pertanyaan terbuka
- [ ] **hlife / settings — Reset data** — v1 tidak punya endpoint pengosongan massal; haruskah UI menyediakan "Reset data" (DELETE per record) atau tombol itu dibuang saja? Konteks: legacy `resetAll` (`index.html:829`) mengosongkan 13 koleksi sekaligus, mempertahankan `auth`. Bukti: `index.html:829`, `docs/api/hlife.md` (tak menyebut reset). Opsi: A) buang tombolnya; B) implementasi loop DELETE per record; C) minta endpoint khusus di API. (juga disalin ke `_pertanyaan.md`)
  → Dijawab K-01 = C: tombol tampil **"Segera"** sampai `POST /hlife/admin/reset` (G-13) ada.

## J. Progres build
Branch: migrasi/hlife · Mulai: 2026-10-01
LANJUTKAN DARI: —

Catatan integrasi: `app/utils/modul-shell.ts` TIDAK ikut diedit (bukan milik agen hlife). Selama pemilik
file itu belum mendaftarkan entri `hlife`, sidebar tetap sidebar Office; karena itu Command Center
menampilkan daftar layar sebagai jalan masuk semua halaman.

| layar (key) | file | status | endpoint dipakai | ditunda karena |
|---|---|---|---|---|
| home | `app/pages/hlife/home.vue` | ✅ | `GET /state`, `GET /settings`, `PUT /settings/{mood,energy,focus,weeklyTarget,dump}`, `PUT /habits/{id}` | — |
| calendar | `app/pages/hlife/calendar.vue` | ✅ | `GET /events`, `GET /tasks`, `GET /content`, `POST/PUT/DELETE /events/{id}` | — |
| tasks | `app/pages/hlife/tasks.vue` | ✅ | `GET/POST/PUT/PATCH/DELETE /tasks`, `GET /businesses`, `GET /projects` | — |
| projects | `app/pages/hlife/projects.vue` | ✅ | `GET/POST/PUT/DELETE /projects`, `GET /tasks`, `GET /businesses` | — |
| projectDetail | `app/pages/hlife/projects/[id].vue` | ✅ | `GET /projects/{id}`, `GET /tasks`, `GET /businesses`, `POST/PUT/DELETE /tasks` | — |
| content | `app/pages/hlife/content.vue` | ✅ | `GET/POST/PUT/DELETE /content`, `GET/PUT /settings/channels` | — |
| goals | `app/pages/hlife/goals.vue` | ✅ | `GET/POST/PUT/DELETE /goals`, `GET /roadmap` | — |
| roadmap | `app/pages/hlife/roadmap.vue` | ✅ | `GET/POST/PUT/DELETE /roadmap`, `GET/POST/PUT/PATCH/DELETE /dreams`, `GET /goals` | — |
| learning | `app/pages/hlife/learning.vue` | ✅ | `GET/POST/PUT/DELETE /learning` | — |
| reviews | `app/pages/hlife/reviews.vue` | ✅ | `GET/POST/PUT/DELETE /reviews` | — |
| finance | `app/pages/hlife/finance.vue` | ✅ | `GET/POST/PUT/DELETE /assets`, `GET/POST/PUT/DELETE /ledger`, `GET /businesses` | — |
| business | `app/pages/hlife/business.vue` | ✅ | `GET/POST/PUT/DELETE /businesses`, `GET /tasks`, `GET /projects` | — |
| bizDetail | `app/pages/hlife/business/[id].vue` | ✅ | `GET /businesses/{id}`, `GET /tasks`, `GET /projects` | — |
| settings | `app/pages/hlife/settings.vue` | ✅ | `GET /state` (backup JSON & .ics) | Reset data: **K-01 / G-13** (tombol "Segera") |
