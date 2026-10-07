<!--
  Cashier › Rekap Stock Rokok (old `viewRokokRekap`, deploy/cashier/index.html:3412-3510).
  Read-only on purpose: only Daily Stock Rokok fills the numbers. Sorted by
  "Keluar" (the question is "what sells / what to restock"); items that did not
  move stay listed at the bottom — 0 is a valid answer.
-->
<script setup lang="ts">
import type { RokokData } from '~/utils/cashier'
import { rokokItems, rokokRekapBulan } from '~/utils/cashier'
import { getRokok, getRokokItems } from '~/composables/useCashier'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['cashier'] })

const bulan = ref(hariIni().slice(0, 7))

const { data, error, status } = useAsyncData('cashier-rokokrekap', async () => {
  const [rokok, items] = await Promise.all([getRokok(), getRokokItems()])
  return { rokok: rokok.value as RokokData, items: items.value }
})

const R = computed(() => rokokRekapBulan(data.value?.rokok ?? {}, rokokItems(data.value?.items), bulan.value))
const urut = computed(() => [...R.value.baris].sort((a, b) => b.keluar - a.keluar || a.n.localeCompare(b.n)))
const maxKeluar = computed(() => Math.max(1, ...urut.value.map(b => b.keluar)))
const nGerak = computed(() => R.value.baris.filter(b => b.masuk || b.keluar).length)
const minus = computed(() => R.value.baris.filter(b => b.akhir < 0))
const labelBulan = computed(() => {
  const d = new Date(`${bulan.value}-01T00:00:00`)
  return Number.isNaN(d.getTime()) ? bulan.value : d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
})
</script>

<template>
  <AppPage
    :title="`Rekap ${labelBulan}`"
    description="Masuk, keluar, dan sisa tiap produk sepanjang satu bulan — dijumlah dari Daily Stock Rokok."
  >
    <template #actions>
      <UInput
        v-model="bulan"
        type="month"
        aria-label="Bulan"
      />
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
    />

    <p
      v-else-if="status === 'pending' && !data"
      class="p-6 text-center text-sm text-muted"
    >
      Memuat…
    </p>

    <AppPanel v-else-if="!R.tgl.length">
      <div class="p-6 text-center">
        <UIcon
          name="i-lucide-package-open"
          class="mx-auto size-8 text-dimmed"
        />
        <p class="mt-2 text-sm">
          Belum ada catatan stock untuk <b>{{ labelBulan }}</b>.
        </p>
        <p class="mt-1 text-xs text-muted">
          Isi lewat menu Daily Stock Rokok — rekap ini menjumlah apa yang sudah dicatat di sana.
        </p>
      </div>
    </AppPanel>

    <template v-else>
      <AppStatGrid>
        <AppStat
          label="Total keluar"
          icon="i-lucide-arrow-up-from-line"
          :value="R.tKeluar"
          :sub="`rata-rata ${(R.tKeluar / R.tgl.length).toFixed(1)} / hari tercatat`"
        />
        <AppStat
          label="Total masuk"
          icon="i-lucide-arrow-down-to-line"
          tone="info"
          :value="R.tMasuk"
          sub="barang yang ditambahkan bulan ini"
        />
        <AppStat
          label="Sisa akhir bulan"
          icon="i-lucide-package"
          tone="success"
          :value="R.tAkhir"
          sub="seluruh item digabung"
        />
        <AppStat
          label="Produk bergerak"
          icon="i-lucide-activity"
          tone="vip"
          :value="`${nGerak} / ${R.baris.length}`"
          :sub="`${R.baris.length - nGerak} item tanpa pergerakan`"
        />
      </AppStatGrid>

      <UAlert
        v-if="minus.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`${minus.length} item sisa akhirnya minus (${minus.map(x => x.n).join(', ')}).`"
        description="Biasanya ada hari yang barang masuknya belum dicatat — periksa di Daily Stock Rokok."
      />

      <AppPanel
        :title="`Dijumlah dari ${R.tgl.length} hari tercatat`"
        icon="i-lucide-list-ordered"
        flush
      >
        <table class="hidden w-full text-sm lg:table">
          <thead class="border-b border-default text-xs text-muted">
            <tr>
              <th class="px-4 py-2 text-left font-semibold">
                Produk
              </th>
              <th class="px-4 py-2 text-right font-semibold">
                Sisa awal
              </th>
              <th class="px-4 py-2 text-right font-semibold">
                Masuk
              </th>
              <th class="px-4 py-2 text-right font-semibold">
                Keluar
              </th>
              <th class="px-4 py-2 text-right font-semibold">
                Sisa akhir
              </th>
              <th class="px-4 py-2 text-right font-semibold">
                Hari bergerak
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="b in urut"
              :key="b.k"
              class="border-b border-default"
            >
              <td class="px-4 py-2">
                <b class="text-highlighted">{{ b.n }}</b>
                <span
                  v-if="b.lain"
                  class="block text-xs text-muted"
                >bukan rokok</span>
                <div class="mt-1 h-1 w-40 overflow-hidden rounded-full bg-muted">
                  <div
                    class="h-full bg-primary-400"
                    :style="{ width: `${Math.round(b.keluar / maxKeluar * 100)}%` }"
                  />
                </div>
              </td>
              <td class="num px-4 py-2 text-right">
                {{ b.awal }}
              </td>
              <td
                class="num px-4 py-2 text-right"
                :class="b.masuk ? '' : 'text-muted'"
              >
                {{ b.masuk }}
              </td>
              <td
                class="num px-4 py-2 text-right"
                :class="b.keluar ? 'font-bold' : 'text-muted'"
              >
                {{ b.keluar }}
              </td>
              <td
                class="num px-4 py-2 text-right"
                :class="b.akhir < 0 ? 'font-bold text-error' : ''"
              >
                {{ b.akhir }}
              </td>
              <td class="num px-4 py-2 text-right text-muted">
                {{ b.hariGerak }} / {{ R.tgl.length }}
              </td>
            </tr>
          </tbody>
          <tfoot class="font-bold">
            <tr class="border-t-2 border-default">
              <td class="px-4 py-2">
                TOTAL
              </td>
              <td class="num px-4 py-2 text-right">
                {{ R.tAwal }}
              </td>
              <td class="num px-4 py-2 text-right">
                {{ R.tMasuk }}
              </td>
              <td class="num px-4 py-2 text-right">
                {{ R.tKeluar }}
              </td>
              <td class="num px-4 py-2 text-right">
                {{ R.tAkhir }}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>

        <div class="divide-y divide-default lg:hidden">
          <div
            v-for="b in urut"
            :key="b.k"
            class="p-4"
          >
            <div class="flex items-start justify-between gap-2">
              <b class="text-highlighted">{{ b.n }}</b>
              <span class="text-sm">keluar <b class="num">{{ b.keluar }}</b></span>
            </div>
            <div class="mt-1 h-1 overflow-hidden rounded-full bg-muted">
              <div
                class="h-full bg-primary-400"
                :style="{ width: `${Math.round(b.keluar / maxKeluar * 100)}%` }"
              />
            </div>
            <p class="mt-1.5 text-xs text-muted">
              Awal {{ b.awal }} · masuk {{ b.masuk }} · sisa <b :class="b.akhir < 0 ? 'text-error' : 'text-default'">{{ b.akhir }}</b> · bergerak {{ b.hariGerak }}/{{ R.tgl.length }} hari
            </p>
          </div>
        </div>
      </AppPanel>
    </template>
  </AppPage>
</template>
