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
import { putRekap, useKompasState } from '~/composables/useCashier'
import { useKasIzin } from '~/utils/layar/finance'
import { tanganiKonflik } from '~/utils/versi'
import { BULAN, HARI, hariIni } from '~/utils/format'

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

const kp = useKompasState()
const data = kp.data
const error = kp.error
const refresh = () => kp.refresh()

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
const setorSelesai = (t: string) => {
  const u = ubah.value[t]?.setor
  if (u !== undefined) return !!u
  return (setorUntuk(t).length ? sisaSetor(t) < 1 : !!(recOf(t)?.setor))
}
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
  let adjKunci = 0
  let lewat = 0
  let net = 0
  let svc = 0
  let tax = 0
  let nTanpaSvc = 0
  for (const { tgl, h } of hariData.value) {
    jual += h.jual
    rekapAkt += h.rekapAkt
    mdrTotal += h.mdrTotal
    kotorMdr += h.kotorMdr
    selisih += h.selisihTotal
    if (Math.abs(h.selisihTotal) > SELISIH_TOLERANSI) lewat++
    net += h.j.net
    svc += h.j.svc
    tax += h.j.tax
    if (h.tanpaSvcTax) nTanpaSvc++
    for (const x of RK_GRUP) {
      const a = h.g[x.k]!.adjust
      adjust += a
      if (tanda(tgl, x.k)) adjKunci += a
    }
  }
  return { jual, rekapAkt, mdrTotal, kotorMdr, selisih, adjust, adjKunci, lewat, net, svc, tax, nTanpaSvc }
})
/** The old panel's colours per payment group (RK_GRUP.warna). Whole class strings, so Tailwind can see them. */
const WARNA: Record<string, { atas: string, teks: string, bar: string }> = {
  cash: { atas: 'border-t-emerald-600', teks: 'text-emerald-700', bar: 'bg-emerald-600' },
  qr_order: { atas: 'border-t-teal-600', teks: 'text-teal-700', bar: 'bg-teal-600' },
  edc_bri: { atas: 'border-t-blue-600', teks: 'text-blue-700', bar: 'bg-blue-600' },
  qris_bri: { atas: 'border-t-blue-600', teks: 'text-blue-700', bar: 'bg-blue-600' },
  edc_mandiri: { atas: 'border-t-amber-600', teks: 'text-amber-700', bar: 'bg-amber-600' },
  qris_mandiri: { atas: 'border-t-amber-600', teks: 'text-amber-700', bar: 'bg-amber-600' },
  edc_bca: { atas: 'border-t-violet-600', teks: 'text-violet-700', bar: 'bg-violet-600' },
  qris_bca: { atas: 'border-t-violet-600', teks: 'text-violet-700', bar: 'bg-violet-600' },
  transfer: { atas: 'border-t-yellow-600', teks: 'text-yellow-700', bar: 'bg-yellow-600' },
  gofood: { atas: 'border-t-red-600', teks: 'text-red-700', bar: 'bg-red-600' },
  grabfood: { atas: 'border-t-red-600', teks: 'text-red-700', bar: 'bg-red-600' },
  tiktokgo: { atas: 'border-t-red-600', teks: 'text-red-700', bar: 'bg-red-600' },
  xendit: { atas: 'border-t-teal-600', teks: 'text-teal-700', bar: 'bg-teal-600' },
  error: { atas: 'border-t-red-600', teks: 'text-red-700', bar: 'bg-red-600' },
}
const warna = (k: string) => WARNA[k] ?? WARNA.cash!
/** Thousand dots while typing (a million is one digit away from ten million). */
const titik = (v: unknown) => {
  const d = String(v ?? '').replace(/[^0-9]/g, '')
  return d ? Number(d).toLocaleString('id-ID') : ''
}
function geserHari(n: number) {
  const d = new Date(`${hariInput.value}T00:00:00`)
  d.setDate(d.getDate() + n)
  hariInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const nSetor = computed(() => hariData.value.filter(d => setorSelesai(d.tgl)).length)
const grupBulan = computed(() => RK_GRUP.map((x) => {
  let pos = 0
  let kotor = 0
  let mdr = 0
  let akt = 0
  let adjust = 0
  let sel = 0
  let nTanda = 0
  for (const { tgl, h } of hariData.value) {
    const g = h.g[x.k]!
    pos += g.pos
    kotor += g.kotor
    mdr += g.mdr
    akt += g.akt
    adjust += g.adjust
    if (g.selisih !== null) sel += g.selisih
    if (tanda(tgl, x.k)) nTanda++
  }
  const nHari = hariData.value.length
  return { ...x, pos, kotor, mdr, akt, adjust, sel, nTanda, punyaPos: x.pos.length > 0, pers: nHari ? Math.round(nTanda / nHari * 100) : 0 }
}))

const namaBulan = computed(() => BULAN[Number(periode.value.split('-')[1]) - 1] ?? '')
/** MDR prints plain («Rp20.000», never signed); zero prints «—» (old rkMdrRp). */
const mdrRp = (n: number) => (!n ? '—' : fmtRp(Math.abs(n)))
/** Money that prints «—» for zero (old rkRp0). */
const rp0 = (n: number) => (!n ? '—' : fmtRp(n))
/**
 * «12,34%» of the pre-cut gross; empty (never «0%») when meaningless
 * (old rkMdrPct: the banks charge off the gross, not the net).
 */
const mdrPct = (mdr: number, kotor: number) => {
  const m = Math.abs(num(mdr))
  const k = num(kotor)
  if (!m || k <= 0) return ''
  return `${(m / k * 100).toFixed(2).replace('.', ',')}%`
}
/** «Kam, 1» — the old day label; the month is rendered separately. */
const labelHari = (t: string) => {
  const d = new Date(`${t}T00:00:00`)
  return `${(HARI[d.getDay()] ?? '').slice(0, 3)}, ${d.getDate()}`
}
const nCek = (t: string) => RK_GRUP.filter(g => tanda(t, g.k)).length
/** Month receivables, read straight from the bon list (old rkBonBulan). */
const bonBulan = computed(() => {
  let baru = 0
  let lunas = 0
  let n = 0
  let belum = 0
  let nBelum = 0
  for (const b of piutang.value as { date?: string, status?: string, lunasDate?: string, nominal?: unknown }[]) {
    if (!b) continue
    if (String(b.date ?? '').slice(0, 7) === periode.value) {
      baru += num(b.nominal)
      n++
      if (b.status !== 'lunas') {
        belum += num(b.nominal)
        nBelum++
      }
    }
    if (b.status === 'lunas' && String(b.lunasDate ?? '').slice(0, 7) === periode.value) lunas += num(b.nominal)
  }
  return { baru, lunas, n, belum, nBelum }
})
/** Cash days never fully deposited — the whole history, not just this month (old rkBelumSetor). */
const belumSetor = computed(() => Object.keys(reports.value)
  .filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t) && cash(t) > 0 && !setorSelesai(t))
  .sort())

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

