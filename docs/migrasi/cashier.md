# Cashier — inventaris migrasi

Status: ⚠️ selesai dengan celah
Terakhir diperbarui: 2026-09-29

> **Triase 2026-09-29** — status di tabel E yang bertentangan dengan catatan ini: catatan ini yang berlaku.
> Rincian: [`_pertanyaan.md`](_pertanyaan.md), [`_gap-api.md`](_gap-api.md).
> - `porsiPic` → K-04. Simpan: part endpoint Kompas, bukan `saveAll` (T-03).
> - Dana Masuk: komponen `DanaMasukPanel` dari modul reservasi (T-12). `syncPicOffice` → T-01.

## Ringkasan
- Jumlah layar: 11 (0 tersembunyi; semuanya di rail nav) · Aksi backend lama: 15 · Gap v1: 0 ❌ · 4 ⚠️
- Cashier adalah Panel pekerjaan kasir: **Report Daily** (setoran POS vs Actual per metode), **Piutang/Bon**, **Compliment**, **Daily Stock Rokok** + rekap + setelan item, **Performa Kasir** (omset diakui + bonus), **Dana Masuk (DP)** (embed modul Reservasi), **Pencocokan QRIS BRI**, **Void Menu**, dan **Kelola Akses Kru** (baca saja).
- Modul ini **TIDAK punya database/backend sendiri**: `TIDAK DITEMUKAN (dicari: laksamana-office/cashier-mysql/)`. Semua tulis-baca memakai **blob Kompas** (`../kompas-api-mysql/api.php`, `:484`), kecuali identitas & DP: `account-api-mysql` (`:1896`,`:3886`,`:4016`), `reservasi-api-mysql` (`:3989`), dan iframe `../reservasi/?embed=finance` (`:3945`).
- Kunci modulnya `cashier`, SENGAJA bukan `kompas` (`deploy/index.html:1300-1305`): kasir boleh menyetor & mencatat compliment tanpa memegang seluruh angka omset/target/bonus perusahaan (`cashier/index.html:11-17`).
- Risiko terbesar saat migrasi: (1) **blob Kompas ditulis utuh** oleh layar ini lewat `saveAll` + penjaga `baseTs`; v1 tidak punya `saveAll` — harus dipecah ke `/sections/{key}`, `/reports/{date}`, `/days/{date}` dengan `If-Match`, dan pemecahan itu per-layar; (2) banyak **rumus uang** hidup di browser (selisih setoran, potongan event, bonus kasir, sisa rokok) yang wajib dipindah apa adanya; (3) beberapa fungsi adalah **berkas kembar** dengan Kompas/Finance dan pernah tertinggal — perilaku Vue harus mengikuti versi Kompas yang lebih baru (lihat §F.12 `porsiPic`).

