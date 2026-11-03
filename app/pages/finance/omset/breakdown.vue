<!--
  Finance › Omset › Breakdown Sumber Omset (old `viewBreakdown`, deploy/finance/omset/index.html:3258-4160).

  Section A: omset per kasir (BRUTO − the bill discount they gave). Self Order
  never belongs to a cashier. Section B (marketing) DEDUCTS the cashier shift by
  the FULL amount column (porsi-pic.ts `potonganBarisKompas`, the Kompas twin of
  K-04); Section C (event) deducts nobody. Marketing/event do NOT add to the
  total — the cashiers alone must equal the day's net.

  The save gate is the old one: balance AND every marketing row with an amount
  has a shift. A row without a shift would leave the deduction uncharged, making
  the same money count twice (PIC recognition + full cashier revenue), and the
  difference only surfaces days later in Performa Kasir. PIC-less rows do NOT
  block, but are warned about: their money is recognised for nobody.

  AUTO-ABSORBED ROWS (breakdown-sumber.ts): deal events + Assisted VIP rows
  from GET /marketing/events-on/{date} and internal events from
  GET /event/events-on/{date}, tagged `srcId` (dedup + `abaikan`). The event
  value reuses the Marketing module's own `eventFinance`; VIP nominals split
  with the finance-specific `vipPecah`. Deleting a row only records its `srcId`
  in `abaikan` (bound on save); "Munculkan lagi" clears it in both places and
  saves at once. One module down never erases the other's rows; both down is
  the only error state. Without the `marketing`/`event` modules the endpoints
  answer 403 (G-23) and the screen falls back to manual rows.
  SYNC KE PERFORMA KASIR (VUE-6): the panel below freezes this day's per-cashier
  realisasi as `bdSync` (next to `bd`, kept by `{...d}` on save). From
  2026-10-01 Performa Kasir (Kas & Cashier) reads the freeze; the button is held
  while edits are unsaved, `bdValid` is not true, a marketing/event row is <= 0,
  or a shift is unset — re-checked on click, with a confirm naming the frozen
  per-cashier numbers.
-->
<script setup lang="ts">
import type { BarisBd, BarisHarian } from '~/utils/kompas'
import { kNum, netOf, taxSvcOf, tagihanOf } from '~/utils/kompas'
import type { PicKompas } from '~/utils/porsi-pic'
import { bagianPotong, obAktif, obTotal, potonganBarisKompas, potongKasirAktif } from '~/utils/porsi-pic'
import {
  cocokPic, namaSama, nilaiEventMkt, picAkun, sumberDari, sumberKosong, vipPecah,
  type SetelanSumber, type SumberHari,
} from '~/utils/breakdown-sumber'
import { getEventsOn } from '~/composables/useMarketing'
import { eventsOn } from '~/composables/useEvent'
import { sidikBd, snapKasir, syncKasirBerlaku, type BdSync } from '~/utils/sync-kasir'
import { fmtRp, jejakList, tambahJejak } from '~/utils/cashier'
import { getDay, getKompasState, putDay } from '~/composables/useCashier'
import { tanganiKonflik } from '~/utils/versi'
import { hariIni, tglLabel, tglPanjang } from '~/utils/format'

definePageMeta({ access: ['kompas'] })

const me = useMe()
const toast = useToast()
const route = useRoute()
const tanggal = ref(typeof route.query.tgl === 'string' && route.query.tgl ? route.query.tgl : hariIni())

const { data, status, error, refresh } = useAsyncData(
  'omset-breakdown',
  async () => {
    const [day, state] = await Promise.all([getDay(tanggal.value), getKompasState()])
    return { day, state }
  },
  { watch: [tanggal] },
)

// Without ?tgl the old screen opens the LAST day already entered this month
// (`bdDate = days[days.length-1].date`, deploy/finance/omset/index.html:3299),
// not today — today usually has no omset yet when Breakdown is opened.
let tglAwalDipilih = !!route.query.tgl
if (!tglAwalDipilih) {
  watch(data, (d) => {
    if (!d || tglAwalDipilih) return
    tglAwalDipilih = true
    const bulan = hariIni().slice(0, 7)
    const hari = (d.state.value.daily ?? []).map(r => r.date).filter(t => t?.startsWith(bulan)).sort()
    const akhir = hari[hari.length - 1]
    if (akhir && akhir !== tanggal.value) tanggal.value = akhir
  }, { immediate: true })
}

const rows = computed(() => data.value?.day.value.rows ?? [])
const rec = computed<BarisHarian | null>(() => rows.value.find(r => r.date === tanggal.value) ?? null)
const net = computed(() => (rec.value ? netOf(rec.value) : 0))
const employees = computed(() => data.value?.state.value.employees ?? {})
const kasirList = computed<PicKompas[]>(() => employees.value.kasir ?? [])
const mkList = computed<PicKompas[]>(() => employees.value.marketing ?? [])
const evList = computed<PicKompas[]>(() => employees.value.event ?? [])

const mk = ref<BarisBd[]>([])
const ev = ref<BarisBd[]>([])
const ks = ref<BarisBd[]>([])
const so = ref<{ amount: number | string, disc: number | string }>({ amount: 0, disc: 0 })
// The absorbed day (EVHARI). Declared before the watcher below: the watcher
// runs immediately and both absorbs and fetches through it.
const sumber = ref<SumberHari>(sumberKosong())

function barisBaru(): BarisBd {
  return { amount: 0, disc: 0, off: false, shift: [], menuFix: '', payGroup: true, ob: false, obAmount: 0, obTax: 0, obService: 0, obKasirId: '', eventName: '', picId: '', tax: 0, service: 0 }
}
function isiDariServer() {
  const d = rec.value
  const bd = (d?.bd ?? {}) as { marketing?: BarisBd[], event?: BarisBd[], kasir?: BarisBd[], self?: { amount?: unknown, disc?: unknown } }
  mk.value = (bd.marketing ?? []).map(r => ({ ...r }))
  ev.value = (bd.event ?? []).map(r => ({ ...r }))
  so.value = { amount: kNum(bd.self?.amount), disc: kNum(bd.self?.disc) }
  const lama: BarisBd[] = bd.kasir ?? []
  ks.value = kasirList.value.map((k) => {
    const ex = lama.find(r => r.kasirId === k.id)
    return ex ? { ...ex } : { kasirId: k.id, amount: 0, disc: 0, off: false }
  })
  // Baris marketing yang shift-nya memuat kasir OFF dirapikan di layar saja;
  // perubahannya baru mengikat kalau disimpan (legacy :3340-3343).
  for (const r of ks.value) if (r.off) buangDariShift(String(r.kasirId))
}
watch([rec, kasirList], () => {
  isiDariServer()
  serapOtomatis()
  if (rec.value && sumber.value.tgl !== tanggal.value) muatSumber()
}, { immediate: true })
watch(tanggal, () => {
  abaikanSementara.value = []
  if (rec.value && rec.value.date === tanggal.value) muatSumber()
  else if (!rec.value) sumber.value = sumberKosong()
})

function buangDariShift(id: string) {
  for (const r of [...mk.value, ...ev.value]) {
    if (Array.isArray(r.shift)) r.shift = r.shift.filter(x => x !== id)
  }
}
function set(r: BarisBd, k: string, v: unknown) {
  r[k] = v
}
function ubahOff(r: BarisBd, off: boolean) {
  r.off = off
  if (off) buangDariShift(String(r.kasirId))
}
function tambahMk() {
  mk.value.push(barisBaru())
}
function tambahEv() {
  ev.value.push(barisBaru())
}
function hapusMk(i: number) {
  const r = mk.value[i]
  if (r?.srcId) abaikanSementara.value.push(String(r.srcId))
  mk.value.splice(i, 1)
}
function hapusEv(i: number) {
  const r = ev.value[i]
  if (r?.srcId) abaikanSementara.value.push(String(r.srcId))
  ev.value.splice(i, 1)
}
const abaikanSementara = ref<string[]>([])
function isiSisa(i: number) {
  const r = ks.value[i]
  if (!r || r.off) return
  const cur = kNum(r.amount) - kNum(r.disc)
  r.amount = Math.max(0, net.value - (sumDiakui.value - cur)) + kNum(r.disc)
}

