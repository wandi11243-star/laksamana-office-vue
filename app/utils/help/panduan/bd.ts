/*
  PANDUAN: Task Management (dulu BD OS)
  ---------------------------------------------------------------------------
  Kuncinya 'bd'. Nama menu disalin dari NAV di deploy/bd/index.html (putaran keempat).
*/
import type { Panduan } from '../tipe'

export default {
  key: 'bd',
  ringkas: 'Ruang kerja tim: task berstatus, project berjangka, '
    + 'promo, dan purchase order.',
  untuk: 'tim BD',

  bagian: [

    {
      id: 'tentang', judul: 'Tentang Task Management',
      isi: [
        { t: 'tabel',
          kepala: ['Kelompok', 'Menu', 'Isinya'],
          baris: [
            ['Workspace', 'Dashboard, My Task, Projects, Calendar', 'Pekerjaan sehari-hari.'],
            ['Operasi', 'Promotion, Purchasing', 'Yang menyentuh divisi lain.'],
            ['Tim', 'Kru BD', 'Anggota tim.'],
          ] },
        { t: 'catatan', nada: 'info', judul: 'Koordinasi & Routine tidak ada di menu',
          isi: 'Keduanya dicabut dari menu, tapi datanya tetap tersimpan dan ikut tersimpan. '
            + 'My Task menggantikan Board & Tasks: task milikmu, dilihat sebagai daftar atau Kanban.' },
      ],
    },

    {
      id: 'kerja', judul: 'Task, sub-task, dan urutan',
      isi: [
        { t: 'tabel',
          kepala: ['Menu', 'Untuk apa', 'Bedanya'],
          baris: [
            ['My Task', 'Pekerjaan yang kamu pegang.', 'Daftar per grup atau Kanban To Do → Done.'],
            ['Projects', 'Pekerjaan besar berjangka.', 'Punya milestone, berlangsung berminggu-minggu.'],
          ] },
        { t: 'catatan', nada: 'info', judul: 'Status: To Do, Doing, Review, Done',
          isi: 'Task lama berstatus Backlog terbaca sebagai To Do, Waiting sebagai Doing. '
            + 'Done mencatat tanggal selesainya; deadline task Done berhenti menghitung dan tampil hijau.' },
        { t: 'catatan', nada: 'info', judul: 'Sub-task & urutan',
          isi: 'Tiap task boleh punya sub-task (progres dihitung dari yang dicentang) dan menunggu '
            + 'task lain. Yang ditahan hanya Done: task yang masih menunggu tidak bisa diselesaikan '
            + 'sebelum prasyaratnya Done — mulai mengerjakannya tetap boleh.' },
      ],
    },

    {
      id: 'koordinasi', judul: 'Koordinasi & Promotion',
      isi: [
        { t: 'teks', isi: '*Koordinasi* untuk request dan follow-up ke divisi lain — hal-hal yang '
          + 'kalau cuma disampaikan lisan akan hilang jejaknya.' },
        { t: 'catatan', nada: 'awas', judul: 'Promo yang kamu daftarkan TERBACA SELURUH KRU di Radar',
          isi: 'Halaman *Promotion* bukan catatan internal. Promo yang berlangsung dan akan datang '
            + 'otomatis muncul di modul Radar, yang dibuka kru operasional. Jadi tulislah nama, '
            + 'tanggal, dan ketentuannya seperti yang perlu dibaca orang di lapangan — bukan '
            + 'singkatan yang cuma dimengerti tim BD.' },
        { t: 'catatan', nada: 'info', judul: 'Yang sudah berakhir tidak ikut tampil di Radar',
          isi: 'Hanya yang berlangsung dan akan datang. Jumlah yang tidak ditampilkan disebut di '
            + 'bawah daftarnya di sana, jadi tidak ada yang terbaca sebagai hilang.' },
      ],
    },

    {
      id: 'po', judul: 'Purchase Order',
      isi: [
        { t: 'langkah', isi: [
          'Buka *Purchasing*, buat purchase request.',
          'Isi barang, jumlah, dan perkiraan harganya.',
          'Pilih *vendor*-nya dari daftar yang tersedia.',
          'Simpan, lalu perbarui statusnya saat pembeliannya berjalan.',
        ] },
        { t: 'catatan', nada: 'info', judul: 'Daftar vendor dibaca dari modul Stock',
          isi: 'Dari *Purchasing → Database & Vendor* di modul Stock, bukan daftar tersendiri di '
            + 'sini. Nama yang tersimpan tapi tidak ada di master tetap digambar, ditandai '
            + '"(lama)" — penandanya dibuang lagi saat disimpan, jadi ia tidak menular jadi '
            + 'bagian dari namanya.' },
        { t: 'catatan', nada: 'info', judul: 'Kalau daftar vendornya belum terbaca',
          isi: 'Kotaknya tetap bisa diketik, dan layarnya mengatakan daftarnya belum termuat. '
            + 'Modul Stock yang sedang tidak bisa dihubungi tidak mematikan form ini.' },
        { t: 'catatan', nada: 'awas', judul: 'Jangan membuat master vendor kedua di sini',
          isi: 'Itu pernah dicoba dan dicabut di hari yang sama. Dua daftar vendor untuk '
            + 'perusahaan yang sama pasti berbeda ejaan dalam sebulan, dan yang mentransfer tidak '
            + 'punya cara tahu mana yang lebih baru. Kalau butuh kolom baru tentang vendor, '
            + 'tambahkan di modul Stock.' },
      ],
    },

    {
      id: 'masalah', judul: 'Masalah Umum',
      isi: [
        { t: 'tabel',
          kepala: ['Gejala', 'Kemungkinan sebabnya', 'Yang perlu dilakukan'],
          baris: [
            ['Promo saya tidak muncul di Radar',
              'Tanggalnya sudah lewat, atau statusnya dijeda.',
              'Radar hanya menampilkan yang berlangsung dan akan datang.'],
            ['Kolom vendor di form PO kosong',
              'Daftar vendor dari modul Stock belum termuat.',
              'Kotaknya tetap bisa diketik. Coba muat ulang halamannya.'],
            ['Task saya hilang dari daftar',
              'Penyaringnya, atau ia sudah ditandai selesai.',
              'Periksa penyaringnya; yang Done ada di Arsip Kanban.'],
            ['Task tidak bisa di-Done-kan',
              'Masih ada task prasyarat yang belum Done.',
              'Namanya disebut di barisnya ("Menunggu …") — selesaikan itu dulu.'],
          ] },
      ],
    },

  ],
} satisfies Panduan
