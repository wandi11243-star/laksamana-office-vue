<!--
  Finance › Kas Kecil › Rekap Penjualan (old `viewRekap`, deploy/finance/kas/index.html:2289-3070).

  POS vs bank deposits, after tax & service. The day formula is
  `hitungRekapHari` in app/utils/kompas.ts — the SAME source Brankas will use
  (old twins: `rkHitung` ≡ `aktGrup`). Only the month's POS figures come from
  Report Daily; what this panel writes is the narrow set (`PUT /kompas/rekap`):
  MDR/aktual marks, the Setor flag and the POS-input ticks — `pay` is NEVER
  written here, and deposits are computed by the server from each covered day's
  cash actual. The deposit sets: the bank/group list is server-closed (T-13):
  an unknown MDR is dropped and reported via `takDikenal`, kept as-is in the UI.
-->
<script setup lang="ts">
import {
  RK_GRUP, hitungRekapHari, kNum, type BarisHarian, type RekapUbah,
} from '~/utils/kompas'
import { SELISIH_TOLERANSI, fmtRp, fmtSel, num } from '~/utils/cashier'
import { getKompasState, putRekap } from '~/composables/useCashier'
import { useKasIzin } from '~/utils/layar/finance'
import { tanganiKonflik } from '~/utils/versi'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['finance'] })

interface SetoranRow { id: string, tgl?: string, tujuan?: string, catatan?: string, hari?: string[], nominal?: unknown, jumlah?: Record<string, unknown>, by?: string, at?: number }

const izin = useKasIzin()
const toast = useToast()
const periode = ref(hariIni().slice(0, 7))
const tab = ref<'rekap' | 'input' | 'setoran'>('rekap')
const terbuka = ref('')
const hariInput = ref(hariIni())
const ubah = ref<Record<string, RekapUbah>>({})
const terpilih = ref<Record<string, boolean>>({})
const setorForm = reactive({ tujuan: '', catatan: '' })

const { data, error, refresh } = useAsyncData('kas-rekap', () => getKompasState())

const reports = computed(() => data.value?.value.reports ?? {})
const daily = computed(() => data.value?.value.daily ?? [])
const piutang = computed(() => data.value?.value.piutang ?? [])
const setoranRows = computed<SetoranRow[]>(() => (data.value?.value.rekap_setoran ?? []) as SetoranRow[])

const omsetOf = (t: string): BarisHarian | null => daily.value.find(d => d.date === t) ?? null
const recOf = (t: string) => reports.value[t] ?? null
const R = (t: string) => hitungRekapHari(recOf(t) as unknown as BarisHarian | null, omsetOf(t), piutang.value, t, ubah.value[t] ?? null)

const hariBulan = computed(() => {
  const [y, m] = periode.value.split('-').map(Number)
  const n = new Date(Date.UTC(y!, m!, 0)).getUTCDate()
  const out: string[] = []
  for (let i = 1; i <= n; i++) out.push(`${periode.value}-${String(i).padStart(2, '0')}`)
  return out
})
const hariData = computed(() => hariBulan.value.map(t => ({ tgl: t, h: R(t) })).filter(x => x.h.adaData))

const cash = (t: string) => kNum((recOf(t)?.pay as Record<string, { actual?: unknown }> | undefined)?.cash?.actual)
const setorUntuk = (t: string) => setoranRows.value.filter(s => Array.isArray(s.hari) && s.hari.includes(t))
const sudahSetor = (t: string) => {
  let s = 0
  for (const d of setorUntuk(t)) {
    const j = d.jumlah?.[t]
    s += j === undefined || j === null || j === '' ? cash(t) : kNum(j)
  }
  return s
}
const sisaSetor = (t: string) => Math.max(0, cash(t) - sudahSetor(t))
const setorSelesai = (t: string) => (setorUntuk(t).length ? sisaSetor(t) < 1 : !!(recOf(t)?.setor))
const tanda = (t: string, grup: string) => {
  const u = ubah.value[t]?.tanda?.[grup]
  if (u !== undefined) return !!u
  const e = (recOf(t)?.esb ?? {}) as Record<string, unknown>
  return !!e[grup]
}

