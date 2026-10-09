/* Guard untuk app/utils/marketing-performa.ts + app/utils/marketing-pegawai.ts
 * (issue #63: Performa Omset & Bonus, Pegawai & Akses).
 * node tools/uji-marketing-sistem.mjs (Node 24: impor .ts langsung)
 */
import { register } from 'node:module'

register('data:text/javascript,' + encodeURIComponent(`
  import { pathToFileURL } from 'node:url'
  import path from 'node:path'
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('~/')) return next(pathToFileURL(path.resolve('app', spec.slice(2) + '.ts')).href, ctx)
    return next(spec, ctx)
  }
`))

const M = await import('../app/utils/marketing.ts')
const P = await import('../app/utils/marketing-performa.ts')
const G = await import('../app/utils/marketing-pegawai.ts')
const B = await import('../app/utils/performa-bonus.ts')

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
const sama = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const ST = { ...M.SETTING_MKT_BAWAAN }
const tagih = n => ({ rincianItem: [{ desc: 'Paket', harga: n }] })

console.log('\nmarketing-performa: acara modul')
const events = [
  { id: 'e1', clientId: 'c1', nama: 'Gala PT A', status: 'Deal', tanggal: '2026-10-05', mktPIC: 'u1', detail: tagih(10_000_000) },
  { id: 'e2', clientId: 'c1', nama: 'Seminar B', status: 'Event Done', tanggal: '2026-10-09', mktPIC: 'u2', detail: tagih(4_000_000), nominalDiakui: 3_500_000 },
  { id: 'e3', clientId: 'c1', nama: 'Lead C', status: 'Lead', tanggal: '2026-10-10', mktPIC: 'u1', detail: tagih(9) },
  { id: 'e4', clientId: 'c1', nama: 'Bulan lalu', status: 'Deal', tanggal: '2026-09-30', mktPIC: 'u1', detail: tagih(9) },
  { id: 'e5', clientId: 'c1', nama: 'Timpa kosong', status: 'Confirmed', tanggal: '2026-10-11', mktPIC: 'u1', detail: tagih(2_000_000), nominalDiakui: '' },
]
const vip = [
  { id: 'v1', jenis: 'Assisted', tanggal: '2026-10-07', nama: 'Bu Rina', clientId: 'c2', nominal: 1_500_000, mktPIC: 'u2' },
  { id: 'v2', jenis: 'Regular', tanggal: '2026-10-07', nama: 'Pak Tono', nominal: 900_000 },
  { id: 'v3', jenis: 'Assisted', tanggal: '2026-10-08', nama: 'Batal', nominal: 700_000, batalAt: '2026-10-01' },
  { id: 'v4', jenis: 'Assisted', tanggal: '2026-10-12', nama: 'Tanpa CRM', perusahaan: 'CV Tulis', nominal: 'x' },
]
const clients = [{ id: 'c1', nama: 'A' }, { id: 'c2', nama: 'Rina', perusahaan: 'PT Rina' }]
const acara = P.acaraPfoMkt(events, vip, clients, ST, '2026-10')
cek('hanya Confirmed/Deal/Event Done di bulan itu + VIP Assisted tidak batal', sama(acara.map(a => a.srcId), ['mkt:e1', 'mkt:e2', 'mkt:e5', 'vip:v1', 'vip:v4']), JSON.stringify(acara.map(a => a.srcId)))
const e1 = acara.find(a => a.srcId === 'mkt:e1')
cek('nominal event = grand total penawaran (pajak + service)', e1.asal > 10_000_000 && e1.nominal === e1.asal && !e1.timpa, String(e1.asal))
const e2 = acara.find(a => a.srcId === 'mkt:e2')
cek('nominalDiakui menimpa, asal tetap grand total', e2.nominal === 3_500_000 && e2.timpa && e2.asal > 4_000_000)
cek('nominalDiakui kosong = tidak ditimpa', acara.find(a => a.srcId === 'mkt:e5').timpa === false)
const v1 = acara.find(a => a.srcId === 'vip:v1')
cek('nama VIP ditulis seperti baris breakdown (perusahaan dari CRM)', v1.name === 'VIP — Bu Rina (PT Rina)' && v1.nominal === 1_500_000, v1.name)
cek('perusahaan VIP tanpa CRM dari kolom ketikan; nominal tak terbaca = 0', acara.find(a => a.srcId === 'vip:v4').name === 'VIP — Tanpa CRM (CV Tulis)' && acara.find(a => a.srcId === 'vip:v4').nominal === 0)
cek('nominal VIP hanya Assisted', P.nominalVipPfoMkt({ jenis: 'Regular', nominal: 5 }) === 0)

