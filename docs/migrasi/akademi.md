# Akademi — inventaris migrasi

Status: ✅ selesai
Terakhir diperbarui: 2026-09-29

## Ringkasan
- Jumlah layar: 13 (0 tersembunyi dari menu; 6 di antaranya khusus admin, 1 untuk manager+) · Aksi backend lama: 6 (`ping`, `stats`, `getAll`, `saveAll`, `trainingStats`, `uploadReceipt`/`receipt`) · Gap v1: 0 ❌
- Akademi adalah platform training kru: materi (video/modul/SOP/menu baru/kuis) per divisi, program bulanan (refresher wajib diulang), progress & sertifikat, struktur organisasi, dan dashboard admin. Penggunanya seluruh kru; halaman Kontrol hanya admin modul Akademi.
- Identitas **100% dari Office (SSO)** — tidak ada login/PIN lokal; roster kru ditarik dari Office dan kru di luar roster dinonaktifkan (bukan dihapus).
- Risiko terbesar saat migrasi: (1) legacy menyimpan satu blob raksasa dengan `saveAll` yang **menghapus baris yang tidak ada di payload** dan penjaga bentrok `baseUpdatedAt` → `bentrok[]`; v1 menggantinya dengan CRUD per-record + version, jadi pola stamp/snapshot/blob harus dibongkar; (2) progress & progProg adalah peta bersarang `progress[uid][mid]` / `progProg[uid][pid][mid]` yang di v1 menjadi sel ber-komposit; (3) perhitungan sertifikasi (`isDone`, `userStats`) harus disalin persis.

## A. Sumber
| jenis | path | baris |
|---|---|---|
| frontend lama | laksamana-office/deploy/akademi/index.html | 1.890 |
| backend lama | laksamana-office/akademi-mysql/api.php | — |
| kontrak v1 | laksamana-api/docs/api/akademi.md | — |
| spec port | laksamana-api/docs/modules/akademi.md | — |
| catatan CLAUDE.md lama | — (grep `akademi`/`training`/`materi`/`sertifik` di CLAUDE.md: TIDAK DITEMUKAN (dicari: `^#.*akademi\|training\|materi\|sertifik`) ) | — |

## B. Akses
- Kunci Modul di launcher: `akademi` (`deploy/index.html:1145`, `access:['akademi']`).
- Gerbang halaman: `readLmSession()` butuh `lm_session` valid dan modul `*` atau `akademi` (`index.html:618-623`).
- **Admin modul** = `adminModules` sesi Office mengandung `*` atau `akademi` (`index.html:1854`). Peran internal `'admin'` di DB **tidak lagi** memberi menu admin (`index.html:598-599`).
- **Manager** = admin modul, atau user dengan `role==='manager'` (PIC divisi) (`index.html:601`).
- Matriks izin per halaman (`canView`, `:602-610`): `ADMIN_VIEWS = ['anjungan','kelolaMateri','kelolaProgram','kelolaKru','log','sync']` hanya admin; `tim` untuk manager+; sisanya semua kru. Ditegakkan di `render()` (`:903`), bukan sekadar menyembunyikan tombol.
- v1: baca = pemegang modul; tulis record & dokumen = **admin modul** (`docs/api/akademi.md:6`).

## C. Daftar layar (dari navSections + views)

Sumber menu `navSections()` `:836-861`; dispatcher `render()` `:897-904`.

| key | judul | subjudul | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| dashboard | Beranda | "Halo, <nama>" / "<divisi>, …" | semua | tidak | `:839`, `:908` |
| materi | Materi Saya | "Materi training untuk <divisi> + materi semua divisi" | semua | tidak | `:840`, `:950` |
| program | Program Bulanan | "Training baru & refresher tiap bulan, standar dijaga terus, bukan sekali jalan" | semua | tidak | `:841`, `:1452` |
| perpus | Perpustakaan | "Semua materi training lintas divisi, belajar apa pun, kapan pun. Materi di luar divisimu terbuka dalam Mode Baca." | semua | tidak | `:842`, `:1807` |
| struktur | Struktur Organisasi | admin: "Susun divisi & jalur komando…"; non-admin: "Kenali jalur komando kapal & PIC divisimu" | semua (tombol edit admin) | tidak | `:845`, `:1567` |
| sertifikat | Progress & Sertifikat | "Jejak trainingmu di Akademi Laksamana" | semua | tidak | `:846`, `:1135` |
| tim | Progress Tim | admin: "Seluruh kru kapal"; else nama divisi | manager+ | tidak | `:849`, `:1164` |
| anjungan | Anjungan | "Pusat kendali training, kondisi standar kru secara keseluruhan" | admin | tidak | `:852`, `:1197` |
| kelolaMateri | Kelola Materi | "Tambah / edit video, modul, SOP, menu baru, dan kuis" | admin | tidak | `:853`, `:1246` |
| kelolaProgram | Kelola Program | "Susun training bulanan: materi baru + refresher lama…" | admin | tidak | `:854`, `:1486` |
| kelolaKru | Kelola Kru | "Divisi dan peran kru. Akun & login dikelola di Office." | admin | tidak | `:855`, `:1367` |
| log | Log Aktivitas | "Jejak audit training (500 terakhir)" | admin | tidak | `:856`, `:1235` |
| sync | Sinkronisasi & Backup | "Data akademi tersimpan di database server, dipakai bersama semua device" | admin | tidak | `:857`, `:1744` |

