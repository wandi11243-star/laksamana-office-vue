<!--
  Performa Marketing / Performa Event — ONE component for both, in Finance ›
  Kas Kecil (old `viewPerforma`, deploy/finance/kas/index.html:4402-4520). The
  realisation counter is `performa-bonus.ts` (pbAgregasi) — the SAME engine
  Marketing/Event use; rows whose PIC is not on the roster are reported as
  `yatim`, never dropped. Layout as the old screen: Report Achievement, PIC
  tabs, three cards, top event, Omset per Event | Daftar Event, the bonus
  ladders (MarketingBonusSkema / EventBonusSkema), Rincian Compliment, and
  Persetujuan Potongan Compliment — READ-ONLY here on purpose: the decision is
  taken in Kompas, Finance only sees the result (kas/index.html:3399).
-->
<script setup lang="ts">
import type { AggPic, BarisYatim, HariBreakdown, PicBonus, Compliment } from '~/utils/performa-bonus'
import { bonusEvent, bonusMarketing, pbAgregasi, pbCompIsPemberi, pbCompPotong, pbCompStatusPemberi } from '~/utils/performa-bonus'
import { getRoster, useKompasState } from '~/composables/useCashier'
import { fmtRp } from '~/utils/cashier'
import { hariIni } from '~/utils/format'

const props = defineProps<{ divisi: 'marketing' | 'event', kunci: string }>()

const izin = useKasIzin()
const periode = ref(hariIni().slice(0, 7))
const mode = ref<'bulan' | 'hari'>('bulan')
const tanggal = ref(hariIni())
const pilihan = ref('__all__')
const hal = ref(1)
const PER_HAL = 5

const kp = useKompasState()
const { data: roster, error: errorRoster } = useAsyncData(props.kunci, () => getRoster())
const error = computed(() => errorRoster.value || kp.error.value)
const data = computed(() => ({ state: kp.data.value, roster: roster.value }))

const judul = computed(() => (props.divisi === 'marketing' ? 'Performa marketing' : 'Performa event'))
const cocokRentang = (tgl: unknown) => (mode.value === 'hari' ? String(tgl) === tanggal.value : String(tgl).slice(0, 7) === periode.value)
const hari = computed<HariBreakdown[]>(() => (data.value?.state.value.daily ?? [])
  .filter(d => cocokRentang(d.date))
  .slice()
  .sort((a, b) => (a.date < b.date ? -1 : 1)) as unknown as HariBreakdown[])
const list = computed<PicBonus[]>(() => (data.value?.state.value.employees?.[props.divisi] ?? []) as PicBonus[])
const komplimen = computed(() => (data.value?.state.value.compliments ?? []).filter(c => cocokRentang(c.date)))

const hasil = computed(() => pbAgregasi(hari.value, props.divisi, list.value, komplimen.value as never))
const agg = computed<Record<string, AggPic>>(() => hasil.value.agg)
const yatim = computed<BarisYatim[]>(() => hasil.value.yatim)
const yatimTeks = computed(() => yatim.value.slice(0, 6)
  .map(y => `${y.date} ${y.name}${y.srcPic ? ` (PIC asalnya "${y.srcPic}")` : ''}`)
  .join(' · '))

const totalReal = computed(() => list.value.reduce((s, e) => s + (agg.value[e.id]?.real ?? 0), 0))
const totalComp = computed(() => list.value.reduce((s, e) => s + (agg.value[e.id]?.comp ?? 0), 0))

const aktif = computed(() => (pilihan.value === '__all__' ? null : agg.value[pilihan.value] ?? null))
const realTampil = computed(() => (aktif.value ? aktif.value.real : totalReal.value))
const eventsTampil = computed(() => {
  const evs = pilihan.value === '__all__'
    ? list.value.flatMap(e => (agg.value[e.id]?.events ?? []).map(x => ({ ...x, pic: e.name })))
    : (aktif.value?.events ?? []).map(x => ({ ...x }))
  return evs.slice().sort((a, b) => (a.date < b.date ? 1 : -1))
})
const totalHal = computed(() => Math.max(1, Math.ceil(eventsTampil.value.length / PER_HAL)))
const halaman = computed(() => {
  const p = Math.min(Math.max(1, hal.value), totalHal.value)
  const mulai = (p - 1) * PER_HAL
  return { p, mulai, akhir: Math.min(mulai + PER_HAL, eventsTampil.value.length), rows: eventsTampil.value.slice(mulai, mulai + PER_HAL) }
})
watch([pilihan, periode, mode, tanggal], () => {
  hal.value = 1
})

