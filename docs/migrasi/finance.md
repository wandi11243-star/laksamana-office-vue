# Finance — inventaris migrasi

Status: ⚠️ selesai dengan celah
Terakhir diperbarui: 2026-09-29

> **Triase 2026-09-29** — status di tabel E yang bertentangan dengan catatan ini: catatan ini yang berlaku.
> Rincian: [`_pertanyaan.md`](_pertanyaan.md), [`_gap-api.md`](_gap-api.md).
> - `ping`/`stats` ❌ → tidak dibawa (U3). Saldo wallet di Kas → G-06.
> - MDR → T-13. Void → T-14. Pembanding POS → T-15. Dana Masuk → T-12.

## Ringkasan
- Jumlah layar: 29 fungsional (1 pemilih panel + 6 Omset + 15 Kas Kecil + 7 Brankas) + 2 halaman pengalih (Kompas, Rekap) · Aksi backend lama: 49 · Gap v1: 2 ❌ · 5 ⚠️
- Finance adalah satu kartu launcher berisi **tiga panel** dengan kunci izin terpisah: `omset/` (kunci `kompas`, bekas modul Kompas), `kas/` (kunci `finance`), dan `brankas/` (kunci `brankas`). Pemilih `deploy/finance/` mengantar otomatis bila user hanya berhak satu panel.
- Penggunanya tiga kelompok yang berbeda: **kasir** mencatat omset + Report Daily + compliment + breakdown tiap malam; **finance** memegang buku kas kecil, rekap penjualan (cocokkan POS vs setoran bank), invoice/kwitansi, void, BRI, dashboard, dan performa; **manajemen/CFO** membaca posisi kas perusahaan & pengembalian modal di Brankas.
- Data omset adalah **satu blob bersama** (`app_state` id=1) yang ditulis oleh `omset/` DAN `cashier/`; satu-satunya penjaga konflik legacy adalah `baseTs`. Saldo Brankas **tidak pernah diketik** — dihitung dari Aktual Masuk Rekap Penjualan. Dua hal inilah yang paling berisiko saat migrasi.
- Banyak rumus hidup di **berkas kembar** yang harus dijaga sama: `aktGrup()` (brankas) ≡ `rkHitung()` (kas); `RK_GRUP` ada di kas DAN brankas; `PAYS` ada di kas, omset, dan cashier. Mesin bonus Marketing/Event & pencocokan BRI sudah dipindah ke `deploy/assets/` (`performa-bonus.js`, `cocok-bri.js`).

## A. Sumber
| jenis | path | baris |
|---|---|---|
| frontend pemilih | laksamana-office/deploy/finance/index.html | 276 |
| frontend omset (bekas Kompas) | laksamana-office/deploy/finance/omset/index.html | 4.390 |
| frontend kas | laksamana-office/deploy/finance/kas/index.html | 7.625 |
| frontend brankas | laksamana-office/deploy/finance/brankas/index.html | 1.772 |
| pengalih kompas | laksamana-office/deploy/kompas/index.html | 56 |
| pengalih rekap | laksamana-office/deploy/finance/rekap/index.html | 56 |
| backend lama KK + Brankas + Invoice | laksamana-office/finance-mysql/api.php, lib_finance_mysql.php, lib_invoice.php | 13.375 / 32.931 / 29.003 byte |
| backend lama Kompas | laksamana-office/kompas-mysql/api.php, lib_kompas_mysql.php | 20.495 / 148.577 byte |
| kontrak v1 finance | laksamana-api/docs/api/finance.md | 145 |
| kontrak v1 kompas | laksamana-api/docs/api/kompas.md | 137 |
| spec port finance | laksamana-api/docs/modules/finance.md | 85 |
| spec port kompas | laksamana-api/docs/modules/kompas.md | 135 |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:91-262 "Modul berpanel finance" · :375-457 "Planning Pembayaran" · :702-772 "Pengakuan Omset" · :2377-2409 "Input Omset Harian: siapa yang menginput" · :5180-5230 "Selisih POS vs Rekap dipecah PER HARI" · :10006-10070 "Catatan Void manual" · :10771-10890 "Rekap Penjualan: persentase MDR, & Dana Masuk" · :11762-11820 "Penjaga tulis-basi pada blob omset bersama" | |
| aset bersama | laksamana-office/deploy/assets/performa-bonus.js · cocok-bri.js | (lihat §G) |
| route v1 | laksamana-api/app/Modules/Finance/routes/v1.php · laksamana-api/app/Modules/Kompas/routes/v1.php | |

## B. Akses
- **Kunci Modul di launcher:** kartu `key:'finance'` dengan `access:['kompas','finance','brankas']`, `accessLabels:{kompas:'Panel Input Omset Harian',finance:'Panel Kas Kecil, Performa & Rekap',brankas:'Panel Brankas'}`, `title:'Finance'`, `tag:'Omset, Kas Kecil, Brankas, Performa & Rekap'` (`deploy/index.html:1355-1359`). Kunci `'rekap'` sudah dilebur ke `'finance'` dan tidak dibaca siapa pun lagi (`deploy/index.html:145-146`, `deploy/finance/index.html:138-145`).
- **Pemilih panel** (`deploy/finance/index.html`): syarat sesi = `lm_session` valid dan modul memuat `*`/`kompas`/`finance`/`brankas` (`:114-124`, `:227-235`). Panel yang boleh dibuka: `omset` bila `*`/`kompas`, `kas` bila `*`/`finance`, `brankas` bila `*`/`brankas` (`:128-131`). Bila hanya satu panel → dialihkan langsung via `window.location.replace` (`:147-162`); bila ≥2 → pemilih ditampilkan (`:163`). Peta `PANEL_URL={omset:'./omset/',kas:'./kas/',brankas:'./brankas/'}` (`:254`).
- **Omset** (`deploy/finance/omset/index.html`): gate modul `*`/`kompas` (`:646-651`). Dua level dari `adminModules`: `full` bila `*`/`kompas` → grup Operasional+Sistem; `ops` → hanya Operasional (`:636-639`, `:660-666`). `VIEW_GRUP`: Operasional=`input,report,piutang,compliment,breakdown`; Sistem=`akses` (`:686-689`). Halaman `akses` (Kelola Akses Kru) hanya baca — pemegang akses ditarik dari Office (`:4295-4330`).
- **Kas** (`deploy/finance/kas/index.html`): gate modul `*`/`finance` (`bacaSesi`, sekitar `:840`). Matriks izin per-**role** (bukan per orang): `ROLE_KEYS=['staf','manajemen','viewer']`, `ROLE_LABEL={staf:'Staf Finance',manajemen:'Manajemen',viewer:'View Only',admin:'Admin Modul'}`, `ROLE_BAWAAN='staf'` (`:1016-1028`). Tiga tingkat `PERM_NONE/VIEW/EDIT` (`:973`). `AKS_HAL_ISI=['kk_input','kk_buku','kk_pos','bayar','rekap','bri','invoice','akses']` (`:981`). `DEFAULT_PERMS` per (halaman, role) (`:1032-1057`). Admin modul (`adminModules` `*`/`finance`) selalu penuh dan tidak bisa diturunkan (`:1098`); `viewer` dijepit ≤ Lihat (`:1104`). Halaman `dp` di luar `AKS_HAL_ISI` tapi matriksnya menentukan siapa boleh **membuka** — isinya milik Reservasi (`AKS_HAL_KET`, `:985`).
- **Brankas** (`deploy/finance/brankas/index.html`): gate modul `*`/`brankas` (`:750`); admin modul = `adminModules` memuat `*`/`brankas`/`finance` (`:756`). Role sama: `staf/manajemen/viewer`, bawaan `staf` (`:791-810`). `AKS_HAL_ISI=['saldo','mutasi','modal','pengaturan','akses']` (`:791`); `pending` sengaja di luar (read-only) (`:786-789`).
- **Aksi khusus admin modul:** edit matriks akses Kas (`PUT access/matrix`, `PUT access/roles/{userId}`), matriks Brankas (`PUT vault/access/...`), Brankas juga hanya admin yang boleh ubah matriks (`:1665+`). Di omset, admin modul dapat level `full`.

## C. Daftar layar (dari TITLES / sidebar)
Sumber: omset `TITLES` `:1263-1275` + sidebar `:465-487`; kas `TITLES` `:3076-3092` + sidebar `:711-764`; brankas `TITLES` `:1094-1102` + sidebar `:559-574`.