Tab bar HP = 5 item pertama dari menu yang boleh dibuka (`:892-895`).

## D. Detail per layar

### D.1 dashboard — Beranda
- **Tampilan:** 4 kartu statistik: **Materi Wajib Selesai** (`mandPct`%), **Total Materi Selesai** (`done/total`), **Wajib Selesai** (`mandDone/mandTotal`), status sertifikasi (ikon medal/hourglass + "Tersertifikasi"/"Belum Sertifikasi") (`:915-919`). Kartu program bulan berjalan (`p.bulan===currentMonthKey()`) dengan progress (`:920-923`). "Materi Wajib yang Belum Selesai" (≤6 kartu) atau kartu "Semua materi wajib selesai" (`:924-930`). "Materi Terbaru" (3 terbaru per `createdAt`) (`:931`).
- **Aksi:** "Buka Program" → `go('program')`; klik `matCard` → `openMaterial`.
- **Perhitungan:** `userStats(u)` (`:752-761`) — lihat §D.14.
- **Catatan:** "Semua materi wajib selesai" memakai latar gradien gelap (`:928`) → melanggar DESIGN.md.

### D.2 materi — Materi Saya
- **Tampilan:** chip filter **tipe** (Semua Tipe + 5 TYPES) dan **kategori** (Semua Kategori + 5 CATS) (`:958-967`); grid kartu materi (`:969`).
- **Filter:** `matFilter={type,cat}` (`:948`); daftar = `matsForUser(u)` (published + divisi cocok) (`:951`).
- **Aksi:** klik kartu → `openMaterial(id)`; chip → `setMatFilter` (`:949`).
- **Catatan:** kosong → "Belum ada materi di filter ini." (`:968`).

### D.3 Material viewer (modal, dipakai dari materi/perpus/program)
- **Tampilan per tipe** (`openMaterial` `:984-1042`):
  - `modul` → `<div class="modul-body">` isi teks + tombol selesai.
  - `video` → iframe YouTube (`ytId` `:979-983`) atau link; deskripsi; tombol "Saya sudah menonton video ini sampai selesai".
  - `sop` → langkah-langkah sebagai checkbox; tombol ack aktif hanya bila semua dicentang (`sopCheck` `:1048-1052`); label tombol: "Saya sudah membaca, paham, dan berkomitmen menjalankan SOP ini".
  - `menu` → hero menu (kategori, nama, harga, deskripsi), kv Komposisi/Alergen/Catatan Ops, "Selling Script (hafalkan gayanya, bukan kata per kata)"; tombol "Saya sudah mempelajari produk ini (komposisi, alergen, script)".
  - `quiz` → intro kuis (lihat D.4).
- **Mode Baca:** materi di luar divisi user → banner "Mode Baca, materi ini milik divisi lain. Kamu bebas mempelajarinya, tapi tidak masuk hitungan progress/sertifikasimu." (`:999`), dan tombol selesai disembunyikan (`doneBtn` `:1043-1047`).
- **Aksi selesai:** `completeMaterial(id)` → `setProg(...,{status:'done',completedAt})`, bila dari program → `markProgDone`, `logAct('selesai',…)`, toast "Materi selesai. Kerja bagus, Pelaut!"; bila jadi tersertifikasi → toast "Semua materi wajib selesai, kamu tersertifikasi." (`:1053-1062`).
- **Bukti:** `:984-1062`.

