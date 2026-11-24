// Schedules loaded by DATE RANGE, kept in one pool. The roster needs more than
// "the month on screen": a week can cross a month, "Salin minggu lalu" needs the
// week before, "Isi otomatis" any range, and the clash check must see every
// loaded day. `pastikan(a, b)` fetches only what is not loaded yet;
// `muatUlang()` refreshes every loaded range (after a save or a conflict).
import type { JadwalTalent } from '~/composables/useEvent'
import { listEvent } from '~/composables/useEvent'
import type { RentangTgl } from '~/utils/event-jadwal'
import { gabungRentang, rentangTercakup } from '~/utils/event-jadwal'
import type { Versi } from '~/utils/versi'

export function useJadwalRentang() {
  const pool = ref<JadwalTalent[]>([])
  const versi = ref<Record<string, Versi>>({})
  const dimuat = ref<RentangTgl[]>([])
  const memuat = ref(0)
  const galat = ref<unknown>(null)
  /** Bumped by `muatUlang`: an answer that left before it is stale and dropped. */
  let generasi = 0

  /** Replace the rows of `[a, b]` with a fresh answer. */
  function terapkan(a: string, b: string, rows: JadwalTalent[], versions: Record<string, Versi>) {
    const lain = pool.value.filter(j => j.date < a || j.date > b)
    pool.value = [...lain, ...rows]
    const v: Record<string, Versi> = {}
    for (const j of lain) if (versi.value[j.id] !== undefined) v[j.id] = versi.value[j.id]!
    for (const j of rows) if (versions[j.id] !== undefined) v[j.id] = versions[j.id]!
    versi.value = v
  }

  async function ambil(a: string, b: string) {
    const g = generasi
    memuat.value++
    try {
      const r = await listEvent<JadwalTalent>('schedules', { from: a, to: b })
      if (g !== generasi) return
      terapkan(a, b, r.data, r.meta?.versions ?? {})
      dimuat.value = gabungRentang(dimuat.value, a, b)
      galat.value = null
    }
    catch (e) {
      if (g === generasi) galat.value = e
      throw e
    }
    finally {
      memuat.value--
    }
  }

  /** Load `[a, b]` unless it is already loaded. */
  async function pastikan(a: string, b: string) {
    if (rentangTercakup(dimuat.value, a, b)) return
    try {
      await ambil(a, b)
    }
    catch {
      // `galat` carries it; the screen shows the message and keeps what it has.
    }
  }

  /** Refresh every loaded range. */
  async function muatUlang() {
    const daftar = dimuat.value.map(r => ({ ...r }))
    generasi++
    dimuat.value = []
    await Promise.all(daftar.map(r => ambil(r.a, r.b).catch(() => {})))
  }

  return { rows: pool, versi, dimuat, memuat: computed(() => memuat.value > 0), galat, pastikan, muatUlang }
}
