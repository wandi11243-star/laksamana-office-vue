<!--
  Kalender DW (deploy/dw/index.html viewKalender :4716-5340). One row per
  daily worker, one column per day — the twin of Jadwal Bulanan, except the
  status is visible (waiting is dashed) and only DW with a row this month are
  drawn; the row of anyone else comes from "+ Tambah DW" (:4598-4606).

  Who writes, and what the write means (F.11, :4961):
    HRD           → langsung terjadwal
    head divisi   → pengajuan, masuk Antrean HRD
  Past days are not clickable, and the sheet refuses them too (:4981).

  Thirty-one day columns do not fit any screen, so the sheet scrolls inside
  its own box with the names frozen (same rule as `JadwalLembar`); the page
  itself never moves sideways at 390px.
-->
<script setup lang="ts">
import type { PekerjaDw } from '~/utils/dw'
import { bolehIsiKalenderDw, kandidatDw, riwayatPakaiDw, tglLampau } from '~/utils/dw'
import { DIVISI, namaDivisiJadwal, HARI_SENIN, hariSebulan, idxHari, labelBulanJadwal, seninDari, tglSel, unduhCsvJadwal } from '~/utils/jadwal'
import { useDwBulan, useDwDasar } from '~/composables/useDw'
import { fTgl, fTglP, hariIni } from '~/utils/format'

definePageMeta({ access: ['dw'] })

const { set, ajuan, permintaan, pekerja, peran, error, refresh } = useDwDasar()
const mk = useDwBulan()

const div = ref(DIVISI[0]!.k)
const hari = computed(() => hariSebulan(mk.value))
const namaBulan = computed(() => labelBulanJadwal(mk.value))

// Rows added by hand (screen state, not data — like LEMBAR_EKSTRA, :4605).
const ekstra = useState<Record<string, string[]>>('dw-lembar-ekstra', () => ({}))

const ajuanBulan = computed(() => ajuan.value.filter(a => a.status !== 'BATAL' && a.tgl >= hari.value[0]! && a.tgl <= hari.value.at(-1)!))
const idBaris = computed(() => {
  const out = new Set<string>()
  for (const a of ajuanBulan.value) if (a.divisi === div.value) out.add(a.dwId)
  for (const id of ekstra.value[div.value] ?? []) out.add(id)
  return [...out]
})
const baris = computed<PekerjaDw[]>(() => idBaris.value
  .map(id => pekerja.value.find(p => p.id === id))
  .filter((p): p is PekerjaDw => !!p)
  .sort((a, b) => String(a.nama).localeCompare(String(b.nama))))

const sel = (dwId: string, tgl: string) => ajuanBulan.value.filter(a => a.dwId === dwId && a.tgl === tgl)
const terjadwalBulan = (dwId: string) => ajuanBulan.value.filter(a => a.dwId === dwId && a.status === 'DISETUJUI').length

const bisaIsi = computed(() => bolehIsiKalenderDw(peran.value, div.value))
const bisaKlik = (tgl: string) => bisaIsi.value && !tglLampau(tgl)

// Cell sheet
const selOpen = ref(false)
const selTgl = ref('')
function bukaSel(tgl: string) {
  if (!bisaKlik(tgl)) return
  selTgl.value = tgl
  selOpen.value = true
}

// Weekly row
const barisOpen = ref(false)
const barisOrang = ref<PekerjaDw | null>(null)
const barisSenin = ref('')
function bukaBaris(p: PekerjaDw) {
  barisOrang.value = p
  const ini = hariIni()
  barisSenin.value = ini.slice(0, 7) === mk.value ? seninDari(ini) : seninDari(`${mk.value}-01`)
  barisOpen.value = true
}

// "+ Tambah DW"
const tambahOpen = ref(false)
const tambahId = ref('__kosong__')
const kandidatTambah = computed(() => kandidatDw(pekerja.value, div.value, '', 'sering').filter(p => !idBaris.value.includes(p.id)))
watch(tambahOpen, (v) => {
  if (v) tambahId.value = '__kosong__'
})
function tambah() {
  if (tambahId.value === '__kosong__') return
  const list = ekstra.value[div.value] ?? []
  if (!list.includes(tambahId.value)) ekstra.value = { ...ekstra.value, [div.value]: [...list, tambahId.value] }
  tambahOpen.value = false
}

