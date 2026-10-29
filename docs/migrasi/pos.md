# POS — rencana & progres build

Sumber kebenaran: `laksamana-office/deploy/pos/index.html` (+ `menu-data.js`,
`rekap-2026.js`, `../assets/venue-layouts.js`) dan
`laksamana-office/kompas-mysql/{api.php,lib_pos.php}`.

Kontrak API: `laksamana-api/docs/api/kompas.md` "POS cashier app" + legacy
compat `posList/posSimpan/posSetting/posEkspor/posImpor` (pintu `pos`, tanpa
DELETE). Kunci akses Vue: `pos` (`app/utils/modul.ts`, `MODUL_SHELL.pos`).

## Layar (semua di bawah `/pos`, kunci `pos`)

| # | Layar lama | Vue | Catatan |
|---|---|---|---|
| 1 | login (PIN pad) | `pos/kasir.vue` (gerbang PIN) | PIN dari setelan bersama; sesi Office tetap syarat (`definePageMeta`) |
| 2 | order (grid 3 tingkat) | `pos/kasir.vue` | Grup FOOD/BEVERAGES/OTHERS dari kolom `jenis` HPP, sub = `kat`, ubin putih/biru/oranye + breadcrumb |
| 3 | meja (denah) | `pos/kasir.vue` + `PosDenah.vue` | Geometri dari `venue-layouts.ts` (Lt.1 Weekday/Weekend + Lt.2); hunian dari open order. `DenahPeta` tidak dipakai: mesin huninya (`kunci-meja.ts`) bertipe reservasi |
| 4 | pay + struk | `pos/kasir.vue` (sheet) | Tombol Bayar full-width; struk teks 42-kolom bawaan + grafis opsional; logo hitam 70mm/80mm → 48mm/58mm; kaki + ruang sobek; cetak via dokumen print |
| 5 | terbuka | `pos/terbuka.vue` | Lanjut ke kasir (`?order=`), batal = status `batal` (tanpa DELETE) |
| 6 | riwayat | `pos/riwayat.vue` | Filter tanggal, cetak ulang |
| 7 | laporan | `pos/laporan.vue` | KPI + bar bulanan + tabel harian; klik tanggal = rincian bill |
| 8 | setting (menu/user/pajak/printer/pindah) | `pos/pengaturan.vue` | Admin modul saja (layar `boleh`). Printer & panduan LAN di tab printer |

## Sinkron

`usePos.ts`: antrean offline di `localStorage` (kunci lama `lm_pos_*`),
poll 15 dtk (unggah antrean → tarik server → unggah sisa), konflik =
ganti baris server. `ver` server dipakai melewatkan render ulang.

## Yang disengaja beda dari POS lama (keputusan)

- Tanpa rekonstruksi bill deterministik dari rekap (`rekap-2026.js` tidak
  dibawa): dengan server, bill HARI INI & ke belakang adalah data sungguhan.
- Tanpa Editor denah: denah milik Reservasi (`DenahEditor`); POS hanya membaca.
- Tanpa impor massal ke HPP: menu POS = snapshot HPP (`pos-menu.ts`,
  generate ulang dari `menu-data.js`) + selisih server, seperti POS lama.
- Light-only (AGENTS.md): tidak ada gaya `dark:`.

## Progres

- [x] Backend v1 + legacy compat + tes (`PosKasirTest`, 9 passed)
- [x] `lint` + `typecheck` file POS bersih
- [ ] Cek visual 390px & 1366px di browser
- [ ] `office:grant <user> pos` di dev/prod agar kunci `pos` ada di Kelola Akses
