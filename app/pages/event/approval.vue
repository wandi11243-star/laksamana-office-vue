<!--
  Approval Flow — management's decision desk (`event/index.html:5686-5799`).

  Three summary cards, the Semua/Rencana/Refund toggle, Antrian/Riwayat tabs
  and two tables (plan + e-ticket refund). Only manajemen decides
  (`bisaSetujui :4680`); everyone else reads. The refund queue is oldest
  first (`:5697`); the menu badge counts the same two queues (`emsAntriApproval`).
-->
<script setup lang="ts">
import type { Acara, KelasTiket, Kursi, OrderTiket, Refund, Tiket } from '~/composables/useEvent'
import { patchEvent, useDaftarEvent } from '~/composables/useEvent'
import { statusPengajuan, tglWIB } from '~/utils/event-hitung'
import { jalankanRefund, refundGantung, ringkasRefund } from '~/utils/event-refund'
import type { RefundBaris } from '~/utils/event-refund'
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
const { data: daftarOrder, refresh: refreshOrder } = useDaftarEvent<OrderTiket>('orders', {}, 'event-approval-orders')
const { data: daftarTiket, refresh: refreshTiket } = useDaftarEvent<Tiket>('tickets', {}, 'event-approval-tickets')
const { data: daftarKursi, refresh: refreshKursi } = useDaftarEvent<Kursi>('seats', {}, 'event-approval-seats')
const { data: daftarKelas, refresh: refreshKelas } = useDaftarEvent<KelasTiket>('ticket-classes', {}, 'event-approval-classes')

// The order behind a refund request (`refundGantung :10182` needs it).
const orderDariId = computed(() => new Map(daftarOrder.value.rows.map(o => [o.id, o])))
const gantung = (r: RefundBaris) => refundGantung(r, orderDariId.value.get(r.order_id ?? ''))

const antreRencana = computed(() => daftar.value.rows.filter(e => statusPengajuan({ pengajuan: e.pengajuan }) === 'Menunggu'))
const sudahRencana = computed(() => daftar.value.rows.filter(e => ['Disetujui', 'Ditolak'].includes(statusPengajuan({ pengajuan: e.pengajuan }))))
// Oldest first for the refund queue (`:5697`)
const antreRefund = computed(() => [...daftarRefund.value.rows.filter(r => (r.status ?? '') === 'Pending')]
  .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0)))
const sudahRefund = computed(() => daftarRefund.value.rows.filter(r => (r.status ?? '') !== 'Pending'))
const nilaiTertahan = computed(() => antreRefund.value.reduce((a, r) => a + (Number(r.amount) || 0), 0))

