<!--
  A panel (DESIGN.md, the WattVision chart / asset cards): a white card with no
  outline and a soft shadow (or, `bersarang`, a paper box inside another panel), a roomy head (display title, optional gold icon and
  count pill, buttons on the right) running straight into the body. `flush`
  drops the body padding for a table that runs edge to edge; then a hairline
  separates the head from the table.
-->
<script setup lang="ts">
defineProps<{
  title?: string
  icon?: string
  count?: number | string
  description?: string
  flush?: boolean
  /** A panel inside another panel: layer 3 (paper + hairline, no shadow),
   *  so it reads apart from the white card around it (DESIGN.md › Lapisan). */
  bersarang?: boolean
}>()
</script>

<template>
  <section
    class="overflow-hidden"
    :data-flush="flush || undefined"
    :class="bersarang ? 'mb-0 rounded-xl border border-default bg-muted' : 'mb-6 rounded-panel bg-default shadow-panel'"
  >
    <header
      v-if="title || $slots.head || $slots.actions"
      class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 lg:px-7 lg:pt-6"
      :class="flush ? 'border-b border-default pb-4 lg:pb-5' : $slots.default ? 'pb-1' : 'pb-5 lg:pb-6'"
    >
      <slot name="head">
        <div class="min-w-0">
          <h2 class="flex items-center gap-2 text-lg font-bold text-highlighted lg:text-xl">
            <UIcon
              v-if="icon"
              :name="icon"
              class="size-5 text-gold-deep"
            />
            {{ title }}
            <span
              v-if="count !== undefined"
              class="rounded-full bg-gold-soft px-2 py-0.5 font-sans text-xs font-bold text-gold-deep num"
            >{{ count }}</span>
          </h2>
          <p
            v-if="description || $slots.description"
            class="mt-0.5 text-sm text-muted"
          >
            <slot name="description">
              {{ description }}
            </slot>
          </p>
        </div>
      </slot>
      <div
        v-if="$slots.actions"
        class="flex flex-wrap items-center gap-2"
      >
        <slot name="actions" />
      </div>
    </header>
    <div
      v-if="$slots.default"
      :class="flush ? '' : 'p-5 lg:px-7 lg:pb-7 lg:pt-5'"
    >
      <slot />
    </div>
  </section>
</template>
