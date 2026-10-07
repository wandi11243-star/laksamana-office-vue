<!--
  Finance › Kas Kecil › Laporan Void (old `viewVoidLap`, deploy/finance/kas/index.html:1757-1850).

  READ-ONLY (T-14/U1, as before): void rows are typed in Cashier › Void Menu,
  and this report only aggregates them. Only LIVE rows are summed; cancelled
  ones are counted and stay visible. The POS comparator card uses `analytics`,
  a module a finance user may not hold (T-15) — it is hidden without it.
-->
<script setup lang="ts">
import type { VoidBaris } from '~/utils/cashier'
import { getVoidKasir } from '~/composables/useCashier'
import { fmtRp } from '~/utils/cashier'
import { hariIni } from '~/utils/format'
import { hasAccess } from '~/composables/useMe'

definePageMeta({ access: ['finance'] })

const me = useMe()
const izin = useKasIzin()
const periode = ref(hariIni().slice(0, 7))
const cari = ref('')

const bulanRentang = computed(() => {
  const [y, m] = periode.value.split('-').map(Number)
  const akhir = new Date(Date.UTC(y!, m!, 0)).getUTCDate()
  return { dari: `${periode.value}-01`, sampai: `${periode.value}-${String(akhir).padStart(2, '0')}` }
})

const { data, status, error, refresh } = useAsyncData(
  'kas-voidb',
  async () => {
    const voids = await getVoidKasir(bulanRentang.value.dari, bulanRentang.value.sampai)
    return { voids }
  },
  { watch: [periode] },
)

const baris = computed<VoidBaris[]>(() => data.value?.voids.baris ?? [])
const hidup = computed(() => baris.value.filter(v => !(Number(v.batalAt) > 0)))
const mati = computed(() => baris.value.filter(v => Number(v.batalAt) > 0))
const total = computed(() => hidup.value.reduce((s, v) => s + Number(v.nominal || 0), 0))
const orang = computed(() => [...new Set(hidup.value.map(v => String(v.penginput || '').trim()).filter(Boolean))])

