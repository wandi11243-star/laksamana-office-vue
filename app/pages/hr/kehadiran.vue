<!--
  HR › Kehadiran — reimagine (B): peringatan jadi "Perlu tindakan".

  Dulu peringatan (tanpa check-in, nama belum terhubung) terselip di antara
  catatan berkas dan tabel. Versi ini mengangkat keduanya jadi bagian
  "Perlu tindakan" tepat di bawah info berkas — yang harus dikerjakan
  dibaca dulu, daftar skor sesudahnya. Isi dan rumus tidak berubah.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { HrEmployee } from '~/utils/hr'
import { canHr, divName, scopeKehadiran } from '~/utils/hr'
import type { AttendanceDetail } from '~/utils/people-score'
import { attendanceCumulative, attendanceDetail, attRules } from '~/utils/people-score'
import { hrPostAudit, hrSaveAttendance, useHrDasar } from '~/composables/useHr'
import { hariIni } from '~/utils/format'
import { labelBulanJadwal } from '~/utils/jadwal'

definePageMeta({ access: ['hr'] })

interface Baris { e: HrEmployee, d: AttendanceDetail, kum: ReturnType<typeof attendanceCumulative> }

const toast = useToast()
const { s, cu, officeAdmin, pending, error, refresh } = useHrDasar()
const mk = useState('hr-kehadiran-mk', () => '')

const bulanAda = computed(() => Object.keys(s.value.attendance).sort())
watch([pending, bulanAda], () => {
  if (!mk.value && !pending.value) mk.value = bulanAda.value.at(-1) ?? hariIni().slice(0, 7)
}, { immediate: true })

const bolehInput = computed(() => canHr('inputKpi', cu.value, officeAdmin.value))
const bulan = computed(() => s.value.attendance[mk.value])
const R = computed(() => attRules(s.value))

const terlihat = computed(() => scopeKehadiran(s.value, cu.value, officeAdmin.value))
const semua = computed<Baris[]>(() => terlihat.value
  .map(e => ({ e, d: attendanceDetail(s.value, e.id, mk.value), kum: attendanceCumulative(s.value, e.id) }))
  .filter((r): r is Baris => !!r.d))
const rows = computed(() => semua.value.filter(r => !r.d.noData).sort((a, b) => (b.d.score ?? 0) - (a.d.score ?? 0)))
const noData = computed(() => semua.value.filter(r => r.d.noData))

const kolom: TableColumn<Baris>[] = [
  { id: 'no', header: '#' },
  { id: 'kru', header: 'Kru' },
  { id: 'divisi', header: 'Divisi' },
  { id: 'hari', header: () => h('span', { class: 'block text-end' }, 'Hari kerja') },
  { id: 'hadir', header: () => h('span', { class: 'block text-end' }, 'Hadir') },
  { id: 'alpa', header: () => h('span', { class: 'block text-end' }, 'Alpa') },
  { id: 'telat', header: () => h('span', { class: 'block text-end' }, 'Telat') },
  { id: 'tanpaOut', header: () => h('span', { class: 'block text-end' }, 'Tanpa out') },
  { id: 'presensi', header: () => h('span', { class: 'block text-end' }, 'Presensi') },
  { id: 'ketepatan', header: () => h('span', { class: 'block text-end' }, 'Ketepatan') },
  { id: 'skor', header: 'Skor bulan' },
  { id: 'kumulatif', header: () => h('span', { class: 'block text-end' }, 'Kumulatif') },
  { id: 'aksi', header: () => h('span', { class: 'block text-end' }, '') },
]

const imporOpen = ref(false)
const rincianOpen = ref(false)
const rincianE = ref<HrEmployee | null>(null)
function rincian(e: HrEmployee) {
  rincianE.value = e
  rincianOpen.value = true
}

