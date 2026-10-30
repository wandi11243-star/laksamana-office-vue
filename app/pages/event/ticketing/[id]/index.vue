<!--
  Ticket detail — four tabs: ticket classes, seat map & booking, sell ticket,
  sales & refund (`renderTicketDetail :6755`).

  The canvas seat-map editor (2 floors, templates, drag, undo/redo) is a
  dedicated build of its own: the Denah tab lists seats by status and class,
  and the full editor shows "Segera". Class CRUD, selling, sales recap,
  refunds and e-ticket handoff (WA + QR download) work fully.
-->
<script setup lang="ts">
import type { KelasTiket, Kursi, OrderTiket, Refund, Tiket } from '~/composables/useEvent'
import { createEvent, getEvent, patchEvent, removeEvent, useDaftarEvent } from '~/composables/useEvent'
import { fmtTglEms, petaOrder, ringkasPenjualan, tglWIB } from '~/utils/event-hitung'
import { jalankanRefund, refundAktif, refundGantung, ringkasRefund } from '~/utils/event-refund'
import type { RefundBaris } from '~/utils/event-refund'
import { apiErrorCode, apiErrorMessage } from '~/composables/useApi'
import { bolehSetujui, bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { angka, hariIni, rupiah } from '~/utils/format'
import { qrSvg } from '~/utils/qr'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const route = useRoute()
const toast = useToast()
const me = useMe()
const namaSaya = computed(() => me.value?.name ?? '')
const id = computed(() => String(route.params.id ?? ''))
const bolehUbah = computed(() => bolehUbahEvent('ticketing', peranEvent(me.value)))
const manajemen = computed(() => bolehSetujui(peranEvent(me.value)))

const tab = ref<'kelas' | 'denah' | 'jual' | 'sales'>('kelas')
const TABS = [
  { value: 'kelas', label: 'Kelas tiket' },
  { value: 'denah', label: 'Denah & booking' },
  { value: 'jual', label: 'Jual tiket' },
  { value: 'sales', label: 'Penjualan & refund' },
] as { value: 'kelas' | 'denah' | 'jual' | 'sales', label: string }[]

const { data: envAcara, error } = useAsyncData(`event-tix-acara-${id.value}`, () => getEvent('events', id.value))
const acara = computed(() => envAcara.value?.data as Record<string, unknown> | undefined)

const q = computed<Record<string, string>>(() => ({ event_id: id.value }))
const { data: daftarKelas, status, refresh: refreshKelas } = useDaftarEvent<KelasTiket>('ticket-classes', q, `event-tix-kelas-${id.value}`)
const { data: daftarTiket, refresh: refreshTiket } = useDaftarEvent<Tiket>('tickets', q, `event-tix-tiket-${id.value}`)
const { data: daftarKursi } = useDaftarEvent<Kursi>('seats', q, `event-tix-kursi-${id.value}`)
const { data: daftarRefundSemua, refresh: refreshRefund } = useDaftarEvent<Refund>('refunds', {}, `event-tix-refund-${id.value}`)
const { data: daftarOrder, refresh: refreshOrder } = useDaftarEvent<OrderTiket>('orders', q, `event-tix-order-${id.value}`)
const muatUlang = () => Promise.all([refreshKelas(), refreshTiket(), refreshRefund(), refreshOrder()])

// The order behind a ticket or refund (`refundGantung :10182` needs it).
const orderDariId = computed(() => new Map(daftarOrder.value.rows.map(o => [o.id, o])))
// Refunds hang off the event AND the order (`emsIsiEvent :3019` matches
// `event_id` or the order link — rows predating the `event_id` copy still count).
const daftarRefund = computed(() => ({
  rows: daftarRefundSemua.value.rows.filter(r => r.event_id === id.value || orderDariId.value.has(r.order_id ?? '')),
  versions: daftarRefundSemua.value.versions,
}))
const gantung = (r: RefundBaris) => refundGantung(r, orderDariId.value.get(r.order_id ?? ''))

// The still-living request wins over the last row (`refundAktif :10097`): an
// order may carry a rejected request followed by a fresh one, and reading
// "the last in the list" once showed an approved refund as rejected.
const refundUntukOrder = (oid: string) =>
  refundAktif(oid, daftarRefund.value.rows)
  ?? daftarRefund.value.rows.filter(r => r.order_id === oid).slice(-1)[0]

// stored order, like `renderTicketDetail` (:6922) — it never sorts
const kelas = computed(() => daftarKelas.value.rows)
const ringkas = computed(() => ringkasPenjualan(id.value, daftarTiket.value.rows, daftarKelas.value.rows, petaOrder(daftarOrder.value.rows)))
// salesBody (:7333): average over ALL orders of the event, quota & remaining over all classes
const kuotaTotal = computed(() => kelas.value.reduce((a, c) => a + (Number(c.quota) || 0), 0))
const sisaTotal = computed(() => Math.max(0, kuotaTotal.value - ringkas.value.tiketSah))
const jmlPesanan = computed(() => daftarOrder.value.rows.filter(o => o.event_id === id.value).length)
/** salesGrafikHTML (:7249): bar = sold against quota; buyers, price per ticket, PENUH. */
function infoKat(nama: string, n: number) {
  const k = kelas.value.find(c => c.name === nama)
  const kuota = Number(k?.quota) || 0
  const pembeli = new Set(daftarTiket.value.rows
    .filter(t => k && t.ticket_class_id === k.id && (t.status ?? '') !== 'Cancelled')
    .map(t => String(t.order_item_id ?? t.order_id ?? ''))).size
  return { id: k?.id ?? '', kuota, harga: Number(k?.price) || 0, pembeli, w: kuota ? Math.min(100, Math.round(n / kuota * 100)) : (n ? 100 : 0), penuh: kuota > 0 && n >= kuota }
}

const kursi = computed(() => {
  const m = new Map<string, { total: number, terjual: number }>()
  for (const s of daftarKursi.value.rows) {
    const cid = String(s.class_id ?? '')
    const g = m.get(cid) ?? { total: 0, terjual: 0 }
    g.total += 1
    m.set(cid, g)
  }
  for (const t of daftarTiket.value.rows) {
    if (!t.seat_id) continue
    const s = daftarKursi.value.rows.find(x => String(x.id) === String(t.seat_id))
    const cid = String(s?.class_id ?? t.ticket_class_id ?? '')
    const g = m.get(cid) ?? { total: 0, terjual: 0 }
    g.terjual += 1
    m.set(cid, g)
  }
  return m
})

// --- class form ---
const sheetKelas = ref(false)
const kelasId = ref('')
const fk = ref({ name: '', benefit: '', description: '', price: 100000, quota: 100, sale_start: '', sale_end: '', is_seated: false })
// sale dates are stored as ISO instants; the form edits the WIB calendar day
const keTgl = (x: unknown) => (x ? tglWIB(x) : '')
function bukaKelasBaru() {
  kelasId.value = ''
  fk.value = { name: '', benefit: '', description: '', price: 100000, quota: 100, sale_start: hariIni(), sale_end: '', is_seated: false }
  sheetKelas.value = true
}
function bukaKelasSunting(k: KelasTiket) {
  kelasId.value = k.id
  fk.value = {
    name: k.name ?? '',
    benefit: k.benefit ?? '',
    description: String(k.description ?? ''),
    price: Number(k.price) || 0,
    quota: Number(k.quota) || 1,
    sale_start: keTgl(k.sale_start),
    sale_end: keTgl(k.sale_end),
    is_seated: Boolean(k.is_seated),
  }
  sheetKelas.value = true
}
async function simpanKelas() {
  // saveTicketClass (:9789): the same checks, in the same order
  const f = fk.value
  const salah = !f.name.trim()
    ? 'Nama wajib.'
    : !f.sale_start
        ? 'Sale Start wajib diisi.'
        : !f.sale_end
            ? 'Sale End wajib diisi.'
            : f.sale_end < f.sale_start
              ? `Sale End (${f.sale_end}) tidak boleh sebelum Sale Start (${f.sale_start}).`
              : f.price < 0
                ? 'Harga tidak boleh minus.'
                : f.quota < 1 ? 'Kuota minimal 1.' : ''
  if (salah) {
    toast.add({ title: salah, color: 'error' })
    return
  }
  const lama = kelasId.value ? daftarKelas.value.rows.find(k => k.id === kelasId.value) : undefined
  // the quota may not drop below what is already sold — "remaining" would go negative
  if (lama && f.quota < (Number(lama.sold) || 0)) {
    toast.add({ title: `Sudah terjual ${Number(lama.sold) || 0} tiket — kuota tidak boleh di bawah itu.`, color: 'error' })
    return
  }
  const isi = {
    name: f.name.trim(),
    price: f.price,
    quota: f.quota,
    benefit: f.benefit,
    description: f.description,
    is_seated: f.is_seated,
    sale_start: new Date(`${f.sale_start}T00:00:00+07:00`).toISOString(),
    sale_end: new Date(`${f.sale_end}T23:59:59+07:00`).toISOString(),
  }
  sheetKelas.value = false
  try {
    if (kelasId.value) {
      await patchEvent('ticket-classes', kelasId.value, { ...isi, updatedAt: Date.now() }, daftarKelas.value.versions[kelasId.value])
      toast.add({ title: 'Kelas tiket diperbarui.', color: 'success' })
    }
    else {
      await createEvent('ticket-classes', {
        ...isi,
        event_id: id.value,
        sold: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      toast.add({ title: 'Kelas tiket dibuat.', color: 'success' })
    }
    await refreshKelas()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshKelas))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}
const hapusKelasId = ref('')
const sheetHapusKelas = computed({ get: () => hapusKelasId.value !== '', set: v => (hapusKelasId.value = v ? hapusKelasId.value : '') })
async function hapusKelas() {
  const kid = hapusKelasId.value
  sheetHapusKelas.value = false
  if (!kid) return
  try {
    await removeEvent('ticket-classes', kid, daftarKelas.value.versions[kid])
    toast.add({ title: 'Kelas tiket dihapus', color: 'success' })
    await refreshKelas()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshKelas))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- sell (`jualBody :6808`, `doPurchase :9802`) ---
const jual = ref({ class_id: '', name: '', phone: '+628', email: '', qty: 1 })
/** service fee per ticket (`pfRingkas` :9942) */
const BIAYA_LAYANAN = 5000
const menjual = ref(false)
const sisaKelas = (k: KelasTiket) => (Number(k.quota) || 0) - (Number(k.sold) || 0)
const kelasJual = computed(() => kelas.value.find(x => x.id === jual.value.class_id) ?? null)
const qtyJual = computed(() => Math.max(1, Math.floor(Number(jual.value.qty) || 1)))
// the old select starts on the first class that still has seats
watch(kelas, (ks) => {
  if (!jual.value.class_id) jual.value.class_id = ks.find(k => sisaKelas(k) > 0)?.id ?? ''
}, { immediate: true })
const uid = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`
// One sale = three writes (order Paid → ticket → class sold+1). The ids are
// made ONCE per sale and kept here, so pressing again after a failed step
// reuses them and skips what already went in: a fresh uid() per press used
// to create a second Paid order (double revenue). `langkah` = steps done.
const penjualan = ref<{ kelas: string, orderId: string, tiket: { id: string, qr: string }[], langkah: number } | null>(null)
watch(() => jual.value.class_id, (k) => {
  // a new class before anything was written is a new sale
  if (penjualan.value && penjualan.value.langkah === 0 && penjualan.value.kelas !== k) penjualan.value = null
})
/** A create that already went in (409 already_exists on our own id) counts as done. */
async function sekali(fn: () => Promise<unknown>) {
  try {
    await fn()
  }
  catch (e) {
    if (apiErrorCode(e) !== 'already_exists') throw e
  }
}
async function simpanJual() {
  const name = jual.value.name.trim()
  const phone = jual.value.phone.trim()
  // the ONLY key from a buyer to their barcode: the customer site matches orders by lowercase email
  const email = jual.value.email.replace(/\s+/g, '').toLowerCase()
  if (!name || !phone || !email) {
    toast.add({ title: 'Nama, phone, email wajib.', color: 'error' })
    return
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    toast.add({ title: 'Email tidak valid. Ini satu-satunya cara pembeli membuka barcode-nya nanti.', color: 'error' })
    return
  }
  const k = kelasJual.value
  if (!k) {
    toast.add({ title: 'Pilih kelas tiket dulu.', color: 'error' })
    return
  }
  // seats are picked on the seat map, which this build does not draw yet
  if (k.is_seated) {
    toast.add({ title: 'Kelas ini bertanda Seated — kursinya dipilih di denah, yang belum tersedia di versi ini.', color: 'error' })
    return
  }
  const jumlah = qtyJual.value
  const sisa = sisaKelas(k)
  if (jumlah > sisa) {
    toast.add({ title: `Sisa kuota tinggal ${sisa} tiket.`, color: 'error' })
    return
  }
  menjual.value = true
  if (!penjualan.value || penjualan.value.kelas !== k.id || penjualan.value.tiket.length !== jumlah) {
    const oid = uid()
    penjualan.value = { kelas: k.id, orderId: oid, tiket: Array.from({ length: jumlah }, (_, i) => ({ id: uid(), qr: `QR${uid()}${oid}${i}` })), langkah: 0 }
  }
  const p = penjualan.value
  const harga = Number(k.price) || 0
  try {
    if (p.langkah < 1) {
      await sekali(() => createEvent('orders', {
        id: p.orderId,
        event_id: id.value,
        buyer_name: name,
        phone,
        email,
        notes: '',
        subtotal: harga * jumlah,
        fee: BIAYA_LAYANAN * jumlah,
        total: (harga + BIAYA_LAYANAN) * jumlah,
        payment_status: 'Paid',
        payment_ref: `MID-${uid().slice(2, 8).toUpperCase()}`,
        // who took the money, and from which screen
        recorded_by: namaSaya.value,
        recorded_via: 'formulir',
        created: new Date().toISOString(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }))
      p.langkah = 1
    }
    if (p.langkah < 2) {
      // tickets link to their order through order_item_id (event_tickets has no order_id)
      const nomorAwal = 1000 + daftarTiket.value.rows.length
      for (const [i, t] of p.tiket.entries()) {
        await sekali(() => createEvent('tickets', {
          id: t.id,
          event_id: id.value,
          order_item_id: p.orderId,
          ticket_number: `LM-${nomorAwal + i}`,
          qr_token: t.qr,
          ticket_class_id: k.id,
          seat_id: null,
          pdf_url: 'eticket.pdf',
          status: 'Valid',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }))
      }
      p.langkah = 2
    }
    if (p.langkah < 3) {
      await patchEvent('ticket-classes', k.id, { sold: (Number(k.sold) || 0) + jumlah, updatedAt: Date.now() }, daftarKelas.value.versions[k.id])
      p.langkah = 3
    }
    toast.add({ title: `${jumlah} tiket tercatat lunas.`, color: 'success' })
    penjualan.value = null
    jual.value = { class_id: k.id, name: '', phone: '+628', email: '', qty: 1 }
    await muatUlang()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menjual.value = false
  }
}

// --- refunds: filing lives here, deciding lives in Approval Flow ---
// Approving runs the refund itself (`approveRefundYakin :10217`): the order
// goes Refunded, its tickets Cancelled, seats & class quota back — never
// just the request status. Rejecting asks for a reason first (`tolakRefund
// :10230`); both happen in Approval, never from the sales board (:7384-7391).
// Repair for approvals from the old version that only flipped the request
// status (`selesaikanRefund :10187`): runs the same execution, keeps Approved.
// --- request refund (`requestRefund/submitRefund :10100`): one living request
// per order. Deciding stays in Approval Flow; sales only files the request.
const refundOrderId = ref('')
const alasanRefund = ref('')
const sheetRefund = computed({ get: () => refundOrderId.value !== '', set: v => (refundOrderId.value = v ? refundOrderId.value : '') })
const orderRefund = computed(() => orderDariId.value.get(refundOrderId.value))
function bukaRefund(orderId: string) {
  const hidup = refundAktif(orderId, daftarRefund.value.rows)
  if (hidup) {
    toast.add({
      title: hidup.status === 'Pending'
        ? 'Refund untuk order ini sudah diajukan — menunggu persetujuan.'
        : 'Refund untuk order ini sudah disetujui.',
      color: 'warning',
    })
    return
  }
  refundOrderId.value = orderId
  alasanRefund.value = ''
}
async function ajukanRefund() {
  const oid = refundOrderId.value
  const alasan = alasanRefund.value.trim()
  if (!oid) return
  if (!alasan) {
    toast.add({ title: 'Alasan wajib diisi.', color: 'error' })
    return
  }
  if (refundAktif(oid, daftarRefund.value.rows)) {
    toast.add({ title: 'Refund untuk order ini sudah ada.', color: 'warning' })
    sheetRefund.value = false
    return
  }
  const o = orderDariId.value.get(oid)
  try {
    await createEvent('refunds', {
      order_id: oid,
      event_id: o?.event_id ?? id.value,
      reason: alasan,
      status: 'Pending',
      oleh: namaSaya.value,
      requested_at: new Date().toISOString(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    sheetRefund.value = false
    toast.add({ title: 'Refund diajukan — menunggu keputusan manajemen di Approval Flow.', color: 'success' })
    await refreshRefund()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshRefund))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

async function eksekusiRefund(r: Refund, order: OrderTiket, selesaikanMode: boolean) {
  const hasil = await jalankanRefund({
    refund: r,
    order,
    tiket: daftarTiket.value.rows,
    kursi: daftarKursi.value.rows,
    kelas: daftarKelas.value.rows,
    versi: {
      refund: daftarRefund.value.versions[r.id],
      order: daftarOrder.value.versions[order.id],
      tiket: daftarTiket.value.versions,
      kursi: daftarKursi.value.versions,
      kelas: daftarKelas.value.versions,
    },
    patch: patchEvent,
    nama: namaSaya.value,
    selesaikan: selesaikanMode,
  })
  if (hasil.konflik) await tanganiKonflik(hasil.galat, muatUlang)
  else await muatUlang()
  const kata = selesaikanMode ? 'diselesaikan' : 'disetujui'
  if (hasil.ok) {
    toast.add({ title: `Refund ${kata} — ${hasil.tiketBatal} tiket dibatalkan & kursinya dilepas.`, color: 'success' })
  }
  else {
    toast.add({ title: `Refund ${kata} sebagian`, description: ringkasRefund(hasil), color: 'warning' })
  }
}

// Repair for approvals from the old version that only flipped the request
// status (`selesaikanRefund :10187`): runs the same execution, keeps Approved.
const selesaikanId = ref('')
const sheetSelesaikan = computed({ get: () => selesaikanId.value !== '', set: v => (selesaikanId.value = v ? selesaikanId.value : '') })
const refundDipilih = computed(() => daftarRefund.value.rows.find(x => x.id === selesaikanId.value))
const orderDipilih = computed(() => orderDariId.value.get(refundDipilih.value?.order_id ?? ''))
async function selesaikan() {
  const r = refundDipilih.value
  const order = orderDipilih.value
  sheetSelesaikan.value = false
  if (!r || !order) return
  await eksekusiRefund(r, order, true)
}

// --- sales board: one row per ORDER (`:7341`), newest first ---
const SALES_PER_HAL = 10
const halSales = ref(1)
const barisOrder = computed(() => [...daftarOrder.value.rows]
  .filter(o => o.event_id === id.value)
  .sort((a, b) => String(b.created ?? '').localeCompare(String(a.created ?? ''))))
const maxHalSales = computed(() => Math.max(1, Math.ceil(barisOrder.value.length / SALES_PER_HAL)))
const orderTampil = computed(() => barisOrder.value.slice((halSales.value - 1) * SALES_PER_HAL, halSales.value * SALES_PER_HAL))
watch(barisOrder, () => {
  halSales.value = Math.min(halSales.value, maxHalSales.value)
})
const tiketOrder = (oid: string) => daftarTiket.value.rows.filter(t => String(t.order_id ?? t.order_item_id ?? '') === oid)
const refundOrder = (oid: string) => refundUntukOrder(oid)
/** Seats grouped, not listed per ticket: one table of 6 reads "5 (6 tamu)". */
const kursiOrder = (tks: Tiket[]) => {
  const jml = new Map<string, number>()
  const urut: string[] = []
  for (const t of tks) {
    if (!t.seat_id) continue
    const st = daftarKursi.value.rows.find(x => String(x.id) === String(t.seat_id))
    const label = String((st as Record<string, unknown> | undefined)?.table_no ?? (st as Record<string, unknown> | undefined)?.seat_no ?? '')
    if (!label) continue
    if (!jml.has(label)) {
      jml.set(label, 0)
      urut.push(label)
    }
    jml.set(label, (jml.get(label) ?? 0) + 1)
  }
  return urut.map(l => ((jml.get(l) ?? 0) > 1 ? `${l} (${jml.get(l)} tamu)` : l))
}
const masukOrder = (tks: Tiket[]) => tks.filter(t => t.status === 'Checked-In').length
const warnaBayar = (s?: string): 'success' | 'warning' | 'neutral' => (s === 'Paid' ? 'success' : s === 'Waiting' ? 'warning' : 'neutral')
const bisaAjukanRefund = (o: OrderTiket) => tiketOrder(o.id).length > 0 && !refundAktif(o.id, daftarRefund.value.rows) && o.payment_status !== 'Refunded'
const fmtTanggalJam = (s?: string | null) => {
  if (!s) return '-'
  const d = new Date(s)
  if (Number.isNaN(+d)) return String(s)
  return `${d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} WIB`
}

// --- e-ticket (`showETicket :9995`): preview + QR PNG + WA template ---
const etiket = ref<Tiket | null>(null)
const sheetEtiket = computed({ get: () => etiket.value !== null, set: (v: boolean) => {
  if (!v) etiket.value = null
} })
const etiketKelas = computed(() => daftarKelas.value.rows.find(c => c.id === etiket.value?.ticket_class_id) ?? null)
const etiketOrder = computed(() => (etiket.value
  ? orderDariId.value.get(String(etiket.value.order_id ?? etiket.value.order_item_id ?? ''))
  : undefined))
const etiketKursi = computed(() => {
  const sid = etiket.value?.seat_id
  if (!sid) return ''
  const st = daftarKursi.value.rows.find(x => String(x.id) === String(sid))
  return String((st as Record<string, unknown> | undefined)?.table_no ?? (st as Record<string, unknown> | undefined)?.seat_no ?? '')
})
const etiketQr = computed(() => {
  if (!etiket.value) return ''
  try {
    return qrSvg(etiket.value.qr_token, 240)
  }
  catch {
    return ''
  }
})
const etiketNo = computed(() => String((etiket.value as Record<string, unknown> | null)?.ticket_number ?? etiket.value?.qr_token ?? ''))
function salinToken() {
  if (!etiket.value) return
  navigator.clipboard?.writeText(etiket.value.qr_token)
    .then(() => toast.add({ title: 'QR token disalin — pakai di menu Check-In.', color: 'success' }))
    .catch(() => toast.add({ title: 'Gagal menyalin.', color: 'error' }))
}

function kirimWA(t: Tiket) {
  const o = orderDariId.value.get(String(t.order_id ?? t.order_item_id ?? ''))
  const c = daftarKelas.value.rows.find(x => x.id === t.ticket_class_id)
  const seat = labelKursiTiket(t.seat_id)
  const baris = [
    `Halo ${String(o?.buyer_name ?? '')}, berikut e-ticket Anda:`,
    '',
    `Nama           : ${String(o?.buyer_name ?? '')}`,
    `Nomor Tiket    : ${String((t as Record<string, unknown>).ticket_number ?? t.qr_token)}`,
    `Jam            : ${fmtTanggalJam(String((acara.value as Record<string, unknown> | undefined)?.start_datetime ?? ''))}`,
    `Kategori Tiket : ${c?.name ?? '-'}`,
  ]
  if (seat) baris.push(`Seat           : ${seat}`)
  baris.push(
    `Venue          : ${String((acara.value as Record<string, unknown> | undefined)?.venue ?? '-')}`,
    '',
    'Tunjukkan QR code (gambar terlampir) saat check-in.',
    'QR berlaku sekali pakai.',
    '',
    'Laksamana Muda Coffee & Live Space',
  )
  const nomor = String(o?.phone ?? '').replace(/[^0-9]/g, '').replace(/^0/, '62')
  if (!nomor) {
    toast.add({ title: 'Nomor WhatsApp pembeli kosong.', color: 'error' })
    return
  }
  window.open(`https://wa.me/${nomor}?text=${encodeURIComponent(baris.join('\n'))}`, '_blank', 'noopener')
  toast.add({ title: 'WhatsApp dibuka — jangan lupa lampirkan gambar QR-nya.' })
}
/** QR disimpan sebagai PNG 600px supaya gampang dilampirkan di WhatsApp atau email. */
function unduhQR(t: Tiket) {
  let svg = ''
  try {
    svg = qrSvg(t.qr_token, 600)
  }
  catch {
    toast.add({ title: 'Token terlalu panjang untuk QR.', color: 'error' })
    return
  }
  const img = new Image()
  img.onload = () => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 600
    const cx = cv.getContext('2d')
    if (!cx) return
    cx.fillStyle = '#fff'
    cx.fillRect(0, 0, 600, 600)
    cx.drawImage(img, 0, 0)
    cv.toBlob((b) => {
      if (!b) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      const no = String((t as Record<string, unknown>).ticket_number ?? t.qr_token)
      a.download = `QR-${no}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      toast.add({ title: `QR tersimpan sebagai ${a.download}`, color: 'success' })
    })
  }
  img.onerror = () => toast.add({ title: 'Gagal menyiapkan gambar QR.', color: 'error' })
  img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}
/** One seat label for WA and e-ticket (table_no wins over the raw seat number). */
function labelKursiTiket(sid?: string) {
  if (!sid) return ''
  const st = daftarKursi.value.rows.find(x => String(x.id) === String(sid))
  return String((st as Record<string, unknown> | undefined)?.table_no ?? (st as Record<string, unknown> | undefined)?.seat_no ?? '')
}
</script>

<template>
  <EventGerbang lihat="ticketing">
    <AppPage
      :title="String(acara?.title ?? 'Ticketing')"
      description="Kelas, denah, penjualan & refund"
      :back="{ label: 'Ticketing', to: '/event/ticketing' }"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :title="apiErrorMessage(error)"
        class="mb-4"
      />
      <div class="mb-4">
        <AppSeg
          v-model="tab"
          :options="TABS"
        />
      </div>

      <template v-if="tab === 'kelas'">
        <AppPanel
          title="Kelas tiket"
          icon="i-lucide-ticket"
          flush
        >
          <template #actions>
            <UButton
              v-if="bolehUbah"
              color="primary"
              size="sm"
              icon="i-lucide-plus"
              @click="bukaKelasBaru()"
            >
              Kelas tiket baru
            </UButton>
          </template>
          <UTable
            :columns="[{ id: 'nama', header: 'Kelas tiket' }, { id: 'harga', header: 'Harga' }, { id: 'kuota', header: 'Kuota' }, { id: 'laku', header: 'Terjual' }, { id: 'masa', header: 'Masa jual' }, { id: 'duduk', header: 'Tempat duduk' }, ...(bolehUbah ? [{ id: 'aksi', header: '' }] : [])]"
            :data="kelas"
            :loading="status === 'pending'"
            class="hidden lg:block"
          >
            <template #nama-cell="{ row }">
              <ULink
                :to="`/event/ticketing/${id}/${row.original.id}`"
                class="font-semibold text-highlighted hover:text-primary-700"
              >
                {{ row.original.name }}
              </ULink>
              <span
                v-if="row.original.benefit"
                class="block text-xs text-muted"
              >{{ row.original.benefit }}</span>
            </template>
            <template #harga-cell="{ row }">
              <span class="num">{{ rupiah(Number(row.original.price) || 0) }}</span>
            </template>
            <template #kuota-cell="{ row }">
              <span class="num">{{ angka(Number(row.original.quota) || 0) }}</span>
            </template>
            <template #laku-cell="{ row }">
              <span class="num">{{ angka(Number(row.original.sold) || 0) }}</span>
              <AppStatus
                v-if="(Number(row.original.sold) || 0) >= (Number(row.original.quota) || 0)"
                color="error"
                size="sm"
                class="ms-1.5"
              >
                Sold
              </AppStatus>
            </template>
            <template #masa-cell="{ row }">
              <span class="text-xs">{{ fmtTglEms(row.original.sale_start) }} – {{ fmtTglEms(row.original.sale_end) }}</span>
            </template>
            <template #duduk-cell="{ row }">
              <AppStatus
                :color="row.original.is_seated ? 'vip' : 'info'"
                size="sm"
              >
                {{ row.original.is_seated ? 'Kursi bernomor' : 'Bebas berdiri' }}
              </AppStatus>
            </template>
            <template #aksi-cell="{ row }">
              <span class="flex gap-1">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-pencil"
                  @click="bukaKelasSunting(row.original)"
                />
                <UButton
                  color="error"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-x"
                  @click="hapusKelasId = row.original.id"
                />
              </span>
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="k in kelas"
              :key="k.id"
            >
              <ULink
                :to="`/event/ticketing/${id}/${k.id}`"
                class="block px-4 py-3"
              >
                <b class="block text-sm text-highlighted">{{ k.name }}</b>
                <span class="mt-0.5 block text-xs text-muted num">{{ rupiah(Number(k.price) || 0) }} · {{ angka(Number(k.sold) || 0) }}/{{ angka(Number(k.quota) || 0) }} terjual</span>
              </ULink>
            </li>
          </ul>
        </AppPanel>
        <p class="mt-3 text-xs text-muted">
          Untuk mencatat penjualan atau memesankan kursi, buka tab <b>Jual tiket</b>.
        </p>
      </template>

      <template v-else-if="tab === 'denah'">
        <AppPanel
          title="Denah & booking"
          icon="i-lucide-armchair"
        >
          <ul class="grid gap-2 lg:grid-cols-2">
            <li
              v-for="k in kelas"
              :key="k.id"
              class="rounded-panel border border-default px-3 py-2 text-sm"
            >
              <b class="text-highlighted">{{ k.name }}</b>
              <span class="mt-0.5 block text-xs text-muted num">
                {{ (kursi.get(k.id)?.terjual ?? 0) }} terjual dari {{ (kursi.get(k.id)?.total ?? 0) }} titik
              </span>
            </li>
          </ul>
          <p
            v-if="!kelas.length"
            class="py-4 text-center text-sm text-dimmed"
          >
            Belum ada kelas tiket.
          </p>
          <UAlert
            color="info"
            variant="soft"
            title="Editor denah kanvas Segera"
            description="Denah 2 lantai, template, drag & mode jual butuh build tersendiri. Penjualan tanpa nomor kursi jalan penuh di tab Jual tiket."
            class="mt-3"
          />
        </AppPanel>
      </template>

      <template v-else-if="tab === 'jual'">
        <div
          v-if="!kelas.length"
          class="rounded-panel border border-default bg-elevated p-8 text-center text-sm text-muted"
        >
          Event ini belum punya satu kelas tiket pun.
          <span class="mt-1 block text-xs">Buat dulu di tab <b>Kelas tiket</b> — tanpa itu tidak ada yang bisa dijual.</span>
        </div>
        <AppPanel
          v-else
          title="Catat penjualan tiket"
          icon="i-lucide-cash-register"
        >
          <p class="mb-3 text-xs text-muted">
            Untuk pembeli yang membayar langsung di tempat — tiketnya terbit begitu disimpan, lengkap dengan QR untuk check-in.
          </p>
          <UFormField
            label="Pilih tiket"
            class="mb-3"
          >
            <USelect
              v-model="jual.class_id"
              :items="kelas.map(k => ({ value: k.id, label: `${k.name} — ${rupiah(Number(k.price) || 0)} (${sisaKelas(k) <= 0 ? 'HABIS' : `${sisaKelas(k)} tersisa`})`, disabled: sisaKelas(k) <= 0 }))"
              class="w-full"
            />
          </UFormField>
          <div class="grid gap-3 lg:grid-cols-2">
            <UFormField
              label="Nama"
              required
            >
              <UInput
                v-model="jual.name"
                placeholder="Nama pembeli"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="No. HP"
              required
            >
              <UInput
                v-model="jual.phone"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Email"
              required
            >
              <UInput
                v-model="jual.email"
                type="email"
                placeholder="untuk kirim e-ticket"
                class="w-full"
              />
            </UFormField>
          </div>
          <p
            v-if="kelasJual"
            class="mt-3 text-xs text-muted num"
          >
            <b class="text-highlighted">{{ qtyJual }} tiket × {{ rupiah(Number(kelasJual.price) || 0) }}</b>
            + biaya layanan {{ rupiah(BIAYA_LAYANAN * qtyJual) }} =
            <b class="text-base text-primary-700">{{ rupiah(((Number(kelasJual.price) || 0) + BIAYA_LAYANAN) * qtyJual) }}</b>
          </p>
          <UButton
            color="primary"
            :loading="menjual"
            class="mt-3"
            @click="simpanJual()"
          >
            Simpan & tandai lunas
          </UButton>
        </AppPanel>
        <AppPanel
          v-if="kelasJual"
          class="mt-4"
        >
          <p
            v-if="kelasJual.is_seated"
            class="text-xs text-error"
          >
            Kelas ini bertanda <b>Seated</b> — kursinya dipilih di denah. Lepas tanda Seated untuk menjualnya sebagai bebas berdiri.
          </p>
          <UFormField
            v-else
            label="Jumlah tiket"
          >
            <UInput
              v-model.number="jual.qty"
              type="number"
              min="1"
              class="w-32"
            />
          </UFormField>
        </AppPanel>
      </template>

      <template v-else>
        <AppStatGrid class="mb-4">
          <AppStat
            label="Omzet Bersih"
            :value="rupiah(ringkas.omzet)"
            :sub="jmlPesanan ? `rata-rata ${rupiah(Math.round(ringkas.omzet / jmlPesanan))} / pesanan` : 'belum ada pesanan'"
            icon="i-lucide-banknote"
            tone="gold"
          />
          <AppStat
            label="Tiket Terjual"
            :value="`${angka(ringkas.tiketSah)}${kuotaTotal ? ` / ${angka(kuotaTotal)}` : ''}`"
            :sub="kuotaTotal ? (sisaTotal ? `sisa ${angka(sisaTotal)} tiket` : 'kuota habis') : 'kuota belum disetel'"
            icon="i-lucide-ticket-check"
            tone="success"
          />
          <AppStat
            label="Dikembalikan"
            :value="rupiah(ringkas.dikembalikan)"
            sub="refund disetujui"
            icon="i-lucide-undo-2"
            tone="error"
          />
          <AppStat
            label="Jumlah Pesanan"
            :value="angka(jmlPesanan)"
            sub="termasuk yang direfund"
            icon="i-lucide-receipt-text"
            tone="info"
          />
        </AppStatGrid>
        <AppPanel
          title="Penjualan per Kategori"
          icon="i-lucide-chart-column"
          class="mb-4"
        >
          <p
            v-if="!ringkas.perKelas.length"
            class="py-4 text-center text-sm text-muted"
          >
            Belum ada tiket terjual di event ini.
          </p>
          <template v-else>
            <p class="mb-3 text-xs text-muted">
              Panjang bar = terjual terhadap kuota. Klik kategorinya untuk melihat siapa saja pembelinya.
            </p>
            <div
              v-for="k in ringkas.perKelas"
              :key="k.nama"
              class="mb-3 last:mb-0"
            >
              <div class="flex flex-wrap items-center gap-2 text-sm">
                <b class="text-highlighted">{{ k.nama }}</b>
                <span class="ms-auto num"><b>{{ angka(k.n) }}</b><span
                  v-if="infoKat(k.nama, k.n).kuota"
                  class="text-xs text-muted"
                >/{{ angka(infoKat(k.nama, k.n).kuota) }}</span></span>
                <span class="font-semibold text-primary-700 num">{{ rupiah(k.rp) }}</span>
                <UButton
                  v-if="infoKat(k.nama, k.n).id"
                  :to="`/event/ticketing/${id}/${infoKat(k.nama, k.n).id}`"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  trailing-icon="i-lucide-chevron-right"
                >
                  Rincian
                </UButton>
              </div>
              <div class="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full rounded-full bg-primary-400"
                  :style="{ width: `${infoKat(k.nama, k.n).w}%` }"
                />
              </div>
              <p class="mt-1 flex gap-3 text-xs text-muted">
                <span>{{ infoKat(k.nama, k.n).pembeli }} pembeli<template v-if="infoKat(k.nama, k.n).harga"> · {{ rupiah(infoKat(k.nama, k.n).harga) }}/tiket</template></span>
                <b
                  v-if="infoKat(k.nama, k.n).penuh"
                  class="text-error"
                >PENUH</b>
              </p>
            </div>
          </template>
        </AppPanel>
        <AppPanel
          title="Daftar pembeli"
          icon="i-lucide-users"
          flush
        >
          <UTable
            :columns="[
              { id: 'nama', header: 'Pembeli' },
              { id: 'kontak', header: 'Kontak' },
              { id: 'tiket', header: 'Tiket' },
              { id: 'kursi', header: 'Kursi' },
              { id: 'total', header: 'Total' },
              { id: 'bayar', header: 'Bayar' },
              { id: 'refund', header: 'Refund' },
              { id: 'hadir', header: 'Check-in' },
              { id: 'aksi', header: '' },
            ]"
            :data="orderTampil"
            class="hidden lg:block"
            :ui="{ th: 'px-2.5 whitespace-normal leading-tight', td: 'px-2.5 py-2 text-[13px]' }"
          >
            <template #nama-cell="{ row }">
              <b class="text-highlighted">{{ String(row.original.buyer_name ?? '—') }}</b>
              <span class="block text-xs text-muted">{{ fmtTanggalJam(row.original.created) }}<template v-if="String(row.original.recorded_by ?? '')"> · {{ String(row.original.recorded_by) === 'Website' ? 'Website' : `oleh ${String(row.original.recorded_by)}` }}</template></span>
              <span
                v-if="String(row.original.payment_ref ?? '')"
                class="block text-xs text-muted"
              >{{ String(row.original.payment_ref) }}</span>
            </template>
            <template #kontak-cell="{ row }">
              <span class="block text-xs">{{ String(row.original.phone || '—') }}</span>
              <span class="block text-xs text-muted">{{ String(row.original.email || '—') }}</span>
            </template>
            <template #tiket-cell="{ row }">
              <span>{{ daftarKelas.rows.find(c => c.id === tiketOrder(row.original.id)[0]?.ticket_class_id)?.name ?? '—' }}</span>
              <AppStatus
                v-if="tiketOrder(row.original.id).length > 1"
                color="info"
                size="sm"
                class="ms-1.5"
              >
                {{ tiketOrder(row.original.id).length }} tiket
              </AppStatus>
            </template>
            <template #kursi-cell="{ row }">
              <span class="text-xs">{{ kursiOrder(tiketOrder(row.original.id)).join(', ') || '—' }}</span>
            </template>
            <template #total-cell="{ row }">
              <b class="num">{{ rupiah(Number(row.original.total) || 0) }}</b>
            </template>
            <template #bayar-cell="{ row }">
              <AppStatus
                :color="warnaBayar(String(row.original.payment_status ?? ''))"
                size="sm"
              >
                {{ String(row.original.payment_status ?? '—') }}
              </AppStatus>
            </template>
            <template #refund-cell="{ row }">
              <span
                v-if="!refundOrder(row.original.id)"
                class="text-muted"
              >—</span>
              <AppStatus
                v-else-if="String(refundOrder(row.original.id)?.status ?? '') === 'Pending'"
                color="warning"
                icon="i-lucide-hourglass"
                size="sm"
              >
                On process
              </AppStatus>
              <span
                v-else-if="gantung(refundOrder(row.original.id)!)"
                class="flex flex-wrap items-center gap-1.5"
              >
                <AppStatus
                  color="warning"
                  icon="i-lucide-hourglass"
                  size="sm"
                >
                  Disetujui · belum diselesaikan
                </AppStatus>
                <UButton
                  v-if="manajemen"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  @click="selesaikanId = refundOrder(row.original.id)!.id"
                >
                  Selesaikan refund
                </UButton>
                <span
                  v-else
                  class="text-xs text-muted"
                >manajemen perlu menekan Selesaikan refund</span>
              </span>
              <AppStatus
                v-else-if="String(refundOrder(row.original.id)?.status ?? '') === 'Approved'"
                color="success"
                icon="i-lucide-check"
                size="sm"
              >
                Refunded
              </AppStatus>
              <AppStatus
                v-else
                color="neutral"
                icon="i-lucide-x"
                size="sm"
              >
                Ditolak
              </AppStatus>
              <UButton
                v-if="refundOrder(row.original.id)?.status === 'Pending'"
                label="diputus di Approval Flow"
                color="neutral"
                variant="link"
                size="xs"
                to="/event/approval"
              />
            </template>
            <template #hadir-cell="{ row }">
              <span class="text-xs num">{{ masukOrder(tiketOrder(row.original.id)) ? `${masukOrder(tiketOrder(row.original.id))}/${tiketOrder(row.original.id).length}` : '—' }}</span>
            </template>
            <template #aksi-cell="{ row }">
              <span
                v-if="tiketOrder(row.original.id).length"
                class="flex gap-1"
              >
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  label="E-Ticket"
                  @click="etiket = tiketOrder(row.original.id)[0]!"
                />
                <UButton
                  v-if="bisaAjukanRefund(row.original)"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  label="Refund"
                  @click="bukaRefund(row.original.id)"
                />
              </span>
            </template>
          </UTable>
          <p
            v-if="!barisOrder.length"
            class="px-4 py-6 text-center text-sm text-dimmed"
          >
            Belum ada pembeli.
          </p>
          <div
            v-else
            class="flex flex-wrap items-center justify-between gap-3 border-t border-default px-4 py-3 text-sm text-muted"
          >
            <span class="num">{{ (halSales - 1) * SALES_PER_HAL + 1 }}–{{ Math.min(halSales * SALES_PER_HAL, barisOrder.length) }} dari {{ angka(barisOrder.length) }} pesanan</span>
            <div class="flex items-center gap-2">
              <UButton
                icon="i-lucide-chevron-left"
                color="neutral"
                variant="outline"
                size="sm"
                aria-label="Halaman sebelumnya"
                :disabled="halSales <= 1"
                @click="halSales--"
              />
              <span class="num">Hal {{ halSales }} / {{ maxHalSales }}</span>
              <UButton
                icon="i-lucide-chevron-right"
                color="neutral"
                variant="outline"
                size="sm"
                aria-label="Halaman berikutnya"
                :disabled="halSales >= maxHalSales"
                @click="halSales++"
              />
            </div>
          </div>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="o in orderTampil"
              :key="o.id"
              class="px-4 py-2.5 text-sm"
            >
              <span class="flex items-start justify-between gap-2">
                <b class="min-w-0 truncate text-highlighted">{{ String(o.buyer_name ?? '—') }}</b>
                <b class="shrink-0 num">{{ rupiah(Number(o.total) || 0) }}</b>
              </span>
              <span class="mt-0.5 block truncate text-xs text-muted">{{ daftarKelas.rows.find(c => c.id === tiketOrder(o.id)[0]?.ticket_class_id)?.name ?? '—' }} · {{ fmtTanggalJam(o.created) }}</span>
              <span
                v-if="refundOrder(o.id)"
                class="mt-1 flex flex-wrap items-center gap-1.5"
              >
                <AppStatus
                  v-if="String(refundOrder(o.id)?.status ?? '') === 'Pending'"
                  color="warning"
                  icon="i-lucide-hourglass"
                  size="sm"
                >
                  On process
                </AppStatus>
                <AppStatus
                  v-else-if="gantung(refundOrder(o.id)!)"
                  color="warning"
                  icon="i-lucide-hourglass"
                  size="sm"
                >
                  Disetujui · belum diselesaikan
                </AppStatus>
                <AppStatus
                  v-else-if="String(refundOrder(o.id)?.status ?? '') === 'Approved'"
                  color="success"
                  icon="i-lucide-check"
                  size="sm"
                >
                  Refunded
                </AppStatus>
                <AppStatus
                  v-else
                  color="neutral"
                  icon="i-lucide-x"
                  size="sm"
                >
                  Ditolak
                </AppStatus>
              </span>
              <span class="mt-1.5 flex flex-wrap gap-1.5">
                <UButton
                  v-if="tiketOrder(o.id).length"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  label="E-Ticket"
                  @click="etiket = tiketOrder(o.id)[0]!"
                />
                <UButton
                  v-if="bisaAjukanRefund(o)"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  label="Refund"
                  @click="bukaRefund(o.id)"
                />
              </span>
            </li>
          </ul>
        </AppPanel>
      </template>

      <ResponsiveSheet
        v-model:open="sheetEtiket"
        title="E-Ticket"
      >
        <div
          v-if="etiket"
          class="space-y-3"
        >
          <div class="flex flex-wrap gap-5">
            <div class="text-center">
              <!-- eslint-disable vue/no-v-html — etiketQr dibangun sendiri oleh qrSvg() lokal, bukan input user -->
              <div
                v-if="etiketQr"
                class="inline-block overflow-hidden rounded-lg border border-default bg-white p-2"
                v-html="etiketQr"
              />
              <!-- eslint-enable vue/no-v-html -->
              <p class="mt-1 text-xs text-muted num">
                {{ etiketNo }}
              </p>
              <AppStatus
                :color="etiket.status === 'Checked-In' ? 'success' : 'neutral'"
                size="sm"
                class="mt-1"
              >
                {{ etiket.status ?? '—' }}
              </AppStatus>
            </div>
            <div class="min-w-52 flex-1 space-y-1.5 text-sm">
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Event</span>
                <b class="text-right text-highlighted">{{ String((acara as Record<string, unknown> | undefined)?.title ?? '—') }}</b>
              </div>
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Nama</span>
                <span>{{ String(etiketOrder?.buyer_name ?? '—') }}</span>
              </div>
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Class</span>
                <span>{{ etiketKelas?.name ?? '—' }}</span>
              </div>
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Seat</span>
                <span>{{ etiketKursi || 'Standing' }}</span>
              </div>
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Venue</span>
                <span>{{ String((acara as Record<string, unknown> | undefined)?.venue ?? '—') }}</span>
              </div>
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">Waktu</span>
                <span>{{ fmtTanggalJam(String((acara as Record<string, unknown> | undefined)?.start_datetime ?? '')) }}</span>
              </div>
              <div class="flex justify-between gap-3 border-b border-default pb-1.5">
                <span class="text-muted">QR Token</span>
                <span class="break-all text-xs num">{{ etiket.qr_token }}</span>
              </div>
            </div>
          </div>
          <p class="text-xs text-muted">
            QR single-use. Tunjukkan saat check-in.
          </p>
          <div class="rounded-panel border border-default bg-muted p-2.5 text-xs text-muted">
            Pembeli membuka barcode-nya sendiri di <b>laksamanamuda.id/ticketing</b> — daftar atau masuk memakai email
            <b class="break-all">{{ String(etiketOrder?.email || '—') }}</b>, tiketnya langsung muncul di menu
            <b>Tiket Saya</b>.
            <template v-if="!etiketOrder?.email">
              <span class="font-semibold text-error">Pesanan ini belum ada emailnya — pembeli tidak akan bisa menemukannya.</span>
            </template>
          </div>
        </div>
        <template #footer>
          <UButton
            label="Salin token"
            color="neutral"
            variant="outline"
            size="xl"
            @click="salinToken"
          />
          <UButton
            label="Unduh QR"
            color="neutral"
            variant="outline"
            size="xl"
            @click="etiket && unduhQR(etiket)"
          />
          <UButton
            label="Kirim WA"
            color="success"
            size="xl"
            @click="etiket && kirimWA(etiket)"
          />
          <UButton
            label="Tutup"
            color="neutral"
            variant="soft"
            size="xl"
            @click="sheetEtiket = false"
          />
        </template>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="sheetKelas"
        :title="kelasId ? 'Edit kelas tiket' : 'Kelas tiket baru'"
      >
        <div class="grid gap-3">
          <UFormField
            label="Nama"
            required
          >
            <UInput
              v-model="fk.name"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Benefit">
            <UInput
              v-model="fk.benefit"
              placeholder="Free drink, seat, dll"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Keterangan"
            help="Tampil ke pembeli di situs ticketing."
          >
            <UInput
              v-model="fk.description"
              placeholder="Penjelasan singkat kelas ini"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Harga">
              <UInput
                v-model.number="fk.price"
                type="number"
                min="0"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Kuota">
              <UInput
                v-model.number="fk.quota"
                type="number"
                min="0"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Mulai jual">
              <UInput
                v-model="fk.sale_start"
                type="date"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Akhir jual">
              <UInput
                v-model="fk.sale_end"
                type="date"
                :min="fk.sale_start || undefined"
                class="w-full"
              />
            </UFormField>
          </div>
          <UCheckbox
            v-model="fk.is_seated"
            label="Seated (pilih kursi)"
          />
          <p
            v-if="kelasId && (Number(daftarKelas.rows.find(k => k.id === kelasId)?.sold) || 0) > 0"
            class="text-xs text-muted"
          >
            Sudah {{ Number(daftarKelas.rows.find(k => k.id === kelasId)?.sold) || 0 }} tiket terjual — kuota tidak bisa diturunkan di bawah angka itu.
          </p>
        </div>
        <template #footer>
          <UButton
            color="primary"
            @click="simpanKelas()"
          >
            Simpan kelas
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            @click="sheetKelas = false"
          >
            Batal
          </UButton>
        </template>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="sheetHapusKelas"
        title="Hapus kelas tiket?"
      >
        <p class="text-sm text-muted">
          Kelas ini dihapus. Tiket yang sudah terjual tidak ikut terhapus.
        </p>
        <template #footer>
          <UButton
            color="error"
            @click="hapusKelas()"
          >
            Ya, hapus
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            @click="sheetHapusKelas = false"
          >
            Batal
          </UButton>
        </template>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="sheetSelesaikan"
        title="Selesaikan refund"
      >
        <div
          v-if="refundDipilih && orderDipilih"
          class="grid gap-1.5 text-sm"
        >
          <p><span class="text-muted">Pembeli:</span> <b class="text-highlighted">{{ String((orderDipilih as Record<string, unknown>).buyer_name ?? '—') }}</b></p>
          <p><span class="text-muted">Nominal:</span> <b class="text-highlighted num">{{ rupiah(Number((orderDipilih as Record<string, unknown>).total) || 0) }}</b></p>
          <p><span class="text-muted">Alasan:</span> {{ String(refundDipilih.reason ?? '—') }}</p>
          <p class="text-muted">
            Refund ini sudah disetujui, tapi oleh versi lama yang tidak ikut membatalkan tiketnya.
            Menyelesaikannya: pesanan jadi Refunded, tiket dibatalkan, kursinya dilepas, dan kuota kelasnya kembali.
            Tidak bisa dibatalkan.
          </p>
        </div>
        <template #footer>
          <UButton
            color="primary"
            @click="selesaikan()"
          >
            Selesaikan
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            @click="sheetSelesaikan = false"
          >
            Batal
          </UButton>
        </template>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="sheetRefund"
        title="Ajukan refund"
        :description="orderRefund ? `${String(orderRefund.buyer_name ?? '')} · ${rupiah(Number(orderRefund.total) || 0)}` : ''"
      >
        <UFormField
          label="Alasan refund"
          required
          help="Setelah diajukan, statusnya menunggu persetujuan. Pengajuan hanya bisa sekali per order."
        >
          <UTextarea
            v-model="alasanRefund"
            :rows="3"
            placeholder="mis. acara bentrok, tiket dobel"
            class="w-full"
          />
        </UFormField>
        <template #footer>
          <UButton
            label="Ajukan"
            @click="ajukanRefund"
          />
          <UButton
            label="Batal"
            color="neutral"
            variant="outline"
            @click="sheetRefund = false"
          />
        </template>
      </ResponsiveSheet>
    </AppPage>
  </EventGerbang>
</template>
