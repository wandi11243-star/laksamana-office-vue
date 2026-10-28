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

// Distinct Miro tints give each launcher module a recognizable icon tile.
const TONE_ICON_MODUL: Record<string, string> = {
  absensi: 'bg-yellow-light text-yellow-dark',
  jadwal: 'bg-sky-light text-blue-pressed',
  akademi: 'bg-rose-light text-vip',
  hr: 'bg-teal-light text-moss-dark',
  stock: 'bg-brand-orange-light text-ink-900',
  reservasi: 'bg-teal-light text-moss-dark',
  service_excellent: 'bg-coral-light text-coral-dark',
  radar: 'bg-sky-light text-blue-pressed',
  cashier: 'bg-yellow-light text-yellow-dark',
  konten: 'bg-rose-light text-vip',
  event: 'bg-brand-orange-light text-ink-900',
  homepage: 'bg-sky-light text-blue-pressed',
  marketing: 'bg-coral-light text-coral-dark',
  finance: 'bg-yellow-light text-yellow-dark',
  bd: 'bg-brand-orange-light text-ink-900',
  hlife: 'bg-teal-light text-moss-dark',
  help: 'bg-rose-light text-vip',
  investor: 'bg-sky-light text-blue-pressed',
  analytics: 'bg-coral-light text-coral-dark',
  akses: 'bg-yellow-light text-yellow-dark',
}

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

// Per-card local toggle so long pill lists stay short: first 6 visible,
// the rest behind a "+N lainnya" / "Sembunyikan" pill.
const bukaSemua = ref(false)
const layarTampil = computed(() => (bukaSemua.value ? layar.value : layar.value.slice(0, 6)))
const sisa = computed(() => layar.value.length - 6)
</script>

<template>
  <div
    class="group flex min-h-11 flex-col gap-2 rounded-panel border border-default bg-default p-2 shadow-panel lg:gap-3 lg:p-4"
    :class="m.ready ? 'cursor-pointer' : 'opacity-60'"
    :role="m.ready ? 'link' : undefined"
    :tabindex="m.ready ? 0 : undefined"
    :aria-disabled="!m.ready || undefined"
    @click="buka"
    @keydown.enter="buka"
  >
    <div class="flex flex-col items-center gap-2 text-center lg:flex-row lg:gap-3 lg:text-left">
      <span
        class="grid size-10 shrink-0 place-items-center rounded-xl"
        :class="TONE_ICON_MODUL[m.key] ?? 'bg-yellow-light text-yellow-dark'"
      >
        <UIcon
          :name="m.icon"
          class="size-5"
        />
      </span>
      <div class="w-full lg:min-w-0 lg:flex-1">
        <h3 class="line-clamp-2 break-words text-sm font-semibold leading-tight text-highlighted lg:truncate lg:text-base">
          {{ m.label }}
        </h3>
        <p class="hidden truncate text-xs uppercase text-muted lg:block">
          {{ m.desc }}
        </p>
      </div>
      <UIcon
        v-if="m.ready"
        name="i-lucide-arrow-right"
        class="hidden size-4 shrink-0 text-dimmed transition-transform group-hover:translate-x-0.5 lg:block"
      />
    </div>
    <div
      v-if="m.ready"
      class="hidden flex-wrap gap-1.5 lg:flex"
    >
      <NuxtLink
        v-for="l in layarTampil"
        :key="l.key"
        :to="l.to"
        class="rounded-full border px-2.5 py-1 text-xs"
        :class="nyala(l.to) ? 'border-yellow-deep bg-yellow-light text-yellow-dark' : 'border-default text-muted'"
        @click.stop
      >
        {{ l.label }}
      </NuxtLink>
      <button
        v-if="layar.length > 6"
        type="button"
        class="rounded-full border border-default px-2.5 py-1 text-xs text-muted"
        @click.stop="bukaSemua = !bukaSemua"
      >
        {{ bukaSemua ? 'Sembunyikan' : `+${sisa} lainnya` }}
      </button>
    </div>
    <div
      v-else
      class="flex flex-wrap gap-1.5"
    >
      <span class="rounded-full border border-default px-2.5 py-1 text-xs text-dimmed">Segera</span>
    </div>
  </div>
</template>
