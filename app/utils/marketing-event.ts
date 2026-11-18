// Marketing › event detail form (issue #59): the D.1–D.11 EVENT_SCHEMA plus the
// pure rules of the detail page — section visibility, required-field check,
// DP-tick sync, payment defaults, kwitansi numbers, offer-letter numbers,
// delete summary, rundown auto time, mirror formatting, WA texts and the
// brief/quotation document builder.
//
// Source: laksamana-office deploy/marketing/index.html
//   :3899-4345 EVENT_SCHEMA, TAB_DEF, visibleSections/visibleTabs
//   :4457-4524 eventFinance (in marketing-uang.ts, imported here)
//   :4624 kwitansiNo · :8065 finPakaiDp · :10632 dpFormKurang · :10645 dpFormBaris
//   :10659 dpFormSinkron · :10878 addPayment defaults · :11022 savePayment proof rule
//   :9745-9830 penawaran statuses, MAKS_PDF_PENAWARAN, noSuratBaru
//   :10088-10190 penawaranCard · :10238 dealPenawaran/ajukanRevisi buttons
//   :10513 waInvoice/waReminderDP buttons · :13879-13900 reminder text
//   :11147-11900 genBriefFor/draftNegotiation/buildBriefDoc
//   :18226 evmFieldHTML (locked tables display + wrong-date warning)
//   :9777 tandaiSelesai dialog · delete flow :6373-6438
//
// Pure: no API, no Vue. Tested by tools/uji-marketing-event.mjs.
import type { EventMkt, SettingsMkt } from '~/utils/marketing'
import { JENIS_EVENT_MKT } from '~/utils/marketing'
import type { UangEventMkt } from '~/utils/marketing-uang'
import { eventFinance, rincianPenawaran } from '~/utils/marketing-uang'

// ---------------------------------------------------------------- schema

/** One field of the old EVENT_SCHEMA. Only the shapes the renderer needs. */
export interface FieldEventMkt {
  k: string
  l: string
  t: 'text' | 'ta' | 'num' | 'cur' | 'date' | 'time' | 'timerange' | 'sel' | 'multi' | 'yn' | 'ynnote' | 'tog' | 'mirror' | 'head' | 'files' | 'rundown' | 'menutbl' | 'barangtbl' | 'itemtbl' | 'mejalock' | 'salinlayout'
  req?: boolean
  /** Select options (static) or a marker for a dynamic list. */
  o?: string[] | 'fb'
  from?: string | string[]
  src?: string
  bar?: boolean
  cond?: { k: string, v: unknown }
  help?: string
  full?: boolean
  desc?: string
}

export interface SeksiEventMkt {
  id: string
  n: string
  title: string
  div: string[]
  fin?: boolean
  desc: string
  fields: FieldEventMkt[]
}

/** D.1 — Informasi Dasar. Top-level keys (nama, jenis, tanggal,
 * tanggalSelesai, pax) live on the event row, the rest in detail. */
const D1: FieldEventMkt[] = [
  { k: 'nama', l: 'Nama Event', t: 'text', req: true },
  { k: 'jenis', l: 'Jenis Event', t: 'sel', o: JENIS_EVENT_MKT, req: true },
  { k: 'jenisLain', l: 'Jenis Event — tulis sendiri', t: 'text', cond: { k: 'jenis', v: 'Lainnya' } },
  { k: 'fbFormat', l: 'Format F&B', t: 'sel', o: 'fb', req: true },
  { k: 'fbFormatLain', l: 'Format F&B — tulis sendiri', t: 'text', cond: { k: 'fbFormat', v: 'Lainnya' } },
  { k: 'tanggal', l: 'Tanggal Event', t: 'date', req: true },
  { k: 'multiHari', l: 'Berlangsung lebih dari satu hari', t: 'tog' },
  { k: 'tanggalSelesai', l: 'Tanggal Selesai', t: 'date', cond: { k: 'multiHari', v: true }, req: true },
  { k: 'mulaiSetup', l: 'Mulai Setup', t: 'time', req: true },
  { k: 'tamuDatang', l: 'Tamu Datang / Jam Mulai', t: 'time', req: true },
  { k: 'selesai', l: 'Estimasi Selesai', t: 'time', req: true },
  { k: 'pax', l: 'Estimasi Jumlah Tamu (Pax)', t: 'num', req: true },
  { k: 'budgetPax', l: 'Budget per Pax (F&B)', t: 'cur', help: 'Harga F&B per orang. Dipakai untuk auto-hitung biaya F&B di tab Finance (Pax × Budget/Pax).' },
  { k: 'vipDetail', l: 'Detail Tamu VIP/VVIP/Umum', t: 'ta' },
  { k: 'privacy', l: 'Sifat Acara', t: 'sel', o: ['Private', 'Public', 'Semi Private', 'Combine Event'], req: true },
  { k: 'area', l: 'Lantai / Area', t: 'sel', o: ['Lantai 1', 'Lantai 2', 'Outdoor', 'VIP Area', 'Seluruh Area', 'Lainnya'], req: true },
  { k: 'areaLain', l: 'Lantai / Area — tulis sendiri', t: 'text', cond: { k: 'area', v: 'Lainnya' } },
  { k: 'highlight', l: 'Poin Penting', t: 'ta', full: true },
  { k: 'rundown', l: 'Rundown Acara', t: 'rundown', help: 'Isi per baris: jam mulai, durasi & kegiatan. Ketik durasi → jam selesai terhitung sendiri.', req: true, full: true },
  { k: 'rundownFiles', l: 'Lampiran Rundown', t: 'files', full: true, help: 'Unggah foto/PDF rundown. Gambar langsung tampil di bawah.' },
  { k: '_hLoading', l: 'Jadwal Loading', t: 'head', desc: 'Kapan dekorasi & barang masuk-keluar. Dipakai juga oleh Security (D.5).', full: true },
  { k: 'loadDekorTgl', l: 'Loading Dekorasi — Tanggal', t: 'date' },
  { k: 'loadDekorJam', l: 'Loading Dekorasi — Waktu', t: 'time' },
  { k: 'loadDekorNote', l: 'Catatan Loading Dekorasi', t: 'ta', full: true },
  { k: 'loadInTgl', l: 'Loading In — Tanggal', t: 'date' },
  { k: 'loadInJam', l: 'Loading In — Waktu', t: 'time' },
  { k: 'loadInNote', l: 'Catatan Loading In', t: 'ta', full: true },
  { k: 'loadOutTgl', l: 'Loading Out — Tanggal', t: 'date' },
  { k: 'loadOutJam', l: 'Loading Out — Waktu', t: 'time' },
  { k: 'loadOutNote', l: 'Catatan Loading Out', t: 'ta', full: true },
  { k: '_hDecor', l: 'Dekorasi & Layout', t: 'head', desc: 'Sumber dekorasi, layout & penggunaan area.', full: true },
  { k: 'decorSource', l: 'Sumber Dekorasi', t: 'sel', o: ['Dari Client', 'Dari Laksamana Muda'], req: true },
  { k: 'decorVendorTime', l: 'Jam Vendor Dekorasi Datang', t: 'time', cond: { k: 'decorSource', v: 'Dari Client' } },
  { k: 'decorSupport', l: 'Perlu Support Tim Venue', t: 'yn', req: true },
  { k: 'decorJenis', l: 'Jenis Dekorasi', t: 'multi', o: ['Photo Booth', 'Backdrop', 'Balloon', 'Flower', 'Standing Flower', 'Table Decoration', 'Lainnya'], cond: { k: 'decorSource', v: 'Dari Client' } },
  { k: 'decorJenisLain', l: 'Jenis Dekorasi — tulis sendiri', t: 'text', cond: { k: 'decorJenis', v: 'Lainnya' } },
  { k: 'decorLM', l: 'Jenis Dekorasi (Laksamana Muda)', t: 'multi', o: ['Kain Hitam', 'Taplak Gold', 'Bunga Meja', 'Custom Placemat', 'Lainnya'], cond: { k: 'decorSource', v: 'Dari Laksamana Muda' } },
  { k: 'decorLMLain', l: 'Jenis Dekorasi (LM) — tulis sendiri', t: 'text', cond: { k: 'decorLM', v: 'Lainnya' } },
  { k: 'decorLMNote', l: 'Catatan Dekor (Laksamana Muda)', t: 'ta', cond: { k: 'decorSource', v: 'Dari Laksamana Muda' }, full: true, help: 'Tampil juga di Floor (D.4) supaya tim floor tahu dekor apa yang dipasang.' },
  { k: 'decorVendorExt', l: 'Vendor Eksternal?', t: 'tog', req: true },
  { k: 'decorVendorName', l: 'Vendor dari mana? (nama & kontak)', t: 'text', cond: { k: 'decorVendorExt', v: true } },
  { k: 'layoutFile', l: 'Catatan Layout & Seating Plan', t: 'ta', help: 'Stage, VIP area, buffet, registration, photo booth, parking, emergency exit. Tampil juga di Floor (D.4).', full: true },
  { k: '_salinLayout', l: 'Ambil Layout dari Event Lain', t: 'salinlayout', full: true },
  { k: 'layoutImgs', l: 'Gambar Layout', t: 'files', full: true, help: 'Boleh lebih dari satu. Gambar langsung tampil di bawah.' },
  { k: 'mejaKunci', l: 'Meja yang Dikunci di Reservasi', t: 'mejalock', full: true, help: 'Pilih meja di denah — mejanya langsung dipesan atas nama acara ini di modul Reservasi, jadi tidak bisa diambil tamu lain.' },
  { k: 'areaPakai', l: 'Area yang Dipakai untuk Seating dan Dekor', t: 'multi', o: ['Main Hall', 'Lobby', 'Lantai 2', 'VIP', 'Outdoor', 'Seluruh Area', 'Lainnya'], req: true },
  { k: 'areaPakaiLain', l: 'Area — tulis sendiri', t: 'text', cond: { k: 'areaPakai', v: 'Lainnya' } },
  { k: 'areaImgs', l: 'Gambar Area', t: 'files', full: true, help: 'Boleh lebih dari satu. Gambar langsung tampil di bawah.' },
  { k: '_hVenue', l: 'Venue Needs', t: 'head', desc: 'Jawab Ya / Tidak. Isi catatan bila perlu detail.', full: true },
  { k: 'sound', l: 'Sound System', t: 'ynnote' },
  { k: 'lighting', l: 'Lighting Khusus', t: 'ynnote' },
  { k: 'screen', l: 'LED / Proyektor / TV', t: 'ynnote' },
  { k: 'entDok', l: 'Dokumentasi', t: 'ynnote' },
  { k: 'entEquip', l: 'Equipment Tambahan', t: 'ynnote' },
  { k: 'entJenis', l: 'Entertainment (Band/DJ/MC/dll)', t: 'ynnote' },
  { k: 'ruangVIP', l: 'Ruang VIP', t: 'ynnote' },
  { k: 'musholla', l: 'Musholla', t: 'ynnote' },
  { k: 'listrik', l: 'Listrik Tambahan', t: 'ynnote' },
]

