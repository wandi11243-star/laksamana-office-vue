<!--
  One photo slot: the picture as the website will crop it, and the buttons to
  pick, replace or remove it. The file is uploaded as soon as it is picked
  (POST …/foto → {key}); the key is saved with the item/article on Simpan.
  Removing only clears the key: the old file stays on the server (API v1).
-->
<script setup lang="ts">
import type { UploadHasil } from '~/composables/useHomepage'

const props = defineProps<{
  /** The stored path/URL of the current photo, for the preview. */
  url: string | null
  upload: (file: File) => Promise<UploadHasil>
  /** Tailwind aspect class of the website's crop. */
  aspect?: string
  label?: string
}>()

const key = defineModel<string | null>({ default: null })
const emit = defineEmits<{ sibuk: [boolean] }>()

const toast = useToast()
const input = ref<HTMLInputElement>()
const pratinjau = ref<string | null>(apiFileUrl(props.url))
const memuat = ref(false)

watch(() => props.url, (u) => {
  pratinjau.value = apiFileUrl(u)
})

const MAKS = 8 * 1024 * 1024
const JENIS = ['image/jpeg', 'image/png', 'image/webp']

async function pilih(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (input.value) input.value.value = ''
  if (!file) return
  if (!JENIS.includes(file.type)) {
    toast.add({ title: 'Pilih gambar JPG, PNG, atau WebP.', color: 'error' })
    return
  }
  if (file.size > MAKS) {
    toast.add({ title: 'Ukuran gambar maksimal 8 MB.', color: 'error' })
    return
  }
  memuat.value = true
  emit('sibuk', true)
  try {
    const hasil = await props.upload(file)
    key.value = hasil.key
    pratinjau.value = apiFileUrl(hasil.url)
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, 'Gagal mengunggah gambar.'), color: 'error' })
  }
  finally {
    memuat.value = false
    emit('sibuk', false)
  }
}

function hapus() {
  key.value = null
  pratinjau.value = null
}
</script>

<template>
  <div>
    <p
      v-if="label"
      class="mb-1.5 text-sm font-semibold text-highlighted"
    >
      {{ label }}
    </p>
    <div
      class="group relative overflow-hidden rounded-xl border border-default bg-muted"
      :class="aspect ?? 'aspect-[4/3]'"
    >
      <img
        v-if="pratinjau"
        :src="pratinjau"
        alt=""
        class="size-full object-cover"
      >
      <button
        v-else
        type="button"
        class="flex size-full flex-col items-center justify-center gap-1.5 text-muted hover:text-highlighted"
        @click="input?.click()"
      >
        <UIcon
          name="i-lucide-image-plus"
          class="size-7"
        />
        <span class="text-sm font-semibold">Pilih gambar</span>
        <span class="text-xs text-dimmed">JPG, PNG, WebP · maks. 8 MB</span>
      </button>
      <div
        v-if="memuat"
        class="absolute inset-0 flex items-center justify-center bg-default/70"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-6 animate-spin text-primary"
        />
      </div>
    </div>
    <div
      v-if="pratinjau"
      class="mt-2 flex gap-2"
    >
      <UButton
        label="Ganti"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        size="sm"
        :loading="memuat"
        @click="input?.click()"
      />
      <UButton
        label="Hapus"
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        size="sm"
        :disabled="memuat"
        @click="hapus"
      />
    </div>
    <input
      ref="input"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="hidden"
      @change="pilih"
    >
  </div>
</template>
