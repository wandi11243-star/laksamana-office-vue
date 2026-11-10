# Design language — Laksamana Office (tema Miro)

**Office Vue memakai tata letak dan warna Office lama** (`laksamana-office/deploy/…`), atas permintaan
mentor (29 September 2026). Kru yang berpindah antara Office lama dan Vue harus merasa berada di tempat
yang sama: sidebar per modul, kartu statistik berwarna, tabel berkepala muted terang, tinta dan kuning lembut.
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
3. **Hitam = aksi, kuning = aksen.** Tombol utama, tombol `+` di top bar, menu aktif, pil terpilih,
   judul bagian form memakai pil hitam `bg-ink-900` teks putih. Kuning `#ffd02f` hanya untuk aksen
   (wordmark, promo, tag), bukan untuk CTA.
   **Aksen pastel Miro untuk identitas panel** (R-31: supaya panel sejenis mudah dibedakan).
   Ubin ikon boleh memakai satu tint pastel Miro per panel/modul (`yellow-light`, `surface-pricing`,
   `teal-light`, `brand-orange-light`, `rose-light`, `coral-light` + pasangan teks gelapnya), selalu
   gelap-di-terang agar lolos AA. Tidak untuk teks, status, badge, atau CTA — dan tidak dicampur
   dengan emas lama.
4. **Warna status punya arti tetap** (sama seperti lama): kuning/`warning` = menunggu (Pending, belum
   dicek), biru/`info` = terkonfirmasi / kapasitas / orang, hijau/`success` = datang / terverifikasi /
   baik, merah/`error` = perlu tindakan / ditolak / no-show, ungu/`vip` = VIP / sharing. Kuning
   `#ffd02f` hanya aksen (wordmark, promo, tag), bukan status. Status selalu **ikon + kata**,
   tidak pernah warna saja.
5. **Satu sumber per status.** Warna & ikon status reservasi: `app/utils/status-reservasi.ts`.
   Modul lain membuat file yang sama untuk statusnya sendiri, bukan peta di tiap halaman.
6. **Tabel di desktop, kartu di HP.** Data tabular: `UTable` (`lg+`) dengan kepala muted terang; di bawah `lg`
   baris yang sama tampil sebagai daftar kartu. Tabel desktop harus muat tanpa geser di 1366px:
   gabungkan kolom sekunder ke kolom tetangganya di bawah 1536px bila perlu (contoh: Dashboard Reservasi).
7. **Tanpa hex di komponen.** Semua warna dari token (`main.css`) dan kelas Nuxt UI.

## Token (`app/assets/css/main.css`)

Palet dari DESIGN.md laksamana-hris (analisis Miro).

| Peran | Kelas | Terang | Gelap |
|---|---|---|---|
| Latar halaman ("paper") | `bg-muted` | `#F7F6F4` | — |
| Permukaan (panel, kartu, form) | `bg-default` | `#ffffff` | — |
| Garis | `border-default` | `#e0e2e8` | — |
| Teks utama / judul | `text-highlighted` | `#1c1c1e` | — |
| Teks biasa | `text-default` | `#1c1c1e` | — |
| Keterangan | `text-muted` | `#555a6a` | — |
| Placeholder, "Segera" | `text-dimmed` | `#8e91a0` | — |
| CTA hitam | `bg-ink-900` teks putih | `#1c1c1e` teks putih | — |
| Hitam sebagai teks | `text-ink-900` | `#1c1c1e` | — |
| Kuning lembut (menu aktif, pil) | `bg-yellow-light` / `text-yellow-dark` | `#fff4c4` / `#746019` | — |
| Kuning aksen (wordmark, promo, tag) | `text-brand-yellow` | `#ffd02f`, bukan untuk CTA | — |
| Aksen emas Laksamana (hover kartu modul, tick judul bagian) | `text-/border-/bg-gold` | `#A9791F` (wash `#F2E9D3`) | — |
| Kepala tabel | `bg-muted` + `text-muted` | `#F7F6F4` + `#555a6a` | — |
| Status | `text-/bg-success·warning·error·info` | sukses `#c3faf5`/`#187574`, tunggu `#fff4c4`/`#746019`, tolak `#ffc6c6`/`#600000`, info `#d8ebff`/`#2a41b6` | — |
| Kartu stat | `AppStat` `tone` → tint penuh | netral `bg-sand-light`, sukses `bg-teal-light`, tunggu `bg-yellow-light`, tolak `bg-coral-light`, info `bg-sky-light`, VIP `bg-lilac-light`/`text-vip`; angka `text-highlighted`, label `text-muted`, ikon pasangan gelap tiap tone | — |
| VIP / sharing | `text-vip` / `bg-vip/12` | `#6B4FB0` | — |
| Radius panel besar | `rounded-panel` | 28px | — |
| Radius kotak grup kecil bersarang | `rounded-xl` | 12px | — |
| Radius field | `rounded-field` | full (`9999px`) | — |
| Bayangan panel | `shadow-panel` | `0 12px 32px -4px rgb(5 0 56/.08)` | — |

