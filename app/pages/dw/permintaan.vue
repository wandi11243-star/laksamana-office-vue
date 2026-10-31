<!--
  Permintaan DW (deploy/dw/index.html viewPermintaan :2963-3103). This is the
  head's desk: their own division's requests and the decisions on them. The
  page does NOT decide — deciding lives in Antrean Pengajuan (:3008); here a
  head may Ubah or Tarik kembali, and HRD may Hapus.

  Two tabs by "what the page is for", not by status: Menunggu = still waiting,
  Riwayat = decided (F.18). The date carries a segera marker so a request for
  tomorrow cannot drown among next month's (:3036).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { PermintaanDw } from '~/utils/dw'
import { bolehBukaDw, bolehHapusMintaDw, bolehUbahMintaDw, divisiKuasaDw, durasiJamDw, jejakDw, kataPutusanDw, mintaOrang, mintaTerpenuhi, namaDw, segeraDw } from '~/utils/dw'
import { hapusPermintaanDw, putusPermintaanDw, useDwDasar } from '~/composables/useDw'
import { fTglP } from '~/utils/format'
import { HARI_SENIN, idxHari, namaDivisiJadwal } from '~/utils/jadwal'

definePageMeta({ access: ['dw'] })

const PER = 20
const toast = useToast()
const route = useRoute()
const { set, ajuan, permintaan, pekerja, peran, pending, error, refresh } = useDwDasar()

/** Matrix-aware gate (T-10); default is head + HRD. */
const bolehHalaman = computed(() => bolehBukaDw(set.value, peran.value, 'permintaan'))

const tab = ref<'antri' | 'riwayat'>('antri')
const mintaOpen = ref(false)
const edit = ref<PermintaanDw | null>(null)
const hal = ref(1)
watch(tab, () => {
  hal.value = 1
})

if (String(route.query.minta ?? '') === '1') mintaOpen.value = true

const kuasa = computed(() => divisiKuasaDw(peran.value))
const semua = computed(() => (peran.value.hrd ? permintaan.value : permintaan.value.filter(x => kuasa.value.includes(x.divisi))))
const antri = computed(() => semua.value.filter(x => x.status === 'MENUNGGU').sort((a, b) => String(a.tgl).localeCompare(String(b.tgl))))
const riwayat = computed(() => semua.value.filter(x => x.status !== 'MENUNGGU').sort((a, b) => (b.putusAt || 0) - (a.putusAt || 0)))
const sumber = computed(() => (tab.value === 'riwayat' ? riwayat.value : antri.value))
const halKini = computed(() => Math.min(hal.value, Math.max(1, Math.ceil(sumber.value.length / PER))))
const daftar = computed(() => sumber.value.slice((halKini.value - 1) * PER, halKini.value * PER))

const opsiTab = computed(() => [
  { value: 'antri' as const, label: `Menunggu ${antri.value.length}` },
  { value: 'riwayat' as const, label: `Riwayat ${riwayat.value.length}` },
])

const kolom: TableColumn<PermintaanDw>[] = [
  { id: 'tgl', header: 'Tanggal' },
  { id: 'divisi', header: 'Divisi / Posisi' },
  { id: 'jam', header: 'Jam' },
  { id: 'jumlah', header: () => h('span', { class: 'block text-end' }, 'Butuh') },
  { id: 'catatan', header: 'Catatan' },
  { id: 'status', header: 'Status' },
  { id: 'aksi', header: '' },
]

const bolehUbah = (x: PermintaanDw) => bolehUbahMintaDw(x, peran.value)
const bolehHapus = (x: PermintaanDw) => bolehHapusMintaDw(ajuan.value, x, peran.value)
const bolehTarik = (x: PermintaanDw) => x.status === 'MENUNGGU' && peran.value.head && kuasa.value.includes(x.divisi)
const terpenuhi = (x: PermintaanDw) => mintaTerpenuhi(ajuan.value, x.id)
/** The old status pill (:3000-3005): waiting is HRD's; approved says how many are still missing. */
const pil = (x: PermintaanDw) => {
  if (x.status === 'MENUNGGU') return { teks: 'Menunggu HRD', color: 'warning' as const, icon: 'i-lucide-hourglass' }
  if (x.status !== 'DISETUJUI') return null
  const isi = terpenuhi(x)
  return isi < x.jumlah
    ? { teks: `${isi} dari ${x.jumlah}`, color: 'warning' as const, icon: 'i-lucide-user-round-plus' }
    : { teks: `Terpenuhi ${isi}/${x.jumlah}`, color: 'success' as const, icon: 'i-lucide-circle-check' }
}
/** Who asked, who edited, who decided — each with its time (:3058-3061). */
const jejak = (x: PermintaanDw) => [
  jejakDw('diminta', x.dibuatOleh, x.dibuatAt),
  jejakDw('diubah', x.diubahOleh, x.diubahAt),
  jejakDw(kataPutusanDw(x.status), x.putusOleh, x.putusAt),
].filter(Boolean)

