/*
 * tools/uji-paralel.mjs — guard for app/utils/paralel.ts.
 *
 *   TZ=Asia/Jakarta node tools/uji-paralel.mjs   (Node 24: imports the .ts directly)
 *
 * What is guarded here is the bounded parallel map for independent writes:
 *   - results follow the input order, one slot per item;
 *   - at most `batas` jobs run at once;
 *   - one rejection never hides the rest (allSettled per batch).
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

const P = await import('../app/utils/paralel.ts')

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
const tunda = ms => new Promise(r => setTimeout(r, ms))

console.log('\nparalel: petaParalel')
const masuk = [1, 2, 3, 4, 5]
const hasil = await P.petaParalel(masuk, 2, async x => x * 10)
cek('hasil mengikuti urutan masuk', hasil.every((h, i) => h.status === 'fulfilled' && h.value === masuk[i] * 10))

let jalan = 0
let puncak = 0
await P.petaParalel([1, 2, 3, 4, 5, 6], 4, async () => {
  jalan++
  puncak = Math.max(puncak, jalan)
  await tunda(20)
  jalan--
})
cek('paling banyak 4 jalan bersamaan', puncak <= 4 && puncak > 1, `puncak=${puncak}`)

const campur = await P.petaParalel([1, 2, 3], 4, async (x) => {
  if (x === 2) throw new Error('gagal-2')
  return x
})
cek('satu gagal tidak menyembunyikan yang lain', campur[0].status === 'fulfilled' && campur[1].status === 'rejected' && campur[2].status === 'fulfilled')
cek('hitungBerhasilParalel menghitung yang terpenuhi', P.hitungBerhasilParalel(campur) === 2)
cek('daftar kosong tidak jalan', (await P.petaParalel([], 4, async () => 1)).length === 0)
cek('batas di bawah 1 dianggap 1', (await P.petaParalel([7], 0, async x => x)).length === 1)

console.log(`\n${ok} OK, ${gagal} GAGAL`)
if (gagal) process.exit(1)