const hapusOpen = ref(false)
async function jalanHapus() {
  try {
    await hrSaveAttendance(mk.value, null)
    try {
      await hrPostAudit('ATT_HAPUS', mk.value)
    }
    catch {
      // Audit is a bonus; the deletion already happened.
    }
    hapusOpen.value = false
    toast.add({ title: `Data kehadiran ${labelBulanJadwal(mk.value)} dihapus`, color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal menghapus: ${apiErrorMessage(e)}`, color: 'error' })
  }
}
async function sesudahImpor(hasilMk: string) {
  mk.value = hasilMk
  await refresh()
}
const angka = (v: number | null | undefined, digit = 1) => (v == null ? '—' : String(Math.round(v * 10 ** digit) / 10 ** digit))
</script>

<template>
  <AppPage
    title="Kehadiran"
    description="Report Talenta & skor presensi."
  >
    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel>
      <template #head>
        <HrBulan v-model="mk" />
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            v-if="bolehInput"
            label="Unggah report Talenta"
            icon="i-lucide-upload"
            size="sm"
            @click="imporOpen = true"
          />
          <UButton
            v-if="bolehInput && bulan"
            label="Hapus bulan ini"
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="sm"
            @click="hapusOpen = true"
          />
        </div>
      </template>

      <p
        v-if="!bulan"
        class="rounded-field bg-muted px-3 py-3 text-sm text-muted"
      >
        Belum ada report absensi untuk <b>{{ labelBulanJadwal(mk) }}</b>.
        <template v-if="bolehInput">
          Unggah berkas <b>export_report_attendance.xlsx</b> dari Talenta lewat tombol di atas.
        </template>
      </p>
      <p
        v-if="!bulan && bulanAda.length"
        class="mt-2 text-sm text-muted"
      >
        Bulan yang sudah ada:
        <button
          v-for="m in bulanAda"
          :key="m"
          type="button"
          class="me-2 font-semibold text-primary-700 hover:underline"
          @click="mk = m"
        >
          {{ labelBulanJadwal(m) }}
        </button>
      </p>

      <template v-if="bulan">
        <p class="mb-3 rounded-field bg-muted px-3 py-2 text-sm text-muted">
          Berkas <b>{{ bulan.fileName || '(tanpa nama)' }}</b>, diunggah {{ bulan.importedBy || '?' }}<template v-if="bulan.importedAt">
            pada {{ String(bulan.importedAt).slice(0, 10) }}
          </template>.
          {{ rows.length }} kru dinilai. Toleransi terlambat {{ R.lateToleranceMin ?? 15 }} menit, penalti penuh di
          {{ R.lateCapMin ?? 45 }} menit, check-in tanpa check-out dihitung {{ R.noCheckoutCredit ?? 0.5 }} hari.
          Ubah di Pengaturan.
        </p>
        <AppSectionTitle
          v-if="bulan && (noData.length || (bulan.unmatched ?? []).length)"
          title="Perlu tindakan"
          icon="i-lucide-siren"
        />
        <p
          v-if="noData.length"
          class="mb-3 rounded-field bg-warning/12 px-3 py-2 text-sm"
        >
          <b>{{ noData.length }} kru tidak punya satu pun check-in sepanjang {{ labelBulanJadwal(mk) }}</b>:
          {{ noData.map(r => r.e.name).join(', ') }}. Mereka <b>tidak diberi skor</b> karena pola ini biasanya berarti
          yang bersangkutan tidak memakai aplikasi absensi, bukan tidak masuk kerja. Kalau memang benar-benar tidak
          masuk, catat lewat modul Disiplin. Kalau ini masalah aplikasi, perbaiki di Talenta lalu unggah ulang bulan ini.
        </p>
        <p
          v-if="(bulan.unmatched ?? []).length"
          class="mb-3 rounded-field bg-warning/12 px-3 py-2 text-sm"
        >
          <b>{{ (bulan.unmatched ?? []).length }} nama di berkas belum terhubung ke akun Office</b>, jadi belum punya skor
          kehadiran: {{ (bulan.unmatched ?? []).map(u => `${u.name} (${u.talentaId})`).join(', ') }}.
          Isi <b>Talenta ID</b> orang tersebut di Office → Kelola User, lalu buka halaman ini lagi. Data harian
          mereka sudah tersimpan, jadi tidak perlu unggah ulang.
        </p>

        <AppSectionTitle
          title="Daftar skor"
          icon="i-lucide-table"
        />
        <UTable
          class="hidden lg:block"
          :data="[...rows, ...noData]"
          :columns="kolom"
          :loading="pending"
          empty="Tidak ada kru yang cocok dengan berkas ini. Periksa pemetaan Talenta ID di Office."
        >
          <template #no-cell="{ row }">
            <span class="text-muted num">{{ rows.indexOf(row.original) > -1 ? rows.indexOf(row.original) + 1 : '–' }}</span>
          </template>
          <template #kru-cell="{ row }">
            <p class="font-semibold text-highlighted">
              {{ row.original.e.name }}
            </p>
            <p class="text-[13px] text-muted">
              {{ row.original.e.role || '' }}
            </p>
          </template>
          <template #divisi-cell="{ row }">
            <span class="text-sm">{{ divName(s, row.original.e.divId) }}</span>
          </template>
          <template #hari-cell="{ row }">
            <span class="block text-end num">{{ row.original.d.hariKerja }}</span>
          </template>
          <template #hadir-cell="{ row }">
            <span class="block text-end num">{{ angka(row.original.d.kredit) }}</span>
          </template>
          <template #alpa-cell="{ row }">
            <span
              class="block text-end num"
              :class="row.original.d.alpa ? '' : 'text-muted'"
            >{{ row.original.d.alpa || '–' }}</span>
          </template>
          <template #telat-cell="{ row }">
            <span
              class="block text-end num"
              :class="row.original.d.telat ? '' : 'text-muted'"
            >{{ row.original.d.telat || '–' }}</span>
          </template>
          <template #tanpaOut-cell="{ row }">
            <span
              class="block text-end num"
              :class="row.original.d.tanpaCheckout ? '' : 'text-muted'"
            >{{ row.original.d.tanpaCheckout || '–' }}</span>
          </template>
          <template #presensi-cell="{ row }">
            <span
              class="block text-end num"
              :class="row.original.d.noData ? 'text-muted' : ''"
            >{{ row.original.d.noData ? '–' : angka(row.original.d.presence) }}</span>
          </template>
          <template #ketepatan-cell="{ row }">
            <span
              class="block text-end num"
              :class="row.original.d.noData ? 'text-muted' : ''"
            >{{ row.original.d.noData ? '–' : angka(row.original.d.punctuality) }}</span>
          </template>
          <template #skor-cell="{ row }">
            <span
              v-if="row.original.d.noData"
              class="text-xs text-muted"
            >tidak pernah tap</span>
            <HrBar
              v-else
              :value="row.original.d.score"
              class="w-32"
            />
          </template>
          <template #kumulatif-cell="{ row }">
            <span
              v-if="row.original.kum"
              class="block text-end num"
            >{{ angka(row.original.kum.score) }}
              <span class="block text-[12px] text-muted">{{ row.original.kum.bulan }} bln</span>
            </span>
            <span
              v-else
              class="block text-end text-muted"
            >–</span>
          </template>
          <template #aksi-cell="{ row }">
            <div class="flex justify-end">
              <UButton
                label="Rincian"
                color="neutral"
                variant="outline"
                size="xs"
                @click="rincian(row.original.e)"
              />
            </div>
          </template>
        </UTable>

        <div class="space-y-2 lg:hidden">
          <article
            v-for="(r, i) in [...rows, ...noData]"
            :key="r.e.id"
            class="rounded-field border border-default p-3"
            :class="r.d.noData && 'opacity-60'"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="font-semibold text-highlighted">
                  <span class="me-1.5 text-muted num">{{ rows.indexOf(r) > -1 ? rows.indexOf(r) + 1 : i + 1 }}</span>{{ r.e.name }}
                </p>
                <p class="text-[13px] text-muted">
                  {{ divName(s, r.e.divId) }} · {{ r.d.hariKerja }} hari kerja · hadir {{ angka(r.d.kredit) }}
                </p>
                <p class="text-[13px] text-muted">
                  Alpa {{ r.d.alpa || 0 }} · Telat {{ r.d.telat || 0 }} · Tanpa out {{ r.d.tanpaCheckout || 0 }}
                </p>
              </div>
              <div class="shrink-0 text-end">
                <p
                  v-if="r.d.noData"
                  class="text-xs text-muted"
                >
                  tidak pernah tap
                </p>
                <p
                  v-else
                  class="font-display text-lg font-bold text-highlighted num"
                >
                  {{ angka(r.d.score) }}
                </p>
              </div>
            </div>
            <div class="mt-2 flex items-center justify-between gap-2">
              <span class="text-xs text-muted">
                Presensi {{ r.d.noData ? '–' : angka(r.d.presence) }} · Ketepatan {{ r.d.noData ? '–' : angka(r.d.punctuality) }}
              </span>
              <UButton
                label="Rincian"
                color="neutral"
                variant="outline"
                size="xs"
                @click="rincian(r.e)"
              />
            </div>
          </article>
        </div>

        <p class="mt-3 text-sm text-muted">
          <b>Presensi</b> = hari hadir dibagi hari kerja (check-in tanpa check-out dihitung
          {{ R.noCheckoutCredit ?? 0.5 }}). <b>Ketepatan</b> = 100 dikurangi penalti terlambat. Hari libur, cuti,
          dan izin dalam jatah tidak masuk hitungan sama sekali. Izin melebihi jatah (I maks
          {{ R.excusedCaps?.I ?? 3 }}, S maks {{ R.excusedCaps?.S ?? 2 }}) dihitung sebagai alpa.
        </p>
      </template>
    </AppPanel>

    <HrImporTalenta
      v-model:open="imporOpen"
      @saved="sesudahImpor"
    />
    <HrRincianKehadiran
      v-model:open="rincianOpen"
      :e="rincianE"
      :mk="mk"
    />

    <ResponsiveSheet
      v-model:open="hapusOpen"
      :title="`Hapus data kehadiran ${labelBulanJadwal(mk)}?`"
    >
      <p class="text-sm">
        Skor attendance bulan itu akan kembali memakai input manual bila ada.
      </p>
      <template #footer>
        <UButton
          label="Ya, hapus"
          color="error"
          @click="jalanHapus"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="hapusOpen = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
