<!--
  Event › Talent Schedule — two views of one roster:
    Kalender        the month grid (KalenderBulan) with cards in category colour;
    Tabel › Minggu  the roster sheet (EventTalentLembar): talents × Monday–Sunday;
    Tabel › Bulan   the monthly attendance table (EventTalentBulan).

  Everything a person does is a DRAFT (`app/utils/event-jadwal.ts`): a new row,
  a change to a saved row, or the deletion of one. Drafts survive switching
  weeks, months and views, and are written together by "Simpan jadwal"
  (`POST /event/schedules/batch`, all or nothing, at most 300). Leaving the page
  with drafts asks first. Clashes (same talent, same date, overlapping hours,
  across EVERY loaded day) are painted red and block saving; the server checks
  them again.

  Data is loaded by the date range the view needs (`useJadwalRentang`), not by
  month, so a week that crosses a month is whole.

  Default hours come from the `jamTalent` setting. Only SAVED hours are used;
  the suggestion shown on the Jam talent screen is never applied here. When the
  setting is missing (404) or empty the page works with no defaults.

  The old Input mingguan, Recurring and Generate bulanan are gone (their
  weekday picker was off by one day); "Isi otomatis" and "Salin minggu lalu"
  replace them and also only produce drafts. A drag in the calendar moves one
  saved row to another day after a confirmation (written at once, with the
  clash check); Done and Cancelled rows are locked.
-->
<script setup lang="ts">
import type { Acara, Talent } from '~/composables/useEvent'
import { batchJadwal, getJamTalent, useDaftarEvent } from '~/composables/useEvent'
import { useJadwalRentang } from '~/composables/useJadwalRentang'
import type { BarisEf, Draf, HasilIsi, NilaiJadwal, SusunanBatch } from '~/utils/event-jadwal'
import {
  STATUS_TERKUNCI, bacaGalatBatch, barisEfektif, barisHidup, bentrokDengan, bentrokEf, buangSatu, dokumenAdaIsi, dokumenKosong,
  daftarKategori, draftBerjam, hapusBaris, hitungDraf, idBarisEms, jamBawaan, jamSlotKedua, nilaiBaru, pesanBatch, rapikanDokumen,
  ringkasDraf, rentangTercakup, salinMingguLalu, seninEms, setNilai, sudahAdaSel, susunBatch, susunGrup, tambahBaru, tandaiBasi, tujuhHariEms,
} from '~/utils/event-jadwal'
import { TAL_CATS, tglWIB } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehBukaEvent, bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { fTglP, hariIni, tglPendek } from '~/utils/format'
import { geserTgl, hariKe, rentangBulan, tglDariHariKe } from '~/utils/kalender'
import { GAYA_NADA, gayaNada } from '~/utils/kalender-warna'
import { nadaKategori } from '~/utils/status-event'
import { isVersiWajib } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const toast = useToast()
const me = useMe()
const route = useRoute()
const router = useRouter()
const peran = computed(() => peranEvent(me.value))
const bolehUbah = computed(() => bolehUbahEvent('schedule', peran.value))
const bolehAturJam = computed(() => bolehBukaEvent('jamtalent', peran.value))

// ---------------------------------------------------------------- view + navigation
type Tampilan = 'kalender' | 'tabel'
type Tabel = 'minggu' | 'bulan'
const KUNCI_TAMPIL = 'event-jadwal-tampilan'
/** Remembered per device; storage can be blocked, so every access is guarded. */
function bacaTampil(): { tampilan: Tampilan, tabel: Tabel } {
  try {
    const s = JSON.parse(localStorage.getItem(KUNCI_TAMPIL) ?? '{}')
    return { tampilan: s.tampilan === 'tabel' ? 'tabel' : 'kalender', tabel: s.tabel === 'bulan' ? 'bulan' : 'minggu' }
  }
  catch {
    return { tampilan: 'kalender', tabel: 'minggu' }
  }
}
const awal = bacaTampil()
const tampilan = ref<Tampilan>(awal.tampilan)
const tabel = ref<Tabel>(awal.tabel)
watch([tampilan, tabel], () => {
  try {
    localStorage.setItem(KUNCI_TAMPIL, JSON.stringify({ tampilan: tampilan.value, tabel: tabel.value }))
  }
  catch { /* private window or blocked storage: the choice just is not remembered */ }
})
const modeMinggu = computed(() => tampilan.value === 'tabel' && tabel.value === 'minggu')

