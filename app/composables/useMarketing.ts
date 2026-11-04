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
  AktivitasMkt, ClientMkt, EventMkt, FollowupMkt, KolomMkt, RequestDesainMkt, RoleAccMkt, SettingsMkt, UrutMkt, UserMkt, VipMkt,
} from '~/utils/marketing'
import {
  PER_HAL_MKT, SETTING_MKT_BAWAAN, TENGGANG_TUTUP_MKT, bolehAksiMkt, bolehBukaMkt, hariAntaraMkt, normRoleAccMkt, normUserMkt, urutAwalMkt, urutMkt,
} from '~/utils/marketing'
import { normEventMkt } from '~/utils/marketing-uang'
import { tglWIB } from '~/utils/event-hitung'
import type { PoBdMkt } from '~/utils/marketing-operasional'
import type { RiwayatKalkMkt } from '~/utils/marketing-kalk'
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

// ---------------------------------------------------------------- events-on (Breakdown Sumber Omset)

// Also read by Finance › Omset › Breakdown: the deal events, Assisted VIP
// rows and charge settings of one day (docs/api/marketing.md Read models).
// Shaped here, not in utils/marketing.ts, because only this call needs it.

/** One row of `GET /marketing/events-on/{date}` → `data.events`. Field names as the API sends them. */
export interface EventOnMkt {
  id: string
  nama: string
  tanggal: string
  status: string
  pax: number
  picId: string
  picName: string | null
  menuFix: string
  selesai: string
  hari: number
  totalHari: number
  detail: Record<string, unknown>
}

/** One row of `GET /marketing/events-on/{date}` → `data.vip`. Field names as the API sends them. */
export interface VipOnMkt {
  id: string
  nama: string
  perusahaan: string
  tanggal: string
  jam: string
  pax: number
  meja: unknown[]
  nominal: number
  picId: string
  picName: string | null
  menuFix: string
}

export interface EventsOnMkt {
  events: EventOnMkt[]
  vip: VipOnMkt[]
  settings: { serviceCharge: number, pb1: number } | null
}

/**
 * GET /marketing/events-on/{YYYY-MM-DD} — Deal/Event Done events that day
 * (multi-day events included, with `hari`/`totalHari`), plus Assisted VIP
 * rows, plus `settings{serviceCharge, pb1}`.
 */
export const getEventsOn = (date: string) =>
  useApi()<Envelope<EventsOnMkt>>(`/marketing/events-on/${date}`)

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
  vip: VipMkt[]
  designreqs: RequestDesainMkt[]
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
  useAsyncData('marketing-state', () => getStateMkt().then(r => normStateMkt(r.data)), { dedupe: 'defer', default: stateMktKosong })

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
 * Audit-trail write with retry: run `tulis` (a logMkt/logKonten POST), retry
 * in the background on failure (3 attempts, ~1s then ~3s backoff), toast ONCE
 * when it finally gives up. Never throws: true = stored, false = dropped
 * after retries (console.warned). Primary writes stay untouched — only the
 * compliance trail (who changed what, when) uses this, so an outage leaves
 * one visible warning instead of silent gaps.
 */
export async function logDenganCobaLagi(tulis: () => Promise<unknown>): Promise<boolean> {
  const TUNDA = [1000, 3000]
  for (let i = 0; i <= TUNDA.length; i++) {
    try {
      await tulis()
      return true
    }
    catch (e) {
      if (i === TUNDA.length) {
        tryUseNuxtApp()?.vueApp.runWithContext(() => useToast())?.add({
          title: 'Catatan aktivitas gagal tersimpan, akan dicoba lagi',
          color: 'warning',
        })
        console.warn('[audit] catatan aktivitas gagal tersimpan setelah 3x percobaan', e)
        return false
      }
      await new Promise(r => setTimeout(r, TUNDA[i]))
    }
  }
  return false
}

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
    // The write has landed: say so now, not after the (large) state reload.
    if (sukses) toast?.add({ title: sukses, color: 'success' })
    await Promise.all((jejak ? [jejak].flat() : []).map(j => logMkt(j.refType, j.refId ?? '-', j.action, j.detail).catch(() => {})))
    await muatUlang()
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

// ---------------------------------------------------------------- files

/** One uploaded file pointer (`POST /marketing/files` → `{key, name, url}`). */
export interface BerkasMkt { key: string, name: string, url?: string }

/** POST /marketing/files — images or PDF, ≤40 MB. The record stores {key, name}. */
export const unggahBerkasMkt = (body: { dataBase64: string, fileName: string, mimeType: string }) =>
  useApi()<Envelope<BerkasMkt>>('/marketing/files', { method: 'POST', body })

