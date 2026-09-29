# Design language — Laksamana Office

**Office Vue memakai tata letak dan warna Office lama** (`laksamana-office/deploy/…`), atas permintaan
mentor (29 September 2026). Kru yang berpindah antara Office lama dan Vue harus merasa berada di tempat
yang sama: sidebar per modul, kartu statistik berwarna, tabel berkepala coklat tua, krem dan emas.
Yang berubah dari Office lama hanya hal yang memang cacat di sana: **emoji diganti ikon Lucide**,
kontras dibetulkan, dan HP mendapat daftar kartu, bukan tabel yang digeser ke samping.

Referensi hidup: `npm run dev`, buka **`/styleguide`**. Contoh layar lengkap: modul Reservasi
(`app/pages/reservasi/*`), dibandingkan dengan tangkapan layar Office lama.

> Aturan ini mengikat semua modul. Membangun modul baru = membuka layar lamanya, lalu menyusun ulang
> layar itu dengan blok di bawah, **dengan urutan, kolom, dan pengelompokan yang sama**.

## Tujuh aturan

1. **Tiru susunan layar lama.** Urutan bagian, kolom tabel, isi kartu statistik, dan letak tombol
   mengikuti layar lama (U1 paritas). Yang boleh berbeda: ikon, kontras, dan tampilan HP.
2. **Ikon, bukan emoji.** Setiap emoji lama (📋 ✅ 💰 📞 ⚠️ 🍽️ …) diganti ikon Lucide (`i-lucide-*`) di
   posisi yang sama. Emoji hanya boleh di **isi pesan WhatsApp** yang dikirim ke tamu.
3. **Emas = aksi dan tanda aktif.** Tombol utama, tombol `+` di top bar, menu aktif, pil terpilih,
   judul bagian form. Teks emas di atas terang selalu `primary-700` (kontras ≥ 4,5:1), bukan emas cerah.
4. **Warna status punya arti tetap** (sama seperti lama): kuning/`warning` = menunggu (Pending, belum
   dicek), biru/`info` = terkonfirmasi / kapasitas / orang, hijau/`success` = datang / terverifikasi /
   baik, merah/`error` = perlu tindakan / ditolak / no-show, ungu/`vip` = VIP / sharing, emas = hitungan
   netral. Status selalu **ikon + kata**, tidak pernah warna saja.
5. **Satu sumber per status.** Warna & ikon status reservasi: `app/utils/status-reservasi.ts`.
   Modul lain membuat file yang sama untuk statusnya sendiri, bukan peta di tiap halaman.
6. **Tabel di desktop, kartu di HP.** Data tabular: `UTable` (`lg+`) dengan kepala gelap; di bawah `lg`
   baris yang sama tampil sebagai daftar kartu. Tabel desktop harus muat tanpa geser di 1366px:
   gabungkan kolom sekunder ke kolom tetangganya di bawah 1536px bila perlu (contoh: Dashboard Reservasi).
7. **Tanpa hex di komponen.** Semua warna dari token (`main.css`) dan kelas Nuxt UI.

## Token (`app/assets/css/main.css`)

Palet diambil dari variabel Office lama (`deploy/reservasi/index.html:62-73`).

