<!--
  Daily Worker › Dashboard (deploy/dw/index.html viewDashboard :2650-2780).

  The first question of the day: which DW are in today. Everything on the page
  is filtered by the divisions the viewer may see (head = their own, HRD = all,
  :2650); a filtered list without filtered numbers reads as data loss, so the
  stat cards obey the same filter and a note names the restriction.

  Rows are DISETUJUI only. Money follows attendance (alfaListDW/biayaListDW,
  :1157) and is hidden entirely for a head (F.12). Attendance only appears for
  today or earlier (:2689). Row actions sit on the row, not in a detail modal
  (F.23).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AjuanDw } from '~/utils/dw'
import { alfaListDw, biayaAjuanDw, biayaListDw, bolehKonfirmasiDw, bolehLihatUangDw, divisiTampakDw, durasiJamDw, hadirBelum, hadirTertunggakDw, jamListDw, kuotaDivDw, namaDw, panduanTeksDw, segeraDw, waNomorDw, waTeksAjuDw } from '~/utils/dw'
import { DIVISI, namaDivisiJadwal } from '~/utils/jadwal'
import { simpanHadirDw, useDwDashTgl, useDwDasar, useDwHadirTgl, useDwPax } from '~/composables/useDw'
import { fTgl, hariIni, tambahHari } from '~/utils/format'

definePageMeta({ access: ['dw'] })

const PER = 10
const toast = useToast()
const { set, pekerja, ajuan, permintaan, peran, pending, error, refresh } = useDwDasar()
const tgl = useDwDashTgl()
const pax = useDwPax()
const hal = ref(1)
watch(tgl, () => {
  hal.value = 1
})

const tampak = computed(() => divisiTampakDw(peran.value))
const punya = (x: { divisi: string }) => tampak.value.includes(x.divisi)

const hariItu = computed(() => ajuan.value.filter(a => a.tgl === tgl.value && punya(a)))
const setuju = computed(() => hariItu.value.filter(a => a.status === 'DISETUJUI')
  .sort((a, b) => String(a.m).localeCompare(String(b.m)) || namaDw(pekerja.value, a.dwId).localeCompare(namaDw(pekerja.value, b.dwId))))
const tunggu = computed(() => ajuan.value.filter(a => a.status === 'MENUNGGU' && punya(a)))
const tungguHariItu = computed(() => hariItu.value.filter(a => a.status === 'MENUNGGU'))
const mintaTunggu = computed(() => permintaan.value.filter(x => x.status === 'MENUNGGU' && punya(x)))

const biaya = computed(() => biayaListDw(set.value, setuju.value))
const jam = computed(() => jamListDw(set.value, setuju.value))
const alfa = computed(() => alfaListDw(setuju.value))
const belumKonfirmasi = computed(() => hadirTertunggakDw(ajuan.value, peran.value).length)
const lebih = computed(() => DIVISI.filter(d => tampak.value.includes(d.k)).map((d) => {
  const n = setuju.value.filter(a => a.divisi === d.k).length
  const k = kuotaDivDw(set.value, d.k, tgl.value, pax.value[tgl.value] ?? 0)
  return k > 0 && n > k ? `${d.n} ${n}/${k}` : ''
}).filter(Boolean))
const panduan = computed(() => !pekerja.value.length && !!peran.value.hrd)

const maksHal = computed(() => Math.max(1, Math.ceil(setuju.value.length / PER)))
const baris = computed(() => setuju.value.slice((Math.min(hal.value, maksHal.value) - 1) * PER, Math.min(hal.value, maksHal.value) * PER))

const kolom: TableColumn<AjuanDw>[] = [
  { id: 'no', header: 'No.' },
  { id: 'nama', header: 'Daily worker' },
  { id: 'divisi', header: 'Divisi' },
  { id: 'posisi', header: 'Posisi' },
  { id: 'jam', header: 'Jam' },
  { id: 'durasi', header: 'Durasi' },
]

/** The money column disappears entirely for a head (F.12), and the
 *  attendance column only exists for today or earlier (:2689). */
const uang = computed(() => bolehLihatUangDw(peran.value))
const kolomTabel = computed<TableColumn<AjuanDw>[]>(() => {
  const out = [...kolom]
  if (uang.value) out.push({ id: 'uang', header: () => h('span', { class: 'block text-end' }, 'Est. biaya') })
  if (lewat.value) out.push({ id: 'hadir', header: 'Kehadiran' })
  out.push({ id: 'aksi', header: '' })
  return out
})

