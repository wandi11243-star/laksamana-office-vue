# Kalender seragam & Talent Schedule gaya roster

Status: **disetujui owner 24 Nov 2026** (deal = titik, jam bawaan = kategori + per talent) · 2026-11-24
Repo: `laksamana-api` (kecil, digabung & di-deploy lebih dulu), `laksamana-office-vue` (utama)
Pengerjaan kode: Claude Sonnet 5.5.

Menggantikan §5.2 (Kalender) dan baris Talent/Schedule di §5.6 dari `2026-11-24-event-mirip-marketing.md`.
Bagian lain plan itu (pipeline, detail 4 tab, Kelola Akses) **tidak** dikerjakan di sini.

## 1. Fakta (kode + data produksi 24 Nov 2026, dibaca saja)

| Fakta | Dampak |
|---|---|
| Kalender Marketing, kalender Event, dan Talent Schedule punya tiga gambar grid sendiri | Satu komponen `KalenderBulan.vue` |
| Marketing: 54 Event Done, 8 Lead, 19 Lost, **0 Deal**. EMS: 44 Event Done, 5 Planning, 6 Upcoming | Titik "deal" hari ini baru tampak di 6 Upcoming; butuh data uji di dev |
| Reservasi hijau di Marketing, biru di Event | Samakan jadi hijau muda (acuan Marketing) |
| Jam November konsisten: Band 19:45–22:30, DJ 22:30–23:59, MC DJ 22:30–23:59 | Jadi jam bawaan awal |
| 94 show DJ/MC DJ tersimpan sebagai tipe "Band" | Form lama memakai satu tipe untuk semua talent. Tipe harus ikut kategori talent |
| `recurring`: 0 baris. `mingguan` 126, `monthly_generator` 115 | Recurring dihapus; isi bulanan tetap perlu ada |
| `schedule.vue`: `DOW` mulai Minggu, tapi indeks hari mulai Senin | **Bug:** pilih "Jum" menulis Sabtu (Recurring & Generate bulanan); label Input mingguan bergeser satu hari |
| Input mingguan hanya memeriksa bentrok di bulan yang tampil | **Bug:** minggu yang melewati akhir bulan tidak diperiksa |
| Simpan = satu POST per baris, dari browser | Gagal di tengah = separuh tersimpan. Perlu simpan sekaligus |
| Tidak ada tempat menyimpan jam bawaan; `entertainmentRules` ditulis ulang oleh Event lama | Kunci pengaturan baru, di luar `EventSchema::SETTINGS` |

## 2. Permintaan 1: template kalender sama + warna deal

`app/components/KalenderBulan.vue`: kepala (judul bulan, legenda, total kanan), grid mulai Minggu, sel, transisi `mkt-swap`,
klik sel, geser kartu. Props: `bulan` (v-model), `bolehKlik`, `bolehSeret`, `judulKlik`; slot `legenda`, `total`, `sel({tgl})`.
Kartu satu gaya: `KalenderKartu.vue` (garis kiri & isi = sumber, titik = deal). Acuan visual: `pages/marketing/calendar.vue` sekarang.

Warna, satu sumber di `app/utils/kalender-warna.ts` (dipakai kedua kalender + legenda):

Keputusan owner 24 Nov 2026: **tidak ada warna penuh**. Warna kartu = sumbernya, deal hanya diberi **titik**.

| Sumber | Kartu |
|---|---|
| Event Marketing | emas muda (seperti sekarang) |
| Event EMS | ungu muda (seperti sekarang) |
| Reservasi | hijau muda (seperti kalender Marketing sekarang; kalender Event ikut) |
| Talent (kalender Event) | merah muda, `error/12` |
| Libur / ulang tahun | netral / kuning |

Keadaan, lewat titik bulat kecil di depan judul (ikut tampil di HP, ada `title` + teks sr-only):
- **Deal / pasti jalan** (Marketing: Deal, Confirmed · EMS: Upcoming, Today): titik hijau `bg-success`.
- Status lain (Lead, Prospect, Approval, Quotation, Planning, Event Done, Finished): tanpa titik.
- Lost / Cancelled: tidak digambar kecuali dipilih di saringan.

Legenda memuat contoh titik: "● Deal / pasti jalan". Di popup, status lengkap tetap lewat `AppStatus`.

