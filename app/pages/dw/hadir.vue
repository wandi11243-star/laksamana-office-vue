<!--
  Konfirmasi Kehadiran (deploy/dw/index.html viewHadir :6750-6824). Who really
  came — this is what payment follows (hadirDibayar). Approved rows only; a
  head only touches their own divisions, and the buttons are decided in one
  place so a caller cannot forget the rule (:6566).

  A date that has not passed yet offers Chat only: tonight's shift cannot be
  confirmed, and a button that always exists stops meaning anything (:6699).
  ALFA is reversible in one tap (the button becomes Batal, :6732).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AjuanDw } from '~/utils/dw'
import { bolehBukaDw, bolehKonfirmasiDw, durasiJamDw, hadirBelum, hadirNilai, KONTEKS_LBL, konteksHariDw, namaDw, waNomorDw, waTeksAjuDw } from '~/utils/dw'
import { namaDivisiJadwal } from '~/utils/jadwal'
import { simpanHadirDw, useDwDasar, useDwHadirTgl, useDwPax } from '~/composables/useDw'
import { fTgl, hariIni, tambahHari } from '~/utils/format'

definePageMeta({ access: ['dw'] })

const toast = useToast()
const { set, pekerja, ajuan, peran, pending, error, refresh } = useDwDasar()
const tgl = useDwHadirTgl()
const pax = useDwPax()

/** Matrix-aware gate (T-10): the default is HRD+head, an admin may loosen it. */
const bolehHalaman = computed(() => bolehBukaDw(set.value, peran.value, 'hadir'))

const hariItu = computed(() => ajuan.value
  .filter(a => a.tgl === tgl.value && a.status === 'DISETUJUI' && bolehKonfirmasiDw(a, peran.value))
  .sort((a, b) => String(a.divisi).localeCompare(String(b.divisi)) || namaDw(pekerja.value, a.dwId).localeCompare(namaDw(pekerja.value, b.dwId))))
const belum = computed(() => hariItu.value.filter(hadirBelum).length)
const hadirN = computed(() => hariItu.value.filter(a => ['HADIR', 'TELAT'].includes(hadirNilai(a))).length)
const alfaN = computed(() => hariItu.value.filter(a => hadirNilai(a) === 'ALFA').length)
const nanti = computed(() => tgl.value > hariIni())
const konteks = computed(() => KONTEKS_LBL[konteksHariDw(tgl.value, pax.value[tgl.value] ?? 0)])

// Skeleton only for the first load: day tabs reuse the same overview slice, so later loads keep the old cards.
const statMemuat = computed(() => pending.value && !ajuan.value.length && !pekerja.value.length)

const kolom: TableColumn<AjuanDw>[] = [
  { id: 'no', header: 'No.' },
  { id: 'nama', header: 'Daily worker' },
  { id: 'divisi', header: 'Divisi / Posisi' },
  { id: 'jam', header: 'Jam' },
  { id: 'hadir', header: 'Kehadiran' },
  { id: 'aksi', header: () => h('span', { class: 'block text-end' }, 'Tindakan') },
]

/** Mobile action buttons; the three attendance states with their tones. */
const opsiHadir = [
  { v: 'HADIR', l: 'Hadir', c: 'success', var: 'solid' },
  { v: 'TELAT', l: 'Telat', c: 'neutral', var: 'outline' },
  { v: 'ALFA', l: 'Tidak hadir', c: 'error', var: 'soft' },
] as const

