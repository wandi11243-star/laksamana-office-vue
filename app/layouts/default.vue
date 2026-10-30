<!--
  App shell, laid out like the old Office (DESIGN.md › Shell):
  a 248px sidebar on the left and a top bar over the content; the hamburger
  collapses the sidebar to an icon rail. Below lg the sidebar gives way to a
  bottom bar (AppNavBawah). Inside a module with its own chrome
  (utils/modul-shell.ts) the top bar carries the module's search, gold "+"
  and bell.
-->
<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'

const route = useRoute()
const router = useRouter()
const { key, shell } = useModulShell()

const desktop = useMediaQuery('(min-width: 1024px)')
const sembunyi = ref(false)

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
    class="min-h-dvh transition-[grid-template-columns] duration-200 lg:grid print:block"
    :class="sembunyi ? 'lg:grid-cols-[76px_1fr]' : 'lg:grid-cols-[248px_1fr]'"
  >
    <aside
      v-if="desktop"
      class="sticky top-0 h-dvh overflow-hidden border-e border-default print:hidden"
    >
      <AppSidebar
        :key="key"
        :mini="sembunyi"
      />
    </aside>

    <div class="min-w-0">
      <header class="sticky top-0 z-10 flex print:hidden items-center gap-2.5 border-b border-default bg-default/95 px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur-sm lg:gap-3 lg:px-5">
        <UButton
          icon="i-lucide-menu"
          color="neutral"
          variant="outline"
          size="lg"
          class="hidden lg:inline-flex"
          aria-label="Tampilkan atau sembunyikan menu"
          @click="sembunyi = !sembunyi"
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

      <main class="px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 lg:px-6 lg:pb-12 lg:pt-7 2xl:px-10">
        <AppHrisBanner
          v-if="key === 'hr' || (key === 'jadwal' && route.path !== '/jadwal/pengaturan')"
          :modul="key === 'hr' ? 'hr' : 'jadwal'"
          class="mb-5"
        />
        <slot />
      </main>
    </div>

    <AppNavBawah
      v-if="!desktop"
      :key="key"
      class="print:hidden"
    />
  </div>
</template>