const KOMPONEN_MENU_MKT = ['Welcome Snack', 'Appetizer', 'Soup', 'Main Course', 'VIP Family Set']
const DIET_MKT = ['Halal', 'Vegetarian', 'Vegan', 'Non Spicy', 'Food Allergy']

const D2: FieldEventMkt[] = [
  { k: 'm_fbFormat', l: 'Format F&B (dari D.1)', t: 'mirror', from: 'fbFormat' },
  { k: 'jamFB', l: 'Jam Keluar F&B', t: 'time', req: true },
  { k: 'komponen', l: 'Komponen Menu', t: 'multi', o: KOMPONEN_MENU_MKT, req: true },
  { k: 'dietary', l: 'Dietary Requirement', t: 'multi', o: DIET_MKT, req: true },
  { k: 'menuFinal', l: 'Menu Final', t: 'menutbl', src: 'komponen', req: true, full: true, help: 'Tabelnya ikut komponen menu yang dicentang di atas. Jam di judul kelompok mengisi semua barisnya, dan tiap baris masih bisa diubah sendiri.' },
  { k: 'kNote', l: 'Catatan Kitchen', t: 'ta' },
  { k: 'm_kPIC', l: 'PIC Konsumsi — Kitchen & Bar (dari D.11)', t: 'mirror', from: 'kPIC' },
]

const D3: FieldEventMkt[] = [
  { k: 'barKomponen', l: 'Komponen Bar', t: 'multi', o: ['Beverage', 'Dessert', 'Fruit'] },
  { k: 'barMenu', l: 'Daftar Menu Bar', t: 'menutbl', bar: true, full: true, help: 'Satu daftar minuman. Jam & jumlah di judul mengisi semua barisnya, dan tiap baris masih bisa diubah sendiri.' },
  { k: 'barJam', l: 'Jam Operasional Bar', t: 'timerange', req: true },
  { k: 'plating', l: 'Standar Plating / Presentasi', t: 'sel', o: ['Dikotakin', 'Dipiringin', 'Lainnya'] },
  { k: 'platingLain', l: 'Standar Plating — tulis sendiri', t: 'text', cond: { k: 'plating', v: 'Lainnya' } },
  { k: 'barVIP', l: 'Special Handling VIP', t: 'ta' },
  { k: 'barNote', l: 'Bar Note', t: 'ta' },
  { k: 'm_bPIC', l: 'PIC Konsumsi — Kitchen & Bar (dari D.11)', t: 'mirror', from: 'kPIC' },
]

