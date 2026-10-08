<!--
  Performa Omset & Bonus — recognised turnover per event PIC plus the four
  bonus schemes (`event/index.html:5302`, D.12).

  The maths is IMPORTED from the single source `app/utils/performa-bonus.ts`
  (`pbAgregasi`, `bonusEvent`) — never copied (F.22). Data comes from
  `GET /kompas/performa/event` (T-23, G-12); the "Nominal" column stays
  hand-typed on the event (`event.nominal`), paged 5 per page (`PF_PER_HAL`).
  Only Head roster / manajemen sees everyone; others see their own PIC row.
-->
<script setup lang="ts">
import type { Acara } from '~/composables/useEvent'
import { patchEvent, performaEvent, useDaftarEvent } from '~/composables/useEvent'
import { apiErrorMessage } from '~/composables/useApi'
import { useModulMembers } from '~/composables/useRoster'
import { bolehSetujui, peranEvent } from '~/utils/layar/event'
import { angka, rupiah, tglPendek } from '~/utils/format'
import type { HariBreakdown, PicBonus } from '~/utils/performa-bonus'
import { bonusEvent, pbAgregasi } from '~/utils/performa-bonus'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const toast = useToast()
const me = useMe()
const manajemen = computed(() => bolehSetujui(peranEvent(me.value)))

