<!--
  Event Detail — banner, basic info, 8-phase timeline, the five live sections
  (rundown, vendors, budget, sponsors, tasks) through one `eventDetails`
  document, budget stats and the ticketing card (`renderEventDetail :6369`).

  Rules: Event Done locks every field (`:6376`); a new rundown row starts at
  the last row's end time (F.17); budget variance = actual − budget (F.18);
  legacy status values stay selectable (`selStatus :6497`).
-->
<script setup lang="ts">
import type { DetailAcara, OrderTiket, Refund } from '~/composables/useEvent'
import { getDetail, getEvent, patchEvent, putDetail, removeEvent, useDaftarEvent } from '~/composables/useEvent'
import { refundGantung } from '~/utils/event-refund'
import { EVT_STATUS, TIMELINE_PHASES, jamWIB } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { angka, rupiah } from '~/utils/format'
import { tanganiKonflik, versiDari } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const route = useRoute()
const toast = useToast()
const me = useMe()
const namaSaya = computed(() => me.value?.name ?? '')
const id = computed(() => String(route.params.id ?? ''))
const bolehUbah = computed(() => bolehUbahEvent('events', peranEvent(me.value)))

const { data: envAcara, refresh: refreshAcara, error } = useAsyncData(`event-acara-${id.value}`, () => getEvent('events', id.value))
const { data: envDetail, refresh: refreshDetail, status: statusDetail } = useAsyncData(`event-detail-${id.value}`, () => getDetail(id.value).catch(() => null))

/** First-load skeleton for the budget cards below: skeleton cells stand in
 *  until the first detail lands. Refetch keeps old numbers, so saving a row
 *  never blanks the cards. */
const statMemuat = computed(() => !envDetail.value && (statusDetail.value === 'pending' || statusDetail.value === 'idle'))
const acara = computed(() => (envAcara.value?.data ?? null) as Record<string, unknown> | null)
const versiAcara = computed(() => versiDari(envAcara.value))
const versiDetail = computed(() => versiDari(envDetail.value))
const terkunci = computed(() => String(acara.value?.status ?? '') === 'Event Done')

const detail = computed<DetailAcara>(() => (envDetail.value?.data ?? {
  rundown: [],
  vendors: [],
  budget: [],
  sponsors: [],
  tasks: [],
  timeline: {},
}) as DetailAcara)

// --- header actions ---
async function setStatus(st: string) {
  if (!acara.value || String(acara.value.status) === st) return
  try {
    await patchEvent('events', id.value, { status: st, statusAt: Date.now(), updatedAt: Date.now() }, versiAcara.value)
    toast.add({ title: `Status → ${st}`, color: 'success' })
    await refreshAcara()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshAcara))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}
const sheetEdit = ref(false)
async function simpanEdit(body: Record<string, unknown>) {
  sheetEdit.value = false
  if (!acara.value) return
  try {
    await patchEvent('events', id.value, { ...body, pic: acara.value.pic }, versiAcara.value)
    toast.add({ title: 'Event disimpan', color: 'success' })
    await refreshAcara()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshAcara))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}
