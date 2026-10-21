// Akademi API calls + types. One Backend under /api/v1/akademi.
//
// Field names are exactly the ones the old client stored in each row's `data`
// JSON; the contract keeps them as they are (`division` ↔ DB column `divisi`,
// `type` ↔ `kind`) — laksamana-api/docs/api/akademi.md "Fields". Nothing is
// renamed here.
//
// Reads bootstrap from `GET /state`, the same whole-state object the old
// `getAll` returned; the screens aggregate client-side exactly like the old app
// (the server mirrors the same maths in AkademiStats::trainingStats()).
//
// Writes are per record, never `saveAll` (U4): `PUT /{resource}/{id}` and the
// composite cells `PUT /progress/{user}/{material}` /
// `PUT /program-progress/{user}/{program}/{material}`. Every update needs the
// version it last read; because `/state` carries no per-row version, the write
// helpers re-read the single record (or cell) to get the authoritative
// `meta.version` before writing. A race between that read and the write is
// still caught by a 409 and surfaces through `tanganiKonflik`.
//
// Records that do NOT exist yet: `POST` needs no version. `PUT`/`DELETE` without
// one answers 428 `version_required`.
import type { Me } from '~/composables/useMe'
import { isAdminOf } from '~/composables/useMe'
import type { ModulMember } from '~/composables/useRoster'

export type TipeMateri = 'video' | 'modul' | 'sop' | 'menu' | 'quiz'
export type PeranAkademi = 'admin' | 'manager' | 'staff'

export interface SoalKuis {
  q: string
  opts: string[]
  a: number
}

export interface MenuMateri {
  name?: string
  price?: string
  category?: string
  desc?: string
  ingredients?: string
  allergens?: string
  selling?: string
  notes?: string
}

export interface MateriAkademi {
  id: string
  type: TipeMateri
  title: string
  division: string[]
  cat: string
  mandatory: boolean
  published: boolean
  createdAt?: number
  updatedAt?: number
  passing?: number
  body?: string
  videoUrl?: string
  desc?: string
  steps?: string[]
  menu?: MenuMateri
  questions?: SoalKuis[]
}

export interface ProgramAkademi {
  id: string
  bulan: string
  title: string
  deadline: string
  note?: string
  materialIds: string[]
  createdAt?: number
  updatedAt?: number
}

export interface KruAkademi {
  id: string
  name: string
  role: PeranAkademi
  division: string
  title?: string
  active: boolean
  updatedAt?: number
}

export interface DivisiAkademi {
  id: string
  name: string
  ic?: string
}

export interface AktivitasAkademi {
  ts: number
  userId: string
  action: string
  detail?: string
}

export interface SetelanAkademi {
  passingDefault?: number
  orgName?: string
  [key: string]: unknown
}

/** A progress cell. Quiz cells carry `passed`/`score`; the rest carry `status`. */
export interface ProgresEntry {
  status?: string
  completedAt?: number | null
  attempts?: number
  score?: number | null
  passed?: boolean
  lastAt?: number
  done?: boolean
  at?: number
  [key: string]: unknown
}

export type PetaProgres = Record<string, Record<string, ProgresEntry>>
export type PetaProgProg = Record<string, Record<string, Record<string, ProgresEntry>>>

export interface AkademiState {
  version?: number
  createdAt?: number
  settings: SetelanAkademi
  divisions: DivisiAkademi[]
  programs: ProgramAkademi[]
  progProg: PetaProgProg
  users: KruAkademi[]
  materials: MateriAkademi[]
  progress: PetaProgres
  activity: AktivitasAkademi[]
}

/** A fresh, empty state — the screens must still render while `/state` loads. */
export const akademiStateKosong = (): AkademiState => ({
  version: 2,
  createdAt: 0,
  settings: { passingDefault: 80 },
  divisions: [],
  programs: [],
  progProg: {},
  users: [],
  materials: [],
  progress: {},
  activity: [],
})

export type ResourceAkademi = 'users' | 'divisions' | 'materials' | 'programs'