- **Kalender Marketing:** perilaku tetap (klik tanggal → Event Baru, geser, saringan status, popup). Yang berubah hanya komponen & warna.
- **Kalender Event** (`pages/event/calendar.vue`) ditulis ulang memakai template itu:
  - Kepala sama: saringan status + saringan sumber, ‹ Hari Ini ›, legenda, "N pax bulan ini".
  - Event EMS bisa diklik → sheet detail. Event multi-hari digambar di semua harinya (WIB).
  - Klik tanggal kosong → sheet Rencana baru (`EventForm`) dengan tanggal terisi 19:00. Hanya `bolehUbahEvent('planning')`.
  - Geser event ke tanggal lain: PATCH `start_datetime`/`end_datetime` saja + `If-Match`, jam & durasi tetap, pakai konfirmasi.
    Event Done/Finished/Cancelled tidak bisa digeser. Event bertiket: konfirmasi menyebut tiket terjual. Hanya `bolehUbahEvent('events')`.
  - Marketing & Reservasi tetap baca saja dan boleh gagal sendiri-sendiri ("Coba lagi"), seperti sekarang.
  - Talent diringkas satu baris per hari ("3 talent · 19:45–23:59"), klik → daftar + tombol "Atur jadwal" ke `/event/schedule?tgl=`.
- `EventForm`: tambah prop tanggal awal. Sekalian betulkan `poster_img` objek yang ditulis jadi `"[object Object]"` saat event diedit
  (simpan kembali nilai aslinya kalau poster tidak diganti; unggahan baru disimpan `{key,name,size,type}` agar terbaca `HomepageEvents::hasPoster`).

## 3. Permintaan 2 & 3: kepala modul Event

- `modul-shell.ts`: hapus `cari` dan `tambah` pada `event`. Lonceng approval tetap. "Rencana baru" tetap ada di halaman Perencanaan.
- "Event calendar" → **"Kalender"**: `layar/event.ts` (menu + `EMS_HALAMAN_LABEL`), judul halaman, Help (`panduan/event.ts`). Alamat `/event/calendar` tetap.
- Modul lain tidak berubah.

## 4. Permintaan 4: Talent Schedule dua tampilan

Pilihan **Kalender | Tabel** (`AppSeg`, diingat per perangkat, try/catch). Kepala sama dengan kalender di §2:
‹ Hari Ini ›, legenda kategori, "N jadwal", saringan kategori.

- **Kalender:** `KalenderBulan` + kartu `19:45 Arkatama` berwarna kategori, batal dicoret. Klik kartu → edit. Klik tanggal → sheet
  **Jadwal hari itu** (§5). Geser kartu = pindah tanggal dengan konfirmasi + periksa bentrok; status Done/Cancelled terkunci.
- **Tabel · Minggu:** lembar roster (acuan `JadwalLembar`): baris = talent dikelompokkan per kategori, kolom = Sen–Min, nama dibekukan,
  sel berisi jam + tipe. Ini tempat input utama (§5).
- **Tabel · Bulan:** tabel Kehadiran yang sudah ada (S/C/✓/×, Tampil, Selesai, Fee), dipindah ke sini. Angka tidak berubah.
- HP 390px: Tabel Minggu menjadi kartu per hari; halaman tidak boleh bergeser ke samping.

## 5. Permintaan 5: input gaya roster dengan jam otomatis

**Mengisi.** Semua perubahan jadi **draf** di layar (garis putus-putus), belum tersimpan sampai **Simpan jadwal**.

1. Klik sel kosong → langsung terisi jam bawaan talent itu. Tidak ada form.
2. Klik sel terisi → editor: pilihan slot dari pengaturan, jam mulai–selesai bebas, fee, tipe, event terkait (opsional), status, catatan, hapus.
   Jam yang berbeda dari bawaan diberi tanda titik.
3. Talent tanpa jam bawaan (mis. Guest Artist) → editor terbuka dengan jam kosong; wajib diisi.
4. `+` di sel terisi → slot kedua di hari yang sama (talent boleh dua kali asal tidak tumpang tindih).
5. **Salin minggu lalu** dan **Isi otomatis** (talent + hari + s/d tanggal; pengganti Input mingguan, Recurring, Generate bulanan).
   Keduanya menghasilkan draf, bukan langsung menulis. Sel yang sudah ada jadwalnya dilewati dan disebut jumlahnya.
6. Bar bawah: "8 baru · 2 diubah · 1 dihapus" + **Simpan jadwal** + Buang. Bentrok ditandai merah di selnya dan menahan Simpan.
   Pindah minggu tidak membuang draf; keluar halaman dengan draf → konfirmasi.

Dari tampilan Kalender, sheet **Jadwal hari itu** memakai logika yang sama: chip talent per kategori, sekali klik masuk dengan jam bawaan,
jam bisa diubah per baris, lalu Simpan jadwal. Setelah tersimpan, jam tetap bisa diubah dari kartu/sel.

Tipe = kategori talent. Fee = fee bawaan talent, bisa ditimpa per baris. `source: 'roster'`. 94 baris lama bertipe salah tidak diubah.