## A. Sumber
| jenis | path | baris |
|---|---|---|
| frontend lama | laksamana-office/deploy/cashier/index.html | 4.107 |
| backend lama | TIDAK DITEMUKAN (dicari: `laksamana-office/cashier-mysql/`) — memanggil `kompas-mysql/api.php` (`:484`), `account-api-mysql/api.php` (`:1896`,`:3886`,`:4016`), `reservasi-api-mysql/api.php` (`:3989`), iframe `../reservasi/?embed=finance` (`:3945`) | — |
| aset bersama | laksamana-office/deploy/assets/cocok-bri.js (mesin QRIS BRI, 2.240 baris; juga dipakai `finance/kas` & `reservasi`) | `:39` |
| kontrak v1 | laksamana-api/docs/api/kompas.md (utama), reservasi.md (DP), account.md (roster) | — |
| kontrak v1 (rujukan) | laksamana-api/docs/api/finance.md (hanya menyebut halaman Kasir/DP sebagai milik kompas/reservasi, `finance.md:28,35`) | — |
| spec port | laksamana-api/docs/modules/kompas.md, reservasi.md, account.md | — |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:2611-2670` "Cashier: berkas kembar KETIGA yang tertinggal DUA kali" | 2611-2670 |
| catatan CLAUDE.md lama | `:2671-2720` "Cashier: Performa Kasir cuma untuk diri sendiri" | 2671-2720 |
| catatan CLAUDE.md lama | `:2777-2800` "TARGET DICABUT SELURUHNYA dari Finance & Cashier" | 2777-2800 |
| catatan CLAUDE.md lama | `:2880-2910` "Open Bill: satu rumus untuk dua layar" | 2880-2910 |
| catatan CLAUDE.md lama | `:10006-10045` "Catatan Void manual: diisi Cashier, dibaca Kas Kecil" | 10006-10045 |
| catatan CLAUDE.md lama | `:10205-10260` "SATU BILL, BANYAK ITEM" | 10205-10260 |
| catatan CLAUDE.md lama | `:10450-10495` "REVISI: service & tax SEKALI per bill, dan dua kolom pengganti `pemesan`" | 10450-10495 |

## B. Akses
- **Kunci Modul di launcher:** `cashier`, `access:['cashier']`, grup operasional, `title:'Cashier'`, `tag:'Setoran & Dana Masuk'` (`deploy/index.html:1305`). Dipisah dari Kompas sejak 28 Juli 2026 (`:1295-1304`).
- **Guard di halaman:** butuh sesi hidup dan `modules` memuat `'*'` atau `'cashier'`, jika tidak → `location.replace('../')` (`cashier/index.html:20-27`; syarat sama di `bacaSesi()` `:562-582`).
- **Role/matriks izin di dalam modul:** TIDAK ADA level (`:552-560`). `bolehLihat(view){ return !!TITLES[view]; }` (`:583`) — semua pemegang kunci boleh membuka kesebelas halamannya. Halaman Akses menjelaskan ini (`:4042-4046`).
- **Admin Modul:** `adminModules` dibaca sejak 7 Sep 2026 → `isAdmin = adm.indexOf('*')>-1 || adm.indexOf('cashier')>-1` (`:574-575`). Efeknya HANYA dua: (a) rincian **per kasir** di Performa Kasir (`bolehLihatSemuaKasir()` `:3675`); (b) form ubah **Setelan tax & service** Void (`:2748`, `:2756-2763`). Server tetap penjaga sungguhan (`:3991-3993`).
- **Aksi khusus admin:** ubah persen Void (`voidSetting`, butuh admin modul cashier/finance); lihat rincian kasir lain (gerbang di `draw()` `:3774-3783`).
- **Token sesi:** dikirim sebagai `sesi` untuk endpoint tulis Void (`:2527-2535`), dan dipakai mesin BRI (`:3990`).

## C. Daftar layar (dari TITLES + nav)
Sumber: `TITLES` (`:1126-1137`), rail nav (`:379-414`), dispatcher `render()` (`:1163-1169`). **Tidak ada layar tersembunyi**; ke-11-nya ada di nav. Komentar nav "Empat halaman, itu saja" (`:382-385`) adalah sisa lama — nav nyatanya memuat 11 tautan.

| key | judul | subjudul | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| report | Report Daily Kasir | Setoran per metode pembayaran: POS vs Actual | semua pemegang akses | tidak | `:1127`, `:386` |
| piutang | Piutang / Bon | Bill yang belum dibayar tamu & owner — beserta metode POS sementaranya | semua | tidak | `:1128`, `:387` |
| compliment | Compliment | Catatan compliment beserta alasan & PIC penanggungnya | semua | tidak | `:1129`, `:388` |
| voidb | Void Menu | Tiap menu yang di-void wajib dicatat berikut kronologinya | semua | tidak | `:1136`, `:393` |
| rokok | Daily Stock Rokok | Barang masuk & keluar per hari, per item | semua | tidak | `:1130`, `:394` |
| rokokrekap | Rekap Stock Rokok | Masuk, keluar, dan sisa tiap produk sepanjang satu bulan | semua | tidak | `:1131`, `:401` |
| kasir | Performa Kasir | Omset yang diakui tiap kasir — angka final | semua (rincian per kasir hanya diri sendiri / admin) | tidak | `:1133`, `:402` |
| dp | Dana Masuk (DP) | Uang DP reservasi yang sudah masuk — dibaca dari modul Reservasi | semua | tidak | `:1134`, `:403` |
| bri | Pencocokan QRIS BRI | Mutasi masuk rekening BRI dicocokkan ke DP reservasi | semua | tidak | `:1135`, `:404` |
| rokokset | Pengaturan Item Rokok | Item apa saja yang muncul di lembar Daily Stock Rokok | semua | tidak | `:1132`, `:413` |
| akses | Kelola Akses Kru | Siapa saja yang bisa membuka modul Cashier | semua | tidak | `:1137`, `:414` |

Kontrol topbar: pemilih **Periode** (bulan) dan pemilih tanggal untuk mode analitik, hanya untuk layar di `VIEW_ANALITIK=['kasir']` — mode **hari/bulan** (`:1078-1114`). Halaman lain punya pemilih tanggalnya sendiri (kalender kustom `calInner` `:3039-3059`).

## D. Detail per layar

### D.1 report — Report Daily Kasir
- **Tampilan:** kepala "Setoran per Metode Pembayaran" + subtitle "Isi POS dan Actual tiap metode. Boleh disubmit kapan saja." + pemilih Tanggal (`:1208-1212`); pita jejak submit (`jejakHtml` `:1379-1390`); tabel kolom **Metode Pembayaran · POS · Actual · Selisih** (+ kolom **Sisa Selisih** hanya bila hari itu ada bon/pelunasan, `:1207`,`:1224`); baris TOTAL (`:1226-1229`); catatan metode (`catatanMetode` `:1423-1444`); bila ada bon → kartu **"Penjelasan Selisih Hari Ini"** (`kartuPenjelasan` `:1477-1522`); 3–4 kartu stat: **Total POS**, **Total Actual**, **Selisih POS vs Actual**, (+ **Sisa Selisih**) (`:1234-1242`). Catatan panjang `:1187-1207` menerangkan mengapa halaman ini **sengaja tidak menyebut omset harian** (kartu "Tagihan Menurut Omset" dibuang).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | `Submit Report` / `Update Report` (teks berubah bila `rec.submitted`) | membangun `DB.reports[repDate]={pay,by,at,submitted:true,log}`, lalu `save()` + `simpanTunggu` | `saveAll` | `PUT /api/v1/kompas/reports/{YYYY-MM-DD}` (If-Match = versi part) | `:1245`, `:1333-1345` |
  | input POS / Actual per metode (`.rf`) | hitung ulang selisih hidup | — (lokal) | — | `:1221-1222`, `:1332` |
  | `Buka halaman Piutang →` | `go('piutang')` | — | — | `:1500` |
- **Form & field:** tak ada form; tabel input per metode. Kunci `pay` = `PAYS` (20 baris, urut alfabetis) `:611-634`:
  `cash`=**Cash**, `compliment`=**Compliment**, `edc_bca`=**EDC BCA**, `edc_bri`=**EDC BRI**, `edc_mandiri`=**EDC Mandiri**, `error_bar`=**Error Bar**, `error_customer`=**Error Customer**, `error_floor`=**Error Floor**, `error_kasir`=**Error Kasir**, `error_kitchen`=**Error Kitchen**, `gofood`=**Gofood**, `grabfood`=**Grabfood**, `member_dep`=**Member Deposit**, `qris_bca`=**QRIS BCA**, `qris_bri`=**QRIS BRI**, `qris_esb`=**QRIS POS** (label sejak 12 Agu 2026; kunci tetap `qris_esb`), `qris_mandiri`=**QRIS Mandiri**, `tiktokgo`=**TikTok Go**, `transfer_uob`=**Transfer UOB**, `voucher`=**Voucher**.
  Terisi default `repDate=todayISO()` (`:1190`). Bidang baris report: `{pay:{<kunci>:{pos,actual}}, by, at, submitted, log[]}` (`seed()` `:672`).
- **Validasi & pesan:** submit **tidak pernah dikunci** — selisih hanya diberi peringatan (`:644-648`, `:1299-1305`). Bila `|sisa|>5000`: "⚠ Total selisih … lewat toleransi … perlu ditelusuri." (`:1440-1441`). Bila aman: "✓ Selisih antar metode saling menutup — total …, masih dalam toleransi …." (`:1442-1443`). Baris belum diisi (POS 0 & Actual 0) tidak dinilai & dikeluarkan dari total bon (`:1263-1277`). Pesan sukses: "✓ Report {tanggal} tersimpan di server …" (`:1343`).
- **Perhitungan di browser:** `selisih = actual − pos` (`:1258`); `tsel = Σactual − Σpos` (`:1295`); `harus[k] = pelunasan[k] − bon[k]` (`:1408`); `sisa = tsel − Σharus` (`:1303`); `aman = |sisa| ≤ SELISIH_TOLERANSI=5000` (`:649`,`:1305`). `TOTAL` POS/Actual = Σ kolom (`:1250-1257`).
- **Real-time/polling:** tak ada `setInterval`. Auto-save: `save()` debounce 1.000 ms → `kirim()` (`:855-863`); retry jeda menanjak `[5000,10000,20000,40000,60000]` ms (`:869-876`); palang `beforeunload` bila `DIRTY||SAVING` (`:964-967`).
- **Catatan:** jejak submit menumpuk maks 20 entri (`tambahJejak` `:1366-1371`).

### D.2 piutang — Piutang / Bon
- **Tampilan:** kartu **"Catat Bon Baru"** / **"Ubah Bon"** + subtitle "Bill yang sudah ditutup di POS tapi uangnya belum diterima."; grup per orang (nama + tipe + jumlah bon + "Total Hutang"); tab **Belum Lunas** / **Riwayat Pelunasan** (`:1713-1716`); 4 kartu stat: **Total Belum Lunas**, **Orang Berhutang**, **Bon Baru {tgl}**, **Pelunasan {tgl}** (`:1707-1712`); tabel riwayat pelunasan (80 terakhir) (`:1719-1736`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | `+ Tambah Bon` / `Simpan Perubahan` | simpan/ubah `DB.piutang[]` | `saveAll` | `PUT /api/v1/kompas/sections/piutang` | `:1703`, `:1754-1808` |
  | `Batal` (edit) | `batalEditBon()` | — | — | `:1704`, `:1595` |
  | `Lunasi Terpilih · Rp…` | set status lunas untuk bon tercentang dalam grup | `saveAll` | `PUT /api/v1/kompas/sections/piutang` | `:1669`, `:1830-1850` |
  | `Ubah` (baris) | `editBon(id)` | — | — | `:1658`, `:1588-1594` |
  | `✕` (hapus bon) | `hapusBon(id)` (konfirmasi) | `saveAll` | `PUT /api/v1/kompas/sections/piutang` | `:1659`, `:1862-1867` |
  | `Batal Lunas` (riwayat) | `batalLunas(id)` (konfirmasi) | `saveAll` | `PUT /api/v1/kompas/sections/piutang` | `:1733`, `:1854-1861` |
  | `Belum Lunas (n)` / `Riwayat Pelunasan` | `setBonTab` | — | — | `:1714-1715` |
  | `✕` chip owner | `hapusOwner(i)` | `saveAll` | `PUT /api/v1/kompas/sections/owners` | `:1625`, `:1872-1878` |
- **Form & field:** kunci bon `{id,date,nama,tipe,bill,nominal,payKey,picName,picOfficeId,picDiv,status,lunasDate,lunasPayKey,lunasBy,lunasAt,by,at}` (`:1785-1805`, `:722-740`).
  | field (nama data) | label UI | tipe | wajib | default / pilihan | validasi & pesan |
  |---|---|---|---|---|---|
  | tipe | Tipe | select | ya | `BON_TIPE` = `tamu`/Tamu, `owner`/Owner, `staff`/Staff, `lain`/Lainnya (`:1549`) | — |
  | nama (owner) | Nama Owner | select + `+ nama lain…` | ya bila tipe owner | `DB.owners` (`:1621-1623`) | "Nama owner wajib dipilih atau diketik." (`:1767`) |
  | nama (bukan owner) | Nama yang Berhutang | text | ya | — | "Nama yang berhutang wajib diisi." (`:1770`) |
  | picOfficeId | PIC yang Menhandle | select | ya bila tipe `tamu` | `COMP_ROSTER` (kasir/marketing/event/office) | "Bon tamu wajib punya PIC yang menghandle — tanpa itu tidak ada yang bisa ditanya saat menagih." (`:1776`) |
  | bill | No. Bill / Keterangan | text | tidak | '' | — |
  | nominal | Nominal | text `.rp` | ya | 0 | "Nominal harus lebih dari nol." (`:1778`) |
  | payKey | Metode POS Sementara | select | ya | `PAYS` | — |
  | (lunas) tgl | Tanggal Uang Diterima | date | ya | `todayISO()` | — |
  | (lunas) pay | Metode Pembayaran Pelunasan | select | ya | `PAYS` | — |
- **Validasi & pesan (konfirmasi):** "Lunasi N bon atas nama X senilai Rp…? Uang dicatat masuk pada … lewat … Report Daily tanggal itu akan menampilkannya sebagai pelunasan." (`:1843`); "Kembalikan bon ini ke status BELUM LUNAS?…" (`:1855`); "Hapus catatan bon ini?…" (`:1863`); "Hapus "X" dari daftar owner?…" (`:1875`).
- **Perhitungan di browser:** `bonBelum()` = status!=='lunas' (`:1553`); `bonRingkasHari(date)`: `baru[payKey]`, `lunas[lunasPayKey]` (`:1561-1567`); `bonGrupBelum()` per `(nama.toLowerCase()|tipe)`, diurut total desc (`:1571-1582`). Pelunasan dicatat pada tanggal uang diterima, bukan tanggal bill (`:1536-1541`).
- **Catatan:** mode ubah memakai form yang sama; snapshot pelunasan tidak disentuh saat ubah (`:1790-1797`).

### D.3 compliment — Compliment
- **Tampilan:** kartu "Catatan Compliment" + penjelasan bahwa **PIC Kasir** dipotong sebesar **Sub Total**, **PIC Pemberi** menunggu persetujuan di Performa Marketing/Event (`:2019`); form Tambah/Ubah; 3 kartu stat: **Total Compliment {tgl}**, **Report Daily (POS)**, **Selisih**; kartu pencocokan ke Report Daily (`kartuCocokRD` `:1984-1991`); tabel daftar compliment (kolom Sub Total/Tax/Service hanya jika ada rincian) (`:2060-2082`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | `+ Tambah` / `💾 Simpan Perubahan` | simpan `DB.compliments[]` | `saveAll` | `PUT /api/v1/kompas/sections/compliments` | `:2051`, `:2098-2151` |
  | `Batal` | `batalEditCompliment()` | — | — | `:2052`, `:1963` |
  | `✏️` (baris) | `editCompliment(id)` | — | — | `:2077`, `:1957-1962` |
  | `✕` (hapus) | `hapusCompliment(id)` (konfirmasi "Hapus catatan compliment ini?") | `saveAll` | `PUT /api/v1/kompas/sections/compliments` | `:2078`, `:2155-2160` |
- **Form & field:** `{id,date,nama,alasan,subTotal,tax,service,nominal,picName,picOfficeId,picDiv,pemberiName,pemberiOfficeId,pemberiDiv,pemberiStatus,putusOleh,putusAt,by,at}` (`:2117-2148`).
  | field | label UI | tipe | wajib | default/pilihan | validasi & pesan |
  |---|---|---|---|---|---|
  | nama | Nama Compliment | text | ya | '' | "Nama compliment wajib diisi." (`:2108`) |
  | subTotal | Sub Total | `.rp` | ya* | 0 | — |
  | tax | Tax | `.rp` | tidak | 0 | — |
  | service | Service Charge | `.rp` | tidak | 0 | "Sub total, tax, dan service charge tidak boleh nol semua." (`:2109`) |
  | picOfficeId | PIC Kasir | select | ya | `Tamu` (`__tamu__`) + roster `kasir` | — |
  | pemberiOfficeId | PIC Pemberi | select | ya | `Tamu` + roster marketing/event/office | — |
- **Perhitungan di browser:** `nominal = subTotal + tax + service` (`:2103`); yang **memotong realisasi** = `compPotong(c) = subTotal` (catatan lama tanpa rincian → `nominal`) (`:2181`); `angkaRD(date)`: cocok bila `totalComp === POS compliment + POS member_dep` (`:1976-1983`). Putusan pemberi direset bila pemberi berubah (`:2129-2139`).
- **Catatan:** `by`/`at` pencatat asli tidak ditimpa saat edit; `alasan` dipertahankan (`:2124-2141`).

### D.4 rokok — Daily Stock Rokok
- **Tampilan:** kepala + pemilih Tanggal; pita jejak; tabel kolom **Item · Sisa Awal · Masuk · Keluar · Sisa Akhir** (SEMUA item selalu tampil) + baris TOTAL (`:3170-3185`); bar saldo: Item bergerak, Total Masuk, Total Keluar + tombol Simpan (`:3187-3194`).
- **Aksi:**
  | tombol | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | `Simpan Stock Harian` | bangun `DB.rokok[rokokDate]={items,by,at,log}`, `save()`+`simpanTunggu` | `saveAll` | `PUT /api/v1/kompas/sections/rokok` | `:3193`, `:3226-3244` |
- **Form & field:** `DB.rokok[date]={items:{<kunci>:{in,out}},by,at,log[]}` (`:673`). Input per item `in`/`out` (`:3165-3166`).
- **Validasi & pesan:** sisa akhir minus → "⚠ N item sisa akhirnya minus (…). Biasanya ada hari sebelumnya yang barang masuknya belum dicatat … Simpan tetap boleh." (`:3221-3223`).
- **Perhitungan di browser:** `Sisa Awal[item] = Σ_{d<date}(in−out)` seluruh tanggal sebelumnya (`rokokSisaAwal` `:3147-3154`); `Sisa Akhir = awal + in − out` (`:3201`).
- **Catatan:** kunci item yang sudah tak ada di daftar **tetap dipertahankan** saat simpan (`:3226-3236`); `in/out` default 0.

### D.5 rokokrekap — Rekap Stock Rokok
- **Tampilan:** read-only, mengikuti pemilih **Periode** (`PERIOD`). 4 kartu stat (**Total Keluar**, **Total Masuk**, **Sisa Akhir Bulan**, **Produk Bergerak**); tabel diurut **Keluar desc** dengan bar mini (`:3471-3507`). Bila tak ada catatan bulan itu → empty state "Belum ada catatan stock untuk {bulan}." (`:3453-3457`).
- **Aksi:** tak ada isian (sengaja — hanya Daily Stock Rokok yang mengisi, `:3414-3418`).
- **Perhitungan:** `rokokRekapBulan(monthKey)`: per item `masuk=Σ in`, `keluar=Σ out`, `awal` dari `rokokSisaAwal(monthKey+'-01')`, `akhir=awal+masuk−keluar`, `hariGerak` (`:3429-3446`).
- **Endpoint v1:** baca bagian `rokok` dari blob → `GET /api/v1/kompas/sections/rokok` (+ `/state`).

### D.6 rokokset — Pengaturan Item Rokok
- **Tampilan:** info bahwa daftar ini menentukan baris Daily/Rekap; kartu **"Item di Lembar Stock"** (kolom Urut, Nama, Kunci data, Kelompok) (`:3385-3398`); kartu **"Tambah Item"** (`:3399-3409`).
- **Aksi:**
  | tombol | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | `↑` / `↓` | `rksGeser(k,±1)` (atur urutan) | `saveAll` | `PUT /api/v1/kompas/sections/rokok_items` | `:3365-3366`, `:3336-3343` |
  | `Ubah nama` | `rksUbahNama(k)` (prompt) | `saveAll` | idem | `:3373`, `:3318-3326` |
  | `Jadikan Rokok` / `Jadikan Lainnya` | `rksToggleLain(k)` | `saveAll` | idem | `:3374`, `:3327-3332` |
  | `Buang` | `rksHapus(k)` (konfirmasi) | `saveAll` | idem | `:3375`, `:3299-3317` |
  | `Tambah` | `rksTambah()` | `saveAll` | idem | `:3406`, `:3284-3298` |
  | `↩ Kembalikan ke bawaan` | `rksPulihkanBawaan()` (hapus `DB.rokok_items`) | `saveAll` | idem | `:3392`, `:3344-3355` |
- **Form & field:** `DB.rokok_items=[{k,n,lain}]` (`:711-719`); `k` = `rksKunci(nama)` = lowercase, non-alfanumerik→`_`, dipangkas, maks 40 (`:3270-3273`). **Kunci permanen** (`:3255-3259`).
- **Validasi & pesan:** "Nama item wajib diisi." (`:3287`); "Nama itu tidak menghasilkan kunci yang sah …" (`:3289`); "Kunci **k** sudah dipakai item **n**. Pakai nama yang berbeda." (`:3295`); "Daftar tidak boleh kosong — sisakan minimal satu item." (`:3302`).
- **DAFTAR bawaan `ROKOK_BAWAAN` (19 item, `:3096-3119`):** la_purple=LA Purple, la_mango=LA Mango, la_bold=LA Bold, la_ice=LA Ice, la_light=LA Light, djarum_super=Djarum Super, djarum_mild=Djarum Mild, insta=Insta, korek=Korek, dos_hermanos=Dos Hermanos, dos_h_rojo=Dos H. Rojo, dos_h_maduro=Dos H. Maduro, dos_h_corona=Dos H. Corona, dos_h_torito=Dos H. Torito, gold_seal_petit=Gold Seal Petit, gold_seal_senor=Gold Seal Senor, coin=Coin (lain), eskrim=Eskrim (lain).

### D.7 kasir — Performa Kasir
- **Tampilan:** segmen pilih kasir (`🧮 Semua` + nama bila berhak, `:3750`); kartu ringkas `baguRingkasKasir` (**Omset Diakui**, **Bonus Saat Ini**, **Menuju Level X / Level Tertinggi**) (`:3538-3548`); baris info "Omset diakui … · N hari masuk, M hari OFF (rata-rata …/hari)" (`:3831`); kartu **Omset Harian** (bar Chart.js `:3863`) + **Riwayat** (pager 12/halaman, kolom Tanggal/Omset Diakui/Status) (`:3814-3828`); kartu **Pengakuan Open Bill** (hanya bila ada) (`:3559-3569`); kartu **💰 Tangga Bonus** (`kartuBonusKasir` `:3571-3589`).
- **Aksi:**
  | tombol | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | `🧮 Semua` / nama kasir | ganti target analisis (gerbang `bolehLihatKasir`) | — | — | `:3750`, `:3868`, `:3676-3681` |
  | `‹ Sebelumnya` / `Berikutnya ›` | pager riwayat | — | — | `:3821-3827` |
- **Perhitungan di browser (WAJIB dipindah apa adanya):**
  - `omsetKasir(r) = num(r.amount) − num(r.disc)` (`:1050`); `diskonKasir(r) = r.off ? 0 : num(r.disc)` (`:1051`).
  - `porsiPic(r) = r.tiket ? Math.round(num(r.amount) × PORSI_PIC_TIKET=0.5) : num(r.amount)` (`:2248-2252`) — **lihat §F.12: di Kompas versi ini sudah berubah**.
  - `potonganBaris(r)`: `total=porsiPic(r)`, `ids=r.shift` (kasir shift), `pembagi=ids.length`, `per=round(total/pembagi)`; DW **tidak** ikut membagi (`:2323-2330`).
  - `potonganHari(d,kasirId)`: Σ `potonganBaris(r).per` atas **baris marketing** `d.bd.marketing` yang `ids` memuat kasirId (`:2347-2354`).
  - `real = omsetKasir(r) − potonganHari(d,kasirId)` (`:3718`); lalu `real −= Σ compPotong` (compliment) (`:3730-3734`).
  - Bonus: `BONUS_KASIR = [{min:200000000,bonus:500000,label:'Level 4'},{150000000,300000,'Level 3'},{100000000,150000,'Level 2'},{80000000,50000,'Level 1'}]`; `bonusKasir(real)` ambil level min terbesar; di bawah 80 jt → label 'Standar kerja', bonus 0 (`:3522-3532`).
  - `barisTanpaShift(d)`: baris `d.bd.marketing` yang `potongKasirAktif(r) && amount>0 && potonganBaris(r).pembagi<=0` (`:2358-2365`). `potongKasirAktif(r)`: `menuFix==='ditempat'`→false, `'tetap'`→true, else `payGroup===false`→false (`:2315-2322`).
  - `obAktif/obTotal/openBillList` (Open Bill) (`:2266-2280`): `obTotal = obAmount+obTax+obService`; **tidak** menambah `real` (hanya pengakuan).
- **Hak akses di dalam layar:** `kasirMurni(e)` hanya akun ber-Keterangan persis `'kasir'` (bukan rangkap) yang dinilai (`:3628-3635`); rincian per-kasir hanya diri sendiri atau admin (`bolehLihatKasir` `:3676-3681`); gerbang di `draw()` bukan tombol (`:3774-3783`).
- **Endpoint v1:** baca `daily[]` (→ `GET /api/v1/kompas/days/{date}` / `/state`), `employees.kasir` (`/sections/employees`), `compliments` (`/sections/compliments`). **Tidak ada tulis** dari layar ini.

### D.8 dp — Dana Masuk (DP)
- **Tampilan:** tombol `↻ Muat Ulang` + `<iframe id="dpFrame" src="../reservasi/?embed=finance">` setinggi viewport (`:3940-3947`). **Bukan salinan** — halaman Dana Masuk milik modul Reservasi dijalankan apa adanya (`:3906-3928`).
- **Aksi:**
  | tombol | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | `↻ Muat Ulang` | set ulang `iframe.src='../reservasi/?embed=finance&t='+Date.now()` | — | — (komposisi frontend) | `:3942`, `:3953-3956` |
- **Ketergantungan:** guard SSO reservasi menerima pemegang modul `cashier` lewat pintu `embed`; `body.embed` menyembunyikan sidebar/appbar; `navigate()` dikunci ke `'finance'`; role dipaksa `cashier` (Dana Masuk = Boleh Ubah) (`:3920-3924`).
- **Endpoint v1:** panel Dana Masuk = kontrak **reservasi** (`docs/api/reservasi.md:23`): baca `GET /api/v1/reservasi/reservations` + `dps[]`; tulis `PUT/PATCH /api/v1/reservasi/reservations/{id}` dengan field DP (`dps[]`, `dpStatus`, `dpAmount`, `dpProofData`); bukti via `GET/PUT /files/{key}` (`r:<id>:dp`, `p:<resId>:<dpId>`).

### D.9 bri — Pencocokan QRIS BRI
- **Tampilan:** seluruh mesin di `deploy/assets/cocok-bri.js` (`cbPasang`/`cbGambar`, `:3970-3999`); bulan dari `PERIOD` (`:3965-3968`). Bila aset gagal termuat → pesan "Mesin pencocokan tidak termuat. … butuh `assets/cocok-bri.js`. …" (`:3976-3978`).
- **Aksi (dari aset, bukan index.html):** `GET ?action=briList` (`cocok-bri.js:259`), `action:'briTambah'` (`:1682`), `action:'briCocok'` (`:1714`), `action:'briAbai'` (`:1970`), `action:'briBatal'` (`:2052`); menulis balik DP reservasi via `action:'saveAll'` ke `rsvUrl` (`cocok-bri.js:432`); membaca reservasi via `?action=getAll` (`:295`,`:364`).
- **Konkurensi:** pencocokan reservasi mengirim `baseVer`; konflik diperiksa di dua bentuk `{data:{conflict:true}}` / `{conflict:true}` (`cocok-bri.js:429-440`).
- **Endpoint v1:** `GET /api/v1/kompas/bri`, `POST /bri`, `POST /bri/match`, `POST /bri/{id}/cancel`, `POST/DELETE /bri/ignored[/{dpId}]`; DP-nya sendiri via reservasi (`docs/api/kompas.md:94-104`, `reservasi.md:46`). Jalur **unggah mutasi bank (`briUnggah`) sudah DICABUT** 21 Sep 2026 bersama `assets/xlsx-baca.js` (`cashier/index.html:35-38`).

### D.10 voidb — Void Menu
- **Tampilan:** kartu "Catatan Void Menu" + pemilih Tanggal; form Tambah/Ubah; kartu setelan tax & service (`details`, `vdSetelanHtml` `:2747-2765`); 3 kartu stat (**Void {tgl}**, **Void Bulan Ini**, **Rekap Lengkap** → Finance > Kas Kecil) (`:2999-3003`); tabel dikelompokkan **per nomor bill** (`vdGrupBill`/`vdGrupHtml`, `:2893-2915`); pita peringatan `VD_ERR`/`VD_POTONG` (`:3004-3005`).
- **Aksi:**
  | tombol | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | `+ Tambah Catatan` / `💾 Simpan Perubahan` | `voidSimpan` (satu bill, banyak item) | `voidSimpan` | `POST /api/v1/kompas/voids` | `:2993`, `:2767-2859` |
  | `Batal` | `vdBatalUbah()` | — | — | `:2994`, `:2693` |
  | `+ Tambah item` | `vdItemTambah()` | — | — | `:2665`, `:2582-2589` |
  | `✕` (hapus baris item) | `vdItemHapus(i)` | — | — | `:2640`, `:2590-2600` |
  | `&#8635;` (auto svc/tax) | `vdAuto()` | — | — | `:2657`, `:2499-2503` |
  | `Simpan Setelan` | `vdSimpanSetelan()` (admin) | `voidSetting` | `PUT /api/v1/kompas/voids/settings` | `:2761`, `:2721-2742` |
  | `Ubah` (baris) | `vdUbah(id)` | — | — | `:2937`, `:2670-2692` |
  | `Batalkan` (baris) | `vdBatal(id)` (prompt alasan wajib) | `voidBatal` | `POST /api/v1/kompas/voids/{id}/cancel` | `:2938`, `:2865-2878` |
