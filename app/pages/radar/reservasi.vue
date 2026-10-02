<!--
  Radar › Reservasi (deploy/radar vResList).

  Opens WEEKLY: the question people bring is "how many bookings are in for
  Friday and Saturday, which nights are still empty". Harian turns the page
  into the daily sheet (the old Briefing): who is coming, their special
  requests, ready for WhatsApp or print. `?tgl=` (from the Pusat Koordinasi
  "Buka reservasi hari ini" button and the calendar) opens that day directly.

  Only LIVE bookings by default: Cancelled and No-show will not come, and
  counting them makes the floor lay tables for guests who already cancelled.
  Picking a status explicitly wins over that rule — otherwise choosing
  "Cancelled" would return an empty list with no visible reason.
-->
<script setup lang="ts">
import type { RadarPilihan, RadarReservasi } from '~/composables/useRadar'
import {
  SEMUA, agendaTgl, dalamPeriode, dpTeks, iris, labelPeriode, paxRes, periodeBaru, rentangPeriode,
  resHidup, saringAktif, urutJam, waResHarian, warnaStatusRes,
} from '~/utils/radar'
import { fTgl, fTglP } from '~/utils/format'

definePageMeta({ access: ['radar'] })

const route = useRoute()
const me = useMe()
const p = useState('radar-fRs', () => periodeBaru('minggu'))
const f = useState('radar-fRs-f', () => ({ q: '', status: SEMUA, kategori: SEMUA, view: 'tabel' as 'grid' | 'tabel' }))

const qTgl = typeof route.query.tgl === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.tgl) ? route.query.tgl : ''
if (qTgl) p.value = { ...p.value, mode: 'hari', tgl: qTgl }

const dari = computed(() => rentangPeriode(p.value).dari)
const sampai = computed(() => rentangPeriode(p.value).sampai)
const { data: board, status, error, refresh } = useRadarBoard('radar-rs-board', dari, sampai)
const semua = computed(() => (board.value?.reservations ?? []).filter(r => r.date))
const agenda = computed(() => board.value?.agenda ?? [])

const list = computed(() => {
  const q = f.value.q.trim().toLowerCase()
  return urutJam(semua.value.filter(r => (saringAktif(f.value.status) ? String(r.status || '') === f.value.status : resHidup(r))
    && dalamPeriode(r.date, p.value)
    && (!saringAktif(f.value.kategori) || String(r.category || '') === f.value.kategori)
    && (!q || `${r.name || ''} ${r.phone || ''} ${r.table || ''}`.toLowerCase().includes(q))))
})
const hari = computed(() => (p.value.mode === 'hari' ? p.value.tgl : ''))

const opsiStatus = computed(() => [{ value: SEMUA, label: 'Hanya yang hidup' },
  ...[...new Set(semua.value.map(r => String(r.status || '')).filter(Boolean))].sort().map(s => ({ value: s, label: s }))])
const opsiKat = computed(() => [{ value: SEMUA, label: 'Semua kategori' },
  ...[...new Set(semua.value.map(r => String(r.category || '')).filter(Boolean))].sort().map(s => ({ value: s, label: s }))])
const OPSI_VIEW = [
  { value: 'grid' as const, label: 'Grid', icon: 'i-lucide-layout-grid' },
  { value: 'tabel' as const, label: 'Tabel', icon: 'i-lucide-table' },
]

const blmKonf = computed(() => list.value.filter(r => /pending|menunggu/i.test(String(r.status || ''))).length)
const vipKorp = computed(() => list.value.filter(r => r.vip || /vip|korporat/i.test(String(r.category || ''))).length)
const khusus = computed(() => list.value.filter(r => r.notes || r.foodReq || r.drinkReq))

const hal = ref(1)
watch([list], () => {
  hal.value = 1
})

const dicetak = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
function kirimWa() {
  const t = waResHarian(hari.value, agenda.value, board.value?.reservations ?? [])
  window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank', 'noopener')
}
const cetak = () => window.print()

const pilih = ref<RadarPilihan>(null)
const buka = ref(false)
const bukaRes = (r: RadarReservasi) => {
  pilih.value = { jenis: 'rs', r }
  buka.value = true
}
useSegarSenyap(refresh, () => buka.value)
</script>

