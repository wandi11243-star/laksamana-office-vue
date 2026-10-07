// Marketing — API calls + types. One backend under /api/v1/marketing
// (laksamana-api/docs/api/marketing.md).
//
// Read: like the old `getAll`, every Marketing screen works from ONE
// `GET /state` (all collections, activities, settings & role documents),
// shared under the key 'marketing-state'. Write: per record, never whole-state
// (U4, T-03): POST / PUT / PATCH / DELETE /{resource}[/{id}] with the row's
// version as If-Match. A row's version IS its `updatedAt` (ms); a 409 carries
// the live row, a write identical to the stored row is a no-op success. This
// replaces the old saveAll + bentrok[] (marketing.md F.1, T-04).
//
//   if (await mktSimpan(() => tambalMkt('events', e.id, { status }, e.updatedAt), 'Tahap diperbarui')) …
//
// Who I am inside the module: the `users` row whose id is my Office id (else my
// name); a person without a row yet acts as `marketing`, in memory only — the
// old resolveOfficeUser did the same (deploy/marketing/index.html:3588-3596).
// An Office admin of `marketing` is Super Admin, as the roster sync made them.
//
// The Dana Masuk tab (DP Event) also reads `GET /marketing/dp` from here; that
// endpoint is open to reservasi/cashier/finance too (G-15).
//
// Not carried over: `ping`/`stats` (U3), whole-state `saveAll` (U4).
import type { Me } from '~/composables/useMe'
import { isAdminOf } from '~/composables/useMe'
import type {
  AktivitasMkt, ClientMkt, EventMkt, FollowupMkt, KolomMkt, RoleAccMkt, SettingsMkt, UrutMkt, UserMkt,
} from '~/utils/marketing'
import {
  PER_HAL_MKT, SETTING_MKT_BAWAAN, TENGGANG_TUTUP_MKT, bolehAksiMkt, bolehBukaMkt, hariAntaraMkt, normRoleAccMkt, normUserMkt, urutAwalMkt, urutMkt,
} from '~/utils/marketing'
import { normEventMkt } from '~/utils/marketing-uang'
import { UButton } from '#components'
import type { Versi } from '~/utils/versi'
import { ifMatch, tanganiKonflik } from '~/utils/versi'

// ---------------------------------------------------------------- DP Event (Dana Masuk)
// The tab is READ-ONLY: payments are verified in Marketing first, and land
// there only to be looked at (`docs/migrasi/reservasi.md` F11).
// Filtered by EVENT date on the server; the pay date stays one column.

/** One event/VIP payment row of `GET /marketing/dp`. Field names as the API sends them. */
export interface DpEvent {
  sumber: 'event' | 'vip'
  evId: string
  event: string
  jenis: string
  tglEvent: string
  status: string
  client: string
  pic: string
  /** Set when a VIP row is also locked into a reservation: "don't count twice". */
  resId: string
  id: string
  no: string
  type: string
  amount: number
  method: string
  at: string
  receipt: string
  receiptUrl: string
}

export interface DpEventData {
  baris: DpEvent[]
  total: number
  tanpaTanggal: number
  vipTerkunci: { n: number, total: number }
  luar: { n: number, total: number, dari: string, sampai: string }
  dari: string
  sampai: string
}

/**
 * GET /marketing/dp?from&to — both required by the API, so the caller clamps
 * an open range to 2000-01-01..2100-12-31 first (the old client's rule).
 */
export const getMarketingDp = (from: string, to: string) =>
  useApi()<Envelope<DpEventData>>('/marketing/dp', { query: { from, to } })

// ---------------------------------------------------------------- state

/** v1 resource names (docs/api/marketing.md Records). */
export type MarketingResource = 'clients' | 'events' | 'followups' | 'approvals' | 'users' | 'staff' | 'task-templates' | 'task-categories' | 'categories' | 'notifications' | 'vip' | 'design-requests'

/** `GET /marketing/state`: the collections under their LEGACY keys (`taskTemplates`, `notifs`, `designreqs`). */
export interface StateMkt {
  clients: ClientMkt[]
  events: EventMkt[]
  followups: FollowupMkt[]
  approvals: Record<string, unknown>[]
  users: UserMkt[]
  taskTemplates: Record<string, unknown>[]
  taskCategories: Record<string, unknown>[]
  categories: string[]
  notifs: Record<string, unknown>[]
  vip: Record<string, unknown>[]
  designreqs: Record<string, unknown>[]
  activities: AktivitasMkt[]
  settings: SettingsMkt
  roleAcc: RoleAccMkt
  fbFormats: string[] | null
  fbSubs: unknown[]
  katalog: Record<string, unknown>[]
  menuDb: Record<string, unknown>
}

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? v as T[] : [])