- **Form & field:** `VD_FORM={bill,penginput,salah,alasan,items:[{item,sub}],svc,tax,svcManual,taxManual}` (`:2419-2420`). **Wajib** `VOID_WAJIB` (`:2399-2403`): `bill`=**Nomor Bill**, `item`=**Nama Item**, `penginput`=**Siapa yang Menginput**, `salah`=**Kesalahan dari Siapa**, `alasan`=**Alasan / Kronologi**. Label UI form: "Nomor Bill *", "Siapa yang Menginput *" (bukan pengisi catatan), "Kesalahan dari Siapa *" (datalist: Kasir/Floor/Kitchen/Bar/Tamu/Sistem / POS), "Item yang Di-void *", "Alasan / Kronologi *", "Subtotal seluruh item", "Service {n}%", "Tax {n}%", "Total yang di-void" (`:2975-2990`, `:2648-2660`).
- **Validasi & pesan:** "✕ **Belum lengkap.** Masih kosong: **…**." + kotak merah & fokus (`:2793-2796`); alasan batal kosong → `alert('Alasan pembatalan wajib diisi.')` (`:2872`). Nominal boleh Rp0 (`:2985`).
- **Perhitungan di browser:** `svc = round(subtotalBill × service%)`, `tax = round(subtotalBill × tax%)`, dasar = `Σ subtotal item bernama`, `total = subtotal+svc+tax` (`:2445-2479`); override manual tidak dihitung ulang (`:2453-2513`). Bawaan persen 10/5, sumbernya server `voidList.setting` (`:2421-2428`, `:2553`). Server membagi tingkat-bill ke tiap item **kumulatif** dan menghitung `nominal` — totalnya **tidak dikirim** (`:2803-2826`).
- **Endpoint v1:** termasuk `GET /api/v1/kompas/voids` (`:2546`), `GET/PUT /voids/settings`, `POST /voids`, `POST /voids/{id}/cancel` (`docs/api/kompas.md:82-92`).

