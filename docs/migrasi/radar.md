# Radar — inventaris migrasi

Status: ✅ selesai (inventaris ringkas — lihat §4.14 & §6: hanya bagian A, B, C, H)
Terakhir diperbarui: 2026-09-30

## Ringkasan
- Jumlah layar: 6 (5 di rail + 1 halaman Detail internal; 0 tersembunyi) · Aksi backend lama: 0 tulis, 5 pembacaan lintas modul · Gap v1: 0 ❌ (2 ⚠️, lihat catatan)
- Radar adalah **papan koordinasi lintas modul**: menyatukan agenda Marketing, Event dan Reservasi ke satu kalender + daftar, plus daftar Promo dari BD OS. Ia **hanya membaca** — `nav-foot` secara eksplisit berbunyi "Radar hanya membaca. Perubahan dilakukan di modul asalnya." (`deploy/radar/index.html:2524`).
- Penggunanya kru operasional/floor & manajemen pemegang kunci `radar`. Risiko migrasi terbesar: **penyatuan tiga bentuk data berbeda** (Marketing `events[]`, Event `events[]`, Reservasi `reservations[]`) dan **konversi zona waktu** (Event menyimpan instant UTC berakhiran `Z`, Marketing menyimpan tanggal lokal polos) (`index.html:739-768`); salah geser = acara muncul di jam/hari yang keliru.
- **Sejak 27 Sep 2026 `radar` modul bawaan SEMUA akun** (Office lama `modul_bawaan_untuk`, commit `c84d826`; di laksamana-api `OfficeAccess::builtinModules`, 2026-09-30). Pencabutan per orang (grant access=0) tetap berlaku. Yang bukan Head (kata utuh "Head" di Tim/Keterangan) dan bukan admin modul Radar **tidak melihat nominal** (harga/deal, DP, pelunasan, biaya) — di Office lama dijaga di layar (`radarBolehUang`); **di laksamana-api dijaga di SERVER** (kunci uang tidak pernah dikirim ke yang bukan Head). Endpoint gabungan Radar sudah ada: `GET /api/v1/radar/board|agenda/{sumber}/{id}|promos|files/{key}` (`module:radar`, `laksamana-api/docs/api/radar.md`), jadi pemegang Radar tidak butuh modul sumbernya.
- Radar tidak punya DB/backend sendiri, tetapi tetap **wajib** terdaftar di Kelola Akses (kartu `key:'radar'`, `deploy/index.html:1159-1165`). Tidak ada gap kontrak v1 karena setiap sumber sudah punya endpoint state/reservations sendiri.

