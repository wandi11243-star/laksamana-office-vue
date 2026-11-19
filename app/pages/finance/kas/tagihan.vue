<!--
  Finance › Kas Kecil › Tagihan Rutin (VUE-14, old `viewTagihan`, laksamana-office
  bc9e0b9, deploy/finance/kas/index.html "TAGIHAN RUTIN").

  Recurring subscriptions (wifi, Claude, ChatGPT, Spotify, YouTube): when is
  each due, and how much has been paid in total. Rules live in
  `app/utils/tagihan.ts` (due dates COMPUTED from `mulai` + `siklus`, totals
  from payment rows at the nominal AS PAID). Contract: laksamana-api
  docs/api/finance.md "Tagihan Rutin".

  - No DELETE anywhere: a wrong payment is CANCELLED with a required reason
    (stays visible, struck through, never summed); a bill that stopped is
    DEACTIVATED (history and totals stay).
  - One due date is paid once — guarded by the SERVER (422 naming who paid
    first), shown through `apiErrorMessage`.
  - SEPARATE from Buku Kas Kecil on purpose: these are paid by card/transfer,
    not from the petty-cash drawer.
  - "Not loaded" never reads as "no bills": a failed load (including 503
    `tagihan_unavailable` before the tables exist) says so, with Coba lagi.
  - Old layout kept: four stat cards, tabs Daftar | Riwayat, the same table
    columns. The old in-row panels (Bayar, Riwayat) and the form tab are
    sheets here (DESIGN.md: forms in `ResponsiveSheet`).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { IsiTagihan } from '~/composables/useFinance'
import { batalBayarTagihan, bayarTagihan, createTagihan, getTagihan, setAktifTagihan, updateTagihan } from '~/composables/useFinance'
import { fmtRp, num } from '~/utils/cashier'
import { hariIni } from '~/utils/format'
import type { BayarTagihan, StatusTagihan, Tagihan } from '~/utils/tagihan'
import {
  KATEGORI_TAGIHAN_BAWAAN, SIKLUS_TAGIHAN, TAGIHAN_AWAL, bayarHidup, perkiraanBulanan, siklusTeks,
  statusTagihan, tglTagihan, totalBayar, urutDaftarTagihan,
} from '~/utils/tagihan'

definePageMeta({ access: ['finance'] })

const izin = useKasIzin()
const toast = useToast()
const bolehUbah = computed(() => izin.ubah('tagihan'))

const periode = ref(hariIni().slice(0, 7))
const tab = ref<'daftar' | 'riwayat'>('daftar')

// Loaded lazily (only when this page opens), like the old page.
const { data, status, error, refresh } = useAsyncData('kas-tagihan', () => getTagihan())
const belumSiap = computed(() => apiErrorCode(error.value) === 'tagihan_unavailable')

// Skeleton only for the first load: month tabs and the history filter read the same payload, so a refetch keeps the old cards.
const statMemuat = computed(() => !data.value && (status.value === 'pending' || status.value === 'idle'))

const tagihan = computed<Tagihan[]>(() => data.value?.tagihan ?? [])
const bayar = computed<BayarTagihan[]>(() => data.value?.bayar ?? [])
const hari = hariIni()

const bayarDari = (id: number) => bayar.value.filter(b => String(b.tagihanId) === String(id))
const tagihanDari = (id: number) => tagihan.value.find(t => String(t.id) === String(id)) ?? null

interface BarisDaftar {
  t: Tagihan
  s: StatusTagihan
  hidup: BayarTagihan[]
  total: number
}
const daftar = computed<BarisDaftar[]>(() => urutDaftarTagihan(tagihan.value.map((t) => {
  const hidup = bayarDari(t.id).filter(bayarHidup)
  return { t, s: statusTagihan(t, bayar.value, hari), hidup, total: totalBayar(hidup) }
})))

// ---- stat cards (old `viewTagihan` top grid) ----
const aktif = computed(() => tagihan.value.filter(t => t.aktif))
const hidupSemua = computed(() => bayar.value.filter(bayarHidup))
const tahun = hari.slice(0, 4)
const totSemua = computed(() => totalBayar(hidupSemua.value))
const totTahun = computed(() => totalBayar(hidupSemua.value.filter(b => String(b.tglBayar).slice(0, 4) === tahun)))
const totBulan = computed(() => totalBayar(hidupSemua.value.filter(b => String(b.tglBayar).slice(0, 7) === periode.value)))
const estBulan = computed(() => perkiraanBulanan(tagihan.value))
const stAktif = computed(() => daftar.value.filter(o => o.t.aktif))
const telat = computed(() => stAktif.value.filter(o => o.s.jenis === 'telat'))
const segera = computed(() => stAktif.value.filter(o => o.s.jenis === 'segera'))
const kosong = computed(() => aktif.value.filter(t => !t.mulai || !num(t.nominal)).length)

