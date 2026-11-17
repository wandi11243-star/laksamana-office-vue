<!--
  BD OS › Promotion (old `vPromotion`, deploy/bd/index.html:2276-3102). Status is
  COMPUTED from the dates on every read, never stored; the order
  running→upcoming→paused→ended is the same one Radar uses. Export/Import is CSV,
  quoting-aware, because the sheet goes POS → Excel → back.
-->
<script setup lang="ts">
import type { BdPromo } from '~/composables/useBd'
import { bdSimpan, putSetelan, useBdSettings, versiSetelan } from '~/composables/useBd'
import { PILIHAN_SEMUA, todayISO } from '~/utils/bd-rumus'
import {
  PROMO_CSV_KOL, PROMO_OUTLET_BAWAAN, promoBuatBarisCsv, promoImporRencana, promoJam, promoSort,
} from '~/utils/bd-promo'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
import BdPromoSheet from '~/widgets/bd/BdPromoSheet.vue'
import { fTglP } from '~/utils/format'
import {
  PROMO_ST, PROMO_TIPE, promoHariTeks, promoKat, promoSisa, promoStatus, promoTipe,
} from '~/utils/promo'

definePageMeta({ access: ['bd'] })

const me = useMe()
const { data: setelan, status: statusSetelan } = useBdSettings()
const f = useState('bd-promo-filter', () => ({ status: 'all', tipe: PILIHAN_SEMUA, cari: '' }))

const promos = computed(() => setelan.value?.data.promos || [])

/** First-load skeleton for the four status cards below: skeleton cells stand
 *  in until the first settings land. Refetch keeps old numbers, so the cards
 *  never blank. */
const statMemuat = computed(() => !setelan.value && (statusSetelan.value === 'pending' || statusSetelan.value === 'idle'))
const versi = computed(() => versiSetelan(setelan.value, 'promos'))
const namaAku = computed(() => me.value?.name || '')

const terlihat = computed(() => promos.value
  .filter(p => (f.value.status === 'all' || promoStatus(p) === f.value.status)
    && (f.value.tipe === PILIHAN_SEMUA || (p.tipe || '') === f.value.tipe)
    && (!f.value.cari.trim() || [p.nama, p.benefit, p.partner, p.kode, p.ketentuan, p.lmPIC].join(' ').toLowerCase().includes(f.value.cari.trim().toLowerCase())))
  .slice()
  .sort(promoSort))

const nStatus = (st: string) => promos.value.filter(p => promoStatus(p) === st).length

const chips = computed(() => [
  { value: 'all', label: `Semua (${promos.value.length})` },
  { value: 'running', label: `Berlangsung (${nStatus('running')})` },
  { value: 'upcoming', label: `Akan datang (${nStatus('upcoming')})` },
  { value: 'paused', label: `Dijeda (${nStatus('paused')})` },
  { value: 'ended', label: `Selesai (${nStatus('ended')})` },
])
const opsiTipe = [{ value: PILIHAN_SEMUA, label: 'Semua tipe' }, ...Object.entries(PROMO_TIPE).map(([k, v]) => ({ value: k, label: v.l }))]

