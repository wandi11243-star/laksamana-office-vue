<!--
  Home. Different per person: it shows the widgets of the modules this user holds
  (MODUL[].widgets), in menu order. No per-user settings yet; see CONTRIBUTING.md.
-->
<script setup lang="ts">
const me = useMe()
const { mine } = useModulNav()

const widgets = computed(() => mine.value.flatMap(m => m.widgets ?? []))
const shortcuts = computed(() => mine.value.filter(m => m.ready).slice(0, 6))

const hour = new Date().getHours()
const greeting = hour < 11 ? 'Pagi' : hour < 15 ? 'Siang' : hour < 18 ? 'Sore' : 'Malam'
const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
</script>

<template>
  <AppPage
    :title="`${greeting}, ${me?.name.split(' ')[0]}`"
    :description="today"
  >
    <div class="grid gap-x-8 lg:grid-cols-2">
      <component
        :is="w"
        v-for="(w, i) in widgets"
        :key="i"
      />

      <AppList
        v-if="shortcuts.length"
        title="Modul Anda"
        :action="{ label: 'Semua', to: '/modul' }"
      >
        <AppListRow
          v-for="m in shortcuts"
          :key="m.key"
          :title="m.label"
          :description="m.desc"
          :icon="m.icon"
          :to="m.to"
        />
      </AppList>
    </div>
  </AppPage>
</template>
