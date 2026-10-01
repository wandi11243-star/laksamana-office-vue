/*
 * tools/uji-help.mjs — the Help Center guard (the Vue successor of the old
 * node tools/uji-help.js).
 *
 *   node tools/uji-help.mjs
 *
 * It needs no dependency and no build: it reads the sources. What it protects,
 * and why each failure is silent without it:
 *
 *   1. REGISTRY vs app/utils/modul.ts. A chapter copies its access key from the
 *      module registry; if a module is added there but not here, its guide just
 *      disappears with no error. `periksaRegistryHelp` in the app repeats this at
 *      runtime; this file repeats it over the source so it runs without Nuxt.
 *
 *   2. CHAPTER FILES. File name must equal the key inside it, every chapter in
 *      the registry must have a file, and no chapter may carry interactive
 *      markup — Help must not become a second app.
 *
 *   3. SCREENSHOTS. An orphan file under public/help/gambar is almost always a
 *      typo (the old usage/catat.png vs usage/pemakaian.png). The size rules are
 *      the ones in the old BACA-DULU.md: PNG, max 1400px wide, under 300 KB.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const P = (...p) => path.join(ROOT, ...p)

let ok = 0
let gagal = 0
const cek = (nama, syarat, ket) => {
  if (syarat) {
    ok++
    console.log('  OK   ' + nama)
  }
  else {
    gagal++
    console.log('  GAGAL ' + nama + (ket ? '  — ' + ket : ''))
  }
}

// ---- minimal source readers (no TS build step) ---------------------------

function potongArray(src, penanda) {
  const i = src.indexOf(penanda)
  if (i < 0) return null
  const j = src.indexOf('\n]', i)
  return src.slice(i + penanda.length, j)
}

function entri(blok) {
  return blok.split(/\n {2}\{/).slice(1)
}

const modulSrc = fs.readFileSync(P('app/utils/modul.ts'), 'utf8')
const MODUL_SRC = potongArray(modulSrc, 'export const MODUL: Modul[] = [')
cek('MODUL terbaca dari app/utils/modul.ts', MODUL_SRC !== null)

const modul = entri(MODUL_SRC ?? '').map((e) => {
  const a = /access:\s*\[([^\]]*)\]/.exec(e)
  const keys = a
    ? a[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean)
    : []
  return { keys, greenfield: /greenfield:\s*true/.test(e) }
})
const kunciModul = [...new Set(modul.flatMap(m => m.keys))]
const kunciGreenfield = new Set(modul.filter(m => m.greenfield).flatMap(m => m.keys))

const regSrc = fs.readFileSync(P('app/utils/help/registry.ts'), 'utf8')
const BAB_SRC = potongArray(regSrc, 'export const HELP_BAB: HelpBab[] = [')
cek('HELP_BAB terbaca dari app/utils/help/registry.ts', BAB_SRC !== null)

const bab = entri(BAB_SRC ?? '').map((e) => {
  const izinNull = /izin:\s*null/.test(e)
  const izin = izinNull ? null : (/izin:\s*'([^']+)'/.exec(e)?.[1] ?? null)
  return {
    izin,
    key: /key:\s*'([^']+)'/.exec(e)?.[1] ?? '',
    menunggu: /menunggu:\s*true/.test(e),
  }
})

// ---- 1. registry vs modul.ts ---------------------------------------------

console.log('\n== Registri Help vs app/utils/modul.ts ==')
cek('registry punya bab', bab.length > 0)

const izinBab = bab.filter(b => b.izin).map(b => b.izin)
const punyaBab = new Set(izinBab)
const kurang = kunciModul.filter(k => k !== 'help' && !kunciGreenfield.has(k) && !punyaBab.has(k))
cek('setiap kunci modul punya babnya di Help', kurang.length === 0,
  'belum ada babnya: ' + kurang.join(', '))

const asing = bab.filter(b => b.izin && !kunciModul.includes(b.izin) && !b.menunggu).map(b => b.izin)
cek('tidak ada bab untuk kunci yang tidak dikenal modul.ts', asing.length === 0,
  'tidak dikenal: ' + asing.join(', '))

const menunggu = bab.filter(b => b.izin && !kunciModul.includes(b.izin) && b.menunggu).map(b => b.izin)
if (menunggu.length) console.log('  ..   bab menunggu modulnya di modul.ts: ' + menunggu.join(', '))

cek('bab pengantar (izin null) hanya satu',
  bab.filter(b => !b.izin).length === 1,
  'bab tanpa izin: ' + bab.filter(b => !b.izin).map(b => b.key).join(', '))

// ---- 2. chapter files -----------------------------------------------------

console.log('\n== Berkas panduan ==')
const DIR = P('app/utils/help/panduan')
const berkas = fs.readdirSync(DIR).filter(f => f.endsWith('.ts')).map(f => f.replace(/\.ts$/, ''))
cek('ada berkas panduan', berkas.length > 0)

const terlarang = ['<script', '<button', '<form', '<input', '<iframe', 'onclick', 'onerror', 'javascript:']
for (const key of berkas) {
  const src = fs.readFileSync(path.join(DIR, key + '.ts'), 'utf8')
  const kunciDalam = /key:\s*'([^']+)'/.exec(src)?.[1]
  cek('panduan ' + key + '.ts kuncinya sama dengan nama berkas', kunciDalam === key, 'dapat ' + kunciDalam)
  cek('panduan ' + key + '.ts memakai tipe Panduan', /satisfies Panduan/.test(src))
  cek('panduan ' + key + '.ts punya ringkas', /ringkas:\s*'/.test(src))
  cek('panduan ' + key + '.ts punya bagian', /bagian:\s*\[/.test(src))
  const kena = terlarang.filter(t => src.toLowerCase().includes(t))
  cek('panduan ' + key + '.ts tidak memuat markup interaktif', kena.length === 0, 'memuat: ' + kena.join(', '))
  const gambar = [...src.matchAll(/berkas:\s*'([^']+)'/g)].map(m => m[1])
  const salah = gambar.filter(g => !/^[a-z0-9_]+\/[^/]+\.(png|jpg|jpeg|webp)$/i.test(g))
  cek('panduan ' + key + '.ts jalur gambarnya <folder>/<berkas>.png', salah.length === 0, 'salah: ' + salah.join(', '))
}

const kunciBerkas = new Set(berkas)
const kunciBab = bab.map(b => b.key)
cek('setiap bab di registry punya berkas panduannya',
  kunciBab.every(k => kunciBerkas.has(k)),
  'belum ada berkasnya: ' + kunciBab.filter(k => !kunciBerkas.has(k)).join(', '))
cek('setiap berkas panduan terdaftar di registry',
  berkas.every(k => kunciBab.includes(k)),
  'tidak terdaftar: ' + berkas.filter(k => !kunciBab.includes(k)).join(', '))

// ---- renderer covers every block type, and never uses v-html -------------

console.log('\n== Renderer ==')
const blokSrc = fs.readFileSync(P('app/components/PanduanBlok.vue'), 'utf8')
for (const t of ['teks', 'langkah', 'daftar', 'tabel', 'catatan', 'tanya', 'gambar']) {
  cek('renderer menggambar blok ' + t, blokSrc.includes(`'${t}'`))
}
cek('renderer menyebut blok yang tidak dikenal', blokSrc.includes('Blok panduan tidak dikenal'))
for (const f of ['app/components/PanduanBlok.vue', 'app/components/PanduanTeks.vue',
  'app/pages/help/index.vue', 'app/pages/help/[kunci].vue']) {
  const src = fs.readFileSync(P(f), 'utf8')
  cek(f + ' tidak memakai v-html', !/(^|\s)v-html\s*=/.test(src))
}

// The two guards for one leak: the loader and the search both walk `babSaya`.
const useHelp = fs.readFileSync(P('app/composables/useHelp.ts'), 'utf8')
cek('pemuat hanya menarik bab yang boleh dibaca', /siapkan[\s\S]*babSaya\.value\.map/.test(useHelp))
cek('penyisir mencari hanya di bab yang boleh dibaca', /cariPanduan\(babSaya\.value/.test(useHelp))

// ---- 3. screenshots -------------------------------------------------------

console.log('\n== Tangkapan layar ==')
const DIR_GAMBAR = P('public/help/gambar')
const dirujuk = new Set()
for (const key of berkas) {
  const src = fs.readFileSync(path.join(DIR, key + '.ts'), 'utf8')
  for (const m of src.matchAll(/berkas:\s*'([^']+)'/g)) dirujuk.add(m[1])
}

const ada = []
;(function sapu(rel) {
  const abs = path.join(DIR_GAMBAR, rel)
  if (!fs.existsSync(abs)) return
  for (const e of fs.readdirSync(abs)) {
    const r = rel ? rel + '/' + e : e
    if (fs.statSync(path.join(DIR_GAMBAR, r)).isDirectory()) sapu(r)
    else if (/\.(png|jpg|jpeg|webp)$/i.test(r)) ada.push(r)
  }
})('')

const yatim = ada.filter(x => !dirujuk.has(x))
cek('tidak ada berkas gambar yang tidak dirujuk panduan', yatim.length === 0,
  'yatim (salah nama?): ' + yatim.join(', '))

for (const rel of ada.filter(x => x.endsWith('.png'))) {
  const b = fs.readFileSync(path.join(DIR_GAMBAR, rel))
  const kb = Math.round(b.length / 1024)
  cek('gambar ' + rel + ' di bawah 300 KB', kb < 300, kb + ' KB')
  const lebar = b.length > 24 ? b.readUInt32BE(16) : 0
  cek('gambar ' + rel + ' lebarnya maksimal 1400px', lebar > 0 && lebar <= 1400, lebar + 'px')
}

const belum = [...dirujuk].filter(x => !ada.includes(x))
console.log('  ..   ' + (dirujuk.size - belum.length) + '/' + dirujuk.size + ' slot tangkapan layar terisi'
  + (belum.length ? ' — menunggu: ' + belum.join(', ') : ''))

console.log('\n' + '='.repeat(52))
console.log('  OK: ' + ok + '   GAGAL: ' + gagal)
console.log('='.repeat(52) + '\n')
process.exit(gagal ? 1 : 0)