Ramp emas lama (`--color-laksamana-*`) tidak dipakai lagi — bloknya dipertahankan di `main.css`
hanya sebagai arsip revert. Kontras kini datang dari pasangan gelap-di-atas-tint Miro (kata
`#187574`/`#746019`/`#600000`/`#2a41b6` di atas tint pastelnya).

Aksen emas `#A9791F` (`gold`) adalah ciri khas Laksamana dan **hanya aksen** — di modul tidak mengganti
pastel Miro. Pengecualian: **Beranda** memakai emas sebagai identitas (permintaan owner, Nov 2026) —
kop merek `BerandaKop` (logo, "Internal office" `gold-deep`, jam, Kelola User, menu akun) menggantikan
top bar, deskripsi modul `gold-deep` `#85600F` (emas tua untuk teks kecil agar kontras AA), pil
jumlah grup `bg-gold-soft text-gold-deep` dengan garis emas tipis; tile ikon tetap pastel. Saat kursor di
atas kartu modul: garis emas, latar emas tipis `gold-soft/20`, ring tile ikon, panah emas, kartu
terangkat halus. Plus tick kecil sebelum judul bagian
(`AppSectionTitle`).

**Tipografi.** Font self-hosted di `public/fonts/` (tanpa Google Fonts): **Noto Sans** untuk judul
halaman, judul panel, dan angka kartu (`font-display`, otomatis di `h1–h3`) maupun semua teks lain,
dengan **Inter** sebagai cadangan. Tumpukan persisnya: bodi `--font-sans: 'Noto Sans', 'Inter',
ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`; judul `--font-display:
'Noto Sans', 'Inter', ui-sans-serif, system-ui, sans-serif`. Skala huruf dibuat ~1px lebih kecil dari
bawaan Tailwind (token `--text-*` di `main.css`, permintaan owner Nov 2026: Noto Sans lebih lebar
dari Inter Office lama): `text-sm` 13px, `text-base` 15px (teks dasar `body`), `text-lg` 17px; jarak
dan area sentuh tidak berubah. Judul halaman 26px bold; judul panel 17px semibold; menu sidebar 14px; label kartu, label filter, kepala tabel, dan judul bagian form = 11–12px **huruf kapital**
bold, tracking lebar. Angka yang harus sejajar memakai `num` (tabular).

Aplikasi hanya terang (**light-only**): tidak ada tema gelap, blok `.dark` dihapus, dan tidak ada
pemilih tema. Cek setiap layar di terang saja.

## Shell (`app/layouts/default.vue`)

Seperti Office lama (`deploy/reservasi/index.html:851-872`):

- **Sidebar 248px** (`AppSidebar`): logo + "Laksamana Muda" + nama modul dalam huruf kapital kecil;
  menu berkelompok dengan label kapital abu (OPERASI, DATA & ANALISA …); item aktif = latar kuning
  lembut, garis kuning `#fcb900` 3px di kiri; **badge merah** untuk jumlah yang menunggu; di kaki: avatar
  hitam bersudut, nama, peran di modul ini, tombol keluar.