// ---- status chip (old `tgChip`) ----
function chip(o: BarisDaftar): { color: 'success' | 'warning' | 'error' | 'neutral', icon: string, teks: string } {
  if (!o.t.aktif) return { color: 'neutral', icon: 'i-lucide-pause', teks: 'Nonaktif' }
  const s = o.s
  if (s.jenis === 'kosong') return { color: 'neutral', icon: 'i-lucide-calendar-x', teks: 'Jatuh tempo belum diisi' }
  if (s.jenis === 'telat') return { color: 'error', icon: 'i-lucide-alarm-clock', teks: `Terlambat${s.telat > 1 ? ` ${s.telat} periode` : ''}` }
  if (s.jenis === 'segera') return { color: 'warning', icon: 'i-lucide-clock', teks: s.sisa === 0 ? 'Hari ini' : `${s.sisa} hari lagi` }
  return { color: 'success', icon: 'i-lucide-check', teks: `${s.sisa} hari lagi` }
}

const kolomDaftar: TableColumn<BarisDaftar>[] = [
  { id: 'nama', header: 'Tagihan' },
  { id: 'nominal', header: 'Nominal', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'siklus', header: 'Siklus' },
  { id: 'next', header: 'Jatuh tempo berikutnya' },
  { id: 'terakhir', header: 'Terakhir dibayar' },
  { id: 'total', header: 'Total dibayar', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'aksi', header: '' },
]

// ---- writes ----
const sibuk = ref(false)
async function tulis(aksi: () => Promise<unknown>, sukses: string): Promise<boolean> {
  if (!bolehUbah.value || sibuk.value) return false
  sibuk.value = true
  try {
    await aksi()
    toast.add({ title: sukses, color: 'success' })
    await refresh()
    return true
  }
  catch (e) {
    toast.add({ title: `Gagal menyimpan: ${apiErrorMessage(e)}`, color: 'error' })
    return false
  }
  finally {
    sibuk.value = false
  }
}

// Form (old "Tambah/Ubah Tagihan" tab).
const formBuka = ref(false)
const formId = ref<number | null>(null)
const form = reactive({ nama: '', kategori: '', nominal: '', siklus: 1, mulai: '', metode: '', catatan: '' })
const kategoriAda = computed(() => [...new Set([...tagihan.value.map(t => t.kategori).filter(Boolean), ...KATEGORI_TAGIHAN_BAWAAN])])
function bukaForm(t?: Tagihan) {
  formId.value = t ? t.id : null
  form.nama = t?.nama ?? ''
  form.kategori = t?.kategori ?? ''
  form.nominal = t && num(t.nominal) ? String(t.nominal) : ''
  form.siklus = Number(t?.siklus) || 1
  form.mulai = t?.mulai ?? ''
  form.metode = t?.metode ?? ''
  form.catatan = t?.catatan ?? ''
  formBuka.value = true
}
async function simpanForm() {
  const isi: IsiTagihan = {
    nama: form.nama.trim(),
    kategori: form.kategori.trim(),
    nominal: num(form.nominal),
    siklus: Number(form.siklus) || 1,
    mulai: form.mulai,
    metode: form.metode.trim(),
    catatan: form.catatan.trim(),
  }
  if (!isi.nama) {
    toast.add({ title: 'Nama tagihan belum diisi.', color: 'error' })
    return
  }
  const id = formId.value
  const ok = await tulis(() => (id === null ? createTagihan(isi) : updateTagihan(id, isi)), id === null ? 'Tagihan ditambahkan.' : 'Tagihan diperbarui.')
  if (ok) formBuka.value = false
}

async function ubahAktif(t: Tagihan, nilai: boolean) {
  if (!nilai && !confirm(`Nonaktifkan "${t.nama}"?\n\nIa berhenti ditagih di daftar, tapi riwayat & total pembayarannya tetap tersimpan.`)) return
  await tulis(() => setAktifTagihan(t.id, nilai), nilai ? `${t.nama} diaktifkan lagi.` : `${t.nama} dinonaktifkan.`)
}

