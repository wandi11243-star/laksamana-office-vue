# Investor Compass — inventaris migrasi

Status: ✅ selesai (inventaris ringkas — lihat §4.14 & §6: hanya bagian A, B, C, H)
Terakhir diperbarui: 2026-09-29

## Ringkasan
- Jumlah layar: 6 (1 layar masuk + 5 tab) · Aksi backend lama: 6 action (`login`, `logout`, `investorRingkas`, `investorAgenda`, `investorLaporUpload`, `investorLaporFile`, `investorLaporHapus` = 7 termasuk logout) · Gap v1: 0 ❌ (1 ⚠️, lihat catatan)
- Investor Compass adalah halaman khusus investor: omset harian/bulanan, capaian target, perbandingan tahun ke tahun, laba rugi, dividen dari Brankas Finance, serta agenda Event & Promo BD. Angkanya **sudah dijumlahkan** dari satu peta harian omset.
- **Satu berkas HTML melayani DUA domain** (`investor.laksamanamuda.id` dan dev-nya), dan **bukan** di bawah `deploy/` — punya alamat Office sendiri, workflow deploy sendiri (`CLAUDE.md:11127-11189,11250-11257`).
- Penggunanya investor (akun Office yang sama, nama/username + PIN) yang memegang kunci modul `investor`. Risiko migrasi terbesar: **konvensi tiga omset** (`net`/`tagihan`/`netSales`) — halaman investor memakai `netSales` **seragam** di seluruh tab Ringkasan (`CLAUDE.md:11234-11247`); serta membedakan pagar baca (`sesi_punya_modul`) vs pagar unggah/hapus (`sesi_admin_modul`).
- **KOREKSI terhadap peta tugas:** `investor` **BUKAN** "? ? / ?" dan **bukan** "tidak memanggil API mana pun". Kini ia memanggil `account-api` (login/logout) dan `kompas-api` (investorRingkas/Agenda/Lapor*) secara berpagar; yang benar-benar tanpa backend adalah `help`. Bukti: `investor/index.html:674,707,731,1141,1650,1686,1713`; `CLAUDE.md:11140-11141` (komentar lama "TIDAK punya backend" sudah usang).

