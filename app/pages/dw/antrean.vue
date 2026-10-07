<!--
  Antrean Pengajuan (deploy/dw/index.html viewAntrean :3912-4560). ONE desk
  for both kinds of work that wait on HRD (F.18): a head's request ("how many
  people") and an assignment ("who"). The Antrian/Riwayat split follows
  "is there work left", not the status (`entriPerluDikerjakan`) — a request
  approved but not fully staffed stays in Antrian, because HRD still has to
  find someone.

  Decisions keep the old consequences:
  - approving an assignment writes it on the Jadwal Shift calendar (server);
  - a request with suggested names approves them in one tap ("Setuju & Pilih
    DW"), still filtered server-side;
  - "Kembalikan" only works when a request has no live assignments, and
    appears as a plain action with its warning written out (:4366-4422);
  - bulk approval always confirms and states what it promises (:4486).
  Money is HRD-only (F.12); without it the column disappears, not dashes.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AjuanDw, PermintaanDw, EntriAntrean } from '~/utils/dw'
import { biayaAjuanDw, biayaPermintaanDw, bolehBukaDw, bolehLihatUangDw, entriAntreanDw, entriPerluDikerjakan, KONTEKS_LBL, lampauiBanyakDw, mintaBelumTuntas, mintaOrang, mintaTerpenuhi, namaDw, ringkasAjuanDw, segeraDw } from '~/utils/dw'
import { namaDivisiJadwal } from '~/utils/jadwal'
import { putusAjuanDw, putusBanyakDw, putusPermintaanDw, tugaskanDw, useDwDasar, useDwPax } from '~/composables/useDw'
import { fTgl, fTglP } from '~/utils/format'

definePageMeta({ access: ['dw'] })

const PER = 20
const toast = useToast()
const { set, ajuan, permintaan, pekerja, peran, pending, error, refresh } = useDwDasar()
const pax = useDwPax()

/** Matrix-aware gate (T-10); default is the HRD desk. Decisions stay HRD-only. */
const bolehHalaman = computed(() => bolehBukaDw(set.value, peran.value, 'antrean'))

const tab = ref<'antri' | 'riwayat' | 'semua'>('antri')
const cari = ref('')
const hal = ref(1)
watch([tab], () => {
  hal.value = 1
  cari.value = ''
})
watch(cari, () => {
  hal.value = 1
})

const entri = computed(() => entriAntreanDw(ajuan.value, permintaan.value))
const menunggu = computed(() => entri.value.filter(e => entriPerluDikerjakan(ajuan.value, e))
  .sort((a, b) => String(a.tgl).localeCompare(String(b.tgl)) || String(a.m).localeCompare(String(b.m))))
const sudah = computed(() => entri.value.filter(e => !entriPerluDikerjakan(ajuan.value, e))
  .filter(e => !(e.jenis === 'minta' && e.status === 'DISETUJUI' && !mintaBelumTuntas(ajuan.value, e.x as PermintaanDw)))
  .sort((a, b) => b.putusAt - a.putusAt))
const urut = computed(() => [...menunggu.value, ...sudah.value])

const q = computed(() => cari.value.trim().toLowerCase())
const namaEntri = (e: EntriAntrean) => (e.jenis === 'ajuan'
  ? namaDw(pekerja.value, (e.x as AjuanDw).dwId)
  : `${(e.x as PermintaanDw).usulan.map(id => namaDw(pekerja.value, id)).join(' ')} ${(e.x as PermintaanDw).dibuatOleh}`)
const tersaring = computed(() => (q.value ? urut.value.filter(e => namaEntri(e).toLowerCase().includes(q.value)) : urut.value))
const sumber = computed(() => (tab.value === 'riwayat' ? sudah.value : tab.value === 'semua' ? urut.value : menunggu.value))
const sumberSaring = computed(() => (q.value ? tersaring.value.filter(e => sumber.value.includes(e)) : sumber.value))
const halKini = computed(() => Math.min(hal.value, Math.max(1, Math.ceil(sumberSaring.value.length / PER))))
const daftar = computed(() => sumberSaring.value.slice((halKini.value - 1) * PER, halKini.value * PER))

