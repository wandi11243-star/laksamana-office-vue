<!--
  Kalender Tamu (deploy/dw/index.html viewTamu :5340-5454).

  Guest pax comes from GET /dw/guests (G-05, laksamana-api#254): per day per
  source (`marketing`, `event`, `reservasi`), already filtered server-side to
  confirmed events and non-cancelled reservations (no-shows count 0). The
  screen only sums, in app/utils/pax-harian.ts (`paxAcaraDari`, `paxRsvDari`,
  `paxTotalDari`); the quota guide keeps reading the event sources only
  (`konteksHariDw`, F.15), fed through `useDwPax` so the Ajukan sheet
  (`DwAjukan`) sees the same numbers.

  Each box prints what the old one did (:5385-5403): the total, up to two
  event titles (+n more), the table bookings, then the DW line. Titles and
  booking counts come from `acara` / `n` (laksamana-api#352); without them
  the box falls back to the per-source pax split. The DW half is built from
  GET /dw/overview (approved + waiting counts per day).

  Clicking any box still opens the Ajukan DW sheet for that day, so the page
  keeps its one job: see the day and act on it.
-->
<script setup lang="ts">
import type { AjuanDw } from '~/utils/dw'
import { ajuanHidup, mulaiKisi } from '~/utils/dw'
import { useDwBulan, useDwDasar, useDwGuests, useDwPax } from '~/composables/useDw'
import { paxAcaraDari, paxRsvDari, paxTotalDari, SUMBER_ACARA } from '~/utils/pax-harian'
import { akhirBulan, geserBulan, labelBulanJadwal, namaDivisiJadwal } from '~/utils/jadwal'
import { hariIni, tambahHari } from '~/utils/format'

definePageMeta({ access: ['dw'] })

const { ajuan, peran, pending, error, refresh } = useDwDasar()
const mk = useDwBulan()
const bulanIni = hariIni().slice(0, 7)

const awal = computed(() => `${mk.value}-01`)
const akhir = computed(() => akhirBulan(mk.value))
/** The visible 42-box grid, so neighbouring-month boxes have pax too. */
const gridDari = computed(() => mulaiKisi(mk.value))
const gridSampai = computed(() => tambahHari(gridDari.value, 41))
const { data: tamu, status: statusTamu, error: tamuError, refresh: refreshTamu } = useDwGuests('dw-guests', gridDari, gridSampai)

const rows = computed(() => tamu.value?.rows ?? [])
const acaraHari = (tgl: string) => (tamu.value?.acara ?? []).filter(x => x.tgl === tgl)
const nRsv = (tgl: string) => rows.value.filter(r => r.tgl === tgl && r.sumber === 'reservasi').reduce((a, r) => a + (Number(r.n) || 0), 0)
/** The old `rsv` line: "3 reservasi · 45 pax" once counts exist, else the pax alone. */
const barisRsv = (tgl: string) => {
  const pr = paxRsv(tgl)
  const n = nRsv(tgl)
  if (n) return `${n} reservasi${pr ? ` · ${pr} pax` : ''}`
  return pr ? `${pr} pax reservasi` : ''
}
const paxAcara = (tgl: string) => paxAcaraDari(rows.value, tgl)
const paxRsv = (tgl: string) => paxRsvDari(rows.value, tgl)
const paxTotal = (tgl: string) => paxTotalDari(rows.value, tgl)
const rincian = (tgl: string) => {
  const parts: string[] = []
  const pa = paxAcara(tgl)
  const pr = paxRsv(tgl)
  if (pa) parts.push(`${pa} acara`)
  if (pr) parts.push(`${pr} rsv`)
  return parts.join(' · ')
}

/** Feed the quota guide (`DwAjukan` reads this): event pax per date. */
const pax = useDwPax()
watch(rows, (rs) => {
  const m: Record<string, number> = {}
  for (const r of rs) {
    if (!SUMBER_ACARA.includes(String(r.sumber || '').toLowerCase())) continue
    m[r.tgl] = (m[r.tgl] ?? 0) + (Number(r.pax) || 0)
  }
  pax.value = m
}, { immediate: true })

/** Every date of the open month, for the monthly stats. */
const hariBulan = computed(() => {
  const out: string[] = []
  for (let d = awal.value; d <= akhir.value; d = tambahHari(d, 1)) out.push(d)
  return out
})
const paxAcaraBulan = computed(() => hariBulan.value.reduce((n, d) => n + paxAcara(d), 0))
const paxRsvBulan = computed(() => hariBulan.value.reduce((n, d) => n + paxRsv(d), 0))
const paxBulan = computed(() => paxAcaraBulan.value + paxRsvBulan.value)
const hariAda = computed(() => hariBulan.value.filter(d => paxTotal(d) > 0).length)

const ajuanBulan = computed(() => ajuan.value.filter(a => a.tgl >= awal.value && a.tgl <= akhir.value && a.status !== 'BATAL'))
const hariAjuan = (tgl: string): AjuanDw[] => ajuan.value.filter(a => a.tgl === tgl && ajuanHidup(a))
const adaSetuju = (tgl: string) => hariAjuan(tgl).some(a => a.status === 'DISETUJUI')

const stat = computed(() => {
  const setuju = ajuanBulan.value.filter(a => a.status === 'DISETUJUI')
  const tunggu = ajuanBulan.value.filter(a => a.status === 'MENUNGGU')
  const tanpa = hariBulan.value.filter(d => paxTotal(d) > 0 && !adaSetuju(d)).length
  return { setuju: setuju.length, tunggu: tunggu.length, tanpa }
})

const muatUlang = () => Promise.all([refresh(), refreshTamu()])

// Skeleton only for the first load: the month picker refetches guests in place, so later loads keep the old cards.
const statMemuat = computed(() => !ajuan.value.length && !rows.value.length
  && (pending.value || statusTamu.value === 'pending' || statusTamu.value === 'idle'))

const ajukanOpen = ref(false)
const ajukanTgl = ref('')
function buka(tgl: string) {
  ajukanTgl.value = tgl
  ajukanOpen.value = true
}
async function selesai() {
  await refresh()
}

/** 42 days of the visible grid clickable; neighbouring-month days too. */
const bisaKlik = () => true
</script>

<template>
  <AppPage
    title="Kalender tamu"
    description="Pax dari Marketing, Event & Reservasi — klik hari untuk ajukan DW."
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
            {{ labelBulanJadwal(mk) }}
          </h2>
          <AppStatus
            v-if="mk !== bulanIni"
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
            @click="mk = geserBulan(mk, -1)"
          />
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Bulan berikutnya"
            @click="mk = geserBulan(mk, 1)"
          />
          <UButton
            v-if="mk !== bulanIni"
            label="Kembali ke bulan ini"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="mk = bulanIni"
          />
          <UButton
            label="Muat ulang"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="muatUlang()"
          />
        </div>
      </template>

      <p
        v-if="tamuError"
        class="mb-3 rounded-field bg-warning/12 px-3 py-2 text-sm text-warning"
      >
        Angka pax belum lengkap ({{ apiErrorMessage(tamuError) }}). Kotak di bawah hanya menampilkan konteks
        daily worker.
        <UButton
          label="Coba lagi"
          color="neutral"
          variant="ghost"
          size="xs"
          class="ms-2"
          @click="refreshTamu()"
        />
      </p>

      <AppStatGrid
        :loading="statMemuat"
        :count="7"
      >
        <AppStat
          label="Total pax"
          icon="i-lucide-users"
          :value="paxBulan"
          :sub="`${paxAcaraBulan} acara + ${paxRsvBulan} reservasi`"
        />
        <AppStat
          label="Acara"
          icon="i-lucide-mic-vocal"
          :value="paxAcaraBulan"
          sub="pax acara"
        />
        <AppStat
          label="Reservasi meja"
          icon="i-lucide-armchair"
          :value="paxRsvBulan"
          sub="pax reservasi"
        />
        <AppStat
          label="Hari ada tamu"
          icon="i-lucide-calendar-check"
          :value="hariAda"
        />
        <AppStat
          label="DW disetujui"
          icon="i-lucide-user-check"
          :value="stat.setuju"
          tone="success"
        />
        <AppStat
          label="DW menunggu"
          icon="i-lucide-hourglass"
          :value="stat.tunggu"
          :tone="stat.tunggu ? 'warning' : 'gold'"
        />
        <AppStat
          label="Hari tanpa DW"
          icon="i-lucide-calendar-x"
          :value="stat.tanpa"
          :tone="stat.tanpa ? 'warning' : 'gold'"
        />
      </AppStatGrid>

      <div class="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-primary-400" /> Marketing</span>
        <span class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-vip" /> Event</span>
        <span class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-info" /> Reservasi meja</span>
        <span class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-success" /> Disetujui</span>
        <span class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-warning" /> Menunggu</span>
        <span v-if="!peran.hrd && (peran.divisi || []).length">
          · head hanya melihat divisi {{ peran.divisi.map(namaDivisiJadwal).join(', ') }} untuk pengisian.
        </span>
      </div>

      <DwKisi
        :mk="mk"
        :bisa="bisaKlik"
        @pilih="buka"
      >
        <template #hari="{ tgl, luar }">
          <template v-if="!luar">
            <span
              v-if="paxTotal(tgl)"
              class="text-[11px] font-bold text-highlighted num"
            >{{ paxTotal(tgl) }} pax</span>
            <template v-if="acaraHari(tgl).length || nRsv(tgl)">
              <span
                v-for="x in acaraHari(tgl).slice(0, 2)"
                :key="x.sumber + x.id"
                class="truncate border-s-2 ps-1 text-[10px] font-semibold text-highlighted"
                :class="x.sumber === 'event' ? 'border-vip' : 'border-primary-400'"
                :title="x.judul"
              >{{ x.judul }}</span>
              <span
                v-if="acaraHari(tgl).length > 2"
                class="text-[10px] text-muted"
              >+{{ acaraHari(tgl).length - 2 }} acara lagi</span>
              <span
                v-if="barisRsv(tgl)"
                class="truncate border-s-2 border-info ps-1 text-[10px] text-muted num"
              >{{ barisRsv(tgl) }}</span>
            </template>
            <span
              v-else-if="rincian(tgl)"
              class="text-[10px] text-muted num"
            >{{ rincian(tgl) }}</span>
            <template v-if="hariAjuan(tgl).length">
              <span class="text-[10px] font-semibold text-muted">
                <!-- Old dwc line (:5402): the approved count even when it is 0. -->
                <b :class="hariAjuan(tgl).some(a => a.status === 'DISETUJUI') && 'text-success'">{{ hariAjuan(tgl).filter(a => a.status === 'DISETUJUI').length }} DW</b>
                <template v-if="hariAjuan(tgl).filter(a => a.status === 'MENUNGGU').length">
                  · {{ hariAjuan(tgl).filter(a => a.status === 'MENUNGGU').length }} menunggu
                </template>
              </span>
            </template>
            <span
              v-else-if="paxTotal(tgl)"
              class="text-[10px] font-semibold text-warning"
            >belum ada DW</span>
          </template>
        </template>
      </DwKisi>

      <p class="mt-3 text-sm text-muted">
        Klik hari mana pun untuk mengajukan daily worker di hari itu. Angka pax dibaca dari
        <b>Marketing</b>, <b>Event</b>, dan <b>Reservasi</b> — hanya acara yang statusnya sudah pasti jalan, dan
        reservasi yang tidak dibatalkan (<i>no-show</i> dihitung 0 pax). Panduan jumlah DW tetap dihitung dari
        ada-tidaknya acara, bukan dari reservasi.
      </p>
    </AppPanel>

    <DwAjukan
      v-model:open="ajukanOpen"
      :tgl-awal="ajukanTgl"
      @sent="selesai"
    />
  </AppPage>
</template>
