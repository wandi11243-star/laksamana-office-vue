<!--
  Reservasi › Atur denah & meja (owner request, Nov 2026: "kalau mau edit meja
  itu bisa di setting di side bar baru saja, jadi di dashboard tidak perlu
  ada"). Everything that CHANGES the plan lives here, out of the day-of
  dashboard, which only reads it. Three tabs (?tab=templat|tanggal|meja), so
  editing a TEMPLATE and editing ONE DATE are never mixed up (owner, Nov 2026):
    - Template denah — every template (a Lantai 1 + Lantai 2 pair), which days
      use it; add one (both floors at once, copied), delete an unused custom
      one; "Template per hari" sets which template each day of the week uses
      (`master.layoutHari`); Lt.1 / Lt.2 opens the template editor, which saves
      into the template only (every day and date using it changes);
    - Denah per tanggal — pick a date + floor; swap the template that date uses
      (and the list of special dates), or move tables for that date only. The
      editor here saves the date's own plan only; the template is not touched;
    - Database meja — every table of every plan in one list, with its
      capacity (min–max). A capacity saved here goes into EVERY template and
      date plan that holds the table, and the master `tables` list is rewritten
      from the plans, so Marketing / VIP read the same tables the floor has.
  Each write carries its section's own version (If-Match); a change in between
  reloads instead of overwriting.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useMediaQuery } from '@vueuse/core'
import { postAudit, putDenah, putSection, useDenah, useSectionVersi } from '~/composables/useReservasi'
import { bolehAksi, bolehBuka, roleReservasi } from '~/utils/layar/reservasi'
import type { GrupTemplat, LayoutDenah, MejaDenah } from '~/utils/venue-layouts'
import {
  LABEL_ZONA, NAMA_HARI, URUT_HARI, adaDenahTanggal, allLayoutKeys, capDenah, capMax, capMin, dayTypeLayoutLt,
  defaultDayTypeLt, denahTanggalBaru, getLayout, GRUP_BAWAAN, grupDari, grupTemplat, hariWeekend, jejakDenah, kapasitasLayout,
  keyTanggal, kunciTemplatBaru, lantaiLayout, layoutName, layoutTanggal, ltCfg, ovLantai, parseKeyTanggal, templatHari,
} from '~/utils/venue-layouts'
import { hariIni, tglPanjang, tglPendek } from '~/utils/format'
import { tanganiKonflik, versiDari } from '~/utils/versi'

definePageMeta({ access: ['reservasi'] })

const me = useMe()
const toast = useToast()
const desktop = useMediaQuery('(min-width: 1024px)')
const role = computed(() => roleReservasi(me.value))
const bolehLihat = computed(() => bolehBuka('denah', role.value))
const bolehUbah = computed(() => bolehAksi('denah', role.value))
const namaSaya = computed(() => me.value?.name ?? '')

const { master, versi, layouts: secLayouts, layoutOverrides: secOv1, layoutOverrides2: secOv2, layoutTanggal: secTgl, layoutHari: secHari, status } = useDenah()
const secTables = useSectionVersi<string[]>('tables')
const muatUlang = () => Promise.all([secLayouts.refresh(), secOv1.refresh(), secOv2.refresh(), secTgl.refresh(), secHari.refresh(), secTables.refresh()])

const catat = async (action: string, detail: string) => {
  try {
    await postAudit({ action, detail })
  }
  catch {
    // The write itself succeeded; a missing audit line is not a failure.
  }
}

// --- date & floor ----------------------------------------------------------------

// --- tabs (kept in the URL: ?tab=templat|tanggal|meja) ---------------------------------

const route = useRoute()
const router = useRouter()
const TAB = ['templat', 'tanggal', 'meja'] as const
type TabDenah = typeof TAB[number]
const tab = computed<TabDenah>(() => {
  const q = String(route.query.tab ?? '')
  return (TAB as readonly string[]).includes(q) ? q as TabDenah : 'templat'
})
function pilihTab(v?: string) {
  if (!v || v === tab.value) return
  router.replace({ query: { ...route.query, tab: v } })
}

// --- date & floor (tab "Denah per tanggal") ---------------------------------------------

const tgl = ref(hariIni())
const lantai = ref<1 | 2>(1)
const kunciTanggal = computed(() => dayTypeLayoutLt(master.value, tgl.value, lantai.value))

/**
 * A template opened from the template list (tab "Template denah"): the editor then
 * edits THAT template (every day and date using it). null = nothing opened.
 * Independent of the date tab, which always shows its own date's plan.
 */
const editTemplat = ref<string | null>(null)
const denahTemplat = computed(() => (editTemplat.value ? getLayout(master.value, editTemplat.value) : null))
const jejakTemplat = computed(() => jejakDenah(denahTemplat.value))
const denahTanggal = computed(() => getLayout(master.value, kunciTanggal.value) ?? getLayout(master.value, defaultDayTypeLt(tgl.value, lantai.value, master.value)))
const jejakTanggal = computed(() => jejakDenah(denahTanggal.value))
watch(denahTemplat, (d) => {
  // The template being deleted ends template mode.
  if (editTemplat.value && !d) editTemplat.value = null
})

// --- editor ------------------------------------------------------------------------

/** The date has its own plan (tables moved for that date only). */
const punyaDenahTanggal = computed(() => adaDenahTanggal(master.value, tgl.value, lantai.value))
/** The template that covers the date when its own plan is not there. */
const templatTanggal = computed(() => {
  const terjadwal = ovLantai(master.value, lantai.value)[tgl.value]
  return (terjadwal && getLayout(master.value, terjadwal)) ? terjadwal : defaultDayTypeLt(tgl.value, lantai.value, master.value)
})
const sumberTanggal = computed(() => {
  if (punyaDenahTanggal.value) return 'meja digeser khusus tanggal ini'
  const terjadwal = ovLantai(master.value, lantai.value)[tgl.value]
  return terjadwal && getLayout(master.value, terjadwal) ? 'template, dijadwalkan khusus' : 'template per hari'
})

