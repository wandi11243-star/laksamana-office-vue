# Radar #178: pemeriksaan visual 23 Oktober 2026

Pilihan Dwipa **A: mengikuti Office lama**, setelah mencoba lalu menolak konsep reimagine. Branch `migrasi/visual-radar`, diselaraskan dengan main `52ae066`. Implementasi dikerjakan subagent GPT-6 Luna. Tidak ada perubahan Office lama, API, dependensi, atau test per issue.

## Lingkungan dan bukti

Chrome headless lokal, zona Asia/Jakarta, tanggal contoh 23 Oktober 2026 pukul 12.00 WIB, lebar 390 dan 1366px. Office lama disajikan statis read-only di localhost; Vue memakai `NUXT_PUBLIC_API_BASE=http://127.0.0.1:4318/api/v1`. Semua respons API dicegat dengan fixture lokal: satu acara Marketing (80 pax), satu Event (106 pax), satu VIP (8–10 orang), tiga reservasi, dua promo. Tidak menggunakan data dev/production. Tinggi input, tab dan pilihan sumber pada halaman Event hasil build diukur langsung; [rekaman area sentuh](touch-targets.json) menunjukkan minimal 44px untuk kontrol yang diperiksa.

[Catatan browser](browser-report.json) berisi 24 capture lama/Vue. Keenam layar Vue pada kedua ukuran mempunyai `overflow:false`, tanpa `pageerror`. [Catatan interaksi](interaction-report.json) berisi 16 alur, tanpa error alur pada pemeriksaan akhir. Screenshot full-page dapat menampilkan bottom bar di posisi viewport pertama; konten tetap dapat digulir di browser.

## Checklist parity per layar

| Layar | 1366px | 390px | Parity dan beda disengaja | Bukti lama / Vue |
|---|---|---|---|---|
| Radar / pusat koordinasi | Lulus | Lulus | Periode, 4 statistik, agenda 14 hari, reservasi hari ini, panel hari ini dan sumber data tetap dalam urutan lama. HP menumpuk panel dan memakai daftar tamu. | [old 1366](old-radar-1366.png) · [new 1366](new-radar-1366.png) · [old 390](old-radar-390.png) · [new 390](new-radar-390.png) |
| Kalender terpadu | Lulus | Lulus | Desktop tetap 42 tanggal, 4 statistik, 4 saklar sumber. HP menjadi daftar tanggal tanpa geser; pax VIP diberi penjelasan di luar total, termasuk saat hanya sumber VIP aktif. | [old 1366](old-kalender-1366.png) · [new 1366](new-kalender-1366.png) · [old 390](old-kalender-390.png) · [new 390](new-kalender-390.png) |
| Daftar Event | Lulus | Lulus | Periode, 5 statistik, filter, akan datang/sudah lewat dan grid/tabel tetap tersedia. Tabel: tanggal, jam, acara, sumber, tempat, format F&B, jenis, pax, status. HP selalu kartu. | [old 1366](old-agenda-1366.png) · [new 1366](new-agenda-1366.png) · [old 390](old-agenda-390.png) · [new 390](new-agenda-390.png) |
| Reservasi | Lulus | Lulus | Periode mingguan, 4 statistik, pencarian/status/kategori dan grid/tabel tetap tersedia. Tabel: tanggal, jam, tamu, pax, meja, kategori, status. Harian mempertahankan briefing, cetak dan WhatsApp. | [old 1366](old-reservasi-1366.png) · [new 1366](new-reservasi-1366.png) · [old 390](old-reservasi-390.png) · [new 390](new-reservasi-390.png) |
| Promo | Lulus | Lulus | 3 statistik, pencarian/tipe, urutan berlangsung lalu akan datang, benefit, tanggal, kode, metadata dan ketentuan dipertahankan. Ikon Lucide menggantikan emoji. | [old 1366](old-promo-1366.png) · [new 1366](new-promo-1366.png) · [old 390](old-promo-390.png) · [new 390](new-promo-390.png) |
| Detail lengkap Event | Lulus | Lulus | Kembali ke daftar dan cetak tetap di kepala. Metadata, klien, detail Marketing, cabang Event dan VIP tetap ada. Tombol membungkus pada HP. | [old 1366](old-detail-1366.png) · [new 1366](new-detail-1366.png) · [old 390](old-detail-390.png) · [new 390](new-detail-390.png) |