**Urutan jam bawaan:** jam khusus talent → slot kategori untuk hari itu → slot kategori untuk semua hari → kosong.

**Pengaturan** — layar baru **Jam talent** (`/event/jam-talent`, grup Pengaturan, kunci akses `jamtalent`: Manajemen & Tim Event ubah, lainnya tidak terlihat):

- Per kategori: daftar slot (nama, mulai, selesai, hari; satu ditandai bawaan). Contoh awal, diisikan sebagai usulan yang disimpan orang:
  Band 19:45–22:30 · DJ 22:30–23:59 · MC DJ 22:30–23:59. Kategori lain kosong.
- Jam khusus per talent (opsional), menimpa kategori.
- Mengubah pengaturan **tidak** mengubah jadwal yang sudah tersimpan.

Bentuk dokumen `jamTalent`:
```json
{ "kategori": { "Band": [{ "id": "b1", "nama": "Utama", "mulai": "19:45", "selesai": "22:30", "hari": [], "bawaan": true }] },
  "talent":   { "<talent_id>": { "mulai": "20:00", "selesai": "22:00" } } }
```
`hari`: 0 = Senin … 6 = Minggu, `[]` = semua hari. Satu pengubah hari dipakai di semua tempat (`idxHari`), supaya bug geser hari tidak terulang.

**Jam lewat tengah malam:** tetap seperti sekarang (maksimal 23:59), karena Event lama memeriksa bentrok dengan aturan itu. Bisa jadi pekerjaan lanjutan setelah Event lama ditutup.

## 6. API (`laksamana-api`, tanpa migrasi, tanpa tabel baru)

| Endpoint | Isi |
|---|---|
| `GET/PUT /event/settings/jamTalent` | Dokumen di atas. Konstanta `SETTINGS_V1` terpisah, jadi `/state`, `GET /settings`, `getAll`, dan `saveAll` lama **tidak berubah**. 422 kalau bentuk/jam salah; 409/428 seperti pengaturan lain. `admin/reset` tidak menyentuhnya |
| `POST /event/schedules/batch` | `{create: [...], update: [{id, version, fields}], delete: [{id, version}]}`, maks 300 baris. Satu kunci `ems_save` + satu transaksi: semua masuk atau tidak sama sekali. Memeriksa versi tiap baris **dan bentrok di server** (talent sama, tanggal sama, jam tumpang tindih, bukan Cancelled, termasuk antarbaris kiriman). 409 `version_conflict` / `jadwal_bentrok` dengan daftar baris; 422 jam/tanggal salah |

Dokumen: `docs/api/event.md`, `docs/modules/event.md`.

## 7. Berkas

| Repo | Baru | Berubah |
|---|---|---|
| api | `Services/EventJadwal.php`, `tests/Feature/Event/EventJadwalTest.php` | `EventSchema`, `EventRecords`, `EventController`, `routes/v1.php`, docs |
| vue | `KalenderBulan.vue`, `KalenderKartu.vue`, `EventTalentLembar.vue`, `EventTalentHari.vue`, `EventTalentSel.vue`, `EventTalentOtomatis.vue`, `pages/event/jam-talent.vue`, `utils/kalender-warna.ts`, `utils/event-jadwal.ts`, `tools/uji-event-jadwal.mjs` | `marketing/calendar.vue`, `event/calendar.vue`, `event/schedule.vue`, `EventForm.vue`, `useEvent.ts`, `layar/event.ts`, `modul-shell.ts`, Help, `docs/migrasi/event.md` |

## 8. Urutan (satu PR per nomor)

1. **api** — `jamTalent` + batch + tes.
2. **vue A** — permintaan 1, 2, 3.
3. **vue B** — permintaan 4, 5 + Jam talent. Butuh nomor 1 sudah di dev.

## 9. Selesai bila

- api: `php artisan test tests/Feature/Event` lolos (lokal bila DB ada, kalau tidak di CI). Tes wajib: batch gagal satu → tidak ada yang tersimpan;
  bentrok dengan DB & antarbaris; versi basi; `getAll`/`/state` tidak memuat `jamTalent`; tanpa modul `event` → 403.
- vue: `lint`, `typecheck`, `uji:event`, `uji:event-jadwal`, `uji:marketing-event` lolos. `uji:event-jadwal`: urutan jam bawaan, hari Senin–Minggu,
  minggu lintas bulan, tumpang tindih, salin minggu lalu, isi otomatis, susunan kiriman batch.
- Dilihat di browser 390px & 1366px ke `dev-api` bila sesi login tersedia; kalau tidak, dilaporkan belum dicoba.
- Jadwal dari roster terbaca di Event lama, Fee & Pembayaran, dan Dashboard.
- Commit/PR tetap lewat GPT Luna saat diminta. Deploy menunggu persetujuan.
