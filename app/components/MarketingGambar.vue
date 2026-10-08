<!--
  A `/marketing/files/{key}` image. The endpoint needs the Bearer token, so
  the picture is fetched as a blob (gambarBerkasMkt, cached per key) instead
  of a plain <img src>. A missing or unreadable file shows a quiet box, not a
  broken-image icon (the old gambarHilang()).
-->
<script setup lang="ts">
const props = defineProps<{ fileKey?: string, alt?: string, imgClass?: string }>()
const emit = defineEmits<{ ukur: [potret: boolean] }>()

const url = ref('')
const gagal = ref(false)
watch(() => props.fileKey, async (k) => {
  url.value = ''
  gagal.value = false
  if (!k) return
  try {
    url.value = await gambarBerkasMkt(k)
  }
  catch {
    gagal.value = true
  }
}, { immediate: true })

/** Orientation, once the picture is in (katUkur: 1.05 so near-squares do not flip). */
function ukur(ev: Event) {
  const img = ev.target as HTMLImageElement
  if (img.naturalWidth && img.naturalHeight) emit('ukur', img.naturalHeight > img.naturalWidth * 1.05)
}
</script>

<template>
  <img
    v-if="url"
    :src="url"
    :alt="alt ?? ''"
    :class="imgClass"
    @load="ukur"
  >
  <div
    v-else
    class="flex items-center justify-center bg-muted text-xs text-muted"
    :class="imgClass"
  >
    <UIcon
      v-if="!gagal && fileKey"
      name="i-lucide-loader-circle"
      class="size-5 animate-spin"
    />
    <span v-else>{{ fileKey ? 'Gambar tidak terbaca' : 'Tanpa gambar' }}</span>
  </div>
</template>