const D4: FieldEventMkt[] = [
  { k: 'm_jamKonsumsi', l: 'Jam Keluar F&B & Operasional Bar (dari D.2/D.3)', t: 'mirror', from: ['jamFB', 'barJam'], full: true },
  { k: 'penyajianBar', l: 'Waktu Penyajian Menu Bar', t: 'ta', help: 'Kesimpulan jam dari Kitchen & Bar sudah tampil di atas dan ikut tercetak; tambahkan catatan sendiri di sini bila perlu.', full: true },
  { k: 'floorTambah', l: 'Kebutuhan Setup', t: 'multi', o: ['Kursi Tambahan', 'Air Putih Gelas + Tutup', 'Tisu', 'Lilin', 'Ruang Ganti', 'Baby Chair', 'Wheelchair', 'Lainnya'] },
  { k: 'floorTambahLain', l: 'Kebutuhan Setup — tulis sendiri', t: 'text', cond: { k: 'floorTambah', v: 'Lainnya' } },
  { k: 'dressCode', l: 'Dress Code Staff Floor', t: 'text' },
  { k: 'barangClient', l: 'Barang Bawaan Client Perlu Setup', t: 'ta' },
  { k: 'floorNote', l: 'Note untuk Floor', t: 'ta', full: true, help: 'Termasuk request service khusus.' },
  { k: '_hGuest', l: 'Host & Guest Handling', t: 'head', desc: 'Pindahan dari D.5 yang lama.', full: true },
  { k: 'guestList', l: 'Guest List / RSVP', t: 'yn' },
  { k: 'hostBantu', l: 'Perlu Perbantuan Host', t: 'yn' },
  { k: 'hostJumlah', l: 'Berapa Host yang Dibutuhkan', t: 'num', cond: { k: 'hostBantu', v: true } },
  { k: 'penandaTamu', l: 'Penanda Tamu', t: 'ta', help: 'Gelang, kartu undangan, lanyard.' },
  { k: '_hInfoFloor', l: 'Info dari Seksi Lain', t: 'head', desc: 'Baca-saja. Diubah di seksi asalnya.', full: true },
  { k: 'm_ruangVIP', l: 'Ruang VIP (dari D.1)', t: 'mirror', from: 'ruangVIP' },
  { k: 'm_musholla', l: 'Musholla (dari D.1)', t: 'mirror', from: 'musholla' },
  { k: 'm_layout', l: 'Catatan Layout & Seating (dari D.1)', t: 'mirror', from: 'layoutFile', full: true },
  { k: 'm_decorLM', l: 'Catatan Dekor Laksamana Muda (dari D.1)', t: 'mirror', from: 'decorLMNote', full: true },
  { k: 'm_fPIC', l: 'PIC Floor, Tamu & Registrasi (dari D.11)', t: 'mirror', from: 'fPIC' },
]

const D5: FieldEventMkt[] = [
  { k: 'secTambah', l: 'Tambahan Security (jumlah & keperluan)', t: 'ta', req: true },
  { k: 'emergency', l: 'Emergency Exit Briefing', t: 'yn' },
  { k: 'medical', l: 'Medical Staff Stand-by', t: 'yn' },
  { k: 'bodyCheck', l: 'Perlu Body Checking?', t: 'yn' },
  { k: 'loadVendor', l: 'Loading Vendor (jadwal masuk-keluar)', t: 'ta' },
  { k: 'loadBarang', l: 'Barang Apa Saja yang Masuk', t: 'barangtbl', full: true, help: 'Sebut barangnya beserta tanggal & jam masuk.' },
  { k: '_hParkir', l: 'Akses Parkir', t: 'head', desc: 'Pindahan dari D.5 yang lama.', full: true },
  { k: 'valet', l: 'Valet / Reservasi Parkir Tamu Penting', t: 'yn' },
  { k: 'vipPark', l: 'VIP Parking — Plat & Nama', t: 'ta' },
  { k: 'parkArea', l: 'Area Parkir yang Digunakan', t: 'text', req: true },
  { k: '_hInfoSec', l: 'Info dari Seksi Lain', t: 'head', desc: 'Baca-saja. Diubah di D.1.', full: true },
  { k: 'm_privacy', l: 'Sifat Acara (dari D.1)', t: 'mirror', from: 'privacy' },
  { k: 'm_loadDekor', l: 'Loading Dekorasi (dari D.1)', t: 'mirror', from: ['loadDekorTgl', 'loadDekorJam', 'loadDekorNote'], full: true },
  { k: 'm_loadIn', l: 'Loading In (dari D.1)', t: 'mirror', from: ['loadInTgl', 'loadInJam', 'loadInNote'], full: true },
  { k: 'm_loadOut', l: 'Loading Out (dari D.1)', t: 'mirror', from: ['loadOutTgl', 'loadOutJam', 'loadOutNote'], full: true },
  { k: 'secNote', l: 'Security Note', t: 'ta', full: true },
]

const D6: FieldEventMkt[] = [
  { k: 'briefTgl', l: 'Tanggal & Jam Briefing/Rehearsal', t: 'text' },
  { k: 'briefPeserta', l: 'Peserta Briefing', t: 'ta', help: 'Internal & pihak client/talent yang wajib hadir.' },
]

const D7: FieldEventMkt[] = [
  { k: 'materiDesain', l: 'Materi Desain Venue', t: 'multi', o: ['Poster', 'TV Slide', 'LED Content', 'Table Number', 'Name Tag', 'Standing Banner', 'Tiket', 'Gelang', 'Voucher', 'Menu', 'Video', 'Lainnya'] },
  { k: 'materiDesainLain', l: 'Materi Desain — tulis sendiri', t: 'text', cond: { k: 'materiDesain', v: 'Lainnya' } },
  { k: 'namaResmi', l: 'Nama Resmi Event & Tagline/Tema', t: 'text', req: true, full: true },
  { k: 'materiAda', l: 'Materi Promosi Sudah Ada?', t: 'yn', req: true },
  { k: 'izinIG', l: 'Izin Posting IG', t: 'yn', req: true },
  { k: 'izinTT', l: 'Izin Posting TikTok', t: 'yn', req: true },
  { k: 'izinTeaser', l: 'Izin Teaser/Reels/Live Story', t: 'yn', req: true },
  { k: 'izinTag', l: 'Izin Tag Akun Client', t: 'yn' },
  { k: 'izinTagAkun', l: 'Nama Akun IG yang Di-tag', t: 'text', cond: { k: 'izinTag', v: true }, help: 'Muncul kalau izin tag dijawab Ya.' },
  { k: 'dokEvent', l: 'Dokumentasi Selama Event Diizinkan', t: 'yn', req: true },
  { k: 'hashtag', l: 'Hashtag Wajib', t: 'text' },
  { k: 'mktPIC', l: 'PIC Marketing dari Client', t: 'text' },
  { k: '_hBooth', l: 'Booth (jika client membuka booth)', t: 'head', desc: 'Isi hanya bila ada booth. Aktifkan "Ada Booth?" agar detailnya muncul.', full: true },
  { k: 'boothAda', l: 'Ada Booth?', t: 'tog' },
  { k: 'boothUkuran', l: 'Ukuran & Jumlah Booth', t: 'text', cond: { k: 'boothAda', v: true } },
  { k: 'boothPosisi', l: 'Posisi Booth', t: 'sel', o: ['Indoor dekat panggung', 'Indoor dekat entrance', 'Outdoor'], cond: { k: 'boothAda', v: true } },
  { k: 'boothAktivitas', l: 'Jenis Aktivitas Booth', t: 'multi', o: ['Jualan Produk', 'Display Brand', 'Food Tasting', 'Games', 'Sampling', 'Registrasi'], cond: { k: 'boothAda', v: true } },
  { k: 'boothListrik', l: 'Kebutuhan Listrik (Watt)', t: 'text', cond: { k: 'boothAda', v: true } },
  { k: 'boothEquip', l: 'Peralatan Tambahan', t: 'multi', o: ['Meja', 'Kursi', 'Backdrop', 'Partisi', 'Lampu Sorot'], cond: { k: 'boothAda', v: true } },
  { k: 'boothJam', l: 'Jam Operasional Booth', t: 'timerange', cond: { k: 'boothAda', v: true } },
  { k: 'boothRevshare', l: 'Revenue Sharing (%)', t: 'text', cond: { k: 'boothAda', v: true } },
  { k: 'boothCP', l: 'Contact Person Booth', t: 'text', cond: { k: 'boothAda', v: true } },
]