const bulan = computed(() => {
  let jual = 0
  let rekapAkt = 0
  let mdrTotal = 0
  let kotorMdr = 0
  let selisih = 0
  let adjust = 0
  let lewat = 0
  for (const { h } of hariData.value) {
    jual += h.jual
    rekapAkt += h.rekapAkt
    mdrTotal += h.mdrTotal
    kotorMdr += h.kotorMdr
    selisih += h.selisihTotal
    if (Math.abs(h.selisihTotal) > SELISIH_TOLERANSI) lewat++
    adjust += RK_GRUP.reduce((s, x) => s + h.g[x.k]!.adjust, 0)
  }
  return { jual, rekapAkt, mdrTotal, kotorMdr, selisih, adjust, lewat }
})
const piutangBulan = computed(() => piutang.value.filter(b => String(b.date).slice(0, 7) === periode.value).reduce((s, b) => s + num(b.nominal), 0))
const sudahSetorBulan = computed(() => setoranRows.value.filter(s => String(s.tgl ?? '').slice(0, 7) === periode.value).reduce((s, x) => s + kNum(x.nominal), 0))
const mdrPersen = computed(() => (bulan.value.kotorMdr > 0 ? (bulan.value.mdrTotal / bulan.value.kotorMdr) * 100 : null))
const grupBulan = computed(() => RK_GRUP.map((x) => {
  let pos = 0
  let kotor = 0
  let mdr = 0
  let akt = 0
  let adjust = 0
  let nTanda = 0
  for (const { tgl, h } of hariData.value) {
    const g = h.g[x.k]!
    pos += g.pos
    kotor += g.kotor
    mdr += g.mdr
    akt += g.akt
    adjust += g.adjust
    if (tanda(tgl, x.k)) nTanda++
  }
  return { ...x, pos, kotor, mdr, akt, adjust, nTanda }
}))

const RH = computed(() => R(hariInput.value))
function ubahAkt(g: string, v: string | number) {
  const t = hariInput.value
  ubah.value = { ...ubah.value, [t]: { ...(ubah.value[t] ?? {}), aktual: { ...(ubah.value[t]?.aktual ?? {}), [g]: String(v) } } }
}
function ubahMdrMan(g: string, v: string | number) {
  const t = hariInput.value
  ubah.value = { ...ubah.value, [t]: { ...(ubah.value[t] ?? {}), mdrman: { ...(ubah.value[t]?.mdrman ?? {}), [g]: String(v) } } }
}
function ubahTanda(g: string, v: boolean) {
  const t = hariInput.value
  ubah.value = { ...ubah.value, [t]: { ...(ubah.value[t] ?? {}), tanda: { ...(ubah.value[t]?.tanda ?? {}), [g]: v } } }
}
function ubahSetor(v: boolean) {
  const t = hariInput.value
  ubah.value = { ...ubah.value, [t]: { ...(ubah.value[t] ?? {}), setor: v } }
}
const setorTerpilih = computed(() => (ubah.value[hariInput.value]?.setor ?? !!recOf(hariInput.value)?.setor))