const kotorHariIni = computed(() => Object.keys(ubah.value).length > 0)
const sibuk = ref(false)
async function simpanHari() {
  if (!izin.ubah('rekap') || sibuk.value) return
  const hariUbah = Object.keys(ubah.value).filter(t => Object.keys(ubah.value[t] ?? {}).length)
  if (!hariUbah.length) return
  sibuk.value = true
  try {
    const hari: Record<string, Record<string, unknown>> = {}
    for (const t of hariUbah) {
      const u = ubah.value[t]!
      const body: Record<string, unknown> = {}
      if (u.aktual) body.aktual = u.aktual
      if (u.mdrman) body.mdrManual = u.mdrman
      if (u.tanda) body.esb = u.tanda
      hari[t] = body
    }
    await putRekap({ hari })
    ubah.value = {}
    toast.add({ title: `Penanda & MDR ${hariUbah.length} hari disimpan.`, color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: `Gagal menyimpan: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

const tglSetor = ref(hariIni())
/** Typed amount per day (digits only); a ticked day starts at its remaining cash (old rkPilihHari). */
const nomSetor = ref<Record<string, string>>({})
const hariTerpilih = computed(() => Object.keys(terpilih.value).filter(t => terpilih.value[t]).sort())
const nominalHari = (t: string) => (nomSetor.value[t] !== undefined ? kNum(nomSetor.value[t]) : sisaSetor(t))
function pilihHari(t: string, on: boolean) {
  terpilih.value = { ...terpilih.value, [t]: on }
  nomSetor.value = { ...nomSetor.value, [t]: on ? String(sisaSetor(t)) : '' }
}
function pilihSemua(on: boolean) {
  for (const x of belumSetor.value) pilihHari(x, on)
}
const totalTerpilih = computed(() => hariTerpilih.value.reduce((s, t) => s + nominalHari(t), 0))
const nTerpilih = computed(() => hariTerpilih.value.length)
/** Ticked days whose amount is zero, or more than what is left of that day's cash (the server would clamp it silently). */
const setorNol = computed(() => hariTerpilih.value.filter(t => nominalHari(t) < 1))
const setorLebih = computed(() => hariTerpilih.value.filter(t => nominalHari(t) > sisaSetor(t) + 0.5))
const umurHari = (t: string) => Math.round((new Date(`${hariIni()}T00:00:00`).getTime() - new Date(`${t}T00:00:00`).getTime()) / 86400000)
const setorBisa = computed(() => nTerpilih.value > 0 && !setorNol.value.length && !setorLebih.value.length && !!setorForm.tujuan.trim() && !!tglSetor.value)
async function simpanSetoran() {
  if (!izin.ubah('rekap') || sibuk.value || !setorBisa.value) return
  const hari = hariTerpilih.value
  const jumlah: Record<string, number> = {}
  for (const t of hari) jumlah[t] = nominalHari(t)
  sibuk.value = true
  try {
    const r = await putRekap({ hari: {}, setoran: { tambah: [{ tgl: tglSetor.value, tujuan: setorForm.tujuan.trim(), catatan: setorForm.catatan.trim(), hari, jumlah }] } })
    terpilih.value = {}
    nomSetor.value = {}
    tglSetor.value = hariIni()
    setorForm.tujuan = ''
    setorForm.catatan = ''
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
      <AppBulan
        v-model="periode"
        class="w-48"
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
            { value: 'setoran', label: 'Setoran cash', badge: belumSetor.length },
          ]"
        />
      </div>

      <template v-if="tab === 'rekap'">
        <div class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
          <div
            v-for="(k, i) in [
              { l: 'Dibayar tamu', v: fmtRp(bulan.jual), s: 'after tax & service · net ' + fmtRp(bulan.net) + ' + svc ' + fmtRp(bulan.svc) + ' + tax ' + fmtRp(bulan.tax), aksen: true },
              { l: 'Rekap aktual', v: fmtRp(bulan.rekapAkt), s: 'seluruh kolom Actual Report Daily, dipotong MDR' },
              { l: 'Total MDR', v: mdrRp(bulan.mdrTotal) + (mdrPct(bulan.mdrTotal, bulan.kotorMdr) ? ' · ' + mdrPct(bulan.mdrTotal, bulan.kotorMdr) : ''), s: 'potongan bank & ojol; persennya dari Aktual kotor kelompok yang kena potongan' },
              { l: 'Total selisih', v: fmtSel(bulan.selisih), s: 'Dibayar Tamu − Rekap Aktual + koreksi bon' },
              { l: 'Piutang / bon', v: fmtRp(bonBulan.baru), s: bonBulan.n ? bonBulan.n + ' bon bulan ini · ' + fmtRp(bonBulan.belum) + ' belum lunas (' + bonBulan.nBelum + ')' + (bonBulan.lunas ? ' · pelunasan masuk ' + fmtRp(bonBulan.lunas) : '') : (bonBulan.lunas ? 'tidak ada bon baru · pelunasan bon lama masuk ' + fmtRp(bonBulan.lunas) : 'tidak ada bon bulan ini') },
              { l: 'Adjust terkunci di POS', v: fmtRp(bulan.adjKunci), s: bulan.adjust - bulan.adjKunci === 0 ? 'seluruhnya sudah diinput' : fmtRp(bulan.adjust - bulan.adjKunci) + ' belum diinput' },
              { l: 'Sudah setor', v: nSetor + ' / ' + hariData.length, s: 'hari yang cash-nya sudah disetor' },
            ]"
            :key="i"
            class="rounded-panel border-t-[3px] p-4 shadow-panel"
            :class="(k as { aksen?: boolean }).aksen ? 'border-t-primary-900 bg-primary text-white' : 'border-t-primary bg-default'"
          >
            <p
              class="text-[11px] font-bold uppercase tracking-wider"
              :class="(k as { aksen?: boolean }).aksen ? 'text-white/80' : 'text-muted'"
            >
              {{ k.l }}
            </p>
            <p
              class="mt-1 text-xl font-extrabold num"
              :class="(k as { aksen?: boolean }).aksen ? 'text-white' : 'text-highlighted'"
            >
              {{ k.v }}
            </p>
            <p
              class="mt-1 text-xs"
              :class="(k as { aksen?: boolean }).aksen ? 'text-white/85' : 'text-muted'"
            >
              {{ k.s }}
            </p>
          </div>
        </div>

        <UAlert
          v-if="kotorHariIni"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`${Object.keys(ubah).length} hari punya perubahan yang belum disimpan. Angka di bawah sudah memperhitungkannya — buka sub-tab Input harian untuk menyimpan.`"
          class="mb-4"
        />
        <UAlert
          v-if="bulan.nTanpaSvc"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`${bulan.nTanpaSvc} hari punya setoran kasir tapi service charge & tax-nya masih nol di Input Omset Harian. Yang dibayar tamu sudah termasuk service & tax, jadi hari-hari itu akan selalu terlihat selisih sebesar service+tax-nya — bukan uang hilang.`"
          class="mb-4"
        />

        <AppPanel
          title="Per metode pembayaran"
          :description="`Sebulan penuh, ${hariData.length} hari. Aktual di sini sudah dipotong MDR.`"
        >
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div
              v-for="g in grupBulan"
              :key="g.k"
              class="rounded-xl border border-t-[3px] border-default bg-default p-3.5 shadow-panel"
              :class="warna(g.k).atas"
            >
              <div class="mb-2 flex items-center justify-between gap-2">
                <b :class="warna(g.k).teks">{{ g.n }}</b>
                <span
                  v-if="g.punyaPos"
                  class="rounded-full px-2 py-0.5 text-[11px] font-bold num"
                  :class="Math.abs(g.sel) <= SELISIH_TOLERANSI ? 'bg-success/15 text-success' : 'bg-error/15 text-error'"
                >{{ Math.abs(g.sel) <= SELISIH_TOLERANSI ? 'cocok' : fmtRp(g.sel) }}</span>
                <span
                  v-else
                  class="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted"
                >tanpa pembanding</span>
              </div>
              <div class="space-y-1 text-sm">
                <div
                  v-if="g.punyaPos"
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
                  <span class="text-muted">MDR</span><span class="num">{{ mdrRp(g.mdr) }}{{ mdrPct(g.mdr, g.kotor) ? ' · ' + mdrPct(g.mdr, g.kotor) : '' }}</span>
                </div>
                <div class="flex justify-between border-t border-dashed border-default pt-1">
                  <span class="text-muted">Adjust</span><b class="num">{{ fmtRp(g.adjust) }}</b>
                </div>
              </div>
              <div class="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full rounded-full"
                  :class="warna(g.k).bar"
                  :style="{ width: g.pers + '%' }"
                />
              </div>
              <p class="mt-1 text-xs text-muted">
                Input POS {{ g.nTanda }}/{{ hariData.length }} hari ({{ g.pers }}%)
              </p>
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
                <b class="w-28 shrink-0 text-highlighted">{{ labelHari(d.tgl) }} <span class="font-normal text-muted">{{ namaBulan }}</span></b>
                <span class="text-muted">Dibayar Tamu <b class="text-highlighted num">{{ rp0(d.h.jual) }}</b></span>
                <span class="text-muted">Rekap Aktual <b class="text-highlighted num">{{ rp0(d.h.rekapAkt) }}</b></span>
                <span class="text-muted">MDR <b class="text-highlighted num">{{ mdrRp(d.h.mdrTotal) }}</b><template v-if="mdrPct(d.h.mdrTotal, d.h.kotorMdr)"> <span class="text-xs">· {{ mdrPct(d.h.mdrTotal, d.h.kotorMdr) }}</span></template></span>
                <span class="text-muted">Selisih <b
                  :class="Math.abs(d.h.selisihTotal) > SELISIH_TOLERANSI ? 'text-error' : 'text-success'"
                  class="num"
                >{{ d.h.selisihTotal ? fmtSel(d.h.selisihTotal) : '—' }}</b></span>
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
                  {{ setorSelesai(d.tgl) ? '✓ Setor' : 'belum setor' }}
                </AppStatus>
                <AppStatus
                  :color="nCek(d.tgl) === RK_GRUP.length ? 'success' : (nCek(d.tgl) ? 'warning' : 'neutral')"
                  size="sm"
                >
                  POS {{ nCek(d.tgl) }}/{{ RK_GRUP.length }}
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
                    class="rounded-panel border border-default bg-default p-2 text-xs"
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
              Belum ada data omset maupun Report Daily untuk {{ namaBulan }} {{ periode.split('-')[0] }}.
              Isi dulu di panel Input Omset Harian.
            </p>
          </div>
        </AppPanel>

        <UAlert
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="Angka POS & Aktual dibaca dari Report Daily"
          description="Di panel Input Omset Harian — tidak bisa diubah dari sini, supaya satu angka tidak ditulis dua layar. Yang diisi di sub-tab Input harian cuma MDR, penanda Setor, dan centang Input POS."
          class="mt-4"
        />
      </template>

      <template v-else-if="tab === 'input'">
        <AppPanel
          title="Hari yang diisi"
          description="Semua isian di halaman ini milik tanggal yang dipilih. Perubahan di tanggal lain tidak hilang saat berpindah — semuanya ikut terkirim sekali Simpan."
        >
          <div class="flex flex-wrap items-end gap-2">
            <AppTanggal
              v-model="hariInput"
              class="w-56"
            />
            <UButton
              label="← Hari sebelumnya"
              color="neutral"
              variant="outline"
              @click="geserHari(-1)"
            />
            <UButton
              label="Hari berikutnya →"
              color="neutral"
              variant="outline"
              @click="geserHari(1)"
            />
            <UButton
              label="Hari ini"
              color="neutral"
              variant="outline"
              @click="hariInput = hariIni()"
            />
          </div>
        </AppPanel>

        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div
            v-for="(k, i) in [
              { l: 'Dibayar tamu', v: fmtRp(RH.jual), s: 'after tax & service · ' + hariInput, aksen: true },
              { l: 'Rekap aktual', v: fmtRp(RH.rekapAkt), s: 'setoran ' + fmtRp(RH.setoran) + ' − MDR + dana lebih' },
              { l: 'Total MDR', v: mdrRp(RH.mdrTotal) + (mdrPct(RH.mdrTotal, RH.kotorMdr) ? ' · ' + mdrPct(RH.mdrTotal, RH.kotorMdr) : ''), s: 'Aktual kotor − Aktual masuk; persennya dari Aktual kotor kelompok yang kena potongan' },
              { l: 'Selisih', v: fmtSel(RH.selisihTotal), s: 'Dibayar Tamu − Rekap Aktual' + (RH.bon.ada ? ' + koreksi bon' : '') },
            ]"
            :key="i"
            class="rounded-panel border-t-[3px] p-4 shadow-panel"
            :class="(k as { aksen?: boolean }).aksen ? 'border-t-primary-900 bg-primary text-white' : 'border-t-primary bg-default'"
          >
            <p
              class="text-[11px] font-bold uppercase tracking-wider"
              :class="(k as { aksen?: boolean }).aksen ? 'text-white/80' : 'text-muted'"
            >
              {{ k.l }}
            </p>
            <p
              class="mt-1 text-xl font-extrabold num"
              :class="(k as { aksen?: boolean }).aksen ? 'text-white' : 'text-highlighted'"
            >
              {{ k.v }}
            </p>
            <p
              class="mt-1 text-xs"
              :class="(k as { aksen?: boolean }).aksen ? 'text-white/85' : 'text-muted'"
            >
              {{ k.s }}
            </p>
          </div>
        </div>

        <UAlert
          v-if="RH.tanpaSvcTax"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          class="my-4"
          title="Service charge & tax tanggal ini masih nol di Input Omset Harian, padahal setoran kasirnya ada."
          description="Selisih di atas kemungkinan besar berasal dari isian yang belum lengkap — bukan uang yang hilang."
        />
        <UAlert
          v-else-if="!recOf(hariInput) && !omsetOf(hariInput)"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          class="my-4"
          title="Report Daily tanggal ini belum ada, jadi seluruh angka POS & Aktual masih nol."
          description="Penandanya boleh dicentang sekarang, tapi Aktual masuk sebaiknya diisi setelah Report Daily-nya ada."
        />

        <AppPanel
          title="Setoran cash"
          class="mt-4"
        >
          <p class="text-sm text-muted">
            Cash hari ini <b class="text-highlighted num">{{ fmtRp(cash(hariInput)) }}</b> · sisa belum disetor <b class="text-highlighted num">{{ fmtRp(sisaSetor(hariInput)) }}</b>.
            Setoran dicatat per beberapa hari sekaligus berikut tujuannya di sub-tab tersendiri.
          </p>
          <UButton
            class="mt-3"
            label="Buka setoran cash"
            icon="i-lucide-landmark"
            color="neutral"
            variant="outline"
            @click="tab = 'setoran'"
          />
        </AppPanel>

        <AppPanel
          title="Aktual masuk & penanda input POS"
          flush
        >
          <template #description>
            Isi <b>Aktual</b> — nominal yang benar-benar masuk rekening menurut mutasi bank / laporan ojol. MDR di sebelahnya <b>dihitung sendiri</b> sebagai selisihnya terhadap Aktual kotor, tidak perlu diketik. Kosongkan kalau memang tidak ada potongan. Centang <b>Input POS</b> berarti nominal <i>adjust</i> kelompok itu sudah dikunci di POS.
          </template>
          <div class="border-b border-default bg-warning/10 px-4 py-3 text-xs leading-relaxed text-default lg:px-6">
            <b>Kalau uang yang masuk rekening MELAMPAUI</b> yang tercatat di Report Daily, kolom <b>MDR berubah jadi kotak isian</b> — di keadaan itu angka saja tidak bisa memberi tahu berapa yang potongan bank dan berapa yang input kasirnya kurang. Isi potongan bank menurut mutasi; sisanya otomatis jadi <b>Dana lebih</b>. Kosongkan kalau memang tidak ada potongan — seluruh kelebihannya akan jatuh ke Dana lebih. Yang berlaku:
            <b>Aktual masuk = Aktual kotor + Dana lebih − MDR</b>. Berapa pun pembagiannya, <b>Rekap Aktual & Selisih tidak bergeser sepeser pun</b> — kolom ini menjelaskan uang, tidak memindahkannya.
          </div>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[56rem] text-sm">
              <thead class="bg-table-head text-table-head-text">
                <tr class="text-xs font-bold uppercase tracking-wider">
                  <th class="px-3 py-2.5 text-start">
                    Kelompok
                  </th>
                  <th class="px-3 py-2.5 text-end">
                    POS
                  </th>
                  <th class="px-3 py-2.5 text-end">
                    Aktual (kotor)
                  </th>
                  <th class="w-40 px-3 py-2.5 text-end">
                    Aktual masuk
                  </th>
                  <th class="w-40 px-3 py-2.5 text-end">
                    MDR
                    <span class="block text-[10px] font-normal normal-case">% dari Aktual kotor</span>
                  </th>
                  <th class="px-3 py-2.5 text-end">
                    Dana lebih
                  </th>
                  <th class="px-3 py-2.5 text-end">
                    Adjust
                  </th>
                  <th class="px-3 py-2.5 text-center">
                    Input POS
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="x in RK_GRUP"
                  :key="x.k"
                >
                  <td class="px-3 py-2.5 font-bold">
                    <span :class="warna(x.k).teks">{{ x.n }}</span>
                  </td>
                  <td class="px-3 py-2.5 text-end num">
                    {{ RH.g[x.k]!.punyaPos ? rp0(RH.g[x.k]!.pos) : '—' }}
                  </td>
                  <td class="px-3 py-2.5 text-end num">
                    {{ rp0(RH.g[x.k]!.kotor) }}
                  </td>
                  <td class="px-3 py-1.5 text-end">
                    <UInput
                      v-if="x.mdr"
                      :model-value="titik(ubah[hariInput]?.aktual?.[x.mdr] ?? (recOf(hariInput)?.aktual as Record<string, unknown> | undefined)?.[x.mdr] ?? '')"
                      inputmode="numeric"
                      class="w-36"
                      :ui="{ base: 'text-end' }"
                      :placeholder="titik(RH.g[x.k]!.akt) || '0'"
                      :disabled="!izin.ubah('rekap')"
                      @update:model-value="(v: string | number) => ubahAkt(x.mdr!, String(v).replace(/[^0-9]/g, ''))"
                    />
                    <span
                      v-else
                      class="text-muted"
                    >—</span>
                  </td>
                  <td class="px-3 py-1.5 text-end num">
                    <template v-if="x.mdr">
                      <UInput
                        v-if="RH.g[x.k]!.berlebih || RH.g[x.k]!.mdrMan !== null"
                        :model-value="titik(ubah[hariInput]?.mdrman?.[x.mdr] ?? (recOf(hariInput)?.mdrManual as Record<string, unknown> | undefined)?.[x.mdr] ?? '')"
                        inputmode="numeric"
                        class="w-36"
                        :ui="{ base: 'text-end' }"
                        placeholder="0"
                        :disabled="!izin.ubah('rekap')"
                        title="Aktual masuk melebihi Aktual kotor. Isi potongan bank menurut mutasi; sisanya otomatis jadi Dana lebih."
                        @update:model-value="(v: string | number) => ubahMdrMan(x.mdr!, String(v).replace(/[^0-9]/g, ''))"
                      />
                      <template v-else>
                        {{ mdrRp(RH.g[x.k]!.mdr) }}
                      </template>
                      <span
                        v-if="mdrPct(RH.g[x.k]!.mdr, RH.g[x.k]!.kotor)"
                        class="block text-[11px] text-muted"
                      >{{ mdrPct(RH.g[x.k]!.mdr, RH.g[x.k]!.kotor) }} dari kotor</span>
                    </template>
                    <span
                      v-else
                      class="text-muted"
                    >—</span>
                  </td>
                  <td class="px-3 py-2.5 text-end num">
                    <span
                      v-if="x.mdr && RH.g[x.k]!.lebih"
                      :class="RH.g[x.k]!.lebih < 0 ? 'text-error' : 'font-semibold text-primary'"
                    >{{ fmtRp(RH.g[x.k]!.lebih) }}</span>
                    <span
                      v-else
                      class="text-muted"
                    >—</span>
                  </td>
                  <td class="px-3 py-2.5 text-end num">
                    {{ rp0(RH.g[x.k]!.adjust) }}
                  </td>
                  <td class="px-3 py-2.5 text-center">
                    <UCheckbox
                      :id="'cb-pos-' + x.k"
                      :model-value="tanda(hariInput, x.k)"
                      :disabled="!izin.ubah('rekap')"
                      @update:model-value="(v: boolean | 'indeterminate') => ubahTanda(x.k, v === true)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </AppPanel>

        <div class="sticky bottom-3 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-panel bg-default p-3 shadow-panel">
          <p class="text-xs text-muted">
            <template v-if="Object.keys(ubah).length">
              <b class="text-warning">{{ Object.keys(ubah).length }} hari punya perubahan yang belum disimpan.</b>
            </template>
            <template v-else>
              Yang disimpan dari layar ini hanya Aktual masuk, MDR (saat dana berlebih), dan centang Input POS.
            </template>
          </p>
          <UButton
            v-if="izin.ubah('rekap')"
            label="Simpan perubahan"
            icon="i-lucide-save"
            :disabled="!kotorHariIni"
            :loading="sibuk"
            @click="simpanHari"
          />
        </div>
      </template>

      <template v-else>
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-panel border-t-[3px] border-t-primary bg-default p-4 shadow-panel">
            <p class="text-[11px] font-bold uppercase tracking-wider text-muted">
              Belum disetor
            </p>
            <p class="mt-1 text-xl font-extrabold text-highlighted num">
              {{ fmtRp(belumSetor.reduce((x, t) => x + sisaSetor(t), 0)) }}
            </p>
            <p class="mt-1 text-xs text-muted">
              {{ belumSetor.length }} hari, seluruh riwayat — bukan cuma bulan ini
            </p>
          </div>
          <div class="rounded-panel border-t-[3px] border-t-primary-900 bg-primary p-4 text-white shadow-panel">
            <p class="text-[11px] font-bold uppercase tracking-wider text-white/80">
              Dipilih sekarang
            </p>
            <p class="mt-1 text-xl font-extrabold num">
              {{ fmtRp(totalTerpilih) }}
            </p>
            <p class="mt-1 text-xs text-white/85">
              {{ nTerpilih }} hari dicentang
            </p>
          </div>
          <div class="rounded-panel border-t-[3px] border-t-primary bg-default p-4 shadow-panel">
            <p class="text-[11px] font-bold uppercase tracking-wider text-muted">
              Setoran tercatat
            </p>
            <p class="mt-1 text-xl font-extrabold text-highlighted num">
              {{ setoranRows.length }} kali
            </p>
            <p class="mt-1 text-xs text-muted">
              riwayat lengkap ada di bawah
            </p>
          </div>
        </div>

        <AppPanel
          title="Cash yang belum disetor"
          description="Centang hari-hari yang uangnya dibawa ke bank dalam satu kali jalan. Angkanya Cash Actual hari itu dari Report Daily."
          class="mt-4"
          flush
        >
          <p
            v-if="!belumSetor.length"
            class="px-5 py-8 text-center text-sm text-muted"
          >
            Seluruh cash yang tercatat sudah disetor.
          </p>
          <div
            v-else
            class="overflow-x-auto"
          >
            <table class="w-full min-w-[44rem] text-sm">
              <thead class="bg-table-head text-table-head-text">
                <tr class="text-xs font-bold uppercase tracking-wider">
                  <th class="w-10 px-3 py-2.5">
                    <UCheckbox
                      id="cb-rekap-semua"
                      :model-value="belumSetor.length > 0 && belumSetor.every(t => terpilih[t])"
                      aria-label="Pilih semua"
                      @update:model-value="(v: boolean | 'indeterminate') => pilihSemua(v === true)"
                    />
                  </th>
                  <th class="px-3 py-2.5 text-start">
                    Tanggal
                  </th>
                  <th class="px-3 py-2.5 text-end">
                    Cash actual
                  </th>
                  <th class="px-3 py-2.5 text-end">
                    Sisa belum setor
                  </th>
                  <th class="w-44 px-3 py-2.5 text-end">
                    Yang disetor
                  </th>
                  <th class="px-3 py-2.5 text-start">
                    Umur
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="t in belumSetor"
                  :key="t"
                >
                  <td class="px-3 py-2">
                    <UCheckbox
                      :id="'cb-rekap-' + t"
                      :model-value="!!terpilih[t]"
                      :aria-label="'Pilih ' + t"
                      @update:model-value="(v: boolean | 'indeterminate') => pilihHari(t, v === true)"
                    />
                  </td>
                  <td class="px-3 py-2 font-semibold text-highlighted">
                    {{ new Date(t + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) }}
                    <span
                      v-if="sudahSetor(t) > 0"
                      class="block text-xs font-normal text-muted"
                    >{{ fmtRp(sudahSetor(t)) }} sudah disetor sebelumnya</span>
                  </td>
                  <td class="px-3 py-2 text-end num">
                    {{ fmtRp(cash(t)) }}
                  </td>
                  <td class="px-3 py-2 text-end font-bold num">
                    {{ fmtRp(sisaSetor(t)) }}
                  </td>
                  <td class="px-3 py-1.5 text-end">
                    <UInput
                      :model-value="terpilih[t] ? titik(nomSetor[t] ?? '') : ''"
                      inputmode="numeric"
                      class="w-40"
                      :ui="{ base: 'text-end' }"
                      :placeholder="titik(sisaSetor(t))"
                      :disabled="!terpilih[t]"
                      :color="setorNol.includes(t) || setorLebih.includes(t) ? 'error' : undefined"
                      :aria-label="'Yang disetor ' + t"
                      @update:model-value="(v: string | number) => { nomSetor = { ...nomSetor, [t]: String(v).replace(/[^0-9]/g, '') } }"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <span
                      class="rounded-full px-2 py-0.5 text-xs font-bold"
                      :class="umurHari(t) <= 1 ? 'bg-muted text-muted' : umurHari(t) <= 3 ? 'bg-warning/15 text-warning' : 'bg-error/15 text-error'"
                    >{{ umurHari(t) <= 1 ? 'baru' : umurHari(t) + ' hari' }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p
            v-if="belumSetor.length"
            class="border-t border-default px-5 py-3 text-xs text-muted"
          >
            Mencentang mengisi kotak <b>Yang disetor</b> dengan sisa hari itu. Ubah kalau yang dibawa ke bank ternyata cuma sebagian — <b>sisanya tetap berdiri di daftar ini</b> sampai benar-benar disetor, jadi tidak ada cash yang hilang dari pantauan.
          </p>
        </AppPanel>

        <AppPanel
          v-if="izin.ubah('rekap')"
          title="Catat setoran"
          description="Nominal per hari diambil dari kotak Yang disetor di tabel atas; yang tidak disunting memakai sisa hari itu, dihitung ulang server dari Report Daily supaya tidak pernah beda dari cash-nya."
          class="mt-4"
        >
          <div class="grid gap-4 sm:grid-cols-3">
            <UFormField label="Tanggal setor">
              <AppTanggal
                v-model="tglSetor"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Disetor ke mana *"
              help="Tulis nama bank (BRI / Mandiri / BCA / UOB) agar masuk ke saldo Brankas."
            >
              <UInput
                v-model="setorForm.tujuan"
                list="rekap-tujuan"
                placeholder="mis. BCA 1234567890"
                class="w-full"
              />
              <datalist id="rekap-tujuan">
                <option value="BCA" />
                <option value="BRI" />
                <option value="Mandiri" />
                <option value="UOB" />
                <option value="Brankas" />
              </datalist>
            </UFormField>
            <UFormField label="Catatan (opsional)">
              <UInput
                v-model="setorForm.catatan"
                placeholder="mis. disetor Pak Budi"
                class="w-full"
              />
            </UFormField>
          </div>
          <UAlert
            v-if="setorNol.length"
            class="mt-3"
            color="error"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="setorNol.length + ' hari dicentang tapi nominalnya nol (' + setorNol.join(', ') + '). Isi nominalnya, atau lepas centangnya — baris setoran nol tidak menyetor apa pun.'"
          />
          <UAlert
            v-if="setorLebih.length"
            class="mt-3"
            color="error"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="setorLebih.length + ' hari nominalnya melampaui sisa yang tercatat (' + setorLebih.map(t => t + ' — sisa ' + fmtRp(sisaSetor(t))).join(', ') + ').'"
            description="Kalau yang benar-benar disetor memang sebesar itu, yang perlu dibetulkan Cash Actual hari itu di Report Daily — bukan setorannya."
          />
          <div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3">
            <div class="flex gap-8 text-sm">
              <span class="text-muted">Hari dipilih <b class="ms-1 text-highlighted num">{{ nTerpilih }}</b></span>
              <span class="text-muted">Total disetor <b class="ms-1 text-highlighted num">{{ fmtRp(totalTerpilih) }}</b></span>
            </div>
            <UButton
              label="Catat setoran"
              icon="i-lucide-landmark"
              :disabled="!setorBisa"
              :loading="sibuk"
              @click="simpanSetoran"
            />
          </div>
        </AppPanel>

        <AppPanel
          title="Riwayat setoran"
          description="Kapan disetor, ke mana, berapa, dan hari mana saja yang tercakup."
          class="mt-4"
          flush
        >
          <p
            v-if="!setoranRows.length"
            class="px-5 py-8 text-center text-sm text-muted"
          >
            Belum ada setoran yang dicatat.
          </p>
          <div
            v-else
            class="overflow-x-auto"
          >
            <table class="w-full min-w-[44rem] text-sm">
              <thead class="bg-table-head text-table-head-text">
                <tr class="text-xs font-bold uppercase tracking-wider">
                  <th class="px-3 py-2.5 text-start">
                    Tanggal setor
                  </th>
                  <th class="px-3 py-2.5 text-start">
                    Tujuan
                  </th>
                  <th class="px-3 py-2.5 text-end">
                    Nominal
                  </th>
                  <th class="px-3 py-2.5 text-start">
                    Hari yang dicakup
                  </th>
                  <th class="px-3 py-2.5 text-start">
                    Oleh
                  </th>
                  <th class="w-12 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="x in setoranRows.slice().sort((a, b) => String(a.tgl) < String(b.tgl) ? 1 : -1)"
                  :key="x.id"
                >
                  <td class="px-3 py-2.5 font-semibold text-highlighted">
                    {{ x.tgl ? new Date(x.tgl + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) : '—' }}
                    <span
                      v-if="x.catatan"
                      class="block text-xs font-normal text-muted"
                    >{{ x.catatan }}</span>
                  </td>
                  <td class="px-3 py-2.5">
                    {{ x.tujuan || '—' }}
                  </td>
                  <td class="px-3 py-2.5 text-end font-bold num">
                    {{ fmtRp(kNum(x.nominal)) }}
                  </td>
                  <td class="px-3 py-2.5">
                    <div class="flex flex-wrap gap-1">
                      <span
                        v-for="h in (x.hari ?? [])"
                        :key="h"
                        class="rounded-full px-2 py-0.5 text-xs font-semibold"
                        :class="x.jumlah?.[h] !== undefined && kNum(x.jumlah[h]) < cash(h) - 0.5 ? 'bg-warning/15 text-warning' : 'bg-muted text-muted'"
                      >{{ labelHari(h) }}{{ x.jumlah?.[h] !== undefined && kNum(x.jumlah[h]) < cash(h) - 0.5 ? ' · ' + fmtRp(kNum(x.jumlah[h])) : '' }}</span>
                    </div>
                  </td>
                  <td class="px-3 py-2.5 text-xs text-muted">
                    {{ x.by || '—' }}
                  </td>
                  <td class="px-3 py-2.5 text-end">
                    <UButton
                      v-if="izin.ubah('rekap')"
                      icon="i-lucide-x"
                      color="error"
                      variant="ghost"
                      size="xs"
                      aria-label="Batalkan setoran"
                      @click="hapusSetoran = x; hapusSetoranOpen = true"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </AppPanel>
      </template>
    </template>

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
