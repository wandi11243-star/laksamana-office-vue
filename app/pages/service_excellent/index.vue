<!--
  Dashboard (capaian) — the Service Excellent home screen and its own panel
  entry (`capaian` → /service_excellent). Team achievement for the shared
  period, the reward board (DISPLAY ONLY, T-19: nothing here writes money
  anywhere), per-crew results, and the per-name target form.

  Office and System Admins run the module, they are not scored: they leave
  the board AFTER the numbers are complete, and what they took is written
  under the table so the cards above stay explainable (F17). Only
  DIVISI_REVIEW is scored (F18). The board is identical for every reader.
  Source: laksamana-office/deploy/service_excellent/index.html:9306-9509,
  reward :7614-7714, targets :7802-7810 + :8634-8678.
-->
<script setup lang="ts">
import { listReservations, postAudit, useSectionVersi } from '~/composables/useReservasi'
import type { ReviewCfg } from '~/composables/useServiceExcellent'
import { useFeedbacks, usePeriodeReview, useReviews, useSeCrew } from '~/composables/useServiceExcellent'
import { useRoster } from '~/composables/useRoster'
import { apiErrorMessage } from '~/composables/useApi'
import { tanganiKonflik, versiDari } from '~/utils/versi'
import { bolehAksiSe, bolehBukaSe, tingkatSe } from '~/utils/layar/service_excellent'
import {
  DIVISI_REVIEW, dalamRentang, keluarDariPapan,
  kruTersaring, labelRentang, layakDiminta, normalisasiReward, rekapCapaian,
  rentangReview, targetTim, targetUntuk, tsDiminta,
} from '~/utils/service-excellent'
import { normPhone } from '~/utils/dp-reservasi'
import { angka, tglPendek, rupiah } from '~/utils/format'

definePageMeta({ access: ['service_excellent'] })

muatPeranSE()

const me = useMe()
const toast = useToast()
const tingkat = computed(() => tingkatSe(me.value))

