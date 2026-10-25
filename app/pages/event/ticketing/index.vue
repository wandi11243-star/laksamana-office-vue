<!--
  Ticketing (EMS) — ticketed approved events with sales progress
  (`renderTicketing`, event/index.html:6841). Only `is_ticketed && status !==
  'Planning'` events are listed (F.1). Warning at ≥90% sold.
-->
<script setup lang="ts">
import type { Acara, OrderTiket } from '~/composables/useEvent'
import { useDaftarEvent } from '~/composables/useEvent'
import { fmtTglEms } from '~/utils/event-hitung'
import { angka, rupiah } from '~/utils/format'
import { STATUS_IKON_EVENT, STATUS_WARNA_EVENT } from '~/utils/status-event'

definePageMeta({ access: ['event'] })

const tab = ref<'upcoming' | 'riwayat'>('upcoming')
const { data: daftar, status } = useDaftarEvent<Acara>('events', {}, 'event-ticketing')
const { data: daftarKelas } = useDaftarEvent('ticket-classes', {}, 'event-ticketing-classes')
const { data: daftarOrder } = useDaftarEvent<OrderTiket>('orders', {}, 'event-ticketing-orders')

// stored order, like the old page — no sorting
const bertiket = computed(() => daftar.value.rows.filter(e => e.is_ticketed && String(e.status) !== 'Planning'))
const selesai = computed(() => bertiket.value.filter(e => String(e.status) === 'Event Done'))
const jalan = computed(() => bertiket.value.filter(e => String(e.status) !== 'Event Done'))
const list = computed(() => (tab.value === 'riwayat' ? selesai.value : jalan.value))
const n = (x: number) => (x ? ` (${x})` : '')

const progres = (e: Acara) => {
  const ks = daftarKelas.value.rows.filter(c => String(c.event_id) === e.id)
  const kuota = ks.reduce((a, c) => a + (Number(c.quota) || 0), 0)
  const laku = ks.reduce((a, c) => a + (Number(c.sold) || 0), 0)
  // revenue = paid orders of the event (`rev`, :6862)
  const omzet = daftarOrder.value.rows.filter(o => String(o.event_id) === e.id && o.payment_status === 'Paid')
    .reduce((a, o) => a + (Number(o.total) || 0), 0)
  // kartuKategoriHTML (:6880): only with 2+ classes, best sellers first, 4 rows + the rest
  const urut = ks.slice().sort((a, b) => (Number(b.sold) || 0) - (Number(a.sold) || 0))
  const kat = ks.length < 2 ? [] : urut.slice(0, 4).map(c => ({ nama: String(c.name ?? ''), laku: Number(c.sold) || 0, kuota: Number(c.quota) || 0 }))
  const sisa = ks.length < 2 ? [] : urut.slice(4)
  return { kuota, laku, pct: kuota ? Math.round(laku / kuota * 100) : 0, omzet, kat, sisaN: sisa.length, sisaLaku: sisa.reduce((a, c) => a + (Number(c.sold) || 0), 0) }
}
</script>

<template>
  <EventGerbang lihat="ticketing">
    <AppPage
      title="Ticketing"
      description="Event ber-tiket yang sudah disetujui"
    >
      <div class="mb-4">
        <AppSeg
          v-model="tab"
          :options="[{ value: 'upcoming', label: `Upcoming${n(jalan.length)}` }, { value: 'riwayat', label: `Riwayat Event${n(selesai.length)}` }]"
        />
      </div>

      <div
        v-if="status === 'pending'"
        class="grid gap-3 md:grid-cols-2"
      >
        <USkeleton
          v-for="i in 2"
          :key="i"
          class="h-44"
        />
      </div>
      <div
        v-else
        class="grid gap-3 md:grid-cols-2"
      >
        <ULink
          v-for="e in list"
          :key="e.id"
          :to="`/event/ticketing/${e.id}`"
          class="block"
        >
          <AppPanel class="h-full transition hover:ring-1 hover:ring-primary-300">
            <div class="flex items-start justify-between gap-2">
              <span class="flex min-w-0 items-center gap-2 text-base font-bold text-highlighted">
                <EventPosterMini
                  :poster="e.poster_img"
                  :size="22"
                />
                <span class="truncate">{{ e.title }}</span>
              </span>
              <AppStatus
                :color="STATUS_WARNA_EVENT[String(e.status)] ?? 'neutral'"
                :icon="STATUS_IKON_EVENT[String(e.status)]"
                size="sm"
              >
                {{ e.status }}
              </AppStatus>
            </div>
            <p class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <UIcon
                name="i-lucide-calendar"
                class="size-3.5"
              />{{ fmtTglEms(e.start_datetime) }} ·
              <UIcon
                name="i-lucide-map-pin"
                class="size-3.5"
              />{{ e.venue || '—' }}
            </p>
            <div class="mt-2.5 flex items-baseline justify-between text-sm">
              <span class="num">{{ angka(progres(e).laku) }}/{{ angka(progres(e).kuota) }} tiket ({{ progres(e).pct }}%)</span>
              <b class="text-primary-700 num">{{ rupiah(progres(e).omzet) }}</b>
            </div>
            <div class="mt-1 h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                class="h-full rounded-full bg-primary-400"
                :style="{ width: `${Math.min(100, progres(e).pct)}%` }"
              />
            </div>
            <ul
              v-if="progres(e).kat.length"
              class="mt-2 space-y-0.5 text-xs"
            >
              <li
                v-for="k in progres(e).kat"
                :key="k.nama"
                class="flex justify-between gap-2"
              >
                <span class="truncate">{{ k.nama }}</span>
                <span class="shrink-0 num">{{ angka(k.laku) }}<span
                  v-if="k.kuota"
                  class="text-muted"
                >/{{ angka(k.kuota) }}</span><b
                  v-if="k.kuota && k.laku >= k.kuota"
                  class="ms-1 text-error"
                >PENUH</b></span>
              </li>
              <li
                v-if="progres(e).sisaN"
                class="flex justify-between gap-2 text-muted"
              >
                <span>+{{ progres(e).sisaN }} kategori lain</span>
                <span class="num">{{ angka(progres(e).sisaLaku) }}</span>
              </li>
            </ul>
            <p
              v-if="progres(e).pct >= 90"
              class="mt-1.5 flex items-center gap-1 text-xs font-semibold text-error"
            >
              <UIcon
                name="i-lucide-triangle-alert"
                class="size-3.5"
              /> Tiket hampir habis!
            </p>
          </AppPanel>
        </ULink>
      </div>
      <p
        v-if="!list.length && status !== 'pending'"
        class="py-10 text-center text-sm text-dimmed"
      >
        {{ tab === 'riwayat' ? 'Belum ada event yang selesai.' : 'Belum ada event ber-tiket yang berjalan.' }}
      </p>
    </AppPage>
  </EventGerbang>
</template>
