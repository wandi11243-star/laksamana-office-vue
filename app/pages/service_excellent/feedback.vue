<!--
  Catat Feedback — guest praise and complaints, one row per note under its own
  division. Recap by status and category, filters, multi-item form, handling
  states, WhatsApp follow-up, delete.

  Item writes go to PUT /master/feedbacks/{id} with the LOADED section
  version; after a conflict the section reloads and the open sheet
  re-snapshots. Photos travel as data URIs; the server moves them to fb:<id>.
  Source: laksamana-office/deploy/service_excellent/index.html:8275-8600.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { deleteSectionItem, getFile, listReservations, postAudit, putSectionItem, useSectionVersi } from '~/composables/useReservasi'
import type { Feedback, FeedbackItem } from '~/composables/useServiceExcellent'
import { usePeriodeReview } from '~/composables/useServiceExcellent'
import { apiErrorMessage } from '~/composables/useApi'
import { tanganiKonflik, versiDari } from '~/utils/versi'
import { bolehAksiSe, bolehBukaSe, tingkatSe } from '~/utils/layar/service_excellent'
import { FB_CATS, dalamRentang, labelKategori, labelRentang, rentangReview, type IdKategori } from '~/utils/service-excellent'
import { normPhone, uid, tampilPhone } from '~/utils/dp-reservasi'
import { angka, hariIni, tglPendek } from '~/utils/format'
import { waKirim } from '~/utils/wa'

definePageMeta({ access: ['service_excellent'] })

const me = useMe()
const toast = useToast()
const tingkat = computed(() => tingkatSe(me.value))
const namaSaya = computed(() => me.value?.name ?? '')

const periode = usePeriodeReview()
const rentang = computed(() => rentangReview(periode.value.mode, periode.value.date, periode.value.month))
const labelPeriode = computed(() => labelRentang(
  periode.value.mode, rentang.value,
  tgl => tgl, tglPendek,
  new Date(`${periode.value.month}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
))

const feedbacks = useSectionVersi<Feedback[]>('feedbacks')
const daftarFb = computed(() => feedbacks.data.value?.data ?? [])
const versiFb = computed(() => versiDari(feedbacks.data.value))

const bolehUbah = computed(() => bolehAksiSe('input', tingkat.value))
const bolehHapus = computed(() => bolehAksiSe('deleteReview', tingkat.value))

const dalam = computed(() => daftarFb.value.filter(x => dalamRentang(x.date, rentang.value)))

/** First-load skeleton for the five recap cards below: skeleton cells stand
 *  in until the first feedback list lands. Refetch keeps old numbers, so the
 *  cards never blank. */
const statMemuat = computed(() => !feedbacks.data.value && (feedbacks.status.value === 'pending' || feedbacks.status.value === 'idle'))

// --- recap -----------------------------------------------------------------------

const hitung = (s: string) => dalam.value.filter(x => (x.status || 'baru') === s).length
const semuaItem = computed(() => dalam.value.flatMap(fb => (fb.items ?? []).map(it => ({ fb, it }))))

const perKategori = computed(() => {
  const map = new Map<string, number>()
  for (const { it } of semuaItem.value) {
    const k = it.cat === 'other' ? `other:${it.catOther || 'Lainnya'}` : it.cat
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n)
})
const maksKategori = computed(() => Math.max(1, ...perKategori.value.map(x => x.n)))
const namaKategori = (k: string) => k.startsWith('other:') ? k.slice(6) : labelKategori(k, '')

// --- filters -----------------------------------------------------------------------

const filterStatus = ref('')
const filterKategori = ref('')
const cari = ref('')

const tampil = computed(() => {
  const q = cari.value.trim().toLowerCase()
  return dalam.value
    .filter(fb => !filterStatus.value || (fb.status || 'baru') === filterStatus.value)
    .filter(fb => !filterKategori.value || (fb.items ?? []).some(it => it.cat === filterKategori.value))
    .filter(fb => !q || [
      fb.name, fb.phone, fb.by, fb.handledBy, fb.actionNote,
      ...((fb.items ?? []).map(it => `${it.text} ${it.catOther || ''}`)),
    ].some(v => String(v || '').toLowerCase().includes(q)))
    .sort((a, b) => (b.at || 0) - (a.at || 0))
})

const hal = ref(1)
const perHal = ref(10)
const maxHal = computed(() => Math.max(1, Math.ceil(tampil.value.length / perHal.value)))
const halaman = computed(() => tampil.value.slice((hal.value - 1) * perHal.value, hal.value * perHal.value))
watch([tampil, perHal], () => {
  hal.value = Math.min(hal.value, maxHal.value)
})

const warnaStatus: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  baru: 'error',
  proses: 'warning',
  selesai: 'success',
}
const labelStatus: Record<string, string> = {
  baru: 'Baru',
  proses: 'Diproses',
  selesai: 'Selesai',
}

const kolom = computed<TableColumn<Feedback>[]>(() => [
  { accessorKey: 'name', header: 'Tamu' },
  { accessorKey: 'cat', header: 'Kategori' },
  { accessorKey: 'text', header: 'Catatan & tindakan' },
  { accessorKey: 'date', header: 'Tanggal' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'by', header: 'Dicatat oleh' },
  { accessorKey: 'aksi', header: 'Aksi' },
])

// --- guest directory (from loaded reservations; G-07 covers the full one) ------------

const { data: reservasi } = useAsyncData(
  'se-feedback-reservasi',
  () => listReservations(rentang.value.from, rentang.value.to).then(r => r.data),
  { watch: [rentang], default: () => [] },
)
const direktori = computed(() => {
  const map = new Map<string, { nama: string, phone: string }>()
  for (const r of (reservasi.value ?? [])) {
    const k = normPhone(r.phone)
    if (r.name && !map.has(r.name.toLowerCase())) map.set(r.name.toLowerCase(), { nama: r.name, phone: r.phone })
    if (k && ![...map.values()].some(v => normPhone(v.phone) === k)) map.set(`#${k}`, { nama: r.name, phone: r.phone })
  }
  return [...map.values()]
})