// ---------------------------------------------------------------- reads

/** GET /akademi/state — one-call bootstrap, shared by every screen. */
export const useAkademiState = () =>
  useAsyncData('akademi-state', () => useApi()<Envelope<AkademiState>>('/akademi/state').then(r => r.data), {
    dedupe: 'defer',
    default: akademiStateKosong,
  })

/** GET /akademi/training-stats — the server's read model of the same numbers. */
export const useAkademiTrainingStats = () =>
  useAsyncData('akademi-training-stats', () => useApi()<Envelope<Record<string, unknown>>>('/akademi/training-stats').then(r => r.data), {
    dedupe: 'defer',
    default: () => ({}),
  })

/** GET /akademi/{resource}/{id} — one record with its authoritative `meta.version`. */
export const getAkademiRecord = <T = unknown>(resource: ResourceAkademi, id: string) =>
  useApi()<Envelope<T>>(`/akademi/${resource}/${id}`)

/** GET /akademi/{resource} — a filtered list (admin pickers, library). */
export const listAkademiRecords = <T = unknown>(resource: ResourceAkademi, query?: Record<string, unknown>) =>
  useApi()<Envelope<T[]>>(`/akademi/${resource}`, { query })

/** GET /akademi/documents/{doc} — a hash-versioned settings document. */
export const getAkademiDocument = <T = unknown>(doc: string) =>
  useApi()<Envelope<T>>(`/akademi/documents/${doc}`)

// ---------------------------------------------------------------- writes

/** POST /akademi/{resource} — admin. `id` optional; the server generates one. */
export const createAkademiRecord = <T = unknown>(resource: ResourceAkademi, body: Record<string, unknown>) =>
  useApi()<Envelope<T>>(`/akademi/${resource}`, { method: 'POST', body })

/**
 * PUT /akademi/{resource}/{id} — replace the whole record. Re-reads the record
 * first so the version in `If-Match` is the server's, not a stale `/state` copy.
 * A conflict still surfaces to the caller for `tanganiKonflik`.
 */
export async function updateAkademiRecord<T = unknown>(resource: ResourceAkademi, id: string, body: Record<string, unknown>): Promise<Envelope<T>> {
  const cur = await getAkademiRecord(resource, id)
  const versi = versiDari(cur)
  return useApi()<Envelope<T>>(`/akademi/${resource}/${id}`, {
    method: 'PUT',
    body,
    headers: versi !== undefined ? ifMatch(versi) : undefined,
  })
}

/** DELETE /akademi/{resource}/{id} — admin, same version rule as PUT. */
export async function deleteAkademiRecord(resource: ResourceAkademi, id: string): Promise<void> {
  const cur = await getAkademiRecord(resource, id)
  const versi = versiDari(cur)
  await useApi()(`/akademi/${resource}/${id}`, { method: 'DELETE', headers: versi !== undefined ? ifMatch(versi) : undefined })
}

/** The version of one existing progress cell, or undefined when it does not exist. */
async function versiProgres(user: string, material: string): Promise<Versi | undefined> {
  try {
    return versiDari(await useApi()<Envelope<ProgresEntry>>(`/akademi/progress/${user}/${material}`))
  }
  catch (e) {
    if (apiErrorCode(e) === 'not_found') return undefined
    throw e
  }
}

/** PUT /akademi/progress/{user}/{material} — replace one composite cell. */
export async function simpanProgres(user: string, material: string, entry: ProgresEntry): Promise<Envelope<ProgresEntry>> {
  const versi = await versiProgres(user, material)
  return useApi()<Envelope<ProgresEntry>>(`/akademi/progress/${user}/${material}`, {
    method: 'PUT',
    body: entry,
    headers: versi !== undefined ? ifMatch(versi) : undefined,
  })
}

async function versiProgProg(user: string, program: string, material: string): Promise<Versi | undefined> {
  try {
    return versiDari(await useApi()<Envelope<ProgresEntry>>(`/akademi/program-progress/${user}/${program}/${material}`))
  }
  catch (e) {
    if (apiErrorCode(e) === 'not_found') return undefined
    throw e
  }
}