export function stateMktKosong(): StateMkt {
  return {
    clients: [], events: [], followups: [], approvals: [], users: [], taskTemplates: [], taskCategories: [],
    categories: [], notifs: [], vip: [], designreqs: [], activities: [], settings: { ...SETTING_MKT_BAWAAN },
    roleAcc: {}, fbFormats: null, fbSubs: [], katalog: [], menuDb: {},
  }
}

/**
 * The state as the old normalizeState shaped it on load (:2338-2661), in
 * memory: settings over their defaults, events migrated (normEventMkt), the
 * role matrix brought up to date, and old `staff` rows folded into `users`.
 */
export function normStateMkt(raw: unknown): StateMkt {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const settings = { ...SETTING_MKT_BAWAAN, ...(s.settings && typeof s.settings === 'object' && !Array.isArray(s.settings) ? s.settings : {}) } as SettingsMkt
  const users = arr<UserMkt>(s.users).filter(u => u && typeof u === 'object').map(normUserMkt)
  for (const st of arr<{ name?: string, officeId?: string, id?: string, div?: string, jabatan?: string, hp?: string, active?: boolean }>(s.staff)) {
    if (!st?.name) continue
    const u = users.find(x => String(x.name || '').toLowerCase() === String(st.name).toLowerCase())
    if (u) {
      if (st.div && !u.div) u.div = st.div
      if (st.jabatan && !u.jabatan) u.jabatan = st.jabatan
      if (st.hp && !u.hp) u.hp = st.hp
    }
    else {
      users.push({ id: st.officeId || st.id || `st_${st.name}`, name: st.name, div: st.div || '', jabatan: st.jabatan || '', hp: st.hp || '', role: 'operational', active: st.active !== false })
    }
  }
  return {
    clients: arr(s.clients),
    events: arr<EventMkt>(s.events).filter(e => e && typeof e === 'object').map(e => normEventMkt(e, settings)),
    followups: arr(s.followups),
    approvals: arr(s.approvals),
    users,
    taskTemplates: arr(s.taskTemplates),
    taskCategories: arr(s.taskCategories),
    categories: arr(s.categories),
    notifs: arr(s.notifs),
    vip: arr(s.vip),
    designreqs: arr(s.designreqs),
    activities: arr(s.activities),
    settings,
    roleAcc: normRoleAccMkt(s.roleAcc, s.roleNav, s.rolePerms),
    fbFormats: Array.isArray(s.fbFormats) ? s.fbFormats as string[] : (s.fbFormats === undefined || s.fbFormats === null ? null : []),
    fbSubs: arr(s.fbSubs),
    katalog: arr(s.katalog),
    menuDb: (s.menuDb && typeof s.menuDb === 'object' && !Array.isArray(s.menuDb) ? s.menuDb : {}) as Record<string, unknown>,
  }
}

/** The F&B formats in force: the seed while the list was never saved (getFbFormats, :5249). */
export const formatFbMkt = (st: StateMkt) => st.fbFormats ?? ['Prasmanan', 'Set Menu', 'Coffee Break', 'Nasi Kotak']

/** GET /marketing/state */
export const getStateMkt = () => useApi()<Envelope<unknown>>('/marketing/state')

/** The shared state every Marketing screen reads. One request per page load, refreshed after writes. */
export const useStateMkt = () =>
  useAsyncData('marketing-state', () => getStateMkt().then(r => normStateMkt(r.data)), { default: stateMktKosong })

// ---------------------------------------------------------------- who I am

export interface SayaMkt { user: UserMkt, sementara: boolean }

/** Map the Office user onto a `users` row (:3588-3596): id first, then the name. */
export function sayaMkt(me: Me | null, users: UserMkt[]): SayaMkt | null {
  if (!me) return null
  const admin = isAdminOf(me, 'marketing')
  const nama = String(me.name || '').toLowerCase()
  const u = users.find(x => x.id === me.id) ?? users.find(x => String(x.name || '').toLowerCase() === nama)
  if (u) return { user: admin ? { ...u, role: 'super_admin' } : u, sementara: false }
  return { user: { id: me.id, name: me.name, role: admin ? 'super_admin' : 'marketing', active: true }, sementara: true }
}

