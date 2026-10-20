<!--
  Investor Compass › Upcoming Event. What is coming, in time order (the table),
  and which dates of the month are busy (the calendar) — two questions over
  the same data, so both draw from the one agenda read. No filters, no search,
  no rupiah: investors need what and when.

  Loaded lazily when the tab opens: one investorAgenda call fans out to
  Marketing, Event and BD server-side. A module that did not answer is named
  in a warning strip — an empty list must never read as "no events".

    laksamana-office/investor/index.html:535-542  tab markup
    laksamana-office/investor/index.html:1196-1312  vEvent + calendar
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { InvestorAgendaEvent } from '~/composables/useInvestor'
import { useInvestorAgenda } from '~/composables/useInvestor'
import { fTgl, hariIni as tglHariIni } from '~/utils/format'
import { blnPanjang, jarakHari } from '~/utils/investor'

definePageMeta({ access: ['investor'] })

const { data: agenda, status, error, refresh } = useInvestorAgenda()
const acara = computed(() => agenda.value?.event ?? [])
const gagal = computed(() => agenda.value?.gagal ?? [])
const lebih = computed(() => agenda.value?.eventLebih ?? 0)
const hariIni = computed(() => agenda.value?.hariIni ?? '')

const mode = ref<'tabel' | 'kalender'>('tabel')

const kolom = computed<TableColumn<InvestorAgendaEvent>[]>(() => [
  { accessorKey: 'tgl', header: 'Tanggal' },
  { accessorKey: 'judul', header: 'Acara' },
  { accessorKey: 'tempat', header: 'Tempat' },
  { accessorKey: 'jenis', header: 'Jenis' },
])

