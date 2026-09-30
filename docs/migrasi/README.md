# Migrasi laksamana-office → laksamana-office-vue

Indeks inventaris modul. Sumber kebenaran perilaku/tampilan: `laksamana-office/` (frontend lama).
Kontrak backend baru: `laksamana-api/docs/api/<modul>.md`.

> **Mulai dari [PLAN.md](PLAN.md).** Tabel di bawah adalah hasil riset (Fase 0). Kolom "gap v1"
> dan "pertanyaan" adalah angka SEBELUM triase 2026-09-29; yang berlaku sekarang ada di
> [_pertanyaan.md](_pertanyaan.md) (10 keputusan owner, semua sudah diputuskan) dan [_gap-api.md](_gap-api.md) (13 gap API).

Status: ⬜ belum · 🟡 sedang dikerjakan · ✅ selesai · ⚠️ selesai dengan celah

| modul | file | status | layar | gap v1 | pertanyaan | catatan |
|---|---|---|---|---|---|---|
| hlife | [hlife.md](hlife.md) | ⚠️ selesai dengan celah | 14 (2 tersembunyi) | 0 ❌ · 2 ⚠️ | 1 | Howandi Life OS |
| akademi | [akademi.md](akademi.md) | ✅ selesai | 13 | 0 | 0 | 6 layar admin |
| hr | [hr.md](hr.md) | ⚠️ selesai dengan celah | 17 (4 admin) | 0 ❌ · 4 ⚠️ | 3 | People OS; skor dihitung di browser |
| konten | [konten.md](konten.md) | ⚠️ selesai dengan celah | 20 (1 di luar menu; 2 sub-tab KOL) | 0 ❌ · 3 ⚠️ | 4 | 4.691 baris; blob saveAll → CRUD per-baris; rumus performa di `assets/performa-konten.js` |
| bd | [bd.md](bd.md) | ⚠️ selesai dengan celah | 11 (2 tersembunyi) | 2 ❌ · 1 ⚠️ | 4 | BD OS — task/project/purchasing/promo; promo dibaca Radar & Kompas |
| absensi | [absensi.md](absensi.md) | ⚠️ selesai dengan celah | 5 layar (+1 masuk) | 7 ❌ · 5 ⚠️ | 5 | audit kelengkapan halaman Vue (7 ❌ = celah cakupan Vue, bukan gap API) |
| jadwal | [jadwal.md](jadwal.md) | ⚠️ selesai dengan celah | 20 (1 pemilih + 8 jadwal + 11 dw) | 3 ❌ · 5 ⚠️ | 8 | jadwal + dw + roster |
| cashier | [cashier.md](cashier.md) | ⚠️ selesai dengan celah | 11 | 0 ❌ · 4 ⚠️ | 4 | tanpa DB sendiri; blob Kompas + embed Reservasi + `assets/cocok-bri.js` |
| finance | [finance.md](finance.md) | ⚠️ selesai dengan celah | 29 (1 pemilih + 6 omset + 15 kas + 7 brankas) + 2 pengalih | 2 ❌ · 5 ⚠️ | 6 | omset/kas/brankas/rekap + kompas |
| stock | [stock.md](stock.md) | ⚠️ selesai dengan celah | 26 (1 pemilih) | 2 ❌ · 11 ⚠️ | 7 | 5 panel: ordering/purchasing/tree/usage/hpp |
| reservasi | [reservasi.md](reservasi.md) | ⚠️ selesai dengan celah | 12 (0 tersembunyi) | 3 ❌ · 6 ⚠️ | 9 | reservasi + service_excellent |
| event | [event.md](event.md) | ⚠️ selesai dengan celah | 28 (17 EMS, 2 tersembunyi + 11 publik ticketing) | 4 ❌ · 7 ⚠️ | 7 | event + ticketing; matriks izin tak tersimpan |
| marketing | [marketing.md](marketing.md) | ⚠️ selesai dengan celah | 23 (3 tersembunyi) + detail event | 3 ❌ · 8 ⚠️ | 5 | 20.365 baris; CRM+Event+VIP+Design+PO |
| analytics | [analytics.md](analytics.md) | ✅ selesai (ringkas) | 18 | 0 ❌ · 3 ⚠️ | 0 | inventaris ringkas (belum ada di Vue); KOREKSI: pakai backend+CK Kompas |
| radar | [radar.md](radar.md) | ✅ selesai (ringkas) | 6 (5 rail + 1 detail) | 0 ❌ · 2 ⚠️ | 0 | dibangun di Vue 2026-09-30 lewat `/radar/*` API; read-only |
| help | [help.md](help.md) | ✅ selesai (ringkas) | 3 jenis (beranda + 25 bab + cari) | 0 | 0 | inventaris ringkas (statis, tanpa backend) |
| investor | [investor.md](investor.md) | ✅ selesai (ringkas) | 6 (1 masuk + 5 tab) | 0 ❌ · 1 ⚠️ | 0 | KOREKSI: pakai backend Kompas+Account |