const lewat = computed(() => tgl.value <= hariIni())
const bisaTombol = (a: AjuanDw) => lewat.value && bolehKonfirmasiDw(a, peran.value)
const linkHadir = (a: AjuanDw) => {
  useDwHadirTgl().value = a.tgl
  return '/dw/hadir'
}

async function setHadir(a: AjuanDw, nilai: '' | 'ALFA') {
  try {
    await simpanHadirDw(a.id, nilai, '')
    await refresh()
    toast.add({
      title: nilai === 'ALFA' ? 'Ditandai tidak hadir — tidak ikut dibayar' : 'Penandaan dibatalkan — kembali belum dikonfirmasi',
      color: nilai === 'ALFA' ? 'info' : 'success',
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
</script>

<template>
  <AppPage
    title="Dashboard"
    description="Daily worker yang masuk hari ini."
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
      description="Panduan ini hilang sendiri begitu ada DW terdaftar."
    >
      <ol class="grid gap-3 lg:grid-cols-3">
        <li class="rounded-field bg-muted p-3">
          <p class="font-semibold text-highlighted">
            1. Daftarkan daily worker dulu
          </p>
          <p class="mt-1 text-sm text-muted">
            Buka <b>Database DW</b> lalu tambahkan orangnya: nama, no HP, divisi, posisi, dan tujuan pembayaran.
            DW <b>bukan</b> pegawai tetap dan <b>tidak punya akun</b> — nomornya dipakai untuk mengabarinya lewat WhatsApp.
          </p>
        </li>
        <li class="rounded-field bg-muted p-3">
          <p class="font-semibold text-highlighted">
            2. Ajuan bisa datang dari dua arah
          </p>
          <p class="mt-1 text-sm text-muted">
            Head divisi meminta lewat <b>Permintaan DW</b> — bisa menyebut jumlahnya saja lalu HRD yang menunjuk,
            atau langsung menunjuk orangnya. Yang sudah bernama masuk ke <b>Antrean Pengajuan</b>.
          </p>
        </li>
        <li class="rounded-field bg-muted p-3">
          <p class="font-semibold text-highlighted">
            3. Upah dihitung otomatis dari tarif posisi
          </p>
          <p class="mt-1 text-sm text-muted">
            Isi tarif tiap posisi di <b>Pengaturan</b>. Shift yang <b>disetujui</b> langsung muncul di
            <b>Pembayaran</b> beserta nominal dan daftar transfernya.
          </p>
        </li>
      </ol>
      <div class="mt-4 flex flex-wrap gap-2">
        <UButton
          label="Tambah daily worker"
          trailing-icon="i-lucide-arrow-right"
          to="/dw/pekerja"
          size="sm"
        />
        <UButton
          label="Atur tarif dulu"
          color="neutral"
          variant="ghost"
          to="/dw/pengaturan"
          size="sm"
        />
      </div>
    </AppPanel>

    <AppPanel>
      <template #head>
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <h2 class="text-lg font-semibold text-highlighted">
            {{ fTgl(tgl) }}
          </h2>
          <AppStatus
            v-if="tgl !== hariIni()"
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
        {{ panduanTeksDw(set, tgl, pax[tgl] ?? 0) }}
      </p>
      <div
        v-if="!peran.hrd && !peran.admin && tampak.length"
        class="mb-3 rounded-field bg-info/10 px-3 py-2 text-sm"
      >
        Halaman ini hanya menampilkan divisi <b>{{ tampak.map(namaDivisiJadwal).join(', ') }}</b>. HRD melihat seluruh divisi.
      </div>
      <div
        v-else-if="!peran.hrd && !peran.admin"
        class="mb-3 rounded-field bg-warning/12 px-3 py-2 text-sm"
      >
        Akun Anda belum tercatat sebagai head divisi mana pun, jadi belum ada pengajuan yang bisa ditampilkan di sini.
        Yang menetapkannya HRD, di modul <b>Jadwal Shift → Pengaturan</b>.
      </div>
      <div
        v-if="lebih.length"
        class="mb-3 rounded-field bg-warning/12 px-3 py-2 text-sm"
      >
        Lebih dari panduan: <b>{{ lebih.join(', ') }}</b>. Bukan larangan — pastikan saja anggarannya memang disiapkan.
      </div>

      <AppStatGrid>
        <AppStat
          label="DW masuk"
          icon="i-lucide-user-check"
          :value="setuju.length"
          :sub="alfa ? `${alfa} tidak hadir` : undefined"
          tone="success"
        />
        <AppStat
          label="Menunggu (hari ini)"
          icon="i-lucide-hourglass"
          :value="tungguHariItu.length"
          tone="warning"
        />
        <AppStat
          label="Menunggu (semua)"
          icon="i-lucide-inbox"
          :value="tunggu.length"
          tone="info"
        />
        <AppStat
          label="Permintaan head"
          icon="i-lucide-mail"
          :value="mintaTunggu.length"
        />
        <AppStat
          label="Belum dikonfirmasi"
          icon="i-lucide-circle-help"
          :value="belumKonfirmasi"
          :tone="belumKonfirmasi ? 'warning' : 'gold'"
        />
        <AppStat
          label="Total jam"
          icon="i-lucide-clock"
          :value="Math.round(jam * 10) / 10"
        />
        <AppStat
          v-if="bolehLihatUangDw(peran)"
          label="Est. biaya"
          icon="i-lucide-banknote"
          :value="rupiah(biaya)"
          :sub="alfa ? `${alfa} tidak hadir tidak dihitung` : undefined"
          tone="gold"
        />
      </AppStatGrid>
    </AppPanel>

    <AppPanel
      title="Daily worker"
      icon="i-lucide-users"
      :count="setuju.length"
      :description="tgl <= hariIni() ? 'Dasar pembayarannya: siapa yang benar-benar datang.' : 'Shift malam ini; kehadiran bisa dikonfirmasi sesudahnya.'"
      flush
    >
      <UTable
        class="hidden lg:block"
        :data="baris"
        :columns="kolomTabel"
        :loading="!setuju.length && !ajuan.length"
        empty="Belum ada daily worker yang disetujui untuk tanggal ini."
      >
        <template #no-cell="{ row }">
          <span class="text-muted num">{{ (Math.min(hal, maksHal) - 1) * PER + row.index + 1 }}</span>
        </template>
        <template #nama-cell="{ row }">
          <p class="font-semibold text-highlighted">
            {{ namaDw(pekerja, row.original.dwId) }}
          </p>
        </template>
        <template #divisi-cell="{ row }">
          {{ namaDivisiJadwal(row.original.divisi) }}
        </template>
        <template #posisi-cell="{ row }">
          {{ row.original.posisi || '—' }}
        </template>
        <template #jam-cell="{ row }">
          <span class="num">{{ row.original.m }}–{{ row.original.s }}</span>
        </template>
        <template #durasi-cell="{ row }">
          <span class="num">{{ durasiJamDw(row.original.m, row.original.s) }} jam</span>
        </template>
        <template #uang-cell="{ row }">
          <span
            v-if="bolehLihatUangDw(peran)"
            class="num"
          >{{ rupiah(biayaAjuanDw(set, row.original)) }}</span>
          <span
            v-else
            class="text-dimmed"
          >—</span>
        </template>
        <template #hadir-cell="{ row }">
          <DwHadirPil
            v-if="lewat"
            :a="row.original"
            size="sm"
          />
          <span
            v-else
            class="text-dimmed"
          >—</span>
        </template>
        <template #aksi-cell="{ row }">
          <div class="flex flex-wrap justify-end gap-1.5">
            <UButton
              label="Chat"
              icon="i-lucide-message-circle"
              color="success"
              variant="soft"
              size="xs"
              @click="chat(row.original)"
            />
            <template v-if="bisaTombol(row.original)">
              <UButton
                v-if="row.original.hadir === 'ALFA'"
                label="Batal"
                icon="i-lucide-undo-2"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="setHadir(row.original, '')"
              />
              <UButton
                v-else
                label="Tidak hadir"
                icon="i-lucide-user-x"
                color="error"
                variant="ghost"
                size="xs"
                @click="setHadir(row.original, 'ALFA')"
              />
              <UButton
                :label="hadirBelum(row.original) ? 'Kehadiran' : 'Ubah kehadiran'"
                color="neutral"
                variant="outline"
                size="xs"
                :to="linkHadir(row.original)"
              />
            </template>
          </div>
        </template>
      </UTable>

      <div class="divide-y divide-default lg:hidden">
        <article
          v-for="(a, i) in baris"
          :key="a.id"
          class="space-y-2 px-4 py-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">
                <span class="me-1.5 text-muted num">{{ (Math.min(hal, maksHal) - 1) * PER + i + 1 }}</span>{{ namaDw(pekerja, a.dwId) }}
              </p>
              <p class="text-sm text-muted">
                {{ namaDivisiJadwal(a.divisi) }} · {{ a.posisi || '—' }} · <span class="num">{{ a.m }}–{{ a.s }}</span>
              </p>
            </div>
            <DwHadirPil
              v-if="lewat"
              :a="a"
              size="sm"
            />
          </div>
          <p
            v-if="bolehLihatUangDw(peran)"
            class="text-sm text-muted"
          >
            Est. biaya <b class="text-highlighted num">{{ rupiah(biayaAjuanDw(set, a)) }}</b>
          </p>
          <div class="flex flex-wrap gap-1.5">
            <UButton
              label="Chat"
              icon="i-lucide-message-circle"
              color="success"
              variant="soft"
              size="xs"
              @click="chat(a)"
            />
            <template v-if="bisaTombol(a)">
              <UButton
                v-if="a.hadir === 'ALFA'"
                label="Batal"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="setHadir(a, '')"
              />
              <UButton
                v-else
                label="Tidak hadir"
                color="error"
                variant="ghost"
                size="xs"
                @click="setHadir(a, 'ALFA')"
              />
              <UButton
                :label="hadirBelum(a) ? 'Kehadiran' : 'Ubah kehadiran'"
                color="neutral"
                variant="outline"
                size="xs"
                :to="linkHadir(a)"
              />
            </template>
          </div>
        </article>
        <div
          v-if="pending && !baris.length"
          class="space-y-2 p-4"
        >
          <!-- Loading cards mirror the schedule list below. -->
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
          Belum ada daily worker yang disetujui untuk tanggal ini.
        </p>
      </div>

      <JadwalPager
        v-model="hal"
        :total="setuju.length"
        :per="PER"
        satuan="daily worker"
      />
    </AppPanel>

    <AppPanel
      v-if="mintaTunggu.length"
      title="Permintaan head yang menunggu"
      icon="i-lucide-mail"
      :count="mintaTunggu.length"
    >
      <div class="divide-y divide-default">
        <div
          v-for="x in mintaTunggu.slice(0, 5)"
          :key="x.id"
          class="flex items-center justify-between gap-3 py-2.5"
        >
          <div class="min-w-0">
            <p class="font-semibold text-highlighted">
              {{ namaDivisiJadwal(x.divisi) }} — {{ x.jumlah }} orang
            </p>
            <p class="text-sm text-muted">
              <span class="num">{{ fTgl(x.tgl) }}</span> · <span class="num">{{ x.m }}–{{ x.s }}</span> · {{ x.posisi || 'DW' }}
              <template v-if="x.dibuatOleh">
                · diminta {{ x.dibuatOleh }}
              </template>
            </p>
          </div>
          <span
            v-if="segeraDw(x.tgl)"
            class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
            :class="segeraDw(x.tgl)!.tone === 'lewat' ? 'bg-error/12 text-error' : 'bg-primary-100 text-primary-800'"
          >{{ segeraDw(x.tgl)!.teks }}</span>
        </div>
      </div>
      <template #actions>
        <UButton
          label="Buka permintaan"
          color="neutral"
          variant="ghost"
          size="sm"
          to="/dw/permintaan"
        />
      </template>
    </AppPanel>

    <AppPanel
      v-if="tunggu.length"
      title="Menunggu keputusan Anda"
      icon="i-lucide-inbox"
      :count="tunggu.length"
    >
      <div class="divide-y divide-default">
        <div
          v-for="a in tunggu.slice(0, 5)"
          :key="a.id"
          class="flex items-center justify-between gap-3 py-2.5"
        >
          <div class="min-w-0">
            <p class="font-semibold text-highlighted">
              {{ namaDw(pekerja, a.dwId) }}
            </p>
            <p class="text-sm text-muted">
              <span class="num">{{ fTgl(a.tgl) }}</span> · {{ namaDivisiJadwal(a.divisi) }} · <span class="num">{{ a.m }}–{{ a.s }}</span>
            </p>
          </div>
          <DwStatus
            :status="a.status"
            size="sm"
          />
        </div>
      </div>
      <template #actions>
        <UButton
          label="Buka antrean"
          color="neutral"
          variant="ghost"
          size="sm"
          to="/dw/antrean"
        />
      </template>
    </AppPanel>
  </AppPage>
</template>
