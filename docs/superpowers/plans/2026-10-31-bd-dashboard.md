# BD Dashboard unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Susun ulang `app/pages/bd/dashboard.vue` menjadi satu alur pagi (sapaan → fokus → kolom 3-hari → daftar aksi → strip angka).

**Architecture:** Tetap satu file page + widget yang sudah dipakai (`BdTaskRow`, `BdProjMini`, `BdTaskSheet`, `BdKonfirmasi`); tambah computed tanggal/agenda/deadline dari `state` yang sama; tanpa endpoint, tanpa file baru kecuali bila satu seksi melewati ~120 baris (maka ekstrak widget `BdHariKolom`).

**Tech Stack:** Nuxt 4 + Nuxt UI v4 + Tailwind v4 (Vue), blok App* + DESIGN.md.

**Spec:** `docs/superpowers/specs/2026-10-31-bd-dashboard-design.md` — rencana berargumen dari spec; eksekutor membaca keduanya.

## Global Constraints

- Blok App* + DESIGN.md; copy UI Indonesia; komentar kode Inggris.
- Tanpa endpoint baru; tanpa dependensi baru; `useApi()` bila perlu (tidak perlu di sini).
- Dilarang menyentuh data hidup; kerja lawan API lokal/mock.
- Tiap task ditutup `npm run lint && npm run typecheck` + cek browser 390px & 1366px terang (tanpa test runner di repo Vue ini).
- Antislop active: during (session override); dial ENERGY 2 / RHYTHM 2 / MOTION 1; tanpa hex, tanpa gradient, light-only, kontras AA, keyboard.

## Review Focus

- Tengah malam / batas hari: task deadline tepat hari ini harus masuk kolom Hari ini, bukan Besok — bandingkan string `YYYY-MM-DD` (`deadline === iso`), jangan `Date` lokal. Diuji: Task 2 (tiga task: kemarin/hari ini/besok → kolom benar).
- Daftar panjang tanpa batas: kolom hari & daftar aksi dibatasi (maks 6/baris + link "lihat semua" ke rute yang sudah ada), jangan render ratusan baris. Diuji: Task 2–3 (lebih dari 6 item → terpotong + link ada).
- "Menunggu respons" bocor ke bukan-reviewer: hanya `menungguReviewSaya` yang tampil; user biasa tak boleh melihat antrean review orang lain. Diuji: Task 3 (login non-reviewer → seksi kosong dengan empty-state).
- Agenda tanpa tanggal valid: agenda `date` kosong/rusak tidak boleh merusak kolom hari (saring + hitung hanya yang sah). Diuji: Task 2 (satu agenda tanggal rusak → diabaikan, kolom tetap render).
- Aksi "Agenda" mati: tombol harus menuju form agenda yang nyata (rute kalender), bukan placeholder. Diuji: Task 1 (klik → rute kalender/agenda terbuka).

---

### Task 1: Sapaan + aksi cepat + fokus

**Files:**
- Modify: `app/pages/bd/dashboard.vue` (blok `AppPage` ~101-144)

**Interfaces:**
- Consumes: `me` (nama), `hari`/`todayISO`, `fokus/syncFokus/fokusUbah/suntingFokus`, `baru()` (sheet sudah ada)
- Produces: — (struktur kepala; Task 2–4 menempel di bawahnya)

- [ ] **Step 1: Ganti kepala `AppPage`** jadi sapaan ("Halo, {namaDepan}") + tanggal (`fTgl(hari)`) + deskripsi satu baris; `#actions` berisi "Tugas Baru" (panggil `baru()`) + "Agenda" (link ke rute agenda kalender yang sudah ada).
- [ ] **Step 2: Pertahankan panel Fokus** apa adanya di bawah sapaan.
- [ ] **Step 3:** `npm run lint && npm run typecheck` — bersih.
- [ ] **Step 4:** Cek browser: sapaan + tanggal benar, kedua tombol bekerja (Agenda membuka rute kalender), 390px & 1366px.
- [ ] **Step 5:** Commit — `feat(bd): sapaan dan aksi cepat dashboard`.

