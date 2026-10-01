<!--
  Confirmation sheet — used before every destructive or status-moving action, so
  the old `confirm()` dialogs keep their guard without a browser popup.
-->
<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  confirmLabel?: string
  color?: 'error' | 'primary'
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ konfirmasi: [] }>()
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="title"
    :description="description"
  >
    <template #footer>
      <UButton
        :label="confirmLabel || 'Hapus'"
        :color="color || 'error'"
        @click="emit('konfirmasi')"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
</template>
