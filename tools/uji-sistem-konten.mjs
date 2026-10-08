/*
 * tools/uji-sistem-konten.mjs — guard for app/utils/sistem-konten.ts.
 *
 *   node tools/uji-sistem-konten.mjs      (Node 24: imports the .ts directly)
 *
 * Rules that fail SILENTLY (docs/migrasi/konten.md F.23–F.26, F.31):
 *   - brand card: Σfollowers ÷ Σtarget, 0 % without a target;
 *   - crew: role counts WITHOUT the role filter; search name/division/email;
 *   - roster: a new Office member gets a planner row (super_admin for module
 *     admin), names follow Office, rows kept under an old id are REPORTED,
 *     never silently re-keyed;
 *   - role matrix: retired rows (bank, reports) hidden but kept on save;
 *     super_admin always stored as edit; the cell cycles None → Lihat → Ubah;
 *   - exports: one performance row per PLATFORM, ratios from the same engine.
 */
import { register } from 'node:module'

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('~/')) {
    const url = new URL('../app/' + spec.slice(2) + (spec.endsWith('.ts') ? '' : '.ts'), ${JSON.stringify(import.meta.url)})
    return next(url.href, ctx)
  }
  return next(spec, ctx)
}`))
const S = await import('../app/utils/sistem-konten.ts')

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

console.log('\nsistem: brand')
const b1 = { id: 'b1', name: 'LM', platforms: [{ p: 'IG', user: '@lm', followers: 4500, target: 10000 }, { p: 'TT', followers: 500, target: 0 }] }
const content = [{ id: 'c1', brand: 'b1', status: 'Posted' }, { id: 'c2', brand: 'b1', status: 'Idea' }, { id: 'c3', brand: 'b2', status: 'Posted' }]
cek('kartu brand: konten, tayang, followers, % ke target', sama(S.statBrand(b1, content), { konten: 2, tayang: 1, followers: 5000, target: 10000, keTarget: 50 }))
cek('tanpa target → 0 %, bukan ∞/NaN', S.statBrand({ id: 'x', name: 'x' }, content).keTarget === 0)
cek('followers tanpa target tetap 0 %', S.statBrand({ id: 'x', name: 'x', platforms: [{ p: 'IG', followers: 500 }] }, content).keTarget === 0)
cek('% ke target dibulatkan', S.statBrand({ id: 'x', name: 'x', platforms: [{ p: 'IG', followers: 1, target: 3 }] }, content).keTarget === 33)

console.log('\nsistem: kru')
const users = [
  { id: 'u2', name: 'Sari', roles: ['account_manager', 'content_planner'], division: 'Marketing', email: 'sari@x' },
  { id: 'u1', name: 'Andi', roles: ['designer'], division: 'Kreatif' },
  { id: 'u3', name: 'Budi', roles: ['designer', 'role_hilang'] },
]
cek('urut nama', sama(S.saringKru(users, S.filterKruBawaan()).map(u => u.id), ['u1', 'u3', 'u2']))
cek('saring role & cari divisi/email', sama(S.saringKru(users, { q: '', role: 'designer' }).map(u => u.id), ['u1', 'u3']) && sama(S.saringKru(users, { q: 'sari@', role: '' }).map(u => u.id), ['u2']) && sama(S.saringKru(users, { q: 'kreatif', role: '' }).map(u => u.id), ['u1']))
cek('hitungan role dari seluruh kru', S.hitungRoleKru(users, 'designer') === 2 && S.hitungRoleKru(users, 'analyst') === 0)
cek('role tak dikenal tidak dipajang', sama(S.rolesKru(users[2]), ['designer']))
cek('label & nama pendek role', S.labelRole('designer') === 'Designer' && S.shortRole('ads_specialist') === 'Ads')

console.log('\nsistem: sinkron roster Office')
const members = [
  { id: 'u1', name: 'Andi Saputra' },
  { id: 'off-9', name: 'sari', isModuleAdmin: true },
  { id: 'u7', name: 'Baru' },
  { id: 'u8', name: 'Admin Baru', isModuleAdmin: true },
  { id: '' },
]
const r = S.rencanaSinkronKru(members, users)
cek('anggota baru → baris planner; admin modul → super_admin', sama(r.baru.map(u => [u.id, u.roles]), [['u7', ['content_planner']], ['u8', ['super_admin']]]))
cek('nama ikut Office', r.ubah.some(x => x.u.id === 'u1' && x.fields.name === 'Andi Saputra'))
cek('jadi admin modul → super_admin ditambah di depan', r.ubah.some(x => x.u.id === 'u2' && sama(x.fields.roles, ['super_admin', 'account_manager', 'content_planner'])))
cek('cocok lewat NAMA dengan id lain → dilaporkan, tidak diganti diam-diam', sama(r.kembar.map(x => [x.u.id, x.officeId]), [['u2', 'off-9']]))
cek('sudah sama → tidak ada perubahan', S.rencanaSinkronKru([{ id: 'u3', name: 'Budi' }], users).ubah.length === 0)

console.log('\nsistem: matriks hak akses')
const perms = { content: { designer: 2, analyst: 0 }, bank: { designer: 2 }, reports: { analyst: 1 }, settings: { super_admin: 2 } }
cek('baris pensiun disembunyikan', sama(S.modulMatriks(perms), ['content', 'settings']))
cek('siklus None → Lihat → Ubah → None', S.siklusLevel(0) === 1 && S.siklusLevel(1) === 2 && S.siklusLevel(2) === 0)
const simpan = S.permSimpan(perms, { content: { analyst: 1, designer: 0 } })
cek('draf diterapkan; super_admin selalu Ubah', simpan.content.analyst === 1 && simpan.content.designer === 0 && simpan.content.super_admin === 2 && simpan.settings.super_admin === 2)
cek('baris pensiun tetap tersimpan apa adanya', sama(simpan.bank, { designer: 2 }) && sama(simpan.reports, { analyst: 1 }))
cek('role yang tak ada di draf memakai nilai lama, lalu 0', simpan.content.video_editor === 0 && S.permSimpan({ x: { analyst: 2 } }, {}).x.analyst === 2)
cek('Editor tidak memajang super_admin', !S.ROLE_MATRIKS.includes('super_admin'))

console.log('\nsistem: ekspor CSV')
const nb = id => (id === 'b1' ? 'LM, Batam' : '')
const nu = id => (id === 'u1' ? 'Andi' : '')
const kc = S.csvKonten([{ id: 'c', title: 'Promo "A"', brand: 'b1', platforms: ['Instagram', 'TT'], pic: 'u1', status: 'Posted' }], nb, nu).split('\n')
cek('ekspor konten: kutip & alias platform', kc[1].startsWith('"Promo ""A""","LM, Batam",IG + TT,'))
const kp = S.csvPerforma([{ id: 'p', title: 'P', brand: 'b1', platforms: ['IG', 'TT'], publishDate: '2026-09-01', perf: { IG: { reach: 1000, likes: 40, shares: 5, saves: 5, cta: 10 }, TT: { reach: 500, likes: 5 } } }], nb).split('\n')
cek('ekspor performa: satu baris per platform', kp.length === 3 && kp[1].includes(',IG,') && kp[2].includes(',TT,'))
cek('rasio dari mesin yang sama (ER 5%, Viral 1%, CTA 1%)', kp[1].endsWith(',50,5,1,1'))
const kd = S.csvPerforma([{ id: 'd', title: 'D', brand: 'b1', platforms: ['IG'], perf: { IG: { reach: 300, likes: 1 } } }], nb).split('\n')
cek('rasio 1 desimal (ER 0,3)', kd[1].endsWith(',1,0.3,0,0'), kd[1])
const kt = S.csvTim([users[0]]).split('\n')
cek('ekspor tim: role digabung', kt[1] === 'Sari,Marketing,Account Manager - Content Planner,,,sari@x')

console.log(`\n${ok} OK, ${gagal} GAGAL\n`)
process.exit(gagal ? 1 : 0)