const bulan = ref(hariIni().slice(0, 7))
const senin = ref(seninEms(hariIni()))
/** One value for ‹ Hari Ini ›: the Monday in week mode, the month otherwise; the other one follows. */
const nav = computed({
  get: () => (modeMinggu.value ? senin.value : bulan.value),
  set: (v: string) => {
    if (modeMinggu.value) {
      senin.value = v
      bulan.value = geserTgl(v, 3).slice(0, 7)
    }
    else {
      bulan.value = v
      senin.value = v === hariIni().slice(0, 7) ? seninEms(hariIni()) : seninEms(`${v}-01`)
    }
  },
})
const hariMinggu = computed(() => tujuhHariEms(senin.value))
const labelMinggu = computed(() => `Minggu ${fTglP(hariMinggu.value[0])} – ${fTglP(hariMinggu.value[6])} ${hariMinggu.value[6]!.slice(0, 4)}`)
const rentangLihat = computed(() => (modeMinggu.value ? { a: hariMinggu.value[0]!, b: hariMinggu.value[6]! } : rentangBulan(bulan.value)))

// ---------------------------------------------------------------- data
const { data: dataTalent } = useDaftarEvent<Talent>('talents', {}, 'event-schedule-talents')
const { data: dataAcara } = useDaftarEvent<Acara>('events', {}, 'event-schedule-acara')
const pool = useJadwalRentang()
watch(rentangLihat, r => pool.pastikan(r.a, r.b), { immediate: true })

const talents = computed(() => dataTalent.value.rows)
const talentById = computed(() => new Map(talents.value.map(t => [t.id, t])))
const namaTalent = (id: string) => talentById.value.get(id)?.name ?? '(talent terhapus)'
const urutKategori = computed(() => daftarKategori(TAL_CATS, talents.value))
const talentAktif = computed(() => talents.value.filter(t => t.status === 'Active'))
/** Legend: categories of active talents, like the old page. */
const katLegenda = computed(() => {
  const ada = new Set(talentAktif.value.map(t => t.category).filter(Boolean))
  const l = urutKategori.value.filter(k => ada.has(k))
  return l.length ? l : [...TAL_CATS]
})
const acaraPilihan = computed(() => dataAcara.value.rows
  .map(a => ({ id: a.id, title: a.title, tgl: tglWIB(a.start_datetime) }))
  .sort((a, b) => b.tgl.localeCompare(a.tgl)))

// default hours (only what is SAVED is used)
const doc = ref(dokumenKosong())
const docMuat = ref(false)
const docGalat = ref('')
async function muatDoc() {
  docGalat.value = ''
  try {
    doc.value = rapikanDokumen((await getJamTalent()).data)
  }
  catch (e) {
    doc.value = dokumenKosong()
    // 404 = the API has no such setting yet: work with empty defaults, say nothing.
    if ((e as { statusCode?: number })?.statusCode !== 404) docGalat.value = apiErrorMessage(e)
  }
  finally {
    docMuat.value = true
  }
}
onMounted(muatDoc)
const petunjukJam = computed(() => docMuat.value && !dokumenAdaIsi(doc.value))

// category filter
const SEMUA = '__semua'
const fKat = ref(SEMUA)
const katAktifFilter = computed(() => (fKat.value === SEMUA ? '' : fKat.value))
const opsiKat = computed(() => [{ value: SEMUA, label: 'Semua kategori' }, ...urutKategori.value.map(k => ({ value: k, label: k }))])
const katBaris = (r: Pick<BarisEf, 'talent_id' | 'performance_type'>) => talentById.value.get(r.talent_id)?.category ?? r.performance_type

