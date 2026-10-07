/*
 * tools/uji-konten.mjs — guard for app/utils/konten.ts.
 *
 *   node tools/uji-konten.mjs      (Node 24: imports the .ts directly)
 *
 * The rules that fail SILENTLY in the old Panel (docs/migrasi/konten.md F):
 *   - the role matrix: default when unset, OLD list-of-roles rows become edit
 *     (never lock anyone out), loosest role wins, super_admin always edit;
 *   - Pengaturan is not in the map for `team` here (that's useKonten); screens
 *     outside VIEW_PERM are open;
 *   - platforms: long old names normalised, de-duplicated, old single field read;
 *   - detailing read both ways; content/print types read old single values;
 *   - Tugas Saya from 3 sources, overdue first, no deadline last, done hidden;
 *   - calendar: linked shootings not counted twice, Cancelled not published;
 *   - "Belum ada PIC" is __none__, not ''.
 */
import * as K from '../app/utils/konten.ts'

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
const kini = new Date('2026-10-07T10:00:00')

console.log('\nkonten: matriks hak akses')
const def = K.permDefaultKonten()
cek('default: planner boleh ubah content, tidak boleh approve', def.content.content_planner === 2 && def.approve.content_planner === 0)
cek('default: analytics & activity ikut ter-seed', def.analytics.analyst === 2 && def.activity.content_director === 2)
cek('belum disetel → default', sama(K.permsKonten(null), def) && sama(K.permsKonten({}), def))
const lama = K.permsKonten({ content: ['designer'], approve: { content_planner: 1 } })
cek('baris LAMA (daftar role) → ubah untuk role itu saja', lama.content.designer === 2 && lama.content.content_planner === 0)
cek('role yang hilang di baris → ambil default', lama.approve.content_planner === 1 && lama.approve.content_director === 2)
cek('modul yang hilang → default', lama.brands.account_manager === 2)
cek('rangkap: level TERLONGGAR menang', K.levelKonten(def, ['designer', 'content_planner'], 'brands') === 2 && K.levelKonten(def, ['designer'], 'brands') === 0)
cek('super_admin selalu ubah', K.modPermKonten({ settings: { super_admin: 0 } }, 'settings', 'super_admin') === 2)
cek('pensiun bank/reports tercatat', sama(K.PERM_PENSIUN_KONTEN, ['bank', 'reports']))

console.log('\nkonten: pembaca dua arah')
cek('platform: nama panjang dinormalkan + dobel dibuang', sama(K.contentPlatforms({ platforms: ['Instagram', 'IG', 'TikTok'] }), ['IG', 'TT']))
cek('platform: field tunggal lama dibaca', sama(K.contentPlatforms({ platform: 'Facebook' }), ['FB']) && K.contentPlatforms(null).length === 0)
cek('content type lama tunggal dibaca', sama(K.contentTypes({ contentType: 'Reel' }), ['Reel']) && K.contentTypeLabel({}) === '-')
cek('print type daftar menang atas tunggal', sama(K.printTypes({ printTypes: ['A4', 'A4', 'Menu'], printType: 'A5' }), ['A4', 'Menu']))
cek('detailing: field baru apa adanya', K.contentDetail({ detail: 'X', caption: 'Y' }) === 'X')
cek('detailing: 4 field lama disusun ulang dengan judul', K.contentDetail({ keyword: 'kopi', caption: 'Halo', hashtags: ['#a', '#b'], script: 'S1' })
  === 'Keyword: kopi\n\nCaption:\nHalo\n\nHashtag: #a #b\n\nScript / Storyboard:\nS1')