const D8: FieldEventMkt[] = [
  { k: 'estimasiOTS', l: 'Estimasi Tamu + Penambahan OTS', t: 'text', req: true },
  { k: 'dealPax', l: 'Deal per Pax', t: 'cur', help: 'Harga yang disepakati per orang.' },
  { k: 'sistemBayar', l: 'Sistem Pembayaran', t: 'sel', o: ['Full di Awal', 'DP', 'Setelah Event Selesai'], req: true },
  { k: 'depositNama', l: 'Deposit — Keterangan', t: 'text', cond: { k: 'sistemBayar', v: 'DP' } },
  { k: 'depositNominal', l: 'Deposit — Nominal', t: 'cur', cond: { k: 'sistemBayar', v: 'DP' } },
  { k: 'depositVia', l: 'Deposit — Via', t: 'sel', o: ['QRIS BRI', 'Transfer UOB', 'QRIS MANDIRI', 'Transfer BRI', 'Debit', 'Cash'], cond: { k: 'sistemBayar', v: 'DP' } },
  { k: 'ketentuanBill', l: 'Ketentuan Bill', t: 'sel', o: ['Open Bill', 'Close Bill'] },
  { k: 'limitAnggaran', l: 'Limit Anggaran Client', t: 'text', cond: { k: 'ketentuanBill', v: 'Open Bill' } },
  { k: 'diskonKasir', l: 'Penyesuaian Harga / Diskon (%)', t: 'text', help: 'Lihat aturan approval Modul I.' },
  { k: 'voucher', l: 'Voucher / Kupon', t: 'ta' },
  { k: 'voucherImgs', l: 'Gambar Voucher / Kupon', t: 'files', full: true, help: 'Boleh lebih dari satu. Gambar langsung tampil di bawah.' },
  { k: 'itemTambah', l: 'Item Tambahan / Pesanan Khusus', t: 'itemtbl', full: true, help: 'Entertainment charge, dekor tambahan, dsb. Nama item & nominalnya ikut muncul di Finance sebagai Lain-lain.' },
  { k: 'm_refundPIC', l: 'PIC Pembayaran + No. WA (dari D.11)', t: 'mirror', from: 'refundPIC' },
  { k: 'jamOrder', l: 'Jam Operasional & Mulai Boleh Order', t: 'timerange', req: true },
  { k: 'kasirTambah', l: 'Request Tambahan Kasir', t: 'ta', help: 'Struk rangkap, laporan harian, invoicing spesial.' },
  { k: 'noteInvoice', l: 'Note Invoice', t: 'ta', full: true },
]

/** D.9 is drawn by hand (finance tab), not by the schema renderer. */
const D9: FieldEventMkt[] = [
  { k: 'rincianItem', l: 'Rincian Tagihan', t: 'text' },
  { k: 'itemFree', l: 'Fasilitas Termasuk (FREE)', t: 'text' },
  { k: 'itemTbc', l: 'Item Belum Pasti Harganya', t: 'text' },
  { k: 'diskon', l: 'Discount', t: 'cur' },
  { k: 'npwp', l: 'Data Perusahaan untuk Invoice + NPWP', t: 'ta' },
  { k: 'materai', l: 'Materai / Kwitansi Panjang', t: 'yn' },
]

const D10: FieldEventMkt[] = [
  { k: 'attachFiles', l: 'Lampiran Berkas', t: 'files', full: true, help: 'Rundown, file vendor, denah, dsb. Maks 8MB per berkas. Tersimpan di server sendiri, bukan di grup WA.' },
  { k: 'attachNote', l: 'Catatan Dokumen', t: 'ta', help: 'Keterangan tambahan soal berkas di atas (mis. versi mana yang dipakai).' },
  { k: 'internalNote', l: 'Internal Note', t: 'ta', help: 'Tidak tampil di versi client.', full: true },
]

const D11: FieldEventMkt[] = [
  { k: 'picAcara', l: 'PIC Acara — Client', t: 'text', req: true },
  { k: 'kPIC', l: 'PIC Konsumsi — Kitchen & Bar (Client)', t: 'text', req: true, help: 'Satu nama untuk seluruh urusan F&B.' },
  { k: 'fPIC', l: 'PIC Floor, Tamu & Registrasi', t: 'text', src: 'staff', req: true, help: 'Boleh kru kita (pilih dari daftar) atau orang client (ketik namanya).' },
  { k: 'refundPIC', l: 'PIC Pembayaran — Client + No. WA', t: 'text', req: true, help: 'Yang mengurus pembayaran di hari-H, beserta nomornya — kasir menghubunginya langsung.' },
  { k: 'picKoordinator', l: 'Koordinator Event (internal)', t: 'text', src: 'staff', req: true },
  { k: 'picMOD', l: 'Manager On Duty (internal)', t: 'text', src: 'staff', req: true },
  { k: 'picOperator', l: 'PIC Operator', t: 'text', src: 'staff', help: 'Boleh kru kita (pilih dari daftar) atau orang client / vendor (ketik namanya).' },
  { k: 'picDokumentasi', l: 'PIC Dokumentasi', t: 'text', src: 'staff', help: 'Boleh kru kita (pilih dari daftar) atau fotografer/videografer bawaan client (ketik namanya).' },
  { k: 'picTalent', l: 'PIC Talent (jika ada)', t: 'text' },
  { k: 'picDekor', l: 'PIC Dekorasi (jika ada)', t: 'text' },
  { k: 'picParkir', l: 'Area Parkir PIC', t: 'text' },
]

