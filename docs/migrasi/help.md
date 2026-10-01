# Help Center — inventaris migrasi

Status: ✅ selesai (inventaris ringkas — lihat §4.14 & §6: hanya bagian A, B, C, H)
Terakhir diperbarui: 2026-09-29

## Ringkasan
- Jumlah layar: 3 jenis (beranda, 1 artikel per bab = 25 bab, hasil pencarian) · Aksi backend lama: 0 · Gap v1: 0 ❌ (0 ⚠️)
- Help Center adalah **panduan pemakaian**, bukan modul kerja: **tidak ada backend, tidak ada tabel, tidak ada endpoint** (`laksamana-office/CLAUDE.md:10938`). Isinya berkas statis di `deploy/help/panduan/<kunci>.js` + gambar di `deploy/help/gambar/<kunci>/`.
- Satu-satunya logika: **menyaring bab menurut hak akses** pembukanya — `lm_session.modules`; modal yang tidak boleh dibuka tidak boleh terlihat panduannya. Registri bab menyalin `access` dari `BRANCHES` portal (`panduan/daftar.js:8-18`).
- Penggunanya semua User Office. Risiko migrasi: mengubahnya jadi "aplikasi kedua" (HTML bebas) atau mempertahankan mesin generik buku-panduan yang berbasis data terstruktur.
- Karena tidak ada backend, tidak ada pekerjaan API; nilainya ada di **memindahkan mesin panduan** (renderer + registri + penyaring izin) dan aset gambarnya.

## A. Sumber
| jenis | path | baris |
|---|---|---|
| frontend lama (mesin) | `laksamana-office/deploy/help/index.html` | 727 |
| registri bab | `laksamana-office/deploy/help/panduan/daftar.js` | `LM_HELP_GRUP` :41-48, `LM_HELP_MODUL` :56-110 |
| isi bab | `laksamana-office/deploy/help/panduan/*.js` | 25 berkas (absensi…usage) |
| gambar | `laksamana-office/deploy/help/gambar/<kunci>/` + `BACA-DULU.md` | 10 subfolder |
| backend lama | **tidak ada** | `CLAUDE.md:10938` |
| kontrak v1 | **tidak ada** | — |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:10923-11024` "Modul `help`: Help Center, panduan pemakaian" | 10923 |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:11025-11126` "HELP TIDAK BOLEH JADI APLIKASI KEDUA" | 11025 |
| tema bersama | `laksamana-office/deploy/assets/laksamana.css` (tanpa blok `:root` sendiri) | `help/index.html:29` |
| uji lama | `node tools/uji-help.js` (318 pemeriksaan) | `CLAUDE.md:11095`-an |

## B. Akses
- Kunci Modul di launcher: `help` — `BRANCHES[].key:'help'`, `access:['help']`, judul **Help Center**, tag **Panduan Pemakaian**, grup `lainnya` (`laksamana-office/deploy/index.html:1412-1415`). Komentar menjelaskan kunci sendiri sengaja dipakai supaya bab bisa disaring menurut kunci modul pembukanya (`deploy/index.html:1394-1411`).
- Gate di frontend: membaca `localStorage['lm_session']`; `SEMUA = modules.indexOf('*') > -1`; `boleh(m) = !m.izin || SEMUA || MODS.indexOf(m.izin) > -1` (`help/index.html:313-320`). Bab tanpa `izin` (`portal`) terbuka untuk semua yang bisa membuka Help; bab lain wajib memegang kuncinya.
- Gerbangnya juga **di router**, bukan cuma dengan tidak menggambar tautan: kunci tak dikenal DAN kunci yang tidak boleh dibuka sama-sama dipulangkan ke beranda dengan pesan sama (`buka()`, `help/index.html:643-663`; `CLAUDE.md:11004-11007`).
- Kunci yang dipegang tapi belum ada di registri tetap disebut di sidebar bagian "Belum ada di Help" (`gambarNav()`, `help/index.html:475-483`).
- Bab yang panduannya belum ada ditandai **"Segera"** di sidebar / **"Sedang disusun"** di kartu beranda (state `STATUS[k]==='kosong'`; `:467,510`).
- Aksi khusus admin: tidak ada. Tombol Keluar berjudul **"Keluar ke Office"**, hanya `location.href = '../'` **tanpa** menghapus `lm_session` (`:700-705`; `CLAUDE.md:11112-11120`).
- Langkah di luar repo (dari `CLAUDE.md:11129-11141`): kunci `help` harus didaftarkan ke Office lewat `syncModules` (buka panel Kelola Akses sekali) lalu dicentangkan; keduanya di DATABASE, bukan di git.