- **Di dalam modul**, sidebar berisi layar modul itu (dari `utils/layar/<modul>.ts`) plus "Beranda Office".
  **Di Beranda (`/`) sidebar tidak ditampilkan di desktop**: kisi peluncurnya sudah memuat semua modul,
  jadi konten memakai lebar penuh (tombol menu di top bar ikut disembunyikan). Di HP tetap bottom bar.
- **Top bar**: tombol menu (desktop saja: sembunyikan sidebar), kotak cari bulat, lalu di kanan
  tombol **`+` pil hitam** (aksi paling sering modul) dan **lonceng** dengan titik merah.
- Isi per modul ditulis di `app/utils/modul-shell.ts`: `subjudul`, `layar`, `cari`, `tambah`, `lonceng`,
  `peran`, `lencana` (badge), `siapkan` (memuat matriks peran sebelum menu digambar).
- Halaman modul (`/reservasi`) langsung membuka layar pertamanya, seperti Office lama.

## Blok bangunan

| Komponen | Padanan Office lama | Dipakai untuk |
|---|---|---|
| `AppPage` | `.page-head` | Judul + satu baris keterangan di kiri, tombol halaman di slot `#actions` di kanan |
| `AppStatGrid` + `AppStat` | `.recap-grid` / `.recap` | Baris kartu statistik: latar tint pastel penuh per `tone`, label kapital + ikon, angka besar (+ `satuan` "/ 32"), satu baris konteks. `tone` = arti angka (aturan 4) |
| `AppPanel` | `.panel` | Wadah semua isi: judul (+ ikon, + pil jumlah gelap), tombol kanan, slot `#head` untuk tab/cari; `flush` untuk tabel sampai tepi |
| `AppFilterGrid` | blok filter | Isi dengan `UFormField` biasa; label otomatis kapital abu kecil |
| `AppChips` | `.pill` | Pilihan cepat (Hari ini / Besok / 7 hari / Bulan ini) |
| `AppSeg` | tab bulat | Tab di dalam trek bulat (Tabel / Kalender / Denah / Waiting list; Harian / Bulanan), boleh ikon & badge; opsi aktif = pil hitam (`bg-ink-900` teks putih), nonaktif = teks abu di atas trek |
| `AppStatus` | `.badge-status` | Pil status: warna + ikon + kata. `size="sm"` di dalam tabel |
| `AppSectionTitle` | `.section-title` | Judul bagian di form panjang: kapital tinta di atas garis; aksi memakai pil hitam |
| `AppPilihan` | `.toggle-row` | Dua–tiga tombol pilihan besar (Sudah DP / Belum DP, Ya / Tidak) |
| `AppBar` | `.bar-item` | Satu batang grafik analitik: label + angka di atas, trek bulat di bawah |
| `UTable` | `table` | Kepala muted-terang kapital (sudah diatur `app.config.ts`); kepala yang bisa diurut = tombol dengan panah |
| `ResponsiveSheet` | `.modal` | Form dan konfirmasi. Bottom sheet di HP, dialog di desktop |
| `AppList` / `AppListRow` | — | Daftar sederhana (pengaturan, widget Beranda, versi HP dari tabel kecil) |
| `AppFocus` | — | Hanya untuk widget Beranda. Layar modul memakai `AppStat` |

Komponen Nuxt UI lain dipakai langsung, tidak dibungkus. Ubah gaya bawaannya di `app.config.ts`.

**Kotak grup kecil bersarang memakai `rounded-xl` (12px), bukan `rounded-panel`.**
Grup field ber-border dengan padding kecil (`p-2`/`p-2.5`/`p-3`) dan kotak daftar
scroll kecil (`max-h-*` + `divide-y`/`space-y`) yang duduk di dalam panel atau sheet
tampil lebih kotak (12px) supaya hirarki panel 28px → grup 12px → field pil terbaca.
Panel besar (`AppPanel`, kartu stat, sheet, kartu daftar) tetap `rounded-panel` (28px);
pengecualian: `AppPanel flush` (tabel/daftar sampai tepi) memakai `rounded-xl`
(12px) — sudut 28px memakan kepala tabel muted yang menempel tepi dan terbaca
kebesaran, sedangkan 12px sejajar kotak grup bersarang; token `--radius-panel`
di `main.css` tidak berubah.