// Payment (old in-row "Catat pembayaran" panel).
const bayarId = ref<number | null>(null)
const bayarBuka = computed({ get: () => bayarId.value !== null, set: v => (bayarId.value = v ? bayarId.value : null) })
const fb = reactive({ periode: '', tglBayar: '', nominal: '', catatan: '' })
const bayarT = computed(() => (bayarId.value === null ? null : tagihanDari(bayarId.value)))
const bayarS = computed(() => (bayarT.value ? statusTagihan(bayarT.value, bayar.value, hari) : null))
const bayarTerakhir = computed(() => (bayarT.value ? bayarDari(bayarT.value.id).find(bayarHidup) ?? null : null))
function bukaBayar(t: Tagihan) {
  const s = statusTagihan(t, bayar.value, hari)
  fb.periode = s.next || hari
  fb.tglBayar = hari
  fb.nominal = num(t.nominal) ? String(t.nominal) : ''
  fb.catatan = ''
  bayarId.value = t.id
}
async function simpanBayar() {
  const t = bayarT.value
  if (!t) return
  const isi = { periode: fb.periode, tglBayar: fb.tglBayar, nominal: num(fb.nominal), catatan: fb.catatan.trim() }
  if (!isi.periode || !isi.tglBayar) {
    toast.add({ title: 'Jatuh tempo yang dibayar dan tanggal bayar wajib diisi.', color: 'error' })
    return
  }
  if (isi.nominal <= 0) {
    toast.add({ title: 'Nominal yang dibayar belum diisi.', color: 'error' })
    return
  }
  // The confirm names the NUMBERS: an empty question only trains people to
  // press OK, and a typo of one zero here has no delete button.
  if (!confirm(`Catat pembayaran?\n\n${t.nama}\nJatuh tempo: ${tglTagihan(isi.periode)}\nDibayar: ${tglTagihan(isi.tglBayar)}\nNominal: ${fmtRp(isi.nominal)}`)) return
  const ok = await tulis(() => bayarTagihan(t.id, isi), `Pembayaran ${t.nama} dicatat.`)
  if (ok) bayarId.value = null
}

// Per-bill history (old in-row "Riwayat" panel).
const riwayatId = ref<number | null>(null)
const riwayatBuka = computed({ get: () => riwayatId.value !== null, set: v => (riwayatId.value = v ? riwayatId.value : null) })
const riwayatT = computed(() => (riwayatId.value === null ? null : tagihanDari(riwayatId.value)))
const riwayatBaris = computed(() => (riwayatId.value === null ? [] : bayarDari(riwayatId.value)))

// Cancel a payment (old `tgBatal`): reason required, once only.
const batalB = ref<BayarTagihan | null>(null)
const batalBuka = computed({ get: () => batalB.value !== null, set: v => (batalB.value = v ? batalB.value : null) })
const batalAlasan = ref('')
function bukaBatal(b: BayarTagihan) {
  batalAlasan.value = ''
  batalB.value = b
}
async function simpanBatal() {
  const b = batalB.value
  if (!b) return
  const alasan = batalAlasan.value.trim()
  if (!alasan) {
    toast.add({ title: 'Alasan pembatalan wajib diisi.', color: 'error' })
    return
  }
  const ok = await tulis(() => batalBayarTagihan(b.id, alasan), 'Pembayaran dibatalkan.')
  if (ok) batalB.value = null
}

// Seed list (old `tgIsiAwal`): one by one through the same endpoint as the
// form, in order — the one that fails midway must be named.
async function isiAwal() {
  if (!bolehUbah.value || sibuk.value) return
  if (!confirm(`Tambahkan ${TAGIHAN_AWAL.length} tagihan ini?\n\n${TAGIHAN_AWAL.map(x => `• ${x.nama}`).join('\n')}\n\nNominal & jatuh temponya masih kosong — isi lewat tombol Ubah tiap barisnya.`)) return
  sibuk.value = true
  try {
    for (const x of TAGIHAN_AWAL) {
      try {
        await createTagihan({ nama: x.nama, kategori: x.kategori, nominal: 0, siklus: 1, mulai: '' })
      }
      catch (e) {
        toast.add({ title: `Berhenti di "${x.nama}": ${apiErrorMessage(e)}. Yang sebelumnya sudah tersimpan.`, color: 'error' })
        return
      }
    }
    toast.add({ title: `${TAGIHAN_AWAL.length} tagihan awal ditambahkan.`, color: 'success' })
  }
  finally {
    sibuk.value = false
    await refresh()
  }
}

