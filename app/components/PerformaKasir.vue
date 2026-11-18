<!--
  Performa Kasir — THE SAME panel in Cashier and Finance › Kas Kecil (both read
  the same blob; the old Office had two copies). Extracted 2026-10-07.

  The final number per cashier: gross − bill discount − event deduction (split
  per SHIFT, DW never joins) − compliment (subTotal only). Compliment is
  subtracted on the day it happened, so the history column adds up to the Omset
  Diakui figure on top; a compliment landing on a day with no cashier row still
  shows as its own negative row, excluded from the table but kept in the total.

  Only accounts whose Tim/Keterangan is EXACTLY "kasir" are ranked. The
  cashier's own restriction (non-admins see only their own name + `Semua`) is
  CASHIER-only — in Kas Kecil anyone who may open the page sees every name
  (`bolehSemua` prop), as the old finance screen did.

  SYNC (VUE-6): from 2026-10-01 (`SYNC_KASIR_MULAI`, `utils/sync-kasir.ts`) the
  per-day rows come from the `bdSync` freeze written by Breakdown Sumber, not
  from live computation. A day with no (valid) freeze is NOT counted — it is
  named in the "belum di-sync" warning. Compliment and Open Bill recognition
  stay live, exactly as before.
-->
<script setup lang="ts">
import type { ComplimentKasir } from '~/utils/cashier'
import type { EmployeesKompas, HariKompas, KetMap, PicKompas } from '~/utils/porsi-pic'
import {
  BONUS_KASIR, barisTanpaShift, bonusKasir, compFilterPic, compPotong, kasirMurni, kasirSaya,
  openBillList,
} from '~/utils/porsi-pic'
import { barisKasirPerforma, syncKasirBerlaku } from '~/utils/sync-kasir'
import { getRoster, putEmployees, useKompasState } from '~/composables/useCashier'
import { fmtRp } from '~/utils/cashier'
import { hariIni, tglPanjang } from '~/utils/format'
import { isAdminOf } from '~/composables/useMe'

const props = withDefaults(defineProps<{ kunci?: string, bolehSemua?: boolean }>(), { bolehSemua: false })

const me = useMe()
const mode = ref<'bulan' | 'hari'>('bulan')
const period = ref(hariIni().slice(0, 7))
const tanggal = ref(hariIni())
const pilihan = ref('__all__')
const hal = ref(1)
const PER_HAL = 12

const kp = useKompasState()
const { data, status, error: errorRoster, refresh } = useAsyncData(props.kunci ?? 'cashier-kasir', async () => {
  const roster = await getRoster()
  if (kp.status.value !== 'success') await kp.refresh()
  const st = kp.data.value
  // T-01 U2: the Office roster sync stays client-side and NON-DESTRUCTIVE —
  // only adds PIC rows that are not there yet (officeUserId first, then name).
  // A refused write never blocks the screen: PIC already stored stay visible.
  const emp = (st.value.employees ??= {}) as EmployeesKompas
  const calon = JSON.parse(JSON.stringify(emp)) as EmployeesKompas
  let ubah = false
  for (const divi of ['marketing', 'event', 'kasir'] as const) {
    for (const u of roster) {
      if (u.active === false) continue
      const kata = String(u.keterangan || '').toLowerCase().split(/[\s,;/]+/)
      if (!kata.includes(divi)) continue
      const nama = String(u.name || '').trim()
      if (!nama) continue
      const list = (calon[divi] ??= [])
      const ada = list.some(e => (e.officeUserId && String(e.officeUserId) === String(u.id))
        || String(e.name || '').trim().toLowerCase() === nama.toLowerCase())
      if (!ada) {
        list.push({ id: divi[0] + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name: nama, target: 0, officeUserId: u.id })
        ubah = true
      }
    }
  }
  if (ubah) {
    try {
      st.value.employees = (await putEmployees(calon, st.version)).value
      await kp.refresh()
    }
    catch {
      await kp.refresh()
      /* write refused — keep the stored list, never a row that is not there */
    }
  }
  // Raw Tim/Keterangan map (Kompass style): id first, then lower-cased name.
  const ket: KetMap = {}
  for (const u of roster) {
    const teks = String(u.keterangan || '')
    if (u.id) ket['#' + u.id] = teks
    const nm = String(u.name || '').trim().toLowerCase()
    if (nm) ket['@' + nm] = teks
  }
  return { ket }
})