### D.4 Kuis (modal)
- **Intro** (`renderQuizIntro` `:1066-1080`): jumlah soal, "Nilai Lulus" (`m.passing||DB.settings.passingDefault`), percobaan & skor terakhir. Tombol "Mulai Kuis"/"Ulangi Kuis" atau, di Mode Baca, "Coba Kuis (Mode Latihan, skor tidak disimpan)".
- **Pengerjaan** (`startQuiz` `:1081-1093`): radio per opsi; "Kumpulkan Jawaban".
- **Validasi:** "Masih ada soal yang belum dijawab" (`:1105`).
- **Perhitungan:** `score = round(correct/total*100)`; `passed = score>=passing` (`:1106-1110`). Simpan: `attempts+1`, `score`, `passed` (pernah lulus tetap lulus: `passed||p.passed===true`), `lastAt`, `completedAt` bila lulus (`:1113`).
- **Hasil** (`:1117-1131`): skor, `correct/total`, badge LULUS/"Pelajari lagi materinya, lalu ulangi. Kamu pasti bisa.", review jawaban (menandai jawaban benar). Mode latihan tidak disimpan.
- **Catatan:** di program bulanan, item yang sudah lulus dulu tetap ditandai "Refresher" dan harus dikerjakan ulang (`:1069`, `:1472`).

### D.5 program — Program Bulanan
- **Tampilan:** kartu per program (urut `bulan` desc); status: "Tidak ada item divisimu" / "Tuntas" / "Lewat deadline, segera selesaikan" / "Berjalan" (bulan ini) / "Arsip" (`:1463-1466`); progress; daftar item dengan tombol "Kerjakan" (`:1470-1479`).
- **Perhitungan:** `programUserStats(u,p)` = `done/total` dari `progMatsForUser` (`:1440-1444`); `over = deadline 23:59:59 < now` (`:1460`).
- **Bukti:** `:1452-1483`.

### D.6 perpus — Perpustakaan
- **Tampilan:** input "Cari judul materi…" (live `perpusSearch`), chip divisi + tipe; grid hasil + "N materi ditemukan" (`:1807-1845`).
- **Filter:** `perpusFilter={q,div,type}` (`:1804`); hanya `published`; materi luar divisi ditandai "Mode Baca" (`:1839`).
- **Bukti:** `:1807-1845`.

### D.7 struktur — Struktur Organisasi
- **Tampilan:** kartu "Nahkoda & Manajemen Pusat" (user `role==='admin'` atau `division==='all'`); per divisi: jumlah orang + materi, PIC (`role==='manager'`), kru (`role==='staff'`), persen wajib (`:1571-1596`).
- **Aksi (admin):** "+ Tambah Divisi", edit/hapus divisi (`editDivisi` `:1602-1620`, `saveDivisi` `:1621-1630`, `delDivisi` `:1631-1640`).
- **Validasi hapus divisi:** "Tidak bisa dihapus: masih ada N kru & M materi di divisi ini. Pindahkan dulu." (`:1635`).
- **Form divisi:** Nama Divisi (wajib: "Nama divisi wajib diisi"), Ikon dari `DIV_IC_CHOICES` (`:1601`) sebagai grid tombol.
- **Catatan:** kartu manajemen berlatar gradien gelap (`:1572`) → melanggar DESIGN.md.

### D.8 sertifikat — Progress & Sertifikat
- **Tampilan:** bila `certified` → sertifikat ("Akademi Laksamana, Sertifikat Standar Kru", nama, jabatan+divisi, teks "Telah menyelesaikan seluruh materi wajib (N materi)…", tanggal+Pekanbaru, ikon anchor) + tombol "Cetak Sertifikat" (`window.print()`); bila belum → kartu "Menuju Sertifikasi" dengan progress (`:1135-1152`).
- **Tabel materi wajib:** kolom Materi Wajib / Tipe / Status / Skor / Selesai (`:1153-1159`).
- **Bukti:** `:1135-1161`.

### D.9 tim — Progress Tim (manager+)
- **Tampilan:** tabel kru aktif (admin: semua; manager: divisinya), kolom Kru / Divisi / Wajib / Progress / Status / Detail. Status: "Tersertifikasi" / "Proses" (≥50%) / "Perlu didorong" (<50%) (`:1164-1179`).
- **Aksi:** "Detail" → `openKruDetail` (modal tabel materi, wajib, status, skor, waktu) (`:1181-1194`).

### D.10 anjungan — Anjungan (admin)
- **Tampilan:** 4 statistik (Kru Aktif, Tersertifikasi, Rata-rata Progress Wajib, Materi Terbit) (`:1203-1207`); "Progress per Divisi" (`:1208-1214`); "Kru yang Perlu Didorong (<50% wajib)" (≤8) (`:1215-1222`); "Hasil Kuis per Materi" (peserta, lulus, rata-rata skor) (`:1223-1230`).
- **Perhitungan:** `avgPct` = rata-rata `mandPct` kru aktif (`:1201`); kuis `taken/pass/sum` (`:1226-1228`).