// ---------------------------------------------------------------- drafts
const draf = ref<Draf[]>([])
const ef = computed(() => barisEfektif(pool.rows.value, draf.value))
const efTampil = computed(() => (katAktifFilter.value ? ef.value.filter(r => katBaris(r) === katAktifFilter.value) : ef.value))
const bentrokLokal = computed(() => bentrokEf(ef.value, draf.value))
const tandaServer = ref(new Set<string>())
watch(draf, () => {
  if (tandaServer.value.size) tandaServer.value = new Set()
})
const tanda = computed(() => new Set([...bentrokLokal.value, ...tandaServer.value]))
const ringkas = computed(() => (draf.value.length ? ringkasDraf(draf.value) : ''))

const dalamRentang = (r: { date: string }) => r.date >= rentangLihat.value.a && r.date <= rentangLihat.value.b
const efLihat = computed(() => efTampil.value.filter(dalamRentang))
const jumlah = computed(() => barisHidup(efLihat.value).length)
const rowsBulanTersimpan = computed(() => pool.rows.value.filter(j => j.date >= rentangBulan(bulan.value).a && j.date <= rentangBulan(bulan.value).b
  && (!katAktifFilter.value || katBaris(j) === katAktifFilter.value)))

const grupMinggu = computed(() => susunGrup(
  katAktifFilter.value ? talents.value.filter(t => t.category === katAktifFilter.value) : talents.value,
  efLihat.value, hariMinggu.value, urutKategori.value,
))
const grupAktif = computed(() => susunGrup(talentAktif.value, [], [], urutKategori.value))

const savedInfo = (kunci: string) => {
  const baris = pool.rows.value.find(j => String(j.id) === kunci)
  return baris ? { baris, versi: pool.versi.value[kunci] } : undefined
}
const nilaiDari = (r: BarisEf): NilaiJadwal => ({
  talent_id: r.talent_id, date: r.date, start_time: r.start_time, end_time: r.end_time, performance_type: r.performance_type,
  fee: r.fee, status: r.status, event_id: r.event_id, notes: r.notes,
})
const barisByKunci = (kunci: string) => ef.value.find(r => r.kunci === kunci)

function tambahDraf(n: NilaiJadwal) {
  draf.value = tambahBaru(draf.value, n, idBarisEms())
}

/** An empty cell: fill with the default hours at once; no default → the editor with empty hours. */
function isiSel(talentId: string, tgl: string) {
  const t = talentById.value.get(talentId)
  if (!t || !bolehUbah.value) return
  const j = jamBawaan(doc.value, t.id, t.category, tgl)
  if (j) tambahDraf(nilaiBaru(t, tgl, j.mulai, j.selesai))
  else editorBaru.value = nilaiBaru(t, tgl, '', '')
}
/** `+`: a second show on the same day, in the first category slot that does not overlap. */
function tambahKedua(talentId: string, tgl: string) {
  const t = talentById.value.get(talentId)
  if (!t || !bolehUbah.value) return
  const j = jamSlotKedua(doc.value, t.id, t.category, tgl, ef.value)
  if (j) tambahDraf(nilaiBaru(t, tgl, j.mulai, j.selesai))
  else editorBaru.value = nilaiBaru(t, tgl, '', '')
}
/** Day sheet chip: first show = default hours, next ones = free slot; empty hours when nothing fits. */
function tambahDiHari(talentId: string, tgl: string) {
  const t = talentById.value.get(talentId)
  if (!t || !bolehUbah.value) return
  const j = sudahAdaSel(ef.value, talentId, tgl)
    ? jamSlotKedua(doc.value, t.id, t.category, tgl, ef.value)
    : jamBawaan(doc.value, t.id, t.category, tgl)
  tambahDraf(nilaiBaru(t, tgl, j?.mulai ?? '', j?.selesai ?? ''))
}
function ubahJamHari(kunci: string, mulai: string, selesai: string) {
  const r = barisByKunci(kunci)
  if (!r || !bolehUbah.value) return
  draf.value = setNilai(draf.value, kunci, { ...nilaiDari(r), start_time: mulai, end_time: selesai }, savedInfo(kunci))
}
function hapusBarisHari(kunci: string) {
  draf.value = hapusBaris(draf.value, kunci, savedInfo(kunci))
}
function pulihBaris(kunci: string) {
  draf.value = buangSatu(draf.value, kunci)
}

