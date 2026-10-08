<!--
  Approval Flow — management's decision desk (`event/index.html:5686-5799`).

  Three summary cards, the Semua/Rencana/Refund toggle, Antrian/Riwayat tabs
  and two tables (plan + e-ticket refund). Only manajemen decides
  (`bisaSetujui :4680`); everyone else reads. The refund queue is oldest
  first (`:5697`); the menu badge counts the same two queues (`emsAntriApproval`).
-->
<script setup lang="ts">
import type { Acara, Refund } from '~/composables/useEvent'
import { patchEvent, statusPengajuan, useDaftarEvent } from '~/composables/useEvent'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehSetujui, peranEvent } from '~/utils/layar/event'
import { angka, rupiah, tglPendek } from '~/utils/format'
import { PENGAJUAN_IKON, PENGAJUAN_WARNA } from '~/utils/status-event'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const toast = useToast()
const me = useMe()
const namaSaya = computed(() => me.value?.name ?? '')
const manajemen = computed(() => bolehSetujui(peranEvent(me.value)))

const tab = ref<'semua' | 'rencana' | 'refund'>('semua')
const riwayat = ref<'antri' | 'sudah'>('antri')

const { data: daftar, status, refresh } = useDaftarEvent<Acara>('events', {}, 'event-approval-events')
const { data: daftarRefund, refresh: refreshRefund } = useDaftarEvent<Refund>('refunds', {}, 'event-approval-refunds')

const antreRencana = computed(() => daftar.value.rows.filter(e => statusPengajuan({ pengajuan: e.pengajuan }) === 'Menunggu'))
const sudahRencana = computed(() => daftar.value.rows.filter(e => ['Disetujui', 'Ditolak'].includes(statusPengajuan({ pengajuan: e.pengajuan }))))
// Oldest first for the refund queue (`:5697`)
const antreRefund = computed(() => [...daftarRefund.value.rows.filter(r => (r.status ?? '') === 'Pending')]
  .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0)))
const sudahRefund = computed(() => daftarRefund.value.rows.filter(r => (r.status ?? '') !== 'Pending'))
const nilaiTertahan = computed(() => antreRefund.value.reduce((a, r) => a + (Number(r.amount) || 0), 0))

const muatUlang = () => Promise.all([refresh(), refreshRefund()])