const sibuk = ref(false)
async function tulis(aksi: () => Promise<unknown>, sukses: string, jejakAudit: [string, string]) {
  sibuk.value = true
  try {
    await aksi()
    await muatUlang()
    await catat(...jejakAudit)
    toast.add({ title: sukses, color: 'success' })
    return true
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
    return false
  }
  finally {
    sibuk.value = false
  }
}

/** Save into the covering template: every date that uses it changes. */
function simpanKeTemplat(data: LayoutDenah) {
  const key = editTemplat.value
  if (!key || parseKeyTanggal(key)) return
  // Keep the floor the template was made for, whatever its name says now.
  const cap = capDenah({ ...data, lantai: lantaiLayout(master.value, key) }, namaSaya.value)
  return tulis(
    () => putDenah('layouts', { ...(secLayouts.data.value?.data ?? {}), [key]: cap }, versi.value.layouts),
    `Template ${layoutName(master.value, key)} disimpan — berlaku untuk semua tanggal yang memakainya`,
    ['Simpan Layout', `${layoutName(master.value, key)} (${cap.tables.length} meja)`],
  )
}

/** Save for the chosen date only: the template is not touched. */
function simpanUntukTanggal(data: LayoutDenah) {
  const d = tgl.value
  const lt = lantai.value
  const key = keyTanggal(d, lt)
  const cap = capDenah(denahTanggalBaru(data, d, lt), namaSaya.value)
  return tulis(
    () => putDenah('layoutTanggal', { ...(secTgl.data.value?.data ?? {}), [key]: cap }, versi.value.layoutTanggal),
    `Denah ${tglPendek(d)} disimpan — template tidak ikut berubah`,
    ['Simpan Denah Tanggal', `${tglPendek(d)} Lt.${lt} (${cap.tables.length} meja)`],
  )
}

/** Drop the date's own plan only; a scheduled template (if any) stays. */
function hapusDenahTanggal() {
  const d = tgl.value
  const lt = lantai.value
  // Meja moved by hand for this date are lost for good; ask first.
  if (!window.confirm(`Buang denah khusus ${tglPendek(d)} (${ltCfg(lt).nama}) dan kembali ke template ${layoutName(master.value, templatTanggal.value)}?`)) return
  const { [keyTanggal(d, lt)]: _buang, ...sisa } = layoutTanggal(master.value)
  return tulis(
    () => putDenah('layoutTanggal', sisa, versi.value.layoutTanggal),
    `Denah khusus ${tglPendek(d)} dihapus — kembali ke ${layoutName(master.value, templatTanggal.value)}`,
    ['Hapus Denah Tanggal', `${tglPendek(d)} Lt.${lt}`],
  )
}

// --- template list (owner, Nov 2026: "bisa buka daftar template denahnya apa saja") ---
// A template is a GROUP: one name, a plan for Lantai 1 and one for Lantai 2
// ("kalau add dia langsung add lantai 1 dan lantai 2, jangan dipisah").

const hariWe = computed(() => hariWeekend(master.value))
const grup = computed(() => grupTemplat(master.value))

/** The group each day of the week ends up with (from Lantai 1's setting, else Lantai 2's), '' = built-in of the day. */
const grupHariTersimpan = computed(() => {
  const s1 = templatHari(master.value, 1)
  const s2 = templatHari(master.value, 2)
  return [0, 1, 2, 3, 4, 5, 6].map((d) => {
    const g = (s1[d] && grupDari(master.value, s1[d]!)) || (s2[d] && grupDari(master.value, s2[d]!))
    return g ? g.id : ''
  })
})

interface BarisGrup extends GrupTemplat {
  meja: number
  pax: number
  hari: string
}

const daftarGrup = computed<BarisGrup[]>(() => grup.value.map((g) => {
  const l1 = g.lt1 ? getLayout(master.value, g.lt1) : null
  const l2 = g.lt2 ? getLayout(master.value, g.lt2) : null
  const pakai = (d: number) => grupHariTersimpan.value[d] === g.id
    || (!grupHariTersimpan.value[d] && g.bawaan && g.id === (hariWe.value.includes(d) ? 'weekend' : 'weekday'))
  const hari = URUT_HARI.filter(pakai).map(d => NAMA_HARI[d]!.slice(0, 3))
  return {
    ...g,
    meja: (l1?.tables?.length ?? 0) + (l2?.tables?.length ?? 0),
    pax: kapasitasLayout(l1 ?? undefined) + kapasitasLayout(l2 ?? undefined),
    hari: hari.length === 7 ? 'setiap hari' : hari.join(', '),
  }
}))

