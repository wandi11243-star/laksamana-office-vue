<!--
  Google Review — invitations to guests, claims, and their verification.
  Two panels: guests not yet asked (from arrived reservations in the period),
  and the review list (mine, unless the reader may see everyone's).

  Item writes go to PUT /master/reviews/{id} with the LOADED section version;
  after a conflict the section reloads and the open sheet re-snapshots.
  Photos travel as data URIs in the record; the server moves them to
  rv:<id> / rv2:<id> and leaves @f: references behind.
  Source: laksamana-office/deploy/service_excellent/index.html:7718-8835.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Reservasi } from '~/composables/useReservasi'
import {
  deleteSectionItem, getFile, listReservations, postAudit, putSectionItem,
  useSectionVersi,
} from '~/composables/useReservasi'
import type { Review } from '~/composables/useServiceExcellent'
import { usePeriodeReview, useReviewCfg } from '~/composables/useServiceExcellent'
import { apiErrorMessage } from '~/composables/useApi'
import { tanganiKonflik, versiDari } from '~/utils/versi'
import {
  bolehAksiSe, bolehBukaSe, tingkatSe,
} from '~/utils/layar/service_excellent'
import { DIVISI_MINTA_REVIEW, dalamRentang, divisiCocok, hostDari, labelRentang, layakDiminta, rentangReview } from '~/utils/service-excellent'
import { normPhone, tampilPhone, uid } from '~/utils/dp-reservasi'
import { angka, hariIni, tglPanjang, tglPendek } from '~/utils/format'
import { waKirim, waSalin } from '~/utils/wa'

definePageMeta({ access: ['service_excellent'] })

const me = useMe()
const toast = useToast()
const tingkat = computed(() => tingkatSe(me.value))
const namaSaya = computed(() => me.value?.name ?? '')

