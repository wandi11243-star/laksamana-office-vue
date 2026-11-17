<!--
  Stock › Break & Loss (old `deploy/stock/breakloss/index.html`).

  Inventory (plates, glasses, bar tools) that breaks or goes missing — not
  ingredients (that is Waste). Looks like the Waste form on purpose (user
  request, Oct 2026): the same Catat | Report shape, stat cards, bars, recap
  and one-by-one list. What Waste does not have: items MUST be registered
  (with a photo), and the CURRENT STOCK per item, summed server-side from
  every live movement.

  Two menus, each with two sub-tabs: Break & Loss (Catat | Report) and
  Barang & Stok (Daftarkan Barang | Stok Terkini). No delete anywhere: a wrong
  row is CANCELLED with a required reason, an unused item is DEACTIVATED.
  Quantities are whole numbers — rounded while typing, refused by the server
  otherwise. The unit is a label from the item master, never an input.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BlItem, BlMutasi } from '~/composables/useStock'
import {
  cancelBlMovement, createBlItem, createBlMovement,
  listBreakLoss, patchBlItem, patchBlMovement, setBlItemActive,
} from '~/composables/useStock'
import { apiErrorCode, apiErrorMessage } from '~/composables/useApi'
import { isAdminOf } from '~/composables/useMe'
import { hariIni, rupiah, tambahHari, tglPendek } from '~/utils/format'
import { tanganiKonflik } from '~/utils/versi'
import {
  bulanIni, daftarBulanPilih, dataBar, fotoKeData, fotoKeThumb, opsiTimCatat,
  pesanTimKosong, rentangBulanCatat, SATUAN_TERSEDIA,
  timBawaanCatat, timBelumDiisi, timCatatTerkunci,
} from '~/utils/stock-catat'

definePageMeta({ access: ['breakloss'] })

const me = useMe()
const toast = useToast()
const admin = computed(() => isAdminOf(me.value, 'breakloss'))
const belumAdaTim = computed(() => timBelumDiisi(me.value?.keterangan, admin.value))

const JENIS_BL = [
  { value: 'break', label: 'Break — pecah / rusak' },
  { value: 'loss', label: 'Loss — hilang' },
]
const SEBAB_BREAK = ['Pecah saat dicuci', 'Jatuh saat service', 'Retak / gompal', 'Jatuh dari rak', 'Rusak dipakai tamu']
const SEBAB_LOSS = ['Tidak kembali dari meja', 'Terbawa tamu', 'Tidak ditemukan saat opname', 'Tertinggal di event luar', 'Terbuang bersama sampah']

const menu = ref<'bl' | 'barang'>('bl')
const subBl = ref<'catat' | 'report'>('catat')
const subBarang = ref<'daftar' | 'stok'>('stok')

// --- period (report) ----------------------------------------------------------

const periode = ref<'minggu' | 'bulan' | 'semua' | 'pilih'>('bulan')
const bulanPilih = ref(bulanIni())
const pilihanBulan = daftarBulanPilih()
const rentang = computed(() => {
  const hari = hariIni()
  if (periode.value === 'minggu') return { dari: tambahHari(hari, -6), ke: hari }
  if (periode.value === 'pilih') return rentangBulanCatat(bulanPilih.value)
  if (periode.value === 'semua') return {} as { dari?: string, ke?: string }
  return { dari: `${bulanIni()}-01`, ke: hari }
})
watch(periode, () => {
  if (periode.value !== 'pilih') bulanPilih.value = bulanIni()
})

const daftarQ = useAsyncData('stock-breakloss', () => listBreakLoss(rentang.value.dari, rentang.value.ke), {
  watch: [rentang],
  default: () => ({ items: [] as BlItem[], mutasi: [] as BlMutasi[] }),
})
const items = computed(() => daftarQ.data.value?.items ?? [])
const mutasi = computed(() => daftarQ.data.value?.mutasi ?? [])
/** The legacy tables do not exist yet: the API answers 503, it never runs DDL. */
const takTersedia = computed(() => apiErrorCode(daftarQ.error.value) === 'breakloss_unavailable')

const item = (id?: string | null) => (id ? items.value.find(i => i.id === id) ?? null : null)
const fmtBil = (n: unknown) => (Number(n) || 0).toLocaleString('id-ID')

/** Whole numbers only: commas and dots are dropped WHILE TYPING, so the box
 *  always shows what will actually be stored (old `bulatkanKotak`). */
function ketikBulat(v: unknown): number | '' {
  const s = String(v ?? '')
  if (s === '') return ''
  return Math.max(0, Math.trunc(Number(s.replace(',', '.')) || 0))
}

// --- photo viewer -------------------------------------------------------------

const fotoSheet = ref(false)
const fotoKind = ref<'bl-item' | 'bl-movement'>('bl-item')
const fotoId = ref('')
const fotoJudul = ref('')
function lihatFoto(kind: 'bl-item' | 'bl-movement', id: string, judul: string) {
  fotoKind.value = kind
  fotoId.value = id
  fotoJudul.value = judul
  fotoSheet.value = true
}

// --- catat form (bl) ----------------------------------------------------------

const form = ref({
  id: '',
  tanggal: hariIni(),
  jenis: 'break',
  tim: timBawaanCatat(me.value?.keterangan),
  itemId: '',
  qty: 1 as number | '',
  sebab: '',
  catatan: '',
})
const opsiTim = computed(() => opsiTimCatat(me.value?.keterangan))
const terkunci = computed(() => timCatatTerkunci(me.value?.keterangan))
const opsiTimTampil = computed(() => {
  const base = opsiTim.value
  if (form.value.tim && !base.some(o => o.value === form.value.tim)) return [...base, { value: form.value.tim, label: `${form.value.tim} (kode lama)` }]
  return base
})
watch(me, () => {
  if (!opsiTim.value.some(o => o.value === form.value.tim)) form.value.tim = timBawaanCatat(me.value?.keterangan)
})

const itemAktif = computed(() => items.value.filter(i => i.aktif).slice().sort((a, b) =>
  String(a.kategori || '').localeCompare(String(b.kategori || ''), 'id') || String(a.nama || '').localeCompare(String(b.nama || ''), 'id')))
const opsiItem = computed(() => {
  const opsi = itemAktif.value.map(i => ({ value: i.id, label: `${i.nama} · stok ${fmtBil(i.stok)} ${i.satuan || ''}`.trim() }))
  const pilih = item(form.value.itemId)
  if (form.value.itemId && !opsi.some(o => o.value === form.value.itemId) && pilih) {
    opsi.push({ value: pilih.id, label: `${pilih.nama} (nonaktif)` })
  }
  return opsi
})
const itemPilih = computed(() => item(form.value.itemId))
const unitLabel = computed(() => itemPilih.value?.satuan || '-')
const sebabSaran = computed(() => form.value.jenis === 'loss' ? SEBAB_LOSS : SEBAB_BREAK)
const stokTersedia = computed(() => {
  const i = itemPilih.value
  if (!i) return 0
  const lama = form.value.id ? mutasi.value.find(m => m.id === form.value.id) : null
  // An edited row already reduces the stock, so its old amount is available to it.
  return Number(i.stok) + (lama && lama.itemId === form.value.itemId ? Math.abs(Number(lama.qty) || 0) : 0)
})

