<!--
  The tabs of a grouped menu row (Layar.kelompok): the sidebar shows one row for
  the group, and every screen of the group shows its siblings here, so the
  sidebar stays short as screens are added. Only screens the viewer may open are
  listed; with one (or no group) nothing is drawn. On a phone the row scrolls
  sideways. Drawn once by layouts/default.vue, never by a page.
-->
<script setup lang="ts">
const me = useMe()
const route = useRoute()
const { shell } = useModulShell()

const tab = computed(() => {
  const s = shell.value
  const kini = s?.layar.find(l => l.to === route.path)
  if (!s || !kini?.kelompok) return []
  const isi = s.layar.filter(l => l.kelompok?.label === kini.kelompok!.label
    && (!l.boleh || (me.value && l.boleh(me.value))))
  return isi.length > 1 ? isi : []
})
</script>

<template>
  <nav
    v-if="tab.length"
    :aria-label="`Halaman ${tab[0]!.kelompok!.label}`"
    class="mb-5 overflow-x-auto print:hidden"
  >
    <div class="inline-flex items-center gap-1 rounded-field border border-default bg-default p-1 shadow-panel">
      <NuxtLink
        v-for="l in tab"
        :key="l.key"
        :to="l.to"
        :aria-current="route.path === l.to ? 'page' : undefined"
        class="inline-flex items-center gap-2 whitespace-nowrap rounded-[8px] px-4 py-2 text-sm font-semibold capitalize transition-colors focus-visible:outline-2 focus-visible:outline-primary"
        :class="route.path === l.to ? 'bg-gold-soft text-gold-deep' : 'text-muted hover:bg-muted hover:text-highlighted'"
      >
        <UIcon
          :name="l.icon"
          class="size-4"
        />
        {{ l.label }}
      </NuxtLink>
    </div>
  </nav>
</template>