### D.11 kelolaMateri — Kelola Materi (admin)
- **Tampilan:** tombol "+ <Tipe>" per TYPES (`:1248-1250`); tabel materi: Materi / Tipe / Divisi / Kategori / Wajib / Status (Terbit/Draft) / aksi edit+hapus (`:1251-1261`).
- **Form materi** (`editMaterial` `:1272-1315`): Judul Materi (wajib: "Judul wajib diisi"); Kategori (CATS); Sifat (Opsional / "Wajib (masuk sertifikasi)"); Untuk Divisi (checkbox `all` + tiap divisi; "Pilih minimal satu divisi"; bila `all` dicentang → hanya `all`); field per tipe:
  - `modul`: Isi Modul (textarea).
  - `video`: URL Video (YouTube), Deskripsi Singkat.
  - `sop`: Langkah-langkah (satu per baris; "SOP butuh minimal satu langkah").
  - `menu`: Nama Menu, Harga, Kategori Menu, Deskripsi, Komposisi/Bahan, Alergen, Selling Script, Catatan Operasional.
  - `quiz`: Nilai Lulus (%) default `DB.settings.passingDefault`; builder soal (tambah/hapus soal, 4 opsi, radio jawaban benar; "Kuis butuh minimal satu soal lengkap"). `a` diklem ke jumlah opsi (`:1358`).
- **Aksi:** Simpan Materi (`saveMaterial` `:1333-1364`); hapus (`delMaterial` `:1264-1270`) — konfirmasi "Hapus materi \"…\"? Progress kru untuk materi ini juga akan hilang." dan menghapus progress semua user untuk materi itu.
- **Catatan:** `published` default true untuk materi baru (`:1339`); tidak ada kontrol publish di form ini (draft hanya dari data lama).

### D.12 kelolaProgram — Kelola Program (admin)
- **Tampilan:** tabel Bulan / Program / Item / Deadline / Kepatuhan Kru / aksi (Kepatuhan, Duplikat, Edit, Hapus) (`:1491-1501`); kartu panduan "Cara pakai siklus bulanan" (`:1502`).
- **Form program** (`editProgram` `:1505-1520`): Bulan (month, auto-isi nama "Program <bulan>"), Deadline (date, default `lastDayOf(bulan)`), Nama Program, Catatan/Fokus, pilih materi (checkbox semua published). Validasi: "Bulan, nama, dan deadline wajib diisi"; "Pilih minimal satu materi".
- **Aksi:** `dupProgram` (`:1543-1551`) → program bulan berikutnya, bila sudah ada: "Program <bulan> sudah ada"; `programCompliance` (modal kepatuhan per kru) (`:1552-1564`); `delProgram` (`:1536-1542`) konfirmasi "Hapus program \"…\"? Catatan pengerjaan program ini ikut terhapus." + hapus `progProg`.
- **Perhitungan:** `programAvg(p)` rata-rata pct kru aktif non-admin yang punya item (`:1445-1449`).

### D.13 kelolaKru — Kelola Kru (admin)
- **Tampilan:** tabel kru **aktif** (hasil sinkron Office): Nama / Jabatan / Divisi / Peran / Atur (`:1373-1379`). Peran: "Nahkoda" (admin), "PIC Divisi" (manager), "Kru" (staff).
- **Form** (`editKru` `:1382-1399`): Nama (disabled — "Nama & login diatur di Office"), Jabatan, Divisi (all + DIVISIONS), Peran (staff/manager/admin).
- **Validasi:** "Kru tidak ditemukan" (`:1384`); tidak ada mode tambah.
- **Bukti:** `:1367-1408`.

### D.14 log — Log Aktivitas (admin)
- **Tampilan:** tabel 120 entri terakhir dari `DB.activity` (500 maksimum disimpan): Waktu / Kru / Aksi / Detail (`:1235-1243`).
- **Bukti:** `:1235-1243`.

### D.15 sync — Sinkronisasi & Backup (admin)
- **Tampilan:** status sync (Tersinkron / menunggu / gagal / belum terhubung), perubahan terakhir, server URL; kartu Database; Backup Manual (`:1744-1763`).
- **Aksi:** "Kirim Sekarang" → `pushToServer()` (`:1662-1690`); "Ambil Ulang dari Server" → `ambilDariServer()` (`:1736-1742`); "Unduh Backup (.json)" → `exportJSON()` (`:1772-1784`); "Pulihkan dari Backup" → `importJSON()`/`doImportJSON()` (`:1785-1799`, peringatan "Ini akan MENGGANTI seluruh data di device ini…").
- **Catatan:** tombol sync manual ke MySQL; `scheduleSync` debounce 1500 ms (`:1656-1659`). `pushDB`/`pullDB` (Apps Script lama) **tidak dipakai lagi** (`:1642-1646`).

