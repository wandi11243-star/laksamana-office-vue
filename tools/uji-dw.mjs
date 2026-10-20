/*
 * tools/uji-dw.mjs — guard for app/utils/dw.ts.
 *
 *   TZ=Asia/Jakarta node tools/uji-dw.mjs   (Node 24: imports the .ts directly)
 *
 * What is guarded here is the setting blob's VERSION handshake (#303): the
 * blob is one row everybody writes whole, so `PUT /dw/settings` must carry the
 * version it was read at. The rules that keep a colleague's save from being
 * overwritten without a word:
 *   - the version the last answer handed back wins over the version the read
 *     produced (it is the version OUR save created);
 *   - no version at all means no save — the server answers 428;
 *   - a version must be a plain number (the blob's updated_at in ms), and 0
 *     is a legal one: the blob was never saved before.
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

const D = await import('../app/utils/dw.ts')

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

console.log('\ndw: versi setting (#303)')
cek('jawaban menang atas baca', D.versiSettingDw(2, 1) === 2)
cek('tanpa jawaban dipakai versi baca', D.versiSettingDw(undefined, 7) === 7)
cek('tanpa keduanya tidak ada versi', D.versiSettingDw(undefined, undefined) === undefined)
cek('versi 0 sah (blob belum pernah disimpan)', D.bolehSimpanSettingDw(0) === true)
cek('tanpa versi tidak boleh menyimpan', D.bolehSimpanSettingDw(undefined) === false)
cek('versi bukan angka tidak boleh menyimpan', D.bolehSimpanSettingDw('') === false || D.bolehSimpanSettingDw('abc') === false)
cek('versi angka bergotong_ok', D.bolehSimpanSettingDw(1750000000000) === true)

console.log(`\n${ok} OK, ${gagal} GAGAL`)
if (gagal) process.exit(1)