| key | panel | judul | subjudul | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|---|
| (pemilih) | finance/ | Pilih Panel | "Anda sudah masuk lewat Office. Pilih panel yang ingin dibuka." | pemegang ≥2 kunci | tidak | finance/index.html:187-211 |
| report | omset | Report Daily Kasir | "Setoran per metode pembayaran: POS vs Actual" | Operasional | tidak | omset:1266, :466 |
| input | omset | Input Omset Harian | "Catat pendapatan, diskon, tax & service, dan trafik harian" | Operasional | tidak | omset:1265, :467 |
| piutang | omset | Piutang / Bon | "Bill yang belum dibayar tamu & owner — beserta metode POS sementaranya" | Operasional | tidak | omset:1267, :468 |
| compliment | omset | Compliment | "Catatan compliment beserta alasan & PIC penanggungnya" | Operasional | tidak | omset:1268, :469 |
| breakdown | omset | Breakdown Sumber Omset | "Isi omset per kasir, lalu potong untuk event marketing, Reservasi VIP & event internal" | Operasional | tidak | omset:1269, :470 |
| akses | omset | Kelola Akses Kru | "Siapa saja yang bisa membuka modul Kompas" | Sistem (level full) | tidak | omset:1274, :486 |
| kk_input | kas | Input Transaksi Kas Kecil | "Satu baris = satu transaksi; tambah baris sebanyak yang perlu lalu simpan sekaligus" | staf (bawaan) | tidak | kas:3077, :725 |
| kk_buku | kas | Buku Kas Kecil | "Semua transaksi berikut saldo berjalan tiap pos" | staf+ | tidak (default halaman) | kas:3078, :724 |
| kk_pos | kas | Pos & Kategori | "Daftar pos pembayaran dan kategori belanja" | staf (bawaan) | tidak | kas:3079, :726 |
| bayar | kas | Planning Pembayaran | "Lembar transfer mingguan per rekening pembayar — pindah dari panel Brankas" | staf+ | tidak | kas:3080, :734 |
| rekap | kas | Rekap Penjualan | "Cocokkan POS dengan setoran bank — angka penjualannya after tax & service" | staf+ | tidak | kas:3081, :735 |
| dp | kas | Dana Masuk (DP) | "DP reservasi yang sudah masuk — halaman milik modul Reservasi, verifikasinya tersimpan di sana" | staf/manajemen (viewer NONE) | tidak | kas:3082, :747 |
| bri | kas | Pencocokan QRIS BRI | "Mutasi masuk rekening BRI dicocokkan ke DP reservasi" | staf/manajemen/viewer (Lihat) | tidak | kas:3083, :748 |
| invoice | kas | Invoice & Kwitansi | "Permintaan kwitansi dari Reservasi — periksa dana masuknya, lalu terbitkan" | staf+ (viewer NONE) | tidak | kas:3084, :749 |
| voidb | kas | Laporan Void | "Menu yang di-void berikut kronologinya — dicatat kasir di modul Cashier" | semua role (Lihat) | tidak | kas:3085, :740 |
| bulanan | kas | Dashboard Omset | "Pencapaian target bulan berjalan" | semua role | tidak | kas:3086, :710 |
| analytics | kas | Dashboard Analytics | "Komposisi & sumber pendapatan" | semua role | tidak | kas:3087, :711 |
| marketing | kas | Performa Marketing | "Kontribusi omset per marketing" | semua role | tidak | kas:3088, :753 |
| event | kas | Performa Event | "Kontribusi omset per PIC event" | semua role | tidak | kas:3089, :754 |
| kasir | kas | Performa Kasir | "Omset yang diakui tiap kasir — angka final" | semua role | tidak | kas:3090, :755 |
| akses (kas) | kas | Kelola Kru | "Siapa saja yang bisa membuka modul Finance" | semua role | tidak | kas:3091, :763 |
| ringkasan | brankas | Ringkasan Brankas | "Posisi kas perusahaan dan keputusan terdekat" | semua role | tidak (default) | brankas:1095, :559 |
| saldo | brankas | Saldo & Rekening | "Dihitung dari Aktual Masuk di Rekap Penjualan" | semua role | tidak | brankas:1096, :560 |
| mutasi | brankas | Mutasi & Transfer | "Setor, tarik, dan pindah uang antar wallet" | semua role | tidak | brankas:1097, :561 |
| pending | brankas | Uang Pending / Piutang | "Bon yang dicatat kasir dan belum dibayar tamu" | semua role (read-only) | tidak | brankas:1098, :565 |
| modal | brankas | Pengembalian Modal | "Progres pengembalian modal per investor" | semua role | tidak | brankas:1099, :569 |
| pengaturan | brankas | Pengaturan | "Saldo awal, pemetaan metode pembayaran, dan biaya bulanan" | staf (bawaan Ubah) | tidak | brankas:1100, :573 |
| akses (brankas) | brankas | Kelola Akses | "Siapa boleh membuka dan mengubah halaman mana" | semua role | tidak | brankas:1101, :574 |
| — | kompas | (pengalih) | "Kompas sekarang ada di Finance" | siapa pun (JS) | — | kompas/index.html:31,51 |
| — | rekap | (pengalih) | "Rekap Penjualan pindah" | siapa pun (JS) | — | rekap/index.html:31,50 |

Catatan: halaman `target` **dihapus** dari kedua panel pada 5 Sep 2026 (seluruh konsep target dicabut); tidak ada di `TITLES` maupun sidebar (`omset:1270-1273`, `:481-485`).

## D. Detail per layar

### D.0 (pemilih) — Pilih Panel (deploy/finance/index.html)
- **Tampilan:** kartu promo "Laksamana Muda / Finance", judul "Angka Harian & Kas Perusahaan", kutipan `"Yang diisi tiap malam, yang dibaca tiap pagi."` (`:174-183`); panel kanan judul "Pilih Panel", nama user (`#who-name`), label "Panel Tersedia" (`:186-195`).
- **Aksi:** 3 tombol `side-card`: **"Input Omset Harian"** (sub "Omset, report daily, piutang, compliment & breakdown", `:197-201`), **"Kas Kecil, Performa & Rekap"** (sub "Buku kas, rekap penjualan, dashboard omset, analytics, ranking & performa", `:202-206`), **"Brankas"** (sub "Posisi kas per bank, piutang, rencana pembayaran & pengembalian modal", `:207-211`); tombol "← Kembali ke Office" (`:214`). `bukaPanel(key)` → `PANEL_URL[key]` (`:255-258`).
- **Tombol yang cocok disembunyikan** bila panel tidak berhak (`:268-270`); auto-redirect bila hanya 1 panel (`:147-162`).
- **Catatan:** `.login-wrap` `visibility:hidden` sampai kelas `tampilkan-pemilih` dipasang (`:86-91`, `:163`), supaya pemilih tidak berkedip.

### D.1 report — Report Daily Kasir
- **Tampilan:** tabel setoran **per metode pembayaran** (`PAYS`, 20 metode, `:722-744`) dengan kolom **Metode Pembayaran / POS / Actual / Selisih** (+ kolom "Sisa Selisih" bila hari itu ada bon, `:1578-1596`); 3–4 kartu statistik: **Total POS** ("angka dari mesin kasir"), **Total Actual** ("uang & mutasi yang benar-benar ada"), **Selisih POS vs Actual** (`:1610-1621`).
- **Filter/cari:** pemilih Tanggal saja (`#rp_cal`, `:1573`).
- **Aksi:** tombol **"Submit Report"** / **"Update Report"** (`:1668`); jejak submit ditampilkan (`jejakHtml`, `:1631`).
- **Form & field:** per metode dua input `data-f="pos"` dan `data-f="actual"` (kelas `rf`, `:1584-1590`).
- **Perhitungan di browser (`hitung()`, `:1597-1666`):**
  - `tp`=Σpos, `ta`=Σactual, `tsel=ta−tp`.
  - Per metode: `s=act−pos`; **baris yang POS dan Actual keduanya 0 tidak dinilai** (dianggap belum diisi); `hk=harus`; `z=s−hk` (sisa setelah bon), `th+=hk`.
  - `sisa=tsel−th`; `aman=|sisa|<=SELISIH_TOLERANSI` (**Rp5.000**, `:761`). Total yang dinilai lanjut: merah hanya bila total lewat toleransi.
- **Real-time:** semua input `oninput` menghitung ulang; **submit tidak pernah dikunci** (`:1622-1666`).
- **Catatan:** menyimpan `DB.reports[tgl]={pay,by,at,submitted,log}` (`:1701-1706`); pakai `baseTs` lewat `save()/kirim()`.

### D.2 input — Input Omset Harian
- **Tampilan:** kartu "Informasi & Pendapatan" (Tanggal + Hari readonly), Pendapatan (Food Sales, Beverage Sales, Pendapatan Lainnya, Discount diberikan (−)); catatan "Service Charge dan Tax dicatat terpisah, tidak menambah/mengurangi omset"; Qty (Food/Beverage/Others), Data Operasional (Traffic, Total Bill) (`:1386-1440`); kartu "Pencocokan dengan Report Daily" (`:1441-1444`); kartu "📅 Pencapaian Bulan Berjalan" (Realisasi Bulan Ini, Rata-rata per Hari) (`:1455-1462`).
- **Aksi:** **"Simpan Omset"** / **"Update Data"** (`#i_save`), **"Hapus"** (`#i_del`, konfirmasi "Hapus data omset <tgl>? Breakdown ikut terhapus."), **"Ke Breakdown →"** (`:1433-1437`, `:1482-1486`).
- **Perhitungan (`recalc`, `:1464-1487` + helper `:1126-1134`):**
  - `gross = food+bev+lainnya`; `net = gross − discount`; `taxSvc = service_charge + tax`; `tagihan = net + taxSvc`; `avgSpend = net / bill` (0 bila bill 0); `items = qty_food+qty_bev+qty_others`.
  - Pencocokan: `setoran = Σ repPay(rep,p).actual`; `koreksi = bon.totLunas − bon.totBaru`; `sel = tagihan − setoran + koreksi`; `lewat = |sel| > SELISIH_TOLERANSI`.
- **Validasi (`saveDaily`, `:1490-1549`):** semua nilai < 0 → "Nilai tidak boleh negatif."; `gross===0` → "Pendapatan tidak boleh kosong."; `discount>gross` → "Diskon melebihi total pendapatan."; `traffic<bill` → "Traffic harus ≥ jumlah Bill."
- **Real-time:** semua `.ci` `oninput` → recalc.
- **Catatan:** hari baru dibuat dengan `bd={marketing:[],event:[],kasir:[],self:{amount:0,disc:0}}`, `bdValid=false`, `log=jejak` (`:1531`). Jejak penginput menumpuk (`tambahJejak`, kata "Diinput").

### D.3 piutang — Piutang / Bon
- **Tampilan:** form **"Catat Bon Baru"**/`"Ubah Bon"` (Tipe, Nama Owner/dropdown, Nama yang Berhutang, PIC yang Menghandle, No. Bill / Keterangan, Nominal, Metode POS Sementara) (`:2035-2070`); daftar bon belum lunas **dikelompokkan per orang** (tabel: checkbox / Tanggal Bill / No. Bill / PIC / Metode POS Sementara / Nominal / Dicatat Oleh) (`:2011-2032`); daftar 80 pelunasan terakhir.
- **Aksi:** **"+ Tambah"** / **"💾 Simpan"** (`#bn_add`), **"Ubah"**, **"✕"** (hapus), **"Lunasi Terpilih · Rp…"** (per grup, `#bnsum_`), **"+ nama lain…"** (owner baru), hapus owner dari daftar (`chipOwner`).
- **Form & field:** `Tipe` pilihan `BON_TIPE` = Tamu/Owner/Staff/Lainnya (`:1918`); `Metode POS Sementara` dari `PAYS`; PIC dari roster Office (`COMP_ROSTER`).
- **Perhitungan:** `bonRingkasHari(date)` → `{baru[pk],lunas[pk],harus[pk]}` per metode (bon baru menambah, pelunasan mengurangi) (`:1924-1938`).
- **Validasi/konfirmasi:** pelunasan `confirm("Lunasi N bon atas nama <nama> senilai Rp…?\n\nUang dicatat masuk pada <tgl> lewat <metode>.<br>Report Daily tanggal itu akan menampilkannya sebagai pelunasan.")` (`:2210`); batal lunas `confirm("Kembalikan bon ini ke status BELUM LUNAS?…")` (`:2223`); hapus bon `confirm("Hapus catatan bon ini?…")` (`:2231`); hapus owner `confirm("Hapus \"<nama>\" dari daftar owner?…")` (`:2241`).
- **Catatan:** status bon `'open'`/`'lunas'`; melunasi menyimpan `lunasDate,lunasPayKey,lunasBy,lunasAt`.

