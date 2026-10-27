<!--
  One module card on Beranda: the old launcher's card in Miro skin. A ready
  card links to the module and lists its screens (LAYAR_*) as pills, so the
  crew jumps straight to a screen without opening the module first. A module
  without its page yet shows "Segera" and has no links.
-->
<script setup lang="ts">
import type { Layar } from '~/utils/layar'
import type { Modul } from '~/utils/modul'
import { LAYAR_ABSENSI } from '~/utils/layar/absensi'
import { LAYAR_AKADEMI } from '~/utils/layar/akademi'
import { LAYAR_ANALYTICS } from '~/utils/layar/analytics'
import { LAYAR_BD } from '~/utils/layar/bd'
import { LAYAR_CASHIER } from '~/utils/layar/cashier'
import { LAYAR_DW } from '~/utils/layar/dw'
import { LAYAR_EVENT } from '~/utils/layar/event'
import { LAYAR_FINANCE } from '~/utils/layar/finance'
import { LAYAR_HELP } from '~/utils/layar/help'
import { LAYAR_HLIFE } from '~/utils/layar/hlife'
import { LAYAR_HOMEPAGE } from '~/utils/layar/homepage'
import { LAYAR_HR } from '~/utils/layar/hr'
import { LAYAR_INVESTOR } from '~/utils/layar/investor'
import { LAYAR_JADWAL } from '~/utils/layar/jadwal'
import { LAYAR_KONTEN } from '~/utils/layar/konten'
import { LAYAR_MARKETING } from '~/utils/layar/marketing'
import { LAYAR_RADAR } from '~/utils/layar/radar'
import { LAYAR_RESERVASI } from '~/utils/layar/reservasi'
import { LAYAR_SERVICE_EXCELLENT } from '~/utils/layar/service_excellent'
import { LAYAR_STOCK } from '~/utils/layar/stock'

const props = defineProps<{ m: Modul & { to: string, ready: boolean } }>()

const route = useRoute()

const buka = () => {
  if (props.m.ready) navigateTo(props.m.to)
}

// Roster holds two access keys (jadwal + dw, modul.ts) but one launcher card,
// so its pills carry both menus. Every other key maps to its own LAYAR array.
const LAYAR_MODUL: Record<string, Layar[]> = {
  absensi: LAYAR_ABSENSI,
  jadwal: [...LAYAR_JADWAL, ...LAYAR_DW],
  akademi: LAYAR_AKADEMI,
  hr: LAYAR_HR,
  stock: LAYAR_STOCK,
  reservasi: LAYAR_RESERVASI,
  service_excellent: LAYAR_SERVICE_EXCELLENT,
  radar: LAYAR_RADAR,
  cashier: LAYAR_CASHIER,
  konten: LAYAR_KONTEN,
  event: LAYAR_EVENT,
  homepage: LAYAR_HOMEPAGE,
  marketing: LAYAR_MARKETING,
  finance: LAYAR_FINANCE,
  bd: LAYAR_BD,
  hlife: LAYAR_HLIFE,
  help: LAYAR_HELP,
  investor: LAYAR_INVESTOR,
  analytics: LAYAR_ANALYTICS,
}

const layar = computed(() => LAYAR_MODUL[props.m.key] ?? [])
const nyala = (to: string) => cocokRute(route.path, to)
</script>

<template>
  <div
    class="group flex flex-col gap-3 rounded-panel border border-default bg-default p-4 shadow-panel"
    :class="m.ready ? 'cursor-pointer' : 'opacity-60'"
    :role="m.ready ? 'link' : undefined"
    :tabindex="m.ready ? 0 : undefined"
    :aria-disabled="!m.ready || undefined"
    @click="buka"
    @keydown.enter="buka"
  >
    <div class="flex items-center gap-3">
      <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-900 text-white">
        <UIcon
          :name="m.icon"
          class="size-5"
        />
      </span>
      <div class="min-w-0 flex-1">
        <h3 class="truncate font-semibold text-highlighted">
          {{ m.label }}
        </h3>
        <p class="truncate text-xs uppercase text-muted">
          {{ m.desc }}
        </p>
      </div>
      <UIcon
        v-if="m.ready"
        name="i-lucide-arrow-right"
        class="size-4 shrink-0 text-dimmed transition-transform group-hover:translate-x-0.5"
      />
    </div>
    <div
      v-if="m.ready"
      class="flex flex-wrap gap-1.5"
    >
      <NuxtLink
        v-for="l in layar"
        :key="l.key"
        :to="l.to"
        class="rounded-full border px-2.5 py-1 text-xs"
        :class="nyala(l.to) ? 'border-yellow-deep bg-yellow-light text-yellow-dark' : 'border-default text-muted'"
        @click.stop
      >
        {{ l.label }}
      </NuxtLink>
    </div>
    <div
      v-else
      class="flex flex-wrap gap-1.5"
    >
      <span class="rounded-full border border-default px-2.5 py-1 text-xs text-dimmed">Segera</span>
    </div>
  </div>
</template>
