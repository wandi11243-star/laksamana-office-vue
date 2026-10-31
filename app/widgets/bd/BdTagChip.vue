<!--
  One `#tag` chip in its tag colour (old `tagHtml`, deploy/bd/index.html:2396).
  The colour belongs to the TAG: every task wearing #Andi shares one colour
  (`warnaTag` over the `tagWarna` settings map, stable name-hash fallback).
  One component for the Kanban card, the task tree, the Recurring rows and the
  task form, so a colour change repaints everywhere at once.
-->
<script setup lang="ts">
import { gayaTag, warnaTag } from '~/utils/bd-rumus'
import { useTagWarna } from '~/composables/useBd'

const props = withDefaults(defineProps<{
  tag: string
  /** Resolved colours; when absent the shared settings document is read. */
  peta?: Record<string, string> | null
  /** Off = outline style (an unpicked choice in the form). */
  aktif?: boolean
}>(), {
  peta: null,
  aktif: true,
})

const jatuh = useTagWarna()
const warna = computed(() => warnaTag(props.tag, props.peta ?? jatuh.value))
const gaya = computed(() => gayaTag(warna.value, props.aktif))
</script>

<template>
  <span
    class="inline-block max-w-full truncate rounded-full border px-2 py-px text-[10px] font-semibold"
    :style="gaya"
    :title="`Untuk: ${tag}`"
  >#{{ tag }}</span>
</template>
