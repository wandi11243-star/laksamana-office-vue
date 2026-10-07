<!--
  Database DW (deploy/dw/index.html viewPekerja :6032-6096). The talent pool:
  names, phones, divisions/positions, work record. DW have no account and
  never log in (:6057); writes are HRD-only, reads are open to heads (F.10).

  Actions mirror the old row menu: Profil (everyone), Sunting / Nonaktifkan /
  Hapus (HRD). Deactivating is the answer to almost every "Hapus" — it stops
  the person being scheduled while keeping the record (:5996).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { PekerjaDw } from '~/utils/dw'
import {
  bolehBukaDw, posPekerja, ringkasDivPekerja, statistikDw, statusDw,
} from '~/utils/dw'
import { hapusWorkerDw, saveWorkerDw, useDwDasar } from '~/composables/useDw'

definePageMeta({ access: ['dw'] })

const toast = useToast()
const { set, ajuan, pekerja, peran, pending, error, refresh } = useDwDasar()

/** Matrix-aware gate (T-10); default is HRD and head. */
const bolehHalaman = computed(() => bolehBukaDw(set.value, peran.value, 'pekerja'))

const tapis = ref<'AKTIF' | 'NONAKTIF' | 'ALL'>('AKTIF')
const q = ref('')

const hitung = computed(() => ({
  AKTIF: pekerja.value.filter(p => p.status === 'AKTIF').length,
  NONAKTIF: pekerja.value.filter(p => p.status === 'NONAKTIF').length,
}))
const daftar = computed(() => {
  const s = q.value.trim().toLowerCase()
  return pekerja.value
    .filter((p) => {
      if (tapis.value !== 'ALL' && statusDw(p.status) !== tapis.value) return false
      if (!s) return true
      return [p.nama, p.hp, p.posisi, p.skill, p.divisi].some(x => String(x || '').toLowerCase().includes(s))
    })
    .sort((a, b) => String(a.nama).localeCompare(String(b.nama)))
})
const opsiTapis = computed(() => [
  { value: 'ALL' as const, label: `Semua (${pekerja.value.length})` },
  { value: 'AKTIF' as const, label: `Aktif (${hitung.value.AKTIF})` },
  { value: 'NONAKTIF' as const, label: `Nonaktif (${hitung.value.NONAKTIF})` },
])

const kolom: TableColumn<PekerjaDw>[] = [
  { id: 'no', header: '#' },
  { id: 'nama', header: 'Nama' },
  { id: 'hp', header: 'No. HP' },
  { id: 'divisi', header: 'Divisi / Posisi' },
  { id: 'kerja', header: () => h('span', { class: 'block text-end' }, 'Kerja') },
  { id: 'status', header: 'Status' },
  { id: 'aksi', header: () => h('span', { class: 'block text-end' }, 'Aksi') },
]

const st = (p: PekerjaDw) => statistikDw(ajuan.value, p.id)

// Sheets
const formOpen = ref(false)
const formP = ref<PekerjaDw | null>(null)
const profilOpen = ref(false)
const profilP = ref<PekerjaDw | null>(null)
const mintaOpen = ref(false)
const mintaOrang = ref<PekerjaDw | null>(null)

function bukaForm(p: PekerjaDw | null) {
  formP.value = p
  formOpen.value = true
}
function bukaProfil(p: PekerjaDw) {
  profilP.value = p
  profilOpen.value = true
}
function dariProfil(kind: 'sunting' | 'hapus' | 'minta') {
  const p = profilP.value
  if (!p) return
  profilOpen.value = false
  if (kind === 'sunting') bukaForm(p)
  else if (kind === 'hapus') konfirmHapus(p)
  else {
    mintaOrang.value = p
    mintaOpen.value = true
  }
}

// Active / delete
const aktifP = ref<PekerjaDw | null>(null)
const aktifOpen = ref(false)
async function konfirmAktif(p: PekerjaDw) {
  aktifP.value = p
  aktifOpen.value = true
}
async function jalanAktif() {
  if (!aktifP.value) return
  const jadi = statusDw(aktifP.value.status) === 'AKTIF' ? 'NONAKTIF' : 'AKTIF'
  try {
    await saveWorkerDw({ ...aktifP.value, status: jadi })
    aktifOpen.value = false
    toast.add({ title: `${aktifP.value.nama} — ${jadi === 'AKTIF' ? 'aktif kembali' : 'dinonaktifkan'}`, color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal menyimpan: ${apiErrorMessage(e)}`, color: 'error' })
  }
}

const hapusP = ref<PekerjaDw | null>(null)
const hapusOpen = ref(false)
function konfirmHapus(p: PekerjaDw) {
  hapusP.value = p
  hapusOpen.value = true
}
async function jalanHapus() {
  if (!hapusP.value) return
  try {
    await hapusWorkerDw(hapusP.value.id)
    hapusOpen.value = false
    toast.add({ title: `${hapusP.value.nama} dihapus dari database`, color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal menghapus: ${apiErrorMessage(e)}`, color: 'error' })
  }
}
const pernahKerja = (p: PekerjaDw) => !!(p.terakhirKerja || st(p).total || st(p).menunggu)
</script>

