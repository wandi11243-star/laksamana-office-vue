<!--
  App shell, laid out like the old Office (DESIGN.md › Shell):
  a 248px sidebar on the left and a top bar over the content. On a phone the
  sidebar slides in from the hamburger; on a desktop the hamburger hides it.
  Inside a module with its own chrome (utils/modul-shell.ts) the top bar carries
  the module's search, gold "+" and bell.
-->
<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { key, shell } = useModulShell()

const laci = ref(false)
const sembunyi = ref(false)
function toggleMenu() {
  if (window.matchMedia('(min-width: 1024px)').matches) sembunyi.value = !sembunyi.value
  else laci.value = !laci.value
}
watch(() => route.fullPath, () => {
  laci.value = false
})

const q = ref('')
watch(() => route.query.q, (v) => {
  q.value = typeof v === 'string' ? v : ''
}, { immediate: true })
function cari() {
  const c = shell.value?.cari
  if (!c) return
  router.push({ path: c.to, query: q.value.trim() ? { q: q.value.trim() } : {} })
}

// Live search for shells that ask for it (Help): the old page searched as you
// typed with a 180 ms debounce, updating the results in place.
let tundaCari: ReturnType<typeof setTimeout> | null = null
watch(q, (v) => {
  const c = shell.value?.cari
  if (!c?.realtime) return
  const kata = v.trim()
  if (route.path === c.to && String(route.query.q ?? '') === kata) return
  if (tundaCari) clearTimeout(tundaCari)
  tundaCari = setTimeout(() => {
    router.replace({ path: c.to, query: kata ? { q: kata } : {} })
  }, 180)
})
onBeforeUnmount(() => {
  if (tundaCari) clearTimeout(tundaCari)
})
</script>

<template>
  <div
    class="min-h-dvh lg:grid"
    :class="sembunyi ? 'lg:grid-cols-[0_1fr]' : 'lg:grid-cols-[248px_1fr]'"
  >
    <aside
      class="sticky top-0 hidden h-dvh overflow-hidden border-e border-default lg:block"
      :class="sembunyi && 'invisible'"
    >
      <AppSidebar :key="key" />
    </aside>

    <USlideover
      v-model:open="laci"
      side="left"
      :ui="{ content: 'max-w-[280px]' }"
      title="Menu"
    >
      <template #content>
        <AppSidebar
          :key="key"
          @pilih="laci = false"
        />
      </template>
    </USlideover>

    <div class="min-w-0">
      <header class="sticky top-0 z-10 flex items-center gap-2.5 border-b border-default bg-default/95 px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur-sm lg:gap-3 lg:px-5">
        <UButton
          icon="i-lucide-menu"
          color="neutral"
          variant="outline"
          size="lg"
          aria-label="Tampilkan atau sembunyikan menu"
          @click="toggleMenu"
        />
        <form
          v-if="shell?.cari"
          class="min-w-0 max-w-[520px] flex-1"
          role="search"
          @submit.prevent="cari"
        >
          <UInput
            v-model="q"
            icon="i-lucide-search"
            :placeholder="shell.cari.placeholder"
            size="lg"
            class="w-full"
            :ui="{ base: 'rounded-full bg-muted focus:bg-default' }"
          />
        </form>
        <NuxtLink
          v-else
          to="/"
          class="flex items-center gap-2 lg:hidden"
          aria-label="Beranda"
        >
          <img
            src="/mark.png"
            alt=""
            class="size-8"
          >
        </NuxtLink>
        <div class="flex-1" />
        <AppTopAksi :key="key" />
      </header>

      <main class="px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-5 lg:px-6 lg:pb-12 lg:pt-7 2xl:px-10">
        <slot />
      </main>
    </div>
  </div>
</template>
