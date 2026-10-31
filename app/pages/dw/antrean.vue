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
import type { AjuanDw, PermintaanDw, EntriAntrean } from '~/utils/dw'
import { biayaAjuanDw, biayaPermintaanDw, bolehBukaDw, bolehLihatUangDw, durasiJamDw, entriAntreanDw, entriPerluDikerjakan, jejakDw, kataPutusanDw, konteksHariDw, KONTEKS_LBL, lampauiBanyakDw, panduanTeksDw, mintaBelumTuntas, mintaOrang, mintaTerpenuhi, namaDw, ringkasAjuanDw, segeraDw } from '~/utils/dw'
import { namaDivisiJadwal } from '~/utils/jadwal'
import { putusAjuanDw, putusBanyakDw, putusPermintaanDw, tugaskanDw, useDwDasar, useDwPax } from '~/composables/useDw'
import { fTgl, fTglP, tglPanjang } from '~/utils/format'

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

const nMinta = computed(() => menunggu.value.filter(e => e.jenis === 'minta').length)
const nAjuan = computed(() => menunggu.value.filter(e => e.jenis === 'ajuan').length)

/**
 * Rows of the page, with a date header before each new day — Antrian only
 * (:3973): the other tabs sort by decision time, where a date header would
 * repeat without grouping anything.
 */
const baris = computed(() => {
  let kini = ''
  return daftar.value.map((e) => {
    let grup: { tgl: string, menunggu: number, disetujui: number, ids: string[] } | null = null
    if (tab.value === 'antri' && e.tgl !== kini) {
      kini = e.tgl
      const seHari = menunggu.value.filter(z => z.tgl === e.tgl)
      grup = {
        tgl: e.tgl,
        menunggu: seHari.length,
        disetujui: ajuan.value.filter(a => a.tgl === e.tgl && a.status === 'DISETUJUI').length,
        ids: seHari.filter(z => z.jenis === 'ajuan').map(z => z.id),
      }
    }
    return { e, grup }
  })
})
const konteks = (tgl: string) => KONTEKS_LBL[konteksHariDw(tgl, pax.value[tgl] ?? 0)]
const panduan = (tgl: string) => panduanTeksDw(set.value, tgl, pax.value[tgl] ?? 0)
/** The small "diajukan/diminta <who> · <when>" line under the name (:4247). */
const jejakMasuk = (e: EntriAntrean) => jejakDw(e.jenis === 'ajuan' ? 'diajukan' : 'diminta', e.x.dibuatOleh, e.x.dibuatAt)
const jejakPutus = (e: EntriAntrean) => jejakDw(kataPutusanDw(e.status), e.x.putusOleh, e.x.putusAt)

// "+ Minta DW" sits on this desk too (:4033).
const mintaOpen = ref(false)

