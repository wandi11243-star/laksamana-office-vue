# Marketing — inventaris migrasi

Status: ⚠️ selesai dengan celah · build Vue berjalan (J)
Terakhir diperbarui: 2026-09-29

> **Triase 2026-09-29** — status di tabel E yang bertentangan dengan catatan ini: catatan ini yang berlaku.
> Rincian: [`_pertanyaan.md`](_pertanyaan.md), [`_gap-api.md`](_gap-api.md).
> - Roster: ❌ → ✅ `/api/v1/account/*` (U2). `ping`/`stats` ❌ → U3. `saveAll` → U4.
> - `kalkHistori` → G-09 ✅ (API #184, `documents/kalkHistori`). `hapus_yang_hilang` → T-04.

## Ringkasan
- Jumlah layar: 23 (3 tersembunyi: `events`, `brief`, `users`) + 1 layar detail event tanpa key sidebar · Aksi backend lama (marketing): 13 · Gap v1: 2 ❌ · ⚠️ 8
- Modul ini adalah CRM penuh orang Marketing: Database Client, Sales Pipeline & Event (kanban + daftar), detailing satu event (11 seksi D.1–D.11), Brief & Surat Penawaran, Reservasi VIP, Request Design & Video, Task Divisi/handover, Template Task, Invoice & Payment, Approval Flow, Purchase Order ke BD, Katalog, Kalkulator, Performa Omset & Bonus, Reporting, Timeline, Notifikasi, Pegawai & Akses, Pengaturan.
- State disimpan sebagai satu blob lewat `saveAll` dengan penjaga anti-timpa per baris (`baseUpdatedAt` + cap `updated_at`); kontrak v1 memecahnya jadi CRUD per-resource dengan `version`/`If-Match`. Ini perubahan bentuk paling berisiko — lihat §E dan §F.
- Paling rawan hilang saat migrasi: rumus uang di `eventFinance()` (subtotal/diskon/service/pajak/DP/pembayaran), mekanisme "Pengakuan Omset" (`menuFix`), sinkronisasi kunci meja ke modul Reservasi, alur Surat Penawaran + Approval, dan penjaga integritas (client/event tidak boleh dihapus sembarangan).
- Modul ini memakai berkas aset bersama `deploy/assets/venue-layouts.js`, `kwitansi-sheet.js`, `hpp-mesin.js`, dan `performa-bonus.js`. TIDAK memakai `performa-konten.js`, `cocok-bri.js`, atau `xlsx-baca.js`.

## A. Sumber
| jenis | path | baris |
|---|---|---|
| frontend lama | laksamana-office/deploy/marketing/index.html | 20.365 |
| backend lama | laksamana-office/marketing-mysql/api.php | 154 |
| backend lama (logika) | laksamana-office/marketing-mysql/lib_marketing_mysql.php | 90.110 byte |
| backend lama (tabel) | laksamana-office/marketing-mysql/schema.sql | 12 tabel |
| kontrak v1 | laksamana-api/docs/api/marketing.md | 80 |
| spec port | laksamana-api/docs/modules/marketing.md | 78 |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:702-760 "Pengakuan Omset: belum ditentukan bukan pilihan ketiga" | |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:1999-2035 "Modul Marketing: bawaannya WAJIB tetap ketat" | |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:6461-6500 "Denah meja: Marketing MENGIKUTI Reservasi" | |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:10583-10630 "kuota localStorage penuh" | |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:12042-12090 "Performa Omset & Bonus" | |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:12409-12470 "Data Marketing hilang sendiri" | |
| catatan CLAUDE.md lama | laksamana-office/CLAUDE.md:13234-13290 "SEPULUH Reservasi VIP hilang" | |
| aset bersama | laksamana-office/deploy/assets/venue-layouts.js (baris 6), kwitansi-sheet.js (:9), hpp-mesin.js (:12), performa-bonus.js (:16) | |

## B. Akses
- Kunci Modul di launcher: `marketing`. `readLmSession()` menerima bila `lm_session.modules` memuat `'*'` atau `'marketing'` (`deploy/marketing/index.html:3571-3578`). Identitas Office dipetakan ke baris `S.users` lewat `userId` lalu `name`; bila belum ada, user sementara dibuat role `marketing` (`:3588-3596`).
- Role internal: `super_admin`, `marketing`, `finance`, `manager`, `operational` dengan daftar nav bawaan masing-masing (`:3552-3558`). Nama tampil: Super Admin / Marketing / Finance / Manager / Approver / Operational; role kosong = `"Belum ada akses"` (`:3563-3566`).
- Matriks izin per (view, role): `PERM_NONE=0` "Tak Terlihat", `PERM_VIEW=1` "Lihat", `PERM_EDIT=2` "Boleh Ubah" (`:3774-3775`). Hasil disimpan di `S.roleAcc` (menimpa default, `:3823-3826`); override per user di `u.acc` (`:3833-3837`); Super Admin selalu penuh (`:3824`,`:3894`).
- Aksi → view: `ACTION_VIEW` (`:3777-3784`) `edit_client/del_client→crm`, `del_event/edit_event→events`, `verify_payment→invoices`, `approve→approvals`, `manage_users→users`, `edit_task→tasks`, `edit_template→templates`, `edit_staff→staff`, `edit_vip→vip`, `edit_designreq→designreq`, `edit_katalog→katalog`.
- Default "boleh ubah" per role (`legacyEditRules`, `:3793-3810`): `edit_client` marketing; `edit_event` marketing+manager; `verify_payment` finance; `approve` manager; `edit_task`/`edit_template` operational+marketing+finance+manager; `edit_staff` marketing+manager; `edit_vip`/`edit_designreq`/`edit_katalog` marketing+manager. `del_client`, `del_event`, `manage_users` = **false untuk semua** (harus dibuka manual).
- `VIEW_TERBUKA=[]` kosong (sejak 7 Sep 2026) — tak ada halaman otomatis terbuka (`:3873`). `perfomset` sengaja tunduk matriks (`:3870-3872`).
- Aksi khusus admin/manager: `manage_users` (kelola role & hak akses) & `edit_staff` (data pegawai) di `staff`; `approve` (persetujuan negosiasi/diskon) & `bisaPutusPenawaran()` di `approvals`; `verify_payment` (catat/hapus pembayaran) di `invoices`.
- Halaman gabungan: `#events` → `pipeline` tab "Daftar Event" (`:4894`); `#users` → `staff` (`:4897`); `staff` boleh dibuka bila punya `staff` ATAU `users` (`:4901`); `pipeline` bila punya `pipeline` ATAU `events` (`:4908`). Tanpa izin → layar "Akses belum aktif" (`:4914-4920`).

## C. Daftar layar (dari NAV_DEF / TITLES)
Kelompok `NAV_DEF` (`:4747-4843`), judul dari `TITLES` (`:4867`), dispatch render `R` (`:4935`).

| key | judul | subjudul | tampil untuk | tersembunyi? | bukti |
|---|---|---|---|---|---|
| dashboard | Dashboard | Ringkasan aktivitas & target hari ini | semua role | — | `:4754`,`:4995` |
| calendar | Kalender | Satu jadwal untuk seluruh venue | semua role | — | `:4760`,`:12253` |
| pipeline | Sales Pipeline & Event | Papan peluang & daftar seluruh event — satu tempat | semua kecuali operational | — | `:4771`,`:6101` |
| events | Input & Event (alias `pipeline`) | Sales Pipeline & Event | — | ya (`hidden:1`) | `:4778` |
| brief | Event Brief & Quotation | Generate briefing internal, versi client & penawaran | semua role | ya (`hidden:1`) | `:4790`,`:11098` |
| vip | Reservasi VIP | Booking ruang VIP — langsung mengunci meja di modul Reservasi | semua role | — | `:4791`,`:16241` |
| designreq | Request Design & Video | Ajukan kebutuhan desain & video - masuk ke antrian modul Konten | semua role | — | `:4795`,`:15467` |
| kalkulator | Menu Kalkulator | Hitung harga jual per pax & diskon dari harga deal customer | semua role | — | `:4798`,`:19230` |
| invoices | Invoice & Payment | Siklus invoice & tracking pembayaran | semua role | — | `:4799`,`:13150` |
| approvals | Approval Flow | Persetujuan negosiasi harga / diskon khusus | super_admin, manager | — | `:4800`,`:14199` |
| purchasing | Purchase Order | Kirim kebutuhan pembelian ke papan Purchasing BD OS | semua role | — | `:4801`,`:13900` |
| perfomset | Performa Omset & Bonus | Omset yang diakui tiap PIC berikut skema bonusnya — angkanya sama dengan panel Finance | super_admin, marketing, finance, manager | — | `:4807`,`:14721` |
| reports | Reporting | Reporting & Analytics (TITLES: "Reporting & Analytics") | super_admin, marketing, finance, manager | — | `:4808`,`:18549` |
| tasks | Task Divisi (Handover) | Operational handover & kesiapan per divisi | semua role | — | `:4814`,`:12377` |
| crm | Database Client | CRM — semua klien dari Lead sampai repeat customer | semua role | — | `:4816`,`:5476` |
| katalog | Katalog | Materi presentasi venue — gambar & deskripsi, bisa dijalankan layar penuh seperti PPT | semua role | — | `:4822`,`:8782` |
| templates | Template Task | Template job per divisi — Task, PIC, Deadline, Catatan | semua role | — | `:4823`,`:12744` |
| notifications | Notification Center | Semua pengingat penting | semua role | — | `:4824`,`:18679` |
| staff | Pegawai & Akses | Satu daftar: data pegawai (otomatis dari database user Office) sekaligus role & hak aksesnya | semua role | — | `:4825`,`:19826` |
| settings | Pengaturan | Aturan bisnis, tarif & data | semua role | — | `:4826`,`:20094` |
| timeline | Timeline & Audit Log | Jejak seluruh perubahan data | semua role | — | `:4834`,`:18630` |
| users | User Management (menyatu ke `staff`) | Kelola akun & hak akses | — | ya (`hidden:1`) | `:4842`,`:4897` |
| event | (tanpa sidebar) Detail Event `#event/<id>` | — | semua role | di luar menu | `:6992` |

## D. Detail per layar

### D.1 dashboard — Dashboard
- **Tampilan:** kepala `"Selamat datang, <nama depan>"` + subkelip `'"Pagi Meeting, Malam Healing" — ini yang perlu perhatianmu hari ini.'` (`:5012`). 4 kartu angka: **Event Hari Ini**, **Follow Up Hari Ini** (marketing, `x/target` + progress bar) atau **Total Follow Up**, **Pendapatan Bulan Ini**, **DP Pending** (`:5017-5021`). Grid "Status Event" per `EV_STATUSES` (`:5026-5028`). Panel kiri "Upcoming Event · 7 Hari" (tabel: Event, Tanggal, Pax, Nilai) (`:5032-5049`). Panel kanan: grafik "Pendapatan 6 Bulan" + papan "Closing Bulan Ini" (Top 6 PIC) (`:5060-5083`).
- **Filter / cari / urut / pager:** tanpa filter; tabel Upcoming pakai mesin tabel bersama (`tblUrut/tblPage`, `KOL_UPCOMING`) (`:5152-5157`).
- **Aksi:** `Lead Baru` (buka modal `newClient()`, hanya bila `can('edit_client')`) (`:5013`). Klik baris Upcoming → `go('event','<id>')` (`:5042`).
- **Perhitungan di browser:**
  - `revMonth`: jumlah `eventFinance(e).grand` untuk event bulan ini berstatus `['Confirmed','Deal','Event Done']` (`:5000`).
  - `dpPending`: event `['Confirmed','Deal']` dengan `eventFinance(e).paid===0` (`:5001`).
  - `upcoming`: event dengan `0<=daysTo(tanggal)<=7` dan statusnya ≠ `'Lost'` (`:5004`).
  - `closingMonth`: event bulan ini berstatus `['Deal','Confirmed','Event Done']` (`:5006`).
  - `pendapatanPerBulan(n)`: 6 bulan, dari event `['Confirmed','Deal','Event Done']` yang `tanggal` diawali `YYYY-MM` (`:5091-5103`). `grafikPendapatan()` tinggi batang = `nilai/maks*100%`, minimum 3px (`:5104-5117`).
  - `papanClosing()`: agregasi per `mktPIC` bulan ini, urut `v` menurun (`:5121-5142`).
- **Real-time / polling:** TIDAK DITEMUKAN (dicari: `setInterval` di sekitar renderDashboard). Ada auto-sync state lintas tab lewat `saveAll`/penyegaran versi (`:3299-3315`).
- **Catatan:** Panel "Mulai Dingin"/`panelPerluDigarap()` dan kolom Kesiapan DICABUT (`:5069-5082`,`:5143-5148`). `settings.staleDays` sengaja tetap hidup di data (`:5080`).

### D.2 crm — Database Client
- **Tampilan:** kepala "Semua klien dalam satu tempat — riwayat komunikasi & event tersimpan permanen." (`:5478`). Pencarian `"Cari nama, perusahaan, kontak..."` (`:5484`), filter relasi (`Semua Client` / `Punya peluang aktif` / per `tahap <s>` / `Pernah deal` / `Repeat customer` / `Belum pernah deal`, `:5485-5490`), filter Source (`Semua Source`, isi `SOURCES` + nilai bebas yang dipakai, `:5494-5495`). Tabel `KOL_CRM`: Client, Kontak, Source, Marketing PIC, Peluang, Total Spending, Next FU (`:5534-5543`). Catatan kaki menjelaskan "Peluang aktif" & ikon bintang = klien VIP (belanja > Rp20 juta) (`:5498`).
- **Filter / cari / urut / pager:** cari mencakup `nama+perusahaan+hp+email+ig` (`:5511`); urut per kolom; pager; sidik filter di pager (`:5548`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | `Export Excel` | unduh CSV client hasil filter; tulis `logAct` + toast | getAll(lokal) | `GET /clients` | `:5479`,`:5649-5662` |
  | `Import Excel` | pilih berkas, pratinjau, Terapkan | getAll(lokal) | `POST /clients` | `:5480`,`:5719-5875` |
  | `Client Baru` | modal `Client Baru` → `Simpan Client` | getAll(lokal) | `POST /clients` | `:5481`,`:5923` |
  | (klik baris) | modal detail client + `WhatsApp`/`Edit`/`Follow Up`/hapus | getAll(lokal) | `GET /clients/{id}` | `:5552`,`:5943` |
  | `Hapus permanen` | konfirmasi ketik nama | getAll(lokal) | `DELETE /clients/{id}` | `:6030` |
- **Form & field client** (`clientForm`, `:5877-5906`): `cf_nama` "Nama" (req), `cf_perusahaan` "Perusahaan / Organisasi", `cf_pic` "PIC (sisi client)", `cf_hp` "No. HP / WhatsApp" (req), `cf_alamat` "Alamat", `cf_source` "Source" (select `SOURCES` + opsi `Lainnya — tulis sendiri` → `cf_sourceLain`), `cf_mktPIC` "Marketing PIC" (select dari `S.users` role marketing), `cf_birthday` "Tanggal Lahir (opsional)" (date), `cf_nextFU` "Next Follow Up" (date), `cf_catatan` "Catatan" (textarea). Email & Instagram DIHAPUS dari form tapi data lama tetap (`:5931-5933`). Validasi: `toast('Lengkapi data','Nama & No. HP wajib diisi.','err')` (`:5935`).
- **Ekspor/Impor CSV** (`CRM_XLS_KOL`, `:5596-5622`): kolom `ID,Nama,Perusahaan,PIC Client,No. HP,Email,Instagram,Alamat,Source,Marketing PIC,Tanggal Lahir,Next Follow Up,Catatan` + keterangan `Jumlah Event,Peluang Aktif,Total Spending`. Format CSV pakai `\ufeff` + baris `sep=,` (`:5678-5702`). Pencocokan impor berjenjang ID → No. HP (`hpKunci`) → nama (`:5804-5811`). Pesan: `'Kolom Nama tidak ditemukan'` (`:5753`), `'Berkas kosong'` (`:5739`), `'Gagal membaca berkas'` (`:5727`).
- **Perhitungan:** `clientSpending` = jumlah grand event `Event Done` (`:5515`); `clientOpenEvents` = event `OPEN_STAGES` (`:5520`); VIP bila spending > 20.000.000 (`:5552`); tag "Repeat" bila `clientDoneEvents>=2` (`:5529`).
- **Real-time / polling:** tidak ada; client dari `S.clients` lokal.

### D.3 pipeline — Sales Pipeline & Event (Kanban + Daftar Event)
- **Tampilan:** kepala + segmen tab `Kanban` / `Daftar Event`, tombol `Event Baru` (`can('edit_event')`) (`:6144-6147`). Baris chip PIC: `Semua` + tombol per PIC (inisial + nama depan), `pipeDaftarPIC()` (`:6107-6116`). Strip ringkasan `pipeRingkas()`: "Peluang Aktif" + sel per `PIPE_COLS` (`Lead,Prospect,Approval,Quotation Terkirim,Deal,Lost`, `:3501`) (`:6317-6349`).
- **Kanban** (`:6188-6272`): kolom = `PIPE_COLS`; kartu menampilkan nama + PIC, client + jenis event, nilai singkat; terbuka → Client, Pax, Nilai + tombol `Ajukan Revisi` (bila penawaran `Terkirim` & belum Deal) dan `Buka Event`. Drag-drop lewat `bindKanban()`/`moveEventPipe()` (`:6357-6368`,`:6498-6531`).
- **Daftar Event** (`pipeIsiEvents`, `:6645-6697`): segmen periode `BRIEF_PERIODE` + penggeser bulan `<` `>` `Bulan ini`, select status (`Semua kecuali selesai` bawaan / `Semua status (termasuk selesai)` / per status), pencarian `"Cari event / client..."`, tombol `Reset filter`. Tabel `KOL_EVENTS`: nama, Tanggal, Pax, Status, PIC Marketing, Grand Total, kolom Dokumen (`Internal`/`Client`/`Draft`) (`:6698-6725`). Hitungan `"x dari y event"` + jumlah selesai disembunyikan (`:6792-6798`).
- **Aksi:**
  | tombol (teks persis) | apa yang terjadi | action lama | endpoint v1 | bukti |
  |---|---|---|---|---|
  | `Event Baru` | modal Event Baru | getAll(lokal) | `POST /events` | `:6147`,`:6869` |
  | `Kanban`/`Daftar Event` | ganti tab | — | — | `:6145-6146` |
  | `Internal`/`Client`/`Draft` | generate brief / draft negotiation | getAll(lokal) | client-side | `:6841-6843` |
  | `Ajukan Revisi` | alur revisi penawaran | getAll(lokal) | `PATCH /events/{id}` | `:6266`,`:9931` |
  | `Buka Event` | `go('event',id)` | — | `GET /events/{id}` | `:6268` |
  | (ubah tahap) | konfirmasi "Ubah tahap ke X?" / "Pindahkan ke X?" | getAll(lokal) | `PATCH /events/{id}` | `:6481-6490`,`:6518-6530` |
- **Pengakuan Omset (`menuFix`)**: wajib di Event Baru, bawaannya KOSONG, dua pilihan `tetap` / `ditempat` (`MENU_FIX`, `:10031-10047`). `submitNewEvent` menolak kosong (`:6972-6973`) SEBELUM client baru dibuat (jika tidak, lead lahir tanpa tahu asalnya). Chip `menuFixChip` menandai yang belum diisi (`:10037-10043`).
- **Form Event Baru** (`newEvent`, `:6869-6917`): Client (combo cari, opsi `+ Client baru (isi cepat)` → `ne_cnama`,`ne_chp`), `Nama Event` (req), `Jenis Event` (req, `EVENT_TYPES` + `Lainnya`→`ne_jenisLain`), `Tanggal` (req, default `today()`), `Estimasi Pax`, `Pengakuan Omset` (req). Validasi: `'Lengkapi data','Client & Nama Event wajib.'` (`:6948`), `'Jenis event belum ditulis'` (`:6961`), `'Pengakuan Omset wajib'` (`:6973`), `'Nama client wajib'` (`:6977`).
- **Konfirmasi hapus event** (`delEvent`, `:6390-6417`): menampilkan No. invoice resmi, jumlah pembayaran, follow up, approval; tombol `Hapus permanen` aktif hanya bila nama event diketik persis (`namaCocok`, normalisasi spasi case-insensitive, `:6386-6389`). Menghapus melepas kunci meja di Reservasi lebih dulu (`rsvUbahBaris`, `:6423-6438`).
- **Perhitungan:** `pipeAktif` = event bukan `Event Done` yang cocok PIC (`:6277-6280`); `pipeStatusOfEv` memetakan `Confirmed→Deal` (`:6173-6183`); ringkasan menjumlah `eventFinance(e).grand` (`:6317-6348`).
- **Real-time:** auto-refresh state lintas tab (`:3299-3315`); `autoCloseEvents()` menutup event H+2 (disebut `:3511`).

### D.4 event — Detail Event (form bertab, `#event/<id>`)
- **Tampilan:** kepala nama event + chip status/jenis/tanggal/pax (`:7002`); tombol `← Daftar`, `Event Brief` (`:7004-7005`). `renderEventTab` menggambar per tab dari `TAB_DEF` (`:4345-4351`): **1 Informasi Dasar**, **2 Operasional**, **3 Finance**, **4 Overview** (`secs` masing-masing). Tiap seksi berupa kartu dengan progres `isi/total` & centang PDF (`:7121-7133`). Tombol `Simpan <tab>` dan `Simpan & Lanjut · <tab berikut>` (`:7154-7156`).
- **EVENT_SCHEMA (D.1–D.11)** (`:3899-4261`) — ringkas:
  - **D.1 Informasi Dasar** (`div:['all']`): Nama Event(req), Jenis Event(req)+jenisLain, Format F&B(req, `getFbFormats()`+`Lainnya`)+fbFormatLain, Tanggal Event(req), `Berlangsung lebih dari satu hari`+Tanggal Selesai(req), Mulai Setup/Tamu Datang/Estimasi Selesai (time, req), Estimasi Jumlah Tamu (Pax)(req), Budget per Pax (F&B), Detail Tamu VIP, Sifat Acara(req), Lantai/Area(req)+areaLain, Poin Penting, Rundown(req, `rundown`), Lampiran Rundown(`files`), blok Jadwal Loading (dekor/in/out), blok Dekorasi & Layout (Sumber Dekorasi req, dsb + `salinlayout` + Gambar Layout), Venue Needs (`sound,lighting,screen,entDok,entEquip,entJenis,ruangVIP,musholla,listrik` `ynnote`).
  - **D.2 Kitchen** (`div:['Kitchen']`): `m_fbFormat`(mirror), Jam Keluar F&B(req), Komponen Menu(req), Dietary Requirement(req), Menu Final(`menutbl`, req), Catatan Kitchen, `m_kPIC`(mirror).
  - **D.3 Bar** (`div:['Bar']`): Komponen Bar(`Beverage/Dessert/Fruit`), Daftar Menu Bar(`menutbl`), Jam Operasional Bar(req), Standar Plating, Special Handling VIP, Bar Note, `m_bPIC`(mirror).
  - **D.4 Floor, Host & Guest Handling** (`div:['Floor','Event']`): `m_jamKonsumsi`,`penyajianBar`, Kebutuhan Setup, Dress Code, Barang Bawaan Client, Note untuk Floor, blok Host & Guest Handling (`guestList,hostBantu,hostJumlah,penandaTamu`), Info dari seksi lain (mirror), `m_fPIC`.
  - **D.5 Security, Safety & Akses Parkir** (`div:['Security']`): Tambahan Security(req), Emergency Exit Briefing, Medical Staff Stand-by, Body Checking, Loading Vendor, Barang Masuk(`barangtbl`), blok Akses Parkir (valet, VIP Parking, Area Parkir req), mirror, Security Note.
  - **D.6 Briefing & Rehearsal** (`div:['Event']`): Tanggal & Jam Briefing, Peserta Briefing.
  - **D.7 Design & Marketing Content** (`div:['Design']`): Materi Desain Venue (`multi`), Nama Resmi Event(req), Materi Promosi Sudah Ada(req), Izin Posting IG/TikTok/Teaser(req), Izin Tag + akun, Dokumentasi Diizinkan(req), Hashtag, PIC Marketing dari Client, blok Booth (`boothAda` + detail).
  - **D.8 Kasir / Cashier Operasional** (`div:['Floor']`): Estimasi Tamu+OTS(req), Deal per Pax, Sistem Pembayaran(req `Full di Awal/DP/Setelah Event Selesai`), Deposit (nama/nominal/via), Ketentuan Bill (`Open Bill/Close Bill`), Limit Anggaran, Penyesuaian Harga/Diskon (%), Voucher+imgs, Item Tambahan/Pesanan Khusus(`itemtbl`), `m_refundPIC`, Jam Operasional(req), Request Tambahan Kasir, Note Invoice.
  - **D.9 Finance & Ketentuan Pembayaran** (`fin:1`, `fields:[]` digambar tangan oleh `financeTab()`): Rincian Tagihan(`rincitbl`), Fasilitas FREE(`itemFree`), Item TBC(`itemTbc`), Item Tambahan dari Kasir(mirror), Discount(`cur`), NPWP, Materai.
  - **D.10 Attachment & Internal Note**: Lampiran Berkas(`files`, maks 8MB/berkas), Catatan Dokumen, Internal Note.
  - **D.11 Matriks PIC Hari-H**: `picAcara`(req), `kPIC`(req), `fPIC`(req, `src:'staff'`), `refundPIC`(req), `picKoordinator`(req,staff), `picMOD`(req,staff), `picOperator`,`picDokumentasi`,`picTalent`,`picDekor`,`picParkir`.
- **Hak akses di dalam modul:** seksi punya `div` (divisi yang lihat) & `fin:1` (sembunyi dari operational) (`:4326-4333`); `visibleSections()` memfilter. `financeTab` menampilkan pesan `"Detail finance hanya untuk Marketing, Finance & Manager."` untuk operational (`:10210-10211`).
- **Aksi tab Finance** (`financeTab`, `:10208-10345`): `rinciPanelHTML` (tabel Rincian), baris `Discount`, `Kena Biaya Service? <pct>%`, `Harga sudah termasuk pajak?`, `DP / Uang Muka` (nominal), `Masuk ke rekening` (`DP_REKENING` = `['QRIS BRI','Transfer UOB','Cash','QRIS BCA']`, `:17001`), `Tanggal transfer`, `Bukti transfer` (maks 8MB, langsung unggah), `DP sudah dibayar` (centang + keterangan hidup), template FREE/TBC, NPWP; panel hitung `finHitungHTML` (Baris ditagih, Subtotal, Discount, Service Charge, PB1, GRAND TOTAL, Pembayaran: DP/Terbayar/Sisa/Kelebihan, Status Invoice, `Pratinjau Lembar Tagihan` + `Cetak`), tombol `Catat Pembayaran`, `Kirim Invoice`, `Reminder DP`.
- **Perhitungan inti** (`eventFinance`, `:4457-4524`):
  - `fbOtomatis = round(fbPax × fbHargaPax)` (`:4400`); `eventFbCost` urutan: `fbManual` → `fbDealTotal` (bila `fbDealAktif`) → `pax×harga` → `biayaFB` lama (`:4425-4438`).
  - `eventSubtotal`: bila `rinciAktif` → `rinciTotalBayar`, else `fb + sewaVenue + biayaTeknis + biayaLain` (`:4439-4456`).
  - `afterDisc = max(0, sub - diskon)`; `service = svcOn ? round(afterDisc×serviceCharge/100) : 0`; tax: bila `taxInclude` → `grand=afterDisc+service`, `tax=round(grand×pb1/(100+pb1))`, else `tax=round((afterDisc+service)×pb1/100)`, `grand=afterDisc+service+tax` (`:4462-4469`).
  - DP: `dp = depositNominal>0 ? depositNominal : round(grand×dpPct/100)`; `dpDiakui = dpCentang ? max(0, dp - bayarTercatat) : 0`; `paid = bayarTercatat + dpDiakui`; `remaining = max(0, grand-paid)` (`:4478-4502`).
  - `invStatus`: grand 0→`Draft`; remaining≤0→`Paid`; paid>0→`Pending`; else bila `daysTo(tanggal)<7` & status Confirmed/Deal→`Overdue`; else `invoiceSent?'Sent':'Draft'` (`:4552-4560`).
- **Catat Pembayaran** (`addPayment`/`savePayment`, `:10805-11035`): tabel `Jenis(DP/Pelunasan/Tambahan Hari-H)`, `Jumlah`, `Metode(Transfer/Cash/QRIS/Card)`, `Tanggal`; baris Grand Total/Terbayar/Sisa; `Bukti Transfer (foto/PDF)` **WAJIB** (`:10975`), maks 8MB. Setiap baris dapat nomor kwitansi `kwitansiNo()` (`:4550-4551`).
- **Surat Penawaran** (`penawaranCard`, `:10088-10190`): status `penStatus` (`:9746`); tombol `Buat Penawaran`, `Baca PDF`, `Ajukan Approval`, `Setujui`/`Tolak` (manager), `Kirim ke Client`, `Kirim ulang`, `Ajukan Revisi`, `Konfirmasi Deal`, `Perbaiki & Ajukan Lagi`. PDF maks `MAKS_PDF_PENAWARAN = 40MB` (`:9745`) diunggah bertahap.
- **Real-time / polling:** auto-save (`autoSaveBind/autoSaveTrigger/autoSaveCommit`, `:7163`,`:9496`), penyegaran lintas tab (`:3299-3315`).

### D.5 brief — Event Brief & Quotation (tersembunyi)
- **Tampilan:** kepala "Briefing internal & versi client, satu klik dari data event." (`:11104`). Pencarian `"Cari nama event, klien, jenis, atau tanggal…"` (`:11119`); tabel `KOL_BRIEF`: Event, Client, Tanggal, Status, Generate (`:11151-11157`). Pemisah bulan saat diurut tanggal (`:11133-11142`).
- **Aksi:** `Internal` (briefing internal), `Client` (versi client), `Draft` (Draft Negotiation) (`:11147-11149`). `draftNegotiation` menawarkan dua kartu: `PDF yang diunggah sendiri` vs `Template otomatis dari sistem` (`:11191-11205`).
- **Perhitungan:** tidak ada; dokumen dibangun `buildBriefDoc(id,mode)` (`:11811`). Mode `quote` = draft/referensi internal, bukan surat resmi (`:11183-11186`).
- **Catatan:** tersembunyi dari sidebar tapi tetap dituju tombol Internal/Client/Draft di detail event & daftar (`:4779-4790`).

### D.6 calendar — Kalender
- **Tampilan:** kepala + select status (`Semua status`/`Lead`/`Prospect`/`Quotation Terkirim`/`Deal`/`Event Done`/`Lost`) + navigasi `←` `Hari Ini` `→` (`:12254-12258`). Legenda 3 warna: Event Marketing (emas), Acara EMS (violet), Reservasi (teal); total `"<n> pax bulan ini"` (`:12264-12284`). Kisi bulan dengan pitanya: event Marketing (`--gold`), acara EMS (`ev-ems`), reservasi (`ev-rsv`) (`:12287-12328`).
- **Aksi:** klik pita event → `calEventPopup(id)` (ringkas); `emsEventPopup`; `rsvHariPopup` (`:12304-12325`).
- **Perhitungan:** `eventPadaTgl` menangani event lintas hari (`:3424-3431`); `calTotalPax` jumlah pax bulan ini dengan penyaring status sama (`:12334-12341`).
- **Real-time:** `muatEventEms()` dan `muatReservasi()` ditarik tanpa ditunggu (non-blocking) (`:12330-12331`).
- **Ketergantungan:** membaca event `Event Done`? — kalender menyaring `e.status!=='Lost'` (default); membaca modul Event (EMS) & Reservasi (`:12062`,`:12159`).

### D.7 tasks — Task Divisi (Handover)
- **Tampilan:** dua tingkat. Tingkat 1 kartu event (`taskEventList`): ringkas client/tanggal/area/tamu/PIC + progres to-do + `<x>/<y> sub kategori siap` (`:12389-12415`). Tingkat 2 papan to-do per event (`taskDetail`/`taskBoard`/`freeBoard`) (`:12418-12560`).
- **Aturan kategori:** satu event satu kategori to-do = **Format F&B** yang dipilih; divisi jadi **sub kategori** di dalamnya (`:5222-5242`). Bila Format F&B belum dipilih → `freeBoard()` "Tugas Bebas" (`:12493-12522`).
- **Aksi:** `← Semua Event`; tombol WhatsApp (`remindWA`), hapus tugas, tambah item; centang selesai (`toggleJobSelesai`); input `Kesimpulan` inline (PIC, Deadline, Catatan) (`:12502-12558`).
- **Perhitungan:** `jobProg` clamp 0–100 (`:5317`); `divProgress` rata-rata `jobProg` item template (`:5318`); `eventItemCount(e)` hitung total/selesai/pct.
- **Catatan:** kategori lama (divisi) bisa dipindah jadi sub kategori lewat `pindahKategoriLama` (`:12833-12860`).

### D.8 templates — Template Task
- **Tampilan:** kepala + tombol `Tutup semua`/`Buka semua` + `Tambah Kategori` (`can edit_template`) (`:12746-12753`). Kartu per Format F&B (`tmplCard`) dengan tombol `Salin dari`, `Edit`, hapus (`:12755-12765`). Blok "Kategori lama — belum dipindah" dengan select tujuan + `Pindahkan` (`:12767-12784`).
- **Aksi:** `Tambah Kategori`, `Salin dari`, `Edit`, `Pindahkan`, hapus kategori/sub/template; tarik-lepas urutan sub kategori dalam satu kategori (`bindSubDrag`/`reorderSub`, `:12787-12859`).
- **Form:** kategori baru `Nama Kategori` (`nf_name`) (`:12871-12877`); sub kategori `Nama Sub Kategori`; template task `div,id,sub` (`:13067-13104`).
- **Validasi (persis):** `'Nama wajib','Isi nama kategori dulu.'`; `'Sudah ada','Nama itu sudah dipakai.'`; `'Pilih kategori','Pilih kategori tujuan dulu.'`; `'Tidak ada sumber','Belum ada kategori lain yang bisa disalin.'`; `'Task wajib','Isi nama task dulu.'` (`:12834-13129`).

### D.9 invoices — Invoice & Payment
- **Tampilan:** kepala "Status pembayaran tiap event, real-time untuk Finance & Marketing." (`:13152`). HANYA event `['Confirmed','Deal','Event Done']` (`:13158`); yang `Draft` disembunyikan tapi jumlahnya disebut (`:13166-13175`). 4 kartu: Total Piutang, Invoice Overdue, Lunas, Draft (`:13178-13184`). Tab `Semua`/`Lunas`/`Sudah DP`/`Belum Payment` (`:13190-13201`). Tabel `KOL_INVOICES`: Client/Event, Grand Total, Terbayar, Sisa, Status, Invoice Resmi, Aksi (`:13214-13227`).
- **Aksi:** `Catat pembayaran` (ikon, bila `verify_payment`/super_admin & remaining>0) (`:13207`). Klik baris → detail event tab Finance.
- **Request Invoice resmi** ke Finance (`API_INV_URL='../finance-api-mysql/api.php'`, `:13324`; `ROLE_MINTA_INV=['marketing','finance','manager','super_admin']`, `:13328`; id dokumen `'mkt:<evId>:dp|lunas'`, `:13351`). Tombol berubah jadi PDF saat Finance menerbitkan nomor.
- **Perhitungan:** sama dengan `eventFinance`; `bayarTab` mengelompokkan lunas/dp/belum (`:13192-13196`).
- **Real-time:** `muatInvMkt(pInv.items)` menyegarkan slot `INV_DP`/`INV_LUNAS` dari Finance setelah render (`:13210-13212`).
- **Catatan:** Piutang = closing belum lunas; Potensi (penawaran terkirim) dipisah (`:13160-13180`).

### D.10 purchasing — Purchase Order
- **Tampilan:** kepala "Kebutuhan pembelian dari Marketing — terkirim ke papan Purchasing BD OS..." (`:13901-13902`). Sorotan "CARA KERJANYA" (baris masuk ke BD OS berstatus **Diajukan**) (`:13906-13912`). Form: `Divisi peminta` (`Business Development/Marketing/Project/Purchasing`, default Marketing), `Dibutuhkan tanggal` (default `poAkhirMinggu()`), `Untuk event (opsional)` (`:13913-13925`). Tabel barang: Nama item, Jumlah, Satuan, Alasan/kebutuhan, Perkiraan harga (Rp) (`:13926-13936`). Daftar "Kebutuhan yang sudah dikirim" dibaca hidup dari BD OS (`:13946-13955`).
- **Aksi:** `Tambah baris`, `Kirim ke BD OS`, `↻ Segarkan` (`:13938-13952`).
- **Backend:** `BD_API='../bd-api-mysql/api.php'` (`:13847`); `addPo` (`:14083-14100`), baca `getAll` (`:13980-13998`). Toast `'Terkirim','<n> item masuk ke BD OS.'`; `'Belum ada baris','Isi minimal satu nama item.'` (`:14077`,`:14098`).
- **Status chip** `poChipStatus` memetakan kata kunci tolak/setuju/menunggu (`:14012-14020`).

### D.11 approvals — Approval Flow
- **Tampilan:** kepala "Meja putusan manajemen." (`:14215`). 3 kartu: Surat Penawaran, Negosiasi Lanjutan, Menunggu Keputusan (`:14216-14225`). Tab `Antrian`/`Riwayat Approval`/`Semua` (`:14244-14248`). Tabel `KOL_APPROVAL`.
- **Aksi:** `Setujui`/`Tolak` untuk penawaran (`putusPenawaran`) dan negosiasi (`decideApproval`) (`:14273-14285`), hanya `bisaPutusPenawaran()` / `can('approve')`; teks `'hanya Manager / Approver'` bila bukan.
- **Backend:** keputusan penawaran lewat state event (`penawaran.status`); negosiasi lewat `S.approvals` (`approvalRows`).
- **Catatan:** Revisi penawaran menurunkan tahap ke `Prospect` dan masuk antrian Negosiasi Lanjutan (`:9995`).

### D.12 perfomset — Performa Omset & Bonus
- **Tampilan:** kepala + input `Periode` (month) (`:14738-14741`). Segmen PIC: `🧮 Semua` + tombol per PIC (`:14775-14778`). Pita akses Head/self (`:14780-14789`). Kartu-kartu: Realisasi, Komposisi event, dst.
- **Backend:** `PFO_API='../kompas-api-mysql/api.php'` (`:14410`); aksi `performaDivisi` dengan `divi:'marketing'` (`:14703`). Mesin hitung dari `deploy/assets/performa-bonus.js` — `pbAgregasi()` & `bonusMarketing()` (`:14731-14735`,`:14746-14749`).
- **Hak lihat:** Head/pengurus melihat anggota tim; selain itu hanya dirinya + rekapan gabungan (`:14766-14789`,`CLAUDE.md:12042-12090`). Gerbang di penggambar `gambar()`, bukan tombol (`:14794-14797`).
- **Perhitungan:** `HASIL = pbAgregasi(days,'marketing',list,comps)`, `BONUS = bonusMarketing(list,agg)`; kontribusi = `nilai/omsetHari*100%` (`pfoSelKontribusi`, `:14417-14420`); rasio per pax dsb.
- **Catatan:** TIDAK menyalin satu rumus pun; bonus dihitung aset bersama (`CLAUDE.md:12042-12090`).

### D.13 designreq — Request Design & Video
- **Tampilan:** kepala "Ajukan kebutuhan desain atau video..." (`:15469-15470`). 3 kartu: Menunggu Dikerjakan, Permintaan Desain, Permintaan Video (`:15474-15477`). Filter jenis (`DR_JENIS`, `:15379`), segmen kategori (`DR_KAT`: `Belum Selesai`/`Sudah Selesai`/`Dibatalkan`/`Semua`, `:15405`), pencarian (`:15479-15486`). Tabel `KOL_DESIGNREQ`.
- **Aksi:** `Request Baru` (`drForm`); klik baris → `drLihat`; `Batalkan` (dibatalkan bukan dihapus, `batalAt`) (`:15505`).
- **Form** (`drForm`, `:15828-15876`): Jenis(req), Prioritas(`DR_PRIO` urgent/high/medium/low), Judul Permintaan(req), Deadline Pengerjaan, Brand (`drOpsiField`), PIC Diminta, Platform (`DR_PLATFORM` = `IG/TT/YT/FB/Website/Threads/Google`, `:15390`), Untuk Acara (event ≥ H-7), Brief(req), Referensi (link + foto; `DR_IMG_MB=2`/foto, `DR_TOTAL_MB=6`/request, `:15778-15779`). Validasi: `'Lengkapi data','Judul & Brief wajib diisi — tim Konten mengerjakannya dari brief ini.'` (`:15883`).
- **Perhitungan:** `drHitungKat()` hitung per kategori (`:15412`); `drData()` filter (`:15443`).
- **Backend:** daftar opsi Brand/PIC dari `GET /api/v1/konten/design-options` (G-16, laksamana-api#190); kemajuan disegarkan `GET /marketing/design-queue` tanpa `active` (`:15551`).
- **Real-time:** `drSegarkanProgres()` tiap halaman dibuka, satu permintaan sekaligus (`:15538-15545`).

### D.14 vip — Reservasi VIP
- **Tampilan:** kepala "Booking ruang VIP. Mejanya langsung dikunci di modul Reservasi." (`:16243`). 4 kartu: Total Reservasi, Assisted, Regular, Nominal Assisted (`:16258-16263`). Strip `vip-yatim` (reservasi di Reservasi belum ada di Marketing) (`:16267`), peringatan Assisted tanpa nominal (`:16268-16270`). Pencarian + segmen periode (`Semua`/`Hari ini`/`Minggu ini`/`Bulan ini` + tanggal) + segmen jenis (`Regular & Assisted`/`Assisted`/`Regular`/`Dibatalkan`/`Semua`) (`:16272-16283`). Tabel `KOL_VIP`.
- **Aksi:** `Reservasi VIP Baru` (`vipForm`), `Isi Nominal` (Assisted), Detail/Ubah/Batalkan/Hapus (`:16241-16400`).
- **Form** (`vipFormUI`, `:16878-16980`): Jenis Reservasi (`Assisted`/`Regular`; Assisted dihitung omzet), Nominal Pendapatan (Assisted), DP & Bukti Transfer (banyak baris, tiap baris nominal+rekening wajib), Pengakuan Omset(req, Assisted), Atas Nama(req), Client/Perusahaan (datalist + `Perusahaan baru, belum ada di Database Client`), Tanggal(req), No. HP(req), Jam Kedatangan(req), Sampai Jam, Jumlah Orang min(req)/maks, Request Layout, Penggunaan TV, Butuh Speaker & Mic, Catatan. Tombol `Simpan` (hanya saat ubah), `Lihat Meja Terkunci`, `Pilih Meja & Kunci →`/`Ubah Meja & Kunci →`.
- **Perhitungan:** `vipNominal(v)` = nominal hanya untuk `jenis==='Assisted'` (`:15317`); `vipDpTotal(v)` (`:17007`). `DP_REKENING = ['QRIS BRI','Transfer UOB','Cash','QRIS BCA']` (`:17001`).
- **Kunci meja:** denah dari `deploy/assets/venue-layouts.js`; `VIP_LT_CFG/VIP_DENAH_*` (`:17520-17589`); lock H-3 jam (`VIP_LOCK_LEAD_MIN=180`, `:15082`); sinkron ke Reservasi lewat `RSV_API='../reservasi-api-mysql/api.php'` (`:14941`,`:15044`,`:15016-15060`). Denah Marketing MENGIKUTI Reservasi (denah tanggal > template edit > bawaan); Minggu = akhir pekan; Lantai 2 pakai `layoutOverrides2` (`CLAUDE.md:6461-6500`).
- **Real-time:** `muatReservasi()` malas, non-blocking (`:16249`).

### D.15 katalog — Katalog
- **Tampilan:** kepala + tombol `Mulai Presentasi`, `Tambah Slide` (gambar) (`:8784-8787`). Grid `kat-card` (thumb + judul + subjudul + deskripsi) (`:8790-8816`).
- **Aksi:** klik thumb → `katShow(i)` (presentasi penuh); `↑`/`↓` urut; `Edit` (modal `kat_judul`/`kat_sub`/`kat_desc`/`kat_file`); hapus slide (`:8798-8805`,`:8896-8915`). Unggah gambar maks 8MB.
- **Validasi:** `'Harus gambar'`; `'File terlalu besar'` (`:8825-8826`).
- **Backend:** slide disimpan di `S.katalog` (document `katalog`), gambar lewat `uploadReceipt`.

### D.16 reports — Reporting
- **Tampilan:** kepala "Omset & jumlah event per kategori, beserta totalnya sebulan. Dihitung dari event yang sudah closing." + `Export CSV` (`:18551-18553`). Input `Periode` (month, `repBulan`) (`:18556-18558`). 3 kartu: Total Omset, Jumlah Event, Rata-rata per Event (`:18568-18571`). Tabel kategori: Kategori, Jumlah Event, Total Omset + baris TOTAL (`:18573-18586`).
- **Perhitungan:** event `['Confirmed','Deal','Event Done']` bulan `repBulan`; dikelompokkan per `jenisEvent(e)` (kosong → `(tanpa jenis)`); urut omset menurun (`:18560-18567`).
- **Aksi:** `Export CSV` seluruh event (`:18622-18626`).

### D.17 timeline — Timeline & Audit Log
- **Tampilan:** kepala "Jejak kronologis semua perubahan data penting. Log otomatis dibatasi 400 entri terbaru." (`:18631`). Tabel `KOL_TIMELINE`: Waktu(`ago`), Oleh, Jenis, Aktivitas, Detail (`:18657-18663`). Tombol `Bersihkan Log` (super_admin) + badge jumlah entri (`:18633`).
- **Aksi:** `Bersihkan Log` → `clearActivities()` (konfirmasi `confirm()`) (`:18665-18670`).
- **Catatan:** `logAct` menyimpan maks 400 entri (`:4565`).

### D.18 notifications — Notification Center
- **Tampilan:** kepala "Semua pengingat yang mudah kelewat kalau manual." + `Tandai semua dibaca` (`:18681-18682`). Kartu "Pengingat Aktif" (live: DP belum masuk, event H-7/H-0, follow up hari ini, invoice overdue) (`:18685-18695`). Kartu "Riwayat Notifikasi" (tabel `KOL_NOTIF`) dengan badge belum dibaca (`:18698-18721`).
- **Aksi:** klik pengingat → `notifGo(link)`; `Tandai semua dibaca` (`:18730`); klik baris riwayat → `openNotif(id)`.
- **Perhitungan live:** event `['Confirmed','Deal']` & `paid===0` → DP; event `0<=daysTo<=7` → event; `nextFU===today()` → FU; `invStatus==='Overdue'` → invoice (`:18685-18689`).

### D.19 kalkulator — Menu Kalkulator
- **Tampilan:** kepala "Hitung harga jual per pax lalu diskon dari harga deal customer. Menu & harga dari Prasmanan di HPP & Resep. Tidak tersimpan — alat hitung cepat." (`:19234`). Field `Jumlah Pax` + tabel menu: `#`, Menu (datalist cari), `Porsi (pcs)`, `Harga Satuan`, `Subtotal`, (admin) `Modal / porsi` (`:19251-19263`). Tombol `Pilih Menu dari Kategori`, `Tambah baris kosong` (`:19266-19269`). Kartu `Hasil Hitung` (Total porsi, Total biaya menu, Harga jual/pax) & `Harga Deal Customer` (Selisih/pax, Diskon, Total deal) (`:19271-19287`). Bagian `Riwayat Perhitungan` (`:19288`).
- **Backend:** `KALK_HPP_API='../stock-api-mysql/hpp.php'`, `KALK_ITEM_API='../stock-api-mysql/items.php'` (`:18945-18946`).
- **Perhitungan:** harga jual/pax = total biaya menu ÷ jumlah pax; total deal = deal × pax; selisih/pax; diskon dari selisih (`:19275-19286`). `kalkRingkas()` menyusun baris & total (`:19332-19344`).
- **Riwayat:** `S.kalkHistori` (id,nama,pax,deal,rows,total,perPax,by,at) — disimpan lewat `save()` (kol_settings server `extra:kalkhistori`); modal TIDAK disimpan (`:19306-19360`). Validasi: `'Nama perhitungan wajib'`,`'Belum ada menu'`,`'Tidak bisa','Hanya pembuatnya atau admin...'` (`:19348-19383`).

### D.20 staff — Pegawai & Akses (+ `users` menyatu)
- **Tampilan:** kepala "Satu daftar untuk semua orang: identitas pegawai otomatis mengikuti database user Office..." (`:19831-19833`). Pita status sinkronisasi `rosterSyncHTML()`. 4 kartu: Total Pegawai, Aktif, Tim Terisi, No. HP Terisi (`:19836-19840`). Tabel `KOL_PEGAWAI`: nama, Tim, No. HP, Role, Status, Aksi (`:19851-19863`). Matriks hak akses `accessMatrix(canMU)` (`:19873`).
- **Sumber pegawai:** Office `listDivisiRoster` (seluruh pegawai) + `listModuleRoster{module:'marketing'}` (keanggotaan & admin), tanpa PIN, timeout 25s, auto tiap modul dibuka (`:3613-3642`). Role diturunkan dari jabatan Office (`roleDariJabatan`, `ROLE_JABATAN`, `:19916-19927`) dengan urutan prioritas; admin modul Office → `super_admin`; jabatan terbaca → sesuai; tidak terbaca → anggota modul Marketing, selainnya Operational (`:3669-3682`).
- **Aksi:** `Ubah No. HP` (`editPegawai`, hanya No. HP), `Hak Akses` (`openUserAccess`), role diubah dari matriks role (`saveRoleMatrix`), `Simpan` matriks; reset akses user (`:19866-19871`,`:20003-20088`).
- **Validasi:** `'Akses ditolak','Kamu tidak punya izin mengubah data pegawai.'` / `'...mengubah data pegawai.'` / `'...kelola user.'` (`:19886`,`:20004`,`:20031`).

### D.21 settings — Pengaturan
- **Tampilan:** kepala "Aturan bisnis, tarif & data. Angka bisa dikalibrasi ulang setelah 2–3 bulan data aktual." (`:20096`). Tabel `Pengaturan | Nilai | Keterangan` (`setRow`): `DP Default (%)` (`set_dp`), `PB1 / Pajak (%)` (`set_pb1`), `Service Charge (%)` (`set_service`), `Target Follow Up / Hari` (`set_fu`), `Jeda Follow Up Berikutnya (hari)` (`set_funext`), `Template Fasilitas FREE` (`set_free`), `Prefix Kwitansi` (`set_kw`), `WA Booking` (`set_wa`) (`:20101-20121`). Tombol `Simpan Pengaturan` (`:20122`). Kartu "Akun Aktif" + `Keluar ke Office` (`:20124`). Kartu "Perlu Konfirmasi (PRD Bagian 14)" 9 poin (`:20126-20129`). Kartu "Galeri Venue (Draft Negotiation)" + `Tambah Foto Venue` (`:20130-20134`).
- **Aksi:** `Simpan Pengaturan` (`saveSettings`, `:20161-20171`); `Tambah Foto Venue`/hapus foto (`uploadVenueFoto`, `delVenueFoto`).
- **Catatan:** tombol "Reset ke Data Contoh" DICABUT (bahaya, `:20145-20151`). `discountThreshold`/`baseline` tidak dibaca lagi (`:20163-20167`).
- **Perhitungan:** tidak ada (nilai disimpan apa adanya).

## E. Pemetaan backend

### E.1 Aksi backend Marketing (`marketing-mysql/api.php:70-151`)
| action lama | dipakai di layar | baca/tulis | endpoint v1 | status | catatan |
|---|---|---|---|---|---|
| `getAll` (GET) | SEMUA layar (muat state) | baca | `GET /state` (+ `GET /{resource}`) | ✅ | `_versi` = `updated_at` maks; v1 punya per-resource + `/state` (`docs/api/marketing.md:16,67`) |
| `stats` (GET) | diagnostik | baca | — | ❌ | tidak ada di kontrak v1 (`api.php:73-74`) |
| `ping` (GET) | boot/CI | baca | — | ❌ | `identitas()` (LIB_VERSI) dipakai CI; tak ada endpoint v1 (`api.php:76-78`) |
| `eventsHari` (GET `tgl`) | Finance Omset / agen investor | baca | `GET /events-on/{YYYY-MM-DD}` | ✅ | `docs/api/marketing.md:68`; balasan `events[],vip[],settings{serviceCharge,pb1}` |
| `dpMasuk` (GET `dari`,`sampai`) | Reservasi tab DP Event / Cashier | baca | `GET /dp?from=&to=` | ✅ | `docs/api/marketing.md:69`; termasuk `vipTerkunci`,`luar` |
| `designReqs` (GET `aktif=1`) | designreq (marketing) + Konten | baca | `GET /design-requests?active=1` (alias `/design-queue?active=1`) | ✅ | `docs/api/marketing.md:20,70`; `/design-queue` hanya yang belum ada ref image |
| `designReq` (GET `id`) | designreq + Konten | baca | `GET /design-requests/{id}` | ✅ | `docs/api/marketing.md:20` |
| `designReqOpsi` (POST `opsi`) | ditulis modul Konten | tulis | `PUT /design-options` | ✅ | whole-document (`docs/api/marketing.md:20`) |
| `designReqSet` (POST `id,status,picNama`) | ditulis modul Konten | tulis | `PUT /design-requests/{id}/progress` | ✅ | `docs/api/marketing.md:20` |
| `receipt` (GET `key`) | semua lampiran/bukti/foto | baca | `GET /files/{key}` | ✅ | `docs/api/marketing.md:78` |
| `uploadReceipt` (POST) | lampiran, katalog, DP, bukti bayar | tulis | `POST /files` | ✅ | ≤40MB (`docs/api/marketing.md:76`) |
| `uploadChunk` (POST) | Surat Penawaran 40MB | tulis | `POST /files/chunks` | ✅ | ~2MB/potong (`docs/api/marketing.md:77`) |
| `saveAll` (POST `data, _sejak`) | SEMUA tulisan | tulis | per-resource `POST/PUT/PATCH/DELETE` + `PUT /documents/{doc}` | ⚠️ | blob → CRUD per baris; penjaga `baseUpdatedAt`/`updated_at` → `version`/`If-Match` (409 `version_conflict`, 428 `version_required`) (`docs/api/marketing.md:43-53`) |
| (koleksi `kalkHistori` / `extra:kalkhistori`) | kalkulator (riwayat) | baca/tulis | `GET/PUT /documents/kalkHistori` | ✅ | dokumen terdaftar (G-09, laksamana-api#184); `If-Match` = content hash, `extra:kalkhistori` legacy (`:2322`) |

### E.2 Panggilan lintas-modul dari frontend
| aksi / URL | dipakai di layar | baca/tulis | endpoint v1 | status | catatan |
|---|---|---|---|---|---|
| `../account-api-mysql/api.php` `listDivisiRoster`,`listModuleRoster{module:'marketing'}` (`:3635-3640`) | staff, boot | baca | `GET /api/v1/account/*` | ⚠️ | tak ada di kontrak marketing; ada di Account |
| `../event-api-mysql/api.php` `getAll` (`:12062-12075`) | calendar (acara EMS) | baca | `GET /api/v1/event/*` | ⚠️ | panggilan modul lain |
| `../finance-api-mysql/api.php` (tabel `inv_kwitansi`) (`:13324-13350`) | invoices, vip (kwitansi) | baca/tulis | `GET/POST /api/v1/finance/*` | ⚠️ | request invoice/kwitansi resmi |
| `../bd-api-mysql/api.php` `getAll` + `addPo` (`:13847`,`:13980`,`:14083`) | purchasing | baca/tulis | `GET /api/v1/bd/...`, `POST /api/v1/bd/purchase-orders/batch` | ✅ | `_lintas-modul.md:48` |
| `../kompas-api-mysql/api.php` `performaDivisi{divi:'marketing'}` (`:14410`,`:14703`) | perfomset | baca | `GET /api/v1/kompas/*` | ⚠️ | berpagar sesi; rumus di `performa-bonus.js` |
| `../reservasi-api-mysql/api.php` `saveAll` (`:14941`,`:15016-15060`) | vip (kunci meja), event (hapus/lepas meja) | tulis | `POST /api/v1/reservasi/*` | ⚠️ | menulis baris `ev-<id>` |
| `../konten-api-mysql/api.php` `getAll` (`:15626-15643`) | designreq (brand/pic/platform) | baca | `GET /api/v1/konten/design-options` | ✅ | G-16 (laksamana-api#190): endpoint sempit brand + kru aktif, open `marketing\|konten`; bukan lagi `/konten/state` |
| `../stock-api-mysql/hpp.php` + `items.php` (`:18945-18959`) | kalkulator | baca | `GET /api/v1/stock/hpp`, `/items` | ⚠️ | menu & harga Prasmanan |

Konkurensi: state blob lama pakai `_versi` (`GET /state` `meta.version`) + penjaga baris `baseUpdatedAt`/`updated_at` + `bentrok[]` (README backend `:21-34`). v1: `GET /{resource}/{id}` `meta.version` & header `ETag`; tulis wajib `If-Match` atau `version` di body; tanpa versi → `428 version_required`; versi basi → `409 version_conflict` (kecuali isi identik = no-op sukses); audit trail otomatis (`docs/api/marketing.md:42-54`). Documents pakai `PUT /documents/{doc}` + `If-Match: "<hash>"`, basi → 409.

Kode error yang wajib ditangani UI: `already_exists` (409 saat POST id duplikat) (`docs/api/marketing.md:43`), `version_required` (428), `version_conflict` (409, current di `error.details.current`) (`:51-52`), serta envelope error generik `{error:{code,message,details?}}` (`:9`). Di sisi lama, `bentrok[]` dari `saveAll` WAJIB ditampilkan (`README backend:29`).

## F. Aturan bisnis yang wajib dibawa
1. **Anti-timpa dua lapis (per baris)** — klien kirim `baseUpdatedAt`; bila server lebih baru → baris DITOLAK & masuk `bentrok[]`, saveAll tetap `ok:true`; aplikasi WAJIB menampilkannya. v1 memakai `If-Match`/`version`. — bukti: `laksamana-office/marketing-mysql/README.md:21-34`, `docs/api/marketing.md:48-53`.
2. **Pengakuan Omset (`menuFix`) wajib, bawaan KOSONG** — dua pilihan `tetap`/`ditempat`; kosong = keadaan, bukan pilihan ketiga. Divalidasi SEBELUM client baru dibuat (agar tidak melahirkan Lead tanpa asal). Event lama tetap kosong dan dibetulkan satu per satu; Finance memperlakukan kosong seperti `tetap` dan WAJIB menyebutkannya. — bukti: `deploy/marketing/index.html:6862-6973`; `CLAUDE.md:702-760`.
3. **Surat Penawaran harus lolos approval manajemen sebelum "Quotation Terkirim"** — `pindahBoleh()` satu tempat, dipakai drag kanban DAN pemilih tahap. — bukti: `:6297-6316`.
4. **Bukti transfer WAJIB saat Catat Pembayaran** (baru; pembayaran lama tanpa bukti ditanya sekali, tidak dikunci). — bukti: `:10975-11004`.
5. **DP sudah dibayar wajib rekening + tanggal + bukti**; centangnya melahirkan baris pembayaran (`dpFormSinkron`), dan menghapus baris itu melepas centangnya. — bukti: `:10271-10335`,`:11021-11033`.
6. **Client yang masih punya event TIDAK BISA dihapus** (ditolak, bukan diperingatkan). — bukti: `:5971-6015`.
7. **Hapus permanen menuntut nama diketik persis** (normalisasi spasi/nbsp, case-insensitive) — berlaku client & event. — bukti: `:5984-6031`,`:6373-6416`.
8. **Kunci meja di Reservasi milik modul Reservasi** — hapus event WAJIB melepas baris `ev-<id>`; kegagalan dilaporkan. Denah Marketing mengikuti Reservasi (denah tanggal > template edit > bawaan; Minggu akhir pekan; Lantai 2 `layoutOverrides2`); lock H-3 jam; `jam` kosong = sehari penuh. — bukti: `:6423-6438`; `CLAUDE.md:6461-6500`.
9. **`today()` pakai jam dinding lokal (WIB), bukan UTC** — `toISOString()` pernah membuat event pagi hari dianggap kemarin. — bukti: `:3452-3473`.
10. **Tahap pipeline selalu boleh naik**, hanya diingatkan bila data dasar kurang (tidak menahan). — bukti: `:6449-6472`.
11. **`Event Done` tidak punya kolom kanban**; ditutup manual atau otomatis H+2. — bukti: `:3508-3513`.
12. **Satu event satu kategori to-do = Format F&B**; divisi jadi sub kategori. — bukti: `:5222-5242`.
13. **`designreqs` & `vip` disimpan per baris di server** (bukan `put_setting` timpa buta); `_versi` WAJIB ikut menghitungnya. Sepuluh Reservasi VIP pernah hilang karena pelanggaran ini. — bukti: `CLAUDE.md:12409-12470`,`:13234-13290`.
14. **Cache localStorage gagal tidak boleh menghentikan penyimpanan server** (`simpanCache()` ber-`try/catch`, lapor sekali per sesi); kuota 5MB pernah menghentikan seluruh `save()`. — bukti: `CLAUDE.md:10583-10630`.
15. **Status tahap & pengakuan omset punya konsekuensi lintas modul**: `tetap` = kasir dipotong di Finance; `ditempat` = omset milik kasir. — bukti: `:10031-10047`,`CLAUDE.md:702-760`.
16. **Invoice tampil hanya `Confirmed/Deal/Event Done`**; Piutang (closing belum lunas) dipisah dari Potensi (penawaran belum diputuskan). — bukti: `:13152-13180`.
17. **Performa Omset/Bonus tidak menyalin rumus** — memakai `performa-bonus.js`; hak lihat Head vs self; gerbang di penggambar. — bukti: `:14731-14749`; `CLAUDE.md:12042-12090`.
18. **Bawaannya WAJIB tetap ketat** pada pemilih meja yang tidak menyerahkan `opts.duduk`. — bukti: `CLAUDE.md:1999-2035`.

## G. Ketergantungan lintas modul
- **Marketing → Konten (Request Design & Video):** Konten membaca `designReqs&aktif=1` / `designReq&id` dan menulis balik progres `designReqSet{status:'done',picNama}`; hanya di Design/Editing Queue. Konten juga menitipkan `designReqOpsi` (brand/kru/platform). v1: `GET /design-queue?active=1`, `GET /design-requests/{id}`, `PUT /design-requests/{id}/progress`, `PUT /design-options`; keempatnya terbuka `marketing|konten` (G-16, laksamana-api#190) (`_lintas-modul.md:41-42`; `:15551`,`:15643`).
- **Marketing ← Konten:** daftar Brand/PIC kini dibaca dari `GET /api/v1/konten/design-options` (G-16); dulu langsung dari `konten-api-mysql?action=getAll` (`:15626-15643`).
- **Marketing → BD (`addPo`):** baris kebutuhan masuk papan Purchasing BD berstatus **Diajukan**; Marketing membaca balik status via `GET /api/v1/bd/...`; v1 `POST /api/v1/bd/purchase-orders/batch` (`_lintas-modul.md:48`; `:13847`,`:14083-14100`,`:13980-13998`).
- **Marketing ↔ Event:** Kalender Marketing membaca acara EMS dari `event-api-mysql?action=getAll` (`:12062-12075`) dan menampilkannya sebagai pita terpisah (tak bisa disunting dari Marketing) (`:12310-12314`).
- **Marketing ↔ Reservasi:** Reservasi VIP mengunci meja ke modul Reservasi lewat `reservasi-api-mysql?action=saveAll` (baris `ev-<id>`, `vip-<id>`); denah satu sumber `venue-layouts.js`; lock H-3 jam (`:14941-15060`; `CLAUDE.md:6461-6500`).
- **Marketing → Finance:** `eventsHari` (`GET /events-on/{date}`) dipakai Finance Omset → Breakdown Sumber; kunci meja & DP event dibaca halaman Dana Masuk (`README backend:11-14`; `:12062`).
- **Marketing ← Finance:** request Invoice resmi & Kwitansi (`finance-api-mysql`, tabel `inv_kwitansi`) (`:13324-13398`,`:16745-16860`).
- **Marketing ← Kompas:** Performa Omset & Bonus menarik `performaDivisi{divi:'marketing'}`; mesin hitung `performa-bonus.js` (dipakai juga Finance/Kas) (`:14410-14706`).
- **Marketing ← Office/Account:** `listDivisiRoster` & `listModuleRoster{module:'marketing'}` untuk Data Pegawai & role (`:3613-3690`); identitas sesi `lm_session`.
- **Marketing ← Stock:** kalkulator membaca HPP & items (`stock-api-mysql/hpp.php`,`items.php`) (`:18945-18959`).
- **Radar & Analytics membaca Marketing:** `getAll` Marketing dipakai Kompas (agenda investor) & Radar (`docs/modules/marketing.md:10-14`).
- **Aset bersama:** `assets/venue-layouts.js` (denah meja), `assets/kwitansi-sheet.js` (lembar kwitansi/bukti), `assets/hpp-mesin.js` (kalkulator), `assets/performa-bonus.js` (Performa Omset) — dipakai di marketing (`:6,:9,:12,:16`). TIDAK memakai `performa-konten.js`, `cocok-bri.js`, `xlsx-baca.js`.

## H. Catatan untuk implementasi Vue
- Halaman: `app/pages/marketing/index.vue` (dashboard) + subfolder per layar: `crm/index.vue`, `pipeline/index.vue`, `event/[id].vue`, `vip/index.vue`, `designreq/index.vue`, `kalkulator/index.vue`, `invoices/index.vue`, `approvals/index.vue`, `purchasing/index.vue`, `perfomset/index.vue`, `reports/index.vue`, `tasks/index.vue`, `templates/index.vue`, `calendar/index.vue`, `katalog/index.vue`, `notifications/index.vue`, `staff/index.vue`, `settings/index.vue`, `timeline/index.vue`, `brief/index.vue`. `definePageMeta({ access:['marketing'] })`.
- Composable `useMarketing.ts`: `getState()`→`GET /state`; CRUD `clients/events/followups/approvals/users/staff/task-templates/task-categories/categories/notifications/vip/design-requests` (`/api/v1/marketing/<resource>`); documents `settings/baseline/rolePerms/roleNav/menuDb/katalog/fbFormats/fbSubs/roleAcc`; `eventsOn(date)`→`/events-on/{date}`; `dp(from,to)`→`/dp`; `designQueue()`, `setDesignProgress()`, `designOptions()`; `uploadFile()`/`uploadChunk()`/`fileUrl(key)`; aktivitas `GET/POST /activities`. Semua lewat `useApi()` + `apiErrorMessage(e)`; tulis pakai `If-Match` dari `meta.version`.
- **Blob → per-baris:** ganti `saveAll`/`buildPayload` dengan mutasi resource tunggal; simpan `version`/`etag` di state untuk tulis. `bentrok[]` lama → tangani `409 version_conflict` (ambil `error.details.current`) & tampilkan dialog "Sebagian Perubahan Tidak Tersimpan".
- **Rumus uang JANGAN ditulis ulang dari nol** — port `eventFinance()`/`eventSubtotal()`/`eventFbCost()`/`fbDealTotal()` (`:4416-4524`) apa adanya ke util/composable; sertakan `invStatus()`, `pendapatanPerBulan()`, `papanClosing()`, `calTotalPax()`.
- **HP vs desktop:** `UTable` hanya `lg+`; di HP semua tabel (CRM, event, invoice, VIP, designreq, staff, timeline, notifikasi, kalkulator) jadi `AppList`/`AppListRow`. Form detail event (banyak field, tab) → `ResponsiveSheet` per seksi (atau halaman penuh dengan tab horizontal scroll). Modal client/event/pembayaran → `ResponsiveSheet`.
- **Kanban & drag-drop:** pertahankan 6 kolom `PIPE_COLS`, tapi di HP tumpuk vertikal; konfirmasi pindah tahap wajib (toast lama "Pindah ke X?").
- **Widget Beranda yang cocok:** Event Hari Ini, DP Pending, Upcoming 7 Hari, Follow Up Hari Ini, Pendapatan 6 Bulan, Closing Bulan Ini. Dashboard Marketing bisa menjadi salah satu panel Beranda.
- **Elemen lama yang melanggar DESIGN.md → padanannya:** kartu angka besar `.grid.g-4`/`stat()` di banyak layar (Dashboard, Invoices, VIP, Reporting, Staff, Designreq) → ringkas jadi ringkasan teks/`AppStatus`; grafik batang custom `rvchart` → grafik Nuxt UI; emoji dipakai di segmen (`🧮 Semua` `:14776`, `🎨/🎬` `DR_JENIS`) → ikon Nuxt UI; warna hex/hardcoded (`--gold`, `--violet`, `color-mix`) → token Nuxt UI; `.seg`/chip PIC custom → `UButtonGroup`/`AppStatus`. Warna kuning sebagai teks (`--gold-deep`) hanya untuk aksen "sekarang".

## I. Pertanyaan terbuka
- [x] **marketing / kalkulator** — ✅ **Selesai (G-09, laksamana-api#184):** disimpan sebagai dokumen `documents/kalkHistori`; Vue memakai `GET/PUT` dengan `If-Match` content hash. Bukti: `deploy/marketing/index.html:2322,19315`; `docs/api/marketing.md:58`.
- [ ] **marketing / boot** — `action=stats` & `action=ping` tidak punya padanan v1. Apakah CI/health-check tetap butuh, atau dihapus? Bukti: `deploy/marketing/index.html:2971-2981` (getAll); `marketing-mysql/api.php:73-78`.
- [ ] **marketing / seluruh modul** — Kontrak v1 memakai CRUD per-baris (If-Match) sementara frontend lama memakai blob `saveAll` + `bentrok[]`. Apakah Vue boleh tetap mengirim satu blob (mis. `PUT /state`)? Tidak ada endpoint `PUT /state` di kontrak. Bukti: `docs/api/marketing.md:43-54,67`.
- [ ] **marketing / event** — `saveAll` memiliki mekanisme hapus `hapus_yang_hilang` dibatasi `_sejak`; v1 DELETE per baris. Apakah event/pembayaran yang dihapus di v1 perlu meniru audit trail `bentrok`? Bukti: `docs/modules/marketing.md:65-68`.
- [ ] **marketing / staff** — Roster & role diturunkan dari Office (`listDivisiRoster`/`listModuleRoster`) yang tidak ada di kontrak v1 marketing; apakah Vue memakai `/api/v1/account/*` langsung? Bukti: `:3613-3690`; `_lintas-modul.md:40`.

## Konsolidasi untuk README & berkas bersama

### Baris `README.md`
```
| marketing | [marketing.md](marketing.md) | ⚠️ selesai dengan celah | 23 (3 tersembunyi) + detail event | 2 ❌ · 8 ⚠️ | 5 | 20.365 baris; CRM+Event+VIP+Design+PO; blob saveAll → CRUD per-baris; `addPo` ke BD; `performa-bonus.js`/`hpp-mesin.js` |
```

### `_pertanyaan.md` (bullet)
- [x] **marketing / kalkulator** — ✅ **Selesai (G-09, laksamana-api#184):** riwayat disimpan sebagai dokumen `documents/kalkHistori` (legacy `extra:kalkhistori`); Vue membaca/menulis lewat `GET/PUT` dengan `If-Match` content hash. Konteks lama: kalkulator menyimpan riwayat bernama (menu, porsi, harga jual, pax, deal) — modal TIDAK disimpan. Bukti: `deploy/marketing/index.html:2322,19315`; `laksamana-api/docs/api/marketing.md:58`.
- [ ] **marketing / boot** — `action=stats` & `action=ping` tidak punya padanan v1. Konteks: `ping` mengembalikan `identitas()`/`LIB_VERSI` yang diperiksa CI; tidak ada endpoint `/stats`/`/ping` di kontrak. Bukti: `marketing-mysql/api.php:73-78`; `docs/modules/marketing.md:9`. Opsi: A) tambah endpoint diagnosa v1; B) hapus dari Vue.
- [ ] **marketing / seluruh modul** — Kontrak v1 memakai CRUD per-baris (`If-Match`) sementara frontend lama memakai blob `saveAll` + `bentrok[]`. Konteks: tidak ada `PUT /state` di kontrak; penjaga anti-timpa per baris (409 `version_conflict`) menggantikan `bentrok[]`. Bukti: `docs/api/marketing.md:43-54,67`. Opsi: A) Vue pakai CRUD per-baris; B) kontrak tambah `PUT /state`.
- [ ] **marketing / event** — `hapus_yang_hilang` lama dibatasi `_sejak`; di v1 hapus per baris (`DELETE`). Konteks: perilaku hapus massal vs per-baris bisa berbeda. Bukti: `docs/modules/marketing.md:65-68`.
- [ ] **marketing / staff** — Roster & role diturunkan dari Office tanpa padanan di kontrak v1 marketing. Konteks: `listDivisiRoster`/`listModuleRoster{module:'marketing'}`. Bukti: `deploy/marketing/index.html:3613-3690`. Opsi: A) Vue pakai `/api/v1/account/*`; B) tambah endpoint di marketing.

### `_lintas-modul.md` (baris untuk ditambahkan/diverifikasi)
```
- **Marketing → Konten (Request Design & Video)** (VERIFIED): Konten MEMBACA `designReqs&aktif=1`/`designReq&id` dan menulis balik progres `designReqSet{status:'done',picNama}`; hanya di Design & Editing Queue, TIDAK di Shooting. v1: `GET /api/v1/marketing/design-queue?active=1`, `GET /api/v1/marketing/design-requests/{id}`, `PUT /api/v1/marketing/design-requests/{id}/progress`; ketiganya + `PUT /api/v1/marketing/design-options` terbuka `marketing|konten` (G-16, laksamana-api#190) (`deploy/marketing/index.html:15551`; `docs/api/marketing.md:20,70`). Marketing kini membaca `GET /api/v1/konten/design-options` untuk daftar Brand/PIC (`docs/api/konten.md` §Design options).
- **Marketing → BD (Purchase Order)** (VERIFIED): Marketing mengirim PO ke BD lewat `addPo` berstatus **Diajukan** lalu membaca balik status dari papan BD (`bd-api-mysql`, `deploy/marketing/index.html:13847`,`:14083-14100`,`:13980-13998`; v1 `POST /api/v1/bd/purchase-orders/batch`).
- **Marketing ↔ Event** (VERIFIED): Kalender Marketing membaca acara EMS lewat `event-api-mysql?action=getAll` dan menggambarnya sebagai pita terpisah (tak bisa disunting) (`deploy/marketing/index.html:12062-12075`,`:12310-12314`).
- **Marketing ↔ Reservasi** (VERIFIED): Reservasi VIP mengunci meja ke modul Reservasi (`reservasi-api-mysql?action=saveAll`, baris `ev-<id>`/`vip-<id>`); denah satu sumber `deploy/assets/venue-layouts.js`; lock H-3 jam; `jam` kosong = sehari penuh (`deploy/marketing/index.html:14941-15060`; `CLAUDE.md:6461-6500`). Hapus event melepas kunci meja (`:6423-6438`).
- **Radar & Analytics ← Marketing**: Radar & Kompas membaca `getAll` Marketing (agenda investor/agenda promo) (`docs/modules/marketing.md:10-14`).
- **Marketing → Finance**: `eventsHari` (`GET /events-on/{date}`) dipakai Finance Omset → Breakdown Sumber; DP event & kunci meja masuk halaman Dana Masuk (`docs/api/marketing.md:68`).
- **Marketing ← Kompas**: Performa Omset & Bonus menarik `performaDivisi{divi:'marketing'}` dan memakai mesin `deploy/assets/performa-bonus.js` (`deploy/marketing/index.html:14410-14706`).
- **Aset bersama `deploy/assets/performa-bonus.js`**: dipakai `deploy/finance/kas/` DAN modul Marketing (Performa Omset & Bonus, `deploy/marketing/index.html:16`,`:14731-14749`).
- **Aset bersama `deploy/assets/hpp-mesin.js`**: dipakai modul Marketing (Menu Kalkulator) — rumus modal HPP dibangkitkan dari modul HPP (`deploy/marketing/index.html:12`,`:18939-18970`).
- **Aset bersama `deploy/assets/venue-layouts.js` & `kwitansi-sheet.js`**: venue-layouts (denah meja VIP/event) dan kwitansi-sheet (lembar kwitansi/bukti) dipakai Marketing (`deploy/marketing/index.html:6`,`:9`,`:16774`). Marketing TIDAK memuat `performa-konten.js`, `cocok-bri.js`, atau `xlsx-baca.js`.
```

## J. Progres build
Issue: #16, dipecah #58–#63 · Branch saat ini: `migrasi/marketing-sistem` (#63, PR #97) · Mulai: 2026-10-07
LANJUTKAN DARI: #63 selesai (menunggu review PR #97). Seluruh layar Marketing sudah ⬜→✅ di cabang masing-masing; sisa: uji cutover K + tindak lanjut API (izin baca HPP untuk modul marketing). G-09 (riwayat kalkulator) selesai di branch `migrasi/marketing-g09-kalkhistori`.

| layar (key) | file | status | endpoint dipakai | sub-issue |
|---|---|---|---|---|
| dashboard | `app/pages/marketing/dashboard.vue` | ✅ | `GET /marketing/state`, `POST /marketing/clients` (Lead Baru) | #58 — (koreksi build) Pendapatan Bulan Ini membandingkan bulan+tahun; lama hanya bulan, jadi Oktober tahun-tahun lalu ikut terjumlah |
| crm | `app/pages/marketing/crm.vue` (+ `MarketingClientForm`, `MarketingClientDetail`, `MarketingFollowUp`) | ✅ | `POST/PATCH/DELETE /marketing/clients`, `DELETE /marketing/followups/{id}`, `POST /marketing/followups`, `PATCH /marketing/events/{id}`, `POST /marketing/activities` | #58 — ekspor/impor CSV sama kolom & aturan; hapus ditolak bila masih memegang event |
| pipeline (+ events) | `app/pages/marketing/pipeline.vue` (+ `MarketingEventBaru`) | ✅ | `POST /marketing/events` (+ `POST /clients` isi cepat), `PATCH /marketing/events/{id}` (tahap) | #58 + #60 — (koreksi build) seret kartu kini butuh `edit_event`; lama tidak memeriksa izin. HP: kolom ditumpuk + "Pindah tahap". Tombol Internal/Client/Draft diaktifkan (#60; dijanjikan #59) |
| calendar | `app/pages/marketing/calendar.vue` | ✅ | `GET /marketing/state`, `GET /event/events?from&to`, `GET /reservasi/reservations?from&to` | #58 — (koreksi build) tanggal acara EMS = tanggal lokal `start_datetime`; lama memotong string UTC |
| event (detail) | `app/pages/marketing/event/[id].vue` (+ `MarketingEventForm`, `MarketingFinanceEvent`, `MarketingBayarSheet`→dalam Finance, `MarketingPenawaran`, `MarketingMejaKunci`, `MarketingBarisTabel`, `app/utils/marketing-event.ts`) | ✅ | `GET /marketing/state`, `PATCH /marketing/events/{id}` (If-Match), `POST /marketing/files`, `POST /marketing/files/chunks`, `PUT /marketing/documents/settings` (kwSeq), `POST /marketing/notifications`, `GET/POST/PUT/DELETE /reservasi/reservations` (kunci `ev-<id>`), `DELETE /marketing/events/{id}` | #59 — form bertab 1/2/3/4 atas EVENT_SCHEMA D.1–D.11 + visibilitas div/fin; Finance: Rincian + Sisipkan FREE & TBC, ketentuan, centang DP (sinkron baris, bukti wajib), riwayat + Catat Pembayaran (default sisa DP → sisa), kwitansi `KW/…` dari kwSeq, pratinjau + cetak, Kirim Invoice / Reminder DP via WA; Penawaran: PDF 40MB chunks, approval, kirim (tahap → Quotation Terkirim), revisi (→ Prospect + Negosiasi Lanjutan), Konfirmasi Deal; hapus ketik-nama + lepas kunci dulu; brief tersembunyi Internal/Client/Draft + cetak |
| brief | `app/pages/marketing/brief/index.vue` | ✅ | `GET /marketing/state` | #59 — tabel + tombol Internal/Client/Draft per baris; mode quote = template negosiasi, bukan surat resmi; PDF unggahan sendiri dibuka bila ada |
| invoices | `app/pages/marketing/invoices.vue` (+ `MarketingSlotInv`) | ✅ | `GET /marketing/state`, `GET /finance/invoices/status?res=`, `POST /finance/invoices/requests`, `GET /finance/invoices/file/{resId}` | #60 — hanya Confirmed/Deal/Event Done (F.16); 4 kartu + tab Semua/Lunas/Sudah DP/Belum Payment; nomor resmi dari Finance (pelunasan dulu); request DP/pelunasan + PDF resmi; Catat = ke tab Finance event |
| approvals | `app/pages/marketing/approvals.vue` | ✅ | `GET /marketing/state`, `PATCH /marketing/events/{id}` (penawaran), `PATCH /marketing/approvals/{id}`, `POST /marketing/notifications` | #60 — penawaran + negosiasi satu daftar; 3 kartu; hanya Manager/Approver memutus; tolak negosiasi → Lost |
| reports | `app/pages/marketing/reports.vue` | ✅ | `GET /marketing/state` | #60 — per kategori + TOTAL + rata-rata; Export CSV seluruh event (BOM + sep=) |
| notifications | `app/pages/marketing/notifications.vue` | ✅ | `GET /marketing/state`, `PATCH /marketing/notifications/{id}` | #60 — pengingat live (DP, H-7/H-0, FU hari ini, overdue) + riwayat; lonceng shell + lencana belum dibaca |
| timeline | `app/pages/marketing/timeline.vue` | ✅ | `GET /marketing/state` | #60 — tabel sortir + pager; Bersihkan Log = Segera (v1 tanpa hapus massal) |
| vip | `app/pages/marketing/vip.vue` (+ `MarketingVipForm`, `MarketingVipKunci`) | ✅ | `GET /marketing/state`, `POST/PATCH/DELETE /marketing/vip`, `POST /marketing/files` (bukti DP), `GET /marketing/files/{key}`, `GET /reservasi/master/tables`, `GET /reservasi/reservations?from&to`, `GET/POST/PUT/PATCH/DELETE /reservasi/reservations/{id}` (baris `vip-<id>`, If-Match) | #61 — 5 segmen jenis (bawaan Regular & Assisted tanpa batal) + keterangan saringan; Isi Nominal di kolom Nominal hanya bila kosong; ikon Detail/Ubah/Batalkan/Buka kembali/Hapus; strip `vip-yatim` + Pulihkan; pemilih meja = daftar meja Reservasi (bukan denah) |
| designreq | `app/pages/marketing/designreq.vue` (+ `MarketingReqForm`) | ✅ | `GET /marketing/state`, `POST/PATCH /marketing/design-requests`, `GET /marketing/design-queue` (progres), `GET /konten/design-options` (opsi brand/PIC) | #61 — G-16 (laksamana-api#190): opsi dari endpoint sempit Konten (open `marketing|konten`); kegagalan = pita + Coba lagi; Batalkan menyimpan jejak (`batalAt`), tidak menghapus |
| tasks | `app/pages/marketing/tasks.vue` (+ `MarketingItemTugas`) | ✅ | `GET /marketing/state`, `PATCH /marketing/events/{id}` (`jobProgress`, `jobMeta`, `extraJobs`, If-Match) | #62 — kartu event (Confirmed/Deal/Event Done s.d. H+2) lalu papan di `?event=`; satu kategori = Format F&B, divisi = sub kategori; tanpa format = Tugas Bebas; user operational hanya melihat sub divisinya; reminder WA ke PIC |
| templates | `app/pages/marketing/templates.vue` (+ `MarketingTemplateForm`, `MarketingTabelTemplate`) | ✅ | `GET/PUT /marketing/documents/fbFormats`, `GET/PUT /marketing/documents/fbSubs`, `POST/PATCH/DELETE /marketing/task-templates`, `PATCH /marketing/events/{id}` (ubah nama / pindah kategori) | #62 — kartu per format (bawaan tertutup, per browser), Salin dari, ubah nama, sub kategori + urutan (seret di desktop, ↑/↓ di mana saja), kategori lama + Pindahkan |
| katalog | `app/pages/marketing/katalog.vue` (+ `MarketingKatalogShow`, `MarketingGambar`) | ✅ | `GET/PUT /marketing/documents/katalog`, `POST /marketing/files`, `GET /marketing/files/{key}` (blob ber-token) | #62 — kartu + ↑/↓ + Edit/Hapus; presentasi layar penuh (← → Spasi, C, P 6 detik, F, Esc) |
| purchasing | `app/pages/marketing/purchasing.vue` | ✅ | `POST /bd/purchase-orders/batch`, `GET /bd/purchase-orders` | #62 — v1 mengunci keduanya dengan modul `bd` (lama terbuka): pemegang Marketing saja kena 403 → pita + Coba lagi; celah API dilaporkan |
| kalkulator | `app/pages/marketing/kalkulator.vue` (+ `MarketingKalkPilih`, `app/utils/hpp-mesin.ts`, `app/utils/marketing-kalk.ts`) | ✅ | `GET /stock/hpp/recipes`, `/stock/hpp/ingredients`, `/stock/hpp/settings`, (admin) `/stock/products`, `GET/PUT /marketing/documents/kalkHistori` | #63 — menu = resep Prasmanan aktif lewat mesin HPP (tanpa salin rumus); pemilih kategori + cari, =pax, rasio per pax, total per satuan, deal → diskon/markup; modal/porsi khusus admin (koreksi build: sel modal lama tidak pernah tergambar). Riwayat perhitungan bernama = `documents/kalkHistori` (#105/G-09): simpan/buka/hapus, harga HPP yang berubah disebut. API 403 untuk akun yang hanya punya modul marketing → pita + Coba lagi |
| perfomset | `app/pages/marketing/perfomset.vue` (+ `MarketingBonusSkema`, `app/utils/marketing-performa.ts`) | ✅ | `GET /kompas/performa/marketing?from&to`, `GET /account/roster`, `PATCH /marketing/events/{id}` (`nominalDiakui`), `PATCH /marketing/vip/{id}` (`nominal`) | #63 — pbAgregasi + bonusMarketing diimpor (F.17); Head (kata utuh, pbHead) / admin modul lihat semua, lainnya Semua + diri; gerbang di `pid`; Daftar Event dari modul ⨝ breakdown lewat srcId, 5/hal, Kontribusi hari itu; kartu Skema 1–4 |
| staff (+ users) | `app/pages/marketing/staff.vue` (+ `app/utils/marketing-pegawai.ts`) | ✅ | `GET /account/roster`, `GET /account/modules/marketing/members`, `POST/PATCH /marketing/users`, `GET/PUT /marketing/documents/roleAcc` | #63 — sinkron roster otomatis saat halaman dibuka (basi 5 menit / gagal); role dari Tim Office (ROLE_JABATAN), admin modul → Super Admin, anggota gagal dibaca = role tak disentuh; Ubah No. HP, Hak Akses per orang (+ reset), matriks role (Super Admin terkunci, dashboard min Lihat) |
| settings | `app/pages/marketing/settings.vue` | ✅ | `GET/PUT /marketing/documents/settings`, `POST /marketing/files`, `GET /marketing/files/{key}` | #63 — 8 baris aturan + Simpan (baca-ubah-tulis berhash, kwSeq & galeri tak tertimpa); Akun aktif + Keluar ke Office; 9 poin konfirmasi; Galeri Venue unggah (gambar ≤8MB) / hapus |

Catatan build:
- Fondasi #58: `app/utils/marketing.ts` (konstanta, tipe, matriks izin `ACTION_VIEW`/`legacyEditRules`/`roleAcc`/`u.acc`, pipeline, CRM & CSV, mesin tabel), `app/utils/marketing-uang.ts` (port apa adanya `eventFinance`, `eventFbCost`, `rinciTotalBayar`, `rincianPenawaran`, `invStatus`, `pendapatanPerBulan`, `papanClosing`), `app/utils/status-marketing.ts`, `app/composables/useMarketing.ts` (satu `GET /state` bersama, CRUD per record dengan If-Match = `updatedAt`; tab DP Event tetap di sini), `app/utils/layar/marketing.ts`, entri shell. Uji: `node tools/uji-marketing.mjs` (55 cek; 13 mutasi tertangkap).
- Fondasi #59: `app/utils/marketing-event.ts` (EVENT_SCHEMA D.1–D.11, tab, visibilitas div/fin, `sinkronDpMkt`, `bawaanBayarMkt`, `sisaSesudahMkt`, `noKwitansiMkt`, `bayarBaruSahMkt`, `noSuratBaruMkt`, `ringkasHapusMkt`, `kunciTanggalSalahMkt`, `selesaiRundownMkt`, `ringkasNilaiMkt`, teks WA, `buildBriefDocMkt`). Uji: `node tools/uji-marketing-event.mjs` (28 cek; 1 mutasi tertangkap).
- #59 menambah ke `useMarketing.ts` (tanpa mengubah pola lama): `unggahBerkasMkt` (`POST /files`), `unggahChunkMkt` + `unggahBertahapMkt` (`POST /files/chunks` ~2MB), `urlBerkasMkt` (`GET /files/{key}`), `getDokumenMkt`/`simpanDokumenMkt`/`versiDokumenMkt` (`PUT /documents/settings` untuk kwSeq), `resIdKunciMkt` + `lepasKunciMejaMkt` (baris `ev-<id>` di Reservasi, 404 = sudah bebas); tipe `PenawaranMkt` + `receiptUrl/verified/by/dariDpForm` di `PembayaranMkt`.
- Kunci meja di D.1: daftar meja dari `GET /reservasi/master/tables` + hunian hari itu dari `GET /reservasi/reservations?from&to`; tulis `POST` (baru) / `PUT` (ada) baris `ev-<id>`; gagal = toast + tidak ada yang berubah (seperti "Reservasi tidak terjangkau" di lama). Kunci pindah tanggal tanpa kunci ulang = peringatan merah (tidak dipindah otomatis, seperti lama).
- Bukti DP & pembayaran diunggah SEGERA saat berkas dipilih (pola `dpBuktiPilih` lama); berkas yatim dibuang server 7 hari bila tab tidak disimpan.
- Nomor kwitansi dari `kwSeq` settings: nomor dipakai saat baris lahir, `kwSeq` dinaikkan lewat `PUT /documents/settings`; gagal menaikkan tidak menggagalkan simpan (cek duplikat di cutover K).
- Fondasi #60: `app/utils/marketing-keuangan.ts` (layakTagih F.16, rekap + tab bayar, resId `mkt:<id>:dp|lunas`, nomor resmi pelunasan-dulu, praPelunasan, ringkasInv, barisApproval pen+nego, laporan + CSV, pengingat live, linkNotif, labelJenis, lalu). Uji: `node tools/uji-marketing-keuangan.mjs` (18 cek; 1 mutasi tertangkap).
- #60 menambah ke `useMarketing.ts`: `tandaiDibacaMkt` (PATCH notifikasi), `useLencanaMkt` (lonceng shell); memakai `mintaKwitansi`/`statusKwitansi`/`berkasKwitansi` milik Finance (tidak disalin). Bentuk notif diselaraskan ke lama (`type/title/body/link/read/at`); panggilan revisi #59 diperbaiki mengikuti bentuk ini.
- Lonceng shell Marketing + lencana belum-dibaca ditulis di entri `// ── marketing ──` milik sendiri di `modul-shell.ts` (§4 TIM-A).
- "Bersihkan Log" = Segera: v1 tanpa hapus massal dan baris log tidak membawa versi (tombol nonaktif + alasan).
- Catat pembayaran dari layar invoices mengarah ke tab Finance event (lembar yang sama dengan #59), bukan modal ganda.
- `normalizeState` lama dijalankan di memori saat membaca (`normEventMkt`, `normRoleAccMkt`, `staff` → `users`): event yang belum pernah disimpan ulang sejak migrasi lama tetap memberi Grand Total yang sama dengan Office lama. Server tidak disentuh sampai baris itu disimpan.
- `autoCloseEvents` (Deal/Confirmed H+2 → Event Done) dijalankan sekali per sesi saat modul dibuka, satu PATCH berversi per event; penolakan diam seperti simpan latar lama.
- Identitas: baris `users` dengan id Office lalu nama; belum ada → `marketing` di memori. Admin modul Office = Super Admin (seperti hasil sinkron roster lama). Sinkron roster → `POST /users` ikut Pegawai & Akses (#63).
- (koreksi build) Follow up dicap jam lokal; lama memakai `toISOString()` sehingga follow up sebelum 07:00 WIB tercatat kemarin dan tidak terhitung "Follow Up Hari Ini".
- (koreksi build) Client baru: Marketing PIC bawaan = diri sendiri bila termasuk daftar; lama mengambil nama pertama di daftar.
- Layar tanpa izin: `MarketingGerbang` menampilkan "Akses belum aktif" / "Akses ditolak" seperti `go()` lama.
- Fondasi #61: `app/utils/marketing-vip.ts` — VIP: angka & rekap, saringan jenis/periode, perusahaan dari CRM, `vip-yatim` + pulihkan, catatan kunci (tulis/baca per posisi), dps + gabung (cicilan kru & verifikasi tetap), baris Reservasi `vip-<id>`, jendela kunci meja `mejaTerpakaiVipMkt` (±3 jam dari jam booking, lintas hari, tamu duduk = check-in + 180 menit, batal/pulang/tanpa jam membebaskan), status buka-kembali; Request: status/kategori/saringan, prioritas, sisa deadline, gerbang foto & link. Uji: `node tools/uji-marketing-vip.mjs` (43 cek; 39 mutasi tertangkap).
- #61 tipe `VipMkt`/`RequestDesainMkt`/`BuktiVipMkt`/`DpVipMkt` di `marketing.ts`. Nama `ReqDesainMkt` & `opsiDesainMkt` sudah dipakai `konten.ts` (auto-import bertabrakan), jadi sisi Marketing memakai `RequestDesainMkt` & `bacaOpsiDesainMkt`.
- (koreksi build) Progres request dibaca dari `GET /design-queue` TANPA `active=1`: dengan `active=1` API membuang yang sudah `done`, sehingga "Sudah Selesai" selalu 0.
- Pemilih meja VIP memakai aturan `rsvMejaTerpakai` lama apa adanya: reservasi Cancelled/No-show/pulang tidak memegang meja, hunian dibaca ±1 hari, jendela per jam booking (bukan sehari penuh).
- Kunci meja mengganti baris Reservasi yang sudah ada dengan `PUT` + If-Match (versi baris itu); tanpa versi API menjawab 428.
- Foto referensi request dikecilkan di peramban (`kecilkanGambarKonten`, 1280px JPEG) sebelum disimpan; bukan gambar / >2MB dilewati dengan alasan; total 6MB per request dihitung bersama foto yang sudah ada. Link tanpa `https://` dirapikan, link ganda ditolak.
- "Buka kembali" VIP batal (`vipBukaLagi` lama, tidak tercantum di D.14 tapi ada di lama) ikut dibawa: ditolak dengan nama meja yang bentrok bila mejanya sudah dipesan tamu lain.
- Belum dibawa: denah visual `venue-layouts.js` (pemilih meja berupa daftar tombol meja), kwitansi resmi VIP (`:16684`), estimasi lama duduk dari `master.dineEstMin` (dipakai 180 menit bawaan lama).
- Fondasi #62: `app/utils/marketing-tugas.ts` (kategori org/lama, item event = template + tambahan, progres 0–100 dijepit, field per event menimpa template, hitungan & sub siap, urutan papan, tulis papan, WA, rencana ubah nama / salin / pindah / urut sub / hapus) dan `app/utils/marketing-operasional.ts` (PO: akhir minggu, rupiah ketik, baris → batch, saring & warna status; Katalog: gerbang gambar 8MB, judul dari nama berkas, geser, indeks berputar). Uji: `node tools/uji-marketing-tugas.mjs` (52 cek; 39 mutasi tertangkap).
- Papan Task Divisi menulis per perubahan (`PATCH /events/{id}` field teratas + If-Match), bukan seluruh state seperti `save()` lama. `genTasks` tidak lagi menulis saat halaman dibuka (lama: tiap render menyimpan); `tasks` per kategori tetap dibuat saat Deal (`tugasDealMkt`, #58).
- `categories` berisi string tidak terbawa v1 (state hanya mengembalikan baris objek), jadi daftar divisi = bawaan + `taskCategories` — sama dengan yang dilihat Office lama sesudah normalizeState. Hapus kategori lama tidak menulis `categories`.
- Ubah nama / pindah / salin kategori = beberapa tulisan berurutan (dokumen fbFormats, fbSubs dengan hash, baris template, baris event dengan versi). Lama: satu save(). Gagal di tengah → mktSimpan memuat ulang dan melapor; langkah yang sudah lewat tetap tersimpan (cek di cutover K).
- Gambar katalog dibaca sebagai blob ber-token (`gambarBerkasMkt`, cache per sesi) karena `/marketing/files` butuh Bearer; slide berikutnya dimuat di latar.
- Urutan sub kategori: seret (desktop) + tombol ↑/↓ (tambahan Vue supaya bisa di HP; seret HTML5 tidak jalan di layar sentuh).

- Fondasi #63: `app/utils/hpp-mesin.ts` (pabrik tipis di atas `stock-hpp.ts`: bawaan setting, migrasi harga_lama, salinan baris), `app/utils/marketing-kalk.ts`, `app/utils/marketing-performa.ts`, `app/utils/marketing-pegawai.ts`. Uji: `node tools/uji-marketing-kalk.mjs` (41 cek) + `node tools/uji-marketing-sistem.mjs` (59 cek); 41 mutasi tertangkap, 0 lolos.
- #63 menambah ke `useMarketing.ts`: `getPerformaMkt` (`GET /kompas/performa/marketing`), `tulisDokumenMkt` (baca-ubah-tulis dokumen berhash; 404 = belum pernah disimpan).
- (koreksi build) Kalkulator: kolom Modal / porsi kini benar-benar terisi untuk admin (lama: kepala kolom ada, selnya tidak pernah digambar).
- (koreksi build) Sinkron roster: baris yang cocok lewat nama TIDAK dipindah ke id Office (baris REST tidak bisa ganti id); yang lain sama. Pita menyebut perubahan yang tertolak, bukan mengaku tersinkron.
- Sinkron roster jalan saat halaman Pegawai & Akses dibuka (lama: tiap modul dibuka).
- Celah API (belum diajukan, menunggu jawaban): HPP `/stock/hpp/*` butuh modul ordering|purchasing|hpp|usage — akun yang hanya marketing kena 403 di Kalkulator. Riwayat kalkulator sudah tersedia (`documents/kalkHistori`, G-09 / laksamana-api#184).

## K. Daftar uji cutover
Uji silang Vue ↔ Office lama pada data yang sama (dev). Bagian #58:

- [ ] **uang** — ambil 10 event nyata (Rincian, kotak lama, fbDeal, pajak termasuk, DP nominal & %, centang DP, pembayaran melebihi DP): Grand Total, DP, Terbayar, Sisa, status invoice sama persis dengan Office lama.
- [ ] **dashboard** — 4 kartu, ubin status, Upcoming 7 hari, Pendapatan 6 bulan, Closing bulan ini sama angkanya (kecuali koreksi tahun di atas).
- [ ] **crm** — tiap saringan (cari, relasi, source) memberi baris yang sama; bintang VIP; ekspor CSV terbuka rapi di Excel id-ID; impor berkas hasil ekspor yang disunting → pratinjau benar, Terapkan tersimpan & tampil di Office lama; hapus client berevent ditolak, tanpa event butuh ketik nama.
- [ ] **follow up** — tiga tujuan (event terbuka, peluang baru, umum): tahap event bergerak sesuai hasil, Deal membuat task kategori, Deal/Lost mengosongkan next FU, client lastContact/nextFU benar.
- [ ] **pipeline** — PIC, ringkasan, seret kartu + konfirmasi; Quotation Terkirim ditolak bila penawaran belum disetujui; pengingat data dasar muncul tanpa menahan; Daftar Event: periode/bulan, status bawaan, cari, Reset, hitungan "x dari y".
- [ ] **event baru** — Pengakuan Omset kosong ditolak SEBELUM client cepat dibuat; client cepat masuk CRM sebagai Lead; PIC mengikuti aturan marketing/non-marketing.
- [ ] **kalender** — event lintas hari di semua harinya, saringan status (bawaan tanpa Lost), pax bulan ini, pita EMS & Reservasi; tanpa modul Event/Reservasi muncul peringatan + Coba lagi, event Marketing tetap tergambar.
- [ ] **akses** — role operational/finance/manager/marketing melihat menu sama dengan lama; override per orang berlaku; konflik versi (dua tab) memunculkan "Data sudah diubah orang lain".
- [ ] **detail** — tiap tab menyimpan D.1–D.11 dengan kolom & validasi wajib yang sama; seksi divisi yang tak berhak tidak tampil; operasional tidak melihat Finance & Overview-uang; progres isi/total per seksi; Simpan & Lanjut pindah ke Operasional.
- [ ] **finance** — Rincian + Sisipkan FREE & TBC, Discount/service/pajak, DP nominal + rekening + tanggal + bukti + centang (melahirkan 1 baris, Simpan kedua tidak menumpuk), Catat Pembayaran (default sisa DP → sisa; bukti wajib untuk baru, lama ditanya sekali), kwitansi `KW/…` berurut tanpa ganda, Kirim Invoice (invoiceSent → Sent) & Reminder DP (hanya bila ber-DP & kurang) membuka WA yang benar, pratinjau + cetak angkanya sama dengan Office lama.
- [ ] **penawaran** — PDF ≤40MB terunggah bertahap & terbaca; alur Draft → Menunggu Approval → Disetujui/Ditolak → Terkirim (tahap → Quotation Terkirim); kirim tanpa persetujuan ditolak; revisi (alasan wajib) → Prospect + antrian Negosiasi Lanjutan + riwayat putaran; Konfirmasi Deal membuat task divisi; nomor surat `NNN/PNW/LM/Romawi/Tahun` berurut.
- [ ] **brief** — tabel + pencarian sama; Internal/Client/Draft membuka dokumen yang benar; client tidak memuat internalNote/highlight; quote menyebut bukan surat resmi; cetak rapi satu halaman.
- [ ] **kunci & hapus** — kunci meja di D.1 tercatat sebagai baris `ev-<id>` di Reservasi & terlihat di sana; pindah tanggal memunculkan peringatan; Lepas Kunci membebaskan; hapus butuh ketik nama persis, melepas kunci dulu, gagal lepas dilaporkan + hapus manual; hapus event yang sudah terbayar diperingatkan dengan nomor kwitansi & totalnya.
- [ ] **invoice** — hanya Confirmed/Deal/Event Done tampil (Draft dihitung terpisah); 4 kartu + 4 tab angkanya sama; nomor resmi = Finance (pelunasan didahulukan); request DP/pelunasan idempoten, ditolak bisa request ulang; PDF resmi tercetak dengan nomor + penanda; gagal jangkau Finance = pita + Coba lagi.
- [ ] **approval** — penawaran (termasuk revisi = Negosiasi Lanjutan) + negosiasi harga satu daftar; 3 kartu; bukan approver hanya membaca; tolak negosiasi memindahkan event ke Lost + notifikasi; putusan penawaran tercatat di kartu detail.
- [ ] **reporting** — kartu + tabel kategori + TOTAL sama; Export CSV terbuka rapi di Excel id-ID (BOM + sep=).
- [ ] **notifikasi** — pengingat live (DP, H-7/H-0, FU hari ini + nurture, overdue) benar di hari yang sama; riwayat + badge lonceng + Tandai semua dibaca; klik baris membuka tujuan yang benar.
- [ ] **timeline** — urut + pager kolom Waktu/Oleh/Jenis; rujukan nama benar; Bersihkan Log tetap Segera sampai v1 punya hapus massal.
- [ ] **vip** — 4 kartu + peringatan tanpa nominal sama dengan lama; 5 segmen jenis & periode memberi baris dan hitungan yang sama; buat Assisted/Regular dengan DP + bukti → tampil di Office lama; Kunci meja menulis baris `vip-<id>` (Confirmed, dps, catatan) yang terlihat di modul Reservasi, cicilan yang dicatat kru Reservasi tidak hilang; meja tamu batal tidak lagi tampil terpakai; Batalkan → status Cancelled di Reservasi + meja bebas; Buka kembali → terkunci lagi, ditolak bila bentrok; Hapus → baris Reservasi hilang (tamu sudah datang: hanya ditandai batal); Isi Nominal masuk omzet; baris `vip-` tanpa pasangan muncul di strip + Pulihkan.
- [ ] **designreq** — request baru (brief, platform, foto & link) muncul di Design/Editing Queue Konten; Tandai Selesai di Konten → "Sudah Selesai" di sini dengan PIC & waktu; Ubah & Batalkan tersimpan (yang batal hilang dari antrian Konten); opsi brand/PIC terisi dari `GET /konten/design-options` (G-16), jatuh ke isian bebas bila Konten tak terbaca.
- [ ] **tasks** — kartu event & angka (x/y, %, sub siap) sama dengan lama; papan per format: centang, PIC/deadline/catatan per event (template tidak berubah), item tambahan per sub + hapus, Tugas Bebas untuk event tanpa format; user operational hanya sub divisinya; reminder WA berisi pesan yang sama; perubahan terlihat di Office lama.
- [ ] **templates** — tambah/ubah nama kategori (event pemakai ikut berganti format & progresnya tidak hilang), Salin dari (dua kali tidak menggandakan), hapus kategori; sub kategori tambah/ubah nama/hapus (item pindah ke tanpa sub) & urutan ikut di papan; item tambah/edit/hapus; kategori lama → Pindahkan (progres event format itu ikut); konflik versi dari dua tab tidak menimpa diam-diam.
- [ ] **katalog** — unggah banyak gambar (bukan gambar / >8MB ditolak), judul dari nama berkas, edit + ganti gambar, ↑/↓, hapus; presentasi layar penuh dengan semua pintasan; urutan sama dengan Office lama.
- [ ] **purchasing** — kirim baris (tanpa nama dilewati, event masuk catatan) masuk papan BD berstatus Diajukan; daftar "sudah dikirim" hanya dari Marketing & status ikut BD; akun Marketing tanpa modul bd: pita 403 (sampai celah API ditutup).

Bagian #63:

- [ ] **kalkulator** — menu & harga = Prasmanan aktif di HPP (harga lama dipakai bila harga baru kosong); kotak kategori + rentang harga; pilih/cabut lewat lembar; jumlah per satuan, total, harga jual/pax (dibulatkan), deal → selisih/diskon/markup & total deal sama dengan Office lama; admin melihat modal/porsi (= modul HPP), non-admin tidak; akun marketing-only → pita akses.
- [ ] **perfomset** — Realisasi, Jumlah Event, Compliment, Daftar Event (Nominal/Omset/Tax/Service/Diakui/Kontribusi), dan kartu Skema 1–4 sama dengan Office lama & panel Finance untuk bulan yang sama; Head/admin membuka tiap PIC, staf hanya Semua + diri (nama PIC tidak muncul di Semua); ubah Nominal event → nominalDiakui (kosong = pulihkan), VIP → nominal.
- [ ] **staff** — sinkron roster: pegawai baru, No. HP/Tim/aktif ikut Office, role ikut Tim (admin modul = Super Admin, Tim kosong = tidak disentuh); Ubah No. HP; Hak Akses per orang + reset; matriks role tersimpan & dipakai menu; Super Admin terkunci.
- [ ] **settings** — 8 nilai tersimpan & terbaca modul lama; kwSeq tidak mundur; galeri venue unggah/hapus tampil di Draft Negotiation.