### D.4 compliment — Compliment
- **Tampilan:** form **"Tambah Compliment"**/`"✏️ Ubah Compliment"` (Nama Compliment, Sub Total, Tax, Service Charge, PIC Kasir, PIC Pemberi) (`:2404-2440`); 3 kartu: **Total Compliment <tgl>**, **Report Daily (POS)** ("Compliment + Member Deposit"), **Selisih**; daftar compliment hari itu.
- **Aksi:** **"+ Tambah"** / **"💾 Simpan Perubahan"** (`#c_add`), **"Batal"** (`#c_batal`), edit (✏️), hapus (✕).
- **Perhitungan (`hitungTotal`, `:2470-2477`):** `nominal = subTotal + tax + service`; **yang memotong realisasi = `subTotal`** (`compPotong`, `:2565`); `angkaRD(date,total)` = `{total=Compliment+MemberDeposit POS, comp, dep, ada, cocok}` (`:2354-2360`).
- **PIC:** `PIC Kasir` dari roster ber-`kasir`; `PIC Pemberi` dari roster `marketing/office/event` (`divPemberi`); opsi `Tamu`=`__tamu__` (`:2392-2401`).
- **Validasi:** "Nama compliment wajib diisi."; "Sub total, tax, dan service charge tidak boleh nol semua." (`:2486-2488`).
- **Catatan:** `pemberiStatus` mulai `'menunggu'`; mengganti pemberi me-reset putusan; edit tidak menimpa `id/by/at/alasan` (`:2515-2536`).

### D.5 breakdown — Breakdown Sumber Omset
- **Tampilan:** pemilih Hari; notice total net; 4 section: **Section A — Omset per Kasir (isi ini dulu)**, **Self Order (tanpa kasir)**, **Section B — Marketing (memotong kasir shift)**, **Section C — Event Internal (diakui 50%, kasir tidak dipotong)**; pita efek & peringatan (`:3258-3324`, `:3401-3410`).
- **Aksi:** **"+ Tambah Data Marketing"**, **"+ Tambah Data Event"**, tombol **"Atur kasir shift"** per baris, centang OFF, **"Simpan Breakdown"** (`#bd_save`, `:4124`).
- **Perhitungan (`calc`, `:4053-4150`):**
  - `sumDiakui()` = Σ kasir diakui + self + marketing porsi + event porsi; `diff = net − tot`; **balance = |diff| < 1**.
  - `omsetKasir(r) = amount − disc` (`:1153`); `diskonKasir(r) = r.off ? 0 : disc` (`:1154`); `selfOmset = amount − disc` (`:1168`); `porsiPic(r,divi)` (`:2798`); `obTotal` = obAmount+obTax+obService bila `r.ob` (`:2797`).
  - **Marketing diakui = omset + tax + service; dipotong dari kasir shift hanya kolom Omset. Event diakui 50% (open bill diakui penuh); kasir tidak dipotong.**
  - Gating simpan: `ok = balance && belum.length===0`; **baris marketing bernominal yang shift-nya belum ditentukan MENGHALANGI simpan** ("Belum bisa disimpan… Potongan … tidak dibebankan ke kasir mana pun, jadi omset itu terhitung dua kali", `:4108-4112`). Atribusi diskon tidak mengunci, hanya peringatan.
  - Baris tanpa PIC → peringatan "N baris belum dipilih PIC-nya … tidak akan muncul di Performa Marketing/Event" (`:4096-4102`).
- **Konfirmasi simpan (`:4126-4149`):** ringkasan Total Omset Diakui / net / Selisih / jumlah baris.
- **Catatan:** menyimpan `d.bd={marketing,event,kasir,self,abaikan}`, `d.bdValid=true`, `d.bdLog` (jejak menumpuk, kata "Diatur"). Pola lama (sebelum 30 Jul 2026) dideteksi & diberi peringatan "🔄 Hari ini diisi dengan aturan lama…" (`:3336`).

### D.6 akses — Kelola Akses Kru (omset, read-only)
- **Tampilan:** tabel pemegang akses modul Kompas dari `listModuleRoster{module:'kompas'}`: Nama / Tim-Keterangan / Status (nonaktif) / **Level Tampilan** ("Super Admin — semua menu" bila `isModuleAdmin`, selain itu "Operasional saja") (`:4317-4372`, `:4339`).
- **Aksi:** **"↻ Segarkan"** (`:4323`).
- **Catatan:** menambah/menghapus akses & menaikkan level dilakukan di Office (`:4316`). Gagal muat 8 detik → pesan "Office tidak menjawab dalam 8 detik" (`:4329`).

### D.7 kk_input — Input Transaksi Kas Kecil (kas)
- **Tampilan:** panel PO BD (`poPanel()`), tabel draf multi-baris (kolom: Tanggal / Keterangan / Kategori / Jenis / satu kolom per pos aktif / Total / Input / Bon) (`:5631-5643`), kotak Σ grand.
- **Aksi:** **"+ Tambah baris"**, **"Simpan semua baris"** (`#kk_simpan`), **"Batal ubah"**, **"Ke Buku Kas Kecil"**, **"+ Input"** dari daftar PO BD (`:5658-5674`).
- **Form & field:** `Jenis` debet/kredit; `nilai[pos_id]`; `input` (sudah masuk pembukuan); `bon` (nota fisik ada); asal PO dari BD (`poId/poItem/poAmount`, `:5681-5687`).
- **Perhitungan:** `d.arah==='debet'` → `debet=n,kredit=0`; sebaliknya (`:5843`).
- **Validasi:** "Belum ada baris yang bisa disimpan — semuanya masih kosong." (`:5850`); "Belum ada pos pembayaran. … Tambahkan dulu di Pos & Kategori." (`:5618`).
- **Catatan:** dikirim `simpanTrx` **satu per satu berurutan**; setelah semua, `poTulisRealisasi` (BD `setRealisasi`) hanya untuk baris berhasil; baris yang berhasil dibuang dari draf (`:5855-5905`).

### D.8 kk_buku — Buku Kas Kecil (kas)
- **Tampilan:** saldo berjalan tiap pos; daftar transaksi (`kkRentang()` mengikuti PERIOD/VIEWDATE); filter `KK_FILTER` (pos, kategori, q, status: `input_belum/input_sudah/bon_belum/bon_sudah/belum_lengkap`) (`:5197-5210`).
- **Aksi:** tombol ubah (`KK_EDIT`), hapus (`hapusTrx`), tandai Input/Bon (`tandai`), pager.
- **Perhitungan:** `kkPetaSaldo(posId)` — saldo berjalan dari **seluruh riwayat** (bukan hanya periode): `s += debet − kredit` (`:5164-5172`); `kkSaldoPos(posId)` = Σ(debet−kredit) (`:5173-5175`).
- **Catatan:** back link ke Input.

### D.9 kk_pos — Pos & Kategori (kas)
- **Tampilan:** dua daftar: **pos pembayaran** (`kk_pos`: nama, urut, aktif) dan **kategori belanja** (`kk_kategori`, 12 seed).
- **Aksi per item:** simpan (`simpanPos`/`simpanKategori`), nonaktif (`nonaktifPos`/`nonaktifKategori`), aktif (`aktifPos`/`aktifKategori`), hapus (`hapusPos`/`hapusKategori`) (`:5920-5974`).
- **Validasi:** hapus ditolak server bila pos dipakai transaksi (v1: `422` → nonaktifkan, `docs/api/finance.md:64`).

### D.10 bayar — Planning Pembayaran (kas)
- **Tampilan:** kartu ringkasan **Nilai Batch / Sudah Dibayar / Bukti TF / Belum Masuk Batch**; pemilih **Lembar pembayaran** (date) + arsip; lembar grid 6 kolom (Vendor / Keterangan / Kategori / Dibayar dari / Nominal / aksi) + baris draf; tabel batch per rekening (`:7218-7400`).
- **Aksi:** **"+ Baris"**, **"Buang semua"**, **"Simpan N baris ke lembar <tgl>"**, edit/hapus baris, bukti TF, status bayar; **"Tetap tambah ke lembar ini"** (paksa arsip); **"Coba lagi"**; **"Buka lembar berjalan"**.
- **Form & field:** Vendor (datalist dari master `stock-api-mysql/vendors.php`), Keterangan, Kategori (`BAYAR_KAT`), Dibayar dari (`SEMUA_WADAH()`), Nominal; `batch`(tgl), `status` (`scheduled`/`paid`), `bukti.ok`, `dari`, `amount`, `name`, `cat`.
- **Perhitungan:** `totBatch = Σ amount`; `sudah = Σ amount status==='paid'`; saldo wallet dari `saldoSemua()` (brankas) (`:7235-7238`).
- **Real-time:** draf disimpan di memori; guard `beforeunload` + konfirmasi `go()`.
- **Catatan:** **layar pindah ke Kas (2 Sep 2026), data tetap di `bk_state.bayar`**; baca `brankasGet`, tulis `bayarSave` (bukan `brankasSave`) (`:7057-7080`, CLAUDE.md:375-400).

### D.11 rekap — Rekap Penjualan (kas)
- **Tampilan:** 3 sub-tab: **Rekap Bulanan / Input Harian / Setoran Cash** (`:2289-2293`). Rekap Bulanan: kartu **Dibayar Tamu** (`after tax & service · net + svc + tax`), **Rekap Aktual** ("dipotong MDR"), **Total MDR**, **Total Selisih**, **Piutang / Bon**, **Adjust Terkunci di POS**, **Sudah Setor**; grid **Per Metode Pembayaran** (`RK_GRUP` 13 kelompok, `:1868-1892`); **Rincian Harian** (klik hari → rincian 9 kelompok + 4 metode lain: Compliment, Member Deposit, Voucher, Error Customer, Error Kitchen).
- **Filter:** Periode (`PERIOD`) dari topbar.
- **Aksi:** **"Simpan Perubahan"** (`#rk-simpan`), **"Catat Setoran"** (`#rk-st-simpan`), **"✎ Isi MDR & penanda hari ini"** (`rkIsiHari`).
- **Perhitungan (`rkHitung`, `rkDetail`):**
  - Rumus aktual: `kotor = Σ reports[tgl].pay[k].actual`; `akt = mdrManual diketik ? <angka> : kotor − MDR tersimpan`; kelompok tanpa MDR (cash/transfer/error) `akt = kotor` (`brankas` kembar `:940-1016`, CLAUDE.md:130-133).
  - `Dibayar Tamu = omset net + service + tax` (`rkJual`, `tagihanOf`); `Selisih = Dibayar Tamu − Setoran(Actual) + MDR + koreksi bon` (`:2377-2390`).
  - MDR% = MDR ÷ **aktual kotor kelompok yang kena MDR** (`kotorMdr`), dua desimal, kosong bila nol (CLAUDE.md:10783-10800).
  - Setoran cash: `rkSetorSudah(tgl)` = Σ per-hari nominal (baris lama tanpa `jumlah` = **setoran PENUH** = `rkCash(tgl)`); `rkSisaSetor = max(0, cash − sudah)` (`:1944-1965`).
