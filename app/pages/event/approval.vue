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
import { fmtTglEms, fmtTglJamEms, statusPengajuan } from '~/utils/event-hitung'
import { jalankanRefund, refundGantung, ringkasRefund } from '~/utils/event-refund'
import type { RefundBaris } from '~/utils/event-refund'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehSetujui, peranEvent } from '~/utils/layar/event'
import { angka, rupiah } from '~/utils/format'
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

/** First-load skeleton for the three recap cards below: show skeleton cells
 *  until the first lists land. Refetch keeps old numbers, so the cards never
 *  blank while a decision is saving. */
const statMemuat = computed(() => !daftar.value.rows.length && (status.value === 'pending' || status.value === 'idle'))

// The order behind a refund request (`refundGantung :10182` needs it).
const orderDariId = computed(() => new Map(daftarOrder.value.rows.map(o => [o.id, o])))
const gantung = (r: RefundBaris) => refundGantung(r, orderDariId.value.get(r.order_id ?? ''))

const antreRencana = computed(() => daftar.value.rows.filter(e => statusPengajuan({ pengajuan: e.pengajuan }) === 'Menunggu'))
// Newest decision first (`renderApprovalEms` :5803)
const sudahRencana = computed(() => daftar.value.rows.filter(e => ['Disetujui', 'Ditolak'].includes(statusPengajuan({ pengajuan: e.pengajuan })))
  .sort((a, b) => String(b.pengajuan?.disetujuiPada ?? '').localeCompare(String(a.pengajuan?.disetujuiPada ?? ''))))
// Oldest first for the refund queue (`:5697`)
// refundRingkas (:5781): a refund whose order is gone is not listed at all
const adaOrder = (r: Refund) => orderDariId.value.has(r.order_id ?? '')
const antreRefund = computed(() => daftarRefund.value.rows.filter(r => (r.status ?? '') === 'Pending' && adaOrder(r))
  .sort((a, b) => String(a.requested_at ?? '').localeCompare(String(b.requested_at ?? ''))))
const sudahRefund = computed(() => daftarRefund.value.rows.filter(r => (r.status ?? '') !== 'Pending' && adaOrder(r))
  .sort((a, b) => String(b.decided_at ?? b.approved_at ?? '').localeCompare(String(a.decided_at ?? a.approved_at ?? ''))))
// the held amount is the ORDER total — what the buyer gets back (:5700)
const totalOrder = (r: Refund) => Number(orderDariId.value.get(r.order_id ?? '')?.total) || 0
const nilaiTertahan = computed(() => antreRefund.value.reduce((a, r) => a + totalOrder(r), 0))
const pembeli = (r: Refund) => orderDariId.value.get(r.order_id ?? '')
const acaraRefund = (r: Refund) => daftar.value.rows.find(e => e.id === pembeli(r)?.event_id)
const nTiket = (r: Refund) => daftarTiket.value.rows.filter(t => t.order_item_id === r.order_id).length
const tglKecil = (x: unknown) => (x ? fmtTglEms(String(x).slice(0, 10)) : '')

const muatUlang = () => Promise.all([refresh(), refreshRefund(), refreshOrder(), refreshTiket(), refreshKursi(), refreshKelas()])

