<!--
  The WhatsApp text of the sheet (deploy/jadwal/index.html salinTeks :5590):
  copied to the clipboard when the browser allows, always shown so it can be
  copied by hand.
-->
<script setup lang="ts">
const props = defineProps<{ teks: string }>()
const open = defineModel<boolean>('open', { default: false })
const tersalin = ref(false)

watch(open, async (v) => {
  if (!v) return
  tersalin.value = false
  try {
    await navigator.clipboard.writeText(props.teks)
    tersalin.value = true
  }
  catch {
    tersalin.value = false
  }
})
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    title="Teks untuk WhatsApp"
  >
    <p
      class="mb-2 rounded-field px-3 py-2 text-sm"
      :class="tersalin ? 'bg-success/12 text-success' : 'text-muted'"
    >
      {{ tersalin ? 'Sudah tersalin ke clipboard — tinggal tempel di grup.' : 'Salin teks di bawah lalu kirim ke grup.' }}
    </p>
    <UTextarea
      :model-value="teks"
      :rows="14"
      readonly
      class="w-full text-xs"
      @focus="($event.target as HTMLTextAreaElement).select()"
    />
    <template #footer>
      <UButton
        label="Selesai"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
</template>
