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
// card decides between a module link and "Segera" (BerandaModul).
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
</script>

<template>
  <div>
    <div class="mx-auto w-full max-w-6xl">
      <BerandaKop />
    </div>
    <AppPage
      :title="`Selamat ${greeting.toLowerCase()}, ${me?.name.split(' ')[0]}`"
      description="Pilih modul di bawah untuk mulai bekerja."
      narrow
    >
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
        <!-- Old launcher group head: spaced caps, a gold count pill, then a hairline. -->
        <h2 class="mb-3 flex items-center gap-3 lg:mb-4">
          <span class="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-muted">{{ g.group }}</span>
          <span class="num shrink-0 rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-deep">{{ g.items.length }}</span>
          <span
            class="h-px flex-1 bg-gold/25"
            aria-hidden="true"
          />
        </h2>
        <div class="grid grid-cols-3 gap-2 lg:grid-cols-5 lg:gap-3">
          <BerandaModul
            v-for="m in g.items"
            :key="m.key"
            :m="m"
          />
        </div>
      </section>
    </AppPage>
  </div>
</template>