## A. Sumber
| jenis | path | baris |
|---|---|---|
| frontend lama | `laksamana-office/investor/index.html` | 1.736 |
| backend lama (dua backend) | `account-api-mysql/api.php` + `kompas-mysql/api.php` | `investor/index.html:578-579` |
| backend lama (aksi investor) | `laksamana-office/kompas-mysql/api.php` (`investorRingkas/Agenda/LaporUpload/LaporHapus/LaporFile`) | 144-256 |
| backend lama (tabel laporan) | tabel `inv_lapor`, kunci UNIK `(bulan, jenis)`; binernya di disk (`inv_lapor_dir()`) | `CLAUDE.md:11305-11315` |
| kontrak v1 | `laksamana-api/docs/api/kompas.md` | 35, 108-119 |
| kontrak v1 (login) | `laksamana-api/docs/api/account.md` | 35 |
| rute v1 | `laksamana-api/app/Modules/Kompas/routes/v1.php` | 38-43 |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:11127-11189` "Dua situs yang TIDAK di bawah `deploy/`" | 11127 |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:11190-11257` "Investor Compass: SSO Office, dan tidak satu pun angka contoh" | 11190 |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:11300-11390` (lanjutan: tiga omset, PDF bulanan, Laba Rugi) | 11300 |
| catatan CLAUDE.md lama | `laksamana-office/CLAUDE.md:11574` "Helper bersama yang sudah ada — pakai ini" | 11574 |

Kontrak v1 yang setara (dari `docs/api/kompas.md`):
| aksi lama | endpoint v1 | catatan |
|---|---|---|
| `login` / `logout` (`account-api`) | `POST /api/v1/auth/login`, `auth/logout` (`account.md:19,35`) | ✅ |
| `investorRingkas` | `GET /api/v1/kompas/investor/summary` (`kompas.md:114`) | ✅ angka sudah dijumlahkan; `meta.canUpload` = admin investor |
| `investorAgenda` | `GET /api/v1/kompas/investor/agenda` (`kompas.md:115`) | ✅ gabungan Event + Marketing + Promo BD; `gagal` menyebut modul yang tak terbaca |
| `investorLaporFile` | `GET /api/v1/kompas/investor/reports/{YYYY-MM}/{balance\|ledger}` (`kompas.md:117`) | ⚠️ v1 mengembalikan **biner PDF**, legacy balas JSON (`dataBase64`) |
| `investorLaporUpload` | `PUT /api/v1/kompas/investor/reports/{YYYY-MM}/{balance\|ledger}` (`kompas.md:118`) | ✅ admin investor; PDF ≤12 MB diperiksa dari isi `%PDF` |
| `investorLaporHapus` | `DELETE /api/v1/kompas/investor/reports/{YYYY-MM}/{balance\|ledger}` (`kompas.md:119`) | ✅ admin investor |

## B. Akses
- Kunci Modul di launcher: `investor` — `BRANCHES[].key:'investor'`, `access:['investor']`, judul **Investor Compass**, tag **Ruang Investor**, grup `bisnis` (`laksamana-office/deploy/index.html:1195-1201`). **Kartunya wajib ada** supaya `syncModules` mendaftarkan kuncinya ke Kelola Akses (`deploy/index.html:1186-1194`; sudah pernah kejadian kotak centangnya tak muncul).
- Berkas berdiri di domain sendiri: `href` dipilih menurut host (`dev.`/localhost → `https://dev.investor.laksamanamuda.id/`, selain itu `https://investor.laksamanamuda.id/`) (`deploy/index.html:1196-1199`).
- Gate di frontend: sesi **sendiri** di `localStorage['lm_investor_sesi']` (sengaja BUKAN `lm_session` — beda domain) (`investor/index.html:582,654-664`); login lewat `account-api?action=login`), lalu `modules` harus memuat `'*'` atau `'investor'` (`:667-697`). Pesan bila belum diberi akses: `'Akun Anda belum diberi akses. Minta admin mencentang <b>Investor Compass</b> lewat Kelola Akses di Laksamana Office.'` (`:689`). Pesan login gagal: `'Nama atau PIN salah.'` / `'Tidak bisa masuk. Coba lagi sebentar lagi.'` (`:676`).
- Gate sebenarnya tetap di server: `investorRingkas`/`investorAgenda`/`investorLaporFile` menolak tanpa `sesi_punya_modul($u,'investor')` (`kompas-mysql/api.php:148,171,226`); unggah/hapus menuntut `sesi_admin_modul($u,'investor')` (`:185,209`). `bolehUnggah` **dihitung server** dan ikut di balasan (`:156`).
- Role / matriks izin di dalam modul: **tidak ada** (hanya pagar baca vs pagar admin). Aksi khusus admin: unggah & hapus laporan PDF (`CLAUDE.md:11319-11324`).
- Komentar penting: komentar "TIDAK punya backend" di `CLAUDE.md:11140-11141` sudah **tidak lagi benar** — bukti panggilan API di `investor/index.html:674-731`.
- Keluar: `logout()` menghapus sesi lokal + `POST account-api {action:'logout', token}` (`investor/index.html:699-714`).

## C. Daftar layar
Tab: `TABS` (`investor/index.html:792-798`), markup tab `:470,506,514,535,543`, dispatcher `switchTab()` (`:808-824`), render per tab `render()` (`:826-836`).

| key | judul | subjudul / grup | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| (login) | — (form masuk) | label field: "Nama atau username" + "PIN"; tombol "Masuk" | siapa pun; lolos hanya pemegang `investor` | tidak | `investor/index.html:433-443,668-696` |
| ringkasan | Ringkasan | "Omset harian dan bulanan, capaian target, dan perbandingan tahun ke tahun" (grup **Kinerja**) | pemegang `investor` | tidak (aktif default) | `:470-503`, `:793` |
| laporan | Laporan Laba Rugi | "Susunan yang sama dengan Profit Loss Report bulanan" (grup **Kinerja**); berisi Laba Rugi + "Laporan Akuntansi Bulanan" (PDF) | pemegang `investor` | tidak | `:514-534`, `:794`,`:1503-1640` |
| dividen | Dividen | "Riwayat dividen yang sudah dibagikan" (grup **Investasi**) | pemegang `investor` | tidak | `:506-513`, `:795` |
| event | Upcoming Event | "Acara terjadwal dari modul Marketing & Event" (grup **Agenda**) | pemegang `investor` | tidak | `:535-542`, `:796` |
| promo | Promo | "Yang sedang berjalan dan yang akan datang, dari modul BD OS" (grup **Agenda**) | pemegang `investor` | tidak | `:543-551`, `:797` |

