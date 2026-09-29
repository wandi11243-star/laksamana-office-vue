# PROMPT — Fase 2: bangun satu modul di laksamana-office-vue

> Cara pakai: ganti **setiap** `{{MODUL}}` dengan key Vue dari `PLAN.md` §3 (mis. `akademi`),
> `{{Modul}}` dengan versi PascalCase-nya (mis. `Akademi`), dan `{{CAKUPAN}}` dengan kolom "cakupan" baris itu. Salin semua di bawah garis ke agen.
> Satu modul per sesi. Modul ≥ 20 layar boleh diminta per kelompok layar: tulis kelompoknya di `{{CAKUPAN}}`.

---

Kamu membangun modul **`{{MODUL}}`** di `laksamana-office-vue` (Nuxt 4 + Nuxt UI v4, SPA),
menggantikan layar yang sama di Office lama. Cakupan sesi ini: **{{CAKUPAN}}**.
Root kerja: `/home/dwipapap/Projek/laksamana/`. Kamu hanya menulis di `laksamana-office-vue/`.

Riset sudah selesai. **Jangan meriset ulang dari nol**: inventaris modul ini sudah ada, lengkap dengan
bukti `path:baris`. Tugasmu menerjemahkannya menjadi halaman Vue.

## 1. Bacaan wajib (urut, sekali)

1. `laksamana-office-vue/AGENTS.md`, `CONTRIBUTING.md`, `DESIGN.md` — aturan kode & tampilan. Wajib.
2. `laksamana-office-vue/docs/migrasi/PLAN.md` — prinsip, urutan, **§4 logika bersama**, **§5 Definition of Done**.
3. `laksamana-office-vue/docs/migrasi/_pertanyaan.md` — aturan **U1–U5**, jawaban **T-xx**, keputusan **K-xx**.
   Cari semua baris yang menyebut `{{MODUL}}`.
4. `laksamana-office-vue/docs/migrasi/_gap-api.md` — gap **G-xx** yang menyangkut `{{MODUL}}`.
5. `laksamana-office-vue/docs/migrasi/{{MODUL}}.md` — **spesifikasimu**: layar (C), detail per layar (D),
   pemetaan endpoint (E), aturan bisnis (F), ketergantungan (G), catatan Vue (H).
6. Kontrak API: `laksamana-api/docs/api/{{MODUL}}.md` (dan kontrak lain yang disebut di bagian A/E).
   Kontrak adalah kebenaran untuk nama field, endpoint, dan kode error.
7. Contoh jadi: `app/pages/absensi/index.vue`, `app/composables/useAbsensi.ts`, dan hasil fondasi:
   `app/utils/versi.ts`, `app/utils/format.ts`, `app/utils/layar.ts`, `app/components/ModulMenu.vue`,
   `app/composables/useRoster.ts`. Juga modul yang sudah selesai sebelumnya (lihat `PLAN.md` §3) — tiru polanya.

Buka `laksamana-office/…` (frontend lama) **hanya** untuk memeriksa detail yang kurang jelas di `{{MODUL}}.md`,
lewat `grep -n` lalu `sed -n` potongan ≤ 300 baris. Jangan membaca file lama dari atas sampai bawah (ada yang
20.000 baris). Jangan membaca `laksamana-office/CLAUDE.md` utuh (~800 KB); grep judul bagian saja.

## 2. Aturan mutlak

1. **Jangan ubah** `laksamana-office/` dan `laksamana-api/`. Kalau API kurang: jangan diakali; ikuti §5 langkah 4.
2. **Hanya `/api/v1`** lewat `useApi()`. Tidak ada URL `*-api-mysql`, tidak ada `fetch`/`$fetch` langsung.
   Pengecualian tertulis hanya yang ada di `PLAN.md` §1 (Apps Script prakiraan stock, K-06).
3. **Jangan melakukan tulisan** (POST/PUT/PATCH/DELETE) ke API dev atau production — termasuk saat mencoba UI.
   Membaca (GET) ke API lokal boleh. Kalau tidak ada API lokal, cukup lint/typecheck/build.
4. **Keputusan K-xx yang kolom "Keputusan"-nya masih ⬜ = bagian itu TIDAK dibangun.** Tampilkan sebagai
   "Segera" dan sebut ID-nya. Jangan menebak pilihan owner, walau ada rekomendasi.
5. **Nama field persis seperti API.** Teks UI dalam bahasa Indonesia sentence case (DESIGN.md), boleh lebih
   singkat dari teks lama, tapi pesan error dari API ditampilkan apa adanya (`apiErrorMessage`).
6. **Rumus bersama** (`PLAN.md` §4): kalau `{{MODUL}}` pemiliknya, port ke `app/utils/<nama>.ts` sebagai fungsi
   murni yang setia pada rumus lama (sertakan komentar `// Source: laksamana-office/<path>:<baris>`). Kalau
   bukan pemilik, IMPOR — jangan salin. Kalau pemiliknya belum dibangun, berhenti dan laporkan.