- **Penyimpanan (`rkKirim`, `:3004-3070`):** aksi sempit **`simpanRekap`** (bukan `saveAll`), mengirim hanya `{hari:{tgl:{setor,mdr,aktual,mdrManual,esb}}, setoran:{tambah/hapus}}`; `esb` = penanda "Input POS"; balasan `{saved,ubah,hari,takDikenal,setoran}`; setoran diganti utuh dari server.
- **Catatan:** `RK_TANDA='esb'` (`:1905`) — nama field di data tetap `esb` meski label UI jadi "POS"; `$grup`/`$bank` backend tertutup → MDR bank tak dikenal dibuang diam-diam (CLAUDE.md:150-151).

### D.12 dp — Dana Masuk (DP) (kas)
- **Tampilan:** `<iframe src="../../reservasi/?embed=finance">` tinggi `calc(100vh-210px)` (`:6429-6440`).
- **Aksi:** **"↻ Muat Ulang"** (menulis ulang `src` + `&t=`, `:6451-6454`).
- **Catatan:** halaman milik modul Reservasi; pemegang `finance` masuk lewat pintu embed dan **punya hak sama dengan kasir** (bisa verifikasi & tolak) — dikatakan di layar (`:6431-6434`, CLAUDE.md:10880-10886). Guard: pemegang `finance` masuk `effRole='cashier'`.

### D.13 bri — Pencocokan QRIS BRI (kas)
- **Tampilan:** mesin di `assets/cocok-bri.js`; host menyediakan `apiUrl`, `rsvUrl` (`../../reservasi-api-mysql/api.php`), `sesi`, `bolehUbah('bri')`, `gambarUlang` (`:6485-6510`).
- **Aksi (di aset):** unggah mutasi (`briUnggah`), tambah manual (`briTambah`), cocokkan (`briCocok`), batalkan (`briBatal`), abaikan DP (`briAbai`); baca `briList` + getAll Reservasi.
- **Catatan:** **satu mesin dengan Cashier**; bulan dari `PERIOD`; menulis balik verifikasi DP ke Reservasi via `saveAll` (`:432-440`) — lintas modul.

### D.14 invoice — Invoice & Kwitansi (kas)
- **Tampilan:** 3 tab **Antrean / Riwayat / Pengaturan** (`:6633`); daftar permintaan (KWITANSI / INV_DP / INV_LUNAS) dengan status MENUNGGU/DIBUAT/DITOLAK; lencana jumlah menunggu di sidebar (`navBadgeInv`).
- **Aksi:** **"Terbitkan"** (`invBuat`→`invPutus aksi:'buat'`), **"Tolak"** (`invPutus aksi:'tolak'` + catatan wajib), **"Batal"**, pilih penanda tangan, tab Pengaturan (`invSetting`, prefix/prefixInvoice/cap/penandaDefault).
- **Perhitungan/peringatan (`invBuat`, `:6679-6720`):** bila belum lengkap → "⚠ PERHATIAN: baru X dari Y transfer yang terverifikasi di halaman Dana Masuk. Kwitansi yang terbit adalah pengakuan perusahaan bahwa uangnya sudah diterima."; bila tak ada penanda → "⚠ Tidak ada penanda tangan yang dipilih — lembarnya akan keluar tanpa tanda tangan."; konfirmasi menyebut nomor "diberikan sekali dan tidak bisa dipakai ulang".
- **Catatan:** `penanda:[]` dikirim eksplisit agar "sengaja tanpa tanda tangan" tidak jatuh ke bawaan server.

### D.15 voidb — Laporan Void (kas, baca saja)
- **Tampilan:** kartu **Total Nominal Void / Orang yang Mencatat / Dibatalkan / Pembanding POS** (`vlKartuPos`); tabel **Siapa yang Mencatat**, **Alasan Void**, **Kesalahan dari Siapa**, **Rincian Catatan** (dikelompokkan per tanggal+bill, yang dibatalkan dicoret); pencarian `#vl_q`.
- **Perhitungan:** hanya baris **hidup** (`vlAktif`) yang dijumlahkan; `batal = total − hidup`; per orang/alasan/salah via `vlKelompok` (`:1763-1772`).
- **Catatan:** **input hanya di Cashier → Void Menu**; pembanding POS dari `analyticsGet` (`AN.data.voidb[bulan].ringkas.nBaris`), selisih dijepit ≥ 0 (CLAUDE.md:10050-10070). Muat ulang per bulan.

### D.16 bulanan — Dashboard Omset (kas)
- **Tampilan:** Realisasi (net) + Realisasi sebagai **Tagihan**; Service+Tax; **Self Order** + porsinya; KPI **UPT** (item÷bill), **ATV** (net÷bill), **APS** (traffic÷bill); **Rasio Komposisi** (Food/Beverage/Lainnya dari **gross**, agar 100%); tren; ringkasan per hari (`:4001-4270`).
- **Perhitungan:** `real=Σ netOf(d)`; `realTagihan=Σ tagihanOf(d)`; `tax=Σ taxSvcOf(d)`; `svcOnly`/`taxOnly`; `compBulan=Σ nominal`; `disc=Σ discount`; `self=Σ selfOmset(d)`; `selfPct=pct(self,real)`; `kompo=food+bev+lainnya`; `rFood/rBev/rLain=pct(...,kompo)` (`:4004-4040`).
- **Real-time:** mode harian/bulanan dari `VIEWMODE`.

### D.17 analytics — Dashboard Analytics (kas)
- **Tampilan:** pie **Komposisi Pendapatan**, pie **Sumber Omset** (Marketing / Event / Walk In), bar **Kontribusi Marketing/Event/Kasir**, kartu **📱 Self Order**, bar **Diskon Diberikan per Kasir** (`:4279-4372`).
- **Perhitungan:** `src.Marketing += porsiPic(r,'marketing')`; `src.Event += porsiPic(r,'event')`; `src['Walk In'] += omsetKasir(r) − potonganHari(d,kasirId)`; `byDisc[kasirId] += diskonKasir(r)`; Self Order **tidak** masuk pie (`:4286-4305`). Selisih diskon `discInput − totDisc` dilaporkan.

### D.18 marketing/event — Performa Marketing / Performa Event (kas)
- **Tampilan:** **"📄 Simpan PDF"**, segmen PIC (termasuk "🧮 Semua"), 3 kartu Realisasi/Jumlah Event/Compliment Ditanggung, kartu Top event, grafik **Omset per Event**, tabel **Daftar Event** (kolom: Tanggal/Nama Event/Omset atau Nilai Event/[Tax/Service hanya marketing]/Open Bill/Diakui), pager 5 baris, kartu skema bonus, kartu approval compliment (`:4402-4520`).
- **Perhitungan:** `pbAgregasi(days,divi,list,compsRentang())` di `assets/performa-bonus.js`; `BONUS = bonusMarketing(list,agg)` atau `bonusEvent(list,agg)` (`:4412-4416`).
- **Aturan:** **Marketing diakui = omset + tax + service, dipotong dari kasir shift; Event diakui 50%, kasir tidak dipotong; Open Bill diakui penuh** (`:4470-4482`). Baris tanpa PIC → pita "N baris breakdown tidak diakui untuk siapa pun" (`pitaYatimPerforma`).

### D.19 kasir — Performa Kasir (kas)
- **Tampilan:** segmen kasir, kartu ringkasan, grafik **Omset Harian**, tabel **Riwayat** (Tanggal / Omset Diakui / Status Masuk-OFF-Compliment), pager 12 baris, kartu bonus, kartu compliment (`:4675-4800`).
- **Perhitungan:** `real = omsetKasir(r) − potonganHari(d,kasirId)`; lalu `real −= compPotong` per kasir; compliment diturunkan ke hari kejadiannya (`:4690-4735`). Hanya akun ber-Tim/Keterangan **kasir murni** (`kasirMurni`) yang dinilai.
- **Catatan:** bila ada baris event tanpa kasir shift → peringatan "N hari punya baris event yang belum ditentukan kasir shift-nya … realisasi di bawah masih terlalu besar".

### D.20 akses (kas) — Kelola Kru
- **Tampilan:** tabel Kepala (Nama/Tim-Keterangan/Status/Role) + matriks **12 halaman × 3 role** dengan tombol bersiklus (None/Lihat/Ubah), legenda `ROLE_KET`, catatan "Kru yang belum pernah ditentukan rolenya dihitung sebagai **Staf Finance**" (`viewAkses`, `:4817-5010`).
- **Aksi:** `simpanAkses` (peta SELISIH dari `DEFAULT_PERMS`), `simpanPeran {kunci:'#<userId>',peran}`; hanya admin modul yang boleh mengubah (tombol disembunyikan); role `'admin'` tidak bisa ditentukan di sini.
- **Catatan:** kunci penugasan = `#<userId>` (cadangan `@nama`); memberi sebuah role "Ubah" di halaman ini = memberinya kunci seluruh modul.

### D.21 ringkasan — Ringkasan Brankas
- **Tampilan:** 4 kartu **Total Kas Likuid** ("4 wadah (4 bank + brankas fisik)"), **Uang Pending / Piutang**, **Kewajiban 30 Hari**, **Runway**; 2 tabel **Posisi per Wadah** dan **Jatuh Tempo Terdekat** (≤6) (`:1130-1170`).
- **Perhitungan:** `likuid = Σ s[k].saldo`; `piutang = Σ bonBelum().nominal` (dibaca dari Cashier/Kompas); `wajib30 = Σ jadwal dueDate 0..30 hari`; `runway = likuid / burn` (null bila burn 0) (`:1131-1141`).

### D.23 saldo — Saldo & Rekening
- **Tampilan:** notice "Saldo … tidak diketik siapa pun"; peringatan "N metode pembayaran belum punya tujuan bank"; tabel **Saldo per Wadah** (Saldo Awal/Aktual Masuk/Setoran Masuk/Setoran Keluar/Pembayaran/Saldo); tabel **Aktual Masuk per Metode**; tabel **Setoran Cash ke Bank** (`:1185-1290`).
- **Perhitungan (`saldoSemua`, `:1018-1080`):** `saldo = awal + masuk + setorMasuk + mutMasuk − setorKeluar − mutKeluar − keluar − modal`.
  - `masuk` = Σ `aktGrup(tgl,g)` untuk kelompok yang dipetakan; setoran cash: bank `setorMasuk += n`, cash `setorKeluar += n`; pembayaran `status==='paid'` → `keluar`; mutasi masuk/keluar/pindah; pengembalian modal `returns[].dari` → `modal`.
