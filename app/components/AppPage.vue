<!-- Every page starts with this: one large title, optional line under it, optional back link. -->
<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  back?: { label: string, to: string }
}>()
</script>

<template>
  <div class="mx-auto w-full max-w-6xl">
    <ULink
      v-if="back"
      :to="back.to"
      class="-ms-1 mb-1 inline-flex items-center gap-0.5 py-2 text-sm font-semibold text-highlighted"
    >
      <UIcon
        name="i-lucide-chevron-left"
        class="size-4"
      />{{ back.label }}
    </ULink>
    <header class="pb-5 pt-1">
      <h1 class="text-balance text-3xl font-extrabold tracking-tight text-highlighted lg:text-4xl">
        {{ title }}
      </h1>
      <p
        v-if="description"
        class="mt-1 text-muted"
      >
        {{ description }}
      </p>
    </header>
    <slot />
  </div>
</template>
