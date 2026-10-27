<!--
  Beranda: the old Office home (a module grid per group) in Miro skin. Greeting
  plus the viewer's team badges, then every module they hold grouped in launcher
  order (MODUL_GROUPS) — ready or not, a module without its page yet shows as
  "Segera" (BerandaModul). Approach A: the greenfield team-dashboard layout is
  gone; this page is a launcher again.
-->
<script setup lang="ts">
import { namaDivisiJadwal } from '~/utils/jadwal'

const me = useMe()
const { mine } = useModulNav()

const tim = computed(() => me.value?.tim ?? [])
const kepala = computed(() => (me.value?.headDivisi ?? []).map(namaDivisiJadwal))

// The modules the viewer holds, in launcher group order. Ready or not: the
// card decides between a module link with screen pills and "Segera".
const grups = computed(() => MODUL_GROUPS
  .map(group => ({ group, items: mine.value.filter(m => m.group === group) }))
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
        <span class="num mb-3 shrink-0 rounded-full border border-default px-2 py-0.5 text-xs text-muted">{{ g.items.length }}</span>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <BerandaModul
          v-for="m in g.items"
          :key="m.key"
          :m="m"
        />
      </div>
    </section>
  </AppPage>
</template>
