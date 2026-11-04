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

Sebelum push: `npm run lint && npm run typecheck && for f in tools/uji-*.mjs; do node "$f" || exit 1; done`. CI menjalankan semuanya ditambah `npm run build` dan job `guards` (skrip `uji:*` dengan `STRICT=1`).

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
    useRoster.ts           roster Office: semua User, dan pemegang satu modul
    use<Modul>.ts          panggilan API + tipe data per modul (contoh: useAbsensi.ts)
  utils/
    modul.ts               daftar menu modul + kunci akses + widget beranda
    format.ts              angka, rupiah, tanggal, jam (satu sumber untuk semua modul)
    layar.ts               tipe Layar + pengelompokan menu modul
    versi.ts               ifMatch(), versiDari(), tanganiKonflik() untuk tulisan berversi
  components/App*.vue      blok bangunan design language (lihat DESIGN.md)
  components/ModulMenu.vue daftar layar sebuah modul
  utils/layar/<modul>.ts   layar modul itu (label, ikon, matriks role)
  widgets/<modul>/*.vue    widget beranda per modul
  pages/<modul>/           halaman per modul (contoh lengkap: pages/absensi/)
```

## Menambah modul (contoh: Reservasi)

Rencana dan keputusan migrasi ada di [`docs/migrasi/PLAN.md`](docs/migrasi/PLAN.md);
per modul ada [<modul>.md](docs/migrasi/). Baca `docs/migrasi/<modul>.md` sampai habis
sebelum menulis kode: itu inventaris layar, field, rumus, dan endpoint-nya.

1. **Baca kontraknya:** `laksamana-api/docs/api/<modul>.md`. Menu di Office lama adalah
   daftar layar yang harus ada.
2. **Buat composable `app/composables/use<Modul>.ts`** berisi tipe dan panggilan API.
   - Nama field **sama persis** dengan yang dikirim API. Jangan diganti namanya.
   - Tiru pola di `useAbsensi.ts`: `useAsyncData` untuk bacaan, fungsi biasa
     (`await useApi()(...)`) untuk tulisan.
   - Roster bukan data modul: pakai `useRoster()` (semua User) dan
     `useModulMembers('<modul>')` (pemegang modul) dari `app/composables/useRoster.ts`.
3. **Buat halaman sesuai konvensi layar (fondasi F4):**
   ```
   app/pages/<modul>/index.vue        beranda modul: AppFocus (opsional) + ModulMenu
   app/pages/<modul>/<layar>.vue      satu file per layar, kunci NAV_DEF lama tidak diubah
   app/utils/layar/<modul>.ts         daftar layar: label, desc, icon, to, boleh (matriks role)
   ```
   ```vue
   <script setup lang="ts">
   definePageMeta({ access: ['reservasi'] })   // kunci dari utils/modul.ts
   </script>
   <template>
     <AppPage title="Reservasi" description="…">
       <ModulMenu :layar="LAYAR_RESERVASI" />   <!-- layar tanpa file -> "Segera" -->
     </AppPage>
   </template>
   ```
   Begitu file halaman ada, menu otomatis berubah dari "Segera" menjadi bisa diklik.
4. **Tulisan berversi** (fondasi F1). Baca `version` dari `meta` (`versiDari()`), kirim
   kembali dengan `ifMatch()`, dan tangani penolakan dengan `tanganiKonflik()`:
   ```ts
   const versi = versiDari(res)
   try {
     await useReservasi().updateReservation(id, body, ifMatch(versi!))
   }
   catch (e) {
     if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
   }
   ```
   `409 version_conflict` (versi basi, record terbaru ada di `error.details.current`) dan
   `428 version_required` (versi tidak terkirim) ditangani di situ: muat ulang, jangan menimpa
   dan jangan mengulang tulisan diam-diam.
5. **Format angka, uang, tanggal** lewat `app/utils/format.ts` (`rupiah()`, `angka()`,
   `persen()`, `tglPendek()`, `tglPanjang()`, `jam()`, `hariIni()`), bukan `Intl` sendiri.
6. **Widget beranda (opsional):** buat `app/widgets/<modul>/NamaWidget.vue` (sebuah `AppList`),
   lalu daftarkan di `widgets` milik entri modul di `utils/modul.ts`. Untuk satu baris angka hidup di
   kartu "Dashboard tim", buat `Kartu<Modul>.vue` dan daftarkan di `kartu`. Tim mana yang melihat modul
   ini di depan diatur di `utils/beranda-tim.ts`; timnya sendiri dikirim API (`me.tim`, dicocokkan dari
   kolom Tim oleh `App\Support\Tim` di laksamana-api).
   Modul yang belum siap dipakai diberi `nonaktif: true` di `utils/modul.ts`.
7. **Admin modul:** `isAdminOf(me, '<modul>')` untuk menyembunyikan aksi admin. API tetap menolak,
   jadi ini hanya soal tampilan.
8. **Rumus bersama** (`venue-layouts.ts`, `DanaMasukPanel`, `kwitansi.ts`, dst.) diimpor dari
   `app/utils/` dan `app/components/` milik modul pemiliknya, tidak disalin. Daftar pemiliknya
   ada di `PLAN.md` §4.

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
- **Docker (lokal):** build-arg wajib diisi, `Dockerfile` sengaja tidak punya default.
  ```bash
  docker build --build-arg NUXT_PUBLIC_API_BASE=https://api.laksamanamuda.id/api/v1 -t laksamana-office .
  docker run -p 8080:80 laksamana-office
  ```
- **Image di GHCR** (`.github/workflows/image.yml`), **manual saja** supaya menit Actions repo private tidak habis
  di setiap merge. Buka Actions → **image** → Run workflow (dari `main`):
  - `production` membangun `ghcr.io/dwipapap/laksamana-office-vue:latest` dan `:sha-<7 char>` untuk API production;
  - `dev` membangun `:dev` dan `:dev-sha-<7 char>` untuk `dev-api`.
- **VPS (Dokploy, tipe Compose):** pakai `docker-compose.yaml` di repo ini.
  1. Karena repo private, package GHCR juga private. Di Dokploy → Settings → Registry, tambahkan `ghcr.io` dengan
     username GitHub dan PAT (classic) ber-scope `read:packages`.
  2. Domains: domain Office, container port `80`, HTTPS (Let's Encrypt).
  3. Environment: `OFFICE_TAG=latest` (default). Isi `dev` untuk gladi, atau `sha-<7 char>` untuk mengunci/rollback versi.
  4. Opsional: salin webhook deploy compose itu ke secret repo `DOKPLOY_WEBHOOK_PRODUCTION` (atau `DOKPLOY_WEBHOOK_DEV`),
     supaya Dokploy redeploy otomatis setelah run selesai. Tanpa secret itu, tekan **Deploy** di Dokploy.
- `nginx.conf` sudah mengatur fallback SPA dan cache (aset `/_nuxt/` immutable; `sw.js` dan manifest `no-cache`, supaya PWA cepat menerima update).
- Domain production masih placeholder: `office.laksamanamuda.id`. Domain yang dipakai harus masuk ke `CORS_ALLOWED_ORIGINS` di API production.

## Belum ada (sengaja)

Ditambahkan kalau dibutuhkan:
- Halaman "Tugas" lintas modul, karena belum ada endpoint gabungan di API.
- Beranda yang bisa diatur sendiri oleh user (pin atau urutan widget). Ini butuh endpoint `me/preferences` di API.
- Pinia (cukup `useState`), i18n, dan test E2E.