- **Rumus `aktGrup` (kembar `rkHitung`):** lihat D.11.

### D.24 mutasi — Mutasi & Transfer
- **Tampilan:** 4 kartu saldo wadah; form **Catat Mutasi** (Jenis / Tanggal / Nominal / Dari Wallet / Ke Wallet / Keterangan); **Riwayat Mutasi** (setoran cash dari Rekap Penjualan ikut, ditandai "Rekap Penjualan") (`:1413-1510`).
- **Aksi:** **"Simpan Mutasi"**, **"Hapus"** (baris manual saja; baris otomatis tak bisa dihapus).
- **Form & field:** `MUT_JENIS` (masuk/keluar/pindah, `:1408`); kotak yang tak berlaku **disembunyikan** (`muUbahJenis`).
- **Validasi (`muSimpan`, `:1497-1510`):** "Nominal wajib diisi."; "Tanggal wajib diisi."; "Wallet asal dan tujuan tidak boleh sama." (jenis `pindah`).
- **Catatan:** jenis manual **tidak** memakai kata "Setor" → label "Uang masuk dari luar (di luar omset harian)"; pindah = SATU baris.

### D.25 pending — Uang Pending / Piutang (read-only)
- **Tampilan:** bon belum dibayar dari **modul Cashier/Kompas** (`KP.piutang`), dikelompokkan per orang, status `PIUTANG_ST = {pending:'Belum masuk', lunas:'Sudah masuk'}` (`:1293-1410`).
- **Catatan:** **tidak diketik di sini** — yang melunaskan kasir di Cashier (`:1288-1292`).

### D.26 modal — Pengembalian Modal
- **Tampilan:** 3 kartu **Modal Masuk / Sudah Dikembalikan / Sisa Kewajiban**; form **Catat Investor** (Nama / Modal / Kepemilikan (%) / Target Selesai); kartu per investor + form pengembalian (Tanggal Bayar / Nominal / Dibayar Dari) + tabel riwayat + **"Hapus Investor"** (`:1527-1600`).
- **Perhitungan:** `kembali = Σ returns[].amount`; `sisa = max(capital − kembali, 0)`; persen = `min(kembali/capital*100,100)`; `modalTanpaWadah()` melaporkan `returns` tanpa `dari` (`:1529-1540`, `:1085-1090`).
- **Validasi:** "Nama investor wajib diisi."; "Tanggal dan nominal pengembalian wajib diisi."
- **Catatan:** `returns[].dari` (wadah) menentukan wallet yang berkurang; tercatat juga sebagai dividen di halaman investor (`:1549-1554`).

### D.27 pengaturan — Pengaturan
- **Tampilan:** **Saldo Awal Tiap Wadah**; **Metode Pembayaran Masuk ke Bank Mana** (select per `RK_GRUP`); **Biaya Operasional Bulanan**; tombol **"Simpan Pengaturan"** (`:1615-1652`).
- **Field data:** `setting.awal[k]`, `setting.peta[grup]`, `setting.burn`.
- **Catatan:** bawaan QR Order/Gofood/Grabfood/TikTok Go → **UOB** (CLAUDE.md:145-148); kosong = runway tidak ditampilkan.

### D.28 akses (brankas) — Kelola Akses
- **Tampilan:** matriks seperti Kas (`DEFAULT_PERMS` brankas, `:810-820`); `AKS_HAL_ISI=['saldo','mutasi','modal','pengaturan','akses']`.
- **Aksi:** `brankasAkses {peta}`, `brankasPeran {kunci, peran}`; hanya admin modul (`:1725-1740`).

### D.29 kompas/ & rekap/ — halaman pengalih
- **kompas/index.html:** `<script>window.location.replace('../finance/omset/');</script>` di `<head>` (`:31`); fallback tanpa JS: "Kompas sekarang ada di Finance" + tautan "Buka halaman barunya →" (`:51-53`).
- **rekap/index.html:** `location.replace('../kas/#rekap')` (`:31`); fallback "Rekap Penjualan pindah" + tautan (`:50-53`). Alasan `#rekap`: panel kas default-nya Buku Kas (`:23-27`).

## E. Pemetaan backend

Legacy finance (`finance-mysql`) berbagi satu `api.php`; legacy kompas (`kompas-mysql`) idem. `action` dikirim di query-string DAN body (`docs/api/finance.md:11`). Semua aksi legacy **terbuka** (tanpa session) kecuali beberapa gate di kompas (`docs/modules/finance.md:15`).

| action lama | dipakai di layar | baca/tulis | endpoint v1 | status | catatan |
|---|---|---|---|---|---|
| `getAll` (finance) | kk_input/kk_buku/kk_pos, akses kas | baca | `GET /api/v1/finance/petty-cash/` | ✅ | `{pos,kategori,trx(baris[]),akses,peran}` (`docs/api/finance.md:54`) |
| `simpanTrx` | kk_input | tulis | `POST /petty-cash/transactions` / `PUT /petty-cash/transactions/{id}` | ✅ | edit menulis ulang baris split; `dibuat_oleh` = user sesi (`:57-58`) |
| `hapusTrx` | kk_buku | tulis | `DELETE /petty-cash/transactions/{id}` | ✅ | baris split ikut terhapus; butuh version (`:60`) |
| `tandai` | kk_buku | tulis | `PATCH /petty-cash/transactions/{id}` `{input?,bon?}` | ✅ | hanya tick administratif (`:59`) |
| `simpanPos` | kk_pos | tulis | `POST /petty-cash/sources` | ✅ | `{nama,urut?}`; duplikat `422 "<nama>" sudah ada dalam daftar.` (`:62`) |
| `nonaktifPos`/`aktifPos` | kk_pos | tulis | `PATCH /petty-cash/sources/{id}` `{aktif:false\|true}` | ✅ | (`:63`) |
| `hapusPos` | kk_pos | tulis | `DELETE /petty-cash/sources/{id}` | ✅ | ditolak `422` bila dipakai; nonaktifkan (`:64`) |
| `simpanKategori`/`nonaktifKategori`/`aktifKategori`/`hapusKategori` | kk_pos | tulis | `/petty-cash/categories[/{id}]` | ✅ | bentuk sama dengan Pos (`:61-64`) |
| `simpanAkses` | akses kas | tulis | `PUT /petty-cash/access/matrix` | ✅ | **module admin**; matrix SELISIH utuh; `tingkat` dijepit 0–2 (`:66`) |
| `simpanPeran` | akses kas | tulis | `PUT /petty-cash/access/roles/{userId}` | ✅ | **module admin**; `""/null` = default (`:67`) |
| `brankasGet` | bayar (kas), brankas semua layar | baca | `GET /finance/vault` (**module `brankas`**) | ⚠️ | panel Kas (module `finance`) memakainya untuk hitung saldo wallet; v1 gated `brankas` → pemegang `finance` saja kehilangan saldo (lihat §I) |
| `brankasSave` | brankas (semua form) | tulis | `POST/PUT/PATCH/DELETE /finance/vault/{list}[/{id}]` (+ `PUT /setting`) | ⚠️ | satu blob → per-record; **satu version untuk seluruh blob** (`updated_at`), `meta.version` (`:83,88-93`) |
| `bayarSave` | bayar (kas) | tulis | `GET/PUT /finance/petty-cash/payment-plan` | ✅ | `{bayar:[...]}`; menulis hanya `bayar` (`:100-103`) |
| `brankasAkses` | akses brankas | tulis | `PUT /finance/vault/access/matrix` | ✅ | **module admin brankas** (`:95`) |
| `brankasPeran` | akses brankas | tulis | `PUT /finance/vault/access/roles/{userId}` | ✅ | (`:96`) |
| `invMinta` | (dipanggil Reservasi/Marketing) | tulis | `POST /finance/invoices/requests` | ✅ | idempotent per `resId` (`:118`) |
| `invStatus` | invoice | baca | `GET /finance/invoices/status?res=…` | ✅ | ≤400 id (`:119`) |
| `invBerkas` | invoice | baca | `GET /finance/invoices/file/{resId}` | ✅ | hanya DIBUAT; `404 not_issued` (`:120`) |
| `invDaftar` | invoice | baca | `GET /finance/invoices/` | ✅ | `?status=&jenis=` (`:126`) |
| `invAntre` | lencana sidebar invoice | baca | `GET /finance/invoices/queue` | ✅ | `{total,perJenis}` (`:127`) |
| `invPutus` | invoice | tulis | `POST /finance/invoices/{id}/decision` `{aksi:buat\|tolak\|batal,catatan?,penanda?}` | ✅ | `tolak` wajib `catatan` (`:129`) |
| `invSetting` | invoice → Pengaturan | baca/tulis | `GET/PUT /finance/invoices/settings` | ✅ | prefix/prefixInvoice/cap/penandaDefault (`:130`) |
| `invPenandaSimpan` | invoice → Pengaturan | tulis | `POST /finance/invoices/signatories` + `PATCH /signatories/{id}` | ✅ | PATCH menulis `ttd` hanya bila dikirim (`:131-132`) |
| `invPenandaHapus` | invoice → Pengaturan | tulis | `DELETE /finance/invoices/signatories/{id}` | ✅ | ditolak bila sudah dipakai (`:132`) |
| `ping`/`stats` (finance) | tidak dipanggil frontend | baca | — | ❌ | tidak ada di kontrak v1; diagnostik (`docs/modules/finance.md:43`) |
| `getAll` (kompas) | omset (semua), kas (bulanan/analytics/performa/kasir/rekap), brankas (saldo/pending) | baca | `GET /api/v1/kompas/state` (+ `GET /kompas/daily`) | ✅ | `meta.version` = `updated_at` (`docs/api/kompas.md:55`) |
| `saveAll` (omset) | report/input/piutang/compliment/breakdown | tulis | `PUT /kompas/state` (+ `PUT /sections/{key}`, `PUT /reports/{date}`, `PUT /days/{date}`) | ⚠️ | blob → bagian granular; `saveAll` butuh version, bgranular tak (`:43-49,55-63`) |
| `simpanTarget` | (target DICABUT dari kedua panel 5 Sep 2026) | tulis | `PUT /kompas/targets` | ⚠️ | endpoint ada, tapi tidak ada layar target lagi (`:57`) |
| `simpanRekap` | rekap (kas) | tulis | `PUT /kompas/rekap` | ✅ | sempit; `{hari,setoran}`; version opsional (`:58,63`) |
| `omsetPic` | (dipakai Marketing; omset pakai porsiPic lokal) | baca | `GET /kompas/omset-pic?from&to` | ✅ | `:60` |
| `performaDivisi` | (dipakai Marketing/Event) | baca | `GET /kompas/performa/{divisi}?from&to` | ✅ | `:61` |
| `voidList` | voidb (kas) | baca | `GET /kompas/voids?from&to` | ✅ | `:88` |
| `voidSetting` | (dipakai Cashier) | baca/tulis | `GET/PUT /kompas/voids/settings` | ✅ | PUT module admin cashier/finance (`:92`) |
| `voidSimpan` | (dipakai Cashier → Void Menu) | tulis | `POST /kompas/voids` | ✅ | `:89` |
| `voidBatal` | (dipakai Cashier) | tulis | `POST /kompas/voids/{id}/cancel` | ✅ | `:91` |
| `analyticsGet` | voidb (kas, Pembanding POS) | baca | `GET /kompas/analytics` | ✅ | (`:125`) |
| `analyticsSave`/`analyticsAkses`/`analyticsPeran` | (dipakai modul Analytics) | tulis | `PUT /kompas/analytics` + `PUT /kompas/analytics/access` | ✅ | roles & matrix digabung (`:127`) |
| `briList` | bri (kas, via cocok-bri.js) | baca | `GET /kompas/bri?from&to` | ✅ | `:98` |
| `briUnggah` | bri (kas) | tulis | `POST /kompas/bri/upload` | ✅ | `sidik=tgl\|jam\|nominal\|#k` (`:99`) |
| `briTambah` | bri (kas) | tulis | `POST /kompas/bri` | ✅ | `cara='bukan'`, `sumber='manual'` (`:100`) |
| `briCocok` | bri (kas) | tulis | `POST /kompas/bri/match` | ✅ | `cocok` butuh `resId`+`dpId`; satu DP satu baris hidup (`:101`) |
| `briBatal` | bri (kas) | tulis | `POST /kompas/bri/{id}/cancel` | ✅ | `:102` |
| `briAbai` | bri (kas) | tulis | `POST /kompas/bri/ignored` + `DELETE /bri/ignored/{dpId}` | ✅ | `:103-104` |
| `ping`/`stats` (kompas) | tidak dipanggil frontend | baca | — | ❌ | tidak dirutekan di v1 (`docs/modules/kompas.md:98`) |
| `listDivisiRoster` (account) | omset piutang/compliment/breakdown, kas compliment/kasir | baca | `GET /api/v1/account/roster` | ✅ | sama dgn legacy (`docs/api/account.md:72`) |
| `listModuleRoster{module}` (account) | omset akses, kas akses, brankas akses | baca | `GET /api/v1/account/modules/{module}/members` | ✅ | `:73` |
| `setRealisasi` (BD) | kk_input (kas) | tulis | `PUT /api/v1/bd/purchase-orders/{id}/realisasi` | ✅ | lintas modul; lihat `_lintas-modul.md` |
| `getAll`/`saveAll` Reservasi (via cocok-bri.js) | bri (kas) | baca/tulis | kontrak `reservasi` | ⚠️ | menulis balik verifikasi DP; lihat §G |
| `getAll` (stock vendors) | bayar (kas), brankas (nama penerima) | baca | `GET /api/v1/stock/vendors` | ✅ | `docs/api/stock.md:22` |