const opsiTab = computed(() => [
  { value: 'antri' as const, label: `Antrian ${menunggu.value.length}` },
  { value: 'riwayat' as const, label: `Riwayat ${sudah.value.length}` },
  { value: 'semua' as const, label: `Semua ${urut.value.length}` },
])
const nBelumLengkap = computed(() => menunggu.value.filter(e => e.jenis === 'minta' && e.status === 'DISETUJUI').length)

const kolom: TableColumn<EntriAntrean>[] = [
  { id: 'tgl', header: 'Tanggal' },
  { id: 'pengajuan', header: 'Pengajuan' },
  { id: 'divisi', header: 'Divisi / Posisi' },
  { id: 'jam', header: 'Jam' },
  { id: 'upah', header: () => h('span', { class: 'block text-end' }, 'Upah') },
  { id: 'status', header: 'Status' },
  { id: 'aksi', header: () => h('span', { class: 'block text-end' }, '') },
]

const bolehAksi = computed(() => peran.value.hrd)

// Group headers (Antrian only): per date, the bulk-approve button and counts.
function idsGrup(tgl: string) {
  return menunggu.value.filter(z => z.tgl === tgl && z.jenis === 'ajuan').map(z => z.id)
}

// ---------------------------------------------------------------- actions
const setujuA = ref<AjuanDw | null>(null)
const setujuOpen = ref(false)
function mintaSetuju(a: AjuanDw) {
  setujuA.value = a
  setujuOpen.value = true
}
async function jalanSetuju() {
  if (!setujuA.value) return
  try {
    await putusAjuanDw(setujuA.value.id, 'DISETUJUI', '')
    setujuOpen.value = false
    toast.add({ title: `${namaDw(pekerja.value, setujuA.value.dwId)} disetujui`, color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal menyetujui: ${apiErrorMessage(e)}`, color: 'error' })
  }
}

const tolakE = ref<EntriAntrean | null>(null)
const tolakOpen = ref(false)
const tolakNota = ref('')
function mintaTolak(e: EntriAntrean) {
  tolakE.value = e
  tolakNota.value = ''
  tolakOpen.value = true
}
async function jalanTolak() {
  if (!tolakE.value) return
  try {
    if (tolakE.value.jenis === 'ajuan') {
      await putusAjuanDw(tolakE.value.id, 'DITOLAK', tolakNota.value.trim() || 'Tidak dibutuhkan pada tanggal itu')
    }
    else {
      await putusPermintaanDw(tolakE.value.id, 'DITOLAK', tolakNota.value.trim() || 'Tidak bisa dipenuhi')
    }
    tolakOpen.value = false
    toast.add({ title: 'Ditolak', color: 'info' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal: ${apiErrorMessage(e)}`, color: 'error' })
  }
}

const kembaliA = ref<AjuanDw | null>(null)
const kembaliOpen = ref(false)
async function jalanKembali() {
  if (!kembaliA.value) return
  try {
    await putusAjuanDw(kembaliA.value.id, 'MENUNGGU', '')
    kembaliOpen.value = false
    toast.add({ title: 'Dikembalikan ke antrean', color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal: ${apiErrorMessage(e)}`, color: 'error' })
  }
}

const kembaliX = ref<PermintaanDw | null>(null)
const kembaliXOpen = ref(false)
const blokirX = ref<PermintaanDw | null>(null)
const blokirOpen = ref(false)
function mintaKembaliMinta(x: PermintaanDw) {
  if (mintaOrang(ajuan.value, x.id).length) {
    blokirX.value = x
    blokirOpen.value = true
    return
  }
  kembaliX.value = x
  kembaliXOpen.value = true
}
async function jalanKembaliMinta() {
  if (!kembaliX.value) return
  try {
    await putusPermintaanDw(kembaliX.value.id, 'MENUNGGU', '')
    kembaliXOpen.value = false
    toast.add({ title: 'Permintaan dikembalikan ke antrean', color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal: ${apiErrorMessage(e)}`, color: 'error' })
  }
}

