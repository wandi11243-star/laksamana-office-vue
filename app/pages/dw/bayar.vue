<!--
  Pembayaran mingguan (deploy/dw/index.html viewBayar :7232-7422). Two views
  over the same rows: Per orang (to check with the person) and Per tujuan (to
  actually transfer). Money is computed client-side from the settings tariff
  plus the long-shift bonus, and only non-ALFA shifts pay (F.14/F.20); the
  tick marks live in the setting blob so they survive a reload.

  Non-HRD pages (opened through the Hak Akses matrix) never see rupiah: the
  head does not see money (F.12), and transfer ticks are HRD-only anyway
  (:6918). Snapshotting past weeks is backlog (K-10) — the note says so.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BarisBayarDw, GrupBayarDw } from '~/utils/dw'
import { BAYAR, bayarJenisSah, bayarLunasInfoDw, bayarSudahDw, bolehBukaDw, bolehLihatUangDw, divPekerja, grupBayarDw, kunciBayarDw, labelTujuanDw, posPekerja, rekapBayarDw, teksTransferDw } from '~/utils/dw'
import { tandaiBayarDw, useDwBayarMinggu, useDwDasar } from '~/composables/useDw'
import { seninDari, namaDivisiJadwal } from '~/utils/jadwal'
import { fTglP, hariIni, tambahHari } from '~/utils/format'

definePageMeta({ access: ['dw'] })

const toast = useToast()
const { set, ajuan, pekerja, peran, pending, error, refresh } = useDwDasar()
const minggu = useDwBayarMinggu()

/** Matrix-aware gate (T-10); default is HRD only. */
const bolehHalaman = computed(() => bolehBukaDw(set.value, peran.value, 'bayar'))

const senin = computed(() => minggu.value || seninDari(hariIni()))
const rentang = computed(() => `${fTglP(senin.value)} – ${fTglP(tambahHari(senin.value, 6))}`)
const semua = computed(() => rekapBayarDw(set.value, pekerja.value, ajuan.value, senin.value))

const filter = ref('ALL')
const baris = computed(() => (filter.value === 'ALL' ? semua.value : semua.value.filter(x => bayarJenisSah(x.p?.bayarJenis) === filter.value)))
const tampilan = ref<'tujuan' | 'orang'>('tujuan')

const totalRp = computed(() => baris.value.reduce((n, x) => n + x.total, 0))
const totalKali = computed(() => baris.value.reduce((n, x) => n + x.kali, 0))
const totalAlfa = computed(() => baris.value.reduce((n, x) => n + x.alfa, 0))
const totalBelum = computed(() => baris.value.reduce((n, x) => n + x.belum, 0))
const grup = computed<GrupBayarDw[]>(() => grupBayarDw(baris.value))
const lunas = computed(() => grup.value.filter(g => bayarSudahDw(set.value, senin.value, g.kunci)))
const sisaRp = computed(() => grup.value.filter(g => !bayarSudahDw(set.value, senin.value, g.kunci)).reduce((n, g) => n + g.total, 0))
const belumHp = computed(() => baris.value.filter(x => !x.p?.bayarNomor))
const nol = computed(() => baris.value.filter(x => x.total <= 0))
const bolehUang = computed(() => bolehLihatUangDw(peran.value))

// Skeleton only for the first load: week tabs reuse the same overview slice, so later loads keep the old cards.
const statMemuat = computed(() => pending.value && !ajuan.value.length && !pekerja.value.length)

const opsiFilter = computed(() => [
  { value: 'ALL', label: `Semua ${semua.value.length}` },
  ...Object.keys(BAYAR).map(k => ({ value: k, label: `${BAYAR[k]!.n} ${semua.value.filter(x => bayarJenisSah(x.p?.bayarJenis) === k).length}` })),
])

