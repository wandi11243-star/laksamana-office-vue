# PROMPT: visual per modul (samain vs reimagine)

> Cara pakai: salin blok di bawah garis ke agen, lalu ganti setiap `{{VARIABEL}}` dengan nilai dari issue. Satu modul per sesi. Jangan mulai coding sebelum owner menjawab pilihan visual di Langkah 1.

---

Kamu mengerjakan modul **`{{MODUL}}`** di `laksamana-office-vue` (Nuxt 4 + Nuxt UI v4, SPA) sebagai pengganti layar yang sama di Office lama. Issue: **#{{ISSUE}}**. Assignee: **{{ASSIGNEE}}**.

Root kerja: folder `laksamana/`. Kamu hanya menulis di `laksamana-office-vue/`. `laksamana-office/` read-only (referensi). `laksamana-api/` boleh kamu ubah lewat issue API sendiri (lihat Langkah 4).

Referensi spesifik modul ini:

- Deploy lama: `{{DEPLOY}}`
- Halaman Vue: `{{VUE}}`
- Kontrak API: `{{API}}`
- Spec migrasi: `{{SPEC}}`
- Perkiraan layar: {{LAYAR}}

## 0. Bacaan wajib (urut, sekali)

1. `laksamana-office-vue/AGENTS.md`, `CONTRIBUTING.md`, `DESIGN.md`. Wajib.
2. `laksamana-office-vue/docs/migrasi/PLAN.md` (prinsip, §4 logika bersama, §5 DoD) dan `TIM-A.md` (klaim issue, branch, kepemilikan file).
3. `{{SPEC}}` (layar, endpoint, aturan bisnis). Kalau file tidak ada (modul dw, homepage), susun daftar layar dari `{{DEPLOY}}` dan `{{VUE}}` lalu tulis di laporan.
4. `{{API}}`. Kontrak adalah kebenaran untuk nama field, endpoint, dan kode error. Kalau tidak ada, catat di laporan.
5. Contoh jadi: `app/pages/reservasi/dashboard.vue`, `app/composables/useAbsensi.ts`, `app/utils/versi.ts`, `app/utils/format.ts`.

## 1. Sesi interaktif: kunci pilihan visual dulu

Jangan coding sebelum owner menjawab. Tanyakan exactement satu hal ini:

> Modul `{{MODUL}}`: (A) samakan visual plek dengan `{{DEPLOY}}` (susunan section, kolom tabel, kartu stat, letak tombol sama, dibangun ulang dengan blok DESIGN.md), atau (B) reimagine total?

- Kalau jawaban (A): ikuti `DESIGN.md` aturan 1 sampai 7. Buka layar lama lewat `grep -n` lalu `sed -n` potongan maksimal 300 baris. Jangan baca file lama dari atas sampai bawah.
- Kalau jawaban (B): kamu boleh web-search inspirasi desain yang umum dipakai untuk modul sejenis, lalu terapkan dengan batas ini: wajib patuhi skill antislop (core, antislop-ui, antislop-layoutmobile, antislop-copywriting), tetap pakai token `DESIGN.md` (tanpa hex di komponen, tanpa gradasi, emas teks `text-primary-700`, ikon Lucide, Indonesia sentence case). Tulis di laporan: 2 sampai 3 referensi yang kamu pakai dan alasan tiap keputusan visual (satu baris per keputusan).
- Kalau owner belum jawab dalam sesi ini, kerjakan hal yang netral dulu (composable, tipe, endpoint) dan tandai layar sebagai menunggu keputusan visual.

## 2. Bandingkan lama vs baru di browser

Untuk tiap layar (pilihan A maupun B):

1. Buka versi lama (`{{DEPLOY}}`, serve statis lokal) dan versi Vue (`npm run dev`, API lokal atau mock read-only) berdampingan.
2. Cek 390px dan 1366px. Catat beda: urutan section, kolom tabel, kartu stat, posisi tombol dan aksi per baris.
3. Tabel HP: `UTable` di `lg+`, daftar kartu di bawahnya. Tidak ada geser samping di 390px. Area sentuh minimal 44px.
4. Tulis checklist parity di laporan (per layar: sama atau beda disengaja + alasan).

Tanpa API lokal, pakai mock read-only. Jangan pernah arahkan dev server ke data dev atau production. Jangan lakukan tulis (POST/PUT/PATCH/DELETE) ke API dev atau production.

## 3. Aturan kode yang tidak bisa ditawar

- Hanya `/api/v1` lewat `useApi()`. Tidak ada URL `*-api-mysql`, tidak ada `fetch` langsung.
- Session token hanya lewat `useToken()`.
- Tiap halaman: `definePageMeta({ access: [...] })` dengan kunci dari `app/utils/modul.ts`.
- Tipe dan panggilan modul di `app/composables/use{{Modul}}.ts`. Nama field persis seperti API. Error API ditampilkan apa adanya lewat `apiErrorMessage()`.
- Tulisan berversi: selalu `ifMatch(versi)` plus `tanganiKonflik(e, refresh)`.
- Rumus bersama milik modul lain diimpor dari `app/utils/`, tidak disalin.
- UI Indonesia sentence case. Komentar kode bahasa Inggris.
- Tanpa dependensi npm baru tanpa izin. Tanpa `dark:` (aplikasi light-only).
- Tanpa test per issue. Test menyusul setelah semua merge ke main.
- Git: branch `migrasi/visual-{{MODUL}}` dari `main` terbaru. Commit kecil per layar (`feat({{MODUL}}): <layar>`). Push branch sendiri dan buka draft PR dengan `Closes #{{ISSUE}}`. Jangan merge. Merge dilakukan owner/reviewer (termasuk Wandi).

## 4. Gap API: kamu berhak bikin dan kerjakan

Kalau API kurang:

1. Buat issue di `laksamana-api` (label `tim-a`) berisi endpoint yang kurang, bukti (`path:baris`), dan pemakaian di modul ini.
2. Kerjakan issue API itu sampai selesai (test API tetap jalan di repo API).
3. Tautkan sebagai blocked-by di issue Vue ini dan lanjutkan bagian yang tidak terblokir. Tampilkan bagian terblokir sebagai Segera.

## 5. Tutup

- `npm run lint`, `npm run typecheck`, `npm run build` hijau. Tulis baris ringkasannya di PR.
- Laporan akhir di chat: pilihan visual owner (A/B), layar selesai atau ditunda (dengan ID K/G), parity lama vs baru per layar, hasil lint/typecheck/build, gap API baru (nomor issue), rumus bersama yang diport atau diimpor, yang belum dicek.
