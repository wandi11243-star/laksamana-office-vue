# Modul Event: konsep & tampilan mengikuti Marketing

Status: **draf, menunggu persetujuan** · 2026-11-24
Repo: `laksamana-office-vue` (utama), `laksamana-api` (kecil: hak akses, log, saringan status)

Catatan aturan repo: AGENTS.md meminta layar dibangun sesuai Office lama. Untuk modul Event, permintaan owner
24 Nov 2026 menggantikannya: acuan layoutnya modul **Marketing di Vue**. Keputusan K-08 ("matriks hak akses tidak
disimpan") ikut dicabut oleh permintaan ini.

## 1. Kondisi sekarang (data produksi 24 Nov 2026, dibaca saja)

| Fakta | Dampak ke rencana |
|---|---|
| 55 event: 44 Event Done, 6 Upcoming, 5 Planning. **Prospect & Approval: 0**, pengajuan: 0 | Alur persetujuan belum pernah dipakai; tahap bisa disusun ulang **tanpa migrasi data** |
| Kategori: **49 dari 55 "Free"** | Kategori mencampur jenis acara dengan cara masuk; harus dipecah dua |
| Rundown terisi 2 event, vendor 1, budget 1, sponsor 1 | Form detail ada tapi tidak terpakai; ini yang "kurang detail" |
| Task: 55/55 hanya bawaan ("Design poster", "Book talent") | Daftar task bukan alat kerja nyata |
| Venue teks bebas: 5 ejaan untuk tempat yang sama, 6 kosong | Jadikan pilihan |
| 289 jadwal talent, **0 tertaut ke event** | Biaya talent per event belum bisa dihitung; perlu tombol tautkan |
| `co_pic` terisi di 9 event, tidak ada di form Vue | Tampilkan lagi |
| **Event lama masih dipakai harian** (log akses hari ini: 103 baca + 1 POST; API v1 Event: 17 permintaan, 0 tulis) | Kendala terbesar, lihat §2 |

## 2. Kendala: Office lama mengubah status yang tidak ia kenal

`laksamana-office/deploy/event/index.html:1472-1478`: saat dibuka, status di luar lima status lama
(Planning, Prospect, Approval, Upcoming, Event Done) diubah jadi **Planning** lalu bisa ikut tersimpan. Website tiket
(`TicketShop::sellable`) dan Homepage (`ELIGIBLE_STATUSES`) juga hanya mengenal `Upcoming`/`Today`.

Jadi: **nilai tersimpan `status` tidak ditambah.** Tahap baru dihitung dari data yang sudah ada lewat satu fungsi,
`tahapAcara(e)`, dan ditulis balik lewat satu fungsi, `isiTahap(tahap)`. Aman selama dua aplikasi hidup bersamaan.

## 3. Tahap pipeline

Tujuh tahap, sejajar dengan Marketing:

| # | Marketing | **Event** | Arti | Tersimpan sebagai |
|---|---|---|---|---|
| 1 | Lead | **Planning** | Ide/rencana baru | `status: Planning` |
| 2 | Prospect | **Prospect** | Konsep matang, detail diisi | `status: Prospect`, belum diajukan |
| 3 | Approval | **Approval** | Menunggu keputusan manajemen | `status: Prospect` + `pengajuan: Menunggu` |
| 4 | Quotation Terkirim | **Persiapan** | Disetujui, vendor/talent/promo jalan | `status: Approval` + `pengajuan: Disetujui` |
| 5 | Deal | **Upcoming** | Pasti jalan, boleh jual tiket & tampil di website | `status: Upcoming` |
| 6 | Event Done | **Event Done** | Selesai, data terkunci | `status: Event Done` |
| 7 | Lost | **Batal** | Dibatalkan, alasan wajib | `status: Planning` + `batalAt`, `batalAlasan` |

Aturan pindah, satu fungsi `pindahBolehEvt` dipakai kanban, halaman detail, dan approval:

- Ke **Approval**: judul, tanggal, venue, PIC, dan estimasi anggaran terisi.
- Ke **Persiapan**: hanya lewat putusan manajemen. Ditolak → kembali ke Prospect dengan alasan.
- Ke **Upcoming**: hanya dari Persiapan (6 Upcoming lama tanpa pengajuan tetap berlaku).
- Ke **Batal**: ditolak selama masih ada pesanan tiket lunas yang belum direfund.
- **Event Done** tidak punya kolom kanban (sama seperti Marketing), terjadi lewat tombol atau otomatis setelah lewat.
- Baris lama: `Draft`→Planning, `Today`→Upcoming, `Finished`→Event Done, `Cancelled`→Batal.

Backend: tambah `Prospect` ke daftar yang dikeluarkan di `EventState::eventsHari` & `eventsRentang`,
`Automation/Feeds/EventPublik`, `Automation/Feeds/InfoPagi`, `InfoPagi/Services/InfoPagi`, dan `LEWAT` di `perfomset.vue`.
Sekarang rencana yang **belum disetujui** terhitung sebagai acara yang jalan (Finance, kalender BD, info pagi).

## 4. Menu samping

| Sekarang (15) | Jadi (14) |
|---|---|
| **Utama** Dashboard · Event calendar | **Ruang Komando** Dashboard · Kalender |
| **Event** Pipeline · Perencanaan · Management · Ticketing · Check-in · Approval | **Event** **Event Pipeline & Management** (gabungan) · Ticketing · Check-in |
| **Talent** Talent · Schedule · Fee | **Talent** Talent · Schedule · Fee & pembayaran |
| — | **Kontrol** Approval Flow |
| **Analitik** Performance · Omset & bonus · Report | **Analitik** Performa omset & bonus · **Reporting** (gabungan Performance + Report) |
| **Pengaturan** Hak akses | **Sistem** Notifikasi · **Kelola Akses** · Log Activity |

Alamat lama dialihkan: `/event/planning` → `/event/pipeline?tab=kanban`, `/event/events` → `?tab=daftar`,
`/event/history` → `?tab=riwayat`, `/event/ideas` → `?tab=ide`, `/event/performa` & `/event/report` → `/event/reports`,
`/event/akses` → `/event/staff`. `/event/events/:id` tetap, supaya tautan dari Radar dan modul lain tidak putus.

## 5. Per layar

### 5.1 Dashboard (acuan `pages/marketing/dashboard.vue`)

1. Sapaan + tombol **Event Baru**.
2. Empat kartu: Event hari ini · Talent hari ini · Pendapatan bulan ini · **Perlu perhatian** (ganti "DP pending").
3. Petak **Status Event**, tujuh tahap + total.
4. Kiri: tabel **Upcoming Event · 7 hari** (Event, Tanggal/H-n, PIC, Tiket/Target pax, Kesiapan %). Di bawahnya daftar Perlu perhatian.
5. Kanan: grafik **Pendapatan 6 bulan**, lalu **Event teratas bulan ini**.

Angka tiket (terjual, hadir, rata-rata harga) dan insight talent pindah ke Reporting. Kartu "Keterisian" dihapus:
isinya sama dengan "Tiket terjual yang hadir".

### 5.2 Kalender (acuan `pages/marketing/calendar.vue`)

- Kepala, legenda, saringan status (bawaan: semua kecuali Batal), dan total pax sama seperti Marketing.
- **Klik tanggal kosong → Event Baru** di tanggal itu; **geser kartu → pindah tanggal** dengan konfirmasi. Event Done terkunci.
- Pita: Event EMS · Event Marketing (baca saja) · Talent · Reservasi · Libur/ulang tahun. Saringan sumber tetap ada.
- Event multi-hari digambar di semua harinya (sekarang hanya hari pertama). Event bertiket yang digeser diberi peringatan.

### 5.3 Event Pipeline & Management (acuan `pages/marketing/pipeline.vue`)

Menggantikan Pipeline, Perencanaan, Management, dan History. Saringan PIC di atas, petak ringkasan per tahap, lalu empat tab:

- **Kanban**: enam kolom (tanpa Event Done). Kartu dibuka di tempat: PIC, tanggal, jenis, target pax, anggaran, kesiapan; tombol Ajukan / Buka Event.
- **Daftar Event**: periode, status, cari, reset, halaman. Kolom Event, Tanggal, PIC, Tahap, Tiket, Omset, Kesiapan.
- **Riwayat**: event selesai + tombol "Buat event serupa".
- **Ide**: Idea Bank kembali punya pintu masuk + "Jadikan event".

### 5.4 Input event: dua langkah (acuan `MarketingEventBaru` + `marketing/event/[id]`)

**Langkah 1, Event Baru (singkat):** Nama · Jenis · Sistem masuk · Tanggal & jam · Venue/area · Target pax · PIC & Co-PIC · Dari ide (opsional) → **Buat & Detailing**.

**Langkah 2, halaman detail** dengan ringkasan pengisian (%), simpan otomatis, dan empat tab:

| Tab | Seksi | Isian |
|---|---|---|
| **1 Informasi Dasar** | E.1 Konsep & jadwal | Jenis, sistem masuk, tema/tagline, tujuan, target audiens, tanggal, multi-hari, setup/open gate/mulai/selesai, target pax, kapasitas, sifat acara, area, poin penting |
| | E.2 Rundown | Jam + durasi otomatis, kegiatan, PIC, lampiran |
| | E.3 Layout, dekorasi & venue | Denah, gambar, area, dekorasi, sound/lighting/LED/listrik (Ya/Tidak + catatan), **kunci meja Reservasi** |
| **2 Operasional** | E.4 Talent & entertainment | Line-up dari jadwal talent (**tautkan ke event**), fee, soundcheck, rider, hospitality |
| | E.5 F&B | Promo menu, minimum order, jam operasional, catatan kitchen & bar |
| | E.6 Floor, host & gate | Host, penanda tamu, registrasi, dress code |
| | E.7 Security & perizinan | Security, medis, izin keramaian/lingkungan + berkas, parkir, loading in/out |
| | E.8 Promosi & konten | Poster, materi, kanal, jadwal posting, KOL/media partner, dokumentasi |
| | E.9 Vendor & sponsor | Tabel yang sudah ada + booth & kewajiban sponsor |
| | E.10 Task & PIC hari-H | Task dengan tenggat + matriks PIC |
| **3 Anggaran & Keuangan** | E.11 Anggaran | Rencana vs aktual: talent (otomatis), vendor, produksi, promosi, F&B |
| | E.12 Pemasukan & hasil | Tiket (otomatis), sponsor, target omset F&B, laba/rugi, titik impas |
| **4 Overview** | — | Ringkasan siap cetak/WA, "Event Brief" tiap divisi, evaluasi sesudah acara |

Timeline 8 fase diganti persen kesiapan per seksi; centang lama tetap ditampilkan.

**Penyimpanan:** isian baru masuk ke dokumen `event-details` yang sudah ada, di kunci `isi` (`rundown`, `vendors`,
`budget`, `sponsors`, `tasks` tetap di tempatnya). Tidak ada tabel atau kolom baru. Field atas yang dibaca modul lain
(`title`, `category`, `venue`, `start_datetime`, `pic`, `capacity`, `is_ticketed`, `status`) tidak berganti nama.

**Kategori dipecah:** `category` = jenis (Music, Festival, Nobar, Kompetisi, Komunitas, Bazaar, Launching, Workshop, Kolaborasi, Internal, Lainnya);
`akses_masuk` baru = Free · Tiket · Minimum order · Undangan. Baris lama "Free"/"Paid" ditampilkan sebagai sistem masuk
dan jenisnya "Belum dikelompokkan" sampai diubah orang; tidak ada ubah massal.

**Komponen:** `MarketingEventForm` dibuat menerima fungsi unggah/buka berkas dan daftar kunci atas lewat props (bawaan
tetap Marketing), lalu dipakai Event dengan skema `SEKSI_EVENT_EMS`. Satu penggambar form untuk dua modul. Kunci meja
Reservasi memakai awalan `ems-<id>`, bukan `ev-<id>` milik Marketing.

### 5.5 Kelola Akses (acuan `pages/marketing/staff.vue`)

- Daftar orang dari roster Office, kartu ringkas, dan kolom Peran (bawaan dari Tim, bisa ditimpa).
- **Matriks per peran** dan **pengecualian per orang**: Tak Terlihat / Lihat / Boleh Ubah untuk tiap menu. Tak Terlihat = hilang dari sidebar dan alamatnya ditolak.
- **Tersimpan di server** (sekarang hilang saat muat ulang). Baca: anggota modul. Tulis: admin modul atau Manajemen, **diperiksa di server**, supaya orang tidak bisa memberi dirinya akses.
- API: `GET/PUT /event/akses` → `{roleAcc, userAcc}`, versi + 409. Disimpan sebagai satu baris baru di pengaturan Event, **di luar** `EventSchema::SETTINGS` supaya `/state` dan `getAll` lama tidak berubah.
- Dashboard minimal Lihat; admin modul selalu penuh.
- Batas: yang diatur adalah **tampilan menu**. Data di API tetap dijaga di tingkat modul, sama seperti Marketing. Mengunci fee talent di tingkat data adalah pekerjaan terpisah.

### 5.6 Layar lain (hasil cek)

| Layar | Putusan |
|---|---|
| Approval Flow | Layout ikut Marketing; tahap dari `tahapAcara`; kartu rencana menampilkan anggaran & kesiapan sebelum diputus |
| Talent, Schedule, Fee | Alur tetap. Tambah kolom "Event" dan tautkan ke event (usulan otomatis dari tanggal sama, orang yang menyetujui) |
| Ticketing, Check-in | Alur tetap. Daftar event memakai tahap baru: Persiapan boleh disiapkan, hanya Upcoming yang dijual |
| Performance + Report | Gabung jadi Reporting bertab: Ringkasan · Per event · Per jenis · Talent |
| Performa omset & bonus | Angka & rumus tidak diubah; label tahap saja |
| Notifikasi (baru) | H-7/H-3/H-1, menunggu putusan, refund, fee belum dibayar, data wajib kosong. Dihitung di browser, tanpa tabel |
| Log Activity (baru) | Siapa mengubah apa. Tabel baru `event_aktivitas` di **core** + `GET/POST /event/activities`, append-only |
| Help Center, `KartuEvent`, pencarian, tombol `+`, lencana | Menyesuaikan nama menu dan alamat baru |

## 6. Masalah yang ketemu saat dicek (ikut dibetulkan)

1. **Poster rusak saat event diedit** — `EventForm.vue:38` membaca `poster_img` (objek `{key,…}`) sebagai teks dan menyimpan `"[object Object]"`. 10 event produksi punya poster; belum ada yang rusak. **Wajib sebelum Event Vue dipakai.**
2. **Poster unggahan Vue tidak tampil di website** — disimpan sebagai teks, sedangkan `HomepageEvents::hasPoster` membaca `poster_img.key`.
3. **Persetujuan bisa dilompati** — tombol status di detail (`events/[id].vue:51`) tanpa pemeriksaan, dan kanban hanya melarang Planning → Upcoming.
4. **Event lewat tidak ditutup otomatis** — hanya Office lama yang menulisnya. Di Vue dibuat seperti `useTutupEventLewat`, tetap menghormati `statusAt`.
5. **Di HP, rundown/vendor/budget/sponsor hanya bisa dibaca.**
6. Hapus event meninggalkan detail yatim → konfirmasi ketik nama, detail dihapus, jadwal talent dilepas tautannya.

## 7. Urutan kerja

| Fase | Isi | Repo | Perkiraan |
|---|---|---|---|
| **0** | Betulkan poster (§6.1–2), tutup lubang persetujuan (§6.3) | vue | 0,5 hari |
| **1** | `tahapAcara`/`pindahBolehEvt` + uji, saringan `Prospect` di backend, tutup otomatis | vue + api | 1 hari |
| **2** | Kelola Akses + endpoint + tes 403/409 | api → vue | 1,5 hari |
| **3** | Event Pipeline & Management, Event Baru, pengalihan alamat, menu | vue | 2 hari |
| **4** | Detail 4 tab + skema E.1–E.12 + simpan otomatis + HP | vue | 3–4 hari |
| **5** | Dashboard + Kalender | vue | 2 hari |
| **6** | Reporting, Approval, tautan talent–event | vue | 2 hari |
| **7** | Notifikasi, Log Activity, Help, dokumen | api + vue | 1,5 hari |

Total ± 13–15 hari kerja. Satu PR per fase per repo, API digabung & di-deploy lebih dulu. Fase 3 dan 5 bisa dibalik.

## 8. Uji & selesai bila

- `npm run lint`, `typecheck`, `uji:event`, `uji:event-refund`, `uji:marketing-event` lolos. `uji:event` mencakup tahap ↔ status bolak-balik dan semua aturan pindah.
- `php artisan test tests/Feature/Event` lolos (butuh salinan DB lokal), termasuk: bukan manajemen menulis `/event/akses` → 403, `getAll` lama tidak berubah bentuk.
- Dibuka di browser 390px dan 1366px, dengan empat peran, ke `dev-api`.
- Uji berdampingan: isi detail di Vue → buka & simpan di Event lama → `isi`, tahap, dan poster tetap utuh. **Syarat rilis Fase 4.**
- Form Marketing tetap berperilaku sama.
- Dokumen: `docs/migrasi/event.md`, `_pertanyaan.md` (K-08), `laksamana-api/docs/api/event.md` + `docs/modules/event.md`.

Tidak ada migrasi data, penghapusan data, atau ubah massal. Satu-satunya DDL: tabel `event_aktivitas` di `core` (Fase 7), dijalankan owner.

## 9. Perlu keputusan owner

1. **Nama tahap** seperti §3, atau persis Marketing (Lead/Deal/Lost)? *Saran: §3 — event internal tidak punya lead dan quotation.*
2. **Approval manajemen wajib** sebelum Upcoming? Selama ini 0 event melewatinya. *Saran: wajib, tapi Manajemen/admin boleh "Setujui & lanjut" sekali klik.*
3. **Kapan Event lama ditutup?** *Saran: setelah Fase 4 dipakai seminggu tanpa keluhan. Menutupnya di luar rencana ini karena repo lama tidak boleh diubah dari sini.*
4. **Daftar jenis event** di §5.4 sudah cocok?