// ---------------------------------------------------------------- editor
const editorKunci = ref<string | null>(null)
/** An empty cell without default hours: not a draft until "Terapkan". */
const editorBaru = ref<NilaiJadwal | null>(null)
const sheetEditor = computed({
  get: () => editorKunci.value !== null || editorBaru.value !== null,
  set: (v: boolean) => {
    if (!v) {
      editorKunci.value = null
      editorBaru.value = null
    }
  },
})
const targetEditor = computed(() => {
  if (editorBaru.value) return { kunci: '', nilai: editorBaru.value, baru: true, draf: null, basi: false }
  const r = editorKunci.value ? barisByKunci(editorKunci.value) : undefined
  return r ? { kunci: r.kunci, nilai: nilaiDari(r), baru: false, draf: r.draf, basi: r.basi } : null
})
function bukaBaris(kunci: string) {
  const r = barisByKunci(kunci)
  if (!r) return
  if (r.draf === 'hapus') {
    if (bolehUbah.value) {
      pulihBaris(kunci)
      toast.add({ title: 'Penghapusan dibatalkan', color: 'neutral' })
    }
    return
  }
  editorKunci.value = kunci
}
function terapkanEditor(n: NilaiJadwal) {
  if (editorBaru.value) {
    tambahDraf(n)
    return
  }
  const k = editorKunci.value
  if (k) draf.value = setNilai(draf.value, k, n, savedInfo(k))
}
function hapusEditor() {
  const k = editorKunci.value
  if (k) draf.value = hapusBaris(draf.value, k, savedInfo(k))
}
function buangEditor() {
  if (editorKunci.value) pulihBaris(editorKunci.value)
}

// ---------------------------------------------------------------- day sheet
const hariBuka = ref<string | null>(null)
const sheetHari = computed({ get: () => hariBuka.value !== null, set: (v: boolean) => {
  if (!v) hariBuka.value = null
} })
const rowsHari = computed(() => (hariBuka.value ? ef.value.filter(r => r.date === hariBuka.value) : []))

// ---------------------------------------------------------------- bulk helpers
async function salinLalu() {
  const a = geserTgl(senin.value, -7)
  const b = geserTgl(senin.value, -1)
  await pool.pastikan(a, b)
  if (!rentangTercakup(pool.dimuat.value, a, b)) {
    toast.add({ title: 'Jadwal minggu lalu belum bisa dimuat', description: 'Coba lagi sebentar.', color: 'error' })
    return
  }
  const h = salinMingguLalu(ef.value, talents.value, senin.value, katAktifFilter.value)
  terapkanIsi(h, `dari minggu lalu${katAktifFilter.value ? ` (${katAktifFilter.value})` : ''}`)
}
function terapkanIsi(h: HasilIsi, asal: string) {
  if (h.baru.length) draf.value = [...draf.value, ...h.baru.map(nilai => ({ kunci: idBarisEms(), nilai }))]
  const bagian = [
    `${h.baru.length} draf ${asal}`,
    h.dilewati ? `${h.dilewati} dilewati (sudah ada jadwal)` : '',
    h.tanpaJam ? `${h.tanpaJam} dilewati (tanpa jam bawaan)` : '',
    h.nonaktif ? `${h.nonaktif} dilewati (talent nonaktif)` : '',
  ].filter(Boolean)
  toast.add({ title: bagian.join(' · '), description: h.baru.length ? 'Belum tersimpan: tekan Simpan jadwal.' : undefined, color: h.baru.length ? 'success' : 'warning' })
}
const sheetOtomatis = ref(false)
const rentangOtomatis = computed(() => ({ dari: modeMinggu.value ? senin.value : rentangBulan(bulan.value).a, sampai: rentangBulan(bulan.value).b }))

