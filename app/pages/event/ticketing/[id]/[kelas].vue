<!--
  Category detail — highlighted sales of one ticket class with paging
  (`renderKategoriDetail :6982`, KAT_PER_HAL = 8).
-->
<script setup lang="ts">
import type { Tiket } from '~/composables/useEvent'
import { getEvent, useDaftarEvent } from '~/composables/useEvent'
import { apiErrorMessage } from '~/composables/useApi'
import { angka, rupiah } from '~/utils/format'

definePageMeta({ access: ['event'] })

const route = useRoute()
const id = computed(() => String(route.params.id ?? ''))
const kelasId = computed(() => String(route.params.kelas ?? ''))

const { data: envAcara, error } = useAsyncData(`event-kat-acara-${id.value}`, () => getEvent('events', id.value))
const acara = computed(() => envAcara.value?.data as Record<string, unknown> | undefined)

const q = computed<Record<string, string>>(() => ({ event_id: id.value }))
const { data: daftarKelas } = useDaftarEvent('ticket-classes', q, `event-kat-kelas-${id.value}`)
const { data: daftarTiket, status } = useDaftarEvent<Tiket>('tickets', { ticket_class_id: kelasId.value } as never, `event-kat-tiket-${id.value}-${kelasId.value}`)

const kelas = computed(() => daftarKelas.value.rows.find(c => c.id === kelasId.value))
// scoped by ticket_class_id: legacy tickets carry no event_id, so filtering on it dropped them
const list = computed(() => daftarTiket.value.rows.filter(t => t.ticket_class_id === kelasId.value))

const hal = ref(1)
const PER_HAL = 8
const maxHal = computed(() => Math.max(1, Math.ceil(list.value.length / PER_HAL)))
const halaman = computed(() => list.value.slice((hal.value - 1) * PER_HAL, hal.value * PER_HAL))
watch(list, () => {
  hal.value = Math.min(hal.value, maxHal.value)
})
</script>

<template>
  <EventGerbang lihat="ticketing">
    <AppPage
      :title="String(kelas?.name ?? 'Kategori tiket')"
      :description="String(acara?.title ?? '')"
      :back="{ label: 'Ticketing', to: `/event/ticketing/${id}` }"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :title="apiErrorMessage(error)"
        class="mb-4"
      />
      <AppStatGrid class="mb-4">
        <AppStat
          label="Terjual"
          :value="angka(Number(kelas?.sold) || 0)"
          icon="i-lucide-ticket-check"
          tone="success"
        />
        <AppStat
          label="Kuota"
          :value="angka(Number(kelas?.quota) || 0)"
          icon="i-lucide-tickets"
          tone="info"
        />
        <AppStat
          label="Harga"
          :value="rupiah(Number(kelas?.price) || 0)"
          icon="i-lucide-tag"
          tone="gold"
        />
      </AppStatGrid>
      <AppPanel
        title="Penjualan kategori ini"
        icon="i-lucide-users"
        flush
      >
        <ul
          v-if="status !== 'pending'"
          class="divide-y divide-default"
        >
          <li
            v-for="t in halaman"
            :key="t.id"
            class="flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
          >
            <b class="truncate text-highlighted">{{ String((t as Record<string, unknown>).buyer_name ?? t.qr_token) }}</b>
            <span class="shrink-0 text-xs text-muted">{{ t.qr_token }}</span>
          </li>
        </ul>
        <p
          v-if="!list.length && status !== 'pending'"
          class="px-4 py-6 text-center text-sm text-dimmed"
        >
          Belum ada penjualan di kategori ini.
        </p>
        <div class="flex items-center justify-between px-4 py-3 text-xs text-muted">
          <span class="num">{{ list.length ? `${(hal - 1) * PER_HAL + 1}–${Math.min(hal * PER_HAL, list.length)} dari ${angka(list.length)}` : '0 dari 0' }}</span>
          <span class="flex gap-1">
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-chevron-left"
              :disabled="hal <= 1"
              @click="hal--"
            />
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-chevron-right"
              :disabled="hal >= maxHal"
              @click="hal++"
            />
          </span>
        </div>
      </AppPanel>
    </AppPage>
  </EventGerbang>
</template>
