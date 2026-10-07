<!--
  Performa Marketing / Performa Event — ONE component for both, in Finance ›
  Kas Kecil (old `viewPerforma`, deploy/finance/kas/index.html:4402-4520). The
  realisation counter is `performa-bonus.ts` (pbAgregasi) — the SAME engine
  Marketing/Event will use; rows whose PIC is not on the roster are reported as
  `yatim`, never dropped. Bonus numbers come from the same engine; the full
  ladder sheets belong to the division screens and are not duplicated here.
-->
<script setup lang="ts">
import type { AggPic, BarisYatim, HariBreakdown, PicBonus } from '~/utils/performa-bonus'
import { bonusEvent, bonusMarketing, pbAgregasi } from '~/utils/performa-bonus'
import { getKompasState, getRoster } from '~/composables/useCashier'
import { fmtRp } from '~/utils/cashier'
import { hariIni } from '~/utils/format'
import { hasAccess } from '~/composables/useMe'

const props = defineProps<{ divisi: 'marketing' | 'event', kunci: string }>()

const izin = useKasIzin()
const periode = ref(hariIni().slice(0, 7))
const pilihan = ref('__all__')
const hal = ref(1)
const PER_HAL = 5

const { data, error } = useAsyncData(props.kunci, async () => {
  const [state, roster] = await Promise.all([getKompasState(), getRoster()])
  return { state, roster }
})

const judul = computed(() => (props.divisi === 'marketing' ? 'Performa marketing' : 'Performa event'))
const hari = computed<HariBreakdown[]>(() => (data.value?.state.value.daily ?? [])
  .filter(d => String(d.date).slice(0, 7) === periode.value)
  .slice()
  .sort((a, b) => (a.date < b.date ? -1 : 1)) as unknown as HariBreakdown[])
const list = computed<PicBonus[]>(() => (data.value?.state.value.employees?.[props.divisi] ?? []) as PicBonus[])
const komplimen = computed(() => (data.value?.state.value.compliments ?? []).filter(c => String(c.date).startsWith(periode.value)))

const hasil = computed(() => pbAgregasi(hari.value, props.divisi, list.value, komplimen.value as never))
const agg = computed<Record<string, AggPic>>(() => hasil.value.agg)
const yatim = computed<BarisYatim[]>(() => hasil.value.yatim)
const yatimTeks = computed(() => yatim.value.slice(0, 6)
  .map(y => `${y.date} ${y.name}${y.srcPic ? ` (PIC asalnya "${y.srcPic}")` : ''}`)
  .join(' · '))
const namaPic = (id: string) => list.value.find(e => e.id === id)?.name ?? id

const totalReal = computed(() => list.value.reduce((s, e) => s + (agg.value[e.id]?.real ?? 0), 0))
const totalEvent = computed(() => list.value.reduce((s, e) => s + (agg.value[e.id]?.events.length ?? 0), 0))
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
watch([pilihan, periode], () => {
  hal.value = 1
})

const topEvent = computed(() => eventsTampil.value.slice().sort((a, b) => b.porsi - a.porsi)[0] ?? null)

// Bonus: the same engine the division screens will use. Only the money totals
// and the current rung's label are shown here; the ladder sheets live there.
const bonus = computed(() => {
  if (props.divisi === 'marketing') {
    const b = bonusMarketing(list.value, agg.value)
    if (pilihan.value === '__all__') return { tunai: b.tunaiSemua, voucher: b.voucherSemua, label: '', semua: true }
    const p = b.per[pilihan.value]
    return { tunai: p?.tunai ?? 0, voucher: p?.voucher ?? 0, label: p?.s2?.label ?? '', semua: false }
  }
  const b = bonusEvent(list.value, agg.value)
  if (pilihan.value === '__all__') return { tunai: b.tunaiSemua, voucher: b.voucherSemua, label: '', semua: true }
  const p = b.per[pilihan.value]
  return { tunai: p?.tunai ?? 0, voucher: p?.voucher ?? 0, label: p?.s4?.label ?? '', semua: false }
})

