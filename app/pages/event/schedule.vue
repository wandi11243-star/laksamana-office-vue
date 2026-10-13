<!--
  Talent Schedule — month calendar with per-category chips, weekly input,
  recurring rules and monthly generation (`event/index.html:2703-3869`).

  Anti double-booking (F.4): the whole sheet is conflict-checked BEFORE a
  single row is written. One talent also may not appear twice on the same day
  of a weekly sheet (F.5). Daily Entertainment Rules is sleeping code
  (`:3848`) — not revived without an owner decision.
-->
<script setup lang="ts">
import type { JadwalTalent, Talent } from '~/composables/useEvent'
import { createEvent, patchEvent, removeEvent, useDaftarEvent } from '~/composables/useEvent'
import { bentrokJadwal, feeAngka, TAL_CATS } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { hariIni, rupiah, tglPendek } from '~/utils/format'
import { JADWAL_IKON, JADWAL_WARNA, nadaKategori } from '~/utils/status-event'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const toast = useToast()
const me = useMe()
const bolehUbah = computed(() => bolehUbahEvent('schedule', peranEvent(me.value)))

const bulan = ref(hariIni().slice(0, 7))
const labelBulan = computed(() => {
  const [y, m] = bulan.value.split('-').map(Number)
  return new Date(y!, m! - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
})
function geserBulan(n: number) {
  const [y, m] = bulan.value.split('-').map(Number)
  const d = new Date(y!, m! - 1 + n, 1)
  bulan.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const dari = computed(() => `${bulan.value}-01`)
const sampai = computed(() => {
  const [y, m] = bulan.value.split('-').map(Number)
  return `${bulan.value}-${String(new Date(y!, m!, 0).getDate()).padStart(2, '0')}`
})

const query = computed<Record<string, string>>(() => ({ from: dari.value, to: sampai.value }))
const { data: daftar, status, refresh } = useDaftarEvent<JadwalTalent>('schedules', query, 'event-schedule')
const { data: daftarTalent } = useDaftarEvent<Talent>('talents', {}, 'event-schedule-talents')

const jadwal = computed(() => daftar.value.rows)
const namaTalent = (id: string) => daftarTalent.value.rows.find(t => t.id === id)?.name ?? '—'
const katTalent = (id: string) => daftarTalent.value.rows.find(t => t.id === id)?.category ?? ''
/** Legend shows only categories of active talents, like the old client. */
const katAktif = computed(() => {
  const ada = [...new Set(daftarTalent.value.rows.filter(t => t.status === 'Active').map(t => t.category).filter(Boolean))]
  return ada.length ? ada : [...TAL_CATS]
})
/** Smart talent order: active first, most-shown in the loaded window first, then name. */
const talentUrut = computed(() => {
  const hitung = new Map<string, number>()
  for (const j of jadwal.value) hitung.set(j.talent_id, (hitung.get(j.talent_id) ?? 0) + 1)
  return [...daftarTalent.value.rows]
    .filter(t => t.status === 'Active')
    .sort((a, b) => ((hitung.get(b.id) ?? 0) - (hitung.get(a.id) ?? 0)) || a.name.localeCompare(b.name))
})

const perTanggal = computed(() => {
  const m = new Map<string, JadwalTalent[]>()
  for (const j of jadwal.value) {
    const l = m.get(j.date) ?? []
    l.push(j)
    m.set(j.date, l)
  }
  for (const l of m.values()) l.sort((a, b) => String(a.start_time ?? '').localeCompare(String(b.start_time ?? '')))
  return m
})

const DOW = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const selBulan = computed(() => {
  const [y, m] = bulan.value.split('-').map(Number)
  const mundur = (new Date(y!, m! - 1, 1).getDay() + 6) % 7
  const jumlah = new Date(y!, m!, 0).getDate()
  const sel: { tgl: string, num: number, dalam: boolean }[] = []
  const tambah = (t: Date, dalam: boolean) => {
    sel.push({
      tgl: `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`,
      num: t.getDate(),
      dalam,
    })
  }
  for (let i = mundur; i > 0; i--) {
    const d = new Date(y!, m! - 1, 0)
    d.setDate(d.getDate() - i + 1)
    tambah(d, false)
  }
  for (let d = 1; d <= jumlah; d++) tambah(new Date(y!, m! - 1, d), true)
  const sisa = (7 - (sel.length % 7)) % 7
  for (let d = 1; d <= sisa; d++) tambah(new Date(y!, m!, d), false)
  return sel
})

// --- chip info sheet (`schedInfo :2856`) ---
const infoId = ref('')
const info = computed(() => jadwal.value.find(j => j.id === infoId.value) ?? null)
const sheetInfo = computed({ get: () => infoId.value !== '', set: v => (infoId.value = v ? infoId.value : '') })

async function setStatus(st: string) {
  const j = info.value
  if (!j || j.status === st) return
  const lama = j.status
  try {
    await patchEvent('schedules', j.id, { status: st, updatedAt: Date.now() }, daftar.value.versions[j.id])
    toast.add({ title: `${namaTalent(j.talent_id)}: ${lama} → ${st}`, color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}
async function hapusJadwal() {
  const j = info.value
  if (!j) return
  try {
    await removeEvent('schedules', j.id, daftar.value.versions[j.id])
    sheetInfo.value = false
    toast.add({ title: 'Jadwal dihapus', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- add form (`scheduleForm :3412`, `saveSchedule :3497`) ---
const sheetTambah = ref(false)
const f = ref({ tanggal: hariIni(), tipe: TAL_CATS[0] as string, mulai: '20:00', selesai: '23:00' })
const pilihTalent = ref<string[]>([])
const feeBaris = ref<Record<string, number>>({})

function bukaTambah(tgl?: string) {
  f.value = { tanggal: tgl ?? hariIni(), tipe: TAL_CATS[0]!, mulai: '20:00', selesai: '23:00' }
  pilihTalent.value = []
  feeBaris.value = {}
  sheetTambah.value = true
}
const feeDefault = (id: string) => feeAngka(daftarTalent.value.rows.find(t => t.id === id)?.default_fee) || 0

async function simpanTambah() {
  if (!pilihTalent.value.length) {
    toast.add({ title: 'Pilih minimal satu talent dulu.', color: 'error' })
    return
  }
  if (f.value.selesai <= f.value.mulai) {
    toast.add({ title: 'Jam selesai harus > jam mulai.', color: 'error' })
    return
  }
  const bentrok = pilihTalent.value.filter(id => bentrokJadwal(jadwal.value, id, f.value.tanggal, f.value.mulai, f.value.selesai))
  if (bentrok.length) {
    toast.add({ title: `Bentrok di ${tglPendek(f.value.tanggal)}: ${bentrok.map(namaTalent).join(', ')}`, color: 'error' })
    return
  }
  sheetTambah.value = false
  const tglSimpan = f.value.tanggal
  try {
    for (const id of pilihTalent.value) {
      await createEvent('schedules', {
        talent_id: id,
        date: f.value.tanggal,
        type: f.value.tipe,
        start_time: f.value.mulai,
        end_time: f.value.selesai,
        fee: feeBaris.value[id] ?? feeDefault(id),
        status: 'Scheduled',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
    toast.add({ title: `${pilihTalent.value.length} jadwal disimpan`, color: 'success' })
    // Follow the saved date: the calendar jumps to its month.
    bulan.value = tglSimpan.slice(0, 7)
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- weekly input (`mgBuka :3225`, `mgSimpan :3364`) ---
const sheetMinggu = ref(false)
const mg = ref({ mulai: '20:00', selesai: '23:00', tipe: TAL_CATS[0] as string })
const mgPilih = ref<Record<string, string[]>>({})
/** Week offset from the current week; ‹ › move it. */
const mgGeser = ref(0)
function bukaMinggu() {
  mg.value = { mulai: '20:00', selesai: '23:00', tipe: TAL_CATS[0]! }
  mgPilih.value = {}
  mgGeser.value = 0
  sheetMinggu.value = true
}
const tglMinggu = computed(() => {
  const h = hariIni()
  const d = new Date(`${h}T00:00:00`)
  const senin = new Date(d)
  senin.setDate(d.getDate() - ((d.getDay() + 6) % 7) + mgGeser.value * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const t = new Date(senin)
    t.setDate(senin.getDate() + i)
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  })
})
const labelMinggu = computed(() => {
  const t = tglMinggu.value
  return `${tglPendek(t[0]!)} – ${tglPendek(t[6]!)}`
})
/** Already scheduled that day (faded in the picker): clashes are skipped, never rewritten. */
const sudahAda = (tgl: string) => jadwal.value.filter(j => j.date === tgl)
/** New rows only: picks minus what is already there. */
const barisMinggu = computed(() => {
  const keluar: { tgl: string, id: string }[] = []
  for (const [tgl, ids] of Object.entries(mgPilih.value)) {
    const ada = new Set(sudahAda(tgl).map(j => j.talent_id))
    for (const id of [...new Set(ids)]) {
      if (!ada.has(id)) keluar.push({ tgl, id })
    }
  }
  return keluar
})
function toggleMg(tgl: string, id: string) {
  const l = mgPilih.value[tgl] ?? []
  mgPilih.value[tgl] = l.includes(id) ? l.filter(x => x !== id) : [...l, id]
}
async function simpanMinggu() {
  if (mg.value.selesai <= mg.value.mulai) {
    toast.add({ title: 'Jam selesai harus lebih dari jam mulai.', color: 'error' })
    return
  }
  const baris = barisMinggu.value
  if (!baris.length) {
    toast.add({ title: 'Belum ada baris baru untuk disimpan.', color: 'error' })
    return
  }
  const bentrokNyata = baris.filter(b => bentrokJadwal(jadwal.value, b.id, b.tgl, mg.value.mulai, mg.value.selesai))
  const bersih = baris.filter(b => !bentrokJadwal(jadwal.value, b.id, b.tgl, mg.value.mulai, mg.value.selesai))
  if (!bersih.length) {
    toast.add({ title: `Bentrok: ${bentrokNyata.map(b => `${namaTalent(b.id)} ${tglPendek(b.tgl)}`).join(', ')}`, color: 'error' })
    return
  }
  sheetMinggu.value = false
  try {
    for (const b of bersih) {
      await createEvent('schedules', {
        talent_id: b.id,
        date: b.tgl,
        type: mg.value.tipe,
        start_time: mg.value.mulai,
        end_time: mg.value.selesai,
        fee: feeDefault(b.id),
        status: 'Scheduled',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
    toast.add({
      title: bersih.length === baris.length
        ? `${bersih.length} jadwal disimpan`
        : `${bersih.length} tersimpan · ${baris.length - bersih.length} dilewati: ${bentrokNyata.map(b => `${namaTalent(b.id)} ${tglPendek(b.tgl)}`).join(', ')}`,
      color: 'success',
    })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- recurring (`recurringModal :3539`, `genRecurring :3604`) ---
const sheetRutin = ref(false)
const rt = ref({ tipe: TAL_CATS[0] as string, fee: 0, mulai: '20:00', selesai: '23:00', dari: hariIni(), sampai: hariIni() })
const rtTalent = ref<string[]>([])
const rtHari = ref<number[]>([5])
const cariRt = ref('')
function bukaRutin() {
  rt.value = { tipe: TAL_CATS[0]!, fee: 0, mulai: '20:00', selesai: '23:00', dari: hariIni(), sampai: akhirBulanDepan() }
  rtTalent.value = []
  rtHari.value = [5]
  cariRt.value = ''
  sheetRutin.value = true
}
/** Default end: last day of next month. */
function akhirBulanDepan() {
  const h = hariIni()
  const d = new Date(Number(h.slice(0, 4)), Number(h.slice(5, 7)) + 1, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const rtCocok = computed(() => {
  const q = cariRt.value.trim().toLowerCase()
  if (!q) return talentUrut.value
  return talentUrut.value.filter(t => t.name.toLowerCase().includes(q))
})
async function simpanRutin() {
  if (!rtTalent.value.length) {
    toast.add({ title: 'Pilih minimal satu talent.', color: 'error' })
    return
  }
  if (!rtHari.value.length) {
    toast.add({ title: 'Pilih minimal satu hari.', color: 'error' })
    return
  }
  const tgls: string[] = []
  const a = new Date(`${rt.value.dari}T00:00:00`)
  const b = new Date(`${rt.value.sampai}T00:00:00`)
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    if (rtHari.value.includes((d.getDay() + 6) % 7)) {
      tgls.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    }
  }
  const baris: { tgl: string, id: string }[] = []
  for (const tgl of tgls) {
    for (const id of rtTalent.value) {
      if (!bentrokJadwal(jadwal.value, id, tgl, rt.value.mulai, rt.value.selesai)) baris.push({ tgl, id })
    }
  }
  sheetRutin.value = false
  try {
    await createEvent('recurring-rules', {
      talent_ids: rtTalent.value,
      days: rtHari.value,
      type: rt.value.tipe,
      fee: rt.value.fee,
      start_time: rt.value.mulai,
      end_time: rt.value.selesai,
      valid_from: rt.value.dari,
      valid_to: rt.value.sampai,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    for (const r of baris) {
      await createEvent('schedules', {
        talent_id: r.id,
        date: r.tgl,
        type: rt.value.tipe,
        start_time: rt.value.mulai,
        end_time: rt.value.selesai,
        fee: rt.value.fee || feeDefault(r.id),
        status: 'Scheduled',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
    toast.add({ title: `${baris.length} jadwal rutin dibuat`, color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- monthly generate (`monthlyGenModal :3657`, `genMonthly :3766`) ---
const sheetBulan = ref(false)
const bl = ref({ tipe: TAL_CATS[0] as string, mulai: '20:00', selesai: '23:00' })
const blTalent = ref<string[]>([])
const blHari = ref<number[]>([5])
function bukaBulan() {
  bl.value = { tipe: TAL_CATS[0]!, mulai: '20:00', selesai: '23:00' }
  blTalent.value = []
  blHari.value = [5]
  sheetBulan.value = true
}
const rencanaBulan = computed(() => {
  const [y, m] = bulan.value.split('-').map(Number)
  const jumlah = new Date(y!, m!, 0).getDate()
  const tgls: string[] = []
  for (let d = 1; d <= jumlah; d++) {
    const dt = new Date(y!, m! - 1, d)
    if (blHari.value.includes((dt.getDay() + 6) % 7)) {
      tgls.push(`${bulan.value}-${String(d).padStart(2, '0')}`)
    }
  }
  return tgls
})
/** Rows that survive the clash check — the pill counts what will be written, not wishes. */
const barisBulan = computed(() => {
  const keluar: { tgl: string, id: string }[] = []
  for (const tgl of rencanaBulan.value) {
    for (const id of blTalent.value) {
      if (!bentrokJadwal(jadwal.value, id, tgl, bl.value.mulai, bl.value.selesai)) keluar.push({ tgl, id })
    }
  }
  return keluar
})
async function simpanBulan() {
  if (!blTalent.value.length) {
    toast.add({ title: 'Pilih minimal satu talent.', color: 'error' })
    return
  }
  const baris = barisBulan.value
  if (!baris.length) {
    toast.add({ title: 'Semua bentrok — tidak ada jadwal dibuat.', color: 'error' })
    return
  }
  sheetBulan.value = false
  try {
    for (const r of baris) {
      await createEvent('schedules', {
        talent_id: r.id,
        date: r.tgl,
        type: bl.value.tipe,
        start_time: bl.value.mulai,
        end_time: bl.value.selesai,
        fee: feeDefault(r.id),
        status: 'Scheduled',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
    toast.add({ title: `${baris.length} jadwal dibuat`, color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

function togglePilih(list: string[], id: string) {
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id]
}

// --- attendance sheet (`lembarTalentHTML :2848`): talent × day grid for the viewed month ---
const sheetHadir = ref(false)
/** Rows: talents with shows this month (plus deleted ones), then day cells. Cancelled is drawn, never counted. */
const barisHadir = computed(() => {
  const [y, m] = bulan.value.split('-').map(Number)
  const jumlah = new Date(y!, m!, 0).getDate()
  const tgls = Array.from({ length: jumlah }, (_, i) => `${bulan.value}-${String(i + 1).padStart(2, '0')}`)
  const perTalent = new Map<string, JadwalTalent[]>()
  for (const j of jadwal.value) {
    const l = perTalent.get(j.talent_id) ?? []
    l.push(j)
    perTalent.set(j.talent_id, l)
  }
  const baris: { id: string, nama: string, hapus: boolean, tampil: number, selesai: number, fee: number, sel: Map<string, JadwalTalent[]> }[] = []
  for (const [tid, rows] of perTalent) {
    const hidup = rows.filter(j => j.status !== 'Cancelled')
    const t = daftarTalent.value.rows.find(x => x.id === tid)
    baris.push({
      id: tid,
      nama: t?.name ?? 'Talent terhapus',
      hapus: !t,
      tampil: hidup.length,
      selesai: hidup.filter(j => j.status === 'Done').length,
      fee: hidup.reduce((a, j) => a + feeAngka(j.fee), 0),
      sel: new Map(tgls.map(d => [d, rows.filter(j => j.date === d)] as [string, JadwalTalent[]])),
    })
  }
  baris.sort((a, b) => a.nama.localeCompare(b.nama))
  return { tgls, baris }
})
/** Viewers + fee per day: distinct talents with a non-cancelled show. */
const kakiHadir = computed(() => barisHadir.value.tgls.map((d) => {
  const ids = new Set<string>()
  let fee = 0
  for (const b of barisHadir.value.baris) {
    const hidup = (b.sel.get(d) ?? []).filter(j => j.status !== 'Cancelled')
    if (hidup.length) {
      ids.add(b.id)
      fee += hidup.reduce((a, j) => a + feeAngka(j.fee), 0)
    }
  }
  return { tampil: ids.size, fee }
}))
const totalKakiHadir = computed(() => kakiHadir.value.reduce((a, k) => ({ tampil: a.tampil + k.tampil, fee: a.fee + k.fee }), { tampil: 0, fee: 0 }))
</script>

<template>
  <EventGerbang lihat="schedule">
    <AppPage
      title="Talent schedule"
      description="Kalender jadwal · anti double-booking"
    >
      <template #actions>
        <UButton
          v-if="bolehUbah"
          color="neutral"
          variant="outline"
          icon="i-lucide-calendar-plus"
          @click="bukaMinggu()"
        >
          Input mingguan
        </UButton>
        <UButton
          v-if="bolehUbah"
          color="neutral"
          variant="outline"
          icon="i-lucide-repeat"
          @click="bukaRutin()"
        >
          Recurring
        </UButton>
        <UButton
          v-if="bolehUbah"
          color="neutral"
          variant="outline"
          icon="i-lucide-calendar-days"
          @click="bukaBulan()"
        >
          Generate bulanan
        </UButton>
        <UButton
          v-if="bolehUbah"
          color="primary"
          icon="i-lucide-plus"
          @click="bukaTambah()"
        >
          Jadwal
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-clipboard-list"
          @click="sheetHadir = true"
        >
          Lembar kehadiran
        </UButton>
      </template>

      <AppPanel class="mb-4">
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-chevron-left"
            @click="geserBulan(-1)"
          />
          <b class="min-w-32 text-center text-highlighted">{{ labelBulan }}</b>
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-chevron-right"
            @click="geserBulan(1)"
          />
          <UButton
            color="neutral"
            variant="outline"
            @click="bulan = hariIni().slice(0, 7)"
          >
            Hari ini
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            :loading="status === 'pending'"
            @click="refresh()"
          >
            Muat ulang
          </UButton>
        </div>
        <div class="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          <span
            v-for="c in katAktif"
            :key="c"
            class="rounded-full px-2 py-0.5 font-semibold"
            :class="nadaKategori(c, TAL_CATS) === 'info' ? 'bg-info/12 text-info' : nadaKategori(c, TAL_CATS) === 'vip' ? 'bg-vip/12 text-vip' : nadaKategori(c, TAL_CATS) === 'success' ? 'bg-success/12 text-success' : nadaKategori(c, TAL_CATS) === 'warning' ? 'bg-warning/12 text-warning' : nadaKategori(c, TAL_CATS) === 'error' ? 'bg-error/12 text-error' : 'bg-muted text-muted'"
          >
            {{ c }}
          </span>
        </div>
      </AppPanel>

      <AppPanel flush>
        <div class="grid grid-cols-7 border-b border-default">
          <div
            v-for="d in DOW"
            :key="d"
            class="px-1 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-muted"
          >
            {{ d }}
          </div>
        </div>
        <div class="grid grid-cols-7">
          <div
            v-for="sel in selBulan"
            :key="sel.tgl"
            class="min-h-20 border-b border-e border-default p-1 align-top"
            :class="sel.dalam ? '' : 'bg-muted/50'"
          >
            <div class="flex items-center justify-between">
              <span
                class="text-xs font-semibold num"
                :class="sel.tgl === hariIni() ? 'rounded-full bg-primary px-1.5 py-0.5 text-white' : 'text-muted'"
              >{{ sel.num }}</span>
              <UButton
                v-if="bolehUbah && sel.dalam"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-plus"
                class="!px-1"
                @click="bukaTambah(sel.tgl)"
              />
            </div>
            <ul class="mt-1 space-y-0.5">
              <li
                v-for="j in (perTanggal.get(sel.tgl) ?? [])"
                :key="j.id"
              >
                <button
                  type="button"
                  class="block w-full truncate rounded px-1 py-0.5 text-left text-[11px] font-medium"
                  :class="[nadaKategori(katTalent(j.talent_id), TAL_CATS) === 'info' ? 'bg-info/12 text-info' : nadaKategori(katTalent(j.talent_id), TAL_CATS) === 'vip' ? 'bg-vip/12 text-vip' : nadaKategori(katTalent(j.talent_id), TAL_CATS) === 'success' ? 'bg-success/12 text-success' : nadaKategori(katTalent(j.talent_id), TAL_CATS) === 'warning' ? 'bg-warning/12 text-warning' : nadaKategori(katTalent(j.talent_id), TAL_CATS) === 'error' ? 'bg-error/12 text-error' : 'bg-muted text-muted', j.status === 'Cancelled' ? 'opacity-60 line-through' : '']"
                  :title="`${tglPendek(j.date)} ${j.start_time}–${j.end_time}`"
                  @click="infoId = j.id"
                >
                  {{ j.start_time }} {{ namaTalent(j.talent_id) }}
                </button>
              </li>
            </ul>
          </div>
        </div>
      </AppPanel>

      <ResponsiveSheet
        v-model:open="sheetInfo"
        :title="info ? namaTalent(info.talent_id) : 'Jadwal'"
      >
        <div
          v-if="info"
          class="space-y-2 text-sm"
        >
          <p class="text-muted">
            {{ tglPendek(info.date) }} · {{ info.start_time }}–{{ info.end_time }} · {{ info.type }}
          </p>
          <p>Fee: <b class="num">{{ rupiah(Number(info.fee) || 0) }}</b></p>
          <p>
            <AppStatus
              :color="JADWAL_WARNA[String(info.status)] ?? 'neutral'"
              :icon="JADWAL_IKON[String(info.status)]"
              size="sm"
            >
              {{ info.status }}
            </AppStatus>
          </p>
          <div
            v-if="bolehUbah"
            class="flex flex-wrap gap-2 pt-2"
          >
            <UButton
              v-for="st in ['Scheduled', 'Confirmed', 'Done', 'Cancelled']"
              :key="st"
              :color="st === 'Done' ? 'success' : st === 'Cancelled' ? 'error' : 'neutral'"
              :variant="info.status === st ? 'solid' : 'outline'"
              :disabled="info.status === st"
              @click="setStatus(st)"
            >
              {{ st === 'Done' ? 'Tandai done' : st === 'Scheduled' ? 'Kembalikan scheduled' : st }}
            </UButton>
            <UButton
              color="error"
              variant="outline"
              @click="hapusJadwal()"
            >
              Hapus
            </UButton>
          </div>
        </div>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="sheetTambah"
        title="Tambah jadwal"
      >
        <div class="grid gap-3">
          <p
            v-if="jadwal.some(j => j.date === f.tanggal)"
            class="rounded-lg border border-default bg-default p-2.5 text-xs text-muted"
          >
            Sudah dijadwalkan hari ini: {{ jadwal.filter(j => j.date === f.tanggal).map(j => `${j.start_time} ${namaTalent(j.talent_id)}`).join(' · ') }}
          </p>
          <UFormField label="Talent (boleh banyak)">
            <div class="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-field border border-default p-2">
              <button
                v-for="t in talentUrut"
                :key="t.id"
                type="button"
                class="rounded-full border px-2.5 py-1 text-xs font-semibold"
                :class="pilihTalent.includes(t.id) ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-default text-muted'"
                @click="pilihTalent = togglePilih(pilihTalent, t.id)"
              >
                {{ t.name }}
              </button>
            </div>
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Tanggal">
              <UInput
                v-model="f.tanggal"
                type="date"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Tipe performance">
              <USelect
                v-model="f.tipe"
                :items="TAL_CATS.map(c => ({ value: c, label: c }))"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Jam mulai">
              <UInput
                v-model="f.mulai"
                type="time"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Jam selesai">
              <UInput
                v-model="f.selesai"
                type="time"
                class="w-full"
              />
            </UFormField>
          </div>
          <div
            v-for="id in pilihTalent"
            :key="id"
          >
            <UFormField :label="`Fee ${namaTalent(id)}`">
              <UInput
                v-model.number="feeBaris[id]"
                type="number"
                min="0"
                :placeholder="String(feeDefault(id))"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>
        <template #footer>
          <UButton
            color="primary"
            @click="simpanTambah()"
          >
            Simpan {{ pilihTalent.length }} jadwal
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            @click="sheetTambah = false"
          >
            Batal
          </UButton>
        </template>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="sheetMinggu"
        title="Input mingguan"
        :description="labelMinggu"
      >
        <div class="mb-3 flex items-center gap-2">
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-chevron-left"
            aria-label="Minggu sebelumnya"
            @click="mgGeser--"
          />
          <b class="flex-1 text-center text-sm text-highlighted">{{ labelMinggu }}</b>
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-chevron-right"
            aria-label="Minggu berikutnya"
            @click="mgGeser++"
          />
        </div>
        <div class="grid grid-cols-3 gap-3">
          <UFormField label="Jam mulai">
            <UInput
              v-model="mg.mulai"
              type="time"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Jam selesai">
            <UInput
              v-model="mg.selesai"
              type="time"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Tipe">
            <USelect
              v-model="mg.tipe"
              :items="TAL_CATS.map(c => ({ value: c, label: c }))"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="mt-3 grid gap-3 lg:grid-cols-2">
          <div
            v-for="(tgl, i) in tglMinggu"
            :key="tgl"
            class="rounded-field border border-default p-2"
          >
            <p class="mb-1.5 flex items-center justify-between gap-2 text-xs font-bold text-highlighted">
              <span>{{ DOW[i] }}, {{ tglPendek(tgl) }}</span>
              <button
                v-if="(mgPilih[tgl] ?? []).length"
                type="button"
                class="font-semibold text-muted hover:text-error"
                title="Kosongkan hari ini"
                @click="mgPilih[tgl] = []"
              >
                Kosongkan
              </button>
            </p>
            <p
              v-if="sudahAda(tgl).length"
              class="mb-1.5 text-[11px] text-muted"
            >
              Sudah ada: {{ sudahAda(tgl).map(j => namaTalent(j.talent_id)).join(', ') }} — tidak ditulis ulang.
            </p>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="t in talentUrut"
                :key="t.id"
                type="button"
                class="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                :class="(mgPilih[tgl] ?? []).includes(t.id) ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-default text-muted'"
                @click="toggleMg(tgl, t.id)"
              >
                {{ t.name }}
              </button>
            </div>
          </div>
        </div>
        <p class="mt-2 text-xs text-muted num">
          {{ barisMinggu.length }} baris baru
        </p>
        <template #footer>
          <UButton
            color="primary"
            :disabled="!barisMinggu.length"
            @click="simpanMinggu()"
          >
            Simpan jadwal minggu ini
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            @click="sheetMinggu = false"
          >
            Batal
          </UButton>
        </template>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="sheetRutin"
        title="Jadwal recurring"
      >
        <div class="grid gap-3">
          <UFormField label="Cari talent">
            <UInput
              v-model="cariRt"
              placeholder="Ketik nama…"
              icon="i-lucide-search"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Talent (boleh banyak)">
            <div class="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-field border border-default p-2">
              <button
                v-for="t in rtCocok"
                :key="t.id"
                type="button"
                class="rounded-full border px-2.5 py-1 text-xs font-semibold"
                :class="rtTalent.includes(t.id) ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-default text-muted'"
                @click="rtTalent = togglePilih(rtTalent, t.id)"
              >
                {{ t.name }}
              </button>
              <p
                v-if="!rtCocok.length"
                class="text-xs text-muted"
              >
                Tidak ada talent yang cocok.
              </p>
            </div>
          </UFormField>
          <UFormField label="Hari">
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="(d, i) in DOW_CEK"
                :key="d"
                type="button"
                class="rounded-full border px-2.5 py-1 text-xs font-semibold"
                :class="rtHari.includes(i) ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-default text-muted'"
                @click="rtHari = togglePilih(rtHari.map(String), String(i)).map(Number)"
              >
                {{ d }}
              </button>
            </div>
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Tipe">
              <USelect
                v-model="rt.tipe"
                :items="TAL_CATS.map(c => ({ value: c, label: c }))"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Fee / show (0 = bawaan talent)">
              <UInput
                v-model.number="rt.fee"
                type="number"
                min="0"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Jam mulai">
              <UInput
                v-model="rt.mulai"
                type="time"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Jam selesai">
              <UInput
                v-model="rt.selesai"
                type="time"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Dari">
              <UInput
                v-model="rt.dari"
                type="date"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Sampai">
              <UInput
                v-model="rt.sampai"
                type="date"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>
        <template #footer>
          <UButton
            color="primary"
            @click="simpanRutin()"
          >
            Buat jadwal rutin
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            @click="sheetRutin = false"
          >
            Batal
          </UButton>
        </template>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="sheetBulan"
        title="Generate bulanan"
      >
        <div class="grid gap-3">
          <UFormField label="Talent (boleh banyak)">
            <div class="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-field border border-default p-2">
              <button
                v-for="t in talentUrut"
                :key="t.id"
                type="button"
                class="rounded-full border px-2.5 py-1 text-xs font-semibold"
                :class="blTalent.includes(t.id) ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-default text-muted'"
                @click="blTalent = togglePilih(blTalent, t.id)"
              >
                {{ t.name }}
              </button>
            </div>
          </UFormField>
          <UFormField label="Tiap hari dalam minggu">
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="(d, i) in DOW_CEK"
                :key="d"
                type="button"
                class="rounded-full border px-2.5 py-1 text-xs font-semibold"
                :class="blHari.includes(i) ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-default text-muted'"
                @click="blHari = togglePilih(blHari.map(String), String(i)).map(Number)"
              >
                {{ d }}
              </button>
            </div>
          </UFormField>
          <div class="grid grid-cols-3 gap-3">
            <UFormField label="Tipe">
              <USelect
                v-model="bl.tipe"
                :items="TAL_CATS.map(c => ({ value: c, label: c }))"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Jam mulai">
              <UInput
                v-model="bl.mulai"
                type="time"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Jam selesai">
              <UInput
                v-model="bl.selesai"
                type="time"
                class="w-full"
              />
            </UFormField>
          </div>
          <p class="text-xs text-muted num">
            {{ rencanaBulan.length }} tanggal · {{ barisBulan.length }} jadwal akan dibuat tanpa bentrok
          </p>
        </div>
        <template #footer>
          <UButton
            color="primary"
            @click="simpanBulan()"
          >
            Buat jadwal bulan ini
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            @click="sheetBulan = false"
          >
            Batal
          </UButton>
        </template>
      </ResponsiveSheet>
      <ResponsiveSheet
        v-model:open="sheetHadir"
        :title="`Lembar kehadiran — ${labelBulan}`"
      >
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-xs">
            <thead>
              <tr class="border-b border-default text-left">
                <th class="sticky left-0 bg-default px-2 py-1.5 font-bold text-highlighted">
                  Talent
                </th>
                <th class="px-2 py-1.5 text-right font-bold text-highlighted num">
                  Tampil
                </th>
                <th class="px-2 py-1.5 text-right font-bold text-highlighted num">
                  Selesai
                </th>
                <th class="px-2 py-1.5 text-right font-bold text-highlighted num">
                  Fee
                </th>
                <th
                  v-for="(d, i) in barisHadir.tgls"
                  :key="d"
                  class="min-w-14 px-1 py-1.5 text-center font-bold text-muted num"
                >
                  {{ i + 1 }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="b in barisHadir.baris"
                :key="b.id"
                class="border-b border-default"
              >
                <td class="sticky left-0 bg-default px-2 py-1.5 font-semibold text-highlighted">
                  {{ b.nama }}
                </td>
                <td class="px-2 py-1.5 text-right num">
                  {{ b.tampil }}
                </td>
                <td class="px-2 py-1.5 text-right num">
                  {{ b.selesai }}
                </td>
                <td class="px-2 py-1.5 text-right num">
                  {{ rupiah(b.fee) }}
                </td>
                <td
                  v-for="d in barisHadir.tgls"
                  :key="d"
                  class="px-1 py-1.5 text-center"
                >
                  <span
                    v-for="j in (b.sel.get(d) ?? [])"
                    :key="j.id"
                    class="block whitespace-nowrap num"
                    :class="j.status === 'Cancelled' ? 'text-dimmed line-through' : j.status === 'Done' ? 'font-semibold text-success' : 'text-default'"
                    :title="`${j.start_time}–${j.end_time} · ${j.type} · ${j.status}`"
                  >{{ j.start_time }}</span>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="font-bold">
                <td class="sticky left-0 bg-default px-2 py-1.5 text-highlighted">
                  Penampil / hari
                </td>
                <td class="px-2 py-1.5 text-right num">
                  {{ totalKakiHadir.tampil }}
                </td>
                <td class="px-2 py-1.5 text-right num" />
                <td class="px-2 py-1.5 text-right num">
                  {{ rupiah(totalKakiHadir.fee) }}
                </td>
                <td
                  v-for="(k, i) in kakiHadir"
                  :key="i"
                  class="px-1 py-1.5 text-center num"
                >
                  {{ k.tampil || '' }}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p class="mt-2 text-xs text-muted">
          Batal digambar tapi tidak dihitung. Talent terhapus tetap baris sendiri.
        </p>
        <template #footer>
          <UButton
            label="Tutup"
            color="neutral"
            variant="soft"
            size="xl"
            @click="sheetHadir = false"
          />
        </template>
      </ResponsiveSheet>
    </AppPage>
  </EventGerbang>
</template>