| Peran | Kelas | Terang | Gelap |
|---|---|---|---|
| Latar halaman ("paper") | `bg-muted` | `#F7F6F4` | `#14120F` |
| Permukaan (panel, kartu, form) | `bg-default` | `#FFFFFF` | `#1E1B17` |
| Garis | `border-default` | `#E7E1D3` | `#3A342B` |
| Teks utama / judul | `text-highlighted` | `#2A2620` | `#FAF6EE` |
| Teks biasa | `text-default` | `#2A2620` | `#E6DFD2` |
| Keterangan | `text-muted` | `#5C574D` | `#B5AC9B` |
| Placeholder, "Segera" | `text-dimmed` | `#7D776B` | `#938A7B` |
| Emas tombol | `bg-primary` (600) | `#93691A` teks putih | `#C8961F` teks gelap |
| Emas sebagai teks | `text-primary-700` / `dark:text-primary-300` | `#7A560F` | `#DDBF74` |
| Emas lembut (menu aktif, pil) | `bg-primary-100` / `dark:bg-primary-950` | `#F2E9D3` | |
| Kepala tabel | `bg-table-head` + `text-table-head-text` | `#2A2620` + putih | `#0F0D0B` |
| Status | `text-/bg-success·warning·error·info` | `#17804C` `#946A12` `#B83A24` `#2A6FAD` | lebih terang |
| VIP / sharing | `text-vip` / `bg-vip/12` | `#6B4FB0` | `#A48DE6` |
| Radius panel / field | `rounded-panel` / `rounded-field` | 14px / 10px | |
| Bayangan panel | `shadow-panel` | `0 4px 18px` coklat 6 % | |

Emas lama `#A9791F` digeser ke `#93691A` untuk isian tombol: teks putih di atasnya 3,9:1 → 4,9:1.
Warna status memakai separuh gelap pasangan lama supaya katanya lolos AA di atas pil berwarna 12 %.

**Tipografi.** Font Office lama, self-hosted di `public/fonts/` (tanpa Google Fonts):
**Plus Jakarta Sans** untuk judul halaman, judul panel, dan angka kartu (`font-display`, otomatis di
`h1–h3`); **Inter** untuk semua teks lain. Judul halaman 28px bold; judul panel 18px semibold; label
kartu, label filter, kepala tabel, dan judul bagian form = 11–12px **huruf kapital** bold, tracking lebar.
Angka yang harus sejajar memakai `num` (tabular).

**Mode gelap** adalah tema tersendiri dengan coklat yang sama, bukan inversi. Emas naik satu tingkat.
Cek setiap layar di terang **dan** gelap.

## Shell (`app/layouts/default.vue`)

Seperti Office lama (`deploy/reservasi/index.html:851-872`):

- **Sidebar 248px** (`AppSidebar`): logo + "Laksamana Muda" + nama modul dalam huruf kapital emas kecil;
  menu berkelompok dengan label kapital abu (OPERASI, DATA & ANALISA …); item aktif = latar emas
  lembut, kata emas, garis emas 3px di kiri; **badge merah** untuk jumlah yang menunggu; di kaki: avatar
  emas bersudut, nama, peran di modul ini, tombol keluar.
- **Di dalam modul**, sidebar berisi layar modul itu (dari `utils/layar/<modul>.ts`) plus "Beranda Office".
  Di Beranda, sidebar berisi daftar modul.
- **Top bar**: tombol menu (desktop: sembunyikan sidebar; HP: buka laci), kotak cari bulat, lalu di kanan
  tombol **`+` emas** (aksi paling sering modul) dan **lonceng** dengan titik merah.
- Isi per modul ditulis di `app/utils/modul-shell.ts`: `subjudul`, `layar`, `cari`, `tambah`, `lonceng`,
  `peran`, `lencana` (badge), `siapkan` (memuat matriks peran sebelum menu digambar).
- Halaman modul (`/reservasi`) langsung membuka layar pertamanya, seperti Office lama.

## Blok bangunan

