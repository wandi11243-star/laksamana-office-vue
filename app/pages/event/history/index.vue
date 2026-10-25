<!--
  Event History — read-only archive of finished events (`renderHistory`
  :11405). Archive = status Event Done or Finished, newest first. Card numbers
  come from `breakdownEventEms`: paid orders, class `sold`, checked-in tickets.
  "Buat event serupa" (`buatEventLagi` :11466) opens the new-plan form filled
  with the shape of the show (title + "(ulang)", category, theme, venue,
  capacity, PIC, description, ticket flag) — never dates, classes or sales.
-->
<script setup lang="ts">
import type { Acara, OrderTiket } from '~/composables/useEvent'
import { useDaftarEvent } from '~/composables/useEvent'
import { EVT_CATS, fmtTglEms, tglWIB } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { angka, rupiah } from '~/utils/format'

definePageMeta({ access: ['event'] })

const toast = useToast()
const me = useMe()
const bolehUbah = computed(() => bolehUbahEvent('planning', peranEvent(me.value)))

const fTahun = ref('semua')
const fKategori = ref('semua')
const { data: daftar, status, error } = useDaftarEvent<Acara>('events', {}, 'event-history')
const { data: daftarKelas } = useDaftarEvent('ticket-classes', {}, 'event-history-classes')
const { data: daftarTiket } = useDaftarEvent('tickets', {}, 'event-history-tickets')
const { data: daftarOrder } = useDaftarEvent<OrderTiket>('orders', {}, 'event-history-orders')

const semuaArsip = computed(() => daftar.value.rows
  .filter(e => ['Event Done', 'Finished'].includes(String(e.status)))
  .sort((a, b) => String(b.start_datetime ?? '').localeCompare(String(a.start_datetime ?? ''))))
// years of the archive itself, not of every event
const tahunAda = computed(() => [...new Set(semuaArsip.value.map(e => tglWIB(e.start_datetime).slice(0, 4)).filter(Boolean))])
const arsip = computed(() => semuaArsip.value
  .filter(e => (fTahun.value === 'semua' || tglWIB(e.start_datetime).slice(0, 4) === fTahun.value))
  .filter(e => (fKategori.value === 'semua' || String(e.category ?? '') === fKategori.value)))

const orderDariId = computed(() => new Map(daftarOrder.value.rows.map(o => [o.id, o])))
/** breakdownEventEms (:5200): paid omzet, class `sold`, checked-in tickets */
function angkaAcara(e: Acara) {
  const terjual = daftarKelas.value.rows.filter(c => c.event_id === e.id).reduce((a, c) => a + (Number(c.sold) || 0), 0)
  const omzet = daftarOrder.value.rows.filter(o => o.event_id === e.id && o.payment_status === 'Paid').reduce((a, o) => a + (Number(o.total) || 0), 0)
  const hadir = daftarTiket.value.rows.filter((t) => {
    const ev = orderDariId.value.get(String(t.order_item_id ?? t.order_id ?? ''))?.event_id ?? t.event_id
    return ev === e.id && t.status === 'Checked-In'
  }).length
  return { terjual, omzet, hadir }
}

const dariIde = useState<Record<string, unknown> | null>('event-dari-ide', () => null)
async function buatSerupa(e: Acara) {
  if (!bolehUbah.value) {
    toast.add({ title: 'Kamu tidak punya izin membuat rencana event.', color: 'error' })
    return
  }
  dariIde.value = {
    title: `${e.title ?? ''} (ulang)`,
    category: e.category ?? '',
    theme: e.theme ?? '',
    venue: e.venue ?? '',
    capacity: Number(e.capacity) || 0,
    pic: e.pic ?? '',
    description: e.description ?? '',
    is_ticketed: !!e.is_ticketed,
  }
  toast.add({ title: `Formulir diisi dari "${e.title ?? ''}". Tanggal & kelas tiket sengaja dikosongkan.`, color: 'info' })
  await navigateTo('/event/planning?baru=1')
}
</script>

<template>
  <EventGerbang lihat="events">
    <AppPage
      title="Event history"
      description="Arsip event selesai (read-only)"
      :back="{ label: 'Perencanaan', to: '/event/planning' }"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :title="apiErrorMessage(error)"
        class="mb-4"
      />

      <div class="mb-4 flex flex-wrap items-center gap-2">
        <USelect
          v-model="fTahun"
          :items="[{ value: 'semua', label: 'Semua tahun' }, ...tahunAda.map(t => ({ value: t, label: t }))]"
          class="w-40"
        />
        <USelect
          v-model="fKategori"
          :items="[{ value: 'semua', label: 'Semua kategori' }, ...EVT_CATS.map(c => ({ value: c, label: c }))]"
          class="w-44"
        />
        <span class="rounded-full bg-muted px-3 py-1 text-xs font-semibold num">{{ angka(arsip.length) }} event</span>
      </div>

      <div
        v-if="status === 'pending'"
        class="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
      >
        <USkeleton
          v-for="i in 3"
          :key="i"
          class="h-56"
        />
      </div>
      <div
        v-else
        class="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
      >
        <AppPanel
          v-for="e in arsip"
          :key="e.id"
          flush
        >
          <ULink
            :to="`/event/history/${e.id}`"
            class="block"
          >
            <EventPosterCover :poster="e.poster_img" />
          </ULink>
          <div class="p-4">
            <ULink
              :to="`/event/history/${e.id}`"
              class="block truncate text-base font-bold text-highlighted hover:text-primary-700"
            >
              {{ e.title }}
            </ULink>
            <p class="mt-1 flex items-center gap-1.5 text-xs text-muted">
              <UIcon
                name="i-lucide-calendar"
                class="size-3.5"
              />{{ fmtTglEms(e.start_datetime) }} · {{ e.venue || '—' }}
            </p>
            <p class="mt-1 flex flex-wrap items-center gap-x-2 text-xs font-semibold text-primary-700 num">
              <span class="flex items-center gap-1"><UIcon
                name="i-lucide-banknote"
                class="size-3.5"
              />{{ rupiah(angkaAcara(e).omzet) }}</span>
              <span class="flex items-center gap-1"><UIcon
                name="i-lucide-ticket"
                class="size-3.5"
              />{{ angka(angkaAcara(e).terjual) }} terjual</span>
              <span class="flex items-center gap-1"><UIcon
                name="i-lucide-users"
                class="size-3.5"
              />{{ angka(angkaAcara(e).hadir) }} hadir</span>
            </p>
            <UButton
              v-if="bolehUbah"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-rotate-ccw"
              block
              class="mt-2.5"
              @click="buatSerupa(e)"
            >
              Buat event serupa
            </UButton>
          </div>
        </AppPanel>
      </div>
      <p
        v-if="!arsip.length && status !== 'pending'"
        class="py-10 text-center text-sm text-dimmed"
      >
        Belum ada event selesai.
      </p>
    </AppPage>
  </EventGerbang>
</template>