const topEvent = computed(() => eventsTampil.value.slice().sort((a, b) => b.porsi - a.porsi)[0] ?? null)

const infoMk = computed(() => bonusMarketing(list.value, agg.value))
const infoEv = computed(() => bonusEvent(list.value, agg.value))

/** Per-event bars (old "Omset per Event" chart), largest first. */
const perEvent = computed(() => eventsTampil.value.slice().sort((a, b) => b.porsi - a.porsi))
const maxEvent = computed(() => Math.max(1, ...perEvent.value.map(e => e.porsi)))
const avgEvent = computed(() => (eventsTampil.value.length ? realTampil.value / eventsTampil.value.length : 0))

/** Compliments that cut the realisation shown (old kartuCompliment over a.compRows). */
const compRows = computed(() => {
  const ids = pilihan.value === '__all__' ? list.value.map(e => e.id) : [pilihan.value]
  const rows: (Compliment & { id?: string, date?: string, nama?: string, alasan?: string, tax?: number | string | null, service?: number | string | null })[] = []
  for (const id of ids) {
    for (const c of agg.value[id]?.compRows ?? []) {
      if (!rows.includes(c)) rows.push(c)
    }
  }
  return rows.sort((a, b) => (String(a.date) < String(b.date) ? -1 : 1))
})
const compTotal = computed(() => compRows.value.reduce((s, c) => s + pbCompPotong(c), 0))
const rinciComp = (c: { subTotal?: unknown, tax?: unknown, service?: unknown, alasan?: string }) => (c.subTotal != null || c.tax != null || c.service != null
  ? `sub ${fmtRp(Number(c.subTotal) || 0)} + tax ${fmtRp(Number(c.tax) || 0)} + svc ${fmtRp(Number(c.service) || 0)}`
  : c.alasan || '—')

/** Compliments GIVEN by this division's PICs, decided or not (old kartuApprovalCompliment — read-only in Finance). */
const approval = computed(() => {
  const rows: { c: Compliment & { id?: string, date?: string, nama?: string, alasan?: string, putusOleh?: string }, emp: PicBonus }[] = []
  for (const e of list.value) {
    for (const c of komplimen.value as (Compliment & { id?: string })[]) {
      if (pbCompIsPemberi(c, e) && !rows.some(x => x.c === c)) rows.push({ c, emp: e })
    }
  }
  return rows.sort((a, b) => (String(a.c.date) < String(b.c.date) ? -1 : 1))
})
const STATUS_POTONG = {
  potong: { color: 'error', label: 'Dipotong' },
  tidak: { color: 'success', label: 'Tidak dipotong' },
  menunggu: { color: 'neutral', label: 'Menunggu' },
} as const

const labelPeriode = computed(() => (mode.value === 'hari'
  ? new Date(`${tanggal.value}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  : new Date(`${periode.value}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })))
const cetak = () => cetakPdf(namaBerkas(judul.value, labelPeriode.value))
</script>