### D.16 Progress & perhitungan inti (dipakai lintas layar)
- `matsForUser(u)` = materi `published` dan (`division` memuat `all` ATAU memuat divisi user) (`:739-745`).
- `isDone(u,m)` = quiz → `p.passed===true`; lainnya → `p.status==='done'` (`:746-751`).
- `userStats(u)` (`:752-761`): `total/done/mandTotal/mandDone`; `pct=round(done/total*100)`; `mandPct=round(mandDone/mandTotal*100)` atau **100** bila tak ada materi wajib; `certified = mandTotal>0 && mandDone===mandTotal`.
- `programUserStats` (`:1440-1444`): `pct=round(done/total*100)` atau 100 bila tak ada item.
- `progItemDone` / `markProgDone` (`:1433-1439`) — program progress terpisah dari progress biasa.

## E. Pemetaan backend

Legacy: `getAll` (GET), `saveAll` (POST `text/plain`, blob + `baseUpdatedAt`), `trainingStats`, `uploadReceipt`/`receipt`, `ping`, `stats` (`docs/modules/akademi.md`). Frontend lama memanggil `getAll` (`:508`) dan `saveAll` (`:1667`); `uploadReceipt`/`trainingStats` **tidak** dipanggil dari `deploy/akademi/index.html` (dipakai modul lain / lama).

| action lama | dipakai di layar | baca/tulis | endpoint v1 | status | catatan |
|---|---|---|---|---|---|
| `getAll` | boot semua | baca | `GET /state` (+ `/materials`, `/users`, `/divisions`, `/programs`, `/progress`, `/program-progress`) | ✅ | v1 granular; `/state` untuk bootstrap |
| `saveAll` (users/divisions/materials/programs) | kelolaMateri, kelolaProgram, kelolaKru, struktur, + progress | tulis | `POST/PUT/PATCH/DELETE /{resource}[/{id}]` | ⚠️ | v1 granular + version (`If-Match`), admin untuk tulis. Tidak ada delete-massal dari payload. |
| `saveAll` (progress) | materi/kuis/program | tulis | `PUT /progress/{user}/{material}` | ⚠️ | v1 sel komposit; entry disimpan apa adanya |
| `saveAll` (progProg) | program | tulis | `PUT /program-progress/{user}/{program}/{material}` | ⚠️ | v1 sel komposit |
| `saveAll` (activity) | `logAct` | tulis | `POST /activity` | ✅ | v1 juga derive id; trim 5000 |
| `saveAll` (settings) | passingDefault | tulis | `PUT /documents/settings` (admin) | ✅ | hash version |
| `trainingStats` | (dipakai HR, bukan frontend akademi) | baca | `GET /training-stats` (+ `/{user}`) | ✅ | sama persis dengan `userStats` |
| `uploadReceipt`/`receipt` | tidak dipakai di frontend akademi | — | `POST /files`, `GET /files/{key}` | ✅ | ≤8 MB, gambar/PDF |
| `ping` / `stats` | diagnostik | baca | `GET /stats` | ✅ | |

Konkurensi: legacy memakai `baseUpdatedAt` per baris; baris yang lebih tua dari versi server ditolak ke `bentrok[]` (tapi `ok` tetap true) (`index.html:1671-1675`, `docs/modules/akademi.md`). v1 memakai `updated_at` (ms) sebagai version, `428 version_required`, `409 version_conflict` (dengan record hidup di `error.details.current`; bila isi identik → sukses no-op). **Keduanya berbagi lock `akademi_save`** dan versi v1 valid sebagai `baseUpdatedAt` lama (`docs/api/akademi.md:52-57`). Kode error UI: `unauthenticated`, `module_not_granted`, `not_found`, `version_required`, `version_conflict`, `already_exists`.

## F. Aturan bisnis yang wajib dibawa
1. **`isDone` khusus kuis** — kuis dianggap selesai hanya bila `passed===true`; tipe lain `status==='done'` — bukti: `index.html:746-751`, `docs/api/akademi.md:74`.
2. **`certified` = ada materi wajib & semuanya selesai**; tanpa materi wajib, `mandPct` = 100 tapi `certified` false (`mandTotal>0`) — bukti: `index.html:759-760`.
3. **Item program dihitung terpisah dari progress biasa; refresher wajib dikerjakan ulang** walau sudah lulus — bukti: `index.html:1472`, `:1502`, `:1433-1439`.
4. **Mode Baca:** materi di luar divisi bisa dipelajari tapi tidak masuk progress/sertifikat — bukti: `index.html:989-999`, `:1043-1047`.
5. **Office = satu-satunya sumber daftar kru.** Sinkron roster menonaktifkan kru di luar roster (bukan menghapus, progress tetap); roster KOSONG diabaikan (jaring pengaman) — bukti: `index.html:709-723`.
6. **Admin modul hanya dari Office** (`adminModules` `*`/`akademi`); peran internal `'admin'` tidak memberi menu — bukti: `index.html:596-599`, `:1854`.
7. **Divisi tidak bisa dihapus bila masih ada kru/materi** — bukti: `index.html:1632-1635`.
8. **Hapus materi/program menghapus progress terkait** — bukti: `index.html:1268`, `:1540`.
9. **Materi baru default `published:true`**; hanya materi `published` yang dihitung — bukti: `index.html:1339`, `:741`.
10. **Satu divisi `all` mengalahkan pilihan lain** (`divs=['all']`) — bukti: `index.html:1338`.
11. **Simpan materi/kuis tidak menyimpan soal tanpa teks / opsi <2** — bukti: `index.html:1356-1358`.
12. **Bentrok `saveAll` tidak menimpa diam-diam** — bukti: `index.html:1671-1675`.