console.log('\nmarketing-performa: PIC & gabungan')
const pics = [{ id: 'k1', name: 'Andi', officeUserId: 'u1' }, { id: 'k2', name: 'Budi Santoso' }]
const users = [{ id: 'u1', name: 'Andi P' }, { id: 'u2', name: 'budi santoso ' }]
cek('PIC dari officeUserId dulu', P.picDariPfoMkt('u1', pics, users)?.id === 'k1')
cek('PIC jatuh ke nama (pangkas + huruf kecil)', P.picDariPfoMkt('u2', pics, users)?.id === 'k2')
cek('PIC tidak dikenal -> null', P.picDariPfoMkt('u9', pics, users) === null && P.picDariPfoMkt('', pics, users) === null)
const bd = [
  { date: '2026-10-05', name: 'Gala PT A', amount: 9, tax: 1, service: 0, ob: 0, porsi: e1.asal, tiket: false, srcId: 'mkt:e1', jenis: '' },
  { date: '2026-10-03', name: 'Manual finance', amount: 5, tax: 0, service: 0, ob: 0, porsi: 5, tiket: false, srcId: '', jenis: '' },
]
const picDari = uid => P.picDariPfoMkt(uid, pics, users)
const semua = P.gabungPfoMkt(acara, bd, '__all__', picDari)
cek('Semua: acara modul + baris breakdown tanpa pasangan (hanyaBd)', semua.length === 6 && semua.filter(r => r.hanyaBd).length === 1)
cek('dicocokkan lewat srcId, bukan nama', semua.find(r => r.srcId === 'mkt:e1').bd === bd[0])
cek('urut tanggal lalu nama', semua[0].name === 'Manual finance' && semua.map(r => r.date).join() === [...semua.map(r => r.date)].sort().join())
const andi = P.gabungPfoMkt(acara, [bd[0]], 'k1', picDari)
cek('segmen PIC: hanya acara PIC itu', sama(andi.map(r => r.srcId), ['mkt:e1', 'mkt:e5']), JSON.stringify(andi.map(r => r.srcId)))
cek('acara PIC lain tidak masuk walau bd-nya tidak ada', !andi.some(r => r.srcId === 'vip:v1'))
cek('beda Diakui: cocok = 0', P.bedaDiakuiPfoMkt(semua.find(r => r.srcId === 'mkt:e1')) === 0)
cek('beda Diakui: belum diinput / hanya bd -> null', P.bedaDiakuiPfoMkt(semua.find(r => r.srcId === 'vip:v1')) === null && P.bedaDiakuiPfoMkt(semua.find(r => r.hanyaBd)) === null)
cek('beda Diakui bertanda', P.bedaDiakuiPfoMkt({ bd: { porsi: 900 }, nominal: 1000 }) === -100)

