# Tautan task→konten di antrean (shooting/design/editing) — short design

## Intent & why
Baris "mandiri" (ProdTask) di antrean konten membuka form edit saat ditekan, padahal
pekerjaan itu milik sebuah konten — user mau tekan → langsung ke detail kontennya
(pilihan user 2026-11-03, opsi A). Task dan request tidak punya field tautan hari ini;
tapi API menyimpan row task sebagai JSON bebas sehingga `contentId` tersimpan tanpa
ubah backend (preseden: `ShootingKonten.contentId`). Cakupan: antrean shooting, design,
editing — semuanya lewat `KontenAntrian` + `KontenTugasForm` bersama ("shooting schedule"
dibaca sebagai halaman shooting; koreksi bila maksudnya kalender/jadwal lain).

## Goals / non-goals / anti-goals
- Goals: form task punya picker "Konten terkait" (cari judul → pilih); task tertaut:
  diklik → `/konten/detail/{contentId}`, baris menampilkan badge judul kontennya;
  task tanpa tautan: perilaku lama (buka form). Task lama tetap mandiri sampai ditautkan.
- Non-goals: menautkan request marketing (milik modul Marketing, read-only di sini);
  filter/sort `contentId` server-side (butuh migrasi + API — catat sebagai follow-up);
  mengubah validasi/simpan selain tambah field.
- Anti-goals: menambah dependensi; migrasi data massal; mengubah modul selain konten.

## Constraints
- `laksamana-office/` read-only; backend TIDAK diubah (field hidup di blob JSON).
- Tanpa hex/gradient, tanpa style `dark:`, ikon Lucide, copy Indonesia sentence case,
  komentar Inggris.
- Cek visual 390px & 1366px di browser; tanpa lint/typecheck/test/commit sampai user
  bilang selesai (mode perbaikan visual).

## Approaches
- Dipilih A: picker pencarian konten di `KontenTugasForm` + routing di `buka()`.
  Sumber daftar: `listKonten()` server-search (pola `planning.vue:39-44`); pola opsi:
  `USelect` brand/PIC (`KontenTugasForm.vue:29-34`).
- Ditolak B: taut-otomatis tanpa picker (tidak menyelesaikan task lama).
- Tidak viable: heuristik judul/brand (tidak ada kunci andal; diverifikasi tidak ada
  join di `barisAntrian`).

## Yang sudah diputuskan
- Field `contentId?: string` di `ProdTask` (JSON blob; tanpa perubahan API — my call
  berdasarkan bukti `KontenController` tanpa whitelist).
- Task tertaut → detail; tanpa tautan → form lama (keputusan user "semua yang punya konten").
- Badge judul konten di baris tertaut — my call (butuh lookup `st.content` client-side).
- Validasi konten se-`kind` opsional (ditentukan builder bila murah; tidak wajib).

## Diserahkan ke builder
- Komponen picker persis (UInputMenu vs USelect + search — pilih yang konsisten repo).
- Label bantu + pesan saat konten tertaut dihapus (tampilkan judul-tersimpan / fallback).
- `buka()` + badge + `toggle()` tidak berubah perilaku untuk task tanpa tautan.
