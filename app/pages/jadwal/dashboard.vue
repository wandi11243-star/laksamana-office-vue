<!--
  Jadwal Shift › Dashboard — who is in and who is off on one date
  (deploy/jadwal/index.html viewDashboard :2539-2740).

  Crew with NO cell that day are not "off": they are counted apart as
  "Belum diatur" with a warning, because an empty cell read as a day off makes
  a head think the day is covered when it has a hole (:2462).
  Daily workers get their own panel and are never mixed into "Masuk": the stat
  cards count Office crew, and a DW row in that table would no longer match
  the numbers above it (:2671). DW rows are read through the jadwal module
  itself (G-03: GET /jadwal/dw-schedule).
  Tables page by 10, numbering continues across pages; changing date,
  division or order goes back to page 1 (:2729-2737).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { KruJadwal, SelJadwal } from '~/utils/jadwal'
import {
  DIVISI, DIV_NONSHIFT, HARI_SENIN, akhirBulan, awalBulan, bolehUbah, bulanDari, daftarShift, divisiKuasa,
  idxHari, jamSel, kunciSel, namaDivisiJadwal, petaSel, shiftDef,
} from '~/utils/jadwal'
import { useJadwalCells, useJadwalDasar, useJadwalDw } from '~/composables/useJadwal'
import { fTgl, hariIni, tambahHari } from '~/utils/format'

definePageMeta({ access: ['jadwal'] })

const PER = 10
const { set, kru, peran, pending, error, refresh: refreshDasar } = useJadwalDasar()

const tgl = useState('jadwal-dash-tgl', () => hariIni())
const div = useState<string>('jadwal-dash-div', () => 'ALL')
const urut = ref<'jam' | 'nama' | 'divisi'>('jam')
const hal = ref(1)
const hal2 = ref(1)
watch([tgl, div, urut], () => {
  hal.value = 1
  hal2.value = 1
})

const dari = computed(() => awalBulan(bulanDari(tgl.value)))
const sampai = computed(() => akhirBulan(bulanDari(tgl.value)))
const { data: cells, refresh: refreshSel, status } = useJadwalCells('jadwal-cells-dash', dari, sampai)
const { data: dwRows, error: dwError } = useJadwalDw('jadwal-dw-dash', dari, sampai)

const peta = computed(() => petaSel(cells.value ?? []))
const ini = computed(() => tgl.value === hariIni())

const emps = computed(() => kru.value
  .filter(u => u.active !== false && u.divisi !== DIV_NONSHIFT && (div.value === 'ALL' || u.divisi === div.value))
  .sort((a, b) => namaDivisiJadwal(a.divisi).localeCompare(namaDivisiJadwal(b.divisi)) || String(a.name).localeCompare(String(b.name))))

interface Baris { u: KruJadwal, c: SelJadwal }
const pembagian = computed(() => {
  const masuk: Baris[] = []
  const libur: Baris[] = []
  const belum: KruJadwal[] = []
  for (const u of emps.value) {
    const c = peta.value.get(kunciSel(u.id, tgl.value))
    if (!c) belum.push(u)
    else if (shiftDef(set.value, c.t).libur) libur.push({ u, c })
    else masuk.push({ u, c })
  }
  const cmp = (a: Baris, b: Baris) => {
    if (urut.value === 'nama') return String(a.u.name).localeCompare(String(b.u.name))
    if (urut.value === 'divisi') return namaDivisiJadwal(a.u.divisi).localeCompare(namaDivisiJadwal(b.u.divisi)) || String(a.u.name).localeCompare(String(b.u.name))
    const ja = jamSel(set.value, a.c)
    const jb = jamSel(set.value, b.c)
    return (ja?.m ?? '99:99').localeCompare(jb?.m ?? '99:99') || String(a.u.name).localeCompare(String(b.u.name))
  }
  return { masuk: masuk.sort(cmp), libur: libur.sort(cmp), belum }
})

const maksHal = (n: number) => Math.max(1, Math.ceil(n / PER))
const halMasuk = computed(() => Math.min(hal.value, maksHal(pembagian.value.masuk.length)))
const halLibur = computed(() => Math.min(hal2.value, maksHal(pembagian.value.libur.length)))
function potong(list: Baris[], h: number) {
  return list.slice((h - 1) * PER, h * PER).map((x, i) => ({ ...x, no: (h - 1) * PER + i + 1 }))
}
const barisMasuk = computed(() => potong(pembagian.value.masuk, halMasuk.value))
const barisLibur = computed(() => potong(pembagian.value.libur, halLibur.value))

const rinci = computed(() => daftarShift(set.value)
  .filter(k => !shiftDef(set.value, k).libur)
  .map(k => ({ k, def: shiftDef(set.value, k), n: pembagian.value.masuk.filter(r => r.c.t === k).length }))
  .filter(x => x.n))

const dwHari = computed(() => (dwRows.value ?? [])
  .filter(x => x.tgl === tgl.value && (div.value === 'ALL' || x.divisi === div.value))
  .sort((a, b) => String(a.m || '99:99').localeCompare(String(b.m || '99:99')) || String(a.nama).localeCompare(String(b.nama))))

