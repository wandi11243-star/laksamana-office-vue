<!--
  Event banner + "Informasi Dasar" (renderEventDetail :6369 /
  renderHistoryDetail :11276 share it): the poster band with title, category,
  status, venue and date, then the nine label/value rows in the old order —
  Kategori, Theme, Venue, Waktu, Kapasitas, PIC, Diinput oleh, Status,
  Ticketed. `terjual` is the classes' sold count; omitted it just says "Ya".
-->
<script setup lang="ts">
import { fmtTglEms, fmtTglJamEms, jamWIB } from '~/utils/event-hitung'
import { angka } from '~/utils/format'
import { STATUS_IKON_EVENT, STATUS_WARNA_EVENT } from '~/utils/status-event'

const props = defineProps<{ acara: Record<string, unknown>, terjual?: number }>()

const st = computed(() => String(props.acara.status ?? ''))
const akhir = computed(() => {
  const j = jamWIB(props.acara.end_datetime as string)
  return j && j !== '—' ? ` – ${j.replace(':', '.')}` : ''
})
const baris = computed(() => [
  { l: 'Kategori', v: String(props.acara.category || '—') },
  { l: 'Theme', v: String(props.acara.theme || '—') },
  { l: 'Venue', v: String(props.acara.venue || '—') },
  { l: 'Waktu', v: `${fmtTglJamEms(props.acara.start_datetime as string)}${akhir.value}` },
  { l: 'Kapasitas', v: `${angka(Number(props.acara.capacity) || 0)} orang` },
  { l: 'PIC', v: String(props.acara.pic || '—') },
  { l: 'Diinput oleh', v: String(props.acara.createdBy || '—') },
])
</script>

<template>
  <AppPanel
    flush
    class="mb-4"
  >
    <EventPosterCover :poster="acara.poster_img" />
    <div class="space-y-1.5 p-4">
      <h2 class="text-lg font-bold text-highlighted">
        {{ acara.title }}
      </h2>
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <UBadge
          color="neutral"
          variant="soft"
        >
          {{ acara.category || '—' }}
        </UBadge>
        <AppStatus
          :color="STATUS_WARNA_EVENT[st] ?? 'neutral'"
          :icon="STATUS_IKON_EVENT[st]"
          size="sm"
        >
          {{ st }}
        </AppStatus>
      </div>
      <p class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span class="flex items-center gap-1"><UIcon
          name="i-lucide-map-pin"
          class="size-3.5"
        />{{ acara.venue || '—' }}</span>
        <span class="flex items-center gap-1"><UIcon
          name="i-lucide-calendar"
          class="size-3.5"
        />{{ fmtTglEms(acara.start_datetime as string) }}</span>
      </p>
    </div>
  </AppPanel>

  <AppPanel
    title="Informasi dasar"
    icon="i-lucide-info"
    class="mb-4"
  >
    <dl class="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
      <div
        v-for="b in baris"
        :key="b.l"
      >
        <dt class="text-xs text-muted">
          {{ b.l }}
        </dt>
        <dd class="font-semibold text-highlighted">
          {{ b.v }}
        </dd>
      </div>
      <div>
        <dt class="text-xs text-muted">
          Status
        </dt>
        <dd>
          <AppStatus
            :color="STATUS_WARNA_EVENT[st] ?? 'neutral'"
            :icon="STATUS_IKON_EVENT[st]"
            size="sm"
          >
            {{ st }}
          </AppStatus>
        </dd>
      </div>
      <div>
        <dt class="text-xs text-muted">
          Ticketed
        </dt>
        <dd class="font-semibold text-highlighted">
          {{ acara.is_ticketed ? `Ya${terjual != null ? ` · ${angka(terjual)} terjual` : ''}` : 'Tidak' }}
        </dd>
      </div>
      <div
        v-if="acara.description"
        class="sm:col-span-2"
      >
        <dt class="text-xs text-muted">
          Deskripsi
        </dt>
        <dd class="whitespace-pre-line text-muted">
          {{ acara.description }}
        </dd>
      </div>
    </dl>
  </AppPanel>
</template>
