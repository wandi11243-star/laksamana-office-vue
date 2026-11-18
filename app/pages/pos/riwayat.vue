<!-- POS › Riwayat: paid and cancelled bills. Reprint from here. -->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { hitungOrderPos, rupiahPos, strukTeksPos } from '~/utils/pos'
import { mulaiPos, printerPos, usePosDb, usePosSetting } from '~/composables/usePos'

definePageMeta({ access: ['pos'] })

const db = usePosDb()
const setting = usePosSetting()

onMounted(() => mulaiPos())

const tgl = ref(new Date().toISOString().slice(0, 10))
const riwayat = computed(() => db.value
  .filter(o => (o.status === 'paid' || o.status === 'batal') && (!tgl.value || o.tgl === tgl.value))
  .sort((a, b) => (b.paidAt || b.updatedAt) - (a.paidAt || a.updatedAt)))

interface BarisRiwayat {
  id: string
  no: string
  meja: string
  status: string
  total: string
  kasir: string
}

const baris = computed<BarisRiwayat[]>(() => riwayat.value.map(o => ({
  id: o.id,
  no: o.no || o.id.slice(-6),
  meja: o.meja,
  status: o.status === 'paid' ? 'Lunas' : 'Batal',
  total: rupiahPos(hitungOrderPos(o, setting.value?.sc ?? 5, setting.value?.pb1 ?? 10).grand),
  kasir: o.kasir,
})))

const kolom: TableColumn<BarisRiwayat>[] = [
  { accessorKey: 'no', header: 'No' },
  { accessorKey: 'meja', header: 'Meja' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'total', header: 'Total' },
  { accessorKey: 'kasir', header: 'Kasir' },
]

const lihat = ref<string | null>(null)
const strukBuka = ref(false)
const orderLihat = computed(() => db.value.find(o => o.id === lihat.value) || null)
const strukLihat = computed(() => {
  const o = orderLihat.value
  if (!o) return ''
  return strukTeksPos(o, hitungOrderPos(o, setting.value?.sc ?? 5, setting.value?.pb1 ?? 10), {
    outlet: 'Laksamana Muda', station: 'A', kasir: o.kasir, kaki: printerPos().kaki,
  }, printerPos().kolom)
})
watch(lihat, v => strukBuka.value = !!v)
watch(strukBuka, (v) => {
  if (!v) lihat.value = null
})

const toast = useToast()

/** Reprint a bill from history using this computer's printer width. */
function cetakUlang(): void {
  const o = orderLihat.value
  if (!o) return
  const p = printerPos()
  const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const dok = window.open('', '_blank', 'width=320,height=600')
  if (!dok) {
    toast.add({ title: 'Popup diblokir', description: 'Izinkan popup untuk mencetak struk.', color: 'warning' })
    return
  }
  dok.document.write(`<html><head><title>Struk ${esc(o.no || o.id)}</title></head><body style="width:${p.lebar}mm;margin:0 auto;padding-bottom:20mm;font-family:monospace;"><pre style="font-size:12px;white-space:pre-wrap;">${esc(strukLihat.value)}</pre><scr` + `ipt>onload=()=>{print();}</scr` + `ipt></body></html>`)
  dok.document.close()
}
</script>

<template>
  <AppPage
    title="Riwayat"
    description="Transaksi yang sudah dibayar atau dibatalkan."
  >
    <AppPanel
      flush
      title="Transaksi"
      icon="i-lucide-history"
      :count="riwayat.length"
    >
      <template #head>
        <div class="flex flex-wrap items-center gap-2 px-4 py-3.5 lg:px-5">
          <AppTanggal
            v-model="tgl"
            class="max-w-45"
          />
        </div>
      </template>
      <UTable
        :columns="kolom"
        :data="baris"
        class="hidden lg:block"
        @select="(_e: Event, row: { original: BarisRiwayat }) => lihat = row.original.id"
      />
      <AppList class="lg:hidden">
        <AppListRow
          v-for="o in riwayat"
          :key="o.id"
          :title="`${o.no || o.id.slice(-6)} · Meja ${o.meja}`"
          :description="`${o.kasir} · ${rupiahPos(hitungOrderPos(o, setting?.sc ?? 5, setting?.pb1 ?? 10).grand)}`"
          @click="lihat = o.id"
        >
          <template #trailing>
            <AppStatus :color="o.status === 'paid' ? 'success' : 'neutral'">
              {{ o.status === 'paid' ? 'Lunas' : 'Batal' }}
            </AppStatus>
          </template>
        </AppListRow>
      </AppList>
      <p
        v-if="!riwayat.length"
        class="p-4 text-center text-sm text-dimmed"
      >
        Belum ada transaksi di tanggal ini.
      </p>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="strukBuka"
      title="Struk"
      :description="orderLihat ? `Meja ${orderLihat.meja}` : ''"
    >
      <pre class="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre">{{ strukLihat }}</pre>
      <template #footer>
        <UButton
          label="Tutup"
          color="neutral"
          variant="ghost"
          @click="strukBuka = false"
        />
        <UButton
          label="Cetak ulang"
          icon="i-lucide-printer"
          color="neutral"
          class="bg-ink-900 text-white"
          @click="cetakUlang()"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
