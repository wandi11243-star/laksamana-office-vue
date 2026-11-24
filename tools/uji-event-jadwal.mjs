/* Guard for app/utils/event-jadwal.ts (Talent Schedule, roster style).
 *   node tools/uji-event-jadwal.mjs     (Node 24: imports the .ts directly)
 * A resolve hook maps `~/x` to app/x.ts; the tested file is used as it is.
 *
 * Rules that fail silently and put a wrong schedule on the floor:
 *   - ONE weekday helper, Monday = 0 (the old page wrote Saturday for "Jum");
 *   - default hours: talent override > category slot of that weekday >
 *     category slot for all days > none; `bawaan` wins among several;
 *   - a week that crosses a month is whole, and the clash check sees all of it;
 *   - clashes: same talent + date + overlapping hours, Cancelled ignored,
 *     back-to-back is fine, a second show is fine when it does not overlap;
 *   - copy last week / auto-fill skip filled cells and count them;
 *   - the batch body (create / update / delete) and the 300 limit.
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

const J = await import('../app/utils/event-jadwal.ts')

let ok = 0
let gagal = 0
const cek = (nama, syarat, ket = '') => {
  if (syarat) {
    ok++
    console.log('  OK    ' + nama)
  }
  else {
    gagal++
    console.log('  GAGAL ' + nama + (ket ? ' — ' + ket : ''))
  }
}
const sama = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ---------------------------------------------------------------- weekdays
console.log('Hari: Senin = 0')
// 2026-11-23 is a Monday, 2026-11-29 a Sunday
cek('2026-11-23 Senin = 0', J.idxHariEms('2026-11-23') === 0)
cek('2026-11-27 Jumat = 4 (bukan Sabtu)', J.idxHariEms('2026-11-27') === 4 && J.HARI_PENDEK[J.idxHariEms('2026-11-27')] === 'Jum')
cek('2026-11-28 Sabtu = 5', J.idxHariEms('2026-11-28') === 5)
cek('2026-11-29 Minggu = 6', J.idxHariEms('2026-11-29') === 6)
cek('2026-12-31 Kamis = 3', J.idxHariEms('2026-12-31') === 3)
cek('1970-01-01 Kamis = 3 (awal hitungan)', J.idxHariEms('1970-01-01') === 3)
cek('seninEms(Minggu) = Senin yang sama minggu', J.seninEms('2026-11-29') === '2026-11-23')
cek('seninEms(Senin) = dirinya', J.seninEms('2026-11-23') === '2026-11-23')
cek('tujuhHariEms lintas bulan', sama(J.tujuhHariEms('2026-11-30'), ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06']))
cek('tujuhHariEms lintas tahun', sama(J.tujuhHariEms('2026-12-28'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']))
let mulaiSemuaSenin = true
for (let i = 0; i < 400; i++) {
  const t = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)
  const js = (new Date(t + 'T00:00:00Z').getUTCDay() + 6) % 7
  if (J.idxHariEms(t) !== js) mulaiSemuaSenin = false
}
cek('idxHariEms cocok dengan Date untuk 400 hari berturut-turut', mulaiSemuaSenin)

// ---------------------------------------------------------------- hours
console.log('Jam: selesai maks 23:59, mulai < selesai')
cek('19:45–22:30 sah', J.pesanJam('19:45', '22:30') === '')
cek('22:30–23:59 sah', J.pesanJam('22:30', '23:59') === '')
cek('kosong ditolak', J.pesanJam('', '22:00') !== '' && J.pesanJam('20:00', '') !== '')
cek('mulai = selesai ditolak', J.pesanJam('20:00', '20:00') !== '')
cek('mulai > selesai ditolak (tidak lewat tengah malam)', J.pesanJam('22:30', '01:30') !== '')
cek('24:00 ditolak', J.pesanJam('22:00', '24:00') !== '')
cek('pesan berbahasa Indonesia', /jam selesai/i.test(J.pesanJam('22:30', '22:30')))
cek('jam5 memotong HH:MM:SS', J.jam5('19:45:00') === '19:45')

// ---------------------------------------------------------------- default hours
console.log('Jam bawaan: talent > hari > semua hari > kosong')
const doc = J.rapikanDokumen({
  kategori: {
    Band: [
      { id: 'b1', nama: 'Utama', mulai: '19:45', selesai: '22:30', hari: [], bawaan: true },
      { id: 'b2', nama: 'Akhir pekan', mulai: '20:30', selesai: '23:30', hari: [4, 5], bawaan: false },
    ],
    DJ: [
      { id: 'd1', nama: 'A', mulai: '22:30', selesai: '23:59', hari: [], bawaan: false },
      { id: 'd2', nama: 'B', mulai: '23:00', selesai: '23:59', hari: [], bawaan: true },
    ],
  },
  talent: { t9: { mulai: '20:00', selesai: '22:00' } },
})
const FRI = '2026-11-27'
const TUE = '2026-11-24'
cek('override talent menang atas slot kategori', J.jamBawaan(doc, 't9', 'Band', FRI)?.asal === 'talent' && J.jamBawaan(doc, 't9', 'Band', FRI)?.mulai === '20:00')
cek('slot hari itu menang atas slot semua hari (Jumat)', J.jamBawaan(doc, 't1', 'Band', FRI)?.slotId === 'b2')
cek('Selasa jatuh ke slot semua hari', J.jamBawaan(doc, 't1', 'Band', TUE)?.slotId === 'b1')
cek('beberapa slot: yang bawaan menang', J.jamBawaan(doc, 't2', 'DJ', TUE)?.slotId === 'd2')
cek('kategori tanpa slot = null', J.jamBawaan(doc, 't3', 'Guest Artist', TUE) === null)
cek('slot rusak dilewati', J.jamBawaan(J.rapikanDokumen({ kategori: { X: [{ id: 'x', nama: '', mulai: '23:00', selesai: '22:00', hari: [], bawaan: true }] }, talent: {} }), 't', 'X', TUE) === null)
cek('slot khusus hari tanpa slot semua hari: hari lain null', J.jamBawaan(J.rapikanDokumen({ kategori: { Y: [{ id: 'y', nama: 'Jumat', mulai: '20:00', selesai: '22:00', hari: [4], bawaan: true }] }, talent: {} }), 't', 'Y', TUE) === null)
cek('titik beda: sama dengan bawaan = tidak beda', J.bedaDariBawaan(doc, 't1', 'Band', TUE, '19:45', '22:30') === false)
cek('titik beda: jam lain = beda', J.bedaDariBawaan(doc, 't1', 'Band', TUE, '20:00', '22:30') === true)
cek('titik beda: tanpa bawaan = tidak ada titik', J.bedaDariBawaan(doc, 't3', 'Guest Artist', TUE, '20:00', '22:30') === false)
cek('rapikanDokumen: [] kosong dari PHP', sama(J.rapikanDokumen([]), { kategori: {}, talent: {} }))
cek('rapikanDokumen: hari diurut & dibersihkan', sama(J.rapikanDokumen({ kategori: { A: [{ id: 'a', nama: 'x', mulai: '19:00:00', selesai: '20:00', hari: [5, 1, 5, 9, 'x'], bawaan: 1 }] } }).kategori.A[0].hari, [1, 5]))
cek('dokumenAdaIsi: kosong vs terisi', !J.dokumenAdaIsi(J.dokumenKosong()) && J.dokumenAdaIsi(doc))
cek('usulan: Band 19:45–22:30, DJ & MC DJ 22:30–23:59', J.jamBawaan(J.JAM_USULAN, 'x', 'Band', TUE)?.selesai === '22:30' && J.jamBawaan(J.JAM_USULAN, 'x', 'DJ', TUE)?.mulai === '22:30' && J.jamBawaan(J.JAM_USULAN, 'x', 'MC DJ', TUE)?.selesai === '23:59')
cek('usulan sah menurut galatDokumen', J.galatDokumen(J.JAM_USULAN).length === 0)
cek('galatDokumen menangkap jam salah dan id kembar', J.galatDokumen({ kategori: { A: [{ id: 'a', nama: 'x', mulai: '22:00', selesai: '21:00', hari: [], bawaan: false }, { id: 'a', nama: 'y', mulai: '19:00', selesai: '20:00', hari: [], bawaan: false }] }, talent: {} }).length === 2)
cek('daftarKategori: tetap + kategori baru dari talent', sama(J.daftarKategori(['Band', 'DJ'], [{ category: 'DJ' }, { category: 'Magician' }, { category: '' }]), ['Band', 'DJ', 'Magician']))

// ---------------------------------------------------------------- fixtures
const talents = [
  { id: 'tA', name: 'Arkatama', category: 'Band', default_fee: '1.500.000', status: 'Active' },
  { id: 'tB', name: 'Bima', category: 'DJ', default_fee: 800000, status: 'Active' },
  { id: 'tC', name: 'Citra', category: 'Band', default_fee: 0, status: 'Inactive' },
]
const simpan = (id, talent, date, st, et, extra = {}) => ({
  id, talent_id: talent, date, start_time: st, end_time: et, performance_type: 'Band', fee: 1000000, status: 'Scheduled', source: 'mingguan', createdAt: 1, updatedAt: 1, ...extra,
})
const efDari = (rows, draf = []) => J.barisEfektif(rows, draf)

// ---------------------------------------------------------------- clashes
console.log('Bentrok: talent + tanggal + jam bertumpuk, Cancelled diabaikan')
{
  const rows = [simpan('s1', 'tA', '2026-11-24', '19:45', '22:30')]
  const bar = (d, k) => J.bentrokEf(efDari(rows, d), d).has(k)
  let d = J.tambahBaru([], J.nilaiBaru(talents[0], '2026-11-24', '20:00', '21:00'), 'n1')
  cek('draf tumpang tindih dengan baris tersimpan = bentrok (kedua sel)', bar(d, 'n1') && bar(d, 's1'))
  d = J.tambahBaru([], J.nilaiBaru(talents[0], '2026-11-24', '22:30', '23:30'), 'n1')
  cek('berurutan 22:30 setelah 22:30 = tidak bentrok', !bar(d, 'n1'))
  d = J.tambahBaru([], J.nilaiBaru(talents[1], '2026-11-24', '20:00', '21:00'), 'n1')
  cek('talent lain di jam sama = tidak bentrok', !bar(d, 'n1'))
  d = J.tambahBaru([], J.nilaiBaru(talents[0], '2026-11-25', '20:00', '21:00'), 'n1')
  cek('tanggal lain = tidak bentrok', !bar(d, 'n1'))
  d = J.tambahBaru([], { ...J.nilaiBaru(talents[0], '2026-11-24', '20:00', '21:00'), status: 'Cancelled' }, 'n1')
  cek('draf Cancelled diabaikan', !bar(d, 'n1'))
  const rows2 = [simpan('s1', 'tA', '2026-11-24', '19:45', '22:30', { status: 'Cancelled' })]
  d = J.tambahBaru([], J.nilaiBaru(talents[0], '2026-11-24', '20:00', '21:00'), 'n1')
  cek('baris tersimpan Cancelled tidak menghalangi', !J.bentrokEf(efDari(rows2, d), d).has('n1'))
  d = J.hapusBaris([], 's1', { baris: rows[0], versi: 5 })
  d = J.tambahBaru(d, J.nilaiBaru(talents[0], '2026-11-24', '20:00', '21:00'), 'n1')
  cek('baris yang didraf dihapus tidak menghalangi', !J.bentrokEf(efDari(rows, d), d).has('n1'))
  const dua = [simpan('s1', 'tA', '2026-11-24', '19:45', '22:30'), simpan('s2', 'tA', '2026-11-24', '20:00', '21:00')]
  cek('dua baris tersimpan yang sudah lama bentrok tidak menahan simpan', J.bentrokEf(efDari(dua, []), []).size === 0)
  d = J.setNilai([], 's2', { ...J.nilaiDariBaris(dua[1]), notes: 'cek suara' }, { baris: dua[1], versi: 2 })
  cek('mengubah catatan baris yang sudah lama bentrok tidak menahan simpan', J.bentrokEf(efDari(dua, d), d).size === 0)
  d = J.setNilai([], 's2', { ...J.nilaiDariBaris(dua[1]), end_time: '22:00' }, { baris: dua[1], versi: 2 })
  cek('mengubah jam baris yang bentrok = ditandai', J.bentrokEf(efDari(dua, d), d).has('s2'))
  const sama2 = J.tambahBaru(J.tambahBaru([], J.nilaiBaru(talents[0], '2026-12-01', '19:00', '20:00'), 'n1'), J.nilaiBaru(talents[0], '2026-12-01', '19:30', '20:30'), 'n2')
  cek('dua draf saling bentrok (antarbaris kiriman)', J.bentrokEf(efDari([], sama2), sama2).has('n1') && J.bentrokEf(efDari([], sama2), sama2).has('n2'))
  cek('bentrokDengan: menemukan lawannya, mengabaikan dirinya', J.bentrokDengan(efDari(rows, []), 'tA', '2026-11-24', '21:00', '22:00')?.kunci === 's1' && J.bentrokDengan(efDari(rows, []), 'tA', '2026-11-24', '21:00', '22:00', 's1') === null)
}

console.log('Dua show di hari sama: boleh bila tidak tumpang tindih')
{
  const rows = [simpan('s1', 'tA', '2026-11-24', '19:45', '22:30')]
  const dua = J.rapikanDokumen({ kategori: { Band: [
    { id: 'p', nama: 'Pertama', mulai: '19:45', selesai: '22:30', hari: [], bawaan: true },
    { id: 'q', nama: 'Kedua', mulai: '22:30', selesai: '23:59', hari: [], bawaan: false },
  ] }, talent: {} })
  const kedua = J.jamSlotKedua(dua, 'tA', 'Band', '2026-11-24', efDari(rows, []))
  cek('slot kedua = slot yang tidak bertumpuk', kedua?.mulai === '22:30' && kedua?.selesai === '23:59')
  cek('tidak ada slot muat = null', J.jamSlotKedua(doc, 'tA', 'Band', '2026-11-24', efDari([simpan('x', 'tA', '2026-11-24', '19:00', '23:59')], [])) === null)
  const d = J.tambahBaru([], J.nilaiBaru(talents[0], '2026-11-24', kedua.mulai, kedua.selesai), 'n1')
  cek('show kedua tidak bentrok', J.bentrokEf(efDari(rows, d), d).size === 0)
}

console.log('Minggu lintas bulan: semua tujuh hari dilihat')
{
  const senin = '2026-11-30'
  const hari = J.tujuhHariEms(senin)
  const rows = [simpan('s1', 'tA', '2026-12-02', '19:45', '22:30'), simpan('s2', 'tA', '2026-11-30', '19:45', '22:30')]
  const d = [
    ...J.tambahBaru([], J.nilaiBaru(talents[0], '2026-12-02', '20:00', '21:00'), 'n1'),
    ...J.tambahBaru([], J.nilaiBaru(talents[0], '2026-11-30', '20:00', '21:00'), 'n2'),
  ]
  const tanda = J.bentrokEf(efDari(rows, d), d)
  cek('bentrok di bagian Desember dan di bagian November sama-sama ketemu', tanda.has('n1') && tanda.has('n2') && hari.includes('2026-12-02'))
  const grup = J.susunGrup(talents, efDari(rows, d), hari, ['Band', 'DJ'])
  cek('lembar: kategori terurut, talent aktif, nonaktif tanpa jadwal tidak tampil', sama(grup.map(g => g.kategori), ['Band', 'DJ']) && sama(grup[0].talents.map(t => t.id), ['tA']))
  const grup2 = J.susunGrup(talents, efDari([simpan('s9', 'tC', '2026-12-04', '20:00', '21:00')], []), hari, ['Band', 'DJ'])
  cek('lembar: talent nonaktif dengan jadwal minggu itu ikut tampil (bertanda)', grup2[0].talents.find(t => t.id === 'tC')?.nonaktif === true)
  const grup3 = J.susunGrup(talents, efDari([simpan('s9', 'gone', '2026-12-04', '20:00', '21:00', { performance_type: 'DJ' })], []), hari, ['Band', 'DJ'])
  cek('lembar: talent terhapus ikut tampil', grup3.find(g => g.kategori === 'DJ').talents.some(t => t.hilang))
}

// ---------------------------------------------------------------- drafts
console.log('Draf: baru / ubah / hapus')
{
  const rows = [simpan('s1', 'tA', '2026-11-24', '19:45', '22:30')]
  const asli = J.nilaiDariBaris(rows[0])
  let d = J.setNilai([], 's1', { ...asli, end_time: '23:00' }, { baris: rows[0], versi: 11 })
  cek('ubah baris tersimpan = satu draf ubah dengan versi', d.length === 1 && J.jenisDraf(d[0]) === 'ubah' && d[0].versi === 11)
  cek('baris tampil dengan nilai draf', efDari(rows, d).find(r => r.kunci === 's1').end_time === '23:00' && efDari(rows, d).find(r => r.kunci === 's1').draf === 'ubah')
  d = J.setNilai(d, 's1', asli, { baris: rows[0], versi: 11 })
  cek('dikembalikan ke nilai asli = draf hilang', d.length === 0)
  d = J.hapusBaris([], 's1', { baris: rows[0], versi: 11 })
  cek('hapus baris tersimpan = draf hapus', J.jenisDraf(d[0]) === 'hapus' && efDari(rows, d).length === 1 && efDari(rows, d)[0].draf === 'hapus')
  cek('barisHidup membuang yang didraf hapus', J.barisHidup(efDari(rows, d)).length === 0)
  d = J.buangSatu(d, 's1')
  cek('batalkan hapus', d.length === 0)
  d = J.tambahBaru([], J.nilaiBaru(talents[0], '2026-11-25', '19:45', '22:30'), 'n1')
  d = J.hapusBaris(d, 'n1')
  cek('hapus draf baru = hilang begitu saja', d.length === 0)
  d = J.tambahBaru([], J.nilaiBaru(talents[0], '2026-11-25', '19:45', '22:30'), 'n1')
  d = J.tambahBaru(d, J.nilaiBaru(talents[1], '2026-11-25', '22:30', '23:59'), 'n2')
  d = J.setNilai(d, 's1', { ...asli, start_time: '20:00' }, { baris: rows[0], versi: 11 })
  d = J.hapusBaris(d, 's1', { baris: rows[0], versi: 11 })
  cek('ubah lalu hapus baris yang sama = satu draf hapus', d.filter(x => x.kunci === 's1').length === 1 && J.jenisDraf(d.find(x => x.kunci === 's1')) === 'hapus')
  cek('hitungDraf', sama(J.hitungDraf(d), { baru: 2, ubah: 0, hapus: 1 }) && J.ringkasDraf(d) === '2 baru · 0 diubah · 1 dihapus')
  const baru = J.nilaiBaru(talents[0], '2026-11-25', '19:45', '22:30')
  cek('rekaman baru: tipe = kategori talent, fee = fee bawaan (teks ribuan terbaca), Scheduled', baru.performance_type === 'Band' && baru.fee === 1500000 && baru.status === 'Scheduled' && baru.event_id === null)
  cek('talent tanpa fee bawaan = 0', J.nilaiBaru(talents[2], '2026-11-25', '19:45', '22:30').fee === 0)
  const basi = J.tandaiBasi(J.setNilai([], 's1', { ...asli, start_time: '20:00' }, { baris: rows[0], versi: 11 }), 's1', { baris: { ...rows[0], start_time: '19:00', end_time: '22:00' }, versi: 12 })
  cek('409: draf tetap, ditandai basi, versi & asli diperbarui', basi.length === 1 && basi[0].basi === true && basi[0].versi === 12 && basi[0].asli.start_time === '19:00' && basi[0].nilai.start_time === '20:00')
  cek('409: baris yang hilang di server = draf dibuang', J.tandaiBasi([{ kunci: 's1', asli, versi: 1, nilai: asli, hapus: true }], 's1', null).length === 0)
  cek('terapkan ulang menghapus tanda basi', J.setNilai(basi, 's1', { ...asli, start_time: '20:30' }, { baris: rows[0], versi: 12 })[0].basi === false)
  const dua = J.draftBerjam(efDari([], J.tambahBaru([], J.nilaiBaru(talents[0], '2026-11-25', '', ''), 'n1')))
  cek('draf tanpa jam ditahan sebelum simpan', dua.length === 1 && dua[0].kunci === 'n1')
}

// ---------------------------------------------------------------- batch
console.log('Susunan kiriman batch')
{
  const rows = [simpan('s1', 'tA', '2026-11-24', '19:45', '22:30'), simpan('s2', 'tB', '2026-11-24', '22:30', '23:59'), simpan('s3', 'tB', '2026-11-25', '22:30', '23:59', { source: 'manual' })]
  let d = J.tambahBaru([], { ...J.nilaiBaru(talents[0], '2026-11-26', '19:45', '22:30'), notes: 'soundcheck 18:00', event_id: 'e7' }, 'n1')
  d = J.tambahBaru(d, J.nilaiBaru(talents[1], '2026-11-26', '22:30', '23:59'), 'n2')
  d = J.setNilai(d, 's1', { ...J.nilaiDariBaris(rows[0]), end_time: '23:00', status: 'Confirmed' }, { baris: rows[0], versi: 101 })
  d = J.hapusBaris(d, 's2', { baris: rows[1], versi: 102 })
  const s = J.susunBatch(d, 1760000000000)
  cek('hitungan create/update/delete', s.create.length === 2 && s.update.length === 1 && s.delete.length === 1 && s.total === 4)
  const c = s.create[0]
  cek('create: bentuk record lama + source roster + id', c.id === 'n1' && c.talent_id === 'tA' && c.event_id === 'e7' && c.date === '2026-11-26' && c.performance_type === 'Band' && c.start_time === '19:45' && c.end_time === '22:30' && c.fee === 1500000 && c.status === 'Scheduled' && c.recurring_rule_id === null && c.source === 'roster' && c.createdAt === 1760000000000 && c.updatedAt === 1760000000000)
  cek('create: catatan hanya bila diisi', c.notes === 'soundcheck 18:00' && !('notes' in s.create[1]))
  cek('update: hanya kunci yang berubah, dengan versi, tanpa updatedAt', s.update[0].id === 's1' && s.update[0].version === 101 && sama(s.update[0].fields, { end_time: '23:00', status: 'Confirmed' }))
  cek('delete: id + versi', sama(s.delete[0], { id: 's2', version: 102 }))
  cek('kunci per operasi untuk memetakan jawaban server', sama(s.kunci, { create: ['n1', 'n2'], update: ['s1'], delete: ['s2'] }))
  cek('batch lengkap tidak ada pesan', J.pesanBatch(s) === '')
  const kosong = J.susunBatch([], 1)
  cek('tanpa draf = pesan', J.pesanBatch(kosong) !== '')
  const banyak = J.susunBatch(Array.from({ length: 301 }, (_, i) => ({ kunci: 'n' + i, nilai: J.nilaiBaru(talents[0], '2026-11-26', '19:45', '22:30') })), 1)
  cek('301 perubahan ditolak dengan pesan, tidak dipecah', J.pesanBatch(banyak).includes('300') && banyak.total === 301)
  const tepat = J.susunBatch(Array.from({ length: 300 }, (_, i) => ({ kunci: 'n' + i, nilai: J.nilaiBaru(talents[0], '2026-11-26', '19:45', '22:30') })), 1)
  cek('300 perubahan boleh', J.pesanBatch(tepat) === '')
  const tanpaVersi = J.susunBatch([{ kunci: 's1', asli: J.nilaiDariBaris(rows[0]), nilai: J.nilaiDariBaris(rows[0]), hapus: true }], 1)
  cek('hapus tanpa versi ditolak', J.pesanBatch(tanpaVersi) !== '')
  cek('baris tersimpan menjaga source-nya (tidak dikirim saat ubah)', !('source' in s.update[0].fields) && d.find(x => x.kunci === 's1').sumber === 'mingguan')
  cek('batas = 300', J.BATAS_BATCH === 300)
  const e409 = { data: { error: { code: 'version_conflict', details: { id: 's1', current: {} } } } }
  cek('409 version_conflict: id baris', J.bacaGalatBatch(e409, s).kode === 'version_conflict' && J.bacaGalatBatch(e409, s).id === 's1')
  const eB = { data: { error: { code: 'jadwal_bentrok', details: { bentrok: [{ id: 'n1', talent_id: 'tA', dengan: { id: 's9' } }] } } } }
  cek('409 jadwal_bentrok: kedua sel ditandai', sama(J.bacaGalatBatch(eB, s).tanda, ['n1', 's9']))
  const e422 = { data: { error: { code: 'validation_failed', details: { baris: [{ index: 1, operation: 'create', reason: 'bad time' }, { index: 0, operation: 'update', reason: 'x' }] } } } }
  const g = J.bacaGalatBatch(e422, s)
  cek('422: baris dipetakan ke draf lewat indeks per daftar', g.baris[0].kunci === 'n2' && g.baris[1].kunci === 's1' && g.tanda.includes('n2'))
  cek('galat tak dikenal tidak membuat apa-apa', J.bacaGalatBatch(new Error('x')).tanda.length === 0)
}

// ---------------------------------------------------------------- copy last week
console.log('Salin minggu lalu')
{
  const senin = '2026-11-30'
  const rows = [
    simpan('a', 'tA', '2026-11-23', '19:45', '22:30'),
    simpan('b', 'tA', '2026-11-27', '19:45', '22:30'),
    simpan('b2', 'tA', '2026-11-27', '22:30', '23:30'),
    simpan('c', 'tB', '2026-11-28', '22:30', '23:59', { status: 'Cancelled' }),
    simpan('d', 'tB', '2026-11-29', '22:30', '23:59', { status: 'Done' }),
    simpan('e', 'tC', '2026-11-24', '19:45', '22:30'),
    simpan('f', 'tB', '2026-11-27', '22:30', '23:59'),
    simpan('x', 'tB', '2026-12-04', '22:30', '23:59'),
  ]
  const h = J.salinMingguLalu(efDari(rows, []), talents, senin)
  cek('Cancelled tidak disalin; Done disalin sebagai Scheduled; nonaktif dilewati', h.baru.length === 4 && h.nonaktif === 1 && h.baru.every(n => n.status === 'Scheduled'))
  cek('tanggal +7 hari lintas bulan', sama(h.baru.map(n => n.date).sort(), ['2026-11-30', '2026-12-04', '2026-12-04', '2026-12-06']))
  cek('sel yang sudah terisi dilewati dan dihitung', h.dilewati === 1 && !h.baru.some(n => n.talent_id === 'tB' && n.date === '2026-12-04'))
  cek('dua show dari satu sel sama-sama disalin', h.baru.filter(n => n.talent_id === 'tA' && n.date === '2026-12-04').length === 2)
  cek('jam disalin, tipe = kategori talent, fee = fee bawaan', h.baru.find(n => n.talent_id === 'tA' && n.date === '2026-11-30').start_time === '19:45' && h.baru.find(n => n.talent_id === 'tB').performance_type === 'DJ' && h.baru.find(n => n.talent_id === 'tB').fee === 800000)
  const hKat = J.salinMingguLalu(efDari(rows, []), talents, senin, 'DJ')
  cek('dengan saringan kategori hanya kategori itu', hKat.baru.every(n => n.talent_id === 'tB'))
  const dr = h.baru.map((nilai, i) => ({ kunci: 'z' + i, nilai }))
  cek('menjalankan dua kali tidak menggandakan (draf ikut dihitung sebagai sel terisi)', J.salinMingguLalu(efDari(rows, dr), talents, senin).baru.length === 0)
  const kosong = J.salinMingguLalu(efDari([], []), talents, senin)
  cek('minggu lalu kosong = tidak ada draf', kosong.baru.length === 0)
}

// ---------------------------------------------------------------- auto-fill
console.log('Isi otomatis')
{
  const rows = [simpan('s1', 'tA', '2026-12-04', '19:45', '22:30')]
  const h = J.isiOtomatis({ talents: [talents[0], talents[1]], hari: [4, 5], dari: '2026-11-27', sampai: '2026-12-06', rows: efDari(rows, []), doc })
  // Fri 27, Sat 28, Fri 4 Dec, Sat 5 Dec  × 2 talents = 8 cells; tA Dec 4 is taken; tB (DJ) has a slot
  cek('hari yang dipilih saja (Jum, Sab), lintas bulan', h.baru.every(n => ['2026-11-27', '2026-11-28', '2026-12-04', '2026-12-05'].includes(n.date)))
  cek('sel terisi dilewati dan dihitung', h.dilewati === 1 && h.baru.length === 7)
  cek('Jumat memakai slot Jumat (20:30), Sabtu juga, untuk Band', h.baru.find(n => n.talent_id === 'tA' && n.date === '2026-11-27').start_time === '20:30')
  cek('DJ memakai slot bawaan', h.baru.find(n => n.talent_id === 'tB').start_time === '23:00')
  const tanpa = J.isiOtomatis({ talents: [{ id: 'g', name: 'Guest', category: 'Guest Artist', status: 'Active' }], hari: [0, 1, 2, 3, 4, 5, 6], dari: '2026-11-23', sampai: '2026-11-29', rows: [], doc })
  cek('talent tanpa jam bawaan dilewati dan dihitung, tidak ditebak', tanpa.baru.length === 0 && tanpa.tanpaJam === 7)
  cek('rentang terbalik = kosong', J.isiOtomatis({ talents, hari: [0], dari: '2026-12-06', sampai: '2026-12-01', rows: [], doc }).baru.length === 0)
  cek('rentang dibatasi', J.isiOtomatis({ talents: [talents[1]], hari: [0, 1, 2, 3, 4, 5, 6], dari: '2026-01-01', sampai: '2026-12-31', rows: [], doc }).baru.length === J.MAKS_HARI_ISI)
  const drafHasil = h.baru.map((nilai, i) => ({ kunci: 'y' + i, nilai }))
  const ulang = J.isiOtomatis({ talents: [talents[0], talents[1]], hari: [4, 5], dari: '2026-11-27', sampai: '2026-12-06', rows: efDari(rows, drafHasil), doc })
  cek('diulang tidak menggandakan', ulang.baru.length === 0)
  const tanpaBatal = J.isiOtomatis({ talents: [talents[0]], hari: [4], dari: '2026-12-04', sampai: '2026-12-04', rows: efDari([simpan('k', 'tA', '2026-12-04', '19:45', '22:30', { status: 'Cancelled' })], []), doc })
  cek('sel yang hanya berisi Cancelled dianggap kosong', tanpaBatal.baru.length === 1 && tanpaBatal.dilewati === 0)
}

// ---------------------------------------------------------------- ranges
console.log('Rentang yang sudah dimuat')
{
  let r = J.gabungRentang([], '2026-11-01', '2026-11-30')
  r = J.gabungRentang(r, '2026-12-01', '2026-12-31')
  cek('bulan yang bersambung digabung', sama(r, [{ a: '2026-11-01', b: '2026-12-31' }]))
  r = J.gabungRentang(r, '2027-02-01', '2027-02-28')
  cek('rentang terpisah tetap terpisah', r.length === 2)
  r = J.gabungRentang(r, '2026-12-15', '2027-01-20')
  cek('rentang tumpang tindih digabung', r.length === 2 && r[0].b === '2027-01-20')
  cek('tercakup / tidak', J.rentangTercakup(r, '2026-11-30', '2026-12-06') && !J.rentangTercakup(r, '2027-01-18', '2027-01-26'))
  cek('minggu lintas bulan butuh kedua bulan', !J.rentangTercakup(J.gabungRentang([], '2026-11-01', '2026-11-30'), '2026-11-30', '2026-12-06'))
}

console.log(`\n${ok} lolos, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
