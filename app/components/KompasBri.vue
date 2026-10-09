<!--
  Pencocokan QRIS BRI — THE SAME panel in Cashier and Finance › Kas Kecil (the
  old Office ran one shared `assets/cocok-bri.js`; docs F.20). Extracted
  2026-10-07; each page passes its own `useAsyncData` key and whether the
  viewer may change anything (`bolehUbah` — the Kas page matrix can make it
  read-only for viewers, old `bolehUbah('bri')`).

  Incoming BRI funds are matched to reservation DPs. A row is a PERSON'S
  STATEMENT that money arrived; DPs are READ from the reservasi module and
  CONNECTED (never copied). Nothing here deletes: a wrong row is cancelled with
  a reason, a DP that is not a valid BRI fund is MARKED (and can be lifted), a
  wrong match is released. The proof viewer downloads ONE file on demand.
-->
<script setup lang="ts">
import {
  barisGabungan, cbBlobUrl, cbBuktiGambar, cbBuktiKey, cbBuktiRef, cbJamWIB, cbNum, cbTglID,
  cbUsulan, caraLuar, dpBelumDicatat, dpBernisan, dpLuarBri, dpsBulan, filterBarisGab, hidupBaris, labelBulanYm,
  namaLuar, rentangBulan, statistikBri,
  type AbaiBri, type BarisBri, type DpBri, type GabRow,
} from '~/utils/cocok-bri'
import {
  addBriManual, cancelBri, getBri, ignoreBriDp, matchBri, unignoreBriDp,
} from '~/composables/useCashier'
import { getFile, getSection, listReservations, patchReservation, postAudit, type Reservasi, type ReservasiDp } from '~/composables/useReservasi'
import { fmtRp } from '~/utils/cashier'
import { hariIni } from '~/utils/format'
import { tanganiKonflik } from '~/utils/versi'

const props = withDefaults(defineProps<{ kunci?: string, bolehUbah?: boolean }>(), { bolehUbah: true })

const toast = useToast()
const izinUbah = computed(() => props.bolehUbah !== false)
const bulan = ref(hariIni().slice(0, 7))
const tapis = ref('semua')
const cari = ref('')
const hal = ref(1)
const PER_HAL = 25

const { data, status, error, refresh } = useAsyncData(props.kunci ?? 'cashier-bri', async () => {
  const r = rentangBulan(bulan.value)
  // Reservations are pulled WHOLE, like the old screen: a DP's transfer date
  // can fall in another month than its reservation date. `dpMethods` is read,
  // not copied — the reservasi module owns that list.
  const [bri, res, metode] = await Promise.all([
    getBri(r.dari, r.sampai),
    listReservations(),
    getSection<string[]>('dpMethods'),
  ])
  return { bri, res: res.data ?? [], metode: (metode.data ?? []).filter(Boolean) }
})

/** All reservation instalments, flattened exactly like the old `muatDp`. */
const dps = computed<DpBri[]>(() => {
  const out: DpBri[] = []
  for (const r of (data.value?.res ?? []) as Reservasi[]) {
    for (const p of (Array.isArray(r.dps) ? r.dps : []) as ReservasiDp[]) {
      const n = cbNum(p.tfAmount) > 0 ? cbNum(p.tfAmount) : cbNum(p.amount)
      out.push({
        resId: String(r.id || ''),
        dpId: String(p.id || ''),
        nama: String(r.name || ''),
        resTgl: String(r.date || ''),
        tfTgl: String(p.tfDate || ''),
        tfJam: String(p.tfTime || ''),
        bank: String(p.tfBank || ''),
        metode: String(p.method || ''),
        status: String(p.tfStatus || ''),
        nominal: Math.round(n),
        diketik: Math.round(cbNum(p.amount)),
        bukti: String(p.proofData || ''),
        buktiNama: String(p.proofName || ''),
      })
    }
  }
  return out
})

const rows = computed(() => data.value?.bri.baris ?? [])
const abaiMap = computed(() => {
  const m: Record<string, AbaiBri> = {}
  for (const a of data.value?.bri.abai ?? []) if (a?.dpId) m[a.dpId] = a
  return m
})
/** dpIds held by a live row in ANY month, seeded from the server (G-19). */
const dipakaiMap = computed(() => {
  const m: Record<string, boolean> = {}
  for (const id of data.value?.bri.dipakai ?? []) if (id) m[String(id)] = true
  return m
})
const gab = computed(() => barisGabungan(rows.value, dps.value))
const stats = computed(() => statistikBri(rows.value))
const bulanDps = computed(() => dpsBulan(dps.value, rows.value, abaiMap.value, bulan.value, dipakaiMap.value))
const belum = computed(() => dpBelumDicatat(bulanDps.value))
const luar = computed(() => dpLuarBri(dps.value, abaiMap.value, bulan.value))
const nisan = computed(() => dpBernisan(dps.value, rows.value, abaiMap.value, bulan.value, dipakaiMap.value))
const usulan = computed(() => cbUsulan(rows.value.filter(belumCocok), bulanDps.value))
const usulanPasti = computed(() => Object.keys(usulan.value).filter(i => usulan.value[i]!.babak.pasti))
const usulanKira = computed(() => Object.keys(usulan.value).filter(i => !usulan.value[i]!.babak.pasti))
const tampil = computed(() => filterBarisGab(gab.value, tapis.value, cari.value))
const totalHal = computed(() => Math.max(1, Math.ceil(tampil.value.length / PER_HAL)))
const halaman = computed(() => {
  const p = Math.min(Math.max(1, hal.value), totalHal.value)
  const mulai = (p - 1) * PER_HAL
  return { p, mulai, akhir: Math.min(mulai + PER_HAL, tampil.value.length), rows: tampil.value.slice(mulai, mulai + PER_HAL) }
})
const tab = computed(() => [
  { value: 'semua', label: `Semua (${gab.value.length})` },
  { value: 'rsv', label: `Dari reservasi (${stats.value.rsv.n})` },
  { value: 'luar', label: `Di luar reservasi (${stats.value.luar.n})` },
  { value: 'belum', label: `Belum ketahuan (${stats.value.belum.n})` },
  { value: 'batal', label: `Dibatalkan / tidak valid (${stats.value.dana.batal})` },
])
watch([tapis, cari], () => {
  hal.value = 1
})
watch(totalHal, (t) => {
  if (hal.value > t) hal.value = t
})

