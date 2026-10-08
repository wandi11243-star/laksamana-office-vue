/* Guard untuk app/utils/marketing-tugas.ts + app/utils/marketing-operasional.ts
 * (issue #62: Task Divisi, Template Task, Katalog, Purchase Order).
 * node tools/uji-marketing-tugas.mjs (Node 24: impor .ts langsung)
 * hook resolve: ~/x -> app/x.ts, file diuji apa adanya.
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

const T = await import('../app/utils/marketing-tugas.ts')
const O = await import('../app/utils/marketing-operasional.ts')

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

const tpl = [
  { id: 't1', div: 'Prasmanan', sub: '', task: 'Cek menu' },
  { id: 't2', div: 'Prasmanan', sub: 'Kitchen', task: 'Masak', hminus: 1 },
  { id: 't3', div: 'Prasmanan', sub: 'Bar', task: 'Es batu' },
  { id: 't4', div: 'Kitchen', sub: '', task: 'Lama' },
]
const subs = [
  { id: 's1', div: 'Prasmanan', nama: 'Bar' },
  { id: 's2', div: 'Prasmanan', nama: 'Kitchen' },
  { id: 's3', div: 'Set Menu', nama: 'Bar' },
  { id: 's4', div: 'Kitchen', nama: 'Dapur' },
]
const ev = (isi = {}) => ({ id: 'e1', nama: 'Gathering', status: 'Deal', tanggal: '2026-10-10', clientId: 'c1', detail: { fbFormat: 'Prasmanan' }, ...isi })

console.log('\nkategori')
cek('kategori org: [] = bawaan divisi + taskCategories', sama(T.kategoriOrgMkt([], ['Sound']), ['Kitchen', 'Bar', 'Floor', 'Design', 'Event', 'Security', 'Sound']) && sama(T.kategoriOrgMkt(['A'], ['B']), ['A']))
cek('kategori lama: hanya yang masih punya template/sub', sama(T.kategoriLamaMkt(['Kitchen', 'Bar', 'Floor'], tpl, subs), ['Kitchen']))
cek('nama kategori: wajib, unik tak peka huruf, Lainnya terlarang', T.cekNamaKategoriMkt('', [], [])?.judul === 'Nama wajib'
&& T.cekNamaKategoriMkt('prasmanan', ['Prasmanan'], [])?.judul === 'Sudah ada'
&& T.cekNamaKategoriMkt('kitchen', [], ['Kitchen'])?.judul === 'Sudah ada'
&& T.cekNamaKategoriMkt('lainnya', [], []) !== null
&& T.cekNamaKategoriMkt('Prasmanan', ['Prasmanan'], [], 'Prasmanan') === null
&& T.cekNamaKategoriMkt('Buffet', ['Prasmanan'], ['Kitchen']) === null)
cek('nama dibersihkan dari kutip & backslash', T.bersihNamaMkt(` "Set'\\ Menu" `) === 'Set Menu')
cek('nama sub: unik per kategori', T.cekNamaSubMkt('bar', subs, 'Prasmanan')?.judul === 'Sudah ada' && T.cekNamaSubMkt('bar', subs, 'Prasmanan', 's1') === null && T.cekNamaSubMkt('Bar', subs, 'Coffee Break') === null)

console.log('\npapan event')
const e1 = ev({ jobProgress: { Prasmanan: { t1: 100, t2: 37, t3: 140 } }, jobMeta: { Prasmanan: { t2: { pic: 'Sari', note: '' } } }, extraJobs: { Prasmanan: [{ id: 'x1', div: 'Prasmanan', sub: 'Bar', task: 'Gelas', pic: 'Budi', extra: true }] } })
cek('progres dijepit 0–100 & dibulatkan', T.jobProgMkt(e1, 'Prasmanan', 't3') === 100 && T.jobProgMkt(e1, 'Prasmanan', 't2') === 37 && T.jobProgMkt(e1, 'Prasmanan', 'zz') === 0)
cek('selesai hanya 100 — data lama 60% belum selesai', !T.jobSelesaiMkt(ev({ jobProgress: { P: { a: 60 } } }), 'P', 'a') && T.jobSelesaiMkt(ev({ jobProgress: { P: { a: 100 } } }), 'P', 'a'))
cek('item event = template + tambahan', T.itemEventMkt(e1, 'Prasmanan', tpl).map(t => t.id).join() === 't1,t2,t3,x1')
cek('progres kategori = rata-rata item', T.progresDivMkt(e1, 'Prasmanan', tpl) === Math.round((100 + 37 + 100 + 0) / 4))
cek('progres sub', T.progresSubMkt(e1, 'Prasmanan', 'Bar', tpl) === 50 && T.progresSubMkt(e1, 'Prasmanan', 'Kosong', tpl) === 0)
cek('hitung item: selesai = 100', sama(T.hitungItemMkt(e1, ['Prasmanan'], tpl), { total: 4, selesai: 2, pct: 50 }) && sama(T.hitungItemMkt(e1, [], tpl), { total: 0, selesai: 0, pct: 0 }))
cek('field: meta event menimpa template, kosong = template', T.jobFieldMkt(e1, 'Prasmanan', tpl[1], 'pic') === 'Sari' && T.jobFieldMkt(ev({ jobMeta: { Prasmanan: { t2: { pic: '' } } } }), 'Prasmanan', { ...tpl[1], pic: 'Andi' }, 'pic') === 'Andi')
cek('field item tambahan dibaca dari item', T.jobFieldMkt(e1, 'Prasmanan', e1.extraJobs.Prasmanan[0], 'pic') === 'Budi')
cek('sub siap dihitung dari sub 100%', T.subSiapMkt(e1, 'Prasmanan', ['Bar', 'Kitchen'], tpl) === 0 && T.subSiapMkt(ev({ jobProgress: { Prasmanan: { t3: 100, x1: 100 } }, extraJobs: e1.extraJobs }), 'Prasmanan', ['Bar', 'Kitchen'], tpl) === 1 && T.subSiapMkt(e1, '', ['Bar'], tpl) === 0)
const urut = T.urutPapanMkt(T.itemEventMkt(e1, 'Prasmanan', [...tpl, { id: 't9', div: 'Prasmanan', sub: 'Hilang', task: 'x' }]), subs)
cek('urut papan: tanpa sub dulu, lalu urutan sub, sub tak terdaftar di ekor', urut.map(g => g.sub).join('|') === '|Bar|Kitchen|Hilang')
cek('urut papan: template di atas tambahan dalam satu sub', urut[1].items.map(t => t.id).join() === 't3,x1')
cek('urut tugas bebas: urutan kemunculan', T.urutBebasMkt([{ id: 'a', sub: 'Hari-H' }, { id: 'b', sub: '' }, { id: 'c', sub: 'Hari-H' }]).map(g => g.sub + ':' + g.items.length).join() === 'Hari-H:2,:1')
cek('handover: Confirmed/Deal/Event Done, sampai H+2 lewat, urut tanggal', T.eventHandoverMkt([
  ev({ id: 'a', tanggal: '2026-10-12' }), ev({ id: 'b', tanggal: '2026-10-06', status: 'Event Done' }), ev({ id: 'c', tanggal: '2026-10-05' }),
  ev({ id: 'd', tanggal: '2026-10-09', status: 'Prospect' }), ev({ id: 'f', tanggal: '2026-10-09', status: 'Confirmed' }), ev({ id: 'g', tanggal: '' }),
], '2026-10-08').map(e => e.id).join() === 'b,f,a')

console.log('\npapan: tulis')
cek('centang: 100 ↔ 0, kategori lain utuh', (() => {
  const a = T.toggleSelesaiMkt(e1, 'Prasmanan', 't2').jobProgress
  const b = T.toggleSelesaiMkt(ev({ jobProgress: { Prasmanan: { t1: 100 }, Lain: { z: 5 } } }), 'Prasmanan', 't1').jobProgress
  return a.Prasmanan.t2 === 100 && b.Prasmanan.t1 === 0 && b.Lain.z === 5
})())
cek('meta: satu field, sisanya utuh', (() => {
  const m = T.setJobMetaMkt(e1, 'Prasmanan', 't2', 'note', 'cepat').jobMeta
  return m.Prasmanan.t2.pic === 'Sari' && m.Prasmanan.t2.note === 'cepat'
})())
cek('tambah item: sub ikut, extra:true, hminus null', (() => {
  const x = T.tambahJobMkt(e1, 'Prasmanan', 'Kitchen', 'x2').extraJobs.Prasmanan
  return x.length === 2 && x[1].sub === 'Kitchen' && x[1].extra === true && x[1].hminus === null
})())
cek('ubah item tambahan: hminus jadi angka ≥0 / null', (() => {
  const a = T.setJobTambahanMkt(e1, 'Prasmanan', 'x1', 'hminus', '7.6').extraJobs.Prasmanan[0].hminus
  const b = T.setJobTambahanMkt(e1, 'Prasmanan', 'x1', 'hminus', '').extraJobs.Prasmanan[0].hminus
  const c = T.setJobTambahanMkt(e1, 'Prasmanan', 'x1', 'hminus', '-3').extraJobs.Prasmanan[0].hminus
  return a === 8 && b === null && c === 0
})())
cek('hapus item tambahan: progresnya ikut hilang', (() => {
  const r = T.hapusJobMkt(ev({ extraJobs: e1.extraJobs, jobProgress: { Prasmanan: { x1: 100, t1: 100 } } }), 'Prasmanan', 'x1')
  return r.extraJobs.Prasmanan.length === 0 && !('x1' in r.jobProgress.Prasmanan) && r.jobProgress.Prasmanan.t1 === 100
})())

console.log('\nWA')
cek('staf aktif & urut nama', T.stafMkt([{ name: 'Zed' }, { name: 'Andi' }, { name: 'X', active: false }, { name: '' }]).map(u => u.name).join() === 'Andi,Zed')
cek('HP dicocokkan nama tak peka huruf', T.hpStafMkt([{ name: 'Sari', hp: '0812' }], 'sari') === '0812' && T.hpStafMkt([], '') === '')
cek('link WA: 0 → 62', T.linkWaMkt('0812-33', 'hai') === 'https://wa.me/6281233?text=hai')
cek('pesan: kategori · sub, deadline dari H-', (() => {
  const p = T.pesanTugasMkt(ev({ detail: { area: 'Lainnya', areaLain: 'Rooftop' } }), 'Prasmanan', tpl[1], 'Sari', '', '', d => d)
  return p.includes('• Kategori: Prasmanan · Kitchen') && p.includes('Deadline: H-1') && p.includes('(2026-10-10 · Rooftop)') && !p.includes('Catatan')
})())
cek('pesan tugas bebas tanpa sub: tanpa baris kategori', !T.pesanTugasMkt(ev(), '_bebas', { id: 'z', task: 'a', extra: true }, 'S', '', '', d => d).includes('Kategori'))

console.log('\nrencana template')
const evs = [
  ev({ id: 'e1', updatedAt: 5, jobProgress: { Prasmanan: { t1: 100 } }, tasks: { Prasmanan: { status: 'Pending' } } }),
  ev({ id: 'e2', detail: { fbFormat: 'Set Menu' }, jobMeta: { Prasmanan: { t1: { pic: 'A' } }, Set: {} } }),
  ev({ id: 'e3', detail: { fbFormat: 'Set Menu' } }),
]
const rn = T.rencanaUbahNamaMkt('Prasmanan', 'Buffet', ['Prasmanan', 'Set Menu'], subs, tpl, evs)
cek('ubah nama: daftar, sub, template', sama(rn.formats, ['Buffet', 'Set Menu']) && rn.subs.filter(x => x.div === 'Buffet').length === 2 && rn.templates.length === 3 && rn.templates.every(t => t.fields.div === 'Buffet'))
cek('ubah nama: event — fbFormat + kunci progres/meta/tasks pindah', (() => {
  const a = rn.events.find(x => x.id === 'e1')
  const b = rn.events.find(x => x.id === 'e2')
  return rn.events.length === 2 && a.updatedAt === 5 && a.fields.detail.fbFormat === 'Buffet' && a.fields.jobProgress.Buffet.t1 === 100 && !('Prasmanan' in a.fields.jobProgress)
    && a.fields.tasks.Buffet.status === 'Pending' && !b.fields.detail && b.fields.jobMeta.Buffet.t1.pic === 'A' && 'Set' in b.fields.jobMeta && rn.nEvent === 1
})())
cek('ubah nama: kunci baru yang sudah ada tidak ditimpa', T.rencanaUbahNamaMkt('A', 'B', ['A'], [], [], [ev({ detail: {}, jobProgress: { A: { x: 1 }, B: { y: 2 } } })]).events[0].fields.jobProgress.B.y === 2)
let n = 0
const id = a => `${a}${++n}`
const sl = T.rencanaSalinMkt('Set Menu', 'Prasmanan', subs, [...tpl, { id: 't5', div: 'Set Menu', sub: 'Bar', task: 'Es batu' }], id)
cek('salin: sub yang belum ada saja, urutan sumber', sl.subsBaru.map(x => x.nama).join() === 'Kitchen' && sl.subsBaru[0].div === 'Set Menu')
cek('salin: item kembar (sub+nama) dilewati, id baru, div tujuan', sl.itemBaru.length === 2 && sl.lewat === 1 && sl.itemBaru.every(t => t.div === 'Set Menu' && t.id.startsWith('tt')) && sl.itemBaru.find(t => t.task === 'Masak').hminus === 1)
const pd = T.rencanaPindahMkt('Kitchen', 'Prasmanan', subs, tpl, [
  ev({ id: 'p1', jobProgress: { Kitchen: { t4: 100 }, Prasmanan: {} } }),
  ev({ id: 'p2', detail: { fbFormat: 'Set Menu' }, jobProgress: { Kitchen: { t4: 100 } } }),
  ev({ id: 'p3', jobProgress: { Kitchen: { t4: 50 }, Prasmanan: { t4: 10 } } }),
], id)
cek('pindah: sub "div" + "div — sub" dibuat di format, sub lama dibuang', pd.subs.filter(x => x.div === 'Prasmanan').map(x => x.nama).join() === 'Bar,Kitchen,Kitchen — Dapur' && !pd.subs.some(x => x.div === 'Kitchen'))
cek('pindah: item → div format, sub = nama divisi', pd.templates.length === 1 && sama(pd.templates[0].fields, { div: 'Prasmanan', sub: 'Kitchen' }))
cek('pindah: progres pindah hanya di event format itu, tidak menimpa', pd.events.length === 1 && pd.events[0].id === 'p1' && pd.events[0].fields.jobProgress.Prasmanan.t4 === 100 && !('t4' in pd.events[0].fields.jobProgress.Kitchen))
const ur = T.urutSubMkt([{ id: 'a', div: 'X' }, { id: 'z', div: 'Y' }, { id: 'b', div: 'X' }, { id: 'c', div: 'X' }], 'a', 'c')
cek('urut sub: ditarik ke bawah mendarat sesudah sasaran, kategori lain diam', ur.map(x => x.id).join() === 'b,z,c,a')
cek('urut sub: ke atas mendarat sebelum sasaran', T.urutSubMkt([{ id: 'a', div: 'X' }, { id: 'b', div: 'X' }, { id: 'c', div: 'X' }], 'c', 'a').map(x => x.id).join() === 'c,a,b')
cek('urut sub: lintas kategori ditolak', T.urutSubMkt([{ id: 'a', div: 'X' }, { id: 'z', div: 'Y' }], 'a', 'z').map(x => x.id).join() === 'a,z')
cek('urut sub: lintas kategori tidak mengubah apa pun', T.urutSubMkt([{ id: 'a', div: 'X' }, { id: 'b', div: 'X' }, { id: 'c', div: 'X' }, { id: 'z', div: 'Y' }], 'a', 'z').map(x => x.id).join() === 'a,b,c,z')
cek('baris template: rapi + hminus', sama(T.barisTemplateMkt({ div: 'P', task: ' Masak ', sub: '', pic: ' Sari ', note: ' n ', deadline: '', hminus: '15' }), { div: 'P', task: 'Masak', sub: '', pic: 'Sari', note: 'n', deadline: '', hminus: 15 }))
cek('hapus kategori lama: kunci progres & tasks dibuang', (() => {
  const r = T.rencanaHapusLamaMkt('Kitchen', [ev({ id: 'h1', jobProgress: { Kitchen: {}, Bar: { x: 1 } }, tasks: { Kitchen: {} } }), ev({ id: 'h2' })])
  return r.length === 1 && !('Kitchen' in r[0].fields.jobProgress) && r[0].fields.jobProgress.Bar.x === 1 && !('Kitchen' in r[0].fields.tasks)
})())

console.log('\npurchase order')
cek('akhir minggu = Minggu ini (Senin awal minggu)', O.akhirMingguMkt('2026-10-08') === '2026-10-11' && O.akhirMingguMkt('2026-10-11') === '2026-10-11' && O.akhirMingguMkt('2026-10-12') === '2026-10-18')
cek('rupiah ketik: titik ribuan, nol depan dibuang, maks 15 digit', O.formatRpKetikMkt('0012a50000') === '1.250.000' && O.formatRpKetikMkt('') === '' && O.angkaRpMkt('1.250.000') === 1250000 && O.formatRpKetikMkt('9'.repeat(20)).replace(/\./g, '').length === 15)
cek('kirim: baris tanpa nama dilewati; event masuk catatan; by kosong', (() => {
  const it = O.itemPoMkt([
    { item: ' Tisu ', qty: '3', unit: '', note: 'meja', amount: '25.000' },
    { item: '  ', qty: '1', unit: 'Unit', note: '', amount: '' },
    { item: 'Lilin', qty: '', unit: 'Pack', note: '', amount: '' },
  ], { needBy: '2026-10-11', div: 'Marketing', event: 'Gathering', nama: 'Wandi' })
  return it.length === 2 && it[0].item === 'Tisu' && it[0].qty === 3 && it[0].unit === 'Unit' && it[0].amount === 25000 && it[0].note === 'meja · Event: Gathering'
    && it[1].qty === 1 && it[1].note === 'Event: Gathering' && it[0].by === '' && it[0].byName === 'Wandi' && it[0].sumber === 'Marketing' && it[0].status === 'Diajukan'
})())
cek('daftar: hanya dari Marketing, terbaru di atas', O.poMarketingMkt([{ id: 'a', sumber: 'Marketing', createdAt: 1 }, { id: 'b', sumber: 'BD', createdAt: 9 }, { id: 'c', sumber: 'Marketing', createdAt: 5 }]).map(p => p.id).join() === 'c,a')
cek('warna status menurut arti; tak dikenal tetap ada', O.warnaStatusPoMkt('Ditolak') === 'error' && O.warnaStatusPoMkt('Disetujui') === 'success' && O.warnaStatusPoMkt('Diajukan') === 'warning' && O.warnaStatusPoMkt('Masuk PR') === 'neutral' && O.warnaStatusPoMkt('Sudah dibeli') === 'success')

console.log('\nkatalog')
cek('gambar dikenali dari nama', O.fotoKahMkt('a.JPEG') && !O.fotoKahMkt('a.pdf'))
cek('gerbang unggah: harus gambar, maks 8MB', O.cekGambarKatalogMkt('a.pdf', 1)?.judul === 'Harus gambar' && O.cekGambarKatalogMkt('a.png', 8 * 1024 * 1024 + 1)?.judul === 'File terlalu besar' && O.cekGambarKatalogMkt('a.png', 8 * 1024 * 1024) === null)
cek('judul ditebak dari nama berkas', O.tebakJudulMkt('area_indoor-full.AC.jpg') === 'area indoor full.AC')
cek('geser slide: tukar tetangga, ujung tak berubah', O.geserSlideMkt(['a', 'b', 'c'], 0, 1).join() === 'b,a,c' && O.geserSlideMkt(['a', 'b'], 0, -1).join() === 'a,b' && O.geserSlideMkt(['a', 'b'], 1, 1).join() === 'a,b')
cek('indeks slide berputar', O.indeksSlideMkt(-1, 3) === 2 && O.indeksSlideMkt(3, 3) === 0 && O.indeksSlideMkt(5, 0) === 0)

console.log(`\n${ok} OK, ${gagal} GAGAL`)
if (gagal) process.exit(1)
