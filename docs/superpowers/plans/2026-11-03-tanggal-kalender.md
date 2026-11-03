# Tanggal Kalender + Pintasan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Field tanggal di form utama reservasi dan dialog edit-cepat memakai kalender popup Nuxt UI + pintasan Hari Ini/Besok/Lusa, tanggal lampau tidak bisa diklik.

**Architecture:** Dua file diubah, masing-masing satu tugas: `app/pages/reservasi/input.vue` (field "Tanggal reservasi") dan `app/components/reservasi/ReservasiEditCepat.vue` (bagian tanggal). Keduanya: tombol label Indonesia + `ResponsiveSheet` berisi deretan pintasan + `UCalendar` (`locale="id"`, `minValue` = hari ini / tanggal lama bila edit-lampau), wiring string `YYYY-MM-DD` ↔ `DateValue` via `parseDate` dari `@internationalized/date` (sudah terbundel — tanpa dependensi baru). Kontrak `form.date: string` tidak berubah sehingga watcher denah, cek bentrok, dan payload API ikut jalan.

**Tech Stack:** Nuxt 4 + Nuxt UI v4 (`UCalendar`, `ResponsiveSheet`), `@internationalized/date` (bundled).

**Spec:** `docs/superpowers/specs/2026-11-03-tanggal-kalender-design.md`

## Global Constraints

- `laksamana-office/` read-only, backend tidak diubah, format simpan tetap string `YYYY-MM-DD` mentah.
- Tanpa hex/gradient, tanpa style `dark:`, ikon Lucide (kalender: `i-lucide-calendar`), copy UI Indonesia sentence case, komentar kode Inggris.
- Cek visual 390px & 1366px di browser (lint/typecheck/test/commit ditunda sampai user bilang selesai).
- Tanpa dependensi baru.

## Review Focus

- Ketuk tanggal lampau: tidak bisa dipilih (tombol disabled) untuk booking baru; edit booking lampau: tanggal lamanya tetap tampil dan tersimpan bila tidak diubah.
- Pintasan Besok dari tanggal 30 Juni → 1 Juli (lintas bulan) dan 31 Des → 1 Jan (lintas tahun), tanpa geser zona waktu.
- Buka edit booking 5 Nov → kalender terbuka di bulan November (bukan bulan hari ini) dengan 5 Nov tertandai.
- Pilih tanggal berbeda lalu Simpan: denah, cek bentrok, dan payload memakai tanggal baru (tidak ada state basi).
- Bahasa Indonesia: header hari Min–Sab, label tombol "Sen, 3 Nov 2026", pintasan "Hari ini/Besok/Lusa".

---

### Task 1: Kalender + pintasan di form utama (`input.vue`)

**Files:**
- Modify: `app/pages/reservasi/input.vue` (field tanggal ~baris 818-824; `form.date` default baris ~65; validasi ~429-430 TIDAK diubah)
- Test: browser `http://127.0.0.1:3000/reservasi/input` (dev server jalan ke `https://dev-api.laksamanamuda.id/api/v1`)

**Interfaces:**
- Consumes: `form.date: string (YYYY-MM-DD)`; `hariIni()` (`app/utils/format.ts:99-102`); watcher denah + `cekMejaServer`/`fieldForm` yang membaca `form.date` (tidak diubah).
- Produces: pola tombol + sheet + bridge `parseDate` yang dipakai ulang Task 2 (nama helper + file bila diekstrak — bila helper dibuat di file ini, Task 2 menyalin pola, bukan impor lintas halaman, kecuali ekstraksi ke `app/utils/` jelas lebih rapi; putuskan saat implementasi dan catat di laporan).

- [ ] **Step 1: Ganti `UInput type="date"` jadi tombol + `ResponsiveSheet` kalender**

Tombol penuh lebar field (ikon `i-lucide-calendar`, size xl): label format Indonesia panjang dari `form.date` (mis. "Sen, 3 Nov 2026"). Sheet "Pilih tanggal": deretan 3 tombol pintasan (Hari ini/Besok/Lusa) + `UCalendar locale="id"` dengan `minValue` = `parseDate(hariIni())` (mode tambah) atau `parseDate(min(form.date, hariIni()))` (mode edit). Pilih tanggal → tulis string `YYYY-MM-DD` ke `form.date` → tutup sheet. Tanggal lampau tampil disabled. Kalender dibuka pada bulan `form.date` (bukan selalu bulan berjalan).

- [ ] **Step 2: Verifikasi di browser (tanpa lint/typecheck/test/commit)**

Booking baru: tombol "Hari ini, …"; pintasan Besok → tanggal +1 (cek lintas bulan bila memungkinkan); ketuk tanggal lampau → tidak bisa; pilih 5 Des → field "Jum, 5 Des 2026", denah ikut ganti, simpan memakai tanggal itu. Edit booking lampau: tanggal lama tampil, bisa disimpan tanpa diubah. Cek 390px & 1366px terang.
Expected: PASS semua.

- [ ] **Step 3: Commit**

```bash
git add app/pages/reservasi/input.vue
git commit -m "feat(reservasi): kalender popup + pintasan untuk tanggal"
```

### Task 2: Kalender + pintasan di edit-cepat (`ReservasiEditCepat.vue`)

**Files:**
- Modify: `app/components/reservasi/ReservasiEditCepat.vue` (bagian tanggal saja — struktur persisnya dicek saat implementasi; bagian jam + logika simpan TIDAK disentuh)
- Test: browser dialog edit-cepat dari dashboard reservasi

**Interfaces:**
- Consumes: pola Task 1 (lihat laporan Task 1 untuk nama helper/struktur final); prop tanggal yang dipakai komponen ini (baca di file — catat di laporan bila beda dari `form.date`).
- Produces: tidak ada (ujung rantai).

- [ ] **Step 1: Ganti input tanggal native jadi tombol + sheet kalender + pintasan**

Pola sama seperti Task 1 (tombol label Indonesia + sheet + `UCalendar locale="id"` + Hari ini/Besok/Lusa + `minValue` hari ini). Hanya bagian tanggal; jam dan simpan tidak disentuh. Bila helper Task 1 diekstrak ke `app/utils/`, pakai ulang; bila tidak, salin pola minimal dan catat di laporan.

- [ ] **Step 2: Verifikasi di browser (tanpa lint/typecheck/test/commit)**

Dari dashboard → edit-cepat booking: tanggal tampil benar; pintasan Besok → +1 hari; pilih tanggal → simpan memakai tanggal baru; tanggal lampau tidak bisa diklik. Cek 390px & 1366px terang.
Expected: PASS semua.

- [ ] **Step 3: Commit**

```bash
git add app/components/reservasi/ReservasiEditCepat.vue
git commit -m "feat(reservasi): kalender popup + pintasan di edit-cepat"
```
