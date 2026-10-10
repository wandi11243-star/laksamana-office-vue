<!--
  Beranda: a team room, not a launcher. Order runs from the viewer outwards:
  their team today (Roster), what waits for them in the team's modules (the
  modules' own badges), the team's main modules as live cards ("Dashboard tim"),
  module widgets, then every other module they hold. Teams come from the API
  (me.tim); several teams merge into one profile (utils/beranda-tim.ts).
  Greenfield layout: the old Office home was only a greeting and the module grid.
-->
<script setup lang="ts">
import { modulFokus } from '~/utils/beranda-tim'
import { namaDivisiJadwal } from '~/utils/jadwal'

const me = useMe()
const { mine } = useModulNav()
const Link = resolveComponent('NuxtLink')

const tim = computed(() => me.value?.tim ?? [])
const kepala = computed(() => (me.value?.headDivisi ?? []).map(namaDivisiJadwal))

// The team's modules the viewer actually holds, in profile order. Without a
// profile, the first three ready modules stand in so the page is never empty.
const fokus = computed(() => {
  const urut = modulFokus(tim.value.map(t => t.key))
  const punya = urut.map(k => mine.value.find(m => m.key === k)).filter(m => !!m)
  return punya.length ? punya : mine.value.filter(m => m.ready).slice(0, 3)
})
const lainnya = computed(() => mine.value.filter(m => !fokus.value.includes(m)))
const widgets = computed(() => mine.value.flatMap(m => m.widgets ?? []))
const pakaiRoster = computed(() => hasAccess(me.value, ['jadwal']))

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

    <BerandaTim v-if="pakaiRoster" />

    <BerandaTindakan :modul="fokus.map(m => m.key)" />

    <section
      v-if="fokus.length"
      class="mb-7"
    >
      <AppSectionTitle
        :title="tim.length ? `Dashboard tim ${tim.map(t => t.label).join(' & ')}` : 'Modul utama'"
        icon="i-lucide-layout-dashboard"
      />
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <component
          :is="m.ready ? Link : 'div'"
          v-for="m in fokus"
          :key="m.key"
          :to="m.ready ? m.to : undefined"
          class="group flex flex-col gap-3 rounded-panel border border-default bg-default p-4 shadow-panel transition-colors"
          :class="m.ready ? 'hover:border-primary-300' : 'opacity-60'"
          :aria-disabled="!m.ready || undefined"
        >
          <div class="flex items-center gap-3">
            <span class="grid size-10 shrink-0 place-items-center rounded-field bg-primary-100 text-primary-700">
              <UIcon
                :name="m.icon"
                class="size-5"
              />
            </span>
            <div class="min-w-0">
              <h3 class="truncate font-semibold text-highlighted">
                {{ m.label }}
              </h3>
              <p class="truncate text-xs text-muted">
                {{ m.desc }}
              </p>
            </div>
          </div>
          <div class="min-h-7 flex-1">
            <component
              :is="m.kartu"
              v-if="m.kartu && m.ready"
            />
          </div>
          <span
            class="flex items-center gap-1 text-sm font-semibold"
            :class="m.ready ? 'text-primary-700' : 'text-dimmed'"
          >
            {{ m.ready ? 'Buka' : 'Segera' }}
            <UIcon
              v-if="m.ready"
              name="i-lucide-arrow-right"
              class="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </component>
      </div>
    </section>

    <div
      v-if="widgets.length"
      class="grid gap-x-8 lg:grid-cols-2"
    >
      <component
        :is="w"
        v-for="(w, i) in widgets"
        :key="i"
      />
    </div>

    <section v-if="lainnya.length">
      <AppSectionTitle
        title="Modul lainnya"
        icon="i-lucide-grid-2x2"
      />
      <div class="grid grid-cols-4 gap-x-2 gap-y-5 sm:grid-cols-6 lg:grid-cols-8">
        <component
          :is="m.ready ? Link : 'div'"
          v-for="m in lainnya"
          :key="m.key"
          :to="m.ready ? m.to : undefined"
          class="grid justify-items-center gap-1.5 text-center text-xs font-medium"
          :class="m.ready ? 'text-default' : 'text-dimmed'"
          :aria-disabled="!m.ready || undefined"
        >
          <span
            class="grid size-14 place-items-center rounded-panel border border-default bg-default shadow-panel"
            :class="!m.ready && 'opacity-50'"
          >
            <UIcon
              :name="m.icon"
              class="size-6"
            />
          </span>
          {{ m.label }}
          <span
            v-if="!m.ready"
            class="-mt-1 text-[10px]"
          >Segera</span>
        </component>
      </div>
      <div class="mt-5 text-right">
        <ULink
          to="/modul"
          class="text-sm font-semibold text-primary-700 underline-offset-4 hover:underline"
        >
          Semua modul
        </ULink>
      </div>
    </section>
  </AppPage>
</template>