## A. Sumber
| jenis | path | baris |
|---|---|---|
| frontend lama | `laksamana-office/deploy/radar/index.html` | 2.698 |
| backend lama | **tidak ada** — membaca 4 backend modul lain | `index.html:598-613` |
| kontrak v1 | **tidak ada kontrak Radar**; memakai kontrak modul sumber | lihat tabel di bawah |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:12490-12520` "Reservasi VIP di Radar (permintaan user nomor 4)" | 12490 |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:13170-13210` "Reservasi VIP punya cabangnya sendiri (9 September 2026)" | 13170 |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:13422-13460` "`uji-vip-radar.js` ternyata sudah MERAH…" (catatan uji, bukan perilaku) | 13422 |

`SUMBER[]` (`index.html:598-613`):
| id | nama | URL lama | endpoint v1 setara |
|---|---|---|---|
| mkt | Marketing | `../marketing-api-mysql/api.php?action=getAll` (`:722`) | `GET /api/v1/marketing/state` (`docs/api/marketing.md:67`); lampiran `GET /api/v1/marketing/files/{key}` (`marketing.md:78`) |
| evt | Event | `../event-api-mysql/api.php?action=getAll` (`:722`) | `GET /api/v1/event/state` (`docs/api/event.md:40`) |
| rsv | Reservasi | `../reservasi-api-mysql/api.php?action=getAll` (`:722`) | `GET /api/v1/reservasi/reservations` (`docs/api/reservasi.md:21`) ⚠️ bentuknya per-record, bukan blob `getAll` |
| bd | BD OS | `../bd-api-mysql/api.php?action=getAll` (`:722`) | `GET /api/v1/bd/state` (`docs/api/bd.md:35`) |

- Lampiran berkas event dibaca lewat endpoint Marketing `?action=receipt&key=…` (`index.html:2026-2037`) → `GET /api/v1/marketing/files/{key}`.

## B. Akses
- Kunci Modul di launcher: `radar` — `BRANCHES[].key:'radar'`, `access:['radar']`, judul **Radar**, tag **Pusat Koordinasi** (`laksamana-office/deploy/index.html:1165-1168`). Komentar menegaskan memberi akses Radar **tidak** memberi kuasa mengubah apa pun (`deploy/index.html:1159-1163`).
- Gate modul di frontend: `lm_session` hidup + `modules` memuat `'*'` atau `'radar'`; kalau tidak, `location.replace('../')` (`deploy/radar/index.html:20-31`).
- Role / matriks izin di dalam modul: **tidak ada** — Radar tidak punya matriks halaman (`grep` `ROLE_NAV`/`perms` → TIDAK DITEMUKAN). Semua pemegang kunci melihat semua halaman.
- Aksi khusus admin: tidak ada (read-only). Catatan kaki sidebar: "Radar hanya membaca." (`:2524`).
- Nama & keterangan user ditampilkan dari sesi (`:2532-2535`).

## C. Daftar layar (dari `NAV` & `JUDUL`)
Rail: `NAV` (`index.html:2510-2511`); judul topbar: `JUDUL` (`index.html:2513-2514`); dispatcher `render()` (`:2538-2548`). Tab lama "Koordinasi" sudah dibuang; `#koordinasi` yang tersimpan di peramban jatuh ke Radar (`:2525-2530,2544-2548`).

| key | judul (topbar) | subjudul | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| radar | Radar | Pusat Koordinasi | semua pemegang `radar` | tidak (di rail) | `index.html:2510`, `:2513` |
| kalender | Kalender Terpadu | Tiga Modul, Satu Jadwal | semua pemegang `radar` | tidak | `index.html:2510`, `:2513` |
| agenda | Daftar Event | Marketing + Event | semua pemegang `radar` | tidak | `index.html:2510-2511`, `:2513` |
| reservasi | Reservasi | Dari Modul Reservasi | semua pemegang `radar` | tidak | `index.html:2510-2511`, `:2513` |
| promo | Promo Berjalan & Akan Datang | Dari BD OS | semua pemegang `radar` | tidak (ditambahkan ke NAV) | `index.html:2511`, `:2514` |
| detail | Detail Event | Detail Lengkap Event | semua; dibuka dari kartu, bukan rail | tidak (internal, `page='detail'`) | `index.html:2513-2514`, `:2587` |

Fungsi render: `vRadar` (`:1309`), `vKalender` (`:1468`), `vDetailEvent` (`:1549`), `vAgendaList` (`:1719`), `vResList` (`:1837`), `vPromo` (`:2419`).

## H. Catatan untuk implementasi Vue
- Halaman: `app/pages/radar/index.vue` (Pusat Koordinasi) + `radar/kalender.vue`, `radar/agenda.vue`, `radar/reservasi.vue`, `radar/promo.vue`, `radar/detail/[sumber]/[id].vue`. Semua `definePageMeta({ access: ['radar'] })`.
- Composable `useRadar.ts` (fungsi → endpoint) — **dibangun 2026-09-30**:
  - `useRadarBoard(key, from, to)` → `GET /api/v1/radar/board?from&to` (agenda Marketing+VIP+Event yang pasti jalan, reservasi semua status, format F&B, status per sumber, `bolehUang`).
  - `getRadarDetail(sumber, id)` → `GET /api/v1/radar/agenda/{mkt|evt|vip}/{id}` (panel detail & Detail Lengkap).
  - `useRadarPromos()` → `GET /api/v1/radar/promos` (running/upcoming + jumlah arsip).
  - `getRadarFileUrl(key)` → `GET /api/v1/radar/files/{key}` (hanya lampiran event Marketing yang tampil di papan).
  - **Tidak ada tulis** — jangan sediakan satu pun mutasi di modul ini.
