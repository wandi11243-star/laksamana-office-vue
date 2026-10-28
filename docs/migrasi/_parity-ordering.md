# Parity checklist — ordering › form order vs lama

Pilot S1, issue #179 (opsi A: susunan lama, kulit Miro). Pembanding:
`laksamana-office/deploy/stock/ordering/index.html` (tab `order`).
Halaman Vue: `app/pages/stock/ordering/order.vue`.

| # | Bagian lama | Perilaku lama | Status baru | Keputusan Miro |
|---|---|---|---|---|
| 1 | Hero "Pengajuan Order Barang Baru" + label TAHAP 1 | Panel gelap gradasi emas (`#5C440F→#A9791F`), judul + eyebrow "Tahap 1" | BEDA disengaja | Panel `bg-ink-900` teks putih, tanpa gradasi; isi dan urutan sama |
| 2 | Lencana "Server Sinkron" di hero | Pil terang + ikon cloud, statis saat online | BEDA disengaja | `AppStatus` success + ikon `i-lucide-cloud-upload`; statis (tak ada state sinkron di file ini; deteksi luring deferred) |
| 3 | PIC (Pemesan) di dalam hero | Read-only, dari user login | ADA | `UInput` putih disabled di atas ink, label putih/70 |
| 4 | Tgl Rencana Kedatangan di dalam hero | Widget kalender kustom + pintasan Hari Ini/Besok/Lusa, default besok | ADA, BEDA kecil | `UInput type=date` + `AppChips` 3 pintasan yang sama, default tetap besok; kalender kustom tak dibawa (aksesibilitas) |
| 5 | Baris bahan stepper | `- [qty] +`, select satuan, note, trash; default qty 5; 3 baris kosong awal | SAMA | Urutan sama; tombol `-`/`+` Lucide 44px; placeholder "Ketik nama bahan" vs lama "Ketik min. 1 huruf..." (drift copy tak disengaja, harmless) |
| 6 | "+ Tambah Baris Bahan" | Tombol di kepala kartu item | ADA | `UButton` outline pil di `#actions` panel, posisi sama |
| 7 | Footer "N Item siap dikirim" | Kiri; tombol Simpan Draft + Cek & Submit Pesanan kanan; hitung SEMUA baris | ADA, BEDA kecil | Teks "N baris siap dikirim" menghitung baris VALID saja (lebih jujur dari lama); Simpan draft outline, Cek & submit pesanan pil hitam (`primary` solid) |
| 8 | Pilih batch Baru/Gabung | Di modal pra-kirim, bukan form utama | BEDA disengaja | Tetap inline di form (pola Vue yang sudah ada); logika `batchId`/`batchName` byte-identical |
| 9 | Modal pra-kirim + cek duplikat | Ringkasan PIC/tgl, "sudah X, akan jadi Y", tombol Kirim | ADA | `ResponsiveSheet` sama; validasi + pesan error tidak diubah |
| 10 | Tab ck (Central Kitchen) | Stok/saldo, minta, kirim, riwayat | TBD batch berikut | — |
| 11 | Tab checkin (Check-in Penerimaan) | Kartu per PO, mode 1 Hari/Rentang | TBD batch berikut | — |
| 12 | Tab restock / forecast / users (admin) | Tabel restock, tier/WAPE, kelola akses | TBD batch berikut | — |

Copy tombol mengikuti kalimat lama dalam sentence case (DESIGN.md).
