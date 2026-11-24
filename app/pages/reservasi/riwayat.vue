<!--
  Riwayat Reservasi — the archive: past bookings, the CRM base, evaluation.
  The table is paged by the server: every page is one request (G-08 `page`/
  `perPage`, newest first), with search, status and the archive rule
  ("past or already closed", `arsip=1`) applied there too — the browser never
  holds more than one page. The default period is THIS MONTH, not "Semua".
  The CSV export walks the pages at 100 rows a time.

  Guest profiles come from the whole-history summary (G-07) of the one phone.
  Rows open the reservation's input page, the screen that already reads and
  edits one booking.
  Source: laksamana-office/deploy/reservasi/index.html:10041-10213.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Reservasi, PetaRingkasan } from '~/composables/useReservasi'
import { getGuestsSummary, listReservationsHalaman, useDenah } from '~/composables/useReservasi'
import { lantaiMap } from '~/utils/venue-layouts'
import { bolehAksi, bolehBuka, roleReservasi } from '~/utils/layar/reservasi'
import { angka, hariIni, tglPendek } from '~/utils/format'
import { fmtMenit } from '~/utils/kunci-meja'
import { tampilPhone } from '~/utils/dp-reservasi'
import {
  csvRiwayat, durasiDuduk, kelompokBarisTamu, profilTamuGabung, paxRiwayat, unduhCsv,
} from '~/utils/riwayat'
import { usePollReservasi } from '~/composables/usePollReservasi'

definePageMeta({ access: ['reservasi'] })

const me = useMe()
const toast = useToast()
const role = computed(() => roleReservasi(me.value))

// Reka UI forbids SelectItem value '' — "Semua" is the sentinel 'semua'.
const SEMUA = 'semua'
const cari = ref('')
const mode = ref<'all' | 'month' | 'year'>('month')
const bulan = ref(hariIni().slice(0, 7))
const tahun = ref(new Date().getFullYear())
const statusAkhir = ref(SEMUA)

const dari = computed(() => {
  if (mode.value === 'month') return `${bulan.value}-01`
  if (mode.value === 'year') return `${tahun.value}-01-01`
  return ''
})
const sampai = computed(() => {
  if (mode.value === 'month') {
    const [y, m] = bulan.value.split('-').map(Number)
    return `${bulan.value}-${String(new Date(y!, m!, 0).getDate()).padStart(2, '0')}`
  }
  if (mode.value === 'year') return `${tahun.value}-12-31`
  return ''
})

/** Typing narrows the window on the server, 300 ms after the last key. */
const cariTunda = ref('')
let tundaCari: ReturnType<typeof setTimeout> | undefined
watch(cari, (v) => {
  clearTimeout(tundaCari)
  tundaCari = setTimeout(() => {
    cariTunda.value = v
  }, 300)
}, { immediate: true })

const hal = ref(1)
const perHal = ref(10)
/** A new search, period, status or page size starts again from page 1. */
watch([cariTunda, statusAkhir, dari, sampai, perHal], () => {
  hal.value = 1
})

/** Everything the server narrows by; the archive rule and the newest-first order are the server's too. */
const saringServer = computed(() => ({
  from: dari.value,
  to: sampai.value,
  q: cariTunda.value.trim() || undefined,
  status: statusAkhir.value !== SEMUA ? statusAkhir.value : undefined,
  arsip: true,
  urut: 'desc' as const,
}))

const { data: hasil, status, refresh } = useAsyncData(
  'reservasi-riwayat',
  () => listReservationsHalaman({ ...saringServer.value, page: hal.value, perPage: perHal.value }),
  { watch: [saringServer, hal, perHal] },
)
const { setel } = usePollReservasi(refresh, {
  jeda: 60000,
  tunda: () => sheetDetail.value || sheetTambahDp.value || sheetEditCepat.value || sheetKirimWa.value,
})
watch(saringServer, setel)

/** The one page on screen. */
const halaman = computed(() => hasil.value?.data ?? [])
const total = computed(() => hasil.value?.meta.total ?? 0)
const maxHal = computed(() => Math.max(1, Math.ceil(total.value / perHal.value)))
/** The server clamps a page past the end (a refresh after rows vanished): follow it. */
watch(hasil, (h) => {
  if (h?.meta.page && h.meta.page !== hal.value) hal.value = h.meta.page
})

/**
 * One guest's whole-history profile (G-07 summary of that phone, rows dated
 * before today). Falls back to the rows of this page while the summary has
 * no entry for the number, like the old screen.
 */