const sheetHapus = ref(false)
// Paid orders block deletion (`hapusEvent :3024`): removing them would erase
// the trail of money that really came in. A hanging refund is named when it
// is the reason.
const { data: daftarOrder } = useDaftarEvent<OrderTiket>('orders', { event_id: id.value }, `event-rinci-orders-${id.value}`)
const { data: daftarKelas } = useDaftarEvent('ticket-classes', { event_id: id.value }, `event-rinci-kelas-${id.value}`)
const terjual = computed(() => daftarKelas.value.rows.reduce((t, c) => t + (Number(c.sold) || 0), 0))
const { data: daftarRefund } = useDaftarEvent<Refund>('refunds', {}, `event-rinci-refunds-${id.value}`)
const infoHapus = computed(() => {
  const orderIds = new Set(daftarOrder.value.rows.map(o => o.id))
  const refunds = daftarRefund.value.rows.filter(r => r.event_id === id.value || orderIds.has(r.order_id ?? ''))
  const lunas = daftarOrder.value.rows.filter(o => o.payment_status === 'Paid')
  const gantungN = lunas.filter(o => refunds.some(r => r.order_id === o.id && refundGantung(r, o))).length
  return { lunas: lunas.length, gantung: gantungN }
})
async function hapus() {
  sheetHapus.value = false
  if (infoHapus.value.lunas) return
  try {
    await removeEvent('events', id.value, versiAcara.value)
    toast.add({ title: 'Event dihapus', color: 'success' })
    await navigateTo('/event/events')
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshAcara))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- detail writes (one document, versioned) ---
const menyimpan = ref(false)
async function simpanDetail(mut: (d: DetailAcara) => void, pesan: string) {
  menyimpan.value = true
  try {
    const d = structuredClone(detail.value)
    mut(d)
    await putDetail(id.value, d, versiDetail.value)
    toast.add({ title: pesan, color: 'success' })
    await refreshDetail()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshDetail))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}

// --- timeline checklist ---
function toggleFase(fase: string) {
  if (!bolehUbah.value || terkunci.value) return
  simpanDetail((d) => {
    d.timeline = { ...(d.timeline ?? {}), [fase]: !(d.timeline ?? {})[fase] }
  }, 'Timeline diperbarui')
}

// --- generic section rows ---
type Seksi = 'rundown' | 'vendors' | 'budget' | 'sponsors' | 'tasks'
const SEKSI_JUDUL: Record<Seksi, { judul: string, ikon: string }> = {
  rundown: { judul: 'Rundown', ikon: 'i-lucide-list-ordered' },
  vendors: { judul: 'Vendor', ikon: 'i-lucide-handshake' },
  budget: { judul: 'Budget', ikon: 'i-lucide-wallet' },
  sponsors: { judul: 'Sponsor', ikon: 'i-lucide-badge-dollar-sign' },
  tasks: { judul: 'Task internal', ikon: 'i-lucide-list-checks' },
}
function tambahBaris(s: Seksi) {
  if (!bolehUbah.value || terkunci.value) return
  simpanDetail((d) => {
    if (s === 'rundown') {
      const rs = d.rundown ?? []
      const mulai = rs.length ? (rs[rs.length - 1]!.endtime || jamWIB(acara.value?.start_datetime)) : jamWIB(acara.value?.start_datetime)
      d.rundown = [...rs, { time: mulai === '—' ? '' : mulai, endtime: '', activity: '', pic: '', notes: '' }]
    }
    else if (s === 'vendors') d.vendors = [...(d.vendors ?? []), { name: '', pic: '', phone: '', cost: 0, status: 'Pending' }]
    else if (s === 'budget') d.budget = [...(d.budget ?? []), { item: '', type: 'Expense', budget: 0, actual: 0 }]
    else if (s === 'sponsors') d.sponsors = [...(d.sponsors ?? []), { name: '', package: '', nominal: 0, agreement: '', status: 'Pending' }]
    else d.tasks = [...(d.tasks ?? []), { title: '', assignee: '', due: '', done: false }]
  }, 'Baris ditambahkan')
}
function hapusBaris(s: Seksi, i: number) {
  simpanDetail((d) => {
    const l = d[s] as unknown[]
    if (i >= 0 && i < l.length) l.splice(i, 1)
  }, 'Baris dihapus')
}

// --- budget stats (`budgetStatHTML :6683`, F.18) ---
const statBudget = computed(() => {
  const rows = detail.value.budget ?? []
  const income = rows.filter(r => r.type === 'Income').reduce((a, r) => a + (Number(r.actual) || 0), 0)
  const expense = rows.filter(r => r.type !== 'Income').reduce((a, r) => a + (Number(r.actual) || 0), 0)
  return { income, expense, profit: income - expense }
})
const totalSponsor = computed(() => (detail.value.sponsors ?? [])
  .filter(s => (s.status ?? '') !== 'Cancelled')
  .reduce((a, s) => a + (Number(s.nominal) || 0), 0))