/** The bits the module menu needs before a screen is drawn (shell `siapkan`). */
export const usePeranMkt = () => useState<{ users: UserMkt[], roleAcc: RoleAccMkt }>('marketing-peran', () => ({ users: [], roleAcc: {} }))

/** Load the state once on entering the module and mirror users + matrix for the menu. */
export function muatPeranMkt() {
  const peran = usePeranMkt()
  const { data } = useStateMkt()
  watchEffect(() => {
    peran.value = { users: data.value.users, roleAcc: data.value.roleAcc }
  })
  return peran
}

/** May I open a screen — for the menu (layar `boleh`). */
export function bolehLihatMkt(me: Me | null, users: UserMkt[], roleAcc: RoleAccMkt, layar: string): boolean {
  return bolehBukaMkt(layar, sayaMkt(me, users)?.user, roleAcc)
}

/** Reactive access for a screen: `can('edit_event')` = the old can(), `canView('crm')` = may open. */
export function useAksesMkt() {
  const me = useMe()
  const { data } = useStateMkt()
  const saya = computed(() => sayaMkt(me.value, data.value.users))
  const can = (action: string) => bolehAksiMkt(action, saya.value?.user, data.value.roleAcc)
  const canView = (layar: string) => bolehBukaMkt(layar, saya.value?.user, data.value.roleAcc)
  return { saya, can, canView }
}

// ---------------------------------------------------------------- writes

const versiHdr = (v?: Versi) => (v === undefined ? undefined : ifMatch(v))

/** POST /marketing/{resource} — `id` optional (server makes `<prefix>_xxxxxxx`). */
export const buatMkt = <T>(res: MarketingResource, body: Partial<T>) =>
  useApi()<Envelope<T>>(`/marketing/${res}`, { method: 'POST', body })

/** PUT — replaces the whole record. Needs the version. */
export const ubahMkt = <T>(res: MarketingResource, id: string, body: Partial<T>, versi?: Versi) =>
  useApi()<Envelope<T>>(`/marketing/${res}/${encodeURIComponent(id)}`, { method: 'PUT', body, headers: versiHdr(versi) })

/** PATCH — merges top-level fields. Needs the version. */
export const tambalMkt = <T>(res: MarketingResource, id: string, fields: Partial<T>, versi?: Versi) =>
  useApi()<Envelope<T>>(`/marketing/${res}/${encodeURIComponent(id)}`, { method: 'PATCH', body: fields, headers: versiHdr(versi) })