Paritas di atas berarti isi, urutan bagian, kolom dan alur lama dipertahankan dalam blok DESIGN.md, bukan kecocokan piksel. Perbedaan yang dipertahankan sesuai DESIGN.md: kepala tabel coklat gelap, ikon Lucide, ukuran/kontras token, padding komponen Nuxt UI, label filter yang jelas, dan kartu statistik dua kolom di HP. Di Daftar Event, 5 statistik muat satu baris desktop; legacy membungkus yang kelima. Papan Radar menampilkan tiga sumber `/board`; BD tetap ada pada layar Promo melalui `/promos` (legacy menulis BD bersama sumber papan dan bahkan memberi keterangan reservasi untuk BD).

Perbaikan sesi ini: daftar kalender HP menggantikan kisi minimal 720px; kontrol dan field sentuh diperbesar; aksi detail bisa membungkus; state memuat/kosong/gagal kalender dibedakan; sumber ditulis sebagai kata selain warna; pax VIP ditampilkan terpisah; kelas mode gelap milik Radar dibuang karena aplikasi light-only. Tidak mengubah rumus atau susunan utama layar lama.

## Alur yang diperiksa

- Pilih Harian/Mingguan/Bulanan; pencarian Event, hasil kosong dan pemulihan; pindah tampilan Tabel; filter sumber Marketing pada hasil build statis.
- Buka drawer agenda, baca detail dan tutup dengan Escape; buka drawer reservasi dari baris tabel.
- Buka reservasi hari ini dan tautan tanggal dari kalender; tombol cetak memanggil `window.print`; preview WhatsApp menghasilkan teks untuk dua booking/enam pax tanpa mengirim pesan atau membuka jaringan WhatsApp.
- Matikan keempat sumber kalender, aktifkan hanya VIP (VIP tetap tampil tanpa masuk total), pindah bulan dan kembali ke hari ini; buka detail dari daftar kalender HP.
- Cari promo dan buka ketentuannya; detail lengkap Marketing, Event, VIP, serta 404.
- Respons kosong, sumber Event gagal parsial, dan error API 503 memakai `apiErrorMessage`. Pesan gagal ditampilkan, tidak diganti pesan kosong. Bukti: [kosong](state-empty-390.png), [sumber gagal](state-failure-390.png), [API gagal](state-api-error-390.png).

## Pemeriksaan kode

- ESLint khusus file Radar: **lulus**. `git diff --check`: **lulus**.
- `npm run lint`: **gagal**, 199 error bawaan di `tools/visual-issues/create.mjs`; [log](lint.txt).
- `NODE_OPTIONS=--max-old-space-size=4096 npm run typecheck`: **gagal**, 8 diagnostik di Reservasi, Event, plugin toast dan util QR; tidak ada diagnostik pada file Radar; [log](typecheck.txt).
- `NUXT_PUBLIC_API_BASE=http://127.0.0.1:4318/api/v1 npm run build`: **lulus**, 278 route, output statis dan service worker dibuat. Dijalankan sesudah perubahan kode terakhir dan rebase main.
- Kegagalan pemeriksaan seluruh repo dicatat pada [#189](https://github.com/dwipapap/laksamana-office-vue/issues/189). Draft belum memenuhi DoD seluruh-repo-hijau.

## Cakupan dan tindak lanjut

Enam layar tersedia, tidak ada layar ditunda karena K/G. Tidak ada gap API baru. Semua bacaan tetap melalui `useRadar` → `useApi()` → `/api/v1/radar`; tidak ada mutasi. Import rumus yang sudah ada dipertahankan (`utils/radar.ts`, `format.ts`, `promo.ts` milik BD); tidak ada port/copy rumus baru.

Temuan di luar cakupan modul: ikon navigasi Radar belum masuk client bundle, sehingga mencoba Iconify eksternal saat runtime. Saat jaringan eksternal diblokir ikon kosong, label dan navigasi tetap bekerja. Dicatat pada [#190](https://github.com/dwipapap/laksamana-office-vue/issues/190); konfigurasi fondasi tidak diubah pada PR ini. Font Google milik legacy diblokir saat audit offline sehingga screenshot legacy memakai fallback; font Vue self-hosted tetap tersedia.

Belum dicek: data/API sungguhan, enforcement redaksi uang di server, lampiran/poster nyata, layout dialog cetak/hasil cetak fisik, pagination >20 baris, siklus auto-refresh lima menit penuh, seluruh kombinasi filter, dan perangkat iOS/Android nyata. Tidak ada klaim pengujian untuk bagian tersebut. Keamanan server mengikuti kontrak dan tidak diuji ulang melalui fixture.
