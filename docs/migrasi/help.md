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
