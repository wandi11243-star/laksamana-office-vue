<!--
  Jadwal Shift › Pengajuan — off, izin, cuti and tukar shift
  (deploy/jadwal/index.html viewPengajuan :4595-5132).

  Two steps (F.5): the head of the requester's Divisi forwards
  (MENUNGGU → MENUNGGU_HRD, "Teruskan ke HRD"), then HRD (= admin of the
  module) approves (→ DISETUJUI, "Sahkan"); either may reject. HRD never takes
  the first step, except for a Divisi that has no head at all — otherwise those
  requests would hang forever (:4497). The server enforces the same.

  Approving writes the cells for the requested shift (OFF/IZIN/CUTI, or the
  shift a TUKAR asked for) through PUT /jadwal/cells, as the old client did
  (`kirimPutusan` :5088): the decision endpoint itself does not touch cells.
  A request without a shift is approved without touching the sheet, and the
  confirmation says so.

  The three tabs are always there with their counts; all three page by 20.
  The name search appears from 8 rows. A head sees every request of their
  Divisi, whatever its status, so a forwarded one does not vanish (:4521).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { PengajuanJadwal } from '~/composables/useJadwal'
import {
  AJU_KE_SHIFT, JENIS_AJU, ajuBerjalan, bisaLihatAju, bisaPutusHead, bisaPutusHRD,
  divisiKuasa, namaDivisiJadwal, shiftDef,
} from '~/utils/jadwal'
import { decideRequest, deleteRequest, saveCells, useJadwalDasar, useJadwalRequests } from '~/composables/useJadwal'
import { fTgl, fTglP, tambahHari } from '~/utils/format'

definePageMeta({ access: ['jadwal'] })

const PER = 20
const toast = useToast()
const { set, kru, peran, kruById, divisiDari, error } = useJadwalDasar()
const { data: requests, status, refresh } = useJadwalRequests()

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

const div = (a: PengajuanJadwal) => divisiDari(a.userId)
const nama = (a: PengajuanJadwal) => kruById(a.userId)?.name ?? '—'

const urut = computed(() => (requests.value ?? [])
  .filter(a => bisaLihatAju(peran.value, a, div(a)))
  .sort((x, y) => (ajuBerjalan(x) ? 0 : 1) - (ajuBerjalan(y) ? 0 : 1) || (y.dibuatAt || 0) - (x.dibuatAt || 0)))
const menunggu = computed(() => urut.value.filter(ajuBerjalan))
const sudah = computed(() => urut.value.filter(a => !ajuBerjalan(a)))
const sumber = computed(() => (tab.value === 'riwayat' ? sudah.value : tab.value === 'semua' ? urut.value : menunggu.value))
const q = computed(() => cari.value.trim().toLowerCase())
const tersaring = computed(() => (q.value ? sumber.value.filter(a => nama(a).toLowerCase().includes(q.value)) : sumber.value))
const halKini = computed(() => Math.min(hal.value, Math.max(1, Math.ceil(tersaring.value.length / PER))))
const daftar = computed(() => tersaring.value.slice((halKini.value - 1) * PER, halKini.value * PER))

const bisaHead = (a: PengajuanJadwal) => bisaPutusHead(peran.value, a, div(a))
const bisaHRD = (a: PengajuanJadwal) => bisaPutusHRD(peran.value, a)
const bisaBatal = (a: PengajuanJadwal) => a.userId === peran.value.id && ajuBerjalan(a)
const nMenunggu = computed(() => menunggu.value.filter(a => bisaHead(a) || bisaHRD(a)).length)
const nDiHRD = computed(() => (peran.value.admin ? 0 : menunggu.value.filter(a => a.status === 'MENUNGGU_HRD').length))
const kuasa = computed(() => divisiKuasa(peran.value))

const opsiTab = computed(() => [
  { value: 'antri' as const, label: `Antrian ${menunggu.value.length}` },
  { value: 'riwayat' as const, label: `Riwayat ${sudah.value.length}` },
  { value: 'semua' as const, label: `Semua ${urut.value.length}` },
])
const kosongTeks = computed(() => (tab.value === 'antri'
  ? 'Tidak ada pengajuan yang menunggu keputusan.'
  : tab.value === 'riwayat' ? 'Belum ada pengajuan yang diputuskan.' : 'Belum ada pengajuan sama sekali.'))

const rentang = (a: PengajuanJadwal) => (a.dari === a.sampai ? fTglP(a.dari) : `${fTglP(a.dari)} – ${fTglP(a.sampai)}`)
const nHari = (a: PengajuanJadwal) => {
  let n = 0
  for (let d = a.dari; d <= a.sampai; d = tambahHari(d, 1)) n++
  return n
}
/** The shift approval will write; '' when the request names none (old TUKAR/UBAH). */
const shiftTulis = (a: PengajuanJadwal) => AJU_KE_SHIFT[a.jenis] || (a.shift && set.value.shifts[a.shift] ? a.shift : '')

