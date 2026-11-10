<!--
  Beranda's brand header, as on the old Office launcher: the Laksamana mark and
  "Laksamana Muda / Internal office" on the left; the live clock card, the
  superadmin "Kelola User" pill and the account menu on the right. It stands in
  for the layout's top bar on Beranda only. On a phone the clock card is
  hidden and "Kelola User" collapses to its icon.
-->
<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { isAdminOf } from '~/composables/useMe'

const me = useMe()
const superadmin = computed(() => isAdminOf(me.value, '*'))
const namaDepan = computed(() => me.value?.name.split(' ')[0] ?? '')

// Minute precision is all the clock shows; refresh twice a minute.
const now = shallowRef(new Date())
useIntervalFn(() => {
  now.value = new Date()
}, 30_000)
const jam = computed(() => now.value.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))
const tanggal = computed(() => now.value.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))

const menuAkun = [[
  { label: 'Profil', icon: 'i-lucide-user-round', to: '/profil' },
  { label: 'Keluar', icon: 'i-lucide-log-out', onSelect: () => logout() },
]]
</script>

<template>
  <header class="mb-6 flex items-center justify-between gap-3 pt-[env(safe-area-inset-top)] lg:mb-8">
    <NuxtLink
      to="/"
      class="flex min-w-0 items-center gap-3"
      aria-label="Beranda"
    >
      <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-gold-soft lg:size-11">
        <img
          src="/mark.png"
          alt=""
          class="size-6 lg:size-7"
        >
      </span>
      <span class="min-w-0 leading-tight">
        <span class="block truncate text-sm font-bold text-highlighted lg:text-base">Laksamana Muda</span>
        <span class="mt-0.5 block truncate text-[10px] font-semibold uppercase tracking-[0.25em] text-gold-deep">Internal office</span>
      </span>
    </NuxtLink>

    <div class="flex shrink-0 items-center gap-2 lg:gap-3">
      <div class="hidden rounded-lg border border-default bg-default px-4 py-1.5 text-right md:block">
        <p class="num text-base font-semibold leading-tight text-highlighted">
          {{ jam }}
        </p>
        <p class="text-[11px] text-muted">
          {{ tanggal }}
        </p>
      </div>
      <UButton
        v-if="superadmin"
        to="/akses"
        icon="i-lucide-users"
        color="neutral"
        variant="outline"
        size="md"
        aria-label="Kelola User"
        class="gap-2 text-gold-deep sm:px-4"
      >
        <span class="hidden sm:inline">Kelola User</span>
      </UButton>
      <UDropdownMenu
        :items="menuAkun"
        :content="{ align: 'end' }"
      >
        <UButton
          icon="i-lucide-user-round"
          trailing-icon="i-lucide-chevron-down"
          color="neutral"
          variant="outline"
          size="md"
          class="gap-2 sm:px-4"
          :aria-label="`Akun ${me?.name ?? ''}`"
        >
          <span class="hidden sm:inline">{{ namaDepan }}</span>
        </UButton>
      </UDropdownMenu>
    </div>
  </header>
</template>
