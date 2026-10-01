<!--
  The sidebar of the old Office (DESIGN.md › Shell): brand with the module's name
  in small gold capitals, the menu in labelled groups, and the user at the foot.
  Inside a module with its own chrome (utils/modul-shell.ts) the menu is that
  module's screens; elsewhere it is Beranda and the modules the user holds.
  Used as the desktop sidebar and inside the phone drawer.
-->
<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const emit = defineEmits<{ pilih: [] }>()

const me = useMe()
const { grouped } = useModulNav()
const { modul, shell } = useModulShell()
shell.value?.siapkan?.()
const lencana = shell.value?.lencana?.()

const groupLayar = (items: Layar[]) => {
  const out = new Map<string, Layar[]>()
  for (const l of items) out.set(l.grup ?? '', [...(out.get(l.grup ?? '') ?? []), l])
  return [...out]
}

const menu = computed<NavigationMenuItem[][]>(() => {
  const s = shell.value
  if (s) {
    const bisa = s.layar.filter(l => !l.boleh || (me.value && l.boleh(me.value)))
    const badge = (key: string) => {
      const n = lencana?.value[key] ?? 0
      return n > 0 ? { label: String(n), color: 'error' as const, variant: 'solid' as const, size: 'sm' as const } : undefined
    }
    const grup = groupLayar(bisa).map(([grup, items]) => [
      ...(grup ? [{ label: grup, type: 'label' as const }] : []),
      ...items.map(l => ({
        label: l.label,
        icon: l.icon,
        to: l.to,
        exact: true,
        badge: badge(l.key) ?? (l.badge
          ? { label: l.badge, color: 'neutral' as const, variant: 'soft' as const, size: 'sm' as const }
          : undefined),
        onSelect: () => emit('pilih'),
      })),
    ])
    return [...grup, ...(s.navEkstra?.() ?? [])]
  }
  return [
    [
      { label: 'Beranda', icon: 'i-lucide-house', to: '/', exact: true, onSelect: () => emit('pilih') },
      { label: 'Semua modul', icon: 'i-lucide-layout-grid', to: '/modul', onSelect: () => emit('pilih') },
    ],
    ...grouped.value.map(g => [
      { label: g.group, type: 'label' as const },
      ...g.items.map(m => m.ready
        ? { label: m.label, icon: m.icon, to: m.to, onSelect: () => emit('pilih') }
        : { label: m.label, icon: m.icon, disabled: true, badge: 'Segera' }),
    ]),
  ]
})

const inisial = computed(() => (me.value?.name ?? '?').split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase())
const peran = computed(() => shell.value?.peran?.(me.value) ?? me.value?.keterangan ?? '')
</script>

<template>
  <div class="flex h-full flex-col bg-default">
    <NuxtLink
      to="/"
      class="flex items-center gap-3 px-5 pb-3.5 pt-5"
      @click="emit('pilih')"
    >
      <img
        src="/mark.png"
        alt=""
        class="size-9 shrink-0 object-contain"
      >
      <span class="leading-tight">
        <span class="block font-display text-base font-bold text-highlighted">Laksamana Muda</span>
        <span class="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-700 dark:text-primary-300">
          {{ shell?.subjudul ?? 'Office' }}
        </span>
      </span>
    </NuxtLink>

    <UNavigationMenu
      :items="menu"
      orientation="vertical"
      class="flex-1 overflow-y-auto px-3"
      :ui="{
        label: 'px-3 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-wider text-dimmed',
        link: 'text-[15px]',
        linkLeadingIcon: 'size-[18px]',
      }"
    />

    <NuxtLink
      v-if="modul && shell"
      to="/"
      class="mx-3 mb-2 flex items-center gap-2 rounded-field px-3 py-2 text-sm font-semibold text-muted hover:bg-muted"
      @click="emit('pilih')"
    >
      <UIcon
        name="i-lucide-arrow-left"
        class="size-4"
      />
      Beranda Office
    </NuxtLink>

    <div class="flex items-center gap-2.5 border-t border-default p-3">
      <NuxtLink
        to="/profil"
        class="flex min-w-0 flex-1 items-center gap-2.5"
        @click="emit('pilih')"
      >
        <span class="flex size-9 shrink-0 items-center justify-center rounded-field bg-primary-600 text-[13px] font-bold text-white dark:bg-primary-400 dark:text-ink-950">
          {{ inisial }}
        </span>
        <span class="min-w-0 leading-tight">
          <span class="block truncate text-sm font-semibold text-highlighted">{{ me?.name }}</span>
          <span class="block truncate text-xs text-muted">{{ peran }}</span>
        </span>
      </NuxtLink>
      <UButton
        v-if="shell?.kaki"
        :to="shell.kaki.to"
        :icon="shell.kaki.icon ?? 'i-lucide-power'"
        color="neutral"
        variant="outline"
        size="sm"
        :aria-label="shell.kaki.label"
        :title="shell.kaki.label"
      />
      <UButton
        v-else
        icon="i-lucide-power"
        color="neutral"
        variant="outline"
        size="sm"
        aria-label="Keluar"
        @click="logout()"
      />
    </div>
  </div>
</template>
