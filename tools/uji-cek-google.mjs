/* Guard for app/utils/cek-google.ts (Service Excellent "Cek Google").
 * node tools/uji-cek-google.mjs (Node 24: imports .ts directly)
 */
const G = await import('../app/utils/cek-google.ts')

let ok = 0
let gagal = 0
const cek = (nama, syarat, ket) => {
  if (syarat) {
    ok++
    console.log('  OK    ' + nama)
  }
  else {
    gagal++
    console.log('  GAGAL ' + nama + (ket ? '  — ' + ket : ''))
  }
}

const wib = tgl => Date.parse(`${tgl}T05:00:00Z`)
const ulasan = (id, penulis, tgl, rating = 5) => ({ id, penulis, rating, teks: 'Seru', waktu_ms: wib(tgl), url: 'https://g/' + id, tnama: 'Laksamana' })
const list = [ulasan('g1', 'Wahyu Ramadhani', '2026-11-20'), ulasan('g2', 'Refanda Zulni', '2026-11-20'), ulasan('g3', 'Darel Fauzi', '2026-11-20')]
const dari = '2026-10-26'
const m = (nama, date = '2026-11-20') => G.cocokGoogle({ reviewerName: nama, date }, list, dari)

cek('nama persis (huruf besar & tanda baca diabaikan) = cocok', m('  WAHYU   ramadhani! ').jenis === 'cocok')
cek('nama sebagian = mirip', m('Wahyu').jenis === 'mirip')
cek('email: nama penulis di depan @ = mirip, tidak pernah cocok', m('darelfauzi15@gmail.com').jenis === 'mirip' && m('darelfauzi15@gmail.com').id === 'g3')
cek('tidak ada = tidak', m('Budi Santoso').jenis === 'tidak')
cek('nama kosong = tanpaNama', m('').jenis === 'tanpaNama')
cek('klaim lebih tua dari jendela = luar', m('Wahyu Ramadhani', '2026-10-01').jenis === 'luar')
cek('ulasan 2 hari sebelum klaim tidak dipakai', m('Wahyu Ramadhani', '2026-11-22').jenis === 'tidak')
cek('ulasan sehari sebelum klaim masih dipakai', m('Wahyu Ramadhani', '2026-11-21').jenis === 'cocok')

const klaim = (id, nama, status = 'diklaim', lain = {}) => ({ id, name: 'Tamu ' + id, reviewerName: nama, date: '2026-11-20', status, ...lain })
const data = { review: list, sumber: ['places'], syncAt: 100 }
const opsi = { hariIni: '2026-11-25', oleh: 'Wandi', kini: 5 }
const daftar = [klaim('a', 'Wahyu Ramadhani'), klaim('b', 'Budi', 'terverifikasi'), klaim('c', 'Wahyu Ramadhani')]
const satu = G.terapkanCekGoogle(daftar, data, opsi)
cek('hanya klaim yang menunggu yang diisi', satu.jumlah === 2 && !satu.next[1].googleCek && satu.next[0].googleCek.jenis === 'cocok' && satu.next[0].googleCek.by === 'Wandi')
cek('sumber tanpa Business Profile ditandai lemah', satu.next[0].googleCek.lemah === true)
cek('cek otomatis kedua tidak menulis apa pun (sinkron baru saja bukan perubahan)', G.terapkanCekGoogle(satu.next, { ...data, syncAt: 200 }, opsi).jumlah === 0)
cek('urutan kunci dari server tidak dianggap berubah', G.terapkanCekGoogle(
  satu.next.map(r => r.googleCek ? { ...r, googleCek: Object.fromEntries(Object.entries(r.googleCek).reverse()) } : r), data, { ...opsi, denganSync: true }).jumlah === 0)
cek('cek manual mencatat sinkron yang lebih baru', G.terapkanCekGoogle(satu.next, { ...data, syncAt: 200 }, { ...opsi, denganSync: true }).jumlah === 2)
const lama = [klaim('d', 'Wahyu Ramadhani', 'diklaim', { date: '2026-10-01', googleCek: { jenis: 'cocok', id: 'g1' } })]
cek('"di luar jendela" tidak menimpa kecocokan lama', G.terapkanCekGoogle(lama, data, opsi).jumlah === 0)
cek('satu ulasan dipakai dua klaim terdeteksi', G.googleDipakai(satu.next, satu.next[0])?.id === 'c')
cek('klaim yang ditolak tidak memegang ulasan', !G.googleDipakai([satu.next[0], { ...satu.next[2], status: 'ditolak' }], satu.next[0]))
cek('kelompok tapis: tanpa hasil / luar = manual', G.kelompokCek(klaim('e', 'x')) === 'manual' && G.kelompokCek(satu.next[0]) === 'cocok')

console.log(`\n${ok} OK, ${gagal} GAGAL`)
if (gagal) process.exit(1)