function useProfilTamu(telepon: Ref<string>, kunci: string) {
  const { data: peta } = useAsyncData(kunci, async () => {
    const m: PetaRingkasan = new Map()
    if (!telepon.value) return m
    const { data } = await getGuestsSummary(hariIni(), telepon.value)
    for (const [k, v] of Object.entries(data.tamu ?? {})) m.set(k.startsWith('k') ? k.slice(1) : k, v)
    return m
  }, { watch: [telepon], default: () => new Map() as PetaRingkasan })
  return computed(() => {
    if (!telepon.value) return null
    const kelompok = peta.value.size ? new Map<string, Reservasi[]>() : kelompokBarisTamu(halaman.value)
    return profilTamuGabung(peta.value, kelompok, telepon.value)
  })
}

/** The CRM card reads the first FOUND row's phone: the newest match of the search. */
const teleponProfil = computed(() => (cariTunda.value.trim() && halaman.value[0] ? halaman.value[0].phone : ''))
const profil = useProfilTamu(teleponProfil, 'reservasi-riwayat-profil')

// --- export --------------------------------------------------------------------

const { master } = useDenah()
const petaLantai = computed(() => lantaiMap(master.value))
const lantaiDari = (meja: string) => {
  const f = petaLantai.value.get(meja)
  return f || undefined
}