// ---- export / import ----
function unduhCsv(baris: (string | number)[][], namaBerkas: string) {
  const csv = baris.map(r => r.map(sel => `"${String(sel == null ? '' : sel).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const blob = new Blob([`\uFEFFsep=,\r\n${csv}`], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = namaBerkas
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
function ekspor() {
  if (!terlihat.value.length) {
    toastErr('Tidak ada yang diekspor — longgarkan dulu penyaringnya.')
    return
  }
  unduhCsv(promoBuatBarisCsv(terlihat.value), `promo_${todayISO()}.csv`)
  toastOk(`${terlihat.value.length} promo diunduh — buka di Excel, sunting, lalu Import untuk mengembalikannya.`)
}

// Empty template for new promos (old promoTemplate). Columns come from the
// same list the import reads (only columns with a field, without ID): a
// hand-written template would drift from what the import actually reads.
function unduhTemplate() {
  const kepala = PROMO_CSV_KOL.filter(k => k.b && k.b !== 'id').map(k => k.k)
  unduhCsv([kepala], 'template_promo.csv')
  toastOk('Template diunduh. Isi satu promo per baris — tanggal ditulis hari-bulan-tahun (mis. 17-08-2026) — lalu tekan Import Excel.')
}

interface Impor { baru: { nama: string, mulai: string, selesai: string, benefit: string }[], ubah: { id: string, lamaNama: string, isi: { nama: string, mulai: string, selesai: string, benefit: string } }[], lewat: { no: number, nama: string, sebab: string }[], berkas: string }
const impor = ref<Impor | null>(null)
const bukaImpor = ref(false)
const berkasImpor = ref<HTMLInputElement | null>(null)

function pilihImpor() {
  berkasImpor.value?.click()
}
function bacaImpor(e: Event) {
  const el = e.target as HTMLInputElement
  const file = el.files?.[0]
  if (!file) return
  const fr = new FileReader()
  fr.onerror = () => toastErr('Berkasnya tidak bisa dibuka. Dari Excel: Save As → CSV UTF-8.')
  fr.onload = () => {
    const hasil = promoImporRencana(String(fr.result || ''), file.name, promos.value)
    el.value = ''
    if ('error' in hasil) {
      toastErr(hasil.error)
      return
    }
    impor.value = hasil
    if (!hasil.baru.length && !hasil.ubah.length) {
      toastErr(`Tidak ada baris yang bisa dipakai — ${hasil.lewat.length} dilewati.`)
      return
    }
    bukaImpor.value = true
  }
  fr.readAsText(file, 'utf-8')
}

async function terapkanImpor() {
  const r = impor.value
  if (!r) return
  const daftar = promos.value.map(p => ({ ...p }))
  r.ubah.forEach((x) => {
    const p = daftar.find(y => y.id === x.id)
    if (p) Object.assign(p, x.isi)
  })
  r.baru.forEach((x) => {
    daftar.unshift({
      id: uidPromo(),
      nama: x.nama,
      tipe: 'in_house',
      kategori: '',
      benefit: x.benefit,
      mulai: x.mulai,
      selesai: x.selesai,
      jamMulai: '',
      jamSelesai: '',
      hari: [],
      outlet: PROMO_OUTLET_BAWAAN,
      partner: '',
      partnerPIC: '',
      partnerKontak: '',
      lmPIC: namaAku.value,
      kode: '',
      kuota: 0,
      ketentuan: '',
      poster: '',
      paused: false,
      dibuatOleh: namaAku.value,
      dibuatAt: Date.now(),
    })
  })
  const n = r.baru.length
  const u = r.ubah.length
  const ok = await bdSimpan(() => putSetelan('promos', daftar, versi.value), `Import selesai — ${n} promo baru, ${u} diperbarui.`)
  if (ok) {
    impor.value = null
    bukaImpor.value = false
  }
}
function uidPromo() {
  return `pr${Math.random().toString(36).slice(2, 9)}`
}

// ---- sheet / detail ----
const bukaPromo = ref(false)
const promoPilih = ref<BdPromo | null>(null)
const bukaDetail = ref(false)
const detail = ref<BdPromo | null>(null)
const promoHapus = ref<BdPromo | null>(null)
const hapusMau = computed({
  get: () => !!promoHapus.value,
  set: (v) => {
    if (!v) promoHapus.value = null
  },
})

function baru() {
  promoPilih.value = null
  bukaPromo.value = true
}
function ubah(p: BdPromo) {
  bukaDetail.value = false
  promoPilih.value = p
  bukaPromo.value = true
}
function bukaDet(p: BdPromo) {
  detail.value = p
  bukaDetail.value = true
}

async function togglePaused(p: BdPromo) {
  const daftar = promos.value.map(x => (x.id === p.id ? { ...x, paused: !x.paused } : x))
  const ok = await bdSimpan(() => putSetelan('promos', daftar, versi.value), p.paused ? 'Promo diaktifkan lagi' : 'Promo dijeda')
  if (ok && detail.value?.id === p.id) detail.value = { ...p, paused: !p.paused }
}
async function hapus() {
  const p = promoHapus.value
  if (!p) return
  promoHapus.value = null
  const daftar = promos.value.filter(x => x.id !== p.id)
  const ok = await bdSimpan(() => putSetelan('promos', daftar, versi.value), 'Promo dihapus')
  if (ok) bukaDetail.value = false
}

// ---- toasts (this screen has no success dialog of its own) ----
const toast = useToast()
const toastOk = (title: string) => toast.add({ title, color: 'success' })
const toastErr = (title: string) => toast.add({ title, color: 'error' })
const tgl = (s?: string) => fTglP(s)

const statut = (p: BdPromo) => PROMO_ST[promoStatus(p)] || PROMO_ST.running!
</script>

<template>
  <AppPage
    title="Promotion"
    description="Promo yang berjalan & akan datang — otomatis terbaca seluruh kru di modul Radar."
  >
    <template #actions>
      <UButton
        label="Template"
        icon="i-lucide-file-down"
        color="neutral"
        variant="outline"
        title="Unduh lembar kosong untuk diisi promo baru, lalu Import"
        @click="unduhTemplate"
      />
      <UButton
        label="Export Excel"
        icon="i-lucide-download"
        color="neutral"
        variant="outline"
        @click="ekspor"
      />
      <UButton
        label="Import Excel"
        icon="i-lucide-upload"
        color="neutral"
        variant="outline"
        @click="pilihImpor"
      />
      <UButton
        label="Promo"
        icon="i-lucide-plus"
        @click="baru"
      />
      <input
        ref="berkasImpor"
        type="file"
        accept=".csv,.txt,text/csv"
        class="hidden"
        @change="bacaImpor"
      >
    </template>

    <AppStatGrid
      :loading="statMemuat"
      :count="4"
    >
      <AppStat
        label="Berlangsung"
        icon="i-lucide-circle-play"
        tone="success"
        :value="nStatus('running')"
        sub="aktif hari ini"
      />
      <AppStat
        label="Akan datang"
        icon="i-lucide-calendar-clock"
        tone="info"
        :value="nStatus('upcoming')"
        sub="sudah dijadwalkan"
      />
      <AppStat
        label="Dijeda"
        icon="i-lucide-pause"
        tone="warning"
        :value="nStatus('paused')"
        sub="sementara tidak berlaku"
      />
      <AppStat
        label="Selesai"
        icon="i-lucide-circle-check"
        :value="nStatus('ended')"
        sub="arsip"
      />
    </AppStatGrid>

    <AppPanel>
      <AppChips
        v-model="f.status"
        :options="chips"
      />
      <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2">
        <UFormField label="Tipe">
          <USelect
            v-model="f.tipe"
            :items="opsiTipe"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Cari">
          <UInput
            v-model="f.cari"
            placeholder="Promo, partner, kode…"
            icon="i-lucide-search"
            class="w-full"
          />
        </UFormField>
      </div>
    </AppPanel>

    <AppPanel v-if="!terlihat.length">
      <p class="py-6 text-center text-sm text-muted">
        <b class="block text-highlighted">Tidak ada promo yang cocok</b>
        Ubah penyaring atau kata kuncinya.
      </p>
    </AppPanel>

    <template v-else>
      <div class="grid gap-3 lg:hidden">
        <div
          v-for="p in terlihat"
          :key="p.id"
          class="rounded-panel border border-default bg-default px-4 py-3.5 shadow-panel lg:px-5"
        >
          <div class="flex items-start justify-between gap-2">
            <button
              type="button"
              class="min-w-0 flex-1 text-start"
              @click="bukaDet(p)"
            >
              <span class="flex items-center gap-1.5 font-semibold text-highlighted">
                <UIcon
                  :name="promoTipe(p.tipe).icon"
                  class="size-4 shrink-0 text-ink-900"
                />{{ p.nama }}
              </span>
            </button>
            <AppStatus
              :color="statut(p).tone"
              size="sm"
            >
              {{ statut(p).l }}
            </AppStatus>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            <AppStatus size="sm">
              {{ tgl(p.mulai) }} → {{ tgl(p.selesai) }}
            </AppStatus>
            <AppStatus
              v-if="promoSisa(p)"
              size="sm"
            >
              {{ promoSisa(p) }}
            </AppStatus>
            <AppStatus
              v-if="p.outlet"
              size="sm"
            >
              {{ p.outlet }}
            </AppStatus>
          </div>
        </div>
      </div>

      <AppPanel
        class="hidden lg:block"
        flush
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted text-muted">
              <tr>
                <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
                  Promo
                </th>
                <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
                  Tipe
                </th>
                <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
                  Periode
                </th>
                <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
                  Status
                </th>
                <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
                  Berlaku
                </th>
                <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
                  PIC
                </th>
                <th class="px-3 py-2 text-end text-[11px] uppercase tracking-wide">
                  <span class="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="p in terlihat"
                :key="p.id"
                class="cursor-pointer hover:bg-elevated/50"
                @click="bukaDet(p)"
              >
                <td class="px-3 py-2">
                  <span class="flex items-center gap-1.5 font-semibold text-highlighted">
                    <UIcon
                      v-if="p.poster"
                      name="i-lucide-image"
                      class="size-4 shrink-0 text-muted"
                      title="Ada poster"
                    />
                    {{ p.nama }}
                  </span>
                  <span
                    v-if="p.benefit"
                    class="mt-0.5 block text-xs text-muted"
                  >{{ p.benefit }}</span>
                  <span
                    v-if="p.kode"
                    class="mt-0.5 block text-xs text-muted"
                  >kode {{ p.kode }}</span>
                </td>
                <td class="px-3 py-2">
                  <span class="inline-flex items-center gap-1.5">
                    <UIcon
                      :name="promoTipe(p.tipe).icon"
                      class="size-4 shrink-0 text-muted"
                    />
                    {{ promoTipe(p.tipe).l }}
                  </span>
                  <span
                    v-if="promoKat(p.kategori)"
                    class="mt-1 block"
                  >
                    <AppStatus size="sm">{{ promoKat(p.kategori)!.l }}</AppStatus>
                  </span>
                </td>
                <td class="px-3 py-2 whitespace-nowrap text-muted">
                  {{ tgl(p.mulai) }} → {{ tgl(p.selesai) }}
                  <span
                    v-if="promoSisa(p)"
                    class="mt-0.5 block text-xs"
                  >{{ promoSisa(p) }}</span>
                </td>
                <td class="px-3 py-2">
                  <AppStatus
                    :color="statut(p).tone"
                    size="sm"
                  >
                    {{ statut(p).l }}
                  </AppStatus>
                </td>
                <td class="px-3 py-2 text-xs text-muted">
                  {{ promoHariTeks(p.hari) || 'Setiap hari' }}
                  <span
                    v-if="promoJam(p)"
                    class="mt-0.5 block"
                  >{{ promoJam(p) }}</span>
                </td>
                <td class="px-3 py-2 text-muted">
                  {{ p.lmPIC || '—' }}
                </td>
                <td class="px-3 py-2 text-end">
                  <UButton
                    icon="i-lucide-trash-2"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    aria-label="Hapus promo"
                    @click.stop="promoHapus = p"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AppPanel>
    </template>

    <!-- detail -->
    <ResponsiveSheet
      v-model:open="bukaDetail"
      :title="detail?.nama || 'Promo'"
      :description="detail ? `${promoTipe(detail.tipe).l} · ${statut(detail).l}` : undefined"
    >
      <div
        v-if="detail"
        class="grid grid-cols-1 gap-3"
      >
        <img
          v-if="detail.poster"
          :src="detail.poster"
          :alt="`Poster ${detail.nama}`"
          class="w-full rounded-panel border border-default"
        >
        <p
          v-if="detail.benefit"
          class="font-semibold text-highlighted"
        >
          {{ detail.benefit }}
        </p>
        <div class="flex flex-wrap gap-1.5">
          <AppStatus size="sm">
            {{ tgl(detail.mulai) }} → {{ tgl(detail.selesai) }}
          </AppStatus>
          <AppStatus
            v-if="promoSisa(detail)"
            size="sm"
          >
            {{ promoSisa(detail) }}
          </AppStatus>
          <AppStatus
            v-if="promoKat(detail.kategori)"
            :icon="promoKat(detail.kategori)!.icon"
            size="sm"
          >
            {{ promoKat(detail.kategori)!.l }}
          </AppStatus>
          <AppStatus
            v-if="detail.kode"
            color="gold"
            size="sm"
          >
            kode {{ detail.kode }}
          </AppStatus>
        </div>
        <ul class="grid gap-1 text-sm">
          <li class="flex items-start gap-2">
            <UIcon
              name="i-lucide-tag"
              class="mt-0.5 size-4 shrink-0 text-muted"
            />{{ promoTipe(detail.tipe).l }}
          </li>
          <li class="flex items-start gap-2">
            <UIcon
              name="i-lucide-calendar"
              class="mt-0.5 size-4 shrink-0 text-muted"
            />{{ promoHariTeks(detail.hari) || 'Setiap hari' }}
          </li>
          <li class="flex items-start gap-2">
            <UIcon
              name="i-lucide-clock"
              class="mt-0.5 size-4 shrink-0 text-muted"
            />{{ promoJam(detail) || 'Sepanjang jam buka' }}
          </li>
          <li
            v-if="detail.outlet"
            class="flex items-start gap-2"
          >
            <UIcon
              name="i-lucide-map-pin"
              class="mt-0.5 size-4 shrink-0 text-muted"
            />{{ detail.outlet }}
          </li>
          <li
            v-if="detail.partner"
            class="flex items-start gap-2"
          >
            <UIcon
              name="i-lucide-handshake"
              class="mt-0.5 size-4 shrink-0 text-muted"
            />{{ detail.partner }}
          </li>
          <li
            v-if="Number(detail.kuota) > 0"
            class="flex items-start gap-2"
          >
            <UIcon
              name="i-lucide-ticket"
              class="mt-0.5 size-4 shrink-0 text-muted"
            />{{ detail.kuota }} pemakaian
          </li>
        </ul>
        <p
          v-if="detail.ketentuan"
          class="whitespace-pre-wrap rounded-xl border border-default bg-muted p-3 text-xs text-muted"
        >
          {{ detail.ketentuan }}
        </p>
      </div>

      <template #footer>
        <UButton
          :label="detail?.paused ? 'Aktifkan lagi' : 'Jeda promo'"
          :icon="detail?.paused ? 'i-lucide-play' : 'i-lucide-pause'"
          color="neutral"
          variant="outline"
          @click="detail && togglePaused(detail)"
        />
        <UButton
          label="Ubah"
          icon="i-lucide-pencil"
          @click="detail && ubah(detail)"
        />
      </template>
    </ResponsiveSheet>

    <!-- import preview -->
    <ResponsiveSheet
      v-model:open="bukaImpor"
      title="Pratinjau import"
      :description="impor ? `Berkas ${impor.berkas}` : undefined"
    >
      <div
        v-if="impor"
        class="grid grid-cols-1 gap-3"
      >
        <p class="text-xs text-muted">
          Yang diambil dari berkas hanya <b>nama promo, tanggal mulai, tanggal selesai, dan benefit/diskon</b> —
          kolom lain diabaikan. Promo yang sudah ada dicocokkan lewat ID, lalu lewat namanya.
        </p>
        <p class="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs">
          Perhatian: tanggal <b>17-08-2026</b> dibaca hari-bulan-tahun. Periksa sekilas sebelum menerapkan.
        </p>
        <div v-if="impor.baru.length">
          <p class="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">
            Promo baru ({{ impor.baru.length }})
          </p>
          <ul class="max-h-40 overflow-auto text-sm">
            <li
              v-for="(x, i) in impor.baru"
              :key="i"
              class="border-b border-default py-1"
            >
              <b>{{ x.nama }}</b> <span class="text-muted">{{ x.mulai }} → {{ x.selesai }}</span>
            </li>
          </ul>
        </div>
        <div v-if="impor.ubah.length">
          <p class="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">
            Diperbarui ({{ impor.ubah.length }})
          </p>
          <ul class="max-h-40 overflow-auto text-sm">
            <li
              v-for="(x, i) in impor.ubah"
              :key="i"
              class="border-b border-default py-1"
            >
              <b>{{ x.isi.nama }}</b> <span class="text-muted">{{ x.isi.mulai }} → {{ x.isi.selesai }}</span>
            </li>
          </ul>
        </div>
        <div v-if="impor.lewat.length">
          <p class="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">
            Dilewati ({{ impor.lewat.length }})
          </p>
          <ul class="max-h-32 overflow-auto text-xs text-muted">
            <li
              v-for="(x, i) in impor.lewat"
              :key="i"
            >
              baris {{ x.no }} · {{ x.nama }} — {{ x.sebab }}
            </li>
          </ul>
        </div>
        <p
          v-if="impor.baru.length"
          class="rounded-xl border border-info/30 bg-info/10 p-3 text-xs"
        >
          Promo baru masuk sebagai <b>Promo Laksamana</b>, berlaku setiap hari, di <b>{{ PROMO_OUTLET_BAWAAN }}</b>,
          tanpa kategori & ketentuan. Lengkapi lewat tombol Ubah sesudah ini.
        </p>
      </div>

      <template #footer>
        <UButton
          :label="`Terapkan ${(impor?.baru.length || 0) + (impor?.ubah.length || 0)} baris`"
          icon="i-lucide-check"
          @click="terapkanImpor"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="bukaImpor = false"
        />
      </template>
    </ResponsiveSheet>

    <BdPromoSheet
      v-model:open="bukaPromo"
      :promo="promoPilih"
      :promos="promos"
      :versi="versi"
      :nama-aku="namaAku"
    />
    <BdKonfirmasi
      v-model:open="hapusMau"
      :title="`Hapus promo &quot;${promoHapus?.nama || ''}&quot;?`"
      description="Ia juga akan hilang dari modul Radar untuk seluruh kru."
      @konfirmasi="hapus"
    />
  </AppPage>
</template>