const kolomGrup: TableColumn<GrupBayarDw>[] = [
  { id: 'no', header: 'No.' },
  { id: 'tujuan', header: 'Tujuan transfer' },
  { id: 'untuk', header: 'Untuk' },
  { id: 'shift', header: () => h('span', { class: 'block text-end' }, 'Shift') },
  { id: 'jumlah', header: () => h('span', { class: 'block text-end' }, 'Jumlah') },
  { id: 'tandai', header: () => h('span', { class: 'block text-end' }, 'Transfer') },
]
const kolomOrang: TableColumn<BarisBayarDw>[] = [
  { id: 'no', header: 'No.' },
  { id: 'nama', header: 'Daily worker' },
  { id: 'divisi', header: 'Divisi / Posisi' },
  { id: 'shift', header: () => h('span', { class: 'block text-end' }, 'Shift') },
  { id: 'jam', header: () => h('span', { class: 'block text-end' }, 'Jam') },
  { id: 'tujuan', header: 'Tujuan transfer' },
  { id: 'jumlah', header: () => h('span', { class: 'block text-end' }, 'Jumlah') },
  { id: 'tandai', header: () => h('span', { class: 'block text-end' }, 'Transfer') },
]

function geser(n: number) {
  minggu.value = tambahHari(senin.value, n * 7)
}
function mingguIni() {
  minggu.value = ''
}