Catatan: tab **"Desain Buku"** dan blok **"Yang Baru & Akan Launching"** DIHAPUS 27 Agustus 2026; tab "Program & Event" lama kini bernama "Upcoming Event" isi agenda saja (`:531-534`; `CLAUDE.md:11260-11264`). Bagian grafik **"Omset Harian"** DICABUT dari dashboard 29 Agustus 2026 (data `harian` tetap dipakai Sorotan) (`:483-495`; `CLAUDE.md:11259-11262`).

## H. Catatan untuk implementasi Vue
- Halaman: `app/pages/investor/index.vue` (Ringkasan) + `investor/laporan.vue`, `investor/dividen.vue`, `investor/event.vue`, `investor/promo.vue`, `investor/masuk.vue`. `definePageMeta({ access: ['investor'] })`. Karena situsnya **domain sendiri**, pastikan base API & token benar; jangan pakai sesi Office`lm_session` lintas-origin.
- Composable `useInvestor.ts` (fungsi → endpoint):
  - `login(login, pin)` → `POST /api/v1/auth/login`; simpan token lewat `useToken()`.
  - `getSummary()` → `GET /api/v1/kompas/investor/summary` (berisi `tahunan`, `harian`, `labaRugi`, `lapor`, `dividen`, `terakhir`, `adaData`, `meta.canUpload`) (`kompas.md:114`).
  - `getAgenda()` → `GET /api/v1/kompas/investor/agenda`; tangani `gagal` (modul yang tak terbaca) dengan pita peringatan.
  - `getReports()` → `GET /api/v1/kompas/investor/reports`; `getReport(bulan, jenis)` → `GET .../reports/{bulan}/{jenis}` (biner PDF); `uploadReports(bulan, files)` → `PUT .../{bulan}/{balance|ledger}` (admin, PDF ≤12 MB, **isi** harus diawali `%PDF`); `deleteReport(bulan, jenis)` → `DELETE` (admin).
- Wajib dibawa: **hanya `netSales`** dipakai di seluruh tab Ringkasan (kartu, grafik tahunan, grafik harian, sorotan, rata-rata per transaksi, persentase target) agar seragam (`CLAUDE.md:11244-11247`); baris keterangan di bawah kartu menyebut service, pajak, compliment **dan angka tagihan POS utuh** (`CLAUDE.md:11249-11255`), tidak digambar bila ketiganya nol. Angka uang **selalu penuh** (`rp()`), bentuk singkat hanya untuk sumbu Y grafik (`rpSumbu()`) (`investor/index.html:600-615`).
- Laba Rugi: hanya blok Pendapatan bersumber; baris COGS/Opex/Other/Depreciation tetap digambar bertanda **"belum ada inputnya"** (`CLAUDE.md:11336-11341`). Urutan & nama baris disalin persis dari laporan CFO.
- Laporan PDF: daftar **satu bulan** dipilih lewat penyaring (bukan 12 kartu menumpuk); satu unggah untuk **kedua** berkas; sesudah unggah penyaring pindah ke bulan yang barusan diunggah; unggah ulang **mengganti** (kunci UNIK bulan+jenis); berkas lama dihapus sesudah yang baru berhasil ditulis; kegagalan satu berkas menyebut namanya dan yang berhasil tetap tersimpan (`CLAUDE.md:11289-11330`).
- Kewalahan `labaRugi` hilang = backend lama: tampilkan pesan yang menyebut backend versi lama (`investor/index.html:1049-1058`).
- Real-time: tidak ada polling; agenda dimuat malas saat tab Event/Promo dibuka (satu `investorAgenda` memicu tiga pembacaan server-ke-server, `:817-824`).
- HP vs desktop: grafik & daftar KPI → `AppList` + satu `AppFocus` (mis. kartu Omset bulan ini); `UTable` hanya `lg+` untuk daftar laporan; form unggah PDF lewat `ResponsiveSheet`.
- Widget Beranda yang cocok: **tidak ada** (modul ini bukan bagian Beranda Office) — kecuali kartu launcher.
- Elemen lama yang melanggar DESIGN.md → padanannya: **grid `kpis` berisi angka raksasa** (`:477`) → `AppFocus` + `AppList`; **emoji sebagai ikon** (`📗`,`📘`,`💰`,`⏳`, `:1520-1521`) → Lucide; **gradien/aksen warna** → token `main.css`; huruf kapital label → sentence case.