// ---- Riwayat tab (old `tgRiwayatHtml`) ----
const cari = ref('')
const bulanRw = ref('')
const opsiBulanRw = computed(() => [
  { label: 'Semua bulan', value: '__semua' },
  ...[...new Set(bayar.value.map(b => String(b.tglBayar).slice(0, 7)))].sort().reverse().map(m => ({ label: m, value: m })),
])
const riwayatSaring = computed(() => {
  const q = cari.value.trim().toLowerCase()
  return bayar.value.filter((b) => {
    if (bulanRw.value && String(b.tglBayar).slice(0, 7) !== bulanRw.value) return false
    if (!q) return true
    const t = tagihanDari(b.tagihanId)
    return [t?.nama, t?.kategori, b.oleh, b.catatan, b.tglBayar].some(x => String(x ?? '').toLowerCase().includes(q))
  })
})
const kolomRiwayat: TableColumn<BayarTagihan>[] = [
  { id: 'tgl', header: 'Dibayar' },
  { id: 'tagihan', header: 'Tagihan' },
  { id: 'periode', header: 'Jatuh tempo' },
  { id: 'nominal', header: 'Nominal', meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'oleh', header: 'Dicatat oleh' },
  { id: 'aksi', header: '' },
]
const namaTagihan = (b: BayarTagihan) => tagihanDari(b.tagihanId)?.nama ?? `(tagihan #${b.tagihanId})`
</script>