function isiPesan(msg: string) {
  toast.add({ title: msg, color: 'success' })
}
function isiGalat(e: unknown) {
  toast.add({ title: apiErrorMessage(e), color: 'error' })
}

// ---- Terapkan usulan pasti (satu per satu di server, bukan satu transaksi) ----
const sibuk = ref(false)
const pastiOpen = ref(false)
async function terapkanPasti() {
  if (!izinUbah.value) return isiGalat(new Error('Peranmu hanya boleh melihat halaman ini.'))
  pastiOpen.value = false
  if (sibuk.value) return
  sibuk.value = true
  try {
    const items = usulanPasti.value.map((i) => {
      const u = usulan.value[i]!
      return { id: i, cara: 'cocok' as const, resId: u.dp.resId, dpId: u.dp.dpId, resNama: u.dp.nama, resTgl: u.dp.resTgl }
    })
    const r = await matchBri({ items })
    const g = r.data.gagal?.length ?? 0
    isiPesan(`${r.data.n} baris tercocokkan${g ? `, ${g} gagal (lihat barisnya, kemungkinan DP-nya keburu dipakai)` : ''}.`)
    await refresh()
  }
  catch (e) {
    isiGalat(e)
  }
  finally {
    sibuk.value = false
  }
}
async function terimaUsul(row: GabRow) {
  const u = usulan.value[row.id]
  if (!u) return
  await cocokkan(row.mut.id, u.dp)
}
async function cocokkan(id: string, d: DpBri) {
  if (!izinUbah.value) return isiGalat(new Error('Peranmu hanya boleh melihat halaman ini.'))
  if (sibuk.value) return
  sibuk.value = true
  try {
    await matchBri({ id, cara: 'cocok', resId: d.resId, dpId: d.dpId, resNama: d.nama, resTgl: d.resTgl })
    kandidatOpen.value = false
    isiPesan(`Dicocokkan ke ${d.nama || '(tanpa nama)'}.`)
    await refresh()
  }
  catch (e) {
    isiGalat(e)
  }
  finally {
    sibuk.value = false
  }
}

// ---- Panel kandidat ----
const kandidatOpen = ref(false)
const kandidatRow = ref<BarisBri | null>(null)
const cariDp = ref('')
const kandidatList = computed(() => {
  const q = String(cariDp.value || '').toLowerCase()
  return bulanDps.value
    .filter(d => !d.dipakai)
    .filter(d => !q || [d.nama, d.nominal, d.tfTgl, d.resTgl, d.metode].join(' ').toLowerCase().includes(q))
})
function bukaKandidat(row: BarisBri) {
  kandidatRow.value = row
  cariDp.value = ''
  kandidatOpen.value = true
}
const selisihDp = (d: DpBri) => d.diketik !== d.nominal

// ---- Tandai di luar reservasi ----
const bukanOpen = ref(false)
const bukanRow = ref<BarisBri | null>(null)
const bukanCatatan = ref('')
function bukaBukan(row: BarisBri) {
  bukanRow.value = row
  bukanCatatan.value = row.catatan || ''
  bukanOpen.value = true
}
async function simpanBukan() {
  const row = bukanRow.value
  if (!row || !izinUbah.value) return
  if (!bukanCatatan.value.trim()) return toast.add({ title: 'Sebabnya wajib diisi.', color: 'error' })
  if (sibuk.value) return
  sibuk.value = true
  try {
    await matchBri({ id: row.id, cara: 'bukan', catatan: bukanCatatan.value.trim() })
    bukanOpen.value = false
    isiPesan('Ditandai bukan DP reservasi.')
    await refresh()
  }
  catch (e) {
    isiGalat(e)
  }
  finally {
    sibuk.value = false
  }
}

// ---- Lepas & batal ----
const lepasOpen = ref(false)
const lepasRow = ref<BarisBri | null>(null)
function bukaLepas(row: BarisBri) {
  lepasRow.value = row
  lepasOpen.value = true
}
async function jalanLepas() {
  const row = lepasRow.value
  if (!row || !izinUbah.value || sibuk.value) return
  sibuk.value = true
  try {
    await matchBri({ id: row.id, cara: 'lepas' })
    lepasOpen.value = false
    isiPesan('Pencocokan dilepas.')
    await refresh()
  }
  catch (e) {
    isiGalat(e)
  }
  finally {
    sibuk.value = false
  }
}

const batalOpen = ref(false)
const batalRow = ref<BarisBri | null>(null)
const batalAlasan = ref('')
function bukaBatal(row: BarisBri) {
  batalRow.value = row
  batalAlasan.value = ''
  batalOpen.value = true
}
async function jalanBatal() {
  const row = batalRow.value
  if (!row || !izinUbah.value || sibuk.value) return
  if (!batalAlasan.value.trim()) return toast.add({ title: 'Alasan pembatalan wajib diisi.', color: 'error' })
  sibuk.value = true
  try {
    await cancelBri(row.id, batalAlasan.value.trim(), row.diubah ?? 0)
    batalOpen.value = false
    isiPesan('Baris mutasi dibatalkan.')
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) isiGalat(e)
  }
  finally {
    sibuk.value = false
  }
}