### D.11 akses — Kelola Akses Kru
- **Tampilan:** kartu "Pemegang Akses Modul Cashier" + tombol `↻ Segarkan`; pita info bahwa semua pemegang akses melihat halaman yang sama, hanya ada admin modul (`:4042-4046`); tabel kolom **Nama · Tim / Keterangan · Status Akun · Admin Modul** (`:4050-4058`); footer "N kru memegang akses Cashier · M di antaranya admin modul." (`:4061`).
- **Aksi:**
  | tombol | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | `↻ Segarkan` | `AKSES_ROSTER=null;AKSES_ERR='';viewAkses()` → `muatAkses()` | `listModuleRoster` | `GET /api/v1/account/modules/cashier/members` | `:4040`, `:4013-4027` |
- **Validasi & pesan:** "Office membalas bukan JSON (account-api-mysql belum terpasang?)" (`:4021`); "Office tidak menjawab dalam 8 detik" (`:4025`). Read-only: tambah/hapus akses di Kelola Akses milik Office (`:4005-4006`).

## E. Pemetaan backend
Semua aksi kompas di bawah ini menerima Modul `cashier` (atau `finance`); lihat `docs/api/kompas.md:53-104`. Aksi tulis Void & BRI dicek modul di controller (`app/Modules/Kompas/routes/v1.php:23-36`).