/** Open one floor of a group in the editor below. */
function bukaTemplat(k: string) {
  editTemplat.value = k
  nextTick(() => document.getElementById('editor-denah')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

const formBaru = ref(false)
const namaBaru = ref('')
const dariGrup = ref('weekday')

/** A new group: Lantai 1 AND Lantai 2, each copied from the chosen group (or that floor's Weekday plan when it has none). */
async function buatTemplat() {
  const nama = namaBaru.value.trim()
  if (!nama) return toast.add({ title: 'Isi nama template dulu', color: 'error' })
  if (grup.value.some(g => g.nama.toLowerCase() === nama.toLowerCase())) return toast.add({ title: `Nama "${nama}" sudah dipakai`, color: 'error' })
  const asal = grup.value.find(g => g.id === dariGrup.value) ?? GRUP_BAWAAN[0]!
  const idGrup = kunciTemplatBaru(master.value, nama)
  const k1 = `${idGrup}_lt1`
  const k2 = `${idGrup}_lt2`
  const salin = (src: string, lt: 1 | 2): LayoutDenah => {
    const s = getLayout(master.value, src) ?? getLayout(master.value, ltCfg(lt).wd)!
    return capDenah({
      name: lt === 2 ? `${nama} (Lantai 2)` : nama,
      lantai: lt,
      grup: idGrup,
      grupNama: nama,
      tables: (s.tables ?? []).map(t => ({ ...t })),
      fixed: (s.fixed ?? []).map(f => ({ ...f })),
    }, namaSaya.value)
  }
  const ok = await tulis(
    () => putDenah('layouts', {
      ...(secLayouts.data.value?.data ?? {}),
      [k1]: salin(asal.lt1 ?? 'weekday', 1),
      [k2]: salin(asal.lt2 ?? 'lantai2', 2),
    }, versi.value.layouts),
    `Template ${nama} dibuat untuk Lantai 1 & Lantai 2 — silakan atur mejanya`,
    ['Buat Template Denah', `${nama} (Lt.1 & Lt.2, salinan ${asal.nama})`],
  )
  if (ok) {
    namaBaru.value = ''
    formBaru.value = false
    bukaTemplat(k1)
  }
}

/** Where a layout key is still in use: days of the week and dates from today on. */
function dipakaiDi(k: string): string[] {
  const out: string[] = []
  for (const lt of [1, 2]) {
    templatHari(master.value, lt).forEach((v, d) => {
      if (v === k) out.push(NAMA_HARI[d]!)
    })
    for (const [d, v] of Object.entries(ovLantai(master.value, lt))) {
      if (v === k && d >= hariIni()) out.push(`${tglPendek(d)} (Lt.${lt})`)
    }
  }
  return out
}

/** Only a custom group can go, both floors at once, and only when no day or coming date points at it. */
function hapusTemplat(g: BarisGrup) {
  if (g.bawaan) return
  const kunciGrup = [g.lt1, g.lt2].filter((k): k is string => !!k)
  const pakai = [...new Set(kunciGrup.flatMap(dipakaiDi))]
  if (pakai.length) return toast.add({ title: `${g.nama} masih dipakai`, description: `Ganti dulu di: ${pakai.join(', ')}`, color: 'error' })
  if (!window.confirm(`Hapus template ${g.nama} (Lantai 1 & Lantai 2)? Tindakan ini tidak bisa dibatalkan.`)) return
  const sisa = Object.fromEntries(Object.entries(secLayouts.data.value?.data ?? {}).filter(([k]) => !kunciGrup.includes(k)))
  if (editTemplat.value && kunciGrup.includes(editTemplat.value)) editTemplat.value = null
  return tulis(
    () => putDenah('layouts', sisa, versi.value.layouts),
    `Template ${g.nama} dihapus`,
    ['Hapus Template Denah', g.nama],
  )
}

// --- template per day of the week (owner, Nov 2026: "bisa disetting, di hari apa saja") ---
// One choice per day sets BOTH floors: the group's Lantai 1 and Lantai 2 plans.

/** Reka's Select forbids an empty value, so "not set" is a sentinel in the UI and '' in storage. */
const BAWAAN_HARI = '__bawaan'
const draftHari = ref<string[]>(['', '', '', '', '', '', ''])
watch(grupHariTersimpan, (v) => {
  draftHari.value = [...v]
}, { immediate: true })

const opsiHari = (d: number) => [
  { value: BAWAAN_HARI, label: `Bawaan (${hariWe.value.includes(d) ? 'Weekend' : 'Weekday'})` },
  ...grup.value.map(g => ({ value: g.id, label: g.nama })),
]
const hariBerubah = computed(() => JSON.stringify(draftHari.value) !== JSON.stringify(grupHariTersimpan.value))

function simpanHari() {
  const semua = master.value.layoutHari
  const dasar = semua && typeof semua === 'object' && !Array.isArray(semua) ? { ...semua } : {}
  const g = (d: number) => grup.value.find(x => x.id === draftHari.value[d])
  const isi1 = [0, 1, 2, 3, 4, 5, 6].map(d => g(d)?.lt1 ?? '')
  const isi2 = [0, 1, 2, 3, 4, 5, 6].map(d => g(d)?.lt2 ?? '')
  const ringkas = URUT_HARI.map(d => `${NAMA_HARI[d]!.slice(0, 3)}=${g(d)?.nama ?? 'bawaan'}`).join(', ')
  return tulis(
    () => putDenah('layoutHari', { ...dasar, 1: isi1, 2: isi2 }, versi.value.layoutHari),
    'Template per hari disimpan (Lantai 1 & Lantai 2)',
    ['Set Template Per Hari', ringkas],
  )
}

// --- full screen ---------------------------------------------------------------------

const kanvas = ref<HTMLElement | null>(null)
const { penuh, bisa: bisaPenuh, alihkan: layarPenuh } = useLayarPenuh(kanvas)

// --- schedule per date ---------------------------------------------------------------

const ovLt = computed(() => ovLantai(master.value, lantai.value))
const BAWAAN = '__bawaan'
const opsiTemplat = computed(() => [
  { value: BAWAAN, label: `Bawaan hari (${layoutName(master.value, defaultDayTypeLt(tgl.value, lantai.value, master.value))})` },
  ...allLayoutKeys(master.value)
    .filter(k => !parseKeyTanggal(k) && lantaiLayout(master.value, k) === lantai.value)
    .map(k => ({ value: k, label: layoutName(master.value, k) })),
])
const pilihTemplat = ref(BAWAAN)
watch([tgl, lantai, ovLt], () => {
  pilihTemplat.value = ovLt.value[tgl.value] ?? BAWAAN
}, { immediate: true })

/**
 * A date's OWN plan always wins over a scheduled template (dayTypeLayoutLt). Until
 * 23 Oct 2026 the old app only wrote the schedule, so the choice was saved but
 * never seen ("24 Okt sudah dipindah ke Weekend tapi denahnya tidak berubah").
 * Now the crew is asked, and the date's plan is dropped in the same write.
 * Returns false when they cancel — then nothing changes.
 */
function bolehBuangDenahTanggal(d: string, lt: number) {
  if (!adaDenahTanggal(master.value, d, lt)) return true
  return window.confirm(`Tanggal ${tglPendek(d)} (${ltCfg(lt).nama}) punya DENAH KHUSUS yang digeser sendiri, dan denah khusus selalu menang atas template.

Supaya pilihan ini berlaku, denah khusus tanggal itu dibuang. Lanjutkan?`)
}

function simpanJadwal(d: string, templat: string) {
  const lt = lantai.value
  const key = lt === 2 ? 'layoutOverrides2' : 'layoutOverrides'
  if (!bolehBuangDenahTanggal(d, lt)) return
  const buangTgl = adaDenahTanggal(master.value, d, lt)
  const ov = Object.fromEntries(Object.entries(ovLt.value).filter(([k]) => k !== d))
  if (templat !== BAWAAN && getLayout(master.value, templat)) ov[d] = templat
  return tulis(
    async () => {
      // Two sections, two writes: the schedule goes FIRST. If the second write fails
      // the date's own plan is still there (and still wins), so nothing is lost and
      // the crew can simply try again; the other way round would drop the plan
      // without the template ever being scheduled.
      await putDenah(key, ov, versi.value[key])
      if (buangTgl) {
        const { [keyTanggal(d, lt)]: _buang, ...sisa } = layoutTanggal(master.value)
        await putDenah('layoutTanggal', sisa, versi.value.layoutTanggal)
        await catat('Hapus Denah Tanggal', `${tglPendek(d)} Lt.${lt} (diganti template)`)
      }
    },
    templat !== BAWAAN ? `${ltCfg(lt).nama} ${tglPendek(d)} memakai ${layoutName(master.value, templat)}` : `${ltCfg(lt).nama} ${tglPendek(d)} kembali ke bawaan hari`,
    [templat !== BAWAAN ? 'Set Denah Tanggal' : 'Reset Denah Tanggal', `${ltCfg(lt).nama} · ${tglPendek(d)} → ${templat !== BAWAAN ? layoutName(master.value, templat) : 'bawaan'}`],
  )
}

const tglLain = ref('')
function terapkanKeTanggalLain() {
  if (!tglLain.value) return toast.add({ title: 'Pilih tanggalnya dulu', color: 'error' })
  if (pilihTemplat.value === BAWAAN) return toast.add({ title: 'Pilih template denahnya dulu (bukan bawaan hari)', color: 'error' })
  return simpanJadwal(tglLain.value, pilihTemplat.value)
}

/** Clears BOTH forms of deviation for a date — a scheduled template and tables drawn for that date. */
async function bersihkanTanggal(d: string) {
  const lt = lantai.value
  await tulis(async () => {
    if (adaDenahTanggal(master.value, d, lt)) {
      const { [keyTanggal(d, lt)]: _buang, ...sisa } = layoutTanggal(master.value)
      await putDenah('layoutTanggal', sisa, versi.value.layoutTanggal)
    }
    if (ovLt.value[d]) {
      const ov = Object.fromEntries(Object.entries(ovLt.value).filter(([k]) => k !== d))
      await putDenah(lt === 2 ? 'layoutOverrides2' : 'layoutOverrides', ov, versi.value[lt === 2 ? 'layoutOverrides2' : 'layoutOverrides'])
    }
  }, `${ltCfg(lt).nama} ${tglPendek(d)} dikembalikan ke bawaan hari`, ['Reset Denah Tanggal', `${ltCfg(lt).nama} · ${tglPendek(d)} → bawaan`])
}

/** Dates from today on whose plan differs from the built-in of the day, this floor. */
const tanggalKhusus = computed(() => {
  const lt = lantai.value
  const dari = hariIni()
  const out: { tgl: string, nama: string }[] = []
  for (const [d, v] of Object.entries(ovLt.value)) {
    if (d >= dari && getLayout(master.value, v)) out.push({ tgl: d, nama: layoutName(master.value, v) })
  }
  for (const key of Object.keys(layoutTanggal(master.value))) {
    const p = parseKeyTanggal(key)
    if (p && p.lt === lt && p.date >= dari) out.push({ tgl: p.date, nama: 'meja digeser khusus tanggal ini' })
  }
  return out.sort((a, b) => a.tgl.localeCompare(b.tgl))
})

// --- table database ----------------------------------------------------------------------

interface BarisMeja {
  id: string
  lantai: string
  zona: string
  min: number
  maks: number
  /** Plans holding this table. */
  denah: string[]
}

/** Every plan that is still in use: templates, and date plans from today on. */
const semuaDenah = computed(() => {
  const dari = hariIni()
  return allLayoutKeys(master.value).filter((k) => {
    const p = parseKeyTanggal(k)
    return !p || p.date >= dari
  })
})

const database = computed<BarisMeja[]>(() => {
  const per = new Map<string, BarisMeja>()
  for (const k of semuaDenah.value) {
    const lt = lantaiLayout(master.value, k)
    const nama = parseKeyTanggal(k) ? `${tglPendek(parseKeyTanggal(k)!.date)} Lt.${lt}` : layoutName(master.value, k)
    for (const t of getLayout(master.value, k)?.tables ?? []) {
      const id = String(t.id)
      const ada = per.get(id)
      if (ada) {
        ada.denah.push(nama)
        if (!ada.lantai.includes(String(lt))) ada.lantai = `${ada.lantai} & ${lt}`
        continue
      }
      per.set(id, { id, lantai: String(lt), zona: LABEL_ZONA[t.zone] ?? t.zone, min: capMin(t.cap), maks: capMax(t.cap), denah: [nama] })
    }
  }
  return [...per.values()].sort((a, b) => a.lantai.localeCompare(b.lantai) || a.id.localeCompare(b.id, 'id', { numeric: true }))
})

/** Edited capacities, by table id; untouched rows keep the plan's own. */
const ubahan = reactive<Record<string, { min: number, maks: number } | undefined>>({})
const kapasitas = (b: BarisMeja) => ubahan[b.id] ?? { min: b.min, maks: b.maks }
function setKapasitas(b: BarisMeja, k: 'min' | 'maks', v: number | string) {
  const n = Math.max(0, Math.round(Number(v) || 0))
  const kini = { ...kapasitas(b), [k]: n }
  if (k === 'maks' && kini.min > n) kini.min = n
  if (k === 'min' && kini.maks < n) kini.maks = n
  ubahan[b.id] = kini
}
const capTeks = (c: { min: number, maks: number }) => (c.min && c.min < c.maks ? `${c.min}-${c.maks}` : String(c.maks))
const jumlahUbah = computed(() => database.value.filter(b => ubahan[b.id] && capTeks(ubahan[b.id]!) !== capTeks(b)).length)
const salah = computed(() => database.value.filter(b => ubahan[b.id] && ubahan[b.id]!.maks < 1).map(b => b.id))

const cariMeja = ref('')
const baris = computed(() => {
  const q = cariMeja.value.trim().toLowerCase()
  return q ? database.value.filter(b => b.id.toLowerCase().includes(q)) : database.value
})
const totalKursi = computed(() => database.value.reduce((a, b) => a + kapasitas(b).maks, 0))

async function simpanDatabase() {
  if (salah.value.length) return toast.add({ title: `Kapasitas maksimal ${salah.value.join(', ')} masih 0`, color: 'error' })
  const ganti = new Map(database.value.filter(b => ubahan[b.id]).map(b => [b.id, capTeks(ubahan[b.id]!)]))
  const pakai = (l: LayoutDenah): LayoutDenah => capDenah({
    ...l,
    tables: (l.tables ?? []).map((t: MejaDenah) => (ganti.has(String(t.id)) ? { ...t, cap: ganti.get(String(t.id))! } : t)),
  }, namaSaya.value)
  const kena = (l?: LayoutDenah | null) => (l?.tables ?? []).some(t => ganti.has(String(t.id)))

  const ok = await tulis(async () => {
    if (ganti.size) {
      // Templates (built-in ones become stored ones, like any editor save).
      const tpl = { ...(secLayouts.data.value?.data ?? {}) }
      let ubahTpl = false
      for (const k of allLayoutKeys(master.value)) {
        if (parseKeyTanggal(k)) continue
        const l = getLayout(master.value, k)
        if (l && kena(l)) {
          tpl[k] = pakai(l)
          ubahTpl = true
        }
      }
      if (ubahTpl) await putDenah('layouts', tpl, versi.value.layouts)
      // Date plans still to come.
      const perTgl = { ...layoutTanggal(master.value) }
      let ubahTgl = false
      for (const [k, l] of Object.entries(perTgl)) {
        const p = parseKeyTanggal(k)
        if (p && p.date >= hariIni() && kena(l)) {
          perTgl[k] = pakai(l)
          ubahTgl = true
        }
      }
      if (ubahTgl) await putDenah('layoutTanggal', perTgl, versi.value.layoutTanggal)
    }
    // The flat table list other modules read, rebuilt from the plans.
    await putSection('tables', database.value.map(b => b.id), versiDari(secTables.data.value))
  }, ganti.size ? `Kapasitas ${ganti.size} meja disimpan ke semua denah` : 'Daftar meja disamakan dengan denah', ['Simpan Database Meja', ganti.size ? [...ganti].map(([id, c]) => `${id}=${c}`).join(', ') : `${database.value.length} meja`])
  if (ok) Object.assign(ubahan, Object.fromEntries(Object.keys(ubahan).map(k => [k, undefined])))
}

/** The stored flat list differs from the plans (e.g. the old "Meja 01 …" list). */
const daftarLama = computed(() => {
  const lama = secTables.data.value?.data ?? []
  const kini = new Set(database.value.map(b => b.id))
  return lama.length !== kini.size || lama.some(x => !kini.has(String(x)))
})

const kolom: TableColumn<BarisMeja>[] = [
  { accessorKey: 'id', header: 'Meja', meta: { class: { th: 'w-28', td: 'w-28' } } },
  { accessorKey: 'lantai', header: 'Lantai', meta: { class: { th: 'w-20', td: 'w-20' } } },
  { accessorKey: 'zona', header: 'Zona', meta: { class: { th: 'w-32', td: 'w-32' } } },
  { id: 'min', header: 'Kapasitas min', meta: { class: { th: 'w-36', td: 'w-36' } } },
  { id: 'maks', header: 'Kapasitas maks', meta: { class: { th: 'w-36', td: 'w-36' } } },
  { id: 'denah', header: 'Ada di denah' },
]
</script>

<template>
  <AppPage
    title="Atur denah & meja"
    description="Template denah, denah khusus per tanggal, dan database meja."
  >
    <template v-if="bolehLihat">
      <p
        v-if="!bolehUbah"
        class="mb-4 rounded-xl border-l-4 border-warning bg-warning/10 p-3 text-sm text-warning"
      >
        Peranmu hanya bisa melihat. Minta manager/admin Reservasi untuk mengubah denah atau kapasitas meja.
      </p>

      <AppSeg
        class="mb-4"
        :model-value="tab"
        :options="[
          { value: 'templat', label: 'Template denah' },
          { value: 'tanggal', label: 'Denah per tanggal' },
          { value: 'meja', label: 'Database meja' },
        ]"
        @update:model-value="pilihTab"
      />

      <!-- Tab 1: templates (affect every day that uses them). -->
      <template v-if="tab === 'templat'">
        <div class="mb-4 grid gap-4 xl:grid-cols-2">
          <AppPanel
            title="Daftar template denah"
            icon="i-lucide-layout-template"
            :count="daftarGrup.length"
            description="Satu template berisi denah Lantai 1 dan Lantai 2. Klik Lt.1 / Lt.2 untuk mengedit denah lantai itu."
          >
            <template #actions>
              <UButton
                v-if="bolehUbah"
                label="Tambah template"
                icon="i-lucide-plus"
                size="sm"
                @click="formBaru = !formBaru"
              />
            </template>
            <div
              v-if="formBaru && bolehUbah"
              class="mb-3 flex flex-wrap items-end gap-2 rounded-xl bg-default p-3"
            >
              <UFormField
                label="Nama template"
                class="min-w-44 flex-1"
              >
                <UInput
                  v-model="namaBaru"
                  placeholder="mis. Event Live Music"
                  autofocus
                  class="w-full"
                  @keydown.enter="buatTemplat"
                />
              </UFormField>
              <UFormField
                label="Salin dari"
                class="min-w-36 flex-1"
              >
                <USelect
                  v-model="dariGrup"
                  :items="grup.map(g => ({ value: g.id, label: g.nama }))"
                  class="w-full"
                />
              </UFormField>
              <UButton
                label="Buat"
                icon="i-lucide-check"
                loading-auto
                @click="buatTemplat"
              />
              <UButton
                label="Batal"
                color="neutral"
                variant="ghost"
                @click="formBaru = false"
              />
              <p class="w-full text-xs text-muted">
                Denah Lantai 1 dan Lantai 2 langsung dibuat bersamaan.
              </p>
            </div>
            <div
              v-for="g in daftarGrup"
              :key="g.id"
              class="flex flex-wrap items-center justify-between gap-2 border-b border-default py-2.5 last:border-b-0"
              :class="editTemplat && (editTemplat === g.lt1 || editTemplat === g.lt2) ? 'rounded-lg bg-gold-soft px-2' : ''"
            >
              <div class="min-w-0">
                <p class="font-semibold text-highlighted">
                  {{ g.nama }}
                  <UBadge
                    v-if="g.bawaan"
                    label="Bawaan"
                    color="neutral"
                    variant="soft"
                    size="sm"
                    class="ml-1 align-middle"
                  />
                </p>
                <p class="text-xs text-muted">
                  {{ g.meja }} meja · {{ g.pax }} pax · {{ g.hari ? 'dipakai ' + g.hari : 'belum dipakai hari apa pun' }}
                </p>
              </div>
              <div class="flex gap-1">
                <UButton
                  v-for="k in ([[1, g.lt1], [2, g.lt2]] as const)"
                  :key="k[0]"
                  icon="i-lucide-pencil"
                  :label="`Lt.${k[0]}`"
                  :color="editTemplat && editTemplat === k[1] ? 'primary' : 'neutral'"
                  :variant="editTemplat && editTemplat === k[1] ? 'solid' : 'outline'"
                  size="sm"
                  :disabled="!k[1]"
                  :title="k[1] ? `Edit denah Lantai ${k[0]} ${g.nama}` : `Template ini belum punya denah Lantai ${k[0]}`"
                  @click="k[1] && bukaTemplat(k[1])"
                />
                <UButton
                  v-if="!g.bawaan"
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="sm"
                  :aria-label="'Hapus ' + g.nama"
                  :disabled="!bolehUbah"
                  loading-auto
                  @click="hapusTemplat(g)"
                />
              </div>
            </div>
          </AppPanel>

          <AppPanel
            title="Template per hari"
            icon="i-lucide-calendar-range"
            description="Tiap minggu, hari itu otomatis memakai template yang dipilih untuk Lantai 1 dan Lantai 2. Tanggal khusus tetap menang."
          >
            <template #actions>
              <UButton
                label="Simpan"
                icon="i-lucide-save"
                size="sm"
                :disabled="!bolehUbah || !hariBerubah"
                loading-auto
                @click="simpanHari"
              />
            </template>
            <div class="grid gap-2">
              <div
                v-for="d in URUT_HARI"
                :key="d"
                class="grid grid-cols-[5.5rem_1fr] items-center gap-2"
              >
                <span class="text-sm font-semibold text-highlighted">{{ NAMA_HARI[d] }}</span>
                <USelect
                  :model-value="draftHari[d] || BAWAAN_HARI"
                  :items="opsiHari(d)"
                  :disabled="!bolehUbah"
                  class="w-full"
                  @update:model-value="(v) => { draftHari[d] = v && v !== BAWAAN_HARI ? String(v) : '' }"
                />
              </div>
            </div>
          </AppPanel>
        </div>

        <p
          v-if="!editTemplat || !denahTemplat"
          class="mb-4 rounded-xl bg-default p-4 text-sm text-muted"
        >
          Klik Lt.1 atau Lt.2 di daftar template untuk mengedit denahnya.
        </p>
        <template v-else>
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-xl bg-gold-soft p-4">
            <div class="flex min-w-0 items-start gap-3">
              <UIcon
                name="i-lucide-layout-template"
                class="mt-0.5 size-5 shrink-0 text-gold-deep"
              />
              <div class="min-w-0">
                <p class="font-semibold text-gold-deep">
                  Kamu sedang mengedit template {{ layoutName(master, editTemplat) }}
                </p>
                <p class="mt-0.5 text-sm text-default">
                  Perubahan berlaku untuk semua hari &amp; tanggal yang memakai template ini ({{ daftarGrup.find(g => g.lt1 === editTemplat || g.lt2 === editTemplat)?.hari || 'belum dipakai' }}). Untuk mengubah satu tanggal saja, pakai tab Denah per tanggal.
                </p>
              </div>
            </div>
            <UButton
              label="Tutup editor"
              icon="i-lucide-x"
              color="neutral"
              variant="outline"
              size="sm"
              @click="editTemplat = null"
            />
          </div>

          <AppPanel
            id="editor-denah"
            :title="`Editor template: ${layoutName(master, editTemplat)}`"
            icon="i-lucide-map"
            class="mb-4"
          >
            <template #actions>
              <UButton
                v-if="bisaPenuh"
                :icon="penuh ? 'i-lucide-minimize' : 'i-lucide-maximize'"
                :label="penuh ? 'Keluar layar penuh' : 'Layar penuh'"
                color="neutral"
                variant="outline"
                size="sm"
                @click="layarPenuh"
              />
            </template>
            <div
              ref="kanvas"
              class="bg-default"
              :class="penuh ? 'overflow-auto p-6' : ''"
            >
              <!-- In full screen the panel's own button is outside: a way back, inside. -->
              <UButton
                v-if="penuh"
                icon="i-lucide-minimize"
                label="Keluar layar penuh"
                color="neutral"
                variant="outline"
                size="sm"
                class="mb-3"
                @click="layarPenuh"
              />
              <DenahEditor
                :key="`tpl-${editTemplat}`"
                mode="templat"
                :layout="denahTemplat"
                :bisa-ubah="bolehUbah && !sibuk"
                :jejak="jejakTemplat"
                @simpan-templat="simpanKeTemplat"
              />
            </div>
          </AppPanel>
        </template>
      </template>

      <!-- Tab 2: the plan of ONE date. -->
      <template v-else-if="tab === 'tanggal'">
        <div class="mb-2 flex flex-wrap items-center gap-3">
          <AppTanggal
            v-model="tgl"
            :clearable="false"
            class="w-60"
          />
          <AppSeg
            :model-value="String(lantai)"
            :options="[{ value: '1', label: 'Lantai 1' }, { value: '2', label: 'Lantai 2' }]"
            @update:model-value="(v?: string) => { lantai = v === '2' ? 2 : 1 }"
          />
        </div>
        <p class="mb-4 text-sm text-muted">
          Tanggal ini memakai: <b class="text-highlighted">{{ layoutName(master, kunciTanggal) }}</b> ({{ sumberTanggal }})
        </p>

        <AppPanel
          title="Ganti template untuk tanggal ini"
          class="mb-4"
          icon="i-lucide-calendar-cog"
          :description="`${ltCfg(lantai).nama}: tanggal lain otomatis kembali ke bawaan hari. Lantai 1 dan Lantai 2 dijadwalkan sendiri-sendiri.`"
        >
          <div class="grid gap-4 lg:grid-cols-2">
            <div class="space-y-3">
              <UFormField :label="`Denah ${ltCfg(lantai).nama} untuk ${tglPanjang(tgl)}`">
                <USelect
                  v-model="pilihTemplat"
                  :items="opsiTemplat"
                  :disabled="!bolehUbah"
                  class="w-full"
                />
              </UFormField>
              <div class="flex flex-wrap items-end gap-2">
                <UButton
                  label="Terapkan ke tanggal ini"
                  icon="i-lucide-check"
                  :disabled="!bolehUbah"
                  loading-auto
                  @click="simpanJadwal(tgl, pilihTemplat)"
                />
              </div>
              <div class="flex flex-wrap items-end gap-2 border-t border-default pt-3">
                <UFormField
                  label="Pakai template yang sama di tanggal lain"
                  class="w-60"
                >
                  <AppTanggal
                    v-model="tglLain"
                    :min="hariIni()"
                    class="w-full"
                  />
                </UFormField>
                <UButton
                  label="Tambahkan tanggal"
                  color="neutral"
                  variant="outline"
                  :disabled="!bolehUbah"
                  loading-auto
                  @click="terapkanKeTanggalLain"
                />
              </div>
            </div>
            <div>
              <AppSectionTitle :title="`Tanggal khusus ${ltCfg(lantai).nama} (hari ini ke depan)`" />
              <p
                v-if="!tanggalKhusus.length"
                class="text-sm text-muted"
              >
                Belum ada tanggal khusus — semua tanggal memakai bawaan harinya.
              </p>
              <div
                v-for="t in tanggalKhusus"
                :key="`${t.tgl}-${t.nama}`"
                class="flex items-center justify-between gap-2 border-b border-default py-2 text-sm last:border-b-0"
              >
                <button
                  type="button"
                  class="text-left hover:text-gold-deep"
                  @click="tgl = t.tgl"
                >
                  <b>{{ tglPendek(t.tgl) }}</b> → {{ t.nama }}
                </button>
                <UButton
                  label="Kembalikan ke bawaan"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :disabled="!bolehUbah"
                  loading-auto
                  @click="bersihkanTanggal(t.tgl)"
                />
              </div>
            </div>
          </div>
        </AppPanel>

        <div class="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-xl bg-info/10 p-4">
          <div class="flex min-w-0 items-start gap-3">
            <UIcon
              name="i-lucide-calendar-check"
              class="mt-0.5 size-5 shrink-0 text-info"
            />
            <div class="min-w-0">
              <p class="font-semibold text-info">
                Kamu sedang mengubah denah khusus {{ tglPanjang(tgl) }} · {{ ltCfg(lantai).nama }}
              </p>
              <p class="mt-0.5 text-sm text-default">
                Template {{ layoutName(master, templatTanggal) }} tidak ikut berubah. Besoknya denah kembali ke template.
              </p>
            </div>
          </div>
          <UButton
            v-if="punyaDenahTanggal"
            label="Kembalikan ke template"
            icon="i-lucide-undo-2"
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="!bolehUbah"
            loading-auto
            @click="hapusDenahTanggal"
          />
        </div>

        <AppPanel
          id="editor-denah"
          title="Ubah meja khusus tanggal ini"
          icon="i-lucide-map"
          class="mb-4"
          :description="`Denah ${tglPanjang(tgl)} · ${ltCfg(lantai).nama}. Hanya tanggal ini yang berubah.`"
        >
          <template #actions>
            <UButton
              v-if="bisaPenuh"
              :icon="penuh ? 'i-lucide-minimize' : 'i-lucide-maximize'"
              :label="penuh ? 'Keluar layar penuh' : 'Layar penuh'"
              color="neutral"
              variant="outline"
              size="sm"
              @click="layarPenuh"
            />
          </template>
          <div
            ref="kanvas"
            class="bg-default"
            :class="penuh ? 'overflow-auto p-6' : ''"
          >
            <!-- In full screen the panel's own button is outside: a way back, inside. -->
            <UButton
              v-if="penuh"
              icon="i-lucide-minimize"
              label="Keluar layar penuh"
              color="neutral"
              variant="outline"
              size="sm"
              class="mb-3"
              @click="layarPenuh"
            />
            <p
              v-if="status === 'pending' && !denahTanggal"
              class="py-10 text-center text-sm text-muted"
            >
              Memuat denah…
            </p>
            <DenahEditor
              v-else-if="denahTanggal"
              :key="`${kunciTanggal}-${tgl}`"
              mode="tanggal"
              :layout="denahTanggal"
              :tanggal="{ date: tgl, lt: lantai }"
              :bisa-ubah="bolehUbah && !sibuk"
              :jejak="jejakTanggal"
              @simpan-tanggal="simpanUntukTanggal"
            />
          </div>
        </AppPanel>
      </template>

      <!-- Tab 3: table database. -->
      <template v-else>
        <AppPanel
          title="Database meja"
          icon="i-lucide-armchair"
          :count="database.length"
          :description="`Semua meja dari semua denah, total ±${totalKursi} kursi. Kapasitas yang disimpan di sini berlaku di semua denah yang memuat meja itu, dan dipakai untuk menghitung sisa kursi.`"
        >
          <template #actions>
            <UButton
              :label="jumlahUbah ? `Simpan ${jumlahUbah} perubahan` : 'Samakan daftar meja'"
              icon="i-lucide-save"
              :disabled="!bolehUbah || (!jumlahUbah && !daftarLama)"
              loading-auto
              @click="simpanDatabase"
            />
          </template>
          <p
            v-if="daftarLama"
            class="mb-3 rounded-xl bg-warning/10 p-3 text-sm text-warning"
          >
            Daftar meja tersimpan ({{ (secTables.data.value?.data ?? []).length }} meja) belum sama dengan denah
            ({{ database.length }} meja). Tekan <b>Samakan daftar meja</b> supaya Marketing &amp; modul lain membaca meja yang sama.
          </p>
          <UInput
            v-model="cariMeja"
            icon="i-lucide-search"
            placeholder="Cari meja…"
            class="mb-3 w-full sm:w-64"
          />
          <UTable
            v-if="desktop"
            :data="baris"
            :columns="kolom"
            class="table-fixed"
          >
            <template #id-cell="{ row }">
              <b class="text-highlighted">{{ row.original.id }}</b>
            </template>
            <template #min-cell="{ row }">
              <UInput
                :model-value="kapasitas(row.original).min"
                type="number"
                min="0"
                size="sm"
                class="w-24"
                :disabled="!bolehUbah"
                @update:model-value="setKapasitas(row.original, 'min', $event)"
              />
            </template>
            <template #maks-cell="{ row }">
              <UInput
                :model-value="kapasitas(row.original).maks"
                type="number"
                min="1"
                size="sm"
                class="w-24"
                :color="kapasitas(row.original).maks < 1 ? 'error' : undefined"
                :highlight="kapasitas(row.original).maks < 1"
                :disabled="!bolehUbah"
                @update:model-value="setKapasitas(row.original, 'maks', $event)"
              />
            </template>
            <template #denah-cell="{ row }">
              <span
                class="block truncate text-muted"
                :title="row.original.denah.join(', ')"
              >{{ row.original.denah.join(', ') }}</span>
            </template>
          </UTable>
          <div
            v-else
            class="flex flex-col gap-2"
          >
            <div
              v-for="b in baris"
              :key="b.id"
              class="rounded-xl border border-default p-3"
            >
              <div class="flex items-center justify-between gap-2">
                <b class="text-highlighted">Meja {{ b.id }}</b>
                <span class="text-xs text-muted">Lantai {{ b.lantai }} · {{ b.zona }}</span>
              </div>
              <div class="mt-2 grid grid-cols-2 gap-2">
                <UFormField label="Kapasitas min">
                  <UInput
                    :model-value="kapasitas(b).min"
                    type="number"
                    min="0"
                    class="w-full"
                    :disabled="!bolehUbah"
                    @update:model-value="setKapasitas(b, 'min', $event)"
                  />
                </UFormField>
                <UFormField label="Kapasitas maks">
                  <UInput
                    :model-value="kapasitas(b).maks"
                    type="number"
                    min="1"
                    class="w-full"
                    :disabled="!bolehUbah"
                    @update:model-value="setKapasitas(b, 'maks', $event)"
                  />
                </UFormField>
              </div>
            </div>
          </div>
        </AppPanel>
      </template>
    </template>
    <p
      v-else
      class="text-muted"
    >
      Tidak ada akses.
    </p>
  </AppPage>
</template>
