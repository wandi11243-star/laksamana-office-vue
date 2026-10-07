<!--
  Cashier › Rekap Stock Rokok (deploy/cashier/index.html viewRokokRekap :3447-3508).

  Read-only on purpose: only Daily Stock Rokok writes numbers. Rows are sorted
  by KELUAR desc — the question brought here is "what sells / needs restocking",
  and alphabetical order hides the answer. Items that never moved stay visible
  at the bottom: zero is a valid answer, and hiding it makes "not selling"
  indistinguishable from "never registered".
-->
<script setup lang="ts">
import { daftarRokok, rokokRekapBulan } from '~/utils/cashier'
import { getRokok, getRokokItems } from '~/composables/useCashier'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['cashier'] })

const mk = ref(hariIni().slice(0, 7))

const { data, error } = useAsyncData('cashier-rokokrekap', async () => {
  const [rokok, items] = await Promise.all([getRokok(), getRokokItems()])
  return { rokok, items }
})

const rekap = computed(() => rokokRekapBulan(data.value?.rokok.value, daftarRokok(data.value?.items.value), mk.value))
const urut = computed(() => rekap.value.baris.slice().sort((a, b) => b.keluar - a.keluar || a.n.localeCompare(b.n)))
const maxKeluar = computed(() => Math.max(1, ...urut.value.map(b => b.keluar)))
const nGerak = computed(() => rekap.value.baris.filter(b => b.masuk || b.keluar).length)
const minus = computed(() => rekap.value.baris.filter(b => b.akhir < 0))
const ada = computed(() => rekap.value.tgl.length > 0)
const rataHari = computed(() => (rekap.value.tgl.length ? rekap.value.tKeluar / rekap.value.tgl.length : 0))