const punyaAnalitik = computed(() => hasAccess(useMe().value, ['analytics']))
</script>

<template>
  <AppPage
    :title="judul"
    :description="divisi === 'marketing' ? 'Kontribusi omset per marketing.' : 'Kontribusi omset per PIC event.'"
  >
    <template #actions>
      <UInput
        v-model="periode"
        type="month"
        size="sm"
        class="w-40"
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

    <template v-else>
      <div class="mb-4">
        <AppSeg
          v-model="pilihan"
          size="sm"
          :options="[{ value: '__all__', label: 'Semua' }, ...list.map(e => ({ value: e.id, label: e.name }))]"
        />
      </div>

      <AppStatGrid>
        <AppStat
          label="Realisasi"
          icon="i-lucide-coins"
          :value="fmtRp(realTampil)"
          :sub="pilihan === '__all__' ? `${list.length} PIC` : namaPic(pilihan)"
        />
        <AppStat
          label="Jumlah event"
          icon="i-lucide-calendar-days"
          :value="pilihan === '__all__' ? totalEvent : (aktif?.events.length ?? 0)"
          sub="baris breakdown yang diakui"
          tone="info"
        />
        <AppStat
          label="Compliment ditanggung"
          icon="i-lucide-gift"
          :value="fmtRp(pilihan === '__all__' ? totalComp : (aktif?.comp ?? 0))"
          sub="memotong realisasi (sub total)"
          tone="warning"
        />
        <AppStat
          label="Bonus saat ini"
          icon="i-lucide-badge-percent"
          :value="fmtRp(bonus.tunai + bonus.voucher)"
          :sub="bonus.semua ? 'gabungan semua PIC — bonus dinilai per orang' : `tunai ${fmtRp(bonus.tunai)} + voucher ${fmtRp(bonus.voucher)}${bonus.label ? ` · ${bonus.label}` : ''}`"
          tone="success"
        />
      </AppStatGrid>

      <UAlert
        v-if="yatim.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-user-x"
        :title="`${yatim.length} baris breakdown tidak diakui untuk siapa pun (PIC-nya tidak ada di roster ${divisi}).`"
        :description="yatimTeks"
      />

      <AppPanel
        v-if="topEvent"
        :title="`Top event — ${topEvent.name || '(tanpa nama)'}`"
        :description="`${topEvent.date} · diakui ${fmtRp(topEvent.porsi)}${topEvent.ob ? ` · open bill ${fmtRp(topEvent.ob)}` : ''}`"
      />

      <AppPanel
        title="Daftar event"
        :description="`${eventsTampil.length} baris diakui pada ${periode}. Diakui PIC = ${divisi === 'marketing' ? 'omset + tax + service + open bill' : 'setengah nilai event + open bill penuh'}.`"
        flush
      >
        <table class="hidden w-full text-sm lg:table">
          <thead class="bg-table-head text-table-head-text">
            <tr>
              <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
                Tanggal
              </th>
              <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
                Nama event
              </th>
              <th
                v-if="pilihan === '__all__'"
                class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider"
              >
                PIC
              </th>
              <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                Nilai
              </th>
              <th
                v-if="divisi === 'marketing'"
                class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider"
              >
                Tax + service
              </th>
              <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                Open bill
              </th>
              <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                Diakui
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="(e, i) in halaman.rows"
              :key="`${e.date}-${i}`"
            >
              <td class="px-3 py-2">
                {{ e.date }}
              </td>
              <td class="px-3 py-2">
                {{ e.name || '(tanpa nama)' }}
              </td>
              <td
                v-if="pilihan === '__all__'"
                class="px-3 py-2 text-muted"
              >
                {{ (e as { pic?: string }).pic || '—' }}
              </td>
              <td class="px-3 py-2 text-end num">
                {{ fmtRp(e.amount) }}
              </td>
              <td
                v-if="divisi === 'marketing'"
                class="px-3 py-2 text-end num"
              >
                {{ fmtRp(e.tax + e.service) }}
              </td>
              <td class="px-3 py-2 text-end num">
                {{ e.ob ? fmtRp(e.ob) : '—' }}
              </td>
              <td class="px-3 py-2 text-end font-semibold num">
                {{ fmtRp(e.porsi) }}
              </td>
            </tr>
            <tr v-if="!eventsTampil.length">
              <td
                :colspan="divisi === 'marketing' ? 7 : 6"
                class="px-3 py-6 text-center text-sm text-muted"
              >
                Tidak ada baris diakui bulan ini.
              </td>
            </tr>
          </tbody>
        </table>

        <div class="divide-y divide-default lg:hidden">
          <div
            v-for="(e, i) in halaman.rows"
            :key="`${e.date}-${i}`"
            class="flex items-start justify-between gap-3 px-4 py-2.5"
          >
            <div class="min-w-0">
              <p class="text-sm font-semibold text-highlighted">
                {{ e.name || '(tanpa nama)' }}
              </p>
              <p class="text-[11px] text-muted">
                {{ e.date }}<template v-if="pilihan === '__all__' && (e as { pic?: string }).pic">
                  · {{ (e as { pic?: string }).pic }}
                </template>
              </p>
            </div>
            <b class="shrink-0 num">{{ fmtRp(e.porsi) }}</b>
          </div>
        </div>

        <div
          v-if="totalHal > 1"
          class="flex flex-wrap items-center justify-between gap-2 border-t border-default px-4 py-3 lg:px-5"
        >
          <UButton
            label="‹ Sebelumnya"
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="halaman.p <= 1"
            @click="hal = halaman.p - 1"
          />
          <span class="text-xs text-muted">Baris {{ halaman.mulai + 1 }}–{{ halaman.akhir }} dari {{ eventsTampil.length }}</span>
          <UButton
            label="Berikutnya ›"
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="halaman.p >= totalHal"
            @click="hal = halaman.p + 1"
          />
        </div>
      </AppPanel>

      <AppPanel
        title="Per PIC"
        description="Realisasi = porsi diakui − compliment yang ditanggung. Baris tanpa PIC tidak diakui untuk siapa pun, tetapi tetap dilaporkan di atas."
        flush
      >
        <div class="divide-y divide-default">
          <div
            v-for="e in list.slice().sort((a, b) => (agg[b.id]?.real ?? 0) - (agg[a.id]?.real ?? 0))"
            :key="e.id"
            class="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 lg:px-5"
          >
            <button
              type="button"
              class="min-w-0 flex-1 text-start"
              @click="pilihan = e.id"
            >
              <b class="text-highlighted">{{ e.name }}</b>
              <span class="block text-xs text-muted">{{ agg[e.id]?.events.length ?? 0 }} event · compliment {{ fmtRp(agg[e.id]?.comp ?? 0) }}</span>
            </button>
            <b class="num">{{ fmtRp(agg[e.id]?.real ?? 0) }}</b>
          </div>
          <p
            v-if="!list.length"
            class="px-4 py-6 text-center text-sm text-muted"
          >
            Belum ada PIC {{ divisi }} di roster. Tambah Tim/Keterangan-nya di Office.
          </p>
        </div>
      </AppPanel>

      <p class="text-xs text-muted">
        <template v-if="punyaAnalitik">
          Pembanding Analytics tersedia dari modul Analytics.
        </template>
        <template v-else>
          Tangga bonus lengkap ditampilkan di layar modul {{ divisi === 'marketing' ? 'Marketing' : 'Event' }}; layar ini memakai mesin yang sama.
        </template>
      </p>
    </template>
  </AppPage>
</template>
