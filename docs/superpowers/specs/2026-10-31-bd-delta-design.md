# Import delta BD Oktober ke Office Vue — design doc

Tanggal: 2026-10-31 · Pendekatan: C (irisan vertikal per fitur — disetujui owner)
Status: menunggu persetujuan owner, lalu `writing-plans`.

## 1. Intent & why

Modul BD di Office lama (`laksamana-office`, read-only) berubah banyak selama
Oktober 2026 dan diganti nama tampilan jadi "Task Management". Office Vue
sudah punya 13 layar BD fungsional + backend `laksamana-api` parity 32/32,
tapi belum punya kemampuan-kemampuan baru itu. Kru harus membuka dua sistem.
Kerja ini mem-porting SELURUH delta kemampuan ke Office Vue (+ endpoint API
baru bila terbukti perlu), supaya kru cukup hidup di satu sistem.

## 2. Goals / non-goals / anti-goals

Goals:
- Seluruh kemampuan delta Oktober hidup di Vue: Recurring Task, mesin pola
  ulang, pintu AI-agent WhatsApp, reviewers + visibilitas semua-kru, sub-task
  ber-assignee, tag berwarna, perilaku kanban terbaru.
- Tiap irisan selesai = langsung bisa dipakai kru (vertikal, bukan fondasi mati).
- Paritas perilaku dengan Office lama (urutan, kolom, rumus sama).

Non-goals:
- Tidak mengubah alur modul lain (Radar/Marketing/Finance yang membaca BD).
- Tidak memigrasi data (DB dipakai bersama, tidak ada migrasi data hidup).
- Tidak menulis ulang layar BD Vue yang sudah ada kecuali tersentuh irisan.

Anti-goals (gagal walau teknis jalan):
- Kru masih harus membuka Office lama untuk satu kemampuan dalam cakupan.
- Endpoint/API baru yang tidak dikontrak di `docs/api/bd.md` + tanpa tes modul.
- Logika tulis yang berisiko menghapus data (pelajaran insiden PR-11/saveAll).

## 3. Constraints

- `laksamana-office/` read-only: spesifikasi saja, tidak diedit/commit.
- API: satu worktree per issue (`tools/agent-worktree.mjs`), tes folder modul
  yang disentuh (`php artisan test tests/Feature/Bd`), kontrak di `docs/api/bd.md`.
- Vue: `useApi()`/`useToken()`, `definePageMeta({ access })`, blok App*,
  DESIGN.md, copy Indonesia, komentar Inggris, `npm run lint && typecheck`.
  Tanpa dependensi baru tanpa persetujuan.
- Dilarang menulis ke data hidup (produksi/dev); kerja tulis hanya lawan API
  lokal/mock. Aturan lintas repo di root `AGENTS.md` berlaku.
- Pintu agent WA butuh keputusan infra: `AGENT_TOKEN`, pengirim WA, pencocokan
  noHp — di luar kode, harus diputuskan sebelum irisan S4.

## 4. Approaches (dipilih C)

- A. Vue dulu, API menyusul kalau mentok — cepat terlihat, tapi mesin ulang
  serumit Google Calendar berakhir di frontend dan agent tertunda.
- B. Backend parity dulu, baru layar — kontrak kokoh tapi kru menunggu tanpa
  hasil terlihat, padahal sebagian besar delta tak butuh endpoint baru.
- C. Irisan vertikal per fitur ✅ — tiap kemampuan Vue (+API bila perlu)
  tuntas dan langsung pakai; risiko tersebar; bagian tersulit (agent WA)
  di akhir. Dipilih owner 2026-10-31.

## 5. Irisan (urutan bangun)

### S1 — Recurring Task + mesin pola ulang
Layar Recurring: satu baris per SERI (`ulangDari` kepala rantai), tombol
Hentikan/Lanjutkan + ✓ Selesai, kolom Deadline sendiri. Pola ulang ala
Google Calendar (`bulanan_ke`/`akhir`, `tahunan`, kustom `k/...`, berakhir
sampai-tanggal / N-kali); seri maju sendiri (`gulirUlang`) tanpa Done.
Acuan lama: `deploy/bd/index.html` (±26–27 Okt), `lib_bd` ulang.
Dugaan: frontend + field blob task yang ada; endpoint baru hanya bila mentok.
Kriteria selesai: seri berulang lahir/maju/henti/selesai dari Vue; paritas
kolom dan perilaku dengan layar lama.