## G. Ketergantungan lintas modul
- **Office (account)** — identitas & roster via `account-api-mysql` (`listModuleRoster`, `:279`) dengan cadangan Apps Script (`:284`); `readLmSession` dari `localStorage['lm_session']`.
- **HR (Staff Performance)** membaca `trainingStats` Akademi (`docs/modules/akademi.md`, kontrak `GET /training-stats`) — Akademi jadi sumber komponen Training HR.
- Tidak menulis ke database modul lain.
- Logo `../assets/laksamanamuda-warna.jpg` (`:877`).

## H. Catatan untuk implementasi Vue
- Halaman: `app/pages/akademi/index.vue` (Beranda) + `akademi/materi.vue`, `akademi/program.vue`, `akademi/perpus.vue`, `akademi/struktur.vue`, `akademi/sertifikat.vue`, `akademi/tim.vue`, `akademi/anjungan.vue`, `akademi/kelola-materi.vue`, `akademi/kelola-program.vue`, `akademi/kelola-kru.vue`, `akademi/log.vue`, `akademi/sync.vue`. `definePageMeta({ access: ['akademi'] })`; sembunyikan menu Kontrol dengan `isAdminOf(me,'akademi')` dan `tim` dengan manager.
- Composable `useAkademi.ts`: `useAkademiState()`→`GET /state`; `useMaterials(filters)`/`useMaterial(id)`; `usePrograms`; `useDivisions`; `useUsers`; `useProgress(user,material)`; `useProgramProgress(...)`; `useTrainingStats(user?)`; `useActivity()`; `createRecord/updateRecord/deleteRecord` (admin, kirim `If-Match`); `saveProgress`→`PUT /progress/{user}/{material}`; `saveProgramProgress`; `postActivity`.
- HP vs desktop: tabel (Progress Tim, Anjungan, Kelola*) → `AppList` di HP, `UTable` di desktop; viewer materi & kuis → `ResponsiveSheet`; grid kartu materi → `AppList`.
- Widget Beranda yang cocok: "Materi wajib belum selesai" (`matCard` ringkas), "Program bulan ini".
- Elemen lama yang melanggar DESIGN.md → padanannya:
  - **Grid kartu berisi angka besar** (Beranda, Anjungan, Struktur) → `AppList` + satu `AppFocus`.
  - **Gradien gelap** (kartu "Semua materi wajib selesai" `:928`, manajemen struktur `:1572`) → `bg-default` flat.
  - **Badge berwarna penuh** (`badge b-ok/b-warn/b-bad`) → `AppStatus` (titik + kata).
  - **Label huruf kapital mono** ("SOAL 1", "SELLING SCRIPT…") → sentence case `text-muted`.
  - **Tombol hapus merah penuh** (`btn-danger`) → aksi neutral/outline + konfirmasi `ResponsiveSheet`.
  - Ikon sudah SVG (bukan emoji) — pertahankan, ganti ke Lucide.
- Sinkronisasi: hilangkan `saveAll`+`localStorage`; tulis langsung per-record ke API, tampilkan `version_conflict` bila ada.

## I. Pertanyaan terbuka
- _(tidak ada)_

## J. Progres build
Branch: migrasi/akademi · Mulai: 2026-10-01
LANJUTKAN DARI: — (semua layar bagian C punya halaman)
Status layar: **dibangun, belum dicek visual** — ✅ di kolom status berarti halamannya
sudah dibangun, **bukan** sudah dirender/dicek di browser (1366px/390px, tugas manusia).