export const SEKSI_EVENT_MKT: SeksiEventMkt[] = [
  { id: 'basic', n: 'D.1', title: 'Informasi Dasar', div: ['all'], desc: 'Apa nama, jenis, tanggal & jam acaranya? Berapa tamu, di area mana, bagaimana rundown, dekorasi & kebutuhan venue-nya?', fields: D1 },
  { id: 'kitchen', n: 'D.2', title: 'Kitchen', div: ['Kitchen'], desc: 'Menu apa saja yang disajikan, jam keluarnya, dan catatan dapurnya?', fields: D2 },
  { id: 'bar', n: 'D.3', title: 'Bar', div: ['Bar'], desc: 'Minuman, dessert & fruit apa yang disediakan, paket apa, dan jam operasional bar-nya?', fields: D3 },
  { id: 'floor', n: 'D.4', title: 'Floor, Host & Guest Handling', div: ['Floor', 'Event'], desc: 'Bagaimana setup & service di lantai, berapa host yang dibutuhkan, dan bagaimana penanganan tamunya?', fields: D4 },
  { id: 'security', n: 'D.5', title: 'Security, Safety & Akses Parkir', div: ['Security'], desc: 'Butuh tambahan security & medical stand-by? Bagaimana jadwal loading barang dan pengaturan parkirnya?', fields: D5 },
  { id: 'brief', n: 'D.6', title: 'Briefing & Rehearsal', div: ['Event'], desc: 'Kapan briefing/rehearsal dilakukan dan siapa saja yang wajib hadir?', fields: D6 },
  { id: 'design', n: 'D.7', title: 'Design & Marketing Content', div: ['Design'], desc: 'Materi desain apa yang dibutuhkan, dan sejauh mana izin publikasi & konten hari-H-nya?', fields: D7 },
  { id: 'cashier', n: 'D.8', title: 'Kasir / Cashier Operasional', div: ['Floor'], desc: 'Bagaimana sistem & metode pembayaran, serta operasional kasir di hari-H?', fields: D8 },
  { id: 'finance', n: 'D.9', title: 'Finance & Ketentuan Pembayaran', div: [], fin: true, desc: 'Berapa rincian biaya & DP-nya, dan bagaimana ketentuan pembayarannya? (khusus Finance/Marketing)', fields: D9 },
  { id: 'attach', n: 'D.10', title: 'Attachment & Internal Note', div: ['all'], desc: 'Dokumen pendukung apa yang dilampirkan, dan catatan internal apa yang perlu dicatat?', fields: D10 },
  { id: 'pic', n: 'D.11', title: 'Matriks PIC Hari-H', div: ['all'], desc: 'Satu-satunya tempat mengisi PIC — dibaca tiap seksi di Overview.', fields: D11 },
]

export interface TabEventMkt { id: string, n: string, title: string, secs: string[], always?: boolean }

export const TAB_EVENT_MKT: TabEventMkt[] = [
  { id: 'basic', n: '1', title: 'Informasi Dasar', secs: ['basic'] },
  { id: 'operasional', n: '2', title: 'Operasional', secs: ['kitchen', 'bar', 'floor', 'security', 'brief', 'design', 'attach', 'pic'] },
  { id: 'finance', n: '3', title: 'Finance', secs: ['cashier', 'finance'] },
  { id: 'overview', n: '4', title: 'Overview', secs: [], always: true },
]

/** Event-row keys: read from the row first, the rest from detail. */
export const KUNCI_ATAS_EVENT_MKT = ['nama', 'jenis', 'tanggal', 'tanggalSelesai', 'pax']

export const JENIS_BAYAR_MKT = ['DP', 'Pelunasan', 'Tambahan Hari-H']
export const METODE_BAYAR_MKT = ['Transfer', 'Cash', 'QRIS', 'Card']
export const REKENING_MKT = ['QRIS BRI', 'Transfer UOB', 'Cash', 'QRIS BCA']
export const MAKS_BERKAS_MKT = 8 * 1024 * 1024
export const MAKS_PDF_PENAWARAN_MKT = 40 * 1024 * 1024
export const STATUS_PENAWARAN_MKT = ['Draft', 'Menunggu Approval', 'Disetujui', 'Ditolak', 'Terkirim'] as const

/** Page draft: top-level keys + detail, saved per tab with a versioned PATCH. */
export interface DrafEventMkt { atas: Record<string, unknown>, detail: Record<string, unknown>, payments?: import('~/utils/marketing').PembayaranMkt[] }

// ---------------------------------------------------------------- reading

type Detail = Record<string, unknown>

/** A field value: the event row first (nama, jenis, tanggal, …), then detail. */
export function nilaiFieldMkt(ev: EventMkt, k: string): unknown {
  const atas = (ev as unknown as Detail)[k]
  if (atas !== undefined && atas !== null && atas !== '') return atas
  return (ev.detail ?? {})[k]
}

function nilaiMentahMkt(ev: EventMkt, k: string): unknown {
  return (ev.detail ?? {})[k]
}

/** A cond {k, v} holds when the other field equals v (or includes v). */
export function condTerpenuhiMkt(f: FieldEventMkt, ev: EventMkt): boolean {
  if (!f.cond) return true
  const v = nilaiFieldMkt(ev, f.cond.k)
  if (Array.isArray(v)) return v.includes(f.cond.v)
  return v === f.cond.v
}

/** Empty for progress + required checks, per field type. */
export function kosongNilaiMkt(t: FieldEventMkt['t'], v: unknown): boolean {
  if (v === undefined || v === null) return true
  if (typeof v === 'string') return v.trim() === ''
  if (typeof v === 'number') return false
  if (typeof v === 'boolean') return false
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') {
    const o = v as Detail
    if ('v' in o) return o.v === undefined
    return Object.keys(o).filter(k => k !== '_teks').every((k) => {
      const x = o[k]
      return Array.isArray(x) ? x.length === 0 : !x
    })
  }
  return false
}

/**
 * Who sees what (old visibleSections, deploy/marketing:9572-9579): finance
 * sections hide from operational crew, and ONLY operational crew are narrowed
 * to their division's sections. Marketing, admins and every other role see all
 * eleven sections whatever division they carry (a Super Admin listed under
 * Kitchen saw only D.1, D.2, D.10, D.11 before).
 */
export function terlihatSeksiMkt(divUser?: string, role?: string): SeksiEventMkt[] {
  return SEKSI_EVENT_MKT.filter((s) => {
    if (s.fin && role === 'operational') return false
    if (!divUser || role !== 'operational') return true
    return s.div.includes('all') || s.div.includes(divUser)
  })
}

/** Tabs with at least one visible section; Overview always shows. */
export function tabTerlihatMkt(divUser?: string, role?: string): TabEventMkt[] {
  const vis = terlihatSeksiMkt(divUser, role).map(s => s.id)
  return TAB_EVENT_MKT.filter(t => t.always || t.secs.some(id => vis.includes(id)))
}

/** Section progress isi/total over its answerable, visible fields (secProgress: uploads don't count, the table lock does). */
export function progresSeksiMkt(ev: EventMkt, seksi: SeksiEventMkt): { isi: number, total: number } {
  let isi = 0
  let total = 0
  for (const f of seksi.fields) {
    if (f.t === 'head' || f.t === 'files' || f.t === 'mirror' || f.t === 'salinlayout') continue
    if (!condTerpenuhiMkt(f, ev)) continue
    total++
    if (!kosongNilaiMkt(f.t, nilaiMentahMkt(ev, f.k) ?? nilaiFieldMkt(ev, f.k))) isi++
  }
  return { isi, total }
}