| action lama | dipakai di layar | baca/tulis | endpoint v1 | status ✅/⚠️/❌ | catatan |
|---|---|---|---|---|---|
| `saveAll` (kompas, `:834`) | report, piutang, compliment, rokok, rokokset, kasir | tulis | `PUT /api/v1/kompas/state`; **granular:** `/sections/{key}`, `/reports/{date}`, `/days/{date}` | ⚠️ | v1 tidak punya `saveAll`; tiap layar harus memecah ke part-nya + `If-Match` (versi part). `baseTs` → `If-Match`/`?version`, konflik → `409 version_conflict` |
| `getAll` (kompas GET `:825`) | boot semua layar | baca | `GET /api/v1/kompas/state` (bootstrap) atau part granular | ✅ | `meta.version` = `updated_at` (ms) |
| `voidList` GET `?action=voidList` (`:2546`) | voidb | baca | `GET /api/v1/kompas/voids?from&to` | ✅ | balasan `{baris[],total,maks:1500,setting}`; `rinci:false` untuk baris lama |
| `voidSetting` (`:2727`) | voidb | tulis | `PUT /api/v1/kompas/voids/settings` | ✅ | butuh **admin modul** cashier/finance; If-Match = `diubah` |
| `voidSimpan` (`:2827`) | voidb | tulis | `POST /api/v1/kompas/voids` | ✅ | satu baris atau `items[]` (satu transaksi); server menghitung `nominal` & `void_bagi` |
| `voidBatal` (`:2874`) | voidb | tulis | `POST /api/v1/kompas/voids/{id}/cancel` | ✅ | alasan wajib; baris tidak pernah dihapus |
| `listDivisiRoster` (account, `:1898`,`:3888`) | compliment, piutang, kasir (PIC & sinkron PIC) | baca | `GET /api/v1/account/roster` | ✅ | dipakai `ambilRoster()` & `syncPicOffice()` |
| `listModuleRoster` (account, `:4018`) | akses | baca | `GET /api/v1/account/modules/cashier/members` | ✅ | balasan memuat `isModuleAdmin` |
| `briList` (cocok-bri.js:259) | bri | baca | `GET /api/v1/kompas/bri?from&to` | ✅ | `{baris[],total,maks:2000,abai[]}` |
| `briTambah` (cocok-bri.js:1682) | bri | tulis | `POST /api/v1/kompas/bri` | ✅ | `{tgl,jam?,nominal,ket}`, `ket` wajib; `cara='bukan'` |
| `briCocok` (cocok-bri.js:1714) | bri | tulis | `POST /api/v1/kompas/bri/match` | ✅ | satu DP hanya boleh dipegang satu baris live; bulk tidak transaksional |
| `briBatal` (cocok-bri.js:2052) | bri | tulis | `POST /api/v1/kompas/bri/{id}/cancel` | ✅ | alasan wajib |
| `briAbai` (cocok-bri.js:1970) | bri | tulis | `POST /api/v1/kompas/bri/ignored` + `DELETE /bri/ignored/{dpId}` | ✅ | menandai DP reservasi tidak valid |
| `reservasi getAll` (cocok-bri.js:295/364) | bri | baca | `GET /api/v1/reservasi/reservations` (+ `/master`) | ⚠️ | mesin BRI lama membaca blob reservasi utuh; v1 granular per reservasi |
| `reservasi saveAll` (cocok-bri.js:432) | bri | tulis | `PUT/PATCH /api/v1/reservasi/reservations/{id}` | ⚠️ | penyimpanan balik DP setelah cocok; `baseVer` → `If-Match` (versi per reservasi) |
| embed `../reservasi/?embed=finance` (`:3945`) | dp | baca+tulis (iframe) | kontrak reservasi (`reservations`, `dps[]`, `files/{key}`) | ⚠️ | v1 tidak punya "embed"; Vue harus menyusun panel Dana Masuk sendiri atau menaut ke modul reservasi |

