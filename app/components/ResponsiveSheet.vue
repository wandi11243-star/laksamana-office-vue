<!--
  Forms and confirmations: a bottom sheet (UDrawer) on phones, a dialog (UModal)
  on desktop. Same content either way.
    <ResponsiveSheet v-model:open="open" title="Absen masuk?" description="...">
      <template #footer> <UButton ... /> </template>
    </ResponsiveSheet>
-->
<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'

defineProps<{
  title: string
  description?: string
}>()

const open = defineModel<boolean>('open', { default: false })
const desktop = useMediaQuery('(min-width: 1024px)')
</script>

<template>
  <UModal
    v-if="desktop"
    v-model:open="open"
    :title="title"
    :description="description"
  >
    <template
      v-if="$slots.default"
      #body
    >
      <slot />
    </template>
    <template
      v-if="$slots.footer"
      #footer
    >
      <div class="flex w-full flex-row-reverse gap-2">
        <slot name="footer" />
      </div>
    </template>
  </UModal>
  <UDrawer
    v-else
    v-model:open="open"
    :title="title"
    :description="description"
  >
    <template
      v-if="$slots.default"
      #body
    >
      <slot />
    </template>
    <template
      v-if="$slots.footer"
      #footer
    >
      <div class="grid gap-2 [&>*]:w-full [&>*]:justify-center">
        <slot name="footer" />
      </div>
    </template>
  </UDrawer>
</template>