/** Every row of the current filter, fetched page by page (the API caps a page at 100). */
async function ekspor() {
  if (!total.value) {
    toast.add({ title: 'Tidak ada baris untuk diekspor', color: 'error' })
    return
  }
  try {
    const baris: Reservasi[] = []
    for (let p = 1; ; p++) {
      const r = await listReservationsHalaman({ ...saringServer.value, page: p, perPage: 100 })
      baris.push(...r.data)
      if (!r.data.length || baris.length >= r.meta.total) break
    }
    unduhCsv(`reservasi_laksamana_${hariIni()}.csv`, csvRiwayat(baris, lantaiDari))
    toast.add({ title: 'CSV diunduh', color: 'success' })
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- the table -------------------------------------------------------------------

const warnaStatus = STATUS_WARNA
/** "28 Sep 2026", the old archive's date. */
const tglPanjangPendek = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

// --- the detail sheet ----------------------------------------------------------
// Like the old archive, a row opens the detail popup (openDetail), not the
// edit form: info + DP + receipt first, edit behind one button.
const bolehEdit = computed(() => bolehAksi('input', role.value))
const bolehFinance = computed(() => bolehAksi('finance', role.value))
const bolehMaster = computed(() => bolehAksi('master', role.value))
const bolehHapus = computed(() => bolehAksi('deleteReservation', role.value))

const detailId = ref('')
const sheetDetail = ref(false)
const sheetTambahDp = ref(false)
const sheetHapus = ref(false)
const sheetEditCepat = ref(false)
const sheetKirimWa = ref(false)
const detail = computed(() => halaman.value.find(r => r.id === detailId.value) ?? null)
const detailProfil = useProfilTamu(computed(() => detail.value?.phone ?? ''), 'reservasi-riwayat-profil-detail')

function bukaDetail(r: Reservasi) {
  detailId.value = r.id
  sheetDetail.value = true
}

const kolom = computed<TableColumn<Reservasi>[]>(() => [
  { accessorKey: 'date', header: 'Tanggal' },
  { accessorKey: 'name', header: 'Tamu' },
  { accessorKey: 'pax', header: 'Pax' },
  { accessorKey: 'table', header: 'Meja' },
  { accessorKey: 'durasi', header: 'Durasi' },
  { accessorKey: 'dp', header: 'DP' },
  { accessorKey: 'status', header: 'Status' },
])
</script>

<template>
  <AppPage
    title="Riwayat reservasi"
    description="Arsip reservasi yang sudah lewat, basis CRM dan evaluasi. Cari nama/HP untuk lihat riwayat pelanggan."
  >
    <template v-if="bolehBuka('riwayat', role)">
      <AppPanel>
        <AppFilterGrid>
          <UFormField
            label="Cari pelanggan"
            class="col-span-2"
          >
            <UInput
              v-model="cari"
              icon="i-lucide-search"
              placeholder="Nama / No HP"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Periode">
            <USelect
              v-model="mode"
              :items="[{ value: 'all', label: 'Semua' }, { value: 'month', label: 'Bulanan' }, { value: 'year', label: 'Tahunan' }]"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="mode === 'month'"
            label="Bulan"
          >
            <AppBulan
              v-model="bulan"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="mode === 'year'"
            label="Tahun"
          >
            <UInput
              v-model.number="tahun"
              type="number"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Status akhir">
            <USelect
              v-model="statusAkhir"
              :items="[{ value: SEMUA, label: 'Semua' }, 'Datang', 'No-show', 'Cancelled']"
              class="w-full"
            />
          </UFormField>
        </AppFilterGrid>
      </AppPanel>

      <!-- The CRM card of one guest, when the search names someone (:10181-10193). -->
      <AppStatGrid v-if="profil">
        <AppStat
          label="Pelanggan"
          icon="i-lucide-user-round"
          :value="profil.nama || '(tanpa nama)'"
          :sub="`${tampilPhone(profil.telepon)}${profil.member ? ` · member ${profil.memberNo}` : ''}`"
        />
        <AppStat
          label="Total kunjungan"
          icon="i-lucide-footprints"
          tone="success"
          :value="angka(profil.kunjungan)"
          :sub="`rata-rata ${profil.rataPax} pax`"
        />
        <AppStat
          label="No-show"
          icon="i-lucide-user-x"
          :tone="profil.noShow ? 'error' : 'gold'"
          :value="angka(profil.noShow)"
          :sub="`dari ${angka(profil.totalBaris)} reservasi`"
        />
        <AppStat
          label="Status"
          icon="i-lucide-badge-check"
          :tone="profil.blacklist ? 'error' : profil.vip ? 'vip' : 'info'"
          :value="profil.blacklist ? 'Blacklist' : profil.vip ? 'VIP' : profil.tipe"
          :sub="profil.kunjunganTerakhir ? `terakhir ${tglPendek(profil.kunjunganTerakhir)} · dari seluruh riwayat` : 'belum pernah datang'"
        />
      </AppStatGrid>

      <AppPanel
        title="Arsip"
        :count="total"
        :description="mode === 'month' ? `Bulan ${bulan}` : mode === 'year' ? `Tahun ${tahun}` : undefined"
        flush
      >
        <template #actions>
          <UButton
            label="Export CSV"
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            size="sm"
            @click="ekspor"
          />
        </template>

        <UTable
          class="hidden lg:block"
          :data="halaman"
          :columns="kolom"
          :loading="status === 'pending'"
          :meta="{ class: { tr: 'cursor-pointer' } }"
          empty="Belum ada riwayat."
          @select="(_e: Event, row: { original: Reservasi }) => bukaDetail(row.original)"
        >
          <template #date-cell="{ row }">
            <span class="text-highlighted">{{ tglPanjangPendek(row.original.date) }}</span>
            <div class="text-[13px] text-muted num">
              {{ row.original.time }}
            </div>
          </template>
          <template #name-cell="{ row }">
            <p class="font-semibold text-highlighted">
              {{ row.original.name }}
              <AppStatus
                v-if="row.original.vip"
                color="vip"
                size="sm"
                icon="i-lucide-crown"
              >
                VIP
              </AppStatus>
            </p>
            <div class="text-[13px] text-muted num">
              {{ tampilPhone(row.original.phone) }}
            </div>
          </template>
          <template #pax-cell="{ row }">
            <template v-if="paxRiwayat(row.original).datang !== null">
              <b class="text-highlighted num">{{ paxRiwayat(row.original).datang }}</b><span class="text-muted">/{{ paxRiwayat(row.original).dipesan }}</span>
              <AppStatus
                v-if="(paxRiwayat(row.original).datang ?? 0) >= paxRiwayat(row.original).dipesan"
                color="success"
                size="sm"
                class="ms-1.5"
              >
                penuh
              </AppStatus>
            </template>
            <span
              v-else
              class="num"
            >{{ paxRiwayat(row.original).dipesan }}</span>
          </template>
          <template #table-cell="{ row }">
            {{ row.original.table || '—' }}
          </template>
          <template #durasi-cell="{ row }">
            <span
              v-if="durasiDuduk(row.original) !== null"
              class="inline-flex items-center gap-1 text-muted"
            >
              <UIcon
                name="i-lucide-timer"
                class="size-3.5"
              />{{ fmtMenit(durasiDuduk(row.original)!) }}
            </span>
            <span
              v-else
              class="text-dimmed"
            >—</span>
          </template>
          <template #dp-cell="{ row }">
            <span
              class="inline-flex size-6 items-center justify-center rounded-full"
              :class="row.original.dpStatus === 'Sudah' ? 'bg-success/12 text-success' : 'bg-primary-100 text-primary-700'"
              :title="row.original.dpStatus === 'Sudah' ? 'Sudah DP' : 'Belum DP'"
            >
              <UIcon
                :name="row.original.dpStatus === 'Sudah' ? 'i-lucide-check' : 'i-lucide-minus'"
                class="size-3.5"
              />
            </span>
          </template>
          <template #status-cell="{ row }">
            <AppStatus
              :color="warnaStatus[row.original.status] ?? 'neutral'"
              :icon="STATUS_IKON[row.original.status]"
            >
              {{ row.original.status }}
            </AppStatus>
          </template>
        </UTable>

        <div class="divide-y divide-default lg:hidden">
          <button
            v-for="r in halaman"
            :key="r.id"
            type="button"
            class="flex w-full items-start justify-between gap-3 px-4 py-3 text-start hover:bg-muted/60"
            @click="bukaDetail(r)"
          >
            <div class="min-w-0">
              <p class="truncate font-semibold text-highlighted">
                {{ r.name }}
              </p>
              <p class="text-sm text-muted num">
                {{ tglPendek(r.date) }} {{ r.time }} · meja {{ r.table || '—' }} · {{ r.pax }} pax
              </p>
            </div>
            <AppStatus
              :color="warnaStatus[r.status] ?? 'neutral'"
              :icon="STATUS_IKON[r.status]"
            >
              {{ r.status }}
            </AppStatus>
          </button>
          <p
            v-if="!halaman.length"
            class="px-4 py-6 text-center text-muted"
          >
            Belum ada riwayat.
          </p>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-default px-4 py-3 text-sm text-muted">
          <div class="flex items-center gap-2">
            <span class="num">{{ total ? (hal - 1) * perHal + 1 : 0 }}–{{ Math.min(hal * perHal, total) }} dari {{ total }}</span>
            <USelect
              v-model.number="perHal"
              :items="[{ value: 10, label: '10 / hal' }, { value: 25, label: '25 / hal' }, { value: 50, label: '50 / hal' }]"
              size="sm"
              class="w-28"
            />
          </div>
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="outline"
              size="sm"
              aria-label="Halaman sebelumnya"
              :disabled="hal <= 1"
              @click="hal--"
            />
            <span class="num">Hal {{ hal }} / {{ maxHal }}</span>
            <UButton
              icon="i-lucide-chevron-right"
              color="neutral"
              variant="outline"
              size="sm"
              aria-label="Halaman berikutnya"
              :disabled="hal >= maxHal"
              @click="hal++"
            />
          </div>
        </div>
        <p class="border-t border-default px-4 py-2 text-xs text-dimmed">
          Satu halaman = satu permintaan ke server; pencarian, status, dan aturan arsip ("sudah lewat atau sudah tutup") dihitung di server. Ekspor CSV mengambil semua baris sesuai filter.
        </p>
      </AppPanel>

      <ResponsiveSheet
        v-model:open="sheetDetail"
        :title="detail?.name ?? 'Detail reservasi'"
        :description="detail ? `${tglPendek(detail.date)} · ${detail.time} · meja ${detail.table || '—'} · ${detail.pax} pax` : ''"
      >
        <ReservasiDetailInfo
          v-if="detail"
          :r="detail"
          :profil="detailProfil"
          :boleh-minta-kwitansi="bolehFinance"
          :boleh-langsung-kwitansi="bolehMaster"
          :boleh-ubah-gelombang="bolehEdit"
          @berubah="refresh"
        />
        <template #footer>
          <UButton
            v-if="bolehFinance && detail"
            label="Tambah DP"
            icon="i-lucide-plus"
            size="xl"
            title="Tamu bayar DP lagi — upload bukti transfernya"
            @click="sheetDetail = false; sheetTambahDp = true"
          />
          <UButton
            v-if="detail"
            label="Kirim WA ke tamu"
            icon="i-lucide-message-circle"
            color="success"
            size="xl"
            @click="sheetKirimWa = true"
          />
          <UButton
            v-if="bolehEdit && detail"
            label="Edit cepat"
            icon="i-lucide-zap"
            color="info"
            variant="soft"
            size="xl"
            @click="sheetEditCepat = true"
          />
          <UButton
            v-if="bolehHapus && detail"
            label="Hapus"
            icon="i-lucide-trash-2"
            color="error"
            variant="soft"
            size="xl"
            @click="sheetDetail = false; sheetHapus = true"
          />
          <UButton
            label="Tutup"
            color="neutral"
            variant="soft"
            size="xl"
            @click="sheetDetail = false"
          />
        </template>
      </ResponsiveSheet>

      <ReservasiHapus
        v-model:open="sheetHapus"
        :r="detail"
        @terhapus="refresh"
        @konflik="refresh"
      />

      <ReservasiTambahDp
        v-model:open="sheetTambahDp"
        :r="detail"
        :boleh-simpan="bolehFinance"
        @tersimpan="refresh"
        @konflik="refresh"
      />
      <ReservasiEditCepat
        v-model:open="sheetEditCepat"
        :r="detail"
        :boleh-simpan="bolehEdit"
        @tersimpan="refresh"
        @konflik="refresh"
      />
      <ReservasiKirimWa
        v-model:open="sheetKirimWa"
        :r="detail"
      />
    </template>
    <p
      v-else
      class="text-muted"
    >
      Tidak ada akses.
    </p>
  </AppPage>
</template>