Konkurensi: legacy memakai **`baseTs`** pada `saveAll` (`:819-852`, penjaga `:804-818`) dan **`baseVer`** pada pencocokan reservasi (`cocok-bri.js:429-440`). v1 memakai **`If-Match`/`?version`** per part (`docs/api/kompas.md:41-49`, `reservasi.md:105-111`). Kode error yang wajib ditangani UI: `401 unauthenticated`, `403 module_not_granted`, `409 version_conflict` (dengan `details.current`/`savedBy`), `422 validation_failed`/`invalid_request` (pesan Indonesia, mis. `Setoran bernilai nol — tidak ada uang yang berpindah`), `428 version_required` (`docs/api/kompas.md:129-137`). Pesan konflik legacy: "⚠ **TIDAK tersimpan.** Data di server sudah diubah oleh **X** sejak halaman ini dibuka. …" (`:895-898`, `:947-948`).

## F. Aturan bisnis yang wajib dibawa
1. **Tidak ada level di modul Cashier** — kenapa: pemisahan sudah di lapisan modul; level kedua akan diam-diam bertentangan dengan yang pertama (bug Kompas 28 Juli 2026) — bukti: `cashier/index.html:552-560`.
2. **`PAYS` harus sama persis dengan `deploy/kompas/index.html`** — kedua modul menulis satu objek `DB.reports[tgl].pay`; metode yang cuma ada di satu sisi membuat total beda antara dua layar — bukti: `:585-634`, `:607-610`.
3. **Baris "Error …" BUKAN metode pembayaran**, tapi tempat selisih yang sudah diketahui sebabnya; ikut Total POS/Actual & toleransi — bukti: `:594-605`.
4. **Hanya TOTAL setoran yang dinilai, toleransi Rp5.000; submit TIDAK pernah dikunci** — mengunci submit membuat kasir mengarang Actual; report cocok-tapi-karangan lebih berbahaya — bukti: `:635-648`, `:1299-1305`, `:1421-1443`.
5. **Penjaga tulis-basi `baseTs`**: konflik TIDAK dicoba ulang dan TIDAK dibuang; pesannya "catat dulu, muat ulang" — insiden 7 Sep 2026 (koreksi tax hilang) — bukti: `:804-818`, `:885-898`, `:941-949`.
6. **Semua tombol "tersimpan" menunggu jawaban server** (`kirimSekarang`/`simpanTunggu`), bukan menebak — bukti: `:909-1026`.
7. **Jejak submit menumpuk maks 20**, menyimpan semua penyimpan; `by`/`at` tetap ditulis untuk modul lain — bukti: `:1350-1371`.
8. **Bon/Piutang**: tipe & PIC; owner dari daftar (nama diketik ulang memecah satu orang jadi beberapa); pelunasan dicatat pada **tanggal uang diterima**; pembatalan lunas bukan edit diam-diam — bukti: `:1524-1541`, `:1613-1623`, `:1843-1861`.
9. **Compliment punya dua PIC**: PIC Kasir (selalu dipotong `subTotal`) & PIC Pemberi (menunggu putusan di Performa Marketing/Event); pemberi "Tamu" tidak memotong siapa pun; ganti pemberi → putusan direset — bukti: `:1946-1954`, `:2113-2141`, `:2181`.
10. **Rokok: semua item selalu tampil (0 = diperiksa, bukan kosong); sisa dihitung dari akumulasi seluruh tanggal sebelumnya; kunci item permanen & data item terhapus dipertahankan** — bukti: `:3062-3095`, `:3143-3154`, `:3226-3236`, `:3255-3259`.
11. **Performa Kasir hanya menilai akun ber-Keterangan persis "kasir"** (bukan rangkap); rincian per-kasir hanya diri sendiri / admin; gerbang di `draw()` bukan tombol — bukti: `:3592-3635`, `:3643-3661`, `:3774-3783`.
12. **Berkas kembar `porsiPic()` — di Cashier masih versi LAMA (`r.tiket ? amount×0.5 : amount`), dan itu MENUNGGU KEPUTUSAN**; di omset/kas sudah `amount + tax + service + obTotal`. Jangan disamakan sendiri — mengubahnya mengubah uang berjalan; nilainya dikunci di `tools/uji-openbill-performa.js` — bukti: `CLAUDE.md:2638-2670`, `cashier/index.html:2248-2252`.
13. **Section event berhenti memotong kasir (7 Agu 2026); baris tanpa potongan disaring `potongKasirAktif` (5 Sep 2026)** — Cashier pernah tertinggal dua perbaikan ini; efek perbaikannya berlaku surut — bukti: `CLAUDE.md:2611-2637`, `cashier/index.html:2315-2364`.
14. **Open Bill TIDAK dipotong dari kasir** (diakui dua kali, penuh kasir & penuh PIC); `real` tidak ditambah; hanya kartu pengakuan — bukti: `:2253-2266`, `CLAUDE.md:2880-2902`.
15. **DW tidak ikut membagi potongan event**; baris tanpa shift → pembagi 0, potongan tidak dibebankan & halaman menandainya — bukti: `:2288-2301`, `:2358-2365`.
16. **TARGET DICABUT dari Cashier (5 Sep 2026)** (`pembagiHari`/`dailyTarget`/`targetPic` dibuang); **Bonus Kasir TETAP** — bukti: `:1054-1063`, `CLAUDE.md:2777-2790`.
17. **Void: wajib kronologi; total dihitung server; service & tax tingkat bill dibagi kumulatif ke item (server) agar tak ada baris minus; dibatalkan bukan dihapus** — bukti: `:2399-2403`, `:2803-2826`, `CLAUDE.md:10205-10260`, `:10450-10495`.
18. **Setelan persen Void = admin modul cashier/finance; tax = 10% × subtotal (bukan subtotal+service)** — bukti: `:2421-2428`, `:2716-2763`.
19. **Dana Masuk (DP) BUKAN salinan** — halaman Reservasi di-embed apa adanya; menyalin berarti salinan kedua yang melenceng — bukti: `:3906-3928`.
20. **QRIS BRI satu mesin** (`assets/cocok-bri.js`) dipakai Cashier & Finance > Kas Kecil — dua salinan rumus uang = dua angka — bukti: `:3958-3963`.
21. **Kelola Akses Kru read-only, tanpa kolom level** — menambah/hapus akses di Office — bukti: `:4002-4011`.