// ---- Tambah dana masuk (juga dipakai tombol Catat pada kartu DP) ----
const tambahOpen = ref(false)
const tambah = reactive({ tgl: hariIni(), jam: '', nominal: '', ket: '', dp: '' })
function bukaTambah() {
  tambah.tgl = hariIni()
  tambah.jam = ''
  tambah.nominal = ''
  tambah.ket = ''
  tambah.dp = ''
  tambahOpen.value = true
}
function catatDp(d: DpBri) {
  tambah.tgl = d.tfTgl || ''
  tambah.jam = cbJamWIB(d.tfJam || '')
  tambah.nominal = String(d.nominal || '')
  tambah.ket = d.nama || ''
  tambah.dp = d.dpId
  tambahOpen.value = true
}
async function simpanTambah() {
  if (!izinUbah.value) return isiGalat(new Error('Peranmu hanya boleh melihat halaman ini.'))
  if (!tambah.tgl.trim()) return toast.add({ title: 'Tanggal wajib diisi.', color: 'error' })
  if (!(cbNum(tambah.nominal) > 0)) return toast.add({ title: 'Nominal wajib diisi.', color: 'error' })
  if (!tambah.ket.trim()) return toast.add({ title: 'Keterangan wajib diisi.', color: 'error' })
  if (sibuk.value) return
  sibuk.value = true
  const nom = cbNum(tambah.nominal)
  const diBulanLain = tambah.tgl.slice(0, 7) !== bulan.value
    ? ` Barisnya bertanggal ${cbTglID(tambah.tgl)} — ganti bulan ke ${labelBulanYm(tambah.tgl.slice(0, 7))} untuk melihatnya.`
    : ''
  try {
    const r = await addBriManual({ tgl: tambah.tgl, jam: tambah.jam, nominal: nom, ket: tambah.ket.trim() })
    tambahOpen.value = false
    if (tambah.dp) {
      const d = dps.value.find(x => x.dpId === tambah.dp)
      try {
        if (!d) throw new Error('DP tidak ditemukan')
        await matchBri({ id: r.data.id, cara: 'cocok', resId: d.resId, dpId: d.dpId, resNama: d.nama, resTgl: d.resTgl })
        isiPesan(`Dana masuk ${fmtRp(nom)} tersimpan dan tersambung ke ${d.nama || '(tanpa nama)'}.${diBulanLain}`)
      }
      catch {
        toast.add({ title: `Dana masuk ${fmtRp(nom)} TERSIMPAN, tapi BELUM tersambung ke DP-nya. Sambungkan lewat tombol Cocokkan di barisnya.${diBulanLain}`, color: 'warning' })
      }
    }
    else {
      isiPesan(`Dana masuk ${fmtRp(nom)} ditambahkan.${diBulanLain}`)
    }
    await refresh()
  }
  catch (e) {
    isiGalat(e)
  }
  finally {
    sibuk.value = false
  }
}

// ---- Tandai tidak valid / pulihkan ----
const abaiOpen = ref(false)
const abaiDp = ref<DpBri | null>(null)
const abaiAlasan = ref('')
function bukaAbai(d: DpBri) {
  abaiDp.value = d
  abaiAlasan.value = ''
  abaiOpen.value = true
}
async function simpanAbai() {
  const d = abaiDp.value
  if (!d || !izinUbah.value || sibuk.value) return
  if (!abaiAlasan.value.trim()) return toast.add({ title: 'Sebabnya wajib diisi.', color: 'error' })
  sibuk.value = true
  try {
    await ignoreBriDp({ dpId: d.dpId, resId: d.resId, nama: d.nama, tgl: d.tfTgl || d.resTgl, nominal: d.nominal, alasan: abaiAlasan.value.trim() })
    abaiOpen.value = false
    isiPesan(`Baris ${d.nama || ''} ditandai tidak valid. DP-nya tetap utuh di modul Reservasi.`)
    await refresh()
  }
  catch (e) {
    isiGalat(e)
  }
  finally {
    sibuk.value = false
  }
}
async function pulihkan(d: DpBri) {
  if (!izinUbah.value) return isiGalat(new Error('Peranmu hanya boleh melihat halaman ini.'))
  try {
    await unignoreBriDp(d.dpId)
    isiPesan('Penandaan dicabut — barisnya ikut dihitung lagi.')
    await refresh()
  }
  catch (e) {
    isiGalat(e)
  }
}

// ---- Betulkan metode DP (menulis LANGSUNG ke modul Reservasi, G-14) ----
const metodeOpen = ref(false)
const metodeDp = ref<DpBri | null>(null)
const metodeBaru = ref('')
function bukaMetode(d: DpBri) {
  metodeDp.value = d
  metodeBaru.value = d.metode || ''
  metodeOpen.value = true
}
async function simpanMetode() {
  const d = metodeDp.value
  if (!d || !izinUbah.value || sibuk.value) return
  if (!metodeBaru.value) return toast.add({ title: 'Pilih dulu metode pembayarannya.', color: 'error' })
  const r = (data.value?.res ?? []).find(x => String(x.id) === d.resId)
  if (!r) return toast.add({ title: 'Reservasinya sudah tidak ada di modul Reservasi.', color: 'error' })
  sibuk.value = true
  try {
    const list = (Array.isArray(r.dps) ? r.dps : []) as ReservasiDp[]
    const baru = list.map(p => ({ ...p, method: String(p.id) === d.dpId ? metodeBaru.value : p.method }))
    await patchReservation(d.resId, { dps: baru, dpMethod: String((baru[0] && baru[0].method) || '') }, r.updatedAt)
    try {
      await postAudit({ action: 'Ubah Metode DP', detail: `Metode DP ${fmtRp(d.nominal)}: ${d.metode || '(belum ada)'} → ${metodeBaru.value} (dari Pencocokan QRIS BRI)`, res: d.resId })
    }
    catch { /* audit gagal tidak membatalkan perubahan yang sudah tersimpan */ }
    metodeOpen.value = false
    isiPesan(`Metode DP ${d.nama || ''} diubah jadi "${metodeBaru.value}" di modul Reservasi.`)
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) isiGalat(e)
  }
  finally {
    sibuk.value = false
  }
}