const kuasa = computed(() => divisiKuasa(peran.value))
const bolehApaPun = computed(() => DIVISI.some(d => bolehUbah(peran.value, d.k)))
const panduan = computed(() => !pending.value && status.value === 'success' && !(cells.value ?? []).length && kru.value.length > 0)
const jabatan = (u: KruJadwal) => set.value.jabatan[u.id] || String(u.keterangan || '').trim() || '—'

const opsiDiv = computed(() => [{ value: 'ALL', label: 'Semua' }, ...DIVISI.map(d => ({ value: d.k, label: d.n, icon: d.icon }))])
const opsiUrut = [{ value: 'jam' as const, label: 'Jam' }, { value: 'nama' as const, label: 'Nama' }, { value: 'divisi' as const, label: 'Divisi' }]

const kolomMasuk: TableColumn<Baris & { no: number }>[] = [
  { accessorKey: 'no', header: '#' },
  { id: 'nama', header: 'Nama' },
  { id: 'divisi', header: 'Divisi' },
  { id: 'shift', header: 'Shift' },
  { id: 'jam', header: 'Jam' },
]
const kolomLibur: TableColumn<Baris & { no: number }>[] = [
  { accessorKey: 'no', header: '#' },
  { id: 'nama', header: 'Nama' },
  { id: 'divisi', header: 'Divisi' },
  { id: 'shift', header: 'Status' },
]

// Cell editor
const editor = ref(false)
const target = ref<{ uid: string, nama: string, tgl: string, sel: SelJadwal | null } | null>(null)
function buka(r: Baris) {
  if (!bolehUbah(peran.value, r.u.divisi)) return
  target.value = { uid: r.u.id, nama: r.u.name, tgl: tgl.value, sel: r.c }
  editor.value = true
}
const muatUlang = () => Promise.all([refreshDasar(), refreshSel()])
</script>