## G. Ketergantungan lintas modul
- **Cashier → Kompas** (blob uang): `getAll`/`saveAll` (`:484`,`:834`), Void (`voidList`/`voidSetting`/`voidSimpan`/`voidBatal`), BRI mesin lewat `assets/cocok-bri.js`. Report Daily & Compliment **menulis objek yang sama** dengan Kompas; perubahan di salah satu wajib diikuti di `deploy/kompas/index.html` (`:460-469`).
- **Cashier → Office/Account:** `listDivisiRoster` (`:1896`,`:3886`) untuk PIC compliment/piutang & sinkron `employees`; `listModuleRoster{module:'cashier'}` (`:4016-4018`) untuk halaman Akses. v1: `GET /api/v1/account/roster`, `GET /api/v1/account/modules/cashier/members`.
- **Cashier → Reservasi:** halaman **Dana Masuk (DP)** = iframe `../reservasi/?embed=finance` (`:3945`); mesin BRI membaca/menulis DP reservasi (`cocok-bri.js:295,432`; `rsvUrl:../reservasi-api-mysql/api.php` `:3989`). v1 = kontrak reservasi.
- **DP Reservasi ditampilkan di DUA modul**: Cashier dan Finance > Kas Kecil (`docs/api/reservasi.md:46`; `_lintas-modul.md:30`).
- **Aset bersama `deploy/assets/cocok-bri.js`**: dipakai `deploy/cashier/`, `deploy/reservasi/`, `deploy/finance/kas/` (grep 3 berkas). Mesin BRI harus dipindah ke satu sumber di Vue.
- **Blob Kompas juga ditulis Finance > Omset dan dibaca Analytics/Investor** — bagian `rokok` & `piutang` hanya ditulis Cashier tapi ikut blob yang sama (`:693-698`, `:721-725`).

## H. Catatan untuk implementasi Vue
- **Halaman:** satu modul dengan 11 panel. Usul: `app/pages/cashier/index.vue` sebagai pemilih/redirect + sub-route `app/pages/cashier/{report,piutang,compliment,rokok,rokokrekap,rokokset,kasir,dp,bri,voidb,akses}.vue` (atau `[...panel].vue`). `definePageMeta({ access: ['cashier'] })`.
- **Composable `useCashier.ts`:**
  - `getState()` → `GET /api/v1/kompas/state`; `getSection(k)` → `GET /sections/{k}`; `putSection(k,v,version)` → `PUT /sections/{k}` (If-Match).
  - `getReport(date)`/`putReport(date,value,version)`; `getDay(date)`/`putDay(date,rows,version)`.
  - `getVoids(from,to)`; `createVoid(payload)`; `cancelVoid(id,alasan,version)`; `getVoidSetting()`/`putVoidSetting(v,version)`.
  - `getBri(from,to)`; `addBriManual`; `matchBri`; `cancelBri`; `ignoreDp`/`unignoreDp`.
  - `getRoster()` → `GET /api/v1/account/roster`; `getCashierMembers()` → `GET /api/v1/account/modules/cashier/members`.
  - DP: pakai composable reservasi (`useReservasi`) atau taut ke modul reservasi.
- **HP vs desktop:** Report Daily & tabel lebar → **`AppList`/`AppListRow` di HP**, `UTable` hanya `lg+` (`AGENTS.md`). Form bon/compliment/void/rokok → **`ResponsiveSheet`**. Performa Kasir (grafik + riwayat) → satu `AppFocus` per layar; grafik Chart.js lama → komponen chart Nuxt UI. Akses & rokokrekap (read-only) → `AppList`.
- **Widget Beranda yang cocok:** [DUGAAN] kartu `cashier` membuka modul; belum ada widget ringkas eksplisit di kode lama. Kandidat aman: pengingat "Report Daily tanggal ini belum diisi" (dari `repOf(repDate)` `:1194`).
- **Elemen lama yang melanggar DESIGN.md → padanannya:**
  - Grid kartu angka besar (`.stat accent`, `:1234-1242`, `:1707-1712`, `:2999-3003`, `:3476-3485`, `:3541-3547`) → ringkasan teks/list, bukan grid angka besar.
  - Gradien: `btn-primary` (`:84`) & avatar Akses (`:4053`) → warna solid primary, avatar polos.
  - Emoji: `⏳ 📝 💰 📦 📅 🔑 🧮 ✏️ ⚙ 💡 ↩ ↻` → ikon Nuxt UI (`UIcon`).
  - Eyebrow uppercase: `.mini-lab`, `th` uppercase (`:113`, `:1647`) → sentence case.
  - Teks kuning/gold sebagai teks: `.nav a.active{color:var(--gold-dim)}` (`:146`) → kuning hanya sebagai fill.

## I. Pertanyaan terbuka
- [ ] **cashier / semua layar** — `saveAll` (blob utuh) harus dipecah ke endpoint granular v1 mana per layar, dan bagaimana peta `baseTs` → `If-Match`? Konteks: legacy menyimpan seluruh blob, v1 per part. Bukti: `cashier/index.html:834`, `laksamana-api/docs/api/kompas.md:41-49`.
- [ ] **cashier / kasir + compliment + piutang** — `porsiPic()` di Cashier masih versi LAMA (`r.tiket ? amount×0.5 : amount`) sementara omset/kas sudah `amount+tax+service+obTotal`; ini **keputusan uang** yang ditunda. Vue harus ikut yang mana? Bukti: `CLAUDE.md:2638-2670`, `cashier/index.html:2248-2252`.
- [ ] **cashier / dp** — Dana Masuk (DP) lama adalah iframe Reservasi `?embed=finance`. Di Vue, bangun panel Dana Masuk di modul cashier atau tautkan ke modul reservasi? Bukti: `cashier/index.html:3945`, `laksamana-api/docs/api/reservasi.md:46`.
- [ ] **cashier / kasir** — `syncPicOffice()` menulis `DB.employees` (milik Kompas) dari roster Office; apakah Vue cashier tetap menyinkron otomatis saat halaman dibuka? Bukti: `cashier/index.html:3883-3904`.

## Konsolidasi untuk README & berkas bersama

**Baris README** (siap tempel ke `README.md`, mengganti baris `cashier`):

`| cashier | [cashier.md](cashier.md) | ⚠️ selesai dengan celah | 11 | 0 ❌ · 4 ⚠️ | 4 | 4.107 baris; tanpa DB sendiri — tulis-baca blob Kompas (module cashier), DP = embed Reservasi, BRI pakai `assets/cocok-bri.js`; 0 ❌, 4 ⚠️ bentuk-simpan/embed; `porsiPic` Cashier masih versi lama (menunggu keputusan) |`

**Pertanyaan untuk `_pertanyaan.md`** (bullet, format §6):

- [ ] **cashier / semua layar** — Pemecahan `saveAll` (blob Kompas utuh) ke endpoint granular v1 (per `sections`/`reports`/`days`) dan peta `baseTs` → `If-Match` per layar. Konteks: legacy menyimpan seluruh blob lewat `saveAll` berpagar `baseTs`; v1 menuntut penulisan per part. Bukti: `laksamana-office/deploy/cashier/index.html:834`, `laksamana-api/docs/api/kompas.md:41-49`. Opsi: A) satu endpoint part per layar (report→`/reports/{date}`, piutang→`/sections/piutang`, dst.) B) tetap pakai `PUT /state` (blob utuh) untuk sementara.
- [ ] **cashier / kasir + compliment + piutang** — `porsiPic()` Cashier masih `r.tiket ? amount×0.5 : amount`, sedangkan `deploy/finance/omset` & `kas` sudah `amount+tax+service+obTotal`. Ini keputusan tentang uang yang sudah berjalan. Vue mengikuti yang mana? Bukti: `laksamana-office/CLAUDE.md:2638-2670`, `laksamana-office/deploy/cashier/index.html:2248-2252`. Opsi: A) ikuti versi Kompas baru (`amount+tax+service+obTotal`) B) pertahankan versi cashier sampai diputuskan owner.
- [ ] **cashier / dp** — Panel Dana Masuk (DP) lama = iframe `../reservasi/?embed=finance`. Di Vue: bangun panel sendiri (kontrak reservasi) atau tautkan ke modul reservasi? Bukti: `laksamana-office/deploy/cashier/index.html:3945`, `laksamana-api/docs/api/reservasi.md:23,46`. Opsi: A) panel Dana Masuk di dalam modul cashier memakai `useReservasi` B) tombol taut ke halaman reservasi.
- [ ] **cashier / kasir** — `syncPicOffice()` menulis `DB.employees` (milik blob Kompas) dari roster Office saat boot. Apakah Vue cashier tetap menyinkron otomatis? Bukti: `laksamana-office/deploy/cashier/index.html:3883-3904`. Opsi: A) ya, sinkron saat buka Performa Kasir B) biarkan Kompas/Finance yang menyinkron.

