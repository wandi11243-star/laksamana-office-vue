<!--
  posterKecilHTML (event/index.html:6343): the event's poster as a small
  square, or a party icon when there is none (or the file cannot load).
  The poster is stored as a key string (new) or {key} (old rows).
-->
<script setup lang="ts">
import { fileEventUrl } from '~/composables/useEvent'

const props = withDefaults(defineProps<{ poster?: unknown, size?: number }>(), { poster: undefined, size: 32 })
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
    class="shrink-0 rounded-md border border-default object-cover"
    :style="{ width: `${size}px`, height: `${size}px` }"
    @error="rusak = true"
  >
  <span
    v-else
    class="flex shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <UIcon
      name="i-lucide-party-popper"
      :style="{ width: `${Math.round(size * 0.55)}px`, height: `${Math.round(size * 0.55)}px` }"
    />
  </span>
</template>
