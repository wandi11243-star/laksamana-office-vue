<!--
  Radar › Entertainment (owner request, 28 Nov 2026). The daily MC / DJ / Band
  roster, read from Event › Talent Schedule through the board's `hiburan[]`.
  Read-only: the roster is edited in Event only. It is a companion to the
  event agenda, never mixed into it — events and pax stay on their own pages;
  a day that also has an event only gets a small "ada event" note.

  Opens WEEKLY, grouped per day, like Reservasi.
-->
<script setup lang="ts">
import type { RadarHiburan } from '~/composables/useRadar'
import { periodeBaru, rentangPeriode, dalamPeriode } from '~/utils/radar'
import { fTglP } from '~/utils/format'

definePageMeta({ access: ['radar'] })

const p = useState('radar-fHib', () => periodeBaru('minggu'))
const kat = useState('radar-fHib-kat', () => '')
const dari = computed(() => rentangPeriode(p.value).dari)
const sampai = computed(() => rentangPeriode(p.value).sampai)
const { data: board, status, error, refresh } = useRadarBoard('radar-hib-board', dari, sampai)
useSegarSenyap(refresh, () => false)

const semua = computed(() => (board.value?.hiburan ?? []).filter(h => dalamPeriode(h.tanggal, p.value)))
const opsiKat = computed(() => [...new Set(semua.value.map(h => h.kategori || 'Lainnya'))].sort())
const list = computed(() => semua.value.filter(h => !kat.value || (h.kategori || 'Lainnya') === kat.value))
const perHari = computed(() => {
  const m = new Map<string, RadarHiburan[]>()
  for (const h of list.value) m.set(h.tanggal, [...(m.get(h.tanggal) ?? []), h])
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
})
/** Days that also have an event — a note only, the event itself lives on its own page. */
const hariEvent = computed(() => new Set((board.value?.agenda ?? []).map(a => a.tgl).filter(Boolean)))

// Category colours (MC, DJ, Band …) so the roster reads at a glance.
const WARNA_KAT: Record<string, string> = {
  'Band': 'bg-violet-100 text-violet-800',
  'DJ': 'bg-sky-100 text-sky-800',
  'MC DJ': 'bg-amber-100 text-amber-800',
  'MC': 'bg-amber-100 text-amber-800',
  'Acoustic': 'bg-emerald-100 text-emerald-800',
  'Solo Singer': 'bg-rose-100 text-rose-800',
}
const warna = (k: string) => WARNA_KAT[k] ?? 'bg-muted text-ink-900'
const memuat = computed(() => !board.value && (status.value === 'pending' || status.value === 'idle'))
</script>

<template>
  <AppPage
    title="Entertainment"
    description="Jadwal MC, DJ & Band harian dari Event › Talent Schedule — hanya membaca."
  >
    <RadarPitaGagal :sumber="board?.sumber" />
    <p
      v-if="error"
      class="mb-4 rounded-field border border-error/30 bg-error/10 p-3 text-sm"
    >
      <b>Jadwal entertainment tidak terbaca:</b> {{ apiErrorMessage(error) }}
    </p>

    <AppPanel>
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-[11px] font-bold uppercase tracking-wide text-muted">Periode</span>
        <RadarPeriode v-model="p" />
      </div>
      <div
        v-if="opsiKat.length > 1"
        class="mt-3 flex flex-wrap gap-1.5"
      >
        <button
          type="button"
          class="rounded-full border px-3 py-1 text-sm font-medium"
          :class="!kat ? 'border-transparent bg-inverted text-inverted' : 'border-default'"
          @click="kat = ''"
        >
          Semua
        </button>
        <button
          v-for="k in opsiKat"
          :key="k"
          type="button"
          class="rounded-full px-3 py-1 text-sm font-medium ring-2"
          :class="[warna(k), kat === k ? 'ring-current' : 'ring-transparent']"
          @click="kat = kat === k ? '' : k"
        >
          {{ k }}
        </button>
      </div>
    </AppPanel>

    <div
      v-if="memuat"
      class="space-y-3"
    >
      <USkeleton
        v-for="i in 3"
        :key="i"
        class="h-24 rounded-panel"
      />
    </div>
    <AppPanel
      v-else-if="!perHari.length"
      title="Belum ada jadwal"
    >
      <p class="py-6 text-center text-sm text-muted">
        Tidak ada jadwal MC, DJ atau Band pada periode ini. Jadwal diisi di Event › Talent Schedule.
      </p>
    </AppPanel>
    <AppPanel
      v-for="[tgl, isi] in perHari"
      :key="tgl"
      :title="fTglP(tgl)"
      :count="isi.length"
    >
      <template
        v-if="hariEvent.has(tgl)"
        #actions
      >
        <AppStatus
          size="sm"
          color="gold"
          icon="i-lucide-star"
        >
          Ada event
        </AppStatus>
      </template>
      <ul class="divide-y divide-default">
        <li
          v-for="h in isi"
          :key="h.id"
          class="flex flex-wrap items-center gap-3 py-3"
        >
          <span class="w-28 shrink-0 font-semibold tabular-nums text-highlighted">
            {{ h.mulai || '—' }}<template v-if="h.selesai"> – {{ h.selesai }}</template>
          </span>
          <span
            class="rounded-full px-2.5 py-0.5 text-sm font-semibold"
            :class="warna(h.kategori || 'Lainnya')"
          >{{ h.kategori || 'Lainnya' }}</span>
          <span class="min-w-0 flex-1 text-base font-medium">{{ h.talent || 'Talent belum diisi' }}</span>
          <AppStatus
            v-if="h.status"
            size="sm"
            :color="h.status === 'Done' ? 'success' : 'neutral'"
          >
            {{ h.status }}
          </AppStatus>
        </li>
      </ul>
    </AppPanel>
  </AppPage>
</template>