<template>
  <AppPage
    title="Database DW"
    description="Talent pool daily worker."
  >
    <template
      v-if="peran.hrd && bolehHalaman"
      #actions
    >
      <UButton
        label="DW baru"
        icon="i-lucide-plus"
        @click="bukaForm(null)"
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
      v-if="!pending && !bolehHalaman"
      title="Halaman ini untuk HRD dan head divisi"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Data talent pool dimuat di sini. Minta admin modul menambahkan Anda di <b>Pengaturan → Hak Akses</b>.
      </p>
    </AppPanel>

    <AppPanel
      v-else
      title="Talent pool"
      icon="i-lucide-users"
      :count="pekerja.length"
      description="Daily worker tidak punya akun — jadwalnya diatur dari sini, orangnya dikabari lewat WhatsApp."
      flush
    >
      <div class="flex flex-wrap items-center gap-3 p-4 lg:p-5">
        <AppSeg
          v-model="tapis"
          :options="opsiTapis"
          size="sm"
        />
        <UInput
          v-model="q"
          icon="i-lucide-search"
          placeholder="Cari nama / HP / skill…"
          class="w-full max-w-64"
        />
      </div>

      <UTable
        class="hidden lg:block"
        :data="daftar"
        :columns="kolom"
        :loading="!pekerja.length"
        empty="Belum ada daily worker terdaftar."
      >
        <template #no-cell="{ row }">
          <span class="text-muted num">{{ row.index + 1 }}</span>
        </template>
        <template #nama-cell="{ row }">
          <p class="font-semibold text-highlighted">
            {{ row.original.nama }}
          </p>
          <p
            v-if="row.original.area"
            class="text-[13px] text-muted"
          >
            {{ row.original.area }}
          </p>
        </template>
        <template #hp-cell="{ row }">
          <span class="num">{{ row.original.hp }}</span>
        </template>
        <template #divisi-cell="{ row }">
          <span :title="`${row.original.divisi} · ${posPekerja(row.original).join(', ')}`">{{ ringkasDivPekerja(row.original) }}</span>
          <p class="text-[13px] text-muted">
            {{ posPekerja(row.original).join(', ') || '—' }}
          </p>
        </template>
        <template #kerja-cell="{ row }">
          <span class="num">{{ st(row.original).total }}×</span>
          <p class="text-[13px] text-muted num">
            {{ st(row.original).jam }} jam
          </p>
        </template>
        <template #status-cell="{ row }">
          <AppStatus
            size="sm"
            :color="statusDw(row.original.status) === 'AKTIF' ? 'success' : 'neutral'"
            :icon="statusDw(row.original.status) === 'AKTIF' ? 'i-lucide-circle-check' : 'i-lucide-circle-slash'"
          >
            {{ statusDw(row.original.status) === 'AKTIF' ? 'Aktif' : 'Nonaktif' }}
          </AppStatus>
        </template>
        <template #aksi-cell="{ row }">
          <div class="flex flex-wrap justify-end gap-1.5">
            <UButton
              label="Profil"
              color="neutral"
              variant="outline"
              size="xs"
              @click="bukaProfil(row.original)"
            />
            <template v-if="peran.hrd">
              <UButton
                label="Sunting"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="bukaForm(row.original)"
              />
              <UButton
                :label="statusDw(row.original.status) === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'"
                :color="statusDw(row.original.status) === 'AKTIF' ? 'error' : 'success'"
                variant="ghost"
                size="xs"
                @click="konfirmAktif(row.original)"
              />
              <UButton
                label="Hapus"
                color="error"
                variant="ghost"
                size="xs"
                @click="konfirmHapus(row.original)"
              />
            </template>
          </div>
        </template>
      </UTable>

      <div class="divide-y divide-default lg:hidden">
        <article
          v-for="(p, i) in daftar"
          :key="p.id"
          class="space-y-2 px-4 py-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">
                <span class="me-1.5 text-muted num">{{ i + 1 }}</span>{{ p.nama }}
              </p>
              <p class="text-sm text-muted">
                <span class="num">{{ p.hp }}</span> · {{ ringkasDivPekerja(p) }} · {{ posPekerja(p).join(', ') || '—' }}
              </p>
              <p class="text-sm text-muted num">
                {{ st(p).total }}× · {{ st(p).jam }} jam
              </p>
            </div>
            <AppStatus
              size="sm"
              :color="statusDw(p.status) === 'AKTIF' ? 'success' : 'neutral'"
            >
              {{ statusDw(p.status) === 'AKTIF' ? 'Aktif' : 'Nonaktif' }}
            </AppStatus>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <UButton
              label="Profil"
              color="neutral"
              variant="outline"
              size="xs"
              @click="bukaProfil(p)"
            />
            <template v-if="peran.hrd">
              <UButton
                label="Sunting"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="bukaForm(p)"
              />
              <UButton
                :label="statusDw(p.status) === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'"
                :color="statusDw(p.status) === 'AKTIF' ? 'error' : 'success'"
                variant="ghost"
                size="xs"
                @click="konfirmAktif(p)"
              />
              <UButton
                label="Hapus"
                color="error"
                variant="ghost"
                size="xs"
                @click="konfirmHapus(p)"
              />
            </template>
          </div>
        </article>
        <p
          v-if="!daftar.length"
          class="px-4 py-8 text-center text-muted"
        >
          {{ q || tapis !== 'ALL' ? 'Tidak ada yang cocok dengan saringan ini.' : 'Belum ada daily worker terdaftar.' }}
        </p>
      </div>
    </AppPanel>

    <DwPekerjaSheet
      v-model:open="formOpen"
      :p="formP"
      @saved="refresh"
    />
    <DwProfilSheet
      v-model:open="profilOpen"
      :p="profilP"
      @sunting="dariProfil('sunting')"
      @hapus="dariProfil('hapus')"
      @minta="dariProfil('minta')"
    />
    <DwMinta
      v-model:open="mintaOpen"
      :orang="mintaOrang"
      @sent="refresh"
    />

    <ResponsiveSheet
      v-model:open="aktifOpen"
      :title="aktifP ? `${statusDw(aktifP.status) === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'} ${aktifP.nama}?` : 'Ubah status?'"
    >
      <p
        v-if="aktifP"
        class="text-sm"
      >
        <template v-if="statusDw(aktifP.status) === 'AKTIF'">
          Namanya hilang dari daftar kandidat dan tidak bisa dijadwalkan lagi. Shift yang <b>terlanjur disetujui</b>
          tetap berdiri — batalkan sendiri kalau memang tidak jadi.
        </template>
        <template v-else>
          Ia kembali muncul sebagai kandidat dan bisa dijadwalkan lagi.
        </template>
      </p>
      <template #footer>
        <UButton
          :label="aktifP && statusDw(aktifP.status) === 'AKTIF' ? 'Ya, nonaktifkan' : 'Ya, aktifkan'"
          :color="aktifP && statusDw(aktifP.status) === 'AKTIF' ? 'error' : 'success'"
          @click="jalanAktif"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="aktifOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="hapusOpen"
      :title="hapusP ? `Hapus ${hapusP.nama} dari database?` : 'Hapus DW?'"
    >
      <div
        v-if="hapusP"
        class="space-y-2 text-sm"
      >
        <p
          v-if="pernahKerja(hapusP)"
          class="rounded-field bg-warning/12 px-3 py-2"
        >
          <b>Orang ini punya riwayat.</b> Shift yang sudah disetujui TIDAK ikut terhapus — ia akan berdiri di
          kalender <b>Jadwal Shift</b> tanpa nama yang bisa ditelusuri, dan tujuan transfernya hilang dari halaman
          <b>Pembayaran</b>.<br>
          Untuk berhenti memakainya, <b>Nonaktifkan</b> lebih tepat: namanya hilang dari daftar kandidat dan tidak
          bisa dijadwalkan lagi, tapi jejaknya utuh.
        </p>
        <p
          v-else
          class="text-muted"
        >
          Belum pernah dijadwalkan, jadi tidak ada riwayat yang ikut terputus.
        </p>
        <p class="text-muted">
          Penghapusan tidak bisa dibatalkan.
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
