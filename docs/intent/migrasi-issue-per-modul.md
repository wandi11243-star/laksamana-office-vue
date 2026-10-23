# Intent: issue per modul laksamana-office-vue (visual parity vs reimagine)

Dikonfirmasi owner. Status: disetujui untuk dikerjakan.

## Hasil yang diminta

19 issue GitHub di `laksamana-office-vue` (repo preferensi), satu per modul, masing-masing berisi penjelasan dan satu blok prompt copy-paste yang interaktif. Issue susulan di `laksamana-api` dibuat langsung oleh agentic bila modul butuh perubahan API.

## Pengguna

- Kamu (Paket A, 11 issue, ±127 layar): finance, konten, hr, akademi, reservasi (termasuk service_excellent), cashier, bd, homepage, help, investor, radar
- Wandi (Paket B, 8 issue, ±126 layar): stock, marketing, jadwal, dw, analytics, event, hlife, absensi
- Agentic lain yang mengeksekusi prompt di tiap issue secara interaktif dengan owner

## Kenapa sekarang

`laksamana-office-vue` (Nuxt 4 + Nuxt UI, API `/api/v1`) adalah pengganti `laksamana-office` (HTML lama). Modul sudah diimpor. Tiap modul harus mencapai kondisi bisa dipakai orang, dengan keputusan visual per modul: samakan plek dengan lama atau reimagine.

## Selesai per modul (Definition of Done)

- Semua layar di `docs/migrasi/<modul>.md` bagian C ada di Vue, atau ditandai Segera dengan alasan (ID K/G)
- Tersambung ke `/api/v1` lewat `useApi()`, tanpa URL legacy
- `npm run lint`, `npm run typecheck`, `npm run build` hijau
- Cek browser 390px dan 1366px (lama vs baru), dicatat di PR
- Tanpa test per issue. Test dikerjakan setelah semua merge ke main

## Batasan

- UI bahasa Indonesia sentence case, ikut `AGENTS.md`, `DESIGN.md`, `TIM-A.md`
- Reimagine boleh web-search inspirasi, tapi wajib skill antislop (core, ui, layoutmobile, copywriting)
- Agentic boleh langsung bikin dan kerjakan issue API (label `tim-a`), pasang tautan blocked-by di issue Vue
- `laksamana-office` read-only, tidak diubah
- Merge oleh owner/reviewer, termasuk Wandi

## Di luar cakupan

- Test per modul
- Mengubah frontend lama
- Migrasi data dan cutover user (fase terpisah, lihat `cutover.md`)

## Referensi per modul

Sumber: inventaris 2026-10-23 (cek `ls` langsung).

### Paket A (assignee: @dwipapap)

| modul | deploy lama | halaman Vue | kontrak API | layar | spec |
|---|---|---|---|---|---|
| finance | `laksamana-office/deploy/finance/` | `app/pages/finance/` (30) | ada | 29 | ada |
| konten | `laksamana-office/deploy/konten/` | `app/pages/konten/` (28) | ada | 20 | ada |
| hr | `laksamana-office/deploy/hr/` | `app/pages/hr/` (17) | ada | 17 | ada |
| akademi | `laksamana-office/deploy/akademi/` | `app/pages/akademi/` (14) | ada | 13 | ada |
| reservasi | `laksamana-office/deploy/reservasi/` + `deploy/service_excellent/` | `app/pages/reservasi/` (8) + `app/pages/service_excellent/` (5) | ada | 12 | ada |
| cashier | `laksamana-office/deploy/cashier/` | `app/pages/cashier/` (12) | tidak | 11 | ada |
| bd | `laksamana-office/deploy/bd/` | `app/pages/bd/` (14) | ada | 11 | ada |
| homepage | greenfield (`laksamana-homepage/`) | `app/pages/homepage/` (6) | ada | 5 | tidak |
| help | `laksamana-office/deploy/help/` | `app/pages/help/` (2) | tidak | 3 jenis | ada |
| investor | `laksamana-office/deploy/help/panduan/investor.js` | `app/pages/investor/` (6) | tidak | 6 | ada |
| radar | `laksamana-office/deploy/radar/` | `app/pages/radar/` (6) | ada | 6 | ada |

### Paket B (assignee: @wandi11243-star)

| modul | deploy lama | halaman Vue | kontrak API | layar | spec |
|---|---|---|---|---|---|
| stock | `laksamana-office/deploy/stock/` | `app/pages/stock/` (32) | ada | 26 | ada |
| marketing | `laksamana-office/deploy/marketing/index.html` | `app/pages/marketing/` (22) | ada | 23 | ada |
| jadwal | `laksamana-office/deploy/jadwal/` (+ `deploy/roster/`) | `app/pages/jadwal/` (9) | ada | 20 gabungan | ada |
| dw | `laksamana-office/deploy/dw/index.html` | `app/pages/dw/` (11) | ada | 11 | tidak |
| analytics | `laksamana-office/deploy/analytics/` | `app/pages/analytics/` (19) | tidak | 18 | ada |
| event | `laksamana-office/deploy/event/` | `app/pages/event/` (23) | ada | 28 | ada |
| hlife | `laksamana-office/deploy/howandi_life/` (nama beda) | `app/pages/hlife/` (15) | ada | 14 | ada |
| absensi | `laksamana-office/absensi/` (standalone, bukan deploy) | `app/pages/absensi/` (5) | ada | 6 | ada |

## Label per issue

Selalu `tim-a` plus satu jalur: finance dan cashier ke `jalur:uang`; konten dan marketing ke `jalur:konten-marketing`; stock, event, bd, reservasi ke `jalur:operasional`; jadwal, dw, hr, absensi, akademi, hlife ke `jalur:sdm`; analytics, radar, investor, help, homepage ke `jalur:penyelesaian`.
