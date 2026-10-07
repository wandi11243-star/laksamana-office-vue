<!--
  Jadwal Shift › Rekap Pegawai — one person's month and hours
  (deploy/jadwal/index.html viewRekap :3179-3305).

  Open to admin, manajemen, Office staff and any head (`bolehRekap`); whoever
  may open it may pick ANYONE in any Divisi (the sums of other divisions were
  already visible on the monthly sheet), but a cell still opens only where
  `bolehUbah` says so. Load alarms use `maksBeruntun` (default 6) and `jedaMin`
  (default 10) from the setting; making them editable is K-10 backlog.
-->
<script setup lang="ts">
import type { SelJadwal } from '~/utils/jadwal'
import {
  DIVISI, JENIS_AJU, LABEL_STATUS_AJU, akhirBulan, awalBulan, bebanKru, bolehRekap, bolehUbah, bulanDari,
  geserBulan, isHeadUser, jabatanSetara, kruDivisi, kunciSel, labelBulanJadwal, namaDivisiJadwal, petaSel,
  rekapDetail, rincianShift, shiftDef,
} from '~/utils/jadwal'
import { useJadwalCells, useJadwalDasar, useJadwalRequests } from '~/composables/useJadwal'
import { STATUS_AJU_IKON, STATUS_AJU_WARNA } from '~/utils/status-jadwal'
import { fTgl, fTglP, hariIni, tambahHari } from '~/utils/format'

definePageMeta({ access: ['jadwal'] })

const { set, kru, peran, kruById, pending, error, refresh: refreshDasar } = useJadwalDasar()
const { data: aju } = useJadwalRequests()

const mk = useState('jadwal-bulan', () => bulanDari(hariIni()))
// One extra day so the rest between the last day and the 1st of next month is not invented.
const dari = computed(() => awalBulan(mk.value))
const sampai = computed(() => tambahHari(akhirBulan(mk.value), 1))
const { data: cells, refresh: refreshSel } = useJadwalCells('jadwal-cells-rekap', dari, sampai)
const peta = computed(() => petaSel(cells.value ?? []))

const kandidat = computed(() => DIVISI.flatMap(d => kruDivisi(peran.value, kru.value, d.k).map(u => ({ u, div: d.k }))))
const uid = useState('jadwal-rekap-uid', () => '')
watch(kandidat, (k) => {
  if (k.length && !k.some(x => x.u.id === uid.value)) uid.value = k[0]!.u.id
}, { immediate: true })

const opsi = computed(() => DIVISI.flatMap((d) => {
  const isi = kandidat.value.filter(x => x.div === d.k)
  return isi.length ? [{ type: 'label' as const, label: d.n }, ...isi.map(x => ({ label: x.u.name, value: x.u.id }))] : []
}))

const u = computed(() => kruById(uid.value))
const div = computed(() => u.value?.divisi ?? '')
const b = computed(() => bebanKru(set.value, peta.value, uid.value, mk.value))
const det = computed(() => rekapDetail(set.value, peta.value, uid.value, mk.value))
const rata = computed(() => (b.value.masuk ? Math.round(b.value.jam / b.value.masuk * 10) / 10 : 0))
const rinci = computed(() => Object.entries(rincianShift(peta.value, uid.value, mk.value))
  .sort(([x], [y]) => (shiftDef(set.value, x).urut || 99) - (shiftDef(set.value, y).urut || 99)))
const jabatan = computed(() => (u.value ? set.value.jabatan[u.value.id] || String(u.value.keterangan || '').trim() : ''))

const alarm = computed(() => {
  const out: string[] = []
  const maks = set.value.maksBeruntun || 6
  const batas = set.value.jedaMin || 10
  if (b.value.maxBeruntun > maks) out.push(`${b.value.maxBeruntun} hari masuk beruntun tanpa libur (batas ${maks})`)
  if (det.value.jedaMin !== null && det.value.jedaMin < batas) out.push(`jeda tersingkat antar shift hanya ${det.value.jedaMin} jam (batas ${batas})`)
  if (b.value.kosong) out.push(`${b.value.kosong} hari belum diatur sama sekali`)
  return out
})

const ajuOrang = computed(() => (aju.value ?? [])
  .filter(x => x.userId === uid.value && !(x.sampai < dari.value || x.dari > akhirBulan(mk.value)))
  .sort((x, y) => x.dari.localeCompare(y.dari)))

const bisa = computed(() => !!div.value && bolehUbah(peran.value, div.value))
const editor = ref(false)
const target = ref<{ uid: string, nama: string, tgl: string, sel: SelJadwal | null } | null>(null)
function buka(tgl: string) {
  if (!u.value) return
  target.value = { uid: u.value.id, nama: u.value.name, tgl, sel: peta.value.get(kunciSel(u.value.id, tgl)) ?? null }
  editor.value = true
}
const muatUlang = () => Promise.all([refreshDasar(), refreshSel()])
const cetak = () => window.print()
</script>

