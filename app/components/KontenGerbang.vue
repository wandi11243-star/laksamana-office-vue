<!--
  The old canView() gate (deploy/konten/index.html:1402-1414) for one screen:
  the menu already hides it, this covers bookmarks and typed addresses. Shows
  nothing until the state is in, so the role defaults never flash a page the
  matrix closes. Same shape as MarketingGerbang.
-->
<script setup lang="ts">
const props = defineProps<{
  /** View key of app/utils/layar/konten.ts (planning, shooting, ads, …). */
  layar: string
}>()

const { error, status } = useStateKonten()
const { saya, canView } = useAksesKonten()
const siap = computed(() => status.value === 'success' || !!error.value)
const boleh = computed(() => canView(props.layar))
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
