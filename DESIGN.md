# DESIGN.md — Laksamana Office

Mengikuti konsep dasbor **WattVision** versi terang (November 2026, permintaan owner): sidebar abu
dengan menu aktif berupa kartu putih, top bar menyatu dengan latar, judul halaman besar, kartu putih
**tanpa garis** dengan bayangan lembut, kartu KPI (ubin ikon + badge tren, label, angka besar +
satuan), panel dengan judul besar, dan batang progres membulat. **Satu-satunya yang diganti adalah
warnanya:** biru WattVision menjadi **emas Laksamana** dari Office lama. Mata uang Rupiah.

Referensi hidup: `npm run dev`, buka **`/styleguide`**. Contoh layar lengkap: modul Reservasi
(`app/pages/reservasi/*`) dan Radar (`app/pages/radar/*`).

> Aturan ini mengikat semua modul. Membangun modul baru = membuka layar lamanya di
> `../laksamana-office/deploy/<modul>`, lalu menyusun ulang layar itu dengan blok di bawah, **dengan
> urutan bagian, kolom tabel, isi kartu statistik, dan letak tombol yang sama**.

## 1. Tema visual & suasana

Antarmuka harus terasa **andal secara teknis** dan **memberi kendali**: alat kerja kru restoran,
bukan media sosial atau aplikasi hiburan. Dipakai di laptop kantor, tablet kasir, dan HP kru di
lantai. Suasananya "dasbor Power BI" yang disederhanakan untuk pengguna sehari-hari: angka dulu,
hiasan belakangan. Identitas Laksamana datang dari **emas Office lama**, dipakai hemat sebagai aksen.

## 2. Palet warna

Semua warna adalah token di `app/assets/css/main.css`; komponen tidak boleh berisi hex.

| Peran | Kelas | Nilai |
|---|---|---|
| Latar halaman ("paper" hangat) | `bg-muted` | `#F7F6F4` |
| Shell: sidebar, kotak cari, tombol sekunder | `bg-shell` | `#EFEDE8` |
| Permukaan kartu, panel, form | `bg-default` | `#FFFFFF` |
| Garis tipis (baris tabel, pemisah di dalam kartu; bukan tepi kartu) | `border-default` | `#E7E5E1` |
| **Aksen utama: emas** (data, KPI, tombol aksi, menu aktif, fokus) | `primary`, `text-/bg-gold-deep` | `#85600F` (AA untuk teks dan untuk putih di atasnya) |
| Emas Laksamana (garis aksen, batang grafik, hover) | `gold` | `#A9791F` |
| Emas terang (sorotan grafik) | `gold-bright` | `#C8961F` |
| Emas lembut (latar menu aktif, pil terpilih, ubin ikon) | `gold-soft` | `#F2E9D3` |
| Ramp emas lengkap (Nuxt UI `primary`) | `laksamana-50…950` | `#FBF7EC` … `#2B1D05` |
| Teks utama / judul | `text-highlighted` | `#1C1C1E` |
| Teks sekunder (label) | `text-muted` | `#555A6A` |
| Placeholder, "Segera" | `text-dimmed` | `#8E91A0` |
| **Peringatan** (lonjakan, perlu tindakan, ditolak, no-show) | `error` | `#600000` |
| **Normal / langsung** (datang, lunas, terverifikasi) | `success` | `#187574` |
| Menunggu (Pending, belum dicek) | `warning` | `#746019` |
| Info (terkonfirmasi, kapasitas, orang) | `info` | `#2A41B6` |
| VIP / sharing | `vip` | `#6B4FB0` |

- **Tidak ada pastel.** Tint pastel Miro lama (`sky-`, `teal-`, `lilac-`, `rose-`, `coral-`,
  `sand-`, `mint-light`, dst.) tidak dipakai untuk kode baru; sisa pemakaian di halaman diganti
  bertahap. Kartu netral (putih); ubin ikon `gold-soft`, kecuali ubin modul Beranda (kelas `ubin-emas`): **salinan persis launcher Office lama** — gradien 135° `#C8961F` → `#7A560F`, ikon putih 20px, sudut 11px, bayangan emas, membesar 7% saat hover. Satu-satunya gradien di aplikasi. Ikon kartu modul juga gambar SVG Office lama sendiri (`i-laks-*` di `app/assets/icons`).
- **Warna status punya arti tetap**, dipakai sebagai kata berwarna di atas tint 10% warnanya
  (`bg-success/10 text-success`). Status selalu **ikon + kata**, tidak pernah warna saja. Satu
  sumber per status: `app/utils/status-reservasi.ts`; modul lain membuat file serupa.