function kelompok(ambil: (v: VoidBaris) => string) {
  const map = new Map<string, { nama: string, n: number, total: number }>()
  for (const v of hidup.value) {
    const k = ambil(v).trim() || '(kosong)'
    const g = map.get(k) ?? { nama: k, n: 0, total: 0 }
    g.n++
    g.total += Number(v.nominal || 0)
    map.set(k, g)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}
const perOrang = computed(() => kelompok(v => String(v.penginput || '')))
const perAlasan = computed(() => kelompok(v => String(v.alasan || '')))
const perSalah = computed(() => kelompok(v => String(v.salah || '')))

const grup = computed(() => {
  const q = cari.value.trim().toLowerCase()
  const list = baris.value
    .filter(v => !q || [v.bill, v.item, v.penginput, v.alasan, v.salah].join(' ').toLowerCase().includes(q))
    .slice()
    .sort((a, b) => (a.tgl < b.tgl ? 1 : a.tgl > b.tgl ? -1 : String(b.bill).localeCompare(String(a.bill))))
  const map = new Map<string, { kunci: string, tgl: string, bill: string, rows: VoidBaris[] }>()
  for (const v of list) {
    const k = `${v.tgl}|${v.bill}`
    const g = map.get(k) ?? { kunci: k, tgl: v.tgl, bill: v.bill, rows: [] }
    g.rows.push(v)
    map.set(k, g)
  }
  return [...map.values()]
})

// POS comparator — only for holders of `analytics` (T-15). The card is hidden,
// not an error, when the module is absent.
const punyaAnalitik = computed(() => hasAccess(me.value, ['analytics']))
const nPos = ref<number | null>(null)
watch([periode, punyaAnalitik], async () => {
  nPos.value = null
  if (!punyaAnalitik.value) return
  try {
    const r = await useApi()<Envelope<Record<string, unknown>>>('/kompas/analytics')
    const v = (r.data as { voidb?: Record<string, { ringkas?: { nBaris?: number } }> }).voidb?.[periode.value]
    nPos.value = typeof v?.ringkas?.nBaris === 'number' ? v.ringkas.nBaris : null
  }
  catch {
    nPos.value = null
  }
}, { immediate: true })
const selisihPos = computed(() => (nPos.value === null ? null : Math.max(0, nPos.value - hidup.value.length)))
</script>

<template>
  <AppPage
    title="Laporan void"
    description="Menu yang di-void berikut kronologinya — dicatat kasir di modul Cashier."
  >
    <template #actions>
      <UInput
        v-model="periode"
        type="month"
        size="sm"
        class="w-40"
      />
      <UButton
        label="Muat ulang"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        size="sm"
        @click="refresh()"
      />
    </template>

    <UAlert
      v-if="!izin.lihat('voidb')"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak dibuka untuk peranmu."
    />
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
    />

    <template v-else>
      <AppStatGrid>
        <AppStat
          label="Total nominal void"
          icon="i-lucide-ban"
          :value="fmtRp(total)"
          :sub="`${hidup.length} baris hidup di ${periode}`"
          tone="warning"
        />
        <AppStat
          label="Orang yang mencatat"
          icon="i-lucide-users"
          :value="orang.length"
          :sub="orang.slice(0, 4).join(', ') || '—'"
        />
        <AppStat
          label="Dibatalkan"
          icon="i-lucide-undo-2"
          :value="mati.length"
          sub="tidak ikut dijumlahkan"
        />
        <AppStat
          v-if="punyaAnalitik"
          label="Pembanding POS"
          icon="i-lucide-monitor-check"
          :value="nPos === null ? '—' : `${selisihPos} selisih`"
          :sub="nPos === null ? 'data analytics bulan ini tidak terbaca' : `${nPos} baris di mesin, ${hidup.length} dicatat manusia`"
          tone="info"
        />
      </AppStatGrid>

      <p
        v-if="status === 'pending' && !baris.length"
        class="mb-4 text-sm text-muted"
      >
        Memuat…
      </p>

      <div class="grid gap-5 lg:grid-cols-3">
        <AppPanel
          title="Siapa yang mencatat"
          flush
        >
          <div class="divide-y divide-default">
            <div
              v-for="g in perOrang"
              :key="g.nama"
              class="flex items-center justify-between gap-3 px-4 py-2 text-sm"
            >
              <span class="min-w-0 truncate">{{ g.nama }}</span>
              <span class="shrink-0 text-muted"><b class="text-highlighted num">{{ fmtRp(g.total) }}</b> · {{ g.n }}×</span>
            </div>
            <p
              v-if="!perOrang.length"
              class="px-4 py-4 text-center text-sm text-muted"
            >
              Tidak ada catatan hidup bulan ini.
            </p>
          </div>
        </AppPanel>

        <AppPanel title="Alasan void">
          <div class="divide-y divide-default">
            <div
              v-for="g in perAlasan"
              :key="g.nama"
              class="flex items-start justify-between gap-3 py-2 text-sm"
            >
              <span class="min-w-0">{{ g.nama }}</span>
              <span class="shrink-0 text-muted"><b class="text-highlighted num">{{ fmtRp(g.total) }}</b> · {{ g.n }}×</span>
            </div>
            <p
              v-if="!perAlasan.length"
              class="py-4 text-center text-sm text-muted"
            >
              —
            </p>
          </div>
        </AppPanel>

        <AppPanel title="Kesalahan dari siapa">
          <div class="divide-y divide-default">
            <div
              v-for="g in perSalah"
              :key="g.nama"
              class="flex items-start justify-between gap-3 py-2 text-sm"
            >
              <span class="min-w-0">{{ g.nama }}</span>
              <span class="shrink-0 text-muted"><b class="text-highlighted num">{{ fmtRp(g.total) }}</b> · {{ g.n }}×</span>
            </div>
            <p
              v-if="!perSalah.length"
              class="py-4 text-center text-sm text-muted"
            >
              —
            </p>
          </div>
        </AppPanel>
      </div>

      <AppPanel
        title="Rincian catatan"
        description="Dikelompokkan per tanggal & nomor bill. Baris yang dibatalkan tetap tampil, tercoret."
        flush
      >
        <div class="border-b border-default px-4 py-3 lg:px-5">
          <UInput
            v-model="cari"
            icon="i-lucide-search"
            placeholder="Cari bill, item, orang, alasan…"
            size="sm"
            class="w-full sm:w-72"
          />
        </div>
        <div class="divide-y divide-default">
          <div
            v-for="g in grup"
            :key="g.kunci"
            class="px-4 py-3 lg:px-5"
          >
            <div class="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <b class="text-highlighted">{{ g.tgl }} · Bill {{ g.bill || '—' }}</b>
              <span class="text-sm text-muted num">
                {{ fmtRp(g.rows.filter(r => !(Number(r.batalAt) > 0)).reduce((s, r) => s + Number(r.nominal || 0), 0)) }}
              </span>
            </div>
            <div
              v-for="r in g.rows"
              :key="r.id"
              class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1 text-sm"
              :class="Number(r.batalAt) > 0 ? 'opacity-60' : ''"
            >
              <span :class="Number(r.batalAt) > 0 ? 'line-through' : ''">{{ r.item || '(tanpa item)' }}</span>
              <span
                class="num"
                :class="Number(r.batalAt) > 0 ? 'line-through text-muted' : ''"
              >{{ fmtRp(Number(r.nominal || 0)) }}</span>
              <span class="text-muted">salah: {{ r.salah || '—' }} · oleh {{ r.penginput || '—' }}</span>
              <span class="w-full text-[12px] text-muted">{{ r.alasan || '—' }}</span>
              <span
                v-if="Number(r.batalAt) > 0"
                class="text-error"
              >dibatalkan — {{ r.batalAlasan || '—' }}</span>
            </div>
          </div>
          <p
            v-if="!grup.length"
            class="px-4 py-6 text-center text-sm text-muted"
          >
            Tidak ada catatan void yang cocok bulan ini.
          </p>
        </div>
      </AppPanel>
    </template>
  </AppPage>
</template>
