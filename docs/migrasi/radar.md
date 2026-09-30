# Radar — inventaris migrasi

Status: ✅ selesai (inventaris ringkas — lihat §4.14 & §6: hanya bagian A, B, C, H)
Terakhir diperbarui: 2026-09-29

## Ringkasan
- Jumlah layar: 6 (5 di rail + 1 halaman Detail internal; 0 tersembunyi) · Aksi backend lama: 0 tulis, 5 pembacaan lintas modul · Gap v1: 0 ❌ (2 ⚠️, lihat catatan)
- Radar adalah **papan koordinasi lintas modul**: menyatukan agenda Marketing, Event dan Reservasi ke satu kalender + daftar, plus daftar Promo dari BD OS. Ia **hanya membaca** — `nav-foot` secara eksplisit berbunyi "Radar hanya membaca. Perubahan dilakukan di modul asalnya." (`deploy/radar/index.html:2524`).
- Penggunanya kru operasional/floor & manajemen pemegang kunci `radar`. Risiko migrasi terbesar: **penyatuan tiga bentuk data berbeda** (Marketing `events[]`, Event `events[]`, Reservasi `reservations[]`) dan **konversi zona waktu** (Event menyimpan instant UTC berakhiran `Z`, Marketing menyimpan tanggal lokal polos) (`index.html:739-768`); salah geser = acara muncul di jam/hari yang keliru.
- **Sejak 27 Sep 2026 `radar` modul bawaan SEMUA akun** (Office lama `modul_bawaan_untuk`, commit `c84d826`; di laksamana-api `OfficeAccess::builtinModules`, 2026-09-30). Pencabutan per orang (grant access=0) tetap berlaku. Yang bukan Head (kata utuh "Head" di Tim/Keterangan) dan bukan admin modul Radar **tidak melihat nominal** (harga/deal, DP, pelunasan, biaya) — dijaga di layarnya (`radarBolehUang`), bukan di server. Catatan untuk build: endpoint sumber (marketing/event/reservasi/bd) tetap digate modul masing-masing, jadi pemegang Radar tanpa modul itu akan kena 403 — perlu endpoint gabungan Radar (belum ada, terkait G-05).
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
- Composable `useRadar.ts` (fungsi → endpoint):
  - `getMarketingState()`, `getEventState()`, `getBdState()` → `GET /api/v1/{marketing|event|bd}/state`.
  - `getReservations({from,to})` → `GET /api/v1/reservasi/reservations`; ⚠️ bentuk per-record, bukan blob — penyatuan dilakukan client-side seperti lama.
  - `getMarketingFile(key)` → `GET /api/v1/marketing/files/{key}` untuk lampiran gambar.
  - **Tidak ada tulis** — jangan sediakan satu pun mutasi di modul ini.
- Penyatuan wajib di satu tempat (satu util, mis. `useRadarAgenda`): pemetaan Marketing `events[]→{tgl,nama,jenis,pax,status}`, Event `events[]→{start_datetime,title,category,venue,capacity}`, Reservasi `reservations[]→{date,name,time,pax,table}` (`index.html:739-768`); nilai rupiah Marketing **sengaja tidak dihitung** (`:780-788`).
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
`| radar | [radar.md](radar.md) | ✅ selesai (ringkas) | 6 (5 rail + 1 detail) | 0 ❌ · 2 ⚠️ | 0 | inventaris ringkas (belum ada di Vue); read-only lintas Marketing/Event/Reservasi/BD |`

Baris `_lintas-modul.md` (tambahkan/dipertahankan; baris lama `_lintas-modul.md:37` masih benar):
- **Radar ← Marketing, Event, Reservasi, BD** (VERIFIED, read-only): `getAll` keempat modul (`radar/index.html:598-613,722`) → v1 `GET /marketing/state`, `/event/state`, `/reservasi/reservations`, `/bd/state`; lampiran event lewat `GET /marketing/files/{key}` (`:2026-2037`). BD dipakai **hanya** untuk tab Promo (BD tidak punya acara bertanggal, `:603-609`). Auto-refresh 5 menit (`:2561,2687`). v1 ⚠️: Reservasi tidak punya blob `getAll` setara (per-record), jadi penyatuan tetap client-side.
- **Radar ↔ DW (berkas kembar):** `satukan()`/penjumlahan pax kembar dengan Kalender Tamu di DW (sudah tercatat di `_lintas-modul.md:55`).

Pertanyaan terbuka: **tidak ada** (kedua ⚠️ bersifat bentuk endpoint yang sudah dipahami, bukan keputusan yang menunggu owner).