- **Hitam** (`text-ink-900`) untuk teks kuat dan avatar; **CTA memakai emas**, bukan hitam.
  Kuning Miro `#ffd02f` tidak lagi dipakai sebagai aksen.

## 3. Gaya komponen

- **Kartu & panel** (`AppPanel`, `AppStat`, `AppList`, `UCard`, modal): `rounded-panel` **16px**,
  latar putih **tanpa garis**, satu bayangan lembut (`shadow-panel`), padding 20px (`p-5`; panel
  desktop 28px). Kartu mengambang di atas latar paper.
- **Kartu KPI** (`AppStat`): baris atas = **ubin ikon** 40px bertint warna `tone` (emas = hitungan
  netral) di kiri dan **badge tren** opsional di kanan (`badge`, `badgeTone` success/error/neutral,
  mis. "4,2%" atau "Stabil"); lalu label biasa abu, **angka besar** extrabold (Plus Jakarta Sans 32px)
  dengan **satuan** kecil abu di sebelahnya (`satuan`: "pax", "/ 32"), dan satu baris konteks.
- **Panel** (`AppPanel`): judul 20px bold langsung disusul isi tanpa garis pemisah; pil jumlah emas
  lembut. `flush` (tabel sampai tepi) memakai garis tipis di bawah kepala.
- **Batang progres** (`AppBar`): label kiri, nilai emas tua di kanan, trek abu membulat, isi emas.
- **Grafik**: batang/garis data emas (`bg-gold`), garis bantu `border-default`, sorotan
  `gold-bright`. Warna solid, tanpa gradien. Untuk tren yang naik-turun tajam, pakai grafik area
  supaya puncaknya terbaca halus.
- **Tabel** (`UTable`, diatur di `app.config.ts`): kepala `bg-muted` huruf kapital kecil abu, setiap
  baris bergaris bawah `1px border-default`, hover baris `bg-muted`. Tabel di `lg+`, kartu di bawahnya.
- **Peringatan**: kotak `bg-error/10`, teks `text-error`, **garis kiri 4px** `border-l-4 border-error`,
  sudut `rounded-xl`. Versi menunggu/info memakai pasangan `warning`/`info` yang sama.
- **Tombol**: `rounded-field` **10px**. Aksi utama = emas (`color="primary"`, putih di atas
  `#85600F`, bayangan emas tipis); sekunder = `color="neutral" variant="soft"` (ubin `bg-shell`
  teks emas tua, seperti "Last 24 Hours"); tersier = `neutral outline`/`ghost`. Tombol menyebut
  hasilnya ("Simpan reservasi"). Di `#actions` AppPage: sekunder dulu, aksi emas paling kanan.
- **Field input/select**: `rounded-field` 10px.
- **Tanggal** (`AppTanggal`): **tidak memakai pemilih bawaan browser** (`type="date"`). Field berisi
  tanggal bahasa Indonesia ("Kamis, 12 November 2026") + ikon kalender emas, membuka `UCalendar`
  dalam popover; model tetap string `YYYY-MM-DD`. Pintasan Hari ini / Besok / Lusa (`AppChips`) boleh
  di bawahnya.
- **Tombol ikon di dalam baris form** (− / + jumlah, hapus baris): `size-10` di HP, `size-8` di
  desktop — sejajar tinggi field, tidak lebih besar.
- **Tab segmen** (`AppSeg`): trek `bg-muted` 10px; opsi aktif = ubin putih bergaris tipis, teks emas
  tua; nonaktif = teks abu.
- **Pil pilihan cepat** (`AppChips`, `AppPilihan`): terpilih = `border-gold bg-gold-soft
  text-gold-deep`.
- **Menu aktif** sidebar: **kartu putih** berbayangan di atas `bg-shell`, ikon dan teks emas tua;
  menu lain abu, memutih saat hover. Bottom bar HP: latar `gold-soft`, teks `gold-deep`.
- **Status** (`AppStatus`): tag `rounded-md`, tint 10% + kata berwarna + ikon.
- **Label kategori** (kategori produk Stock, dll.): tag `rounded-md`, warna dari
  `warnaKategori(nama)` (`app/utils/kategori-warna.ts`) — enam token `kat-1…6` (tint 12% + kata),
  **terpisah dari warna status** supaya kategori tidak terbaca sebagai "menunggu" atau "ditolak".
  Nama yang sama selalu warna yang sama; kosong/"Lainnya" netral.
