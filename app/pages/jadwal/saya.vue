<!--
  Jadwal Shift › Jadwal Saya — my month and my requests (deploy/jadwal/index.html
  viewSaya :4370-4464).

  Every date opens the request form for that date; the hint sits ABOVE the
  calendar, where the people who do not know it yet will read it (:4428). A dot
  marks a date with a request still waiting, so nobody files a second one for
  the same day. An empty cell is "belum diatur", never a day off.
  `?ajukan=1` (the gold "+" in the top bar) opens the form straight away.
-->
<script setup lang="ts">
import type { PengajuanJadwal } from '~/composables/useJadwal'
import {
  JENIS_AJU, LABEL_STATUS_AJU, ajuBerjalan, akhirBulan, awalBulan, bulanDari, daftarShift, durasiJam,
  geserBulan, jamSel, kunciSel, namaDivisiJadwal, petaSel, shiftDef,
} from '~/utils/jadwal'
import { useJadwalCells, useJadwalDasar, useJadwalRequests } from '~/composables/useJadwal'
import { STATUS_AJU_IKON, STATUS_AJU_WARNA } from '~/utils/status-jadwal'
import { BULAN, fTgl, fTglP, hariIni, tambahHari } from '~/utils/format'
import { JADWAL_BACA_SAJA } from '~/utils/hris'

definePageMeta({ access: ['jadwal'] })

const route = useRoute()
const router = useRouter()
const { set, kru, peran, kruById, pending, error } = useJadwalDasar()
const { data: requests, refresh: refreshAju } = useJadwalRequests()

const mk = useState('jadwal-bulan', () => bulanDari(hariIni()))
const dari = computed(() => awalBulan(mk.value))
const sampai = computed(() => akhirBulan(mk.value))
const { data: cells, refresh: refreshSel } = useJadwalCells('jadwal-cells-saya', dari, sampai)
const peta = computed(() => petaSel(cells.value ?? []))

const aku = computed(() => kruById(peran.value.id))
const labelBulan = computed(() => {
  const [y, m] = mk.value.split('-')
  return `${BULAN[Number(m) - 1]} ${y}`
})

const ajuSaya = computed(() => (requests.value ?? []).filter(a => a.userId === peran.value.id))
const menunggu = computed(() => ajuSaya.value.filter(ajuBerjalan))

/** Dates already asked for; a waiting request wins over a decided one (:4389). */
const ajuPeta = computed(() => {
  const out: Record<string, string> = {}
  for (const x of ajuSaya.value) {
    if (x.status === 'DITOLAK') continue
    for (let d = x.dari; d <= x.sampai; d = tambahHari(d, 1)) {
      if (out[d] !== 'MENUNGGU') out[d] = x.status
    }
  }
  return out
})

const hitung = computed(() => {
  let masuk = 0
  let libur = 0
  let jam = 0
  for (let d = dari.value; d <= sampai.value; d = tambahHari(d, 1)) {
    const c = peta.value.get(kunciSel(peran.value.id, d))
    if (!c) continue
    if (shiftDef(set.value, c.t).libur) {
      libur++
      continue
    }
    masuk++
    const j = jamSel(set.value, c)
    if (j) jam += durasiJam(j.m, j.s)
  }
  return { masuk, libur, jam: Math.round(jam * 10) / 10 }
})

const legenda = computed(() => daftarShift(set.value).map(k => ({ k, def: shiftDef(set.value, k) })))

const form = ref(false)
const tglForm = ref('')
function ajukan(d?: string) {
  if (JADWAL_BACA_SAJA) return
  tglForm.value = d ?? ''
  form.value = true
}
onMounted(() => {
  if (route.query.ajukan) {
    ajukan()
    router.replace({ query: {} })
  }
})
watch(() => route.query.ajukan, (v) => {
  if (v) {
    ajukan()
    router.replace({ query: {} })
  }
})

const rentang = (x: PengajuanJadwal) => (x.dari === x.sampai ? fTgl(x.dari) : `${fTglP(x.dari)} – ${fTgl(x.sampai)}`)
const sesudahKirim = () => Promise.all([refreshAju(), refreshSel()])
</script>

