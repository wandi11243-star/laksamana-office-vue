<!--
  Investor Compass › Promo. Running and upcoming promos from BD OS: names,
  benefits and outlets only — no prices, no clients.

    laksamana-office/investor/index.html:543-551  tab markup
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { InvestorAgendaPromo } from '~/composables/useInvestor'
import { useInvestorAgenda } from '~/composables/useInvestor'
import { fTglP } from '~/utils/format'

definePageMeta({ access: ['investor'] })

const { data: agenda, status, error, refresh } = useInvestorAgenda()
const promo = computed(() => agenda.value?.promo ?? [])
const gagal = computed(() => agenda.value?.gagal ?? [])
const lebih = computed(() => agenda.value?.promoLebih ?? 0)

const kolom = computed<TableColumn<InvestorAgendaPromo>[]>(() => [
  { accessorKey: 'nama', header: 'Promo' },
  { accessorKey: 'benefit', header: 'Benefit' },
  { accessorKey: 'outlet', header: 'Outlet' },
  { accessorKey: 'periode', header: 'Periode' },
  { accessorKey: 'status', header: 'Status' },
])

const periode = (p: InvestorAgendaPromo) => {
  if (p.mulai && p.selesai) return `${fTglP(p.mulai)} – ${fTglP(p.selesai)}`
  if (p.mulai) return `mulai ${fTglP(p.mulai)}`
  if (p.selesai) return `s/d ${fTglP(p.selesai)}`
  return '—'
}
</script>

<template>
  <AppPage
    title="Promo"
    description="Yang sedang berjalan dan yang akan datang, dari modul BD OS"
  >
    <AppPanel
      v-if="status === 'pending'"
      title="Memuat promo"
    >
      <USkeleton class="h-24 w-full" />
    </AppPanel>

    <div v-else-if="error || !agenda">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Promo tidak bisa dibaca"
        :description="apiErrorMessage(error, 'Periksa koneksi, lalu muat ulang halaman.')"
      />
      <UButton
        label="Muat ulang"
        color="error"
        variant="soft"
        class="mt-3"
        @click="() => refresh()"
      />
    </div>

    <template v-else>
      <UAlert
        v-if="gagal.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Daftar mungkin belum lengkap"
        :description="`Data dari ${gagal.join(', ')} tidak terbaca saat ini.`"
        class="mb-5"
      />

      <AppPanel
        title="Promo"
        icon="i-lucide-badge-percent"
        :count="promo.length"
        flush
      >
        <p
          v-if="!promo.length"
          class="px-4 py-6 text-sm text-muted"
        >
          Tidak ada promo yang sedang berjalan atau akan datang.
        </p>

        <template v-else>
          <UTable
            class="hidden lg:block"
            :data="promo"
            :columns="kolom"
            empty="Tidak ada promo."
          >
            <template #nama-cell="{ row }">
              <b>{{ row.original.nama }}</b>
              <span
                v-if="row.original.kategori"
                class="block text-[13px] font-normal text-muted"
              >{{ row.original.kategori }}</span>
            </template>
            <template #benefit-cell="{ row }">
              {{ row.original.benefit || '—' }}
            </template>
            <template #outlet-cell="{ row }">
              {{ row.original.outlet || '—' }}
            </template>
            <template #periode-cell="{ row }">
              {{ periode(row.original) }}
            </template>
            <template #status-cell="{ row }">
              <AppStatus
                size="sm"
                :color="row.original.status === 'running' ? 'success' : 'warning'"
                :icon="row.original.status === 'running' ? 'i-lucide-play' : 'i-lucide-hourglass'"
              >
                {{ row.original.status === 'running' ? 'Berjalan' : 'Akan datang' }}
              </AppStatus>
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="(p, i) in promo"
              :key="i"
              class="px-4 py-3"
            >
              <div class="flex items-start justify-between gap-3">
                <p class="font-semibold text-highlighted">
                  {{ p.nama }}
                </p>
                <AppStatus
                  size="sm"
                  :color="p.status === 'running' ? 'success' : 'warning'"
                  :icon="p.status === 'running' ? 'i-lucide-play' : 'i-lucide-hourglass'"
                >
                  {{ p.status === 'running' ? 'Berjalan' : 'Akan datang' }}
                </AppStatus>
              </div>
              <p
                v-if="p.benefit"
                class="mt-0.5 text-sm text-default"
              >
                {{ p.benefit }}
              </p>
              <p class="text-sm text-muted">
                {{ [p.kategori, p.outlet, periode(p)].filter(x => x && x !== '—').join(' · ') || '—' }}
              </p>
            </div>
          </div>
          <p
            v-if="lebih > 0"
            class="px-4 py-2 text-[13px] text-muted"
          >
            + {{ lebih }} promo lagi tidak ditampilkan.
          </p>
        </template>
      </AppPanel>
    </template>
  </AppPage>
</template>