const fotoCam = ref<HTMLInputElement | null>(null)
const fotoFile = ref<HTMLInputElement | null>(null)
const fotoBaru = ref<{ foto: string, thumb: string, nama: string } | null>(null)
const fotoInfo = ref('')
const editAdaFoto = ref(false)
const fotoDibuang = ref(false)
async function pilihFotoCatat(ev: Event, sumber: 'cam' | 'file') {
  const el = ev.target as HTMLInputElement
  const f = el.files?.[0]
  if (!f) return
  try {
    const [foto, thumb] = await Promise.all([fotoKeData(f), fotoKeThumb(f)])
    fotoBaru.value = { foto, thumb, nama: f.name }
    fotoInfo.value = sumber === 'cam' ? 'Foto kamera siap.' : 'Foto unggahan siap.'
    if (sumber === 'cam' && fotoFile.value) fotoFile.value.value = ''
    if (sumber === 'file' && fotoCam.value) fotoCam.value.value = ''
  }
  catch (e) {
    buangFotoCatat()
    toast.add({ title: e instanceof Error ? e.message : 'Foto tidak bisa dipakai.', color: 'error' })
  }
}
function buangFotoCatat() {
  fotoBaru.value = null
  if (editAdaFoto.value) fotoDibuang.value = true
  if (fotoCam.value) fotoCam.value.value = ''
  if (fotoFile.value) fotoFile.value.value = ''
  fotoInfo.value = ''
}

function resetCatat() {
  form.value = { id: '', tanggal: hariIni(), jenis: 'break', tim: timBawaanCatat(me.value?.keterangan), itemId: '', qty: 1, sebab: '', catatan: '' }
  editAdaFoto.value = false
  fotoDibuang.value = false
  buangFotoCatat()
  fotoInfo.value = ''
}
// Call it only after every ref it touches exists (the photo refs above).
resetCatat()

/** Edit from the report — the Catat form is filled, then shown (old `editMutasi`).
 *  Live break/loss rows only; the server refuses the rest too. */
function editMutasi(m: BlMutasi) {
  if (!m || m.batalAt || (m.jenis !== 'break' && m.jenis !== 'loss')) return
  resetCatat()
  form.value = {
    id: m.id,
    tanggal: m.tanggal || hariIni(),
    jenis: m.jenis,
    tim: m.tim || timBawaanCatat(me.value?.keterangan),
    itemId: m.itemId || '',
    qty: Math.abs(Number(m.qty) || 0),
    sebab: m.sebab || '',
    catatan: m.catatan || '',
  }
  editAdaFoto.value = !!m.adaFoto
  fotoDibuang.value = false
  fotoInfo.value = m.adaFoto ? 'Sudah ada foto — pilih foto baru untuk menggantinya.' : ''
  subBl.value = 'catat'
  menu.value = 'bl'
}

/** From a stock card: preset the item, then show the Catat form. */
function catatUntuk(id: string) {
  resetCatat()
  form.value.itemId = id
  menu.value = 'bl'
  subBl.value = 'catat'
}