<template>
  <AppPage
    title="Dashboard"
    description="Siapa masuk dan siapa libur hari ini."
  >
    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel
      v-if="panduan"
      title="Tiga langkah untuk mulai"
      icon="i-lucide-compass"
      description="Panduan ini hilang sendiri begitu ada jadwal yang terisi."
    >
      <ol class="grid gap-3 lg:grid-cols-3">
        <li class="rounded-field bg-muted p-3">
          <p class="font-semibold text-highlighted">
            1. Kru datang otomatis dari Office
          </p>
          <p class="mt-1 text-sm text-muted">
            Daftar nama ditarik dari database pegawai Laksamana Office. Kalau ada nama yang belum muncul,
            kolom <b>Tim / Keterangan</b> orang itu di Office belum diisi divisinya.
          </p>
        </li>
        <li class="rounded-field bg-muted p-3">
          <p class="font-semibold text-highlighted">
            2. Susun jadwalnya di Input Mingguan
          </p>
          <p class="mt-1 text-sm text-muted">
            <template v-if="kuasa.length">
              Buka <b>Input Mingguan</b>, pilih minggunya, lalu klik sel mana pun untuk memilih shift.
            </template>
            <template v-else>
              Yang menyusun jadwal adalah head tiap divisi. Kalau Anda memang head, minta admin menunjuk Anda
              lewat <b>Pengaturan → Head Divisi</b>.
            </template>
          </p>
        </li>
        <li class="rounded-field bg-muted p-3">
          <p class="font-semibold text-highlighted">
            3. Off & izin masuk lewat Pengajuan
          </p>
          <p class="mt-1 text-sm text-muted">
            Kru mengajukan sendiri dari <b>Jadwal Saya</b>. Yang disahkan di <b>Pengajuan</b> langsung mengisi sel jadwalnya.
          </p>
        </li>
      </ol>
      <div
        v-if="kuasa.length"
        class="mt-4 flex flex-wrap gap-2"
      >
        <UButton
          label="Mulai susun jadwal"
          trailing-icon="i-lucide-arrow-right"
          to="/jadwal/minggu"
          size="sm"
        />
        <UButton
          label="Atur shift & jam dulu"
          color="neutral"
          variant="ghost"
          to="/jadwal/pengaturan"
          size="sm"
        />
      </div>
    </AppPanel>

    <AppPanel>
      <template #head>
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <h2 class="text-lg font-semibold text-highlighted">
            {{ ini ? 'Hari ini' : HARI_SENIN[idxHari(tgl)] }}, {{ fTgl(tgl).split(', ')[1] }}
          </h2>
          <AppStatus
            v-if="!ini"
            size="sm"
          >
            bukan hari ini
          </AppStatus>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Hari sebelumnya"
            @click="tgl = tambahHari(tgl, -1)"
          />
          <UInput
            v-model="tgl"
            type="date"
            size="sm"
            class="w-40"
          />
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Hari berikutnya"
            @click="tgl = tambahHari(tgl, 1)"
          />
          <UButton
            v-if="!ini"
            label="Kembali ke hari ini"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="tgl = hariIni()"
          />
        </div>
      </template>

      <p
        v-if="dwError"
        class="mb-3 rounded-field bg-warning/12 px-3 py-2 text-sm text-warning"
      >
        Daily worker belum bisa dimuat ({{ apiErrorMessage(dwError) }}). Jadwal kru tetap utuh.
      </p>

      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AppSeg
          v-model="div"
          :options="opsiDiv"
          size="sm"
        />
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="r in rinci"
            :key="r.k"
            class="inline-flex items-center gap-1.5 rounded-full border border-default px-2.5 py-1 text-xs font-semibold"
          >
            <JadwalShiftPil
              :def="r.def"
              size="sm"
            />
            <b class="num">{{ r.n }}</b>
          </span>
        </div>
      </div>

      <AppStatGrid>
        <AppStat
          label="Masuk"
          icon="i-lucide-user-check"
          :value="pembagian.masuk.length"
          tone="success"
        />
        <AppStat
          label="Tidak masuk"
          icon="i-lucide-palmtree"
          :value="pembagian.libur.length"
          tone="info"
        />
        <AppStat
          label="Belum diatur"
          icon="i-lucide-circle-help"
          :value="pembagian.belum.length"
          :tone="pembagian.belum.length ? 'warning' : 'gold'"
        />
        <AppStat
          label="Total kru"
          icon="i-lucide-users"
          :value="emps.length"
        />
        <AppStat
          label="Daily worker"
          icon="i-lucide-user-plus"
          :value="dwHari.length"
          tone="vip"
        />
      </AppStatGrid>

      <div
        v-if="pembagian.belum.length"
        class="flex flex-wrap items-center gap-2 rounded-field bg-warning/12 px-3 py-2 text-sm"
      >
        <span><b>{{ pembagian.belum.length }} kru belum dijadwalkan</b> pada tanggal ini. Belum dijadwalkan bukan berarti libur.</span>
        <UButton
          v-if="kuasa.length"
          label="Isi lewat Input Mingguan"
          color="neutral"
          variant="ghost"
          size="xs"
          to="/jadwal/minggu"
        />
      </div>
    </AppPanel>

    <AppPanel
      title="Masuk"
      icon="i-lucide-circle-check"
      :count="pembagian.masuk.length"
      flush
    >
      <template
        v-if="pembagian.masuk.length > 1"
        #actions
      >
        <AppSeg
          v-model="urut"
          :options="opsiUrut"
          size="sm"
        />
      </template>
      <JadwalDashTabel
        :rows="barisMasuk"
        :columns="kolomMasuk"
        :set="set"
        :peran="peran"
        :tgl="tgl"
        :jabatan="jabatan"
        :loading="status === 'pending'"
        empty="Tidak ada yang masuk pada tanggal ini."
        @pilih="buka"
      />
      <JadwalPager
        v-model="hal"
        :total="pembagian.masuk.length"
        :per="PER"
        satuan="orang"
      />
    </AppPanel>

    <AppPanel
      v-if="dwHari.length"
      title="Daily worker"
      icon="i-lucide-user-plus"
      :count="dwHari.length"
      description="Disetujui HR di modul Daily Worker."
      flush
    >
      <div class="divide-y divide-default">
        <div
          v-for="(x, i) in dwHari"
          :key="x.id"
          class="flex items-center justify-between gap-3 px-4 py-3 lg:px-5"
        >
          <div class="min-w-0">
            <p class="truncate font-semibold text-highlighted">
              <span class="me-2 text-muted num">{{ i + 1 }}</span>{{ x.nama }}
            </p>
            <p class="text-sm text-muted">
              Daily worker · {{ namaDivisiJadwal(x.divisi) }} · {{ x.posisi || '—' }}
            </p>
          </div>
          <span class="shrink-0 text-sm text-muted num">{{ x.m && x.s ? `${x.m} – ${x.s}` : '—' }}</span>
        </div>
      </div>
    </AppPanel>

    <AppPanel
      title="Tidak masuk"
      icon="i-lucide-palmtree"
      :count="pembagian.libur.length"
      flush
    >
      <JadwalDashTabel
        :rows="barisLibur"
        :columns="kolomLibur"
        :set="set"
        :peran="peran"
        :tgl="tgl"
        :jabatan="jabatan"
        :loading="status === 'pending'"
        empty="Tidak ada yang libur, izin, atau cuti pada tanggal ini."
        @pilih="buka"
      />
      <JadwalPager
        v-model="hal2"
        :total="pembagian.libur.length"
        :per="PER"
        satuan="orang"
      />
      <p
        v-if="bolehApaPun"
        class="px-4 pb-4 text-sm text-muted lg:px-5"
      >
        Klik baris mana pun untuk mengubah shift orang itu pada tanggal ini.
      </p>
    </AppPanel>

    <JadwalSelEditor
      v-model:open="editor"
      :set="set"
      :target="target"
      @saved="muatUlang"
    />
  </AppPage>
</template>
