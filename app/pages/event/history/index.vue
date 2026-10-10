<!--
  Event History — read-only archive of finished events (`:11202-11260`).
  Archive = status Event Done or Finished (`:11214`). "Make similar" copies
  the shape of the show (title, category, theme, venue, capacity, PIC,
  description, ticket flag) WITHOUT dates, classes, maps or sales — always
  born Planning (`:11263`).
-->
<script setup lang="ts">
import type { Acara } from '~/composables/useEvent'
import { createEvent, useDaftarEvent } from '~/composables/useEvent'
import { ringkasPenjualan, tglWIB } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { angka, rupiah, tglPanjang } from '~/utils/format'

definePageMeta({ access: ['event'] })

const toast = useToast()
const me = useMe()
const bolehUbah = computed(() => bolehUbahEvent('planning', peranEvent(me.value)))

const fTahun = ref('semua')
const fKategori = ref('semua')
const { data: daftar, status, refresh, error } = useDaftarEvent<Acara>('events', {}, 'event-history')
const { data: daftarKelas } = useDaftarEvent('ticket-classes', {}, 'event-history-classes')
const { data: daftarTiket } = useDaftarEvent('tickets', {}, 'event-history-tickets')

const arsip = computed(() => daftar.value.rows
  .filter(e => ['Event Done', 'Finished'].includes(String(e.status)))
  .filter(e => (fTahun.value === 'semua' || tglWIB(e.start_datetime).slice(0, 4) === fTahun.value))
  .filter(e => (fKategori.value === 'semua' || String(e.category ?? '') === fKategori.value))
  .sort((a, b) => String(b.start_datetime ?? '').localeCompare(String(a.start_datetime ?? ''))))

const tahunAda = computed(() => [...new Set(daftar.value.rows.map(e => tglWIB(e.start_datetime).slice(0, 4)).filter(Boolean))].sort().reverse())
const kategoriAda = computed(() => [...new Set(daftar.value.rows.map(e => String(e.category ?? '')).filter(Boolean))].sort())

const kelas = computed(() => daftarKelas.value.rows.map(r => ({ id: String(r.id), event_id: String(r.event_id ?? ''), name: String(r.name ?? ''), price: Number(r.price) || 0 })))
const tiket = computed(() => daftarTiket.value.rows.map(r => ({ id: String(r.id), event_id: String(r.event_id ?? ''), ticket_class_id: String(r.ticket_class_id ?? ''), status: String(r.status ?? '') })))
const ringkas = (e: Acara) => ringkasPenjualan(e.id, tiket.value as never, kelas.value as never)

async function buatSerupa(e: Acara) {
  try {
    const r = await createEvent('events', {
      title: e.title,
      category: e.category,
      theme: e.theme,
      venue: e.venue,
      capacity: e.capacity,
      pic: e.pic,
      description: e.description,
      is_ticketed: e.is_ticketed,
      status: 'Planning',
      createdBy: me.value?.name ?? '',
      createdById: me.value?.id ?? '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    toast.add({ title: 'Event serupa dibuat sebagai rencana', color: 'success' })
    await navigateTo(`/event/events/${(r.data as { id: string }).id}`)
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}
</script>

<template>
  <AppPage
    title="Event history"
    description="Arsip event selesai (read-only)"
    :back="{ label: 'Perencanaan', to: '/event/planning' }"
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

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      :title="apiErrorMessage(error)"
      class="mb-4"
    />

    <AppPanel class="mb-4">
      <AppFilterGrid>
        <UFormField label="Tahun">
          <USelect
            v-model="fTahun"
            :items="[{ value: 'semua', label: 'Semua tahun' }, ...tahunAda.map(t => ({ value: t, label: t }))]"
          />
        </UFormField>
        <UFormField label="Kategori">
          <USelect
            v-model="fKategori"
            :items="[{ value: 'semua', label: 'Semua kategori' }, ...kategoriAda.map(c => ({ value: c, label: c }))]"
          />
        </UFormField>
      </AppFilterGrid>
    </AppPanel>

    <div
      v-if="status === 'pending'"
      class="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
    >
      <USkeleton
        v-for="i in 3"
        :key="i"
        class="h-40"
      />
    </div>
    <div
      v-else
      class="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
    >
      <AppPanel
        v-for="e in arsip"
        :key="e.id"
      >
        <ULink
          :to="`/event/history/${e.id}`"
          class="block truncate text-base font-bold text-highlighted hover:text-primary-700"
        >
          {{ e.title }}
        </ULink>
        <p class="mt-0.5 text-xs text-muted">
          {{ tglPanjang(tglWIB(e.start_datetime)) }} · {{ e.venue || '—' }}
        </p>
        <p class="mt-1.5 text-sm num">
          {{ rupiah(ringkas(e).omzet) }} ·
          {{ angka(ringkas(e).tiketSah) }} terjual
        </p>
        <UButton
          v-if="bolehUbah"
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-rotate-ccw"
          class="mt-2"
          @click="buatSerupa(e)"
        >
          Buat event serupa
        </UButton>
      </AppPanel>
    </div>
    <p
      v-if="!arsip.length && status !== 'pending'"
      class="py-10 text-center text-sm text-dimmed"
    >
      Arsip masih kosong.
    </p>
  </AppPage>
</template>