/** POST /marketing/files/chunks — ~2 MB per chunk; the last one returns {key, name}. */
export const unggahChunkMkt = (body: { uploadId: string, seq: number, last: boolean, dataBase64: string, mimeType: string, fileName: string }) =>
  useApi()<Envelope<BerkasMkt>>('/marketing/files/chunks', { method: 'POST', body })

/** GET /marketing/files/{key} — the file itself streams. */
export const urlBerkasMkt = (key: string) => {
  const { apiBase } = useRuntimeConfig().public as { apiBase: string }
  return `${apiBase.replace(/\/api\/v1\/?$/, '')}/api/v1/marketing/files/${encodeURIComponent(key)}`
}

/** Read a File into pure base64 (no data: prefix), like the old fileToBase64. */
export function berkasKeBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',').pop() ?? '')
    r.onerror = () => reject(new Error('read_failed'))
    r.readAsDataURL(f)
  })
}

/**
 * Upload in ~2 MB chunks (the old unggahBertahap for the 40 MB offer PDF).
 * Calls back with 0..1 progress.
 */
export async function unggahBertahapMkt(f: File, progress?: (v: number) => void): Promise<BerkasMkt> {
  const buf = new Uint8Array(await f.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]!)
  const b64 = btoa(bin)
  const POTONG = 2 * 1024 * 1024
  const uploadId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
  const n = Math.max(1, Math.ceil(b64.length / POTONG))
  let hasil: BerkasMkt = { key: '', name: f.name }
  for (let i = 0; i < n; i++) {
    const r = await unggahChunkMkt({
      uploadId, seq: i, last: i === n - 1,
      dataBase64: b64.slice(i * POTONG, (i + 1) * POTONG),
      mimeType: f.type || 'application/octet-stream', fileName: f.name,
    })
    if (r.data?.key) hasil = r.data
    progress?.((i + 1) / n)
  }
  return hasil
}

// ---------------------------------------------------------------- table locks (Reservasi module, read mostly)

/** The Reservasi row id that holds this event's locked tables (rsvUbahBaris). */
export const resIdKunciMkt = (evId: string) => `ev-${evId}`

/**
 * Release the lock row, fire-and-forget with one version retry (the old
 * rsvUbahBaris(resId, () => null), retry 6x on conflict). A missing row
 * (404) means the tables are already free. Anything else fails LOUDLY with
 * the table names + the manual path, because a silent failure double-books
 * the night (marketing.md F.8).
 */
export async function lepasKunciMejaMkt(evId: string): Promise<{ ok: boolean, pesan: string }> {
  const resId = resIdKunciMkt(evId)
  const api = useApi()
  try {
    const ada = await api<Envelope<{ updatedAt?: number }>>(`/reservasi/reservations/${encodeURIComponent(resId)}`).catch((e: unknown) => {
      if ((e as { statusCode?: number })?.statusCode === 404) return null
      throw e
    })
    if (!ada) return { ok: true, pesan: 'Tidak ada meja terkunci di modul Reservasi.' }
    await api(`/reservasi/reservations/${encodeURIComponent(resId)}`, { method: 'DELETE', headers: ifMatch((ada.data?.updatedAt ?? 0) as Versi) })
    return { ok: true, pesan: 'Meja bebas lagi di modul Reservasi.' }
  }
  catch (e) {
    return { ok: false, pesan: `Kunci meja (${resId}) gagal dilepas: ${apiErrorMessage(e)}. Hapus manual di modul Reservasi.` }
  }
}

/** PATCH /marketing/notifications/{id} — mark read, needs the row version. */
export const tandaiDibacaMkt = (id: string, versi?: Versi) =>
  useApi()<Envelope<unknown>>(`/marketing/notifications/${encodeURIComponent(id)}`, { method: 'PATCH', body: { read: true }, headers: versiHdr(versi) })

/**
 * The red count of the Marketing chrome: unread notifications, on the bell
 * (the old unread badge + popup, paintNotifPop).
 */
export function useLencanaMkt() {
  const { data } = useStateMkt()
  return computed(() => ({ lonceng: data.value.notifs.filter(n => !(n as { read?: boolean }).read).length }))
}

// ---------------------------------------------------------------- design requests (Konten side)

/**
 * GET /marketing/design-queue — progress written back by Konten, once per
 * page open (drSegarkanProgres). Without active=1: that flag drops the done
 * ones, which are exactly what this reads. G-16 (laksamana-api#190) opens it to
 * marketing|konten; if the API is unreachable the caller shows a ribbon +
 * "Coba lagi" and never blocks.
 */