const bolehAksi = computed(() => peran.value.hrd)

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
    description="Setujui atau tolak permintaan & pengajuan DW."
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
      title="Antrean Pengajuan DW"
      icon="i-lucide-inbox"
      flush
    >
      <template #actions>
        <UButton
          label="Minta DW"
          icon="i-lucide-plus"
          size="sm"
          @click="mintaOpen = true"
        />
      </template>
      <div class="space-y-3 p-4 lg:p-5">
        <p
          v-if="menunggu.length"
          class="text-sm text-muted"
        >
          <b class="num">{{ menunggu.length }}</b> menunggu tindakan Anda<template v-if="nMinta && nAjuan">
            — {{ nMinta }} permintaan head, {{ nAjuan }} pengajuan.
          </template><template v-else-if="nMinta">
            — semuanya permintaan head.
          </template><template v-else>
            .
          </template>
          <template v-if="nBelumLengkap">
            <b class="num">{{ nBelumLengkap }}</b> di antaranya sudah disetujui tapi orangnya belum lengkap.
          </template>
        </p>
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
            {{ tab === 'antri' ? 'Yang belum diputuskan, dikelompokkan per tanggal.' : tab === 'riwayat' ? 'Keputusan yang sudah diambil, terbaru di atas.' : 'Seluruhnya; yang menunggu di atas.' }}
          </span>
        </div>
      </div>

      <table class="hidden w-full text-sm lg:table">
        <thead class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
          <tr>
            <th class="px-4 py-2">
              Tanggal
            </th>
            <th class="px-4 py-2">
              Pengajuan
            </th>
            <th class="px-4 py-2">
              Divisi / Posisi
            </th>
            <th class="px-4 py-2">
              Jam
            </th>
            <th class="px-4 py-2 text-end">
              Upah
            </th>
            <th class="px-4 py-2">
              Status
            </th>
            <th class="px-4 py-2" />
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-if="pending && !daftar.length">
            <td
              colspan="7"
              class="space-y-2 px-4 py-4"
            >
              <!-- Loading rows mirror the queue table below. -->
              <USkeleton
                v-for="i in 4"
                :key="i"
                class="h-10 w-full"
              />
            </td>
          </tr>
          <tr v-else-if="!daftar.length">
            <td
              colspan="7"
              class="px-4 py-8 text-center text-muted"
            >
              {{ kosongTeks }}
            </td>
          </tr>
          <template
            v-for="{ e, grup } in baris"
            :key="`${e.jenis}-${e.id}`"
          >
            <tr
              v-if="grup"
              class="bg-muted"
            >
              <td
                colspan="7"
                class="px-4 py-2"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <b class="text-highlighted">{{ tglPanjang(grup.tgl) }}</b>
                  <AppStatus size="sm">
                    {{ grup.menunggu }} menunggu
                  </AppStatus>
                  <AppStatus size="sm">
                    {{ grup.disetujui }} sudah disetujui
                  </AppStatus>
                  <AppStatus
                    size="sm"
                    :title="panduan(grup.tgl)"
                  >
                    {{ konteks(grup.tgl) }}
                  </AppStatus>
                  <UButton
                    v-if="bolehAksi && grup.ids.length > 1"
                    :label="`Setujui ${grup.ids.length} pengajuan`"
                    color="success"
                    size="xs"
                    @click="bukaBanyak(grup.ids)"
                  />
                </div>
              </td>
            </tr>
            <tr :class="entriPerluDikerjakan(ajuan, e) && 'bg-warning/8'">
              <td class="px-4 py-2 align-top">
                <span class="num">{{ fTglP(e.tgl) }}</span>
                <p
                  v-if="segeraDw(e.tgl)"
                  class="text-[13px] font-semibold"
                  :class="segeraDw(e.tgl)!.tone === 'lewat' ? 'text-error' : 'text-primary-700'"
                >
                  {{ segeraDw(e.tgl)!.teks }}
                </p>
              </td>
              <td class="px-4 py-2 align-top">
                <p class="flex flex-wrap items-center gap-1.5">
                  <AppStatus
                    size="sm"
                    :color="e.jenis === 'ajuan' ? 'info' : 'vip'"
                  >
                    {{ e.jenis === 'ajuan' ? 'Pengajuan' : 'Permintaan' }}
                  </AppStatus>
                  <b class="text-highlighted">
                    <template v-if="e.jenis === 'ajuan'">{{ namaDw(pekerja, (e.x as AjuanDw).dwId) }}</template>
                    <template v-else>{{ (e.x as PermintaanDw).jumlah }} orang</template>
                  </b>
                </p>
                <p
                  v-if="e.jenis === 'minta' && (e.x as PermintaanDw).usulan.length"
                  class="text-[13px] text-primary-700"
                >
                  usul: {{ (e.x as PermintaanDw).usulan.map(id => namaDw(pekerja, id)).join(', ') }}
                </p>
                <p
                  v-if="jejakMasuk(e)"
                  class="text-[12px] text-muted"
                >
                  {{ jejakMasuk(e) }}
                </p>
                <p
                  v-if="e.x.catatan"
                  class="text-[12px] text-muted"
                >
                  {{ e.x.catatan }}
                </p>
              </td>
              <td class="px-4 py-2 align-top">
                {{ namaDivisiJadwal(e.divisi) }}
                <p class="text-[13px] text-muted">
                  {{ e.x.posisi || '—' }}
                </p>
              </td>
              <td class="px-4 py-2 align-top">
                <span class="num">{{ e.x.m }}–{{ e.x.s }}</span>
                <p class="text-[13px] text-muted num">
                  {{ durasiJamDw(e.x.m, e.x.s) }} jam
                </p>
              </td>
              <td class="px-4 py-2 text-end align-top">
                <span
                  v-if="bolehLihatUangDw(peran)"
                  class="num"
                >
                  <template v-if="e.jenis === 'ajuan'">{{ rupiah(biayaAjuanDw(set, e.x as AjuanDw)) }}</template>
                  <template v-else>± {{ rupiah(biayaPermintaanDw(set, e.x as PermintaanDw)) }}</template>
                </span>
                <span
                  v-else
                  class="text-dimmed"
                >—</span>
              </td>
              <td class="px-4 py-2 align-top">
                <DwStatus
                  :status="e.status"
                  size="sm"
                />
                <p
                  v-if="e.jenis === 'minta' && e.status === 'DISETUJUI'"
                  class="text-[12px] text-muted"
                >
                  {{ mintaTerpenuhi(ajuan, e.id) }} dari {{ (e.x as PermintaanDw).jumlah }} terpenuhi
                </p>
                <p
                  v-if="jejakPutus(e)"
                  class="text-[12px] text-muted"
                >
                  {{ jejakPutus(e) }}
                </p>
                <p
                  v-if="e.x.putusNota"
                  class="text-[12px] text-error"
                >
                  "{{ e.x.putusNota }}"
                </p>
              </td>
              <td class="px-4 py-2 align-top">
                <div class="flex flex-wrap justify-end gap-1.5">
                  <template v-if="bolehAksi && entriPerluDikerjakan(ajuan, e)">
                    <template v-if="e.jenis === 'ajuan'">
                      <UButton
                        label="Setuju"
                        icon="i-lucide-check"
                        color="success"
                        size="xs"
                        @click="mintaSetuju(e.x as AjuanDw)"
                      />
                    </template>
                    <template v-else>
                      <UButton
                        v-if="sisaUsulan(e.x as PermintaanDw).length"
                        :label="`Setuju & pilih ${sisaUsulan(e.x as PermintaanDw).length} DW`"
                        color="success"
                        size="xs"
                        @click="mintaUsul(e.x as PermintaanDw)"
                      />
                      <UButton
                        label="Pilih DW"
                        icon="i-lucide-user-round-plus"
                        color="neutral"
                        variant="outline"
                        size="xs"
                        @click="bukaTunjuk(e.x as PermintaanDw)"
                      />
                    </template>
                    <UButton
                      label="Tolak"
                      icon="i-lucide-x"
                      color="error"
                      variant="ghost"
                      size="xs"
                      @click="mintaTolak(e)"
                    />
                  </template>
                  <UButton
                    v-else-if="bolehAksi"
                    label="Kembalikan"
                    icon="i-lucide-undo-2"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    @click="aksiKembali(e)"
                  />
                  <span
                    v-else
                    class="text-dimmed"
                  >—</span>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

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
        <div
          v-if="pending && !daftar.length"
          class="space-y-2 p-4"
        >
          <!-- Loading cards mirror the queue below. -->
          <USkeleton
            v-for="i in 3"
            :key="i"
            class="h-16 w-full rounded-panel"
          />
        </div>
        <p
          v-else-if="!daftar.length"
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
    <DwMinta
      v-model:open="mintaOpen"
      @sent="refresh"
    />
  </AppPage>
</template>