const periode = usePeriodeReview()
const rentang = computed(() => rentangReview(periode.value.mode, periode.value.date, periode.value.month))
const labelPeriode = computed(() => labelRentang(
  periode.value.mode, rentang.value,
  t => t, tglPendek,
  new Date(`${periode.value.month}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
))

const { data: reviews } = useReviews()
const { data: feedbacks } = useFeedbacks()
const cfgSec = useSectionVersi<ReviewCfg>('reviewCfg')
const cfg = computed(() => cfgSec.data.value?.data)
const aturan = computed(() => normalisasiReward({
  min: (cfg.value as { reward?: { min?: unknown } })?.reward?.min,
  tiers: (cfg.value as { reward?: { tiers?: unknown } })?.reward?.tiers,
}))
const targets = computed(() => (cfg.value as { targets?: Record<string, number> })?.targets)
const targetTimBulan = computed(() => targetTim(targets.value))

const { data: crew } = useSeCrew()
const { data: roster, status: statusRoster } = useRoster()

const { data: reservasi } = useAsyncData(
  'se-capaian-reservasi',
  () => listReservations(rentang.value.from, rentang.value.to).then(r => r.data),
  { watch: [rentang], default: () => [] },
)

// --- crew --------------------------------------------------------------------------
// Office roster first (it carries the team), module crew as fallback — so the
// board is never empty. Name-keyed: a review stores the host name as written.

const divisiDariNama = (nama: string): string => {
  const k = String(nama || '').trim().toLowerCase()
  if (!k) return ''
  const r = (roster.value ?? []).find(u => String(u.name || '').trim().toLowerCase() === k)
  if (r) return String(r.keterangan || '')
  return String((crew.value ?? []).find(u => String(u.name || '').trim().toLowerCase() === k)?.divisi || '')
}

const tingkatDariNama = (nama: string): string => {
  const k = String(nama || '').trim().toLowerCase()
  if (!k) return ''
  return String((crew.value ?? []).find(u => String(u.name || '').trim().toLowerCase() === k)?.role || '')
}

const kruCapaian = computed(() => {
  const src = (roster.value ?? []).length
    ? (roster.value ?? []).map(u => ({ nama: String(u.name || '').trim(), divisi: String(u.keterangan || '') }))
    : (crew.value ?? []).map(u => ({ nama: String(u.name || '').trim(), divisi: String(u.divisi || '') }))
  const { dipakai, tersembunyi } = kruTersaring(src.filter(u => u.nama), DIVISI_REVIEW)
  return {
    nama: dipakai.map(u => u.nama),
    tersembunyi,
    dariRoster: (roster.value ?? []).length > 0,
  }
})

// --- numbers -------------------------------------------------------------------------

const rvRange = computed(() => (reviews.value ?? []).filter(x => dalamRentang(x.date, rentang.value)))
const fbRange = computed(() => (feedbacks.value ?? []).filter(x => dalamRentang(x.date, rentang.value)))

const sah = computed(() => rvRange.value.filter(x => x.status === 'terverifikasi'))
const klaim = computed(() => rvRange.value.filter(x => x.status === 'diklaim'))
const tolak = computed(() => rvRange.value.filter(x => x.status === 'ditolak'))
const diminta = computed(() => rvRange.value.filter(x => tsDiminta(x) > 0))
const fbSelesai = computed(() => fbRange.value.filter(x => x.status === 'selesai').length)

const target = computed(() => layakDiminta(
  (reservasi.value ?? []),
  rentang.value,
  new Set((reviews.value ?? []).map(x => x.resId).filter(Boolean)),
  normPhone,
))
const cakupan = computed(() => target.value.layak.length
  ? Math.round(target.value.sudah.length / target.value.layak.length * 100)
  : 0)

const pctTim = computed(() => targetTimBulan.value
  ? Math.min(100, Math.round(sah.value.length / targetTimBulan.value * 100))
  : 0)

const semuaBaris = computed(() => rekapCapaian({
  kru: kruCapaian.value.nama,
  diminta: diminta.value,
  diklaim: klaim.value,
  sah: sah.value,
  ditolak: tolak.value,
  feedback: fbRange.value,
  targets: targets.value,
  aturan: aturan.value,
}))

const baris = computed(() => semuaBaris.value.filter(o => !keluarDariPapan(divisiDariNama(o.nama), tingkatDariNama(o.nama))))
const tersembunyi = computed(() => semuaBaris.value.filter(o => keluarDariPapan(divisiDariNama(o.nama), tingkatDariNama(o.nama))))
const sahSembunyi = computed(() => tersembunyi.value.reduce((a, o) => a + o.sah, 0))
const fbSembunyi = computed(() => tersembunyi.value.reduce((a, o) => a + o.fb, 0))

/** The reward total counts VISIBLE rows only: office never earns a tier (F17). */
const totalBonus = computed(() => baris.value.reduce((a, o) => a + o.reward.bonus, 0))
const kruDapat = computed(() => baris.value.filter(o => o.reward.bonus > 0).length)
const lolosBelum = computed(() => baris.value.filter(o => o.reward.layak && !o.reward.bonus).length)
const belumLayak = computed(() => baris.value.filter(o => !o.reward.layak).length)

const tangga = computed(() => aturan.value.tiers.map(t => ({
  ...t,
  sampai: baris.value.filter(o => o.reward.bonus > 0 && o.reward.tier?.rv === t.rv).length,
  menuju: baris.value.filter(o => o.reward.berikut?.rv === t.rv).length,
})))

// --- targets ---------------------------------------------------------------------------
// Per name, per month; 0/empty = not scored. The team target follows by itself.

const bolehAtur = computed(() => bolehAksiSe('master', tingkat.value))
const sheetTarget = ref(false)
const targetForm = reactive<Record<string, number>>({})

const hostTarget = computed(() => {
  const src = (crew.value ?? []).length ? (crew.value ?? []) : (roster.value ?? []).map(u => ({ name: u.name, divisi: u.keterangan }))
  return kruTersaring(
    src.map(u => ({ nama: String(u.name || '').trim(), divisi: String((u as { divisi?: string }).divisi ?? (u as { keterangan?: string }).keterangan ?? '') })),
    DIVISI_REVIEW,
  ).dipakai.map(u => u.nama).filter((v, i, a) => v && a.indexOf(v) === i).sort((a, b) => a.localeCompare(b))
})

function bukaTarget() {
  for (const n of hostTarget.value) targetForm[n] = targetUntuk(targets.value, n)
  sheetTarget.value = true
}

const totalTargetForm = computed(() => Object.values(targetForm).reduce((a, v) => a + Math.max(0, Number(v) || 0), 0))

async function simpanTarget() {
  const t: Record<string, number> = {}
  for (const [n, v] of Object.entries(targetForm)) {
    const x = Math.max(0, Number(v) || 0)
    if (x > 0) t[n] = x
  }
  try {
    const lama = cfg.value
    const next: ReviewCfg = {
      link: lama?.link || '',
      waAktif: lama?.waAktif,
      target: Object.values(t).reduce((a, v) => a + v, 0),
      targets: t,
      counts: (lama?.counts ?? {}) as ReviewCfg['counts'],
      reward: normalisasiReward({
        min: (lama as { reward?: { min?: unknown } })?.reward?.min,
        tiers: (lama as { reward?: { tiers?: unknown } })?.reward?.tiers,
      }),
    }
    await putSection('reviewCfg', next, versiDari(cfgSec.data.value))
    await cfgSec.refresh()
    await postAudit({ action: 'Google Review', detail: `Target diperbarui: ${Object.keys(t).length} host, tim otomatis ${next.target}/bulan` })
    sheetTarget.value = false
    toast.add({ title: 'Target disimpan', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => cfgSec.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <AppPage
    title="Service Excellent"
    description="Pencapaian tim, review Google, dan feedback tamu."
  >
    <template v-if="bolehBukaSe('capaian', tingkat)">
      <div class="mb-5 flex flex-wrap items-end gap-2">
        <div class="flex gap-2">
          <UButton
            label="Harian"
            color="neutral"
            :variant="periode.mode === 'hari' ? 'soft' : 'ghost'"
            size="sm"
            @click="periode.mode = 'hari'"
          />
          <UButton
            label="Mingguan"
            color="neutral"
            :variant="periode.mode === 'minggu' ? 'soft' : 'ghost'"
            size="sm"
            @click="periode.mode = 'minggu'"
          />
          <UButton
            label="Bulanan"
            color="neutral"
            :variant="periode.mode === 'bulan' ? 'soft' : 'ghost'"
            size="sm"
            @click="periode.mode = 'bulan'"
          />
        </div>
        <UFormField
          v-if="periode.mode === 'bulan'"
          label="Bulan"
          class="max-w-44"
        >
          <UInput
            v-model="periode.month"
            type="month"
            class="w-full"
          />
        </UFormField>
        <UFormField
          v-else
          label="Tanggal acuan"
          class="max-w-44"
        >
          <UInput
            v-model="periode.date"
            type="date"
            class="w-full"
          />
        </UFormField>
        <span class="pb-2 text-sm text-muted">
          {{ kruCapaian.nama.length }} kru{{ kruCapaian.dariRoster ? ' (seluruh tim)' : ' (kru modul — roster Office belum termuat)' }} · target tim {{ targetTimBulan || 'belum diatur' }}
        </span>
        <div class="ms-auto">
          <UButton
            v-if="bolehAtur"
            label="Atur target"
            color="neutral"
            variant="soft"
            size="sm"
            @click="bukaTarget"
          />
        </div>
      </div>

      <div class="mb-7 max-w-xl">
        <AppFocus
          label="Pencapaian tim"
          :value="`${angka(targetTimBulan ? pctTim : 0)}%`"
          :hint="targetTimBulan ? (sah.length >= targetTimBulan ? 'target tim tercapai' : `kurang ${angka(targetTimBulan - sah.length)} review lagi · ${labelPeriode}`) : `target tim belum diatur · ${labelPeriode}`"
        />
      </div>

      <div class="mb-5">
        <div class="h-2 overflow-hidden rounded bg-muted">
          <div
            class="h-full rounded bg-primary"
            :style="{ width: `${targetTimBulan ? pctTim : 0}%` }"
          />
        </div>
      </div>

      <AppList :title="`Pencapaian tim — ${labelPeriode}`">
        <AppListRow
          title="Diminta"
          description="ajakan terkirim"
          icon="i-lucide-send"
        >
          <template #trailing>
            {{ angka(diminta.length) }}
          </template>
        </AppListRow>
        <AppListRow
          title="Perlu verifikasi"
          description="tamu sudah klaim"
          icon="i-lucide-hourglass"
        >
          <template #trailing>
            {{ angka(klaim.length) }}
          </template>
        </AppListRow>
        <AppListRow
          title="Terverifikasi"
          description="sah dihitung"
          icon="i-lucide-check"
        >
          <template #trailing>
            {{ angka(sah.length) }}
          </template>
        </AppListRow>
        <AppListRow
          title="Ditolak"
          description="tak ada di Google"
          icon="i-lucide-x"
        >
          <template #trailing>
            {{ angka(tolak.length) }}
          </template>
        </AppListRow>
        <AppListRow
          title="Cakupan tamu"
          :description="`${angka(target.sudah.length)} dari ${angka(target.layak.length)} ber-nomor`"
          icon="i-lucide-scan"
        >
          <template #trailing>
            {{ angka(cakupan) }}%
          </template>
        </AppListRow>
        <AppListRow
          title="Feedback"
          :description="`${angka(fbSelesai)} selesai ditangani`"
          icon="i-lucide-messages-square"
        >
          <template #trailing>
            {{ angka(fbRange.length) }}
          </template>
        </AppListRow>
        <AppListRow
          title="Total reward"
          :description="`${angka(kruDapat)} kru mencapai tangga bonus · hanya tampilan`"
          icon="i-lucide-award"
        >
          <template #trailing>
            {{ rupiah(totalBonus) }}
          </template>
        </AppListRow>
      </AppList>

      <AppList title="Reward review">
        <p class="px-4 pt-3 text-sm text-muted">
          {{ labelPeriode }} · dari review terverifikasi. Dibayar <b>satu tangga tertinggi</b> yang dilewati, bukan dijumlahkan.
          Syarat minimal <b>{{ aturan.min }} review</b> menang atas tangga.
        </p>
        <AppListRow
          title="Total cair"
          :description="`${angka(kruDapat)} kru mencapai tangga`"
          icon="i-lucide-banknote"
        >
          <template #trailing>
            {{ rupiah(totalBonus) }}
          </template>
        </AppListRow>
        <AppListRow
          title="Syarat minimal"
          description="di bawah ini belum dibayar"
          icon="i-lucide-target"
        >
          <template #trailing>
            {{ angka(aturan.min) }} review
          </template>
        </AppListRow>
        <AppListRow
          title="Lolos, belum bertangga"
          :description="`sudah ≥ ${angka(aturan.min)} tapi belum ${angka(aturan.tiers[0]?.rv ?? 0)}`"
          icon="i-lucide-hourglass"
        >
          <template #trailing>
            {{ angka(lolosBelum) }}
          </template>
        </AppListRow>
        <AppListRow
          title="Belum memenuhi"
          :description="`dari ${angka(baris.length)} kru`"
          icon="i-lucide-trending-down"
        >
          <template #trailing>
            {{ angka(belumLayak) }}
          </template>
        </AppListRow>
        <div
          v-if="tangga.length"
          class="mb-7 hidden overflow-hidden rounded-2xl bg-default lg:block"
        >
          <UTable
            :data="tangga"
            :columns="[{ accessorKey: 'rv', header: 'Tangga' }, { accessorKey: 'bonus', header: 'Bonus' }, { accessorKey: 'sampai', header: 'Sudah sampai' }, { accessorKey: 'menuju', header: 'Sedang menuju' }, { accessorKey: 'subtotal', header: 'Subtotal' }]"
          >
            <template #rv-cell="{ row }">
              <b class="num">{{ row.original.rv }}</b> review
            </template>
            <template #bonus-cell="{ row }">
              {{ rupiah(row.original.bonus) }}
            </template>
            <template #sampai-cell="{ row }">
              {{ row.original.sampai ? `${row.original.sampai} kru` : '—' }}
            </template>
            <template #menuju-cell="{ row }">
              {{ row.original.menuju ? `${row.original.menuju} kru` : '—' }}
            </template>
            <template #subtotal-cell="{ row }">
              {{ row.original.sampai ? rupiah(row.original.sampai * row.original.bonus) : '—' }}
            </template>
          </UTable>
        </div>
        <p
          v-else
          class="px-4 py-3 text-muted"
        >
          Belum ada tangga bonus yang disetel.{{ bolehAtur ? ' Atur di Setelan.' : '' }}
        </p>
      </AppList>

      <AppList title="Perolehan per kru">
        <div class="mb-7 hidden overflow-hidden rounded-2xl bg-default lg:block">
          <UTable
            :data="baris"
            :columns="[{ accessorKey: 'nama', header: 'Kru' }, { accessorKey: 'minta', header: 'Diminta' }, { accessorKey: 'klaim', header: 'Diklaim' }, { accessorKey: 'sah', header: 'Terverifikasi' }, { accessorKey: 'tolak', header: 'Ditolak' }, { accessorKey: 'fb', header: 'Feedback' }, { accessorKey: 'target', header: 'Target' }, { accessorKey: 'pct', header: 'Capaian' }, { accessorKey: 'reward', header: 'Reward' }]"
          >
            <template #minta-cell="{ row }">
              {{ row.original.minta || '—' }}
            </template>
            <template #klaim-cell="{ row }">
              {{ row.original.klaim || '—' }}
            </template>
            <template #sah-cell="{ row }">
              <b class="num">{{ row.original.sah }}</b>
            </template>
            <template #tolak-cell="{ row }">
              {{ row.original.tolak || '—' }}
            </template>
            <template #fb-cell="{ row }">
              {{ row.original.fb || '—' }}
            </template>
            <template #target-cell="{ row }">
              {{ row.original.target || '—' }}
            </template>
            <template #pct-cell="{ row }">
              <span
                v-if="row.original.pct === null"
                class="text-muted"
              >target belum diatur</span>
              <span v-else>{{ row.original.pct }}%</span>
            </template>
            <template #reward-cell="{ row }">
              <template v-if="row.original.reward.bonus > 0">
                <b>{{ rupiah(row.original.reward.bonus) }}</b>
                <div class="text-xs text-muted">
                  tangga {{ row.original.reward.tier?.rv }} review<template v-if="row.original.reward.berikut">
                    · {{ row.original.reward.kurang }} lagi ke {{ rupiah(row.original.reward.berikut.bonus) }}
                  </template>
                </div>
              </template>
              <template v-else-if="!row.original.reward.layak">
                <span class="text-muted">belum layak</span>
                <div class="text-xs text-dimmed">
                  kurang {{ row.original.reward.min - row.original.reward.n }} dari minimal {{ row.original.reward.min }}
                </div>
              </template>
              <template v-else>
                <span class="text-muted">—</span>
                <div class="text-xs text-dimmed">
                  {{ row.original.reward.berikut ? `kurang ${row.original.reward.kurang} ke ${rupiah(row.original.reward.berikut.bonus)}` : 'tidak ada tangga' }}
                </div>
              </template>
            </template>
          </UTable>
        </div>
        <AppListRow
          v-for="o in baris"
          :key="o.nama"
          :title="`${o.nama} · ${o.sah} terverifikasi`"
          :description="`diminta ${o.minta} · diklaim ${o.klaim} · ditolak ${o.tolak} · feedback ${o.fb} · target ${o.target || '—'}${o.reward.bonus > 0 ? ` · reward ${rupiah(o.reward.bonus)}` : ''}`"
          icon="i-lucide-user-round"
          class="lg:hidden"
        >
          <template #trailing>
            {{ o.pct === null ? '—' : `${o.pct}%` }}
          </template>
        </AppListRow>
        <p
          v-if="tersembunyi.length && (sahSembunyi || fbSembunyi)"
          class="px-4 py-3 text-sm text-muted"
        >
          {{ tersembunyi.length }} orang tidak ditampilkan di papan ini — tim Office dan pemegang Admin Sistem mengatur modulnya, bukan dinilai perolehannya.
          Angka mereka yang tidak ikut tabel: <b>{{ sahSembunyi }}</b> review terverifikasi<template v-if="fbSembunyi">
            & <b>{{ fbSembunyi }}</b> feedback
          </template>.
          Itulah selisih antara penjumlahan tabel dan kartu Terverifikasi di atas.
        </p>
        <p
          v-if="statusRoster === 'pending'"
          class="px-4 py-3 text-sm text-muted"
        >
          Roster Office belum termuat — papan memakai kru modul.
        </p>
      </AppList>
    </template>
    <p
      v-else
      class="text-muted"
    >
      Tidak ada akses.
    </p>

    <ResponsiveSheet
      v-model:open="sheetTarget"
      title="Atur target per nama"
      description="Target sebulan per nama. Kosong / 0 = tidak dinilai. Target tim = jumlah semuanya."
    >
      <p
        v-if="!hostTarget.length"
        class="text-sm text-muted"
      >
        Belum ada kru terdaftar di modul ini.
      </p>
      <UFormField
        v-for="n in hostTarget"
        :key="n"
        :label="n"
      >
        <UInput
          v-model.number="targetForm[n]"
          type="number"
          :min="0"
          placeholder="0"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <div class="mt-2 flex items-center justify-between border-t border-default pt-3">
        <span class="text-sm text-muted">Target akumulasi tim (otomatis)</span>
        <b class="num text-lg">{{ totalTargetForm }}</b>
      </div>
      <template #footer>
        <UButton
          label="Simpan target"
          size="xl"
          @click="simpanTarget"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheetTarget = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