/** DELETE — needs the version. */
export const hapusMkt = (res: MarketingResource, id: string, versi?: Versi) =>
  useApi()<unknown>(`/marketing/${res}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: versiHdr(versi) })

/** POST /marketing/activities — the old logAct (:4634); `by` and `at` come from the server. */
export const logMkt = (refType: string, refId: string, action: string, detail = '') =>
  useApi()<unknown>('/marketing/activities', { method: 'POST', body: { refType, refId: refId || '-', action, detail } })

export type JejakMkt = { refType: string, refId?: string, action: string, detail?: string }

/**
 * Run a versioned write (or several, in order): on 409/428 reload and say so,
 * otherwise toast the error. Reloads the shared state on success. The activity
 * line(s) follow like the old logAct — their failure never fails the write.
 */
export async function mktSimpan<T>(aksi: () => Promise<T>, sukses?: string, jejak?: JejakMkt | JejakMkt[]): Promise<boolean> {
  const toast = tryUseNuxtApp()?.vueApp.runWithContext(() => useToast()) ?? null
  const muatUlang = () => refreshNuxtData('marketing-state')
  try {
    await aksi()
    for (const j of jejak ? [jejak].flat() : []) await logMkt(j.refType, j.refId ?? '-', j.action, j.detail).catch(() => {})
    await muatUlang()
    if (sukses) toast?.add({ title: sukses, color: 'success' })
    return true
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) {
      toast?.add({ title: apiErrorMessage(e), color: 'error' })
      // A chain of writes may have half-landed (follow-up + its event): show what is stored.
      await muatUlang().catch(() => {})
    }
    return false
  }
}

// ---------------------------------------------------------------- automatic close (H+2)

/**
 * autoCloseEvents (:4704-4714), run by the old client on every boot: a
 * Deal/Confirmed event whose date is two or more days past becomes Event
 * Done. Here once per session, after the state arrives, one PATCH per event
 * with its version; refusals (no access, someone else was faster) stay silent
 * like the old background save — the next opener tries again.
 */
export function useTutupEventLewat() {
  const sudah = useState('marketing-tutup-lewat', () => false)
  const { data, status } = useStateMkt()
  watch(status, async (s) => {
    if (s !== 'success' || sudah.value) return
    sudah.value = true
    const hari = hariIni()
    const lewat = data.value.events.filter(e => ['Deal', 'Confirmed'].includes(e.status) && e.tanggal && hariAntaraMkt(hari, e.tanggal) <= -TENGGANG_TUTUP_MKT)
    let n = 0
    for (const e of lewat) {
      try {
        await tambalMkt<EventMkt>('events', e.id, { status: 'Event Done', pipeCol: 'Event Done' }, e.updatedAt)
        await logMkt('event', e.id, 'Status → Event Done', 'otomatis: tanggal event sudah lewat lebih dari sehari').catch(() => {})
        n++
      }
      catch { /* see above */ }
    }
    if (n) await refreshNuxtData('marketing-state')
  }, { immediate: true })
}

// ---------------------------------------------------------------- tables

/**
 * One table's sort + page, kept for the session like the old TBL_SORT/TBL_HAL
 * (:5451-5470). A new sort or a changed filter fingerprint (`sidik`) goes back
 * to page 1; data merely refreshing keeps the page.
 */
export function useTabelMkt<T>(key: string, kolom: KolomMkt<T>[], sidik?: () => string) {
  const urut = useState<UrutMkt | null>(`mkt-urut-${key}`, () => urutAwalMkt(kolom))
  const hal = useState(`mkt-hal-${key}`, () => 1)
  const jejak = useState(`mkt-sidik-${key}`, () => '')
  if (sidik) {
    watch(sidik, (s) => {
      if (s !== jejak.value) {
        jejak.value = s
        hal.value = 1
      }
    }, { immediate: true })
  }
  function klik(k: string) {
    urut.value = urut.value?.k === k ? { k, arah: urut.value.arah === 1 ? -1 : 1 } : { k, arah: 1 }
    hal.value = 1
  }

  /** A UTable `header` for a sortable column. */
  const kepala = (k: string, t: string) => () => h(UButton, {
    'label': t,
    'color': 'neutral',
    'variant': 'link',
    'class': '-mx-1 px-1 text-xs font-semibold tracking-wide text-table-head-text uppercase',
    'trailingIcon': urut.value?.k === k ? (urut.value.arah === 1 ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down') : 'i-lucide-arrow-up-down',
    'aria-label': `Urutkan menurut ${t}`,
    'onClick': () => klik(k),
  })
  const susun = (rows: T[]) => urutMkt(rows, kolom, urut.value)
  const potong = (rows: T[]) => {
    const maks = Math.max(1, Math.ceil(rows.length / PER_HAL_MKT))
    const kini = Math.min(Math.max(1, hal.value), maks)
    return rows.slice((kini - 1) * PER_HAL_MKT, kini * PER_HAL_MKT)
  }
  return { urut, hal, klik, kepala, susun, potong }
}

// ---------------------------------------------------------------- other modules (read-only)

/** One EMS event as the calendar needs it (muatEventEms, :12141-12175). */
export interface AcaraEmsMkt { id: string, tgl: string, nama: string, venue: string, kategori: string, status: string, pic: string }

/**
 * GET /event/events?from&to — the Event module's own events, drawn as a separate
 * read-only band. Needs the `event` module; without it the calendar says so and
 * still draws the Marketing events (as before). `Planning` events are left out.
 * The day is the LOCAL date of start_datetime — the old client sliced the UTC
 * string, which put an event before 07:00 WIB on the previous day.
 */
export async function getAcaraEms(from: string, to: string): Promise<AcaraEmsMkt[]> {
  const r = await useApi()<Envelope<Record<string, unknown>[]>>('/event/events', { query: { from, to, perPage: 1000 } })
  return (r.data ?? [])
    .filter(e => e && e.start_datetime && e.status !== 'Planning')
    .map((e) => {
      const d = new Date(String(e.start_datetime))
      const tgl = Number.isNaN(d.getTime())
        ? String(e.start_datetime).slice(0, 10)
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return { id: String(e.id), tgl, nama: String(e.title || '(tanpa judul)'), venue: String(e.venue || ''), kategori: String(e.category || ''), status: String(e.status || ''), pic: String(e.pic || '') }
    })
}