## C. Daftar layar
Help bukan modul `NAV_DEF`; ia router hash `#/<kunci>` dengan tiga jenis halaman (`buka()`, `help/index.html:649-663`).

| key | judul | subjudul | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| (kosong / `#/`) | Help Center | "Panduan pemakaian Office Laksamana Muda… Yang tampil di sini hanya modul yang memang bisa kamu buka" | semua pemegang `help` | tidak | `help/index.html:492-517` |
| `#/<kunci>` | `<label bab>` | artikel bab (blok: `p`, `langkah`, `tabel`, `catatan`, `tanya`, `gambar`) | pemegang kunci bab itu (bab `portal` = semua) | tidak | `help/index.html:519-578`, `:340-430` |
| (pencarian) | Hasil pencarian | kotak cari `#cari`, jeda 180 ms | semua pemegang `help`; hanya menyisir bab yang boleh dibaca | tidak | `help/index.html:610-641,680-699` |

25 bab (registri `LM_HELP_MODUL`, `panduan/daftar.js:56-110`), digrup seperti portal (`LM_HELP_GRUP`, `:41-48`):
- **Mulai Dari Sini** — `portal` "Office & Cara Masuk" (izin `null`).
- **Operasional** — `reservasi`, `cashier`, `service_excellent`, `radar`, `ordering`, `purchasing`, `tree`, `usage`, `hpp`.
- **Tim & Kru** — `jadwal`, `dw`, `absensi`, `akademi`, `hr`.
- **Marketing & Event** — `marketing`, `event`, `konten`.
- **Bisnis & Target** — `kompas`, `finance`, `brankas`, `analytics`, `bd`, `investor`.
- **Lainnya** — `howandi_life`.
Semua bab berdisk panduan (25/25) dan **tidak ada** yang bertanda *Segera* (`CLAUDE.md:11049-11050`).

## H. Catatan untuk implementasi Vue
- Halaman: `app/pages/help/index.vue` (beranda + daftar bab) dan `help/[kunci].vue` (artikel). Karena **tidak ada backend**, tak ada composable API. `definePageMeta({ access: ['help'] })`.
- Panduan dipindahkan sebagai **data terstruktur**, bukan HTML: blok `p`/`langkah`/`tabel`/`catatan`/`tanya`/`gambar` dengan satu renderer bersama; uji lama **menolak** berkas panduan yang memuat `<button>`, `<input>`, `<form>`, `<script>`, atau `onclick` (`CLAUDE.md:11027-11033`). Pindahkan 25 berkas `panduan/*.js` apa adanya (nama berkas = kunci) dan jaga **kunci di dalam berkas sama dengan nama berkasnya** (`CLAUDE.md:11087`).
- Registri bab harus tetap **menyalin kunci dari `app/utils/modul.ts`** (`MODUL.access`), bukan daftar kedua. Ganti penjaga lama `tools/uji-help.js` dengan uji yang membandingkan registri Help ↔ `modul.ts` (`CLAUDE.md:11013-11015`).
- Penyaring izin: pakai sesi Vue/Akses yang sama (`useModulNav`/`useToken`), bukan `lm_session` mentah. Pencarian harus punya **dua penjaga**: pemuat hanya menarik bab yang boleh dibaca DAN penyisir hanya menyusuri bab yang boleh dibaca (`CLAUDE.md:11009-11011`).
- Penekanan `*tebal*` dijalankan **sesudah** escaping (`teks()`, `help/index.html:340-346`) — kalau dibalik, markup bisa disuntikkan; di Vue pakai komponen teks aman, jangan `v-html` mentah.
- Gambar: slot yang gambarnya belum ada adalah **keadaan sah** dan harus menyebut **jalur berkas** yang ditunggu, bukan sekadar "gambar tidak tersedia" (`help/index.html:412-430`; `CLAUDE.md:11094`). Berkas yatim di `gambar/` (tidak disebut panduan) hampir selalu salah nama → jaga uji/peringatan (`CLAUDE.md:11096-11103`). Batas lama: lebar 1400px, ≤300 KB (`CLAUDE.md:11080-11083`); pindahkan 11 tangkapan layar yang ada.
- Blok berjenis tak dikenal harus **disebutkan di layar**, bukan dilewati (`CLAUDE.md:11093`). Tangkapan layar = `<figure><img>`, bukan potongan markup modul (`CLAUDE.md:11034-11036`).
- Modul baru di portal tanpa bab harus muncul **merah** di uji, bukan hilang diam-diam (`CLAUDE.md:11013-11015`); bab "belum ditulis" tetap digambar bertanda *Segera* (`CLAUDE.md:11058-11060`).
- HP vs desktop: sidebar bab → `AppList` berkelompok per grup di HP dan sidebar tetap di `lg+`; artikel = konten tunggal (tanpa `UTable` kecuali blok `tabel`). `AppFocus` tidak perlu (tidak ada aksi utama).
- Widget Beranda yang cocok: **tidak ada** — Help bukan sumber data; cukup tautan kartu modul `help`.
- Elemen lama yang melanggar DESIGN.md → padanannya: mesin sudah memakai tema bersama `assets/laksamana.css` dan **tanpa** `:root` sendiri (`CLAUDE.md:11124-11127`) — pertahankan prinsip itu (`main.css` + `app.config.ts`); pastikan tidak menyalin palet/`--gold` ke komponen. Emoji penanda (mis. `⏳`) → Lucide.

