# Design language — Laksamana Office

Office dipakai setiap hari, separuh di HP dan separuh di PC. Karena itu tampilannya harus tenang, cepat dibaca, dan terasa seperti aplikasi di HP. Identitasnya diambil dari logo: **kuning, hitam, putih. Flat.**

Referensi hidup: jalankan `npm run dev`, lalu buka **`/styleguide`**. Semua blok di dokumen ini ada di sana, dalam mode terang dan gelap.

## Lima aturan

1. **Kuning hanya untuk sinyal.** Pakai kuning untuk tombol utama, tanda "hari ini", dan hal yang butuh tindakan. Jangan pakai sebagai hiasan, latar kartu, atau warna teks. Teks kuning di atas putih tidak terbaca.
2. **Satu elemen yang menonjol per layar.** Pakai `AppFocus` dengan paling banyak satu tombol kuning. Isinya jawaban untuk pertanyaan "apa yang harus orang ini lakukan sekarang?". Sisanya tenang.
3. **Daftar lebih dulu, kartu belakangan.** Isi disusun sebagai daftar berkelompok (`AppList` + `AppListRow`): baris putih di atas latar abu, dengan garis tipis di antaranya. Tidak ada grid kartu berisi angka besar.
4. **Flat.** Tanpa gradien, tanpa shadow, tanpa garis aksen di tepi kartu. Pemisah antarelemen cukup warna latar dan garis tipis.
5. **Status = titik + kata.** Pakai `<AppStatus color="warning">Menunggu</AppStatus>`. Jangan pakai kotak atau badge berwarna penuh.

## Token

Semua token ada di `app/assets/css/main.css` dan `app/app.config.ts`. **Jangan menulis kode hex atau `bg-[#…]` di komponen.** Kalau butuh warna yang belum ada, tambahkan tokennya, jangan warnanya langsung.

| Peran | Kelas (Nuxt UI / Tailwind) | Catatan |
|---|---|---|
| Latar halaman | `bg-muted` | abu hangat `#F3F3F1`, hitam `#0A0A09` di mode gelap |
| Permukaan (daftar, form, dialog) | `bg-default` | putih, `#161615` di mode gelap |
| Judul, angka penting | `text-highlighted` | hampir hitam |
| Teks biasa | `text-default` | |
| Keterangan, label bagian | `text-muted` | |
| Placeholder, "Segera" | `text-dimmed` | |
| Garis | `border-default`, `divide-default` | |
| Aksi utama | `<UButton>` (color primary, solid) | kuning dengan teks hitam, sudah diatur di app.config |
| Aksi lain | `color="neutral" variant="soft"` / `"outline"` / `"ghost"` | |
| Status | `text-success` / `text-warning` / `text-error` | hanya lewat `AppStatus` |

**Tipografi:** Geist untuk semua teks. Judul halaman `text-3xl lg:text-4xl font-extrabold tracking-tight`, dan ini sudah diatur oleh `AppPage`. Angka yang perlu sejajar (uang, jam, jumlah) memakai class `num` (tabular).

**Ikon:** Lucide (`i-lucide-*`), satu warna, diletakkan di kiri baris. Jangan pakai emoji sebagai ikon.

## Blok bangunan

| Komponen | Dipakai untuk |
|---|---|
| `AppPage` | Pembuka setiap halaman: judul besar, satu baris keterangan, dan tautan kembali (opsional). |
| `AppFocus` | Satu blok yang menonjol per layar. |
| `AppList` / `AppListRow` | Hampir semua isi: daftar, ringkasan, pengaturan, widget beranda. |
| `AppStatus` | Status di dalam baris atau tabel. |
| `ResponsiveSheet` | Form dan konfirmasi. Tampil sebagai bottom sheet di HP dan dialog di desktop. |
| `UTable` | Data tabular, **hanya di desktop**. Di HP, data yang sama ditampilkan dengan `AppList` (contoh: `pages/absensi/index.vue`). |

Komponen Nuxt UI lain (UInput, USelect, UFormField, UTextarea, UButton, dan seterusnya) dipakai langsung. **Jangan membungkusnya** dengan komponen buatan sendiri. Kalau gaya bawaannya perlu diubah, ubah di `app.config.ts` supaya berlaku di semua tempat.

## HP dan desktop

- Titik pisahnya `lg` (1024px). Di bawah itu tampil versi HP: top bar dan tab bar bawah (Beranda, Modul, Profil). Di atasnya tampil sidebar.
- Halamannya sama untuk keduanya, hanya bingkainya yang berganti. Jangan membuat halaman terpisah untuk HP.
- Area sentuh minimal 44px. Tombol utama di HP selebar layar (`AppFocus` dan `ResponsiveSheet` sudah mengaturnya).
- Di desktop, isi boleh dibagi dua kolom (`grid lg:grid-cols-2 gap-x-8`). Jangan lebih dari itu.

## Tulisan

- Bahasa Indonesia sehari-hari. Huruf kapital hanya di awal kalimat: "Absen masuk", bukan "Absen Masuk" atau "ABSEN MASUK".
- Tombol menyebut apa yang terjadi: "Simpan PIN", "Setujui", "Cocokkan". Hindari "OK" atau "Submit".
- Pesan error menjelaskan apa yang salah dan cara memperbaikinya: "PIN baru harus 4–8 angka." Tanpa "Oops!".
- Tulis nama hal seperti yang dikenal kru: "Setoran", "Kas kecil", "Shift", bukan istilah teknis.

## Yang membuat tampilan terasa "AI generik" (hindari)

Emas gradien di atas krem, grid kartu dengan angka raksasa, label kecil huruf kapital di atas setiap bagian, radius besar dan shadow di semua elemen, emoji sebagai penanda, garis aksen warna di tepi kartu, dan hero ungu-biru. Office lama memakai beberapa di antaranya. Office baru tidak.

## Logo

`public/mark.png` (kapal kuning) dipakai di top bar, sidebar, login, dan ikon PWA. Wordmark "LAKSAMANA MUDA" yang dekoratif hanya boleh muncul di logo. Jangan meniru hurufnya untuk judul. Kalau ada panduan merek resmi (kode warna, font), panduan itu yang menang. Perbarui `--color-laksamana-*` di `main.css`.
