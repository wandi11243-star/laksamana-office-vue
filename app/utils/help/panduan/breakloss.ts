/*
  PANDUAN: Stock, Break & Loss
  ---------------------------------------------------------------------------
  Kuncinya 'breakloss'. Panel barang inventaris (piring, gelas, alat bar)
  yang pecah atau hilang — disalin dari `deploy/stock/breakloss/`.
*/
import type { Panduan } from '../tipe'

export default {
  key: 'breakloss',
  ringkas: 'Mencatat barang inventaris yang pecah atau hilang, berikut stok terkininya.',
  untuk: 'steward, bar, dan supervisor',

  bagian: [

    {
      id: 'tentang', judul: 'Tentang Panel Break & Loss',
      isi: [
        { t: 'teks', isi: 'Panel ini yang menjawab pertanyaan "piring dan gelas kita ke mana saja". '
          + 'Bedanya dengan Waste: barang di sini WAJIB terdaftar dulu (berikut fotonya), dan '
          + 'stok terkininya dihitung dari seluruh catatan — bukan diketik.' },
        { t: 'tabel',
          kepala: ['Tampilan', 'Isinya'],
          baris: [
            ['Break & Loss, Catat', 'Mencatat barang yang pecah atau hilang.'],
            ['Break & Loss, Report', 'Ringkasan, grafik, dan riwayat catatannya.'],
            ['Barang & Stok, Daftarkan Barang', 'Mendaftarkan barang inventaris berikut fotonya.'],
            ['Barang & Stok, Stok Terkini', 'Stok tiap barang, yang menipis, dan yang minus.'],
          ] },
      ],
    },

    {
      id: 'catat', judul: 'Mencatat',
      isi: [
        { t: 'langkah', judul: 'Break & loss', isi: [
          'Buka *Break & Loss*, sub-tab *Catat*.',
          'Pilih barangnya — satuannya mengikuti data barang.',
          'Isi jumlah (selalu bilangan bulat), tanggal, dan SEBABNYA.',
          'Simpan. Jumlah yang melebihi stok ditanya dulu sebelum disimpan.',
        ] },
        { t: 'langkah', judul: 'Ubah catatan yang salah', isi: [
          'Buka *Report*, tekan ikon pensil di catatannya.',
          'Betulkan, simpan — nilai sebelumnya tetap tersimpan di riwayat catatan itu.',
          'Yang sudah dibatalkan, masuk, atau opname tidak bisa diubah: batalkan lalu catat ulang.',
        ] },
        { t: 'langkah', judul: 'Batalkan catatan', isi: [
          'Tekan ikon larangan di catatannya, tulis ALASANNYA.',
          'Catatannya tetap terlihat (dicoret) dan berhenti dihitung.',
        ] },
        { t: 'langkah', judul: 'Tambah stok & opname', isi: [
          'Dari kartu barang di *Stok Terkini*: tambah untuk barang datang, timbang untuk opname.',
          'Opname menghitung selisihnya sendiri dari stok catatan.',
        ] },
        { t: 'catatan', nada: 'awas', judul: 'Tidak ada hapus di panel ini',
          isi: 'Catatan yang salah DIBATALKAN dengan alasan, barang yang tidak dipakai DINONAKTIFKAN. '
            + 'Keduanya tetap terlihat di riwayat.' },
      ],
    },

    {
      id: 'stok', judul: 'Stok Terkini',
      isi: [
        { t: 'teks', isi: 'Stok = jumlah seluruh catatan yang belum dibatalkan. Kartu yang stoknya '
          + 'sampai batas minimum ditandai "Stok menipis"; yang minus perlu opname.' },
        { t: 'catatan', nada: 'info', judul: 'Stok tidak diubah dari form barang',
          isi: 'Form Daftarkan Barang hanya mengubah data barang. Perubahan stok selalu lewat '
            + 'Catat, Tambah Stok, atau Opname supaya tercatat.' },
      ],
    },

    {
      id: 'masalah', judul: 'Masalah Umum',
      isi: [
        { t: 'tabel',
          kepala: ['Gejala', 'Kemungkinan sebabnya', 'Yang perlu dilakukan'],
          baris: [
            ['Panel menulis tabelnya belum ada',
              'Tabel database-nya belum dibuat.',
              'Buka panel Break & Loss di Office lama sekali agar tabelnya dibuat.'],
            ['Barang yang saya cari tidak ada',
              'Belum terdaftar di master barang.',
              'Daftarkan dulu di sub-tab Daftarkan Barang, berikut fotonya.'],
            ['Stok minus sesudah mencatat',
              'Break/loss tercatat melebihi stok.',
              'Lakukan opname untuk meluruskan stok fisiknya.'],
            ['Catatan tidak bisa diubah',
              'Sudah dibatalkan, atau jenisnya masuk/opname.',
              'Batalkan (bila belum) lalu catat ulang yang benar.'],
          ] },
      ],
    },

  ],
} satisfies Panduan