const labelBulan = computed(() => {
  const d = new Date(`${mk.value}-01T00:00:00`)
  return Number.isNaN(+d) ? mk.value : d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
})
function geser(n: number) {
  const p = mk.value.split('-')
  const d = new Date(Number(p[0]), Number(p[1]) - 1 + n, 1)
  mk.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const persenBar = (b: { keluar: number }) => (b.keluar / maxKeluar.value) * 100
</script>

<template>
  <AppPage
    title="Rekap stock rokok"
    description="Masuk, keluar, dan sisa tiap produk sepanjang satu bulan."
  >
    <AppPanel>
      <template #head>
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <h2 class="text-lg font-semibold text-highlighted">
            Rekap {{ labelBulan }}
          </h2>
          <AppStatus
            v-if="mk !== hariIni().slice(0, 7)"
            size="sm"
          >
            bukan bulan ini
          </AppStatus>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Bulan sebelumnya"
            @click="geser(-1)"
          />
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Bulan berikutnya"
            @click="geser(1)"
          />
          <UButton
            v-if="mk !== hariIni().slice(0, 7)"
            label="Bulan ini"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="mk = hariIni().slice(0, 7)"
          />
        </div>
      </template>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Rekap gagal dimuat: ${apiErrorMessage(error)}`"
      />

      <p
        v-if="!ada"
        class="rounded-field bg-muted px-3 py-6 text-center text-sm text-muted"
      >
        Belum ada catatan stock untuk <b>{{ labelBulan }}</b>.
        <span class="block">Isi lewat menu <b>Daily Stock Rokok</b> — rekap ini menjumlah apa yang sudah dicatat di sana.</span>
      </p>

      <template v-else>
        <p class="mb-4 text-sm text-muted">
          Dijumlah dari <b>{{ rekap.tgl.length }} hari</b> yang tercatat di Daily Stock Rokok.
        </p>

        <AppStatGrid>
          <AppStat
            label="Total keluar"
            icon="i-lucide-trending-down"
            :value="rekap.tKeluar"
            :sub="rekap.tgl.length ? `rata-rata ${rataHari.toFixed(1)} / hari tercatat` : undefined"
            tone="warning"
          />
          <AppStat
            label="Total masuk"
            icon="i-lucide-trending-up"
            :value="rekap.tMasuk"
            sub="barang yang ditambahkan bulan ini"
            tone="success"
          />
          <AppStat
            label="Sisa akhir bulan"
            icon="i-lucide-package"
            :value="rekap.tAkhir"
            sub="seluruh item digabung"
          />
          <AppStat
            label="Produk bergerak"
            icon="i-lucide-activity"
            :value="`${nGerak} / ${rekap.baris.length}`"
            :sub="`${rekap.baris.length - nGerak} item tanpa pergerakan`"
            tone="info"
          />
        </AppStatGrid>

        <UAlert
          v-if="minus.length"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`${minus.length} item sisa akhirnya minus (${minus.map(x => x.n).join(', ')}).`"
          description="Biasanya ada hari yang barang masuknya belum dicatat — periksa di Daily Stock Rokok."
          class="mb-4"
        />

        <table class="hidden w-full text-sm lg:table">
          <thead class="bg-table-head text-table-head-text">
            <tr>
              <th class="px-4 py-2.5 text-start text-xs font-bold uppercase tracking-wider">
                Produk
              </th>
              <th class="px-4 py-2.5 text-end text-xs font-bold uppercase tracking-wider">
                Sisa awal
              </th>
              <th class="px-4 py-2.5 text-end text-xs font-bold uppercase tracking-wider">
                Masuk
              </th>
              <th class="px-4 py-2.5 text-end text-xs font-bold uppercase tracking-wider">
                Keluar
              </th>
              <th class="px-4 py-2.5 text-end text-xs font-bold uppercase tracking-wider">
                Sisa akhir
              </th>
              <th class="px-4 py-2.5 text-end text-xs font-bold uppercase tracking-wider">
                Hari bergerak
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="b in urut"
              :key="b.k"
            >
              <td class="px-4 py-2">
                <b class="text-highlighted">{{ b.n }}</b>
                <span
                  v-if="b.lain"
                  class="block text-[11px] text-muted"
                >bukan rokok</span>
                <span class="mt-1 block h-1 w-full overflow-hidden rounded-full bg-muted">
                  <span
                    class="block h-full rounded-full bg-primary-400"
                    :style="{ width: `${persenBar(b)}%` }"
                  />
                </span>
              </td>
              <td class="px-4 py-2 text-end text-muted num">
                {{ b.awal }}
              </td>
              <td class="px-4 py-2 text-end num">
                {{ b.masuk }}
              </td>
              <td class="px-4 py-2 text-end font-bold num">
                {{ b.keluar }}
              </td>
              <td
                class="px-4 py-2 text-end font-bold num"
                :class="b.akhir < 0 ? 'text-error' : 'text-highlighted'"
              >
                {{ b.akhir }}
              </td>
              <td class="px-4 py-2 text-end text-muted num">
                {{ b.hariGerak }} / {{ rekap.tgl.length }}
              </td>
            </tr>
          </tbody>
          <tfoot class="border-t-2 border-default font-bold">
            <tr>
              <td class="px-4 py-2">
                Total
              </td>
              <td class="px-4 py-2 text-end num">
                {{ rekap.tAwal }}
              </td>
              <td class="px-4 py-2 text-end num">
                {{ rekap.tMasuk }}
              </td>
              <td class="px-4 py-2 text-end num">
                {{ rekap.tKeluar }}
              </td>
              <td class="px-4 py-2 text-end num">
                {{ rekap.tAkhir }}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>

        <div class="divide-y divide-default lg:hidden">
          <article
            v-for="b in urut"
            :key="b.k"
            class="space-y-2 px-4 py-3"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="font-semibold text-highlighted">
                  {{ b.n }}
                </p>
                <p
                  v-if="b.lain"
                  class="text-[11px] text-muted"
                >
                  bukan rokok
                </p>
              </div>
              <div class="shrink-0 text-end">
                <p
                  class="font-bold num"
                  :class="b.akhir < 0 ? 'text-error' : 'text-highlighted'"
                >
                  {{ b.akhir }}
                </p>
                <p class="text-[11px] text-muted">
                  sisa akhir
                </p>
              </div>
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              <span>Awal <b class="text-highlighted num">{{ b.awal }}</b></span>
              <span>Masuk <b class="text-highlighted num">{{ b.masuk }}</b></span>
              <span>Keluar <b class="text-highlighted num">{{ b.keluar }}</b></span>
              <span>Gerak <b class="text-highlighted num">{{ b.hariGerak }} / {{ rekap.tgl.length }}</b></span>
            </div>
            <span class="block h-1 w-full overflow-hidden rounded-full bg-muted">
              <span
                class="block h-full rounded-full bg-primary-400"
                :style="{ width: `${persenBar(b)}%` }"
              />
            </span>
          </article>
        </div>
      </template>
    </AppPanel>
  </AppPage>
</template>
