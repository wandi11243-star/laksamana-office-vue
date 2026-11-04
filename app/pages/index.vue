<!--
  Beranda: the old Office home (a module grid per group) in Miro skin. Greeting
  plus the viewer's team badges, then every module they hold grouped in launcher
  order (MODUL_GROUPS) — ready or not, a module without its page yet shows as
  "Segera" (BerandaModul). Approach A: the greenfield team-dashboard layout is
  gone; this page is a launcher again.
-->
<script setup lang="ts">
import type { Modul } from '~/utils/modul'
import { isAdminOf } from '~/composables/useMe'
import { namaDivisiJadwal } from '~/utils/jadwal'

const me = useMe()
const { mine } = useModulNav()

const tim = computed(() => me.value?.tim ?? [])
const kepala = computed(() => (me.value?.headDivisi ?? []).map(namaDivisiJadwal))

// U2 Kelola Akses: a pseudo-card for superadmins. '/akses' has no module key,
// so useModulNav never lists it — it is prepended to Lainnya instead.
const superadmin = computed(() => isAdminOf(me.value, '*'))
const kartuAkses: Modul & { to: string, ready: boolean } = {
  key: 'akses',
  label: 'Kelola Akses',
  desc: 'Pengguna, modul & akses',
  icon: 'i-lucide-key-round',
  group: 'Lainnya',
  access: ['*'],
  to: '/akses',
  ready: true,
}

// The modules the viewer holds, in launcher group order. Ready or not: the
// card decides between a module link with screen pills and "Segera" (BerandaModul).
const grups = computed(() => MODUL_GROUPS
  .map(group => ({
    group,
    items: [
      ...(group === 'Lainnya' && superadmin.value ? [kartuAkses] : []),
      ...mine.value.filter(m => m.group === group),
    ],
  }))
  .filter(g => g.items.length))

const hour = new Date().getHours()
const greeting = hour < 11 ? 'Pagi' : hour < 15 ? 'Siang' : hour < 18 ? 'Sore' : 'Malam'
const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
</script>

<template>
  <AppPage
    :title="`${greeting}, ${me?.name.split(' ')[0]}`"
    :description="today"
  >
    <!-- Small superadmin shortcut mirroring the old top-bar "Kelola User" pill. -->
    <template
      v-if="superadmin"
      #actions
    >
      <UButton
        label="Kelola Akses"
        icon="i-lucide-key-round"
        color="neutral"
        variant="soft"
        size="sm"
        to="/akses"
      />
    </template>
    <div
      v-if="tim.length || kepala.length || me?.keterangan"
      class="-mt-2 mb-6 flex flex-wrap items-center gap-2"
    >
      <UBadge
        v-for="t in tim"
        :key="t.key"
        :label="`Tim ${t.label}`"
        icon="i-lucide-users"
        color="primary"
        variant="soft"
      />
      <UBadge
        v-if="!tim.length && me?.keterangan"
        :label="me.keterangan"
        icon="i-lucide-users"
        color="neutral"
        variant="soft"
      />
      <UBadge
        v-for="k in kepala"
        :key="k"
        :label="`Kepala ${k}`"
        icon="i-lucide-badge-check"
        color="neutral"
        variant="outline"
      />
    </div>

    <section
      v-for="g in grups"
      :key="g.group"
      class="mb-7 last:mb-0"
    >
      <div class="flex items-end gap-2">
        <AppSectionTitle
          :title="g.group"
          class="min-w-0 flex-1"
        />
        <span class="num mb-3 hidden shrink-0 rounded-full border border-default px-2 py-0.5 text-xs text-muted lg:inline">{{ g.items.length }}</span>
      </div>
      <div class="grid grid-cols-3 gap-2 lg:gap-3">
        <BerandaModul
          v-for="m in g.items"
          :key="m.key"
          :m="m"
        />
      </div>
    </section>
  </AppPage>
</template>
