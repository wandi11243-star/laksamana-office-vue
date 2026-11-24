/*
 * tools/uji-bd-pindah.mjs — guard for app/utils/bd-pindah.ts (moving tasks to
 * another project). node tools/uji-bd-pindah.mjs (Node 24: imports .ts directly)
 *
 * What is guarded: sub-tasks and everything else of a task travel untouched
 * (only `project` is written), an order between tasks never reaches across
 * projects after a move, and only ids touched by the move are ever removed.
 */
import { register } from 'node:module'

register('data:text/javascript,' + encodeURIComponent(`
  import { pathToFileURL } from 'node:url'
  import path from 'node:path'
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('~/')) return next(pathToFileURL(path.resolve('app', spec.slice(2) + '.ts')).href, ctx)
    if ((spec.startsWith('./') || spec.startsWith('../')) && !path.extname(spec) && ctx.parentURL?.endsWith('.ts')) return next(spec + '.ts', ctx)
    return next(spec, ctx)
  }
`))

const { rencanaPindah } = await import('../app/utils/bd-pindah.ts')

let ok = 0
let gagal = 0
const cek = (nama, dapat, harap) => {
  const a = JSON.stringify(dapat)
  const b = JSON.stringify(harap)
  if (a === b) ok++
  else {
    gagal++
    console.log(`GAGAL ${nama}\n  dapat ${a}\n  harap ${b}`)
  }
}

const T = (id, project, extra = {}) => ({ id, name: id, project, status: 'To Do', ...extra })
const ubahDari = r => r.ubah.map(u => [u.id, u.fields])

// 1. a plain move writes only `project`; sub-tasks need nothing (they ride in the row)
{
  const semua = [T('a', 'P1', { subtasks: [{ id: 's', t: 'x', done: false }, { id: 's2', t: 'y', done: true }] }), T('b', 'P1'), T('c', 'P2')]
  const r = rencanaPindah(semua, ['a'], 'P2')
  cek('move: one row', ubahDari(r), [['a', { project: 'P2' }]])
  cek('move: sub-tasks counted', r.subTask, 2)
  cek('move: nothing released', r.dilepas, 0)
}
// 2. everything moves: orders between the moved tasks stay
{
  const semua = [T('a', 'P1'), T('b', 'P1', { dependsOn: ['a'] }), T('c', 'P2')]
  const r = rencanaPindah(semua, ['a', 'b'], 'P2')
  cek('all: order between moved tasks is kept', ubahDari(r), [['a', { project: 'P2' }], ['b', { project: 'P2' }]])
  cek('all: nothing released', r.dilepas, 0)
}
// 3. a moved task whose prerequisite stays behind loses that order; the waiter that stays loses the moved one
{
  const semua = [T('a', 'P1'), T('b', 'P1', { dependsOn: ['a'] }), T('c', 'P1', { dependsOn: ['b'] })]
  const r = rencanaPindah(semua, ['b'], 'P2')
  cek('partial: moved task releases prerequisite left behind', r.ubah[0], { id: 'b', fields: { project: 'P2', dependsOn: [] } })
  cek('partial: waiter left behind is released', r.ubah[1], { id: 'c', fields: { dependsOn: [] } })
  cek('partial: two orders released', r.dilepas, 2)
}
// 4. a prerequisite already in the destination is kept
{
  const semua = [T('x', 'P2'), T('b', 'P1', { dependsOn: ['x', 'gone'] })]
  const r = rencanaPindah(semua, ['b'], 'P2')
  cek('dest: keeps order on a task already there, drops a stray id', r.ubah[0], { id: 'b', fields: { project: 'P2', dependsOn: ['x'] } })
  cek('dest: one released', r.dilepas, 1)
}
// 5. out of any project: orders cannot stay
{
  const semua = [T('a', 'P1'), T('b', 'P1', { dependsOn: ['a'] })]
  const r = rencanaPindah(semua, ['a', 'b'], null)
  cek('none: project null, orders dropped', ubahDari(r), [['a', { project: null }], ['b', { project: null, dependsOn: [] }]])
  cek('none: one released', r.dilepas, 1)
}
// 6. already there, Daily and unknown ids are skipped; an empty plan writes nothing
{
  const semua = [T('a', 'P2'), T('d', 'P1', { daily: true }), T('b', 'P1')]
  const r = rencanaPindah(semua, ['a', 'd', 'zzz'], 'P2')
  cek('skip: nothing to write', r.ubah, [])
  cek('skip: counted as skipped', r.dilewati, 3)
  cek('skip: no tasks moved', r.dipindah.length, 0)
}
// 7. a waiter that already lives in the destination keeps its order on the moved task
{
  const semua = [T('a', 'P1'), T('w', 'P2', { dependsOn: ['a'] })]
  const r = rencanaPindah(semua, ['a'], 'P2')
  cek('waiter in destination is left alone', ubahDari(r), [['a', { project: 'P2' }]])
}
// 8. unrelated orders are never rewritten
{
  const semua = [T('a', 'P1'), T('b', 'P1'), T('c', 'P1', { dependsOn: ['b'] }), T('m', 'P1')]
  const r = rencanaPindah(semua, ['a', 'm'], 'P2')
  cek('unrelated: only moved rows are written', r.ubah.map(u => u.id), ['a', 'm'])
}

console.log(`${ok} lolos, ${gagal} gagal`)
if (gagal) process.exit(1)
