<!-- POS › Riwayat: paid and cancelled bills. Reprint from here. -->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { hitungOrderPos, rupiahPos, strukTeksPos } from '~/utils/pos'
import { mulaiPos, printerPos, usePosDb, usePosSetting, voidOrderPos } from '~/composables/usePos'
import { hariIni } from '~/utils/format'
import { isAdminOf, useMe } from '~/composables/useMe'
import { apiErrorCode, apiErrorMessage } from '~/composables/useApi'

definePageMeta({ access: ['pos'] })

const db = usePosDb()
const setting = usePosSetting()

onMounted(() => mulaiPos())

const tgl = ref(hariIni())
const riwayat = computed(() => db.value
  .filter(o => (o.status === 'paid' || o.status === 'batal' || o.status === 'void') && (!tgl.value || o.tgl === tgl.value))
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
  status: o.status === 'paid' ? 'Lunas' : o.status === 'void' ? 'Void' : 'Batal',
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
const me = useMe()
const alasan = ref('')
const voidBuka = ref(false)
const voidSedang = ref(false)
const targetVoid = ref<{ id: string, base: number } | null>(null)
const bolehVoid = computed(() => isAdminOf(me.value, 'pos') && orderLihat.value?.status === 'paid'
  && orderLihat.value._naik === true && !!orderLihat.value._base)

function bukaVoid(): void {
  const o = orderLihat.value
  if (!o || !bolehVoid.value || !o._base) return
  targetVoid.value = { id: o.id, base: o._base }
  alasan.value = ''
  voidBuka.value = true
}

async function simpanVoid(): Promise<void> {
  const target = targetVoid.value
  const o = db.value.find(x => x.id === target?.id)
  if (!target || !o || alasan.value.trim().length < 3 || alasan.value.trim().length > 160) return
  voidSedang.value = true
  try {
    await voidOrderPos({ ...o, _base: target.base }, alasan.value.trim())
    voidBuka.value = false
    toast.add({ title: 'Transaksi di-void', color: 'success' })
  }
  catch (e) {
    const konflik = ['version_conflict', 'precondition_required'].includes(apiErrorCode(e) || '')
    if (konflik) voidBuka.value = false
    // A plain Error is our own pre-check (not synced / changed): say it as is,
    // instead of the "cannot reach the server" fallback.
    const pesan = e instanceof Error && e.name === 'Error' ? e.message : apiErrorMessage(e)
    toast.add({ title: konflik ? 'Order berubah, periksa kembali' : 'Void gagal', description: pesan, color: 'error' })
  }
  finally { voidSedang.value = false }
}

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
    description="Transaksi yang sudah dibayar, dibatalkan, atau di-void."
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
            <AppStatus :color="o.status === 'paid' ? 'success' : o.status === 'void' ? 'error' : 'neutral'">
              {{ o.status === 'paid' ? 'Lunas' : o.status === 'void' ? 'Void' : 'Batal' }}
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
      <div
        v-if="orderLihat?.status === 'void'"
        class="mb-3 rounded-xl border-l-4 border-error bg-error/10 p-3 text-sm text-error"
      >
        <strong>Transaksi sudah di-void dan tidak dihitung dalam omset.</strong>
        <p>Oleh {{ orderLihat.voidOleh || '-' }} · {{ orderLihat.voidAt ? new Date(orderLihat.voidAt).toLocaleString('id-ID') : '-' }}</p>
        <p>Alasan: {{ orderLihat.voidAlasan || '-' }}</p>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre">{{ strukLihat }}</pre>
      <template #footer>
        <UButton
          label="Tutup"
          color="neutral"
          variant="ghost"
          @click="strukBuka = false"
        />
        <UButton
          v-if="bolehVoid"
          label="Void transaksi"
          color="error"
          variant="soft"
          @click="bukaVoid()"
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
    <ResponsiveSheet
      v-model:open="voidBuka"
      title="Void transaksi"
      description="Transaksi tidak lagi dihitung dalam omset dan PB1, tetapi tetap tersimpan di riwayat."
    >
      <UFormField
        label="Alasan void"
        required
        hint="3–160 karakter"
      >
        <UTextarea
          v-model="alasan"
          :maxlength="160"
          class="w-full"
          placeholder="Masukkan alasan void"
        />
      </UFormField>
      <template #footer>
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          :disabled="voidSedang"
          @click="voidBuka = false"
        />
        <UButton
          label="Void transaksi"
          color="error"
          :loading="voidSedang"
          :disabled="alasan.trim().length < 3"
          @click="simpanVoid()"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