export const progresDesainMkt = () =>
  useApi()<Envelope<{ reqs?: { id: string, status?: string, pic?: string, doneAt?: string }[] }>>('/marketing/design-queue')

/**
 * GET /marketing/design-requests/{id} — one request WITH its reference photos.
 * `/state` sends the photos as stubs (laksamana-api#341), so anything that
 * shows or edits them reads this first.
 */
export const ambilRequestDesainMkt = (id: string) =>
  useApi()<Envelope<{ req: RequestDesainMkt | null }>>(`/marketing/design-requests/${encodeURIComponent(id)}`)

export interface OpsiDesainMkt { brands: string[], pics: string[], platforms: string[] }

/**
 * Brand/PIC options for the Request Design form, from Konten's narrow picker
 * (G-16, laksamana-api#190) — brands + active crew only, production roles
 * first, open to marketing|konten. Konten down or empty → null, and the form
 * falls back to free text — there is always a way out (drOpsiField).
 */
export async function bacaOpsiDesainMkt(): Promise<OpsiDesainMkt | null> {
  try {
    const r = await useApi()<Envelope<{ brands?: { id: string, name: string }[], pics?: { id: string, name: string, roles?: string[] }[] }>>('/konten/design-options')
    const brands = (r.data?.brands ?? []).map(b => b.name).filter(Boolean)
    const pics = (r.data?.pics ?? []).map(u => u.name).filter(Boolean)
    if (!brands.length && !pics.length) return null
    return { brands, pics, platforms: [] }
  }
  catch {
    return null
  }
}

// ---------------------------------------------------------------- documents

/** GET /marketing/documents/{doc} — settings & friends (contract Documents). */
export const getDokumenMkt = (doc: string) =>
  useApi()<Envelope<unknown>>(`/marketing/documents/${encodeURIComponent(doc)}`)

/** PUT /marketing/documents/{doc} — whole value, needs the content hash. */
export const simpanDokumenMkt = (doc: string, value: unknown, versi?: Versi) =>
  useApi()<Envelope<unknown>>(`/marketing/documents/${encodeURIComponent(doc)}`, { method: 'PUT', body: value as Record<string, unknown>, headers: versiHdr(versi) })

/** The content-hash version of a document envelope. */
export const versiDokumenMkt = (r: Envelope<unknown>): Versi | undefined => {
  const v = (r.meta as Record<string, unknown> | undefined)?.version
  return (typeof v === 'string' || typeof v === 'number' ? v : undefined) as Versi | undefined
}

// ---------------------------------------------------------------- other modules (read-only)

/** One EMS event as the calendar needs it (muatEventEms, :12141-12175). */
export interface AcaraEmsMkt { id: string, tgl: string, nama: string, venue: string, kategori: string, status: string, pic: string }

/**
 * GET /event/events?from&to — the Event module's own events, drawn as a separate
 * read-only band. The list is open to `event` and `marketing` holders, so a
 * Marketing account without the Event module sees it too. `Planning` events are left out.
 * The day is the LOCAL date of start_datetime — the old client sliced the UTC
 * string, which put an event before 07:00 WIB on the previous day.
 */
export async function getAcaraEms(from: string, to: string): Promise<AcaraEmsMkt[]> {
  const r = await useApi()<Envelope<Record<string, unknown>[]>>('/event/events', { query: { from, to } })
  return (r.data ?? [])
    .filter(e => e && e.start_datetime && e.status !== 'Planning')
    .map((e) => {
      const tgl = tglWIB(e.start_datetime)
      return { id: String(e.id), tgl, nama: String(e.title || '(tanpa judul)'), venue: String(e.venue || ''), kategori: String(e.category || ''), status: String(e.status || ''), pic: String(e.pic || '') }
    })
}

// ---------------------------------------------------------------- documents: read-modify-write (#62)

/**
 * GET the document for its content hash, apply `ubah`, PUT it back under that
 * hash — the old save() wrote the whole list too, but blind. A 409 means
 * someone changed it in between; mktSimpan reloads and says so.
 */
export async function ubahDokumenMkt<T>(doc: 'fbFormats' | 'fbSubs' | 'katalog', ubah: (kini: T) => T): Promise<T> {
  const r = await getDokumenMkt(doc)
  const baru = ubah(r.data as T)
  await simpanDokumenMkt(doc, baru, versiDokumenMkt(r))
  return baru
}

// ---------------------------------------------------------------- authed images (#62)

const urlGambarMkt = new Map<string, Promise<string>>()

/**
 * A `/marketing/files/{key}` image as an object URL. The endpoint needs the
 * Bearer token, so a plain <img src> cannot load it. Cached per key for the
 * session (the katalog shows and preloads the same slides again and again).
 */