const menyimpan = ref(false)
async function simpanCatat() {
  const itemId = form.value.itemId
  const qty = Number(form.value.qty) || 0
  const sebab = form.value.sebab.trim()
  if (!itemId || qty <= 0 || !Number.isInteger(qty) || !form.value.tanggal || !sebab) {
    toast.add({ title: 'Belum lengkap', description: 'Barang, jumlah bulat, tanggal, dan sebab wajib diisi.', color: 'error' })
    return
  }
  const i = item(itemId)
  if (i && qty > stokTersedia.value
    && !confirm(`Jumlah ${fmtBil(qty)} melebihi stok terkini ${fmtBil(i.stok)} ${i.satuan || ''}. Stok akan jadi minus.\n\nTetap simpan? (Sebaiknya lakukan opname setelahnya.)`)) return
  const idUbah = form.value.id
  const body: Record<string, unknown> = {
    itemId, jenis: form.value.jenis, qty, tanggal: form.value.tanggal, sebab,
    tim: form.value.tim, catatan: form.value.catatan.trim(),
  }
  if (idUbah) {
    // The photo travels only when it really changed: replaced, or thrown away.
    if (fotoBaru.value) {
      body.foto = fotoBaru.value.foto
      body.fotoNama = fotoBaru.value.nama
    }
    else if (fotoDibuang.value) {
      body.foto = ''
      body.fotoNama = ''
    }
  }
  else {
    body.foto = fotoBaru.value ? fotoBaru.value.foto : ''
    body.fotoNama = fotoBaru.value ? fotoBaru.value.nama : ''
  }
  menyimpan.value = true
  try {
    const hasil = idUbah ? await patchBlMovement(idUbah, body) : await createBlMovement(body)
    toast.add({
      title: idUbah ? 'Perubahan tersimpan' : 'Tersimpan',
      description: `${i ? i.nama : 'Barang'} — stok sekarang ${fmtBil(hasil.stok)} ${i ? i.satuan || '' : ''}.`.trim(),
      color: 'success',
    })
    resetCatat()
    await daftarQ.refresh()
    subBl.value = 'report'
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => daftarQ.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}

// --- cancel (no delete) -------------------------------------------------------

const sheetBatal = ref(false)
const batalTarget = ref<BlMutasi | null>(null)
const batalAlasan = ref('')
function bukaBatal(m: BlMutasi) {
  batalTarget.value = m
  batalAlasan.value = ''
  sheetBatal.value = true
}
async function batalGo() {
  const m = batalTarget.value
  const alasan = batalAlasan.value.trim()
  if (!m) return
  if (!alasan) {
    toast.add({ title: 'Alasan wajib diisi', description: 'Pembatalan tidak disimpan.', color: 'error' })
    return
  }
  sheetBatal.value = false
  try {
    await cancelBlMovement(m.id, alasan)
    toast.add({ title: 'Dibatalkan', description: 'Catatan dicoret dan tidak lagi dihitung.', color: 'success' })
    batalTarget.value = null
    await daftarQ.refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => daftarQ.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- masuk / opname sheet -----------------------------------------------------

const sheetMo = ref(false)
const mo = ref({ id: '', jenis: 'masuk' as 'masuk' | 'opname', qty: '' as number | '', tanggal: hariIni(), ket: '' })
const moItem = computed(() => item(mo.value.id))
const moOpname = computed(() => mo.value.jenis === 'opname')
const moSelisih = computed(() => {
  if (!moOpname.value || mo.value.qty === '') return null
  return Number(mo.value.qty) - Number(moItem.value?.stok || 0)
})
function bukaMo(id: string, jenis: 'masuk' | 'opname') {
  mo.value = { id, jenis, qty: '', tanggal: hariIni(), ket: '' }
  sheetMo.value = true
}
const menyimpanMo = ref(false)
async function simpanMo() {
  const q = Number(mo.value.qty)
  if (mo.value.qty === '' || q < 0 || !Number.isInteger(q) || (!moOpname.value && q <= 0) || !mo.value.tanggal) {
    toast.add({
      title: 'Jumlah belum benar',
      description: `${moOpname.value ? 'Isi jumlah fisik (boleh 0)' : 'Jumlah harus lebih dari 0'}, bilangan bulat.`,
      color: 'error',
    })
    return
  }
  menyimpanMo.value = true
  try {
    const body: Record<string, unknown> = {
      itemId: mo.value.id, jenis: mo.value.jenis, tanggal: mo.value.tanggal, sebab: mo.value.ket.trim(),
    }
    if (moOpname.value) body.fisik = q
    else body.qty = q
    const hasil = await createBlMovement(body)
    const i = moItem.value
    toast.add({
      title: 'Tersimpan',
      description: `Stok sekarang ${fmtBil(hasil.stok)}${moOpname.value ? ` (selisih ${hasil.delta > 0 ? '+' : ''}${fmtBil(hasil.delta)})` : ''}${i?.satuan ? ` ${i.satuan}` : ''}.`,
      color: 'success',
    })
    sheetMo.value = false
    await daftarQ.refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => daftarQ.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpanMo.value = false
  }
}

// --- report (bl) --------------------------------------------------------------

const cari = ref('')
const jenisFilter = ref('BL')
const timFilter = ref('ALL')

const lolosJenis = (m: BlMutasi) => {
  if (jenisFilter.value === 'ALL') return true
  if (jenisFilter.value === 'BL') return m.jenis === 'break' || m.jenis === 'loss'
  return m.jenis === jenisFilter.value
}
const daftarTampil = computed(() => {
  const q = cari.value.trim().toLowerCase()
  return mutasi.value
    .filter(lolosJenis)
    .filter(m => timFilter.value === 'ALL' || (m.tim || '') === timFilter.value)
    .filter((m) => {
      if (!q) return true
      const i = item(m.itemId)
      return [i?.nama, m.sebab, m.pic, m.catatan, m.tim, m.oleh].some(v => String(v || '').toLowerCase().includes(q))
    })
})
/** Summary counts live break/loss rows only; the list keeps everything. */
const hidup = computed(() => daftarTampil.value.filter(m => !m.batalAt && (m.jenis === 'break' || m.jenis === 'loss')))
/**
 * The mutasi list holds the newest 3000 rows at most, so the "Semua" totals
 * come from the server-side all-time per-item sums instead (same live-only
 * semantics, whole history).
 */
const semuaDariItems = computed(() => periode.value !== 'semua'
  ? null
  : {
      totBreak: items.value.reduce((a, i) => a + Math.abs(Number(i.totBreak) || 0), 0),
      totLoss: items.value.reduce((a, i) => a + Math.abs(Number(i.totLoss) || 0), 0),
      nilai: items.value.reduce((a, i) => a + (Math.abs(Number(i.totBreak) || 0) + Math.abs(Number(i.totLoss) || 0)) * (Number(i.harga) || 0), 0),
    })
/** The API caps the mutasi list at the newest 3000 rows. */
const mutasiTerpotong = computed(() => mutasi.value.length >= 3000)
const ringkas = computed(() => {
  const tot = (j: string) => hidup.value.filter(m => m.jenis === j).reduce((a, m) => a + Math.abs(Number(m.qty) || 0), 0)
  const nilai = hidup.value.reduce((a, m) => a + Math.abs(Number(m.qty) || 0) * (Number(m.harga) || 0), 0)
  const semua = semuaDariItems.value
  const perSebab: Record<string, number> = {}
  const perItem: Record<string, number> = {}
  const rekap = new Map<string, { nama: string, break: number, loss: number, nilai: number, n: number, stok: number, satuan: string }>()
  for (const m of hidup.value) {
    const s = String(m.sebab || 'Lainnya').trim()
    perSebab[s] = (perSebab[s] || 0) + 1
    const i = item(m.itemId)
    const nm = i?.nama || '(tidak dikenal)'
    const q = Math.abs(Number(m.qty) || 0)
    perItem[nm] = (perItem[nm] || 0) + q
    const r = rekap.get(m.itemId) ?? { nama: nm, break: 0, loss: 0, nilai: 0, n: 0, stok: Number(i?.stok) || 0, satuan: i?.satuan || '' }
    if (m.jenis === 'break') r.break += q
    else r.loss += q
    r.nilai += q * (Number(m.harga) || 0)
    r.n++
    rekap.set(m.itemId, r)
  }
  return {
    totBreak: semua?.totBreak ?? tot('break'), nBreak: hidup.value.filter(m => m.jenis === 'break').length,
    totLoss: semua?.totLoss ?? tot('loss'), nLoss: hidup.value.filter(m => m.jenis === 'loss').length,
    nilai: semua?.nilai ?? nilai, berfoto: hidup.value.filter(m => m.adaFoto).length,
    perSebab, perItem,
    rekap: [...rekap.values()].sort((a, b) => (b.nilai - a.nilai) || ((b.break + b.loss) - (a.break + a.loss))),
  }
})
const barsSebab = computed(() => dataBar(ringkas.value.perSebab))
const barsItem = computed(() => {
  const entri = Object.entries(ringkas.value.perItem).sort((a, b) => b[1]! - a[1]!).slice(0, 8)
  return dataBar(Object.fromEntries(entri))
})
interface RekapBl { nama: string, break: number, loss: number, nilai: number, n: number, stok: number, satuan: string }
const kolomRekap: TableColumn<RekapBl>[] = [
  { accessorKey: 'nama', header: 'Barang' },
  { accessorKey: 'break', header: 'Break' },
  { accessorKey: 'loss', header: 'Loss' },
  { accessorKey: 'nilai', header: 'Nilai' },
  { accessorKey: 'stok', header: 'Stok terkini' },
]

/** Values BEFORE each edit, for the "Diubah" row tooltip (old `teksRiwayat`). */
function teksRiwayat(m: BlMutasi): string {
  return (m.riwayat || []).map((r) => {
    const s = r.sebelum || {}
    const i = item(s.itemId)
    return `${s.tanggal || ''} ${r.oleh || ''} — sebelumnya: ${i ? i.nama : '?'} · ${s.jenis || ''} ${fmtBil(Math.abs(Number(s.qty) || 0))} · ${s.sebab || '-'}`
  }).join('\n')
}
const qtyTampil = (m: BlMutasi) => (m.jenis === 'break' || m.jenis === 'loss')
  ? fmtBil(Math.abs(Number(m.qty) || 0))
  : `${Number(m.qty) > 0 ? '+' : ''}${fmtBil(Number(m.qty) || 0)}`
const jenisWarna = (j: string): 'error' | 'vip' | 'success' | 'info' | 'gold' =>
  j === 'break' ? 'error' : j === 'loss' ? 'vip' : j === 'masuk' ? 'success' : j === 'opname' ? 'info' : 'gold'
const jenisLabel = (j: string) => j === 'break' ? 'Break' : j === 'loss' ? 'Loss' : j === 'masuk' ? 'Masuk' : j === 'opname' ? 'Opname' : j

// --- barang master ------------------------------------------------------------

const formItem = ref({
  id: '',
  nama: '',
  kategori: '',
  lokasi: '',
  satuan: 'Pcs',
  harga: '' as number | '',
  stokMin: '' as number | '',
  stokAwal: '' as number | '',
  catatan: '',
})
const katSaran = computed(() => [...new Set(items.value.map(i => i.kategori).filter(Boolean))].sort())
const lokSaran = computed(() => [...new Set(items.value.map(i => i.lokasi).filter(Boolean))].sort())
const satuanOpsi = computed(() => {
  const daftar = SATUAN_TERSEDIA.slice()
  const t = formItem.value.satuan
  // A legacy unit stays drawable — otherwise opening the item silently
  // switches its unit on save.
  if (t && !daftar.includes(t)) daftar.push(t)
  return daftar.map(s => ({ value: s, label: s }))
})
const fotoItemCam = ref<HTMLInputElement | null>(null)
const fotoItemFile = ref<HTMLInputElement | null>(null)
/** undefined = untouched, null = removed, object = new. */
const fotoItemBaru = ref<{ foto: string, thumb: string, nama: string } | null | undefined>(undefined)
const thumbLama = ref('')
const thumbItemTampil = computed(() => fotoItemBaru.value ? fotoItemBaru.value.thumb : (fotoItemBaru.value === null ? '' : thumbLama.value))
async function pilihFotoItem(ev: Event, sumber: 'cam' | 'file') {
  const el = ev.target as HTMLInputElement
  const f = el.files?.[0]
  if (!f) return
  try {
    const [foto, thumb] = await Promise.all([fotoKeData(f), fotoKeThumb(f)])
    fotoItemBaru.value = { foto, thumb, nama: f.name }
    if (sumber === 'cam' && fotoItemFile.value) fotoItemFile.value.value = ''
    if (sumber === 'file' && fotoItemCam.value) fotoItemCam.value.value = ''
  }
  catch (e) {
    el.value = ''
    toast.add({ title: e instanceof Error ? e.message : 'Foto tidak bisa dipakai.', color: 'error' })
  }
}
function buangFotoItem() {
  fotoItemBaru.value = null
  if (fotoItemCam.value) fotoItemCam.value.value = ''
  if (fotoItemFile.value) fotoItemFile.value.value = ''
}

function resetItem() {
  formItem.value = { id: '', nama: '', kategori: '', lokasi: '', satuan: 'Pcs', harga: '', stokMin: '', stokAwal: '', catatan: '' }
  fotoItemBaru.value = undefined
  thumbLama.value = ''
  buangFotoItem()
  fotoItemBaru.value = undefined
}
resetItem()

function editItem(i: BlItem) {
  resetItem()
  formItem.value = {
    id: i.id, nama: i.nama || '', kategori: i.kategori || '', lokasi: i.lokasi || '',
    satuan: i.satuan || 'Pcs', harga: Number(i.harga) || '', stokMin: Number(i.stokMin) || '',
    stokAwal: '', catatan: i.catatan || '',
  }
  thumbLama.value = i.thumb || ''
  subBarang.value = 'daftar'
  menu.value = 'barang'
}

const menyimpanItem = ref(false)
async function simpanItem() {
  const nama = formItem.value.nama.trim()
  const id = formItem.value.id
  if (formItem.value.stokMin !== '' && !Number.isInteger(Number(formItem.value.stokMin))) {
    toast.add({ title: 'Harus bilangan bulat', description: 'Stok minimum tidak boleh desimal.', color: 'error' })
    return
  }
  if (!id && formItem.value.stokAwal !== '' && !Number.isInteger(Number(formItem.value.stokAwal))) {
    toast.add({ title: 'Harus bilangan bulat', description: 'Stok awal tidak boleh desimal.', color: 'error' })
    return
  }
  if (!nama) {
    toast.add({ title: 'Nama barang kosong', description: 'Isi nama barangnya.', color: 'error' })
    return
  }
  if (Number(formItem.value.harga) < 0) {
    toast.add({ title: 'Harga tidak boleh negatif.', color: 'error' })
    return
  }
  const body: Record<string, unknown> = {
    nama,
    kategori: formItem.value.kategori.trim(),
    lokasi: formItem.value.lokasi.trim(),
    satuan: formItem.value.satuan,
    harga: Number(formItem.value.harga) || 0,
    stokMin: Number(formItem.value.stokMin) || 0,
    catatan: formItem.value.catatan.trim(),
  }
  if (!id) body.stokAwal = Number(formItem.value.stokAwal) || 0
  // Photo: unsent = kept; empty string = removed (contract stock.md).
  if (fotoItemBaru.value === null) {
    body.foto = ''
    body.thumb = ''
    body.fotoNama = ''
  }
  else if (fotoItemBaru.value) {
    body.foto = fotoItemBaru.value.foto
    body.thumb = fotoItemBaru.value.thumb
    body.fotoNama = fotoItemBaru.value.nama
  }
  menyimpanItem.value = true
  try {
    if (id) await patchBlItem(id, body)
    else await createBlItem(body)
    toast.add({ title: 'Tersimpan', description: id ? `${nama} diperbarui.` : `${nama} terdaftar.`, color: 'success' })
    resetItem()
    await daftarQ.refresh()
    subBarang.value = 'stok'
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => daftarQ.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpanItem.value = false
  }
}

async function toggleAktif() {
  const i = item(formItem.value.id)
  if (!i) return
  const aktif = !i.aktif
  if (!aktif && !confirm(`Nonaktifkan "${i.nama}"?\n\nBarangnya tidak dihapus — riwayatnya tetap ada, cuma tidak bisa dicatat lagi. Bisa diaktifkan lagi kapan saja.`)) return
  try {
    await setBlItemActive(i.id, aktif)
    toast.add({ title: aktif ? 'Diaktifkan lagi' : 'Dinonaktifkan', description: i.nama, color: 'success' })
    resetItem()
    await daftarQ.refresh()
    subBarang.value = 'stok'
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => daftarQ.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- stok terkini -------------------------------------------------------------

const sq = ref('')
const tampilStok = ref<'aktif' | 'non' | 'semua'>('aktif')
// Reka UI forbids a SelectItem value of '': "all categories" is the non-empty
// sentinel 'SEMUA', mapped back in the filter below.
const katFilter = ref('SEMUA')
const menipis = (i: BlItem) => !!i.aktif && Number(i.stokMin) > 0 && Number(i.stok) <= Number(i.stokMin)
const stokTampil = computed(() => {
  const q = sq.value.trim().toLowerCase()
  return items.value
    .filter(i => tampilStok.value === 'semua' || (tampilStok.value === 'aktif' ? i.aktif : !i.aktif))
    .filter(i => katFilter.value === 'SEMUA' || (i.kategori || '') === katFilter.value)
    .filter(i => !q || [i.nama, i.kategori, i.lokasi].some(v => String(v || '').toLowerCase().includes(q)))
})
const ringkasStok = computed(() => {
  const aktif = items.value.filter(i => i.aktif)
  return {
    nAktif: aktif.length,
    nNon: items.value.length - aktif.length,
    tipis: aktif.filter(menipis).length,
    minus: aktif.filter(i => Number(i.stok) < 0).length,
    nilai: aktif.reduce((a, i) => a + Math.max(0, Number(i.stok)) * (Number(i.harga) || 0), 0),
  }
})

async function segarkan() {
  await daftarQ.refresh()
}
</script>

<template>
  <AppPage
    title="Break & Loss"
    description="Barang inventaris yang pecah atau hilang, berikut stok terkininya."
  >
    <template #actions>
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        size="sm"
        @click="segarkan"
      />
    </template>

    <UAlert
      v-if="takTersedia"
      class="mb-5"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Tabel Break & Loss belum ada di database"
      :description="apiErrorMessage(daftarQ.error.value, 'Buka panel Break & Loss di Office lama sekali agar tabelnya dibuat. Selama itu seluruh tombol di sini akan ditolak.')"
    />
    <UAlert
      v-else-if="daftarQ.error.value"
      class="mb-5"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Data Break & Loss tidak terbaca"
      :description="apiErrorMessage(daftarQ.error.value)"
    />

    <UAlert
      v-if="belumAdaTim"
      class="mb-5"
      color="warning"
      variant="subtle"
      icon="i-lucide-shield-alert"
      title="Tim belum diisi"
      :description="pesanTimKosong"
    />

    <!-- Menu + its sub-tabs on one row, with a divider between them. -->
    <div class="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3">
      <AppSeg
        v-model="menu"
        size="sm"
        :options="[
          { value: 'bl', label: 'Break & Loss', icon: 'i-lucide-package-x' },
          { value: 'barang', label: 'Barang & Stok', icon: 'i-lucide-archive' },
        ]"
      />
      <span
        class="hidden h-6 border-l border-default sm:block"
        aria-hidden="true"
      />
      <AppSeg
        v-if="menu === 'bl'"
        v-model="subBl"
        size="sm"
        :options="[
          { value: 'catat', label: 'Catat Break & Loss' },
          { value: 'report', label: 'Report Break & Loss' },
        ]"
      />
      <AppSeg
        v-else
        v-model="subBarang"
        size="sm"
        :options="[
          { value: 'daftar', label: 'Daftarkan Barang' },
          { value: 'stok', label: 'Stok Terkini' },
        ]"
      />
    </div>

    <!-- ============================ 1. BREAK & LOSS ============================ -->
    <template v-if="menu === 'bl'">
      <template v-if="subBl === 'catat'">
        <AppPanel :title="form.id ? 'Ubah catatan break & loss' : 'Catat break & loss baru'">
          <template
            v-if="form.id"
            #actions
          >
            <UButton
              label="Batal edit"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="resetCatat"
            />
          </template>

          <p
            v-if="form.id"
            class="mb-4 text-[12px] text-muted"
          >
            Mengubah catatan — nilai sebelumnya tetap tersimpan di riwayat catatan ini.
          </p>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <UFormField label="Tanggal">
              <UInput
                v-model="form.tanggal"
                type="date"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Jenis">
              <USelect
                v-model="form.jenis"
                :items="JENIS_BL"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Tim"
              :help="terkunci ? 'Tim Anda, ditetapkan di Kelola Akses.' : 'Anda melihat semua tim — pilih tim yang sesuai.'"
            >
              <USelect
                v-model="form.tim"
                :items="opsiTimTampil"
                class="w-full"
                :class="terkunci && 'pointer-events-none'"
              />
            </UFormField>
            <UFormField label="Jumlah">
              <div class="flex items-stretch gap-2">
                <UInput
                  :model-value="form.qty === '' ? '' : String(form.qty)"
                  type="number"
                  min="1"
                  step="1"
                  inputmode="numeric"
                  class="w-24 shrink-0 text-center font-bold"
                  @update:model-value="form.qty = ketikBulat($event)"
                />
                <span class="flex min-w-0 flex-1 items-center truncate rounded-field border border-default bg-muted px-3 font-semibold text-muted">{{ unitLabel }}</span>
              </div>
            </UFormField>
          </div>

          <UFormField
            class="mt-4"
            label="Barang"
            required
          >
            <USelectMenu
              :model-value="form.itemId || undefined"
              :items="opsiItem"
              value-key="value"
              placeholder="Pilih barang yang terdaftar…"
              :search-input="{ placeholder: 'Cari nama barang…' }"
              class="w-full"
              @update:model-value="form.itemId = typeof $event === 'string' ? $event : ''"
            />
            <div
              v-if="itemPilih"
              class="mt-2 flex items-center gap-2.5"
            >
              <img
                v-if="itemPilih.thumb"
                :src="itemPilih.thumb"
                :alt="`Foto ${itemPilih.nama}`"
                class="size-10 shrink-0 cursor-pointer rounded-field border border-default object-cover"
                @click="lihatFoto('bl-item', itemPilih.id, itemPilih.nama)"
              >
              <span
                v-else
                class="flex size-10 shrink-0 items-center justify-center rounded-field border border-default bg-muted"
              >
                <UIcon
                  name="i-lucide-utensils"
                  class="size-5 text-dimmed"
                />
              </span>
              <p class="text-[12px] text-muted">
                Stok terkini <b class="text-highlighted num">{{ fmtBil(itemPilih.stok) }} {{ itemPilih.satuan }}</b>
                <template v-if="itemPilih.harga">
                  · {{ rupiah(Number(itemPilih.harga)) }}/{{ itemPilih.satuan }}{{ Number(form.qty) ? ` · nilai ± ${rupiah(Number(form.qty) * Number(itemPilih.harga))}` : '' }}
                </template>
                <template v-else>
                  · harga belum diisi
                </template>
                <template v-if="Number(form.qty) > stokTersedia">
                  <br><span class="font-semibold text-error">Jumlah melebihi stok terkini — stok akan jadi minus.</span>
                </template>
              </p>
            </div>
            <p
              v-else
              class="mt-1 text-[12px] text-muted"
            >
              {{ itemAktif.length ? 'Barang harus terdaftar supaya stoknya bisa dihitung.' : 'Belum ada barang. Daftarkan dulu di Barang & Stok → Daftarkan Barang.' }}
            </p>
          </UFormField>

          <UFormField
            class="mt-4"
            label="Sebab"
            required
          >
            <UInput
              v-model="form.sebab"
              list="bl-sebab-saran"
              autocomplete="off"
              placeholder="cth: pecah saat dicuci"
              class="w-full"
            />
            <datalist id="bl-sebab-saran">
              <option
                v-for="s in sebabSaran"
                :key="s"
                :value="s"
              />
            </datalist>
          </UFormField>

          <UFormField
            class="mt-4"
            label="Catatan — kronologinya"
          >
            <UTextarea
              v-model="form.catatan"
              :rows="2"
              placeholder="cth: tray jatuh saat clear table meja 12"
              class="w-full"
            />
          </UFormField>

          <UFormField
            class="mt-4"
            label="Foto bukti (opsional)"
          >
            <div class="flex flex-wrap items-center gap-2.5">
              <input
                ref="fotoCam"
                type="file"
                accept="image/*"
                capture="environment"
                class="hidden"
                @change="pilihFotoCatat($event, 'cam')"
              >
              <input
                ref="fotoFile"
                type="file"
                accept="image/*"
                class="hidden"
                @change="pilihFotoCatat($event, 'file')"
              >
              <UButton
                label="Buka kamera"
                icon="i-lucide-camera"
                color="neutral"
                variant="outline"
                size="sm"
                @click="fotoCam?.click()"
              />
              <UButton
                label="Upload foto"
                icon="i-lucide-upload"
                color="neutral"
                variant="outline"
                size="sm"
                @click="fotoFile?.click()"
              />
              <img
                v-if="fotoBaru"
                :src="fotoBaru.thumb"
                alt="Pratinjau foto bukti"
                class="size-14 rounded-field border border-default object-cover"
              >
              <UButton
                v-if="fotoBaru"
                icon="i-lucide-x"
                color="error"
                variant="ghost"
                size="sm"
                title="Buang foto"
                aria-label="Buang foto"
                @click="buangFotoCatat"
              />
              <UButton
                v-if="form.id && editAdaFoto && !fotoBaru"
                label="Lihat foto lama"
                icon="i-lucide-image"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="lihatFoto('bl-movement', form.id, 'Bukti catatan')"
              />
              <span class="text-[12px] text-muted">{{ fotoInfo }}</span>
            </div>
          </UFormField>

          <UButton
            class="mt-5 w-full"
            :label="form.id ? 'Simpan perubahan' : 'Simpan catatan break & loss'"
            icon="i-lucide-save"
            :loading="menyimpan"
            @click="simpanCatat"
          />
        </AppPanel>
      </template>

      <template v-else>
        <AppPanel title="Report break & loss">
          <AppFilterGrid>
            <UFormField label="Cari">
              <UInput
                v-model="cari"
                icon="i-lucide-search"
                placeholder="Cari barang, sebab, atau PIC…"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Periode">
              <AppChips
                v-model="periode"
                :options="[
                  { value: 'minggu', label: '7 Hari' },
                  { value: 'bulan', label: 'Bulan Ini' },
                  { value: 'semua', label: 'Semua' },
                ]"
              />
            </UFormField>
            <UFormField label="Bulan tertentu">
              <USelect
                v-model="bulanPilih"
                :items="pilihanBulan"
                class="w-full"
                @update:model-value="periode = 'pilih'"
              />
            </UFormField>
            <UFormField label="Jenis">
              <USelect
                v-model="jenisFilter"
                :items="[
                  { value: 'BL', label: 'Break & Loss' },
                  { value: 'break', label: 'Break saja' },
                  { value: 'loss', label: 'Loss saja' },
                  { value: 'ALL', label: 'Semua (+ masuk & opname)' },
                ]"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="admin"
              label="Divisi"
            >
              <USelect
                v-model="timFilter"
                :items="[{ value: 'ALL', label: 'Semua divisi' }, ...opsiTimCatat(me?.keterangan)]"
                class="w-full"
              />
            </UFormField>
          </AppFilterGrid>

          <UAlert
            v-if="mutasiTerpotong"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :description="periode === 'semua'
              ? 'Daftar mutasi hanya memuat 3000 terbaru — total di atas dihitung dari seluruh riwayat.'
              : 'Daftar mutasi hanya memuat 3000 terbaru — rincian di bawah bisa terpotong.'"
            class="mt-4"
          />

          <AppStatGrid class="mt-4">
            <AppStat
              label="Break"
              icon="i-lucide-package-x"
              :value="fmtBil(ringkas.totBreak)"
              :sub="`${ringkas.nBreak} catatan · pecah / rusak`"
              tone="error"
            />
            <AppStat
              label="Loss"
              icon="i-lucide-package-search"
              :value="fmtBil(ringkas.totLoss)"
              :sub="`${ringkas.nLoss} catatan · hilang`"
              tone="vip"
            />
            <AppStat
              label="Nilai kerugian"
              icon="i-lucide-banknote"
              :value="rupiah(ringkas.nilai)"
              sub="harga saat dicatat"
              tone="warning"
            />
            <AppStat
              label="Berfoto"
              icon="i-lucide-camera"
              :value="hidup.length ? `${ringkas.berfoto}/${hidup.length}` : '—'"
              :sub="hidup.length ? 'ada buktinya' : 'belum ada catatan'"
              tone="info"
            />
          </AppStatGrid>

          <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AppPanel
              bersarang
              title="Sebab terbanyak"
            >
              <div
                v-if="!barsSebab.length"
                class="text-[13px] text-dimmed"
              >
                Belum ada data pada periode ini.
              </div>
              <AppBar
                v-for="b in barsSebab"
                :key="b.label"
                :label="b.label"
                :value="b.value"
                :persen="b.persen"
                tone="error"
              />
            </AppPanel>
            <AppPanel
              bersarang
              title="Barang terbanyak pecah / hilang"
            >
              <div
                v-if="!barsItem.length"
                class="text-[13px] text-dimmed"
              >
                Belum ada data pada periode ini.
              </div>
              <AppBar
                v-for="b in barsItem"
                :key="b.label"
                :label="b.label"
                :value="b.value"
                :persen="b.persen"
                tone="gold"
              />
            </AppPanel>
          </div>

          <AppPanel
            v-if="ringkas.rekap.length"
            bersarang
            class="mt-5"
            title="Total break & loss per barang"
            :description="`${ringkas.rekap.length} barang`"
            flush
          >
            <UTable
              class="hidden lg:block"
              :data="ringkas.rekap"
              :columns="kolomRekap"
            >
              <template #nama-cell="{ row }">
                <b class="text-highlighted">{{ row.original.nama }}</b>
              </template>
              <template #break-cell="{ row }">
                <span class="num">{{ fmtBil(row.original.break) }}</span>
              </template>
              <template #loss-cell="{ row }">
                <span class="num">{{ fmtBil(row.original.loss) }}</span>
              </template>
              <template #nilai-cell="{ row }">
                <span class="num">{{ row.original.nilai ? rupiah(row.original.nilai) : '—' }}</span>
              </template>
              <template #stok-cell="{ row }">
                <span class="num">{{ fmtBil(row.original.stok) }} {{ row.original.satuan }}</span>
              </template>
            </UTable>
            <div class="divide-y divide-default lg:hidden">
              <div
                v-for="r in ringkas.rekap"
                :key="r.nama"
                class="flex items-center justify-between gap-3 px-4 py-3"
              >
                <b class="min-w-0 truncate text-sm text-highlighted">{{ r.nama }}</b>
                <span class="num shrink-0 text-sm">B {{ fmtBil(r.break) }} · L {{ fmtBil(r.loss) }}</span>
              </div>
            </div>
          </AppPanel>

          <div class="mt-5">
            <UAlert
              v-if="!daftarTampil.length"
              color="neutral"
              variant="subtle"
              icon="i-lucide-sparkles"
              :title="(cari || timFilter !== 'ALL' || jenisFilter !== 'BL') ? 'Tidak ada yang cocok dengan penyaring yang dipasang.' : 'Belum ada break maupun loss pada periode ini.'"
            />
            <div
              v-for="m in daftarTampil"
              :key="m.id"
              class="mb-3 flex flex-wrap items-start gap-3 rounded-panel bg-default px-4 py-3.5 shadow-panel"
              :class="m.batalAt && 'opacity-60'"
            >
              <img
                v-if="item(m.itemId)?.thumb"
                :src="item(m.itemId)!.thumb"
                :alt="`Foto ${item(m.itemId)?.nama}`"
                class="size-12 shrink-0 cursor-pointer rounded-field border border-default object-cover"
                @click="lihatFoto('bl-item', m.itemId, item(m.itemId)?.nama || 'Foto barang')"
              >
              <span
                v-else
                class="flex size-12 shrink-0 items-center justify-center rounded-field border border-default bg-muted"
              >
                <UIcon
                  name="i-lucide-utensils"
                  class="size-5 text-dimmed"
                />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <b
                    class="font-display text-[14px] font-bold text-highlighted"
                    :class="m.batalAt && 'line-through'"
                  >{{ item(m.itemId)?.nama || '(barang tidak dikenal)' }}</b>
                  <AppStatus
                    :color="jenisWarna(m.jenis)"
                    size="sm"
                  >
                    {{ jenisLabel(m.jenis) }} {{ qtyTampil(m) }} {{ item(m.itemId)?.satuan || '' }}
                  </AppStatus>
                  <AppStatus
                    v-if="m.sebab"
                    color="neutral"
                    size="sm"
                  >
                    {{ m.sebab }}
                  </AppStatus>
                  <AppStatus
                    v-if="m.tim"
                    color="gold"
                    size="sm"
                  >
                    {{ m.tim }}
                  </AppStatus>
                  <AppStatus
                    v-if="(m.jenis === 'break' || m.jenis === 'loss') && Number(m.harga)"
                    color="warning"
                    size="sm"
                  >
                    {{ rupiah(Math.abs(Number(m.qty)) * Number(m.harga)) }}
                  </AppStatus>
                </div>
                <div class="mt-1 text-[12px] text-muted">
                  {{ tglPendek(String(m.tanggal || '')) }} · {{ m.pic || '-' }} · dicatat {{ m.oleh || '-' }} {{ m.waktu || '' }}
                </div>
                <div
                  v-if="m.catatan"
                  class="mt-2 rounded-xl border border-default bg-muted px-3 py-2 text-[13px] leading-relaxed"
                >
                  {{ m.catatan }}
                </div>
                <div
                  v-if="m.diubahAt"
                  class="mt-1.5 text-[12px] text-warning"
                  :title="teksRiwayat(m)"
                >
                  Diubah {{ m.diubahOleh || '' }} · {{ m.waktu || '' }}{{ (m.riwayat || []).length > 1 ? ` (${m.riwayat.length}×)` : '' }}
                </div>
                <div
                  v-if="m.batalAt"
                  class="mt-2 text-[12.5px] font-semibold text-error"
                >
                  Dibatalkan {{ m.batalOleh || '' }} · {{ m.batalAt }}: {{ m.batalAlasan || '' }}
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1.5">
                <UButton
                  v-if="m.adaFoto"
                  icon="i-lucide-image"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  title="Lihat foto"
                  aria-label="Lihat foto"
                  @click="lihatFoto('bl-movement', m.id, `${item(m.itemId)?.nama || 'Bukti'} — ${tglPendek(String(m.tanggal || ''))}`)"
                />
                <UButton
                  v-if="!m.batalAt && (m.jenis === 'break' || m.jenis === 'loss')"
                  icon="i-lucide-pen"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  title="Ubah"
                  aria-label="Ubah"
                  @click="editMutasi(m)"
                />
                <UButton
                  v-if="!m.batalAt"
                  icon="i-lucide-ban"
                  color="error"
                  variant="ghost"
                  size="sm"
                  title="Batalkan catatan salah input"
                  aria-label="Batalkan catatan salah input"
                  @click="bukaBatal(m)"
                />
              </div>
            </div>
          </div>
        </AppPanel>
      </template>
    </template>

    <!-- ============================ 2. BARANG & STOK ============================ -->
    <template v-else>
      <template v-if="subBarang === 'daftar'">
        <AppPanel :title="formItem.id ? 'Ubah barang' : 'Daftarkan barang baru'">
          <template
            v-if="formItem.id"
            #actions
          >
            <UButton
              label="Batal edit"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="resetItem"
            />
          </template>

          <UFormField label="Nama barang">
            <UInput
              v-model="formItem.nama"
              placeholder="cth: Piring saji putih 27cm"
              autocomplete="off"
              class="w-full"
            />
          </UFormField>

          <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <UFormField label="Kategori">
              <UInput
                v-model="formItem.kategori"
                list="bl-kat-saran"
                placeholder="cth: Piring"
                autocomplete="off"
                class="w-full"
              />
              <datalist id="bl-kat-saran">
                <option
                  v-for="k in katSaran"
                  :key="k"
                  :value="k"
                />
              </datalist>
            </UFormField>
            <UFormField label="Lokasi">
              <UInput
                v-model="formItem.lokasi"
                list="bl-lok-saran"
                placeholder="cth: Kitchen"
                autocomplete="off"
                class="w-full"
              />
              <datalist id="bl-lok-saran">
                <option
                  v-for="k in lokSaran"
                  :key="k"
                  :value="k"
                />
              </datalist>
            </UFormField>
            <UFormField label="Satuan">
              <USelect
                v-model="formItem.satuan"
                :items="satuanOpsi"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Harga satuan (Rp)">
              <UInput
                :model-value="formItem.harga === '' ? '' : String(formItem.harga)"
                type="number"
                min="0"
                placeholder="0"
                class="w-full"
                @update:model-value="formItem.harga = $event === '' || $event == null ? '' : Math.max(0, Number($event) || 0)"
              />
            </UFormField>
          </div>

          <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UFormField label="Stok minimum">
              <UInput
                :model-value="formItem.stokMin === '' ? '' : String(formItem.stokMin)"
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                placeholder="0"
                class="w-full"
                @update:model-value="formItem.stokMin = ketikBulat($event)"
              />
              <p class="mt-1 text-[12px] text-muted">
                Kartu ditandai "Stok menipis" kalau stoknya sudah sampai angka ini.
              </p>
            </UFormField>
            <UFormField
              v-if="!formItem.id"
              label="Stok awal (jumlah fisik sekarang)"
            >
              <UInput
                :model-value="formItem.stokAwal === '' ? '' : String(formItem.stokAwal)"
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                placeholder="0"
                class="w-full"
                @update:model-value="formItem.stokAwal = ketikBulat($event)"
              />
              <p class="mt-1 text-[12px] text-muted">
                Dicatat sebagai "Masuk — Stok awal". Boleh dikosongkan lalu diisi lewat Opname.
              </p>
            </UFormField>
          </div>

          <UFormField
            class="mt-4"
            label="Catatan"
          >
            <UTextarea
              v-model="formItem.catatan"
              :rows="2"
              placeholder="cth: dipakai untuk menu prasmanan"
              class="w-full"
            />
          </UFormField>

          <UFormField
            class="mt-4"
            label="Foto barang"
          >
            <div class="flex flex-wrap items-center gap-2.5">
              <input
                ref="fotoItemCam"
                type="file"
                accept="image/*"
                capture="environment"
                class="hidden"
                @change="pilihFotoItem($event, 'cam')"
              >
              <input
                ref="fotoItemFile"
                type="file"
                accept="image/*"
                class="hidden"
                @change="pilihFotoItem($event, 'file')"
              >
              <UButton
                label="Buka kamera"
                icon="i-lucide-camera"
                color="neutral"
                variant="outline"
                size="sm"
                @click="fotoItemCam?.click()"
              />
              <UButton
                label="Upload foto"
                icon="i-lucide-upload"
                color="neutral"
                variant="outline"
                size="sm"
                @click="fotoItemFile?.click()"
              />
              <img
                v-if="thumbItemTampil"
                :src="thumbItemTampil"
                alt="Pratinjau foto barang"
                class="size-14 rounded-field border border-default object-cover"
              >
              <UButton
                v-if="thumbItemTampil"
                icon="i-lucide-x"
                color="error"
                variant="ghost"
                size="sm"
                title="Buang foto"
                aria-label="Buang foto"
                @click="buangFotoItem"
              />
              <span
                v-else
                class="text-[12px] text-muted"
              >Foto membuat barang mudah dikenali saat mencatat.</span>
            </div>
          </UFormField>

          <p
            v-if="formItem.id"
            class="mt-4 text-[12px] text-muted"
          >
            Stok tidak diubah dari form ini — pakai tombol tambah stok atau Opname di Stok Terkini supaya perubahannya tercatat.
          </p>

          <div class="mt-5 flex flex-wrap gap-2">
            <UButton
              v-if="formItem.id"
              :label="item(formItem.id)?.aktif ? 'Nonaktifkan' : 'Aktifkan lagi'"
              :icon="item(formItem.id)?.aktif ? 'i-lucide-pause' : 'i-lucide-play'"
              color="neutral"
              variant="outline"
              @click="toggleAktif"
            />
            <UButton
              label="Simpan barang"
              icon="i-lucide-package"
              class="flex-1"
              :loading="menyimpanItem"
              @click="simpanItem"
            />
          </div>
        </AppPanel>
      </template>

      <template v-else>
        <AppPanel>
          <div class="flex flex-wrap items-center gap-2">
            <UInput
              v-model="sq"
              icon="i-lucide-search"
              placeholder="Cari nama, kategori, atau lokasi…"
              class="min-w-48 flex-1"
            />
            <AppSeg
              v-model="tampilStok"
              size="sm"
              :options="[
                { value: 'aktif', label: 'Aktif' },
                { value: 'non', label: 'Nonaktif' },
                { value: 'semua', label: 'Semua' },
              ]"
            />
            <USelect
              v-model="katFilter"
              :items="[{ value: 'SEMUA', label: 'Semua kategori' }, ...katSaran.map(k => ({ value: k, label: k }))]"
              class="w-auto"
            />
          </div>
        </AppPanel>

        <AppStatGrid>
          <AppStat
            label="Barang terdaftar"
            icon="i-lucide-package"
            :value="ringkasStok.nAktif"
            :sub="ringkasStok.nNon ? `${ringkasStok.nNon} nonaktif tidak dihitung` : 'semuanya aktif'"
          />
          <AppStat
            label="Stok menipis"
            icon="i-lucide-triangle-alert"
            :value="ringkasStok.tipis"
            sub="di bawah / sama dengan stok minimum"
            :tone="ringkasStok.tipis ? 'warning' : 'success'"
          />
          <AppStat
            label="Stok minus"
            icon="i-lucide-trending-down"
            :value="ringkasStok.minus"
            :sub="ringkasStok.minus ? 'perlu opname' : 'tidak ada'"
            :tone="ringkasStok.minus ? 'error' : 'success'"
          />
          <AppStat
            label="Nilai stok"
            icon="i-lucide-banknote"
            :value="rupiah(ringkasStok.nilai)"
            sub="stok × harga satuan"
            tone="info"
          />
        </AppStatGrid>

        <UAlert
          v-if="!items.length"
          color="neutral"
          variant="subtle"
          icon="i-lucide-package"
          title="Belum ada barang terdaftar"
          description="Daftarkan barang inventarisnya (piring, gelas, alat bar…) berikut fotonya lewat sub-tab Daftarkan Barang."
        />
        <UAlert
          v-else-if="!stokTampil.length"
          color="neutral"
          variant="subtle"
          icon="i-lucide-search"
          title="Tidak ada barang yang cocok dengan penyaring yang dipasang."
        />

        <div
          v-for="i in stokTampil"
          :key="i.id"
          class="mb-3 flex flex-wrap items-center gap-3 rounded-panel bg-default px-4 py-3.5 shadow-panel"
          :class="!i.aktif && 'opacity-60'"
        >
          <img
            v-if="i.thumb"
            :src="i.thumb"
            :alt="`Foto ${i.nama}`"
            class="size-14 shrink-0 cursor-pointer rounded-field border border-default object-cover"
            @click="lihatFoto('bl-item', i.id, i.nama)"
          >
          <span
            v-else
            class="flex size-14 shrink-0 items-center justify-center rounded-field border border-default bg-muted"
          >
            <UIcon
              name="i-lucide-utensils"
              class="size-6 text-dimmed"
            />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <b class="font-display text-[14px] font-bold text-highlighted">{{ i.nama }}</b>
              <AppStatus
                v-if="i.kategori"
                color="neutral"
                size="sm"
              >
                {{ i.kategori }}
              </AppStatus>
              <AppStatus
                v-if="i.lokasi"
                color="gold"
                size="sm"
              >
                {{ i.lokasi }}
              </AppStatus>
              <AppStatus
                v-if="!i.aktif"
                color="neutral"
                size="sm"
              >
                Nonaktif
              </AppStatus>
              <AppStatus
                v-else-if="menipis(i)"
                color="warning"
                size="sm"
              >
                Stok menipis
              </AppStatus>
            </div>
            <div class="mt-1 text-[12px] text-muted">
              Total break <b class="text-error num">{{ fmtBil(i.totBreak) }}</b> · loss <b class="text-vip num">{{ fmtBil(i.totLoss) }}</b>
              <template v-if="Number(i.harga)">
                · {{ rupiah(Number(i.harga)) }}/{{ i.satuan }}
              </template>
              <template v-if="Number(i.stokMin)">
                · min {{ fmtBil(i.stokMin) }}
              </template>
            </div>
            <div
              v-if="Number(i.stok) < 0"
              class="mt-1 text-[12px] text-error"
            >
              Stok minus — break/loss tercatat melebihi stok. Lakukan opname.
            </div>
          </div>
          <div class="shrink-0 text-right">
            <div
              class="font-display text-2xl font-bold num"
              :class="(menipis(i) || Number(i.stok) < 0) ? 'text-warning' : 'text-highlighted'"
            >
              {{ fmtBil(i.stok) }}
            </div>
            <div class="text-[11.5px] text-muted">
              {{ i.satuan }} · stok terkini
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-1.5">
            <template v-if="i.aktif">
              <UButton
                icon="i-lucide-zap"
                color="error"
                variant="ghost"
                size="sm"
                title="Catat break / loss"
                aria-label="Catat break / loss"
                @click="catatUntuk(i.id)"
              />
              <UButton
                icon="i-lucide-plus"
                color="success"
                variant="ghost"
                size="sm"
                title="Tambah stok (barang datang)"
                aria-label="Tambah stok (barang datang)"
                @click="bukaMo(i.id, 'masuk')"
              />
              <UButton
                icon="i-lucide-scale"
                color="neutral"
                variant="ghost"
                size="sm"
                title="Opname: hitung fisik"
                aria-label="Opname: hitung fisik"
                @click="bukaMo(i.id, 'opname')"
              />
            </template>
            <UButton
              icon="i-lucide-pen"
              color="neutral"
              variant="ghost"
              size="sm"
              title="Ubah barang"
              aria-label="Ubah barang"
              @click="editItem(i)"
            />
          </div>
        </div>
      </template>
    </template>

    <StockFotoSheet
      :id="fotoId"
      v-model:open="fotoSheet"
      :kind="fotoKind"
      :judul="fotoJudul"
    />

    <ResponsiveSheet
      v-model:open="sheetMo"
      :title="moOpname ? `Opname — ${moItem?.nama || ''}` : `Tambah stok — ${moItem?.nama || ''}`"
      description="Stok terkini menurut catatan"
    >
      <div class="grid grid-cols-1 gap-4">
        <p class="rounded-xl border border-default bg-muted px-3.5 py-2.5 text-sm">
          Stok terkini menurut catatan: <b class="num">{{ fmtBil(moItem?.stok) }} {{ moItem?.satuan }}</b>
        </p>
        <div class="grid grid-cols-2 gap-3">
          <UFormField :label="moOpname ? `Jumlah fisik (${moItem?.satuan || ''})` : `Jumlah masuk (${moItem?.satuan || ''})`">
            <UInput
              :model-value="mo.qty === '' ? '' : String(mo.qty)"
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              class="w-full text-center font-bold"
              @update:model-value="mo.qty = ketikBulat($event)"
            />
          </UFormField>
          <UFormField label="Tanggal">
            <UInput
              v-model="mo.tanggal"
              type="date"
              class="w-full"
            />
          </UFormField>
        </div>
        <p
          v-if="moOpname && moSelisih !== null && mo.qty !== ''"
          class="text-sm"
        >
          <template v-if="moSelisih === 0">
            Sama dengan catatan — tetap dicatat sebagai bukti sudah dihitung.
          </template>
          <template v-else>
            Selisih <b :class="moSelisih < 0 ? 'text-error' : 'text-success'">{{ moSelisih > 0 ? '+' : '' }}{{ fmtBil(moSelisih) }}</b> akan dicatat sebagai koreksi opname.
          </template>
        </p>
        <UFormField label="Keterangan">
          <UInput
            v-model="mo.ket"
            :placeholder="moOpname ? 'cth: opname akhir bulan' : 'cth: pembelian dari vendor'"
            class="w-full"
          />
        </UFormField>
      </div>
      <template #footer>
        <UButton
          label="Simpan"
          icon="i-lucide-check"
          :loading="menyimpanMo"
          @click="simpanMo"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="sheetMo = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetBatal"
      title="Batalkan catatan"
    >
      <p class="text-sm text-muted">
        Batalkan catatan {{ batalTarget ? `${jenisLabel(batalTarget.jenis)} ${fmtBil(Math.abs(Number(batalTarget.qty) || 0))} ${item(batalTarget.itemId)?.satuan || ''} ${item(batalTarget.itemId)?.nama || ''}` : '' }}
        ({{ batalTarget ? tglPendek(String(batalTarget.tanggal || '')) : '' }})?
        Catatannya tetap terlihat (dicoret) dan berhenti dihitung.
      </p>
      <UFormField
        class="mt-4"
        label="Alasan pembatalan"
        required
      >
        <UTextarea
          v-model="batalAlasan"
          :rows="2"
          placeholder="Tulis alasannya…"
          class="w-full"
        />
      </UFormField>
      <template #footer>
        <UButton
          label="Batalkan catatan"
          icon="i-lucide-ban"
          color="error"
          @click="batalGo"
        />
        <UButton
          label="Kembali"
          color="neutral"
          variant="outline"
          @click="sheetBatal = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