## Konsolidasi untuk README & berkas bersama
Baris README:
`| investor | [investor.md](investor.md) | ✅ selesai (ringkas) | 6 (1 masuk + 5 tab) | 0 ❌ · 1 ⚠️ | 0 | KOREKSI: di domain sendiri, kini memakai backend Kompas+Account (bukan "? ?"); buka di Kartu launcher |`

Baris `_lintas-modul.md` (tambahkan):
- **Investor ← Kompas (omset & laporan) & Account (SSO):** gerbang baca `sesi_punya_modul($u,'investor')`, gerbang unggah/hapus `sesi_admin_modul($u,'investor')` (`kompas-mysql/api.php:148,171,185,209,226`). v1: `GET /kompas/investor/summary`, `/agenda`, `/reports*` + `POST /auth/login` (`docs/api/kompas.md:108-119`). Angka investor = `netSales` (tagihan − compliment), **bukan** `net`/`tagihan` (`CLAUDE.md:11213-11247`). Lampiran agenda membaca Event + Marketing + Promo BD lewat satu `investorAgenda` (`CLAUDE.md:11270-11275`).
- **Kartu launcher `investor` wajib ada di `BRANCHES`** agar kuncinya terdaftar di Kelola Akses (`deploy/index.html:1186-1194`); tanpa itu tidak seorang pun bisa masuk tanpa galat.

Pertanyaan terbuka: **tidak ada** (⚠️ pada `investorLaporFile` adalah perbedaan bentuk biner vs base64 yang memang sudah jadi kontrak v1 — bukan celah; keputusan konvensi omset sudah ditetapkan owner).

## J. Progres build
Branch: migrasi/investor · Mulai: 2026-10-08
LANJUTKAN DARI: selesai build — tinggal cek visual di browser (1366 & 390, investor biasa & admin), push + PR oleh owner.

| layar (key) | file | status | endpoint dipakai | ditunda karena |
|---|---|---|---|---|
| masuk | app/pages/investor/masuk.vue | ✅ | POST /auth/login (lewat login() useMe) | — |
| ringkasan | app/pages/investor/index.vue | ✅ | GET /kompas/investor/summary | — |
| laporan | app/pages/investor/laporan.vue | ✅ | summary (labaRugi) + reports GET/PUT/DELETE | — |
| dividen | app/pages/investor/dividen.vue | ✅ | summary (dividen) | — |
| event | app/pages/investor/event.vue | ✅ | GET /kompas/investor/agenda | — |
| promo | app/pages/investor/promo.vue | ✅ | GET /kompas/investor/agenda | — |

