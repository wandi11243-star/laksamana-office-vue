<!--
  Riwayat Reservasi — the archive: past bookings, the CRM base, evaluation.
  Search + status narrow the window on the server (G-08 `q`/`status`, no
  paging — the archive rule "past or already closed" lives only here, so the
  page itself is still sliced in the browser). The default period is THIS
  MONTH, not "Semua": "Semua" pulls the whole table, and opening the screen
  should stay fast — "Semua" remains one tap away.

  Guest profiles merge the whole-history summary (G-07) with the loaded rows.
  Rows open the reservation's input page, the screen that already reads and
  edits one booking.
  Source: laksamana-office/deploy/reservasi/index.html:10041-10213.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Reservasi } from '~/composables/useReservasi'
import { useDaftarReservasi, useDenah, useRingkasanTamu } from '~/composables/useReservasi'
import { lantaiMap } from '~/utils/venue-layouts'
import { bolehAksi, bolehBuka, roleReservasi } from '~/utils/layar/reservasi'
import { angka, hariIni, tglPendek } from '~/utils/format'
import { fmtMenit } from '~/utils/kunci-meja'
import { tampilPhone } from '~/utils/dp-reservasi'
import {
  barisArsip, csvRiwayat, durasiDuduk, kelompokBarisTamu, normStatus, profilTamu, profilTamuGabung, paxRiwayat, unduhCsv, urutArsip,
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

/** Server-side narrowing (G-08): search + status only. The archive rule lives here alone, so no paging. */
const saringServer = computed(() => ({
  q: cariTunda.value.trim() || undefined,
  status: statusAkhir.value !== SEMUA ? statusAkhir.value : undefined,
}))

const { data: semua, status, refresh } = useDaftarReservasi(dari, sampai, 'reservasi-riwayat', saringServer)
const { setel } = usePollReservasi(refresh, {
  jeda: 60000,
  tunda: () => sheetDetail.value || sheetTambahDp.value || sheetEditCepat.value || sheetKirimWa.value,
})
watch([dari, sampai, () => saringServer.value.q, () => saringServer.value.status], setel)

/** Whole-history guest map, before the period start. Empty in "Semua" mode: the window IS the whole table there. */
const { data: ringkasan } = useRingkasanTamu(dari, 'reservasi-tamu-riwayat')

const arsip = computed(() => urutArsip(barisArsip(semua.value ?? [], hariIni())))

/** Rows grouped by phone once per window for the whole-history profiles. */
const kelompokTamu = computed(() => kelompokBarisTamu(semua.value ?? []))

const daftar = computed(() => {
  const q = cariTunda.value.trim().toLowerCase()
  return arsip.value.filter((r) => {
    if (statusAkhir.value !== SEMUA && normStatus(r.status) !== statusAkhir.value) return false
    if (q && !((r.name || '').toLowerCase().includes(q) || (r.phone || '').includes(q))) return false
    return true
  })
})

/** The CRM card reads the first FOUND row's phone, over the whole history (summary + window, no double count). */
const profil = computed(() => {
  const pertama = cariTunda.value.trim() && daftar.value.length ? daftar.value[0]! : null
  if (!pertama) return null
  if (!dari.value) return profilTamu(arsip.value, pertama.phone)
  return profilTamuGabung(ringkasan.value ?? new Map(), kelompokTamu.value, pertama.phone, dari.value)
})

// --- paging in the browser (the server only narrows; the archive rule lives here) ---

const hal = ref(1)
const perHal = ref(10)
const maxHal = computed(() => Math.max(1, Math.ceil(daftar.value.length / perHal.value)))
const halaman = computed(() => daftar.value.slice((hal.value - 1) * perHal.value, hal.value * perHal.value))
watch([daftar, perHal], () => {
  hal.value = Math.min(hal.value, maxHal.value)
})

// --- export --------------------------------------------------------------------

const { master } = useDenah()
const petaLantai = computed(() => lantaiMap(master.value))
const lantaiDari = (meja: string) => {
  const f = petaLantai.value.get(meja)
  return f || undefined
}

function ekspor() {
  if (!daftar.value.length) {
    toast.add({ title: 'Tidak ada baris untuk diekspor', color: 'error' })
    return
  }
  unduhCsv(`reservasi_laksamana_${hariIni()}.csv`, csvRiwayat(daftar.value, lantaiDari))
  toast.add({ title: 'CSV diunduh', color: 'success' })
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

const detailId = ref('')
const sheetDetail = ref(false)
const sheetTambahDp = ref(false)
const sheetEditCepat = ref(false)
const sheetKirimWa = ref(false)
const detail = computed(() => (semua.value ?? []).find(r => r.id === detailId.value) ?? null)
const detailProfil = computed(() => {
  const r = detail.value
  if (!r) return null
  if (!dari.value) return profilTamu(semua.value ?? [], r.phone)
  return profilTamuGabung(ringkasan.value ?? new Map(), kelompokTamu.value, r.phone, dari.value)
})

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
            <UInput
              v-model="bulan"
              type="month"
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
        :count="daftar.length"
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
            <span class="num">{{ daftar.length ? (hal - 1) * perHal + 1 : 0 }}–{{ Math.min(hal * perHal, daftar.length) }} dari {{ daftar.length }}</span>
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
          Pencarian & status dipersempit di server; halaman & ekspor CSV di browser — aturan arsip ("sudah lewat atau sudah tutup") hanya ada di layar ini.
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
            label="Kirim WA"
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
            label="Tutup"
            color="neutral"
            variant="soft"
            size="xl"
            @click="sheetDetail = false"
          />
        </template>
      </ResponsiveSheet>

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