<template>
  <AppPage
    title="Reservasi"
    description="Dari modul Reservasi — hanya membaca."
  >
    <RadarPitaGagal :sumber="board?.sumber" />
    <p
      v-if="error"
      class="mb-4 rounded-field border border-error/30 bg-error/10 p-3 text-sm"
    >
      <b>Reservasi tidak terbaca:</b> {{ apiErrorMessage(error) }}
    </p>

    <AppPanel class="print:hidden">
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-[11px] font-bold uppercase tracking-wide text-muted">Periode</span>
        <RadarPeriode v-model="p" />
      </div>
    </AppPanel>

    <template v-if="hari">
      <AppPanel class="print:hidden">
        <div class="flex flex-wrap items-center gap-2">
          <b class="text-highlighted">Lembar harian</b>
          <span class="text-sm text-muted">{{ fTgl(hari) }}</span>
          <div class="flex-1" />
          <UButton
            label="Kirim ke WhatsApp"
            icon="i-lucide-message-circle"
            color="neutral"
            variant="outline"
            size="sm"
            @click="kirimWa"
          />
          <UButton
            label="Cetak"
            icon="i-lucide-printer"
            size="sm"
            @click="cetak"
          />
        </div>
      </AppPanel>
      <AppPanel>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
              Laksamana Muda Coffee &amp; Live Space
            </p>
            <h2 class="mt-1 font-display text-xl font-bold text-highlighted">
              Reservasi Harian
            </h2>
            <p class="text-sm text-muted">
              {{ fTgl(hari) }}
            </p>
          </div>
          <p class="text-right text-xs text-muted">
            Dicetak {{ dicetak }}<br>oleh {{ me?.name || '—' }}
          </p>
        </div>
        <!-- Today's agenda is one line of CONTEXT (the floor needs to know), never part of the guest count. -->
        <p
          v-if="agendaTgl(agenda, hari).length"
          class="mt-3 border-t border-default pt-3 text-sm text-muted"
        >
          Agenda hari ini: {{ agendaTgl(agenda, hari).map(a => a.judul + (a.jam ? ` (${a.jam})` : '')).join(' · ') }}
        </p>
      </AppPanel>
    </template>

    <AppStatGrid>
      <AppStat
        :label="hari ? 'Booking hari itu' : 'Reservasi tampil'"
        icon="i-lucide-book-open"
        :value="list.length"
        :sub="labelPeriode(p)"
      />
      <AppStat
        label="Total pax"
        icon="i-lucide-users"
        tone="info"
        :value="paxRes(list)"
        sub="tanpa yang batal & no-show"
      />
      <AppStat
        v-if="hari"
        label="Meja terpakai"
        icon="i-lucide-armchair"
        tone="info"
        :value="list.filter(r => r.table).length"
        sub="dari booking hari itu"
      />
      <AppStat
        v-else
        label="Belum konfirmasi"
        icon="i-lucide-clock"
        :tone="blmKonf ? 'error' : 'gold'"
        :value="blmKonf"
        sub="perlu tindak lanjut"
      />
      <AppStat
        label="VIP / Korporat"
        icon="i-lucide-crown"
        tone="vip"
        :value="vipKorp"
        sub="butuh perhatian khusus"
      />
    </AppStatGrid>

    <AppPanel class="print:hidden">
      <AppFilterGrid>
        <UFormField label="Cari">
          <UInput
            v-model="f.q"
            placeholder="Nama, nomor, meja…"
            icon="i-lucide-search"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Status">
          <USelect
            v-model="f.status"
            :items="opsiStatus"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Kategori">
          <USelect
            v-model="f.kategori"
            :items="opsiKat"
            class="w-full"
          />
        </UFormField>
      </AppFilterGrid>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <p class="flex-1 text-xs text-muted">
          Reservasi <b>Cancelled</b> dan <b>No-show</b> disembunyikan — keduanya tidak akan datang.
          Pilih statusnya di penyaring untuk memunculkannya kembali.
        </p>
        <AppSeg
          v-model="f.view"
          :options="OPSI_VIEW"
          size="sm"
        />
      </div>
    </AppPanel>

    <p
      v-if="status === 'pending' && !board"
      class="text-sm text-muted"
    >
      Memuat…
    </p>
    <AppPanel v-else-if="!list.length">
      <p class="text-center text-sm">
        <b class="block text-highlighted">Tidak ada reservasi yang cocok</b>
        Ubah periode, filter, atau kata kuncinya.
      </p>
    </AppPanel>
    <template v-else-if="f.view === 'grid'">
      <div class="grid gap-3 lg:grid-cols-2">
        <button
          v-for="r in iris(list, hal)"
          :key="r.id"
          type="button"
          class="rounded-panel border border-default bg-default p-3.5 text-left shadow-panel transition-colors hover:border-primary-300"
          @click="bukaRes(r)"
        >
          <span class="flex items-baseline gap-2">
            <span class="num text-sm font-semibold text-muted">{{ r.time || '--:--' }}</span>
            <span class="min-w-0 flex-1 truncate font-semibold text-highlighted">{{ r.name || '—' }}</span>
            <span class="num font-display text-lg font-bold">{{ Number(r.pax) || 0 }}<span class="text-xs font-semibold text-muted"> pax</span></span>
          </span>
          <span class="mt-1 flex flex-wrap gap-x-3 text-[13px] text-muted">
            <span class="inline-flex items-center gap-1"><UIcon
              name="i-lucide-calendar"
              class="size-3.5"
            />{{ fTglP(r.date) }}</span>
            <span
              v-if="r.table"
              class="inline-flex items-center gap-1"
            ><UIcon
              name="i-lucide-map-pin"
              class="size-3.5"
            />{{ r.table }}</span>
            <span v-if="r.category">{{ r.category }}</span>
          </span>
          <span class="mt-2 flex flex-wrap gap-1.5">
            <AppStatus
              :color="warnaStatusRes(r)"
              size="sm"
            >{{ r.status || '—' }}</AppStatus>
            <AppStatus
              v-if="r.vip"
              color="vip"
              icon="i-lucide-crown"
              size="sm"
            >VIP</AppStatus>
            <AppStatus
              v-if="board?.bolehUang"
              :color="dpTeks(r).ada ? 'success' : 'neutral'"
              size="sm"
            >{{ dpTeks(r).ada ? dpTeks(r).teks : 'DP belum' }}</AppStatus>
          </span>
          <span
            v-if="r.notes"
            class="mt-2 block truncate text-xs text-muted"
          >{{ r.notes }}</span>
        </button>
      </div>
      <RadarPager
        v-model="hal"
        :total="list.length"
        satuan="booking"
        class="mt-3"
      />
    </template>
    <AppPanel
      v-else
      flush
    >
      <RadarTabelRes
        :list="list"
        tanggal
        :boleh-uang="board?.bolehUang"
        kosong="Tidak ada reservasi yang cocok."
        @buka="bukaRes"
      />
    </AppPanel>

    <!-- Special requests only on one day: across a month the list is too long to be useful. -->
    <AppPanel
      v-if="hari && khusus.length"
      title="Permintaan khusus tamu"
      icon="i-lucide-message-square-warning"
      :count="khusus.length"
    >
      <div
        v-for="r in khusus"
        :key="r.id"
        class="mb-2 rounded-r-field border-l-4 border-primary-400 bg-primary-50 px-3 py-2 text-sm dark:bg-primary-950/40"
      >
        <b class="text-highlighted">{{ r.name || '—' }}</b>
        <span class="text-muted num"> ({{ r.time || '—' }} · {{ Number(r.pax) || 0 }} pax{{ r.table ? ` · ${r.table}` : '' }})</span>
        <p class="whitespace-pre-wrap">
          {{ [r.notes, r.foodReq, r.drinkReq].filter(Boolean).join(' · ') }}
        </p>
      </div>
    </AppPanel>

    <RadarDetailSheet
      v-model:open="buka"
      :pilih="pilih"
      :boleh-uang="board?.bolehUang"
    />
  </AppPage>
</template>