/** Labels of visible required fields that are still empty. */
export function kurangWajibMkt(ev: EventMkt, seksi: SeksiEventMkt[]): string[] {
  const kurang: string[] = []
  for (const s of seksi) {
    for (const f of s.fields) {
      if (!f.req || f.t === 'head' || f.t === 'mirror') continue
      if (!condTerpenuhiMkt(f, ev)) continue
      if (kosongNilaiMkt(f.t, nilaiFieldMkt(ev, f.k))) kurang.push(`${s.n} — ${f.l}`)
    }
  }
  return kurang
}

// ---------------------------------------------------------------- DP + payments

/** This event really uses DP: sistemBayar DP or a deposit nominal (:8065). */
export function finPakaiDpMkt(ev: EventMkt): boolean {
  const d = (ev.detail ?? {}) as Detail
  return d.sistemBayar === 'DP' || +(d.depositNominal as number) > 0
}

/** What the "DP sudah dibayar" tick still misses (:10632). */
export function dpFormKurangMkt(ev: EventMkt): string[] {
  const d = (ev.detail ?? {}) as Detail
  const k: string[] = []
  if (!(+((d.depositNominal ?? 0) as number) > 0)) k.push('nominal DP')
  if (!String(d.dpRek ?? '').trim()) k.push('rekening tujuan')
  if (!String(d.dpTgl ?? '').trim()) k.push('tanggal transfer')
  if (!String(d.dpBuktiUrl ?? '')) k.push('bukti transfer')
  return k
}

/** The payment row born from the DP tick, if any (:10645). */
export function dpFormBarisMkt(ev: EventMkt) {
  return (ev.payments ?? []).find(p => p && (p as { dariDpForm?: boolean }).dariDpForm) ?? null
}

export interface SinkronDpMkt { payments: EventMkt['payments'], lahir: boolean, perbarui: boolean }

/**
 * Mirror the DP tick into payments (:10659): complete tick → create or
 * refresh the dariDpForm row; anything else → touch nothing (deletion only
 * happens through the paths that ask: untick confirm, payment delete).
 */
export function sinkronDpMkt(
  ev: EventMkt, centang: boolean, noBaru: string, oleh: string,
): SinkronDpMkt {
  const d = (ev.detail ?? {}) as Detail
  const payments = [...(ev.payments ?? [])]
  if (!centang || dpFormKurangMkt(ev).length) return { payments, lahir: false, perbarui: false }
  const isi = {
    type: 'DP',
    amount: +(d.depositNominal as number) || 0,
    method: String(d.dpRek ?? ''),
    at: String(d.dpTgl ?? ''),
    receipt: String(d.dpBuktiNama ?? ''),
    receiptUrl: String(d.dpBuktiUrl ?? ''),
  }
  const i = payments.findIndex(p => p && (p as { dariDpForm?: boolean }).dariDpForm)
  if (i >= 0) {
    payments[i] = { ...payments[i], ...isi }
    return { payments, lahir: false, perbarui: true }
  }
  payments.push({ id: `p${Date.now().toString(36)}`, no: noBaru, verified: true, by: oleh, dariDpForm: true, ...isi })
  return { payments, lahir: true, perbarui: false }
}

/**
 * New-payment defaults (:10878): while the DP is still short, offer the
 * shortfall as DP; after that, the remaining balance as Pelunasan.
 */
export function bawaanBayarMkt(uang: UangEventMkt, pakaiDp: boolean): { amount: number, type: string } {
  const kurangDp = pakaiDp && uang.dp > uang.paid ? uang.dp - uang.paid : 0
  return kurangDp
    ? { amount: kurangDp, type: 'DP' }
    : { amount: uang.remaining, type: 'Pelunasan' }
}

/** Live "sisa sesudah pembayaran ini" from what is typed, not from the DP (:paySisaLive). */
export function sisaSesudahMkt(uang: UangEventMkt, lama: number, kini: number): number {
  return Math.max(0, uang.grand - (uang.paid - lama) - kini)
}

/** Next kwitansi number without consuming it: (kwPrefix||'KW/') + seq (:4624). */
export function noKwitansiMkt(st: SettingsMkt): string {
  const seq = Math.max(1, +(st.kwSeq as number) || 1)
  return `${(st.kwPrefix as string) || 'KW/'}${String(seq).padStart(4, '0')}`
}

/** The settings value to store after handing that number out. */
export const seqBerikutMkt = (st: SettingsMkt) => Math.max(1, +(st.kwSeq as number) || 1) + 1

/**
 * Proof rule for the payment sheet (:11022): new rows REQUIRE a file; old
 * rows without one ask once instead of locking.
 */
export function bayarBaruSahMkt(adaBerkas: boolean, buktiLama: boolean, barisBaru: boolean): 'ok' | 'wajib' | 'tanya' {
  if (adaBerkas || buktiLama) return 'ok'
  return barisBaru ? 'wajib' : 'tanya'
}

// ---------------------------------------------------------------- offer letter

/** Next offer number: NNN/PNW/LM/Romawi/Tahun over the events that have one. */
export function noSuratBaruMkt(jumlah: number, kini = new Date()): string {
  const ROMAWI = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
  return `${String(jumlah + 1).padStart(3, '0')}/PNW/LM/${ROMAWI[kini.getMonth() + 1]}/${kini.getFullYear()}`
}

export const revisiBerikutMkt = (rev?: number) => (rev || 0) + 1

// ---------------------------------------------------------------- delete

/**
 * Other booked events on the same day and area (bookingConflicts, :4716):
 * Deal/Confirmed/Event Done only; an empty area or "Seluruh Area" always warns.
 */
export function bentrokJadwalMkt(ev: EventMkt, events: EventMkt[]): EventMkt[] {
  if (!ev.tanggal) return []
  const area = (x: EventMkt) => String((x.detail ?? {}).area ?? '')
  const a = area(ev)
  return events.filter((x) => {
    if (x.id === ev.id || x.tanggal !== ev.tanggal) return false
    if (!['Deal', 'Confirmed', 'Event Done'].includes(x.status)) return false
    const b = area(x)
    if (!a || !b || a === 'Seluruh Area' || b === 'Seluruh Area') return true
    return a === b
  })
}

export interface RingkasHapusMkt { kwitansi: string[], terbayar: number, nBayar: number, nFu: number }

/** What the delete dialog shows: kwitansi numbers, money, FU count (:6373-6416). */
export function ringkasHapusMkt(ev: EventMkt, nFu: number): RingkasHapusMkt {
  const bayar = ev.payments ?? []
  return {
    kwitansi: bayar.map(p => String(p.no ?? '')).filter(Boolean),
    terbayar: bayar.reduce((a, p) => a + (+(p.amount ?? 0) || 0), 0),
    nBayar: bayar.length,
    nFu,
  }
}

// ---------------------------------------------------------------- locked tables

export const mejaTerkunciMkt = (ev: EventMkt): string[] => {
  const v = (ev.detail ?? {}).mejaKunci
  return Array.isArray(v) ? v.filter(Boolean).map(String) : []
}