- ~~Penyatuan di klien~~ — sekarang di server (`RadarRules::agenda`). Aturan aslinya untuk rujukan: penyatuan wajib di satu tempat: pemetaan Marketing `events[]→{tgl,nama,jenis,pax,status}`, Event `events[]→{start_datetime,title,category,venue,capacity}`, Reservasi `reservations[]→{date,name,time,pax,table}` (`index.html:739-768`); nilai rupiah Marketing **sengaja tidak dihitung** (`:780-788`).
- Konversi waktu: ada penanda zona (`Z`/`±hh:mm`) → geser ke WIB; tanpa zona → pakai apa adanya (`pecahWaktu()`, `index.html:756-768`).
- Pemuatan & kegagalan (harus dibawa): sumber yang gagal ditampilkan sebagai pita merah menyebut namanya, bukan disembunyikan (`index.html:718-734`, `:2549-2552`); auto-refresh senyap tiap **5 menit** (`SEGAR_MS=5*60*1000`, `:2561`), ditunda saat panel detail terbuka (`segarSenyap()`, `:2562-2566`), posisi gulir dikembalikan sesudah render (`:2566`); tombol "Segarkan" & jam dinding sudah dibuang (`:533`).
- Pakai "Hari ini" memanggil pintasan yang membuka Reservasi mode Harian tanggal hari ini (`APP.resHariIni`, `:2612`); ada juga WA harian `waResHarian` yang membuka `https://wa.me/?text=…` (`:2666-2680`).
- HP vs desktop: Kalender Terpadu & matriks kesiapan divisi sebaiknya `AppList` di HP; `UTable` hanya `lg+` untuk daftar Event/Reservasi/Promo. Saklar mode (Harian/Mingguan/Bulanan) jadi segmented control; saklar grid/tabel lama boleh disederhanakan.
- Widget Beranda yang cocok: "Agenda 14 hari", "Reservasi hari ini", "Briefing harian" sebagai `AppList` ringkas.
- Elemen lama yang melanggar DESIGN.md → padanannya:
  - **Palet disalin dari modul Marketing** + garis aksen/emoji → token `main.css`; ikuti DESIGN.md.
  - **Matriks/rose berwarna penuh** untuk kesiapan divisi (pengganti SVG mawar, `index.html:641-645`) → `AppList` + `AppStatus` (titik + kata).
  - **Pill berwarna** (`pill(t,c)`, `:667`) → `AppStatus`.
  - **Grafik/diagram warna khusus** → sederhanakan; kuning hanya untuk aksi/tanda "hari ini".
  - Uppercase label grup navigasi (`nav-l`, `:104`) → `text-muted` sentence case.

## Konsolidasi untuk README & berkas bersama
Baris README:
`| radar | [radar.md](radar.md) | ✅ selesai (ringkas) | 6 (5 rail + 1 detail) | 0 ❌ · 2 ⚠️ | 0 | dibangun di Vue 2026-09-30 (visual belum dicek dengan data asli); read-only lintas Marketing/Event/Reservasi/BD |`

Baris `_lintas-modul.md` (tambahkan/dipertahankan; baris lama `_lintas-modul.md:37` masih benar):
- **Radar ← Marketing, Event, Reservasi, BD** (VERIFIED, read-only): `getAll` keempat modul (`radar/index.html:598-613,722`) → v1 `GET /marketing/state`, `/event/state`, `/reservasi/reservations`, `/bd/state`; lampiran event lewat `GET /marketing/files/{key}` (`:2026-2037`). BD dipakai **hanya** untuk tab Promo (BD tidak punya acara bertanggal, `:603-609`). Auto-refresh 5 menit (`:2561,2687`). v1 ⚠️: Reservasi tidak punya blob `getAll` setara (per-record), jadi penyatuan tetap client-side.
- **Radar ↔ DW (berkas kembar):** `satukan()`/penjumlahan pax kembar dengan Kalender Tamu di DW (sudah tercatat di `_lintas-modul.md:55`).

Pertanyaan terbuka: **tidak ada** (kedua ⚠️ bersifat bentuk endpoint yang sudah dipahami, bukan keputusan yang menunggu owner).