const tunjukX = ref<PermintaanDw | null>(null)
const tunjukOpen = ref(false)
function bukaTunjuk(x: PermintaanDw) {
  tunjukX.value = x
  tunjukOpen.value = true
}
async function selesaiTunjuk(pesan: string) {
  toast.add({ title: pesan, color: 'success' })
  await refresh()
}

const usulX = ref<PermintaanDw | null>(null)
const usulOpen = ref(false)
function mintaUsul(x: PermintaanDw) {
  usulX.value = x
  usulOpen.value = true
}
function mintaKembaliA(a: AjuanDw) {
  kembaliA.value = a
  kembaliOpen.value = true
}
/** One click handler for "Kembalikan", whichever kind of row it sits on. */
function aksiKembali(e: EntriAntrean) {
  if (e.jenis === 'ajuan') mintaKembaliA(e.x as AjuanDw)
  else mintaKembaliMinta(e.x as PermintaanDw)
}
function sisaUsulan(x: PermintaanDw) {
  const sudah = mintaOrang(ajuan.value, x.id).map(a => a.dwId)
  return x.usulan.filter(id => !sudah.includes(id))
}
async function jalanUsul() {
  if (!usulX.value) return
  try {
    const r = await tugaskanDw(usulX.value.id, sisaUsulan(usulX.value))
    const t = r.data?.tertahan ?? []
    usulOpen.value = false
    toast.add({ title: t.length ? `${r.data?.masuk ?? 0} ditugaskan, ${t.length} tertahan bentrok` : `${r.data?.masuk ?? 0} daily worker disetujui`, color: t.length ? 'warning' : 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal menugaskan: ${apiErrorMessage(e)}`, color: 'error' })
  }
}

// Bulk approve (Antrian group header).
const banyakIds = ref<string[]>([])
const banyakOpen = ref(false)
const ringkas = computed(() => ringkasAjuanDw(set.value, ajuan.value, banyakIds.value))
const lampauBanyak = computed(() => (banyakIds.value.length ? lampauiBanyakDw(ajuan.value, set.value, banyakIds.value, t => pax.value[t] ?? 0) : []))
function bukaBanyak(ids: string[]) {
  if (!ids.length || !peran.value.hrd) return
  banyakIds.value = ids
  banyakOpen.value = true
}
async function jalanBanyak() {
  try {
    const n = banyakIds.value.length
    await putusBanyakDw(banyakIds.value, 'DISETUJUI', '')
    banyakOpen.value = false
    toast.add({ title: `${n} pengajuan disetujui`, color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal menyimpan: ${apiErrorMessage(e)}`, color: 'error' })
  }
}

const kosongTeks = computed(() => (tab.value === 'antri'
  ? 'Tidak ada permintaan atau pengajuan yang perlu dikerjakan.'
  : tab.value === 'riwayat' ? 'Belum ada yang diputuskan.' : 'Belum ada permintaan maupun pengajuan.'))
</script>