### Task 2: Kolom Hari ini / Besok / Lusa

**Files:**
- Modify: `app/pages/bd/dashboard.vue` (tambah computed + seksi kolom; pakai `tambahHari` dari `~/utils/format` bila ada, else hitung `YYYY-MM-DD` manual)

**Interfaces:**
- Consumes: `state.agenda`, `aktif`, `hari`
- Produces: `kolomHari: { label, iso, agenda, deadline }[]` — dipakai Task 4 (link "lihat semua" tidak perlu; tiap kartu klik buka sheet/detail yang sudah ada)

- [ ] **Step 1: Tambah computed** `isoBesok`, `isoLusa`, `kolomHari` (agenda by `date === iso`, deadline by `deadline === iso`; abaikan tanggal tak valid).
- [ ] **Step 2: Render 3 kolom** (AppPanel per hari atau satu panel 3-kolom desktop / tumpuk HP): tiap item agenda → baris judul + tipe; tiap deadline → `BdTaskRow` ringkas; kosong → "Tidak ada agenda/deadline"; maks 6 + link ke My Task/kalender bila lebih.
- [ ] **Step 3:** Verifikasi batas hari (kemarin/hari ini/besok) + agenda rusak diabaikan + potong 6 item.
- [ ] **Step 4:** `npm run lint && npm run typecheck` — bersih.
- [ ] **Step 5:** Commit — `feat(bd): kolom tiga hari dashboard`.

### Task 3: Daftar aksi (tanpa deadline, menunggu respons, project berjalan)

**Files:**
- Modify: `app/pages/bd/dashboard.vue` (tiga panel di bawah kolom hari)

**Interfaces:**
- Consumes: `aktif`, `menungguReviewSaya` (`app/utils/bd-rumus.ts`), `jalan`, `BdTaskRow`, `BdProjMini`, sheet yang sudah ada
- Produces: — (akhir alur triase)

- [ ] **Step 1: Panel "Belum ada deadline"** (list `aktif` tanpa deadline + count): tiap baris tombol "Atur deadline" inline membuka `BdTaskSheet` pada task itu.
- [ ] **Step 2: Panel "Menunggu respons"** (list `menungguReviewSaya(aktif)`): baris membuka sheet; kosong → empty-state ("Tidak ada yang menunggu jawabanmu").
- [ ] **Step 3: Panel "Project berjalan"** (reuse pola `jalan` + `BdProjMini` yang sudah ada di halaman ini; pindahkan dari posisi lama ke sini).
- [ ] **Step 4:** Verifikasi: non-reviewer melihat seksi respons kosong; tombol Atur deadline menyimpan.
- [ ] **Step 5:** `npm run lint && npm run typecheck` — bersih.
- [ ] **Step 6:** Commit — `feat(bd): daftar aksi dashboard`.

### Task 4: Strip angka + bersih-bersih

**Files:**
- Modify: `app/pages/bd/dashboard.vue` (pindahkan `AppStatGrid` + panel Prioritas/Kesehatan/Overdue/Agenda lama)

**Interfaces:**
- Consumes: semua computed Task 1–3 + `AppStat`/`top`/`od`/`agHariIni`/`dueHariIni` yang sudah ada

- [ ] **Step 1: Pindahkan 5 `AppStat`** menjadi strip kondisi di bawah daftar aksi (tanpa ubah rumus); hapus panel Prioritas/Kesehatan/Overdue/Agenda yang digantikan kolom/daftar baru (kesehatan project tetap terwakili panel Project berjalan; overdue terwakili kolom hari + daftar).
- [ ] **Step 2: Hapus kode mati** (computed/template yang tak lagi dipakai: `top`, `od`, `agHariIni`, `dueHariIni`, panel terkait) — jangan sisakan referensi yatim.
- [ ] **Step 3:** Verifikasi akhir browser 390px & 1366px + keyboard (Tab mencapai semua tombol/link, sheet tertutup Escape).
- [ ] **Step 4:** `npm run lint && npm run typecheck` — bersih.
- [ ] **Step 5:** Commit — `feat(bd): strip angka dan bersih-bersih dashboard`.