// --- form ------------------------------------------------------------------------------
// One guest, several notes — each under its own division. `other` must name
// itself. Status rides in the same form: issues fixed on the spot ("minumannya
// langsung diganti") must not wait for a second pass (`:8406-8435`).

const sheet = ref(false)
const form = reactive({
  id: '', nama: '', phone: '', tanggal: hariIni(), tone: 'negatif' as 'negatif' | 'positif',
  items: [{ cat: 'floor' as IdKategori, catOther: '', text: '' }],
  status: 'baru' as 'baru' | 'proses' | 'selesai',
  aksi: '', fotoLama: '', namaFotoLama: '', berkas: null as File | null, namaBerkas: '',
})

function bukaForm(fbId = '') {
  const fb = fbId ? daftarFb.value.find(x => x.id === fbId) : null
  Object.assign(form, {
    id: fb?.id ?? '', nama: fb?.name ?? '', phone: fb?.phone ? tampilPhone(fb.phone) : '',
    tanggal: fb?.date || hariIni(), tone: fb?.tone || 'negatif',
    items: (fb && fb.items.length ? fb.items : [{ cat: 'floor', catOther: '', text: '' }])
      .map(x => ({ cat: (x.cat || 'floor') as IdKategori, catOther: x.catOther || '', text: x.text || '' })),
    status: fb?.status || 'baru', aksi: fb?.actionNote || '',
    fotoLama: fb?.proofData || '', namaFotoLama: fb?.proofName || '', berkas: null, namaBerkas: '',
  })
  sheet.value = true
}

function tambahItem() {
  form.items.push({ cat: 'floor', catOther: '', text: '' })
}

function hapusItem(i: number) {
  form.items.splice(i, 1)
  if (!form.items.length) form.items.push({ cat: 'floor', catOther: '', text: '' })
}

function pilihFoto(f: File | null | undefined) {
  if (f && f.size > 5 * 1024 * 1024) {
    toast.add({ title: 'Foto melebihi 5 MB — kecilkan dulu', color: 'error' })
    return
  }
  form.berkas = f ?? null
  form.namaBerkas = f ? f.name : ''
}

const bacaBerkas = (f: File): Promise<string> => new Promise((resolve, reject) => {
  const fr = new FileReader()
  fr.onload = () => resolve(String(fr.result))
  fr.onerror = () => reject(fr.error)
  fr.readAsDataURL(f)
})

/** Reload the open form from the newest section after a conflict. */
async function muatUlangForm() {
  await feedbacks.refresh()
  if (!form.id) return
  const fb = daftarFb.value.find(x => x.id === form.id)
  if (fb) bukaForm(fb.id)
}

