<script setup lang="ts">
import EventDaftar from '~/components/EventDaftar.vue'
import EventPerencanaan from '~/components/EventPerencanaan.vue'
import { bolehBukaEvent, bolehUbahEvent, peranEvent } from '~/utils/layar/event'

definePageMeta({ access: ['event'] })

const me = useMe()
const route = useRoute()
const peran = computed(() => peranEvent(me.value))
const bolehPlanning = computed(() => bolehBukaEvent('planning', peran.value))
const bolehEvents = computed(() => bolehBukaEvent('events', peran.value))
const bolehBuat = computed(() => bolehUbahEvent('planning', peran.value))
const sheetBaru = ref(false)
const pilihan = computed(() => {
  const tabs: { value: string, label: string }[] = []
  if (bolehEvents.value) tabs.push({ value: 'events', label: 'Daftar event' })
  if (bolehPlanning.value) {
    tabs.push({ value: 'rencana', label: 'Perencanaan' }, { value: 'riwayat', label: 'Riwayat event' })
  }
  return tabs
})
const tab = computed({
  get: () => pilihan.value.find(p => p.value === route.query.tab)?.value ?? pilihan.value[0]?.value,
  set: (value) => {
    const { baru: _baru, ...query } = route.query
    sheetBaru.value = false
    void navigateTo({ query: { ...query, tab: value } })
  },
})
</script>

<template>
  <EventGerbang :lihat="['planning', 'events']">
    <AppPage title="Event management">
      <template
        v-if="bolehBuat && tab === 'rencana'"
        #actions
      >
        <UButton
          color="primary"
          icon="i-lucide-plus"
          @click="sheetBaru = true"
        >
          Rencana baru
        </UButton>
      </template>

      <AppSeg
        v-if="pilihan.length > 1"
        v-model="tab"
        :options="pilihan"
        class="mb-4"
      />
      <EventDaftar v-if="tab === 'events'" />
      <EventPerencanaan
        v-else-if="tab === 'rencana' || tab === 'riwayat'"
        v-model:baru="sheetBaru"
        :tab="tab"
      />
    </AppPage>
  </EventGerbang>
</template>