const sumKasir = computed(() => ks.value.reduce((s, r) => s + (r.off ? 0 : kNum(r.amount) - kNum(r.disc)), 0))
const selfOmset = computed(() => kNum(so.value.amount) - kNum(so.value.disc))
const sumDiakui = computed(() => sumKasir.value + selfOmset.value)
const diff = computed(() => net.value - sumDiakui.value)
const balance = computed(() => Math.abs(diff.value) < 1)
const belum = computed(() => mk.value.filter(r => potongKasirAktif(r) && kNum(r.amount) > 0 && potonganBarisKompas(r).pembagi <= 0))
const ok = computed(() => balance.value && belum.value.length === 0)
const dHari = computed(() => kNum(rec.value?.discount))
const dTot = computed(() => ks.value.reduce((s, r) => s + (r.off ? 0 : kNum(r.disc)), 0) + kNum(so.value.disc))
const dSel = computed(() => dHari.value - dTot.value)
const lebihan = computed(() => {
  const l = ks.value.filter(r => !r.off && kNum(r.disc) > kNum(r.amount))
  if (kNum(so.value.disc) > kNum(so.value.amount)) l.push({ kasirId: '', self: true } as BarisBd)
  return l
})
const tanpaPic = computed(() => [
  ...mk.value.filter(r => !mkList.value.some(e => e.id === r.picId)).map(r => ({ r, divi: 'Marketing' })),
  ...ev.value.filter(r => !evList.value.some(e => e.id === r.picId)).map(r => ({ r, divi: 'Event' })),
])
const nilaiTanpaPic = computed(() => tanpaPic.value.reduce((s, x) => s + kNum(x.r.amount), 0))
const potongUntuk = (id: string) => mk.value.reduce((s, r) => s + bagianPotong(potonganBarisKompas(r), id), 0)
const obUntuk = (id: string) => [...mk.value, ...ev.value]
  .filter(r => obAktif(r) && String(r.obKasirId || '') === id)
  .reduce((s, r) => s + obTotal(r), 0)
const efek = computed(() => ks.value.filter(r => !r.off).map((r) => {
  const id = String(r.kasirId)
  const bruto = kNum(r.amount)
  const disc = kNum(r.disc)
  const potong = potongUntuk(id)
  return { id, nama: kasirList.value.find(k => k.id === id)?.name ?? '—', bruto, disc, potong, real: bruto - disc - potong, ob: obUntuk(id) }
}))
/** Totals row of the effect table, Self Order included (old "TOTAL"). */
const efekTotal = computed(() => {
  const sb = kNum(so.value.amount)
  const sd = kNum(so.value.disc)
  return efek.value.reduce((t, e) => ({ bruto: t.bruto + e.bruto, disc: t.disc + e.disc, potong: t.potong + e.potong, real: t.real + e.real, ob: t.ob + e.ob }),
    { bruto: sb, disc: sd, potong: 0, real: sb - sd, ob: 0 })
})
const compHari = computed(() => (data.value?.state.value.compliments ?? [])
  .filter(c => c.date === tanggal.value && c.picDiv !== 'tamu'))

const jejak = computed(() => jejakList(rec.value))

const shiftOpen = ref(false)
const shiftRow = ref<BarisBd | null>(null)
/** "Bagi rata" splits evenly; "Atur nominal" stores exact rupiah per cashier (`r.shiftNom`). */
const shiftMode = ref<'rata' | 'nominal'>('rata')
/** Rupiah drafts per checked cashier, as typed (parsed with `kNum` on save). */
const shiftNom = ref<Record<string, string>>({})
const namaKasir = (id: string) => kasirList.value.find(k => k.id === id)?.name ?? id
function shiftIds(): string[] {
  const r = shiftRow.value
  return r && Array.isArray(r.shift) ? (r.shift as string[]).filter(Boolean) : []
}
/** Fill drafts missing a value with the even share — manual starts from equal, never from blank. */
function isiNomDariRata() {
  const r = shiftRow.value
  if (!r) return
  const ids = shiftIds()
  const total = potonganBarisKompas(r).total
  const rata = ids.length ? Math.round(total / ids.length) : 0
  const draf: Record<string, string> = {}
  for (const id of ids) draf[id] = shiftNom.value[id] ?? String(rata)
  shiftNom.value = draf
}
function bukaShift(r: BarisBd) {
  if (!Array.isArray(r.shift)) r.shift = []
  shiftRow.value = r
  const b = potonganBarisKompas(r)
  if (b.manual) {
    shiftMode.value = 'nominal'
    shiftNom.value = Object.fromEntries(shiftIds().map(id => [id, String(b.nom[id] ?? 0)]))
  }
  else {
    shiftMode.value = 'rata'
    shiftNom.value = {}
    isiNomDariRata()
  }
  shiftOpen.value = true
}
watch(shiftMode, (m) => {
  if (m === 'nominal') isiNomDariRata()
})
function toggleShift(id: string) {
  const r = shiftRow.value
  if (!r) return
  const s = Array.isArray(r.shift) ? r.shift.slice() : []
  const i = s.indexOf(id)
  if (i >= 0) s.splice(i, 1)
  else s.push(id)
  r.shift = s
  if (shiftMode.value === 'nominal') isiNomDariRata()
}
/** The row's deductible total and the drafts' sum — Save stays held until they match. */
const shiftTotal = computed(() => (shiftRow.value ? potonganBarisKompas(shiftRow.value).total : 0))
const shiftNomJumlah = computed(() => shiftIds().reduce((s, id) => s + kNum(shiftNom.value[id]), 0))
const shiftNomPas = computed(() => shiftIds().length > 0 && shiftTotal.value > 0 && shiftNomJumlah.value === shiftTotal.value)
const shiftManualTersimpan = (r: BarisBd) => potonganBarisKompas(r).manual
function simpanShift() {
  const r = shiftRow.value
  if (!r) {
    shiftOpen.value = false
    return
  }
  if (shiftMode.value === 'nominal') {
    if (!shiftNomPas.value) return
    const isi: Record<string, number> = {}
    for (const id of shiftIds()) isi[id] = kNum(shiftNom.value[id])
    r.shiftNom = isi
  }
  else if ('shiftNom' in r) {
    // Back to even split throws the manual map away — stale nominals must
    // never linger where the screen reads "bagi rata".
    delete r.shiftNom
  }
  shiftOpen.value = false
}