7. **Tulisan berversi**: selalu `ifMatch(versi)` + `tanganiKonflik(e, refresh)` (fondasi F1).
8. **Tanpa dependensi npm baru** kecuali yang diizinkan di `PLAN.md` §6 (`tesseract.js` untuk reservasi, face-api untuk absensi #15).
9. **Git**: branch `migrasi/{{MODUL}}` dari `main` terbaru. Commit per layar (atau per 2–3 layar kecil),
   pesan `feat({{MODUL}}): <layar>`. Jangan push, jangan merge.

## 3. Struktur yang harus dihasilkan

```
app/composables/use{{Modul}}.ts         tipe + panggilan API (baca: useAsyncData; tulis: fungsi async)
app/utils/layar/{{MODUL}}.ts            daftar Layar (key = key NAV_DEF lama)
app/pages/{{MODUL}}/index.vue           beranda modul: AppPage + AppFocus (opsional) + ModulMenu
app/pages/{{MODUL}}/<layar>.vue         satu file per layar
app/widgets/{{MODUL}}/*.vue             (opsional) widget Beranda, dari usulan bagian H
app/utils/<rumus>.ts                    hanya bila modul ini pemilik logika bersama
```

Modul berpanel (stock, finance): lihat konvensi `00-fondasi.md` F4. Setiap halaman memakai
`definePageMeta({ access: [...] })` dengan kunci dari `utils/modul.ts` (atau kunci panelnya).
Kalau modul belum ada di `utils/modul.ts` (analytics, radar, investor, help), tambahkan entri
dengan `access` dari `BRANCHES` di `laksamana-office/deploy/index.html` (lihat `README.md` inventaris).

## 4. Aturan tampilan (ringkas — detail di DESIGN.md)

- Satu halaman untuk HP dan desktop. Daftar: `AppList`/`AppListRow` di HP, `UTable` hanya di `lg+`, dari data yang sama.
- Form dan konfirmasi di `ResponsiveSheet`. Maksimal satu `AppFocus` dan satu tombol kuning per layar.
- Status lewat `AppStatus`. Tanpa kartu angka besar, gradien, shadow, emoji, hex, teks kuning.
- Elemen lama yang melanggar DESIGN.md sudah dicatat di bagian H `{{MODUL}}.md` beserta padanannya — ikuti.
- Hak akses di dalam modul (matriks role, admin) → `Layar.boleh` dan `isAdminOf(me,'{{MODUL}}')`.
  Server tetap menolak; ini soal tidak menampilkan yang pasti gagal.

## 5. Langkah kerja

**Langkah 0 — Rencana & pelacak.** Tambahkan di akhir `docs/migrasi/{{MODUL}}.md`:

```markdown
## J. Progres build
Branch: migrasi/{{MODUL}} · Mulai: <YYYY-MM-DD>
LANJUTKAN DARI: —

| layar (key) | file | status | endpoint dipakai | ditunda karena |
|---|---|---|---|---|
```

Isi satu baris per layar dari bagian C (status ⬜). Ubah status modul di `PLAN.md` §3 jadi 🟡. Commit.

**Langkah 1 — Composable.** Tulis `use{{Modul}}.ts` dari tabel E: semua endpoint ✅/⚠️ yang dipakai cakupan
ini, dengan tipe dari kontrak. Endpoint ❌ tidak ditulis. `npm run typecheck`.

**Langkah 2 — Menu.** `utils/layar/{{MODUL}}.ts` + `pages/{{MODUL}}/index.vue`. Setelah ini menu Office
berubah dari "Segera" menjadi bisa dibuka.

**Langkah 3 — Layar satu per satu**, urut bagian C. Untuk setiap layar:
1. baca subbagian D-nya dan aturan F yang menyebut layar itu;
2. bangun halaman: tampilan, filter/cari/urut, aksi, form + validasi, rumus;
3. `npm run lint && npm run typecheck`;
4. perbarui baris layar di tabel J (✅ / ⏸ ditunda + ID K/G) — **langsung, jangan ditumpuk**;
5. commit.

Kalau sesi hampir habis: isi `LANJUTKAN DARI: <layar>, <apa yang sudah/ belum>` di J, commit, lalu laporkan.

**Langkah 4 — Bila menemukan hal baru.**
- API kurang dan belum ada di `_gap-api.md` → tambahkan butir G baru (format sama, dengan bukti), bangun sisanya.
- Inventaris `{{MODUL}}.md` salah → perbaiki di file itu dengan catatan `(koreksi build <tanggal>)`.
- Butuh keputusan produk → tambahkan baris K baru di `_pertanyaan.md` dengan Keputusan ⬜, tunda bagian itu.

**Langkah 5 — Daftar uji cutover.** Tambahkan `## K. Daftar uji cutover` di `{{MODUL}}.md`
(format di `cutover.md` §"Daftar uji per modul"): satu butir per layar dan per aksi tulis, termasuk uji silang
Vue ↔ Office lama.

**Langkah 6 — Tutup.** `npm run lint && npm run typecheck && npm run build`. Centang Definition of Done
(`PLAN.md` §5) satu per satu di laporan. Status di `PLAN.md` §3 → ✅ (atau ⚠️ bila ada layar ditunda),
kolom C0 di `cutover.md` → ✅ hanya bila semua DoD terpenuhi. Commit.

## 6. Laporan akhir (di chat, singkat)

1. Layar selesai / ditunda (dengan ID K/G) / belum (dengan `LANJUTKAN DARI`).
2. Hasil lint, typecheck, build (baris ringkasan).
3. Checklist Definition of Done, per butir ✅/❌.
4. G atau K baru yang kamu tambahkan.
5. Logika bersama yang kamu port atau impor.
6. Yang belum dicek (visual 390/1366, dark mode, uji dengan data nyata).
