<!--
  Rekap Pegawai (DW) (deploy/dw/index.html viewRekap :7011-7194). The twin of
  Jadwal Shift › Rekap Pegawai, with the same section order: month, picker,
  numbers, notes, month grid, assignment list. HR tends to both for fixed crew
  and daily workers, and two layouts would force re-learning each time.

  Only DISETUJUI counts as scheduled; money follows attendance through the
  same `hadirDibayar` as Pembayaran (F.20). Money is HRD-only (F.12). Clicking
  a day opens the Ajukan DW sheet for this person (:7109).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AjuanDw, PekerjaDw } from '~/utils/dw'
import { biayaAjuanDw, bolehBukaDw, bolehLihatUangDw, divPekerja, durasiJamDw, posPekerja, rekapAjuanDw, rekapBebanDw, statusDw } from '~/utils/dw'
import { useDwBulan, useDwDasar } from '~/composables/useDw'
import { akhirBulan, geserBulan, labelBulanJadwal, namaDivisiJadwal } from '~/utils/jadwal'
import { fTglP, hariIni, rupiah } from '~/utils/format'

definePageMeta({ access: ['dw'] })

const { set, ajuan, pekerja, peran, pending, error, refresh } = useDwDasar()
const mk = useDwBulan()
const pilihId = ref('')

/** Matrix-aware gate (T-10). */
const bolehHalaman = computed(() => bolehBukaDw(set.value, peran.value, 'rekap'))

const kandidat = computed(() => {
  const adaAjuan: Record<string, number> = {}
  for (const x of ajuan.value) {
    if (x.tgl >= `${mk.value}-01` && x.tgl <= akhirBulan(mk.value)) adaAjuan[x.dwId] = 1
  }
  return pekerja.value
    .filter(p => p.status === 'AKTIF' || adaAjuan[p.id])
    .sort((a, b) => String(a.nama).localeCompare(String(b.nama)))
})
const opsiOrang = computed(() => {
  const kode = new Set(['bar', 'kitchen', 'floor', 'cashier'])
  return kandidat.value.map((p) => {
    const ds = divPekerja(p).filter(k => kode.has(k))
    const grup = ds.length ? ds.map(namaDivisiJadwal).join(' / ') : '• Tanpa divisi'
    return { value: p.id, label: `${grup} · ${p.nama}` }
  })
})
watch([kandidat, mk], () => {
  if (!pilihId.value || !kandidat.value.some(p => p.id === pilihId.value)) pilihId.value = kandidat.value[0]?.id ?? ''
}, { immediate: true })
const p = computed<PekerjaDw | null>(() => kandidat.value.find(x => x.id === pilihId.value) ?? null)
const b = computed(() => (p.value ? rekapBebanDw(set.value, ajuan.value, p.value.id, mk.value) : null))
const list = computed(() => (p.value ? rekapAjuanDw(ajuan.value, p.value.id, mk.value) : []))
const rata = computed(() => (b.value && b.value.hariMasuk ? Math.round((b.value.jam / b.value.hariMasuk) * 10) / 10 : 0))

const alarm = computed(() => {
  const out: string[] = []
  if (!b.value) return out
  if (b.value.maxBeruntun >= 6) out.push(`${b.value.maxBeruntun} hari masuk beruntun tanpa jeda`)
  if (b.value.menunggu) out.push(`${b.value.menunggu} ajuan masih menunggu keputusan HR`)
  if (b.value.ditolak) out.push(`${b.value.ditolak} ajuan ditolak bulan ini`)
  if (p.value && p.value.status !== 'AKTIF') out.push('DW ini berstatus Nonaktif — tidak bisa dijadwalkan lagi')
  return out
})

/** Chips, sorted, with a guaranteed non-null month summary. */
const chipDiv = computed(() => (b.value
  ? Object.keys(b.value.perDivisi).sort((x, y) => b.value!.perDivisi[y]! - b.value!.perDivisi[x]!).map(k => ({ k, n: b.value!.perDivisi[k]! }))
  : []))
const chipPos = computed(() => (b.value
  ? Object.keys(b.value.perPosisi).sort((x, y) => b.value!.perPosisi[y]! - b.value!.perPosisi[x]!).map(k => ({ k, n: b.value!.perPosisi[k]! }))
  : []))

const kolom: TableColumn<AjuanDw>[] = [
  { id: 'tgl', header: 'Tanggal' },
  { id: 'divisi', header: 'Divisi / Posisi' },
  { id: 'jam', header: 'Jam' },
  { id: 'upah', header: () => h('span', { class: 'block text-end' }, 'Upah') },
  { id: 'status', header: 'Status' },
]

