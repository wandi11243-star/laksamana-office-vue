<!-- POS › Open Order: bills still open on any device. Continue on the till. -->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { OrderPos } from '~/utils/pos'
import { hitungOrderPos, rupiahPos } from '~/utils/pos'
import { antreOrderPos, mulaiPos, usePosDb, usePosSetting } from '~/composables/usePos'

definePageMeta({ access: ['pos'] })

const toast = useToast()
const db = usePosDb()
const setting = usePosSetting()

onMounted(() => mulaiPos())

interface BarisTerbuka {
  id: string
  meja: string
  item: string
  total: string
  kasir: string
  waktu: string
}

const terbuka = computed<OrderPos[]>(() => db.value
  .filter(o => o.status === 'open' || o.status === 'draft')
  .sort((a, b) => b.updatedAt - a.updatedAt))

const baris = computed<BarisTerbuka[]>(() => terbuka.value.map(o => ({
  id: o.id,
  meja: o.meja,
  item: `${o.items.reduce((s, i) => s + i.qty, 0)} item`,
  total: rupiahPos(hitungOrderPos(o, setting.value?.sc ?? 5, setting.value?.pb1 ?? 10).grand),
  kasir: o.kasir,
  waktu: new Date(o.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
})))

const kolom: TableColumn<BarisTerbuka>[] = [
  { accessorKey: 'meja', header: 'Meja' },
  { accessorKey: 'item', header: 'Item' },
  { accessorKey: 'total', header: 'Total' },
  { accessorKey: 'kasir', header: 'Kasir' },
  { accessorKey: 'waktu', header: 'Dibuka' },
  {
    id: 'aksi',
    header: 'Aksi',
    cell: ({ row }: { row: { original: BarisTerbuka } }) => h('div', { class: 'flex gap-1' }, [
      h(resolveComponent('UButton'), { label: 'Lanjut', color: 'neutral', size: 'sm', to: `/pos/kasir?order=${row.original.id}` }),
      h(resolveComponent('UButton'), { label: 'Batal', color: 'error', variant: 'ghost', size: 'sm', onClick: () => batalkan(row.original.id) }),
    ]),
  },
]

function batalkan(id: string): void {
  const o = db.value.find(x => x.id === id)
  if (!o) return
  antreOrderPos({ ...o, status: 'batal', _base: o._base ?? o.updatedAt })
  toast.add({ title: 'Order dibatalkan', description: `Meja ${o.meja} dibebaskan. Jejaknya tetap tersimpan.`, color: 'warning' })
}
</script>

<template>
  <AppPage
    title="Open Order"
    description="Order yang masih terbuka di semua komputer kasir."
  >
    <AppPanel
      flush
      title="Terbuka"
      icon="i-lucide-receipt-text"
      :count="terbuka.length"
    >
      <UTable
        :columns="kolom"
        :data="baris"
        class="hidden lg:block"
      />
      <AppList class="lg:hidden">
        <AppListRow
          v-for="o in terbuka"
          :key="o.id"
          :title="`Meja ${o.meja} — ${o.items.reduce((s, i) => s + i.qty, 0)} item`"
          :description="`${o.kasir} · ${rupiahPos(hitungOrderPos(o, setting?.sc ?? 5, setting?.pb1 ?? 10).grand)}`"
        >
          <template #trailing>
            <div class="flex gap-1">
              <UButton
                label="Lanjut"
                color="neutral"
                size="sm"
                :to="`/pos/kasir?order=${o.id}`"
              />
              <UButton
                label="Batal"
                color="error"
                variant="ghost"
                size="sm"
                @click="batalkan(o.id)"
              />
            </div>
          </template>
        </AppListRow>
      </AppList>
      <p
        v-if="!terbuka.length"
        class="p-4 text-center text-sm text-dimmed"
      >
        Tidak ada order terbuka.
      </p>
    </AppPanel>
  </AppPage>
</template>