console.log('\nmarketing-performa: kontribusi & akses')
cek('kontribusi = (omset+tax+service+OB) / omset hari', P.kontribusiPfoMkt({ amount: 600, tax: 60, service: 30, ob: 10 }, 2000) === 35)
cek('tanpa omset hari -> null (bukan 0%)', P.kontribusiPfoMkt({ amount: 600 }, 0) === null && P.kontribusiPfoMkt({ amount: 600 }, undefined) === null)
const aku = P.akuPicPfoMkt({ id: 'u1', name: 'X' }, pics)
cek('PIC saya lewat id Office', aku?.id === 'k1')
cek('PIC saya lewat nama', P.akuPicPfoMkt({ id: 'zz', name: ' Budi Santoso' }, pics)?.id === 'k2')
cek('Semua selalu boleh', P.bolehLihatPfoMkt('__all__', false, null))
cek('bukan Head: hanya diri sendiri', P.bolehLihatPfoMkt('k1', false, aku) && !P.bolehLihatPfoMkt('k2', false, aku))
cek('tanpa PIC cocok: tak ada segmen orang', !P.bolehLihatPfoMkt('k1', false, null))
cek('Head/admin: siapa saja', P.bolehLihatPfoMkt('k2', true, null))
const agg = { k1: { real: 100, events: [bd[0]], comp: 10, compRows: [{}] }, k2: { real: 50, events: [bd[1]], comp: 5, compRows: [{}, {}] } }
const gab = P.gabunganPfoMkt(pics, agg, false)
cek('gabungan: real/comp/compRows dijumlah', gab.real === 150 && gab.comp === 15 && gab.compRows.length === 3 && gab.events.length === 2)
cek('gabungan tanpa hak: nama PIC tidak ikut di baris', gab.events.every(e => !('pic' in e)))
cek('gabungan untuk Head: nama PIC ikut', P.gabunganPfoMkt(pics, agg, true).events[0].pic === 'Andi')
const ket = P.ketDariUsersPfoMkt([{ id: 'u1', name: 'Andi P', jabatan: 'Marketing Head' }, { id: 'u5', name: 'Budi Santoso', jabatan: 'Marketing' }])
cek('keterangan lewat officeUserId lalu nama', ket(pics[0]) === 'Marketing Head' && ket(pics[1]) === 'Marketing' && ket({ id: 'x', name: 'Zed' }) === null)
cek('Head memakai pbHead yang sama (kata utuh)', B.pbHead(pics[0], ket) && !B.pbHead(pics[1], ket))
cek('digit rupiah', P.digitRupiahPfoMkt('Rp 1.250.000') === '1250000' && P.digitRupiahPfoMkt('') === '')

console.log('\nmarketing-pegawai: role dari jabatan')
cek('Marketing Manager -> manager (kata berkuasa dulu)', G.roleDariJabatanMkt('Marketing Manager') === 'manager')
cek('Finance -> finance', G.roleDariJabatanMkt('Finance & Admin') === 'finance')
cek('super admin butuh kedua kata', G.roleDariJabatanMkt('Super Admin') === 'super_admin' && G.roleDariJabatanMkt('Admin Gudang') === '')
cek('kata utuh: Barista bukan bar, Administrasi bukan admin', G.roleDariJabatanMkt('Administrasi') === '' && G.roleDariJabatanMkt('Barista') === '')
cek('Sales -> marketing', G.roleDariJabatanMkt('Sales & Partnership') === 'marketing')
cek('kosong -> \'\'', G.roleDariJabatanMkt('') === '')
cek('divisi dari keterangan (kata utuh)', G.divisiDariKeteranganMkt('Bar Head', ['Kitchen', 'Bar']) === 'Bar' && G.divisiDariKeteranganMkt('Barista', ['Bar']) === '')
cek('tim dari jabatan lalu div', G.timUserMkt({ jabatan: ' Marketing ' }) === 'Marketing' && G.timUserMkt({ div: 'Bar' }) === 'Bar')
cek('akses custom dikenali (acc / nav lama)', G.aksesKhususMkt({ acc: {} }) && G.aksesKhususMkt({ nav: [] }) && !G.aksesKhususMkt({}))

