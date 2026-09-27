<!--
  App shell. Phone (< lg): top bar + bottom tab bar. Desktop (lg+): left sidebar.
  Same pages in both; only the chrome changes.
-->
<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const me = useMe()
const route = useRoute()
const { grouped } = useModulNav()

const sidebar = computed<NavigationMenuItem[][]>(() => [
  [
    { label: 'Beranda', icon: 'i-lucide-house', to: '/', exact: true },
    { label: 'Semua modul', icon: 'i-lucide-layout-grid', to: '/modul' },
  ],
  ...grouped.value.map(g => [
    { label: g.group, type: 'label' as const },
    ...g.items.map(m => m.ready
      ? { label: m.label, icon: m.icon, to: m.to }
      : { label: m.label, icon: m.icon, disabled: true, badge: 'Segera' }),
  ]),
])

// Bottom tabs: the module tab stays lit inside any module page.
const tabs = computed(() => [
  { label: 'Beranda', icon: 'i-lucide-house', to: '/', active: route.path === '/' },
  { label: 'Modul', icon: 'i-lucide-layout-grid', to: '/modul', active: route.path === '/modul' || !!route.meta.access },
  { label: 'Profil', icon: 'i-lucide-circle-user', to: '/profil', active: route.path === '/profil' },
])
</script>

<template>
  <div class="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
    <!-- Desktop sidebar -->
    <aside class="sticky top-0 hidden h-dvh flex-col border-e border-default bg-default px-3 py-5 lg:flex">
      <NuxtLink
        to="/"
        class="mb-5 flex items-center gap-2.5 px-2 font-extrabold tracking-tight text-highlighted"
      >
        <img
          src="/mark.png"
          alt=""
          class="size-8"
        >
        Laksamana
      </NuxtLink>
      <UNavigationMenu
        :items="sidebar"
        orientation="vertical"
        class="-mx-1 flex-1 overflow-y-auto"
        :ui="{ label: 'pt-4 text-xs font-semibold text-dimmed' }"
      />
      <NuxtLink
        to="/profil"
        class="mt-3 flex items-center gap-2.5 border-t border-default px-2 pt-3 text-sm font-semibold text-highlighted"
      >
        <UAvatar
          :alt="me?.name"
          size="sm"
        />
        <span class="truncate">{{ me?.name }}</span>
      </NuxtLink>
    </aside>

    <div class="min-w-0">
      <!-- Phone top bar -->
      <header class="sticky top-0 z-10 flex items-center justify-between bg-muted px-4 pb-1.5 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
        <NuxtLink
          to="/"
          aria-label="Beranda"
        >
          <img
            src="/mark.png"
            alt="Laksamana Muda"
            class="size-8"
          >
        </NuxtLink>
        <NuxtLink
          to="/profil"
          aria-label="Profil"
        >
          <UAvatar
            :alt="me?.name"
            size="md"
          />
        </NuxtLink>
      </header>

      <main class="px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-2 lg:px-10 lg:pb-12 lg:pt-8">
        <slot />
      </main>
    </div>

    <!-- Phone tab bar -->
    <nav
      class="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-default bg-default px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden"
      aria-label="Navigasi utama"
    >
      <NuxtLink
        v-for="t in tabs"
        :key="t.to"
        :to="t.to"
        class="flex flex-col items-center gap-0.5 py-1 text-[11px]"
        :class="t.active ? 'font-bold text-highlighted' : 'font-medium text-dimmed'"
        :aria-current="t.active ? 'page' : undefined"
      >
        <UIcon
          :name="t.icon"
          class="size-6"
        />
        {{ t.label }}
      </NuxtLink>
    </nav>
  </div>
</template>