### Cek visual 2026-10-08 (Refs #19, branch `fix/visual-akademi`, mock read-only :4014 → dev :3014)
13/13 layar dibuka 1366px & 390px sebagai admin (Risa, `tok-admin`) dan kru
Kitchen (Kadek, `tok-kru`): overflow 0 di semua lebar, console tanpa error.
Kolom tabel tim/kelola-materi/kelola-program/kelola-kru/log/sertifikat sama
dengan Office lama; viewer materi (modul/video/SOP/menu/kuis), Mode Baca, dan
intro + pengerjaan kuis dicek interaktif. Gate peran: kru melihat penolakan
yang benar di `tim` (manager+) dan `anjungan`/kelola (admin).
Perbaikan: kartu Sertifikasi di dashboard memakai `wrap` (`AppStat`) supaya
"Belum Sertifikasi" tidak terpotong di 390px.
`npm run lint && npm run typecheck && npm run build` hijau 2026-10-08.

| layar (key) | file | status | endpoint dipakai | ditunda karena |
|---|---|---|---|---|
| dashboard | `app/pages/akademi/dashboard.vue` | ✅ | `GET /state`, `POST /users` (roster), `POST /activity`, `PUT /progress`, `PUT /program-progress` | — |
| materi | `app/pages/akademi/materi.vue` | ✅ | `GET /state`, `PUT /progress`, `PUT /program-progress`, `POST /activity` | — |
| program | `app/pages/akademi/program.vue` | ✅ | `GET /state`, `PUT /progress`, `PUT /program-progress`, `POST /activity` | — |
| perpus | `app/pages/akademi/perpus.vue` | ✅ | `GET /state`, `PUT /progress`, `PUT /program-progress`, `POST /activity` | — |
| struktur | `app/pages/akademi/struktur.vue` | ✅ | `GET /state`, `POST /divisions`, `PUT /divisions/{id}`, `DELETE /divisions/{id}` | — |
| sertifikat | `app/pages/akademi/sertifikat.vue` | ✅ | `GET /state` | — |
| tim | `app/pages/akademi/tim.vue` | ✅ | `GET /state` | — |
| anjungan | `app/pages/akademi/anjungan.vue` | ✅ | `GET /state` | — |
| kelolaMateri | `app/pages/akademi/kelola-materi.vue` | ✅ | `POST/PUT/DELETE /materials`, `GET /progress`, `DELETE /progress/{user}/{material}` (cascade F8) | — |
| kelolaProgram | `app/pages/akademi/kelola-program.vue` | ✅ | `POST/PUT/DELETE /programs`, `GET /program-progress`, `DELETE /program-progress/{user}/{program}/{material}` (cascade F8) | — |
| kelolaKru | `app/pages/akademi/kelola-kru.vue` | ✅ | `GET /state`, `PUT /users/{id}`, `GET /account/modules/akademi/members`, `POST /users` | — |
| log | `app/pages/akademi/log.vue` | ✅ | `GET /state` | — |
| sync | `app/pages/akademi/sync.vue` | ✅ (sebagian ⏸) | `GET /state` (unduh backup) | **"Segera"**: "Kirim Sekarang" (`pushToServer`), "Ambil Ulang dari Server" (`ambilDariServer`), "Pulihkan dari Backup" (`importJSON`/`doImportJSON`) — v1 tidak punya whole-state write. Kandidat G baru (pola K-01/G-13). |

Catatan build:
- **Registrasi chrome belum ada.** `app/utils/modul-shell.ts` milik lead; entri `akademi` harus ditambahkan di sana agar sidebar modul aktif:
  ```ts
  akademi: {
    subjudul: 'Akademi',
    layar: LAYAR_AKADEMI,
    peran: me => kruSaya(me)?.title || 'Kru',
    siapkan: () => muatAkademiKru(),
  },
  ```
  Tanpa entri itu halaman tetap bisa dibuka lewat URL, tetapi sidebar jatuh ke daftar modul Office.
- **Sinkron roster hanya jalan untuk admin.** `POST /users` butuh hak admin modul, jadi `sinkronRosterAkademi()` hanya dipanggil dari layar admin (Beranda & Kelola Kru). Kru baru yang belum pernah dibuka admin belum punya baris; layar memakai baris sementara `division:'all'` seperti `resolveAkademiUser` lama. Kandidat gap (roster sync non-admin).
- **Cascade hapus F8 dikerjakan klien.** API `DELETE /materials/{id}` / `DELETE /programs/{id}` tidak menghapus progress terkait; klien menghapus sel per sel lewat `GET /progress?material=` / `GET /program-progress?program=` lalu `DELETE`, sesuai F8. Bisa jadi gap kalau pemanggil lain lupa.
- **`GET /state` tidak membawa versi per baris.** Helper tulis (`updateAkademiRecord`, `simpanProgres`, `simpanProgProg`) membaca ulang baris/sel untuk mendapat `meta.version` sebelum menulis; konflik tetap ditangani `tanganiKonflik`.
- Helpers murni: `app/utils/akademi-hitung.ts` (userStats/isDone/program), `app/utils/akademi-konstanta.ts` (TYPES/CATS/divisi/peran), `app/utils/status-akademi.ts` (peta status).