**Baris `_lintas-modul.md`** (siap tempel di bagian "Peta silang antar modul"):

- Cashier memuat **Dana Masuk (DP)** dari Reservasi lewat **iframe** `../reservasi/?embed=finance` (`laksamana-office/deploy/cashier/index.html:3945`; lihat juga `deploy/index.html:1299`); guard SSO reservasi menerima modul `cashier` lewat pintu embed dan mengunci `navigate()` ke `'finance'` (`cashier/index.html:3920-3924`). DP yang sama juga muncul di Finance > Kas Kecil (`laksamana-api/docs/api/reservasi.md:46`).
- **Cashier TIDAK memanggil Finance/Account sebagai data uang**: backend-nya = **Kompas** (`../kompas-api-mysql/api.php`, blob `daily/reports/compliments/piutang/rokok/employees`, `cashier/index.html:484`,`:834`) dan **Office/Account** hanya untuk identitas (`account-api-mysql?action=listDivisiRoster` & `listModuleRoster{module:'cashier'}`, `:1896`,`:3886`,`:4016-4018`). Cashier juga menulis balik DP **Reservasi** saat mencocokkan QRIS BRI (`reservasi-api-mysql?action=saveAll`, `cocok-bri.js:432`).
- **Aset bersama `deploy/assets/cocok-bri.js`** (mesin QRIS BRI, 2.240 baris) dipakai `deploy/cashier/`, `deploy/finance/kas/`, dan `deploy/reservasi/` — rumus pencocokan & pembagian DP wajib dipindah ke satu sumber di Vue; v1: `GET/POST /api/v1/kompas/bri*` (`cashier/index.html:39`, `cocok-bri.js:259,1682,1714,1970,2052`; `docs/api/kompas.md:94-104`).
- **Cashier ↔ Kompas: berkas kembar wajib serempak** — Report Daily & Compliment menulis objek yang SAMA (`DB.reports[tgl].pay`, `DB.compliments[]`); `PAYS`, `compFilterPic`, `porsiPic`, `potonganHari`/`potongKasirAktif`, `obAktif`/`obTotal`/`openBillList` adalah kembar dengan `deploy/kompas/index.html` & `deploy/finance/omset/` (`cashier/index.html:460-469,585-610,2315-2364`; `CLAUDE.md:2880-2902`). Cashier pernah tertinggal dua perbaikan berturut-turut (`CLAUDE.md:2611-2637`).

## J. Progres build
Branch: migrasi/cashier-inti (#26, bagian 1 dari #13) · Mulai: 2026-10-06
LANJUTKAN DARI: #27 voidb → #28 rokok → #29 kasir → #30 bri.

| layar (key) | file | status | endpoint dipakai | ditunda karena |
|---|---|---|---|---|
| report | `app/pages/cashier/report.vue` | ✅ | `GET/PUT /kompas/reports/{date}`, `GET /kompas/sections/piutang` | — |
| piutang | `app/pages/cashier/piutang.vue` | ✅ | `GET/PUT /kompas/sections/piutang`, `/sections/owners`, `GET /account/roster` | — |
| compliment | `app/pages/cashier/compliment.vue` | ✅ | `GET/PUT /kompas/sections/compliments`, `GET /kompas/reports/{date}`, `GET /account/roster` | — |
| voidb | — | ⬜ | | #27 |
| rokok | — | ⬜ | | #28 |
| rokokrekap | — | ⬜ | | #28 |
| kasir | — | ⬜ | | #29 (`porsi-pic.ts`, K-04) |
| dp | `app/pages/cashier/dp.vue` | ✅ | `DanaMasukPanel` (kontrak reservasi, pintu G-14) | — |
| bri | — | ⬜ | | #30 (`cocok-bri.ts`) |
| rokokset | — | ⬜ | | #28 |
| akses | `app/pages/cashier/akses.vue` | ✅ | `GET /account/modules/cashier/members` | — |

Catatan build:
- **Satu perilaku sengaja berbeda dari lama:** submit Report Daily mempertahankan tanda lain di report yang sama
  (`mdr`, `aktual`, `setor`, … dari Finance › Rekap Penjualan). Layar lama mengganti seluruh objek dan membuangnya.
- Konflik versi (409/428) tidak membuang isian Report Daily: isian tetap di layar, pita "Belum tersimpan" muncul.
- Rumus murni di `app/utils/cashier.ts`, dijaga `npm run uji:cashier` (28 pemeriksaan; PAYS dibandingkan dengan
  `deploy/cashier` dan `deploy/finance/omset`; 8 mutasi dicoba, semua tertangkap).
- Nama auto-import dijaga unik: tipe `ComplimentKasir` (bukan `Compliment`, sudah dipakai `performa-bonus.ts`),
  `getBagianKompas`/`putBagianKompas` (bukan `getSection`, sudah dipakai `useReservasi.ts`).
- Cek visual 2026-10-07 dengan API tiruan baca-saja (tulis = 403): 1366px terang, kelima layar + validasi bon,
  konfirmasi lunasi, mode ubah compliment, penolakan simpan tampil sebagai toast; 390px tanpa geser samping.

## K. Daftar uji cutover (layar #26)
Setiap aksi tulis diuji SILANG: ubah di Vue → terlihat di Office lama (Cashier & Finance › Omset), dan sebaliknya.

1. **Report Daily** — pilih tanggal hari ini, isi POS & Actual beberapa metode, tekan Submit. Pastikan angka sama di
   Report Daily Office lama dan di Finance › Rekap Penjualan. Isi MDR di Rekap Penjualan, lalu Update dari Vue:
   MDR **tidak hilang**.
2. **Report Daily, toleransi** — buat selisih total Rp5.000 (pita hijau) lalu Rp5.001 (pita merah); submit tetap bisa.
3. **Report Daily, bon** — catat bon Cash di Piutang tanggal yang sama: kolom Sisa Selisih & kartu Penjelasan muncul,
   selisih Cash terjelaskan.
4. **Report Daily, konflik** — buka tanggal yang sama di dua tab, simpan di tab A lalu tab B: tab B menolak, isian tab B
   tetap di layar.
5. **Piutang** — tambah bon tamu (PIC wajib), owner baru (masuk daftar owner), ubah nominal, hapus. Cek di Office lama.
6. **Piutang, lunasi** — lunasi 2 bon satu orang dengan tanggal uang diterima & metode lain; muncul di Riwayat dan sebagai
   pelunasan di Report Daily tanggal itu. Batal lunas mengembalikannya.
7. **Compliment** — tambah dengan PIC Kasir & Pemberi, ubah pemberinya (status kembali "Menunggu keputusan"), hapus.
   Total harus cocok dengan POS Compliment + Member Deposit Report Daily.
8. **Dana Masuk** — pemegang `cashier` tanpa modul reservasi bisa melihat dan memverifikasi DP; tidak ada tombol hapus.
9. **Kelola Akses** — daftar sama dengan pemegang modul `cashier` di Kelola Akses Office.