// ---------------------------------------------------------------- save
const menyimpan = ref(false)

async function simpan() {
  if (!bolehUbah.value || !draf.value.length || menyimpan.value) return
  if (draf.value.some(d => d.basi)) {
    toast.add({ title: 'Ada baris yang diubah orang lain', description: 'Buka barisnya (bertanda !) lalu tekan Terapkan, atau buang perubahannya.', color: 'warning' })
    return
  }
  const jamSalah = draftBerjam(ef.value)
  if (jamSalah.length) {
    const r = barisByKunci(jamSalah[0]!.kunci)
    toast.add({ title: `${r ? `${namaTalent(r.talent_id)}, ${tglPendek(r.date)}` : 'Satu baris'}: ${jamSalah[0]!.pesan}`, description: jamSalah.length > 1 ? `Dan ${jamSalah.length - 1} baris lain.` : undefined, color: 'error' })
    return
  }
  if (tanda.value.size) {
    toast.add({ title: 'Masih ada jadwal yang bentrok', description: 'Baris bertanda merah harus dibereskan dulu.', color: 'error' })
    return
  }
  const susunan = susunBatch(draf.value, Date.now())
  const p = pesanBatch(susunan)
  if (p) {
    toast.add({ title: p, color: 'error' })
    return
  }
  menyimpan.value = true
  try {
    await batchJadwal({ create: susunan.create, update: susunan.update, delete: susunan.delete })
    const n = susunan.total
    draf.value = []
    sheetHari.value = false
    toast.add({ title: `${n} perubahan jadwal tersimpan`, color: 'success' })
    await pool.muatUlang()
  }
  catch (e) {
    await tanganiGalat(e, susunan)
  }
  finally {
    menyimpan.value = false
  }
}

/** A refused batch: drafts stay; the page says which row, refreshes, and marks cells. */
async function tanganiGalat(e: unknown, s?: SusunanBatch) {
  const g = bacaGalatBatch(e, s)
  const nama = (id?: string) => {
    const r = id ? barisByKunci(id) : undefined
    const j = id ? pool.rows.value.find(x => String(x.id) === id) : undefined
    const t = r?.talent_id ?? j?.talent_id
    const d = r?.date ?? j?.date
    return t ? `${namaTalent(t)}, ${d ? tglPendek(d) : ''}` : 'Satu baris'
  }
  if (g.kode === 'version_conflict' || isVersiWajib(e)) {
    const sebut = nama(g.id)
    await pool.muatUlang()
    if (g.id) {
      const segar = savedInfo(g.id)
      draf.value = tandaiBasi(draf.value, g.id, segar ?? null)
    }
    toast.add({
      title: `${sebut} sudah diubah orang lain`,
      description: 'Tidak ada yang tersimpan. Draf Anda tetap ada dan jadwal dimuat ulang: periksa baris itu (bertanda !), terapkan lagi, lalu simpan.',
      color: 'warning',
    })
    return
  }
  if (g.kode === 'jadwal_bentrok') {
    tandaServer.value = new Set(g.tanda)
    toast.add({ title: 'Bentrok dengan jadwal lain di server', description: 'Tidak ada yang tersimpan. Baris yang bentrok ditandai merah.', color: 'error' })
    await pool.muatUlang()
    return
  }
  if (g.kode === 'not_found') {
    const sebut = nama(g.id)
    if (g.id) draf.value = tandaiBasi(draf.value, g.id, null)
    await pool.muatUlang()
    toast.add({ title: `${sebut} sudah dihapus orang lain`, description: 'Draf untuk baris itu dibuang. Sisanya belum tersimpan.', color: 'warning' })
    return
  }
  if (g.kode === 'validation_failed' && g.baris.length) {
    tandaServer.value = new Set(g.tanda)
    const b = g.baris[0]!
    toast.add({
      title: `${b.kunci ? nama(b.kunci) : 'Satu baris'}: ${b.alasan}`,
      description: g.baris.length > 1 ? `Dan ${g.baris.length - 1} baris lain.` : undefined,
      color: 'error',
    })
    return
  }
  toast.add({ title: apiErrorMessage(e), color: 'error' })
}

