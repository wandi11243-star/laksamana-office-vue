# Task→Konten Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Task mandiri di antrean konten bisa ditautkan ke item konten; baris tertaut diklik langsung ke detail kontennya (shooting/design/editing sekaligus via komponen bersama).

**Architecture:** Dua file inti + satu tipe: `app/utils/konten.ts` (`ProdTask.contentId?` + bawa lewat `barisAntrian` + helper judul), `app/components/KontenAntrian.vue` (`buka()` + badge), `app/components/KontenTugasForm.vue` (picker + simpan). Tanpa ubah backend (JSON blob). Kontrak simpan task tidak berubah selain satu field.

**Tech Stack:** Nuxt 4 + Nuxt UI v4, `listKonten()` server-search, `router.push('/konten/detail/'+id)`.

**Spec:** `docs/superpowers/specs/2026-11-03-task-konten-link-design.md`

## Global Constraints

- `laksamana-office/` read-only; backend TIDAK diubah; format simpan task tetap JSON mentah + satu field `contentId`.
- Tanpa hex/gradient, tanpa style `dark:`, ikon Lucide, copy Indonesia sentence case, komentar Inggris.
- Cek visual 390px & 1366px di browser (lint/typecheck/test/commit ditunda sampai user bilang selesai).
- Tanpa dependensi baru.

## Review Focus

- Ketuk baris task tertaut → `/konten/detail/{id}` yang benar (bukan id task), tanpa membuka form.
- Task tanpa tautan → tetap buka form edit seperti semula; badge tautan tidak muncul.
- Simpan task baru dengan tautan → `contentId` tersimpan (reload/edit ulang masih tertaut); hapus tautan (kosongkan picker) → kembali mandiri.
- Konten tertaut yang sudah dihapus → baris tidak crash; tampil fallback yang jelas, klik tidak ke halaman mati.
- Picker mencari judul yang cocok (server-search), tidak memuat seluruh database ke klien.

---

### Task 1: Tipe + routing + badge (tanpa picker)

**Files:**
- Modify: `app/utils/konten.ts` (`ProdTask` tambah `contentId?: string`; `BarisAntrian` bawa `contentId?`; `barisAntrian()` teruskan dari task; helper `judulKonten(id)` client-side via daftar content yang sudah ada)
- Modify: `app/components/KontenAntrian.vue` (`buka()`: task dengan `contentId` → `router.push('/konten/detail/'+contentId)`; badge judul konten di sel judul baris tertaut)
- Test: browser `/konten/shooting`, `/konten/design`, `/konten/editing` (atau halaman antreannya)

**Interfaces:**
- Consumes: `BarisAntrian`, `barisAntrian()` (ada); daftar `st.value.content` untuk lookup judul.
- Produces: `contentId` mengalir task → baris → `buka()` + badge; dipakai Task 2 (form menulis field ini).

- [ ] **Step 1: Tambah `contentId?` + teruskan ke baris + routing + badge**

`ProdTask` tambah `contentId?: string` (komentar: id KontenItem terkait, blob JSON, tanpa filter server-side). `BarisAntrian` tambah `contentId?: string`; `barisAntrian()` isi dari task. `buka()`: cabang task — bila `r.contentId` → `router.push('/konten/detail/' + r.contentId)`, else form lama. Badge di sel judul (desktop + mobile): bila tertaut tampilkan judul konten (lookup `st.value.content`, fallback id-ringkas bila konten tak ditemukan) — jangan crash bila konten dihapus.

- [ ] **Step 2: Verifikasi di browser (tanpa lint/typecheck/test/commit)**

Siapkan satu task dengan `contentId` manual (sementara via devtools/payload — catat caranya di laporan, HAPUS data uji sesudahnya HANYA bila itu data dev; jangan sentuh produksi): ketuk baris → detail konten benar; task tanpa tautan → form lama. Cek 390px & 1366px terang.
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/utils/konten.ts app/components/KontenAntrian.vue
git commit -m "feat(konten): task tertaut ke detail konten"
```

### Task 2: Picker "Konten terkait" di form task

**Files:**
- Modify: `app/components/KontenTugasForm.vue` (field picker + sertakan `contentId` di `simpan()`; preset saat edit)
- Test: browser form tambah/ubah task dari antrean

**Interfaces:**
- Consumes: `contentId` dari Task 1; `listKonten()` server-search (`app/composables/useKonten.ts`); pola opsi `USelect` repo.
- Produces: tidak ada (ujung rantai).

- [ ] **Step 1: Tambah picker + simpan + preset**

Field "Konten terkait" (opsional, bisa dikosongkan = mandiri): cari judul via `listKonten()` server-side (jangan muat semua ke klien); simpan `contentId` bersama field lain (tugas baru + edit; edit mempertahankan bila tak diubah); preset menampilkan judul saat edit task tertaut. Kosongkan picker = hapus tautan. Validasi konten se-`kind` hanya bila murah, else lewati dan catat.

- [ ] **Step 2: Verifikasi di browser (tanpa lint/typecheck/test/commit)**

Buat task baru + pilih konten → simpan → baris di antrean berbadge + ketuk → detail benar. Ubah task: ganti tautan, kosongkan tautan. Konten yang dihapus → fallback jelas. Cek 390px & 1366px terang.
Expected: PASS semua.

- [ ] **Step 3: Commit**

```bash
git add app/components/KontenTugasForm.vue
git commit -m "feat(konten): picker konten terkait di form task"
```