## K. Daftar uji cutover

Daftar untuk **manusia** (agen tidak menjalankan app). Setiap butir **layar**: dibuka di
**1366px** dan **390px**, tanpa error runtime, susunan/kolom/kartu sama dengan Office lama
(rujukan D.x di atas), tabel muat di 1366px dan menjadi kartu di 390px. Setiap butir
**aksi tulis**: berhasil, dan versi basi memicu muat-ulang konflik (bukan menimpa
diam-diam). Tanda **[G-xx]** menandai butir yang menyentuh bagian "Segera"/gap.

### Layar (1366px & 390px)
- [ ] **dashboard** — Beranda (D.1): 4 kartu (`userStats`, silang `GET /training-stats/{me}`), program bulan berjalan, materi wajib belum selesai, materi terbaru.
- [ ] **materi** — Materi Saya (D.2): chip tipe & kategori menyaring, kartu materi tampil.
- [ ] **program** — Program Bulanan (D.5): status Tuntas/Lewat deadline/Berjalan/Arsip, item refresher ditandai.
- [ ] **perpus** — Perpustakaan (D.6): cari judul, chip divisi+tipe, "N materi ditemukan", penanda Mode Baca.
- [ ] **struktur** — Struktur Organisasi (D.7): kartu manajemen + per divisi (PIC/kru/persen wajib).
- [ ] **sertifikat** — Progress & Sertifikat (D.8): tersertifikasi → sertifikat + tombol cetak; belum → panel progress + tabel materi wajib.
- [ ] **tim** — Progress Tim (D.9): admin lihat semua kru, manager hanya divisinya; Detail menampilkan materi/skor/waktu.
- [ ] **anjungan** — Anjungan (D.10): 4 statistik, progress per divisi, kru <50%, hasil kuis per materi.
- [ ] **kelolaMateri** — Kelola Materi (D.11): tombol "+ <Tipe>", tabel Materi/Tipe/Divisi/Kategori/Wajib/Status/aksi.
- [ ] **kelolaProgram** — Kelola Program (D.12): tabel Bulan/Program/Item/Deadline/Kepatuhan/aksi + kartu panduan.
- [ ] **kelolaKru** — Kelola Kru (D.13): tabel kru aktif Nama/Jabatan/Divisi/Peran/Atur. **[G-18]**
- [ ] **log** — Log Aktivitas (D.14): tabel Waktu/Kru/Aksi/Detail, 120 entri terbaru dari `activity`.
- [ ] **sync** — Sinkronisasi & Backup (D.15): status sync, kartu Database, tombol unduh backup. **[G-16]**

### Aksi tulis (berhasil + konflik versi)
- [ ] Buka materi (D.3) modul/video/SOP/menu/kuis; tombol selesai hanya aktif sesuai aturan (SOP semua langkah dicentang) → `PUT /progress/{user}/{material}`.
- [ ] Kerjakan item program (D.5) → `PUT /program-progress/{user}/{program}/{material}`; refresher tetap bisa dikerjakan ulang; Mode Baca tidak menyimpan.
- [ ] Kuis (D.4): skor & lulus disimpan, Mode Baca = mode latihan (tidak disimpan).
- [ ] struktur: tambah/edit divisi (`POST`/`PUT /divisions/{id}`); hapus divisi berisi kru/materi ditolak dengan pesan.
- [ ] kelolaMateri: simpan materi tiap tipe (`POST`/`PUT /materials`); **hapus materi** = progress kru ikut terhapus dulu, materi terakhir. **[G-17]**
- [ ] kelolaProgram: simpan/edit program; duplikat ke bulan berikut; **hapus program** = program-progress ikut terhapus dulu, program terakhir. **[G-17]**
- [ ] kelolaKru: "Sinkron dari Office"/roster (`POST /users`) menambah/mengaktifkan tanpa menghapus; edit jabatan/divisi/peran (`PUT /users/{id}`). **[G-18]**
- [ ] log: setiap aksi menulis baris `POST /activity`; nama kru diambil dari `users`.
- [ ] sync: "Unduh Backup (.json)" cocok dengan `GET /state`. **"Segera" [G-16]:** "Kirim Sekarang", "Ambil Ulang dari Server", "Pulihkan dari Backup" (butuh endpoint whole-state).

### Silang Vue ↔ Office lama
- [ ] Tulis progress/versi di Vue, buka tab Office lama: `updated_at` v1 terbaca sebagai `baseUpdatedAt` lama; sunting dari kedua sisi tidak saling menimpa (yang kalah → konflik, bukan kehilangan data).