const bulan = ref(new Date().toISOString().slice(0, 7))
const dari = computed(() => `${bulan.value}-01`)
const sampai = computed(() => {
  const [y, m] = bulan.value.split('-').map(Number)
  return `${bulan.value}-${String(new Date(y!, m!, 0).getDate()).padStart(2, '0')}`
})
function geserBulan(n: number) {
  const [y, m] = bulan.value.split('-').map(Number)
  const d = new Date(y!, m! - 1 + n, 1)
  bulan.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const labelBulan = computed(() => new Date(`${bulan.value}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }))

const { data: anggota } = useModulMembers('event')
const daftarPic = computed<PicBonus[]>(() => (anggota.value ?? []).map(m => ({ id: m.id, name: m.name })))

const { data: envKompas, status, error } = useAsyncData(
  `event-perfomset-${bulan.value}`,
  () => performaEvent(dari.value, sampai.value).then(r => r.data as { days?: HariBreakdown[] }),
  { watch: [bulan], default: () => null },
)
const agregat = computed(() => pbAgregasi(envKompas.value?.days, 'event', daftarPic.value))
const bonus = computed(() => bonusEvent(daftarPic.value, agregat.value.agg))

const picSaya = computed(() => {
  const saya = daftarPic.value.find(p => p.id === me.value?.id)
    ?? daftarPic.value.find(p => p.name.toLowerCase() === (me.value?.name ?? '').toLowerCase())
  return saya ?? (daftarPic.value[0] ?? null)
})
const picAktif = ref('semua')
watch(picSaya, (p) => {
  if (picAktif.value === 'semua' && p && !bolehSemua.value) picAktif.value = p.id
}, { immediate: true })
const bolehSemua = computed(() => manajemen.value || /head/i.test(me.value?.keterangan ?? ''))
const picTampil = computed(() => {
  if (bolehSemua.value && (picAktif.value === 'semua' || !picAktif.value)) return daftarPic.value
  return daftarPic.value.filter(p => p.id === (picAktif.value === 'semua' ? picSaya.value?.id : picAktif.value))
})

// Event list with hand-typed nominal (`event.nominal`, PF_PER_HAL = 5)
const { data: daftar, refresh: refreshAcara } = useDaftarEvent<Acara>('events', {}, 'event-perfomset-events')
const hal = ref(1)
const PER_HAL = 5
const maxHal = computed(() => Math.max(1, Math.ceil(daftar.value.rows.length / PER_HAL)))
const halaman = computed(() => daftar.value.rows.slice((hal.value - 1) * PER_HAL, hal.value * PER_HAL))

async function simpanNominal(e: Acara, nilai: number) {
  try {
    await patchEvent('events', e.id, { nominal: nilai, updatedAt: Date.now() }, daftar.value.versions[e.id])
    toast.add({ title: 'Nominal disimpan', color: 'success' })
    await refreshAcara()
  }
  catch (err) {
    if (!(await tanganiKonflik(err, refreshAcara))) toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}
</script>

<template>
  <AppPage
    title="Performa omset & bonus"
    description="Omset yang diakui tiap PIC event berikut skema bonusnya"
  >
    <template #actions>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-chevron-left"
        @click="geserBulan(-1)"
      />
      <b class="text-highlighted">{{ labelBulan }}</b>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-chevron-right"
        @click="geserBulan(1)"
      />
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      :title="apiErrorMessage(error)"
      class="mb-4"
    />

    <AppPanel
      v-if="bolehSemua"
      title="PIC"
      icon="i-lucide-users"
      class="mb-4"
    >
      <USelect
        v-model="picAktif"
        :items="[{ value: 'semua', label: 'Semua PIC' }, ...daftarPic.map(p => ({ value: p.id, label: p.name }))]"
        class="max-w-xs"
      />
    </AppPanel>

    <div
      v-if="status === 'pending'"
      class="grid gap-3 md:grid-cols-2"
    >
      <USkeleton
        v-for="i in 2"
        :key="i"
        class="h-40"
      />
    </div>
    <div
      v-else
      class="grid gap-3 md:grid-cols-2"
    >
      <AppPanel
        v-for="p in picTampil"
        :key="p.id"
        :title="p.name"
        icon="i-lucide-user"
      >
        <dl class="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt class="text-xs text-muted">
              Realisasi
            </dt>
            <dd class="font-bold text-highlighted num">
              {{ rupiah(agregat.agg[p.id]?.real ?? 0) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted">
              Event
            </dt>
            <dd class="font-bold text-highlighted num">
              {{ angka((agregat.agg[p.id]?.events ?? []).length) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted">
              Bonus skema 1
            </dt>
            <dd class="font-bold text-highlighted num">
              {{ rupiah(bonus.per[p.id]?.s1 ?? 0) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted">
              Bonus skema 2
            </dt>
            <dd class="font-bold text-highlighted num">
              {{ rupiah(bonus.per[p.id]?.s2 ?? 0) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted">
              Bonus skema 4
            </dt>
            <dd class="font-bold text-highlighted num">
              {{ rupiah(bonus.per[p.id]?.s4?.bonus ?? 0) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted">
              Voucher
            </dt>
            <dd class="font-bold text-highlighted num">
              {{ rupiah(bonus.per[p.id]?.voucher ?? 0) }}
            </dd>
          </div>
        </dl>
        <ul class="mt-2 space-y-1 text-xs text-muted">
          <li
            v-for="ev in (agregat.agg[p.id]?.events ?? []).slice(0, 5)"
            :key="`${ev.date}-${ev.srcId}`"
            class="flex justify-between gap-2"
          >
            <span class="truncate">{{ tglPendek(ev.date) }} · {{ ev.name }}</span>
            <span class="shrink-0 num">{{ rupiah(ev.porsi) }}</span>
          </li>
        </ul>
      </AppPanel>
    </div>
    <p
      v-if="!picTampil.length && status !== 'pending'"
      class="py-10 text-center text-sm text-dimmed"
    >
      Belum ada PIC / data kompas untuk bulan ini.
    </p>

    <AppPanel
      title="Daftar event (nominal diketik)"
      icon="i-lucide-list"
      flush
      class="mt-4"
    >
      <UTable
        :columns="[{ id: 'acara', header: 'Event' }, { id: 'tanggal', header: 'Tanggal' }, { id: 'nominal', header: 'Nominal' }]"
        :data="halaman"
        class="hidden lg:block"
      >
        <template #acara-cell="{ row }">
          <ULink
            :to="`/event/events/${row.original.id}`"
            class="font-semibold text-highlighted hover:text-primary-700"
          >
            {{ row.original.title }}
          </ULink>
        </template>
        <template #tanggal-cell="{ row }">
          {{ tglPendek(String(row.original.start_datetime ?? '').slice(0, 10)) }}
        </template>
        <template #nominal-cell="{ row }">
          <UInput
            :model-value="Number(row.original.nominal) || 0"
            type="number"
            min="0"
            size="sm"
            class="w-40"
            @change="simpanNominal(row.original, Number(($event.target as HTMLInputElement).value) || 0)"
          />
        </template>
      </UTable>
      <ul class="divide-y divide-default lg:hidden">
        <li
          v-for="e in halaman"
          :key="e.id"
          class="px-4 py-2.5 text-sm"
        >
          <b class="block truncate text-highlighted">{{ e.title }}</b>
          <UInput
            :model-value="Number(e.nominal) || 0"
            type="number"
            min="0"
            size="sm"
            class="mt-1 w-44"
            @change="simpanNominal(e, Number(($event.target as HTMLInputElement).value) || 0)"
          />
        </li>
      </ul>
      <div class="flex items-center justify-between px-4 py-3 text-xs text-muted">
        <span class="num">{{ daftar.rows.length ? `${(hal - 1) * PER_HAL + 1}–${Math.min(hal * PER_HAL, daftar.rows.length)} dari ${angka(daftar.rows.length)}` : '0 dari 0' }}</span>
        <span class="flex gap-1">
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-chevron-left"
            :disabled="hal <= 1"
            @click="hal--"
          />
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-chevron-right"
            :disabled="hal >= maxHal"
            @click="hal++"
          />
        </span>
      </div>
    </AppPanel>
  </AppPage>
</template>
