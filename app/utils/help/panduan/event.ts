/*
  PANDUAN: Event
  ---------------------------------------------------------------------------
  Kuncinya 'event'. Nama menu yang disebut di sini disalin dari NAV di
  deploy/event/index.html; kalau menu di sana diganti namanya, panduan ini
  ikut harus diganti, kalau tidak orang mencari menu yang sudah tidak ada.
*/
import type { Panduan } from '../tipe'

export default {
  key: 'event',
  ringkas: 'Merencanakan acara dari wacana sampai selesai: jadwal talent, tiket, check-in hari H, '
    + 'dan laporan hasilnya.',
  untuk: 'tim event dan manajemen',

  bagian: [

    {
      id: 'tentang', judul: 'Tentang Modul Event',
      isi: [
        { t: 'teks', isi: 'Modul Event mengurus acara yang diselenggarakan sendiri: musik, pertunjukan, '
          + 'dan acara berjadwal talent. Acara pesanan klien yang dijual tim Marketing diurus di '
          + 'modul Marketing, bukan di sini.' },
        { t: 'teks', isi: 'Menu di kiri dikelompokkan mengikuti urutan kerja: merencanakan, menjalankan, '
          + 'lalu menilai hasilnya.' },
        { t: 'tabel',
          kepala: ['Kelompok', 'Menu', 'Untuk apa'],
          baris: [
            ['Utama', 'Dashboard, Kalender', 'Melihat apa yang sedang berjalan dan kapan.'],
            ['Talent', 'Talent Management, Talent Schedule, Fee & Pembayaran', 'Data penampil, jadwal tampilnya, dan bayarannya.'],
            ['Event', 'Event Pipeline, Event Management, Ticketing, Check-In, Approval Flow', 'Dari wacana sampai tamu masuk pintu.'],
            ['Analitik', 'Event Performance, Performa Omset & Bonus, Report & Analytics', 'Hasil acaranya, dan omset yang diakui.'],
            ['Pengaturan', 'Hak Akses, Jam talent', 'Siapa boleh apa, dan jam bawaan talent untuk mengisi jadwal.'],
          ] },
        { t: 'gambar', berkas: 'event/dashboard.png',
          teks: 'Dashboard modul Event: acara terdekat, jadwal talent, dan ringkasan tiket.',
          tandai: [
            'Sidebar menu, dikelompokkan Utama, Talent, Event, dan Analitik.',
            'Kartu ringkasan acara yang akan datang.',
            'Menu yang tidak boleh kamu buka tidak digambar sama sekali.',
          ] },
        { t: 'catatan', nada: 'info', judul: 'Dua menu bernama mirip, isinya berbeda',
          isi: '*Event Performance* menilai jalannya acara: talent, tiket, dan kehadiran. '
            + '*Performa Omset & Bonus* menilai uangnya: omset yang diakui dan bonus yang dihitung '
            + 'dari situ. Keduanya sengaja dipertahankan karena menjawab pertanyaan yang berbeda.' },
      ],
    },

    {
      id: 'buat', judul: 'Membuat Event Baru',
      isi: [
        { t: 'langkah', isi: [
          'Buka *Event Management*, pilih tab *Perencanaan*, lalu tekan *Rencana Baru*. Atau buka *Kalender* dan klik tanggal yang masih kosong: tanggalnya sudah terisi (jam 19:00).',
          'Isi *nama acara*, *tanggal*, dan *jamnya*.',
          'Pilih *jenis acara*. Jenis inilah yang dipakai laporan untuk mengelompokkan omset, jadi jangan dilewati.',
          'Isi *tempat* dan perkiraan *kapasitas* tamunya.',
          'Simpan. Acaranya langsung muncul di Kalender.',
        ] },
        { t: 'catatan', nada: 'info', judul: 'Kolom PIC terisi sendiri',
          isi: 'Kolom PIC event baru dikunci ke akun yang sedang login, dan itu disengaja: kolom itu '
            + 'yang menentukan omset acaranya diakui ke siapa di Finance. Untuk event lama yang '
            + 'PIC-nya masih berisi jabatan seperti "Event Manager", kolomnya masih bisa diketik '
            + 'supaya bisa dibetulkan.' },
        { t: 'langkah', judul: 'Kalau acaranya belum pasti', isi: [
          'Catat di *Event Pipeline* atau di tab *Perencanaan* pada *Event Management*.',
          'Setelah disetujui, acara tampil di tab *Daftar Event*.',
        ] },
        { t: 'catatan', nada: 'info', judul: 'Kenapa dipisah',
          isi: 'Menyusun rencana yang belum tentu jadi dan menjalankan acara yang sudah pasti adalah '
            + 'dua pekerjaan berbeda. Mencampurnya di satu daftar membuat acara yang benar-benar '
            + 'akan berjalan tenggelam di antara belasan wacana.' },
      ],
    },

    {
      id: 'status', judul: 'Arti Status Event',
      isi: [
        { t: 'tabel',
          kepala: ['Status', 'Artinya'],
          baris: [
            ['Planning', 'Masih disusun. Belum tentu berjalan.'],
            ['Upcoming', 'Sudah pasti dan akan berjalan.'],
            ['Event Done', 'Acaranya sudah selesai dijalankan.'],
            ['Cancelled', 'Dibatalkan. Bukan "selesai".'],
          ] },
        { t: 'catatan', nada: 'awas', judul: '"Event Done" bukan sekadar penanda rapi',
          isi: 'Halaman analisa Pengaruh Event di modul Analytics hanya menghitung acara berstatus '
            + '*Event Done*. Acara yang sudah benar-benar berjalan tapi lupa ditandai tidak akan '
            + 'ikut dihitung pengaruhnya terhadap omset, dan tidak ada satu pun layar yang '
            + 'memberitahu bahwa ia terlewat. Biasakan menutup acara begitu selesai.' },
        { t: 'catatan', nada: 'info', judul: 'Cancelled tidak dipetakan ke Event Done',
          isi: '"Selesai" berarti acaranya berjalan sampai habis. Acara yang batal tidak pernah '
            + 'berjalan, jadi ia tetap Cancelled.' },
      ],
    },

    {
      id: 'talent', judul: 'Talent & Jadwalnya',
      isi: [
        { t: 'langkah', judul: 'Mendaftarkan talent', isi: [
          'Buka *Talent Management*.',
          'Tambahkan talent baru: nama, kategori (Band, DJ, MC, dan seterusnya), dan kontaknya.',
          'Simpan. Talent itu kini bisa dipilih saat menyusun jadwal.',
        ] },
        { t: 'langkah', judul: 'Mengatur jam bawaan (sekali saja)', isi: [
          'Buka *Jam talent* di grup Pengaturan (Manajemen dan Tim Event).',
          'Untuk tiap kategori, isi slot jamnya: nama, jam mulai dan selesai, hari berlakunya, dan tandai satu sebagai *Bawaan*. Slot tanpa hari dipilih berlaku di semua hari.',
          'Talent tertentu boleh diberi *jam khusus* yang menimpa jam kategorinya.',
          'Selama belum ada yang tersimpan, layar menampilkan *usulan* (Band 19:45–22:30, DJ dan MC DJ 22:30–23:59). Usulan itu baru dipakai setelah Anda menekan *Simpan*.',
        ] },
        { t: 'langkah', judul: 'Menjadwalkan talent tampil', isi: [
          'Buka *Talent Schedule*. Pilih tampilan *Kalender* (satu bulan, kartu berwarna per kategori) atau *Tabel*.',
          'Di *Tabel › Minggu*, tiap baris adalah talent dan tiap kolom adalah hari Senin sampai Minggu. Klik sel kosong: sel langsung terisi jam bawaan talent itu. Klik sel yang sudah terisi untuk mengubah jam, fee, tipe, event terkait, status, atau catatannya, atau untuk menghapusnya. Tanda *+* menambah show kedua di hari yang sama.',
          'Di *Kalender*, klik tanggal untuk membuka *Jadwal hari itu*: tekan nama talent untuk menambahkannya, ubah jamnya per baris. Klik kartu untuk mengubah satu jadwal; geser kartu ke tanggal lain untuk memindahkannya (jadwal Done dan Cancelled terkunci).',
          '*Salin minggu lalu* dan *Isi otomatis* (talent, hari, dari dan sampai tanggal) membuat draf dari jam bawaan. Sel yang sudah punya jadwal dilewati dan jumlahnya disebutkan.',
          'Semua yang Anda kerjakan adalah *draf* (garis putus-putus) sampai Anda menekan *Simpan jadwal* di bar bawah. Draf tetap ada saat pindah minggu, bulan, atau tampilan; meninggalkan halaman dengan draf akan ditanya dulu. *Buang* membatalkan semua draf.',
          'Jadwal yang bentrok (talent sama, tanggal sama, jam bertumpuk) ditandai merah dan menahan penyimpanan. Titik kuning kecil berarti jamnya berbeda dari jam bawaan.',
        ] },
        { t: 'catatan', nada: 'awas', judul: 'Jam tampil menentukan angka analisa',
          isi: 'Halaman Performa Talent di modul Analytics menghitung omset yang masuk selama jam '
            + 'tampil tiap penampil. Jam yang kosong atau salah membuat penampil itu tidak bisa '
            + 'dinilai sama sekali, dan yang tercatat salah akan menagihkan omset malam itu ke '
            + 'penampil yang keliru.' },
        { t: 'daftar', isi: [
          'Jam selesai paling akhir 23:59 dan harus lebih besar dari jam mulai; jadwal tidak bisa melewati tengah malam.',
          'Simpan jadwal bersifat semua-atau-tidak-sama-sekali: bila satu baris ditolak (bentrok, atau sudah diubah orang lain), tidak ada yang tersimpan dan draf Anda tetap ada. Paling banyak 300 perubahan sekali simpan.',
          'Mengubah *Jam talent* tidak mengubah jadwal yang sudah tersimpan.',
          'Jadwal berstatus *Cancelled* tidak ikut dihitung. Status lain ikut, termasuk yang lupa ditandai selesai.',
          'Bayaran talent dicatat di *Fee & Pembayaran*, terpisah dari jadwalnya.',
        ] },
      ],
    },

    {
      id: 'tiket', judul: 'Ticketing & Check-In',
      isi: [
        { t: 'langkah', judul: 'Menyiapkan tiket', isi: [
          'Buka acaranya di *Event Management*, lalu tandai bahwa acara itu berjenis berbayar tiket.',
          'Buka menu *Ticketing*, atur jenis tiket dan harganya.',
          'Simpan. Tiket sudah bisa dijual.',
        ] },
        { t: 'langkah', judul: 'Check-in di hari H', isi: [
          'Buka menu *Check-In*.',
          'Pilih acaranya.',
          'Pindai QR di tiket tamu, atau cari namanya kalau QR-nya tidak bisa dipindai.',
          'Tandai masuk. Tiket yang sudah dipakai akan ditolak kalau dipindai lagi.',
        ] },
        { t: 'catatan', nada: 'info', judul: 'Kalau QR tidak mau terbaca',
          isi: 'Cari tamunya berdasarkan nama atau nomor pesanan, lalu tandai masuk secara manual. '
            + 'Jangan menerbitkan tiket pengganti, karena tiket yang sama jadi terhitung dua kali.' },
        { t: 'tabel',
          kepala: ['Status tiket', 'Artinya'],
          baris: [
            ['Valid', 'Tiket sah dan belum dipakai masuk.'],
            ['Checked-In', 'Sudah dipakai masuk malam itu.'],
            ['Expired', 'Sudah lewat masa berlakunya.'],
            ['Refunded', 'Sudah dikembalikan uangnya.'],
          ] },
      ],
    },

    {
      id: 'masalah', judul: 'Masalah Umum',
      isi: [
        { t: 'tabel',
          kepala: ['Gejala', 'Kemungkinan sebabnya', 'Yang perlu dilakukan'],
          baris: [
            ['Menu tertentu tidak ada di sidebar',
              'Peran akunmu tidak diberi hak melihat halaman itu.',
              'Minta admin modul Event membukanya lewat menu Hak Akses.'],
            ['Acara tidak muncul di analisa Analytics',
              'Statusnya belum *Event Done*.',
              'Tutup acaranya di Event Management.'],
            ['Omset acara tidak muncul di Performa Omset & Bonus',
              'Barisnya belum diisi finance di Breakdown Sumber, atau PIC-nya belum cocok.',
              'Periksa kolom PIC acaranya, lalu koordinasi dengan finance.'],
            ['Penampil terlihat tidak menyumbang omset apa pun',
              'Jam tampilnya kosong atau tidak terbaca.',
              'Lengkapi jam mulai dan durasinya di Talent Schedule.'],
            ['Tamu sudah bayar tapi tiketnya ditolak saat check-in',
              'Tiketnya sudah pernah dipakai masuk.',
              'Cek riwayat check-in tiket itu sebelum menerbitkan yang baru.'],
          ] },
        { t: 'tanya', isi: [
          { t: 'Acara klien yang memesan tempat dicatat di mana?',
            j: 'Di modul Marketing, bukan di sini. Modul Event untuk acara yang diselenggarakan sendiri.' },
          { t: 'Saya salah menandai acara sebagai Event Done. Bisa dibalik?',
            j: 'Bisa, ubah lagi statusnya. Tapi perlu diingat angka analisa ikut berubah, jadi '
              + 'beritahukan ke yang memakai laporannya.' },
          { t: 'Kenapa PIC event tidak bisa saya ketik?',
            j: 'Untuk event baru, PIC dikunci ke akun pembuatnya karena kolom itu menentukan '
              + 'pengakuan omset. Yang masih bisa diketik hanya event lama yang belum punya jejak pembuat.' },
        ] },
      ],
    },

  ],
} satisfies Panduan
