<!--
  Marketing › Performa Omset & Bonus (docs/migrasi/marketing.md D.12, F.17,
  issue #63; old deploy/marketing/index.html:14483-14990).

  Recognised turnover per PIC plus the four bonus schemes. Every number is
  computed by `performa-bonus.ts` (pbAgregasi, bonusMarketing) — the same
  engine as Finance › Kas Kecil › Performa Marketing — never a copy (F.17).
  Data: GET /kompas/performa/marketing. The Daftar Event list is built from
  THIS module (closing events + Assisted VIP) and joined with the breakdown
  rows by srcId, so events Finance has not entered yet still show ("belum
  diinput finance"). Nominal belongs to this module and is editable here
  (event → `nominalDiakui`, VIP → `nominal`); Diakui stays Finance's.

  Who sees whom: Head (whole word in Office Tim/Keterangan) or module admin see
  every PIC; others see "Semua" + themselves. The gate sits in `tampil`, not in
  the buttons.
-->
<script setup lang="ts">
import type { EventMkt } from '~/utils/marketing'
import type { PicBonus, Compliment, HariBreakdown } from '~/utils/performa-bonus'
import { bonusMarketing, pbAgregasi, pbHead } from '~/utils/performa-bonus'
import type { BarisPfoMkt, VipPfo } from '~/utils/marketing-performa'
import {
  acaraPfoMkt, akuPicPfoMkt, bedaDiakuiPfoMkt, bolehLihatPfoMkt, digitRupiahPfoMkt, gabunganPfoMkt, gabungPfoMkt,
  ketDariUsersPfoMkt, kontribusiPfoMkt, PER_HAL_PFO_MKT, picDariPfoMkt,
} from '~/utils/marketing-performa'
import { apiErrorMessage } from '~/composables/useApi'
import { useRoster } from '~/composables/useRoster'
import { angka, hariIni, rupiah, tglPendek } from '~/utils/format'

definePageMeta({ access: ['marketing'] })

const me = useMe()
const { data: st } = useStateMkt()
const { saya, can } = useAksesMkt()
const { data: roster } = useRoster()

const bulan = useState('mkt-pfo-bulan', () => hariIni().slice(0, 7))
const rentang = computed(() => {
  const [y, m] = bulan.value.split('-').map(Number)
  return { dari: `${bulan.value}-01`, sampai: `${bulan.value}-${String(new Date(y!, m!, 0).getDate()).padStart(2, '0')}` }
})

const { data: kompas, status, error, refresh } = useAsyncData(
  'mkt-pfo',
  () => getPerformaMkt(rentang.value.dari, rentang.value.sampai),
  { watch: [bulan], default: () => null },
)
// First-load skeleton for the stat cards: while the Kompas payload is absent
// the grid shows placeholders; later refetches keep the old cards on screen.
const statMemuat = computed(() => !kompas.value && (status.value === 'pending' || status.value === 'idle'))

// pbAgregasi joins breakdown rows by the KOMPAS pic id, so the list is the kompas roster.
const list = computed<PicBonus[]>(() => (kompas.value?.pic ?? []).map(p => ({
  id: String(p.id), name: p.name, officeUserId: p.officeUserId == null ? undefined : String(p.officeUserId),
})))
const hasil = computed(() => pbAgregasi(
  (kompas.value?.days ?? []) as unknown as HariBreakdown[], 'marketing', list.value, (kompas.value?.comps ?? []) as Compliment[],
))

// Office Tim/Keterangan for the Head word: the live Office roster first, the
// module's synced users (old pfoPasangKeterangan) as fallback.
const ketUsers = computed(() => ketDariUsersPfoMkt(st.value.users))
const ket = (e: PicBonus): string | null => {
  const r = roster.value
  const o = (e.officeUserId ? r.find(x => String(x.id) === String(e.officeUserId)) : undefined)
    ?? r.find(x => x.name.trim().toLowerCase() === e.name.trim().toLowerCase())
  return o ? o.keterangan : ketUsers.value(e)
}
const bonus = computed(() => bonusMarketing(list.value, hasil.value.agg, ket))

// ---- who may see whom (pfoAkuHead / pfoAdminModul / pfoBolehSemua)
// One word, one rule (pbHead): my own Office Tim/Keterangan first, the roster mapping as fallback.
const akuHead = computed(() => !!me.value && (
  pbHead({ id: '', name: me.value.name }, () => me.value?.keterangan ?? null)
  || pbHead({ id: '', name: me.value.name, officeUserId: me.value.id }, ket)))
const adminModul = computed(() => isAdminOf(me.value, 'marketing') || saya.value?.user.role === 'super_admin')
const bolehSemua = computed(() => akuHead.value || adminModul.value)
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

// ---- Daftar Event
const acara = computed(() => acaraPfoMkt(st.value.events, st.value.vip as unknown as VipPfo[], st.value.clients, st.value.settings, bulan.value))
const picDari = (uid: string) => picDariPfoMkt(uid, list.value, st.value.users)
const baris = computed(() => gabungPfoMkt(acara.value, a.value.events, pid.value, picDari))
const nDiakui = computed(() => a.value.events.length)
const avg = computed(() => (nDiakui.value ? a.value.real / nDiakui.value : 0))
const belum = computed(() => baris.value.filter(x => !x.bd && !x.hanyaBd).length)
const takCocok = computed(() => acara.value.filter(x => !picDari(x.picUser)).length)
const yatim = computed(() => hasil.value.yatim)
const yatimTotal = computed(() => yatim.value.reduce((s, x) => s + x.amount, 0))

const totalHal = computed(() => Math.max(1, Math.ceil(baris.value.length / PER_HAL_PFO_MKT)))
const kini = computed(() => Math.min(Math.max(1, hal.value), totalHal.value))
const mulai = computed(() => (kini.value - 1) * PER_HAL_PFO_MKT)
const halaman = computed(() => baris.value.slice(mulai.value, mulai.value + PER_HAL_PFO_MKT))
// Date → omset that day, from the RAW payload (two events one day must not double it).
const omsetHari = computed(() => new Map((kompas.value?.days ?? []).map(d => [d.date, Number(d.omsetHari) || 0])))
const kontribusi = (r: BarisPfoMkt) => (r.bd ? kontribusiPfoMkt(r.bd, omsetHari.value.get(r.date)) : undefined)

// ---- editing Nominal (pfoSetNominal): permission follows the source data.
const bisaUbah = (r: BarisPfoMkt) => !r.hanyaBd && (r.sumber === 'vip' ? can('edit_vip') : can('edit_event'))
const nominalTeks = (n: number | null) => (n == null ? '' : angka(n))
async function setNominal(r: BarisPfoMkt, teks: string) {
  const digit = digitRupiahPfoMkt(teks)
  const [jenis, ...rest] = r.srcId.split(':')
  const id = rest.join(':')
  if (jenis === 'vip') {
    const v = (st.value.vip as unknown as (VipPfo & { updatedAt?: number })[]).find(x => String(x.id) === id)
    if (!v) return
    await mktSimpan(() => tambalMkt('vip', id, { nominal: digit === '' ? '' : Number(digit) }, v.updatedAt), 'Nominal disimpan',
      { refType: 'vip', refId: id, action: 'Nominal VIP diubah dari Performa', detail: digit === '' ? 'dikosongkan' : rupiah(Number(digit)) })
  }
  else if (jenis === 'mkt') {
    const e = st.value.events.find(x => String(x.id) === id)
    if (!e) return
    // Empty = back to the offer's grand total: the override is removed (null), never 0.
    await mktSimpan(() => tambalMkt<EventMkt & { nominalDiakui?: number | null }>('events', id, { nominalDiakui: digit === '' ? null : Number(digit) }, e.updatedAt),
      digit === '' ? 'Nominal dipulihkan' : 'Nominal disimpan',
      { refType: 'event', refId: id, action: 'Nominal diakui diubah dari Performa', detail: digit === '' ? 'dipulihkan ke grand total' : rupiah(Number(digit)) })
  }
}
</script>

<template>
  <AppPage
    title="Performa omset & bonus"
    description="Omset yang diakui tiap PIC berikut skema bonusnya — angkanya sama dengan panel Finance."
  >
    <MarketingGerbang layar="perfomset">
      <AppPanel>
        <div class="flex flex-wrap items-center gap-3">
          <UFormField label="Periode">
            <AppBulan
              v-model="bulan"
              class="w-44"
            />
          </UFormField>
          <p class="min-w-0 flex-1 text-base text-muted">
            Angkanya sama dengan <b>Performa Marketing</b> di panel Kas Kecil — dihitung oleh berkas yang sama.
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
        description="Kalau berbunyi soal akses, halaman ini butuh centang modul Marketing di Kelola Akses Office."
        :actions="[{ label: 'Coba lagi', color: 'neutral', variant: 'outline', onClick: () => { refresh() } }]"
      />

      <template v-else-if="kompas">
        <div class="mb-5 space-y-3">
          <AppSeg
            v-model="seg"
            :options="opsiSeg"
          />
          <p
            v-if="bolehSemua"
            class="text-base text-muted"
          >
            <template v-if="akuHead">
              Anda tercatat <b>Head</b> di Tim/Keterangan Office, jadi bisa membuka tiap anggota tim.
            </template>
            <template v-else>
              Anda <b>admin modul Marketing</b>, jadi bisa membuka tiap anggota tim.
            </template>
          </p>
          <p
            v-else-if="aku"
            class="text-base text-muted"
          >
            Anda bisa membuka <b>capaian sendiri</b> dan <b>rekapan gabungan</b>. Capaian rekan tidak dibuka satu per satu — yang bisa membukanya hanya yang tercatat <b>Head</b> di Tim/Keterangan Office.
          </p>
          <UAlert
            v-else
            color="warning"
            variant="soft"
            title="Akun Anda belum cocok dengan satu pun PIC marketing"
            description="Yang tampil hanya rekapan gabungan. Perbaikannya di Office: isi kolom Tim/Keterangan dengan Marketing supaya nama Anda ikut ditarik ke roster PIC."
          />
        </div>

        <UAlert
          v-if="yatim.length"
          color="warning"
          variant="soft"
          icon="i-lucide-user-x"
          class="mb-5"
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
          <p class="px-4 pt-3 text-base text-muted">
            {{ baris.length }} acara menurut modul ini (event closing + Reservasi VIP Assisted)<template v-if="belum">
              · <b>{{ belum }} belum diinput finance</b>
            </template>.
            <b>Nominal</b> milik modul ini — grand total Surat Penawaran, atau kolom Nominal untuk Reservasi VIP — dan boleh disunting di sini.
            <b>Diakui</b> dibaca dari Finance › Omset › Breakdown Sumber; menyunting Nominal TIDAK mengubahnya, finance yang menariknya lewat tombol “salin ke kolom” di sana. Idealnya keduanya sama.
            <b>Kontribusi hari itu</b> = nilai acara dibagi seluruh omset venue pada tanggal itu.
            <template v-if="takCocok">
              <b>{{ takCocok }} acara</b> belum cocok dengan PIC mana pun di roster kompas, jadi hanya muncul di segmen Semua.
            </template>
          </p>

          <table class="mt-3 hidden w-full text-base lg:table">
            <thead class="bg-table-head text-left text-sm font-bold uppercase tracking-wide text-table-head-text">
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
                  Omset
                </th>
                <th class="px-3 py-2 text-right">
                  Tax
                </th>
                <th class="px-3 py-2 text-right">
                  Service
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
                    class="text-sm text-muted"
                  > · {{ r.bd.pic }}</span>
                </td>
                <td class="px-3 py-2 text-right">
                  <template v-if="r.hanyaBd">
                    <span class="text-dimmed">—</span>
                    <span class="block text-sm text-muted">hanya ada di Breakdown</span>
                  </template>
                  <template v-else>
                    <UInput
                      v-if="bisaUbah(r)"
                      :model-value="nominalTeks(r.nominal)"
                      inputmode="numeric"
                      class="ml-auto w-40"
                      :ui="{ base: 'text-right num' }"
                      @change="setNominal(r, ($event.target as HTMLInputElement).value)"
                    />
                    <span
                      v-else
                      class="num"
                    >{{ rupiah(r.nominal) }}</span>
                    <span class="block text-sm text-muted">
                      <template v-if="r.timpa">
                        diubah manual · asalnya {{ rupiah(r.asal) }} ·
                        <UButton
                          v-if="bisaUbah(r)"
                          variant="link"
                          size="xs"
                          class="p-0"
                          label="pulihkan"
                          loading-auto
                          @click="setNominal(r, '')"
                        />
                      </template>
                      <template v-else>{{ r.sumber === 'vip' ? 'kolom Nominal reservasi' : 'grand total Surat Penawaran' }}</template>
                    </span>
                  </template>
                </td>
                <td class="px-3 py-2 text-right num">
                  {{ r.bd ? rupiah(r.bd.amount) : '—' }}
                </td>
                <td class="px-3 py-2 text-right num">
                  {{ r.bd ? rupiah(r.bd.tax) : '—' }}
                </td>
                <td class="px-3 py-2 text-right num">
                  {{ r.bd ? rupiah(r.bd.service) : '—' }}
                </td>
                <td class="px-3 py-2 text-right num">
                  <template v-if="r.bd">
                    {{ rupiah(r.bd.porsi) }}
                    <span
                      v-if="bedaDiakuiPfoMkt(r) === 0"
                      class="block text-sm text-muted"
                    >cocok</span>
                    <span
                      v-else-if="bedaDiakuiPfoMkt(r) != null"
                      class="block text-sm text-error"
                    >beda {{ bedaDiakuiPfoMkt(r)! > 0 ? '+' : '−' }}{{ rupiah(Math.abs(bedaDiakuiPfoMkt(r)!)) }}</span>
                  </template>
                  <template v-else>
                    <span class="text-dimmed">—</span>
                    <span class="block text-sm text-muted">belum diinput finance</span>
                  </template>
                </td>
                <td class="px-3 py-2 text-right num">
                  <template v-if="kontribusi(r) === undefined">
                    <span class="text-dimmed">—</span>
                  </template>
                  <span
                    v-else-if="kontribusi(r) === null"
                    class="text-dimmed"
                  >belum ada omset</span>
                  <template v-else>
                    {{ kontribusi(r)!.toFixed(1).replace('.', ',') }}%
                    <span class="block text-sm text-muted">dari omset hari itu</span>
                  </template>
                </td>
              </tr>
              <tr v-if="!halaman.length">
                <td
                  colspan="8"
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
              class="space-y-1.5 px-4 py-3 text-base"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <b class="block truncate text-highlighted">{{ r.name }}</b>
                  <span class="text-sm text-muted">{{ tglPendek(r.date) }}<template v-if="r.bd?.pic"> · {{ r.bd.pic }}</template></span>
                </div>
                <div class="shrink-0 text-right">
                  <span class="block text-sm text-muted">Diakui</span>
                  <b
                    v-if="r.bd"
                    class="num text-highlighted"
                  >{{ rupiah(r.bd.porsi) }}</b>
                  <span
                    v-else
                    class="text-sm text-dimmed"
                  >belum diinput finance</span>
                </div>
              </div>
              <div
                v-if="!r.hanyaBd"
                class="flex items-center gap-2"
              >
                <span class="text-sm text-muted">Nominal</span>
                <UInput
                  v-if="bisaUbah(r)"
                  :model-value="nominalTeks(r.nominal)"
                  inputmode="numeric"
                  size="sm"
                  class="w-36"
                  @change="setNominal(r, ($event.target as HTMLInputElement).value)"
                />
                <span
                  v-else
                  class="num"
                >{{ rupiah(r.nominal) }}</span>
                <UButton
                  v-if="r.timpa && bisaUbah(r)"
                  variant="link"
                  size="xs"
                  label="pulihkan"
                  loading-auto
                  @click="setNominal(r, '')"
                />
              </div>
              <p class="text-sm text-muted">
                <template v-if="r.hanyaBd">
                  hanya ada di Breakdown ·
                </template>
                <template v-if="r.bd">
                  omset {{ rupiah(r.bd.amount) }} · tax {{ rupiah(r.bd.tax) }} · service {{ rupiah(r.bd.service) }}
                  <template v-if="bedaDiakuiPfoMkt(r) === 0">
                    · cocok
                  </template>
                  <span
                    v-else-if="bedaDiakuiPfoMkt(r) != null"
                    class="text-error"
                  > · beda {{ bedaDiakuiPfoMkt(r)! > 0 ? '+' : '−' }}{{ rupiah(Math.abs(bedaDiakuiPfoMkt(r)!)) }}</span>
                  · {{ kontribusi(r) == null ? 'belum ada omset' : `${kontribusi(r)!.toFixed(1).replace('.', ',')}% dari omset hari itu` }}
                </template>
              </p>
            </li>
            <li
              v-if="!halaman.length"
              class="px-4 py-8 text-center text-base text-dimmed"
            >
              Belum ada acara bulan ini.
            </li>
          </ul>

          <div
            v-if="totalHal > 1"
            class="flex flex-wrap items-center justify-between gap-2 border-t border-default px-4 py-2.5 text-base text-muted"
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
            <span class="num text-sm">Baris {{ mulai + 1 }}–{{ Math.min(mulai + PER_HAL_PFO_MKT, baris.length) }} dari {{ baris.length }} · halaman {{ kini }}/{{ totalHal }}</span>
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

        <MarketingBonusSkema
          :info="bonus"
          :pid="pid"
          :real="a.real"
          :list="list"
        />
      </template>
    </MarketingGerbang>
  </AppPage>
</template>
