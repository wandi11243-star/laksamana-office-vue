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
import { ringkasPenjualan } from '~/utils/event-hitung'
import { jalankanRefund, refundAktif, refundGantung, ringkasRefund } from '~/utils/event-refund'
import type { RefundBaris } from '~/utils/event-refund'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehSetujui, bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { angka, rupiah } from '~/utils/format'
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
const refundUntukTiket = (t: Tiket) => {
  const oid = String(t.order_id ?? t.order_item_id ?? '')
  return oid ? refundUntukOrder(oid) : undefined
}

const kelas = computed(() => [...daftarKelas.value.rows].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0)))
const ringkas = computed(() => ringkasPenjualan(id.value, daftarTiket.value.rows, daftarKelas.value.rows))

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
const fk = ref({ name: '', benefit: '', price: 0, quota: 0, sale_start: '', sale_end: '', seating: 'Bebas berdiri' })
function bukaKelasBaru() {
  kelasId.value = ''
  fk.value = { name: '', benefit: '', price: 0, quota: 0, sale_start: '', sale_end: '', seating: 'Bebas berdiri' }
  sheetKelas.value = true
}
function bukaKelasSunting(k: KelasTiket) {
  kelasId.value = k.id
  fk.value = {
    name: k.name ?? '',
    benefit: k.benefit ?? '',
    price: Number(k.price) || 0,
    quota: Number(k.quota) || 0,
    sale_start: String(k.sale_start ?? ''),
    sale_end: String(k.sale_end ?? ''),
    seating: String(k.seating ?? 'Bebas berdiri'),
  }
  sheetKelas.value = true
}
async function simpanKelas() {
  if (!fk.value.name.trim()) {
    toast.add({ title: 'Nama kelas wajib diisi.', color: 'error' })
    return
  }
  sheetKelas.value = false
  try {
    if (kelasId.value) {
      const lama = daftarKelas.value.rows.find(k => k.id === kelasId.value)
      await patchEvent('ticket-classes', kelasId.value, { ...fk.value, name: fk.value.name.trim(), updatedAt: Date.now() }, daftarKelas.value.versions[kelasId.value])
      void lama
      toast.add({ title: 'Kelas tiket disimpan', color: 'success' })
    }
    else {
      await createEvent('ticket-classes', {
        ...fk.value,
        name: fk.value.name.trim(),
        event_id: id.value,
        sold: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      toast.add({ title: 'Kelas tiket baru ditambahkan', color: 'success' })
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
const jual = ref({ class_id: '', name: '', phone: '+628', email: '' })
const menjual = ref(false)
const uid = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`
async function simpanJual() {
  const k = kelas.value.find(x => x.id === jual.value.class_id)
  if (!k) {
    toast.add({ title: 'Pilih kelas tiket dulu.', color: 'error' })
    return
  }
  const sisa = (Number(k.quota) || 0) - (Number(k.sold) || 0)
  if (sisa <= 0) {
    toast.add({ title: 'Kelas ini habis.', color: 'error' })
    return
  }
  if (!jual.value.name.trim() || !jual.value.phone.trim()) {
    toast.add({ title: 'Nama & no. HP wajib diisi.', color: 'error' })
    return
  }
  menjual.value = true
  try {
    const orderId = uid()
    await createEvent('orders', {
      id: orderId,
      event_id: id.value,
      total: Number(k.price) || 0,
      payment_status: 'Paid',
      buyer_name: jual.value.name.trim(),
      buyer_phone: jual.value.phone.trim(),
      buyer_email: jual.value.email.trim(),
      created: new Date().toISOString(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    await createEvent('tickets', {
      id: uid(),
      event_id: id.value,
      ticket_class_id: k.id,
      order_id: orderId,
      qr_token: uid(),
      status: 'Valid',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    await patchEvent('ticket-classes', k.id, { sold: (Number(k.sold) || 0) + 1, updatedAt: Date.now() }, daftarKelas.value.versions[k.id])
    toast.add({ title: 'Tiket terjual & ditandai lunas', color: 'success' })
    jual.value = { class_id: '', name: '', phone: '+628', email: '' }
    await muatUlang()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menjual.value = false
  }
}

// --- refunds (`requestRefund/submitRefund/approveRefund/tolakRefund :9981`) ---
// Approving runs the refund itself (`approveRefundYakin :10217`): the order
// goes Refunded, its tickets Cancelled, seats & class quota back — never
// just the request status.
// Rejecting asks for a reason first (`tolakRefund :10230`); the sheet emits it.
const tolakRid = ref('')
const sheetTolak = computed({ get: () => tolakRid.value !== '', set: v => (tolakRid.value = v ? tolakRid.value : '') })
const ketTolak = computed(() => {
  const r = daftarRefund.value.rows.find(x => x.id === tolakRid.value)
  const o = orderDariId.value.get(r?.order_id ?? '')
  return o ? `${String(o.buyer_name ?? '')} · ${rupiah(Number(o.total) || 0)}` : undefined
})
const menolak = ref(false)
async function jalanTolakRefund(alasan: string) {
  const rid = tolakRid.value
  if (!rid || menolak.value) return
  menolak.value = true
  try {
    await patchEvent('refunds', rid, {
      status: 'Rejected', penyetuju: namaSaya.value, alasan_tolak: alasan, decided_at: new Date().toISOString(), updatedAt: Date.now(),
    }, daftarRefund.value.versions[rid])
    tolakRid.value = ''
    toast.add({ title: 'Refund ditolak — alasannya tercatat.', color: 'success' })
    await refreshRefund()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshRefund))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menolak.value = false
  }
}
async function putuskanRefund(rid: string, setuju: boolean) {
  const r = daftarRefund.value.rows.find(x => x.id === rid)
  if (!r) return
  if (!setuju) {
    tolakRid.value = rid
    return
  }
  const order = orderDariId.value.get(r.order_id ?? '')
  if (!order) {
    toast.add({ title: 'Pesanannya sudah tidak ada.', color: 'error' })
    return
  }
  await eksekusiRefund(r, order, false)
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
const antreRefund = computed(() => daftarRefund.value.rows.filter(r => (r.status ?? '') === 'Pending'))

function kirimWA(t: Tiket) {
  const nama = String((t as Record<string, unknown>).buyer_name ?? '')
  const hp = String((t as Record<string, unknown>).buyer_phone ?? '')
  const teks = `Halo Kak ${nama}!\n\nE-ticket *${String(acara.value?.title ?? '')}*:\nKode: ${t.qr_token}\nKelas: ${daftarKelas.value.rows.find(c => c.id === t.ticket_class_id)?.name ?? ''}\n\nTunjukkan kode ini di pintu masuk. Sampai jumpa!`
  window.open(`https://wa.me/${hp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(teks)}`, '_blank')
}
function unduhQR(t: Tiket) {
  const blob = new Blob([`LAKSAMANA MUDA E-TICKET\n${String(acara.value?.title ?? '')}\nKode: ${t.qr_token}\n`], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `eticket-${t.qr_token}.txt`
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
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
          :columns="[{ id: 'nama', header: 'Nama + benefit' }, { id: 'harga', header: 'Harga' }, { id: 'kuota', header: 'Kuota' }, { id: 'laku', header: 'Terjual' }, { id: 'masa', header: 'Masa jual' }, { id: 'duduk', header: 'Tempat duduk' }, ...(bolehUbah ? [{ id: 'aksi', header: '' }] : [])]"
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
          </template>
          <template #masa-cell="{ row }">
            {{ row.original.sale_start || '—' }}–{{ row.original.sale_end || '—' }}
          </template>
          <template #duduk-cell="{ row }">
            {{ row.original.seating || 'Bebas berdiri' }}
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
            class="rounded-field border border-default px-3 py-2 text-sm"
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
      <AppPanel
        title="Jual tiket"
        icon="i-lucide-cash-register"
      >
        <div class="grid gap-3 lg:grid-cols-2">
          <UFormField label="Tiket">
            <USelect
              v-model="jual.class_id"
              :items="kelas.map(k => ({ value: k.id, label: `${k.name} — ${rupiah(Number(k.price) || 0)}${(Number(k.quota) || 0) - (Number(k.sold) || 0) <= 0 ? ' (HABIS)' : ''}`, disabled: (Number(k.quota) || 0) - (Number(k.sold) || 0) <= 0 }))"
              placeholder="Pilih kelas…"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Nama"
            required
          >
            <UInput
              v-model="jual.name"
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
          <UFormField label="Email">
            <UInput
              v-model="jual.email"
              type="email"
              class="w-full"
            />
          </UFormField>
        </div>
        <UButton
          color="primary"
          :loading="menjual"
          class="mt-3"
          @click="simpanJual()"
        >
          Simpan & tandai lunas
        </UButton>
      </AppPanel>
    </template>

    <template v-else>
      <AppStatGrid class="mb-4">
        <AppStat
          label="Omzet"
          :value="rupiah(ringkas.omzet)"
          icon="i-lucide-banknote"
          tone="gold"
        />
        <AppStat
          label="Tiket sah"
          :value="angka(ringkas.tiketSah)"
          icon="i-lucide-ticket-check"
          tone="success"
        />
        <AppStat
          label="Dikembalikan"
          :value="rupiah(ringkas.dikembalikan)"
          icon="i-lucide-undo-2"
          tone="error"
        />
      </AppStatGrid>
      <AppPanel
        title="Ringkasan per kategori"
        icon="i-lucide-chart-column"
        class="mb-4"
      >
        <AppBar
          v-for="k in ringkas.perKelas"
          :key="k.nama"
          :label="k.nama"
          :value="`${angka(k.n)} · ${rupiah(k.rp)}`"
          :persen="ringkas.tiketSah ? Math.round(k.n / ringkas.tiketSah * 100) : 0"
        />
      </AppPanel>
      <AppPanel
        v-if="bolehUbah && antreRefund.length"
        title="Refund menunggu"
        icon="i-lucide-undo-2"
        class="mb-4"
      >
        <ul class="space-y-2">
          <li
            v-for="r in antreRefund"
            :key="r.id"
            class="flex flex-wrap items-center gap-2 rounded-field border border-default px-3 py-2 text-sm"
          >
            <span class="flex-1"><b class="text-highlighted num">{{ rupiah(Number(r.amount) || 0) }}</b> · <span class="text-muted">{{ String(r.reason ?? '') }}</span></span>
            <UButton
              color="success"
              size="sm"
              @click="putuskanRefund(r.id, true)"
            >
              Setujui
            </UButton>
            <UButton
              color="error"
              variant="outline"
              size="sm"
              @click="putuskanRefund(r.id, false)"
            >
              Tolak
            </UButton>
          </li>
        </ul>
      </AppPanel>
      <AppPanel
        title="Daftar pembeli"
        icon="i-lucide-users"
        flush
      >
        <UTable
          :columns="[{ id: 'nama', header: 'Pembeli' }, { id: 'kelas', header: 'Kelas' }, { id: 'kode', header: 'Kode' }, { id: 'refund', header: 'Refund' }, { id: 'aksi', header: 'E-ticket' }]"
          :data="daftarTiket.rows"
          class="hidden lg:block"
        >
          <template #nama-cell="{ row }">
            <b class="text-highlighted">{{ String((row.original as Record<string, unknown>).buyer_name ?? '—') }}</b>
          </template>
          <template #kelas-cell="{ row }">
            {{ daftarKelas.rows.find(c => c.id === row.original.ticket_class_id)?.name ?? '—' }}
          </template>
          <template #kode-cell="{ row }">
            <span class="text-xs">{{ row.original.qr_token }}</span>
          </template>
          <template #refund-cell="{ row }">
            <span
              v-if="!refundUntukTiket(row.original)"
              class="text-muted"
            >—</span>
            <AppStatus
              v-else-if="String(refundUntukTiket(row.original)?.status ?? '') === 'Pending'"
              color="warning"
              icon="i-lucide-hourglass"
              size="sm"
            >
              On process
            </AppStatus>
            <span
              v-else-if="gantung(refundUntukTiket(row.original)!)"
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
                @click="selesaikanId = refundUntukTiket(row.original)!.id"
              >
                Selesaikan refund
              </UButton>
              <span
                v-else
                class="text-xs text-muted"
              >manajemen perlu menekan Selesaikan refund</span>
            </span>
            <AppStatus
              v-else-if="String(refundUntukTiket(row.original)?.status ?? '') === 'Approved'"
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
          </template>
          <template #aksi-cell="{ row }">
            <span class="flex gap-1">
              <UButton
                color="success"
                variant="ghost"
                size="sm"
                icon="i-lucide-message-circle"
                @click="kirimWA(row.original)"
              />
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-download"
                @click="unduhQR(row.original)"
              />
            </span>
          </template>
        </UTable>
        <ul class="divide-y divide-default lg:hidden">
          <li
            v-for="t in daftarTiket.rows"
            :key="t.id"
            class="flex items-center gap-2 px-4 py-2.5 text-sm"
          >
            <span class="min-w-0 flex-1">
              <b class="block truncate text-highlighted">{{ String((t as Record<string, unknown>).buyer_name ?? '—') }}</b>
              <span class="block truncate text-xs text-muted">{{ t.qr_token }}</span>
              <span
                v-if="refundUntukTiket(t)"
                class="mt-1 flex flex-wrap items-center gap-1.5"
              >
                <AppStatus
                  v-if="String(refundUntukTiket(t)?.status ?? '') === 'Pending'"
                  color="warning"
                  icon="i-lucide-hourglass"
                  size="sm"
                >
                  On process
                </AppStatus>
                <AppStatus
                  v-else-if="gantung(refundUntukTiket(t)!)"
                  color="warning"
                  icon="i-lucide-hourglass"
                  size="sm"
                >
                  Disetujui · belum diselesaikan
                </AppStatus>
                <AppStatus
                  v-else-if="String(refundUntukTiket(t)?.status ?? '') === 'Approved'"
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
                  v-if="gantung(refundUntukTiket(t)!) && manajemen"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  @click="selesaikanId = refundUntukTiket(t)!.id"
                >
                  Selesaikan refund
                </UButton>
              </span>
            </span>
            <UButton
              color="success"
              variant="ghost"
              size="sm"
              icon="i-lucide-message-circle"
              @click="kirimWA(t)"
            />
          </li>
        </ul>
      </AppPanel>
    </template>

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
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Tempat duduk">
          <USelect
            v-model="fk.seating"
            :items="[{ value: 'Bebas berdiri', label: 'Bebas berdiri' }, { value: 'Kursi bernomor', label: 'Kursi bernomor' }]"
            class="w-full"
          />
        </UFormField>
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

    <EventTolakRefund
      v-model:open="sheetTolak"
      :ket="ketTolak"
      :sibuk="menolak"
      @tolak="jalanTolakRefund"
    />
  </AppPage>
</template>
