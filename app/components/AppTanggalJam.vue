<!--
  Date + time in the app's own look: AppTanggal beside AppJam, in place of a
  native <input type="datetime-local">. The model is the same
  "YYYY-MM-DDTHH:MM" string, '' while no day is chosen:
    <AppTanggalJam v-model="form.mulai" jam-awal="19:00" />
  Picking a day first fills the time with `jamAwal`; picking a time first
  fills today. Emptying the day empties the whole field. They wrap onto two
  lines where the field is narrow.
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** Earliest pickable day, YYYY-MM-DD. */
  min?: string
  /** Time filled in when a day is picked first. */
  jamAwal?: string
}>(), { min: undefined, jamAwal: '00:00' })

const model = defineModel<string>({ default: '' })

// The API may separate the two with a space instead of "T".
const bagian = computed(() => String(model.value ?? '').match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/))

const tanggal = computed({
  get: () => bagian.value?.[1] ?? '',
  set: (v: string) => {
    model.value = v ? `${v}T${bagian.value?.[2] ?? props.jamAwal}` : ''
  },
})
const jam = computed({
  get: () => bagian.value?.[2] ?? '',
  set: (v: string) => {
    if (v) model.value = `${tanggal.value || hariIni()}T${v}`
  },
})
</script>

<template>
  <div class="flex w-full flex-wrap gap-2">
    <AppTanggal
      v-model="tanggal"
      :min="min"
      class="!w-auto min-w-56 flex-1"
    />
    <AppJam
      v-model="jam"
      :clearable="false"
      class="!w-28 shrink-0"
      aria-label="Pilih jam"
    />
  </div>
</template>