// ---- Bukti transfer: diunduh SATU per klik, di-cache selama halaman hidup ----
const buktiOpen = ref(false)
const buktiJudul = ref('')
const buktiData = ref('')
const buktiNama = ref('')
const buktiGambar = ref(false)
const buktiMemuat = ref(false)
const buktiGalat = ref('')
const buktiCache = new Map<string, string>()
async function lihatBukti(d: DpBri) {
  buktiJudul.value = `Bukti transfer — ${d.nama || '(tanpa nama)'}`
  buktiNama.value = d.buktiNama || ''
  buktiData.value = ''
  buktiGalat.value = ''
  buktiOpen.value = true
  if (!d.bukti) {
    buktiGalat.value = 'DP ini tidak punya bukti transfer.'
    return
  }
  buktiMemuat.value = true
  try {
    if (!cbBuktiRef(d.bukti)) buktiData.value = d.bukti
    else {
      const key = cbBuktiKey(d.bukti)
      const cached = buktiCache.get(key)
      if (cached) buktiData.value = cached
      else {
        const f = await getFile(key)
        buktiCache.set(key, f.data.data)
        buktiData.value = f.data.data
      }
    }
    buktiGambar.value = cbBuktiGambar(d.bukti, d.buktiNama)
  }
  catch (e) {
    buktiGalat.value = `Bukti transfernya tidak terbaca: ${apiErrorMessage(e)}`
  }
  finally {
    buktiMemuat.value = false
  }
}
function bukaTabBukti() {
  const u = cbBlobUrl(buktiData.value)
  if (!u) {
    toast.add({ title: 'Bukti transfernya tidak bisa dibuka: bentuk berkasnya tidak dikenali.', color: 'error' })
    return
  }
  window.open(u, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(u), 60000)
}

const dpTgl = (d: DpBri) => (d.tfTgl ? cbTglID(d.tfTgl) : d.resTgl ? cbTglID(d.resTgl) : '—')
</script>

