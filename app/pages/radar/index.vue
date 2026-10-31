<!--
  Radar › Pusat Koordinasi (deploy/radar vRadar).

  Numbers are SPLIT per source, never added up: Marketing pax (the client's
  contract), Event pax (the event's capacity) and table-booking pax are three
  different crowds that happen to come on the same day. Only events that will
  actually happen count (the API filters: Marketing Deal / Event Done, Event
  Approval / Upcoming / Event Done).

  The F&B filter narrows the Marketing/Event numbers AND the 14-day agenda,
  never the reservation numbers: a table booking has no F&B format, and
  emptying it when a format is picked would read as "no guests tonight".

  Agenda 14 hari lists EVENTS only — reservations have their own table below
  and their own screen; mixed in, two weeks of bookings drown the events.
-->
<script setup lang="ts">
import type { RadarAgenda, RadarPilihan } from '~/composables/useRadar'
import {
  SEMUA, TANPA_FB, agendaTgl, cocokFb, dDay, dalamPeriode, fbOpsi, iris, labelPeriode, paxOf,
  paxRes, periodeBaru, rentangPeriode, resHidup, resAktif, resTgl, saringAktif,
} from '~/utils/radar'
import { fTgl, hariIni, tambahHari } from '~/utils/format'

definePageMeta({ access: ['radar'] })

const p = useState('radar-fRd', () => periodeBaru('hari'))
const fb = useState('radar-fRd-fb', () => SEMUA)

const hari = hariIni()
// One request covers the picked period, today, and the 14 days ahead.
const dari = computed(() => [rentangPeriode(p.value).dari, hari].sort()[0]!)
const sampai = computed(() => [rentangPeriode(p.value).sampai, tambahHari(hari, 14)].sort().at(-1)!)
const { data: board, status, error, refresh } = useRadarBoard('radar-board', dari, sampai)

const agenda = computed(() => board.value?.agenda ?? [])
const res = computed(() => board.value?.reservations ?? [])

const agPer = computed(() => agenda.value.filter(a => dalamPeriode(a.tgl, p.value) && cocokFb(a, fb.value)))
const rsPer = computed(() => resAktif(res.value).filter(r => resHidup(r) && dalamPeriode(r.date, p.value)))
const mkt = computed(() => agPer.value.filter(a => a.sumber === 'mkt'))
const evt = computed(() => agPer.value.filter(a => a.sumber === 'evt'))

const dua = computed(() => agenda.value.filter((a) => {
  const d = dDay(a.tgl)
  return d >= 0 && d <= 14 && cocokFb(a, fb.value)
}))
const hal14 = ref(1)
watch([dua], () => {
  hal14.value = 1
})

const resHariIni = computed(() => resTgl(res.value, hari))
const agHariIni = computed(() => agendaTgl(agenda.value, hari))

const opsiFb = computed(() => [
  { value: SEMUA, label: 'Semua format F&B' },
  ...fbOpsi(agenda.value, board.value?.fbFormats).map(f => ({ value: f, label: f })),
  // Event-module events never have a format; without this option picking any format hides them unexplained.
  { value: TANPA_FB, label: '(tanpa format F&B)' },
])
const labelFb = computed(() => (fb.value === TANPA_FB ? 'tanpa format F&B' : fb.value))

const pilih = ref<RadarPilihan>(null)
const buka = ref(false)
const bukaAgenda = (a: RadarAgenda) => {
  pilih.value = { jenis: 'ag', a }
  buka.value = true
}

useSegarSenyap(refresh, () => buka.value)
</script>

<template>
  <AppPage
    title="Radar"
    description="Pusat koordinasi: acara Marketing, Event, Reservasi VIP, dan reservasi meja dalam satu papan."
  >
    <RadarPitaGagal :sumber="board?.sumber" />
    <p
      v-if="error"
      class="mb-4 rounded-field border border-error/30 bg-error/10 p-3 text-sm"
    >
      <b>Papan tidak terbaca:</b> {{ apiErrorMessage(error) }}
    </p>

    <AppPanel>
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-[11px] font-bold uppercase tracking-wide text-muted">Ringkasan</span>
        <RadarPeriode v-model="p" />
        <USelect
          v-model="fb"
          :items="opsiFb"
          size="sm"
          class="min-h-11 w-52"
          aria-label="Format F&B"
        />
      </div>
    </AppPanel>

    <AppStatGrid>
      <AppStat
        label="Total reservasi"
        icon="i-lucide-book-open"
        tone="info"
        :value="rsPer.length"
        sub="booking meja"
      />
      <AppStat
        label="Total pax reservasi"
        icon="i-lucide-users"
        tone="info"
        :value="paxRes(rsPer)"
        sub="tamu meja · tanpa batal & no-show"
      />
      <AppStat
        label="Total pax Event"
        icon="i-lucide-mic-vocal"
        tone="vip"
        :value="paxOf(evt)"
        :sub="`${evt.length} acara · dari modul Event`"
      />
      <AppStat
        label="Total pax Marketing"
        icon="i-lucide-briefcase"
        :value="paxOf(mkt)"
        :sub="`${mkt.length} event · pax kontrak klien`"
      />
    </AppStatGrid>
    <p class="-mt-3 mb-5 text-xs text-muted">
      Pax Event dan pax Marketing <b>tidak dijumlahkan</b> dengan pax reservasi meja — ketiganya rombongan berbeda.
      Hanya acara yang sudah pasti jalan yang dihitung (Marketing: Deal / Event Done · Event: Approval / Upcoming / Event Done).
      Periode: {{ labelPeriode(p) }}.
    </p>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div class="min-w-0">
        <AppPanel
          title="Agenda 14 hari"
          icon="i-lucide-calendar-days"
          :count="dua.length"
          :description="saringAktif(fb) ? labelFb : undefined"
        >
          <div
            v-if="status === 'pending' && !board"
            class="space-y-2"
          >
            <!-- Loading rows mirror the agenda list below. -->
            <USkeleton
              v-for="i in 4"
              :key="i"
              class="h-12 w-full"
            />
            <p class="pt-1 text-sm text-muted">
              Memuat…
            </p>
          </div>
          <p
            v-else-if="!dua.length"
            class="text-sm text-muted"
          >
            <b class="text-highlighted">Tidak ada agenda dalam 14 hari.</b>
            Jendela kosong. Kalau ini bukan low season, ini saatnya mendorong booking korporat.
          </p>
          <div
            v-else
            class="grid gap-3"
          >
            <RadarAgendaKartu
              v-for="a in iris(dua, hal14)"
              :key="`${a.sumber}-${a.id}`"
              :a="a"
              @buka="bukaAgenda"
            />
          </div>
          <RadarPager
            v-model="hal14"
            :total="dua.length"
            satuan="acara"
            class="-mx-4 -mb-4 mt-3 lg:-mx-5 lg:-mb-5"
          />
        </AppPanel>

        <AppPanel
          title="Reservasi hari ini"
          icon="i-lucide-book-open"
          :count="resHariIni.length"
          flush
        >
          <RadarTabelRes
            :list="[...resHariIni].sort((x, y) => String(x.time || '').localeCompare(String(y.time || '')))"
            :boleh-uang="false"
            kosong="Tidak ada booking untuk tanggal ini."
            @buka="r => { pilih = { jenis: 'rs', r }; buka = true }"
          />
        </AppPanel>
      </div>

      <div>
        <!-- "Hari ini" sums up a DATE, so both modules may sit here — each under its own heading. -->
        <AppPanel
          title="Hari ini"
          icon="i-lucide-sun"
        >
          <p class="font-semibold text-ink-900">
            {{ fTgl(hari) }}
          </p>
          <p class="mt-2 text-[11px] font-bold uppercase tracking-wide text-muted">
            Agenda
          </p>
          <ul
            v-if="agHariIni.length"
            class="text-sm"
          >
            <li
              v-for="a in agHariIni"
              :key="`${a.sumber}-${a.id}`"
            >
              {{ a.judul }}<span
                v-if="a.jam"
                class="text-muted num"
              > · {{ a.jam }}</span>
            </li>
          </ul>
          <p
            v-else
            class="text-sm text-muted"
          >
            Tidak ada agenda — operasional reguler.
          </p>
          <div class="mt-2 border-t border-default pt-2 text-sm">
            <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
              Reservasi meja
            </p>
            <span class="num">{{ resHariIni.length }} booking · {{ paxRes(resHariIni) }} pax</span>
          </div>
          <UButton
            label="Buka reservasi hari ini"
            icon="i-lucide-book-open"
            color="neutral"
            variant="outline"
            block
            class="mt-3 min-h-11"
            :to="{ path: '/radar/reservasi', query: { tgl: hari } }"
          />
        </AppPanel>

        <AppPanel
          title="Sumber data"
          icon="i-lucide-plug"
        >
          <ul class="divide-y divide-default">
            <li
              v-for="s in board?.sumber ?? []"
              :key="s.id"
              class="flex items-center gap-2 py-2"
            >
              <span class="flex-1 text-sm">
                <b class="text-highlighted">{{ s.nama }}</b>
                <span class="block text-xs text-muted">{{ s.ok ? `${s.n ?? 0} ${s.id === 'rsv' ? 'reservasi dalam rentang' : 'event'}` : 'tidak terhubung' }}</span>
              </span>
              <AppStatus
                :color="s.ok ? 'success' : 'error'"
                :icon="s.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
                size="sm"
              >
                {{ s.ok ? 'Terhubung' : 'Gagal' }}
              </AppStatus>
            </li>
          </ul>
          <p class="mt-2 text-xs text-muted">
            Radar hanya membaca. Perubahan tetap dilakukan di modul asalnya.
          </p>
        </AppPanel>
      </div>
    </div>

    <RadarDetailSheet
      v-model:open="buka"
      :pilih="pilih"
      :boleh-uang="board?.bolehUang"
    />
  </AppPage>
</template>