function buangSemua() {
  if (!draf.value.length) return
  if (!window.confirm(`Buang semua draf (${ringkasDraf(draf.value)})? Jadwal yang sudah tersimpan tidak berubah.`)) return
  draf.value = []
}

// ---------------------------------------------------------------- calendar view
const MAKS_KARTU = 4
const efKalender = computed(() => barisHidup(efLihat.value))
const kartuHari = (tgl: string) => efKalender.value.filter(r => r.date === tgl).sort((a, b) => a.start_time.localeCompare(b.start_time))
const gayaKartu = (r: BarisEf) => (tanda.value.has(r.kunci)
  ? `${GAYA_NADA.error!.kartu} ring-1 ring-error`
  : gayaNada(nadaKategori(katBaris(r), urutKategori.value)).kartu)
const bisaGeser = (r: BarisEf) => bolehUbah.value && !r.draf && !STATUS_TERKUNCI.includes(r.status)
const judulKartu = (r: BarisEf) => `${namaTalent(r.talent_id)} · ${r.start_time ? `${r.start_time}–${r.end_time}` : 'jam belum diisi'} · ${r.performance_type} · ${r.status}${r.draf ? ' · draf' : ''}`

/** Drag a saved card to another day: confirmed, clash-checked, written at once. */
async function pindah({ id, dari, ke }: { id: string, dari: string, ke: string }) {
  const r = barisByKunci(id)
  if (!r || ke === dari || !bisaGeser(r)) return
  const b = bentrokDengan(ef.value, r.talent_id, ke, r.start_time, r.end_time, r.kunci)
  if (b) {
    toast.add({ title: `Bentrok: ${namaTalent(r.talent_id)} sudah punya jadwal ${b.start_time}–${b.end_time} di ${tglPendek(ke)}.`, color: 'error' })
    return
  }
  if (!window.confirm(`Pindahkan ${namaTalent(r.talent_id)} (${r.start_time}–${r.end_time}) dari ${tglPendek(dari)} ke ${tglPendek(ke)}? Jam dan fee tidak berubah.`)) return
  try {
    await batchJadwal({ create: [], update: [{ id, version: pool.versi.value[id] as string | number, fields: { date: ke } }], delete: [] })
    toast.add({ title: `${namaTalent(r.talent_id)} dipindah ke ${tglPendek(ke)}`, color: 'success' })
    await pool.muatUlang()
  }
  catch (e) {
    await tanganiGalat(e)
  }
}

// ---------------------------------------------------------------- ?tgl=YYYY-MM-DD
function bukaTanggal(v: unknown) {
  const t = Array.isArray(v) ? v[0] : v
  if (typeof t !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t) || tglDariHariKe(hariKe(t)) !== t) return
  bulan.value = t.slice(0, 7)
  senin.value = seninEms(t)
  hariBuka.value = t
  router.replace({ query: {} })
}
onMounted(() => bukaTanggal(route.query.tgl))
watch(() => route.query.tgl, v => v && bukaTanggal(v))