<template>
  <AppPage
    title="Rekap pegawai"
    description="Jadwal sebulan dan jam kerja satu orang."
  >
    <template #actions>
      <UButton
        label="Print / PDF"
        icon="i-lucide-printer"
        color="neutral"
        variant="outline"
        size="sm"
        @click="cetak"
      />
    </template>

    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel v-if="!pending && !bolehRekap(peran)">
      <div class="py-6 text-center">
        <UIcon
          name="i-lucide-lock"
          class="size-8 text-dimmed"
        />
        <p class="mt-2 font-semibold text-highlighted">
          Halaman ini untuk head divisi, staf kantor, manajemen, dan admin modul.
        </p>
        <p class="mt-1 text-sm text-muted">
          Jadwal Anda sendiri ada di <b>Jadwal Saya</b>.
        </p>
      </div>
    </AppPanel>

    <AppPanel v-else-if="!pending && !kandidat.length">
      <p class="py-6 text-center text-muted">
        Belum ada kru yang ditempatkan di divisi shift.
      </p>
    </AppPanel>

    <template v-else-if="u">
      <AppPanel>
        <template #head>
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <USelect
              v-model="uid"
              :items="opsi"
              class="w-60"
            />
            <AppStatus size="sm">
              {{ namaDivisiJadwal(div) }}
            </AppStatus>
            <AppStatus
              v-if="!jabatanSetara(jabatan, div)"
              size="sm"
            >
              {{ jabatan }}
            </AppStatus>
            <AppStatus
              v-if="isHeadUser(peran, u.id, div)"
              size="sm"
              color="gold"
            >
              head divisi
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
            <b class="min-w-36 text-center text-highlighted">{{ labelBulanJadwal(mk) }}</b>
            <UButton
              icon="i-lucide-chevron-right"
              color="neutral"
              variant="outline"
              size="sm"
              aria-label="Bulan berikutnya"
              @click="mk = geserBulan(mk, 1)"
            />
          </div>
        </template>

        <AppStatGrid>
          <AppStat
            label="Hari masuk"
            icon="i-lucide-user-check"
            :value="b.masuk"
            tone="success"
          />
          <AppStat
            label="Off / cuti"
            icon="i-lucide-palmtree"
            :value="b.libur"
            tone="info"
          />
          <AppStat
            label="Total jam"
            icon="i-lucide-clock"
            :value="b.jam || '—'"
          />
          <AppStat
            label="Rata jam/hari"
            icon="i-lucide-gauge"
            :value="rata || '—'"
          />
          <AppStat
            label="Beruntun terpanjang"
            icon="i-lucide-repeat"
            :value="b.maxBeruntun"
            :tone="b.maxBeruntun > (set.maksBeruntun || 6) ? 'error' : 'gold'"
          />
          <AppStat
            label="Masuk akhir pekan"
            icon="i-lucide-calendar-heart"
            :value="det.wknd"
          />
          <AppStat
            label="Jeda tersingkat (jam)"
            icon="i-lucide-timer"
            :value="det.jedaMin === null ? '—' : det.jedaMin"
            :tone="det.jedaMin !== null && det.jedaMin < (set.jedaMin || 10) ? 'error' : 'gold'"
          />
          <AppStat
            label="Belum diatur"
            icon="i-lucide-circle-help"
            :value="b.kosong"
            :tone="b.kosong ? 'warning' : 'gold'"
          />
        </AppStatGrid>

        <div
          v-if="alarm.length"
          class="mb-3 rounded-field bg-warning/12 px-3 py-2 text-sm"
        >
          <b>Perlu dilihat:</b>
          <ul class="ms-5 mt-1 list-disc">
            <li
              v-for="a in alarm"
              :key="a"
            >
              {{ a }}
            </li>
          </ul>
        </div>
        <p
          v-else
          class="mb-3 rounded-field bg-info/10 px-3 py-2 text-sm"
        >
          Tidak ada yang melewati batas hari beruntun maupun jeda antar-shift.
        </p>

        <div
          v-if="rinci.length"
          class="mb-3 flex flex-wrap items-center gap-1.5 text-sm"
        >
          <span class="text-muted">Rincian shift:</span>
          <span
            v-for="[k, n] in rinci"
            :key="k"
            class="inline-flex items-center gap-1"
          >
            <JadwalShiftPil
              :def="shiftDef(set, k)"
              size="sm"
            /><b class="num">{{ n }}×</b>
          </span>
        </div>

        <JadwalKalender
          :set="set"
          :peta="peta"
          :uid="u.id"
          :mk="mk"
          :bisa="bisa"
          judul-klik="klik untuk mengubah"
          @pilih="buka"
        />
        <p class="mt-3 text-sm text-muted">
          {{ bisa ? `Klik tanggal mana pun untuk mengubah shift ${u.name}.` : 'Mode lihat saja — yang menyusun jadwal divisi ini adalah head-nya.' }}
        </p>
      </AppPanel>

      <AppPanel
        v-if="ajuOrang.length"
        title="Pengajuan bulan ini"
        :count="ajuOrang.length"
        flush
      >
        <div class="divide-y divide-default">
          <div
            v-for="x in ajuOrang"
            :key="x.id"
            class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 lg:px-5"
          >
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">
                {{ JENIS_AJU[x.jenis] ?? x.jenis }}
              </p>
              <p class="text-sm text-muted">
                {{ x.dari === x.sampai ? fTgl(x.dari) : `${fTglP(x.dari)} – ${fTgl(x.sampai)}` }}<template v-if="x.alasan">
                  — {{ x.alasan }}
                </template>
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

    <JadwalSelEditor
      v-model:open="editor"
      :set="set"
      :target="target"
      @saved="muatUlang"
    />
  </AppPage>
</template>