export function gambarBerkasMkt(key: string): Promise<string> {
  let p = urlGambarMkt.get(key)
  if (!p) {
    p = useApi()<Blob>(`/marketing/files/${encodeURIComponent(key)}`, { responseType: 'blob' }).then(b => URL.createObjectURL(b))
    p.catch(() => urlGambarMkt.delete(key))
    urlGambarMkt.set(key, p)
  }
  return p
}

/** File key from a stored urlBerkasMkt() URL (proof URLs are stored whole). */
export function kunciBerkasMkt(url: string): string {
  const u = String(url ?? '')
  return decodeURIComponent(u.split('/marketing/files/')[1] ?? u.split('/files/')[1] ?? '')
}

/**
 * Open a `/marketing/files/{key}` blob in a new tab. Direct links cannot
 * carry the Bearer token, so the browser alone always gets 401 — fetch
 * through useApi instead, like MarketingGambar does for images.
 */
export async function bukaBerkasMkt(key: string): Promise<boolean> {
  const toast = useToast()
  if (!key) return false
  try {
    const b = await useApi()<Blob>(`/marketing/files/${encodeURIComponent(key)}`, { responseType: 'blob' })
    window.open(URL.createObjectURL(b), '_blank', 'noopener')
    return true
  }
  catch (e) {
    toast.add({ title: `Berkas tidak bisa dibuka: ${apiErrorMessage(e)}`, color: 'error' })
    return false
  }
}

// ---------------------------------------------------------------- BD purchasing (#62)

/**
 * GET /bd/purchase-orders — the live BD board (the old page read getAll and
 * filtered). Needs module `bd` in v1; the old endpoint was open, so a
 * Marketing-only holder now gets 403 and the page says so instead of failing.
 */
export const daftarPoBdMkt = () => useApi()<Envelope<PoBdMkt[]>>('/bd/purchase-orders')

/** POST /bd/purchase-orders/batch — insert-only, like legacy addPo. → {added, ids}. */
export const kirimPoBdMkt = (items: Record<string, unknown>[]) =>
  useApi()<Envelope<{ added: number, ids: string[] }>>('/bd/purchase-orders/batch', { method: 'POST', body: { items } })

/** What `GET /kompas/performa/marketing` returns: the raw inputs of the bonus engine. */
export interface PerformaMkt {
  pic: { id: string | number, name: string, officeUserId?: string | number | null }[]
  days: { date: string, omsetHari?: number, bd?: Record<string, unknown> }[]
  comps: Record<string, unknown>[]
}

/**
 * GET /kompas/performa/marketing?from&to (old `performaDivisi`, divi
 * 'marketing', D.12). `omsetHari` is the day's tagihan — the denominator of
 * the "Kontribusi hari itu" column. Breakdown rows carry no `shift`.
 */
export const getPerformaMkt = (from: string, to: string) =>
  useApi()<Envelope<PerformaMkt>>('/kompas/performa/marketing', { query: { from, to } }).then(r => r.data)

/**
 * Read-modify-write one document under its content hash (Pengaturan, the role
 * matrix): GET for the fresh value + version, then PUT the changed whole. A
 * stale hash is a 409 that mktSimpan turns into "reload".
 */
export async function tulisDokumenMkt<T>(doc: string, ubah: (lama: T | null) => T) {
  // A document never saved answers 404: start from nothing, without a version.
  const r = await getDokumenMkt(doc).catch((e: { statusCode?: number }) => {
    if (e?.statusCode === 404) return null
    throw e
  })
  return simpanDokumenMkt(doc, ubah((r?.data ?? null) as T | null), r ? versiDokumenMkt(r) : undefined)
}

// ---------------------------------------------------------------- Menu Kalkulator history (G-09)

/** GET /marketing/documents/kalkHistori — the named calculator history (legacy `extra:kalkHistori`). */
export const getKalkHistoriMkt = () =>
  getDokumenMkt('kalkHistori')

/**
 * Read-modify-write the history under its own content hash: GET the fresh list,
 * apply `ubah`, PUT it back. A concurrent save is a 409 that `mktSimpan` turns
 * into "reload", so one calculation never wipes another (same guard as the
 * old per-row collections, marketing.md F.1).
 */
export async function ubahKalkHistoriMkt(ubah: (kini: RiwayatKalkMkt[]) => RiwayatKalkMkt[]) {
  return tulisDokumenMkt<RiwayatKalkMkt[]>('kalkHistori', (lama) => {
    const kini = Array.isArray(lama) ? lama.filter((x): x is RiwayatKalkMkt => !!x && typeof x.id === 'string') : []
    return ubah(kini)
  })
}