/** PUT /akademi/program-progress/{user}/{program}/{material} — replace one cell. */
export async function simpanProgProg(user: string, program: string, material: string, entry: ProgresEntry): Promise<Envelope<ProgresEntry>> {
  const versi = await versiProgProg(user, program, material)
  return useApi()<Envelope<ProgresEntry>>(`/akademi/program-progress/${user}/${program}/${material}`, {
    method: 'PUT',
    body: entry,
    headers: versi !== undefined ? ifMatch(versi) : undefined,
  })
}

/** POST /akademi/activity — the audit line of an action with no record row. */
export const catatAktivitas = (action: string, detail?: string) =>
  useApi()<Envelope<AktivitasAkademi>>('/akademi/activity', { method: 'POST', body: { action, detail } })

/** PUT /akademi/documents/{doc} — admin, whole value, `If-Match` with the hash. */
export async function simpanDokumenAkademi<T = unknown>(doc: string, value: T): Promise<Envelope<T>> {
  const cur = await getAkademiDocument(doc)
  const versi = versiDari(cur)
  return useApi()<Envelope<T>>(`/akademi/documents/${doc}`, {
    method: 'PUT',
    body: value as Record<string, unknown>,
    headers: versi !== undefined ? ifMatch(versi) : undefined,
  })
}

/**
 * Delete every progress cell of one material (F8: deleting a material deletes
 * its progress). The API has no cascade, so the cells are removed one by one —
 * each with the version the list returned.
 *
 * G-17: the caller MUST delete the progress cells first and the material last,
 * and stop at the first refusal. The sequential `await` in this loop does that:
 * a failed cell throws before `deleteAkademiRecord('materials', …)` runs, so the
 * screen is not left half-deleted. `kelola-materi.vue` relies on this order.
 */
export async function hapusProgresMateri(material: string): Promise<void> {
  const { data } = await useApi()<Envelope<{ userId: string, materialId: string, version: Versi }[]>>('/akademi/progress', { query: { material } })
  for (const row of data ?? []) {
    await useApi()(`/akademi/progress/${row.userId}/${row.materialId}`, { method: 'DELETE', headers: ifMatch(row.version) })
  }
}

/**
 * Delete every program-progress cell of one program (F8: same rule as materials).
 * G-17: progress first, program last, stop on the first refusal — the caller
 * (`kelola-program.vue`) deletes the record only after this resolves.
 */
export async function hapusProgProgProgram(program: string): Promise<void> {
  const { data } = await useApi()<Envelope<{ userId: string, programId: string, materialId: string, version: Versi }[]>>('/akademi/program-progress', { query: { program } })
  for (const row of data ?? []) {
    await useApi()(`/akademi/program-progress/${row.userId}/${row.programId}/${row.materialId}`, { method: 'DELETE', headers: ifMatch(row.version) })
  }
}

// ---------------------------------------------------------------- shared crew state

/** The crew rows of `GET /state`, mirrored into `useState` so the menu's `boleh` can read them (no async in the sidebar). */
export const useAkademiKru = () => useState<KruAkademi[]>('akademi-kru', () => [])

/** Fill the shared crew state from `/state`; call once from a page (or the shell `siapkan`). */
export function muatAkademiKru() {
  const { data } = useAkademiState()
  const kru = useAkademiKru()
  watchEffect(() => {
    kru.value = data.value.users ?? []
  })
  return kru
}

/**
 * The signed-in person's crew row, matched by Office id then by name
 * (`resolveAkademiUser`, :633-648). A crew member Office granted access to but
 * that is not in the row list yet gets a transient `all`/staff row so the
 * screens still work before an admin syncs the roster.
 */