async function setHadir(a: AjuanDw, nilai: '' | 'HADIR' | 'TELAT' | 'ALFA') {
  try {
    await simpanHadirDw(a.id, nilai, '')
    await refresh()
    toast.add({
      title: nilai === 'ALFA'
        ? 'Ditandai tidak hadir — tidak ikut dibayar'
        : nilai === 'TELAT'
          ? 'Ditandai telat — tetap dibayar penuh'
          : nilai === 'HADIR'
            ? 'Ditandai hadir'
            : 'Penandaan dibatalkan — kembali belum dikonfirmasi',
      color: 'success',
    })
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}
function chat(a: AjuanDw) {
  const p = pekerja.value.find(x => x.id === a.dwId)
  const no = waNomorDw(p?.hp)
  if (!no) return toast.add({ title: `Nomor HP ${namaDw(pekerja.value, a.dwId)} belum diisi di Database DW`, color: 'error' })
  window.open(`https://wa.me/${no}?text=${encodeURIComponent(waTeksAjuDw(a, namaDw(pekerja.value, a.dwId)))}`, '_blank', 'noopener')
}

const gantiOpen = ref(false)
const gantiA = ref<AjuanDw | null>(null)
function bukaGanti(a: AjuanDw) {
  if (!bolehKonfirmasiDw(a, peran.value)) return toast.add({ title: 'Anda tidak berhak mengubah shift divisi itu', color: 'error' })
  gantiA.value = a
  gantiOpen.value = true
}
async function selesaiGanti(pesan: string) {
  toast.add({ title: pesan, color: 'success' })
  await refresh()
}
</script>

<template>
  <AppPage
    title="Konfirmasi kehadiran"
    description="Siapa yang benar-benar datang — inilah dasar pembayarannya."
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

    <template v-else>
      <AppPanel>
        <template #head>
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <h2 class="text-lg font-semibold text-highlighted">
              {{ fTgl(tgl) }}
            </h2>
            <AppStatus
              v-if="nanti"
              size="sm"
              color="info"
              icon="i-lucide-calendar-clock"
            >
              belum lewat
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
              v-if="tgl !== hariIni()"
              label="Kembali ke hari ini"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="tgl = hariIni()"
            />
          </div>
        </template>

        <p class="mb-3 text-sm text-muted">
          {{ konteks }} · yang ditandai <b>tidak hadir</b> tidak ikut di daftar transfer. Yang
          <b>belum dikonfirmasi</b> tetap dibayar — supaya riwayat lama yang memang tidak pernah punya catatan
          kehadiran tidak mendadak jadi Rp 0 — tapi jumlahnya disebut di halaman Pembayaran.
        </p>
        <p
          v-if="nanti"
          class="mb-3 rounded-field bg-info/10 px-3 py-2 text-sm"
        >
          Tanggal ini <b>belum lewat</b>. Kehadiran biasanya dikonfirmasi sesudah shiftnya selesai; sebelum itu yang
          berguna tombol <b>Chat</b> untuk memastikan orangnya bisa hadir.
        </p>
        <p
          v-if="!peran.hrd && (peran.divisi || []).length"
          class="mb-3 rounded-field bg-info/10 px-3 py-2 text-sm"
        >
          Head hanya melihat dan menandai divisi sendiri. HRD melihat seluruh divisi.
        </p>

        <AppStatGrid
          :loading="statMemuat"
          :count="4"
        >
          <AppStat
            label="Disetujui"
            icon="i-lucide-clipboard-check"
            :value="hariItu.length"
          />
          <AppStat
            label="Hadir / telat"
            icon="i-lucide-user-check"
            :value="hadirN"
            tone="success"
          />
          <AppStat
            label="Tidak hadir"
            icon="i-lucide-user-x"
            :value="alfaN"
            :tone="alfaN ? 'error' : 'gold'"
          />
          <AppStat
            label="Belum dikonfirmasi"
            icon="i-lucide-circle-help"
            :value="belum"
            :tone="belum ? 'warning' : 'gold'"
          />
        </AppStatGrid>
      </AppPanel>

      <AppPanel
        title="Daftar shift"
        icon="i-lucide-list-checks"
        :count="hariItu.length"
        flush
      >
        <UTable
          class="hidden lg:block"
          :data="hariItu"
          :columns="kolom"
          :loading="!ajuan.length"
          empty="Tidak ada daily worker yang disetujui untuk tanggal ini."
        >
          <template #no-cell="{ row }">
            <span class="text-muted num">{{ row.index + 1 }}</span>
          </template>
          <template #nama-cell="{ row }">
            <p class="font-semibold text-highlighted">
              {{ namaDw(pekerja, row.original.dwId) }}
            </p>
            <p
              v-if="row.original.hadirNota"
              class="text-[13px] text-muted"
            >
              {{ row.original.hadirNota }}
            </p>
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
          <template #hadir-cell="{ row }">
            <DwHadirPil
              :a="row.original"
              size="sm"
            />
            <p
              v-if="row.original.hadirOleh"
              class="text-[12px] text-muted"
            >
              oleh {{ row.original.hadirOleh }}
            </p>
          </template>
          <template #aksi-cell="{ row }">
            <div class="flex flex-wrap justify-end gap-1.5">
              <template v-if="!nanti && bolehKonfirmasiDw(row.original, peran)">
                <UButton
                  label="Hadir"
                  color="success"
                  size="xs"
                  :disabled="hadirNilai(row.original) === 'HADIR'"
                  @click="setHadir(row.original, 'HADIR')"
                />
                <UButton
                  label="Telat"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  :disabled="hadirNilai(row.original) === 'TELAT'"
                  @click="setHadir(row.original, 'TELAT')"
                />
                <UButton
                  label="Tidak hadir"
                  color="error"
                  variant="ghost"
                  size="xs"
                  :disabled="hadirNilai(row.original) === 'ALFA'"
                  @click="setHadir(row.original, 'ALFA')"
                />
                <UButton
                  v-if="hadirNilai(row.original) === 'ALFA'"
                  label="Batal"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  loading-auto
                  @click="setHadir(row.original, '')"
                />
                <UButton
                  label="Ganti orang"
                  icon="i-lucide-repeat"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  @click="bukaGanti(row.original)"
                />
              </template>
              <span
                v-else-if="!nanti"
                class="text-dimmed"
              >—</span>
              <UButton
                label="Chat"
                icon="i-lucide-message-circle"
                color="success"
                variant="soft"
                size="xs"
                @click="chat(row.original)"
              />
            </div>
          </template>
        </UTable>

        <div class="divide-y divide-default lg:hidden">
          <article
            v-for="(a, i) in hariItu"
            :key="a.id"
            class="space-y-2 px-4 py-3"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="font-semibold text-highlighted">
                  <span class="me-1.5 text-muted num">{{ i + 1 }}</span>{{ namaDw(pekerja, a.dwId) }}
                </p>
                <p class="text-sm text-muted">
                  {{ namaDivisiJadwal(a.divisi) }} · {{ a.posisi || '—' }} · <span class="num">{{ a.m }}–{{ a.s }}</span>
                </p>
              </div>
              <DwHadirPil
                :a="a"
                size="sm"
              />
            </div>
            <div class="flex flex-wrap gap-1.5">
              <template v-if="!nanti && bolehKonfirmasiDw(a, peran)">
                <UButton
                  v-for="o in opsiHadir"
                  :key="o.v"
                  :label="o.l"
                  :color="o.c"
                  :variant="o.var"
                  size="xs"
                  :disabled="hadirNilai(a) === o.v"
                  @click="setHadir(a, o.v)"
                />
                <UButton
                  v-if="hadirNilai(a) === 'ALFA'"
                  label="Batal"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  loading-auto
                  @click="setHadir(a, '')"
                />
                <UButton
                  label="Ganti orang"
                  icon="i-lucide-repeat"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  @click="bukaGanti(a)"
                />
              </template>
              <UButton
                label="Chat"
                icon="i-lucide-message-circle"
                color="success"
                variant="soft"
                size="xs"
                @click="chat(a)"
              />
            </div>
          </article>
          <div
            v-if="pending && !hariItu.length"
            class="space-y-2 p-4"
          >
            <!-- Loading cards mirror the attendance list below. -->
            <USkeleton
              v-for="i in 3"
              :key="i"
              class="h-16 w-full rounded-panel"
            />
          </div>
          <p
            v-else-if="!hariItu.length"
            class="px-4 py-8 text-center text-muted"
          >
            Tidak ada daily worker yang disetujui untuk tanggal ini.
          </p>
        </div>
      </AppPanel>
    </template>

    <DwGantiOrang
      v-model:open="gantiOpen"
      :a="gantiA"
      @done="selesaiGanti"
    />
  </AppPage>
</template>
