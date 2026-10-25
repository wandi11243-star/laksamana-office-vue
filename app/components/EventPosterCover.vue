<!--
  posterCoverHTML (event/index.html:6372): the poster across the top of an
  event card, or a party icon on a soft band when there is none.
  The poster is stored as a key string (new) or {key} (old rows).
-->
<script setup lang="ts">
import { fileEventUrl } from '~/composables/useEvent'

const props = defineProps<{ poster?: unknown }>()
const key = computed(() => {
  const p = props.poster
  if (typeof p === 'string') return p
  if (p && typeof p === 'object' && 'key' in p) return String((p as { key: unknown }).key ?? '')
  return ''
})
const rusak = ref(false)
watch(key, () => {
  rusak.value = false
})
</script>

<template>
  <img
    v-if="key && !rusak"
    :src="fileEventUrl(key)"
    alt=""
    class="h-32 w-full rounded-t-field object-cover"
    @error="rusak = true"
  >
  <span
    v-else
    class="flex h-32 w-full items-center justify-center rounded-t-field bg-primary-50 text-primary-700"
  >
    <UIcon
      name="i-lucide-party-popper"
      class="size-10"
    />
  </span>
</template>
