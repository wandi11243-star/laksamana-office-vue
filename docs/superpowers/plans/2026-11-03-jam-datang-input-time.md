# Jam datang UInputTime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Field "Jam datang" di `/reservasi/input` memakai `UInputTime` Nuxt UI yang selalu 24 jam dan terkunci ke kelipatan 5 menit.

**Architecture:** Satu file halaman diubah: `UInput` teks + `<datalist id="opsi-jam">` diganti `UInputTime` (`hourCycle=24`, step menit 5 + `stepSnapping`), di-wire ke `form.time` (string `HH:MM`) lewat computed perantara; default booking baru `19:00`; nilai lama non-kelipatan dibulatkan dengan info ke user.

**Tech Stack:** Nuxt 4 + Nuxt UI v4 `UInputTime` (reka-ui TimeField, `@internationalized/date` sudah terbundel — tanpa dependensi baru).

**Spec:** `docs/superpowers/specs/2026-11-03-jam-datang-input-time-design.md`

## Global Constraints

- `laksamana-office/` read-only, backend tidak diubah, format simpan tetap string `HH:MM` mentah.
- Tanpa hex/gradient, tanpa style `dark:`, ikon Lucide, copy UI Indonesia sentence case, komentar kode Inggris.
- Cek visual 390px & 1366px di browser (lint/typecheck/test ditunda sampai user bilang selesai — mode perbaikan visual).
- Tanpa dependensi baru.

## Review Focus

- Ketik menit ganjil lalu blur/Enter: nilai snap ke kelipatan 5 terdekat dan user diberi tahu (bukan diam-diam).
- Field dikosongkan: validasi wajib tetap berbunyi "Lengkapi field wajib: Jam Datang", bukan crash.
- Buka edit booking lama bervalue `19:03`: field menampilkan `19:05` + info pembulatan sekali saat load.
- `00:00`/`23:55` (batas): tetap valid dan tersimpan apa adanya.
- Paste `19.30`/`1930`/`7`: tetap diterima lalu di-snap (parity toleransi lama), bukan ditolak.

---

### Task 1: Ganti UInput jam jadi UInputTime terkunci 5 menit

**Files:**
- Modify: `app/pages/reservasi/input.vue:744-757` (field "Jam datang")
- Modify: `app/pages/reservasi/input.vue:694-700` (hapus `<datalist id="opsi-jam">`)
- Test: browser `http://127.0.0.1:3000/reservasi/input` (dev server jalan ke `https://dev-api.laksamanamuda.id/api/v1`)

**Interfaces:**
- Consumes: `form.time: string` (`HH:MM`, `app/pages/reservasi/input.vue:62-66`); `normTime(s: string): string` (`app/utils/format.ts:112-142`); pemicu cek bentrok yang membaca `form.time` (watch baris ~211-213, `cekMejaServer`/`conflictCheck` baris ~377-430).
- Produces: computed perantara `jamValue` (TimeValue ↔ string) yang dipakai Task 2 untuk default/pembulatan.

- [ ] **Step 1: Tambah computed `jamValue` di `app/pages/reservasi/input.vue` (dekat `form`, ~baris 82)**

```ts
import { parseTime } from '@internationalized/date'
// get: form.time valid ? parseTime(form.time) : parseTime('19:00')
// set: form.time = value ? value.toString().slice(0, 5) : ''
```

Jika import `@internationalized/date` tidak ter-resolve, fallback: ambil `Time`/`parseTime` dari `reka-ui` yang pasti ada (cek `node_modules/reka-ui` dulu) — tetap tanpa dependensi baru.

- [ ] **Step 2: Ganti blok field baris 744-757 menjadi `UInputTime`**

```vue
<UFormField label="Jam datang" required help="Kelipatan 5 menit, mis. 19:00 atau 19:05">
  <UInputTime
    v-model="jamValue"
    hour-cycle="24"
    granularity="minute"
    :step="{ minute: 5 }"
    step-snapping
    locale="id"
    icon="i-lucide-clock"
    size="xl"
    class="w-full"
    @blur="snapJamKeLima"
  />
</UFormField>
```

Hapus `<datalist id="opsi-jam">` (baris 694-700). `snapJamKeLima()`: bulatkan menit `form.time` ke kelipatan 5 terdekat (via `normTime` lalu koreksi menit `% 5`), pertahankan `form.time` bila sudah kelipatan 5. Verifikasi di browser bahwa `stepSnapping` + ketik manual menit ganjil + blur menghasilkan snap; bila `stepSnapping` tidak snap saat ketik, `snapJamKeLima` yang menjamin (jangan dua mekanisme yang berkonflik — blur handler adalah penjamin terakhir).

- [ ] **Step 3: Verifikasi di browser (tanpa lint/typecheck/test)**

Buka `http://127.0.0.1:3000/reservasi/input`, ketik `19:03` → blur → field menjadi `19:05`; paste `1930` → menjadi `19:30`; ketik `25:99` → tidak jadi `23:59` diam-diam (tolak/kembalikan dengan galat yang jelas); `00:00` dan `23:55` tetap valid dan tersimpan apa adanya; kosongkan → simpan menampilkan "Lengkapi field wajib: Jam Datang". Cek 390px & 1366px.
Expected: PASS semua perilaku di atas; cek bentrok meja tetap terpicu saat jam berubah.

- [ ] **Step 4: Commit**

```bash
git add app/pages/reservasi/input.vue
git commit -m "feat(reservasi): kunci jam datang ke kelipatan 5 menit via UInputTime"
```

