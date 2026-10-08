<!--
  Stock › Pilih Panel (old launcher, deploy/stock/index.html:86-91,184-232).

  One backend, five panels with their own keys: ordering, purchasing, tree,
  usage, hpp. Someone holding exactly one BUILT panel goes straight there;
  a panel that is not built yet reads "Segera" instead of linking nowhere.
  Usage-only sessions are let in (K-07): the old `<head>` gate dropped them,
  but the panel list itself names them.
-->
<script setup lang="ts">
import { hasAccess } from '~/composables/useMe'

definePageMeta({ access: ['ordering', 'purchasing', 'tree', 'usage', 'hpp'] })

const me = useMe()

interface Panel { key: string, label: string, sub: string, icon: string, to?: string, kunci: string[] }

const semua: Panel[] = [
  { key: 'ordering', label: 'Ordering', sub: 'Order & check-in penerimaan', icon: 'i-lucide-chef-hat', to: '/stock/ordering', kunci: ['ordering'] },
  { key: 'purchasing', label: 'Purchasing', sub: 'Antrean order, vendor & dispatch', icon: 'i-lucide-clipboard-list', to: '/stock/purchasing', kunci: ['purchasing'] },
  { key: 'tree', label: 'Pohon Resep', sub: 'Rincian menu sampai bahan mentah', icon: 'i-lucide-tree-deciduous', to: '/stock/tree', kunci: ['tree'] },
  { key: 'usage', label: 'Pemakaian Bahan Baku', sub: 'Bahan untuk prasmanan, training & RND', icon: 'i-lucide-utensils', to: '/stock/usage', kunci: ['usage'] },
  { key: 'hpp', label: 'HPP & Resep', sub: 'Resep, harga bahan, modal per menu & COGS', icon: 'i-lucide-calculator', to: '/stock/hpp', kunci: ['hpp'] },
]

const panels = computed(() => semua.filter(p => hasAccess(me.value, p.kunci)))

onMounted(() => {
  const siap = panels.value.filter(p => p.to)
  if (panels.value.length === 1 && siap.length === 1) navigateTo(siap[0]!.to!)
})
</script>

<template>
  <AppPage
    title="Stock"
    description="Sistem order bahan baku — “Dari dapur ke gudang, satu alur pesanan.”"
  >
    <AppPanel
      title="Pilih panel"
      :description="me?.name ? `Masuk sebagai ${me.name}. Panel yang tampil hanya yang kamu berhak buka.` : 'Panel yang tampil hanya yang kamu berhak buka.'"
    >
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="p in panels"
          :key="p.key"
          class="flex flex-col rounded-panel border border-default bg-default p-4 shadow-panel"
        >
          <div class="mb-2 flex items-center gap-2">
            <UIcon
              :name="p.icon"
              class="size-5 text-primary-700"
            />
            <b class="text-highlighted">{{ p.label }}</b>
            <AppStatus
              v-if="!p.to"
              color="neutral"
              size="sm"
            >
              Segera
            </AppStatus>
          </div>
          <p class="mb-4 flex-1 text-sm text-muted">
            {{ p.sub }}
          </p>
          <UButton
            v-if="p.to"
            label="Buka panel"
            :to="p.to"
            icon="i-lucide-arrow-right"
            class="self-start"
          />
          <p
            v-else
            class="text-sm text-muted"
          >
            Panel ini sedang dibangun — layarnya menyusul.
          </p>
        </div>
        <div
          v-if="!panels.length"
          class="rounded-panel border border-default bg-default p-4 text-sm text-muted"
        >
          Akunmu belum memegang satu pun panel Stock.
        </div>
      </div>

      <p class="mt-4 text-sm text-muted">
        Kembali ke <ULink
          to="/"
          class="font-semibold text-primary-700"
        >Beranda Office</ULink>.
      </p>
    </AppPanel>
  </AppPage>
</template>