console.log('\nmarketing-pegawai: rencana sinkron')
const uLama = [
  { id: 'o1', name: 'Andi', role: 'marketing', hp: '', jabatan: 'Marketing', active: true, updatedAt: 11 },
  { id: 'lokal', name: 'Citra', role: 'operational', hp: '081', jabatan: 'Kitchen', active: true, updatedAt: 22 },
  { id: 'o4', name: 'Dewi', role: 'finance', jabatan: '', active: true, updatedAt: 33 },
]
const roster = [
  { id: 'o1', name: 'Andi', keterangan: 'Marketing Manager', noHp: '0812', active: true },
  { id: 'o2', name: 'Citra', keterangan: 'Kitchen', noHp: '', active: false },
  { id: 'o3', name: 'Eko', keterangan: 'Bar', noHp: '0857', active: true },
  { id: 'o4', name: 'Dewi', keterangan: '', noHp: '', active: true },
  { id: 'o5', name: 'Fajar', keterangan: '', noHp: '', active: true },
]
const anggota = [{ id: 'o1' }, { id: 'o3', isModuleAdmin: true }, { id: 'o5' }]
const r = G.rencanaSinkronMkt(uLama, roster, anggota, ['Kitchen', 'Bar'], M.namaRoleMkt)
const ubahAndi = r.ubah.find(u => u.id === 'o1')
cek('role ikut jabatan + No. HP & jabatan dari Office', sama(ubahAndi?.fields, { role: 'manager', hp: '0812', jabatan: 'Marketing Manager' }), JSON.stringify(ubahAndi?.fields))
cek('versi ikut (If-Match = updatedAt)', ubahAndi?.versi === 11)
const ubahCitra = r.ubah.find(u => u.id === 'lokal')
cek('dicocokkan lewat nama bila id beda; aktif ikut Office; HP kosong tidak menghapus', sama(ubahCitra?.fields, { div: 'Kitchen', active: false }), JSON.stringify(ubahCitra?.fields))
cek('Tim kosong: role TIDAK disentuh', !r.ubah.find(u => u.id === 'o4')?.fields.role)
const eko = r.baru.find(u => u.id === 'o3')
cek('baru: admin modul -> Super Admin, divisi ditebak', eko?.role === 'super_admin' && eko.div === 'Bar' && eko.hp === '0857')
cek('baru tanpa Tim: role kosong (Belum ada akses), bukan ditebak', r.baru.find(u => u.id === 'o5')?.role === '')
cek('jejak perubahan role terbaca', r.roleBerubah.includes('Andi: Marketing → Manager / Approver'))
cek('hitung yang Tim-nya tak menunjuk divisi (seperti lama)', r.tanpaDiv === 3, String(r.tanpaDiv))
const rGagal = G.rencanaSinkronMkt(uLama, roster, null, ['Kitchen', 'Bar'], M.namaRoleMkt)
cek('anggota gagal dibaca: TIDAK ada role yang diubah', rGagal.ubah.every(u => !('role' in u.fields)) && rGagal.roleBerubah.length === 0 && rGagal.baru.every(u => u.role === ''))
const rSama = G.rencanaSinkronMkt([{ id: 'o3', name: 'Eko', role: 'super_admin', hp: '0857', jabatan: 'Bar', div: 'Bar', active: true }], [roster[2]], anggota, ['Bar'], M.namaRoleMkt)
cek('tidak ada perubahan -> tidak ada tulisan', rSama.ubah.length === 0 && rSama.baru.length === 0)
cek('jenis anggota non-anggota tanpa jabatan terbaca -> operational', G.rencanaSinkronMkt([], [{ id: 'o9', name: 'Gita', keterangan: 'Floor', active: true }], [], [], M.namaRoleMkt).baru[0].role === 'operational')
cek('anggota tanpa jabatan terbaca -> marketing', G.rencanaSinkronMkt([], [{ id: 'o9', name: 'Gita', keterangan: 'Floor', active: true }], [{ id: 'o9' }], [], M.namaRoleMkt).baru[0].role === 'marketing')

console.log('\nmarketing-pegawai: matriks')
cek('siklus None -> Lihat -> Ubah -> None', G.putarLevelMkt(0) === 1 && G.putarLevelMkt(1) === 2 && G.putarLevelMkt(2) === 0)
const mat = G.simpanMatriksMkt({ marketing: { dashboard: 0, crm: 2 }, super_admin: { dashboard: 0 } })
cek('Super Admin tidak disimpan (selalu penuh)', !('super_admin' in mat))
cek('dashboard minimal Lihat', mat.marketing.dashboard === 1 && mat.finance.dashboard === 1)
cek('semua layar terisi angka', M.VIEW_KEYS_MKT.every(v => typeof mat.marketing[v] === 'number') && mat.marketing.crm === 2)
const accU = G.simpanAksesUserMkt({ dashboard: 0, invoices: 2 })
cek('akses per orang: dashboard minimal Lihat + layar lain 0', accU.dashboard === 1 && accU.invoices === 2 && accU.crm === 0)
cek('judul tiap layar matriks ada', M.VIEW_KEYS_MKT.every(v => G.JUDUL_VIEW_MKT[v]))

console.log(`\n${ok} OK, ${gagal} GAGAL`)
process.exit(gagal ? 1 : 0)