const varians = (budget: number, actual: number) => actual - budget

const STATUS_SEKSI = ['Pending', 'Confirmed', 'Paid']
</script>

<template>
  <EventGerbang lihat="events">
    <AppPage
      title="Rincian event"
      :description="String(acara?.title ?? '')"
      :back="{ label: 'Event', to: '/event/events' }"
    >
      <template
        v-if="acara"
        #actions
      >
        <AppSeg
          v-if="bolehUbah && !terkunci"
          :model-value="String(acara.status)"
          :options="[...new Set([...EVT_STATUS, String(acara.status)])].map(s => ({ value: s, label: s }))"
          @update:model-value="(v?: string) => setStatus(String(v ?? ''))"
        />
        <UButton
          v-if="bolehUbah && !terkunci"
          color="neutral"
          variant="outline"
          icon="i-lucide-pencil"
          @click="sheetEdit = true"
        >
          Edit
        </UButton>
        <UButton
          v-if="bolehUbah && !terkunci"
          color="error"
          variant="outline"
          icon="i-lucide-trash-2"
          @click="sheetHapus = true"
        >
          Hapus
        </UButton>
      </template>

      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :title="apiErrorMessage(error)"
        class="mb-4"
      />

      <template v-if="acara">
        <EventInfoDasar
          :acara="acara"
          :terjual="terjual"
        />

        <AppPanel
          v-if="acara.is_ticketed"
          title="Ticketing"
          class="mb-4"
          icon="i-lucide-ticket"
        >
          <UButton
            :to="`/event/ticketing/${id}`"
            color="primary"
            icon="i-lucide-arrow-right"
          >
            Kelola ticketing
          </UButton>
        </AppPanel>

        <AppPanel
          title="Timeline event"
          icon="i-lucide-timer"
          class="mb-4"
        >
          <ul class="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            <li
              v-for="fase in TIMELINE_PHASES"
              :key="fase"
            >
              <label class="flex cursor-pointer items-center gap-2 rounded-field border border-default px-2.5 py-1.5 text-sm">
                <UCheckbox
                  :model-value="!!(detail.timeline ?? {})[fase]"
                  :disabled="!bolehUbah || terkunci"
                  @update:model-value="toggleFase(fase)"
                />
                <span :class="(detail.timeline ?? {})[fase] ? 'text-highlighted' : 'text-muted'">{{ fase }}</span>
              </label>
            </li>
          </ul>
        </AppPanel>

        <AppPanel
          :title="SEKSI_JUDUL.rundown.judul"
          :icon="SEKSI_JUDUL.rundown.ikon"
          flush
          class="mb-4"
        >
          <template #actions>
            <UButton
              v-if="bolehUbah && !terkunci"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-plus"
              @click="tambahBaris('rundown')"
            >
              Baris
            </UButton>
          </template>
          <UTable
            :columns="[{ id: 'jam', header: 'Jam' }, { id: 'acara', header: 'Kegiatan' }, { id: 'pic', header: 'PIC' }, { id: 'cat', header: 'Catatan' }, ...(bolehUbah && !terkunci ? [{ id: 'aksi', header: '' }] : [])]"
            :data="detail.rundown ?? []"
            class="hidden lg:block"
          >
            <template #jam-cell="{ row }">
              <span class="flex items-center gap-1">
                <UInput
                  v-model="row.original.time"
                  type="time"
                  size="sm"
                  :disabled="!bolehUbah || terkunci"
                  @change="simpanDetail(() => {}, 'Rundown disimpan')"
                />
                <span class="text-muted">–</span>
                <UInput
                  v-model="row.original.endtime"
                  type="time"
                  size="sm"
                  :disabled="!bolehUbah || terkunci"
                  @change="simpanDetail(() => {}, 'Rundown disimpan')"
                />
              </span>
            </template>
            <template #acara-cell="{ row }">
              <UInput
                v-model="row.original.activity"
                size="sm"
                :disabled="!bolehUbah || terkunci"
                class="w-full"
                @change="simpanDetail(() => {}, 'Rundown disimpan')"
              />
            </template>
            <template #pic-cell="{ row }">
              <UInput
                v-model="row.original.pic"
                size="sm"
                :disabled="!bolehUbah || terkunci"
                @change="simpanDetail(() => {}, 'Rundown disimpan')"
              />
            </template>
            <template #cat-cell="{ row }">
              <UInput
                v-model="row.original.notes"
                size="sm"
                :disabled="!bolehUbah || terkunci"
                class="w-full"
                @change="simpanDetail(() => {}, 'Rundown disimpan')"
              />
            </template>
            <template #aksi-cell="{ row }">
              <UButton
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                @click="hapusBaris('rundown', row.index)"
              />
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="(r, i) in (detail.rundown ?? [])"
              :key="i"
              class="px-4 py-2.5 text-sm"
            >
              <b class="text-highlighted">{{ r.time }}{{ r.endtime ? `–${r.endtime}` : '' }}</b> {{ r.activity }}
              <span class="block text-xs text-muted">{{ r.pic }}{{ r.notes ? ` · ${r.notes}` : '' }}</span>
            </li>
          </ul>
        </AppPanel>

        <AppPanel
          :title="SEKSI_JUDUL.vendors.judul"
          :icon="SEKSI_JUDUL.vendors.ikon"
          flush
          class="mb-4"
        >
          <template #actions>
            <UButton
              v-if="bolehUbah && !terkunci"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-plus"
              @click="tambahBaris('vendors')"
            >
              Vendor
            </UButton>
          </template>
          <UTable
            :columns="[{ id: 'nama', header: 'Vendor' }, { id: 'pic', header: 'PIC' }, { id: 'hp', header: 'Telepon' }, { id: 'biaya', header: 'Biaya' }, { id: 'st', header: 'Status' }, ...(bolehUbah && !terkunci ? [{ id: 'aksi', header: '' }] : [])]"
            :data="detail.vendors ?? []"
            class="hidden lg:block"
          >
            <template #nama-cell="{ row }">
              <UInput
                v-model="row.original.name"
                size="sm"
                :disabled="!bolehUbah || terkunci"
                @change="simpanDetail(() => {}, 'Vendor disimpan')"
              />
            </template>
            <template #pic-cell="{ row }">
              <UInput
                v-model="row.original.pic"
                size="sm"
                :disabled="!bolehUbah || terkunci"
                @change="simpanDetail(() => {}, 'Vendor disimpan')"
              />
            </template>
            <template #hp-cell="{ row }">
              <UInput
                v-model="row.original.phone"
                size="sm"
                :disabled="!bolehUbah || terkunci"
                @change="simpanDetail(() => {}, 'Vendor disimpan')"
              />
            </template>
            <template #biaya-cell="{ row }">
              <UInput
                v-model.number="row.original.cost"
                type="number"
                min="0"
                size="sm"
                :disabled="!bolehUbah || terkunci"
                @change="simpanDetail(() => {}, 'Vendor disimpan')"
              />
            </template>
            <template #st-cell="{ row }">
              <USelect
                v-model="row.original.status"
                :items="STATUS_SEKSI.map(s => ({ value: s, label: s }))"
                size="sm"
                :disabled="!bolehUbah || terkunci"
                @update:model-value="simpanDetail(() => {}, 'Vendor disimpan')"
              />
            </template>
            <template #aksi-cell="{ row }">
              <UButton
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                @click="hapusBaris('vendors', row.index)"
              />
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="(v, i) in (detail.vendors ?? [])"
              :key="i"
              class="px-4 py-2.5 text-sm"
            >
              <b class="text-highlighted">{{ v.name || 'Tanpa nama' }}</b> · <span class="num">{{ rupiah(Number(v.cost) || 0) }}</span>
              <span class="block text-xs text-muted">{{ v.status }} · {{ v.pic }}</span>
            </li>
          </ul>
        </AppPanel>

        <AppPanel
          :title="SEKSI_JUDUL.budget.judul"
          :icon="SEKSI_JUDUL.budget.ikon"
          class="mb-4"
        >
          <template #actions>
            <UButton
              v-if="bolehUbah && !terkunci"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-plus"
              @click="tambahBaris('budget')"
            >
              Baris
            </UButton>
          </template>
          <AppStatGrid
            class="mb-3"
            :loading="statMemuat"
            :count="3"
          >
            <AppStat
              label="Income (actual)"
              :value="rupiah(statBudget.income)"
              icon="i-lucide-trending-up"
              tone="success"
            />
            <AppStat
              label="Expense (actual)"
              :value="rupiah(statBudget.expense)"
              icon="i-lucide-trending-down"
              tone="error"
            />
            <AppStat
              label="Profit"
              :value="rupiah(statBudget.profit)"
              icon="i-lucide-wallet"
              :tone="statBudget.profit >= 0 ? 'success' : 'error'"
            />
          </AppStatGrid>
          <UTable
            :columns="[{ id: 'item', header: 'Item' }, { id: 'tipe', header: 'Tipe' }, { id: 'anggaran', header: 'Budget' }, { id: 'aktual', header: 'Actual' }, { id: 'var', header: 'Var' }, ...(bolehUbah && !terkunci ? [{ id: 'aksi', header: '' }] : [])]"
            :data="detail.budget ?? []"
            class="hidden lg:block"
          >
            <template #item-cell="{ row }">
              <UInput
                v-model="row.original.item"
                size="sm"
                :disabled="!bolehUbah || terkunci"
                @change="simpanDetail(() => {}, 'Budget disimpan')"
              />
            </template>
            <template #tipe-cell="{ row }">
              <USelect
                v-model="row.original.type"
                :items="[{ value: 'Expense', label: 'Expense' }, { value: 'Income', label: 'Income' }]"
                size="sm"
                :disabled="!bolehUbah || terkunci"
                @update:model-value="simpanDetail(() => {}, 'Budget disimpan')"
              />
            </template>
            <template #anggaran-cell="{ row }">
              <UInput
                v-model.number="row.original.budget"
                type="number"
                size="sm"
                :disabled="!bolehUbah || terkunci"
                @change="simpanDetail(() => {}, 'Budget disimpan')"
              />
            </template>
            <template #aktual-cell="{ row }">
              <UInput
                v-model.number="row.original.actual"
                type="number"
                size="sm"
                :disabled="!bolehUbah || terkunci"
                @change="simpanDetail(() => {}, 'Budget disimpan')"
              />
            </template>
            <template #var-cell="{ row }">
              <b
                class="num"
                :class="varians(Number(row.original.budget) || 0, Number(row.original.actual) || 0) > 0 ? 'text-error' : 'text-success'"
              >{{ rupiah(varians(Number(row.original.budget) || 0, Number(row.original.actual) || 0)) }}</b>
            </template>
            <template #aksi-cell="{ row }">
              <UButton
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                @click="hapusBaris('budget', row.index)"
              />
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="(b, i) in (detail.budget ?? [])"
              :key="i"
              class="px-4 py-2.5 text-sm"
            >
              <b class="text-highlighted">{{ b.item || 'Tanpa nama' }}</b> · {{ b.type }} · <span class="num">{{ rupiah(Number(b.actual) || 0) }}</span>
            </li>
          </ul>
        </AppPanel>

        <AppPanel
          :title="SEKSI_JUDUL.sponsors.judul"
          :icon="SEKSI_JUDUL.sponsors.ikon"
          flush
          class="mb-4"
        >
          <template #actions>
            <UButton
              v-if="bolehUbah && !terkunci"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-plus"
              @click="tambahBaris('sponsors')"
            >
              Sponsor
            </UButton>
          </template>
          <UTable
            :columns="[{ id: 'nama', header: 'Sponsor' }, { id: 'paket', header: 'Paket' }, { id: 'nom', header: 'Nominal' }, { id: 'agr', header: 'Agreement' }, { id: 'st', header: 'Status' }, ...(bolehUbah && !terkunci ? [{ id: 'aksi', header: '' }] : [])]"
            :data="detail.sponsors ?? []"
            class="hidden lg:block"
          >
            <template #nama-cell="{ row }">
              <UInput
                v-model="row.original.name"
                size="sm"
                :disabled="!bolehUbah || terkunci"
                @change="simpanDetail(() => {}, 'Sponsor disimpan')"
              />
            </template>
            <template #paket-cell="{ row }">
              <UInput
                v-model="row.original.package"
                size="sm"
                :disabled="!bolehUbah || terkunci"
                @change="simpanDetail(() => {}, 'Sponsor disimpan')"
              />
            </template>
            <template #nom-cell="{ row }">
              <UInput
                v-model.number="row.original.nominal"
                type="number"
                min="0"
                size="sm"
                :disabled="!bolehUbah || terkunci"
                @change="simpanDetail(() => {}, 'Sponsor disimpan')"
              />
            </template>
            <template #agr-cell="{ row }">
              <UInput
                v-model="row.original.agreement"
                size="sm"
                :disabled="!bolehUbah || terkunci"
                @change="simpanDetail(() => {}, 'Sponsor disimpan')"
              />
            </template>
            <template #st-cell="{ row }">
              <USelect
                v-model="row.original.status"
                :items="STATUS_SEKSI.map(s => ({ value: s, label: s }))"
                size="sm"
                :disabled="!bolehUbah || terkunci"
                @update:model-value="simpanDetail(() => {}, 'Sponsor disimpan')"
              />
            </template>
            <template #aksi-cell="{ row }">
              <UButton
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                @click="hapusBaris('sponsors', row.index)"
              />
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="(sp, i) in (detail.sponsors ?? [])"
              :key="i"
              class="space-y-1.5 px-4 py-3"
            >
              <UInput
                v-model="sp.name"
                size="sm"
                placeholder="Sponsor"
                :disabled="!bolehUbah || terkunci"
                @change="simpanDetail(() => {}, 'Sponsor disimpan')"
              />
              <div class="grid grid-cols-2 gap-1.5">
                <UInput
                  v-model="sp.package"
                  size="sm"
                  placeholder="Paket"
                  :disabled="!bolehUbah || terkunci"
                  @change="simpanDetail(() => {}, 'Sponsor disimpan')"
                />
                <UInput
                  v-model.number="sp.nominal"
                  type="number"
                  min="0"
                  size="sm"
                  placeholder="Nominal"
                  :disabled="!bolehUbah || terkunci"
                  @change="simpanDetail(() => {}, 'Sponsor disimpan')"
                />
                <UInput
                  v-model="sp.agreement"
                  size="sm"
                  placeholder="Agreement"
                  :disabled="!bolehUbah || terkunci"
                  @change="simpanDetail(() => {}, 'Sponsor disimpan')"
                />
                <USelect
                  v-model="sp.status"
                  :items="STATUS_SEKSI.map(s => ({ value: s, label: s }))"
                  size="sm"
                  :disabled="!bolehUbah || terkunci"
                  @update:model-value="simpanDetail(() => {}, 'Sponsor disimpan')"
                />
              </div>
              <UButton
                v-if="bolehUbah && !terkunci"
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                label="Hapus"
                @click="hapusBaris('sponsors', i)"
              />
            </li>
            <li
              v-if="!(detail.sponsors ?? []).length"
              class="px-4 py-4 text-center text-sm text-dimmed"
            >
              Belum ada sponsor.
            </li>
          </ul>
          <p class="px-4 py-2.5 text-right text-sm">
            Total sponsor masuk: <b class="text-highlighted num">{{ rupiah(totalSponsor) }}</b>
          </p>
        </AppPanel>

        <AppPanel
          :title="SEKSI_JUDUL.tasks.judul"
          :icon="SEKSI_JUDUL.tasks.ikon"
          class="mb-4"
        >
          <template #actions>
            <UButton
              v-if="bolehUbah && !terkunci"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-plus"
              @click="tambahBaris('tasks')"
            >
              Task
            </UButton>
          </template>
          <ul class="space-y-1.5">
            <li
              v-for="(t, i) in (detail.tasks ?? [])"
              :key="i"
              class="flex items-center gap-2 rounded-field border border-default px-2.5 py-1.5 text-sm"
            >
              <UCheckbox
                v-model="t.done"
                :disabled="!bolehUbah || terkunci"
                @update:model-value="simpanDetail(() => {}, 'Task diperbarui')"
              />
              <UInput
                v-model="t.title"
                size="sm"
                placeholder="Judul task"
                :disabled="!bolehUbah || terkunci"
                class="flex-1"
                @change="simpanDetail(() => {}, 'Task diperbarui')"
              />
              <UInput
                v-model="t.assignee"
                size="sm"
                placeholder="Penanggung jawab"
                :disabled="!bolehUbah || terkunci"
                class="hidden w-36 sm:block"
                @change="simpanDetail(() => {}, 'Task diperbarui')"
              />
              <UInput
                v-model="t.due"
                type="date"
                size="sm"
                :disabled="!bolehUbah || terkunci"
                class="hidden w-36 md:block"
                @change="simpanDetail(() => {}, 'Task diperbarui')"
              />
              <UButton
                v-if="bolehUbah && !terkunci"
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                @click="hapusBaris('tasks', i)"
              />
            </li>
          </ul>
          <p
            v-if="!(detail.tasks ?? []).length"
            class="py-4 text-center text-sm text-dimmed"
          >
            Belum ada task.
          </p>
        </AppPanel>
      </template>

      <ResponsiveSheet
        v-model:open="sheetEdit"
        title="Edit event"
      >
        <EventForm
          v-if="acara"
          :awal="acara as never"
          :pic-terkunci="namaSaya"
          @simpan="simpanEdit($event)"
          @batal="sheetEdit = false"
        />
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="sheetHapus"
        title="Hapus event?"
      >
        <p
          v-if="infoHapus.lunas"
          class="text-sm text-muted"
        >
          Event <b class="text-highlighted">{{ String(acara?.title ?? '') }}</b> sudah punya
          <b class="text-highlighted num">{{ angka(infoHapus.lunas) }} pesanan lunas</b>.
          Menghapusnya berarti menghapus jejak uang yang benar-benar masuk.
        </p>
        <p
          v-if="infoHapus.gantung"
          class="mt-2 text-sm text-muted"
        >
          <b class="text-highlighted num">{{ angka(infoHapus.gantung) }}</b> di antaranya refundnya sudah
          disetujui tapi belum diselesaikan — buka Ticketing › Penjualan lalu tekan Selesaikan refund (manajemen).
        </p>
        <p
          v-if="infoHapus.lunas"
          class="mt-2 text-sm text-muted"
        >
          Kalau acaranya batal, selesaikan lewat refund pada pesanan itu dulu. Kalau cuma ingin
          menyembunyikannya dari daftar aktif, ubah statusnya jadi Event Done.
        </p>
        <p
          v-else
          class="text-sm text-muted"
        >
          Event ini dihapus. Rincian (rundown, vendor, budget, sponsor, task) ikut terhapus.
        </p>
        <template #footer>
          <UButton
            v-if="!infoHapus.lunas"
            color="error"
            @click="hapus()"
          >
            Ya, hapus
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            @click="sheetHapus = false"
          >
            {{ infoHapus.lunas ? 'Tutup' : 'Batal' }}
          </UButton>
        </template>
      </ResponsiveSheet>
    </AppPage>
  </EventGerbang>
</template>
