<!-- Home widget for Absensi. Widgets are AppList sections; they never use AppFocus. -->
<script setup lang="ts">
const { data, status } = useAbsensiContext()

const shift = computed(() => {
  const s = data.value?.shift
  const first = Array.isArray(s) ? s[0] : null
  if (!first) return 'Tidak ada shift hari ini'
  return first.libur ? 'Libur' : `Shift ${first.mulai}–${first.selesai}`
})
</script>

<template>
  <AppList
    title="Absensi hari ini"
    :action="{ label: 'Riwayat', to: '/absensi' }"
  >
    <USkeleton
      v-if="status === 'pending'"
      class="m-4 h-6 w-40"
    />
    <template v-else>
      <AppListRow
        title="Masuk"
        :description="shift"
        icon="i-lucide-log-in"
      >
        <template #trailing>
          {{ data?.hariIni?.masuk?.jam ?? '—' }}
        </template>
      </AppListRow>
      <AppListRow
        title="Pulang"
        icon="i-lucide-log-out"
      >
        <template #trailing>
          {{ data?.hariIni?.pulang?.jam ?? '—' }}
        </template>
      </AppListRow>
    </template>
  </AppList>
</template>