export function kruSaya(me: Me | null): KruAkademi | null {
  if (!me) return null
  const users = useAkademiKru().value
  const ketemu = users.find(u => u.id === me.id)
    ?? users.find(u => String(u.name).toLowerCase() === me.name.toLowerCase())
  if (ketemu) return ketemu
  return {
    id: me.id,
    name: me.name,
    role: isAdminOf(me, 'akademi') ? 'admin' : 'staff',
    division: 'all',
    title: '',
    active: true,
  }
}

/** `isManager(u)` (`:601`): module admin, or an internal `manager` (PIC division). */
export const isManagerAkademi = (me: Me | null): boolean =>
  isAdminOf(me, 'akademi') || kruSaya(me)?.role === 'manager'

/** The reactive read every screen uses: state slices + the signed-in crew. */
export function useAkademiData() {
  const me = useMe()
  const { data, status, error, refresh } = useAkademiState()
  const materials = computed(() => data.value.materials ?? [])
  const users = computed(() => data.value.users ?? [])
  const divisions = computed(() => data.value.divisions ?? [])
  const programs = computed(() => data.value.programs ?? [])
  const progress = computed(() => data.value.progress ?? {})
  const progProg = computed(() => data.value.progProg ?? {})
  const activity = computed(() => data.value.activity ?? [])
  const settings = computed(() => data.value.settings ?? {})
  const kru = computed(() => kruSaya(me.value))
  const isAdmin = computed(() => isAdminOf(me.value, 'akademi'))
  const isManager = computed(() => isManagerAkademi(me.value))
  const passingDefault = computed(() => Number(settings.value.passingDefault) || 80)

  return { me, state: data, status, error, refresh, materials, users, divisions, programs, progress, progProg, activity, settings, kru, isAdmin, isManager, passingDefault }
}

// ---------------------------------------------------------------- roster sync (T-01, F5)

/**
 * Pull the crew Office granted access to into the `users` collection. Office is
 * the only source of the crew list; crew outside the roster are DEACTIVATED,
 * never deleted, and an EMPTY roster is ignored (`:709-723`). Best-effort and
 * admin-only (record writes need module admin), so it is called from screens an
 * admin opens; failures are swallowed.
 */
export async function sinkronRosterAkademi(users: KruAkademi[], members: ModulMember[]): Promise<number> {
  let ubah = 0
  const punyaNama = new Map(users.map(u => [String(u.name).toLowerCase(), u]))
  for (const m of members) {
    if (!m.id) continue
    const u = users.find(x => x.id === m.id) ?? punyaNama.get(String(m.name).toLowerCase())
    if (!u) {
      await createAkademiRecord('users', {
        id: m.id,
        name: m.name || '(tanpa nama)',
        role: m.isModuleAdmin ? 'admin' : 'staff',
        division: 'all',
        title: '',
        active: true,
      })
      ubah++
      continue
    }
    const baru: KruAkademi = { ...u }
    if (m.name && u.name !== m.name) baru.name = m.name
    if (m.isModuleAdmin && u.role !== 'admin') baru.role = 'admin'
    if (u.active === false) baru.active = true
    if (baru.name !== u.name || baru.role !== u.role || baru.active !== u.active) {
      await updateAkademiRecord('users', u.id, baru as unknown as Record<string, unknown>)
      ubah++
    }
  }
  if (members.length) {
    const idOk = new Set(members.map(m => m.id))
    for (const u of users) {
      if (!idOk.has(u.id) && u.active) {
        await updateAkademiRecord('users', u.id, { ...u, active: false } as unknown as Record<string, unknown>)
        ubah++
      }
    }
  }
  return ubah
}

// ---------------------------------------------------------------- the material viewer

export interface JawabanKuis {
  /** The full progress entry to store (already merged with the previous attempts). */
  entry: ProgresEntry
  lulus: boolean
  latihan: boolean
  skor: number
}

/**
 * The shared "open a material" behaviour of Beranda / Materi / Perpustakaan /
 * Program: opens the viewer sheet, and on completion stores the progress cell
 * (and the program cell when it was opened from a monthly program), logs it and
 * refreshes the state. The certification toast fires the first time the crew
 * becomes certified.
 */