<template>
  <AppPage
    title="Antrean pengajuan"
    description="Pengajuan yang menunggu keputusan HR."
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
        Antrean memuat seluruh permintaan dan pengajuan yang menunggu keputusan. Minta admin modul menambahkan Anda
        di <b>Pengaturan → Hak Akses</b>.
      </p>
    </AppPanel>

    <AppPanel
      v-else
      title="Satu meja untuk dua jenis"
      icon="i-lucide-inbox"
      flush
    >
      <div class="space-y-3 p-4 lg:p-5">
        <div class="flex flex-wrap items-center gap-3">
          <AppSeg
            v-model="tab"
            :options="opsiTab"
            size="sm"
          />
          <UInput
            v-if="sumber.length >= 8"
            v-model="cari"
            icon="i-lucide-search"
            placeholder="Cari nama…"
            class="w-full max-w-56"
          />
          <span class="text-sm text-muted">
            <template v-if="menunggu.length">
              <b>{{ menunggu.length }} entri</b> menunggu keputusan<template v-if="nBelumLengkap"> · {{ nBelumLengkap }} permintaan sudah disetujui tapi orangnya belum lengkap</template>.
            </template>
            <template v-else>Antrean kosong.</template>
          </span>
        </div>
        <p class="text-sm text-muted">
          <b>Permintaan</b> menyebut berapa orang; <b>pengajuan</b> menyebut siapa. Yang disetujui langsung tampil di
          kalender modul <b>Jadwal Shift</b>. Antrian dan Riwayat dipisah menurut masih ada pekerjaannya atau tidak.
        </p>
      </div>

      <UTable
        class="hidden lg:block"
        :data="daftar"
        :columns="kolom"
        :loading="!ajuan.length && !permintaan.length"
        :empty="kosongTeks"
        :meta="{ class: { tr: (row: { original: EntriAntrean }) => (entriPerluDikerjakan(ajuan, row.original) ? 'bg-warning/8' : '') } }"
      >
        <template #tgl-cell="{ row }">
          <span class="num">{{ fTglP(row.original.tgl) }}</span>
          <p
            v-if="segeraDw(row.original.tgl)"
            class="text-[13px] font-semibold"
            :class="segeraDw(row.original.tgl)!.tone === 'lewat' ? 'text-error' : 'text-primary-700'"
          >
            {{ segeraDw(row.original.tgl)!.teks }}
          </p>
          <button
            v-if="tab === 'antri' && bolehAksi && idsGrup(row.original.tgl).length > 1"
            type="button"
            class="text-[12px] font-semibold text-primary-700 hover:underline"
            @click="bukaBanyak(idsGrup(row.original.tgl))"
          >
            Setujui {{ idsGrup(row.original.tgl).length }} pengajuan
          </button>
        </template>
        <template #pengajuan-cell="{ row }">
          <template v-if="row.original.jenis === 'ajuan'">
            <p class="font-semibold text-highlighted">
              {{ namaDw(pekerja, (row.original.x as AjuanDw).dwId) }}
            </p>
            <p class="text-[13px] text-muted">
              Pengajuan DW{{ (row.original.x as AjuanDw).catatan ? ` · "${(row.original.x as AjuanDw).catatan}"` : '' }}
            </p>
          </template>
          <template v-else>
            <p class="font-semibold text-highlighted">
              Permintaan {{ (row.original.x as PermintaanDw).jumlah }} orang
            </p>
            <p class="text-[13px] text-muted">
              {{ (row.original.x as PermintaanDw).dibuatOleh ? `diminta ${(row.original.x as PermintaanDw).dibuatOleh}` : '' }}
              <template v-if="(row.original.x as PermintaanDw).catatan">
                · "{{ (row.original.x as PermintaanDw).catatan }}"
              </template>
            </p>
            <p
              v-if="(row.original.x as PermintaanDw).usulan.length"
              class="text-[13px] text-primary-700"
            >
              usul: {{ (row.original.x as PermintaanDw).usulan.map(id => namaDw(pekerja, id)).join(', ') }}
            </p>
          </template>
        </template>
        <template #divisi-cell="{ row }">
          {{ namaDivisiJadwal(row.original.divisi) }}
          <p class="text-[13px] text-muted">
            {{ row.original.x.posisi || '—' }}
          </p>
        </template>
        <template #jam-cell="{ row }">
          <span class="num">{{ row.original.x.m }}–{{ row.original.x.s }}</span>
        </template>
        <template #upah-cell="{ row }">
          <span
            v-if="bolehLihatUangDw(peran)"
            class="num"
          >
            <template v-if="row.original.jenis === 'ajuan'">{{ rupiah(biayaAjuanDw(set, row.original.x as AjuanDw)) }}</template>
            <template v-else>± {{ rupiah(biayaPermintaanDw(set, row.original.x as PermintaanDw)) }}</template>
          </span>
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
            v-if="row.original.jenis === 'minta' && row.original.status === 'DISETUJUI'"
            class="text-[12px] text-muted"
          >
            {{ mintaTerpenuhi(ajuan, row.original.id) }} dari {{ (row.original.x as PermintaanDw).jumlah }} terpenuhi
          </p>
          <p
            v-if="row.original.x.putusOleh"
            class="text-[12px] text-muted"
          >
            oleh {{ row.original.x.putusOleh }}
          </p>
          <p
            v-if="row.original.x.putusNota"
            class="text-[12px] text-error"
          >
            "{{ row.original.x.putusNota }}"
          </p>
        </template>
        <template #aksi-cell="{ row }">
          <div class="flex flex-wrap justify-end gap-1.5">
            <template v-if="bolehAksi && entriPerluDikerjakan(ajuan, row.original)">
              <template v-if="row.original.jenis === 'ajuan'">
                <UButton
                  label="Setujui"
                  color="success"
                  size="xs"
                  @click="mintaSetuju(row.original.x as AjuanDw)"
                />
              </template>
              <template v-else>
                <UButton
                  v-if="sisaUsulan(row.original.x as PermintaanDw).length"
                  :label="`Setuju & pilih ${sisaUsulan(row.original.x as PermintaanDw).length} DW`"
                  color="success"
                  size="xs"
                  @click="mintaUsul(row.original.x as PermintaanDw)"
                />
                <UButton
                  label="Pilih DW"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  @click="bukaTunjuk(row.original.x as PermintaanDw)"
                />
              </template>
              <UButton
                label="Tolak"
                color="error"
                variant="ghost"
                size="xs"
                @click="mintaTolak(row.original)"
              />
            </template>
            <template v-else-if="bolehAksi && !entriPerluDikerjakan(ajuan, row.original)">
              <UButton
                label="Kembalikan"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="aksiKembali(row.original)"
              />
            </template>
            <span
              v-else
              class="text-dimmed"
            >—</span>
          </div>
        </template>
      </UTable>

      <div class="divide-y divide-default lg:hidden">
        <article
          v-for="e in daftar"
          :key="`${e.jenis}-${e.id}`"
          class="space-y-2 px-4 py-3"
          :class="entriPerluDikerjakan(ajuan, e) && 'bg-warning/8'"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">
                <template v-if="e.jenis === 'ajuan'">
                  {{ namaDw(pekerja, (e.x as AjuanDw).dwId) }}
                </template>
                <template v-else>
                  Permintaan {{ (e.x as PermintaanDw).jumlah }} orang
                </template>
              </p>
              <p class="text-sm text-muted">
                <span class="num">{{ fTglP(e.tgl) }}</span> · {{ namaDivisiJadwal(e.divisi) }} · <span class="num">{{ e.x.m }}–{{ e.x.s }}</span>
              </p>
            </div>
            <DwStatus
              :status="e.status"
              size="sm"
            />
          </div>
          <div
            v-if="bolehAksi && entriPerluDikerjakan(ajuan, e)"
            class="flex flex-wrap gap-1.5"
          >
            <template v-if="e.jenis === 'ajuan'">
              <UButton
                label="Setujui"
                color="success"
                size="xs"
                @click="mintaSetuju(e.x as AjuanDw)"
              />
            </template>
            <template v-else>
              <UButton
                v-if="sisaUsulan(e.x as PermintaanDw).length"
                label="Setuju & pilih DW"
                color="success"
                size="xs"
                @click="mintaUsul(e.x as PermintaanDw)"
              />
              <UButton
                label="Pilih DW"
                color="neutral"
                variant="outline"
                size="xs"
                @click="bukaTunjuk(e.x as PermintaanDw)"
              />
            </template>
            <UButton
              label="Tolak"
              color="error"
              variant="ghost"
              size="xs"
              @click="mintaTolak(e)"
            />
          </div>
          <div
            v-else-if="bolehAksi"
            class="flex flex-wrap gap-1.5"
          >
            <UButton
              label="Kembalikan"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="aksiKembali(e)"
            />
          </div>
        </article>
        <p
          v-if="!daftar.length"
          class="px-4 py-8 text-center text-muted"
        >
          {{ kosongTeks }}
        </p>
      </div>

      <JadwalPager
        v-model="hal"
        :total="sumberSaring.length"
        :per="PER"
        satuan="entri"
      />
    </AppPanel>

    <ResponsiveSheet
      v-model:open="setujuOpen"
      :title="setujuA ? `Setujui ${namaDw(pekerja, setujuA.dwId)}?` : 'Setujui?'"
    >
      <div
        v-if="setujuA"
        class="space-y-2 text-sm"
      >
        <p>
          <b>{{ fTgl(setujuA.tgl) }}</b> · <span class="num">{{ setujuA.m }}–{{ setujuA.s }}</span><br>
          {{ namaDivisiJadwal(setujuA.divisi) }} · {{ setujuA.posisi || '—' }}
        </p>
        <p
          v-if="bolehLihatUangDw(peran)"
          class="rounded-field bg-info/10 px-3 py-2"
        >
          Upah yang timbul: <b>{{ rupiah(biayaAjuanDw(set, setujuA)) }}</b> — muncul di halaman <b>Pembayaran</b>
          untuk minggu shift-nya.
        </p>
        <p class="text-muted">
          Yang disetujui langsung tampil di kalender modul <b>Jadwal Shift</b> hari itu.
        </p>
      </div>
      <template #footer>
        <UButton
          label="Ya, setujui"
          color="success"
          @click="jalanSetuju"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="setujuOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="tolakOpen"
      :title="tolakE ? `Tolak ${namaEntri(tolakE)}` : 'Tolak?'"
    >
      <UFormField
        label="Alasan penolakan"
        help="Dibaca yang mengajukan. Kosongkan kalau tidak perlu — akan tertulis alasan baku."
      >
        <UTextarea
          v-model="tolakNota"
          :rows="3"
          class="w-full"
        />
      </UFormField>
      <template #footer>
        <UButton
          label="Tolak"
          color="error"
          @click="jalanTolak"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="tolakOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="kembaliOpen"
      title="Kembalikan ke antrean?"
    >
      <div
        v-if="kembaliA"
        class="space-y-2 text-sm"
      >
        <p>
          <b>{{ namaDw(pekerja, kembaliA.dwId) }}</b> · <span class="num">{{ fTgl(kembaliA.tgl) }}</span> ·
          <span class="num">{{ kembaliA.m }}–{{ kembaliA.s }}</span>
        </p>
        <p class="text-muted">
          Statusnya kembali <b>Menunggu HR</b> dan barisnya muncul lagi di tab <b>Antrian</b> untuk diputuskan ulang.
          Catatan putusan yang lama dibuang.
        </p>
        <p
          v-if="kembaliA.status === 'DISETUJUI'"
          class="rounded-field bg-warning/12 px-3 py-2"
        >
          Shift ini <b>hilang dari kalender Jadwal Shift</b> dan upahnya <b>hilang dari halaman Pembayaran</b> minggu
          itu. Kalau orangnya sudah dikabari, ia perlu dikabari lagi.
        </p>
      </div>
      <template #footer>
        <UButton
          label="Kembalikan ke antrean"
          color="primary"
          @click="jalanKembali"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="kembaliOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="kembaliXOpen"
      title="Kembalikan permintaan ke antrean?"
    >
      <div
        v-if="kembaliX"
        class="space-y-2 text-sm"
      >
        <p>
          <b>{{ namaDivisiJadwal(kembaliX.divisi) }}</b> · <span class="num">{{ fTgl(kembaliX.tgl) }}</span> ·
          <b>{{ kembaliX.jumlah }}</b> orang
        </p>
        <p class="text-muted">
          Statusnya kembali <b>Menunggu HR</b> dan barisnya muncul lagi di tab <b>Antrian</b>. Catatan putusan yang
          lama dibuang.
        </p>
      </div>
      <template #footer>
        <UButton
          label="Kembalikan ke antrean"
          @click="jalanKembaliMinta"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="kembaliXOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="blokirOpen"
      title="Tarik penugasannya dulu"
    >
      <div
        v-if="blokirX"
        class="space-y-2 text-sm"
      >
        <p class="text-muted">
          Permintaan ini sudah punya <b>{{ mintaOrang(ajuan, blokirX.id).length }}</b> penugasan yang hidup:
          <b>{{ mintaOrang(ajuan, blokirX.id).map(a => namaDw(pekerja, a.dwId)).join(', ') }}</b>.
        </p>
        <p class="rounded-field bg-warning/12 px-3 py-2">
          Kalau permintaannya dikembalikan ke antrean sekarang, ia akan terhitung sudah terpenuhi — tombol
          <b>Setuju</b> dan <b>Pilih DW</b> tidak muncul satu pun, dan barisnya duduk di antrean tanpa ada yang bisa
          dikerjakan padanya.
        </p>
        <p class="text-muted">
          Kembalikan atau tolak dulu penugasan di atas, lalu ulangi.
        </p>
      </div>
      <template #footer>
        <UButton
          label="Mengerti"
          @click="blokirOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="usulOpen"
      :title="usulX ? `Setujui ${sisaUsulan(usulX).length} nama untuk ${namaDivisiJadwal(usulX.divisi)}?` : 'Setujui usulan?'"
    >
      <div
        v-if="usulX"
        class="space-y-2 text-sm"
      >
        <p>
          {{ sisaUsulan(usulX).map(id => namaDw(pekerja, id)).join(', ') }} — langsung masuk lembar Jadwal Shift
          hari itu, <span class="num">{{ usulX.m }}–{{ usulX.s }}</span>.
        </p>
        <p
          v-if="bolehLihatUangDw(peran)"
          class="rounded-field bg-info/10 px-3 py-2"
        >
          Perkiraan upah: <b>{{ rupiah(biayaAjuanDw(set, { posisi: usulX.posisi, m: usulX.m, s: usulX.s }) * sisaUsulan(usulX).length) }}</b>
        </p>
      </div>
      <template #footer>
        <UButton
          label="Ya, setujui"
          color="success"
          @click="jalanUsul"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="usulOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="banyakOpen"
      :title="`Setujui ${ringkas.n} ajuan sekaligus?`"
    >
      <div class="space-y-2 text-sm">
        <p><b>{{ ringkas.n }} shift</b> untuk <b>{{ ringkas.orang }} daily worker</b> akan disetujui.</p>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="d in ringkas.divisi"
            :key="d.k"
            class="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted"
          >{{ namaDivisiJadwal(d.k) }} <b class="num">{{ d.n }}</b></span>
        </div>
        <p
          v-if="bolehLihatUangDw(peran)"
          class="rounded-field bg-info/10 px-3 py-2"
        >
          Perkiraan upah yang timbul: <b>{{ rupiah(ringkas.upah) }}</b> — muncul di halaman <b>Pembayaran</b>.
        </p>
        <p class="text-muted">
          Yang disetujui langsung tampil di kalender modul Jadwal Shift. Membatalkannya harus satu per satu.
        </p>
        <div
          v-if="lampauBanyak.length"
          class="rounded-field bg-warning/12 px-3 py-2"
        >
          <b>Melebihi panduan di {{ lampauBanyak.length }} hari/divisi:</b>
          <p
            v-for="(l, i) in lampauBanyak"
            :key="i"
          >
            {{ KONTEKS_LBL[l.konteks] }} {{ fTglP(l.tgl) }} · {{ namaDivisiJadwal(l.div) }}: panduan {{ l.kuota }}, jadi {{ l.jadi }}.
          </p>
          Bukan larangan — lanjutkan saja kalau memang perlu.
        </div>
      </div>
      <template #footer>
        <UButton
          :label="`Ya, setujui ${ringkas.n} shift`"
          color="success"
          @click="jalanBanyak"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="banyakOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <DwTunjuk
      v-model:open="tunjukOpen"
      :x="tunjukX"
      @assigned="selesaiTunjuk"
    />
  </AppPage>
</template>