async function putuskanRencana(e: Acara, setuju: boolean) {
  try {
    await patchEvent('events', e.id, {
      status: setuju ? 'Approval' : 'Planning',
      pengajuan: { ...(e.pengajuan ?? {}), status: setuju ? 'Disetujui' : 'Ditolak', oleh: namaSaya.value, pada: Date.now() },
      statusAt: Date.now(),
      updatedAt: Date.now(),
    }, daftar.value.versions[e.id])
    toast.add({ title: setuju ? 'Rencana disetujui' : 'Rencana ditolak', color: 'success' })
    await refresh()
  }
  catch (err) {
    if (!(await tanganiKonflik(err, refresh))) toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}
async function putuskanRefund(r: Refund, setuju: boolean) {
  try {
    await patchEvent('refunds', r.id, { status: setuju ? 'Approved' : 'Rejected', updatedAt: Date.now() }, daftarRefund.value.versions[r.id])
    toast.add({ title: setuju ? 'Refund disetujui' : 'Refund ditolak', color: 'success' })
    await refreshRefund()
  }
  catch (err) {
    if (!(await tanganiKonflik(err, refreshRefund))) toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}

const lihatRencana = computed(() => tab.value !== 'refund')
const lihatRefund = computed(() => tab.value !== 'rencana')
</script>

<template>
  <AppPage
    title="Approval flow"
    description="Meja putusan manajemen"
  >
    <template #actions>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-refresh-cw"
        :loading="status === 'pending'"
        @click="muatUlang()"
      >
        Muat ulang
      </UButton>
    </template>

    <AppStatGrid class="mb-4">
      <AppStat
        label="Rencana menunggu"
        :value="angka(antreRencana.length)"
        icon="i-lucide-hourglass"
        tone="warning"
      />
      <AppStat
        label="Refund menunggu"
        :value="angka(antreRefund.length)"
        icon="i-lucide-undo-2"
        tone="warning"
      />
      <AppStat
        label="Nilai refund tertahan"
        :value="rupiah(nilaiTertahan)"
        icon="i-lucide-banknote"
        tone="error"
      />
    </AppStatGrid>

    <div class="mb-4 flex flex-wrap gap-2">
      <AppSeg
        v-model="tab"
        :options="[
          { value: 'semua', label: 'Semua' },
          { value: 'rencana', label: `Rencana event (${antreRencana.length})` },
          { value: 'refund', label: `Refund e-ticket (${antreRefund.length})` },
        ]"
      />
      <AppSeg
        v-model="riwayat"
        :options="[{ value: 'antri', label: 'Antrian' }, { value: 'sudah', label: 'Riwayat approval' }]"
        size="sm"
      />
    </div>

    <AppPanel
      v-if="lihatRencana"
      title="Rencana event"
      icon="i-lucide-clipboard-list"
      flush
      class="mb-4"
    >
      <UTable
        :columns="[{ id: 'rencana', header: 'Rencana' }, { id: 'tanggal', header: 'Tanggal' }, { id: 'oleh', header: 'Diajukan oleh' }, { id: 'aksi', header: 'Putusan' }]"
        :data="riwayat === 'antri' ? antreRencana : sudahRencana"
        class="hidden lg:block"
      >
        <template #rencana-cell="{ row }">
          <ULink
            :to="`/event/events/${row.original.id}`"
            class="font-semibold text-highlighted hover:text-primary-700"
          >
            {{ row.original.title }}
          </ULink>
          <span class="block text-xs text-muted">{{ row.original.venue || '—' }}</span>
        </template>
        <template #tanggal-cell="{ row }">
          {{ tglPendek(String(row.original.start_datetime ?? '').slice(0, 10)) }}
        </template>
        <template #oleh-cell="{ row }">
          {{ row.original.pengajuan?.oleh || '—' }}
        </template>
        <template #aksi-cell="{ row }">
          <span
            v-if="riwayat === 'antri'"
            class="flex gap-1"
          >
            <UButton
              :to="`/event/events/${row.original.id}`"
              color="neutral"
              variant="outline"
              size="sm"
            >
              Buka
            </UButton>
            <template v-if="manajemen">
              <UButton
                color="success"
                size="sm"
                @click="putuskanRencana(row.original, true)"
              >
                Setujui
              </UButton>
              <UButton
                color="error"
                variant="outline"
                size="sm"
                @click="putuskanRencana(row.original, false)"
              >
                Tolak
              </UButton>
            </template>
          </span>
          <AppStatus
            v-else
            :color="PENGAJUAN_WARNA[statusPengajuan({ pengajuan: row.original.pengajuan })] ?? 'neutral'"
            :icon="PENGAJUAN_IKON[statusPengajuan({ pengajuan: row.original.pengajuan })]"
            size="sm"
          >
            {{ statusPengajuan({ pengajuan: row.original.pengajuan }) }}
          </AppStatus>
        </template>
      </UTable>
      <ul class="divide-y divide-default lg:hidden">
        <li
          v-for="e in (riwayat === 'antri' ? antreRencana : sudahRencana)"
          :key="e.id"
          class="px-4 py-3"
        >
          <b class="block text-sm text-highlighted">{{ e.title }}</b>
          <span class="mt-0.5 block text-xs text-muted">{{ tglPendek(String(e.start_datetime ?? '').slice(0, 10)) }} · {{ e.pengajuan?.oleh || '—' }}</span>
          <span
            v-if="riwayat === 'antri'"
            class="mt-1.5 flex gap-1.5"
          >
            <UButton
              :to="`/event/events/${e.id}`"
              color="neutral"
              variant="outline"
              size="sm"
            >Buka</UButton>
            <template v-if="manajemen">
              <UButton
                color="success"
                size="sm"
                @click="putuskanRencana(e, true)"
              >Setujui</UButton>
              <UButton
                color="error"
                variant="outline"
                size="sm"
                @click="putuskanRencana(e, false)"
              >Tolak</UButton>
            </template>
          </span>
        </li>
      </ul>
    </AppPanel>

    <AppPanel
      v-if="lihatRefund"
      title="Refund e-ticket"
      icon="i-lucide-undo-2"
      flush
    >
      <UTable
        :columns="[{ id: 'tiket', header: 'Tiket' }, { id: 'nilai', header: 'Nilai' }, { id: 'alasan', header: 'Alasan' }, { id: 'aksi', header: 'Putusan' }]"
        :data="riwayat === 'antri' ? antreRefund : sudahRefund"
        class="hidden lg:block"
      >
        <template #tiket-cell="{ row }">
          {{ row.original.ticket_id || row.original.order_id || row.original.id }}
        </template>
        <template #nilai-cell="{ row }">
          <span class="num">{{ rupiah(Number(row.original.amount) || 0) }}</span>
        </template>
        <template #alasan-cell="{ row }">
          {{ String(row.original.reason ?? '') }}
        </template>
        <template #aksi-cell="{ row }">
          <span
            v-if="riwayat === 'antri' && manajemen"
            class="flex gap-1"
          >
            <UButton
              color="success"
              size="sm"
              @click="putuskanRefund(row.original, true)"
            >
              Setujui
            </UButton>
            <UButton
              color="error"
              variant="outline"
              size="sm"
              @click="putuskanRefund(row.original, false)"
            >
              Tolak
            </UButton>
          </span>
          <AppStatus
            v-else
            :color="row.original.status === 'Approved' ? 'success' : 'error'"
            :icon="row.original.status === 'Approved' ? 'i-lucide-check' : 'i-lucide-x'"
            size="sm"
          >
            {{ row.original.status }}
          </AppStatus>
        </template>
      </UTable>
      <ul class="divide-y divide-default lg:hidden">
        <li
          v-for="r in (riwayat === 'antri' ? antreRefund : sudahRefund)"
          :key="r.id"
          class="px-4 py-3 text-sm"
        >
          <b class="text-highlighted num">{{ rupiah(Number(r.amount) || 0) }}</b> · {{ String(r.reason ?? '') }}
          <span
            v-if="riwayat === 'antri' && manajemen"
            class="mt-1.5 flex gap-1.5"
          >
            <UButton
              color="success"
              size="sm"
              @click="putuskanRefund(r, true)"
            >Setujui</UButton>
            <UButton
              color="error"
              variant="outline"
              size="sm"
              @click="putuskanRefund(r, false)"
            >Tolak</UButton>
          </span>
        </li>
      </ul>
      <p
        v-if="!(riwayat === 'antri' ? antreRefund : sudahRefund).length"
        class="px-4 py-6 text-center text-sm text-dimmed"
      >
        Tidak ada refund di sini.
      </p>
    </AppPanel>
  </AppPage>
</template>
