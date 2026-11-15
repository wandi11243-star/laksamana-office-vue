<!--
  Stock › Kelola Akses — one screen for both panels (owner request, Nov 2026):
  the old Office had a Kelola Akses inside Ordering and another inside
  Purchasing. Each tab is the old screen as it was (StockAksesOrdering /
  StockAksesPurchasing) and shows only to that panel's admin; with one tab
  the switch is hidden. `?tab=ordering|purchasing` opens a tab directly.
-->
<script setup lang="ts">
import { isAdminOf } from '~/composables/useMe'

definePageMeta({ access: ['ordering', 'purchasing'] })

const me = useMe()
const route = useRoute()
const router = useRouter()

const adminOrdering = computed(() => isAdminOf(me.value, 'ordering'))
const adminPurchasing = computed(() => isAdminOf(me.value, 'purchasing'))

type Tab = 'ordering' | 'purchasing'
const opsi = computed(() => [
  ...(adminOrdering.value ? [{ value: 'ordering' as const, label: 'Ordering', icon: 'i-lucide-shopping-cart' }] : []),
  ...(adminPurchasing.value ? [{ value: 'purchasing' as const, label: 'Purchasing', icon: 'i-lucide-clipboard-list' }] : []),
])

const tab = computed<Tab>({
  get: () => {
    const q = route.query.tab
    if ((q === 'ordering' || q === 'purchasing') && opsi.value.some(o => o.value === q)) return q
    return opsi.value[0]?.value ?? 'ordering'
  },
  set: v => router.replace({ query: { ...route.query, tab: v } }),
})
</script>

<template>
  <AppPage
    title="Kelola Akses"
    description="Kru Ordering & Purchasing beserta perannya, dalam satu halaman"
  >
    <AppPanel
      v-if="!opsi.length"
      title="Khusus admin"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Kelola Akses hanya untuk admin Ordering atau admin Purchasing.
      </p>
    </AppPanel>

    <template v-else>
      <AppSeg
        v-if="opsi.length > 1"
        v-model="tab"
        :options="opsi"
        class="mb-5"
      />
      <StockAksesOrdering v-if="tab === 'ordering'" />
      <StockAksesPurchasing v-else />
    </template>
  </AppPage>
</template>