function geser(n: number) {
  const p = mk.value.split('-')
  const d = new Date(Number(p[0]), Number(p[1]) - 1 + n, 1)
  mk.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
async function selesai() {
  await refresh()
}

// Share tools, same order as Jadwal Bulanan (Excel · Teks WA · Print, :4914-4921).
const toast = useToast()
const namaDw = (id: string) => pekerja.value.find(x => x.id === id)?.nama ?? '(DW dihapus)'
const isiSel = (dwId: string, tgl: string) => sel(dwId, tgl).filter(a => a.status !== 'DITOLAK')
/** exportExcelDW as CSV (K-05): one row per DW, one column per day; status written when not approved. */
function eksporExcel() {
  if (!baris.value.length) {
    toast.add({ title: 'Belum ada daily worker terjadwal di lembar ini', color: 'warning' })
    return
  }
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['No.', 'Nama', 'Posisi', ...hari.value]
  const body = baris.value.map((x, i) => [i + 1, x.nama, x.posisi || 'DW', ...hari.value.map(d => isiSel(x.id, d)
    .map(a => `${a.posisi || 'DW'}${a.m && a.s ? ` ${a.m}–${a.s}` : ''}${a.status === 'DISETUJUI' ? '' : ` (${a.status === 'MENUNGGU' ? 'Menunggu' : a.status})`}`)
    .join(' · '))])
  unduhCsvJadwal(`DW-${namaDivisiJadwal(div.value)}-${mk.value}.csv`, [head, ...body].map(r => r.map(q).join(',')).join('\n'))
}
/** exportWADW (:7774): per day, waiting shifts included and flagged. */
const teksWa = computed(() => {
  const garis = '━━━━━━━━━━━━━━━'
  let txt = `*DAILY WORKER — ${namaDivisiJadwal(div.value).toUpperCase()}*\n_${namaBulan.value}_\n${garis}\n`
  let nTunggu = 0
  let nSetuju = 0
  for (const d of hari.value) {
    const isi = ajuanBulan.value.filter(a => a.divisi === div.value && a.tgl === d && a.status !== 'DITOLAK')
      .sort((x, y) => String(x.m || '').localeCompare(String(y.m || '')))
    if (!isi.length) continue
    txt += `\n*${HARI_SENIN[idxHari(d)]} · ${fTglP(d)}${idxHari(d) >= 5 ? ' 🔴' : ''}*\n`
    for (const a of isi) {
      if (a.status === 'MENUNGGU') nTunggu++
      else nSetuju++
      txt += `   • ${namaDw(a.dwId)} _(${a.posisi || 'DW'}${a.m && a.s ? ` · ${a.m}–${a.s}` : ''})_${a.status === 'MENUNGGU' ? ' ⏳ _belum disetujui_' : ''}\n`
    }
  }
  txt += `\n${garis}\n_${nSetuju} shift disetujui${nTunggu ? `, ${nTunggu} masih menunggu HR` : ''}_\n`
  return `${txt}_Laksamana Muda · daily worker_`
})
const waOpen = ref(false)
function bukaWa() {
  if (!ajuanBulan.value.some(a => a.divisi === div.value)) {
    toast.add({ title: 'Belum ada ajuan di lembar ini', color: 'warning' })
    return
  }
  waOpen.value = true
}
const cetak = () => cetakPdf(namaBerkas('Kalender DW', namaDivisiJadwal(div.value), namaBulan.value))
</script>

<template>
  <AppPage
    title="Kalender DW"
    description="Sebulan penuh per divisi."
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
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <h2 class="text-lg font-semibold text-highlighted">
            {{ namaBulan }}
          </h2>
          <AppStatus
            v-if="mk !== hariIni().slice(0, 7)"
            size="sm"
          >
            bukan bulan ini
          </AppStatus>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Bulan sebelumnya"
            @click="geser(-1)"
          />
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Bulan berikutnya"
            @click="geser(1)"
          />
          <UButton
            v-if="mk !== hariIni().slice(0, 7)"
            label="Kembali ke bulan ini"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="mk = hariIni().slice(0, 7)"
          />
          <div class="ms-auto flex flex-wrap items-center gap-1.5 print:hidden">
            <UButton
              v-if="bisaIsi"
              label="Tambah DW ke lembar"
              icon="i-lucide-plus"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="tambahOpen = true"
            />
            <UButton
              label="Excel sebulan"
              icon="i-lucide-file-spreadsheet"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="eksporExcel"
            />
            <UButton
              label="Teks WA"
              icon="i-lucide-message-circle"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="bukaWa"
            />
            <UButton
              label="Print / PDF"
              icon="i-lucide-printer"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="cetak"
            />
          </div>
        </div>
      </template>

      <div class="mb-3 flex flex-wrap items-center gap-3">
        <AppSeg
          v-model="div"
          :options="DIVISI.map(d => ({ value: d.k as string, label: d.n }))"
          size="sm"
        />
        <span class="text-sm text-muted">
          <template v-if="peran.hrd">Sebagai HRD, yang Anda isi langsung terjadwal.</template>
          <template v-else-if="bisaIsi">Yang Anda isi masuk sebagai pengajuan; HRD yang menyetujui.</template>
          <template v-else>Hanya head divisi ini dan HRD yang bisa mengisi lembar ini.</template>
        </span>
      </div>

      <div class="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-success" /> Disetujui</span>
        <span class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-warning" /> Menunggu</span>
        <span>· klik sel untuk mengisi · sel berisi status selain disetujui tidak bisa ditimpa dari sini</span>
      </div>

      <div
        v-if="!baris.length"
        class="rounded-field bg-muted px-3 py-6 text-center text-muted"
      >
        Belum ada daily worker {{ namaDivisiJadwal(div) }} yang punya ajuan bulan ini.
        <template v-if="bisaIsi">
          Tekan <b>Tambah DW</b> untuk menambahkan barisnya.
        </template>
      </div>

      <div
        v-else
        class="overflow-x-auto"
      >
        <table class="lembar w-max min-w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th class="beku left-0 w-9 bg-table-head text-table-head-text">
                No.
              </th>
              <th class="beku left-9 w-32 bg-table-head text-start text-table-head-text lg:w-44">
                Nama
              </th>
              <th class="beku left-41 w-24 bg-table-head text-start text-table-head-text lg:w-32">
                Bulan ini
              </th>
              <th
                v-for="d in hari"
                :key="d"
                class="hari bg-table-head px-1 py-2 text-table-head-text num"
                :class="idxHari(d) === 0 && 'border-s-2 border-s-primary-400'"
              >
                {{ tglSel(d) }}
              </th>
            </tr>
            <tr>
              <th class="beku left-0 bg-muted" />
              <th class="beku left-9 bg-muted" />
              <th class="beku left-41 bg-muted text-start text-[11px] font-semibold uppercase text-muted">
                Terjadwal
              </th>
              <th
                v-for="d in hari"
                :key="`h-${d}`"
                class="bg-muted px-1 py-1 text-[11px] font-semibold"
                :class="[idxHari(d) >= 5 ? 'text-primary-700' : 'text-muted', idxHari(d) === 0 && 'border-s-2 border-s-primary-400']"
              >
                {{ HARI_SENIN[idxHari(d)]!.slice(0, 3) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(p, i) in baris"
              :key="p.id"
            >
              <td class="beku left-0 bg-default text-center text-muted num">
                {{ i + 1 }}
              </td>
              <td class="beku left-9 max-w-32 bg-default lg:max-w-44">
                <b class="block truncate text-highlighted">{{ p.nama }}</b>
                <i class="text-[11px] not-italic text-muted">{{ riwayatPakaiDw(pekerja.find(x => x.id === p.id)!) }}</i>
              </td>
              <td class="beku left-41 bg-default">
                <span class="font-semibold text-highlighted num">{{ terjadwalBulan(p.id) }}</span>
                <button
                  v-if="bisaIsi"
                  type="button"
                  class="ms-1 rounded px-1 text-[11px] font-semibold text-primary-700 hover:bg-primary-100"
                  title="Isi satu minggu untuk orang ini"
                  @click="bukaBaris(p)"
                >
                  Input mingguan
                </button>
              </td>
              <td
                v-for="d in hari"
                :key="`${p.id}-${d}`"
                class="sel align-top"
                :class="[
                  idxHari(d) === 0 && 'border-s-2 border-s-primary-400',
                  bisaKlik(d) && 'cursor-pointer hover:outline-2 hover:outline-primary-500',
                ]"
                :title="bisaKlik(d) ? `Isi ${p.nama} · ${fTgl(d)}` : `${p.nama} · ${fTgl(d)}`"
                @click="bisaKlik(d) && bukaSel(d)"
              >
                <template v-if="sel(p.id, d).length">
                  <div
                    v-for="a in sel(p.id, d)"
                    :key="a.id"
                    class="mb-0.5 rounded px-1 py-0.5 text-[10px] font-bold"
                    :class="a.status === 'DISETUJUI'
                      ? 'bg-success/12 text-success'
                      : a.status === 'MENUNGGU'
                        ? 'border border-dashed border-warning text-warning'
                        : 'bg-muted text-muted'"
                  >
                    {{ a.posisi || namaDivisiJadwal(a.divisi) }}
                    <span class="font-medium num">{{ a.m }}–{{ a.s }}</span>
                  </div>
                </template>
                <span
                  v-else
                  class="block text-center text-dimmed"
                >·</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="mt-3 text-sm text-muted">
        <span v-if="bisaIsi">Hanya DW yang sudah punya ajuan bulan ini yang punya barisnya — tekan <b>Tambah DW</b> untuk orang lain.</span>
        <span v-else>Hanya DW yang sudah punya ajuan bulan ini yang punya barisnya.</span>
        Baris yang <b>menunggu</b> tetap bisa dilihat tetapi keputusannya di <b>Antrean Pengajuan</b>.
      </p>
    </AppPanel>

    <DwSelSheet
      v-if="set"
      v-model:open="selOpen"
      :set="set"
      :pekerja="pekerja"
      :ajuan="ajuan"
      :permintaan="permintaan"
      :peran="peran"
      :tgl="selTgl"
      :div="div"
      @sent="selesai"
    />

    <DwIsiBaris
      v-if="barisOrang && set"
      v-model:open="barisOpen"
      :set="set"
      :peran="peran"
      :ajuan="ajuan"
      :p="barisOrang"
      :senin="barisSenin"
      :div="div"
      @sent="selesai"
    />

    <ResponsiveSheet
      v-model:open="tambahOpen"
      title="Tambah baris DW"
      description="Baris ini hanya untuk menyusun bulan ini; begitu orangnya benar-benar punya ajuan, barisnya berdiri sendiri."
    >
      <UFormField label="Daily worker">
        <USelect
          v-model="tambahId"
          :items="[{ value: '__kosong__', label: '— pilih daily worker —' }, ...kandidatTambah.map(p => ({ value: p.id, label: `${p.nama} · ${riwayatPakaiDw(p)}` }))]"
          class="w-full"
        />
      </UFormField>
      <template #footer>
        <UButton
          label="Tambahkan"
          :disabled="tambahId === '__kosong__'"
          @click="tambah"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="tambahOpen = false"
        />
      </template>
    </ResponsiveSheet>
    <JadwalTeksWA
      v-model:open="waOpen"
      :teks="teksWa"
    />
  </AppPage>
</template>

<style scoped>
/* Geometry only; colours are tokens (DESIGN.md: no hex in components). */
.lembar th,
.lembar td {
  border-bottom: 1px solid var(--ui-border);
  border-right: 1px solid var(--ui-border);
}
.lembar td {
  padding: 0.25rem 0.375rem;
}
.beku {
  position: sticky;
  z-index: 10;
}
.lembar td.sel {
  height: 3rem;
  padding: 0.125rem;
}
.lembar .hari,
.lembar td.sel {
  width: 4.75rem;
  min-width: 4.75rem;
  max-width: 4.75rem;
}
/* Phones freeze only No + Nama; the third column scrolls with the days. */
.left-41 {
  position: static;
}
@media (min-width: 1024px) {
  .left-41 {
    position: sticky;
    left: 10.25rem;
  }
}
</style>