- **Kotak grup kecil bersarang** (grup field, daftar scroll kecil di dalam panel/sheet): `rounded-xl`
  (12px), supaya hirarki panel 16px → grup 12px → field 10px terbaca.
- **Lapisan warna: setiap lapis berganti warna, tidak pernah putih di atas putih.**

  | Lapis | Isi | Warna |
  |---|---|---|
  | 1 | Halaman | `bg-muted` (paper) |
  | 2 | Kartu / panel / sheet | `bg-default` + `shadow-panel` |
  | 3 | Kotak di dalam kartu yang berisi field (baris bahan, grup form, daftar centang) | `bg-muted` + `border border-default` + `rounded-xl` |
  | 3 | Panel di dalam panel (kartu vendor/batch di Monitor Order, grafik kecil) | `<AppPanel bersarang>` (paper + garis, tanpa bayangan) |
  | 4 | Field di dalam kotak | `bg-default` + garis field (bawaan Nuxt UI) |

  Kotak lapis 3 yang hanya berisi teks (baris daftar) boleh tetap putih bergaris. Chip pilihan dan
  baris centang adalah kontrol, bukan lapis — warnanya ikut status terpilih.
- **Kanban** (`AppKanban`): kolom `bg-muted` + `border-default` + `rounded-xl`; kartu putih di dalamnya.
  Highlight target drop: `border-primary-400 bg-primary-50`.

## 4. Tipografi

Font self-hosted di `public/fonts/` (tanpa Google Fonts).

- **Teks biasa: Noto Sans** (cadangan Inter). Owner memilih mempertahankan Noto Sans; skala
  dibuat ~1px lebih kecil dari bawaan Tailwind (token `--text-*`): `text-sm` 13px, `text-base` 15px
  (teks dasar `body`), `text-lg` 17px.
- **Judul, judul panel, dan angka KPI: Plus Jakarta Sans** (`font-display`, otomatis di `h1–h3`),
  seperti huruf geometris WattVision. Judul halaman extrabold 32px (24px di HP); judul panel 20px
  bold; angka KPI extrabold 32px (turun ke 24/20px untuk nilai panjang seperti Rupiah).
- **Angka lain yang harus sejajar** (tabel, jumlah): kelas `num` (digit tabular Noto Sans).
- **Label kecil** (kartu, filter, kepala tabel, judul bagian): 11–12px **huruf kapital**, bold,
  tracking lebar, ditulis biasa di kode dan dikapitalkan CSS.
- Menu sidebar 14px, huruf kapital di awal kata (`capitalize`).

Aplikasi hanya terang (**light-only**): tidak ada tema gelap, tidak ada `dark:` dan tidak ada
pemilih tema.

## 5. Prinsip tata letak

- **Spasi kelipatan 8px**: 8 / 16 / 24 / 32 (`2` / `4` / `6` / `8`); 4px dan 12px hanya untuk jarak
  rapat di dalam komponen. Jarak antar-seksi besar `mb-5`/`mb-6` (bawaan `AppPage`, `AppStatGrid`,
  `AppPanel`) — jangan sisipkan pemisah lain.
- **Grid 12 kolom** di desktop untuk dasbor.
- **Pola dasbor**: deret KPI di atas (`AppStatGrid`, 3–4 kartu) → konten utama **8 kolom** (grafik,
  tabel, agenda) + panel samping **4 kolom** (peringatan, hari ini, sumber data). Contoh: Radar.
- **Dashboard modul**: `AppPage` (+ tombol kanan) → `AppStatGrid` → `AppPanel` filter (`AppSeg` +
  cari, `AppFilterGrid`, `AppChips`) → `AppPanel flush` daftar (judul + jumlah + Export CSV, tabel
  desktop, kartu HP, pager).
- **Form input**: satu `AppPanel`, grid dua kolom (`lg:grid-cols-2`), urutan field sama dengan lama,
  bagian dipisah `AppSectionTitle`, Simpan (emas) + Batal di bawah, Hapus di kanan.
- **Form dengan baris berulang** (bahan, item, barang — Form Order, Minta dari CK, Kirim ke CK):
  **"Tambah baris" ada tepat di bawah baris terakhir**, bukan di kepala panel — bilah selebar daftar,
  garis putus-putus emas (`border-2 border-dashed border-gold/40`, teks `gold-deep`, ikon `+`). Tombol
  kirim/simpan tetap di kanan bawah.
- **Baris tabel yang butuh perhatian**: telat = `bg-error/10`, perlu perhatian = `bg-warning/10`.
- **Skeleton saat memuat**: `USkeleton` menyerupai tata letak konten, hanya saat `pending` dan belum
  ada data.