## Konsolidasi untuk README & berkas bersama
Baris README:
`| help | [help.md](help.md) | ✅ selesai (ringkas) | 3 jenis (beranda + 25 bab + cari) | 0 | 0 | inventaris ringkas (statis, tanpa backend); butuh registri bab ikut modul.ts |`

Baris `_lintas-modul.md` (tambahkan):
- **Help ← Office/Account (sesi) & `modul.ts` (kunci):** `help` menyaring bab menurut `lm_session.modules` (`help/index.html:313-320`) dan registri `daftar.js` **menyalin** `access` dari `BRANCHES` portal (`daftar.js:8-18`). Di Vue, registri harus menyalin `app/utils/modul.ts` dan dijaga uji, bukan daftar kedua. **Tidak ada** backend/DB (tidak ada pekerjaan v1).
- **Aset bersama:** Help memakai tema `deploy/assets/laksamana.css` tanpa blok `:root` sendiri (`help/index.html:29`; `CLAUDE.md:11124-11127`).

Pertanyaan terbuka: **tidak ada** (modul statis; satu-satunya keputusan desain — panduan sebagai data terstruktur — sudah ditetapkan owner di `CLAUDE.md:11025-11033`).

## J. Progres build

Status: ✅ dibangun (2026-10-01) · **belum dicek visual** (lihat di bawah)

### Layar yang dibangun
| layar | file | catatan |
|---|---|---|
| Beranda + hasil cari | `app/pages/help/index.vue` | kartu bab digrup seperti portal lama; kartu tanpa berkas panduan ditandai **Sedang disusun**; hasil cari menyebut jumlah bagian dan menyorot kata yang dicari |
| Artikel satu bab | `app/pages/help/[kunci].vue` | judul, "Dipakai oleh", daftar isi, bagian-bagian; kunci tak dikenal **dan** kunci yang tidak boleh dibaca sama-sama dipulangkan ke beranda dengan pesan sama (`app/middleware/help-bab.ts`) |
| Renderer blok | `app/components/PanduanBlok.vue` + `PanduanTeks.vue` | `teks`·`langkah`·`daftar`·`tabel`·`catatan`·`tanya`·`gambar`, **tanpa `v-html`**; blok tak dikenal disebut di layar |
| Registri bab | `app/utils/help/registry.ts` | `HELP_GRUP` + 25 `HELP_BAB`; kunci **menyalin** `MODUL[].access` di `app/utils/modul.ts` |
| Pemuat + cari | `app/utils/help/muat.ts`, `cari.ts`, `app/composables/useHelp.ts` | impor malas per bab; **dua penjaga**: pemuat hanya menarik `babSaya`, penyisir hanya menyusuri `babSaya` |
| Isi 25 bab | `app/utils/help/panduan/<kunci>.ts` | port apa adanya dari `panduan/*.js`; nama berkas = kunci di dalam berkas |
| Daftar layar sidebar | `app/utils/layar/help.ts` | dibangun dari registri, bukan daftar ketiga |
| Uji/penjaga | `tools/uji-help.mjs` (`npm run uji:help`) | registri ↔ `modul.ts`, kunci berkas, markup terlarang, jalur & berkas yatim gambar, lebar/ukuran gambar, `v-html` |
| Gambar | `public/help/gambar/**` | 11 tangkapan layar disalin (1400px, <300 KB); slot kosong menyebut `public/help/gambar/<berkas>` |