### S2 — Reviewers + visibilitas semua-kru
Semua kru melihat semua task (ganti aturan "saya+anak buah"); field
`reviewers`; "Menunggu review kamu" bila ditag. Acuan: commit 28 Okt.
Kriteria selesai: kru non-admin melihat task yang dulu buta; reviewer
tertandai dan terdaftar di antrean review-nya.

### S3 — Sub-task ber-assignee + tag + kanban terbaru
Sub-task ber-assignee, kotak cari, tag "untuk siapa" + warna, kartu kanban
mendarat paling bawah (`pindahKe`), ikon Daily matahari. Acuan: 15 & 18 Okt.
Kriteria selesai: paritas perilaku dengan lama di layar My Task/Projects.

### S4 — Pintu AI-agent WhatsApp (terakhir)
`agentTugas`/`agentSelesai`/`agentCatat` (acuan: `lib_agent.php` 371 baris,
`agent-reminder-bd.md`): token, noHp pengirim cocok PIC/pelaksana, id
kejadian dibuat frontend (anti-kembar dua tab), mati bila token kosong.
Butuh endpoint Laravel baru + keputusan infra (pemilik: owner).
Kriteria selesai: reminder WA terkirim dari aksi Vue; tanpa token = mati
bersih, bukan error.

## 6. Yang diputuskan owner (2026-10-31)

- Cakupan: SEMUA kemampuan delta (bukan sebagian).
- Pendekatan: C, urutan S1 → S2 → S3 → S4.
- Perubahan API bila perlu: boleh, ikut aturan repo API.
- S2 visibilitas: ikut yang lama — semua kru melihat semua task tanpa
  kecuali (aturan 28 Okt 2026), termasuk pembaca lintas modul.
- S4 WA (hasil bedah kode lama, terverifikasi dari sumber):
  repo lama TIDAK mengirim WA; tidak ada go-whatsapp self-host di kode
  produksi (ingatan owner tidak terbukti di repo). Alur lama: cron di VPS
  (09:00 & 16:00 WIB) → POST pintu `bd-api-mysql/api.php`
  (agentTugas/agentSelesai/agentCatat, token via body/header, tidak via
  query) → agent VPS mengirim via template WhatsApp Cloud API bertombol
  `selesai:<id>`/`belum:<id>` → webhook balasan masuk ke AGENT (bukan PHP)
  → agent teruskan hasil ke PHP dengan `noHp` pengirim yang wajib milik
  PIC/pelaksana (normalisasi ke `628…`; roster tak terbaca = ditolak).
  `AGENT_TOKEN` (min 24 char, beda dev/prod, kosong = pintu mati) hidup di
  `config.php` tiap server. Anti-kembar dua tab diselesaikan di sisi task
  (id penerus tetap `t.id+'_u'`); dedup kirim reminder dicatat di sisi agent
  (`id+tanggal`). Nomor pengirim WA, template ID, dan token Cloud API semua
  hidup di VPS agent — tidak ada di repo.
- PARKIR (keputusan owner 2026-10-31): S4 ditunda sampai prasyarat infra
  tersedia (nomor pengirim, template + token Cloud API, `AGENT_TOKEN`,
  cron/pemicu). Yang jalan sekarang: S1 → S2 → S3.

## 7. Diserahkan ke builder (ringkas, bukan daftar ulang)

- Detail paritas per layar ada di recon: struktur NAV/SUB lama
  (`deploy/bd/index.html:1578-1640`), fungsi `lib_bd_mysql.php` (19 fn),
  `lib_agent.php` (21 fn), skema 9 tabel, status Vue (`docs/migrasi/bd.md`,
  `PLAN.md:57`), kontrak API (`docs/api/bd.md`, parity 32/32 M10).
- Tiap irisan: tulis + uji modul API bila menyentuh API; lint+typecheck Vue;
  cek browser 390px & 1366px terang; tanpa test E2E baru (CI yang jalan).
- Keputusan infra S4 (AGENT_TOKEN, pengirim WA) kembali ke owner sebelum S4.