const kolom: TableColumn<PengajuanJadwal>[] = [
  { id: 'jenis', header: 'Jenis' },
  { id: 'nama', header: 'Nama' },
  { id: 'tanggal', header: 'Tanggal' },
  { id: 'shift', header: 'Shift' },
  { accessorKey: 'alasan', header: 'Alasan' },
  { id: 'status', header: 'Status' },
  { id: 'aksi', header: () => h('span', { class: 'block text-end' }, 'Aksi') },
]

// ------------------------------------------------------------ decisions
const konfirm = ref(false)
const tolakOpen = ref(false)
const pilih = ref<{ a: PengajuanJadwal, status: 'MENUNGGU_HRD' | 'DISETUJUI' } | null>(null)
const nota = ref('')
const sibuk = ref(false)
const tolakA = ref<PengajuanJadwal | null>(null)

function putuskan(a: PengajuanJadwal, st: 'MENUNGGU_HRD' | 'DISETUJUI' | 'DITOLAK') {
  if (st === 'DITOLAK') {
    tolakA.value = a
    nota.value = ''
    tolakOpen.value = true
    return
  }
  pilih.value = { a, status: st }
  konfirm.value = true
}

async function kirim(a: PengajuanJadwal, st: 'MENUNGGU_HRD' | 'DISETUJUI' | 'DITOLAK', catatan: string) {
  sibuk.value = true
  try {
    await decideRequest(a.id, st, catatan)
    const t = shiftTulis(a)
    if (st === 'DISETUJUI' && t) {
      const libur = !!shiftDef(set.value, t).libur
      const rows = []
      for (let d = a.dari; d <= a.sampai; d = tambahHari(d, 1)) {
        rows.push({ u: a.userId, d, t, m: libur ? '' : (a.jamMulai || ''), s: libur ? '' : (a.jamSelesai || ''), n: '' })
      }
      try {
        await saveCells(rows)
        toast.add({ title: `Disetujui — ${rows.length} hari diisi ${shiftDef(set.value, t).n}`, color: 'success' })
      }
      catch (e) {
        // The decision stands; only the cells failed. Say so instead of hiding it.
        toast.add({ title: `Disahkan, tapi sel jadwal gagal diisi: ${apiErrorMessage(e)}. Isi manual di lembar.`, color: 'warning' })
      }
    }
    else {
      toast.add({
        title: st === 'MENUNGGU_HRD' ? 'Diteruskan ke HRD' : st === 'DISETUJUI' ? 'Pengajuan disetujui' : 'Pengajuan ditolak',
        color: st === 'DITOLAK' ? 'info' : 'success',
      })
    }
    konfirm.value = false
    tolakOpen.value = false
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal menyimpan putusan: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

async function batal(a: PengajuanJadwal) {
  try {
    await deleteRequest(a.id)
    toast.add({ title: 'Pengajuan dibatalkan', color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal membatalkan: ${apiErrorMessage(e)}`, color: 'error' })
  }
}

// New request
const form = ref(false)
</script>

<template>
  <AppPage
    title="Pengajuan"
    description="Off, izin, cuti, dan tukar shift."
  >
    <template #actions>
      <UButton
        label="Ajukan"
        icon="i-lucide-plus"
        @click="form = true"
      />
    </template>

    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel
      title="Pengajuan off, izin & tukar shift"
      icon="i-lucide-message-square-text"
      flush
    >
      <div class="space-y-3 p-4 lg:p-5">
        <p
          v-if="nMenunggu"
          class="rounded-field bg-warning/12 px-3 py-2 text-sm"
        >
          <b>{{ nMenunggu }} pengajuan</b> menunggu keputusan Anda.
        </p>
        <p
          v-if="nDiHRD"
          class="rounded-field bg-info/10 px-3 py-2 text-sm"
        >
          <b>{{ nDiHRD }} pengajuan</b> sudah diteruskan dan sedang menunggu pengesahan HRD. Jadwalnya belum berubah sampai HRD mengesahkannya.
        </p>
        <p class="text-sm text-muted">
          <template v-if="peran.admin">
            Sebagai HRD, Anda mengesahkan pengajuan yang sudah diteruskan head.
          </template>
          <template v-else-if="kuasa.length">
            Sebagai head {{ kuasa.map(namaDivisiJadwal).join(', ') }}, Anda meneruskan pengajuan kru divisi itu ke HRD.
          </template>
          <template v-else>
            Pengajuan Anda diteruskan head divisi Anda, lalu disahkan HRD.
          </template>
          Pengajuan <b>Off/Izin/Cuti/Tukar</b> yang disahkan langsung mengisi sel jadwalnya.
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
            placeholder="Cari nama kru…"
            class="w-full max-w-56"
          />
          <span class="text-sm text-muted">{{ tab === 'antri' ? 'Yang belum diputuskan.' : tab === 'riwayat' ? 'Keputusan yang sudah diambil, terbaru di atas.' : 'Seluruh pengajuan; yang menunggu di atas.' }}</span>
        </div>
        <div
          v-if="q"
          class="flex items-center gap-2"
        >
          <AppStatus size="sm">
            {{ tersaring.length }} dari {{ sumber.length }} pengajuan
          </AppStatus>
          <UButton
            label="Tampilkan semua"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="cari = ''"
          />
        </div>
        <p
          v-if="q && !tersaring.length"
          class="rounded-field bg-warning/12 px-3 py-2 text-sm"
        >
          Tidak ada pengajuan atas nama "<b>{{ cari }}</b>" di tab ini. Coba tab <b>Semua</b> — mungkin sudah diputuskan.
        </p>
      </div>

      <UTable
        class="hidden lg:block"
        :data="daftar"
        :columns="kolom"
        :loading="status === 'pending'"
        :empty="kosongTeks"
        :meta="{ class: { tr: (row: { original: PengajuanJadwal }) => (ajuBerjalan(row.original) ? 'bg-warning/8' : '') } }"
      >
        <template #jenis-cell="{ row }">
          <AppStatus
            color="gold"
            size="sm"
          >
            {{ JENIS_AJU[row.original.jenis] ?? row.original.jenis }}
          </AppStatus>
        </template>
        <template #nama-cell="{ row }">
          <p class="font-semibold text-highlighted">
            {{ nama(row.original) }}
          </p>
          <p class="text-[13px] text-muted">
            {{ namaDivisiJadwal(div(row.original) ?? '') }}
          </p>
        </template>
        <template #tanggal-cell="{ row }">
          <span class="num">{{ rentang(row.original) }}</span>
          <p
            v-if="row.original.dari !== row.original.sampai"
            class="text-[13px] text-muted"
          >
            {{ nHari(row.original) }} hari
          </p>
        </template>
        <template #shift-cell="{ row }">
          <template v-if="shiftTulis(row.original) || (row.original.shift && set.shifts[row.original.shift])">
            <JadwalShiftPil
              :def="shiftDef(set, shiftTulis(row.original) || row.original.shift)"
              size="sm"
            />
          </template>
          <span
            v-else
            class="text-dimmed"
          >—</span>
        </template>
        <template #alasan-cell="{ row }">
          <span class="line-clamp-3 max-w-64 whitespace-normal">{{ row.original.alasan || '—' }}</span>
        </template>
        <template #status-cell="{ row }">
          <JadwalAjuStatus
            :a="row.original"
          />
        </template>
        <template #aksi-cell="{ row }">
          <div class="flex flex-wrap justify-end gap-1.5">
            <template v-if="bisaHead(row.original)">
              <UButton
                label="Teruskan ke HRD"
                icon="i-lucide-check"
                color="success"
                size="xs"
                @click="putuskan(row.original, 'MENUNGGU_HRD')"
              />
              <UButton
                label="Tolak"
                icon="i-lucide-x"
                color="error"
                variant="ghost"
                size="xs"
                @click="putuskan(row.original, 'DITOLAK')"
              />
            </template>
            <template v-else-if="bisaHRD(row.original)">
              <UButton
                label="Sahkan"
                icon="i-lucide-check"
                color="success"
                size="xs"
                @click="putuskan(row.original, 'DISETUJUI')"
              />
              <UButton
                label="Tolak"
                icon="i-lucide-x"
                color="error"
                variant="ghost"
                size="xs"
                @click="putuskan(row.original, 'DITOLAK')"
              />
            </template>
            <UButton
              v-if="bisaBatal(row.original)"
              label="Batal"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="batal(row.original)"
            />
            <span
              v-if="!bisaHead(row.original) && !bisaHRD(row.original) && !bisaBatal(row.original)"
              class="text-dimmed"
            >—</span>
          </div>
        </template>
      </UTable>

      <div class="divide-y divide-default lg:hidden">
        <article
          v-for="a in daftar"
          :key="a.id"
          class="space-y-2 px-4 py-3"
          :class="ajuBerjalan(a) && 'bg-warning/8'"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">
                {{ nama(a) }}
              </p>
              <p class="text-sm text-muted">
                {{ JENIS_AJU[a.jenis] ?? a.jenis }} · {{ namaDivisiJadwal(div(a) ?? '') }} · <span class="num">{{ rentang(a) }}</span>
              </p>
            </div>
            <JadwalShiftPil
              v-if="shiftTulis(a) || (a.shift && set.shifts[a.shift])"
              :def="shiftDef(set, shiftTulis(a) || a.shift)"
              size="sm"
            />
          </div>
          <p
            v-if="a.alasan"
            class="rounded-field bg-muted px-3 py-2 text-sm"
          >
            {{ a.alasan }}
          </p>
          <JadwalAjuStatus :a="a" />
          <div
            v-if="bisaHead(a) || bisaHRD(a) || bisaBatal(a)"
            class="grid grid-cols-2 gap-2"
          >
            <UButton
              v-if="bisaHead(a) || bisaHRD(a)"
              :label="bisaHead(a) ? 'Teruskan ke HRD' : 'Sahkan'"
              icon="i-lucide-check"
              color="success"
              class="justify-center"
              @click="putuskan(a, bisaHead(a) ? 'MENUNGGU_HRD' : 'DISETUJUI')"
            />
            <UButton
              v-if="bisaHead(a) || bisaHRD(a)"
              label="Tolak"
              icon="i-lucide-x"
              color="error"
              variant="soft"
              class="justify-center"
              @click="putuskan(a, 'DITOLAK')"
            />
            <UButton
              v-if="bisaBatal(a)"
              label="Batal"
              color="neutral"
              variant="outline"
              class="col-span-2 justify-center"
              @click="batal(a)"
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
        :total="tersaring.length"
        :per="PER"
        satuan="pengajuan"
      />
    </AppPanel>

    <ResponsiveSheet
      v-model:open="konfirm"
      :title="pilih ? `${pilih.status === 'MENUNGGU_HRD' ? 'Teruskan' : 'Sahkan'} ${JENIS_AJU[pilih.a.jenis] ?? pilih.a.jenis} — ${nama(pilih.a)}${pilih.status === 'MENUNGGU_HRD' ? ' ke HRD' : ''}?` : ''"
    >
      <div
        v-if="pilih"
        class="space-y-2 text-sm"
      >
        <p class="font-semibold text-highlighted">
          {{ pilih.a.dari === pilih.a.sampai ? fTgl(pilih.a.dari) : `${fTgl(pilih.a.dari)} – ${fTgl(pilih.a.sampai)}` }}
        </p>
        <p v-if="pilih.status === 'MENUNGGU_HRD'">
          Jadwalnya <b>belum berubah</b> setelah ini — HRD yang mengesahkan, dan sel jadwal baru terisi saat itu.
        </p>
        <p v-else-if="shiftTulis(pilih.a)">
          Sel jadwalnya langsung terisi <b>{{ shiftDef(set, shiftTulis(pilih.a)).n }}</b> untuk <b>{{ nHari(pilih.a) }} hari</b> — menimpa shift yang sekarang ada di sana.
        </p>
        <p v-else>
          Pengajuan ini tidak menyebut shift yang diminta, jadi <b>sel jadwalnya tidak ikut berubah</b>. Isi sendiri di lembar setelah ini.
        </p>
        <p
          v-if="pilih.status === 'DISETUJUI' && pilih.a.headOleh"
          class="text-muted"
        >
          Sudah diloloskan head: {{ pilih.a.headOleh }}
        </p>
        <p
          v-if="pilih.a.alasan"
          class="italic text-muted"
        >
          "{{ pilih.a.alasan }}"
        </p>
      </div>
      <template #footer>
        <UButton
          :label="pilih?.status === 'MENUNGGU_HRD' ? 'Ya, teruskan' : 'Ya, sahkan'"
          color="success"
          :loading="sibuk"
          @click="pilih && kirim(pilih.a, pilih.status, '')"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="konfirm = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="tolakOpen"
      :title="`Tolak pengajuan ${tolakA ? nama(tolakA) : ''}`"
    >
      <UFormField
        label="Alasan penolakan"
        help="Dibaca kru yang mengajukan. Kosongkan kalau memang tidak perlu — akan tertulis &quot;Tidak disetujui head divisi&quot;."
      >
        <UTextarea
          v-model="nota"
          :rows="3"
          autofocus
          placeholder="Mis. hari itu sudah dua orang off di Cashier"
          class="w-full"
        />
      </UFormField>
      <template #footer>
        <UButton
          label="Tolak pengajuan"
          color="error"
          :loading="sibuk"
          @click="tolakA && kirim(tolakA, 'DITOLAK', nota.trim() || 'Tidak disetujui head divisi')"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="tolakOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <JadwalAjukan
      v-model:open="form"
      :set="set"
      :kru="kru"
      :peran="peran"
      @sent="refresh"
    />
  </AppPage>
</template>