- **HP dan desktop satu halaman.** Titik pisah `lg` (1024px). Di bawahnya sidebar diganti bottom bar
  (`AppNavBawah`). Kartu statistik 2 kolom di HP; tabel jadi daftar kartu. Area sentuh minimal 44px;
  tidak boleh ada geser ke samping di 390px. Cek 390px dan 1366px di browser.

### Shell (`app/layouts/default.vue`)

- **Sidebar 248px** (`AppSidebar`) di atas `bg-shell`, tanpa garis pemisah: ubin logo putih +
  "Laksamana Muda" extrabold emas tua + nama modul kapital kecil abu; menu berkelompok; item aktif =
  kartu putih; **badge merah** untuk jumlah yang menunggu; di kaki avatar, nama, peran, tombol keluar.
  Di Beranda (`/`) sidebar tidak tampil di desktop.
- **Top bar** menyatu dengan latar (tanpa garis): tombol menu (desktop), kotak cari `bg-shell`, lalu di
  kanan `+` dan lonceng (ghost). Beranda memakai kop sendiri (`BerandaKop`).
- **Judul halaman** di badan halaman (`AppPage`), besar, dengan keterangan di bawahnya dan tombol di
  kanan.
- Isi per modul di `app/utils/modul-shell.ts` (`subjudul`, `layar`, `cari`, `tambah`, `lonceng`,
  `peran`, `lencana`, `siapkan`).

### Blok bangunan

| Komponen | Dipakai untuk |
|---|---|
| `AppPage` | Judul (+ keterangan) dan tombol halaman di `#actions` |
| `AppStatGrid` + `AppStat` | Deret kartu KPI |
| `AppPanel` | Wadah isi: judul (+ ikon emas, + pil jumlah), tombol kanan, `#head`; `flush` untuk tabel sampai tepi |
| `AppFilterGrid` | Filter dengan `UFormField` biasa |
| `AppChips` | Pilihan cepat (Hari ini / Besok / 7 hari / Bulan ini) |
| `AppSeg` | Tab segmen (Tabel / Kalender, Harian / Bulanan) |
| `AppStatus` | Status: warna + ikon + kata |
| `AppSectionTitle` | Judul bagian form panjang (tick emas) |
| `AppPilihan` | Dua–tiga pilihan besar (Ya / Tidak) |
| `AppBar` | Satu batang grafik analitik |
| `UTable` | Data tabular desktop |
| `ResponsiveSheet` | Form dan konfirmasi (bottom sheet di HP, dialog di desktop) |
| `AppTanggal` | Field tanggal dengan kalender sendiri (bukan pemilih browser) |
| `AppList` / `AppListRow` | Daftar sederhana dan versi HP tabel kecil |
| `AppFocus` | Satu blok utama widget Beranda |

Komponen Nuxt UI lain dipakai langsung, tidak dibungkus; ubah gayanya di `app/app.config.ts`.

## 6. Yang dilakukan & yang dihindari

- ✅ Angka KPI besar dengan satuannya di sebelah dan konteksnya di bawah (periode, rincian, tren).
- ✅ Uang selalu dengan **Rp** dan pemisah ribuan Indonesia (`Rp 1.250.000`, lewat `rupiah()` di
  `app/utils/format.ts`), dan angka lain bersama satuannya (pax, porsi, kg).
- ✅ Grafik area untuk tren yang naik-turun tajam; batang solid emas untuk perbandingan.
- ✅ Ikon Lucide (`i-lucide-*`) yang spesifik untuk maknanya (meja, kalender, dompet, peringatan),
  di posisi emoji lama. Emoji hanya di isi pesan WhatsApp untuk tamu.
- ✅ Bahasa Indonesia sehari-hari, kapital di awal kalimat; istilah kru tetap (Setoran, Kas kecil,
  Walk-in, Follow up, DP). Pesan error menyebut masalah dan cara memperbaikinya.
- ❌ Warna pastel sebagai latar kartu, panel, atau ubin.
- ❌ Gradien (kecuali `ubin-emas`), garis tebal, bayangan berat, atau sudut sangat bulat (pil) untuk kartu dan tombol.
- ❌ Hex di komponen; warna hanya dari token.
- ❌ Warna sebagai satu-satunya penanda status.
- ❌ Ikon generik yang tidak menjelaskan apa-apa (bintang/hiasan) di tempat yang butuh makna.

## Logo

`public/mark.png` di sidebar, kop Beranda, top bar HP, login, dan ikon PWA. Wordmark hanya di logo.