Kolom kanban (`AppKanban`) adalah baki pastel di atas halaman muted — satu warna
`bg-mint-light` untuk semua kolom + `border-default` + `rounded-xl`
tanpa bayangan; kartu putih di dalamnya terangkat lewat garis dan
`shadow-panel`-nya sendiri, pil jumlah kolom memakai `bg-muted`. Bahasa highlight
drop-target tetap satu: `border-primary-400` + `bg-primary-50`, yang tetap terbaca
di atas pastel. Satu-satunya cara pindah kartu adalah drag & drop — tidak ada
picker "Pindah ke…" di dalam board.

### Pola layar

- **Dashboard modul**: `AppPage` (+ tombol kanan) → `AppStatGrid` → `AppPanel` filter (tab `AppSeg` + cari
  di `#head`, `AppFilterGrid`, `AppChips`) → `AppPanel flush` daftar (judul + jumlah + Export CSV, tabel
  desktop, kartu HP, pager "1–10 dari 32 · 10 / hal").
- **Form input**: satu `AppPanel`, grid dua kolom (`lg:grid-cols-2`), urutan field sama dengan lama,
  bagian dipisah `AppSectionTitle`, tombol Simpan (pil hitam) + Batal di bawah, Hapus di kanan.
- **Analitik**: `AppPanel` periode (tab Harian/Bulanan + tanggal di kanan) berisi pita info biru,
  `AppStatGrid`, dan daftar `AppBar`; lalu `AppSectionTitle` "Ringkasan keseluruhan", `AppStatGrid`,
  dan panel `AppBar` dua kolom.
- **Baris tabel yang butuh perhatian** diberi latar: telat = `bg-error/10`, perlu perhatian = `bg-warning/10`.
- **Skeleton saat memuat**: layar yang menunggu data menampilkan `USkeleton` menyerupai tata letak kontennya
  (deret kartu stat, baris tabel, kolom kanban, paragraf kertas) hanya saat `pending` dan belum ada data;
  shimmer-nya runtuh jadi blok statis di `prefers-reduced-motion`.
- **Aksi per baris** berwarna seperti lama: Datang/Verifikasi = `success`, Follow up (WA) = `success soft`,
  No-show/Tolak = `error`, Selesai = pil hitam, sunting = ikon pensil `outline`.
- **Jarak vertikal antar-seksi besar selalu `mb-5` (20px)** — itu bawaan `AppPage` (kepala), `AppStatGrid`,
  `AppPanel`, dan `KontenBrandBar`. Jangan sisipkan `mb-2`/`mb-3`/`mb-4` atau `space-y-1`/`space-y-2`
  sebagai pemisah seksi; di dalam seksi (kepala panel, deret pil) pakai `mt-4`/`space-y-3`.
- **Isi panel kustom** (`rounded-panel` + `border` + `shadow-panel` di luar `AppPanel`) memakai `px-4 py-3.5 lg:px-5`, sama seperti kepala `AppPanel`; kotak info/notis di dalamnya memakai `rounded-xl`, bukan `rounded-field`.
- **Jarak label kapital → nilai selalu `mt-1`** di semua layar; `mt-1.5` hanya untuk deret pil/aksi di bawah judul kartu.

## HP dan desktop

- Titik pisah `lg` (1024px). Di bawahnya sidebar diganti bottom bar (`AppNavBawah`): satu ikon per grup layar yang membuka sheet berisi layarnya, layar tanpa grup langsung jadi ikon, maksimal 4 + "Lainnya" (sisa grup, Beranda Office, akun). Ikon grup di `utils/nav-bawah.ts`; top bar tetap.
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
