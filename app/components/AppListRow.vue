<!--
  One row of an AppList. A link when `to` is set, a button when it has a click
  listener, plain otherwise. Put a value or <AppStatus> in the #trailing slot.
-->
<script setup lang="ts">
const props = defineProps<{
  title: string
  description?: string
  icon?: string
  to?: string
  onClick?: () => void
}>()

const tag = computed(() => props.to ? resolveComponent('NuxtLink') : props.onClick ? 'button' : 'div')
const interactive = computed(() => !!(props.to || props.onClick))
</script>

<template>
  <component
    :is="tag"
    :to="to"
    :type="tag === 'button' ? 'button' : undefined"
    class="flex min-h-14 w-full items-center gap-3.5 px-4 py-3 text-start"
    :class="interactive && 'transition-colors hover:bg-elevated/60 active:bg-elevated focus-visible:outline-2 focus-visible:outline-primary'"
    @click="onClick"
  >
    <UIcon
      v-if="icon"
      :name="icon"
      class="size-5 shrink-0 text-muted"
    />
    <span class="min-w-0 flex-1">
      <span class="block truncate font-semibold text-highlighted">{{ title }}</span>
      <span
        v-if="description || $slots.description"
        class="block text-sm text-muted"
      >
        <slot name="description">{{ description }}</slot>
      </span>
    </span>
    <span
      v-if="$slots.trailing"
      class="shrink-0 text-end font-semibold text-highlighted num"
    >
      <slot name="trailing" />
    </span>
    <UIcon
      v-if="interactive"
      name="i-lucide-chevron-right"
      class="size-4 shrink-0 text-dimmed"
    />
  </component>
</template>