| Komponen | Padanan Office lama | Dipakai untuk |
|---|---|---|
| `AppPage` | `.page-head` | Judul + satu baris keterangan di kiri, tombol halaman di slot `#actions` di kanan |
| `AppStatGrid` + `AppStat` | `.recap-grid` / `.recap` | Baris kartu statistik: garis warna kiri, label kapital + ikon, angka besar (+ `satuan` "/ 32"), satu baris konteks. `tone` = arti angka (aturan 4) |
| `AppPanel` | `.panel` | Wadah semua isi: judul (+ ikon, + pil jumlah gelap), tombol kanan, slot `#head` untuk tab/cari; `flush` untuk tabel sampai tepi |
| `AppFilterGrid` | blok filter | Isi dengan `UFormField` biasa; label otomatis kapital abu kecil |
| `AppChips` | `.pill` | Pilihan cepat (Hari ini / Besok / 7 hari / Bulan ini) |
| `AppSeg` | tab bulat | Tab di dalam trek bulat (Tabel / Kalender / Denah / Waiting list; Harian / Bulanan), boleh ikon & badge |
| `AppStatus` | `.badge-status` | Pil status: warna + ikon + kata. `size="sm"` di dalam tabel |
| `AppSectionTitle` | `.section-title` | Judul bagian di form panjang: kapital emas di atas garis |
| `AppPilihan` | `.toggle-row` | Dua–tiga tombol pilihan besar (Sudah DP / Belum DP, Ya / Tidak) |
| `AppBar` | `.bar-item` | Satu batang grafik analitik: label + angka di atas, trek bulat di bawah |
| `UTable` | `table` | Kepala gelap kapital (sudah diatur `app.config.ts`); kepala yang bisa diurut = tombol dengan panah |
| `ResponsiveSheet` | `.modal` | Form dan konfirmasi. Bottom sheet di HP, dialog di desktop |
| `AppList` / `AppListRow` | — | Daftar sederhana (pengaturan, widget Beranda, versi HP dari tabel kecil) |
| `AppFocus` | — | Hanya untuk widget Beranda. Layar modul memakai `AppStat` |

Komponen Nuxt UI lain dipakai langsung, tidak dibungkus. Ubah gaya bawaannya di `app.config.ts`.

### Pola layar

- **Dashboard modul**: `AppPage` (+ tombol kanan) → `AppStatGrid` → `AppPanel` filter (tab `AppSeg` + cari
  di `#head`, `AppFilterGrid`, `AppChips`) → `AppPanel flush` daftar (judul + jumlah + Export CSV, tabel
  desktop, kartu HP, pager "1–10 dari 32 · 10 / hal").
- **Form input**: satu `AppPanel`, grid dua kolom (`lg:grid-cols-2`), urutan field sama dengan lama,
  bagian dipisah `AppSectionTitle`, tombol Simpan (emas) + Batal di bawah, Hapus di kanan.
- **Analitik**: `AppPanel` periode (tab Harian/Bulanan + tanggal di kanan) berisi pita info biru,
  `AppStatGrid`, dan daftar `AppBar`; lalu `AppSectionTitle` "Ringkasan keseluruhan", `AppStatGrid`,
  dan panel `AppBar` dua kolom.
- **Baris tabel yang butuh perhatian** diberi latar: telat = `bg-warning/15`, segera = `bg-primary-50`.
- **Aksi per baris** berwarna seperti lama: Datang/Verifikasi = `success`, Follow up (WA) = `success soft`,
  No-show/Tolak = `error`, Selesai = emas, sunting = ikon pensil `outline`.

## HP dan desktop

- Titik pisah `lg` (1024px). Di bawahnya sidebar menjadi laci dari tombol menu; top bar tetap.
- Kartu statistik 2 kolom di HP. Tabel menjadi daftar kartu (nama tebal, satu baris keterangan, pil status).
- Area sentuh minimal 44px. Tidak boleh ada geser ke samping di 390px.

## Tulisan

- Bahasa Indonesia sehari-hari, istilah kru tetap (Setoran, Kas kecil, Walk-in, Follow up, DP).
- Judul dan tombol mengikuti teks lama, tanpa emoji; kapital di awal kalimat untuk tombol dan kalimat.
  Label kecil kapital (kartu, filter, kepala tabel, judul bagian) ditulis biasa di kode dan dikapitalkan CSS.
- Tombol menyebut apa yang terjadi ("Simpan reservasi", "Tandai no-show"). Pesan error menyebut masalah
  dan cara memperbaikinya.

## Logo

`public/mark.png` di sidebar, top bar HP, login, dan ikon PWA. Wordmark hanya di logo.
