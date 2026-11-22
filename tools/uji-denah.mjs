/* Guard for the table-plan rules brought in line with the old Reservasi app:
 * weekend days from Master Data (old 21 Oct 2026) and the nearest booking on a
 * table (old bookingBerikut, 26 Sep 2026).
 * node tools/uji-denah.mjs (Node 24: imports .ts directly)
 * resolve hook: ~/x -> app/x.ts and extensionless relative imports -> .ts, files tested as they are.
 */
import { register } from 'node:module'

register('data:text/javascript,' + encodeURIComponent(`
  import { pathToFileURL } from 'node:url'
  import path from 'node:path'
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('~/')) return next(pathToFileURL(path.resolve('app', spec.slice(2) + '.ts')).href, ctx)
    // venue-layouts imports ./format without an extension, as Nuxt allows
    if ((spec.startsWith('./') || spec.startsWith('../')) && !path.extname(spec) && ctx.parentURL?.endsWith('.ts')) return next(spec + '.ts', ctx)
    return next(spec, ctx)
  }
`))

const V = await import('../app/utils/venue-layouts.ts')
const K = await import('../app/utils/kunci-meja.ts')

let ok = 0
let gagal = 0
const cek = (nama, dapat, harap) => {
  const a = JSON.stringify(dapat)
  const b = JSON.stringify(harap)
  if (a === b) ok++
  else {
    gagal++
    console.error(`GAGAL ${nama}\n  dapat: ${a}\n  harap: ${b}`)
  }
}

// --- weekend days ---------------------------------------------------------------
// 2026-11-20 Friday, 2026-11-21 Saturday, 2026-11-22 Sunday, 2026-11-23 Monday.

cek('bawaan Jum/Sab/Min', V.hariWeekend(undefined), [0, 5, 6])
cek('bawaan: Jumat weekend', V.hariAkhirPekan('2026-11-20'), true)
cek('bawaan: Senin weekday', V.hariAkhirPekan('2026-11-23'), false)
cek('daftar kosong sah, tidak jatuh ke bawaan', V.hariWeekend({ hariWeekend: [] }), [])
cek('daftar kosong: Sabtu jadi weekday', V.hariAkhirPekan('2026-11-21', { hariWeekend: [] }), false)
cek('hanya Sab/Min: Jumat weekday', V.defaultDayTypeLt('2026-11-20', 1, { hariWeekend: [6, 0] }), 'weekday')
cek('hanya Sab/Min: Sabtu weekend Lt.2', V.defaultDayTypeLt('2026-11-21', 2, { hariWeekend: [6, 0] }), 'lantai2_weekend')
cek('nilai sampah dibuang', V.hariWeekend({ hariWeekend: [1, 9, -1, 2.5, '3'] }), [1, 3])
cek('jadwal tanggal tetap menang', V.dayTypeLayoutLt({ hariWeekend: [], layoutOverrides: { '2026-11-23': 'weekend' } }, '2026-11-23', 1), 'weekend')
cek('tanpa jadwal ikut setelan', V.dayTypeLayoutLt({ hariWeekend: [1] }, '2026-11-23', 1), 'weekend')

// --- nearest booking on a table ---------------------------------------------------

const now = new Date('2026-11-22T18:00:00').getTime()
const r = (id, date, time, extra = {}) => ({ id, name: id, date, time, pax: 4, table: '12', status: 'Confirmed', leftAt: 0, ...extra })
const list = [
  r('besok', '2026-11-23', '02:10'),
  r('nanti', '2026-11-22', '20:00'),
  r('lebih', '2026-11-22', '21:30'),
  r('telat', '2026-11-22', '17:30'),
  r('kemarin', '2026-11-21', '19:00'),
  r('batal', '2026-11-22', '18:30', { status: 'Cancelled' }),
  r('duduk', '2026-11-22', '16:00', { status: 'Datang', checkinAt: now - 3600000 }),
  r('lain', '2026-11-22', '18:10', { table: '13' }),
]

const hariIni = K.bookingBerikut(list, '12', { date: '2026-11-22', hariIni: true, now })
cek('hari ini: yang telat tetap disebut lebih dulu', hariIni?.res.id, 'telat')
cek('hari ini: menitnya negatif', hariIni?.menit, -30)
cek('hari ini: sisanya dihitung, besok tidak', hariIni?.lain, 2)

const tanpaTelat = K.bookingBerikut(list.filter(x => x.id !== 'telat'), '12', { date: '2026-11-22', hariIni: true, now })
cek('hari ini: berikutnya jam 20:00', tanpaTelat?.res.id, 'nanti')
cek('hari ini: 2 jam lagi', tanpaTelat?.menit, 120)

const besok = K.bookingBerikut(list, '12', { date: '2026-11-23', hariIni: false, now })
// From the start of the 23rd: 20:00 on the 22nd has released the table (lock
// ends 23:00), 21:30 still holds it until 00:30, so that one is named first.
cek('denah besok: booking kemarin malam yang masih memegang meja', besok?.res.id, 'lebih')
cek('denah besok: lalu booking dini hari', besok?.lain, 1)

const kosong = K.bookingBerikut(list, '99', { date: '2026-11-22', hariIni: true, now })
cek('meja tanpa booking', kosong, null)

const gabung = K.bookingBerikut(list, '13, 14', { date: '2026-11-22', hariIni: true, now })
cek('beberapa meja sekaligus', gabung?.res.id, 'lain')

cek('mepet: 10 menit terkunci', K.mepetKah(10), true)
cek('mepet: 2 jam tidak', K.mepetKah(120), false)

console.log(`${ok} lulus, ${gagal} gagal`)
if (gagal) process.exit(1)