### Task 2: Default 19:00 + bulatkan nilai lama dengan info

**Files:**
- Modify: `app/pages/reservasi/input.vue:66` (`time: '00:00'`) dan `:127` (`time: r.time || '00:00'`)
- Test: browser mode baru + mode edit (`/reservasi/input?id=...` booking bervalue menit ganjil)

**Interfaces:**
- Consumes: `jamValue` + `snapJamKeLima` dari Task 1.
- Produces: tidak ada (ujung rantai).

- [ ] **Step 1: Ubah default booking baru `time: '00:00'` → `time: '19:00'` (baris 66)**

Satu baris, parity default aplikasi lama (`timePickerHtml` default `19:00`).

- [ ] **Step 2: Di `isiForm` (baris ~127), bulatkan nilai lama non-kelipatan dengan info**

```ts
time: snapJamKeLima(r.time || '19:00') // + toast/info "Jam dibulatkan ke 19:05" bila berubah
```

Gunakan `useToast` yang sudah ada di file (baris ~44). Info muncul sekali saat load edit, bukan tiap render.

- [ ] **Step 3: Verifikasi di browser (tanpa lint/typecheck/test)**

Booking baru: field terisi `19:00`. Edit booking `19:03`: tampil `19:05` + info pembulatan; simpan menyimpan `19:05`. Edit booking `19:00`: tanpa info, tanpa perubahan.
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/pages/reservasi/input.vue
git commit -m "feat(reservasi): default jam 19:00 dan bulatkan nilai lama ke kelipatan 5"
```

### Task 3: Panel popup JAM | MENIT 1:1 aplikasi lama

**Files:**
- Modify: `app/pages/reservasi/input.vue` (blok field "Jam datang" Task 1 — ganti `UInputTime` jadi tombol + `UPopover` dua kolom; helper `jamValue`/`snapJamKeLima`/`bagiJamMentah` dipakai ulang, tidak ditulis ulang)
- Test: browser `http://127.0.0.1:3000/reservasi/input` (dev server jalan ke `https://dev-api.laksamanamuda.id/api/v1`)

**Interfaces:**
- Consumes: `form.time: string (HH:MM)`, `jamValue`, `snapJamKeLima`, `bagiJamMentah` dari Task 1; pola popup/sheet yang sudah ada di repo bila ada (`ResponsiveSheet` dipakai di halaman ini).
- Produces: tidak ada (ujung rantai; presentasi saja, kontrak data tidak berubah).

**Catatan final-review (kerjakan dalam task ini, 2–3 baris per item):**
- F1: `bagiJamMentah` harus toleran segmen detik (`HH:MM:SS` → pakai HH:MM bila detik 0–59), agar booking lama `19:00:00` tetap bisa dibuka dan disimpan.
- F2: toast `isiForm` hanya bila menit BERUBAH (bandingkan menit hasil snap vs menit terparse, bukan string mentah vs hasil), agar normalisasi format murni (`"7"` → `"07:00"`) tidak memicu toast "dibulatkan".

- [ ] **Step 1: Ganti `UInputTime` jadi tombol + popup dua kolom**

Field tetap `UFormField` label "Jam datang" required, help "Kelipatan 5 menit, mis. 19:00 atau 19:05".
Tombol (penuh lebar field, ikon `i-lucide-clock`, size xl) menampilkan `form.time` (atau `jamValue` yang tervalidasi) dan membuka popup berisi dua kolom tombol: JAM `00`–`23` | MENIT `00, 05, …, 55` (12 tombol). Klik jam set jam (menit dipertahankan), klik menit set menit + tutup popup. Pilihan aktif ditandai (variant solid vs soft/outline, tanpa hex). Nilai ditulis lewat `snapJamKeLima` agar kontrak kelipatan-5 dan penolakan invalid tetap berlaku; perubahan tetap memicu cek bentrok (tulis ke `form.time`). Gunakan `UPopover`; bila di 390px sempit/bermasalah, `ResponsiveSheet` (sudah dipakai di file ini) sebagai alternatif — pilih satu yang konsisten dengan repo. Kolom JAM/MENIT: scroll vertikal bila perlu (`max-h` + overflow), touch-friendly (`min-h` per tombol).

- [ ] **Step 2: Terapkan F1 + F2 (final-review fixes)**

F1 di `bagiJamMentah`: terima `p.length === 3` bila segmen detik numerik 0–59 (abaikan detik). F2 di `isiForm`: bandingkan menit, bukan string.

- [ ] **Step 3: Verifikasi di browser (tanpa lint/typecheck/test)**

Buka popup → terlihat dua kolom seperti gambar lama; klik jam 19 lalu menit 05 → field `19:05`; buka ulang → 19 dan 05 tertandai aktif. Booking baru default `19:00`. Edit `19:03` → `19:05` + toast sekali; edit `"7"` → `07:00` TANPA toast; legacy `19:00:00` bisa dibuka dan disimpan. Kosongkan (`form.time = ''` — bila tombol mengizinkan hapus/reset; bila tidak ada jalur hapus, lewati) → simpan menampilkan "Lengkapi field wajib: Jam Datang". Cek 390px & 1366px terang.
Expected: PASS semua; cek bentrok tetap terpicu saat jam berubah.

- [ ] **Step 4: Commit**

```bash
git add app/pages/reservasi/input.vue
git commit -m "feat(reservasi): panel JAM-MENIT popup untuk jam datang"
```