<template>
  <AppPage
    title="Jadwal saya"
    description="Shift saya bulan ini."
  >
    <template #actions>
      <UButton
        v-if="aku && !JADWAL_BACA_SAJA"
        label="Ajukan off / izin"
        icon="i-lucide-plus"
        @click="ajukan()"
      />
    </template>

    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel v-if="!pending && !aku">
      <div class="py-6 text-center">
        <UIcon
          name="i-lucide-user-x"
          class="size-8 text-dimmed"
        />
        <p class="mt-2 font-semibold text-highlighted">
          Akun Anda belum ketemu di daftar kru Office.
        </p>
        <p class="mt-1 text-sm text-muted">
          Jadwal pribadi baru bisa ditampilkan setelah akun Anda terdaftar sebagai pegawai di Laksamana Office.
        </p>
      </div>
    </AppPanel>

    <template v-else-if="aku">
      <AppPanel>
        <template #head>
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <h2 class="text-lg font-semibold text-highlighted">
              Jadwal saya
            </h2>
            <AppStatus size="sm">
              {{ aku.name }} · {{ namaDivisiJadwal(aku.divisi) }}
            </AppStatus>
          </div>
          <div class="flex items-center gap-1.5">
            <UButton
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="outline"
              size="sm"
              aria-label="Bulan sebelumnya"
              @click="mk = geserBulan(mk, -1)"
            />
            <b class="min-w-36 text-center text-highlighted">{{ labelBulan }}</b>
            <UButton
              icon="i-lucide-chevron-right"
              color="neutral"
              variant="outline"
              size="sm"
              aria-label="Bulan berikutnya"
              @click="mk = geserBulan(mk, 1)"
            />
            <UButton
              v-if="mk !== bulanDari(hariIni())"
              label="Bulan ini"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="mk = bulanDari(hariIni())"
            />
          </div>
        </template>

        <AppStatGrid>
          <AppStat
            label="Hari masuk"
            icon="i-lucide-user-check"
            :value="hitung.masuk"
            tone="success"
          />
          <AppStat
            label="Off / cuti"
            icon="i-lucide-palmtree"
            :value="hitung.libur"
            tone="info"
          />
          <AppStat
            label="Total jam"
            icon="i-lucide-clock"
            :value="hitung.jam"
          />
          <AppStat
            label="Pengajuan menunggu"
            icon="i-lucide-hourglass"
            :value="menunggu.length"
            :tone="menunggu.length ? 'warning' : 'gold'"
          />
        </AppStatGrid>

        <p
          v-if="!JADWAL_BACA_SAJA"
          class="mb-3 flex items-start gap-2 rounded-field bg-info/10 px-3 py-2 text-sm"
        >
          <UIcon
            name="i-lucide-pointer"
            class="mt-0.5 size-4 shrink-0 text-info"
          />
          <span><b>Klik tanggal mana pun</b> di kalender untuk mengajukan <b>off</b>, <b>izin</b>, atau
            <b>tukar shift</b> pada hari itu — atau pakai tombol <b>Ajukan off / izin</b> di atas.</span>
        </p>

        <JadwalKalender
          :set="set"
          :peta="peta"
          :uid="peran.id"
          :mk="mk"
          :bisa="!JADWAL_BACA_SAJA"
          judul-klik="klik untuk mengajukan off, izin, atau tukar shift"
          :tanda="ajuPeta"
          @pilih="ajukan"
        />

        <div class="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap gap-1.5">
            <JadwalShiftPil
              v-for="l in legenda"
              :key="l.k"
              :def="l.def"
              size="sm"
            />
          </div>
          <span class="text-sm text-muted">Kotak abu = belum diatur head, bukan libur.</span>
        </div>
      </AppPanel>

      <AppPanel
        v-if="menunggu.length"
        title="Pengajuan menunggu"
        :count="menunggu.length"
        flush
      >
        <template #actions>
          <UButton
            label="Lihat semua"
            color="neutral"
            variant="ghost"
            size="sm"
            to="/jadwal/pengajuan"
          />
        </template>
        <div class="divide-y divide-default">
          <div
            v-for="x in menunggu"
            :key="x.id"
            class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 lg:px-5"
          >
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">
                {{ JENIS_AJU[x.jenis] ?? x.jenis }}
              </p>
              <p class="text-sm text-muted">
                {{ rentang(x) }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <JadwalShiftPil
                v-if="x.shift && set.shifts[x.shift]"
                :def="shiftDef(set, x.shift)"
                size="sm"
              />
              <AppStatus
                size="sm"
                :color="STATUS_AJU_WARNA[x.status]"
                :icon="STATUS_AJU_IKON[x.status]"
              >
                {{ LABEL_STATUS_AJU[x.status] ?? x.status }}
              </AppStatus>
            </div>
          </div>
        </div>
      </AppPanel>
    </template>

    <JadwalAjukan
      v-model:open="form"
      :set="set"
      :kru="kru"
      :peran="peran"
      :tgl-awal="tglForm"
      @sent="sesudahKirim"
    />
  </AppPage>
</template>