const error = computed(() => errorRoster.value || kp.error.value)
/** The reload button: fresh Kompas blob first, then the roster + PIC sync on top of it. */
const muatUlang = async () => {
  await kp.refresh()
  await refresh()
}
const state = computed(() => kp.data.value.value)
const ket = computed<KetMap | null>(() => data.value?.ket ?? null)
const semuaPic = computed<PicKompas[]>(() => state.value?.employees?.kasir ?? [])
const list = computed(() => semuaPic.value.filter(k => kasirMurni(k, ket.value)))
const bolehSemua = computed(() => props.bolehSemua || isAdminOf(me.value, 'cashier'))
const saya = computed(() => kasirSaya(list.value, me.value))
const tampil = computed(() => (bolehSemua.value ? list.value : (saya.value ? [saya.value] : [])))
const seg = computed(() => [{ value: '__all__', label: 'Semua' }, ...tampil.value.map(k => ({ value: k.id, label: k.name }))])
watch(list, () => {
  if (pilihan.value !== '__all__' && !list.value.some(k => k.id === pilihan.value)) pilihan.value = '__all__'
})

const labelBulan = computed(() => {
  const d = new Date(`${period.value}-01T00:00:00`)
  return Number.isNaN(+d) ? period.value : d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
})
const rentangLabel = computed(() => (mode.value === 'hari' ? tglPanjang(tanggal.value) : labelBulan.value))

const days = computed<HariKompas[]>(() => {
  const all = state.value?.daily ?? []
  if (mode.value === 'hari') return all.filter(d => d.date === tanggal.value)
  return all.filter(d => String(d.date).slice(0, 7) === period.value).sort((a, b) => (a.date < b.date ? -1 : 1))
})
const compsRentang = computed<ComplimentKasir[]>(() => (state.value?.compliments ?? [])
  .filter(c => (mode.value === 'hari' ? c.date === tanggal.value : String(c.date).slice(0, 7) === period.value)))

interface HistRow { date: string, real: number, off: boolean, extra?: boolean, kasir?: string }
interface ObRow { date: string, eventName: string, total: number, kasir?: string }
interface RekapKasir { real: number, masuk: number, off: number, potong: number, comp: number, hist: HistRow[], ob: ObRow[], compRows: ComplimentKasir[] }
const KOSONG: RekapKasir = { real: 0, masuk: 0, off: 0, potong: 0, comp: 0, hist: [], ob: [], compRows: [] }

const agg = computed<Record<string, RekapKasir>>(() => {
  const out: Record<string, RekapKasir> = {}
  for (const k of list.value) out[k.id] = { real: 0, masuk: 0, off: 0, potong: 0, comp: 0, hist: [], ob: [], compRows: [] }
  // Open Bill is collected from EVERY day of the range: it can land on a day
  // where the cashier has no revenue row at all. Never added to `real` — the
  // money is already inside that day's gross (:3695-3703). Recognition stays
  // LIVE even on synced days (like compliment, VUE-6): the freeze only holds
  // the kasir rows, never OB.
  for (const d of days.value) {
    for (const x of openBillList(d)) {
      const a = out[x.kasirId]
      if (a) a.ob.push({ date: d.date, eventName: x.eventName, total: x.total })
    }
  }
  // From SYNC_KASIR_MULAI the rows come from the `bdSync` freeze (null = the
  // day is not counted yet, listed in `belumSync` below); before it, live
  // computation exactly as before (K-04 untouched).
  for (const d of days.value) {
    const rows = barisKasirPerforma(d)
    if (!rows) continue
    for (const r of rows) {
      const a = out[r.kasirId]
      if (!a) continue
      if (r.off) {
        a.off++
        a.hist.push({ date: d.date, real: 0, off: true })
        continue
      }
      a.real += r.real
      a.potong += r.potong
      a.masuk++
      a.hist.push({ date: d.date, real: r.real, off: false })
    }
  }
  for (const k of list.value) {
    const a = out[k.id]!
    const cr = compFilterPic(compsRentang.value, k)
    a.compRows = cr
    a.comp = cr.reduce((s, c) => s + compPotong(c), 0)
    a.real -= a.comp
    const perTgl = new Map<string, number>()
    for (const c of cr) perTgl.set(c.date, (perTgl.get(c.date) ?? 0) + compPotong(c))
    for (const h of a.hist) {
      const v = perTgl.get(h.date)
      if (v) {
        h.real -= v
        perTgl.delete(h.date)
      }
    }
    for (const [dt, v] of perTgl) a.hist.push({ date: dt, real: -v, off: false, extra: true })
  }
  return out
})