/** Tables still locked under the OLD date after the event moved (evmFieldHTML). */
export function kunciTanggalSalahMkt(ev: EventMkt): string | null {
  const tglKunci = String((ev.detail ?? {}).mejaKunciTgl ?? '')
  if (!tglKunci || !ev.tanggal || tglKunci === ev.tanggal) return null
  return `Tanggal event sekarang ${ev.tanggal}, tapi mejanya masih terkunci di ${tglKunci}. Kunci ulang supaya pindah — mejanya di tanggal baru bisa saja sudah dipesan tamu lain.`
}

// ---------------------------------------------------------------- rundown clock

/** "HH:MM" + minutes → "HH:MM", wrapping past midnight. */
export function tambahMenitJamMkt(mulai: string, menit: number): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(mulai.trim())
  if (!m) return ''
  const total = ((+(m[1] ?? 0)) * 60 + (+(m[2] ?? 0)) + Math.round(menit)) % (24 * 60)
  const t = (total + 24 * 60) % (24 * 60)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Type the duration → the finish fills itself in (rundown help). */
export function selesaiRundownMkt(mulai: string, durasi: string): string {
  const angka = durasi.match(/\d+/g)?.reduce((a, x) => a + (+x || 0), 0) ?? 0
  if (!angka) return ''
  return tambahMenitJamMkt(mulai, angka)
}

// ---------------------------------------------------------------- mirror text

const rp = (v: unknown) => `Rp${(+(v as number) || 0).toLocaleString('id-ID')}`

/** One value as the read-only mirrors and the Overview print it. */
export function ringkasNilaiMkt(t: FieldEventMkt['t'], v: unknown): string | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') return v.trim() ? v : null
  if (typeof v === 'number') return t === 'cur' ? rp(v) : String(v)
  if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak'
  if (Array.isArray(v)) {
    if (t === 'mejalock') {
      const m = v.filter(Boolean).map(String)
      return m.length ? `${m.join(', ')} (${m.length} meja)` : null
    }
    const s = v.filter(x => x !== '' && x !== null && x !== undefined).map(String).join(', ')
    return s ? s : null
  }
  if (typeof v === 'object') {
    const o = v as Detail
    if ('v' in o) {
      const yn = o.v === true ? 'Ya' : o.v === false ? 'Tidak' : null
      const note = typeof o.note === 'string' && o.note.trim() ? ` — ${o.note.trim()}` : ''
      return yn ? `${yn}${note}` : (note ? note.trim().replace(/^— /, '') : null)
    }
    if (t === 'menutbl' || t === 'barangtbl' || t === 'itemtbl' || t === 'rundown') {
      const rows = menubarisMkt(v)
      if (!rows.length) return null
      return rows.map(r => Object.values(r).filter(x => x !== '' && x !== undefined).join(' · ')).join('\n')
    }
    const kosong = Object.values(o).every(x => x === undefined || x === null || x === '')
    return kosong ? null : Object.values(o).filter(x => x !== '' && x !== undefined).map(String).join(', ')
  }
  return null
}

/** Table-ish values → row objects for mirrors and the brief. */
export function menubarisMkt(v: unknown): Record<string, string>[] {
  if (Array.isArray(v)) {
    return (v as Detail[]).filter(r => r && typeof r === 'object').map(r => ({
      menu: String(r.menu ?? r.nama ?? r.desc ?? r.kegiatan ?? ''),
      jumlah: String(r.qty ?? r.jumlah ?? ''),
      jam: String(r.jam ?? r.mulai ?? r.tgl ?? ''),
      harga: String(r.harga ?? r.nominal ?? ''),
    })).filter(r => r.menu || r.jumlah || r.jam || r.harga)
  }
  if (v && typeof v === 'object') {
    const out: Record<string, string>[] = []
    for (const [g, gd] of Object.entries(v as Detail)) {
      if (g === '_teks' || !gd || typeof gd !== 'object') continue
      for (const r of (gd as { rows?: Detail[] }).rows ?? []) {
        out.push({
          menu: `${g}: ${String(r.menu ?? '')}`,
          jumlah: String(r.qty ?? ''),
          jam: String(r.jam ?? ''),
          harga: '',
        })
      }
    }
    return out.filter(r => (r.menu ?? '').replace(/^.*: $/, ''))
  }
  return []
}

// ---------------------------------------------------------------- overview (read-only rich blocks)

export interface BarisRundownOv { mulai: string, durasi: string, selesai: string, kegiatan: string, pic: string }

/** Rundown rows worth drawing (old ovRundown table). */
export function barisRundownOv(v: unknown): BarisRundownOv[] {
  if (!Array.isArray(v)) return []
  return (v as Detail[])
    .filter(r => r && typeof r === 'object')
    .map(r => ({
      mulai: String(r.mulai ?? ''), durasi: String(r.durasi ?? ''), selesai: String(r.selesai ?? ''),
      kegiatan: String(r.kegiatan ?? ''), pic: String(r.pic ?? r.nama ?? ''),
    }))
    .filter(r => r.mulai || r.durasi || r.selesai || r.kegiatan || r.pic)
}

export interface BerkasOv { key: string, name: string }

/** File attachments worth drawing (old ovLampiran/ovLayout images). */
export function berkasOv(v: unknown): BerkasOv[] {
  if (!Array.isArray(v)) return []
  return (v as Detail[])
    .filter(b => b && typeof b === 'object' && String((b as Detail).key ?? ''))
    .map(b => ({ key: String((b as Detail).key ?? ''), name: String((b as Detail).name ?? (b as Detail).key ?? '') }))
}

export function berkasGambarOv(name: string): boolean {
  return /\.(png|jpe?g|webp|gif)$/i.test(name)
}

export interface GrupMenuOv { nama: string, jam: string, qty: string, rows: { kat: string, menu: string, qty: string, jam: string }[] }

/** Menu groups worth drawing (old ovMenu tables per kelompok). */
export function grupMenuOv(v: unknown): GrupMenuOv[] {
  const out: GrupMenuOv[] = []
  const baris = (r: Detail) => ({
    kat: String(r.kat ?? ''), menu: String(r.menu ?? ''), qty: String(r.qty ?? ''), jam: String(r.jam ?? ''),
  })
  if (Array.isArray(v)) {
    const rows = (v as Detail[]).filter(r => r && typeof r === 'object').map(baris)
      .filter(r => r.kat || r.menu || r.qty || r.jam)
    if (rows.length) out.push({ nama: '', jam: '', qty: '', rows })
    return out
  }
  if (v && typeof v === 'object') {
    for (const [g, gd] of Object.entries(v as Detail)) {
      if (g === '_teks' || !gd || typeof gd !== 'object') continue
      const gg = gd as Detail & { jam?: string, qty?: string, rows?: Detail[] }
      const rows = (gg.rows ?? []).filter(r => r && typeof r === 'object').map(baris)
        .filter(r => r.kat || r.menu || r.qty || r.jam)
      if (rows.length || String(gg.jam ?? '') || String(gg.qty ?? '')) {
        out.push({ nama: g, jam: String(gg.jam ?? ''), qty: String(gg.qty ?? ''), rows })
      }
    }
  }
  return out
}