<template>
  <AppPage
    title="Pencocokan QRIS BRI"
    description="Dana masuk rekening BRI dicocokkan ke DP reservasi."
  >
    <AppPanel
      title="Dana masuk BRI"
      :description="`Menampilkan ${labelBulanYm(bulan)}. Satu baris = satu uang yang dinyatakan masuk; DP reservasi disambungkan ke barisnya lewat tombol Cocokkan.`"
    >
      <template #actions>
        <UInput
          v-model="bulan"
          type="month"
          size="sm"
          class="w-40"
        />
        <UButton
          label="Muat ulang"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="outline"
          size="sm"
          @click="refresh()"
        />
      </template>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Daftar mutasi tidak terbaca: ${apiErrorMessage(error)}.`"
      />
      <UAlert
        v-if="stats.tanpaTgl"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        :title="`${stats.tanpaTgl} transaksi tidak punya tanggal transfer`"
        description="Barisnya berdiri di paling bawah, di luar urutan waktu. Itu baris lama dari jalur unggah mutasi bank yang sudah dicabut — bukan data yang hilang."
        class="mb-3"
      />
      <p
        v-if="status === 'pending'"
        class="text-sm text-muted"
      >
        Memuat…
      </p>

      <AppStatGrid>
        <AppStat
          label="Dana masuk BRI"
          icon="i-lucide-banknote"
          :value="fmtRp(stats.dana.total)"
          :sub="`${stats.dana.n} transaksi${stats.dana.batal ? ` · ${stats.dana.batal} dibatalkan / tidak valid, tidak dihitung` : ''}`"
        />
        <AppStat
          label="Dari reservasi"
          icon="i-lucide-calendar-check"
          :value="fmtRp(stats.rsv.total)"
          :sub="`${stats.rsv.n} transaksi — sudah disambungkan ke DP`"
          tone="success"
        />
        <AppStat
          label="Di luar reservasi"
          icon="i-lucide-circle-slash"
          :value="fmtRp(stats.luar.total)"
          :sub="`${stats.luar.n} transaksi, bukan DP reservasi`"
        />
        <AppStat
          label="Belum ketahuan"
          icon="i-lucide-circle-help"
          :value="fmtRp(stats.belum.total)"
          :sub="`${stats.belum.n} baris yang belum disambungkan ke mana pun`"
          :tone="stats.belum.n ? 'warning' : undefined"
        />
      </AppStatGrid>

      <div class="mb-3 flex flex-wrap items-center gap-2">
        <AppSeg
          v-model="tapis"
          size="sm"
          :options="tab"
        />
        <UInput
          v-model="cari"
          icon="i-lucide-search"
          placeholder="Cari nama, nominal, tanggal…"
          size="sm"
          class="w-full sm:w-64"
        />
      </div>

      <div
        v-if="usulanPasti.length"
        class="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-field border border-default bg-muted px-3 py-2 text-sm"
      >
        <span>
          <b>{{ usulanPasti.length }} usulan pasti</b> — nominalnya cocok DAN namanya cocok DAN salah satu tanggalnya cocok.
          <span
            v-if="usulanKira.length"
            class="text-muted"
          > {{ usulanKira.length }} usulan kira-kira ditawarkan di barisnya masing-masing.</span>
        </span>
        <UButton
          v-if="izinUbah"
          :label="`Terapkan ${usulanPasti.length} usulan`"
          size="sm"
          :loading="sibuk"
          @click="pastiOpen = true"
        />
      </div>

      <table class="hidden w-full text-sm lg:table">
        <thead class="bg-table-head text-table-head-text">
          <tr>
            <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
              Tanggal
            </th>
            <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
              Jam (WIB)
            </th>
            <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
              Nominal
            </th>
            <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
              Dari
            </th>
            <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
              Bukti
            </th>
            <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
              Keterangan
            </th>
            <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="row in halaman.rows"
            :key="row.id"
            :class="!hidupBaris(row.mut) ? 'opacity-60' : ''"
          >
            <td class="px-3 py-2 whitespace-nowrap">
              {{ row.tgl || '—' }}
            </td>
            <td class="px-3 py-2 whitespace-nowrap">
              {{ row.jam || '—' }}
            </td>
            <td
              class="px-3 py-2 text-end font-semibold num"
              :class="!hidupBaris(row.mut) ? 'line-through' : ''"
            >
              {{ fmtRp(row.nominal) }}
            </td>
            <td class="px-3 py-2">
              <template v-if="!hidupBaris(row.mut)">
                <span class="text-error">dibatalkan</span>
                <div class="text-[11px] text-muted">
                  {{ row.mut.batalAlasan || '—' }}
                </div>
              </template>
              <template v-else-if="row.mut.cara === 'cocok'">
                <b class="text-highlighted">{{ row.mut.resNama || '(tanpa nama)' }}</b>
                <div
                  v-if="row.mut.resTgl"
                  class="text-[11px] text-muted"
                >
                  reservasi {{ cbTglID(row.mut.resTgl) }}
                </div>
                <div
                  v-if="row.mut.cocokOleh"
                  class="text-[11px] text-muted"
                >
                  dicocokkan {{ row.mut.cocokOleh }}
                </div>
              </template>
              <template v-else-if="row.mut.cara === 'bukan'">
                <span>{{ row.mut.catatan || 'di luar reservasi' }}</span>
                <div
                  v-if="row.mut.cocokOleh"
                  class="text-[11px] text-muted"
                >
                  oleh {{ row.mut.cocokOleh }}
                </div>
              </template>
              <template v-else-if="usulan[row.id]">
                <span class="text-primary-700">usul: <b>{{ usulan[row.id]!.dp.nama }}</b></span>
                <div class="text-[11px] text-muted">
                  {{ usulan[row.id]!.babak.teks }}
                </div>
                <UButton
                  label="Terima"
                  size="xs"
                  variant="outline"
                  class="mt-1"
                  @click="terimaUsul(row)"
                />
              </template>
              <template v-else>
                <span class="text-muted">belum ketahuan</span>
                <div class="text-[11px] text-muted">
                  baris mutasi bank
                </div>
              </template>
            </td>
            <td class="px-3 py-2">
              <template v-if="row.dp">
                <UButton
                  v-if="row.dp.bukti"
                  :label="cbBuktiGambar(row.dp.bukti, row.dp.buktiNama) ? 'Lihat' : 'PDF'"
                  :icon="cbBuktiGambar(row.dp.bukti, row.dp.buktiNama) ? 'i-lucide-image' : 'i-lucide-file-text'"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  @click="lihatBukti(row.dp)"
                />
                <AppStatus
                  v-else
                  color="warning"
                  size="sm"
                >
                  tanpa bukti
                </AppStatus>
              </template>
              <span
                v-else
                class="text-muted"
              >—</span>
            </td>
            <td class="px-3 py-2">
              {{ row.ket || '—' }}
            </td>
            <td class="px-3 py-2">
              <div
                v-if="izinUbah"
                class="flex flex-wrap justify-end gap-1"
              >
                <template v-if="hidupBaris(row.mut)">
                  <UButton
                    v-if="row.mut.cara !== 'cocok'"
                    label="Cocokkan"
                    size="xs"
                    @click="bukaKandidat(row.mut)"
                  />
                  <UButton
                    v-if="row.mut.cara !== 'bukan'"
                    label="Di luar"
                    color="neutral"
                    variant="outline"
                    size="xs"
                    @click="bukaBukan(row.mut)"
                  />
                  <UButton
                    v-else
                    label="Lepas"
                    color="neutral"
                    variant="outline"
                    size="xs"
                    @click="bukaLepas(row.mut)"
                  />
                  <UButton
                    v-if="row.mut.cara === 'cocok'"
                    label="Lepas"
                    color="neutral"
                    variant="outline"
                    size="xs"
                    @click="bukaLepas(row.mut)"
                  />
                  <UButton
                    label="Batalkan"
                    color="error"
                    variant="ghost"
                    size="xs"
                    @click="bukaBatal(row.mut)"
                  />
                </template>
              </div>
            </td>
          </tr>
          <tr v-if="!tampil.length">
            <td
              colspan="7"
              class="px-3 py-6 text-center text-sm text-muted"
            >
              <template v-if="!gab.length && belum.length">
                Belum ada satu baris dana masuk pun di bulan ini. Bulan ini punya <b>{{ belum.length }} DP reservasi</b>
                ({{ fmtRp(belum.reduce((s, d) => s + d.nominal, 0)) }}) yang uangnya masuk BRI dan belum dicatat —
                lihat kartu DP Reservasi yang Belum Dicatat di bawah.
              </template>
              <template v-else-if="!gab.length && luar.length">
                Belum ada satu transaksi BRI pun di bulan ini, tapi ada <b>{{ luar.length }} DP reservasi</b>
                ({{ fmtRp(luar.reduce((s, d) => s + d.nominal, 0)) }}) yang uangnya masuk rekening lain, lewat
                {{ caraLuar(luar).join(', ') }} — lihat kartu di bawah.
              </template>
              <template v-else>
                Tidak ada baris yang cocok dengan saringan yang sedang berlaku{{ cari ? ` dan kata kunci "${cari}"` : '' }}.
              </template>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="divide-y divide-default lg:hidden">
        <article
          v-for="row in halaman.rows"
          :key="row.id"
          class="space-y-1.5 py-3"
          :class="!hidupBaris(row.mut) ? 'opacity-60' : ''"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="text-sm text-highlighted">
                {{ row.tgl || '—' }} <span
                  v-if="row.jam"
                  class="text-muted"
                >· {{ row.jam }}</span>
              </p>
              <p class="text-[11px] text-muted">
                {{ row.jenis === 'manual' ? 'dana masuk manual' : 'baris mutasi bank' }}
              </p>
            </div>
            <b
              class="shrink-0 num"
              :class="!hidupBaris(row.mut) ? 'line-through text-muted' : ''"
            >{{ fmtRp(row.nominal) }}</b>
          </div>
          <p
            v-if="!hidupBaris(row.mut)"
            class="text-sm text-error"
          >
            dibatalkan — {{ row.mut.batalAlasan || '—' }}
          </p>
          <template v-else>
            <p
              v-if="row.mut.cara === 'cocok'"
              class="text-sm"
            >
              <b>{{ row.mut.resNama || '(tanpa nama)' }}</b>
              <span
                v-if="row.mut.resTgl"
                class="text-muted"
              > · reservasi {{ cbTglID(row.mut.resTgl) }}</span>
            </p>
            <p
              v-else-if="row.mut.cara === 'bukan'"
              class="text-sm"
            >
              {{ row.mut.catatan || 'di luar reservasi' }}
            </p>
            <p
              v-else-if="usulan[row.id]"
              class="text-sm text-primary-700"
            >
              usul: <b>{{ usulan[row.id]!.dp.nama }}</b> — {{ usulan[row.id]!.babak.teks }}
            </p>
            <p
              v-else
              class="text-sm text-muted"
            >
              belum ketahuan
            </p>
            <p
              v-if="row.ket"
              class="text-sm text-muted"
            >
              {{ row.ket }}
            </p>
            <div class="flex flex-wrap gap-1.5 pt-1">
              <UButton
                v-if="usulan[row.id] && izinUbah"
                label="Terima usul"
                size="xs"
                @click="terimaUsul(row)"
              />
              <UButton
                v-if="row.mut.cara !== 'cocok' && izinUbah"
                label="Cocokkan"
                size="xs"
                @click="bukaKandidat(row.mut)"
              />
              <UButton
                v-if="row.dp?.bukti"
                :label="cbBuktiGambar(row.dp.bukti, row.dp.buktiNama) ? 'Bukti' : 'Bukti PDF'"
                color="neutral"
                variant="outline"
                size="xs"
                @click="lihatBukti(row.dp)"
              />
              <UButton
                v-if="row.mut.cara !== 'bukan' && izinUbah"
                label="Di luar"
                color="neutral"
                variant="outline"
                size="xs"
                @click="bukaBukan(row.mut)"
              />
              <UButton
                v-if="(row.mut.cara === 'cocok' || row.mut.cara === 'bukan') && izinUbah"
                label="Lepas"
                color="neutral"
                variant="outline"
                size="xs"
                @click="bukaLepas(row.mut)"
              />
              <UButton
                v-if="izinUbah"
                label="Batalkan"
                color="error"
                variant="ghost"
                size="xs"
                @click="bukaBatal(row.mut)"
              />
            </div>
          </template>
        </article>
        <p
          v-if="!tampil.length"
          class="py-6 text-center text-sm text-muted"
        >
          Tidak ada baris yang cocok dengan saringan yang sedang berlaku.
        </p>
      </div>

      <div
        v-if="totalHal > 1"
        class="mt-3 flex flex-wrap items-center justify-between gap-2"
      >
        <UButton
          label="‹ Sebelumnya"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="halaman.p <= 1"
          @click="hal = halaman.p - 1"
        />
        <span class="text-xs text-muted">Menampilkan {{ halaman.mulai + 1 }}–{{ halaman.akhir }} dari {{ tampil.length }} baris</span>
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

    <AppPanel
      title="Tambah dana masuk"
      description="Satu baris = satu uang yang kamu lihat masuk di rekening. Kalau uangnya DP reservasi, sambungkan sesudahnya lewat tombol Cocokkan."
    >
      <template #actions>
        <UButton
          v-if="izinUbah"
          label="+ Tambah dana masuk"
          icon="i-lucide-plus"
          size="sm"
          @click="bukaTambah"
        />
      </template>
      <p class="text-sm text-muted">
        Daftar di atas berisi uang yang orang nyatakan masuk — diketik dari mutasi bank, bukan disalin dari bukti bayar.
        DP reservasi disambungkan ke barisnya; yang belum tersambung berdiri di kartu di bawah tabel, berikut tombol
        untuk mencatatnya sekali klik.
      </p>
    </AppPanel>

    <AppPanel
      title="DP reservasi yang belum dicatat"
      :description="belum.length ? `${belum.length} DP (${fmtRp(belum.reduce((s, d) => s + d.nominal, 0))}) uangnya masuk BRI dan belum punya baris dana masuk.` : 'Semua DP BRI bulan ini sudah punya barisnya.'"
    >
      <p
        v-if="!belum.length"
        class="text-sm text-muted"
      >
        Tidak ada yang menunggu di bulan ini.
      </p>
      <div
        v-else
        class="divide-y divide-default"
      >
        <div
          v-for="d in belum"
          :key="d.dpId"
          class="flex flex-wrap items-center justify-between gap-2 py-2"
        >
          <div class="min-w-0">
            <p class="text-sm font-semibold text-highlighted">
              {{ d.nama || '(tanpa nama)' }} <span class="font-normal text-muted num">{{ fmtRp(d.nominal) }}</span>
            </p>
            <p class="text-[11px] text-muted">
              {{ dpTgl(d) }} · metode {{ d.metode || d.bank || '(tanpa metode)' }}
              <template v-if="d.tfTgl === ''">
                · tanggal transfer tidak terbaca di bukti — isi sendiri dari mutasi banknya
              </template>
            </p>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <UButton
              v-if="d.bukti"
              :label="cbBuktiGambar(d.bukti, d.buktiNama) ? 'Bukti' : 'Bukti PDF'"
              color="neutral"
              variant="outline"
              size="xs"
              @click="lihatBukti(d)"
            />
            <UButton
              label="Catat"
              size="xs"
              :disabled="!izinUbah"
              @click="catatDp(d)"
            />
            <UButton
              label="Tidak valid"
              color="neutral"
              variant="outline"
              size="xs"
              :disabled="!izinUbah"
              @click="bukaAbai(d)"
            />
          </div>
        </div>
      </div>

      <template v-if="nisan.length">
        <AppSectionTitle
          class="mt-5"
          title="Ditandai tidak valid"
        />
        <div class="divide-y divide-default">
          <div
            v-for="d in nisan"
            :key="d.dpId"
            class="flex flex-wrap items-center justify-between gap-2 py-2"
          >
            <div class="min-w-0">
              <p class="text-sm text-muted line-through">
                {{ d.nama || '(tanpa nama)' }} <span class="num">{{ fmtRp(d.nominal) }}</span>
              </p>
              <p class="text-[11px] text-muted">
                {{ abaiMap[d.dpId]?.alasan || '—' }}<template v-if="abaiMap[d.dpId]?.oleh">
                  · oleh {{ abaiMap[d.dpId]!.oleh }}
                </template>
              </p>
            </div>
            <UButton
              label="Pulihkan"
              color="neutral"
              variant="outline"
              size="xs"
              :disabled="!izinUbah"
              @click="pulihkan(d)"
            />
          </div>
        </div>
      </template>
    </AppPanel>

    <AppPanel
      v-if="luar.length"
      title="DP bulan ini yang tidak masuk BRI"
      :description="`${luar.length} DP (${fmtRp(luar.reduce((s, d) => s + d.nominal, 0))}) uangnya masuk rekening lain, lewat ${caraLuar(luar).join(', ')}${namaLuar(luar).length ? ` — ${namaLuar(luar).join(', ')}` : ''}. Yang menentukan metode DP-nya, bukan bank pengirim di struk.`"
    >
      <div class="divide-y divide-default">
        <div
          v-for="d in luar"
          :key="d.dpId"
          class="flex flex-wrap items-center justify-between gap-2 py-2"
        >
          <div class="min-w-0">
            <p class="text-sm font-semibold text-highlighted">
              {{ d.nama || '(tanpa nama)' }} <span class="font-normal text-muted num">{{ fmtRp(d.nominal) }}</span>
            </p>
            <p class="text-[11px] text-muted">
              {{ dpTgl(d) }} · metode {{ d.metode || d.bank || '(tanpa metode)' }}
            </p>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <UButton
              v-if="d.bukti"
              :label="cbBuktiGambar(d.bukti, d.buktiNama) ? 'Bukti' : 'Bukti PDF'"
              color="neutral"
              variant="outline"
              size="xs"
              @click="lihatBukti(d)"
            />
            <UButton
              label="Ubah metode"
              color="neutral"
              variant="outline"
              size="xs"
              :disabled="!izinUbah"
              @click="bukaMetode(d)"
            />
          </div>
        </div>
      </div>
      <p class="mt-3 text-sm text-muted">
        Kalau uangnya sebenarnya masuk BRI, betulkan metode DP itu di sini — barisnya muncul di daftar begitu itu beres.
      </p>
    </AppPanel>

    <!-- Kandidat pencocokan -->
    <ResponsiveSheet
      v-model:open="kandidatOpen"
      :title="kandidatRow ? `Cocokkan ${fmtRp(cbNum(kandidatRow.nominal))} ke DP reservasi` : 'Cocokkan'"
    >
      <div class="space-y-3">
        <UInput
          v-model="cariDp"
          icon="i-lucide-search"
          placeholder="Cari nama, nominal, tanggal…"
          class="w-full"
        />
        <p
          v-if="!kandidatList.length"
          class="rounded-field bg-muted px-3 py-4 text-center text-sm text-muted"
        >
          Tidak ada DP yang bisa dipilih. DP yang sudah dipegang baris lain, ditandai tidak valid, atau di luar bulan ini tidak ditawarkan.
        </p>
        <div
          v-else
          class="max-h-96 divide-y divide-default overflow-y-auto"
        >
          <div
            v-for="d in kandidatList"
            :key="d.dpId"
            class="flex flex-wrap items-center justify-between gap-2 py-2"
          >
            <div class="min-w-0">
              <p class="text-sm font-semibold text-highlighted">
                {{ d.nama || '(tanpa nama)' }} <span class="font-normal text-muted num">{{ fmtRp(d.nominal) }}</span>
              </p>
              <p class="text-[11px] text-muted">
                {{ dpTgl(d) }} · metode {{ d.metode || d.bank || '(tanpa metode)' }}
                <template v-if="selisihDp(d)">
                  · diketik {{ fmtRp(d.diketik) }}
                </template>
              </p>
            </div>
            <div class="flex gap-1.5">
              <UButton
                v-if="d.bukti"
                :label="cbBuktiGambar(d.bukti, d.buktiNama) ? 'Bukti' : 'PDF'"
                color="neutral"
                variant="outline"
                size="xs"
                @click="lihatBukti(d)"
              />
              <UButton
                label="Pilih"
                size="xs"
                :loading="sibuk"
                @click="kandidatRow && cocokkan(kandidatRow.id, d)"
              />
            </div>
          </div>
        </div>
      </div>
    </ResponsiveSheet>

    <!-- Di luar reservasi -->
    <ResponsiveSheet
      v-model:open="bukanOpen"
      title="Uang ini masuk dari mana?"
    >
      <p class="mb-3 text-sm text-muted">
        Wajib diisi: baris tanpa sebab tidak bisa diperiksa siapa pun, dan ia jadi tempat paling mudah menyembunyikan
        uang yang sebenarnya belum dicocokkan.
      </p>
      <UFormField label="Sebab / keterangan *">
        <UInput
          v-model="bukanCatatan"
          placeholder="mis. Event corporate PT Ibra, Sewa videotron, Setoran tamu"
          class="w-full"
        />
      </UFormField>
      <template #footer>
        <UButton
          label="Simpan"
          :loading="sibuk"
          @click="simpanBukan"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="bukanOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <!-- Lepas -->
    <ResponsiveSheet
      v-model:open="lepasOpen"
      title="Lepas pencocokan baris ini?"
    >
      <p class="text-sm">
        Baris mutasinya TIDAK dihapus — ia cuma kembali ke daftar "belum dicocokkan", dan DP-nya bebas dipakai baris lain.
      </p>
      <template #footer>
        <UButton
          label="Lepas"
          :loading="sibuk"
          @click="jalanLepas"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="lepasOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <!-- Batalkan baris -->
    <ResponsiveSheet
      v-model:open="batalOpen"
      title="Batalkan baris mutasi ini?"
    >
      <p class="mb-3 text-sm">
        Barisnya TIDAK dihapus — ia tetap tergambar, tercoret, dan berhenti ikut dijumlahkan.
      </p>
      <UFormField label="Alasan pembatalan *">
        <UInput
          v-model="batalAlasan"
          class="w-full"
        />
      </UFormField>
      <template #footer>
        <UButton
          label="Batalkan baris"
          color="error"
          :loading="sibuk"
          @click="jalanBatal"
        />
        <UButton
          label="Tutup"
          color="neutral"
          variant="ghost"
          @click="batalOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <!-- Terapkan usulan pasti -->
    <ResponsiveSheet
      v-model:open="pastiOpen"
      :title="`Terapkan ${usulanPasti.length} usulan?`"
    >
      <p class="text-sm">
        {{ usulanPasti.length }} baris mutasi akan dicocokkan ke DP reservasi. Semuanya nominal, nama, dan salah satu
        tanggalnya cocok. Yang salah tetap bisa dilepas satu per satu setelah ini.
      </p>
      <template #footer>
        <UButton
          label="Terapkan"
          :loading="sibuk"
          @click="terapkanPasti"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="pastiOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <!-- Tambah dana masuk -->
    <ResponsiveSheet
      v-model:open="tambahOpen"
      title="Catat dana masuk"
    >
      <div class="space-y-3">
        <UAlert
          v-if="tambah.dp && dps.find(d => d.dpId === tambah.dp)"
          color="info"
          variant="subtle"
          icon="i-lucide-link"
          :title="`Isian diisi dari DP ${dps.find(d => d.dpId === tambah.dp)?.nama || ''} — begitu disimpan, barisnya langsung disambungkan ke DP itu.`"
          :description="dps.find(d => d.dpId === tambah.dp)?.tfTgl ? undefined : 'Tanggal transfernya tidak terbaca di bukti — isi sendiri dari mutasi banknya.'"
        />
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField label="Tanggal *">
            <UInput
              v-model="tambah.tgl"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Jam (boleh kosong)">
            <UInput
              v-model="tambah.jam"
              type="time"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Nominal *">
          <UInput
            v-model="tambah.nominal"
            inputmode="numeric"
            placeholder="0"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Keterangan — uang ini masuk dari mana *"
          help="Wajib diisi — baris dana masuk tanpa sebab tidak bisa diperiksa siapa pun."
        >
          <UInput
            v-model="tambah.ket"
            placeholder="mis. Event corporate PT Ibra Harisindo"
            class="w-full"
          />
        </UFormField>
      </div>
      <template #footer>
        <UButton
          label="Simpan dana masuk"
          :loading="sibuk"
          @click="simpanTambah"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="tambahOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <!-- Tandai tidak valid -->
    <ResponsiveSheet
      v-model:open="abaiOpen"
      title="Kenapa baris ini tidak valid?"
    >
      <p class="mb-3 text-sm text-muted">
        Mis. "dobel dengan transfer 5 Sep", "DP batal, uang dikembalikan", "salah catat". Wajib diisi — baris yang
        dicabut dari rekonsiliasi tanpa sebab tidak bisa diperiksa siapa pun. DP-nya TIDAK dihapus dari modul Reservasi.
      </p>
      <UFormField label="Sebab *">
        <UInput
          v-model="abaiAlasan"
          class="w-full"
        />
      </UFormField>
      <template #footer>
        <UButton
          label="Tandai tidak valid"
          :loading="sibuk"
          @click="simpanAbai"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="abaiOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <!-- Ubah metode DP -->
    <ResponsiveSheet
      v-model:open="metodeOpen"
      :title="metodeDp ? `Ubah metode DP ${metodeDp.nama || '(tanpa nama)'}` : 'Ubah metode DP'"
    >
      <p class="mb-3 text-sm">
        Ini menulis LANGSUNG ke modul Reservasi, dan barisnya akan ikut pindah di seluruh layar yang membacanya.
        Metode menentukan apakah uangnya dihitung sebagai dana masuk BRI.
      </p>
      <UFormField label="Metode pembayaran">
        <USelect
          v-model="metodeBaru"
          :items="(data?.metode ?? []).map(m => ({ label: m, value: m }))"
          class="w-full"
        />
      </UFormField>
      <template #footer>
        <UButton
          label="Simpan metode"
          :loading="sibuk"
          @click="simpanMetode"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="metodeOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <!-- Bukti transfer -->
    <ResponsiveSheet
      v-model:open="buktiOpen"
      :title="buktiJudul"
    >
      <p
        v-if="buktiMemuat"
        class="py-6 text-center text-sm text-muted"
      >
        Memuat bukti transfer…
      </p>
      <p
        v-else-if="buktiGalat"
        class="rounded-field bg-muted px-3 py-4 text-center text-sm text-muted"
      >
        {{ buktiGalat }}
      </p>
      <div v-else-if="buktiGambar">
        <img
          :src="buktiData"
          :alt="`Bukti transfer ${buktiJudul}`"
          class="max-h-[70vh] w-full rounded-field object-contain"
        >
        <p class="mt-2 text-[11px] text-muted">
          {{ buktiNama || 'berkas bukti' }}
        </p>
      </div>
      <div
        v-else
        class="space-y-3"
      >
        <p class="text-sm text-muted">
          Bukti ini bukan gambar ({{ buktiNama || 'berkas' }}). Buka di tab baru untuk membacanya.
        </p>
        <UButton
          label="Buka bukti di tab baru"
          icon="i-lucide-external-link"
          @click="bukaTabBukti"
        />
      </div>
      <template #footer>
        <UButton
          label="Tutup"
          color="neutral"
          variant="ghost"
          @click="buktiOpen = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
