<!--
  Ticketing (EMS) — ticketed approved events with sales progress
  (`event/index.html:6697-6755`). Only `is_ticketed && status !== 'Planning'`
  events are listed (F.1). Warning at ≥90% sold (`:6712`).
-->
<script setup lang="ts">
import type { Acara } from '~/composables/useEvent'
import { useDaftarEvent } from '~/composables/useEvent'
import { ringkasPenjualan, tglWIB } from '~/utils/event-hitung'
import { angka, rupiah } from '~/utils/format'

definePageMeta({ access: ['event'] })

const tab = ref<'upcoming' | 'riwayat'>('upcoming')
const { data: daftar, status, refresh } = useDaftarEvent<Acara>('events', {}, 'event-ticketing')
const { data: daftarKelas } = useDaftarEvent('ticket-classes', {}, 'event-ticketing-classes')
const { data: daftarTiket } = useDaftarEvent('tickets', {}, 'event-ticketing-tickets')

const kelas = computed(() => daftarKelas.value.rows.map(r => ({
  id: String(r.id),
  event_id: String(r.event_id ?? ''),
  name: String(r.name ?? ''),
  price: Number(r.price) || 0,
})))
const tiket = computed(() => daftarTiket.value.rows.map(r => ({
  id: String(r.id),
  event_id: String(r.event_id ?? ''),
  ticket_class_id: String(r.ticket_class_id ?? ''),
  status: String(r.status ?? ''),
})))

const list = computed(() => daftar.value.rows
  .filter(e => e.is_ticketed && String(e.status) !== 'Planning')
  .filter(e => (tab.value === 'upcoming' ? !['Event Done', 'Finished'].includes(String(e.status)) : ['Event Done', 'Finished'].includes(String(e.status))))
  .sort((a, b) => String(a.start_datetime ?? '').localeCompare(String(b.start_datetime ?? ''))))

const progres = (e: Acara) => {
  const ks = daftarKelas.value.rows.filter(c => String(c.event_id) === e.id)
  const kuota = ks.reduce((a, c) => a + (Number(c.quota) || 0), 0)
  const laku = ks.reduce((a, c) => a + (Number(c.sold) || 0), 0)
  const ringkas = ringkasPenjualan(e.id, tiket.value as never, kelas.value as never)
  return { kuota, laku, pct: kuota ? Math.round(laku / kuota * 100) : 0, omzet: ringkas.omzet, top: ringkas.perKelas.slice(0, 4) }
}
</script>

<template>
  <EventGerbang lihat="ticketing">
  <AppPage
    title="Ticketing"
    description="Event ber-tiket yang sudah disetujui"
  >
    <template #actions>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-refresh-cw"
        :loading="status === 'pending'"
        @click="refresh()"
      >
        Muat ulang
      </UButton>
    </template>

    <div class="mb-4">
      <AppSeg
        v-model="tab"
        :options="[{ value: 'upcoming', label: 'Upcoming' }, { value: 'riwayat', label: 'Riwayat event' }]"
      />
    </div>

    <div
      v-if="status === 'pending'"
      class="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
    >
      <USkeleton
        v-for="i in 3"
        :key="i"
        class="h-44"
      />
    </div>
    <div
      v-else
      class="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
    >
      <AppPanel
        v-for="e in list"
        :key="e.id"
      >
        <ULink
          :to="`/event/ticketing/${e.id}`"
          class="block truncate text-base font-bold text-highlighted hover:text-primary-700"
        >
          {{ e.title }}
        </ULink>
        <p class="mt-0.5 text-xs text-muted">
          {{ tglWIB(e.start_datetime) }} · {{ e.venue || '—' }}
        </p>
        <div class="mt-2 flex items-baseline justify-between text-sm">
          <span class="font-semibold text-highlighted num">{{ angka(progres(e).laku) }}/{{ angka(progres(e).kuota) }} ({{ progres(e).pct }}%)</span>
          <span class="font-bold text-primary-700 num">{{ rupiah(progres(e).omzet) }}</span>
        </div>
        <div class="mt-1 h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            class="h-full rounded-full bg-primary-400"
            :style="{ width: `${Math.min(100, progres(e).pct)}%` }"
          />
        </div>
        <p
          v-if="progres(e).pct >= 90"
          class="mt-1.5 flex items-center gap-1 text-xs font-semibold text-warning"
        >
          <UIcon
            name="i-lucide-triangle-alert"
            class="size-3.5"
          /> Tiket hampir habis!
        </p>
        <ul
          v-if="progres(e).top.length"
          class="mt-1.5 space-y-0.5 text-xs text-muted"
        >
          <li
            v-for="k in progres(e).top"
            :key="k.nama"
            class="flex justify-between gap-2"
          >
            <span class="truncate">{{ k.nama }}</span>
            <span class="shrink-0 num">{{ angka(k.n) }} · {{ rupiah(k.rp) }}</span>
          </li>
        </ul>
      </AppPanel>
    </div>
    <p
      v-if="!list.length && status !== 'pending'"
      class="py-10 text-center text-sm text-dimmed"
    >
      Belum ada event ber-tiket di sini.
    </p>
  </AppPage>
  </EventGerbang>
</template>
