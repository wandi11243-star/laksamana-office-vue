// POS cashier store: the shared server copy plus the offline queue.
// Contract: laksamana-api/docs/api/kompas.md "POS cashier app".
//
// Like the old POS (deploy/pos/index.html:406-414), localStorage stays as the
// copy and the queue: an order that is not uploaded yet carries _naik=false
// and is retried until the network returns, so the till never stops serving
// on dead wifi. A poll every 15s uploads the queue, then downloads. The
// server refuses a write whose `base` is stale, and the refused row is
// replaced by the server row — never overwritten.
//
// Storage keys are the old ones (lm_pos_v1, lm_pos_set_v1, lm_pos_user), so a
// device that ran the old POS keeps its queue and printer settings.
import type { Envelope } from '~/composables/useApi'
import { apiErrorMessage } from '~/composables/useApi'
import type { MenuPos, OrderPos, PrinterPos, SettingPos, UserPos } from '~/utils/pos'
import { MENU_BAWAAN_POS } from '~/utils/pos-menu'
import { PRINTER_BAWAAN_POS, TAHUN_POS } from '~/utils/pos'

const KEY_DB = 'lm_pos_v1'
const KEY_SET = 'lm_pos_set_v1'
const KEY_USER = 'lm_pos_user'
export const POLL_MS_POS = 15000

interface DaftarPos {
  orders: OrderPos[]
  setting: (SettingPos & { ts?: number }) | null
  ver: number
}

const bacaLokal = <T>(kunci: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(kunci) || 'null') as T | null
  }
  catch { return null }
}

const tulisLokal = (kunci: string, nilai: unknown): void => {
  try {
    localStorage.setItem(kunci, JSON.stringify(nilai))
  }
  catch {
    /* private mode: the till forgets after the tab closes */
  }
}

/** One menu row on screen: the HPP snapshot plus the origin it came from. */
export type MenuTampilPos = MenuPos & { asal: 'hpp' | 'pos' }

/** Full menu: HPP snapshot, server diffs on top, then POS-only extras. */
export const gabungMenuPos = (set: SettingPos | null): MenuTampilPos[] => [
  ...MENU_BAWAAN_POS.map(m => ({ ...m, ...(set?.menu?.[m.id] || {}), asal: 'hpp' as const })),
  ...(set?.menuBaru || []).map(m => ({ ...m, asal: 'pos' as const })),
].filter(m => m.aktif !== false && +m.harga > 0)

export const usePosDb = () => useState<OrderPos[]>('pos_orders', () => [])
export const usePosSetting = () => useState<SettingPos | null>('pos_setting', () => null)
export const usePosUser = () => useState<UserPos | null>('pos_user', () => null)
export const usePosSync = () => useState('pos_sync', () => ({ sedang: false, gagal: '', terakhir: 0, ver: -1 }))

const simpanDb = (orders: OrderPos[]): void => {
  usePosDb().value = orders
  tulisLokal(KEY_DB, { orders })
}

/** Stamp and queue one order for upload. */
export function antreOrderPos(o: OrderPos): OrderPos {
  o.updatedAt = Math.max(Date.now(), (o.updatedAt || 0) + 1)
  o._naik = false
  const db = usePosDb().value
  const i = db.findIndex(x => x.id === o.id)
  if (i >= 0) db[i] = o
  else db.push(o)
  simpanDb([...db])
  void sinkronPos()
  return o
}

async function kirimAntre(): Promise<void> {
  const api = useApi()
  for (const o of usePosDb().value.filter(x => x._naik === false)) {
    const { _naik: _a, _base: _b, ...kirim } = o
    const res = await api<Envelope<{ id: string, updatedAt: number }>>('/kompas/pos/orders', {
      method: 'POST', body: { order: kirim, base: o._base || 0 },
    })
    o._naik = true
    o.updatedAt = res.data.updatedAt
    o._base = res.data.updatedAt
    simpanDb([...usePosDb().value])
  }
}

async function kirimSetBersama(): Promise<void> {
  const set = usePosSetting().value
  if (!set) return
  const api = useApi()
  const res = await api<Envelope<{ ts: number }>>('/kompas/pos/setting', {
    method: 'PUT', body: { users: set.users, menu: set.menu, menuBaru: set.menuBaru, sc: set.sc, pb1: set.pb1 },
  })
  usePosSetting().value = { ...set, ts: res.data.ts }
  tulisLokal(KEY_SET, usePosSetting().value)
}

async function tarikServer(): Promise<boolean> {
  const api = useApi()
  const res = await api<Envelope<DaftarPos>>('/kompas/pos/orders', { query: { dari: `${TAHUN_POS}-01-01` } })
  const d = res.data
  const db = usePosDb().value
  let berubah = false
  const srv: Record<string, OrderPos> = {}
  for (const o of d.orders || []) srv[o.id] = o
  const hilang = new Set<string>()
  for (let i = 0; i < db.length; i++) {
    const o = db[i]!
    const so = srv[o.id]
    if (so) {
      if (o._naik !== false && (so.updatedAt || 0) !== (o._base || 0)) {
        db[i] = { ...so, _naik: true as const, _base: so.updatedAt }
        berubah = true
      }
      hilang.add(o.id)
    }
    else if (o._naik !== false && o._naik !== true) {
      o._naik = false // pre-sync transaction: joins the queue
    }
  }
  for (const id of Object.keys(srv)) {
    if (hilang.has(id)) continue
    const so = srv[id]!
    db.push({ ...so, _naik: true as const, _base: so.updatedAt })
    berubah = true
  }
  if (berubah || db.some(o => o._naik === false)) simpanDb([...db])
  const set = usePosSetting().value
  const ss = d.setting
  if (!ss) {
    // Empty server (fresh move): upload ours once.
    if (set && (set.users?.length || Object.keys(set.menu || {}).length || (set.menuBaru || []).length)) await kirimSetBersama()
  }
  else if ((ss.ts || 0) > (set?.ts || 0)) {
    const lokal = { ...(set || {}), printer: set?.printer || PRINTER_BAWAAN_POS }
    const gabung: SettingPos = {
      users: (ss.users?.length ? ss.users : lokal.users) || [],
      menu: ss.menu || {},
      menuBaru: ss.menuBaru || [],
      sc: Number(ss.sc ?? lokal.sc ?? 5),
      pb1: Number(ss.pb1 ?? lokal.pb1 ?? 10),
      ts: ss.ts,
      printer: lokal.printer,
    }
    usePosSetting().value = gabung
    tulisLokal(KEY_SET, gabung)
    berubah = true
  }
  usePosSync().value.ver = d.ver ?? -1
  return berubah
}

