<!--
  Finance › Pilih Panel (old launcher, deploy/finance/index.html:147-211).

  One card, three panels with separate keys: omset/ (`kompas`), kas/
  (`finance`), brankas/ (`brankas`). Someone holding exactly one panel goes
  straight there; the launcher explains itself when a panel is not built yet
  instead of redirecting into a missing page.
-->
<script setup lang="ts">
import { hasAccess } from '~/composables/useMe'

definePageMeta({ access: ['kompas', 'finance', 'brankas'] })

const me = useMe()

interface Panel { key: string, label: string, sub: string, icon: string, to?: string, kunci: string[] }

const semua: Panel[] = [
  { key: 'omset', label: 'Input Omset Harian', sub: 'Omset, report daily, piutang, compliment & breakdown', icon: 'i-lucide-trending-up', to: '/finance/omset/input', kunci: ['kompas'] },
  { key: 'kas', label: 'Kas Kecil, Performa & Rekap', sub: 'Buku kas, rekap penjualan, dashboard omset, analytics, ranking & performa', icon: 'i-lucide-wallet', kunci: ['finance'] },
  { key: 'brankas', label: 'Brankas', sub: 'Posisi kas per bank, piutang, rencana pembayaran & pengembalian modal', icon: 'i-lucide-vault', kunci: ['brankas'] },
]

const panels = computed(() => semua.filter(p => hasAccess(me.value, p.kunci)))

onMounted(() => {
  const siap = panels.value.filter(p => p.to)
  if (panels.value.length === 1 && siap.length === 1) navigateTo(siap[0]!.to!)
})
</script>

<template>
  <AppPage
    title="Finance"
    description="Angka harian & kas perusahaan — “Yang diisi tiap malam, yang dibaca tiap pagi.”"
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
          Akunmu belum memegang satu pun panel Finance.
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