Berkas lintas modul: [_lintas-modul.md](_lintas-modul.md) · [_pertanyaan.md](_pertanyaan.md)

## Peta modul (verifikasi dari `deploy/index.html`)

Sumber menu launcher lama: `laksamana-office/deploy/index.html`, `BRANCHES` (`:1108`) dan
`SUPER_BRANCHES` (`:2847`). Sumber menu Vue: `laksamana-office-vue/app/utils/modul.ts` (`MODUL`, `:25`).

| key Vue | frontend lama | kunci akses | backend lama | kontrak v1 |
|---|---|---|---|---|
| absensi | `absensi/index.html` (di luar `deploy/`) | `absensi` | `absensi-mysql/` | `docs/api/absensi.md` |
| jadwal | `deploy/roster/` (pemilih) → `deploy/jadwal/`, `deploy/dw/` | `jadwal`, `dw` | `jadwal-mysql/`, `dw-mysql/` | `jadwal.md`, `dw.md` |
| akademi | `deploy/akademi/` | `akademi` | `akademi-mysql/` | `akademi.md` |
| hr | `deploy/hr/` | `hr` | `hr-mysql/` | `hr.md` |
| stock | `deploy/stock/` (pemilih) → `ordering/ purchasing/ tree/ usage/ hpp/` | `ordering`, `purchasing`, `tree`, `usage`, `hpp` | `stock-mysql/` | `stock.md` |
| reservasi | `deploy/reservasi/` + `deploy/service_excellent/` | `reservasi`, `service_excellent` | `reservasi-mysql/` | `reservasi.md` |
| cashier | `deploy/cashier/` | `cashier` | memanggil kompas, reservasi | `kompas.md`, `reservasi.md` |
| konten | `deploy/konten/` | `konten` | `konten-mysql/` | `konten.md` |
| event | `deploy/event/` + `deploy/ticketing/` | `event` | `event-mysql/`, `ticketing-mysql/` | `event.md`, `ticketing.md` |
| marketing | `deploy/marketing/` | `marketing` | `marketing-mysql/` | `marketing.md` |
| finance | `deploy/finance/` (pemilih) → `omset/ kas/ brankas/ rekap/`, + `deploy/kompas/` (pengalih) | `kompas`, `finance`, `brankas` | `finance-mysql/`, `kompas-mysql/` | `finance.md`, `kompas.md` |
| bd | `deploy/bd/` | `bd` | `bd-mysql/` | `bd.md` |
| hlife | `deploy/howandi_life/` | `howandi_life` | `howandi-life-mysql/` | `hlife.md` |
| — (belum di Vue) | `deploy/analytics/` | `analytics` | baca stock/hpp, konten, marketing, kompas, event; **menyimpan** ke backend Kompas | `kompas.md` (`/kompas/analytics`) |
| — | `deploy/radar/` | `radar` | baca marketing, reservasi, event, bd | — |
| — | `deploy/help/` | `help` | statis (`panduan/`, `gambar/`), tanpa backend | — |
| — | `investor/` (di luar `deploy/`, domain sendiri) | `investor` | **Kompas** (omset/laporan) + **Account** (SSO) | `kompas.md` (`/kompas/investor/*`) |

### Koreksi terhadap peta awal (dari kode, bukan dari tabel tugas)

- **Roster** ada di `deploy/roster/index.html` (275 baris) dan merupakan **pemilih panel** yang
  mengalihkan sendiri bila user hanya berhak satu panel (`deploy/index.html:1255-1258`). Bukan di
  `deploy/roster/` sebagai aplikasi. Modul Vue `jadwal` mengarah ke sini.
- **finance** punya **3 panel**: `omset/` (izin `kompas`), `kas/` (izin `finance`), `brankas/`
  (izin `brankas`), plus `rekap/` yang hanya pengalih ke `kas/#rekap` (`deploy/index.html:1316-1321`).
  `deploy/kompas/` (56 baris) kini hanya halaman pengalih.
- **service_excellent** punya kunci akses sendiri (`service_excellent`), bukan `reservasi`
  (`deploy/index.html:1139`). Kartunya terpisah dari Reservasi.
- **howandi_life** tidak ada di `BRANCHES`; ia di `SUPER_BRANCHES` (`deploy/index.html:2847`) dan
  muncul sebagai kartu khusus "Akses Nahkoda". Aksesnya tidak diberikan ke superadmin Howandi
  (`deploy/index.html:995`).
- **help** punya kunci sendiri `help` (`deploy/index.html:1412`), walaupun statis tanpa backend.
