<script setup lang="ts">
const { grouped } = useModulNav()
const Link = resolveComponent('NuxtLink')
</script>

<template>
  <AppPage title="Modul">
    <p
      v-if="!grouped.length"
      class="rounded-panel border border-default bg-default shadow-panel p-6 text-center text-muted"
    >
      Anda belum punya akses ke modul apa pun. Minta admin membukanya di Kelola Akses.
    </p>
    <section
      v-for="g in grouped"
      :key="g.group"
      class="mb-7"
    >
      <h2 class="px-1 pb-3 text-sm font-semibold text-muted">
        {{ g.group }}
      </h2>
      <div class="grid grid-cols-4 gap-x-2 gap-y-5 sm:grid-cols-6 lg:grid-cols-8">
        <component
          :is="m.ready ? Link : 'div'"
          v-for="m in g.items"
          :key="m.key"
          :to="m.ready ? m.to : undefined"
          class="grid justify-items-center gap-1.5 text-center text-xs font-medium"
          :class="m.ready ? 'text-default' : 'text-dimmed'"
          :aria-disabled="!m.ready || undefined"
        >
          <span
            class="grid size-14 place-items-center rounded-panel border border-default bg-default shadow-panel"
            :class="!m.ready && 'opacity-50'"
          >
            <UIcon
              :name="m.icon"
              class="size-6"
            />
          </span>
          {{ m.label }}
          <span
            v-if="!m.ready"
            class="-mt-1 text-[10px]"
          >Segera</span>
        </component>
      </div>
    </section>
  </AppPage>
</template>