const simpanOpen = ref(false)
const menyimpan = ref(false)
async function jalanSimpan() {
  const d = rec.value
  if (!d || !data.value || menyimpan.value) return
  menyimpan.value = true
  const bd = {
    ...(d.bd ?? {}),
    marketing: mk.value,
    event: ev.value,
    kasir: ks.value,
    self: { amount: kNum(so.value.amount), disc: kNum(so.value.disc) },
    abaikan: [...new Set([...(((d.bd ?? {}) as { abaikan?: string[] }).abaikan ?? []), ...abaikanSementara.value])],
  }
  const baru: BarisHarian = { ...d, bd, bdValid: true, bdLog: tambahJejak({ log: d.bdLog }, me.value?.name ?? '') }
  const rowsBaru = [...rows.value.filter(r => r.date !== tanggal.value), baru]
  try {
    data.value.day = await putDay(tanggal.value, rowsBaru, data.value.day.version)
    // B2: real API 200 but the screen only updates after reload — re-read
    // (same finding as fix/api-cashier for the Kompas panels).
    await refresh()
    simpanOpen.value = false
    toast.add({ title: `Breakdown ${tglPanjang(tanggal.value)} tersimpan.`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}

const labelKasirShift = (r: BarisBd) => {
  const s = Array.isArray(r.shift) ? r.shift.filter(Boolean) as string[] : []
  return s.length ? s.map(namaKasir).join(', ') : '— belum dipilih —'
}

// ---- Sync ke Performa Kasir (8 Okt 2026, commit Office lama 5731a23/1ca25f7) ----
// The freeze (`bdSync`) lives NEXT TO `bd` on the day row; the breakdown save
// above keeps it via `{...d}`. Performa Kasir (Kas & Cashier) reads the freeze
// for days >= SYNC_KASIR_MULAI instead of computing live.

/** The edited breakdown in exactly the shape `jalanSimpan` stores. */
const bdForm = computed(() => {
  const d = rec.value
  return {
    ...(d?.bd ?? {}),
    marketing: mk.value,
    event: ev.value,
    kasir: ks.value,
    self: { amount: kNum(so.value.amount), disc: kNum(so.value.disc) },
    abaikan: [...new Set([...(((d?.bd ?? {}) as { abaikan?: string[] }).abaikan ?? []), ...abaikanSementara.value])],
  }
})
/** Unsaved edits: the form no longer matches what the server holds. A stale
 * mismatch only forces a save first (the safe direction); a real edit can
 * never read as clean, so sync always freezes what was actually saved. */
const kotor = computed(() => JSON.stringify(bdForm.value) !== JSON.stringify(rec.value?.bd ?? {}))

const berlakuSync = computed(() => syncKasirBerlaku(tanggal.value))
const bdSync = computed(() => {
  const s = rec.value?.bdSync as BdSync | null | undefined
  return s && typeof s === 'object' && Array.isArray(s.kasir) ? s : null
})
const sidikKini = computed(() => sidikBd(rec.value?.bd))
const syncStatus = computed<'belum' | 'sudah' | 'berubah'>(() => {
  if (!bdSync.value) return 'belum'
  return bdSync.value.sidik === sidikKini.value ? 'sudah' : 'berubah'
})
const namaBarisSync = (r: BarisBd, list: PicKompas[]) =>
  String(r.eventName || list.find(e => e.id === r.picId)?.name || '(tanpa nama)')
/**
 * Why the Sync button is held (`syncAlasan`, omset :4100-4110). Every reason
 * is named; re-checked on click because `disabled` is bypassable. `belum`
 * (the save gate) doubles as the shift gate: its `pembagi` is shift-based,
 * identical to legacy `barisTanpaShift`.
 */
function alasanSync(): string[] {
  const out: string[] = []
  if (kotor.value) out.push('Ada isian yang belum disimpan — simpan breakdown dulu, baru sync.')
  if (rec.value?.bdValid !== true) out.push('Breakdown belum valid — simpan dulu sampai berstatus valid.')
  for (const r of mk.value) {
    if (kNum(r.amount) <= 0) out.push(`Baris marketing "${namaBarisSync(r, mkList.value)}" bernominal ${fmtRp(kNum(r.amount))} — betulkan dulu.`)
  }
  for (const r of ev.value) {
    if (kNum(r.amount) <= 0) out.push(`Baris event "${namaBarisSync(r, evList.value)}" bernominal ${fmtRp(kNum(r.amount))} — betulkan dulu.`)
  }
  if (belum.value.length) {
    out.push(`${belum.value.length} baris marketing belum ditentukan kasir shift-nya (${belum.value.map(r => namaBarisSync(r, mkList.value)).join(', ')}).`)
  }
  return out
}
const alasanTampil = computed(() => (berlakuSync.value ? alasanSync() : []))

const syncing = ref(false)
async function jalanSync() {
  const d = rec.value
  if (!d || !data.value || syncing.value) return
  if (!syncKasirBerlaku(tanggal.value)) return
  const alasan = alasanSync()
  if (alasan.length) {
    toast.add({ title: 'Belum bisa di-sync', description: alasan.join(' '), color: 'warning' })
    return
  }
  // Frozen from the SAVED breakdown (unsaved edits are blocked above), so the
  // fingerprint below always matches what Performa will read back.
  const beku = snapKasir(d.bd)
  const baris = beku.map(b => `• ${namaKasir(b.kasirId)}: ${fmtRp(b.real)}${b.potong ? ` (potongan ${fmtRp(b.potong)})` : ''}${b.off ? ' — OFF' : ''}`).join('\n')
  if (!confirm(`Sync ke Performa Kasir — ${tglPanjang(tanggal.value)}?\n\nAngka per kasir yang dibekukan:\n${baris}\n\nSesudah sync, Performa Kasir (Kas & Cashier) memakai angka ini sampai Sync ulang.`)) return
  syncing.value = true
  try {
    const sync: BdSync = { at: Date.now(), by: me.value?.name ?? '', sidik: sidikBd(d.bd), kasir: beku }
    const baru: BarisHarian = { ...d, bdSync: sync }
    const rowsBaru = [...rows.value.filter(r => r.date !== tanggal.value), baru]
    data.value.day = await putDay(tanggal.value, rowsBaru, data.value.day.version)
    await refresh()
    toast.add({ title: `Performa kasir ${tglPanjang(tanggal.value)} di-sync.`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    syncing.value = false
  }
}

// Reka UI's SelectItem refuses an EMPTY value, so "not chosen yet" travels as a
// sentinel and is mapped back to '' on write. The stored value stays '' — the
// missing PIC is a real state, never the first name in the list (:3345-3360).
const KOSONG = '__kosong'
const opsiPic = (list: PicKompas[]) => [{ label: '— pilih PIC —', value: KOSONG }, ...list.map(e => ({ label: e.name, value: e.id }))]
const pilihPic = (r: BarisBd, v: string) => set(r, 'picId', v === KOSONG ? '' : v)
const opsiMenu = [
  { label: '— belum ditentukan —', value: KOSONG },
  { label: 'Menu ditetapkan (kasir dipotong)', value: 'tetap' },
  { label: 'Menu dipilih di tempat (tidak memotong)', value: 'ditempat' },
]
const pilihMenu = (r: BarisBd, v: string) => set(r, 'menuFix', v === KOSONG ? '' : v)
const opsiKasir = (list: PicKompas[]) => [{ label: '— pilih kasir —', value: KOSONG }, ...list.map(e => ({ label: e.name, value: e.id }))]
const pilihKasirOb = (r: BarisBd, v: string) => set(r, 'obKasirId', v === KOSONG ? '' : v)

// ---- Baris otomatis dari modul Marketing & Event (EVHARI, omset :3108-3155)
// Deal events, Assisted VIP reservations and internal events are absorbed as
// rows tagged `srcId` ("mkt:<id>" / "vip:<id>" / "evt:<id>"): the tag dedups
// re-renders and links the row to `abaikan` when it is thrown away. One
// module down never erases the other's rows (allSettled, like the old
// screen); both down is the only error state.
async function muatSumber() {
  const t = tanggal.value
  if (sumber.value.tgl === t && (sumber.value.st === 'muat' || sumber.value.st === 'ok')) return
  sumber.value = { ...sumberKosong(t), st: 'muat' }
  const [m, e] = await Promise.allSettled([getEventsOn(t), eventsOn(t)])
  if (tanggal.value !== t) return // the user moved on meanwhile
  const s = sumber.value
  const gagal: string[] = []
  if (m.status === 'fulfilled') {
    const d = m.value.data
    s.mk = Array.isArray(d.events) ? d.events : []
    // `vip` only exists since 11 Aug 2026; an older backend answers without
    // the key, and that is not an error — just no VIP rows.
    s.vp = Array.isArray(d.vip) ? d.vip : []
    s.set = (d.settings ?? null) as SetelanSumber | null
  }
  else { gagal.push(`marketing (${apiErrorMessage(m.reason)})`) }
  if (e.status === 'fulfilled') {
    const d = e.value.data
    s.ev = Array.isArray(d) ? d : []
  }
  else { gagal.push(`event (${apiErrorMessage(e.reason)})`) }
  s.galat = gagal.join(' · ')
  s.st = gagal.length === 2 ? 'galat' : 'ok'
  serapOtomatis()
}

/** The filler on duty, matched into the division roster (old `picPengisi`, omset :3459-3461). */
function picPengisi(list: PicKompas[]): string | null {
  const aku = me.value
  if (!aku) return null
  return picAkun(list, aku.id, aku.name)
}

function serapOtomatis(): boolean {
  const s = sumber.value
  if (s.tgl !== tanggal.value || s.st !== 'ok' || !rec.value) return false
  const abai = new Set([...(((rec.value.bd ?? {}) as { abaikan?: string[] }).abaikan ?? []), ...abaikanSementara.value])
  let berubah = false
  const sudahAda = (key: string) => [...mk.value, ...ev.value].some(r => r.srcId === key)
  // The source's menu decision is refreshed on every open, not just at birth:
  // rows absorbed earlier would otherwise keep an empty menuFix forever.
  const menuSumber: Record<string, string> = {}
  for (const a of s.mk) menuSumber[`mkt:${a.id}`] = String(a.menuFix ?? '')
  for (const v of s.vp) menuSumber[`vip:${v.id}`] = String(v.menuFix ?? '')
  for (const r of [...mk.value, ...ev.value]) {
    const k = String(r.srcId ?? '')
    if (!k || !(k in menuSumber)) continue
    if (String(r.menuFix ?? '') !== menuSumber[k]) {
      r.menuFix = menuSumber[k]
      berubah = true
    }
  }
  // The Marketing event kind (Wedding / Corporate / …) decides the corporate
  // bonus scheme, and is refreshed for the same reason. VIP rows are left out
  // on purpose: they are never corporate events.
  const jenisSumber: Record<string, string> = {}
  for (const a of s.mk) jenisSumber[`mkt:${a.id}`] = String(a.detail?.jenis ?? '')
  for (const r of mk.value) {
    const k = String(r.srcId ?? '')
    if (!k || !(k in jenisSumber)) continue
    if (String(r.srcJenis ?? '') !== jenisSumber[k]) {
      r.srcJenis = jenisSumber[k]
      berubah = true
    }
  }
  for (const a of s.mk) {
    const key = `mkt:${a.id}`
    if (abai.has(key) || sudahAda(key)) continue
    const f = nilaiEventMkt(a, s.set)
    mk.value.push({
      picId: cocokPic(mkList.value, a.picName) || picPengisi(mkList.value) || undefined,
      eventName: a.nama ?? '', amount: 0, tax: 0, service: 0, shift: [],
      menuFix: String(a.menuFix ?? ''),
      srcId: key, srcPic: a.picName ?? '', srcNominal: f.grand,
      srcJenis: String(a.detail?.jenis ?? ''),
      // A multi-day event appears on EVERY day as day n of N; without the
      // note two identical rows on two dates read as a double input.
      srcHari: a.hari || 1, srcHariTotal: a.totalHari || 1,
      srcOmset: f.omset, srcTax: f.tax, srcService: f.service,
    })
    berubah = true
  }
  for (const v of s.vp) {
    const key = `vip:${v.id}`
    if (abai.has(key) || sudahAda(key)) continue
    const p = vipPecah(v.nominal, s.set)
    const pt = v.perusahaan ? ` (${v.perusahaan})` : ''
    mk.value.push({
      picId: cocokPic(mkList.value, v.picName) || picPengisi(mkList.value) || undefined,
      eventName: `VIP — ${v.nama || '(tanpa nama)'}${pt}`, amount: 0, tax: 0, service: 0, shift: [],
      menuFix: String(v.menuFix ?? ''),
      srcId: key, srcPic: v.picName ?? '', srcNominal: kNum(v.nominal),
      srcOmset: p.omset, srcTax: p.tax, srcService: p.service,
    })
    berubah = true
  }
  for (const t of s.ev) {
    const key = `evt:${t.id}`
    if (abai.has(key) || sudahAda(key)) continue
    // The Event module keeps no rupiah: only the name & PIC are absorbed.
    // Order matters: the typed PIC first, then the input account (the PIC
    // column holds a title like "Event Manager"), then the filler — all
    // clamped to the event roster, never guessed.
    ev.value.push({
      picId: cocokPic(evList.value, t.picName)
        || picAkun(evList.value, t.inputOlehId, t.inputOleh)
        || picPengisi(evList.value) || undefined,
      eventName: t.nama ?? '', amount: 0, shift: [],
      srcId: key, srcPic: t.picName ?? '', srcInput: t.inputOleh ?? '',
    })
    berubah = true
  }
  return berubah
}

/** Fill Omset/Tax/Service from the source's own numbers (the "salin ke kolom" button). */
function salinSumber(r: BarisBd) {
  r.amount = kNum(r.srcOmset)
  r.tax = kNum(r.srcTax)
  r.service = kNum(r.srcService)
}

/**
 * Why a row is recognised for someone else than the source named (old
 * `bedaPic`, omset :3784-3786): the source named a title or an outsider, and
 * the fallback was the event's input account or the filler.
 */
function bedaPic(r: BarisBd, divi: 'marketing' | 'event'): string {
  const list = divi === 'event' ? evList.value : mkList.value
  const terpilih = list.find(e => e.id === r.picId)
  if (!terpilih || namaSama(r.srcPic, terpilih.name)) return ''
  const lewatInput = divi === 'event' && namaSama(r.srcInput, terpilih.name)
  return `${terpilih.name} — ${lewatInput ? 'yang input di Event' : 'yang mengisi'}`
}

// ---- The source ribbon (old `pitaSumber`, omset :3591-3645) ----
const nSumber = computed(() => sumber.value.mk.length + sumber.value.vp.length + sumber.value.ev.length)
const rinciSumber = computed(() => [
  sumber.value.mk.length ? `${sumber.value.mk.length} event Marketing` : '',
  sumber.value.vp.length ? `${sumber.value.vp.length} Reservasi VIP` : '',
  sumber.value.ev.length ? `${sumber.value.ev.length} event Event` : '',
].filter(Boolean).join(' + '))
/** Absorbed rows actually on screen — not the find count (old :3620-3625). */
const tampilSumber = computed(() => [...mk.value, ...ev.value].filter(r => r.srcId).length)
const tersimpanBuang = computed(() => (((rec.value?.bd ?? {}) as { abaikan?: string[] }).abaikan ?? []).length)
const buangSementara = computed(() => {
  const simpan = new Set((((rec.value?.bd ?? {}) as { abaikan?: string[] }).abaikan ?? []))
  return abaikanSementara.value.filter(k => !simpan.has(k)).length
})
const galatSebagian = computed(() => (sumber.value.galat ? ` (${sumber.value.galat} tidak terbaca)` : ''))

const memulihkan = ref(false)
/** Empty `abaikan` in both places and save at once (old `bd_pulih`, omset :3633-3644). */
async function pulihkanSumber() {
  const d = rec.value
  if (!d || !data.value || memulihkan.value) return
  memulihkan.value = true
  try {
    abaikanSementara.value = []
    const bd = { ...bdForm.value, abaikan: [] as string[] }
    const baru: BarisHarian = { ...d, bd }
    const rowsBaru = [...rows.value.filter(r => r.date !== tanggal.value), baru]
    data.value.day = await putDay(tanggal.value, rowsBaru, data.value.day.version)
    await refresh()
    serapOtomatis()
    toast.add({ title: 'Baris yang pernah dibuang dimunculkan lagi.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    memulihkan.value = false
  }
}
</script>

<template>
  <AppPage
    title="Breakdown sumber omset"
    description="Isi omset per kasir, lalu potong untuk event marketing, Reservasi VIP & event internal."
  >
    <template #actions>
      <UInput
        v-model="tanggal"
        type="date"
        size="sm"
        class="w-40"
      />
      <UButton
        label="Ke input omset"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="outline"
        size="sm"
        :to="`/finance/omset/input?tgl=${tanggal}`"
      />
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
    />

    <AppPanel v-if="status === 'pending' && !rec">
      <!-- Loading rows mirror the breakdown below. -->
      <div class="space-y-2">
        <USkeleton class="h-20 rounded-xl" />
        <USkeleton
          v-for="i in 5"
          :key="i"
          class="h-10 w-full"
        />
        <p class="pt-1 text-center text-sm text-muted">
          Memuat…
        </p>
      </div>
    </AppPanel>

    <AppPanel v-else-if="!rec">
      <p class="py-4 text-center text-sm text-muted">
        Belum ada omset untuk <b>{{ tglPanjang(tanggal) }}</b>.<br>
        Input omsetnya dulu di menu <ULink
          :to="`/finance/omset/input?tgl=${tanggal}`"
          class="font-semibold text-primary-700"
        >Input Omset Harian</ULink>, atau pilih tanggal lain di atas.
      </p>
    </AppPanel>

    <template v-else-if="rec">
      <AppPanel
        :description="`Total omset net ${fmtRp(net)}${kNum(rec.discount) > 0 ? ` (sesudah diskon ${fmtRp(kNum(rec.discount))})` : ''}. Service charge + tax ${fmtRp(taxSvcOf(rec))} tidak masuk breakdown. Tagihan hari itu ${fmtRp(tagihanOf(rec))}.`"
      >
        <UAlert
          v-if="compHari.length"
          color="warning"
          variant="subtle"
          icon="i-lucide-gift"
          :title="`Ada ${compHari.length} compliment hari ini yang membebani PIC, total ${fmtRp(compHari.reduce((s, c) => s + kNum(c.subTotal ?? c.nominal), 0))} menurut Sub Total-nya.`"
          description="Angka ini memotong realisasi PIC bersangkutan di Performa & Ranking — alokasi breakdown di bawah tidak perlu dikurangi sendiri."
        />
        <UAlert
          v-if="sumber.st === 'muat' || sumber.tgl !== tanggal"
          color="info"
          variant="subtle"
          icon="i-lucide-loader-circle"
          :title="`Mengambil event & Reservasi VIP ${tglLabel(tanggal)} dari modul Marketing & Event…`"
          class="mt-2"
        />
        <UAlert
          v-else-if="sumber.st === 'galat'"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`Daftar otomatis tidak bisa diambil (${sumber.galat}). Breakdown tetap bisa diisi seperti biasa — tambahkan barisnya manual.`"
          class="mt-2"
        />
        <template v-else-if="sumber.st === 'ok'">
          <UAlert
            v-if="nSumber"
            :color="tampilSumber ? 'success' : 'warning'"
            variant="subtle"
            :icon="tampilSumber ? 'i-lucide-check' : 'i-lucide-triangle-alert'"
            :title="tampilSumber
              ? `${tampilSumber} dari ${nSumber} sumber untuk ${tglLabel(tanggal)} (${rinciSumber}) sudah dibuatkan barisnya di bawah — tinggal diisi nominalnya.`
              : `${nSumber} sumber ditemukan untuk ${tglLabel(tanggal)} (${rinciSumber}), tapi tidak ada satu pun yang dipasang karena semuanya pernah dibuang.`"
            :description="`${galatSebagian}${tersimpanBuang ? ` · ${tersimpanBuang} baris pernah dibuang.` : ''}${buangSementara ? ` · ${buangSementara} baris baru dibuang di layar ini — belum tersimpan, akan muncul lagi kalau halaman ditutup sebelum Simpan Breakdown.` : ''}` || undefined"
            class="mt-2"
          />
          <UAlert
            v-else
            color="info"
            variant="subtle"
            icon="i-lucide-info"
            :title="`Tidak ada event berstatus Deal/Upcoming maupun Reservasi VIP Assisted di modul Marketing & Event untuk ${tglLabel(tanggal)}.${galatSebagian}${tersimpanBuang ? ` · ${tersimpanBuang} baris pernah dibuang.` : ''}`"
            class="mt-2"
          />
          <UButton
            v-if="tersimpanBuang"
            label="Munculkan lagi"
            color="neutral"
            variant="ghost"
            size="xs"
            class="mt-2"
            :loading="memulihkan"
            @click="pulihkanSumber"
          />
        </template>
      </AppPanel>

      <!-- the old sticky summary: always in view while the rows below are typed -->
      <div class="sticky top-16 z-[5] mb-5 rounded-panel border border-default bg-default/95 px-4 py-3 shadow-panel backdrop-blur lg:px-5">
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Total omset diakui
            </p>
            <b class="text-highlighted num">{{ fmtRp(sumDiakui) }}</b>
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Total omset (net)
            </p>
            <b class="text-highlighted num">{{ fmtRp(net) }}</b>
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Self order
            </p>
            <b class="text-highlighted num">{{ fmtRp(kNum(so.amount) - kNum(so.disc)) }}</b>
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Diskon tercatat
            </p>
            <b
              class="num"
              :class="dTot === dHari ? 'text-success' : 'text-warning'"
            >{{ fmtRp(dTot) }} / {{ fmtRp(dHari) }}</b>
          </div>
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Selisih
            </p>
            <b
              class="num"
              :class="ok ? 'text-success' : 'text-error'"
            >{{ diff === 0 ? 'Rp0' : (diff > 0 ? `Kurang ${fmtRp(diff)}` : `Lebih ${fmtRp(-diff)}`) }}</b>
          </div>
          <div class="flex-1" />
          <AppStatus
            :color="ok ? 'success' : 'error'"
            :icon="ok ? 'i-lucide-check' : 'i-lucide-triangle-alert'"
            size="md"
          >
            {{ ok ? 'Valid, siap disimpan' : (!balance ? 'Belum balance' : `${belum.length} baris belum ada kasir shift-nya`) }}
          </AppStatus>
          <UButton
            label="Simpan breakdown"
            icon="i-lucide-save"
            :disabled="!ok"
            @click="simpanOpen = true"
          />
        </div>
      </div>

      <AppPanel
        title="Section A — omset per kasir"
        description="Semua uang lewat meja kasir, termasuk tiket event dan tagihan gathering. Omset diisi BRUTO (sebelum diskon); yang diakui = bruto − diskon. Total yang diakui harus sama dengan omset net — Section B & C di bawah TIDAK menambah total, tapi memotong dari kasir yang kena shift-nya. Centang OFF jika kasir libur."
      >
        <div class="divide-y divide-default">
          <div
            v-for="(r, i) in ks"
            :key="String(r.kasirId)"
            class="flex flex-wrap items-end gap-3 py-3"
            :class="r.off ? 'opacity-60' : ''"
          >
            <div class="min-w-40 flex-1">
              <p class="font-semibold text-highlighted">
                {{ namaKasir(String(r.kasirId)) }}
              </p>
              <UCheckbox
                :model-value="!!r.off"
                label="OFF (libur)"
                class="mt-1"
                @update:model-value="(v: boolean | 'indeterminate') => ubahOff(r, v === true)"
              />
            </div>
            <UFormField label="Omset bruto">
              <UInput
                :model-value="String(r.amount ?? 0)"
                inputmode="numeric"
                class="w-32"
                :disabled="!!r.off"
                @update:model-value="(v: string | number) => set(r, 'amount', v)"
              />
            </UFormField>
            <UFormField label="Diskon diberikan">
              <UInput
                :model-value="String(r.disc ?? 0)"
                inputmode="numeric"
                class="w-32"
                :disabled="!!r.off"
                @update:model-value="(v: string | number) => set(r, 'disc', v)"
              />
            </UFormField>
            <div class="pb-2 text-sm">
              <span class="text-muted">Diakui</span>
              <b class="ms-1 text-highlighted num">{{ fmtRp(r.off ? 0 : kNum(r.amount) - kNum(r.disc)) }}</b>
            </div>
            <UButton
              v-if="!r.off"
              label="Isi sisa"
              color="neutral"
              variant="ghost"
              size="xs"
              class="mb-2"
              @click="isiSisa(i)"
            />
          </div>
        </div>
      </AppPanel>

      <AppPanel
        title="Self order"
        description="Tamu memesan sendiri lewat barcode di meja — tidak ada kasir yang melayani, jadi nominalnya bukan omset kasir mana pun: tidak masuk Performa Kasir, tidak kena potongan event, tidak ikut menghitung bonus. Uangnya tetap dialokasikan di sini supaya harian ini balance."
      >
        <div class="flex flex-wrap gap-4">
          <UFormField label="Omset bruto (self)">
            <UInput
              :model-value="String(so.amount ?? 0)"
              inputmode="numeric"
              class="w-36"
              @update:model-value="(v: string | number) => { so.amount = v }"
            />
          </UFormField>
          <UFormField label="Diskon diberikan">
            <UInput
              :model-value="String(so.disc ?? 0)"
              inputmode="numeric"
              class="w-36"
              @update:model-value="(v: string | number) => { so.disc = v }"
            />
          </UFormField>
          <div class="self-end pb-1 text-sm text-muted">
            Diakui: <b class="text-highlighted num">{{ fmtRp(selfOmset) }}</b>
          </div>
        </div>
      </AppPanel>

      <AppPanel
        title="Section B — marketing (memotong kasir shift)"
        description="Nilai event dipecah Omset, Tax, dan Service. Realisasi PIC = ketiganya; yang dipotong dari kasir shift HANYA kolom Omset. Menu ditetapkan → kasir yang menginput dipotong; menu dipilih di tempat → tidak ada potongan. Tanpa PIC, nominalnya tidak diakui untuk siapa pun di Performa Marketing."
      >
        <div
          v-for="(r, i) in mk"
          :key="`mk${i}`"
          class="mb-4 rounded-panel border border-default p-3"
        >
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <UFormField label="PIC">
              <USelect
                :model-value="String(r.picId || KOSONG)"
                :items="opsiPic(mkList)"
                class="w-full"
                @update:model-value="(v: string) => pilihPic(r, v)"
              />
            </UFormField>
            <UFormField label="Nama event">
              <UInput
                :model-value="String(r.eventName || '')"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'eventName', v)"
              />
            </UFormField>
            <UFormField label="Omset">
              <UInput
                :model-value="String(r.amount ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'amount', v)"
              />
            </UFormField>
            <UFormField label="Tax">
              <UInput
                :model-value="String(r.tax ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'tax', v)"
              />
            </UFormField>
            <UFormField label="Service">
              <UInput
                :model-value="String(r.service ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'service', v)"
              />
            </UFormField>
            <UFormField label="Menu">
              <USelect
                :model-value="String(r.menuFix || KOSONG)"
                :items="opsiMenu"
                class="w-full"
                @update:model-value="(v: string) => pilihMenu(r, v)"
              />
            </UFormField>
            <UFormField label="Payment group">
              <UCheckbox
                :model-value="r.payGroup !== false"
                label="Wajib potong (bayar per grup)"
                @update:model-value="(v: boolean | 'indeterminate') => set(r, 'payGroup', v === true)"
              />
            </UFormField>
            <div class="flex items-end gap-2">
              <UButton
                :label="`Atur kasir shift`"
                color="neutral"
                variant="outline"
                size="xs"
                @click="bukaShift(r)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                aria-label="Buang baris"
                @click="hapusMk(i)"
              />
            </div>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <AppStatus
              :color="potongKasirAktif(r) ? 'warning' : 'success'"
              size="sm"
            >
              {{ potongKasirAktif(r) ? `memotong kasir · ${fmtRp(potonganBarisKompas(r).total)}${shiftManualTersimpan(r) ? ' · nominal per kasir' : ''}` : 'tidak memotong kasir' }}
            </AppStatus>
            <span>Shift: <b class="text-highlighted">{{ labelKasirShift(r) }}</b></span>
            <span>Diakui PIC: <b class="text-highlighted num">{{ fmtRp(kNum(r.amount) + kNum(r.tax) + kNum(r.service) + obTotal(r)) }}</b></span>
            <UTooltip text="Open Bill: pesanan tambahan tamu event di luar paket; diakui PENUH untuk PIC dan TIDAK dipotong dari kasir.">
              <UCheckbox
                :model-value="!!r.ob"
                label="Open bill"
                @update:model-value="(v: boolean | 'indeterminate') => set(r, 'ob', v === true)"
              />
            </UTooltip>
          </div>
          <div
            v-if="r.srcId"
            class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted"
          >
            <AppStatus
              color="info"
              size="sm"
            >
              otomatis
            </AppStatus>
            <span>dari modul {{ sumberDari(r.srcId) }}</span>
            <span v-if="r.srcPic">· PIC di {{ sumberDari(r.srcId) }}: <b class="text-highlighted">{{ String(r.srcPic) }}</b></span>
            <span v-if="bedaPic(r, 'marketing')">· diakui untuk <b class="text-highlighted">{{ bedaPic(r, 'marketing') }}</b></span>
            <span v-if="kNum(r.srcHariTotal) > 1">· hari ke-{{ kNum(r.srcHari) || 1 }} dari {{ kNum(r.srcHariTotal) }}</span>
            <span v-if="String(r.menuFix) === 'ditempat'">· menu dipilih di tempat</span>
            <span v-else-if="String(r.menuFix) === 'tetap'">· menu ditetapkan</span>
            <span v-else>· <b class="text-warning">menu belum ditentukan</b></span>
            <template v-if="kNum(r.srcNominal) > 0">
              <span v-if="kNum(r.srcHariTotal) > 1">· nilai <b>SELURUH</b> acara menurut {{ sumberDari(r.srcId) }}: <b class="num">{{ fmtRp(kNum(r.srcNominal)) }}</b> untuk {{ kNum(r.srcHariTotal) }} hari — isi kolom Omset dengan bagian hari ini saja.</span>
              <span v-else>· nilai menurut {{ sumberDari(r.srcId) }}: <b class="num">{{ fmtRp(kNum(r.srcNominal)) }}</b><template v-if="String(r.srcId).startsWith('vip')"> (sudah termasuk tax & service → Omset {{ fmtRp(kNum(r.srcOmset)) }} + Tax {{ fmtRp(kNum(r.srcTax)) }} + Service {{ fmtRp(kNum(r.srcService)) }})</template>
                <UButton
                  label="salin ke kolom"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  class="ms-1"
                  @click="salinSumber(r)"
                />
              </span>
            </template>
          </div>
          <div
            v-if="r.ob"
            class="mt-2 grid gap-3 sm:grid-cols-4"
          >
            <UFormField label="OB amount">
              <UInput
                :model-value="String(r.obAmount ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'obAmount', v)"
              />
            </UFormField>
            <UFormField label="OB tax">
              <UInput
                :model-value="String(r.obTax ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'obTax', v)"
              />
            </UFormField>
            <UFormField label="OB service">
              <UInput
                :model-value="String(r.obService ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'obService', v)"
              />
            </UFormField>
            <UFormField
              label="Kasir pelayan OB"
              help="Keterangan pengakuan; tidak menambah omsetnya."
            >
              <USelect
                :model-value="String(r.obKasirId || KOSONG)"
                :items="opsiKasir(kasirList)"
                class="w-full"
                @update:model-value="(v: string) => pilihKasirOb(r, v)"
              />
            </UFormField>
          </div>
        </div>
        <UButton
          label="Tambah data marketing"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          size="sm"
          @click="tambahMk"
        />
      </AppPanel>

      <AppPanel
        title="Section C — event internal (diakui 50%, kasir tidak dipotong)"
        description="Yang diakui untuk target PIC event separuh nominalnya, dihitung otomatis. Kasir tidak dipotong sama sekali. Open Bill diakui penuh, tidak ikut dibagi dua."
      >
        <div
          v-for="(r, i) in ev"
          :key="`ev${i}`"
          class="mb-4 rounded-panel border border-default p-3"
        >
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <UFormField label="PIC">
              <USelect
                :model-value="String(r.picId || KOSONG)"
                :items="opsiPic(evList)"
                class="w-full"
                @update:model-value="(v: string) => pilihPic(r, v)"
              />
            </UFormField>
            <UFormField label="Nama event">
              <UInput
                :model-value="String(r.eventName || '')"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'eventName', v)"
              />
            </UFormField>
            <UFormField label="Nilai event">
              <UInput
                :model-value="String(r.amount ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'amount', v)"
              />
            </UFormField>
            <div class="flex items-end gap-2">
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                aria-label="Buang baris"
                @click="hapusEv(i)"
              />
            </div>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Diakui PIC: <b class="text-highlighted num">{{ fmtRp(Math.round(kNum(r.amount) / 2) + obTotal(r)) }}</b> (50% + open bill)</span>
            <UTooltip text="Open Bill diakui PENUH untuk PIC event dan tidak dipotong dari kasir mana pun.">
              <UCheckbox
                :model-value="!!r.ob"
                label="Open bill"
                @update:model-value="(v: boolean | 'indeterminate') => set(r, 'ob', v === true)"
              />
            </UTooltip>
          </div>
          <div
            v-if="r.srcId"
            class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted"
          >
            <AppStatus
              color="info"
              size="sm"
            >
              otomatis
            </AppStatus>
            <span>dari modul {{ sumberDari(r.srcId) }}</span>
            <span v-if="r.srcPic">· PIC di {{ sumberDari(r.srcId) }}: <b class="text-highlighted">{{ String(r.srcPic) }}</b></span>
            <span v-if="r.srcInput">· diinput oleh <b class="text-highlighted">{{ String(r.srcInput) }}</b></span>
            <span v-if="bedaPic(r, 'event')">· diakui untuk <b class="text-highlighted">{{ bedaPic(r, 'event') }}</b></span>
          </div>
          <div
            v-if="r.ob"
            class="mt-2 grid gap-3 sm:grid-cols-4"
          >
            <UFormField label="OB amount">
              <UInput
                :model-value="String(r.obAmount ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'obAmount', v)"
              />
            </UFormField>
            <UFormField label="OB tax">
              <UInput
                :model-value="String(r.obTax ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'obTax', v)"
              />
            </UFormField>
            <UFormField label="OB service">
              <UInput
                :model-value="String(r.obService ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => set(r, 'obService', v)"
              />
            </UFormField>
            <UFormField label="Kasir pelayan OB">
              <USelect
                :model-value="String(r.obKasirId || KOSONG)"
                :items="opsiKasir(kasirList)"
                class="w-full"
                @update:model-value="(v: string) => pilihKasirOb(r, v)"
              />
            </UFormField>
          </div>
        </div>
        <UButton
          label="Tambah data event"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          size="sm"
          @click="tambahEv"
        />
      </AppPanel>

      <AppPanel
        v-if="efek.length"
        title="Efek ke realisasi kasir"
        description="Rincian lengkap ada di sini, bukan di halaman Performa Kasir — di sana yang tampil hanya angka finalnya. Diskon yang diberikan seorang kasir tidak pernah jadi omsetnya."
      >
        <table class="w-full text-sm">
          <thead class="bg-table-head text-table-head-text">
            <tr>
              <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
                Kasir
              </th>
              <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                Omset bruto
              </th>
              <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                Diskon
              </th>
              <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                Potongan event
              </th>
              <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                Realisasi
              </th>
              <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                Open bill
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="e in efek"
              :key="e.id"
            >
              <td class="px-3 py-2">
                {{ e.nama }}
              </td>
              <td class="px-3 py-2 text-end num">
                {{ fmtRp(e.bruto) }}
              </td>
              <td class="px-3 py-2 text-end num">
                {{ e.disc ? `−${fmtRp(e.disc)}` : '—' }}
              </td>
              <td class="px-3 py-2 text-end num">
                {{ e.potong ? `−${fmtRp(e.potong)}` : '—' }}
              </td>
              <td class="px-3 py-2 text-end font-semibold num">
                {{ fmtRp(e.real) }}
              </td>
              <td class="px-3 py-2 text-end num">
                {{ e.ob ? fmtRp(e.ob) : '—' }}
              </td>
            </tr>
            <tr>
              <td class="px-3 py-2 italic text-muted">
                Self Order (tanpa kasir)
              </td>
              <td class="px-3 py-2 text-end num">
                {{ fmtRp(kNum(so.amount)) }}
              </td>
              <td class="px-3 py-2 text-end num">
                {{ kNum(so.disc) ? `−${fmtRp(kNum(so.disc))}` : '—' }}
              </td>
              <td class="px-3 py-2 text-end num">
                —
              </td>
              <td class="px-3 py-2 text-end font-semibold num">
                {{ fmtRp(kNum(so.amount) - kNum(so.disc)) }}
              </td>
              <td class="px-3 py-2 text-end num">
                —
              </td>
            </tr>
          </tbody>
          <tfoot class="border-t-2 border-default font-bold">
            <tr>
              <td class="px-3 py-2.5 text-xs uppercase tracking-wide">
                Total
              </td>
              <td class="px-3 py-2.5 text-end num">
                {{ fmtRp(efekTotal.bruto) }}
              </td>
              <td class="px-3 py-2.5 text-end num">
                {{ efekTotal.disc ? `−${fmtRp(efekTotal.disc)}` : '—' }}
              </td>
              <td class="px-3 py-2.5 text-end num">
                {{ efekTotal.potong ? `−${fmtRp(efekTotal.potong)}` : '—' }}
              </td>
              <td class="px-3 py-2.5 text-end num">
                {{ fmtRp(efekTotal.real) }}
              </td>
              <td class="px-3 py-2.5 text-end num">
                {{ efekTotal.ob ? fmtRp(efekTotal.ob) : '—' }}
              </td>
            </tr>
          </tfoot>
        </table>
        <p class="mt-2 text-xs text-muted">
          Kolom <b>Open Bill</b> tidak menambah maupun mengurangi Realisasi di sebelahnya — uangnya sudah ada di dalam Omset Bruto kasir itu.
          Ia menandai bagian mana yang datang dari pesanan tambahan event, dan event mana.
        </p>
      </AppPanel>

      <AppPanel title="Peringatan">
        <UAlert
          v-if="lebihan.length"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`${lebihan.map(r => r.self ? 'Self Order' : namaKasir(String(r.kasirId))).join(', ')} diberi diskon lebih besar daripada omset brutonya sendiri.`"
          description="Kolom omset harus diisi BRUTO (sebelum diskon), bukan setoran bersihnya."
        />
        <UAlert
          v-else-if="dHari !== dTot"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`Diskon yang sudah diatribusikan ${fmtRp(dTot)}, sedangkan Discount di Input Omset Harian ${fmtRp(dHari)} — ${dSel > 0 ? `masih ada ${fmtRp(dSel)} yang belum ditulis atas nama kasir mana pun (atau Self Order)` : `kelebihan ${fmtRp(-dSel)}`}.`"
          description="Selama belum cocok, tidak ada catatan siapa yang memberi diskon itu — meski total omsetnya tetap benar."
        />
        <UAlert
          v-else-if="dHari > 0"
          color="success"
          variant="subtle"
          icon="i-lucide-check"
          :title="`Seluruh diskon ${fmtRp(dHari)} sudah tercatat atas nama pemberinya.`"
        />
        <UAlert
          v-if="tanpaPic.length"
          color="error"
          variant="subtle"
          icon="i-lucide-user-x"
          :title="`${tanpaPic.length} baris belum dipilih PIC-nya${nilaiTanpaPic ? ` (total ${fmtRp(nilaiTanpaPic)})` : ''}.`"
          :description="`Nominalnya tidak akan muncul di Performa Marketing/Event — tidak diakui untuk siapa pun. ${tanpaPic.map(x => `${x.divi}: ${x.r.eventName || '(tanpa nama)'}${x.r.srcPic ? ` — di modul asalnya PIC-nya \u201c${x.r.srcPic}\u201d, tidak ada di roster ${x.divi.toLowerCase()}` : ''}`).join(' · ')}`"
          class="mt-2"
        />
        <UAlert
          v-if="belum.length"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`Belum bisa disimpan. ${belum.length} baris marketing belum ditentukan kasir shift-nya${belum.some(r => r.eventName) ? ` (${belum.map(r => r.eventName).join(', ')})` : ''}.`"
          :description="`Potongan ${fmtRp(belum.reduce((s, r) => s + potonganBarisKompas(r).total, 0))} tidak dibebankan ke kasir mana pun, jadi omset itu terhitung dua kali — sekali di realisasi PIC, sekali di realisasi kasir. Klik tombol Atur kasir shift pada barisnya.`"
          class="mt-2"
        />

        <div
          v-if="jejak.length"
          class="mt-3 text-xs text-muted"
        >
          Jejak atur: {{ jejak.map(j => `${j.by || '—'} ${new Date(j.at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`).join(' · ') }}
        </div>
        <p
          v-else
          class="mt-3 text-xs text-muted"
        >
          Breakdown hari ini belum pernah disimpan, atau diatur sebelum jejaknya dicatat.
        </p>
      </AppPanel>

      <AppPanel
        title="Sync ke Performa Kasir"
        description="Bekukan angka realisasi per kasir hari ini untuk Performa Kasir (Kas & Cashier). Mulai 1 Oktober 2026 Performa membaca angka beku ini, bukan hitungan langsung — hari sebelumnya tetap dihitung langsung."
      >
        <UAlert
          v-if="!berlakuSync"
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="Hari ini belum masuk masa sync."
          description="Sync hanya untuk 1 Oktober 2026 ke atas; hari sebelumnya dihitung langsung seperti sekarang."
        />
        <template v-else>
          <div class="flex flex-wrap items-center gap-3">
            <AppStatus
              :color="syncStatus === 'sudah' ? 'success' : 'warning'"
              size="md"
            >
              {{ syncStatus === 'sudah' ? 'Sudah di-sync' : syncStatus === 'berubah' ? 'Breakdown berubah sesudah sync' : 'Belum di-sync' }}
            </AppStatus>
            <span
              v-if="bdSync"
              class="text-sm text-muted"
            >oleh {{ bdSync.by || '—' }} · {{ bdSync.at ? new Date(bdSync.at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—' }}</span>
            <div class="flex-1" />
            <UButton
              :label="syncStatus === 'sudah' ? 'Sync ulang' : 'Sync ke Performa Kasir'"
              icon="i-lucide-refresh-cw"
              :disabled="alasanTampil.length > 0"
              :loading="syncing"
              @click="jalanSync"
            />
          </div>
          <UAlert
            v-if="syncStatus === 'berubah'"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Breakdown berubah sesudah sync — Performa masih memakai angka beku yang lama."
            description="Tekan Sync ulang untuk membekukan angka yang sekarang."
            class="mt-3"
          />
          <UAlert
            v-if="alasanTampil.length"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Belum bisa di-sync:"
            :description="alasanTampil.join(' ')"
            class="mt-3"
          />
          <p
            v-else-if="syncStatus === 'belum'"
            class="mt-3 text-sm text-muted"
          >
            Performa Kasir untuk hari ini masih kosong (belum dihitung) sampai di-sync.
          </p>
        </template>
      </AppPanel>
    </template>

    <ResponsiveSheet
      v-model:open="shiftOpen"
      :title="shiftRow?.eventName ? `Kasir shift — ${shiftRow.eventName}` : 'Kasir shift'"
    >
      <p class="mb-3 text-sm text-muted">
        Yang dicentang saja yang ikut menanggung potongan baris ini. Kasir yang masuk tapi tidak kebagian shift event tidak dipotong.
      </p>
      <AppSeg
        v-model="shiftMode"
        size="sm"
        :options="[{ value: 'rata', label: 'Bagi rata' }, { value: 'nominal', label: 'Atur nominal' }]"
      />
      <p class="mt-2 text-xs text-muted">
        <template v-if="shiftMode === 'rata'">
          Total {{ fmtRp(shiftTotal) }} dibagi rata ke semua yang dicentang.
        </template>
        <template v-else>
          Ketik rupiah tiap kasir yang dicentang — jumlahnya harus pas {{ fmtRp(shiftTotal) }} baru bisa disimpan.
          Kembali ke Bagi rata membuang nominal yang diketik.
        </template>
      </p>
      <div class="mt-2 space-y-2">
        <div
          v-for="k in kasirList"
          :key="k.id"
          class="flex items-center gap-2"
        >
          <UCheckbox
            :model-value="shiftIds().includes(k.id)"
            :label="k.name"
            @update:model-value="() => toggleShift(k.id)"
          />
          <UInput
            v-if="shiftMode === 'nominal' && shiftIds().includes(k.id)"
            :model-value="shiftNom[k.id] ?? ''"
            inputmode="numeric"
            placeholder="Rp0"
            class="ms-auto w-36 shrink-0"
            @update:model-value="(v: string | number) => { shiftNom[k.id] = String(v) }"
          />
        </div>
      </div>
      <p
        v-if="shiftMode === 'nominal'"
        class="mt-3 rounded-xl border p-3 text-sm"
        :class="shiftNomPas ? 'border-success/30 bg-success/10' : 'border-warning/30 bg-warning/10'"
      >
        Jumlah <b class="num">{{ fmtRp(shiftNomJumlah) }}</b> dari <b class="num">{{ fmtRp(shiftTotal) }}</b> —
        {{ shiftNomPas ? 'pas, bisa disimpan.' : 'belum pas, sesuaikan nominalnya.' }}
      </p>
      <template #footer>
        <UButton
          label="Simpan pembagian"
          :disabled="shiftMode === 'nominal' && !shiftNomPas"
          @click="simpanShift"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="shiftOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="simpanOpen"
      :title="`Simpan breakdown ${tglPanjang(tanggal)}?`"
    >
      <ul class="space-y-1 text-sm">
        <li>Total omset diakui: <b class="num">{{ fmtRp(sumDiakui) }}</b></li>
        <li>Total omset (net): <b class="num">{{ fmtRp(net) }}</b></li>
        <li>Selisih: <b class="num">{{ diff === 0 ? 'Rp0' : (diff > 0 ? `Kurang ${fmtRp(diff)}` : `Lebih ${fmtRp(-diff)}`) }}</b></li>
        <li>Baris: {{ mk.length }} marketing, {{ ev.length }} event</li>
      </ul>
      <p class="mt-3 text-sm text-muted">
        Datanya dikirim ke server sekarang. Tunggu sampai muncul pesan tersimpan sebelum menutup halaman.
      </p>
      <template #footer>
        <UButton
          label="Simpan"
          :loading="menyimpan"
          @click="jalanSimpan"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="simpanOpen = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