async function simpanPutusan(e: Acara, setuju: boolean, alasan: string) {
  try {
    // the submitter (oleh) stays; the decider is penyetuju (setujuiRencana :4818)
    await patchEvent('events', e.id, {
      status: setuju ? 'Approval' : 'Planning',
      pengajuan: { ...(e.pengajuan ?? {}), status: setuju ? 'Disetujui' : 'Ditolak', penyetuju: namaSaya.value, disetujuiPada: new Date().toISOString(), alasan },
      statusAt: Date.now(),
      updatedAt: Date.now(),
    }, daftar.value.versions[e.id])
    toast.add({ title: setuju ? 'Disetujui — tahapnya naik ke Approval. Lanjutkan ke Upcoming kalau acaranya sudah pasti berjalan.' : 'Rencana ditolak — alasannya tercatat di kartunya.', color: 'success' })
    await refresh()
  }
  catch (err) {
    if (!(await tanganiKonflik(err, refresh))) toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}
// tolakRencana (:4837): a rejection needs its reason
const tolakAcara = ref<Acara | null>(null)
const alasanTolak = ref('')
const sheetTolakRencana = computed({ get: () => tolakAcara.value !== null, set: v => (tolakAcara.value = v ? tolakAcara.value : null) })
function putuskanRencana(e: Acara, setuju: boolean) {
  if (setuju) return simpanPutusan(e, true, '')
  alasanTolak.value = ''
  tolakAcara.value = e
}
async function tolakRencanaYakin() {
  const e = tolakAcara.value
  const alasan = alasanTolak.value.trim()
  if (!e) return
  if (!alasan) {
    toast.add({ title: 'Alasan wajib diisi.', color: 'error' })
    return
  }
  tolakAcara.value = null
  await simpanPutusan(e, false, alasan)
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

// counts as the old tabs show them: nothing when zero
const n = (x: number) => (x ? ` (${x})` : '')
const nAntri = computed(() => tab.value === 'semua' ? antreRencana.value.length + antreRefund.value.length : tab.value === 'refund' ? antreRefund.value.length : antreRencana.value.length)
const nRiwayat = computed(() => tab.value === 'semua' ? sudahRencana.value.length + sudahRefund.value.length : tab.value === 'refund' ? sudahRefund.value.length : sudahRencana.value.length)
const listRencana = computed(() => (riwayat.value === 'antri' ? antreRencana.value : sudahRencana.value))
const listRefund = computed(() => (riwayat.value === 'antri' ? antreRefund.value : sudahRefund.value))
const lihatRencana = computed(() => tab.value !== 'refund')
const lihatRefund = computed(() => tab.value !== 'rencana')
const kosong = computed(() => {
  const antri = riwayat.value === 'antri'
  if (tab.value === 'semua' && !listRencana.value.length && !listRefund.value.length) return antri ? 'Tidak ada satu pun perkara yang menunggu keputusan.' : 'Belum ada keputusan yang tercatat.'
  if (tab.value === 'rencana' && !listRencana.value.length) return antri ? 'Tidak ada rencana yang menunggu keputusan.' : 'Belum ada keputusan yang tercatat.'
  if (tab.value === 'refund' && !listRefund.value.length) return antri ? 'Tidak ada pengajuan refund yang menunggu.' : 'Belum ada keputusan yang tercatat.'
  return ''
})
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

      <AppStatGrid
        class="mb-4"
        :loading="statMemuat"
        :count="3"
      >
        <AppStat
          label="Rencana Menunggu"
          :value="angka(antreRencana.length)"
          :sub="antreRencana.length ? 'perlu ditindak' : 'semua sudah diputuskan'"
          icon="i-lucide-hourglass"
          tone="warning"
        />
        <AppStat
          label="Refund Menunggu"
          :value="angka(antreRefund.length)"
          :sub="antreRefund.length ? 'pembeli sedang menunggu uangnya' : 'tidak ada yang menggantung'"
          icon="i-lucide-undo-2"
          tone="warning"
        />
        <AppStat
          label="Nilai Refund Tertahan"
          :value="rupiah(nilaiTertahan)"
          sub="kalau semuanya disetujui"
          icon="i-lucide-banknote"
          tone="error"
        />
      </AppStatGrid>

      <AppSeg
        v-model="tab"
        class="mb-3"
        :options="[
          { value: 'semua', label: `Semua${n(antreRencana.length + antreRefund.length)}` },
          { value: 'rencana', label: `Rencana Event${n(antreRencana.length)}` },
          { value: 'refund', label: `Refund E-Ticket${n(antreRefund.length)}` },
        ]"
      />
      <UTabs
        v-model="riwayat"
        class="mb-4"
        variant="link"
        :content="false"
        :items="[{ value: 'antri', label: `Antrian${n(nAntri)}` }, { value: 'sudah', label: `Riwayat Approval${n(nRiwayat)}` }]"
      />

      <div
        v-if="kosong"
        class="rounded-panel border border-default bg-elevated p-8 text-center text-sm text-muted"
      >
        {{ kosong }}
      </div>

      <AppPanel
        v-if="lihatRencana && listRencana.length"
        :title="tab === 'semua' ? `Rencana Event (${listRencana.length})` : undefined"
        :icon="tab === 'semua' ? 'i-lucide-clipboard-list' : undefined"
        flush
        class="mb-4"
      >
        <UTable
          :columns="[{ id: 'event', header: 'Event' }, { id: 'tanggal', header: 'Tanggal' }, { id: 'venue', header: 'Venue' }, { id: 'oleh', header: 'Diajukan' }, { id: 'status', header: 'Status' }, { id: 'aksi', header: manajemen && riwayat === 'antri' ? 'Aksi' : '' }]"
          :data="listRencana"
          class="hidden lg:block"
        >
          <template #event-cell="{ row }">
            <b class="block text-highlighted">{{ row.original.title || '(tanpa judul)' }}</b>
            <span class="block text-xs text-muted">{{ row.original.category }}</span>
          </template>
          <template #tanggal-cell="{ row }">
            {{ fmtTglJamEms(row.original.start_datetime) }}
          </template>
          <template #venue-cell="{ row }">
            {{ row.original.venue || '—' }}
          </template>
          <template #oleh-cell="{ row }">
            {{ row.original.pengajuan?.oleh || '—' }}
            <span class="block text-xs text-muted">{{ tglKecil(row.original.pengajuan?.pada) }}</span>
          </template>
          <template #status-cell="{ row }">
            <AppStatus
              :color="PENGAJUAN_WARNA[statusPengajuan({ pengajuan: row.original.pengajuan })] ?? 'neutral'"
              :icon="PENGAJUAN_IKON[statusPengajuan({ pengajuan: row.original.pengajuan })]"
              size="sm"
            >
              {{ statusPengajuan({ pengajuan: row.original.pengajuan }) }}
            </AppStatus>
            <span
              v-if="row.original.pengajuan?.alasan"
              class="mt-0.5 block text-xs text-error"
            >{{ row.original.pengajuan.alasan }}</span>
          </template>
          <template #aksi-cell="{ row }">
            <span
              v-if="manajemen && riwayat === 'antri'"
              class="flex gap-1"
            >
              <UButton
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
            </span>
            <UButton
              v-else
              :to="`/event/events/${row.original.id}`"
              color="neutral"
              variant="outline"
              size="sm"
            >
              Buka
            </UButton>
          </template>
        </UTable>
        <ul class="divide-y divide-default lg:hidden">
          <li
            v-for="e in listRencana"
            :key="e.id"
            class="px-4 py-3"
          >
            <b class="block text-sm text-highlighted">{{ e.title || '(tanpa judul)' }}</b>
            <span class="mt-0.5 block text-xs text-muted">{{ fmtTglJamEms(e.start_datetime) }} · {{ e.venue || '—' }} · {{ e.pengajuan?.oleh || '—' }}</span>
            <span
              v-if="e.pengajuan?.alasan"
              class="mt-0.5 block text-xs text-error"
            >{{ e.pengajuan.alasan }}</span>
            <span class="mt-1.5 flex flex-wrap items-center gap-1.5">
              <AppStatus
                :color="PENGAJUAN_WARNA[statusPengajuan({ pengajuan: e.pengajuan })] ?? 'neutral'"
                :icon="PENGAJUAN_IKON[statusPengajuan({ pengajuan: e.pengajuan })]"
                size="sm"
              >
                {{ statusPengajuan({ pengajuan: e.pengajuan }) }}
              </AppStatus>
              <template v-if="manajemen && riwayat === 'antri'">
                <UButton
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
              <UButton
                v-else
                :to="`/event/events/${e.id}`"
                color="neutral"
                variant="outline"
                size="sm"
              >Buka</UButton>
            </span>
          </li>
        </ul>
      </AppPanel>

      <AppPanel
        v-if="lihatRefund && listRefund.length"
        :title="tab === 'semua' ? `Refund E-Ticket (${listRefund.length})` : undefined"
        :icon="tab === 'semua' ? 'i-lucide-undo-2' : undefined"
        flush
      >
        <UTable
          :columns="[{ id: 'pembeli', header: 'Pembeli' }, { id: 'event', header: 'Event' }, { id: 'nominal', header: 'Nominal' }, { id: 'alasan', header: 'Alasan' }, { id: 'oleh', header: 'Diajukan' }, { id: 'status', header: 'Status' }, { id: 'aksi', header: manajemen && riwayat === 'antri' ? 'Aksi' : '' }]"
          :data="listRefund"
          class="hidden lg:block"
        >
          <template #pembeli-cell="{ row }">
            <b class="block">{{ pembeli(row.original)?.buyer_name || '—' }}</b>
            <span class="block text-xs text-muted">{{ pembeli(row.original)?.phone || pembeli(row.original)?.email || '' }}</span>
          </template>
          <template #event-cell="{ row }">
            {{ acaraRefund(row.original)?.title || '(event terhapus)' }}
            <span class="block text-xs text-muted">{{ nTiket(row.original) }} tiket</span>
          </template>
          <template #nominal-cell="{ row }">
            <span class="num">{{ rupiah(totalOrder(row.original)) }}</span>
          </template>
          <template #alasan-cell="{ row }">
            <span class="text-xs">{{ String(row.original.reason ?? '') || '—' }}</span>
          </template>
          <template #oleh-cell="{ row }">
            {{ String(row.original.oleh ?? '') || '—' }}
            <span class="block text-xs text-muted">{{ tglKecil(row.original.requested_at) }}</span>
          </template>
          <template #status-cell="{ row }">
            <AppStatus
              v-if="row.original.status === 'Pending'"
              color="warning"
              icon="i-lucide-hourglass"
              size="sm"
            >
              Menunggu
            </AppStatus>
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
                Selesaikan
              </UButton>
            </span>
            <AppStatus
              v-else
              :color="row.original.status === 'Approved' ? 'success' : 'neutral'"
              :icon="row.original.status === 'Approved' ? 'i-lucide-check' : 'i-lucide-x'"
              size="sm"
            >
              {{ row.original.status === 'Approved' ? 'Disetujui' : 'Ditolak' }}
            </AppStatus>
            <span
              v-if="row.original.penyetuju"
              class="block text-xs text-muted"
            >{{ row.original.penyetuju }}</span>
            <span
              v-if="row.original.alasan_tolak"
              class="block text-xs text-error"
            >{{ row.original.alasan_tolak }}</span>
          </template>
          <template #aksi-cell="{ row }">
            <span
              v-if="manajemen && riwayat === 'antri'"
              class="flex gap-1"
            >
              <UButton
                size="sm"
                loading-auto
                @click="putuskanRefund(row.original, true)"
              >
                Setujui
              </UButton>
              <UButton
                color="error"
                variant="outline"
                size="sm"
                loading-auto
                @click="putuskanRefund(row.original, false)"
              >
                Tolak
              </UButton>
            </span>
          </template>
        </UTable>
        <ul class="divide-y divide-default lg:hidden">
          <li
            v-for="r in listRefund"
            :key="r.id"
            class="px-4 py-3 text-sm"
          >
            <b class="block">{{ pembeli(r)?.buyer_name || '—' }} · <span class="num">{{ rupiah(totalOrder(r)) }}</span></b>
            <span class="block text-xs text-muted">{{ acaraRefund(r)?.title || '(event terhapus)' }} · {{ String(r.reason ?? '') || '—' }}</span>
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
                Selesaikan
              </UButton>
            </span>
            <span
              v-if="riwayat === 'antri' && manajemen"
              class="mt-1.5 flex gap-1.5"
            >
              <UButton
                size="sm"
                loading-auto
                @click="putuskanRefund(r, true)"
              >Setujui</UButton>
              <UButton
                color="error"
                variant="outline"
                size="sm"
                loading-auto
                @click="putuskanRefund(r, false)"
              >Tolak</UButton>
            </span>
          </li>
        </ul>
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
            loading-auto
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

      <ResponsiveSheet
        v-model:open="sheetTolakRencana"
        title="Tolak rencana"
      >
        <p class="mb-2 text-sm text-muted">
          {{ tolakAcara?.title }}
        </p>
        <UFormField
          label="Alasan"
          required
          help="Alasannya wajib: penolakan tanpa alasan cuma memantulkan pekerjaan bolak-balik."
        >
          <UTextarea
            v-model="alasanTolak"
            :rows="3"
            placeholder="mis. anggaran belum masuk, tanggal bentrok dengan acara lain"
            class="w-full"
          />
        </UFormField>
        <template #footer>
          <UButton
            color="error"
            loading-auto
            @click="tolakRencanaYakin()"
          >
            Tolak
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            @click="sheetTolakRencana = false"
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
