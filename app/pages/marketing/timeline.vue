<!--
  Marketing › Log Activity (was Timeline & Audit Log; docs/migrasi/marketing.md
  D.17, issue #60): chronological trail of every important change, newest
  first. Read one page at a time from its own endpoint
  (`GET /marketing/activities?page=&perPage=`, meta.total — owner request,
  Nov 2026) instead of the 400 newest rows riding on the shared state, so the
  whole history is reachable. The module state still names the record a row
  points to (client / user / event) — the shell loads it for access anyway.
  "Bersihkan Log" stays "Segera": v1 has no bulk delete and rows carry no
  version for per-row DELETE.
-->
<script setup lang="ts">
import { labelJenisMkt, laluMkt } from '~/utils/marketing-keuangan'
import { listAktivitasHalamanMkt, useAksesMkt, useStateMkt } from '~/composables/useMarketing'
import type { AktivitasMkt } from '~/utils/marketing'
import { angka } from '~/utils/format'

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

const hal = ref(1)
const perHal = ref(25)
const logQ = useAsyncData('mkt-log-hal', () => listAktivitasHalamanMkt(hal.value, perHal.value), {
  watch: [hal, perHal],
  default: () => ({ rows: [] as AktivitasMkt[], total: 0, page: 1 }),
})
const daftar = computed(() => logQ.data.value?.rows ?? [])
const total = computed(() => logQ.data.value?.total ?? 0)
watch(perHal, () => {
  hal.value = 1
})
watch(() => logQ.data.value?.page, (p) => {
  if (p && p !== hal.value) hal.value = p
})

const kolom = [
  { id: 'at', header: 'Waktu' },
  { accessorKey: 'by', header: 'Oleh' },
  { id: 'jenis', header: 'Jenis' },
  { id: 'aksi', header: 'Aktivitas' },
  { id: 'ref', header: 'Detail' },
]
</script>

<template>
  <AppPage
    title="Log activity"
    description="Jejak kronologis semua perubahan data penting — terbaru dulu."
  >
    <template #actions>
      <UBadge
        v-if="total"
        :label="`${angka(total)} entri`"
        color="neutral"
        variant="soft"
      />
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="logQ.status.value === 'pending'"
        @click="logQ.refresh()"
      />
      <UButton
        v-if="superAdmin && total"
        icon="i-lucide-trash-2"
        label="Bersihkan Log"
        color="neutral"
        variant="outline"
        disabled
        title="Segera — v1 tidak punya hapus massal dan baris log tidak membawa versi untuk hapus per baris"
      />
    </template>
    <MarketingGerbang layar="timeline">
      <UAlert
        v-if="logQ.error.value"
        class="mb-4"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Log tidak terbaca"
        :description="apiErrorMessage(logQ.error.value)"
      />
      <AppPanel flush>
        <div
          v-if="!daftar.length && logQ.status.value !== 'pending'"
          class="p-8 text-center text-sm text-muted"
        >
          Belum ada aktivitas.
        </div>
        <template v-else>
          <UTable
            :data="daftar"
            :columns="kolom"
            :loading="logQ.status.value === 'pending'"
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
              <span class="whitespace-normal text-muted">{{ namaRujuk(row.original) }}{{ namaRujuk(row.original) && row.original.detail ? ' — ' : '' }}{{ row.original.detail }}</span>
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="a in daftar"
              :key="String(a.id ?? `${a.at}-${a.action}`)"
              class="p-4"
            >
              <p class="text-sm">
                <b>{{ a.action }}</b>
              </p>
              <p class="text-xs text-muted">
                {{ namaRujuk(a) }}{{ namaRujuk(a) && a.detail ? ' — ' : '' }}{{ a.detail }}
              </p>
              <p class="num mt-0.5 text-xs text-muted">
                {{ laluMkt(a.at) }} · {{ a.by }} · {{ labelJenisMkt(a.refType) }}
              </p>
            </li>
          </ul>
          <div class="px-4 pb-3">
            <AppPager
              v-model:page="hal"
              v-model:per="perHal"
              :total="total"
              satuan="entri"
            />
          </div>
        </template>
      </AppPanel>
    </MarketingGerbang>
  </AppPage>
</template>