async function tandai(g: GrupBayarDw) {
  await pindahTanda(g.kunci, !bayarSudahDw(set.value, senin.value, g.kunci))
}
async function pindahTanda(kunci: string, nyala: boolean) {
  if (!peran.value.hrd) return toast.add({ title: 'Hanya yang berhak yang bisa menandai pembayaran', color: 'error' })
  try {
    await tandaiBayarDw(senin.value, kunci, nyala)
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Tanda pembayaran belum tersimpan: ${apiErrorMessage(e)}`, color: 'error' })
  }
}
function info(kunci: string) {
  return bayarLunasInfoDw(set.value, senin.value, kunci)
}

async function salin() {
  const teks = teksTransferDw(set.value, pekerja.value, ajuan.value, senin.value)
  if (!teks) return toast.add({ title: 'Tidak ada yang perlu ditransfer minggu ini', color: 'info' })
  try {
    await navigator.clipboard.writeText(teks)
    toast.add({ title: 'Daftar transfer disalin', color: 'success' })
  }
  catch {
    toast.add({ title: 'Gagal menyalin — izinkan akses papan klip', color: 'error' })
  }
}
function cetak() {
  window.print()
}
</script>

<template>
  <AppPage
    title="Pembayaran"
    description="Rekap mingguan & daftar transfer."
  >
    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel
      v-if="!pending && !bolehHalaman"
      title="Halaman ini untuk HRD"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Daftar transfer dan angka upah hanya untuk yang berhak memutuskan pembayaran. Minta admin modul menambahkan
        Anda di <b>Pengaturan → Hak Akses</b>.
      </p>
    </AppPanel>

    <AppPanel v-else>
      <template #head>
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <h2 class="text-lg font-semibold text-highlighted">
            {{ rentang }}
          </h2>
          <AppStatus
            v-if="senin !== seninDari(hariIni())"
            size="sm"
          >
            bukan minggu ini
          </AppStatus>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Minggu sebelumnya"
            @click="geser(-1)"
          />
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Minggu berikutnya"
            @click="geser(1)"
          />
          <UButton
            v-if="senin !== seninDari(hariIni())"
            label="Minggu ini"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="mingguIni"
          />
        </div>
      </template>

      <AppStatGrid
        :loading="statMemuat"
        :count="4"
      >
        <AppStat
          label="Daily worker"
          icon="i-lucide-users"
          :value="baris.length"
        />
        <AppStat
          label="Total shift"
          icon="i-lucide-calendar-check"
          :value="totalKali"
        />
        <AppStat
          label="Transfer terkirim"
          icon="i-lucide-send"
          :value="`${lunas.length} / ${grup.length}`"
          :tone="grup.length && lunas.length >= grup.length ? 'success' : 'warning'"
        />
        <AppStat
          v-if="bolehUang"
          label="Total dibayar"
          icon="i-lucide-banknote"
          :value="rupiah(totalRp)"
          tone="gold"
        />
      </AppStatGrid>

      <p
        v-if="bolehUang && grup.length && lunas.length < grup.length"
        class="mb-3 rounded-field bg-warning/12 px-3 py-2 text-sm"
      >
        <b>{{ grup.length - lunas.length }} transfer belum dikirim</b> · sisa <b>{{ rupiah(sisaRp) }}</b>. Tekan
        <b>Tandai</b> di kolom Transfer tiap kali satu selesai — tandanya tersimpan di server, jadi tetap ada kalau
        halaman ditutup.
      </p>
      <p
        v-else-if="bolehUang && grup.length"
        class="mb-3 rounded-field bg-info/10 px-3 py-2 text-sm"
      >
        Semua transfer minggu ini sudah ditandai terkirim.
      </p>

      <p
        v-if="totalAlfa"
        class="mb-3 rounded-field bg-warning/12 px-3 py-2 text-sm"
      >
        <b>{{ totalAlfa }} shift</b> tidak ikut dibayar karena ditandai <b>tidak hadir</b>. Daftar di bawah karena
        itu lebih pendek daripada jadwal yang disetujui — itu memang yang diinginkan.
      </p>
      <p
        v-if="totalBelum"
        class="mb-3 rounded-field bg-info/10 px-3 py-2 text-sm"
      >
        <b>{{ totalBelum }} shift</b> kehadirannya <b>belum dikonfirmasi</b> dan tetap ikut dihitung di sini.
        Periksa dulu di <ULink
          to="/dw/hadir"
          class="font-semibold text-highlighted underline-offset-4 hover:underline"
        >Konfirmasi Kehadiran</ULink>.
      </p>
      <p
        v-if="belumHp.length"
        class="mb-3 rounded-field bg-warning/12 px-3 py-2 text-sm"
      >
        <b>{{ belumHp.length }} orang</b> belum punya nomor tujuan: {{ belumHp.map(x => x.nama).join(', ') }}.
        Lengkapi di <b>Database DW</b> supaya bisa ikut digabung.
      </p>
      <p
        v-if="bolehUang && nol.length"
        class="mb-3 rounded-field bg-error/12 px-3 py-2 text-sm"
      >
        Nominal <b>Rp 0</b> untuk {{ nol.map(x => x.nama).join(', ') }}. Tarif posisinya belum disetel di
        <b>Pengaturan → Posisi per Divisi</b>.
      </p>

      <div class="mb-4 flex flex-wrap items-center gap-3">
        <AppSeg
          v-model="filter"
          :options="opsiFilter"
          size="sm"
        />
        <AppSeg
          v-model="tampilan"
          :options="[{ value: 'tujuan', label: 'Per tujuan' }, { value: 'orang', label: 'Per orang' }]"
          size="sm"
        />
        <UButton
          v-if="bolehUang"
          label="Salin daftar"
          icon="i-lucide-clipboard-copy"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="salin"
        />
        <UButton
          label="Print"
          icon="i-lucide-printer"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="cetak"
        />
      </div>

      <div v-if="tampilan === 'tujuan'">
        <UTable
          class="hidden lg:block"
          :data="grup"
          :columns="kolomGrup"
          :loading="!ajuan.length"
          empty="Tidak ada shift disetujui pada minggu ini."
        >
          <template #no-cell="{ row }">
            <span class="text-muted num">{{ row.index + 1 }}</span>
          </template>
          <template #tujuan-cell="{ row }">
            <p class="font-semibold text-highlighted">
              {{ labelTujuanDw(row.original.p) }}
            </p>
            <p
              v-if="row.original.orang.length > 1"
              class="text-[13px] text-muted"
            >
              {{ row.original.orang.length }} orang sekali transfer
            </p>
          </template>
          <template #untuk-cell="{ row }">
            <p
              v-for="o in row.original.orang"
              :key="o.id"
            >
              {{ o.nama }} <span class="text-[13px] text-muted">({{ o.kali }}×<template v-if="bolehUang"> · {{ rupiah(o.total) }}</template>)</span>
            </p>
          </template>
          <template #shift-cell="{ row }">
            <span class="num">{{ row.original.kali }}×</span>
          </template>
          <template #jumlah-cell="{ row }">
            <b
              v-if="bolehUang"
              class="num"
            >{{ rupiah(row.original.total) }}</b>
            <span
              v-else
              class="text-dimmed"
            >—</span>
          </template>
          <template #tandai-cell="{ row }">
            <UButton
              v-if="peran.hrd"
              :label="bayarSudahDw(set, senin, row.original.kunci) ? 'Sudah' : 'Tandai'"
              :icon="bayarSudahDw(set, senin, row.original.kunci) ? 'i-lucide-check' : 'i-lucide-square'"
              :color="bayarSudahDw(set, senin, row.original.kunci) ? 'success' : 'neutral'"
              :variant="bayarSudahDw(set, senin, row.original.kunci) ? 'soft' : 'outline'"
              size="xs"
              class="justify-end"
              @click="tandai(row.original)"
            />
            <span
              v-else
              class="text-dimmed"
            >{{ bayarSudahDw(set, senin, row.original.kunci) ? '✓ sudah' : '—' }}</span>
          </template>
        </UTable>

        <div class="divide-y divide-default lg:hidden">
          <article
            v-for="(g, i) in grup"
            :key="g.kunci"
            class="space-y-1.5 px-4 py-3"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="font-semibold text-highlighted">
                  <span class="me-1.5 text-muted num">{{ i + 1 }}</span>{{ labelTujuanDw(g.p) }}
                </p>
                <p class="text-sm text-muted">
                  {{ g.orang.map(o => o.nama).join(', ') }} · {{ g.kali }} shift
                </p>
              </div>
              <b
                v-if="bolehUang"
                class="shrink-0 num"
              >{{ rupiah(g.total) }}</b>
            </div>
            <UButton
              v-if="peran.hrd"
              :label="bayarSudahDw(set, senin, g.kunci) ? 'Sudah ditransfer' : 'Tandai sudah ditransfer'"
              :color="bayarSudahDw(set, senin, g.kunci) ? 'success' : 'neutral'"
              :variant="bayarSudahDw(set, senin, g.kunci) ? 'soft' : 'outline'"
              size="sm"
              @click="tandai(g)"
            />
          </article>
          <p
            v-if="!grup.length"
            class="px-4 py-8 text-center text-muted"
          >
            Tidak ada shift disetujui pada minggu ini.
          </p>
        </div>
      </div>

      <div v-else>
        <UTable
          class="hidden lg:block"
          :data="baris"
          :columns="kolomOrang"
          :loading="!ajuan.length"
          empty="Tidak ada shift disetujui pada minggu ini."
        >
          <template #no-cell="{ row }">
            <span class="text-muted num">{{ row.index + 1 }}</span>
          </template>
          <template #nama-cell="{ row }">
            <p class="font-semibold text-highlighted">
              {{ row.original.nama }}
            </p>
          </template>
          <template #divisi-cell="{ row }">
            {{ row.original.p ? divPekerja(row.original.p).map(namaDivisiJadwal).join(' / ') : '—' }}
            <p class="text-[13px] text-muted">
              {{ row.original.p ? posPekerja(row.original.p).join(', ') || '—' : '' }}
            </p>
          </template>
          <template #shift-cell="{ row }">
            <span class="num">{{ row.original.kali }}×</span>
          </template>
          <template #jam-cell="{ row }">
            <span class="num">{{ Math.round(row.original.jam * 10) / 10 }}</span>
          </template>
          <template #tujuan-cell="{ row }">
            <span class="text-[13px]">{{ labelTujuanDw(row.original.p) }}</span>
          </template>
          <template #jumlah-cell="{ row }">
            <b
              v-if="bolehUang"
              class="num"
            >{{ rupiah(row.original.total) }}</b>
            <span
              v-else
              class="text-dimmed"
            >—</span>
          </template>
          <template #tandai-cell="{ row }">
            <UButton
              v-if="peran.hrd"
              :label="bayarSudahDw(set, senin, kunciBayarDw(row.original.p, row.original.id)) ? 'Sudah' : 'Tandai'"
              :color="bayarSudahDw(set, senin, kunciBayarDw(row.original.p, row.original.id)) ? 'success' : 'neutral'"
              :variant="bayarSudahDw(set, senin, kunciBayarDw(row.original.p, row.original.id)) ? 'soft' : 'outline'"
              size="xs"
              @click="pindahTanda(kunciBayarDw(row.original.p, row.original.id), !bayarSudahDw(set, senin, kunciBayarDw(row.original.p, row.original.id)))"
            />
            <span
              v-else
              class="text-dimmed"
            >{{ bayarSudahDw(set, senin, kunciBayarDw(row.original.p, row.original.id)) ? '✓ sudah' : '—' }}</span>
          </template>
        </UTable>

        <div class="divide-y divide-default lg:hidden">
          <article
            v-for="(x, i) in baris"
            :key="x.id"
            class="space-y-1.5 px-4 py-3"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="font-semibold text-highlighted">
                  <span class="me-1.5 text-muted num">{{ i + 1 }}</span>{{ x.nama }}
                </p>
                <p class="text-sm text-muted">
                  {{ x.kali }} shift · {{ Math.round(x.jam * 10) / 10 }} jam · {{ labelTujuanDw(x.p) }}
                </p>
              </div>
              <b
                v-if="bolehUang"
                class="shrink-0 num"
              >{{ rupiah(x.total) }}</b>
            </div>
            <UButton
              v-if="peran.hrd"
              :label="bayarSudahDw(set, senin, kunciBayarDw(x.p, x.id)) ? 'Sudah ditransfer' : 'Tandai sudah ditransfer'"
              :color="bayarSudahDw(set, senin, kunciBayarDw(x.p, x.id)) ? 'success' : 'neutral'"
              :variant="bayarSudahDw(set, senin, kunciBayarDw(x.p, x.id)) ? 'soft' : 'outline'"
              size="sm"
              @click="pindahTanda(kunciBayarDw(x.p, x.id), !bayarSudahDw(set, senin, kunciBayarDw(x.p, x.id)))"
            />
          </article>
          <div
            v-if="pending && !baris.length"
            class="space-y-2 p-4"
          >
            <!-- Loading cards mirror the payout list below. -->
            <USkeleton
              v-for="i in 3"
              :key="i"
              class="h-16 w-full rounded-panel"
            />
          </div>
          <p
            v-else-if="!baris.length"
            class="px-4 py-8 text-center text-muted"
          >
            Tidak ada shift disetujui pada minggu ini.
          </p>
        </div>
      </div>

      <p class="mt-3 text-sm text-muted">
        Yang dihitung hanya shift yang <b>sudah disetujui</b> dan <b>tidak ditandai tidak hadir</b> pada
        {{ rentang }}. Nominalnya dari tarif per posisi di Pengaturan — kalau tarifnya berubah, angka minggu yang
        sudah lewat ikut berubah.
      </p>
      <p
        v-if="bolehUang && lunas.length"
        class="mt-2 text-sm text-muted"
      >
        <template
          v-for="(g, i) in lunas"
          :key="g.kunci"
        >
          <span v-if="i > 0"> · </span>{{ labelTujuanDw(g.p) }}<template v-if="info(g.kunci)?.oleh">
            oleh {{ info(g.kunci)!.oleh }}
          </template>
        </template>
      </p>
    </AppPanel>
  </AppPage>
</template>