async function simpan() {
  if (!bolehUbah.value) return
  const nama = form.nama.trim()
  if (!nama) {
    toast.add({ title: 'Nama tamu wajib diisi', color: 'error' })
    return
  }
  const items: FeedbackItem[] = form.items
    .map(it => ({ cat: it.cat || 'floor', catOther: it.catOther.trim(), text: it.text.trim() }))
    .filter(it => it.text)
  if (!items.length) {
    toast.add({ title: 'Isi catatannya minimal satu', color: 'error' })
    return
  }
  if (items.some(it => it.cat === 'other' && !it.catOther)) {
    toast.add({ title: 'Kategori "Other" harus disebutkan namanya', color: 'error' })
    return
  }
  try {
    const lama = form.id ? daftarFb.value.find(x => x.id === form.id) : null
    const kini = Date.now()
    // "baru" means unhandled: an action note from an earlier edit is cleared,
    // so no Baru row oddly carries a handling note.
    const fb: Feedback = {
      id: form.id || uid(),
      resId: lama?.resId || '',
      name: nama,
      phone: normPhone(form.phone),
      date: form.tanggal || hariIni(),
      tone: form.tone,
      items,
      status: form.status,
      actionNote: form.status === 'baru' ? '' : form.aksi.trim(),
      proofData: form.berkas ? await bacaBerkas(form.berkas) : (lama?.proofData || ''),
      proofName: form.berkas ? form.berkas.name : (lama?.proofName || ''),
      by: lama?.by || namaSaya.value,
      at: lama?.at || kini,
      handledBy: form.status === 'baru' ? '' : (lama?.handledBy || namaSaya.value),
      handledAt: form.status === 'baru' ? 0 : (lama?.handledAt || kini),
    }
    if (form.status !== 'baru' && lama && lama.status !== form.status) {
      fb.handledBy = namaSaya.value
      fb.handledAt = kini
    }
    await putSectionItem('feedbacks', fb.id, fb, versiFb.value)
    await feedbacks.refresh()
    await postAudit({
      action: 'Feedback',
      detail: `${form.id ? 'Feedback diperbarui' : 'Feedback baru'} dari ${nama}: ${items.map(it => labelKategori(it.cat, it.catOther)).join(', ')} [${labelStatus[form.status]}]`,
    })
    sheet.value = false
    toast.add({ title: 'Feedback tersimpan', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlangForm))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- row actions ---------------------------------------------------------------------------

async function setStatus(fb: Feedback, status: 'proses' | 'selesai', aksi: string) {
  if (!bolehUbah.value) return
  try {
    const lama = daftarFb.value.find(x => x.id === fb.id)
    if (!lama) {
      toast.add({ title: 'Catatannya tidak ketemu — daftar dimuat ulang', color: 'error' })
      await feedbacks.refresh()
      return
    }
    await putSectionItem('feedbacks', fb.id, {
      ...lama, status, actionNote: aksi, handledBy: namaSaya.value, handledAt: Date.now(),
    }, versiFb.value)
    await feedbacks.refresh()
    await postAudit({ action: 'Feedback', detail: `Feedback ${lama.name} → ${labelStatus[status]}` })
    toast.add({ title: `Feedback ditandai ${labelStatus[status]}`, color: status === 'selesai' ? 'success' : undefined })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => feedbacks.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

const sheetSelesai = ref(false)
const selesai = reactive({ id: '', nama: '', aksi: '' })

async function selesaiGo() {
  const fb = daftarFb.value.find(f => f.id === selesai.id)
  sheetSelesai.value = false
  if (fb) await setStatus(fb, 'selesai', selesai.aksi.trim())
}

async function hapus(fb: Feedback) {
  try {
    await deleteSectionItem('feedbacks', fb.id, versiFb.value)
    await feedbacks.refresh()
    await postAudit({ action: 'Feedback', detail: `Feedback ${fb.name} dihapus` })
    toast.add({ title: 'Dihapus' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => feedbacks.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

const sheetHapus = ref(false)
const hapusTarget = ref<Feedback | null>(null)

const teksMaaf = (nama: string) =>
  `Halo Kak ${nama} 🙏\n\nMohon maaf atas ketidaknyamanannya kemarin di *Laksamana Muda*.\nMasukan Kakak sudah kami tindak lanjuti ke tim terkait.\n\nTerima kasih sudah mau memberi tahu kami — semoga berkenan mampir lagi ⚓`

async function waTindakLanjut(fb: Feedback) {
  if (!fb.phone) {
    toast.add({ title: 'Nomor WhatsApp tamu kosong', color: 'error' })
    return
  }
  await waKirim(fb.phone, teksMaaf(fb.name))
}

// --- proof viewer ----------------------------------------------------------------------------

const sheetBukti = ref(false)
const buktiData = ref('')
const buktiMemuat = ref(false)

async function lihatBukti(fb: Feedback) {
  if (!fb.proofData) return
  sheetBukti.value = true
  buktiData.value = ''
  buktiMemuat.value = true
  try {
    buktiData.value = fb.proofData.startsWith('@f:')
      ? (await getFile(fb.proofData.replace(/^@f:/, ''))).data.data
      : fb.proofData
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
    title="Catat feedback"
    description="Pujian & keluhan tamu, dikategorikan per divisi."
  >
    <template v-if="bolehBukaSe('feedback', tingkat)">
      <div class="mb-5 flex flex-wrap items-center gap-3">
        <AppSeg
          v-model="periode.mode"
          size="sm"
          :options="[
            { value: 'hari', label: 'Harian' },
            { value: 'minggu', label: 'Mingguan' },
            { value: 'bulan', label: 'Bulanan' },
          ]"
        />
        <UFormField
          v-if="periode.mode === 'bulan'"
          label="Bulan"
          class="max-w-44 [&_label]:sr-only"
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
          class="max-w-44 [&_label]:sr-only"
        >
          <UInput
            v-model="periode.date"
            type="date"
            class="w-full"
          />
        </UFormField>
        <span class="text-sm text-muted">Menampilkan data <b>{{ labelPeriode }}</b></span>
        <div class="ms-auto">
          <UButton
            v-if="bolehUbah"
            label="Catat feedback"
            size="sm"
            @click="bukaForm()"
          />
        </div>
      </div>

      <AppStatGrid
        :loading="statMemuat"
        :count="5"
      >
        <AppStat
          label="Total feedback"
          icon="i-lucide-messages-square"
          :value="angka(dalam.length)"
          :sub="`${angka(semuaItem.length)} catatan · ${labelPeriode}`"
        />
        <AppStat
          label="Baru"
          icon="i-lucide-sparkle"
          :tone="hitung('baru') ? 'error' : 'gold'"
          :value="angka(hitung('baru'))"
          sub="belum ditangani"
        />
        <AppStat
          label="Diproses"
          icon="i-lucide-wrench"
          tone="warning"
          :value="angka(hitung('proses'))"
          sub="sedang ditangani"
        />
        <AppStat
          label="Selesai"
          icon="i-lucide-badge-check"
          tone="success"
          :value="angka(hitung('selesai'))"
          sub="sudah ditindaklanjuti"
        />
        <AppStat
          label="Paling sering"
          icon="i-lucide-flame"
          tone="vip"
          :value="perKategori.length ? namaKategori(perKategori[0]!.k) : '—'"
          :sub="perKategori.length ? `${angka(perKategori[0]!.n)} catatan` : 'belum ada'"
        />
      </AppStatGrid>

      <AppPanel
        v-if="perKategori.length"
        title="Per kategori / divisi"
        icon="i-lucide-chart-bar"
      >
        <AppBar
          v-for="c in perKategori"
          :key="c.k"
          :label="namaKategori(c.k)"
          :value="c.n"
          :persen="c.n / maksKategori * 100"
          :tone="c.n === maksKategori ? 'error' : 'info'"
        />
      </AppPanel>

      <AppPanel>
        <div class="flex flex-col gap-3">
          <AppChips
            v-model="filterStatus"
            :options="[{ value: '', label: 'Semua status' }, { value: 'baru', label: 'Baru' }, { value: 'proses', label: 'Diproses' }, { value: 'selesai', label: 'Selesai' }]"
          />
          <AppChips
            v-model="filterKategori"
            :options="[{ value: '', label: 'Semua kategori' }, ...FB_CATS.map(c => ({ value: c.id, label: c.label }))]"
          />
          <UInput
            v-model="cari"
            icon="i-lucide-search"
            placeholder="Cari nama, no. HP, atau isi catatan…"
            class="w-full sm:max-w-md"
          />
        </div>
      </AppPanel>

      <div class="mb-7 hidden overflow-hidden rounded-panel border border-default bg-default shadow-panel lg:block">
        <UTable
          :data="halaman"
          :columns="kolom"
          empty="Belum ada feedback."
        >
          <template #name-cell="{ row }">
            <div class="font-semibold">
              {{ row.original.name }}
              <AppStatus
                v-if="row.original.tone === 'positif'"
                class="ms-1"
              >
                Positif
              </AppStatus>
            </div>
            <div class="text-muted">
              {{ row.original.phone || '-' }}
            </div>
          </template>
          <template #cat-cell="{ row }">
            <span
              v-for="(it, i) in (row.original.items ?? [])"
              :key="i"
              class="me-1"
            >{{ labelKategori(it.cat, it.catOther) }}</span>
          </template>
          <template #text-cell="{ row }">
            <div
              v-for="(it, i) in (row.original.items ?? [])"
              :key="i"
            >
              • {{ it.text }}
            </div>
            <div
              v-if="row.original.actionNote"
              class="mt-0.5 text-xs text-muted"
            >
              {{ row.original.actionNote }}
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
              v-if="row.original.handledBy"
              class="mt-0.5 text-xs text-muted"
            >
              oleh {{ row.original.handledBy }}
            </div>
          </template>
          <template #by-cell="{ row }">
            {{ row.original.by || '-' }}
          </template>
          <template #aksi-cell="{ row }">
            <div class="flex flex-wrap gap-1">
              <UButton
                v-if="row.original.proofData"
                label="Foto"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="lihatBukti(row.original)"
              />
              <UButton
                v-if="row.original.phone"
                label="WA"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="waTindakLanjut(row.original)"
              />
              <UButton
                v-if="bolehUbah && row.original.status === 'baru'"
                label="Proses"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="setStatus(row.original, 'proses', row.original.actionNote || '')"
              />
              <UButton
                v-if="bolehUbah && row.original.status !== 'selesai'"
                label="Selesai"
                color="neutral"
                variant="soft"
                size="xs"
                @click="selesai.id = row.original.id; selesai.nama = row.original.name; selesai.aksi = row.original.actionNote || ''; sheetSelesai = true"
              />
              <UButton
                v-if="bolehUbah"
                label="Ubah"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="bukaForm(row.original.id)"
              />
              <UButton
                v-if="bolehHapus"
                label="Hapus"
                color="error"
                variant="ghost"
                size="xs"
                @click="hapusTarget = row.original; sheetHapus = true"
              />
            </div>
          </template>
        </UTable>
      </div>

      <AppList
        title="Daftar feedback"
        class="lg:hidden"
      >
        <AppListRow
          v-for="fb in halaman"
          :key="fb.id"
          :title="`${fb.name} · ${(fb.items ?? []).map(it => labelKategori(it.cat, it.catOther)).join(', ')}`"
          :description="`${tglPendek(fb.date)} · ${labelStatus[fb.status] ?? fb.status}${fb.actionNote ? ` · ${fb.actionNote}` : ''}`"
          icon="i-lucide-message-square"
          @click="bolehUbah ? bukaForm(fb.id) : undefined"
        >
          <template #trailing>
            <AppStatus :color="warnaStatus[fb.status] ?? 'neutral'">
              {{ labelStatus[fb.status] ?? fb.status }}
            </AppStatus>
          </template>
        </AppListRow>
        <p
          v-if="!halaman.length"
          class="px-4 py-3 text-muted"
        >
          Belum ada feedback.
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
              :disabled="hal <= 1"
              @click="hal--"
            />
            <span class="num">Hal {{ hal }} dari {{ maxHal }}</span>
            <UButton
              label="Berikutnya"
              color="neutral"
              variant="soft"
              size="sm"
              :disabled="hal >= maxHal"
              @click="hal++"
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
      v-model:open="sheet"
      :title="form.id ? 'Ubah feedback' : 'Catat feedback'"
      description="Catat apa adanya. Satu tamu menyebut beberapa hal → tambah catatan supaya tiap hal masuk kategori divisinya sendiri."
    >
      <div class="space-y-3">
        <UFormField label="Sifat tanggapan">
          <USelect
            v-model="form.tone"
            :items="[{ value: 'negatif', label: 'Keluhan / negatif' }, { value: 'positif', label: 'Pujian / positif' }]"
            size="xl"
            class="w-full"
          />
          <p class="mt-1 text-xs text-muted">
            Catatan lama tanpa sifat dianggap keluhan — memang itu isinya.
          </p>
        </UFormField>
        <UFormField
          label="Nama tamu"
          required
        >
          <UInput
            v-model="form.nama"
            list="fbNama"
            size="xl"
            class="w-full"
          />
          <datalist id="fbNama">
            <option
              v-for="g in direktori"
              :key="g.nama"
              :value="g.nama"
            />
          </datalist>
        </UFormField>
        <UFormField label="No. WhatsApp">
          <UInput
            v-model="form.phone"
            inputmode="numeric"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tanggal kejadian">
          <UInput
            v-model="form.tanggal"
            type="date"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Foto bukti (opsional)">
          <UFileUpload
            :model-value="form.berkas"
            accept="image/*"
            label="Pilih foto"
            description="Gambar, maks 5 MB"
            @update:model-value="pilihFoto"
          >
            <p class="mt-1 text-xs text-muted">
              {{ form.namaBerkas || form.namaFotoLama || 'Belum ada foto' }}
            </p>
          </ufileupload>
        </UFormField>
        <div
          v-for="(it, i) in form.items"
          :key="i"
          class="rounded-lg border border-default p-3"
        >
          <div class="mb-2 flex items-center justify-between">
            <b class="text-sm">Keluhan {{ i + 1 }}</b>
            <UButton
              v-if="form.items.length > 1"
              label="Hapus"
              color="error"
              variant="ghost"
              size="xs"
              @click="hapusItem(i)"
            />
          </div>
          <UFormField
            label="Kategori / divisi"
            required
          >
            <USelect
              v-model="it.cat"
              :items="FB_CATS.map(c => ({ value: c.id, label: c.label }))"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="it.cat === 'other'"
            label="Sebutkan kategorinya"
            required
          >
            <UInput
              v-model="it.catOther"
              placeholder="mis. Parkir, Musik, AC…"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Isi keluhan"
            required
          >
            <UTextarea
              v-model="it.text"
              :rows="2"
              placeholder="Tulis keluhan tamu apa adanya…"
              size="xl"
              class="w-full"
            />
          </UFormField>
        </div>
        <UButton
          label="Tambah catatan"
          color="neutral"
          variant="soft"
          size="sm"
          @click="tambahItem"
        />
        <UFormField label="Status penanganan">
          <USelect
            v-model="form.status"
            :items="[{ value: 'baru', label: 'Baru — belum ditangani' }, { value: 'proses', label: 'Diproses — sedang ditangani' }, { value: 'selesai', label: 'Selesai — sudah ditindaklanjuti' }]"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField
          v-if="form.status !== 'baru'"
          label="Tindakan yang dilakukan"
        >
          <UInput
            v-model="form.aksi"
            placeholder="mis. sudah minta maaf & ganti minumannya"
            size="xl"
            class="w-full"
          />
        </UFormField>
      </div>
      <template #footer>
        <UButton
          label="Simpan feedback"
          size="xl"
          @click="simpan"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheet = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetSelesai"
      :title="`Selesai — ${selesai.nama}`"
    >
      <UFormField label="Tindakan yang sudah dilakukan">
        <UInput
          v-model="selesai.aksi"
          placeholder="mis. sudah minta maaf & ganti minumannya"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <template #footer>
        <UButton
          label="Tandai selesai"
          size="xl"
          @click="selesaiGo"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheetSelesai = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetHapus"
      title="Hapus feedback"
    >
      <p class="text-sm text-muted">
        Hapus feedback dari "{{ hapusTarget?.name }}"?
      </p>
      <template #footer>
        <UButton
          label="Hapus"
          color="error"
          size="xl"
          @click="hapusTarget && hapus(hapusTarget); sheetHapus = false"
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
      title="Foto bukti"
    >
      <div
        v-if="buktiMemuat"
        class="space-y-2"
      >
        <!-- Photo placeholder mirrors the proof image below. -->
        <USkeleton class="h-40 w-full rounded-lg" />
        <p class="pt-1 text-sm text-muted">
          Memuat foto…
        </p>
      </div>
      <img
        v-else-if="buktiData"
        :src="buktiData"
        alt="Foto bukti feedback"
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