// ---------------------------------------------------------------- leaving with drafts
function cegahTutup(e: BeforeUnloadEvent) {
  if (draf.value.length) e.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', cegahTutup))
onBeforeUnmount(() => window.removeEventListener('beforeunload', cegahTutup))
onBeforeRouteLeave(() => {
  if (draf.value.length && !window.confirm(`Ada draf jadwal yang belum disimpan (${ringkasDraf(draf.value)}). Tinggalkan halaman ini? Draf akan hilang.`)) return false
})
const jumlahBentrok = computed(() => tanda.value.size)
const hitung = computed(() => hitungDraf(draf.value))
</script>

<template>
  <EventGerbang lihat="schedule">
    <AppPage
      title="Talent schedule"
      description="Kalender dan lembar roster · anti double-booking"
    >
      <template #actions>
        <AppSeg
          v-model="tampilan"
          size="sm"
          :options="[{ value: 'kalender', label: 'Kalender', icon: 'i-lucide-calendar-days' }, { value: 'tabel', label: 'Tabel', icon: 'i-lucide-table' }]"
        />
        <AppSeg
          v-if="tampilan === 'tabel'"
          v-model="tabel"
          size="sm"
          :options="[{ value: 'minggu', label: 'Minggu' }, { value: 'bulan', label: 'Bulan' }]"
        />
        <USelect
          v-model="fKat"
          :items="opsiKat"
          class="w-44"
          aria-label="Kategori talent"
        />
        <KalenderNav
          v-model="nav"
          :mode="modeMinggu ? 'minggu' : 'bulan'"
        />
      </template>

      <UAlert
        v-if="pool.galat.value"
        color="error"
        variant="soft"
        :title="apiErrorMessage(pool.galat.value)"
        class="mb-4"
        :actions="[{ label: 'Coba lagi', onClick: () => pool.muatUlang() }]"
      />
      <UAlert
        v-if="docGalat"
        color="warning"
        variant="soft"
        title="Jam bawaan tidak terbaca"
        :description="`${docGalat} Klik sel kosong akan membuka editor tanpa jam.`"
        class="mb-4"
        :actions="[{ label: 'Coba lagi', onClick: () => muatDoc() }]"
      />
      <UAlert
        v-else-if="petunjukJam && bolehUbah"
        color="info"
        variant="soft"
        title="Jam bawaan belum diatur"
        description="Selama belum ada, mengklik sel kosong membuka editor dengan jam kosong. Atur jam per kategori agar sel terisi otomatis."
        class="mb-4"
        :actions="bolehAturJam ? [{ label: 'Buka Jam talent', to: '/event/jam-talent' }] : []"
      />

      <div
        v-if="bolehUbah"
        class="mb-4 flex flex-wrap items-center gap-2"
      >
        <UButton
          v-if="modeMinggu"
          color="neutral"
          variant="outline"
          icon="i-lucide-copy"
          @click="salinLalu()"
        >
          Salin minggu lalu
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-wand-sparkles"
          @click="sheetOtomatis = true"
        >
          Isi otomatis
        </UButton>
        <UButton
          v-if="bolehAturJam"
          color="neutral"
          variant="ghost"
          icon="i-lucide-timer"
          to="/event/jam-talent"
        >
          Jam talent
        </UButton>
        <span
          v-if="pool.memuat.value"
          class="text-xs text-muted"
        >Memuat jadwal…</span>
      </div>

      <KalenderBulan
        v-if="tampilan === 'kalender'"
        :bulan="bulan"
        boleh-klik
        :boleh-seret="bolehUbah"
        :judul-klik="bolehUbah ? 'Klik untuk membuka dan mengatur jadwal hari itu' : 'Klik untuk melihat jadwal hari itu'"
        @klik-tgl="hariBuka = $event"
        @lepas="pindah"
      >
        <template #legenda>
          <span
            v-for="k in katLegenda"
            :key="k"
            class="flex items-center gap-1.5"
          ><span
            class="h-3 w-1 rounded-none"
            :class="gayaNada(nadaKategori(k, urutKategori)).swatch"
          />{{ k }}</span>
          <span class="flex items-center gap-1.5 text-muted"><span class="size-2.5 rounded-sm outline-1 -outline-offset-1 outline-dashed outline-muted" />Draf</span>
        </template>
        <template #total>
          {{ jumlah }} jadwal bulan ini
        </template>
        <template #sel="{ tgl }">
          <KalenderKartu
            v-for="r in kartuHari(tgl).slice(0, MAKS_KARTU)"
            :key="r.kunci"
            :gaya="gayaKartu(r)"
            :draf="!!r.draf"
            :judul="`${r.start_time || '--:--'} ${namaTalent(r.talent_id)}`"
            :dicoret="r.status === 'Cancelled'"
            :title="judulKartu(r)"
            :seret-id="bisaGeser(r) ? r.kunci : ''"
            :tgl="tgl"
            @klik="bukaBaris(r.kunci)"
          />
          <p
            v-if="kartuHari(tgl).length > MAKS_KARTU"
            class="px-1 text-[11px] text-muted num"
          >
            +{{ kartuHari(tgl).length - MAKS_KARTU }} lagi
          </p>
        </template>
      </KalenderBulan>

      <EventTalentLembar
        v-else-if="tabel === 'minggu'"
        :hari="hariMinggu"
        :grup="grupMinggu"
        :rows="efLihat"
        :doc="doc"
        :bentrok="tanda"
        :urut-kategori="urutKategori"
        :boleh-ubah="bolehUbah"
        :judul="labelMinggu"
        :jumlah="jumlah"
        @kosong="isiSel"
        @pilih="bukaBaris"
        @tambah="tambahKedua"
        @hari="hariBuka = $event"
      />

      <EventTalentBulan
        v-else
        :bulan="bulan"
        :rows="rowsBulanTersimpan"
        :talents="talents"
        @pilih="bukaBaris"
      />

      <!-- draft bar -->
      <div
        v-if="bolehUbah && draf.length"
        class="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-panel bg-default px-4 py-3 shadow-panel ring-1 ring-default lg:bottom-4"
        role="region"
        aria-label="Draf jadwal"
      >
        <p class="min-w-0 flex-1 text-sm">
          <b class="num text-highlighted">{{ hitung.baru }} baru · {{ hitung.ubah }} diubah · {{ hitung.hapus }} dihapus</b>
          <span class="block text-xs text-muted">Belum tersimpan.<template v-if="jumlahBentrok">
            <b class="text-error"> {{ jumlahBentrok }} baris bentrok: bereskan dulu.</b></template></span>
        </p>
        <UButton
          color="neutral"
          variant="outline"
          :disabled="menyimpan"
          @click="buangSemua()"
        >
          Buang
        </UButton>
        <UButton
          color="primary"
          icon="i-lucide-save"
          :loading="menyimpan"
          @click="simpan()"
        >
          Simpan jadwal
        </UButton>
      </div>

      <EventTalentSel
        v-model:open="sheetEditor"
        :target="targetEditor"
        :nama-talent="targetEditor ? namaTalent(targetEditor.nilai.talent_id) : ''"
        :doc="doc"
        :kategori="urutKategori"
        :acara="acaraPilihan"
        :semua="ef"
        :boleh-ubah="bolehUbah"
        @terapkan="terapkanEditor"
        @hapus="hapusEditor"
        @buang="buangEditor"
      />

      <EventTalentHari
        v-model:open="sheetHari"
        :tgl="hariBuka"
        :rows="rowsHari"
        :grup="grupAktif"
        :bentrok="tanda"
        :boleh-ubah="bolehUbah"
        :ringkas="ringkas"
        :menyimpan="menyimpan"
        :nama="namaTalent"
        @tambah="tambahDiHari"
        @jam="ubahJamHari"
        @detail="bukaBaris"
        @hapus="hapusBarisHari"
        @pulih="pulihBaris"
        @simpan="simpan()"
      />

      <EventTalentOtomatis
        v-model:open="sheetOtomatis"
        :grup="grupAktif"
        :talents="talentAktif"
        :rows="ef"
        :doc="doc"
        :memuat="pool.memuat.value"
        :awal="rentangOtomatis"
        @muat="(a, b) => pool.pastikan(a, b)"
        @terapkan="h => terapkanIsi(h, 'dari Isi otomatis')"
      />
    </AppPage>
  </EventGerbang>
</template>