const ajukanOpen = ref(false)
const ajukanTgl = ref('')
function buka(tgl: string) {
  if (!p.value) return
  ajukanTgl.value = tgl
  ajukanOpen.value = true
}
function cetak() {
  window.print()
}
function perTgl(tgl: string) {
  return ajuan.value.filter(a => p.value && a.dwId === p.value.id && a.tgl === tgl && a.status !== 'BATAL')
}
</script>

<template>
  <AppPage
    title="Rekap pegawai"
    description="Jadwal sebulan, jam kerja & upah satu daily worker."
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
      title="Halaman ini untuk HRD dan head divisi"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Minta admin modul menambahkan Anda di <b>Pengaturan → Hak Akses</b>, atau minta ditunjuk sebagai head divisi
        di modul <b>Jadwal Shift → Pengaturan → Head Divisi</b>.
      </p>
    </AppPanel>

    <AppPanel
      v-else-if="!kandidat.length"
      title="Belum ada daily worker"
      icon="i-lucide-users"
    >
      <p class="text-sm text-muted">
        Tambahkan dulu di <b>Database DW</b>, lalu buka halaman ini lagi.
      </p>
    </AppPanel>

    <template v-else>
      <AppPanel>
        <template #head>
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <h2 class="text-lg font-semibold text-highlighted">
              {{ labelBulanJadwal(mk) }}
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
              v-if="mk !== hariIni().slice(0, 7)"
              label="Bulan ini"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="mk = hariIni().slice(0, 7)"
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
        </template>

        <div class="mb-4 flex flex-wrap items-center gap-2">
          <USelect
            v-model="pilihId"
            :items="opsiOrang"
            class="w-full max-w-72"
          />
          <template v-if="p">
            <span
              v-for="k in divPekerja(p)"
              :key="k"
              class="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted"
            >{{ namaDivisiJadwal(k) }}</span>
            <span
              v-if="posPekerja(p).length"
              class="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted"
            >{{ posPekerja(p).join(', ') }}</span>
            <AppStatus
              size="sm"
              :color="statusDw(p.status) === 'AKTIF' ? 'success' : 'neutral'"
            >
              {{ statusDw(p.status) === 'AKTIF' ? 'Aktif' : 'Nonaktif' }}
            </AppStatus>
          </template>
        </div>

        <div
          v-if="b"
          class="mb-4"
        >
          <AppStatGrid>
            <AppStat
              label="Hari masuk"
              icon="i-lucide-calendar-check"
              :value="b.hariMasuk"
              tone="success"
            />
            <AppStat
              label="Total jam"
              icon="i-lucide-clock"
              :value="b.jam || '—'"
            />
            <AppStat
              label="Rata jam/hari"
              icon="i-lucide-timer"
              :value="rata || '—'"
            />
            <AppStat
              label="Beruntun terpanjang"
              icon="i-lucide-flame"
              :value="b.maxBeruntun"
              :tone="b.maxBeruntun >= 6 ? 'warning' : 'gold'"
            />
            <AppStat
              label="Masuk akhir pekan"
              icon="i-lucide-calendar-heart"
              :value="b.wknd"
            />
            <AppStat
              label="Ajuan menunggu"
              icon="i-lucide-hourglass"
              :value="b.menunggu"
              :tone="b.menunggu ? 'warning' : 'gold'"
            />
            <AppStat
              label="Ajuan ditolak"
              icon="i-lucide-x"
              :value="b.ditolak"
              :tone="b.ditolak ? 'error' : 'gold'"
            />
            <AppStat
              v-if="bolehLihatUangDw(peran)"
              label="Upah bulan ini"
              icon="i-lucide-banknote"
              :value="rupiah(b.upah)"
              tone="gold"
            />
          </AppStatGrid>
        </div>

        <div
          v-if="alarm.length"
          class="mb-4 rounded-field bg-warning/12 px-3 py-2 text-sm"
        >
          <b>Perlu dilihat:</b>
          <ul class="ms-5 mt-1 list-disc">
            <li
              v-for="(x, i) in alarm"
              :key="i"
            >
              {{ x }}
            </li>
          </ul>
        </div>
        <p
          v-else
          class="mb-4 rounded-field bg-info/10 px-3 py-2 text-sm"
        >
          Tidak ada ajuan yang menggantung, dan tidak ada hari beruntun yang berlebihan.
        </p>

        <div
          v-if="chipDiv.length"
          class="mb-2 flex flex-wrap items-center gap-1.5 text-sm"
        >
          <span class="text-muted">Divisi:</span>
          <span
            v-for="c in chipDiv"
            :key="c.k"
            class="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted"
          >{{ namaDivisiJadwal(c.k) }} <b class="num">{{ c.n }}×</b></span>
        </div>
        <div
          v-if="chipPos.length"
          class="mb-4 flex flex-wrap items-center gap-1.5 text-sm"
        >
          <span class="text-muted">Posisi:</span>
          <span
            v-for="c in chipPos"
            :key="c.k"
            class="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted"
          >{{ c.k }} <b class="num">{{ c.n }}×</b></span>
        </div>

        <DwKisi
          :mk="mk"
          :bisa="() => true"
          @pilih="buka"
        >
          <template #hari="{ tgl }">
            <div
              v-if="perTgl(tgl).length"
              class="space-y-0.5"
            >
              <span
                v-for="a in perTgl(tgl).slice(0, 2)"
                :key="a.id"
                class="block truncate rounded px-1 py-0.5 text-[10px] font-bold"
                :class="a.status === 'DISETUJUI'
                  ? 'bg-success/12 text-success'
                  : a.status === 'MENUNGGU'
                    ? 'border border-dashed border-warning text-warning'
                    : 'bg-muted text-muted'"
              >
                {{ a.posisi || namaDivisiJadwal(a.divisi) }}
                <span class="font-medium num">{{ a.m }}–{{ a.s }}</span>
              </span>
              <span
                v-if="perTgl(tgl).length > 2"
                class="block text-[10px] text-muted"
              >+{{ perTgl(tgl).length - 2 }} lagi</span>
            </div>
          </template>
        </DwKisi>
        <p class="mt-3 text-sm text-muted">
          Klik tanggal mana pun untuk mengajukan {{ p?.nama }} pada hari itu.
        </p>
      </AppPanel>

      <AppPanel
        title="Ajuan bulan ini"
        icon="i-lucide-list"
        :count="list.length"
        flush
      >
        <UTable
          class="hidden lg:block"
          :data="list"
          :columns="kolom"
          empty="Belum ada ajuan pada bulan ini."
        >
          <template #tgl-cell="{ row }">
            <span class="num">{{ fTglP(row.original.tgl) }}</span>
          </template>
          <template #divisi-cell="{ row }">
            {{ namaDivisiJadwal(row.original.divisi) }}
            <p class="text-[13px] text-muted">
              {{ row.original.posisi || '—' }}
            </p>
          </template>
          <template #jam-cell="{ row }">
            <span class="num">{{ row.original.m }}–{{ row.original.s }}</span>
            <p class="text-[13px] text-muted num">
              {{ durasiJamDw(row.original.m, row.original.s) }} jam
            </p>
          </template>
          <template #upah-cell="{ row }">
            <span
              v-if="bolehLihatUangDw(peran) && row.original.status === 'DISETUJUI'"
              class="num"
            >{{ rupiah(biayaAjuanDw(set, row.original)) }}</span>
            <span
              v-else
              class="text-dimmed"
            >—</span>
          </template>
          <template #status-cell="{ row }">
            <DwStatus
              :status="row.original.status"
              size="sm"
            />
            <p
              v-if="row.original.putusNota"
              class="text-[12px] text-error"
            >
              "{{ row.original.putusNota }}"
            </p>
          </template>
        </UTable>

        <div class="divide-y divide-default lg:hidden">
          <article
            v-for="a in list"
            :key="a.id"
            class="flex items-start justify-between gap-2 px-4 py-3"
          >
            <div class="min-w-0">
              <p class="font-semibold text-highlighted num">
                {{ fTglP(a.tgl) }} · {{ a.m }}–{{ a.s }}
              </p>
              <p class="text-sm text-muted">
                {{ namaDivisiJadwal(a.divisi) }} · {{ a.posisi || '—' }} · {{ durasiJamDw(a.m, a.s) }} jam
              </p>
            </div>
            <div class="shrink-0 text-end">
              <DwStatus
                :status="a.status"
                size="sm"
              />
              <p
                v-if="bolehLihatUangDw(peran) && a.status === 'DISETUJUI'"
                class="text-xs text-muted num"
              >
                {{ rupiah(biayaAjuanDw(set, a)) }}
              </p>
            </div>
          </article>
          <p
            v-if="!list.length"
            class="px-4 py-8 text-center text-muted"
          >
            Belum ada ajuan pada bulan ini.
          </p>
        </div>
      </AppPanel>
    </template>

    <DwAjukan
      v-model:open="ajukanOpen"
      :tgl-awal="ajukanTgl"
      :dw-id="p?.id ?? ''"
      @sent="refresh"
    />
  </AppPage>
</template>
