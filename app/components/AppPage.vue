<!--
  Every page starts with this, like the old Office's page head: the title and one
  line under it on the left, the page's own buttons on the right (#actions).

  On desktop the title moves up into the top bar beside the sidebar toggle, as
  in the old Office (module name in small gold caps over the page title): this
  component publishes it through `useJudulHalaman()` and the layout draws it.
  Phones and Beranda (which has no top bar) keep the title here.
-->
<script setup lang="ts">
const props = defineProps<{
  title: string
  description?: string
  back?: { label: string, to: string }
  // A narrower column for launcher-style pages (Beranda) that read better
  // with breathing room left and right on wide screens.
  narrow?: boolean
}>()

const route = useRoute()
const slots = useSlots()
const judul = useJudulHalaman()
const beranda = computed(() => route.path === '/')

watchEffect(() => {
  judul.value = props.title
})
onBeforeUnmount(() => {
  // Leave the next page's title alone if it already set its own.
  if (judul.value === props.title) judul.value = ''
})

// With the title in the top bar, an empty head row would only leave a gap.
const kepalaKosongDesktop = computed(() => !beranda.value && !props.description && !slots.actions)
</script>

<template>
  <div
    class="mx-auto w-full"
    :class="narrow ? 'max-w-6xl' : 'max-w-[1400px]'"
  >
    <ULink
      v-if="back"
      :to="back.to"
      class="-ms-1 mb-1 inline-flex items-center gap-0.5 py-1 text-sm font-semibold text-muted hover:text-highlighted"
    >
      <UIcon
        name="i-lucide-chevron-left"
        class="size-4"
      />{{ back.label }}
    </ULink>
    <header
      class="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3"
      :class="kepalaKosongDesktop && 'lg:hidden'"
    >
      <div class="min-w-0">
        <h1
          class="text-balance text-2xl font-bold text-highlighted lg:text-[26px]"
          :class="!beranda && 'lg:hidden'"
        >
          {{ title }}
        </h1>
        <p
          v-if="description"
          class="mt-1 text-sm text-muted"
          :class="!beranda && 'lg:mt-0'"
        >
          {{ description }}
        </p>
      </div>
      <div
        v-if="$slots.actions"
        class="flex flex-wrap items-center gap-2"
      >
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </div>
</template>