const periode = usePeriodeReview()
const rentang = computed(() => rentangReview(periode.value.mode, periode.value.date, periode.value.month))
const labelPeriode = computed(() => labelRentang(
  periode.value.mode, rentang.value,
  tglPanjang, tglPendek,
  new Date(`${periode.value.month}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
))

// --- reads ---------------------------------------------------------------------

const reviews = useSectionVersi<Review[]>('reviews')
const daftarReview = computed(() => reviews.data.value?.data ?? [])
const versiReviews = computed(() => versiDari(reviews.data.value))
const { data: cfg } = useReviewCfg()

const { data: reservasi } = useAsyncData(
  'se-review-reservasi',
  () => listReservations(rentang.value.from, rentang.value.to).then(r => r.data),
  { watch: [rentang], default: () => [] },
)

// --- permissions -----------------------------------------------------------------
// The ask panel is division work, not role work: kitchen may manage, but
// chasing Google reviews is not their job (`:7720-7738`).

const waAktif = computed(() => cfg.value?.waAktif !== false)
const adminSe = computed(() => tingkat.value === 'admin')
const divisiSaya = computed(() => me.value?.keterangan ?? '')
const lihatPanelMinta = computed(() => adminSe.value || divisiCocok(divisiSaya.value, DIVISI_MINTA_REVIEW))
const panelMintaTampil = computed(() => waAktif.value && lihatPanelMinta.value)

const bolehMinta = computed(() => bolehAksiSe('mintaReview', tingkat.value))
const bolehCatat = computed(() => bolehAksiSe('catatReview', tingkat.value))
const bolehVerif = computed(() => bolehAksiSe('master', tingkat.value))
const bolehHapus = computed(() => bolehAksiSe('deleteReview', tingkat.value))

/** Admin, office, or a claim verifier sees everyone's list — otherwise the verifier's button could never be pressed (`:7780-7798`). */
const lihatSemua = computed(() => adminSe.value || divisiCocok(divisiSaya.value, ['office']) || bolehVerif.value)

// --- eligible guests ---------------------------------------------------------------

const target = computed(() => layakDiminta(
  (reservasi.value ?? []),
  rentang.value,
  new Set(daftarReview.value.map(x => x.resId).filter(Boolean)),
  normPhone,
))

const cariBelum = ref('')
const belumTampil = computed(() => {
  const q = cariBelum.value.trim().toLowerCase()
  return target.value.belum.filter(r => !q || [r.name, r.phone, r.table].some(v => String(v || '').toLowerCase().includes(q)))
})

// --- the review list -------------------------------------------------------------------

const saya = computed(() => String(namaSaya.value).trim().toLowerCase())
const milikSaya = (x: Review) => [x.host, x.claimedBy, x.by].some(v => String(v || '').trim().toLowerCase() === saya.value)

const cariDaftar = ref('')
const daftarTampil = computed(() => {
  const dasar = lihatSemua.value ? daftarReview.value : daftarReview.value.filter(milikSaya)
  const q = cariDaftar.value.trim().toLowerCase()
  return dasar
    .filter(x => dalamRentang(x.date, rentang.value))
    .filter(x => !q || [x.name, x.reviewerName, x.phone, x.claimedBy, x.by].some(v => String(v || '').toLowerCase().includes(q)))
    .sort((a, b) => (b.claimedAt || b.at || 0) - (a.claimedAt || a.at || 0))
})

const halDaftar = ref(1)
const perHal = ref(10)
const maxHalDaftar = computed(() => Math.max(1, Math.ceil(daftarTampil.value.length / perHal.value)))
const halamanDaftar = computed(() => daftarTampil.value.slice((halDaftar.value - 1) * perHal.value, halDaftar.value * perHal.value))
watch([daftarTampil, perHal], () => {
  halDaftar.value = Math.min(halDaftar.value, maxHalDaftar.value)
})

const halBelum = ref(1)
const maxHalBelum = computed(() => Math.max(1, Math.ceil(belumTampil.value.length / perHal.value)))
const halamanBelum = computed(() => belumTampil.value.slice((halBelum.value - 1) * perHal.value, halBelum.value * perHal.value))
watch([belumTampil, perHal], () => {
  halBelum.value = Math.min(halBelum.value, maxHalBelum.value)
})

const warnaStatus: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  diminta: 'neutral',
  diklaim: 'warning',
  terverifikasi: 'success',
  ditolak: 'error',
}
const labelStatus: Record<string, string> = {
  diminta: 'Diminta',
  diklaim: 'Perlu verifikasi',
  terverifikasi: 'Terverifikasi',
  ditolak: 'Ditolak',
}

const kolomBelum = computed<TableColumn<Reservasi>[]>(() => [
  { accessorKey: 'date', header: 'Tanggal' },
  { accessorKey: 'time', header: 'Jam' },
  { accessorKey: 'name', header: 'Tamu' },
  { accessorKey: 'pax', header: 'Pax' },
  { accessorKey: 'table', header: 'Meja' },
  { accessorKey: 'aksi', header: 'Aksi' },
])

const kolomDaftar = computed<TableColumn<Review>[]>(() => [
  { accessorKey: 'name', header: 'Tamu' },
  { accessorKey: 'reviewerName', header: 'Nama akun Google' },
  { accessorKey: 'date', header: 'Tanggal' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'host', header: 'Nama' },
  { accessorKey: 'aksi', header: 'Aksi' },
])

// --- ask ---------------------------------------------------------------------------
// The note exists the moment the invitation goes out — its presence IS the
// proof of asking. `askedAt` is its own field: `date` later becomes the REVIEW
// date on claim (`:7987-8000`).

const teksAjakan = (nama: string) =>
  `Halo Kak ${nama} 👋\n\nTerima kasih sudah mampir ke *Laksamana Muda* ⚓\nKalau berkenan, boleh bantu kami dengan ulasan Google-nya? Cukup 1 menit 🙏\n\n${cfg.value?.link ?? ''}\n\nUlasan Kakak sangat berarti buat kami 🌟`

async function mintaReview(r: Reservasi) {
  if (!waAktif.value) {
    toast.add({ title: 'Ajakan review lewat WhatsApp sedang dimatikan di Setelan', color: 'error' })
    return
  }
  if (!bolehMinta.value) {
    toast.add({ title: 'Role kamu tidak berhak mengirim ajakan review', color: 'error' })
    return
  }
  if (!cfg.value?.link) {
    toast.add({ title: 'Link Google Review belum diatur — isi dulu di halaman Setelan', color: 'error' })
    return
  }
  try {
    const ada = daftarReview.value.find(x => x.resId === r.id)
    const kini = Date.now()
    const rv: Review = ada
      ? { ...ada, at: kini, askedAt: kini, by: namaSaya.value, askedBy: namaSaya.value }
      : {
          id: uid(), resId: r.id, name: r.name, phone: r.phone, date: r.date || hariIni(),
          status: 'diminta', reviewerName: '', host: '', tableNo: '',
          proofData: '', proofName: '', proof2Data: '', proof2Name: '',
          by: namaSaya.value, at: kini, askedAt: kini, askedBy: namaSaya.value,
          claimedBy: '', claimedAt: 0, verifiedBy: '', verifiedAt: 0, rejectNote: '',
        }
    await putSectionItem('reviews', rv.id, rv, versiReviews.value)
    await reviews.refresh()
    await postAudit({ action: 'Google Review', detail: `Ajakan review dikirim ke ${r.name}` })
    if (r.phone) await waKirim(r.phone, teksAjakan(r.name))
    else toast.add({ title: 'Nomor HP tamu kosong — kirim manual', color: 'error' })
    toast.add({ title: 'Dicatat: ajakan review terkirim', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => reviews.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

async function salinLink() {
  if (!cfg.value?.link) {
    toast.add({ title: 'Link belum diatur', color: 'error' })
    return
  }
  const ok = await waSalin(cfg.value.link)
  toast.add({ title: ok ? 'Link review disalin' : 'Gagal menyalin', color: ok ? 'success' : 'error' })
}

// --- claim form ----------------------------------------------------------------------
// Foto 1 now, Foto 2 may follow (usually H+1) — but nothing verifies without
// Foto 2. Same-account and same-phone guards run across time (`:8098-8123`).

const sheetKlaim = ref(false)
const klaim = reactive({
  id: '', resId: '', nama: '', phone: '', reviewer: '', meja: '', tanggal: hariIni(),
  foto1: null as File | null, namaFoto1: '', foto1Lama: '', namaFoto1Lama: '',
  foto2: null as File | null, namaFoto2: '', foto2Lama: '', namaFoto2Lama: '',
  host: '',
})

function bukaKlaim(rvId = '', resId = '') {
  const semua = daftarReview.value
  const rv = rvId ? semua.find(x => x.id === rvId) : (resId ? semua.find(x => x.resId === resId) : null)
  const r = resId ? (reservasi.value ?? []).find(x => x.id === resId) : null
  Object.assign(klaim, {
    id: rv?.id ?? '', resId: resId || rv?.resId || '',
    nama: rv?.name || r?.name || '', phone: rv?.phone ? tampilPhone(rv.phone) : (r?.phone ? tampilPhone(r.phone) : ''),
    reviewer: rv?.reviewerName || '', meja: rv?.tableNo || '', tanggal: rv?.date || hariIni(),
    foto1: null, namaFoto1: '', foto1Lama: rv?.proofData || '', namaFoto1Lama: rv?.proofName || '',
    foto2: null, namaFoto2: '', foto2Lama: rv?.proof2Data || '', namaFoto2Lama: rv?.proof2Name || '',
    host: rv?.host || namaSaya.value,
  })
  sheetKlaim.value = true
}

function pilihFoto(e: Event, mana: 1 | 2) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  if (f && f.size > 5 * 1024 * 1024) {
    toast.add({ title: 'Foto melebihi 5 MB — kecilkan dulu', color: 'error' })
    return
  }
  if (mana === 1) {
    klaim.foto1 = f
    klaim.namaFoto1 = f ? f.name : ''
  }
  else {
    klaim.foto2 = f
    klaim.namaFoto2 = f ? f.name : ''
  }
}

const bacaBerkas = (f: File): Promise<string> => new Promise((resolve, reject) => {
  const fr = new FileReader()
  fr.onload = () => resolve(String(fr.result))
  fr.onerror = () => reject(fr.error)
  fr.readAsDataURL(f)
})

/** Reload the open claim from the newest section after a conflict. */
async function muatUlangKlaim() {
  await reviews.refresh()
  if (!klaim.id) return
  const rv = daftarReview.value.find(x => x.id === klaim.id)
  if (rv) bukaKlaim(rv.id, rv.resId)
}

async function simpanKlaim() {
  if (!bolehCatat.value) return
  const nama = klaim.nama.trim()
  const reviewer = klaim.reviewer.trim()
  if (!nama) {
    toast.add({ title: 'Nama tamu wajib diisi', color: 'error' })
    return
  }
  if (!reviewer) {
    toast.add({ title: 'Nama akun Google (reviewer) wajib diisi — ini kunci verifikasinya', color: 'error' })
    return
  }
  const adaFoto1 = klaim.foto1 || klaim.foto1Lama
  if (!adaFoto1) {
    toast.add({ title: 'Foto 1 (screenshot review tamu) wajib dilampirkan', color: 'error' })
    return
  }
  const telp = normPhone(klaim.phone)
  const kembar = daftarReview.value.find(x =>
    x.id !== klaim.id
    && ['diklaim', 'terverifikasi'].includes(x.status) && (
      (reviewer && String(x.reviewerName || '').trim().toLowerCase() === reviewer.toLowerCase())
      || (telp && normPhone(x.phone || '') === telp)
    ))
  if (kembar) {
    const samaAkun = reviewer && String(kembar.reviewerName || '').trim().toLowerCase() === reviewer.toLowerCase()
    toast.add({
      title: samaAkun
        ? `Akun Google "${kembar.reviewerName}" sudah pernah diklaim (${kembar.name}, ${tglPendek(kembar.date)}). Satu akun hanya bisa satu review.`
        : `Nomor HP ini sudah pernah mengklaim review (${kembar.name}, ${tglPendek(kembar.date)}).`,
      color: 'error',
    })
    return
  }
  try {
    const lama = klaim.id ? daftarReview.value.find(x => x.id === klaim.id) : null
    const host = lama?.host ? lama.host : namaSaya.value
    const rv: Review = {
      id: klaim.id || uid(),
      resId: klaim.resId,
      name: nama,
      phone: telp,
      reviewerName: reviewer,
      host,
      tableNo: klaim.meja.trim(),
      date: klaim.tanggal || hariIni(),
      status: 'diklaim',
      proofData: klaim.foto1 ? await bacaBerkas(klaim.foto1) : (lama?.proofData || ''),
      proofName: klaim.foto1 ? klaim.foto1.name : (lama?.proofName || ''),
      proof2Data: klaim.foto2 ? await bacaBerkas(klaim.foto2) : (lama?.proof2Data || ''),
      proof2Name: klaim.foto2 ? klaim.foto2.name : (lama?.proof2Name || ''),
      by: lama?.by || namaSaya.value,
      at: lama?.at || Date.now(),
      askedAt: lama?.askedAt,
      askedBy: lama?.askedBy,
      claimedBy: namaSaya.value,
      claimedAt: Date.now(),
      verifiedBy: '',
      verifiedAt: 0,
      rejectNote: '',
    }
    await putSectionItem('reviews', rv.id, rv, versiReviews.value)
    await reviews.refresh()
    await postAudit({ action: 'Google Review', detail: `Klaim review dicatat: ${nama} (akun: ${reviewer}, host: ${host}, meja: ${rv.tableNo})` })
    sheetKlaim.value = false
    toast.add({ title: 'Klaim dicatat — menunggu manager memverifikasi', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlangKlaim))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- verify / reject / delete ----------------------------------------------------------

const sheetVerif = ref(false)
const verifId = ref('')

function bukaVerif(id: string) {
  const rv = daftarReview.value.find(x => x.id === id)
  if (!rv) return
  if (!rv.proof2Data) {
    toast.add({ title: 'Belum bisa diverifikasi — Foto 2 (bukti poin bertambah) belum dilampirkan. Minta host melengkapinya lewat Ubah.', color: 'error' })
    return
  }
  verifId.value = id
  sheetVerif.value = true
}

async function verifGo() {
  const id = verifId.value
  sheetVerif.value = false
  if (!id) return
  try {
    const lama = daftarReview.value.find(x => x.id === id)
    if (!lama) {
      toast.add({ title: 'Catatannya tidak ketemu — daftar dimuat ulang', color: 'error' })
      await reviews.refresh()
      return
    }
    await putSectionItem('reviews', id, {
      ...lama, status: 'terverifikasi', verifiedBy: namaSaya.value, verifiedAt: Date.now(), rejectNote: '',
    }, versiReviews.value)
    await reviews.refresh()
    await postAudit({ action: 'Google Review', detail: `Review ${lama.name} (${lama.reviewerName}) TERVERIFIKASI` })
    toast.add({ title: 'Review terverifikasi', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => reviews.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

const sheetTolak = ref(false)
const tolak = reactive({ id: '', nama: '', alasan: '' })

function bukaTolak(id: string) {
  const rv = daftarReview.value.find(x => x.id === id)
  if (!rv) return
  Object.assign(tolak, { id, nama: rv.name, alasan: '' })
  sheetTolak.value = true
}

async function tolakGo() {
  const id = tolak.id
  sheetTolak.value = false
  if (!id) return
  try {
    const lama = daftarReview.value.find(x => x.id === id)
    if (!lama) {
      toast.add({ title: 'Catatannya tidak ketemu — daftar dimuat ulang', color: 'error' })
      await reviews.refresh()
      return
    }
    await putSectionItem('reviews', id, {
      ...lama, status: 'ditolak', rejectNote: tolak.alasan.trim(), verifiedBy: namaSaya.value, verifiedAt: Date.now(),
    }, versiReviews.value)
    await reviews.refresh()
    await postAudit({ action: 'Google Review', detail: `Review ${lama.name} DITOLAK: ${tolak.alasan.trim()}` })
    toast.add({ title: 'Review ditolak' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => reviews.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

const sheetHapus = ref(false)
const hapusId = ref('')

async function hapusGo() {
  const id = hapusId.value
  sheetHapus.value = false
  if (!id) return
  try {
    const lama = daftarReview.value.find(x => x.id === id)
    await deleteSectionItem('reviews', id, versiReviews.value)
    await reviews.refresh()
    if (lama) await postAudit({ action: 'Google Review', detail: `Catatan review ${lama.name} dihapus` })
    toast.add({ title: 'Dihapus' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => reviews.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- proof viewer --------------------------------------------------------------------------

const sheetBukti = ref(false)
const buktiJudul = ref('')
const buktiData = ref('')
const buktiMemuat = ref(false)

async function lihatBukti(rv: Review, mana: 1 | 2) {
  const ref = mana === 1 ? rv.proofData : rv.proof2Data
  if (!ref) return
  sheetBukti.value = true
  buktiJudul.value = mana === 1 ? 'Screenshot review' : 'Bukti poin bertambah'
  buktiData.value = ''
  buktiMemuat.value = true
  try {
    buktiData.value = ref.startsWith('@f:') ? (await getFile(ref.replace(/^@f:/, ''))).data.data : ref
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
    sheetBukti.value = false
  }
  finally {
    buktiMemuat.value = false
  }
}
</script>

<template>
  <AppPage
    title="Google review"
    description="Ajakan review ke tamu, klaim, dan verifikasinya."
    :back="{ label: 'Semua layar', to: '/service_excellent' }"
  >
    <template v-if="bolehBukaSe('review', tingkat)">
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
        <span class="pb-2 text-sm text-muted">Menampilkan data <b>{{ labelPeriode }}</b>{{ periode.mode === 'minggu' ? ' (Senin–Minggu)' : '' }}</span>
        <div class="ms-auto flex gap-2">
          <UButton
            v-if="cfg?.link"
            label="Salin link review"
            color="neutral"
            variant="soft"
            size="sm"
            @click="salinLink"
          />
          <UButton
            v-if="bolehCatat"
            label="Catat review"
            size="sm"
            @click="bukaKlaim()"
          />
        </div>
      </div>

      <template v-if="panelMintaTampil">
        <div class="mb-7 max-w-xl">
          <AppFocus
            label="Belum diminta"
            :value="`${angka(target.belum.length)} tamu`"
            :hint="`${angka(target.sudah.length)} dari ${angka(target.layak.length)} tamu ber-nomor sudah tersentuh`"
          />
        </div>

        <AppList title="Tamu belum diminta review">
          <UFormField
            label="Cari nama, no. HP, atau meja"
            class="px-4 pt-3"
          >
            <UInput
              v-model="cariBelum"
              placeholder="Cari nama, no. HP, atau meja…"
              class="w-full"
            />
          </UFormField>
          <div class="mb-7 hidden overflow-hidden rounded-2xl bg-default lg:block">
            <UTable
              :data="halamanBelum"
              :columns="kolomBelum"
              empty="Semua tamu yang datang sudah diminta review."
            >
              <template #date-cell="{ row }">
                {{ tglPendek(row.original.date) }}
              </template>
              <template #name-cell="{ row }">
                <div class="font-semibold">
                  {{ row.original.name }}
                </div>
                <div class="text-muted">
                  {{ row.original.phone }}
                </div>
              </template>
              <template #aksi-cell="{ row }">
                <UButton
                  v-if="waAktif && bolehMinta"
                  label="Minta review"
                  size="xs"
                  @click="mintaReview(row.original)"
                />
                <span
                  v-else
                  class="text-xs text-dimmed"
                >—</span>
              </template>
            </UTable>
          </div>
          <AppListRow
            v-for="r in halamanBelum"
            :key="r.id"
            :title="`${r.name} · ${r.pax} pax`"
            :description="`${tglPendek(r.date)} ${r.time} · ${r.table || 'tanpa meja'}`"
            icon="i-lucide-send"
            class="lg:hidden"
          >
            <template #trailing>
              <UButton
                v-if="waAktif && bolehMinta"
                label="Minta"
                size="xs"
                @click="mintaReview(r)"
              />
            </template>
          </AppListRow>
          <p
            v-if="!halamanBelum.length"
            class="px-4 py-3 text-muted lg:hidden"
          >
            Semua tamu yang datang sudah diminta review.
          </p>
        </AppList>
      </template>

      <AppList :title="`Daftar review${lihatSemua ? '' : ' saya'} — ${labelPeriode}`">
        <p
          v-if="!lihatSemua"
          class="px-4 pt-3 text-sm text-muted"
        >
          Hanya review atas nama Anda sendiri.
        </p>
        <UFormField
          label="Cari nama tamu, akun Google, atau pencatat"
          class="px-4 pt-3"
        >
          <UInput
            v-model="cariDaftar"
            placeholder="Cari nama tamu, akun Google, atau pencatat…"
            class="w-full"
          />
        </UFormField>
        <div class="mb-7 hidden overflow-hidden rounded-2xl bg-default lg:block">
          <UTable
            :data="halamanDaftar"
            :columns="kolomDaftar"
            empty="Belum ada catatan review."
          >
            <template #name-cell="{ row }">
              <div class="font-semibold">
                {{ row.original.name }}
              </div>
              <div class="text-muted">
                {{ row.original.phone || '-' }}
              </div>
            </template>
            <template #date-cell="{ row }">
              {{ tglPendek(row.original.date) }}
            </template>
            <template #status-cell="{ row }">
              <AppStatus :color="warnaStatus[row.original.status] ?? 'neutral'">
                {{ labelStatus[row.original.status] ?? row.original.status }}
              </AppStatus>
              <div
                v-if="row.original.rejectNote"
                class="mt-0.5 text-xs text-muted"
              >
                {{ row.original.rejectNote }}
              </div>
              <div
                v-if="row.original.status === 'diklaim' && !row.original.proof2Data"
                class="mt-0.5 text-xs text-muted"
              >
                menunggu Foto 2
              </div>
            </template>
            <template #host-cell="{ row }">
              {{ hostDari(row.original) }}
            </template>
            <template #aksi-cell="{ row }">
              <div class="flex flex-wrap gap-1">
                <UButton
                  v-if="row.original.proofData || row.original.proof2Data"
                  label="Bukti"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="lihatBukti(row.original, row.original.proofData ? 1 : 2)"
                />
                <UButton
                  v-if="row.original.status === 'diklaim' && bolehVerif && row.original.proof2Data"
                  label="Verifikasi"
                  color="neutral"
                  variant="soft"
                  size="xs"
                  @click="bukaVerif(row.original.id)"
                />
                <UButton
                  v-if="row.original.status === 'diklaim' && bolehVerif"
                  label="Tolak"
                  color="error"
                  variant="ghost"
                  size="xs"
                  @click="bukaTolak(row.original.id)"
                />
                <UButton
                  v-if="row.original.status !== 'terverifikasi' && bolehCatat"
                  label="Ubah"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="bukaKlaim(row.original.id, row.original.resId)"
                />
                <UButton
                  v-if="bolehHapus"
                  label="Hapus"
                  color="error"
                  variant="ghost"
                  size="xs"
                  @click="hapusId = row.original.id; sheetHapus = true"
                />
              </div>
            </template>
          </UTable>
        </div>
        <AppListRow
          v-for="x in halamanDaftar"
          :key="x.id"
          :title="`${x.name} · ${x.reviewerName || 'tanpa akun'}`"
          :description="`${tglPendek(x.date)} · ${labelStatus[x.status] ?? x.status} · ${hostDari(x)}`"
          icon="i-lucide-star"
          class="lg:hidden"
          @click="bolehCatat && x.status !== 'terverifikasi' ? bukaKlaim(x.id, x.resId) : undefined"
        >
          <template #trailing>
            <AppStatus :color="warnaStatus[x.status] ?? 'neutral'">
              {{ labelStatus[x.status] ?? x.status }}
            </AppStatus>
          </template>
        </AppListRow>
        <p
          v-if="!halamanDaftar.length"
          class="px-4 py-3 text-muted lg:hidden"
        >
          Belum ada catatan review.
        </p>
      </AppList>

      <AppList title="Halaman">
        <div class="flex flex-wrap items-center justify-between gap-2 px-4 pb-4">
          <div class="flex items-center gap-2 text-sm text-muted">
            <span>Baris per halaman</span>
            <USelect
              v-model.number="perHal"
              :items="[10, 25, 50]"
              class="w-20"
            />
          </div>
          <div class="flex items-center gap-2 text-sm text-muted">
            <UButton
              label="Sebelumnya"
              color="neutral"
              variant="soft"
              size="sm"
              :disabled="halDaftar <= 1"
              @click="halDaftar--"
            />
            <span class="num">Hal {{ halDaftar }} dari {{ maxHalDaftar }}</span>
            <UButton
              label="Berikutnya"
              color="neutral"
              variant="soft"
              size="sm"
              :disabled="halDaftar >= maxHalDaftar"
              @click="halDaftar++"
            />
          </div>
        </div>
      </AppList>
    </template>
    <p
      v-else
      class="text-muted"
    >
      Tidak ada akses.
    </p>

    <ResponsiveSheet
      v-model:open="sheetKlaim"
      title="Catat Google Review"
      description="Isi sesuai screenshot review tamu. Baru dihitung ke target setelah diverifikasi manager."
    >
      <div class="space-y-3">
        <p class="rounded-lg border border-default bg-default p-3 text-sm text-muted">
          Nama: <b>{{ klaim.host }}</b> — poin masuk ke akun ini.
        </p>
        <UFormField
          label="Nama tamu"
          required
        >
          <UInput
            v-model="klaim.nama"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="No. WhatsApp">
          <UInput
            v-model="klaim.phone"
            inputmode="numeric"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Nama akun Google (reviewer)"
          required
        >
          <UInput
            v-model="klaim.reviewer"
            placeholder="Nama yang tampil di review"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="No. meja / bill (opsional)">
          <UInput
            v-model="klaim.meja"
            placeholder="mis. 12 atau B-0345"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tanggal review">
          <UInput
            v-model="klaim.tanggal"
            type="date"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="1) Screenshot review tamu (wajib)">
          <input
            type="file"
            accept="image/*"
            class="w-full text-sm"
            @change="pilihFoto($event, 1)"
          >
          <p class="mt-1 text-xs text-muted">
            {{ klaim.namaFoto1 || klaim.namaFoto1Lama || 'belum ada' }}
          </p>
        </UFormField>
        <UFormField label="2) Bukti poin bertambah (menyusul)">
          <input
            type="file"
            accept="image/*"
            class="w-full text-sm"
            @change="pilihFoto($event, 2)"
          >
          <p class="mt-1 text-xs text-muted">
            {{ klaim.namaFoto2 || klaim.namaFoto2Lama || 'belum ada' }}. Layar Google “poin bertambah” biasanya baru muncul H+1. Klaim belum bisa diverifikasi sebelum Foto 2 dilampirkan.
          </p>
        </UFormField>
      </div>
      <template #footer>
        <UButton
          label="Simpan klaim"
          size="xl"
          @click="simpanKlaim"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheetKlaim = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetVerif"
      title="Verifikasi review"
    >
      <p class="text-sm text-muted">
        Sudah cocokkan review ini di Google Business Profile? Tekan Ya hanya jika review-nya benar-benar ada di Google.
      </p>
      <template #footer>
        <UButton
          label="Ya, verifikasi"
          size="xl"
          @click="verifGo"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheetVerif = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetTolak"
      :title="`Tolak review — ${tolak.nama}`"
    >
      <UFormField label="Alasan (mis. tidak ditemukan di Google)">
        <UTextarea
          v-model="tolak.alasan"
          :rows="3"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <template #footer>
        <UButton
          label="Tolak review"
          color="error"
          size="xl"
          @click="tolakGo"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheetTolak = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetHapus"
      title="Hapus catatan review"
    >
      <p class="text-sm text-muted">
        Hapus catatan ini? Tindakan ini tercatat di audit log.
      </p>
      <template #footer>
        <UButton
          label="Hapus"
          color="error"
          size="xl"
          @click="hapusGo"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheetHapus = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetBukti"
      :title="buktiJudul"
    >
      <p
        v-if="buktiMemuat"
        class="text-sm text-muted"
      >
        Memuat bukti…
      </p>
      <img
        v-else-if="buktiData"
        :src="buktiData"
        :alt="buktiJudul"
        class="w-full rounded-lg border border-default"
      >
      <template #footer>
        <UButton
          label="Tutup"
          color="neutral"
          variant="soft"
          size="xl"
          @click="sheetBukti = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
