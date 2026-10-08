<!--
  History detail — banner, basic info, achievement (ticket omzet, sold,
  day-H attendance, best class) and P/L when there is a budget
  (`renderHistoryDetail :11276`). The old hard-coded two-sentence evaluation
  stays removed (`:11281`).
-->
<script setup lang="ts">
import { getDetail, getEvent, listCheckins, useDaftarEvent } from '~/composables/useEvent'
import { ringkasPenjualan } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { angka, rupiah, tglPanjang } from '~/utils/format'

definePageMeta({ access: ['event'] })

const route = useRoute()
const id = computed(() => String(route.params.id ?? ''))

const { data: envAcara, error } = useAsyncData(`event-hist-acara-${id.value}`, () => getEvent('events', id.value))
const { data: envDetail } = useAsyncData(`event-hist-detail-${id.value}`, () => getDetail(id.value).catch(() => null))
const acara = computed(() => envAcara.value?.data as Record<string, unknown> | undefined)
const detail = computed(() => envDetail.value?.data as Record<string, { item: string, type: string, budget: number, actual: number }[]> | { budget?: { item: string, type: string, budget: number, actual: number }[] } | undefined)

const q = computed<Record<string, string>>(() => ({ event_id: id.value }))
const { data: daftarKelas } = useDaftarEvent('ticket-classes', q, `event-hist-kelas-${id.value}`)
const { data: daftarTiket } = useDaftarEvent('tickets', q, `event-hist-tiket-${id.value}`)
const { data: checkins } = useAsyncData(`event-hist-ci-${id.value}`, () => listCheckins().then(r => r.data))

const kelas = computed(() => daftarKelas.value.rows.map(r => ({ id: String(r.id), event_id: String(r.event_id ?? ''), name: String(r.name ?? ''), price: Number(r.price) || 0 })))
const tiket = computed(() => daftarTiket.value.rows.map(r => ({ id: String(r.id), event_id: String(r.event_id ?? ''), ticket_class_id: String(r.ticket_class_id ?? ''), status: String(r.status ?? '') })))
const ringkas = computed(() => ringkasPenjualan(id.value, tiket.value as never, kelas.value as never))
const hadir = computed(() => {
  const ids = new Set(tiket.value.map(t => t.id))
  return (checkins.value ?? []).filter(c => ids.has(c.ticket_id) && (c.result ?? 'Valid') === 'Valid').length
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
      <AppPanel
        title="Informasi dasar"
        icon="i-lucide-info"
        class="mb-4"
      >
        <div class="grid gap-x-6 gap-y-2 text-sm lg:grid-cols-2">
          <p><b class="text-highlighted">{{ acara.title }}</b> · {{ acara.category }}</p>
          <p class="text-muted">
            {{ tglPanjang(String(acara.start_datetime ?? '').slice(0, 10)) }}
          </p>
          <p class="text-muted">
            Venue: {{ acara.venue || '—' }} · PIC: {{ acara.pic || '—' }}
          </p>
        </div>
      </AppPanel>

      <AppSectionTitle title="Pencapaian" />
      <AppStatGrid class="mb-4">
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
        <AppStatGrid>
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
</template>