Konkurensi: legacy omset/`saveAll` memakai `baseTs` → tolak bila `updated_at` bergerak (`{ok:false,konflik:true,ts,by}`) (`docs/modules/kompas.md:38-42`). v1: `PUT /kompas/state` wajib `If-Match`/`?version=` → `428`/`409` (`docs/api/kompas.md:56`); bagian granular ber-version sendiri (hash isi), jadi dua orang di hari berbeda tak konflik (`:41-49`). Kas Kecil: tabel `kk_*` tanpa kolom version → version = 16 hex pertama `sha1` dari nilai yang dilihat klien, kirim `If-Match`/`?version=`; `428 version_required`, `409 version_conflict` dengan `error.details.current`; tiap tulis dalam satu transaksi `SELECT … FOR UPDATE` (`docs/api/finance.md:71-73`). Brankas: satu version untuk seluruh blob (`updated_at` ms) (`:83`). Invoice: version = hash isi (`:134`).

Kode error yang wajib ditangani UI (`docs/api/finance.md:136-145`, `docs/api/kompas.md:129-137`): `401 unauthenticated`, `403 module_not_granted`/`forbidden`, `404 not_found`/`not_issued`, `409 version_conflict`/`already_exists`, `422 validation_failed`/`invalid_request` (pesan legacy: `Tanggal tidak sah.`, `Keterangan wajib diisi.`, `Nominal tidak boleh negatif.`, `Satu pos tidak boleh debet dan kredit sekaligus.`, `Pos yang sama dikirim dua kali.`, `Belum ada nominal di satu pos pun.`; kompas: `Setoran bernilai nol — tidak ada uang yang berpindah`), `428 version_required`.

## F. Aturan bisnis yang wajib dibawa
1. **Blob omset ditulis oleh DUA modul (omset + cashier) — wajib penjaga tulis-basi.** `saveAll` mengirim SELURUH state; tab basi yang menyimpan menghapus koreksi orang lain tanpa galat. Penjaganya `baseTs`; konflik DIBEDAKAN & TIDAK dicoba ulang; yang ditolak tidak dibuang. Bukti: `omset:887-1010`, `CLAUDE.md:11762-11820`.
2. **`baseTs` kosong dibiarkan lewat** (klien lama / urutan deploy), dan `BASE_TS` ikut disimpan bersama salinan lokal (`CACHE_KEY+'_ts'`). Bukti: `omset:911-913`, `:949-953`, `CLAUDE.md:11807-11815`.
3. **Toleransi selisih Rp5.000, dan submit TIDAK pernah dikunci.** Mengunci submit memaksa kasir mengarang angka. Bukti: `omset:761`, `:1622-1626`; `report` di `omset:1696-1706`.
4. **Saldo Brankas TIDAK PERNAH diketik** — dihitung dari Aktual Masuk Rekap Penjualan. Rumus `aktGrup` (kembar `rkHitung`): `kotor=Σ pay[k].actual`; `akt = aktual diketik ?? kotor − MDR`; tanpa MDR (cash/transfer/error) → `akt=kotor`. Bukti: `brankas:940-1016`, `:1018-1080`, `CLAUDE.md:130-133`.
5. **MDR bank/ojol yang tak dikenal DIBUANG DIAM-DIAM** (daftar `$grup`/`$bank` tertutup); penanda dilaporkan `takDikenal` tapi MDR hilang tanpa pesan. Metode baru harus didaftarkan di **5 tempat**. Bukti: `CLAUDE.md:146-165`, `kas:1872-1878`.
6. **MDR% penyebut = Aktual KOTOR kelompok yang kena MDR** (bukan aktual masuk, bukan seluruh setoran), dua desimal, kosong bila nol. Bukti: `CLAUDE.md:10783-10800`.
7. **Setoran cash boleh sebagian; baris LAMA tanpa `jumlah` = setoran PENUH; nominal dijepit server ke SISA hari** (bukan ke cash). Bukti: `kas:1944-1965`, `CLAUDE.md:236-260`.
8. **Pengakuan omset: Marketing = omset+tax+service (dipotong dari kasir shift); Event = 50% dari nilai event (kasir tidak dipotong); Open Bill diakui penuh (event)**. `menuFix` kosong diperlakukan seperti `tetap` (kasir dipotong) dan WAJIB disebut di pita. Bukti: `omset:3401-3410`, `kas:4470-4482`, `CLAUDE.md:702-772`.
9. **Baris Marketing bernominal tanpa kasir shift MENGHALANGI Simpan Breakdown** (kalau tidak, omset terhitung dua kali). Bukti: `omset:4072-4079`, `:4108-4112`.
10. **Compliment: yang memotong realisasi = `subTotal`** (bukan `nominal` = subTotal+tax+service); PIC Kasir langsung dipotong, PIC Pemberi menunggu persetujuan di Performa. Bukti: `omset:2565`, `:2472-2476`, `:2593-2597`.
11. **Jejak penginput MENUMPUK** (`log[]`, kata "Diinput"/"Disubmit"/"Diatur"), bukan menimpa; hari lama tidak diklaim siapa pun. Bukti: `omset:1732-1773`, `CLAUDE.md:2377-2395`.
12. **Jenis mutasi manual BUKAN "Setor"** — "Uang masuk dari luar (di luar omset harian)"; `pindah` = SATU baris. Bukti: `brankas:1408`, `CLAUDE.md:203-210`.
13. **Setoran cash dari Rekap Penjualan IKUT Riwayat Mutasi (dibaca, tidak disalin)** dan **tidak boleh** ikut dijumlahkan lagi di `saldoSemua` (brankas fisik berkurang dua kali). Bukti: `brankas:1391-1400`, `CLAUDE.md:189-200`.
14. **Planning Pembayaran: layar di Kas, data di Brankas.** Kas menulis lewat `bayarSave` (sempit), BUKAN `brankasSave`. `bayar` wajib tetap ada di kunci `brankas_simpan`. Bukti: `kas:7079`, `brankas:1540-1550`, `CLAUDE.md:375-410`.
15. **Piutang & Catatan Void diinput di SATU tempat** (Piutang → Cashier/Kompas, Void → Cashier); Brankas/Kas hanya membaca. Bukti: `brankas:1288-1292`, `kas:1757-1762`, `CLAUDE.md:10020-10027`.
16. **Kas TIDAK PERNAH menulis blob Kompas** — `save()` dilumpuhkan (localStorage saja); tulisan lewat `simpanRekap` sempit. Bukti: `kas:1402-1412`, `CLAUDE.md:11728-11733`.
17. **Pengembalian modal wajib menyebut wadah `dari`**; yang menggantung dilaporkan (bukan ditebak), agar saldo tidak lebih besar dari kenyataan. Bukti: `brankas:1085-1090`, `:1557-1564`.
18. **Kwitansi ditahan sampai dana masuk diverifikasi**; terbit butuh peringatan eksplisit bila DP belum lengkap; nomor diberikan sekali & tidak dipakai ulang. Bukti: `kas:6679-6720`, `docs/api/finance.md:109-111`.
19. **Metode pembayaran `PAYS` harus sama di kas, omset, DAN cashier** (satu objek `reports[tgl].pay`). Bukti: `omset:722-744`, `CLAUDE.md:182-190`.
20. **`RK_GRUP`/`aktGrup` adalah berkas kembar** kas ↔ brankas; satu rumus untuk satu angka. Bukti: `brankas:692-700`, `CLAUDE.md:130-131`.
21. **Kriteria barang rusak vs komplain (Void) + pengukuran error**: baris `error_*` (Error Bar/Customer/Floor/Kasir/Kitchen) adalah tempat selisih yang SUDAH diketahui sebabnya; ikut Total POS/Actual & toleransi Rp5.000. Bukti: `omset:700-721`.