const gabung = computed<RekapKasir>(() => {
  const a: RekapKasir = { real: 0, masuk: 0, off: 0, potong: 0, comp: 0, hist: [], ob: [], compRows: [] }
  for (const k of list.value) {
    const g = agg.value[k.id]
    if (!g) continue
    a.real += g.real
    a.masuk += g.masuk
    a.off += g.off
    a.potong += g.potong
    a.comp += g.comp
    for (const h of g.hist) a.hist.push({ ...h, kasir: k.name })
    for (const o of g.ob) a.ob.push({ ...o, kasir: k.name })
    for (const c of g.compRows) if (!a.compRows.includes(c)) a.compRows.push(c)
  }
  return a
})

const dibuka = computed(() => pilihan.value === '__all__' || bolehSemua.value || (!!saya.value && saya.value.id === pilihan.value))
const aktif = computed<RekapKasir>(() => (pilihan.value === '__all__' ? gabung.value : (agg.value[pilihan.value] ?? KOSONG)))

const chart = computed(() => {
  const map: Record<string, number> = {}
  for (const h of aktif.value.hist) map[h.date] = (map[h.date] ?? 0) + h.real
  return Object.keys(map).sort().map(date => ({ date, real: map[date]! }))
})
const maxChart = computed(() => Math.max(1, ...chart.value.map(x => Math.abs(x.real))))
const persen = (v: number) => Math.min(100, (Math.abs(v) / maxChart.value) * 100)
const tanggalPendek = (d: string) => {
  const x = new Date(`${d}T00:00:00`)
  return Number.isNaN(+x) ? d : x.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

const histUrut = computed(() => aktif.value.hist.slice().sort((x, y) => (x.date < y.date ? -1 : 1)))
const compUrut = computed(() => aktif.value.compRows.slice().sort((x, y) => (x.date < y.date ? -1 : 1)))
const rinciComp = (c: ComplimentKasir) => (c.subTotal != null || c.tax != null || c.service != null
  ? `sub ${fmtRp(Number(c.subTotal) || 0)} + tax ${fmtRp(Number(c.tax) || 0)} + svc ${fmtRp(Number(c.service) || 0)}`
  : c.alasan || '—')
const totalHal = computed(() => Math.max(1, Math.ceil(histUrut.value.length / PER_HAL)))
const halaman = computed(() => {
  const p = Math.min(Math.max(1, hal.value), totalHal.value)
  const mulai = (p - 1) * PER_HAL
  return { p, mulai, akhir: Math.min(mulai + PER_HAL, histUrut.value.length), rows: histUrut.value.slice(mulai, mulai + PER_HAL) }
})
watch([pilihan, mode, period, tanggal], () => {
  hal.value = 1
})
watch(totalHal, (t) => {
  if (hal.value > t) hal.value = t
})

const bonus = computed(() => bonusKasir(aktif.value.real))
const kurang = computed(() => (bonus.value.next ? Math.max(0, bonus.value.next.min - aktif.value.real) : 0))
const ratarata = computed(() => (aktif.value.masuk > 0 ? aktif.value.real / aktif.value.masuk : 0))
const obTotalSemua = computed(() => aktif.value.ob.reduce((s, x) => s + x.total, 0))
/** Days from the cutoff on that are not synced yet: not counted above, named here (`peringatanSync`). */
const belumSync = computed(() => days.value
  .filter(d => syncKasirBerlaku(d.date) && barisKasirPerforma(d) === null)
  .map(d => d.date))
/** The "shift unset" ribbon is only for pre-cutoff days: synced days read the
 * freeze, so a live missing shift changes nothing here (it still blocks the
 * next sync on the breakdown page). */
const hariBelum = computed(() => days.value.filter(d => !syncKasirBerlaku(d.date) && barisTanpaShift(d).length))
</script>

<template>
  <AppPage
    title="Performa kasir"
    description="Omset yang diakui tiap kasir — angka final."
  >
    <AppPanel
      title="Rentang"
      :description="`Menampilkan ${mode === 'hari' ? 'satu hari' : 'satu bulan'} · ${rentangLabel}`"
    >
      <template #actions>
        <AppSeg
          v-model="mode"
          size="sm"
          :options="[{ value: 'bulan', label: 'Bulanan' }, { value: 'hari', label: 'Harian' }]"
        />
        <AppBulan
          v-if="mode === 'bulan'"
          v-model="period"
          size="sm"
          class="w-40"
        />
        <AppTanggal
          v-else
          v-model="tanggal"
          size="sm"
          class="w-40"
        />
      </template>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat: ${apiErrorMessage(error)}`"
      />
      <UAlert
        v-if="hariBelum.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`${hariBelum.length} hari punya baris event yang belum ditentukan kasir shift-nya (${hariBelum.slice(0, 5).map(d => d.date).join(', ')}${hariBelum.length > 5 ? ', …' : ''}).`"
        description="Potongannya belum dibebankan ke kasir mana pun, jadi realisasi di bawah masih terlalu besar — atur di Breakdown Sumber pada modul Kompas untuk tanggal tersebut."
        class="mb-2"
      />
      <UAlert
        v-if="belumSync.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-cloud-off"
        :title="`${belumSync.length} hari belum di-sync (${belumSync.slice(0, 5).join(', ')}${belumSync.length > 5 ? ', …' : ''}) — belum dihitung di bawah.`"
        description="Tekan Sync di Breakdown Sumber Omset untuk tanggal tersebut; sampai itu Performa hari itu kosong."
        class="mb-2"
      />
      <p
        v-if="!bolehSemua"
        class="rounded-field bg-muted px-3 py-2 text-sm text-muted"
      >
        <template v-if="saya">
          Rincian per kasir hanya untuk <b class="text-highlighted">{{ saya.name }}</b> — namamu sendiri. Tab <b>Semua</b> tetap memuat seluruh kasir, sebagai satu angka gabungan.
        </template>
        <template v-else>
          Akunmu belum cocok dengan satu pun nama kasir di sini, jadi yang bisa dibuka cuma tab <b>Semua</b>. Pencocokannya lewat Tim/Keterangan di Office — kalau namamu memang kasir, minta dibetulkan di sana.
        </template>
      </p>
      <p
        v-if="status === 'pending'"
        class="mt-2 text-sm text-muted"
      >
        Memuat…
      </p>
    </AppPanel>

    <template v-if="list.length">
      <div class="mb-4">
        <AppSeg
          v-model="pilihan"
          size="sm"
          :options="seg"
        />
      </div>

      <AppPanel v-if="!dibuka">
        <p class="text-sm text-muted">
          Rincian kasir lain tidak dibuka di modul ini. Yang bisa dilihat: namamu sendiri, dan tab <b>Semua</b> sebagai angka gabungan.
        </p>
      </AppPanel>

      <template v-else>
        <AppStatGrid>
          <AppStat
            label="Omset diakui"
            icon="i-lucide-badge-check"
            :value="fmtRp(aktif.real)"
            sub="angka final · dasar bonus"
          />
          <AppStat
            label="Bonus saat ini"
            icon="i-lucide-gift"
            :value="fmtRp(bonus.bonus)"
            :sub="bonus.label"
            :tone="bonus.bonus ? 'success' : undefined"
          />
          <AppStat
            :label="bonus.next ? `Menuju ${bonus.next.label}` : 'Level tertinggi'"
            icon="i-lucide-trending-up"
            :value="bonus.next ? fmtRp(kurang) : '—'"
            :sub="bonus.next ? `lagi untuk bonus ${fmtRp(bonus.next.bonus)}` : 'sudah di level teratas'"
            tone="info"
          />
        </AppStatGrid>

        <p class="mb-4 text-sm text-muted">
          Omset diakui <b class="text-highlighted num">{{ fmtRp(aktif.real) }}</b> ·
          {{ aktif.masuk }} hari masuk, {{ aktif.off }} hari OFF (rata-rata {{ fmtRp(ratarata) }}/hari)
        </p>

        <div class="grid gap-5 lg:grid-cols-2 lg:items-start">
          <AppPanel
            title="Omset harian"
            description="Satu batang per tanggal; nilai negatif = potongan compliment di hari tanpa omset."
          >
            <p
              v-if="!chart.length"
              class="rounded-field bg-muted px-3 py-6 text-center text-sm text-muted"
            >
              Belum ada data pada rentang ini.
            </p>
            <div
              v-else
              class="max-h-80 space-y-1 overflow-y-auto pe-1"
            >
              <AppBar
                v-for="x in chart"
                :key="x.date"
                :label="tanggalPendek(x.date)"
                :value="fmtRp(x.real)"
                :persen="persen(x.real)"
                :tone="x.real < 0 ? 'error' : 'gold'"
              />
            </div>
          </AppPanel>

          <AppPanel
            title="Riwayat"
            :description="`${aktif.masuk} hari masuk, ${aktif.off} hari OFF · angka per hari sudah final, jumlahnya tepat sama dengan Omset Diakui di atas`"
          >
            <table class="hidden w-full text-sm lg:table">
              <thead class="bg-table-head text-table-head-text">
                <tr>
                  <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                    Omset diakui
                  </th>
                  <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="h in halaman.rows"
                  :key="h.date + (h.kasir ?? '')"
                >
                  <td class="px-3 py-2">
                    {{ h.date }}
                    <span
                      v-if="h.kasir"
                      class="text-[11px] text-muted"
                    >· {{ h.kasir }}</span>
                  </td>
                  <td class="px-3 py-2 text-end num">
                    <span
                      v-if="h.off && !h.real"
                      class="text-muted"
                    >—</span>
                    <b v-else>{{ fmtRp(h.real) }}</b>
                  </td>
                  <td class="px-3 py-2">
                    <AppStatus
                      :color="h.extra ? 'gold' : h.off ? 'warning' : 'success'"
                      size="sm"
                    >
                      {{ h.extra ? 'Compliment' : h.off ? 'OFF' : 'Masuk' }}
                    </AppStatus>
                  </td>
                </tr>
                <tr v-if="!histUrut.length">
                  <td
                    colspan="3"
                    class="px-3 py-6 text-center text-sm text-muted"
                  >
                    Belum ada data.
                  </td>
                </tr>
              </tbody>
            </table>

            <div class="divide-y divide-default lg:hidden">
              <div
                v-for="h in halaman.rows"
                :key="h.date + (h.kasir ?? '')"
                class="flex items-center justify-between gap-3 py-2"
              >
                <div class="min-w-0">
                  <p class="text-sm text-highlighted">
                    {{ h.date }}
                  </p>
                  <p
                    v-if="h.kasir"
                    class="text-[11px] text-muted"
                  >
                    {{ h.kasir }}
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <span class="text-sm font-semibold num">{{ h.off && !h.real ? '—' : fmtRp(h.real) }}</span>
                  <AppStatus
                    :color="h.extra ? 'gold' : h.off ? 'warning' : 'success'"
                    size="sm"
                  >
                    {{ h.extra ? 'Compliment' : h.off ? 'OFF' : 'Masuk' }}
                  </AppStatus>
                </div>
              </div>
              <p
                v-if="!histUrut.length"
                class="py-6 text-center text-sm text-muted"
              >
                Belum ada data.
              </p>
            </div>

            <div
              v-if="totalHal > 1"
              class="mt-2 flex flex-wrap items-center justify-between gap-2"
            >
              <UButton
                label="‹ Sebelumnya"
                color="neutral"
                variant="ghost"
                size="sm"
                :disabled="halaman.p <= 1"
                @click="hal = halaman.p - 1"
              />
              <span class="text-xs text-muted">Baris {{ halaman.mulai + 1 }}–{{ halaman.akhir }} dari {{ histUrut.length }} · halaman {{ halaman.p }}/{{ totalHal }}</span>
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
        </div>

        <AppPanel
          v-if="aktif.ob.length"
          title="Pengakuan open bill"
          :description="`Pesanan tambahan tamu event yang dilayani lewat meja kasir, di luar paket marketing. Total ${fmtRp(obTotalSemua)} dalam rentang ini. Nominalnya sudah termasuk di dalam Omset Diakui di atas — kartu ini menyebutkan event mana, bukan menambah angka.`"
        >
          <table class="w-full text-sm">
            <thead class="bg-table-head text-table-head-text">
              <tr>
                <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
                  Tanggal
                </th>
                <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
                  Event
                </th>
                <th
                  v-if="pilihan === '__all__'"
                  class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider"
                >
                  Kasir
                </th>
                <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                  Nominal
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="o in aktif.ob"
                :key="o.date + o.eventName + o.total"
              >
                <td class="px-3 py-2">
                  {{ o.date }}
                </td>
                <td class="px-3 py-2 font-semibold text-highlighted">
                  {{ o.eventName || 'Event tanpa nama' }}
                </td>
                <td
                  v-if="pilihan === '__all__'"
                  class="px-3 py-2"
                >
                  {{ o.kasir || '—' }}
                </td>
                <td class="px-3 py-2 text-end num">
                  {{ fmtRp(o.total) }}
                </td>
              </tr>
            </tbody>
            <tfoot class="border-t-2 border-default font-bold">
              <tr>
                <td
                  :colspan="pilihan === '__all__' ? 3 : 2"
                  class="px-3 py-2"
                >
                  Total
                </td>
                <td class="px-3 py-2 text-end num">
                  {{ fmtRp(obTotalSemua) }}
                </td>
              </tr>
            </tfoot>
          </table>
        </AppPanel>

        <AppPanel
          :title="pilihan === '__all__' ? 'Tangga bonus (gabungan semua kasir)' : 'Tangga bonus'"
          :description="pilihan === '__all__' ? 'Angka gabungan itu hanya gambaran; bonus dinilai per kasir, pilih namanya di atas.' : ''"
        >
          <table class="w-full text-sm">
            <thead class="bg-table-head text-table-head-text">
              <tr>
                <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
                  Level
                </th>
                <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                  Omset diakui minimal
                </th>
                <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
                  Bonus per orang
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr :class="bonus.bonus ? '' : 'bg-muted'">
                <td class="px-3 py-2">
                  <b v-if="!bonus.bonus">Standar kerja ✓</b><template v-else>
                    Standar kerja
                  </template>
                </td>
                <td class="px-3 py-2 text-end num">
                  &lt; {{ fmtRp(80000000) }}
                </td>
                <td class="px-3 py-2 text-end num">
                  —
                </td>
              </tr>
              <tr
                v-for="t in [...BONUS_KASIR].reverse()"
                :key="t.label"
                :class="t.label === bonus.label ? 'bg-muted' : ''"
              >
                <td class="px-3 py-2">
                  <b v-if="t.label === bonus.label">{{ t.label }} ✓</b><template v-else>
                    {{ t.label }}
                  </template>
                </td>
                <td class="px-3 py-2 text-end num">
                  {{ fmtRp(t.min) }}
                </td>
                <td class="px-3 py-2 text-end num">
                  <b v-if="t.label === bonus.label">{{ fmtRp(t.bonus) }}</b><template v-else>
                    {{ fmtRp(t.bonus) }}
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
          <p class="mt-3 text-sm text-muted">
            Angka nett (sebelum tax &amp; service). Pencairan tetap lewat verifikasi SM/CEO dan persetujuan Finance, HRD &amp; CEO — kartu ini hanya menunjukkan posisi capaian.
          </p>
        </AppPanel>

        <AppPanel
          title="Rincian Compliment"
          :flush="compUrut.length > 0"
        >
          <template
            v-if="compUrut.length"
            #description
          >
            {{ compUrut.length }} compliment, dipotong {{ fmtRp(aktif.comp) }} dari Realisasi di atas — dihitung dari <b>Sub Total</b>, tax &amp; service charge tidak ikut.
          </template>
          <p
            v-if="!compUrut.length"
            class="py-4 text-center text-sm text-muted"
          >
            Tidak ada compliment yang membebani pada periode ini.
          </p>
          <div
            v-else
            class="overflow-x-auto"
          >
            <table class="w-full min-w-[36rem] text-sm">
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
                  v-for="c in compUrut"
                  :key="c.id"
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
                    {{ fmtRp(compPotong(c)) }}
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
                    {{ fmtRp(aktif.comp) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </AppPanel>
      </template>
    </template>

    <AppPanel v-else-if="status !== 'pending'">
      <p class="py-4 text-center text-sm text-muted">
        <template v-if="semuaPic.length">
          Tidak ada kasir yang dinilai di sini — {{ semuaPic.length }} nama yang ada semuanya bertim rangkap atau bukan kasir. Halaman ini hanya menilai akun ber-Tim/Keterangan <b>kasir</b> saja; perbaikannya di Office.
        </template>
        <template v-else>
          Belum ada kasir. Muncul otomatis dari Tim/Keterangan di Office.
        </template>
      </p>
    </AppPanel>

    <UButton
      v-if="error"
      label="Muat ulang"
      icon="i-lucide-refresh-cw"
      color="neutral"
      variant="outline"
      class="mt-4"
      loading-auto
      @click="muatUlang()"
    />
  </AppPage>
</template>
