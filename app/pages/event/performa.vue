<!--
  Event Performance — objective results per event & talent from one function
  (`angkaEms :4925`), shared with Report so the two never differ (D.13).

  Only Approval/Upcoming/Event Done stages count as result (`EVT_STATUS_HASIL`).
  `terjual` (class counter) and `tiket` (issued e-tickets) stay apart on purpose.
-->
<script setup lang="ts">
import { useStateEvent } from '~/composables/useEvent'
import { angkaEms, EVT_STATUS_HASIL, tglWIB } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { angka, persen, rupiah } from '~/utils/format'

definePageMeta({ access: ['event'] })

const { data: state, status, refresh, error } = useStateEvent()
const s = computed(() => state.value?.data ?? null)

const ringkas = computed(() => angkaEms(s.value?.events ?? [], s.value?.ticketClasses ?? [], s.value?.tickets ?? [], s.value?.orders ?? []))

interface BarisAcara { id: string, judul: string, tanggal: string, omzet: number, terjual: number, kuota: number, tiket: number, hadir: number }
const perAcara = computed<BarisAcara[]>(() => {
  const acara = (s.value?.events ?? []).filter(e => (EVT_STATUS_HASIL as string[]).includes(String(e.status)))
  const kelas = s.value?.ticketClasses ?? []
  const tiket = s.value?.tickets ?? []
  const order = s.value?.orders ?? []
  const idMasuk = new Set((s.value?.checkins ?? []).filter(c => (c.result ?? 'Valid') === 'Valid').map(c => c.ticket_id))
  return acara.map((e) => {
    const ks = kelas.filter(c => c.event_id === e.id)
    const ts = tiket.filter(t => t.event_id === e.id)
    return {
      id: e.id,
      judul: e.title,
      tanggal: tglWIB(e.start_datetime),
      omzet: order.filter(o => o.event_id === e.id && o.payment_status === 'Paid').reduce((a, o) => a + (Number(o.total) || 0), 0),
      terjual: ks.reduce((a, c) => a + (Number(c.sold) || 0), 0),
      kuota: ks.reduce((a, c) => a + (Number(c.quota) || 0), 0),
      tiket: ts.length,
      hadir: ts.filter(t => idMasuk.has(t.id)).length,
    }
  }).sort((a, b) => b.omzet - a.omzet)
})

interface BarisTalent { id: string, nama: string, show: number, fee: number }
const perTalent = computed<BarisTalent[]>(() => {
  const m = new Map<string, BarisTalent>()
  for (const j of s.value?.schedules ?? []) {
    if (j.status !== 'Done') continue
    const b = m.get(j.talent_id) ?? { id: j.talent_id, nama: (s.value?.talents ?? []).find(t => t.id === j.talent_id)?.name ?? '—', show: 0, fee: 0 }
    b.show += 1
    b.fee += Number(j.fee) || 0
    m.set(j.talent_id, b)
  }
  return [...m.values()].sort((a, b) => b.show - a.show)
})
</script>