function bukaMinta(x: PermintaanDw | null) {
  edit.value = x
  mintaOpen.value = true
}

const tarik = ref<PermintaanDw | null>(null)
const tarikOpen = ref(false)
async function jalanTarik() {
  if (!tarik.value) return
  try {
    await putusPermintaanDw(tarik.value.id, 'BATAL', 'Ditarik')
    tarikOpen.value = false
    toast.add({ title: 'Permintaan ditarik', color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal: ${apiErrorMessage(e)}`, color: 'error' })
  }
}

const hapusT = ref<PermintaanDw | null>(null)
const hapusOpen = ref(false)
async function jalanHapus() {
  if (!hapusT.value) return
  try {
    await hapusPermintaanDw(hapusT.value.id)
    hapusOpen.value = false
    toast.add({ title: 'Permintaan dihapus', color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal menghapus: ${apiErrorMessage(e)}`, color: 'error' })
  }
}
</script>

<template>
  <AppPage
    title="Permintaan DW"
    description="Permintaan divisi Anda & putusannya."
  >
    <template #actions>
      <UButton
        v-if="kuasa.length || peran.hrd"
        label="Minta DW"
        icon="i-lucide-plus"
        @click="bukaMinta(null)"
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
      v-if="!pending && (!bolehHalaman || (!kuasa.length && !peran.hrd))"
      title="Halaman ini untuk head divisi dan HRD"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Head ditunjuk di modul <b>Jadwal Shift → Pengaturan → Head Divisi</b>.
      </p>
    </AppPanel>

    <template v-else>
      <AppPanel
        title="Permintaan Daily Worker"
        icon="i-lucide-clipboard-list"
        flush
      >
        <div class="space-y-3 p-4 lg:p-5">
          <p class="text-sm text-muted">
            <template v-if="peran.hrd">
              Riwayat permintaan semua divisi berikut putusannya. Yang <b>menunggu</b> diputuskan di
              <ULink
                to="/dw/antrean"
                class="font-semibold text-highlighted underline-offset-4 hover:underline"
              >Antrean Pengajuan</ULink>.
            </template>
            <template v-else>
              Ajukan kebutuhan divisi Anda; HRD yang menyetujui dan menunjuk orangnya. Yang disetujui muncul di <b>Jadwal Shift</b>.
            </template>
          </p>
          <AppSeg
            v-model="tab"
            :options="opsiTab"
            size="sm"
          />
        </div>

        <UTable
          class="hidden lg:block"
          :data="daftar"
          :columns="kolom"
          :loading="!permintaan.length"
          :empty="tab === 'antri' ? 'Tidak ada permintaan yang menunggu.' : 'Belum ada permintaan yang diputuskan.'"
        >
          <template #tgl-cell="{ row }">
            <span class="num">{{ fTglP(row.original.tgl) }}</span>
            <p class="text-[13px] text-muted">
              {{ HARI_SENIN[idxHari(row.original.tgl)] }}
              <span
                v-if="segeraDw(row.original.tgl)"
                class="font-semibold"
                :class="segeraDw(row.original.tgl)!.tone === 'lewat' ? 'text-error' : 'text-primary-700'"
              > · {{ segeraDw(row.original.tgl)!.teks }}</span>
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
          <template #jumlah-cell="{ row }">
            <div class="text-end">
              <b class="num">{{ row.original.jumlah }}</b> orang
              <p
                v-if="mintaOrang(ajuan, row.original.id).length"
                class="text-[13px] text-muted"
              >
                {{ mintaOrang(ajuan, row.original.id).map(a => namaDw(pekerja, a.dwId)).join(', ') }}
              </p>
              <p
                v-if="row.original.usulan.length"
                class="text-[13px] text-primary-700"
              >
                usul: {{ row.original.usulan.map(id => namaDw(pekerja, id)).join(', ') }}
              </p>
            </div>
          </template>
          <template #catatan-cell="{ row }">
            <span class="line-clamp-3 max-w-64 whitespace-normal">{{ row.original.catatan || '—' }}</span>
            <p
              v-if="row.original.putusNota"
              class="text-[13px] text-error"
            >
              "{{ row.original.putusNota }}"
            </p>
          </template>
          <template #status-cell="{ row }">
            <AppStatus
              v-if="pil(row.original)"
              :color="pil(row.original)!.color"
              :icon="pil(row.original)!.icon"
              size="sm"
            >
              {{ pil(row.original)!.teks }}
            </AppStatus>
            <DwStatus
              v-else
              :status="row.original.status"
              size="sm"
            />
            <p
              v-for="j in jejak(row.original)"
              :key="j"
              class="text-[12px] text-muted"
            >
              {{ j }}
            </p>
          </template>
          <template #aksi-cell="{ row }">
            <div class="flex flex-wrap justify-end gap-1.5">
              <UButton
                v-if="bolehUbah(row.original)"
                label="Ubah"
                color="neutral"
                variant="outline"
                size="xs"
                @click="bukaMinta(row.original)"
              />
              <UButton
                v-if="bolehTarik(row.original)"
                label="Tarik kembali"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="tarik = row.original; tarikOpen = true"
              />
              <UButton
                v-if="bolehHapus(row.original)"
                label="Hapus"
                color="error"
                variant="ghost"
                size="xs"
                @click="hapusT = row.original; hapusOpen = true"
              />
              <span
                v-if="!bolehUbah(row.original) && !bolehTarik(row.original) && !bolehHapus(row.original)"
                class="text-dimmed"
              >—</span>
            </div>
          </template>
        </UTable>

        <div class="divide-y divide-default lg:hidden">
          <article
            v-for="x in daftar"
            :key="x.id"
            class="space-y-2 px-4 py-3"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="font-semibold text-highlighted">
                  {{ namaDivisiJadwal(x.divisi) }} — {{ x.jumlah }} orang
                </p>
                <p class="text-sm text-muted">
                  <span class="num">{{ fTglP(x.tgl) }}</span> · <span class="num">{{ x.m }}–{{ x.s }}</span> · {{ x.posisi || '—' }}
                </p>
              </div>
              <AppStatus
                v-if="pil(x)"
                :color="pil(x)!.color"
                :icon="pil(x)!.icon"
                size="sm"
              >
                {{ pil(x)!.teks }}
              </AppStatus>
              <DwStatus
                v-else
                :status="x.status"
                size="sm"
              />
            </div>
            <p
              v-if="x.catatan"
              class="rounded-field bg-muted px-3 py-2 text-sm"
            >
              {{ x.catatan }}
            </p>
            <p
              v-if="x.usulan.length"
              class="text-sm text-primary-700"
            >
              usul: {{ x.usulan.map(id => namaDw(pekerja, id)).join(', ') }}
            </p>
            <div class="flex flex-wrap gap-1.5">
              <UButton
                v-if="bolehUbah(x)"
                label="Ubah"
                color="neutral"
                variant="outline"
                size="xs"
                @click="bukaMinta(x)"
              />
              <UButton
                v-if="bolehTarik(x)"
                label="Tarik kembali"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="tarik = x; tarikOpen = true"
              />
              <UButton
                v-if="bolehHapus(x)"
                label="Hapus"
                color="error"
                variant="ghost"
                size="xs"
                @click="hapusT = x; hapusOpen = true"
              />
            </div>
          </article>
          <div
            v-if="pending && !daftar.length"
            class="space-y-2 p-4"
          >
            <!-- Loading cards mirror the request list below. -->
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
            {{ tab === 'antri' ? 'Tidak ada permintaan yang menunggu.' : 'Belum ada permintaan yang diputuskan.' }}
          </p>
        </div>

        <JadwalPager
          v-model="hal"
          :total="sumber.length"
          :per="PER"
          satuan="permintaan"
        />
      </AppPanel>
    </template>

    <DwMinta
      v-model:open="mintaOpen"
      :edit="edit"
      @sent="refresh"
    />

    <ResponsiveSheet
      v-model:open="tarikOpen"
      :title="tarik ? `Tarik kembali permintaan ${fTglP(tarik.tgl)}?` : 'Tarik kembali?'"
    >
      <p class="text-sm">
        Permintaan ini hilang dari antrean HRD. Kalau ternyata masih butuh, ajukan lagi.
      </p>
      <template #footer>
        <UButton
          label="Ya, tarik"
          color="error"
          @click="jalanTarik"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="tarikOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="hapusOpen"
      :title="hapusT ? `Hapus permintaan ${fTglP(hapusT.tgl)}?` : 'Hapus permintaan?'"
    >
      <div
        v-if="hapusT"
        class="space-y-2 text-sm"
      >
        <p><b>{{ hapusT.jumlah }} orang</b> · <span class="num">{{ hapusT.m }}–{{ hapusT.s }}</span></p>
        <p class="text-muted">
          Barisnya hilang permanen dan tidak bisa dikembalikan — berbeda dengan <b>Tarik kembali</b>, yang
          menyimpannya sebagai riwayat berstatus Batal.
        </p>
        <p
          v-if="mintaTerpenuhi(ajuan, hapusT.id)"
          class="rounded-field bg-warning/12 px-3 py-2"
        >
          <b>{{ mintaTerpenuhi(ajuan, hapusT.id) }} daily worker sudah ditugaskan dari permintaan ini, dan mereka TETAP terjadwal.</b>
          Orangnya sudah dijanjikan datang — menghapus permintaannya tidak membatalkan janji itu. Kalau memang mau
          dibatalkan, batalkan shift-nya satu per satu di Kalender DW lebih dulu.
        </p>
      </div>
      <template #footer>
        <UButton
          label="Ya, hapus permanen"
          color="error"
          @click="jalanHapus"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="hapusOpen = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