## G. Ketergantungan lintas modul
- **Omset/Kas ↔ Cashier** — satu blob `app_state` (kompas) ditulis keduanya; metode `PAYS` harus sama; penjaga `baseTs` melindungi keduanya. Bukti: `omset:887-1010`, `CLAUDE.md:11762-11820`.
- **Kas → BD (`setRealisasi`)** — baris kas kecil yang berasal dari PO BD menulis balik `realisasi` (`PO_BD_URL`, `:5391`, `:5597-5603`); v1 `PUT /api/v1/bd/purchase-orders/{id}/realisasi`. Gagal → peringatan, tidak membatalkan kas.
- **Kas → Reservasi (`dp`)** — `<iframe src="../../reservasi/?embed=finance">`; pemegang `finance` dapat `effRole='cashier'` (bisa verifikasi/tolak DP). Bukti: `kas:6431-6440`, `CLAUDE.md:10872-10886`.
- **Kas `bri` → Reservasi** — `cocok-bri.js` membaca `getAll` reservasi & menulis balik verifikasi DP lewat `saveAll` reservasi. Bukti: `assets/cocok-bri.js:295,432`.
- **Kas performa → aset `deploy/assets/performa-bonus.js`** — mesin bonus Marketing/Event dipakai juga oleh modul Marketing & Event. Bukti: `kas:4412-4416`, `:4385-4388`, `performa-bonus.js:105,311,699`.
- **Kas bri → aset `deploy/assets/cocok-bri.js`** (juga dipakai Cashier). Bukti: `kas:6469-6483`.
- **Brankas → Kompas** — membaca blob omset (`brankasGet` setoran + `getAll` piutang/rekap) untuk Saldo & Mutasi & Ringkasan. Bukti: `brankas:879-905`, `:1018-1080`.
- **Brankas → Stock (Purchasing)** — master vendor `stock-api-mysql/vendors.php` untuk nama penerima & nomor rekening di Planning Pembayaran. Bukti: `brankas:638`, `:898-905`; `kas:5391`.
- **Brankas → Account** — roster `listModuleRoster{module:'brankas'}`. Bukti: `brankas:1657`.
- **Omset/Kas → Account** — `listDivisiRoster` (PIC compliment/piutang/kasir), `listModuleRoster{module:'kompas'|'finance'}` (Kelola Akses). Bukti: `omset:2267`, `:4301`; `kas:3167`, `:4807`.
- **Kompas → Brankas (Finance)** — halaman investor Kompas membaca vault via `Brankas::read()`/`brankasGet`. Bukti: `docs/modules/README.md:42`, `docs/modules/finance.md:76`.
- **Analytics/Ranking (jika ada di Vue) → blob Kompas** — dibaca dari `db_api`. (Di modul ini, `analytics` read-only dari blob.)
- **Aset bersama lain yang dipakai modul ini:** `cocok-bri.js`, `performa-bonus.js` (lihat §A). `deploy/assets/*.js` lain tidak dipakai.

## H. Catatan untuk implementasi Vue
- Halaman: `app/pages/finance/index.vue` (pemilih 3 panel, `definePageMeta({access:['kompas','finance','brankas']})`), lalu
  - `services/omset/*`: `omset/index.vue` (input), `omset/report.vue`, `omset/piutang.vue`, `omset/compliment.vue`, `omset/breakdown.vue`, `omset/akses.vue` (`access:['kompas']`).
  - `services/kas/*`: `kas/index.vue` (Buku Kas), `kas/input.vue`, `kas/pos.vue`, `kas/bayar.vue`, `kas/rekap.vue`, `kas/dp.vue`, `kas/bri.vue`, `kas/invoice.vue`, `kas/void.vue`, `kas/dashboard.vue`, `kas/analytics.vue`, `kas/performa-marketing.vue`, `kas/performa-event.vue`, `kas/performa-kasir.vue`, `kas/akses.vue` (`access:['finance']`).
  - `services/brankas/*`: `brankas/index.vue` (Ringkasan), `brankas/saldo.vue`, `brankas/mutasi.vue`, `brankas/pending.vue`, `brankas/modal.vue`, `brankas/pengaturan.vue`, `brankas/akses.vue` (`access:['brankas']`).
  - `kompas` → redirect `/finance/omset` (route `redirect`), `finance/rekap` → `/finance/kas#rekap`.
- Composable `useFinance.ts` / `useKompas.ts` / `useBrankas.ts`: `getState`; `kkState`→`GET /finance/petty-cash`; transaksi `createTransaction/updateTransaction/markTransaction/deleteTransaction`; `sources`/`categories` CRUD; `access`/`putMatrix`/`putRole`; `paymentPlan`; `vault` per-list CRUD + `setting`; `invoices` (`index`,`queue`,`show`,`decide`,`settings`,`signatories`); `kompasState`/`putState`/`putPart` (sections/reports/days), `putRekap`, `daily`, `omsetPic`, `performa`; `voids`; `bri` (+ port mesin `cocok-bri.js` ke composable/`utils`); `analytics`; `invoices.request/status/file`.
- HP vs desktop: tabel Rekap/Buku Kas/Analytics/Performa/Daftar Bon → `AppList` di HP, `UTable` (`lg+`) di desktop; form Input/Transaksi/Piutang/Compliment/Mutasi/Modal/Investor → `ResponsiveSheet`; breakdown = satu `AppFocus` per section A/B/C.
- Widget Beranda yang cocok: "Realisasi bulan berjalan" (Dashboard Omset), "Total Kas Likuid + Runway" (Brankas Ringkasan), "Kewajiban 30 Hari", "Lencana invoice menunggu".
- Elemen lama yang melanggar DESIGN.md → padanannya:
  - Kartu angka besar ber-emoji (`📅 Pencapaian Bulan Berjalan`, `📱 Self Order`, `🧾 UPT`, `💳 ATV`) → `AppList` + `AppFocus`, ikon Lucide, sentence case.
  - Gradien emas pada mark/avatar pemilih (`finance/index.html:38,42,58,69`; `kompas/index.html:39`) dan kartu investor Brankas → `bg-default` flat.
  - `alert()`/`confirm()` native (semua validasi) → `ResponsiveSheet` + `apiErrorMessage`.
  - Badge berwarna penuh (`chip ok/warn/bad`) → `AppStatus` (titik + kata).
  - Chart.js dari CDN → komponen chart Nuxt UI (perlu cek izin dependency).
- Sinkronisasi: hilangkan `localStorage`/`saveAll`; tulis per-record dengan `If-Match`; tampilkan `version_conflict` dengan ajakan "catat dulu, jangan muat ulang".
- **Jangan hidupkan `save()`/`apiSave()` Kas** — sengaja mati; Risiko bug yang sama (`CLAUDE.md:11728`).

## I. Pertanyaan terbuka
- [ ] **finance / kas → Planning Pembayaran — saldo wallet** — legacy Kas Kecil (module `finance`) menghitung saldo wallet dari `brankasGet`; v1 `/finance/vault` digated module `brankas` dan Kas hanya dapat `/petty-cash/payment-plan` (tanpa saldo). Konteks: user memutuskan (2 Sep 2026) pemegang Kas boleh melihat saldo rekening; kontrak v1 menutupnya lagi. Bukti: `kas:7057-7070`, `laksamana-api/docs/api/finance.md:25,98-103`, `laksamana-api/app/Modules/Finance/routes/v1.php` (prefix `module:brankas`). Opsi: A) Vue hanya tampilkan plan tanpa saldo; B) tambah endpoint saldo ringkas ber-module `finance`; C) minta pemegang Kas Kecil juga diberi modul `brankas`.
- [ ] **finance / omset + kas — metode pembayaran baru** — v1 `$bank`/`$grup` server tertutup; menambah metode di UI tanpa sinkron server membuat MDR dibuang diam-diam & penanda `takDikenal`. Perlu daftar tertutup di v1? Bukti: `CLAUDE.md:146-165`, `laksamana-api/docs/api/kompas.md:68`. Opsi: A) UI membatasi pilihan ke daftar server; B) server mengembalikan daftar yang dikenal; C) biarkan dan andalkan pesan `takDikenal`.
- [ ] **finance / kas — void tulis di Vue?** — Laporan Void legacy di Kas hanya BACA; v1 punya `POST /kompas/voids` (module cashier atau finance). Apakah input void tetap hanya di Cashier, atau Finance boleh mengoreksi? Bukti: `kas:1757-1762`, `CLAUDE.md:10020-10027`, `laksamana-api/docs/api/kompas.md:89`. Opsi: A) read-only di Finance (legacy); B) buka tulis untuk Finance.
- [ ] **finance / omset + kas — pembanding POS Void (`analyticsGet`)** — v1 `/kompas/analytics` modul `analytics`, sedangkan layar Void Kas memakainya untuk kartu "Pembanding POS". Apakah pemegang `finance` boleh membacanya? Bukti: `kas:1620-1640`, `laksamana-api/docs/api/kompas.md:125`. Opsi: A) sembunyikan kartu bila tanpa modul `analytics`; B) beri baca ringan untuk finance.
- [ ] **finance / diagnostics `ping`/`stats`** — legacy finance & kompas punya `ping`/`stats`; v1 tidak merutekannya. Perlukah? Bukti: `laksamana-api/docs/modules/finance.md:43`, `laksamana-api/docs/modules/kompas.md:98`. Opsi: A) pakai `GET /stats` bila ada; B) tambah endpoint; C) tidak perlu.
- [ ] **finance / kas — `dp` embed** — legacy memuat halaman Reservasi dalam `<iframe>`; di Vue Nuxt SPA, apakah halaman DP dipindah menjadi halaman Reservasi asli (bukan embed) dan dibuka lintas modul? Bukti: `kas:6429-6440`, `CLAUDE.md:10872-10886`. Opsi: A) route Reservasi asli di Nuxt; B) iframe tetap; C) composable DP khusus.