export function usePenontonMateri() {
  const toast = useToast()
  const { materials, progress, progProg, refresh, kru, passingDefault } = useAkademiData()

  const buka = ref(false)
  const materi = ref<MateriAkademi | null>(null)
  const progId = ref<string | null>(null)

  const dariProgram = computed(() => !!progId.value)
  const materiOke = computed(() => materi.value)

  /** Mode Baca: in the crew's scope (matsForUser) it counts, otherwise it is study-only. */
  const dalamLingkup = computed(() => {
    const m = materi.value
    const u = kru.value
    if (!m || !u) return false
    return materiUntuk(u, [m]).length > 0
  })

  /** The viewer's "done" state: a program item's own cell when opened from a program, else the normal cell. */
  const selesai = computed(() => {
    const m = materi.value
    const u = kru.value
    if (!m || !u) return false
    if (dariProgram.value && progId.value) return itemProgramSelesai(u.id, progId.value, m.id, progProg.value)
    return selesaiMateri(u.id, m, progress.value)
  })

  const progresMateri = computed<ProgresEntry | null>(() => {
    const m = materi.value
    const u = kru.value
    if (!m || !u) return null
    return progresSel(u.id, m.id, progress.value)
  })

  const skorMateri = computed<number | null>(() => {
    const p = progresMateri.value
    return typeof p?.score === 'number' ? p.score : null
  })

  function bukaMateri(id: string, programId?: string) {
    const m = materials.value.find(x => x.id === id) ?? null
    if (!m) return
    materi.value = m
    progId.value = programId ?? null
    buka.value = true
  }

  function tutup() {
    buka.value = false
  }

  /** Non-quiz completion (`completeMaterial`, :1053-1062). */
  async function tandaiSelesai() {
    const m = materi.value
    const u = kru.value
    if (!m || !u) return
    const certifiedSebelum = statKru(u, materials.value, progress.value).certified
    const now = Date.now()
    try {
      // Merge into the existing cell, like the old setProg (`:733-738`).
      await simpanProgres(u.id, m.id, { ...(progresMateri.value ?? {}), status: 'done', completedAt: now })
      if (dariProgram.value && progId.value) {
        await simpanProgProg(u.id, progId.value, m.id, { done: true, at: now })
      }
      await catatAktivitas('selesai', `Menyelesaikan ${statusTipe(m.type).label}: ${m.title}`)
      await refresh()
      buka.value = false
      toast.add({ title: 'Materi selesai. Kerja bagus, Pelaut!', color: 'success' })
      if (!certifiedSebelum && statKru(u, materials.value, progress.value).certified) {
        toast.add({ title: 'Semua materi wajib selesai, kamu tersertifikasi.', color: 'success' })
      }
    }
    catch (e) {
      if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
    }
  }

  /** Quiz submission (`submitQuiz`, :1102-1116). Practice runs are never stored. */
  async function simpanKuis(j: JawabanKuis) {
    const m = materi.value
    const u = kru.value
    if (!m || !u || j.latihan) return
    const certifiedSebelum = statKru(u, materials.value, progress.value).certified
    try {
      await simpanProgres(u.id, m.id, j.entry)
      if (dariProgram.value && progId.value && j.lulus) {
        await simpanProgProg(u.id, progId.value, m.id, { done: true, at: Date.now(), score: j.skor })
      }
      await catatAktivitas('kuis', `${m.title}, skor ${j.skor}% (${j.lulus ? 'LULUS' : 'belum lulus'})`)
      await refresh()
      if (!certifiedSebelum && statKru(u, materials.value, progress.value).certified) {
        toast.add({ title: 'Semua materi wajib selesai, kamu tersertifikasi.', color: 'success' })
      }
    }
    catch (e) {
      if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
    }
  }

  return {
    buka, tutup, materi, materiOke, progId, dariProgram, dalamLingkup, selesai, progresMateri, skorMateri,
    passingDefault, bukaMateri, tandaiSelesai, simpanKuis,
  }
}