// --- calendar: which dates of one month are busy ----------------------------
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const blnKal = ref(tglHariIni().slice(0, 7))
const geserBulan = (n: number) => {
  const [y, m] = blnKal.value.split('-').map(Number)
  const d = new Date(y!, m! - 1 + n, 1)
  blnKal.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const perTanggal = computed(() => {
  const peta = new Map<string, InvestorAgendaEvent[]>()
  for (const e of acara.value) {
    if (!String(e.tgl).startsWith(blnKal.value)) continue
    peta.set(e.tgl, [...(peta.get(e.tgl) ?? []), e])
  }
  return peta
})
const selKalender = computed(() => {
  const [y, m] = blnKal.value.split('-').map(Number)
  const pertama = new Date(y!, m! - 1, 1).getDay()
  const jumlah = new Date(y!, m!, 0).getDate()
  const sel: ({ tgl: string } | null)[] = []
  for (let i = 0; i < pertama; i++) sel.push(null)
  for (let d = 1; d <= jumlah; d++) sel.push({ tgl: `${blnKal.value}-${String(d).padStart(2, '0')}` })
  return sel
})
const hitungBulan = computed(() => acara.value.filter(e => String(e.tgl).startsWith(blnKal.value)).length)
</script>

<template>
  <AppPage
    title="Upcoming event"
    description="Acara terjadwal dari modul Marketing & Event"
  >
    <AppPanel
      v-if="status === 'pending'"
      title="Memuat agenda"
    >
      <USkeleton class="h-24 w-full" />
    </AppPanel>

    <div v-else-if="error || !agenda">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Agenda tidak bisa dibaca"
        :description="apiErrorMessage(error, 'Periksa koneksi, lalu muat ulang halaman.')"
      />
      <UButton
        label="Muat ulang"
        color="error"
        variant="soft"
        class="mt-3"
        @click="() => refresh()"
      />
    </div>

    <template v-else>
      <UAlert
        v-if="gagal.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Daftar mungkin belum lengkap"
        :description="`Data dari ${gagal.join(', ')} tidak terbaca saat ini.`"
        class="mb-5"
      />

      <AppPanel
        title="Acara akan datang"
        icon="i-lucide-calendar-days"
        :count="acara.length"
        flush
      >
        <template #head>
          <div class="flex w-full flex-wrap items-center gap-3">
            <AppSeg
              v-model="mode"
              :options="[
                { value: 'tabel', label: 'Tabel', icon: 'i-lucide-table' },
                { value: 'kalender', label: 'Kalender', icon: 'i-lucide-calendar-days' },
              ]"
            />
          </div>
        </template>

        <p
          v-if="!acara.length"
          class="px-4 py-6 text-sm text-muted"
        >
          Belum ada acara terjadwal. Acara Marketing &amp; Event yang tanggalnya sudah lewat hari ini muncul di sini.
        </p>

        <template v-else-if="mode === 'tabel'">
          <UTable
            class="hidden lg:block"
            :data="acara"
            :columns="kolom"
            empty="Belum ada acara."
          >
            <template #tgl-cell="{ row }">
              <span class="num">{{ fTgl(row.original.tgl) }}</span>
              <span class="block text-[13px] font-normal text-muted">{{ row.original.jam || jarakHari(row.original.tgl, hariIni) }}</span>
            </template>
            <template #judul-cell="{ row }">
              <b>{{ row.original.judul }}</b>
              <span class="block text-[13px] font-normal text-muted">{{ row.original.sumber }}</span>
            </template>
            <template #tempat-cell="{ row }">
              {{ row.original.tempat || '—' }}
            </template>
            <template #jenis-cell="{ row }">
              {{ row.original.jenis || '—' }}{{ row.original.pax ? ` · ${row.original.pax} pax` : '' }}
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="(e, i) in acara"
              :key="i"
              class="px-4 py-3"
            >
              <p class="font-semibold text-highlighted">
                {{ e.judul }}
              </p>
              <p class="mt-0.5 text-sm text-muted">
                {{ fTgl(e.tgl) }}{{ e.jam ? ` · ${e.jam}` : '' }} · {{ jarakHari(e.tgl, hariIni) }}
              </p>
              <p
                v-if="e.tempat || e.jenis"
                class="text-sm text-muted"
              >
                {{ [e.tempat, e.jenis].filter(Boolean).join(' · ') }}{{ e.pax ? ` · ${e.pax} pax` : '' }}
              </p>
            </div>
          </div>
          <p
            v-if="lebih > 0"
            class="px-4 py-2 text-[13px] text-muted"
          >
            + {{ lebih }} acara lagi tidak ditampilkan.
          </p>
        </template>

        <template v-else>
          <div class="flex items-center justify-between gap-2 px-4 py-3">
            <UButton
              icon="i-lucide-chevron-left"
              variant="soft"
              size="sm"
              aria-label="Bulan sebelumnya"
              @click="geserBulan(-1)"
            />
            <b class="text-highlighted">{{ blnPanjang(blnKal) }}</b>
            <UButton
              icon="i-lucide-chevron-right"
              variant="soft"
              size="sm"
              aria-label="Bulan berikutnya"
              @click="geserBulan(1)"
            />
          </div>
          <div class="grid grid-cols-7 gap-px bg-default px-4 pb-4">
            <p
              v-for="h in HARI"
              :key="h"
              class="py-1 text-center text-xs font-bold tracking-wide text-muted uppercase"
            >
              {{ h }}
            </p>
            <div
              v-for="(s, i) in selKalender"
              :key="i"
              class="min-h-16 rounded-field border border-default p-1"
              :class="!s && 'border-transparent'"
            >
              <template v-if="s">
                <p
                  class="text-xs font-bold"
                  :class="s.tgl === hariIni ? 'text-primary-700' : 'text-muted'"
                >
                  {{ Number(s.tgl.slice(8)) }}
                </p>
                <p
                  v-for="(e, k) in (perTanggal.get(s.tgl) ?? []).slice(0, 2)"
                  :key="k"
                  class="truncate text-[11px] text-highlighted"
                  :title="e.judul"
                >
                  {{ e.judul }}
                </p>
                <p
                  v-if="(perTanggal.get(s.tgl) ?? []).length > 2"
                  class="text-[11px] text-muted"
                >
                  +{{ (perTanggal.get(s.tgl) ?? []).length - 2 }} lagi
                </p>
              </template>
            </div>
          </div>
          <p class="px-4 py-2 text-[13px] text-muted">
            {{ hitungBulan ? `${hitungBulan} acara di ${blnPanjang(blnKal)}` : `Tidak ada acara di ${blnPanjang(blnKal)}` }}
          </p>
        </template>
      </AppPanel>
    </template>
  </AppPage>
</template>
