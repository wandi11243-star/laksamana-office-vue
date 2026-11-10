<!--
  One module card on Beranda: the old launcher's card in Miro skin, kept
  minimal — icon tile, then name over a short description, arrow on the right,
  as in the old Office launcher; the module's screens live in its own sidebar,
  not on the card. Desktop shows five near-square tiles per row. A module
  without its page yet shows "Segera" and has no link.

  Beranda carries the Laksamana gold (owner request, Nov 2026) in a deep-gold
  description; the icon tiles keep their pastel tint per module. Under the
  cursor a ready card lifts slightly, takes a faint gold wash, a gold border,
  icon ring and arrow.
-->
<script setup lang="ts">
import type { Modul } from '~/utils/modul'

const props = defineProps<{ m: Modul & { to: string, ready: boolean } }>()

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
</script>

<template>
  <div
    class="group flex min-h-11 flex-col items-center gap-2 rounded-panel border border-default bg-default p-2 text-center shadow-panel transition duration-200 ease-laks lg:min-h-36 lg:flex-row lg:items-start lg:gap-2.5 lg:p-3.5 lg:text-left"
    :class="m.ready
      ? 'cursor-pointer hover:-translate-y-0.5 hover:border-gold hover:bg-gold-soft/20 hover:shadow-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40'
      : 'opacity-60'"
    :role="m.ready ? 'link' : undefined"
    :tabindex="m.ready ? 0 : undefined"
    :aria-disabled="!m.ready || undefined"
    @click="buka"
    @keydown.enter="buka"
  >
    <span
      class="grid size-10 shrink-0 place-items-center rounded-xl transition-shadow duration-200 group-hover:ring-2 group-hover:ring-gold/30 lg:size-11"
      :class="TONE_ICON_MODUL[m.key] ?? 'bg-yellow-light text-yellow-dark'"
    >
      <UIcon
        :name="m.icon"
        class="size-5 lg:size-6"
      />
    </span>
    <div class="w-full lg:min-w-0 lg:flex-1">
      <!-- Never clipped: a long name ("Task Management") wraps whole instead of "…". -->
      <h3 class="text-balance break-words text-sm font-semibold leading-tight text-highlighted lg:text-base">
        {{ m.label }}
      </h3>
      <p class="mt-1 hidden text-[11px] font-semibold uppercase leading-snug tracking-wide text-gold-deep lg:line-clamp-3">
        {{ m.desc }}
      </p>
    </div>
    <UIcon
      v-if="m.ready"
      name="i-lucide-arrow-right"
      class="mt-3 hidden size-4 shrink-0 text-dimmed transition group-hover:translate-x-0.5 group-hover:text-gold lg:block"
    />
    <span
      v-else
      class="shrink-0 rounded-full border border-default px-2 py-0.5 text-xs text-dimmed lg:px-2.5 lg:py-1"
    >Segera</span>
  </div>
</template>
