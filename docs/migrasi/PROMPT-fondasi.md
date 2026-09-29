# PROMPT — Fase 1: fondasi bersama laksamana-office-vue

> Salin semua di bawah garis ini ke agen. Satu sesi.

---

Kamu mengerjakan **Fase 1 (fondasi)** migrasi Office lama ke `laksamana-office-vue`
(Nuxt 4 + Nuxt UI v4, SPA). Root kerja: `/home/dwipapap/Projek/laksamana/`.
Kamu hanya menulis di `laksamana-office-vue/`.

## Baca dulu (urut, sekali)

1. `laksamana-office-vue/AGENTS.md`, `CONTRIBUTING.md`, `DESIGN.md`
2. `laksamana-office-vue/docs/migrasi/PLAN.md`
3. `laksamana-office-vue/docs/migrasi/00-fondasi.md` ← **spesifikasi tugasmu, F1–F5**
4. Kode yang sudah ada: `app/composables/useApi.ts`, `useMe.ts`, `useModulNav.ts`, `useAbsensi.ts`,
   `app/pages/absensi/index.vue`, `app/pages/styleguide.vue`, `app/components/*.vue`
5. Kontrak API seperlunya: `laksamana-api/docs/api/account.md` (roster), `laksamana-api/docs/api/bd.md:40-85`
   dan `konten.md:40-75` (aturan versi & konflik)

## Aturan mutlak

1. Jangan ubah `laksamana-office/` dan `laksamana-api/`.
2. Tanpa dependensi npm baru.
3. Jangan menjalankan tulisan (POST/PUT/PATCH/DELETE) ke API dev atau production. Contoh di styleguide tidak memanggil API.
4. Ikuti `00-fondasi.md` persis: nama file, nama fungsi, teks toast. Kalau spesifikasi ternyata tidak cocok
   dengan kode (mis. tipe `Me` tidak bisa diimpor seperti ditulis), pilih solusi paling kecil, lalu catat di laporan.
5. Komentar kode bahasa Inggris, teks UI bahasa Indonesia sentence case. Tiru gaya kode yang sudah ada
   (kepadatan komentar, penamaan, `useAsyncData` untuk baca).
6. Git: buat branch `migrasi/fondasi` dari `main`. Satu commit per tugas F1…F5. Jangan push.

## Langkah

Untuk setiap F1 → F5:
1. Ubah status tugas di tabel atas `00-fondasi.md` menjadi 🟡.
2. Kerjakan.
3. Jalankan `npm run lint && npm run typecheck`. Perbaiki sampai hijau.
4. Ubah status jadi ✅, commit (`feat(fondasi): <ringkas>` / `docs: …` untuk F5).

Setelah F5: `npm run build` harus hijau. Kalau ada perintah `npm run dev` + browser yang tersedia,
buka `/styleguide` di 390px dan 1366px (terang & gelap) dan periksa contoh baru. Kalau tidak bisa, katakan.

## Laporan akhir (di chat)

- daftar file yang dibuat/diubah;
- hasil `lint`, `typecheck`, `build` (salin baris ringkasannya);
- penyimpangan dari `00-fondasi.md` dan alasannya;
- apa yang belum dicek (visual, dll.).