<template>
  <AppPage
    :title="judul"
    :description="divisi === 'marketing' ? 'Kontribusi omset per marketing.' : 'Kontribusi omset per PIC event.'"
  >
    <template #actions>
      <AppSeg
        v-model="mode"
        size="sm"
        class="print:hidden"
        :options="[{ value: 'bulan', label: 'Bulanan' }, { value: 'hari', label: 'Harian' }]"
      />
      <AppBulan
        v-if="mode === 'bulan'"
        v-model="periode"
        class="w-48 print:hidden"
      />
      <AppTanggal
        v-else
        v-model="tanggal"
        class="w-48 print:hidden"
      />
    </template>

    <UAlert
      v-if="!izin.lihat(divisi)"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak dibuka untuk peranmu."
    />
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
    />

    <div
      v-else
      class="space-y-4"
    >
      <AppPanel
        title="Report Achievement"
        description="Rekap semua PIC — simpan sebagai PDF."
      >
        <template #actions>
          <UButton
            label="Simpan PDF"
            icon="i-lucide-file-down"
            size="sm"
            class="print:hidden"
            @click="cetak"
          />
        </template>
        <p class="text-sm text-muted">
          Menampilkan <b>{{ mode === 'hari' ? 'satu hari' : 'satu bulan' }}</b> · {{ labelPeriode }}
        </p>
      </AppPanel>

      <AppSeg
        v-model="pilihan"
        size="sm"
        :options="[{ value: '__all__', label: 'Semua' }, ...list.map(e => ({ value: e.id, label: e.name }))]"
      />

      <div class="grid gap-3 sm:grid-cols-3">
        <AppStat
          label="Realisasi"
          icon="i-lucide-coins"
          :value="fmtRp(realTampil)"
          :sub="(pilihan === '__all__' ? totalComp : (aktif?.comp ?? 0)) ? `sudah dipotong compliment ${fmtRp(pilihan === '__all__' ? totalComp : (aktif?.comp ?? 0))}` : 'tanpa potongan compliment'"
          class="bg-primary-50"
        />
        <AppStat
          label="Jumlah event"
          icon="i-lucide-calendar-days"
          :value="eventsTampil.length"
          :sub="`avg ${fmtRp(avgEvent)}/event`"
          tone="info"
        />
        <AppStat
          label="Compliment ditanggung"
          icon="i-lucide-gift"
          :value="fmtRp(compTotal)"
          :sub="`${compRows.length} catatan`"
          tone="warning"
        />
      </div>
      <AppPanel>
        <p class="text-sm text-muted">
          <template v-if="topEvent">
            Top event: <b class="text-highlighted">{{ topEvent.name || '(tanpa nama)' }}</b> · {{ fmtRp(topEvent.porsi) }}
          </template>
          <template v-else>
            Belum ada event.
          </template>
        </p>
      </AppPanel>

      <UAlert
        v-if="yatim.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-user-x"
        :title="`${yatim.length} baris breakdown tidak diakui untuk siapa pun (PIC-nya tidak ada di roster ${divisi}).`"
        :description="yatimTeks"
      />

      <div class="grid items-start gap-4 lg:grid-cols-2">
        <AppPanel title="Omset per Event">
          <p
            v-if="!perEvent.length"
            class="py-8 text-center text-sm text-muted"
          >
            Belum ada event
          </p>
          <div
            v-else
            class="space-y-2.5"
          >
            <AppBar
              v-for="(e, i) in perEvent"
              :key="`${e.date}-${i}`"
              :label="e.name || '(tanpa nama)'"
              :value="fmtRp(e.porsi)"
              :persen="(e.porsi / maxEvent) * 100"
              tone="info"
            />
          </div>
        </AppPanel>

        <AppPanel
          title="Daftar Event"
          :description="`${eventsTampil.length} event · diakui ${divisi === 'marketing' ? 'omset + tax + service + open bill' : '50%, kasir tidak dipotong'}`"
          flush
        >
          <table class="w-full text-sm print:hidden">
            <thead class="bg-table-head text-xs font-bold uppercase tracking-wider text-table-head-text">
              <tr>
                <th class="px-3 py-2.5 text-start">
                  Tanggal
                </th>
                <th class="px-3 py-2.5 text-start">
                  Nama event
                </th>
                <th class="px-3 py-2.5 text-end">
                  {{ divisi === 'marketing' ? 'Omset' : 'Nilai event' }}
                </th>
                <template v-if="divisi === 'marketing'">
                  <th class="px-3 py-2.5 text-end">
                    Tax
                  </th>
                  <th class="px-3 py-2.5 text-end">
                    Service
                  </th>
                </template>
                <th class="px-3 py-2.5 text-end">
                  Diakui
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="(e, i) in halaman.rows"
                :key="`${e.date}-${i}`"
              >
                <td class="px-3 py-2.5 whitespace-nowrap num">
                  {{ e.date }}
                </td>
                <td class="px-3 py-2.5">
                  {{ e.name || '(tanpa nama)' }}
                  <span
                    v-if="pilihan === '__all__' && (e as { pic?: string }).pic"
                    class="block text-[11px] text-muted"
                  >{{ (e as { pic?: string }).pic }}</span>
                </td>
                <td class="px-3 py-2.5 text-end num">
                  {{ fmtRp(e.amount) }}
                </td>
                <template v-if="divisi === 'marketing'">
                  <td class="px-3 py-2.5 text-end num">
                    {{ fmtRp((e as { tax?: number }).tax ?? 0) }}
                  </td>
                  <td class="px-3 py-2.5 text-end num">
                    {{ fmtRp((e as { service?: number }).service ?? 0) }}
                  </td>
                </template>
                <td class="px-3 py-2.5 text-end font-semibold num">
                  {{ fmtRp(e.porsi) }}
                  <span
                    v-if="e.ob"
                    class="block text-[11px] font-normal text-muted"
                  >open bill {{ fmtRp(e.ob) }}</span>
                </td>
              </tr>
              <tr v-if="!eventsTampil.length">
                <td
                  :colspan="divisi === 'marketing' ? 6 : 4"
                  class="px-3 py-6 text-center text-sm text-muted"
                >
                  Belum ada event.
                </td>
              </tr>
            </tbody>
          </table>
          <table class="hidden w-full text-sm print:table">
            <thead class="text-xs font-bold uppercase tracking-wider">
              <tr>
                <th class="px-3 py-2 text-start">
                  Tanggal
                </th>
                <th class="px-3 py-2 text-start">
                  Nama event
                </th>
                <th class="px-3 py-2 text-end">
                  Diakui
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(e, i) in eventsTampil.slice().sort((a, b) => (a.date < b.date ? -1 : 1))"
                :key="`pdf-${e.date}-${i}`"
              >
                <td class="px-3 py-1.5">
                  {{ e.date }}
                </td>
                <td class="px-3 py-1.5">
                  {{ e.name || '(tanpa nama)' }}<template v-if="pilihan === '__all__' && (e as { pic?: string }).pic">
                    ({{ (e as { pic?: string }).pic }})
                  </template>
                </td>
                <td class="px-3 py-1.5 text-end">
                  {{ fmtRp(e.porsi) }}
                </td>
              </tr>
            </tbody>
          </table>
          <div
            v-if="totalHal > 1"
            class="flex flex-wrap items-center justify-between gap-2 border-t border-default px-4 py-3 print:hidden"
          >
            <UButton
              label="‹ Sebelumnya"
              color="neutral"
              variant="outline"
              size="xs"
              :disabled="halaman.p <= 1"
              @click="hal = halaman.p - 1"
            />
            <span class="text-xs text-muted">Baris {{ halaman.mulai + 1 }}–{{ halaman.akhir }} dari {{ eventsTampil.length }}</span>
            <UButton
              label="Berikutnya ›"
              color="neutral"
              variant="outline"
              size="xs"
              :disabled="halaman.p >= totalHal"
              @click="hal = halaman.p + 1"
            />
          </div>
        </AppPanel>
      </div>

      <MarketingBonusSkema
        v-if="divisi === 'marketing'"
        :info="infoMk"
        :pid="pilihan"
        :real="realTampil"
        :list="list"
      />
      <EventBonusSkema
        v-else
        :info="infoEv"
        :pid="pilihan"
        :list="list"
      />

      <AppPanel
        title="Rincian Compliment"
        :flush="compRows.length > 0"
      >
        <template
          v-if="compRows.length"
          #description
        >
          {{ compRows.length }} compliment, dipotong {{ fmtRp(compTotal) }} dari Realisasi di atas — dihitung dari <b>Sub Total</b>, tax &amp; service charge tidak ikut.
        </template>
        <p
          v-if="!compRows.length"
          class="py-4 text-center text-sm text-muted"
        >
          Tidak ada compliment yang membebani pada periode ini.
        </p>
        <table
          v-else
          class="w-full text-sm"
        >
          <thead class="bg-table-head text-xs font-bold uppercase tracking-wider text-table-head-text">
            <tr>
              <th class="px-3 py-2.5 text-start">
                Tanggal
              </th>
              <th
                v-if="pilihan === '__all__'"
                class="px-3 py-2.5 text-start"
              >
                PIC
              </th>
              <th class="px-3 py-2.5 text-start">
                Compliment
              </th>
              <th class="px-3 py-2.5 text-start">
                Rincian
              </th>
              <th class="px-3 py-2.5 text-end">
                Dipotong
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="(c, i) in compRows"
              :key="c.id ?? i"
            >
              <td class="px-3 py-2.5 num">
                {{ c.date }}
              </td>
              <td
                v-if="pilihan === '__all__'"
                class="px-3 py-2.5"
              >
                {{ c.picName || '—' }}
              </td>
              <td class="px-3 py-2.5 font-semibold text-highlighted">
                {{ c.nama || '—' }}
              </td>
              <td class="px-3 py-2.5 text-xs text-muted">
                {{ rinciComp(c) }}
              </td>
              <td class="px-3 py-2.5 text-end num">
                {{ fmtRp(pbCompPotong(c)) }}
              </td>
            </tr>
          </tbody>
          <tfoot class="border-t-2 border-default font-bold">
            <tr>
              <td
                :colspan="pilihan === '__all__' ? 4 : 3"
                class="px-3 py-2.5 text-xs uppercase tracking-wide"
              >
                Total potongan
              </td>
              <td class="px-3 py-2.5 text-end num">
                {{ fmtRp(compTotal) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </AppPanel>

      <AppPanel
        title="Persetujuan Potongan Compliment"
        icon="i-lucide-gift"
        :flush="approval.length > 0"
      >
        <p
          v-if="!approval.length"
          class="py-4 text-center text-sm text-muted"
        >
          Tidak ada compliment yang diberikan PIC {{ divisi === 'marketing' ? 'Marketing' : 'Event' }} pada periode ini.
        </p>
        <template v-else>
          <table class="w-full text-sm">
            <thead class="bg-table-head text-xs font-bold uppercase tracking-wider text-table-head-text">
              <tr>
                <th class="px-3 py-2.5 text-start">
                  Tanggal
                </th>
                <th class="px-3 py-2.5 text-start">
                  Compliment
                </th>
                <th class="px-3 py-2.5 text-start">
                  Pemberi
                </th>
                <th class="px-3 py-2.5 text-end">
                  Nilai potong
                </th>
                <th class="px-3 py-2.5 text-start">
                  Status
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="({ c, emp }, i) in approval"
                :key="c.id ?? i"
              >
                <td class="px-3 py-2.5 num">
                  {{ c.date }}
                </td>
                <td class="px-3 py-2.5">
                  <b class="text-highlighted">{{ c.nama || '—' }}</b>
                  <span class="block text-[11px] text-muted">{{ rinciComp(c) }}</span>
                </td>
                <td class="px-3 py-2.5">
                  {{ emp.name }}
                </td>
                <td class="px-3 py-2.5 text-end num">
                  {{ fmtRp(pbCompPotong(c)) }}
                </td>
                <td class="px-3 py-2.5">
                  <AppStatus
                    :color="STATUS_POTONG[pbCompStatusPemberi(c)].color"
                    size="sm"
                  >
                    {{ STATUS_POTONG[pbCompStatusPemberi(c)].label }}
                  </AppStatus>
                  <span
                    v-if="c.putusOleh"
                    class="block text-[11px] text-muted"
                  >{{ c.putusOleh }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <p class="px-4 py-3 text-xs text-muted">
            Angkanya <b>Sub Total</b> — tax &amp; service charge tidak pernah ikut dipotong. Keputusan potong / tidak diambil di
            <b>modul Kompas</b>; di sini hanya ditampilkan hasilnya.
          </p>
        </template>
      </AppPanel>
    </div>
  </AppPage>
</template>
