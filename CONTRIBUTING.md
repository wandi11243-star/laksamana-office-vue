# Cara kerja di laksamana-office-vue

## Menjalankan

```bash
npm install
cp .env.example .env        # pilih API: lokal, dev, atau production
npm run dev                 # http://localhost:3000
```

- **Masuk** dengan akun Office yang sama (nama atau username + PIN).
- **Style guide:** http://localhost:3000/styleguide (hanya di mode dev).
- **API** adalah [laksamana-api](https://github.com/dwipapap/laksamana-api). Kontrak tiap modul ada di `laksamana-api/docs/api/<modul>.md`. Semua panggilan memakai `/api/v1/...`.
- **CORS:** API hanya menerima origin yang terdaftar di `CORS_ALLOWED_ORIGINS` (`.env` server API).
  - `dev-api` perlu `http://localhost:3000` supaya bisa develop secara lokal.
  - Untuk API lokal: tambahkan `CORS_ALLOWED_ORIGINS=http://localhost:3000` ke `.env` laksamana-api, lalu
    `php artisan serve` (API di `http://127.0.0.1:8000/api/v1`) dan isi `.env` di sini dengan
    `NUXT_PUBLIC_API_BASE=http://127.0.0.1:8000/api/v1`.
  - Database core lokal harus siap dulu sebelum bisa masuk: `php artisan migrate`, lalu
    `php artisan core:import account` (tanpa ini tabel `user`/`modul` kosong dan login selalu gagal).
    Tambah modul lain secukupnya, misalnya `php artisan core:import absensi`.

Sebelum push: `npm run lint && npm run typecheck`. CI menjalankan keduanya ditambah `npm run build`.

## Struktur

```
app/
  assets/css/main.css      token warna + font (satu-satunya tempat warna didefinisikan)
  app.config.ts            gaya bawaan komponen Nuxt UI
  layouts/default.vue      bingkai: sidebar (desktop) / top bar + tab bar (HP)
  middleware/auth.global.ts  wajib login + cek akses modul
  composables/
    useApi.ts              SATU-SATUNYA cara memanggil API (Bearer, 401 -> /login, pesan error)
    useMe.ts               user yang login (GET /me), login(), logout(), hasAccess()
    useModulNav.ts         modul yang boleh dibuka user ini
    use<Modul>.ts          panggilan API + tipe data per modul (contoh: useAbsensi.ts)
  utils/modul.ts           daftar menu modul + kunci akses + widget beranda
  components/App*.vue      blok bangunan design language (lihat DESIGN.md)
  widgets/<modul>/*.vue    widget beranda per modul
  pages/<modul>/           halaman per modul (contoh lengkap: pages/absensi/)
```

## Menambah modul (contoh: Reservasi)

1. **Baca kontraknya:** `laksamana-api/docs/api/reservasi.md`. Menu di Office lama (`NAV_DEF` di `laksamana-office/deploy/reservasi/index.html`) adalah daftar layar yang harus ada.
2. **Buat composable `app/composables/useReservasi.ts`** berisi tipe dan panggilan API.
   - Nama field **sama persis** dengan yang dikirim API. Jangan diganti namanya.
   - Tiru pola di `useAbsensi.ts`: `useAsyncData` untuk bacaan, fungsi biasa (`await useApi()(...)`) untuk tulisan.
3. **Buat halaman `app/pages/reservasi/index.vue`:**
   ```ts
   definePageMeta({ access: ['reservasi'] })   // kunci dari utils/modul.ts
   ```
   Begitu file halaman ada, menu otomatis berubah dari "Segera" menjadi bisa diklik.
4. **Widget beranda (opsional):** buat `app/widgets/reservasi/NamaWidget.vue` (sebuah `AppList`), lalu daftarkan di `widgets` milik entri Reservasi di `utils/modul.ts`.
5. **Admin modul:** `isAdminOf(me, 'reservasi')` untuk menyembunyikan aksi admin. API tetap menolak, jadi ini hanya soal tampilan.

## Aturan

- **Semua panggilan API lewat `useApi()`.** Jangan memakai `fetch` atau `$fetch` langsung dan jangan menulis URL lengkap. Base URL-nya dari `NUXT_PUBLIC_API_BASE`.
- **Error:** tampilkan `apiErrorMessage(e)`. Untuk menangani penolakan tertentu, cek `apiErrorCode(e)` (kode error ada di kontrak API).
- **Konkurensi:** kalau kontrak modul memakai `version` / ETag (`If-Match`), kirim nilainya kembali. Jangan menimpa data orang lain tanpa sadar.
- **Nama user yang sedang bertindak** selalu berasal dari token di sisi API. Jangan mengirimnya dari form.
- **Satu halaman untuk HP dan desktop.** Ikuti DESIGN.md: `AppList` di HP, `UTable` di desktop, `ResponsiveSheet` untuk form.
- **Tanpa library baru** sebelum dibicarakan. Nuxt UI, VueUse, dan Lucide sudah tersedia.
- **Komentar kode dalam bahasa Inggris.** Teks yang dibaca user dalam bahasa Indonesia.

## Build & deploy

- `npm run build` menghasilkan file statis di `.output/public` (SPA dengan fallback `200.html`). `NUXT_PUBLIC_API_BASE` dibaca **saat build**, jadi dev dan production perlu build terpisah.
- **Docker:**
  ```bash
  docker build --build-arg NUXT_PUBLIC_API_BASE=https://api.laksamanamuda.id/api/v1 -t laksamana-office .
  docker run -p 8080:80 laksamana-office
  ```
- `nginx.conf` sudah mengatur fallback SPA dan cache (aset `/_nuxt/` immutable; `sw.js` dan manifest `no-cache`, supaya PWA cepat menerima update).
- Domain production masih placeholder: `office.laksamanamuda.id`. Domain yang dipakai harus masuk ke `CORS_ALLOWED_ORIGINS` di API production.

## Belum ada (sengaja)

Ditambahkan kalau dibutuhkan:
- Halaman "Tugas" lintas modul, karena belum ada endpoint gabungan di API.
- Beranda yang bisa diatur sendiri oleh user (pin atau urutan widget). Ini butuh endpoint `me/preferences` di API.
- Pinia (cukup `useState`), i18n, dan test E2E.