console.log('\nkonten: tanggal & arsip')
cek('sisa hari: kemarin -1, hari ini 0, kosong null', K.sisaHariKonten('2026-10-06', kini) === -1 && K.sisaHariKonten('2026-10-07', kini) === 0 && K.sisaHariKonten('', kini) === null)
cek('rel hari: lewat tidak ditulis', K.relHariKonten('2026-10-06', kini) === '' && K.relHariKonten('2026-10-08', kini) === 'Besok' && K.relHariKonten('2026-10-10', kini) === 'H-3')
cek('lewat tenggat hanya bila belum selesai', K.lewatTenggat('2026-10-01', false, kini) && !K.lewatTenggat('2026-10-01', true, kini))
cek('STATUS_ARSIP satu daftar', K.sudahArsip({ status: 'Posted' }) && K.sudahArsip({ status: 'Cancelled' }) && !K.sudahArsip({ status: 'Scheduled' }))
cek('PIC: __none__ = tanpa PIC, "" = semua', K.picCocok(K.PIC_KOSONG, '') && !K.picCocok(K.PIC_KOSONG, 'u1') && K.picCocok('', 'u9') && !K.picCocok('u1', 'u2'))

console.log('\nkonten: tugas saya')
const content = [
  { id: 'a', title: 'A', pic: 'me', status: 'Design', deadline: '2026-10-09', prod: { design: { date: '2026-10-05', status: 'todo' }, shoot: { date: '2026-10-01', status: 'done' } } },
  { id: 'b', title: 'B', pic: 'me', status: 'Posted', deadline: '2026-10-01', prod: { edit: { date: '2026-10-08' } } },
  { id: 'c', title: 'C', pic: 'other', status: 'Idea', deadline: '2026-10-02' },
  { id: 'd', title: '', pic: 'me', status: 'Idea' },
]
const tasks = [
  { id: 't1', kind: 'edit', title: 'T1', pic: 'me', date: '2026-10-06' },
  { id: 't2', kind: 'shoot', title: 'T2', pic: 'me', status: 'done', date: '2026-10-01' },
]
const my = K.tugasSaya('me', content, tasks, kini)
cek('3 sumber: konten aktif, kebutuhan produksi, tugas mandiri', sama(my.map(x => x.jenis + ':' + x.ref), ['prod:a', 'mandiri:t1', 'prod:b', 'konten:a', 'konten:d']), JSON.stringify(my.map(x => x.jenis + ':' + x.ref)))
cek('konten arsip tidak ikut, tapi kebutuhan produksinya yang belum selesai ikut', !my.some(x => x.jenis === 'konten' && x.ref === 'b') && my.some(x => x.jenis === 'prod' && x.ref === 'b'))
cek('yang selesai tidak ikut; tanpa deadline di paling bawah', !my.some(x => x.ref === 't2') && my.at(-1).ref === 'd' && my.at(-1).title === '(tanpa judul)')

console.log('\nkonten: kalender')
const ev = K.acaraKalender({
  content: [
    { id: 'p', title: 'P', publishDate: '2026-10-07', publishTime: '19:00', status: 'Scheduled', prod: { shoot: { date: '2026-10-05', status: 'done' } } },
    { id: 'x', title: 'X', publishDate: '2026-10-07', status: 'Cancelled' },
  ],
  prodTasks: [{ id: 't', kind: 'design', title: 'T', date: '2026-10-08' }],
  shootings: [{ id: 's1', title: 'Tertaut', date: '2026-10-05', contentId: 'p' }, { id: 's2', title: '', date: '2026-10-06' }],
  visits: [{ id: 'v', date: '2026-10-07', invitees: ['k1', 'k2'] }],
  namaKol: id => (id === 'k1' ? 'Rina' : '-'),
}, { publish: true, shoot: true, design: true, edit: true, visit: true })
cek('Cancelled tidak tayang di kalender', !ev.some(e => e.cid === 'x'))
cek('shooting tertaut konten tidak dihitung dua kali', ev.filter(e => e.type === 'shoot').length === 2 && !ev.some(e => e.sid === 's1'))
cek('kebutuhan produksi selesai ditandai done', ev.find(e => e.type === 'shoot' && e.cid === 'p').done === true)
cek('kunjungan: nama undangan pertama + jumlah', ev.find(e => e.vid === 'v').title === 'Rina - 2 undangan')
cek('saringan jenis dihormati', K.acaraKalender({ content: [{ id: 'p', publishDate: '2026-10-07' }], prodTasks: [], shootings: [], visits: [] }, { publish: false, shoot: true, design: true, edit: true, visit: true }).length === 0)

console.log(`\n${ok} OK, ${gagal} GAGAL\n`)
process.exit(gagal ? 1 : 0)