<template>
  <AppPage
    title="Tagihan rutin"
    description="Langganan & tagihan berulang — kapan jatuh temponya, dan berapa yang sudah dibayar."
  >
    <template #actions>
      <AppBulan
        v-model="periode"
        size="sm"
        class="w-40"
      />
      <UButton
        label="Muat ulang"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        size="sm"
        :loading="status === 'pending'"
        @click="refresh()"
      />
      <UButton
        v-if="bolehUbah && data"
        label="Tambah tagihan"
        icon="i-lucide-plus"
        size="sm"
        @click="bukaForm()"
      />
    </template>

    <UAlert
      v-if="!izin.lihat('tagihan')"
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
      :title="belumSiap ? 'Tabel tagihan rutin belum tersedia di server.' : 'Daftar tagihan tidak terbaca dari server.'"
      :description="belumSiap
        ? 'Tabelnya dibuat oleh Office lama saat halaman Tagihan Rutin di sana pertama kali dibuka. Buka sekali di Office lama, lalu coba lagi di sini.'
        : apiErrorMessage(error)"
      :actions="[{ label: 'Coba lagi', color: 'neutral', variant: 'outline', onClick: () => { refresh() } }]"
    />
    <AppStatGrid
      v-else-if="!data"
      :loading="true"
      :count="4"
    />

    <template v-else>
      <AppStatGrid
        :loading="statMemuat"
        :count="4"
      >
        <AppStat
          label="Total sudah dibayar"
          icon="i-lucide-wallet"
          :value="fmtRp(totSemua)"
          :sub="`${hidupSemua.length} pembayaran · tahun ${tahun}: ${fmtRp(totTahun)}`"
        />
        <AppStat
          :label="`Dibayar bulan ${periode}`"
          icon="i-lucide-calendar"
          :value="fmtRp(totBulan)"
          sub="ganti bulan lewat kotak di atas"
          tone="info"
        />
        <AppStat
          label="Perkiraan per bulan"
          icon="i-lucide-calculator"
          :value="fmtRp(estBulan)"
          :sub="`${aktif.length} tagihan aktif · tahunan dibagi 12`"
          tone="info"
        />
        <AppStat
          label="Perlu dibayar"
          icon="i-lucide-alarm-clock"
          :value="telat.length + segera.length"
          :sub="`${telat.length} terlambat · ${segera.length} dalam 7 hari`"
          :tone="telat.length ? 'error' : 'warning'"
        />
      </AppStatGrid>

      <AppSeg
        v-model="tab"
        :options="[{ value: 'daftar', label: 'Daftar tagihan' }, { value: 'riwayat', label: 'Riwayat pembayaran' }]"
        class="mb-4"
      />

      <!-- ── Daftar ── -->
      <template v-if="tab === 'daftar'">
        <UAlert
          v-if="telat.length"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`${telat.length} tagihan terlambat: ${telat.map(o => `${o.t.nama} (sejak ${tglTagihan(o.s.next)})`).join(', ')}`"
          class="mb-3"
        />
        <UAlert
          v-if="kosong"
          color="warning"
          variant="subtle"
          icon="i-lucide-pencil"
          :title="`${kosong} tagihan belum lengkap nominal atau jatuh temponya — tekan Ubah di barisnya.`"
          description="Tanpa jatuh tempo, halaman ini tidak bisa menyebut kapan harus dibayar."
          class="mb-3"
        />

        <AppPanel
          v-if="!daftar.length"
          title="Daftar tagihan"
        >
          <div class="py-6 text-center text-sm text-muted">
            <UIcon
              name="i-lucide-receipt"
              class="mb-2 size-8"
            />
            <p><b class="text-highlighted">Belum ada tagihan rutin.</b></p>
            <p class="mt-1">
              Tambahkan lewat tombol Tambah tagihan, atau isi sekaligus daftar awal: {{ TAGIHAN_AWAL.map(x => x.nama).join(', ') }}.
            </p>
            <UButton
              v-if="bolehUbah"
              :label="`Isi ${TAGIHAN_AWAL.length} tagihan awal`"
              size="sm"
              class="mt-4"
              :loading="sibuk"
              @click="isiAwal"
            />
          </div>
        </AppPanel>

        <AppPanel
          v-else
          title="Daftar tagihan"
          description="Diurut dari yang paling mendesak. Total dibayar = jumlah seluruh pembayaran yang dicatat (yang dibatalkan tidak ikut), memakai nominal saat dibayar — bukan harga sekarang dikali jumlah bulan."
          flush
        >
          <UTable
            :columns="kolomDaftar"
            :data="daftar"
            class="hidden lg:block"
          >
            <template #nama-cell="{ row }">
              <div :class="row.original.t.aktif ? '' : 'opacity-60'">
                <b class="text-highlighted">{{ row.original.t.nama }}</b>
                <span
                  v-if="row.original.t.kategori || row.original.t.metode"
                  class="block text-xs text-muted"
                >{{ [row.original.t.kategori, row.original.t.metode].filter(Boolean).join(' · ') }}</span>
              </div>
            </template>
            <template #nominal-cell="{ row }">
              <span
                v-if="num(row.original.t.nominal)"
                class="num"
              >{{ fmtRp(row.original.t.nominal) }}</span>
              <span
                v-else
                class="text-muted"
              >belum diisi</span>
            </template>
            <template #siklus-cell="{ row }">
              {{ siklusTeks(row.original.t.siklus) }}
            </template>
            <template #next-cell="{ row }">
              <span
                v-if="row.original.s.next"
                class="mb-1 block"
              >{{ tglTagihan(row.original.s.next) }}</span>
              <AppStatus
                :color="chip(row.original).color"
                :icon="chip(row.original).icon"
                size="sm"
              >
                {{ chip(row.original).teks }}
              </AppStatus>
            </template>
            <template #terakhir-cell="{ row }">
              <template v-if="row.original.hidup[0]">
                {{ tglTagihan(row.original.hidup[0].tglBayar) }}
                <span class="num block text-xs text-muted">{{ fmtRp(row.original.hidup[0].nominal) }}</span>
              </template>
              <span
                v-else
                class="text-muted"
              >belum pernah</span>
            </template>
            <template #total-cell="{ row }">
              <b class="num text-highlighted">{{ fmtRp(row.original.total) }}</b>
              <span class="block text-xs text-muted">{{ row.original.hidup.length }}× bayar</span>
            </template>
            <template #aksi-cell="{ row }">
              <div class="flex justify-end gap-1 whitespace-nowrap">
                <UButton
                  v-if="bolehUbah && row.original.t.aktif"
                  label="Bayar"
                  size="xs"
                  @click="bukaBayar(row.original.t)"
                />
                <UButton
                  label="Riwayat"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click="riwayatId = row.original.t.id"
                />
                <UButton
                  v-if="bolehUbah"
                  label="Ubah"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click="bukaForm(row.original.t)"
                />
                <UButton
                  v-if="bolehUbah"
                  :label="row.original.t.aktif ? 'Nonaktifkan' : 'Aktifkan'"
                  size="xs"
                  :color="row.original.t.aktif ? 'error' : 'neutral'"
                  variant="ghost"
                  :loading="sibuk"
                  @click="ubahAktif(row.original.t, !row.original.t.aktif)"
                />
              </div>
            </template>
          </UTable>

          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="o in daftar"
              :key="o.t.id"
              class="px-4 py-3"
              :class="o.t.aktif ? '' : 'opacity-60'"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <b class="text-highlighted">{{ o.t.nama }}</b>
                  <span class="block text-xs text-muted">
                    {{ [o.t.kategori, num(o.t.nominal) ? fmtRp(o.t.nominal) : 'nominal belum diisi', siklusTeks(o.t.siklus)].filter(Boolean).join(' · ') }}
                  </span>
                </div>
                <AppStatus
                  :color="chip(o).color"
                  :icon="chip(o).icon"
                  size="sm"
                  class="shrink-0"
                >
                  {{ chip(o).teks }}
                </AppStatus>
              </div>
              <dl class="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt class="text-muted">
                    Jatuh tempo
                  </dt>
                  <dd>{{ o.s.next ? tglTagihan(o.s.next) : '—' }}</dd>
                </div>
                <div>
                  <dt class="text-muted">
                    Terakhir dibayar
                  </dt>
                  <dd>{{ o.hidup[0] ? tglTagihan(o.hidup[0].tglBayar) : 'belum pernah' }}</dd>
                </div>
                <div class="text-right">
                  <dt class="text-muted">
                    Total ({{ o.hidup.length }}×)
                  </dt>
                  <dd class="num font-semibold text-highlighted">
                    {{ fmtRp(o.total) }}
                  </dd>
                </div>
              </dl>
              <div class="mt-2 flex flex-wrap gap-1">
                <UButton
                  v-if="bolehUbah && o.t.aktif"
                  label="Bayar"
                  size="xs"
                  @click="bukaBayar(o.t)"
                />
                <UButton
                  label="Riwayat"
                  size="xs"
                  color="neutral"
                  variant="outline"
                  @click="riwayatId = o.t.id"
                />
                <UButton
                  v-if="bolehUbah"
                  label="Ubah"
                  size="xs"
                  color="neutral"
                  variant="outline"
                  @click="bukaForm(o.t)"
                />
                <UButton
                  v-if="bolehUbah"
                  :label="o.t.aktif ? 'Nonaktifkan' : 'Aktifkan'"
                  size="xs"
                  :color="o.t.aktif ? 'error' : 'neutral'"
                  variant="outline"
                  :loading="sibuk"
                  @click="ubahAktif(o.t, !o.t.aktif)"
                />
              </div>
            </li>
          </ul>
        </AppPanel>
      </template>

      <!-- ── Riwayat ── -->
      <AppPanel
        v-else
        title="Riwayat pembayaran"
        description="Seluruh pembayaran tagihan rutin, terbaru di atas. Yang dibatalkan tetap terlihat (dicoret) dan tidak ikut dijumlahkan."
      >
        <div class="mb-3 grid gap-2 sm:grid-cols-[1fr_12rem]">
          <UInput
            v-model="cari"
            icon="i-lucide-search"
            placeholder="Cari tagihan, pencatat, catatan…"
            class="w-full"
          />
          <USelect
            :model-value="bulanRw || '__semua'"
            :items="opsiBulanRw"
            class="w-full"
            @update:model-value="(v: string) => bulanRw = v === '__semua' ? '' : v"
          />
        </div>
        <p
          v-if="!riwayatSaring.length"
          class="py-4 text-center text-sm text-muted"
        >
          {{ cari || bulanRw ? 'Tidak ada pembayaran yang cocok dengan saringan ini.' : 'Belum ada pembayaran yang dicatat.' }}
        </p>
        <template v-else>
          <p class="mb-2 text-sm text-muted">
            {{ riwayatSaring.length }} baris · total (tanpa yang dibatalkan) <b class="num text-highlighted">{{ fmtRp(totalBayar(riwayatSaring)) }}</b>
          </p>
          <UTable
            :columns="kolomRiwayat"
            :data="riwayatSaring"
            class="hidden lg:block"
          >
            <template #tgl-cell="{ row }">
              <span :class="row.original.batalAt ? 'opacity-60' : ''">{{ tglTagihan(row.original.tglBayar) }}</span>
            </template>
            <template #tagihan-cell="{ row }">
              <b
                class="text-highlighted"
                :class="row.original.batalAt ? 'opacity-60' : ''"
              >{{ namaTagihan(row.original) }}</b>
            </template>
            <template #periode-cell="{ row }">
              <span class="text-muted">{{ tglTagihan(row.original.periode) }}</span>
            </template>
            <template #nominal-cell="{ row }">
              <span
                class="num"
                :class="row.original.batalAt ? 'line-through opacity-60' : ''"
              >{{ fmtRp(row.original.nominal) }}</span>
            </template>
            <template #oleh-cell="{ row }">
              {{ row.original.oleh || '—' }}
              <span
                v-if="row.original.catatan"
                class="block text-xs text-muted"
              >{{ row.original.catatan }}</span>
              <span
                v-if="row.original.batalAt"
                class="block text-xs text-error"
              >Dibatalkan {{ row.original.batalOleh || '' }}{{ row.original.batalAlasan ? ` — ${row.original.batalAlasan}` : '' }}</span>
            </template>
            <template #aksi-cell="{ row }">
              <div class="flex justify-end">
                <UButton
                  v-if="bolehUbah && !row.original.batalAt"
                  label="Batalkan"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click="bukaBatal(row.original)"
                />
              </div>
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="b in riwayatSaring"
              :key="b.id"
              class="py-2.5 text-sm"
            >
              <div class="flex items-start justify-between gap-3">
                <div
                  class="min-w-0"
                  :class="b.batalAt ? 'opacity-60' : ''"
                >
                  <b class="text-highlighted">{{ namaTagihan(b) }}</b>
                  <span class="block text-xs text-muted">Dibayar {{ tglTagihan(b.tglBayar) }} · jatuh tempo {{ tglTagihan(b.periode) }} · {{ b.oleh || '—' }}</span>
                  <span
                    v-if="b.catatan"
                    class="block text-xs text-muted"
                  >{{ b.catatan }}</span>
                </div>
                <span
                  class="num shrink-0 font-semibold"
                  :class="b.batalAt ? 'line-through opacity-60' : 'text-highlighted'"
                >{{ fmtRp(b.nominal) }}</span>
              </div>
              <span
                v-if="b.batalAt"
                class="mt-1 block text-xs text-error"
              >Dibatalkan {{ b.batalOleh || '' }}{{ b.batalAlasan ? ` — ${b.batalAlasan}` : '' }}</span>
              <UButton
                v-else-if="bolehUbah"
                label="Batalkan"
                size="xs"
                color="neutral"
                variant="outline"
                class="mt-1.5"
                @click="bukaBatal(b)"
              />
            </li>
          </ul>
        </template>
      </AppPanel>
    </template>

    <!-- ── Form tagihan ── -->
    <ResponsiveSheet
      v-model:open="formBuka"
      :title="formId === null ? 'Tambah tagihan' : `Ubah tagihan — ${form.nama}`"
      description="Mengubah nominal di sini tidak mengubah pembayaran yang sudah tercatat — total yang sudah dibayar tetap memakai angka saat dibayar."
      lebar="sedang"
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField
          label="Nama tagihan"
          required
        >
          <UInput
            v-model="form.nama"
            placeholder="mis. Wifi Biznet"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Kategori">
          <UInput
            v-model="form.kategori"
            list="tg-kategori"
            placeholder="mis. Internet"
            class="w-full"
          />
          <datalist id="tg-kategori">
            <option
              v-for="k in kategoriAda"
              :key="k"
              :value="k"
            />
          </datalist>
        </UFormField>
        <UFormField label="Nominal per tagihan">
          <UInput
            v-model="form.nominal"
            inputmode="numeric"
            placeholder="0"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Dibayar setiap">
          <USelect
            v-model="form.siklus"
            :items="SIKLUS_TAGIHAN"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Jatuh tempo pertama yang mau dicatat"
          help="Tanggal di bulan ini menentukan tanggal jatuh tempo tiap periode (mis. 5 Okt → tiap tanggal 5). Isi dengan jatuh tempo terdekat, bukan tanggal mulai berlangganan dulu — jatuh tempo sebelumnya yang belum dicatat akan terhitung terlambat."
        >
          <AppTanggal
            v-model="form.mulai"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Dibayar lewat">
          <UInput
            v-model="form.metode"
            placeholder="mis. Kartu kredit BCA / Transfer Mandiri"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Catatan"
          class="sm:col-span-2"
        >
          <UInput
            v-model="form.catatan"
            placeholder="mis. nomor pelanggan, akun yang dipakai"
            class="w-full"
          />
        </UFormField>
      </div>
      <template #footer>
        <UButton
          :label="formId === null ? 'Tambah tagihan' : 'Simpan perubahan'"
          :loading="sibuk"
          @click="simpanForm"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="formBuka = false"
        />
      </template>
    </ResponsiveSheet>

    <!-- ── Catat pembayaran ── -->
    <ResponsiveSheet
      v-model:open="bayarBuka"
      :title="`Catat pembayaran — ${bayarT?.nama ?? ''}`"
      lebar="sedang"
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField label="Jatuh tempo yang dibayar">
          <AppTanggal
            v-model="fb.periode"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tanggal bayar">
          <AppTanggal
            v-model="fb.tglBayar"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Nominal">
          <UInput
            v-model="fb.nominal"
            inputmode="numeric"
            placeholder="0"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Catatan (opsional)">
          <UInput
            v-model="fb.catatan"
            placeholder="mis. no. ref transfer"
            class="w-full"
          />
        </UFormField>
      </div>
      <UAlert
        v-if="bayarS && bayarS.telat > 1"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Ada ${bayarS.telat} jatuh tempo yang belum tercatat dibayar — yang terisi di atas yang paling lama. Catat satu per satu.`"
        class="mt-3"
      />
      <p class="mt-3 text-sm text-muted">
        Nominal terisi dari harga tagihan sekarang; ubah kalau yang dibayar berbeda — yang tersimpan angka yang diketik di sini.
        <template v-if="bayarTerakhir">
          Terakhir dibayar {{ fmtRp(bayarTerakhir.nominal) }} pada {{ tglTagihan(bayarTerakhir.tglBayar) }}.
        </template>
      </p>
      <template #footer>
        <UButton
          label="Simpan pembayaran"
          :loading="sibuk"
          @click="simpanBayar"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="bayarBuka = false"
        />
      </template>
    </ResponsiveSheet>

    <!-- ── Riwayat satu tagihan ── -->
    <ResponsiveSheet
      v-model:open="riwayatBuka"
      :title="`Riwayat ${riwayatT?.nama ?? ''} — total ${fmtRp(totalBayar(riwayatBaris))}`"
    >
      <p
        v-if="!riwayatBaris.length"
        class="py-4 text-center text-sm text-muted"
      >
        Belum ada pembayaran yang dicatat.
      </p>
      <ul
        v-else
        class="divide-y divide-default"
      >
        <li
          v-for="b in riwayatBaris"
          :key="b.id"
          class="py-2.5 text-sm"
        >
          <div class="flex items-start justify-between gap-3">
            <div :class="b.batalAt ? 'opacity-60' : ''">
              Dibayar {{ tglTagihan(b.tglBayar) }}
              <span class="block text-xs text-muted">Jatuh tempo {{ tglTagihan(b.periode) }} · dicatat {{ b.oleh || '—' }}</span>
              <span
                v-if="b.catatan"
                class="block text-xs text-muted"
              >{{ b.catatan }}</span>
            </div>
            <span
              class="num shrink-0 font-semibold"
              :class="b.batalAt ? 'line-through opacity-60' : 'text-highlighted'"
            >{{ fmtRp(b.nominal) }}</span>
          </div>
          <span
            v-if="b.batalAt"
            class="mt-1 block text-xs text-error"
          >Dibatalkan {{ b.batalOleh || '' }}{{ b.batalAlasan ? ` — ${b.batalAlasan}` : '' }}</span>
          <UButton
            v-else-if="bolehUbah"
            label="Batalkan"
            size="xs"
            color="neutral"
            variant="outline"
            class="mt-1.5"
            @click="bukaBatal(b)"
          />
        </li>
      </ul>
    </ResponsiveSheet>

    <!-- ── Batalkan pembayaran ── -->
    <ResponsiveSheet
      v-model:open="batalBuka"
      title="Batalkan pembayaran"
      :description="batalB ? `${namaTagihan(batalB)} · ${fmtRp(batalB.nominal)} · jatuh tempo ${tglTagihan(batalB.periode)}` : undefined"
    >
      <p class="mb-3 text-sm text-muted">
        Barisnya tetap terlihat tapi dicoret dan tidak ikut dijumlahkan. Pembatalan hanya bisa sekali.
      </p>
      <UFormField
        label="Alasan pembatalan"
        required
      >
        <UTextarea
          v-model="batalAlasan"
          :rows="3"
          placeholder="mis. salah tagihan, salah nominal"
          class="w-full"
        />
      </UFormField>
      <template #footer>
        <UButton
          label="Batalkan pembayaran"
          color="error"
          :loading="sibuk"
          @click="simpanBatal"
        />
        <UButton
          label="Tutup"
          color="neutral"
          variant="outline"
          @click="batalBuka = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
