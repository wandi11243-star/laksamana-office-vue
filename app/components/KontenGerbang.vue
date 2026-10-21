<!--
  The old canView() gate (deploy/konten/index.html:1402-1414) for one screen:
  the menu already hides it, this covers bookmarks and typed addresses. Shows
  nothing until the state is in, so the role defaults never flash a page the
  matrix closes. Same shape as MarketingGerbang.
-->
<script setup lang="ts">
const props = defineProps<{
  /** View key of app/utils/layar/konten.ts (planning, shooting, ads, …). */
  lihat: string
  /**
   * The screen does not read the full state (it has its own light list, e.g.
   * Content Planning): decide from the light crew + matrix dict instead of
   * waiting ~7 s for the 4,8 MB `/konten/state`. Same access rule either way.
   */
  ringan?: boolean
}>()

const penuh = props.ringan ? null : useStateKonten()
const dict = props.ringan ? useDictKonten() : null
const akses = props.ringan ? useAksesKontenRingan() : useAksesKonten()
const { saya, canView } = akses
const error = computed(() => (penuh ? penuh.error.value : dict!.error.value))
const siap = computed(() => (penuh ? penuh.status.value === 'success' : dict!.status.value === 'success') || !!error.value)
const boleh = computed(() => canView(props.lihat))
</script>

<template>
  <slot v-if="siap && (boleh || error)" />
  <AppPanel v-else-if="siap">
    <div class="flex flex-col items-center gap-2 py-8 text-center">
      <UIcon
        name="i-lucide-lock"
        class="size-8 text-muted"
      />
      <p class="text-lg font-semibold text-highlighted">
        Akses ditolak
      </p>
      <p class="max-w-md text-sm text-muted">
        {{ saya?.user.name }} tidak punya akses ke halaman ini.
      </p>
      <UButton
        label="Ke Dashboard"
        to="/konten/dashboard"
        color="neutral"
        variant="outline"
        class="mt-2"
      />
    </div>
  </AppPanel>
</template>