const kotorHariIni = computed(() => Object.keys(ubah.value).length > 0)
const sibuk = ref(false)
async function simpanHari() {
  if (!izin.ubah('rekap') || sibuk.value) return
  const t = hariInput.value
  const u = ubah.value[t]
  if (!u) return
  sibuk.value = true
  try {
    const body: Record<string, unknown> = {}
    if (u.aktual) body.aktual = u.aktual
    if (u.mdrman) body.mdrManual = u.mdrman
    if (u.tanda) body.esb = u.tanda
    if (u.setor !== undefined) body.setor = u.setor
    await putRekap({ hari: { [t]: body } })
    ubah.value = { ...ubah.value, [t]: {} }
    toast.add({ title: `Penanda & MDR ${t} disimpan.`, color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: `Gagal menyimpan: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

const setoranBuka = ref(false)
function bukaSetoran() {
  terpilih.value = {}
  setorForm.tujuan = ''
  setorForm.catatan = ''
  setoranBuka.value = true
}
const totalTerpilih = computed(() => Object.keys(terpilih.value).filter(t => terpilih.value[t]).reduce((s, t) => s + sisaSetor(t), 0))
const nTerpilih = computed(() => Object.keys(terpilih.value).filter(t => terpilih.value[t]).length)
async function simpanSetoran() {
  if (!izin.ubah('rekap') || sibuk.value) return
  const hari = Object.keys(terpilih.value).filter(t => terpilih.value[t]).sort()
  if (!hari.length) {
    toast.add({ title: 'Pilih dulu hari yang disetor.', color: 'error' })
    return
  }
  sibuk.value = true
  try {
    const r = await putRekap({ hari: {}, setoran: { tambah: [{ tgl: hari[hari.length - 1], tujuan: setorForm.tujuan.trim(), catatan: setorForm.catatan.trim(), hari }] } })
    setoranBuka.value = false
    toast.add({ title: `Setoran dicatat (${hari.length} hari).${Array.isArray(r.data.takDikenal) && r.data.takDikenal.length ? ` Sebagian tak dikenal: ${JSON.stringify(r.data.takDikenal)}` : ''}`, color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: `Gagal menyimpan setoran: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
const hapusSetoranOpen = ref(false)
const hapusSetoran = ref<SetoranRow | null>(null)
async function jalanHapusSetoran() {
  const s = hapusSetoran.value
  if (!s || sibuk.value) return
  sibuk.value = true
  try {
    await putRekap({ hari: {}, setoran: { hapus: [String(s.id)] } })
    hapusSetoranOpen.value = false
    toast.add({ title: 'Setoran dihapus; harinya kembali ke daftar belum disetor.', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: `Gagal menghapus: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <AppPage
    title="Rekap penjualan"
    description="Cocokkan POS dengan setoran bank — angka penjualannya after tax & service."
  >
    <template #actions>
      <UInput
        v-model="periode"
        type="month"
        size="sm"
        class="w-40"
      />
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        size="sm"
        @click="refresh()"
      />
    </template>

    <UAlert
      v-if="!izin.lihat('rekap')"
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
          v-model="tab"
          size="sm"
          :options="[
            { value: 'rekap', label: 'Rekap bulanan' },
            { value: 'input', label: 'Input harian' },
            { value: 'setoran', label: 'Setoran cash' },
          ]"
        />
      </div>

      <template v-if="tab === 'rekap'">
        <AppStatGrid>
          <AppStat
            label="Dibayar tamu"
            icon="i-lucide-receipt"
            :value="fmtRp(bulan.jual)"
            sub="after tax & service · net + svc + tax"
          />
          <AppStat
            label="Rekap aktual"
            icon="i-lucide-landmark"
            :value="fmtRp(bulan.rekapAkt)"
            sub="aktual masuk, sudah dipotong MDR"
            tone="info"
          />
          <AppStat
            label="Total MDR"
            icon="i-lucide-scissors"
            :value="fmtRp(bulan.mdrTotal)"
            :sub="mdrPersen === null ? 'belum ada aktual kotor' : `${mdrPersen.toFixed(2)}% dari aktual kotor`"
            tone="warning"
          />
          <AppStat
            label="Total selisih"
            icon="i-lucide-scale"
            :value="fmtSel(bulan.selisih)"
            :sub="bulan.lewat ? `${bulan.lewat} hari lewat toleransi ${fmtRp(SELISIH_TOLERANSI)}` : 'semua dalam toleransi ✓'"
            :tone="bulan.lewat ? 'error' : 'success'"
          />
        </AppStatGrid>
        <AppStatGrid>
          <AppStat
            label="Piutang / bon"
            icon="i-lucide-hand-coins"
            :value="fmtRp(piutangBulan)"
            sub="bon bulan ini (belum & lunas)"
          />
          <AppStat
            label="Adjust terkunci di POS"
            icon="i-lucide-lock"
            :value="fmtRp(bulan.adjust)"
            sub="POS − aktual per kelompok (non-POS: aktual)"
          />
          <AppStat
            label="Sudah setor"
            icon="i-lucide-banknote"
            :value="fmtRp(sudahSetorBulan)"
            :sub="`${setoranRows.filter(s => String(s.tgl ?? '').slice(0, 7) === periode).length} setoran bulan ini`"
            tone="success"
          />
        </AppStatGrid>

        <AppPanel title="Cara angkanya dibaca">
          <p class="text-sm text-muted">
            Angka POS & Aktual dibaca dari Report Daily di panel Input Omset Harian — tidak bisa diubah dari sini.
            Yang diisi di sub-tab <b>Input harian</b> hanya MDR/dana lebih, penanda Setor, dan centang Input POS.
          </p>
        </AppPanel>

        <AppPanel
          title="Per metode pembayaran"
          :description="`Sebulan penuh, ${hariData.length} hari. Aktual sudah dipotong MDR; kelompok tanpa sisi POS tidak punya selisih.`"
        >
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="g in grupBulan"
              :key="g.k"
              class="rounded-field border border-default p-3 text-sm"
            >
              <div class="mb-1 flex items-center justify-between gap-2">
                <b class="text-highlighted">{{ g.n }}</b>
                <AppStatus
                  :color="g.nTanda === hariData.length && hariData.length ? 'success' : (g.nTanda ? 'warning' : 'neutral')"
                  size="sm"
                >
                  POS {{ g.nTanda }}/{{ hariData.length }}
                </AppStatus>
              </div>
              <div
                v-if="g.pos"
                class="flex justify-between"
              >
                <span class="text-muted">POS</span><span class="num">{{ fmtRp(g.pos) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted">Aktual{{ g.mdr ? ' (bersih)' : '' }}</span><b class="num">{{ fmtRp(g.akt) }}</b>
              </div>
              <div
                v-if="g.mdr"
                class="flex justify-between"
              >
                <span class="text-muted">MDR</span><span class="num">{{ fmtRp(g.mdr) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted">Adjust</span><span class="num">{{ fmtRp(g.adjust) }}</span>
              </div>
            </div>
          </div>
        </AppPanel>

        <AppPanel
          title="Rincian harian"
          description="Klik satu hari untuk rincian kelompoknya dan cara angkanya dihitung."
          flush
        >
          <div class="divide-y divide-default">
            <div
              v-for="d in hariData"
              :key="d.tgl"
            >
              <button
                type="button"
                class="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-start text-sm hover:bg-muted lg:px-5"
                @click="terbuka = terbuka === d.tgl ? '' : d.tgl"
              >
                <b class="w-24 shrink-0 text-highlighted">{{ d.tgl }}</b>
                <span class="text-muted">Tamu <b class="text-highlighted num">{{ fmtRp(d.h.jual) }}</b></span>
                <span class="text-muted">Aktual <b class="text-highlighted num">{{ fmtRp(d.h.rekapAkt) }}</b></span>
                <span class="text-muted">MDR <b class="text-highlighted num">{{ fmtRp(d.h.mdrTotal) }}</b></span>
                <span class="text-muted">Selisih <b
                  :class="Math.abs(d.h.selisihTotal) > SELISIH_TOLERANSI ? 'text-error' : 'text-success'"
                  class="num"
                >{{ fmtSel(d.h.selisihTotal) }}</b></span>
                <span class="flex-1" />
                <AppStatus
                  v-if="d.h.tanpaSvcTax"
                  color="error"
                  size="sm"
                >
                  svc & tax kosong
                </AppStatus>
                <AppStatus
                  :color="setorSelesai(d.tgl) ? 'success' : 'neutral'"
                  size="sm"
                >
                  {{ setorSelesai(d.tgl) ? 'Setor ✓' : 'Belum setor' }}
                </AppStatus>
              </button>

              <div
                v-if="terbuka === d.tgl"
                class="bg-muted px-4 pb-4 lg:px-5"
              >
                <p class="py-2 text-sm text-muted">
                  Omset net <b class="text-highlighted num">{{ fmtRp(d.h.j.net) }}</b> + service <b class="num">{{ fmtRp(d.h.j.svc) }}</b> + tax <b class="num">{{ fmtRp(d.h.j.tax) }}</b>
                  = <b class="text-highlighted num">{{ fmtRp(d.h.jual) }}</b> − setoran <b class="num">{{ fmtRp(d.h.setoran) }}</b>
                  <template v-if="d.h.mdrTotal">
                    + MDR <b class="num">{{ fmtRp(d.h.mdrTotal) }}</b>
                  </template>
                  <template v-if="d.h.bon.ada">
                    + bon − pelunasan <b class="num">{{ fmtSel(d.h.bon.koreksi) }}</b>
                  </template>
                  = <b
                    :class="Math.abs(d.h.selisihTotal) > SELISIH_TOLERANSI ? 'text-error' : 'text-success'"
                    class="num"
                  >{{ fmtSel(d.h.selisihTotal) }}</b>
                  <template v-if="d.h.tanpaSvcTax">
                    · service & tax masih nol di Input Omset Harian
                  </template>
                </p>
                <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div
                    v-for="x in RK_GRUP"
                    :key="x.k"
                    class="rounded-field border border-default bg-default p-2 text-xs"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <b>{{ x.n }}</b>
                      <AppStatus
                        :color="tanda(d.tgl, x.k) ? 'success' : 'neutral'"
                        size="sm"
                      >
                        {{ tanda(d.tgl, x.k) ? 'POS ✓' : 'belum' }}
                      </AppStatus>
                    </div>
                    <div
                      v-if="d.h.g[x.k]!.punyaPos"
                      class="flex justify-between"
                    >
                      <span class="text-muted">POS</span><span class="num">{{ fmtRp(d.h.g[x.k]!.pos) }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted">Aktual{{ d.h.g[x.k]!.mdr ? ' bersih' : '' }}</span><b class="num">{{ fmtRp(d.h.g[x.k]!.akt) }}</b>
                    </div>
                    <div
                      v-if="d.h.g[x.k]!.mdr"
                      class="flex justify-between"
                    >
                      <span class="text-muted">MDR</span><span class="num">{{ fmtRp(d.h.g[x.k]!.mdr) }}</span>
                    </div>
                  </div>
                </div>
                <div class="mt-2 flex flex-wrap gap-x-4 text-xs text-muted">
                  <span>Compliment <b class="num">{{ fmtRp(d.h.comp) }}</b></span>
                  <span>Member deposit <b class="num">{{ fmtRp(d.h.mdep) }}</b></span>
                  <span>Voucher <b class="num">{{ fmtRp(d.h.vou) }}</b></span>
                  <span>Error customer <b class="num">{{ fmtRp(d.h.errCust) }}</b></span>
                  <span>Error kitchen <b class="num">{{ fmtRp(d.h.errKit) }}</b></span>
                  <UButton
                    v-if="izin.ubah('rekap')"
                    label="Isi MDR & penanda hari ini"
                    size="xs"
                    color="neutral"
                    variant="outline"
                    @click="hariInput = d.tgl; tab = 'input'"
                  />
                </div>
              </div>
            </div>
            <p
              v-if="!hariData.length"
              class="px-4 py-6 text-center text-sm text-muted"
            >
              Belum ada data omset maupun Report Daily untuk {{ periode }}.
            </p>
          </div>
        </AppPanel>
      </template>

      <template v-else-if="tab === 'input'">
        <AppPanel
          :title="`Input MDR & penanda — ${hariInput}`"
          description="Aktual yang diketik menggantikan hitungan; MDR manual dipakai saat aktual BERLEBIH (bank memotong, angka saja tidak bisa menebak pembagiannya)."
        >
          <UInput
            v-model="hariInput"
            type="date"
            size="sm"
            class="mb-3 w-40"
          />
          <div class="divide-y divide-default">
            <div
              v-for="x in RK_GRUP.filter(g => g.mdr)"
              :key="x.k"
              class="grid gap-2 py-2 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
            >
              <div>
                <b class="text-highlighted">{{ x.n }}</b>
                <p class="text-xs text-muted">
                  Kotor <b class="num">{{ fmtRp(RH.g[x.k]!.kotor) }}</b> · MDR kini <b class="num">{{ fmtRp(RH.g[x.k]!.mdr) }}</b>{{ RH.g[x.k]!.berlebih ? ' · aktual BERLEBIH' : '' }}
                </p>
              </div>
              <UFormField label="Aktual diketik (kosong = hitungan)">
                <UInput
                  :model-value="String(ubah[hariInput]?.aktual?.[x.mdr!] ?? (recOf(hariInput)?.aktual as Record<string, unknown> | undefined)?.[x.mdr!] ?? '')"
                  inputmode="numeric"
                  class="w-full"
                  :disabled="!izin.ubah('rekap')"
                  @update:model-value="(v: string | number) => ubahAkt(x.mdr!, v)"
                />
              </UFormField>
              <UFormField label="MDR manual (saat berlebih)">
                <UInput
                  :model-value="String(ubah[hariInput]?.mdrman?.[x.mdr!] ?? (recOf(hariInput)?.mdrManual as Record<string, unknown> | undefined)?.[x.mdr!] ?? '')"
                  inputmode="numeric"
                  class="w-full"
                  :disabled="!izin.ubah('rekap')"
                  @update:model-value="(v: string | number) => ubahMdrMan(x.mdr!, v)"
                />
              </UFormField>
              <UFormField label="Input POS (mesin)">
                <UCheckbox
                  :model-value="tanda(hariInput, x.k)"
                  :disabled="!izin.ubah('rekap')"
                  @update:model-value="(v: boolean | 'indeterminate') => ubahTanda(x.k, v === true)"
                />
              </UFormField>
              <p class="pb-1 text-xs text-muted">
                Aktual bersih: <b class="text-highlighted num">{{ fmtRp(RH.g[x.k]!.akt) }}</b>{{ RH.g[x.k]!.lebih ? ` · dana lebih ${fmtRp(RH.g[x.k]!.lebih)}` : '' }}
              </p>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-4">
            <UCheckbox
              :model-value="setorTerpilih"
              label="Setor (cermin riwayat setoran)"
              :disabled="!izin.ubah('rekap')"
              @update:model-value="(v: boolean | 'indeterminate') => ubahSetor(v === true)"
            />
            <span class="text-sm text-muted">Sisa setor hari ini: <b class="text-highlighted num">{{ fmtRp(sisaSetor(hariInput)) }}</b></span>
            <div class="flex-1" />
            <UButton
              v-if="izin.ubah('rekap')"
              label="Simpan penanda & MDR"
              icon="i-lucide-save"
              :disabled="!kotorHariIni"
              :loading="sibuk"
              @click="simpanHari"
            />
          </div>
        </AppPanel>
      </template>

      <template v-else>
        <AppPanel
          title="Riwayat setoran cash"
          :description="`${setoranRows.filter(s => String(s.tgl ?? '').slice(0, 7) === periode).length} setoran bulan ini · total ${fmtRp(sudahSetorBulan)}. Nominal dihitung server dari cash actual hari-hari yang dicakup; baris lama tanpa rincian berarti setoran penuh.`"
          flush
        >
          <template #actions>
            <UButton
              v-if="izin.ubah('rekap')"
              label="+ Catat setoran"
              icon="i-lucide-plus"
              size="sm"
              @click="bukaSetoran"
            />
          </template>
          <div class="divide-y divide-default">
            <div
              v-for="s in setoranRows.filter(x => String(x.tgl ?? '').slice(0, 7) === periode).sort((a, b) => String(a.tgl) < String(b.tgl) ? 1 : -1)"
              :key="s.id"
              class="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-5"
            >
              <div class="min-w-0 flex-1">
                <b class="text-highlighted">{{ s.tgl || '—' }}</b>
                <span class="ms-2 text-sm text-muted">{{ s.tujuan || '(tanpa tujuan)' }}</span>
                <p class="text-xs text-muted">
                  {{ (s.hari ?? []).length }} hari: {{ (s.hari ?? []).join(', ') }}
                  <template v-if="s.catatan">
                    · {{ s.catatan }}
                  </template>
                  <template v-if="s.by">
                    · oleh {{ s.by }}
                  </template>
                </p>
              </div>
              <b class="num">{{ fmtRp(kNum(s.nominal)) }}</b>
              <UButton
                v-if="izin.ubah('rekap')"
                label="Hapus"
                color="error"
                variant="ghost"
                size="xs"
                @click="hapusSetoran = s; hapusSetoranOpen = true"
              />
            </div>
            <p
              v-if="!setoranRows.filter(x => String(x.tgl ?? '').slice(0, 7) === periode).length"
              class="px-4 py-6 text-center text-sm text-muted"
            >
              Belum ada setoran tercatat bulan ini.
            </p>
          </div>
        </AppPanel>
      </template>
    </template>

    <ResponsiveSheet
      v-model:open="setoranBuka"
      title="Catat setoran cash"
    >
      <p class="mb-3 text-sm text-muted">
        Pilih hari-hari yang benar-benar dibawa ke bank. Nominalnya dihitung server dari cash actual tiap hari; uang yang masih tersisa tetap berstatus belum disetor.
      </p>
      <div class="max-h-64 space-y-1 overflow-y-auto">
        <UCheckbox
          v-for="t in hariBulan.filter(t => cash(t) > 0 || sisaSetor(t) > 0)"
          :key="t"
          :model-value="!!terpilih[t]"
          :label="`${t} — sisa ${fmtRp(sisaSetor(t))}`"
          @update:model-value="(v: boolean | 'indeterminate') => { terpilih = { ...terpilih, [t]: v === true } }"
        />
      </div>
      <div class="mt-3 space-y-3">
        <UFormField label="Tujuan (bank/penerima)">
          <UInput
            v-model="setorForm.tujuan"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Catatan">
          <UInput
            v-model="setorForm.catatan"
            class="w-full"
          />
        </UFormField>
        <p class="text-sm text-muted">
          {{ nTerpilih }} hari terpilih · perkiraan total <b class="text-highlighted num">{{ fmtRp(totalTerpilih) }}</b>
        </p>
      </div>
      <template #footer>
        <UButton
          label="Simpan setoran"
          :disabled="!nTerpilih"
          :loading="sibuk"
          @click="simpanSetoran"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="setoranBuka = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="hapusSetoranOpen"
      :title="hapusSetoran ? `Hapus setoran ${hapusSetoran.tgl}?` : 'Hapus setoran?'"
    >
      <p class="text-sm">
        Barisnya dihapus dari riwayat; hari-hari yang dicakupnya kembali berstatus belum disetor.
      </p>
      <template #footer>
        <UButton
          label="Ya, hapus"
          color="error"
          :loading="sibuk"
          @click="jalanHapusSetoran"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="hapusSetoranOpen = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