## J. Progres build
Branch: migrasi/finance-omset (#38) · migrasi/finance-input (#39, sub-issue 2/4) · Mulai: 2026-10-07
LANJUTKAN DARI: #40 kas (15 layar), lalu #41 brankas (7 layar).

| layar (key) | file | status | endpoint dipakai | ditunda karena |
|---|---|---|---|---|
| pemilih panel | `app/pages/finance/index.vue` | ✅ | — (kartu panel; auto-redirect bila satu panel) | — |
| omset/report | `app/pages/finance/omset/report.vue` + `app/components/KompasReport.vue` | ✅ | `GET/PUT /kompas/reports/{date}`, `GET /kompas/sections/piutang` | — |
| omset/piutang | `app/pages/finance/omset/piutang.vue` + `KompasPiutang.vue` | ✅ | `GET/PUT /kompas/sections/piutang`, `/owners`, `GET /account/roster` | — |
| omset/compliment | `app/pages/finance/omset/compliment.vue` + `KompasCompliment.vue` | ✅ | `GET/PUT /kompas/sections/compliments`, `GET /kompas/reports/{date}`, roster | — |
| omset/input | `app/pages/finance/omset/input.vue` | ✅ | `GET/PUT /kompas/days/{date}`, `GET /kompas/reports/{date}`, `/sections/piutang`, `GET /kompas/state` (pencapaian bulan) | — |
| omset/breakdown | `app/pages/finance/omset/breakdown.vue` | ✅ | `GET/PUT /kompas/days/{date}`, `GET /kompas/state` (`employees`, `compliments`) | baris otomatis dari modul Marketing/Event (deal, VIP Assisted, event internal) menyusul saat modulnya ada; ditambah manual |
| omset/akses | `app/pages/finance/omset/akses.vue` | ✅ | `GET /account/modules/kompas/members` | — |
| kas/* (15 layar) | — | ⬜ | | #40 |
| brankas/* (7 layar) | — | ⬜ | | #41 |

Catatan build #38:
- **Ekstraksi panel bersama.** Report Daily, Piutang, dan Compliment sekarang komponen `KompasReport`/`KompasPiutang`/
  `KompasCompliment` (`app/components/`), dipakai Cashier DAN Finance › Omset; halaman Cashier menjadi pembungkus tipis.
  Objek blob-nya memang satu (`reports[date]`, `piutang`, `compliments`) — dua salinan pasti menyimpang (F.19). Tiap
  halaman memberi kunci `useAsyncData` sendiri lewat prop `kunci`, jadi cache dua halaman tidak saling bocor.
- Launcher `finance/index.vue`: hanya panel yang berhak tampil; panel yang belum dibangun ditandai **"Segera"** (tidak
  redirect ke halaman kosong). Auto-redirect hanya bila user punya SATU panel dan halamannya sudah ada.
- Shell `// ── finance ──` + `app/utils/layar/finance.ts`; tiap layar menyatakan kuncinya lewat `boleh`
  (`kompas`/`finance`/`brankas`), jadi pemegang satu panel tidak melihat menu panel lain. Kunci layar diberi awalan
  `omset_` karena tiga dokumen lama memakai kunci view yang sama.
- Halaman pengalih URL lama (`kompas/`, `finance/rekap/`) TIDAK dibawa di SPA — URL lamanya tetap berlaku selama
  aplikasi lama hidup; dicatat di komentar #14.
- Cek visual 2026-10-07 (mock `mock-api-cashier.mjs` 4013, tulis 403) sebagai `finance` (3 kunci) & `kasir`:
  omset report/piutang/compliment/akses dan cashier report/piutang/compliment di 1366px & 390px overflow 0, console
  bersih; launcher menampilkan 3 kartu (2 "Segera"), sidebar hanya memuat menu panel yang berhak.
- `npm run lint && npm run typecheck && npm run build` hijau; uji mesin (cashier/porsi-pic/bri) tidak tersentuh.

Catatan build #39 (input + breakdown):
- `app/utils/kompas.ts` — **satu sumber** turunan baris harian: `grossOf`/`netOf`/`taxSvcOf`/`tagihanOf`/`avgSpendOf`/`itemsOf` + validasi `saveDaily` (`validasiHarian`). Dipakai Omset sekarang, Kas/Brankas menyusul; dijaga `npm run uji:kompas` (13 pemeriksaan; rumus lama dicek di sumber Office lama).
- **K-04 di sisi potongan**: `porsi-pic.ts` kini juga mengekspor `potongKasirKompas`/`potonganBarisKompas`/`potonganHariKompas` — versi Omset/Kas memotong kolom **Omset penuh**, sedangkan Cashier membelah baris free-entry. Dua jawaban berbeda untuk baris yang sama, keduanya diuji (`uji:porsi-pic` 29 OK) supaya tidak ada yang menyatukan.
- `omset/input.vue`: hari lahir di sini; validasi lama (negatif, pendapatan kosong, diskon > gross, traffic ≥ bill); **gerbang selisih Report Daily tidak ada** (dihapus 4 Agu 2026 di Office lama) — selisih ditampilkan berikut koreksi bon; "Pencapaian bulan berjalan" memakai dasar **tagihan** (kembar Dashboard Omset), hari yang diketik menggantikan salinan tersimpan; hapus hari ikut menghapus breakdown (dengan konfirmasi).
- `omset/breakdown.vue`: Section A kasir (bruto − diskon), Self Order, Section B marketing (potong kasir shift, `menuFix`/`payGroup`/Open Bill), Section C event (50% + OB penuh, kasir tidak dipotong); gate simpan = balance && baris marketing bernominal punya shift; peringatan diskon & PIC kosong; kartu Efek ke Realisasi; konfirmasi simpan + jejak `bdLog`. Baris `abaikan` dibawa apa adanya.
- **Ditunda (dicatat):** baris otomatis dari modul Marketing/Event (deal, Reservasi VIP Assisted, event internal) + suntingan `abaikan`-nya — modul asalnya belum bermigrasi; baris ditambah manual dengan pita pemberitahuan di layar. Disunting ulang saat modul Marketing/Event dibangun.
- Cek visual 2026-10-07 (mock `mock-api-cashier.mjs` 4013, tulis 403): `finance/omset/input?tgl=2026-10-01` (net Rp4.900.000, service+tax Rp210.000, setoran & selisih) dan `breakdown?tgl=2026-10-01` (total diakui = net, potongan GIG Rp200.000 ke shift, efek Sari Rp4.700.000, peringatan PIC, "Valid, siap disimpan") di 1366 & 390 overflow 0, console bersih; `PUT /kompas/days/2026-10-01` ditolak 403 tanpa crash.

## Konsolidasi untuk README & berkas bersama
- Baris README: `| finance | [finance.md](finance.md) | ⚠️ selesai dengan celah | 29 (1 pemilih + 6 omset + 15 kas + 7 brankas) + 2 pengalih | 2 ❌ · 5 ⚠️ | 6 | omset/kas/brankas/rekap + kompas |`
- `_pertanyaan.md` (bullet, format baku):
  - `- [ ] **finance / kas → Planning Pembayaran — saldo wallet** — v1 `/finance/vault` digated module `brankas` sehingga Kas Kecil (module `finance`) tak bisa menghitung saldo wallet seperti legacy. Bukti: `laksamana-office/deploy/finance/kas/index.html:7057-7070`; `laksamana-api/docs/api/finance.md:25,98-103`. Opsi: A) tampilkan plan tanpa saldo; B) endpoint saldo ringkas ber-module `finance`; C) pemegang Kas diberi modul `brankas`.`
  - `- [ ] **finance / omset + kas — daftar metode pembayaran tertutup** — MDR untuk bank/ojol yang tak terdaftar di `$bank`/`$grup` v1 dibuang diam-diam. Bukti: `laksamana-office/CLAUDE.md:146-165`; `laksamana-api/docs/api/kompas.md:68`. Opsi: A) UI pakai daftar server; B) endpoint daftar; C) andalkan pesan `takDikenal`.`
  - `- [ ] **finance / kas — Void: baca atau tulis?** — legacy read-only, v1 punya `POST /kompas/voids` untuk finance. Bukti: `laksamana-office/deploy/finance/kas/index.html:1757-1762`; `laksamana-api/docs/api/kompas.md:89`. Opsi: A) read-only; B) buka tulis.`
  - `- [ ] **finance / kas — Pembanding POS Void** — kartu memakai `/kompas/analytics` (modul `analytics`). Bukti: `laksamana-office/deploy/finance/kas/index.html:1620-1640`; `laksamana-api/docs/api/kompas.md:125`. Opsi: A) sembunyikan bila tanpa modul; B) izin baca untuk finance.`
  - `- [ ] **finance + kompas — diagnostik `ping`/`stats`** — v1 tak merutekannya. Bukti: `laksamana-api/docs/modules/finance.md:43`; `laksamana-api/docs/modules/kompas.md:98`. Opsi: A) `GET /stats`; B) tambah endpoint; C) tak perlu.`
  - `- [ ] **finance / kas — halaman DP (embed Reservasi)** — di Vue SPA, apakah jadi route Reservasi asli? Bukti: `laksamana-office/deploy/finance/kas/index.html:6429-6440`. Opsi: A) route Reservasi asli; B) iframe; C) composable DP.`
- `_lintas-modul.md` (baris tambahan):
  - `- **Finance › Kas → BD (VERIFIED)**: \`setRealisasi\` (\`deploy/finance/kas/index.html:5391\`,\`:5597-5603\`; v1 \`PUT /api/v1/bd/purchase-orders/{id}/realisasi\`) menulis \`realisasi\` + penanda proses ke baris PO; gagal → peringatan, kas tetap tersimpan.`
  - `- **Kompas → Brankas Finance (VERIFIED)**: investor Kompas membaca vault via \`Brankas::read()\` / legacy \`brankasGet\` (\`laksamana-api/docs/modules/README.md:42\`, \`docs/modules/finance.md:76\`).`
  - `- **Finance › Kas → Reservasi (DP)**: halaman \`dp\` = \`<iframe src="../../reservasi/?embed=finance">\`; pemegang \`finance\` masuk dengan hak kasir (verifikasi/tolak) (\`deploy/finance/kas/index.html:6431-6440\`; \`CLAUDE.md:10872-10886\`).`
  - `- **Finance › Kas ↔ Cashier (blob omset bersama)**: \`omset/\` dan \`cashier/\` menulis SATU baris \`app_state\`; penjaga \`baseTs\` (v1 \`If-Match\` di \`PUT /kompas/state\`) (\`omset:887-1010\`; \`CLAUDE.md:11762-11820\`).`
  - `- **Aset bersama \`deploy/assets/performa-bonus.js\`** dipakai \`deploy/finance/kas/\` (Performa Marketing/Event) DAN modul Marketing & Event (\`kas:4385-4388\`). **\`deploy/assets/cocok-bri.js\`** dipakai \`deploy/finance/kas/\` DAN Cashier (\`kas:6469-6483\`). Keduanya wajib dipindah apa adanya ke satu sumber Vue.`
  - `- **Finance › Brankas → Stock/Purchasing**: master vendor \`stock-api-mysql/vendors.php\` dibaca untuk nama penerima & nomor rekening (\`brankas:638,898-905\`; v1 \`GET /api/v1/stock/vendors\`).`
  - `- **Finance › Brankas → Cashier/Kompas**: Piutang & setoran cash dibaca, tidak disalin — \`KP.piutang\`, \`KP.rekap_setoran\` (\`brankas:1018-1080,1293-1296\`).`
