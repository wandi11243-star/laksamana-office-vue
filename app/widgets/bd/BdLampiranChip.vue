<!--
  One sub-task attachment (Nov 2026): a small thumbnail for an image, a file
  icon for anything else, then the name and size. Click opens it in a new tab
  (fetched with the Bearer token — a plain link cannot load it). `hapus`
  shows a remove button (the task form); lists leave it out.
-->
<script setup lang="ts">
import type { BdLampiran } from '~/composables/useBd'
import { bukaLampiranBd, lampiranGambar, ukuranLampiran, urlLampiranBd } from '~/composables/useBd'

const props = defineProps<{ file: BdLampiran, hapus?: boolean }>()
defineEmits<{ hapus: [] }>()

const gambar = computed(() => lampiranGambar(props.file))
const pratinjau = ref('')
watch(() => props.file.key, (k) => {
  pratinjau.value = ''
  if (gambar.value) urlLampiranBd(k).then(u => (pratinjau.value = u)).catch(() => {})
}, { immediate: true })

// Images preview in-app first (owner request, Nov 2026); other files open as before.
const lihat = ref(false)
function klik() {
  if (gambar.value) lihat.value = true
  else void bukaLampiranBd(props.file)
}
function unduh() {
  if (!pratinjau.value) return
  const a = document.createElement('a')
  a.href = pratinjau.value
  a.download = props.file.name || 'lampiran'
  a.click()
}

const ikon = computed(() => {
  const m = String(props.file.mime || '')
  if (m === 'application/pdf') return 'i-lucide-file-text'
  if (m.includes('sheet') || m.includes('excel') || m === 'text/csv') return 'i-lucide-file-spreadsheet'
  if (m.includes('presentation') || m.includes('powerpoint')) return 'i-lucide-presentation'
  return 'i-lucide-file'
})
</script>

<template>
  <span class="inline-flex max-w-full items-center gap-2 rounded-lg border border-default bg-default py-1 pe-1 ps-1">
    <button
      type="button"
      class="flex min-w-0 items-center gap-2 text-left"
      :title="gambar ? `Lihat ${file.name}` : `Buka ${file.name}`"
      @click.stop="klik"
    >
      <img
        v-if="gambar && pratinjau"
        :src="pratinjau"
        :alt="file.name"
        class="size-8 shrink-0 rounded-md object-cover"
      >
      <span
        v-else
        class="grid size-8 shrink-0 place-items-center rounded-md bg-gold-soft text-gold-deep"
      >
        <UIcon
          :name="gambar ? 'i-lucide-image' : ikon"
          class="size-4"
        />
      </span>
      <span class="min-w-0">
        <span class="block max-w-44 truncate text-xs font-semibold text-highlighted">{{ file.name }}</span>
        <span class="block text-[11px] text-muted">{{ ukuranLampiran(file.size) }}</span>
      </span>
    </button>
    <UButton
      v-if="hapus"
      icon="i-lucide-x"
      color="neutral"
      variant="ghost"
      size="xs"
      :aria-label="`Hapus lampiran ${file.name}`"
      @click.stop="$emit('hapus')"
    />
  </span>

  <ResponsiveSheet
    v-model:open="lihat"
    :title="file.name"
    :description="ukuranLampiran(file.size)"
    detail
  >
    <div class="grid min-h-48 place-items-center rounded-xl bg-muted p-2">
      <img
        v-if="pratinjau"
        :src="pratinjau"
        :alt="file.name"
        class="max-h-[65vh] w-auto max-w-full rounded-lg object-contain"
      >
      <UIcon
        v-else
        name="i-lucide-loader-circle"
        class="size-6 animate-spin text-muted"
      />
    </div>
    <template #footer>
      <UButton
        label="Unduh"
        icon="i-lucide-download"
        color="neutral"
        variant="outline"
        :disabled="!pratinjau"
        @click="unduh"
      />
      <UButton
        label="Buka di tab baru"
        icon="i-lucide-external-link"
        @click="bukaLampiranBd(file)"
      />
    </template>
  </ResponsiveSheet>
</template>
