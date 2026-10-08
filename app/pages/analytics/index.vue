<!--
  The Analytics module opens on its first viewable screen that is built,
  like the old Office (halPertamaBoleh, deploy/analytics/index.html:1038).
  L1 builds only Unggah, so everyone who may upload lands there; L2/L3 add
  their keys to LAYAR_DIBANGUN as each screen lands (ringkasan first).
-->
<script setup lang="ts">
import { LAYAR_ANALYTICS } from '~/utils/layar/analytics'

definePageMeta({ access: ['analytics'] })

/** Screen keys with a page file, in TITLES order. L2/L3 extend this list. */
const LAYAR_DIBANGUN = ['ringkasan', 'hari', 'menu', 'kategori', 'kunjungan', 'meja', 'talent', 'error', 'voidb', 'promo', 'tren', 'event', 'marketing', 'unggah']

const me = useMe()
const router = useRouter()
// The matrix arrives after first paint (shell `siapkan`); redirecting on the
// staf defaults first would strand a viewer on Unggah, a page they may not
// open. So the redirect waits until the matrix is in.
const siap = useAnalyticsAksesSiap()
const ada = (to: string) => router.getRoutes().some(r => r.path === to)
const pertama = computed(() => LAYAR_ANALYTICS.find(
  l => LAYAR_DIBANGUN.includes(l.key) && ada(l.to) && (!l.boleh || (me.value && l.boleh(me.value))),
) ?? null)

watch([pertama, siap], ([l, s]) => {
  if (s && l) navigateTo(l.to, { replace: true })
}, { immediate: true })
</script>

<template>
  <AppPage
    title="Analytics"
    description="Analisa penjualan dari laporan POS yang diunggah"
  >
    <ModulMenu :layar="LAYAR_ANALYTICS" />
  </AppPage>
</template>