## J. Progres build (2026-09-30)

### Cek visual 2026-10-08 (issue #19, Lane A2 — mock read-only, akun jebe)
- 1366px: Radar, Kalender Terpadu, Daftar Event, Reservasi, Promo, Detail Lengkap (mkt + evt) — semua merender tanpa galat, paritas dengan `deploy/radar` (§C: 5 rail + 1 detail internal; pita sumber gagal, auto-refresh 5 menit, "Radar hanya membaca", WA harian + "Buka reservasi hari ini").
- 390px: keenam layar di atas — kartu statistik 2 kolom, tabel jadi kartu di bawah `lg`, tidak ada geser samping kecuali kisi kalender 7 kolom (disengaja, lihat di bawah).
- Layar terkunci: user tanpa kunci `radar` mendapat 403 "Belum ada akses" di `/radar`; kartu Radar tidak muncul di beranda. Radar tidak punya matriks role (semua pemegang kunci melihat semua halaman).
- Perbaikan: `pages/radar/detail/[sumber]/[id].vue` — payload sumber yang tak lengkap (mis. `mkt` tanpa `mkt`) dulu hanya menampilkan header kosong; sekarang ada pesan "Detail acara ini belum lengkap…" (terverifikasi di browser dengan respons tanpa payload).
- Tidak ada aksi tulis di modul ini (read-only), jadi bagian D tidak berlaku.
- API: `app/Modules/Radar` di laksamana-api (RadarRules murni + RadarBoard + RadarController), Unit test `RadarRulesTest`; Feature test `tests/Feature/Radar` **belum dijalankan** (butuh dump lokal).
- Vue: `useRadar.ts`, `utils/radar.ts`, `utils/layar/radar.ts`, komponen `components/radar/*`, enam halaman di `pages/radar/`. Kartu Radar di `utils/modul.ts` (grup Operasional) + shell di `modul-shell.ts`.
- Dicek di browser headless dengan API tiruan (390px & 1366px): semua halaman merender tanpa galat. **Belum dicek dengan data dev sungguhan.**
- Beda sengaja dari Office lama: Kalender Terpadu tetap kisi 7 kolom yang bisa digulir mendatar di HP (bukan AppList) — bentuk bulanannya yang dicari orang; Tabel di Daftar Event jatuh ke kartu di bawah `lg`.

### Sinkron Office 5–9 Okt 2026 — VUE-5 label status Event (2026-10-10, branch `feat/sinkron-office-2026-10`)

Sumber Office lama: commit `4ee871e` (`deploy/radar/index.html`: `ST_EVT_JALAN`).
Teks penjelasan di `pages/radar/index.vue` dan `agenda.vue` ("Event: Upcoming, Today & Finished")
menjadi "Event: Approval / Upcoming / Event Done". Penyaring status di klien tidak perlu diubah:
`utils/radar.ts` tidak menyaring status Event (server yang menyaring), `agSelesai()` (`/done|finish/i`)
sudah cocok dengan "Event Done", dan daftar status diambil dinamis dari data (`statusPasti()`).
Catatan: penyaring server (API-3, `RadarRules::EVT_JALAN` di laksamana-api) masih daftar lama —
acara "Approval"/"Event Done" baru tampil setelah API-3 digabung.


### Visual #178: mengikuti Office lama (23 Oktober 2026)

- Pilihan owner: **A**, tetap memakai susunan Office lama dan blok DESIGN.md. Enam layar diperiksa pada 390px dan 1366px dengan mock read-only lokal.
- Kalender HP menjadi daftar per tanggal; desktop mempertahankan kisi bulanan. Kontrol diperbesar, label sumber/pax VIP diperjelas, dan kelas mode gelap di Radar dibuang.
- Tidak ada layar ditunda (K/G), gap API baru, dependensi, atau test per issue.
- Build dan lint khusus Radar lulus. Lint/typecheck seluruh repo masih gagal di file luar Radar, ditindaklanjuti pada #189. Ikon navigasi offline yang memerlukan konfigurasi fondasi dicatat di #190.
- [Checklist parity, bukti screenshot, hasil pemeriksaan dan batas verifikasi](visual-radar/README.md).
