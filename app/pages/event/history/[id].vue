<!--
  History detail — banner, basic info, achievement (ticket omzet, sold,
  day-H attendance, best class) and P/L when there is a budget
  (`renderHistoryDetail :11276`). The old hard-coded two-sentence evaluation
  stays removed (`:11281`).
-->
<script setup lang="ts">
import type { Checkin, OrderTiket } from '~/composables/useEvent'
import { getDetail, getEvent, listCheckins, useDaftarEvent } from '~/composables/useEvent'
import { idCheckin, petaOrder, ringkasPenjualan } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { angka, rupiah } from '~/utils/format'

definePageMeta({ access: ['event'] })

const route = useRoute()
const id = computed(() => String(route.params.id ?? ''))

const { data: envAcara, error } = useAsyncData(`event-hist-acara-${id.value}`, () => getEvent('events', id.value))
const { data: envDetail, status: statusDetail } = useAsyncData(`event-hist-detail-${id.value}`, () => getDetail(id.value).catch(() => null))
const acara = computed(() => envAcara.value?.data as Record<string, unknown> | undefined)
const detail = computed(() => envDetail.value?.data as Record<string, { item: string, type: string, budget: number, actual: number }[]> | { budget?: { item: string, type: string, budget: number, actual: number }[] } | undefined)

const q = computed<Record<string, string>>(() => ({ event_id: id.value }))
const { data: daftarKelas } = useDaftarEvent('ticket-classes', q, `event-hist-kelas-${id.value}`)
const { data: daftarTiket, status: statusTiket } = useDaftarEvent('tickets', q, `event-hist-tiket-${id.value}`)
const { data: daftarOrder } = useDaftarEvent<OrderTiket>('orders', q, `event-hist-order-${id.value}`)

/** First-load skeleton for both stat grids below (sales + profit): skeleton
 *  cells stand in until the first answers land. Refetch keeps old numbers,
 *  so the cards never blank. */
const statMemuat = computed(() => (!daftarTiket.value.rows.length && (statusTiket.value === 'pending' || statusTiket.value === 'idle'))
  || (!envDetail.value && (statusDetail.value === 'pending' || statusDetail.value === 'idle')))
const orderById = computed(() => petaOrder(daftarOrder.value.rows))

// GET /checkins returns the newest 2000 only (`meta.total` = all): an old event
// slowly fell out of that window and showed "hadir 0". When the window is
// cut, read this event's tickets one by one (`?ticket_id=`, a few at a time).
async function muatCheckinAcara(ids: string[]): Promise<Checkin[]> {
  const r = await listCheckins()
  const total = Number((r.meta as { total?: unknown } | undefined)?.total ?? r.data.length)
  if (total <= r.data.length) return r.data
  const out: Checkin[] = []
  for (let i = 0; i < ids.length; i += 6) {
    const bagian = await Promise.all(ids.slice(i, i + 6).map(tid => listCheckins({ ticket_id: tid }).then(x => x.data)))
    for (const b of bagian) out.push(...b)
  }
  return out
}

const kelas = computed(() => daftarKelas.value.rows.map(r => ({ id: String(r.id), event_id: String(r.event_id ?? ''), name: String(r.name ?? ''), price: Number(r.price) || 0 })))
const tiket = computed(() => daftarTiket.value.rows.map(r => ({ id: String(r.id), event_id: String(r.event_id ?? ''), ticket_class_id: String(r.ticket_class_id ?? ''), status: String(r.status ?? ''), order_id: String(r.order_id ?? ''), order_item_id: String(r.order_item_id ?? '') })))
const ringkas = computed(() => ringkasPenjualan(id.value, tiket.value, kelas.value, orderById.value))
const idTiket = computed(() => tiket.value.map(t => t.id).sort())
const { data: checkins } = useAsyncData(`event-hist-ci-${id.value}`, () => muatCheckinAcara(idTiket.value), { watch: [idTiket], default: () => [] as Checkin[] })
// presence rule: newest row per ticket, cancellations excluded
const hadir = computed(() => {
  const masuk = idCheckin(checkins.value ?? [])
  return tiket.value.filter(t => masuk.has(t.id)).length
})
const budget = computed(() => {
  const d = detail.value as { budget?: { item: string, type: string, budget: number, actual: number }[] } | undefined
  return d?.budget ?? []
})
const pl = computed(() => {
  const income = budget.value.filter(b => b.type === 'Income').reduce((a, b) => a + (Number(b.actual) || 0), 0)
  const expense = budget.value.filter(b => b.type !== 'Income').reduce((a, b) => a + (Number(b.actual) || 0), 0)
  return { income, expense, profit: income - expense }
})
</script>

<template>
  <EventGerbang lihat="events">
    <AppPage
      :title="String(acara?.title ?? 'Arsip event')"
      description="Pencapaian & laba-rugi event selesai"
      :back="{ label: 'History', to: '/event/history' }"
    >
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
          :terjual="ringkas.tiketSah"
        />

        <AppSectionTitle title="Pencapaian" />
        <AppStatGrid
          class="mb-4"
          :loading="statMemuat"
          :count="4"
        >
          <AppStat
            label="Omzet tiket"
            :value="rupiah(ringkas.omzet)"
            icon="i-lucide-banknote"
            tone="gold"
          />
          <AppStat
            label="Tiket terjual"
            :value="angka(ringkas.tiketSah)"
            icon="i-lucide-ticket"
            tone="info"
          />
          <AppStat
            label="Hadir hari-H"
            :value="angka(hadir)"
            icon="i-lucide-scan-line"
            tone="success"
          />
          <AppStat
            label="Kategori terlaku"
            :value="ringkas.perKelas[0]?.nama ?? '—'"
            :sub="ringkas.perKelas[0] ? `${angka(ringkas.perKelas[0].n)} tiket` : ''"
            icon="i-lucide-trophy"
            tone="vip"
            wrap
          />
        </AppStatGrid>

        <template v-if="budget.length">
          <AppSectionTitle title="Laba-rugi" />
          <AppStatGrid
            :loading="statMemuat"
            :count="3"
          >
            <AppStat
              label="Income"
              :value="rupiah(pl.income)"
              icon="i-lucide-trending-up"
              tone="success"
            />
            <AppStat
              label="Expense"
              :value="rupiah(pl.expense)"
              icon="i-lucide-trending-down"
              tone="error"
            />
            <AppStat
              label="Profit"
              :value="rupiah(pl.profit)"
              icon="i-lucide-wallet"
              :tone="pl.profit >= 0 ? 'success' : 'error'"
            />
          </AppStatGrid>
        </template>
      </template>
    </AppPage>
  </EventGerbang>
</template>
