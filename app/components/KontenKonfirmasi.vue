<!--
  Confirmation sheet for the Konten screens: the old `confirm()` texts keep
  their guard without a browser popup.
-->
<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  confirmLabel?: string
  color?: 'error' | 'primary'
  loading?: boolean
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
    <slot />
    <template #footer>
      <UButton
        :label="confirmLabel || 'Hapus'"
        :color="color || 'error'"
        :loading="loading"
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
