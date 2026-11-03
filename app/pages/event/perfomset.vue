<!--
  Event › Performa Omset & Bonus — the legacy `renderPerformaOmsetEvent`
  (event/index.html:5412), twin of Marketing › Performa Omset & Bonus.

  Every number comes from `performa-bonus.ts` (pbAgregasi, bonusEvent) — the
  same engine as Finance › Kas Kecil › Performa Event — never a copy (F.22).
  Data: GET /kompas/performa/event. Daftar Event is built from THIS module's
  events (status not Planning/Draft/Cancelled, WIB month) joined with the
  breakdown rows by srcId `evt:<id>`, so an event Finance has not entered yet
  still shows ("belum diinput finance"). Nominal is typed here and stored on
  the event (`nominal`); empty means empty, never 0. Diakui stays Finance's.

  Who sees whom (pevBolehSemua): Head (whole word in Office Tim/Keterangan) or
  manajemen see every PIC; others see "Semua" + themselves. The gate sits in
  `pid`, not in the buttons.
-->
<script setup lang="ts">
import type { Acara } from '~/composables/useEvent'
import { patchEvent, performaEvent, useDaftarEvent } from '~/composables/useEvent'
import { apiErrorMessage } from '~/composables/useApi'
import { useRoster } from '~/composables/useRoster'
import { bolehSetujui, bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import type { Compliment, HariBreakdown, PicBonus } from '~/utils/performa-bonus'
import { bonusEvent, pbAgregasi, pbHead } from '~/utils/performa-bonus'
import type { AcaraPfoMkt, BarisPfoMkt } from '~/utils/marketing-performa'
import {
  akuPicPfoMkt, bedaDiakuiPfoMkt, bolehLihatPfoMkt, digitRupiahPfoMkt, gabunganPfoMkt, gabungPfoMkt,
  kontribusiPfoMkt, PER_HAL_PFO_MKT,
} from '~/utils/marketing-performa'
import { tglWIB } from '~/utils/event-hitung'
import { angka, hariIni, rupiah, tglPendek } from '~/utils/format'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const toast = useToast()
const me = useMe()
const { data: roster } = useRoster()
const manajemen = computed(() => bolehSetujui(peranEvent(me.value)))
const bisaUbahNom = computed(() => bolehUbahEvent('events', peranEvent(me.value)))

const bulan = useState('event-pev-bulan', () => hariIni().slice(0, 7))
const rentang = computed(() => {
  const [y, m] = bulan.value.split('-').map(Number)
  return { dari: `${bulan.value}-01`, sampai: `${bulan.value}-${String(new Date(y!, m!, 0).getDate()).padStart(2, '0')}` }
})

interface DataPev { days?: HariBreakdown[], pic?: { id: string, name: string, officeUserId?: string | number | null }[], comps?: Compliment[] }
const { data: kompas, status, error, refresh } = useAsyncData(
  'event-pev',
  () => performaEvent(rentang.value.dari, rentang.value.sampai).then(r => r.data as DataPev),
  { watch: [bulan], default: () => null },
)

// pbAgregasi joins breakdown rows by the KOMPAS pic id, so the list is the kompas roster.
const list = computed<PicBonus[]>(() => (kompas.value?.pic ?? []).map(p => ({
  id: String(p.id), name: p.name, officeUserId: p.officeUserId == null ? undefined : String(p.officeUserId),
})))
const hasil = computed(() => pbAgregasi(kompas.value?.days ?? [], 'event', list.value, kompas.value?.comps ?? []))
const bonus = computed(() => bonusEvent(list.value, hasil.value.agg))

// ---- who may see whom
const ket = (e: PicBonus): string | null => {
  const r = roster.value
  const o = (e.officeUserId ? r.find(x => String(x.id) === String(e.officeUserId)) : undefined)
    ?? r.find(x => x.name.trim().toLowerCase() === e.name.trim().toLowerCase())
  return o ? o.keterangan : null
}
const akuHead = computed(() => !!me.value && (
  pbHead({ id: '', name: me.value.name }, () => me.value?.keterangan ?? null)
  || pbHead({ id: '', name: me.value.name, officeUserId: me.value.id }, ket)))
const bolehSemua = computed(() => akuHead.value || manajemen.value)
const aku = computed(() => akuPicPfoMkt(me.value, list.value))

const pilihan = ref('')
const hal = ref(1)
watch([bulan, pilihan], () => {
  hal.value = 1
})
// THE gate: whatever is asked for, a person who may not see it gets "Semua".
const pid = computed(() => {
  const want = pilihan.value || (!bolehSemua.value && aku.value ? aku.value.id : '__all__')
  return bolehLihatPfoMkt(want, bolehSemua.value, aku.value) ? want : '__all__'
})
const opsiSeg = computed(() => [
  { value: '__all__', label: 'Semua', icon: 'i-lucide-calculator' },
  ...(bolehSemua.value ? list.value : (aku.value ? [aku.value] : [])).map(e => ({ value: e.id, label: e.name })),
])
const seg = computed({
  get: () => pid.value,
  set: (v: string) => {
    pilihan.value = v
  },
})

const a = computed(() => (pid.value === '__all__'
  ? gabunganPfoMkt(list.value, hasil.value.agg, bolehSemua.value)
  : hasil.value.agg[pid.value] ?? { real: 0, events: [], comp: 0, compRows: [] }))

// ---- Daftar Event: this module's events (pevAcaraModul :5220)
const LEWAT = ['Planning', 'Draft', 'Cancelled'] // same as events_hari()
const { data: daftar, refresh: refreshAcara, status: statusAcara } = useDaftarEvent<Acara>('events', {}, 'event-pev-events')

/** First-load skeleton for the three recap cards below: skeleton cells stand
 *  in until both the performance breakdown and the event list land. Refetch
 *  (month change) keeps old numbers, so the cards never blank. */
const statMemuat = computed(() => (!kompas.value || !daftar.value.rows.length)
  && (status.value === 'pending' || status.value === 'idle' || statusAcara.value === 'pending' || statusAcara.value === 'idle'))
const acara = computed<AcaraPfoMkt[]>(() => daftar.value.rows
  .filter(e => !LEWAT.includes(String(e.status)) && tglWIB(e.start_datetime).slice(0, 7) === bulan.value)
  .map((e) => {
    const ada = e.nominal != null && String(e.nominal) !== ''
    // createdById first (the Office id of who entered it), the PIC text only as fallback (pevPicDari :5237).
    return { srcId: `evt:${e.id}`, sumber: 'evt', date: tglWIB(e.start_datetime), name: e.title || '(tanpa nama)',
      picUser: e.createdById ? String(e.createdById) : `nama:${e.pic ?? ''}`, asal: null, nominal: ada ? Number(e.nominal) || 0 : null, timpa: false }
  }))
function picDari(uid: string): PicBonus | null {
  if (!uid) return null
  if (uid.startsWith('nama:')) {
    const nm = uid.slice(5).trim().toLowerCase()
    return nm ? list.value.find(x => x.name.trim().toLowerCase() === nm) ?? null : null
  }
  return list.value.find(x => x.officeUserId != null && String(x.officeUserId) === uid) ?? null
}
const baris = computed(() => gabungPfoMkt(acara.value, a.value.events, pid.value, picDari))
const nDiakui = computed(() => a.value.events.length)
const avg = computed(() => (nDiakui.value ? a.value.real / nDiakui.value : 0))
const belum = computed(() => baris.value.filter(x => !x.bd && !x.hanyaBd).length)
const takCocok = computed(() => acara.value.filter(x => !picDari(x.picUser)).length)
const yatim = computed(() => hasil.value.yatim)
const yatimTotal = computed(() => yatim.value.reduce((s, x) => s + x.amount, 0))
// The Open Bill column only shows when someone has one (a column of Rp0 otherwise).
const totOb = computed(() => a.value.events.reduce((s, x) => s + (Number(x.ob) || 0), 0))

const totalHal = computed(() => Math.max(1, Math.ceil(baris.value.length / PER_HAL_PFO_MKT)))
const kini = computed(() => Math.min(Math.max(1, hal.value), totalHal.value))
const mulai = computed(() => (kini.value - 1) * PER_HAL_PFO_MKT)
const halaman = computed(() => baris.value.slice(mulai.value, mulai.value + PER_HAL_PFO_MKT))
// Date → omset that day, from the RAW payload (two events one day must not double it).
const omsetHari = computed(() => new Map((kompas.value?.days ?? []).map(d => [d.date, Number((d as { omsetHari?: number }).omsetHari) || 0])))
const kontribusi = (r: BarisPfoMkt) => (r.bd ? kontribusiPfoMkt(r.bd, omsetHari.value.get(r.date)) : undefined)
const persen = (n: number) => `${n.toFixed(1).replace('.', ',')}%`

// ---- Nominal (pevSetNominal): empty goes back to EMPTY, never 0.
const nominalTeks = (n: number | null) => (n == null ? '' : angka(n))
async function setNominal(r: BarisPfoMkt, teks: string) {
  const id = r.srcId.split(':').slice(1).join(':')
  const e = daftar.value.rows.find(x => String(x.id) === id)
  if (!e) return
  const digit = digitRupiahPfoMkt(teks)
  try {
    await patchEvent('events', id, { nominal: digit === '' ? null : Number(digit), updatedAt: Date.now() }, daftar.value.versions[id])
    toast.add({ title: digit === '' ? 'Nominal dikosongkan' : 'Nominal disimpan', color: 'success' })
    await refreshAcara()
  }
  catch (err) {
    if (!(await tanganiKonflik(err, refreshAcara))) toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}
</script>

<template>
  <EventGerbang lihat="perfomset">
    <AppPage
      title="Performa omset & bonus"
      description="Omset yang diakui tiap PIC event berikut skema bonusnya"
    >
      <AppPanel class="mb-4">
        <div class="flex flex-wrap items-center gap-3">
          <UFormField label="Periode">
            <UInput
              v-model="bulan"
              type="month"
              class="w-44"
            />
          </UFormField>
          <p class="min-w-0 flex-1 text-sm text-muted">
            Angkanya sama dengan <b>Performa Event</b> di panel Kas Kecil — dihitung berkas yang sama.
          </p>
        </div>
      </AppPanel>

      <div
        v-if="status === 'pending'"
        class="space-y-3"
      >
        <USkeleton class="h-24" />
        <USkeleton class="h-64" />
      </div>
      <UAlert
        v-else-if="error"
        color="error"
        variant="soft"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat: ${apiErrorMessage(error)}`"
        description="Kalau berbunyi soal akses, halaman ini butuh centang modul Event di Kelola Akses Office."
        :actions="[{ label: 'Coba lagi', color: 'neutral', variant: 'outline', onClick: () => { refresh() } }]"
      />

      <div
        v-else-if="kompas"
        class="space-y-4"
      >
        <div class="space-y-2">
          <AppSeg
            v-model="seg"
            :options="opsiSeg"
          />
          <p
            v-if="bolehSemua"
            class="text-sm text-muted"
          >
            <template v-if="akuHead">
              Anda tercatat <b>Head</b> di Tim/Keterangan Office, jadi bisa membuka tiap anggota tim.
            </template>
            <template v-else>
              Anda <b>manajemen / admin modul Event</b>, jadi bisa membuka tiap anggota tim.
            </template>
          </p>
          <p
            v-else-if="aku"
            class="text-sm text-muted"
          >
            Anda bisa membuka <b>capaian sendiri</b> dan <b>rekapan gabungan</b>. Capaian rekan tidak dibuka satu per satu — yang bisa membukanya hanya yang tercatat <b>Head</b> di Tim/Keterangan Office.
          </p>
          <UAlert
            v-else
            color="warning"
            variant="soft"
            title="Akun Anda belum cocok dengan satu pun PIC event"
            description="Yang tampil hanya rekapan gabungan. Perbaikannya di Office: isi kolom Tim/Keterangan dengan Event supaya nama Anda ikut ditarik ke roster PIC."
          />
        </div>

        <UAlert
          v-if="yatim.length"
          color="warning"
          variant="soft"
          icon="i-lucide-user-x"
          :title="`${yatim.length} baris breakdown belum punya PIC${yatimTotal ? ` — total ${rupiah(yatimTotal)}` : ''}`"
          description="Nominalnya tidak diakui untuk siapa pun. Yang membetulkannya Finance, di Omset → Breakdown Sumber."
        />

        <AppStatGrid
          :loading="statMemuat"
          :count="3"
        >
          <AppStat
            label="Realisasi"
            :value="rupiah(a.real)"
            :sub="a.comp ? `sudah dipotong compliment ${rupiah(a.comp)}` : 'tanpa potongan compliment'"
            tone="success"
          />
          <AppStat
            label="Jumlah event"
            :value="baris.length"
            :sub="`${belum ? `${belum} belum diakui finance · ` : ''}avg ${rupiah(avg)}/event yang diakui`"
            tone="info"
          />
          <AppStat
            label="Compliment ditanggung"
            :value="rupiah(a.comp ?? 0)"
            :sub="`${(a.compRows ?? []).length} catatan`"
            tone="warning"
          />
        </AppStatGrid>

        <AppPanel
          title="Daftar event"
          icon="i-lucide-list"
          :count="baris.length"
          flush
        >
          <p class="px-4 pt-3 text-sm text-muted">
            {{ baris.length }} acara menurut modul ini<template v-if="belum">
              · <b>{{ belum }} belum diinput finance</b>
            </template>.
            <b>Nominal</b> milik modul ini dan diketik di sini — modul Event memang tidak menyimpan nilai rupiah event di tempat lain.
            <b>Diakui</b> dibaca dari Finance › Omset › Breakdown Sumber; mengetik Nominal TIDAK mengubahnya. Idealnya keduanya sama.
            <b>Kontribusi hari itu</b> = nilai penuh acara (omset + tax + service<template v-if="totOb">
              + Open Bill
            </template>) dibagi seluruh omset venue pada tanggal itu. Penyebutnya BUKAN kolom Diakui di sebelahnya.
            <template v-if="takCocok">
              <b>{{ takCocok }} acara</b> belum cocok dengan PIC mana pun di roster kompas, jadi hanya muncul di segmen Semua.
            </template>
            <template v-if="totOb">
              Termasuk <b>Open Bill {{ rupiah(totOb) }}</b> yang tidak dipotong dari kasir mana pun.
            </template>
          </p>

          <table class="mt-3 hidden w-full text-sm lg:table">
            <thead class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
              <tr>
                <th class="px-3 py-2">
                  Tanggal
                </th>
                <th class="px-3 py-2">
                  Nama event
                </th>
                <th class="px-3 py-2 text-right">
                  Nominal
                </th>
                <th class="px-3 py-2 text-right">
                  Nilai event
                </th>
                <th
                  v-if="totOb"
                  class="px-3 py-2 text-right"
                >
                  Open bill
                </th>
                <th class="px-3 py-2 text-right">
                  Diakui
                </th>
                <th class="px-3 py-2 text-right">
                  Kontribusi hari itu
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="r in halaman"
                :key="r.srcId + r.date + r.name"
              >
                <td class="px-3 py-2 num">
                  {{ tglPendek(r.date) }}
                </td>
                <td class="px-3 py-2">
                  <span class="font-medium text-highlighted">{{ r.name }}</span>
                  <span
                    v-if="r.bd?.pic"
                    class="text-xs text-muted"
                  > · {{ r.bd.pic }}</span>
                </td>
                <td class="px-3 py-2 text-right">
                  <template v-if="r.hanyaBd">
                    <span class="text-dimmed">—</span>
                    <span class="block text-xs text-muted">hanya ada di Breakdown</span>
                  </template>
                  <template v-else>
                    <UInput
                      v-if="bisaUbahNom"
                      :model-value="nominalTeks(r.nominal)"
                      inputmode="numeric"
                      placeholder="0"
                      size="sm"
                      class="ml-auto w-36"
                      :ui="{ base: 'text-right num' }"
                      @change="setNominal(r, ($event.target as HTMLInputElement).value)"
                    />
                    <span
                      v-else
                      class="num"
                    >{{ r.nominal == null ? '—' : rupiah(r.nominal) }}</span>
                    <span class="block text-xs text-muted">{{ r.nominal == null ? 'belum diisi' : 'diketik di modul ini' }}</span>
                  </template>
                </td>
                <td class="px-3 py-2 text-right num">
                  {{ r.bd ? rupiah(r.bd.amount) : '—' }}
                </td>
                <td
                  v-if="totOb"
                  class="px-3 py-2 text-right num"
                >
                  {{ r.bd?.ob ? rupiah(r.bd.ob) : '—' }}
                </td>
                <td class="px-3 py-2 text-right num">
                  <template v-if="r.bd">
                    {{ rupiah(r.bd.porsi) }}
                    <span
                      v-if="bedaDiakuiPfoMkt(r) === 0"
                      class="block text-xs text-muted"
                    >cocok</span>
                    <span
                      v-else-if="bedaDiakuiPfoMkt(r) != null"
                      class="block text-xs text-error"
                    >beda {{ bedaDiakuiPfoMkt(r)! > 0 ? '+' : '−' }}{{ rupiah(Math.abs(bedaDiakuiPfoMkt(r)!)) }}</span>
                  </template>
                  <template v-else>
                    <span class="text-dimmed">—</span>
                    <span class="block text-xs text-muted">belum diinput finance</span>
                  </template>
                </td>
                <td class="px-3 py-2 text-right num">
                  <span
                    v-if="kontribusi(r) === undefined"
                    class="text-dimmed"
                  >—</span>
                  <span
                    v-else-if="kontribusi(r) === null"
                    class="text-dimmed"
                  >belum ada omset</span>
                  <template v-else>
                    {{ persen(kontribusi(r)!) }}
                    <span class="block text-xs text-muted">dari omset hari itu</span>
                  </template>
                </td>
              </tr>
              <tr v-if="!halaman.length">
                <td
                  :colspan="totOb ? 7 : 6"
                  class="px-3 py-8 text-center text-dimmed"
                >
                  Belum ada acara bulan ini.
                </td>
              </tr>
            </tbody>
          </table>

          <ul class="mt-3 divide-y divide-default lg:hidden">
            <li
              v-for="r in halaman"
              :key="r.srcId + r.date + r.name"
              class="space-y-1.5 px-4 py-3 text-sm"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <b class="block truncate text-highlighted">{{ r.name }}</b>
                  <span class="text-xs text-muted">{{ tglPendek(r.date) }}<template v-if="r.bd?.pic"> · {{ r.bd.pic }}</template></span>
                </div>
                <div class="shrink-0 text-right">
                  <span class="block text-xs text-muted">Diakui</span>
                  <b
                    v-if="r.bd"
                    class="num text-highlighted"
                  >{{ rupiah(r.bd.porsi) }}</b>
                  <span
                    v-else
                    class="text-xs text-dimmed"
                  >belum diinput finance</span>
                </div>
              </div>
              <div
                v-if="!r.hanyaBd"
                class="flex items-center gap-2"
              >
                <span class="text-xs text-muted">Nominal</span>
                <UInput
                  v-if="bisaUbahNom"
                  :model-value="nominalTeks(r.nominal)"
                  inputmode="numeric"
                  placeholder="0"
                  size="sm"
                  class="w-36"
                  @change="setNominal(r, ($event.target as HTMLInputElement).value)"
                />
                <span
                  v-else
                  class="num"
                >{{ r.nominal == null ? '—' : rupiah(r.nominal) }}</span>
              </div>
              <p class="text-xs text-muted">
                <template v-if="r.hanyaBd">
                  hanya ada di Breakdown ·
                </template>
                <template v-if="r.bd">
                  nilai event {{ rupiah(r.bd.amount) }}<template v-if="r.bd.ob">
                    · open bill {{ rupiah(r.bd.ob) }}
                  </template>
                  · {{ kontribusi(r) == null ? 'belum ada omset' : `${persen(kontribusi(r)!)} dari omset hari itu` }}
                </template>
              </p>
            </li>
            <li
              v-if="!halaman.length"
              class="px-4 py-8 text-center text-sm text-dimmed"
            >
              Belum ada acara bulan ini.
            </li>
          </ul>

          <div
            v-if="totalHal > 1"
            class="flex flex-wrap items-center justify-between gap-2 border-t border-default px-4 py-2.5 text-sm text-muted"
          >
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-chevron-left"
              label="Sebelumnya"
              :disabled="kini <= 1"
              @click="hal = kini - 1"
            />
            <span class="num text-xs">Baris {{ mulai + 1 }}–{{ Math.min(mulai + PER_HAL_PFO_MKT, baris.length) }} dari {{ baris.length }} · halaman {{ kini }}/{{ totalHal }}</span>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              trailing-icon="i-lucide-chevron-right"
              label="Berikutnya"
              :disabled="kini >= totalHal"
              @click="hal = kini + 1"
            />
          </div>
        </AppPanel>

        <EventBonusSkema
          :info="bonus"
          :pid="pid"
          :list="list"
        />
      </div>
    </AppPage>
  </EventGerbang>
</template>
