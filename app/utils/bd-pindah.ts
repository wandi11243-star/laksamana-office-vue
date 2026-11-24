// Moving tasks to another project in one go (Task Management › project detail).
// Pure: no Vue, no API, importable from plain node (tools/uji-bd-pindah.mjs).
//
// A task row carries `project` (id or null), its sub-tasks and `dependsOn`
// (ids of tasks it waits on). Sub-tasks ride inside the row, so they move with
// it. `dependsOn` is only meaningful inside ONE project (the task form offers
// "same project" candidates only), so a move must not leave an order that
// reaches across projects:
//   - a moved task keeps a prerequisite only when that one ends up in the
//     same destination project (moved along, or already there);
//   - a task that stays behind and waits on a moved one is released from it
//     (unless it already sits in the destination).
// Only ids touched by the move are ever removed; nothing else is rewritten.
import type { BdTask } from '~/composables/useBd'
import { deps, subs } from '~/utils/bd-rumus'

/** The fields written to one task row (PATCH, merged over the stored row). */
export interface UbahPindah {
  id: string
  /** Moved tasks carry `project`; a waiter that only loses an order does not. */
  fields: { project?: string | null, dependsOn?: string[] }
}

export interface RencanaPindah {
  /** Tasks that really change project (selected, not daily, not already there). */
  dipindah: BdTask[]
  /** Rows to write: the moved tasks first, then the waiters that are released. */
  ubah: UbahPindah[]
  /** Selected ids that stay put (already in the destination, or Daily). */
  dilewati: number
  /** Order entries (task A waits on task B) that are dropped by this move. */
  dilepas: number
  /** Sub-tasks travelling with the moved tasks. */
  subTask: number
}

/**
 * What moving `ids` to `tujuan` (a project id, or null = out of any project)
 * would write. `semua` is every task of the board.
 */
export function rencanaPindah(semua: BdTask[], ids: string[], tujuan: string | null): RencanaPindah {
  const pilih = new Set(ids)
  const dipindah = semua.filter(t => pilih.has(t.id) && !t.daily && (t.project || null) !== tujuan)
  const pindah = new Set(dipindah.map(t => t.id))
  const projekBaru = (id: string): string | null | undefined => {
    if (pindah.has(id)) return tujuan
    const t = semua.find(x => x.id === id)
    return t ? (t.project || null) : undefined
  }

  const ubah: UbahPindah[] = []
  let dilepas = 0

  for (const t of dipindah) {
    const lama = deps(t)
    // An order needs a project; out of any project nothing is kept.
    const baru = lama.filter(d => tujuan !== null && projekBaru(d) === tujuan)
    dilepas += lama.length - baru.length
    ubah.push({ id: t.id, fields: baru.length === lama.length ? { project: tujuan } : { project: tujuan, dependsOn: baru } })
  }

  // Waiters that stay behind, still pointing at a task that has just left.
  for (const u of semua) {
    if (pindah.has(u.id)) continue
    const lama = deps(u)
    if (!lama.some(d => pindah.has(d))) continue
    const sama = tujuan !== null && (u.project || null) === tujuan
    if (sama) continue
    const baru = lama.filter(d => !pindah.has(d))
    dilepas += lama.length - baru.length
    ubah.push({ id: u.id, fields: { dependsOn: baru } })
  }

  return {
    dipindah,
    ubah,
    dilewati: pilih.size - dipindah.length,
    dilepas,
    subTask: dipindah.reduce((a, t) => a + subs(t).length, 0),
  }
}
