<!--
  Marketing › Timeline & Audit Log (docs/migrasi/marketing.md D.17, issue
  #60): chronological trail of every important change, newest first,
  sortable per column. "Bersihkan Log" stays "Segera": v1 has no bulk delete
  and rows carry no version for per-row DELETE.
-->
<script setup lang="ts">
import { labelJenisMkt, laluMkt } from '~/utils/marketing-keuangan'
import { useAksesMkt, useStateMkt, useTabelMkt } from '~/composables/useMarketing'
import type { AktivitasMkt, KolomMkt } from '~/utils/marketing'

definePageMeta({ access: ['marketing'] })

const { data: st } = useStateMkt()
const { saya } = useAksesMkt()
const superAdmin = computed(() => saya.value?.user.role === 'super_admin')

const namaRujuk = (a: AktivitasMkt) => {
  if (a.refType === 'client') return st.value.clients.find(c => c.id === a.refId)?.nama ?? ''
  if (a.refType === 'user') return st.value.users.find(u => u.id === a.refId)?.name ?? ''
  if (a.refType === 'event') return st.value.events.find(e => e.id === a.refId)?.nama ?? ''
  return ''
}
const KOL: KolomMkt<AktivitasMkt>[] = [
  { k: 'at', t: 'Waktu', v: a => String(a.at ?? '') },
  { k: 'by', t: 'Oleh', v: a => a.by ?? '' },
  { k: 'jenis', t: 'Jenis', v: a => labelJenisMkt(a.refType) },
  { k: 'aksi', t: 'Aktivitas', v: a => a.action ?? '' },
  { k: 'ref', t: 'Detail', v: a => namaRujuk(a) },
]
const tbl = useTabelMkt<AktivitasMkt>('timeline', KOL, () => String(st.value.activities.length))
const hal = computed(() => tbl.potong(tbl.susun([...st.value.activities])))
</script>

<template>
  <AppPage
    title="Timeline & Audit Log"
    description="Jejak kronologis semua perubahan data penting. Log otomatis dibatasi 400 entri terbaru."
  >
    <template #actions>
      <UBadge
        v-if="st.activities.length"
        :label="`${st.activities.length} entri`"
        color="neutral"
        variant="soft"
      />
      <UButton
        v-if="superAdmin && st.activities.length"
        icon="i-lucide-trash-2"
        label="Bersihkan Log"
        color="neutral"
        variant="outline"
        disabled
        title="Segera — v1 tidak punya hapus massal dan baris log tidak membawa versi untuk hapus per baris"
      />
    </template>
    <MarketingGerbang layar="timeline">
      <AppPanel flush>
        <div
          v-if="!st.activities.length"
          class="p-8 text-center text-sm text-muted"
        >
          Belum ada aktivitas.
        </div>
        <template v-else>
          <UTable
            :data="hal"
            :columns="[
              { accessorKey: 'at', header: 'Waktu' },
              { accessorKey: 'by', header: 'Oleh' },
              { accessorKey: 'jenis', header: 'Jenis' },
              { accessorKey: 'aksi', header: 'Aktivitas' },
              { accessorKey: 'ref', header: 'Detail' },
            ]"
            class="hidden lg:block"
          >
            <template #at-cell="{ row }">
              <span class="num whitespace-nowrap">{{ laluMkt(row.original.at) }}</span>
            </template>
            <template #jenis-cell="{ row }">
              <UBadge
                :label="labelJenisMkt(row.original.refType)"
                color="neutral"
                variant="soft"
              />
            </template>
            <template #aksi-cell="{ row }">
              <b>{{ row.original.action }}</b>
            </template>
            <template #ref-cell="{ row }">
              <span class="text-muted">{{ namaRujuk(row.original) }}{{ row.original.detail ? ` — ${row.original.detail}` : '' }}</span>
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="a in hal"
              :key="String(a.id ?? `${a.at}-${a.action}`)"
              class="p-4"
            >
              <p class="text-sm">
                <b>{{ a.action }}</b>
              </p>
              <p class="text-xs text-muted">
                {{ namaRujuk(a) }}{{ a.detail ? ` — ${a.detail}` : '' }}
              </p>
              <p class="num mt-0.5 text-xs text-muted">
                {{ laluMkt(a.at) }} · {{ a.by }} · {{ labelJenisMkt(a.refType) }}
              </p>
            </li>
          </ul>
          <MarketingPager
            v-model="tbl.hal.value"
            :total="st.activities.length"
          />
        </template>
      </AppPanel>
    </MarketingGerbang>
  </AppPage>
</template>