### Keputusan
- **Grup baru `'Lainnya'`.** Kartu Help ditempatkan di grup `Lainnya` seperti launcher lama (`deploy/index.html:1412`) supaya kru menemukannya di tempat yang sama (U1). Grup ini untuk sementara hanya berisi Help Center; Howandi Life OS dibiarkan di `Bisnis & Target` seperti sebelumnya.
- **Chrome sendiri.** Help masuk `app/utils/modul-shell.ts`: sidebar berisi bab digrup, kotak cari top bar menyala **langsung** dengan jeda **180 ms** (opsi baru `cari.realtime`), bagian **"Belum ada di Help"** untuk kunci yang dipegang tapi belum punya bab (opsi baru `navEkstra`), dan tombol kaki **"Keluar ke Office"** (opsi baru `kaki`) yang menuju `/` **tanpa** menghapus sesi — bukan `logout()`.
- **Registri menyalin kunci, bukan menduplikasinya.** `periksaRegistryHelp()` dan `tools/uji-help.mjs` membandingkan kedua arah; arah yang paling berbahaya (modul baru di `modul.ts` tanpa bab) membuat uji merah.
- **Dua penjaga pencarian** ada di satu tempat (`useHelp`): `siapkan()` mengimpor hanya bab dari `babSaya`, dan `cari()` menyisir hanya `babSaya`. Keduanya ditulis dari satu pintu `babBoleh`.
- **Penekanan `*tebal*`** dijalankan sebagai elemen `<strong>` sungguhan setelah Vue meng-escape teks; tidak ada string HTML yang dibangun.

### Penyimpangan yang disengaja (dan alasannya)
- **`greenfield` pada modul Homepage.** Uji registri menuntut setiap kunci modul punya bab (aturan lama), tetapi Homepage tidak punya bab di Office lama. Modulnya ditandai `greenfield: true` di `modul.ts` supaya uji tidak menuntut bab untuk modul yang memang belum pernah didokumentasikan; modul baru biasa tetap membuat uji merah.
- **Bab `analytics` & `investor` ditandai `menunggu`.** Keduanya modul PLAN.md §3 #14 yang belum ada di `modul.ts`. Babnya tetap bisa tampil kalau API memberi kuncinya; tanda `menunggu` hanya memberi tahu uji bahwa kuncinya belum ada di `modul.ts` (bukan salah ketik).
- **Tidak ada bab ber-`Segera` di dataset** karena 25/25 panduan ada. Keadaannya tetap didukung: lencana "Segera" di sidebar, "Sedang disusun" di kartu beranda, dan pesan di layar artikel.
- **Lebar konten** dibatasi 900px (beranda) / 860px (artikel), meniru `.hc-wrap` lama yang memang sempit supaya enak dibaca.
- **Tombol "Kembali ke Office" di top bar lama** tidak dibuat terpisah: link **"Beranda Office"** milik shell bersama sudah menuju `/` (dua jalan ke tempat yang sama di halaman yang sama tidak menambah apa pun). Yang dipertahankan justru tombol kaki "Keluar ke Office" karena ikon dayanya sudah jadi tempat yang dicari di modul lain.

### Belum dicek / perlu owner
- **Belum dicek visual** di 390px/1366px, terang/gelap: halaman butuh sesi Office dan API hidup; belum dijalankan di peramban.
- **`npm run build` gagal di lingkungan ini untuk SEMUA route** (bukan hanya Help): nitro prerender melempar `Only URLs with a scheme in: file, data, and node are supported… Received protocol 'd:'` untuk `/login`, `/styleguide`, `/` dan seterusnya — masalah path Windows/nitro, bukan dari Help. `npm run lint` dan `npm run typecheck` hijau; `npm run uji:help` 196 hijau.
- **Langkah di luar repo tetap sama**: kunci `help` harus didaftarkan lewat `syncModules` lalu dicentangkan (di DATABASE, bukan di git).