/** Does an overview row carry anything drawable? (simple types: the 1-line summary.) */
export function adaIsiOverviewMkt(t: string, raw: unknown, ringkas: string | null): boolean {
  if (t === 'rundown') return barisRundownOv(raw).length > 0
  if (t === 'files') return berkasOv(raw).length > 0
  if (t === 'menutbl') return grupMenuOv(raw).length > 0
  if (t === 'barangtbl' || t === 'itemtbl') return menubarisMkt(raw).length > 0
  if (t === 'rincitbl') return Array.isArray(raw) && raw.length > 0
  return ringkas !== null && ringkas !== ''
}

// ---------------------------------------------------------------- WA texts

const digitHp = (s: unknown) => String(s ?? '').replace(/\D/g, '')

/** Who gets the invoice/reminder: client HP first, then the payment PIC's number. */
export function tujuanWaMkt(clientHp?: unknown, refundPIC?: unknown): string {
  const hp = digitHp(clientHp)
  if (hp.length >= 9) return hp
  const m = String(refundPIC ?? '').replace(/\D/g, '')
  return m.length >= 9 ? m : ''
}

export function pesanInvoiceWaMkt(ev: EventMkt, namaClient: string, st: SettingsMkt): string {
  const f = eventFinance(ev, st)
  const baris = rincianPenawaran(ev, st)
    .map(b => b.gratis ? `• ${b.desc} (FREE)` : b.tbc ? `• ${b.desc} (TBC)` : `• ${b.desc}: ${rp(b.total)}`)
    .join('\n')
  return [
    `Tagihan acara *${ev.nama}* (${namaClient})`,
    baris,
    `GRAND TOTAL: ${rp(f.grand)}`,
    `Terbayar: ${rp(f.paid)} · Sisa: ${rp(f.remaining)}`,
  ].join('\n')
}

export function pesanReminderWaMkt(ev: EventMkt, namaClient: string, st: SettingsMkt): string {
  const f = eventFinance(ev, st)
  return [
    `Halo ${namaClient}, mengingatkan DP acara *${ev.nama}* tanggal ${ev.tanggal ?? ''}.`,
    `DP: ${rp(f.dp)} · sudah masuk: ${rp(f.paid)} · kurang: ${rp(Math.max(0, f.dp - f.paid))}.`,
    'Terima kasih.',
  ].join('\n')
}

// ---------------------------------------------------------------- brief document

export type ModeBriefMkt = 'internal' | 'client' | 'quote'

const escHtml = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Keys that never print on the client version (internalNote, highlight). */
export const KUNCI_INTERNAL_MKT = ['internalNote', 'highlight']

/**
 * The brief/quotation paper (buildBriefDoc, :11811): an HTML string the page
 * shows and prints. `quote` is the system template — a negotiation draft,
 * never the official letter (that is the uploaded PDF on the offer card).
 */
export function buildBriefDocMkt(ev: EventMkt, namaClient: string, st: SettingsMkt, mode: ModeBriefMkt): string {
  const d = (ev.detail ?? {}) as Detail
  const f = eventFinance(ev, st)
  const judul = mode === 'internal' ? 'Event Brief — Internal' : mode === 'client' ? 'Konfirmasi Detail Acara' : 'Penawaran / Quotation'
  const h: string[] = [
    `<h1>${escHtml(judul)}</h1>`,
    `<p><b>${escHtml(ev.nama ?? '')}</b> · ${escHtml(namaClient)} · ${escHtml(ev.tanggal ?? '')}${ev.tanggalSelesai && ev.tanggalSelesai !== ev.tanggal ? ` s/d ${escHtml(ev.tanggalSelesai)}` : ''} · ${escHtml(String(ev.pax ?? ''))} pax</p>`,
  ]
  if (mode === 'quote') {
    const pen = (ev.penawaran ?? {}) as Detail
    h.push(`<p>No. surat: ${escHtml(String(pen.noSurat ?? ''))} · Berlaku s/d: ${escHtml(String((d.validUntil ?? pen.validUntil) ?? ''))}</p>`)
    h.push('<table><thead><tr><th>Deskripsi</th><th>Jumlah</th><th>Harga</th><th>Total</th></tr></thead><tbody>')
    for (const b of rincianPenawaran(ev, st)) {
      h.push(`<tr><td>${escHtml(b.desc)}${b.gratis ? ' (FREE)' : ''}${b.tbc ? ' (TBC)' : ''}</td><td>${b.qty ?? ''}</td><td>${b.unit ? rp(b.unit) : ''}</td><td>${rp(b.total)}</td></tr>`)
    }
    h.push(`</tbody></table><p><b>Grand total: ${rp(f.grand)}</b> · DP: ${rp(f.dp)} · Sisa: ${rp(f.remaining)}</p>`)
    const pic = String(d.picAcara ?? '')
    h.push(`<p>Marketing: ______ · Menyetujui: ______${pic ? ` · PIC acara: ${escHtml(pic)}` : ''}</p>`)
    return h.join('\n')
  }
  const pdfSec = (d._pdfSec ?? {}) as Record<string, unknown>
  for (const s of SEKSI_EVENT_MKT) {
    if (s.id === 'finance') continue
    if (pdfSec[s.id] === false) continue // switched off with "Tampil di PDF" (old pdfSecOn)
    const baris: string[] = []
    for (const fld of s.fields) {
      if (fld.t === 'head' || fld.t === 'mirror' || fld.t === 'salinlayout' || fld.t === 'mejalock') continue
      if (mode === 'client' && KUNCI_INTERNAL_MKT.includes(fld.k)) continue
      const teks = ringkasNilaiMkt(fld.t, d[fld.k] ?? (ev as unknown as Detail)[fld.k])
      if (teks) baris.push(`<tr><td>${escHtml(fld.l)}</td><td>${escHtml(teks).replace(/\n/g, '<br>')}</td></tr>`)
    }
    if (baris.length) h.push(`<h2>${escHtml(s.n)} ${escHtml(s.title)}</h2><table>${baris.join('')}</table>`)
  }
  if (mode === 'internal') {
    h.push(`<h2>Keuangan (internal)</h2><p>Grand total: ${rp(f.grand)} · DP: ${rp(f.dp)} · Terbayar: ${rp(f.paid)} · Sisa: ${rp(f.remaining)}</p>`)
    const pics = ['picAcara', 'kPIC', 'fPIC', 'refundPIC', 'picKoordinator', 'picMOD'].map(k => d[k]).filter(Boolean)
    if (pics.length) h.push(`<p>PIC: ${escHtml(pics.map(String).join(' · '))}</p>`)
  }
  else {
    h.push(`<h2>Ketentuan Pembayaran</h2><p>Sistem: ${escHtml(String(d.sistemBayar ?? ''))} · DP: ${rp(f.dp)} · Sisa: ${rp(f.remaining)}</p>`)
  }
  return h.join('\n')
}