<template>
  <EventGerbang lihat="performa">
  <AppPage
    title="Event performance"
    description="Ukur hasil event & talent secara objektif"
  >
    <template #actions>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-refresh-cw"
        :loading="status === 'pending'"
        @click="refresh()"
      >
        Muat ulang
      </UButton>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      :title="apiErrorMessage(error)"
      class="mb-4"
    />

    <AppStatGrid class="mb-4">
      <AppStat
        label="Event hasil"
        :value="angka(ringkas.hasil)"
        icon="i-lucide-party-popper"
        tone="vip"
      />
      <AppStat
        label="Omzet"
        :value="rupiah(ringkas.omzet)"
        icon="i-lucide-banknote"
        tone="gold"
      />
      <AppStat
        label="Terjual / kuota"
        :value="`${angka(ringkas.terjual)} / ${angka(ringkas.kuota)}`"
        icon="i-lucide-ticket"
        tone="info"
      />
      <AppStat
        label="Keterisian"
        :value="persen(ringkas.kuota ? ringkas.terjual / ringkas.kuota : 0)"
        icon="i-lucide-armchair"
        tone="success"
      />
      <AppStat
        label="Hadir / tiket"
        :value="`${angka(ringkas.hadir)} / ${angka(ringkas.tiket)}`"
        icon="i-lucide-scan-line"
        tone="success"
      />
      <AppStat
        label="Kehadiran"
        :value="persen(ringkas.tiket ? ringkas.hadir / ringkas.tiket : 0)"
        icon="i-lucide-door-open"
        tone="info"
      />
    </AppStatGrid>

    <AppPanel
      title="Hasil per event"
      icon="i-lucide-chart-column"
      flush
      class="mb-4"
    >
      <UTable
        :columns="[{ id: 'acara', header: 'Event' }, { id: 'omzet', header: 'Omzet' }, { id: 'jual', header: 'Terjual' }, { id: 'isi', header: 'Isi' }, { id: 'hadir', header: 'Hadir' }]"
        :data="perAcara"
        class="hidden lg:block"
      >
        <template #acara-cell="{ row }">
          <ULink
            :to="`/event/events/${row.original.id}`"
            class="font-semibold text-highlighted hover:text-primary-700"
          >
            {{ row.original.judul }}
          </ULink>
          <span class="block text-xs text-muted">{{ row.original.tanggal }}</span>
        </template>
        <template #omzet-cell="{ row }">
          <span class="num">{{ rupiah(row.original.omzet) }}</span>
        </template>
        <template #jual-cell="{ row }">
          <span class="num">{{ angka(row.original.terjual) }}/{{ angka(row.original.kuota) }}</span>
        </template>
        <template #isi-cell="{ row }">
          <span class="num">{{ row.original.kuota ? Math.round(row.original.terjual / row.original.kuota * 100) : 0 }}%</span>
        </template>
        <template #hadir-cell="{ row }">
          <span class="num">{{ angka(row.original.hadir) }}/{{ angka(row.original.tiket) }}</span>
        </template>
      </UTable>
      <ul class="divide-y divide-default lg:hidden">
        <li
          v-for="r in perAcara"
          :key="r.id"
          class="px-4 py-2.5 text-sm"
        >
          <b class="block truncate text-highlighted">{{ r.judul }}</b>
          <span class="block text-xs text-muted num">{{ rupiah(r.omzet) }} · {{ angka(r.terjual) }}/{{ angka(r.kuota) }} · hadir {{ angka(r.hadir) }}/{{ angka(r.tiket) }}</span>
        </li>
      </ul>
    </AppPanel>

    <AppPanel
      title="Hasil per talent"
      icon="i-lucide-mic-vocal"
      flush
    >
      <UTable
        :columns="[{ id: 'nama', header: 'Talent' }, { id: 'show', header: 'Show done' }, { id: 'fee', header: 'Total fee' }]"
        :data="perTalent"
        class="hidden lg:block"
      >
        <template #nama-cell="{ row }">
          <ULink
            :to="`/event/talents/${row.original.id}`"
            class="font-semibold text-highlighted hover:text-primary-700"
          >
            {{ row.original.nama }}
          </ULink>
        </template>
        <template #show-cell="{ row }">
          <span class="num">{{ angka(row.original.show) }}</span>
        </template>
        <template #fee-cell="{ row }">
          <span class="num">{{ rupiah(row.original.fee) }}</span>
        </template>
      </UTable>
      <ul class="divide-y divide-default lg:hidden">
        <li
          v-for="r in perTalent"
          :key="r.id"
          class="flex justify-between px-4 py-2.5 text-sm"
        >
          <b class="text-highlighted">{{ r.nama }}</b>
          <span class="num">{{ r.show }} show · {{ rupiah(r.fee) }}</span>
        </li>
      </ul>
      <p
        v-if="!perTalent.length"
        class="px-4 py-6 text-center text-sm text-dimmed"
      >
        Belum ada show done.
      </p>
    </AppPanel>
  </AppPage>
  </EventGerbang>
</template>
