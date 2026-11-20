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
  /** Wider modal and bounded, independently scrollable body for long record details. */
  detail?: boolean
  /**
   * Wider dialog for a form whose fields sit side by side (owner request,
   * Nov 2026: "Rabu, 18…" was cut in a 3-column row of the default 512px
   * dialog). `true` = 896px for three or more columns; 'sedang' = 672px for two
   * columns holding a date / hour field; 'penuh' = the whole screen, for a
   * table plan (owner request, Nov 2026: "denah langsung full screen").
   * Phones are unaffected (bottom sheet).
   */
  lebar?: boolean | 'sedang' | 'penuh'
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
    :fullscreen="lebar === 'penuh'"
    :ui="detail ? {
      content: 'max-w-4xl rounded-xl',
      body: 'max-h-[72vh] overflow-y-auto',
      footer: 'flex-wrap justify-end',
    } : lebar === 'penuh' ? { content: 'rounded-none', body: 'flex-1 overflow-y-auto' }
      : lebar ? { content: lebar === 'sedang' ? 'max-w-2xl' : 'max-w-4xl' } : undefined"
  >
    <template
      v-if="$slots.title"
      #title
    >
      <slot name="title" />
    </template>
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
      <div :class="detail ? 'flex w-full flex-wrap items-center justify-end gap-2' : 'flex w-full flex-row-reverse gap-2'">
        <slot name="footer" />
      </div>
    </template>
  </UModal>
  <UDrawer
    v-else
    v-model:open="open"
    :title="title"
    :description="description"
    :close="detail"
    :ui="detail ? {
      content: 'max-h-[92dvh]',
      container: 'h-[92dvh] max-h-[92dvh] gap-0 overflow-hidden p-0',
      header: 'px-4 pt-4 pb-3 sm:px-6',
      body: 'min-h-0 flex-1 overflow-y-auto px-4 py-3',
      footer: 'shrink-0 border-t border-default bg-default px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]',
    } : undefined"
  >
    <template
      v-if="$slots.title"
      #title
    >
      <slot name="title" />
    </template>
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
      <div :class="detail ? 'grid w-full grid-cols-2 gap-2 [&>*]:min-h-11 [&>*]:w-full [&>*]:justify-center' : 'grid gap-2 [&>*]:w-full [&>*]:justify-center'">
        <slot name="footer" />
      </div>
    </template>
  </UDrawer>
</template>
