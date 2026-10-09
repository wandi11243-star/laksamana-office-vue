<!--
  Jadwal Shift › Input Mingguan — compose one week (deploy/jadwal/index.html
  viewMinggu :3324-3463).

  A head sees the Divisi they hold, Office/admin see all four, a crew member
  without a head role sees only their own — and nobody gets a clickable cell
  they may not write (`bolehUbah` per Divisi). The bulk tools work on ONE
  Divisi: in "Semua" they are hidden rather than left to silently work on an
  empty list (:3410). Every bulk write lists the cells it overwrites first.
  PNG export is not built (it needs a drawing library; see #11); Excel is CSV
  per K-05.
-->
<script setup lang="ts">
import type { GrupLembar } from '~/components/JadwalLembar.vue'
import type { KruJadwal, SelJadwal } from '~/utils/jadwal'
import {
  DIVISI, adaHead, bolehUbah, daftarShift, divisiLihat, kruDivisi, kunciSel, namaDivisiJadwal, petaSel,
  rentangMinggu, seninDari, shiftDef, teksWA, tujuhHari,
} from '~/utils/jadwal'
import { useJadwalCells, useJadwalDasar, useJadwalDw, useJadwalMassal, useJadwalRequests } from '~/composables/useJadwal'
import { hariIni, tambahHari } from '~/utils/format'

definePageMeta({ access: ['jadwal'] })

const { me, set, kru, peran, divisiDari, kruById, error, refresh: refreshDasar } = useJadwalDasar()
const { data: aju } = useJadwalRequests()

const senin = useState('jadwal-minggu', () => seninDari(hariIni()))
const div = useState<string>('jadwal-minggu-div', () => 'ALL')
const hari = computed(() => tujuhHari(senin.value))

const dari = computed(() => tambahHari(senin.value, -7))
const sampai = computed(() => tambahHari(senin.value, 6))
const { data: cells, refresh: refreshSel } = useJadwalCells('jadwal-cells-minggu', dari, sampai)
const { data: dwRows, error: dwError } = useJadwalDw('jadwal-dw-minggu', senin, sampai)
const peta = computed(() => petaSel(cells.value ?? []))

const lihat = computed(() => divisiLihat(peran.value, divisiDari(me.value?.id ?? '') ?? ''))
watch([lihat, div], () => {
  if (div.value !== 'ALL' && lihat.value.length && !lihat.value.includes(div.value)) div.value = lihat.value[0]!
}, { immediate: true })

const semuaDiv = computed(() => div.value === 'ALL')
const daftarDiv = computed(() => (semuaDiv.value ? lihat.value : [div.value]))
const grup = computed<GrupLembar[]>(() => daftarDiv.value.map(dv => ({
  div: dv,
  kru: kruDivisi(peran.value, kru.value, dv),
  bisa: bolehUbah(peran.value, dv),
  heads: set.value.heads[dv] ?? [],
})))
const kruTampil = computed(() => grup.value.flatMap(g => g.kru))
const kruDiv = computed(() => (semuaDiv.value ? [] : kruDivisi(peran.value, kru.value, div.value)))
const bisaUbahDiv = computed(() => !semuaDiv.value && bolehUbah(peran.value, div.value))
const belum = computed(() => kruTampil.value.reduce((n, u) => n + hari.value.filter(d => !peta.value.get(kunciSel(u.id, d))).length, 0))
const minggIni = computed(() => senin.value === seninDari(hariIni()))

const opsiDiv = computed(() => [
  { value: 'ALL', label: 'Semua' },
  ...DIVISI.filter(d => lihat.value.includes(d.k)).map(d => ({ value: d.k as string, label: d.n, icon: d.icon })),
])
const legenda = computed(() => daftarShift(set.value).map(k => ({ k, def: shiftDef(set.value, k) })))
const jabatan = (u: KruJadwal) => set.value.jabatan[u.id] || String(u.keterangan || '').trim() || '—'

const muatUlang = () => Promise.all([refreshDasar(), refreshSel()])
const nama = (uid: string) => kruById(uid)?.name ?? '—'
const massal = useJadwalMassal({ peta, nama, aju: computed(() => aju.value ?? []), sesudah: muatUlang })
const toast = useToast()

// ---- cell editor + one row
const editor = ref(false)
const target = ref<{ uid: string, nama: string, tgl: string, sel: SelJadwal | null } | null>(null)
function buka(u: KruJadwal, tgl: string) {
  target.value = { uid: u.id, nama: u.name, tgl, sel: peta.value.get(kunciSel(u.id, tgl)) ?? null }
  editor.value = true
}
const baris = ref(false)
const barisTarget = ref<{ uid: string, nama: string } | null>(null)
function isiBaris(u: KruJadwal) {
  barisTarget.value = { uid: u.id, nama: u.name }
  baris.value = true
}

// ---- bulk tools (one Divisi)
function salinMingguLalu() {
  const lalu = tambahHari(senin.value, -7)
  const rows: SelJadwal[] = []
  for (const u of kruDiv.value) {
    for (let i = 0; i < 7; i++) {
      const c = peta.value.get(kunciSel(u.id, tambahHari(lalu, i)))
      if (c) rows.push({ ...c, d: tambahHari(senin.value, i) })
    }
  }
  if (!rows.length) {
    toast.add({ title: `Minggu lalu (${rentangMinggu(lalu)}) masih kosong`, color: 'info' })
    return
  }
  massal.minta({
    rows,
    judul: 'Salin minggu lalu?',
    judulBentrok: n => `Salin minggu lalu — ${n} sel akan tertimpa`,
    pesan: `${rows.length} sel dari ${rentangMinggu(lalu)} akan disalin ke ${rentangMinggu(senin.value)}.`,
    ya: 'Ya, salin',
    yaBentrok: n => `Ya, timpa ${n} sel`,
    bolehLewati: true,
    selaluTanya: true,
    selesai: `Sel disalin dari ${rentangMinggu(lalu)}`,
  })
}
const isiOpen = ref(false)
function sesudahIsi(rows: SelJadwal[], label: string) {
  massal.minta({
    rows,
    judul: '',
    judulBentrok: n => `Timpa ${n} sel yang sudah terisi?`,
    pesan: `${rows.length} sel akan diisi ${label}.`,
    ya: '',
    yaBentrok: n => `Ya, timpa ${n} sel`,
    selesai: `${rows.length} sel diisi ${label}`,
  })
}
const imporOpen = ref(false)
function sesudahImpor(rows: SelJadwal[]) {
  massal.minta({
    rows,
    judul: '',
    judulBentrok: n => `Timpa ${n} sel yang sudah terisi?`,
    pesan: `${rows.length} sel dari berkas akan ditulis.`,
    ya: '',
    yaBentrok: n => `Ya, timpa ${n} sel`,
    selesai: `${rows.length} sel diimpor dari Excel`,
  })
}
function kosongkanMinggu() {
  const clear = kruDiv.value.flatMap(u => hari.value.filter(d => peta.value.get(kunciSel(u.id, d))).map(d => ({ u: u.id, d })))
  if (!clear.length) {
    toast.add({ title: 'Minggu ini sudah kosong', color: 'info' })
    return
  }
  massal.minta({
    clear,
    judul: 'Kosongkan minggu ini?',
    pesan: `${clear.length} sel divisi ${namaDivisiJadwal(div.value)} pada ${rentangMinggu(senin.value)} akan dihapus. Tidak bisa dibatalkan. Menghapus sel hasil pengajuan tidak membatalkan pengajuannya — orangnya tetap mengira hari itu off.`,
    ya: 'Ya, kosongkan',
    selaluTanya: true,
    selesai: `Minggu dikosongkan — ${clear.length} sel dihapus`,
  })
}

// ---- share
const eksporOpen = ref(false)
const waOpen = ref(false)
const waTeks = computed(() => teksWA(set.value, peta.value, kruDiv.value, div.value, hari.value, rentangMinggu(senin.value), true, dwRows.value ?? []))
const cetak = () => window.print()
</script>

<template>
  <AppPage
    title="Input mingguan"
    description="Susun jadwal satu minggu."
  >
    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel v-if="!lihat.length">
      <div class="py-6 text-center">
        <UIcon
          name="i-lucide-lock"
          class="size-8 text-dimmed"
        />
        <p class="mt-2 font-semibold text-highlighted">
          Halaman ini untuk head divisi.
        </p>
        <p class="mt-1 text-sm text-muted">
          Kalau Anda memang head, minta admin modul mencentang nama Anda di <b>Pengaturan → Head Divisi</b> lalu menekan
          <b>Simpan</b> — centang yang belum disimpan tidak berlaku.
        </p>
      </div>
    </AppPanel>

    <AppPanel
      v-else
      flush
    >
      <template #head>
        <AppSeg
          v-model="div"
          :options="opsiDiv"
          size="sm"
        />
        <div class="flex items-center gap-1.5">
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Minggu sebelumnya"
            @click="senin = tambahHari(senin, -7)"
          />
          <b class="min-w-44 text-center text-highlighted">{{ rentangMinggu(senin) }}</b>
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Minggu berikutnya"
            @click="senin = tambahHari(senin, 7)"
          />
          <UButton
            v-if="!minggIni"
            label="Minggu ini"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="senin = seninDari(hariIni())"
          />
        </div>
      </template>

      <div class="space-y-3 p-4 lg:p-5">
        <p
          v-if="dwError"
          class="rounded-field bg-warning/12 px-3 py-2 text-sm text-warning"
        >
          Daftar daily worker belum bisa diambil ({{ apiErrorMessage(dwError) }}). Lembar kru tetap benar.
        </p>
        <p
          v-if="!adaHead(peran)"
          class="rounded-field bg-warning/12 px-3 py-2 text-sm"
        >
          <b>Belum ada head divisi yang ditunjuk.</b> Selama daftarnya kosong, semua pemegang akses modul ini bisa
          menyusun jadwal divisi mana pun. Tunjuk head-nya di <b>Pengaturan → Head Divisi</b>.
        </p>
        <p
          class="rounded-field px-3 py-2 text-sm"
          :class="belum ? 'bg-warning/12' : 'bg-info/10'"
        >
          <template v-if="belum">
            <b>{{ belum }} sel</b> masih kosong di minggu ini<template v-if="semuaDiv">
              (seluruh divisi Anda)
            </template>.
          </template>
          <template v-else>
            Minggu ini sudah terisi penuh.
          </template>
        </p>

        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap gap-1.5">
            <JadwalShiftPil
              v-for="l in legenda"
              :key="l.k"
              :def="l.def"
              size="sm"
            />
          </div>
          <div class="flex flex-wrap gap-1.5 print:hidden">
            <span
              v-if="semuaDiv"
              class="text-sm text-muted"
            >Salin / isi massal & ekspor bekerja per divisi — pilih tab divisinya.</span>
            <template v-else-if="bisaUbahDiv">
              <UButton
                label="Salin minggu lalu"
                icon="i-lucide-copy"
                color="neutral"
                variant="outline"
                size="sm"
                @click="salinMingguLalu"
              />
              <UButton
                label="Isi jadwal"
                icon="i-lucide-zap"
                color="neutral"
                variant="outline"
                size="sm"
                @click="isiOpen = true"
              />
              <UButton
                label="Impor dari Excel"
                icon="i-lucide-file-up"
                color="neutral"
                variant="outline"
                size="sm"
                @click="imporOpen = true"
              />
              <UButton
                label="Kosongkan"
                icon="i-lucide-eraser"
                color="neutral"
                variant="outline"
                size="sm"
                @click="kosongkanMinggu"
              />
            </template>
            <span
              v-else
              class="text-sm text-muted"
            >Mode lihat saja — yang menyusun jadwal divisi ini adalah head-nya.</span>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-1.5 print:hidden">
          <span class="me-auto text-sm text-muted">Bagikan minggu ini:</span>
          <UButton
            label="Excel seminggu"
            icon="i-lucide-file-spreadsheet"
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="!kruTampil.length"
            @click="eksporOpen = true"
          />
          <UButton
            v-if="!semuaDiv"
            label="Teks WA"
            icon="i-lucide-message-circle"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="waOpen = true"
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

      <JadwalLembar
        :set="set"
        :peta="peta"
        :hari="hari"
        :grup="grup"
        :judul-divisi="semuaDiv"
        :dw="dwRows ?? []"
        info-label="Tgl"
        info-sub="Hari"
        @pilih="buka"
      >
        <template #info="{ u, div: dv }">
          <UButton
            v-if="bolehUbah(peran, dv)"
            label="Input mingguan"
            color="neutral"
            variant="ghost"
            size="xs"
            title="Isi seluruh minggu untuk kru ini — satu klik satu hari"
            @click="isiBaris(u)"
          />
          <span
            v-else
            class="text-[11px] text-muted"
          >{{ jabatan(u) }}</span>
        </template>
      </JadwalLembar>
      <p class="px-4 py-3 text-sm text-muted lg:px-5">
        Klik sel untuk memilih shift. Jam bawaan tiap shift bisa ditimpa per sel — dipakai untuk jadwal khusus, mis. shift 9 jam.
      </p>
    </AppPanel>

    <JadwalSelEditor
      v-model:open="editor"
      :set="set"
      :target="target"
      @saved="muatUlang"
    />
    <JadwalIsiBaris
      v-model:open="baris"
      :set="set"
      :peta="peta"
      :target="barisTarget"
      :senin="senin"
      @simpan="(r, c, p) => massal.tulis(r, c, p)"
    />
    <JadwalIsiJadwal
      v-model:open="isiOpen"
      :set="set"
      :peta="peta"
      :kru="kruDiv"
      :div="div"
      :senin="senin"
      @pilih="sesudahIsi"
    />
    <JadwalImpor
      v-model:open="imporOpen"
      :set="set"
      :peta="peta"
      :kru="kruDiv"
      :div="div"
      :acuan="senin"
      @simpan="sesudahImpor"
    />
    <JadwalTimpa
      v-model:open="massal.open.value"
      :set="set"
      :title="massal.judul.value"
      :bentrok="massal.bentrok.value"
      :dari-aju="massal.dariAju.value"
      :ya="massal.ya.value"
      :alt="massal.alt.value"
      :sibuk="massal.sibuk.value"
      @ya="massal.jalan"
      @alt="massal.jalanAman"
    >
      <p>{{ massal.pesan.value }}</p>
    </JadwalTimpa>
    <JadwalEkspor
      v-model:open="eksporOpen"
      :set="set"
      :peta="peta"
      :kru="kruTampil"
      :hari="hari"
      judul="jadwal minggu ini"
      :nama-berkas="`jadwal-${semuaDiv ? 'semua' : div}-${senin}.csv`"
    />
    <JadwalTeksWA
      v-model:open="waOpen"
      :teks="waTeks"
    />
  </AppPage>
</template>
