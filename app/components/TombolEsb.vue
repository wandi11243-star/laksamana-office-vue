<!--
  The one button that pulls data from ESB (POS). Every "isi dari ESB" action in the app
  uses it, so they all look and size the same: solid gold, regular size, cloud icon.
  Only the label, the busy state and the click differ.
-->
<script setup lang="ts">
defineProps<{
  label: string
  loading?: boolean
  disabled?: boolean
}>()
defineEmits<{ click: [] }>()
</script>

<template>
  <UButton
    :label="label"
    icon="i-lucide-cloud-download"
    color="primary"
    variant="solid"
    :loading="loading"
    :disabled="disabled"
    @click="$emit('click')"
  />
</template>