let timerPos: ReturnType<typeof setInterval> | null = null

/** Upload the queue, then download. Throws nothing: failure parks in sync.gagal.
 *  With `hanyaKirim`, the download half is skipped (the tick yields to typing). */
export async function sinkronPos(hanyaKirim = false): Promise<boolean> {
  const sync = usePosSync()
  if (sync.value.sedang) return false
  sync.value = { ...sync.value, sedang: true }
  let berubah = false
  try {
    const antre = usePosDb().value.filter(o => o._naik === false)
    if (antre.length) await kirimAntre()
    if (!hanyaKirim) berubah = await tarikServer()
    if (usePosDb().value.some(o => o._naik === false)) await kirimAntre()
    sync.value = { sedang: false, gagal: '', terakhir: Date.now(), ver: sync.value.ver }
  }
  catch (e) {
    const pesan = apiErrorMessage(e)
    // A refused order (409) is final, not a network problem: drop it from the
    // queue so one conflict does not block everything behind it.
    const konflik = (e as { data?: { error?: { details?: { server?: OrderPos } } } })?.data?.error?.details?.server
    if (konflik?.id) {
      const db = usePosDb().value.map(o => o.id === konflik.id ? { ...konflik, _naik: true as const, _base: konflik.updatedAt } : o)
      simpanDb(db)
      sync.value = { sedang: false, gagal: `Order ${konflik.id} sudah diubah di perangkat lain — versi terbaru dipakai.`, terakhir: Date.now(), ver: sync.value.ver }
    }
    else {
      sync.value = { sedang: false, gagal: pesan, terakhir: sync.value.terakhir, ver: sync.value.ver }
    }
  }
  return berubah
}

/** The 15s tick yields while the cashier is typing or the tab is hidden: the
 *  upload queue still goes out, only the download half is skipped. */
function pollMengalahPos(): boolean {
  if (document.visibilityState !== 'visible') return true
  const el = document.activeElement as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

/** Load local copies, pull once, and start the 15s poll. Call once per session. */
export function mulaiPos(): void {
  if (timerPos) return
  const db = bacaLokal<{ orders?: OrderPos[] }>(KEY_DB)
  if (db && Array.isArray(db.orders)) usePosDb().value = db.orders
  const set = bacaLokal<SettingPos>(KEY_SET)
  if (set && typeof set === 'object') {
    usePosSetting().value = {
      users: Array.isArray(set.users) && set.users.length ? set.users : [],
      menu: set.menu || {},
      menuBaru: Array.isArray(set.menuBaru) ? set.menuBaru : [],
      sc: Number(set.sc ?? 5),
      pb1: Number(set.pb1 ?? 10),
      ts: set.ts,
      printer: { ...PRINTER_BAWAAN_POS, ...(set.printer || {}) },
    }
  }
  const user = bacaLokal<UserPos>(KEY_USER)
  if (user && user.id) usePosUser().value = user
  void sinkronPos()
  timerPos = setInterval(() => {
    if (pollMengalahPos()) void sinkronPos(true)
    else void sinkronPos()
  }, POLL_MS_POS)
}

export const antreBelumNaik = (): number => usePosDb().value.filter(o => o._naik === false).length

/** Red badge on Open Order: open bills waiting on this device plus unuploaded ones. */
export function useLencanaPos() {
  return computed<Record<string, number>>(() => {
    const terbuka = usePosDb().value.filter(o => o.status === 'open' || o.status === 'draft').length
    return { terbuka }
  })
}

export function pilihUserPos(u: UserPos | null): void {
  usePosUser().value = u
  try {
    if (u) localStorage.setItem(KEY_USER, JSON.stringify(u))
    else localStorage.removeItem(KEY_USER)
  }
  catch { /* private mode */ }
}

/** POS-only printer settings: this computer's paper, never sent to the server. */
export function simpanPrinterPos(p: PrinterPos): void {
  const set = usePosSetting().value || { users: [], menu: {}, menuBaru: [], sc: 5, pb1: 10 }
  const gabung = { ...set, printer: { ...p } }
  usePosSetting().value = gabung
  tulisLokal(KEY_SET, gabung)
}

export const printerPos = (): PrinterPos => usePosSetting().value?.printer || { ...PRINTER_BAWAAN_POS }

/** GET /kompas/pos/backup — the whole POS state as a backup file. */
export const unduhCadanganPos = () => useApi()<Envelope<{ format: string, versi: number, dibuat: string, orders: OrderPos[], setting: SettingPos | null }>>('/kompas/pos/backup')

/** POST /kompas/pos/restore — add-only restore (existing ids are skipped). */
export const pulihkanCadanganPos = (orders: OrderPos[], setting: SettingPos | null) =>
  useApi()<Envelope<{ baru: number, ada: number, tolak: number, setting: boolean }>>('/kompas/pos/restore', { method: 'POST', body: { orders, setting } })