const muatUlang = () => Promise.all([refresh(), refreshRefund(), refreshOrder(), refreshTiket(), refreshKursi(), refreshKelas()])

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
// Rejecting asks for a reason first (`tolakRefund :10230`); the sheet emits it.
const tolakRefund = ref<Refund | null>(null)
const sheetTolak = computed({ get: () => tolakRefund.value !== null, set: v => (tolakRefund.value = v ? tolakRefund.value : null) })
const ketTolak = computed(() => {
  const o = orderDariId.value.get(tolakRefund.value?.order_id ?? '')
  return o ? `${String(o.buyer_name ?? '')} · ${rupiah(Number(o.total) || 0)}` : undefined
})
const menolak = ref(false)
async function jalanTolakRefund(alasan: string) {
  const r = tolakRefund.value
  if (!r || menolak.value) return
  menolak.value = true
  try {
    await patchEvent('refunds', r.id, {
      status: 'Rejected', penyetuju: namaSaya.value, alasan_tolak: alasan, decided_at: new Date().toISOString(), updatedAt: Date.now(),
    }, daftarRefund.value.versions[r.id])
    tolakRefund.value = null
    toast.add({ title: 'Refund ditolak — alasannya tercatat.', color: 'success' })
    await refreshRefund()
  }
  catch (err) {
    if (!(await tanganiKonflik(err, refreshRefund))) toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
  finally {
    menolak.value = false
  }
}
async function putuskanRefund(r: Refund, setuju: boolean) {
  if (!setuju) {
    tolakRefund.value = r
    return
  }
  // Approving runs the refund itself (`approveRefundYakin :10217`): the order
  // goes Refunded, its tickets Cancelled, seats & class quota back — never
  // just the request status.
  const order = orderDariId.value.get(r.order_id ?? '')
  if (!order) {
    toast.add({ title: 'Pesanannya sudah tidak ada.', color: 'error' })
    return
  }
  const hasil = await jalankanRefund({
    refund: r,
    order,
    tiket: daftarTiket.value.rows,
    kursi: daftarKursi.value.rows,
    kelas: daftarKelas.value.rows,
    versi: {
      refund: daftarRefund.value.versions[r.id],
      order: daftarOrder.value.versions[order.id],
      tiket: daftarTiket.value.versions,
      kursi: daftarKursi.value.versions,
      kelas: daftarKelas.value.versions,
    },
    patch: patchEvent,
    nama: namaSaya.value,
  })
  if (hasil.konflik) await tanganiKonflik(hasil.galat, muatUlang)
  else await muatUlang()
  if (hasil.ok) {
    toast.add({ title: `Refund disetujui — ${hasil.tiketBatal} tiket dibatalkan & kursinya dilepas.`, color: 'success' })
  }
  else {
    toast.add({ title: 'Refund disetujui sebagian', description: ringkasRefund(hasil), color: 'warning' })
  }
}

// Repair for approvals from the old version that only flipped the request
// status (`selesaikanRefund :10187`): runs the same execution, keeps Approved.
const selesaikanId = ref('')
const sheetSelesaikan = computed({ get: () => selesaikanId.value !== '', set: v => (selesaikanId.value = v ? selesaikanId.value : '') })
const refundDipilih = computed(() => daftarRefund.value.rows.find(x => x.id === selesaikanId.value))
const orderDipilih = computed(() => orderDariId.value.get(refundDipilih.value?.order_id ?? ''))
async function selesaikan() {
  const r = refundDipilih.value
  const order = orderDipilih.value
  sheetSelesaikan.value = false
  if (!r || !order) return
  const hasil = await jalankanRefund({
    refund: r,
    order,
    tiket: daftarTiket.value.rows,
    kursi: daftarKursi.value.rows,
    kelas: daftarKelas.value.rows,
    versi: {
      refund: daftarRefund.value.versions[r.id],
      order: daftarOrder.value.versions[order.id],
      tiket: daftarTiket.value.versions,
      kursi: daftarKursi.value.versions,
      kelas: daftarKelas.value.versions,
    },
    patch: patchEvent,
    nama: namaSaya.value,
    selesaikan: true,
  })
  if (hasil.konflik) await tanganiKonflik(hasil.galat, muatUlang)
  else await muatUlang()
  if (hasil.ok) {
    toast.add({ title: `Refund diselesaikan — ${hasil.tiketBatal} tiket dibatalkan & kursinya dilepas.`, color: 'success' })
  }
  else {
    toast.add({ title: 'Refund diselesaikan sebagian', description: ringkasRefund(hasil), color: 'warning' })
  }
}

const lihatRencana = computed(() => tab.value !== 'refund')
const lihatRefund = computed(() => tab.value !== 'rencana')
</script>

<template>
  <EventGerbang lihat="approval">
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
          {{ tglPendek(tglWIB(row.original.start_datetime)) }}
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
          <span class="mt-0.5 block text-xs text-muted">{{ tglPendek(tglWIB(e.start_datetime)) }} · {{ e.pengajuan?.oleh || '—' }}</span>
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
          <span
            v-else-if="gantung(row.original)"
            class="flex flex-wrap items-center gap-1.5"
          >
            <AppStatus
              color="warning"
              icon="i-lucide-hourglass"
              size="sm"
            >
              Disetujui · belum diselesaikan
            </AppStatus>
            <UButton
              v-if="manajemen"
              color="neutral"
              variant="outline"
              size="sm"
              @click="selesaikanId = row.original.id"
            >
              Selesaikan refund
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
            v-if="gantung(r) && riwayat !== 'antri'"
            class="mt-1 flex flex-wrap items-center gap-1.5"
          >
            <AppStatus
              color="warning"
              icon="i-lucide-hourglass"
              size="sm"
            >
              Disetujui · belum diselesaikan
            </AppStatus>
            <UButton
              v-if="manajemen"
              color="neutral"
              variant="outline"
              size="sm"
              @click="selesaikanId = r.id"
            >
              Selesaikan refund
            </UButton>
          </span>
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

    <ResponsiveSheet
      v-model:open="sheetSelesaikan"
      title="Selesaikan refund"
    >
      <div
        v-if="refundDipilih && orderDipilih"
        class="grid gap-1.5 text-sm"
      >
        <p><span class="text-muted">Pembeli:</span> <b class="text-highlighted">{{ String((orderDipilih as Record<string, unknown>).buyer_name ?? '—') }}</b></p>
        <p><span class="text-muted">Nominal:</span> <b class="text-highlighted num">{{ rupiah(Number((orderDipilih as Record<string, unknown>).total) || 0) }}</b></p>
        <p><span class="text-muted">Alasan:</span> {{ String(refundDipilih.reason ?? '—') }}</p>
        <p class="text-muted">
          Refund ini sudah disetujui, tapi oleh versi lama yang tidak ikut membatalkan tiketnya.
          Menyelesaikannya: pesanan jadi Refunded, tiket dibatalkan, kursinya dilepas, dan kuota kelasnya kembali.
          Tidak bisa dibatalkan.
        </p>
      </div>
      <template #footer>
        <UButton
          color="primary"
          @click="selesaikan()"
        >
          Selesaikan
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          @click="sheetSelesaikan = false"
        >
          Batal
        </UButton>
      </template>
    </ResponsiveSheet>

    <EventTolakRefund
      v-model:open="sheetTolak"
      :ket="ketTolak"
      :sibuk="menolak"
      @tolak="jalanTolakRefund"
    />
  </AppPage>
  </EventGerbang>
</template>