Catatan build:
- Grafik "Omset per Bulan" digambar sebagai SVG tanpa dependensi baru (tidak ada chart lib di repo; `tesseract.js`/face-api satu-satunya yang diizinkan dan tidak relevan). Titik membawa `<title>` berangka penuh; sumbu Y memakai `rpSumbu()`.
- Tulisan PDF tidak memakai `ifMatch`/versi: kontrak (`kompas.md:118-119`) tidak mengenal versi untuk reports — tiap (bulan, jenis) diganti utuh oleh admin.
- Kalimat "Segera": tidak ada — seluruh 6 layar dibangun, tidak ada K/G yang memblokir.
- Cek headless yang dilakukan: `lint` + `typecheck` + `build` hijau; 12 uji logika `app/utils/investor.ts` lolos; mock read-only port 4013 (semua tulisan 403) + dev 3013, keenam halaman HTTP 200, apiBase terbukti `127.0.0.1:4013`.
- Belum dilakukan: cek visual di browser sungguhan (tidak ada browser di device ini) — 1366px & 390px sebagai investor biasa & admin investor, termasuk form unggah PDF dan sheet konfirmasi hapus.
- Perbaikan Fase 3 (2026-10-08, diuji ke API lokal, Admin + jebe):
  - Daftar PDF langsung disegarkan dari server sesudah unggah/hapus (akar: `useAsyncData` menyimpan payload di shallow ref — mutasi `data.lapor` di tempat tak pernah me-render ulang; kini seluruh `value` diganti dari `GET reports`).
  - Pil tahun grafik dikunci eksplisit bila tinggal satu yang tampil (`disabled` + alasan + catatan "dikunci sampai ada data tahun lain") — mematikannya hanya akan mengosongkan grafik.
  - Baris kartu Omset kini bertingkat blok — segmen delta & target tak lagi menyambung saat wrap (1366 & 390).
  - Validasi berkas pindah ke dalam loop per berkas — Balance valid tetap tersimpan walau Ledger `.txt`; tiap kegagalan menyebut nama berkasnya.
- Sinkron Office 5–9 Okt 2026 — VUE-8 per investor (2026-10-10, branch `feat/investor-per-investor`, butuh API-1 ✅ di `laksamana-api@eb69036`).
  Sumber Office lama: commit `3d5d368` (`investor/index.html` `renderDividen`). `dividen.vue` memakai
  penanda `semua` dari API: admin (`semua: true`) melihat tabel Per Investor (Modal Masuk /
  Dikembalikan / Sisa / % / Akun terhubung); investor biasa hanya modal & dividennya sendiri.
  Akun belum terhubung (`semua: false` + `per` kosong) dibedakan dari belum ada pembagian.
  Tipe `InvestorDividen` di `useInvestor.ts` ditambah `per[]`, `semua`, `jumlahSemua`.

## K. Daftar uji cutover

1. Buka `/investor/masuk`, masuk dengan nama + PIN — mendarat di Ringkasan; angka sama dengan Investor Compass lama bulan berjalan.
2. Masuk dengan akun Office tanpa kunci `investor` — tampil "Akun Anda belum diberi akses. Minta admin mencentang Investor Compass lewat Kelola Akses di Laksamana Office." (pesan persis).
3. Ringkasan: kartu Omset memakai netSales; baris keterangan service/pajak/compliment + tagihan POS cocok dengan Rekap Penjualan; baris hilang bila ketiganya nol; delta rata-rata/hari vs bulan lalu hilang bila bulan lalu < 7 hari terisi.
4. Ringkasan: grafik Omset per Bulan bisa menyalakan/mematikan tahun; tooltip titik berangka penuh; Sorotan menyebut hari terbaik + rata-rata bulan berjalan.
5. Laporan: pilih bulan — blok Pendapatan cocok dengan Profit Loss Report CFO; baris beban bertanda "belum ada inputnya"; ada nota "Net Sales bukan laba."
6. Laporan (admin investor): unggah Balance + Ledger sekaligus untuk bulan lalu — penyaring pindah ke bulan itu; unggah ulang bulan yang sama mengganti; berkas > 12 MB dan bukan-PDF ditolak sebelum terkirim; Buka PDF membuka tab baru; Hapus meminta konfirmasi dulu.
7. Laporan (investor biasa): form unggah dan tombol Hapus tidak tampil.
8. Dividen: total/modal/sisa cocok dengan Finance → Brankas → Pengembalian Modal; riwayat terbaru lebih dulu; teks menegaskan angka seluruh investor.
9. Event: daftar urut waktu terdekat; kalender menandai tanggal yang ada acaranya; bila modul Marketing/Event/BD tak terbaca, muncul pita "Daftar mungkin belum lengkap".
10. Promo: promo berjalan dan akan datang tampil dengan pil Berjalan/Akan datang; tanpa harga dan tanpa nama klien.
11. Silang: catat omset harian / pengembalian modal / unggah PDF di Office lama → terlihat di Vue setelah muat ulang, dan sebaliknya (unggah di Vue → terbaca di Investor Compass lama).
12. HP 390px: tidak ada geser ke samping di keenam layar; tabel menjadi kartu; form unggah muat penuh.
