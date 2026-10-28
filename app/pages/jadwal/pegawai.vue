<!--
  Jadwal Shift › Data Pegawai — personal data of crew (deploy/jadwal/index.html
  viewPegawai :2048-2380, F.9). HRD / admin of `jadwal` only.

  Only DATA DIRI: name, Tim, phone, Talenta Employee ID, HR columns, active.
  PIN, username and module access are never touched here (a new account starts
  with PIN 1111). Deactivating hides the person from every sheet, past months
  included, without deleting cells; permanent delete is only offered once a
  row is inactive, and the server enforces the same.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { DataDiri } from '~/composables/useJadwal'
import type { KruJadwal } from '~/utils/jadwal'
import {
  DIVISI, DIV_NONSHIFT, HR_BRANCH, HR_LEVEL, HR_ORG, HR_STATUS, divisiDariTim, namaDivisiJadwal,
} from '~/utils/jadwal'
import { hapusKru, pesanGagalRoster, saveDataDiri, setAktifKru, useJadwalDasar } from '~/composables/useJadwal'
import { JADWAL_BACA_SAJA } from '~/utils/hris'

definePageMeta({ access: ['jadwal'] })

const toast = useToast()
const { set, kru, peran, pending, error, refresh } = useJadwalDasar()

const tapis = ref<'aktif' | 'nonaktif' | 'semua'>('aktif')
const divTapis = ref('ALL')
const q = ref('')
const nAktif = computed(() => kru.value.filter(u => u.active !== false).length)
const daftar = computed(() => {
  const s = q.value.trim().toLowerCase()
  return kru.value.filter((u) => {
    const aktif = u.active !== false
    if (tapis.value === 'aktif' && !aktif) return false
    if (tapis.value === 'nonaktif' && aktif) return false
    if (divTapis.value !== 'ALL' && u.divisi !== divTapis.value) return false
    if (!s) return true
    return [u.name, u.keterangan, u.noHp, u.talentaId, u.jobPosition].some(x => String(x || '').toLowerCase().includes(s))
  }).sort((a, b) => String(a.name).localeCompare(String(b.name)))
})
const ketTapis = computed(() => {
  const b: string[] = []
  if (tapis.value !== 'semua') b.push(tapis.value === 'aktif' ? 'hanya yang aktif' : 'hanya yang nonaktif')
  if (divTapis.value !== 'ALL') b.push(`divisi ${namaDivisiJadwal(divTapis.value)}`)
  if (q.value.trim()) b.push(`cari "${q.value.trim()}"`)
  return b.join(', ')
})
function bersih() {
  q.value = ''
  tapis.value = 'semua'
  divTapis.value = 'ALL'
}
const opsiTapis = computed(() => [
  { value: 'aktif' as const, label: `Aktif (${nAktif.value})` },
  { value: 'nonaktif' as const, label: `Nonaktif (${kru.value.length - nAktif.value})` },
  { value: 'semua' as const, label: `Semua (${kru.value.length})` },
])
const opsiDiv = [
  { value: 'ALL', label: 'Semua divisi' },
  ...DIVISI.map(d => ({ value: d.k as string, label: d.n })),
  { value: DIV_NONSHIFT, label: 'Tidak dijadwalkan' },
]
const manual = (u: KruJadwal) => !!set.value.divOverride[u.id]

const kolom: TableColumn<KruJadwal>[] = [
  { id: 'no', header: '#' },
  { id: 'nama', header: 'Nama' },
  { accessorKey: 'keterangan', header: 'Tim (Office)' },
  { id: 'divisi', header: 'Divisi' },
  { accessorKey: 'noHp', header: 'No HP' },
  { accessorKey: 'talentaId', header: 'Employee ID' },
  { id: 'status', header: 'Status' },
  { id: 'aksi', header: 'Aksi' },
]

// ---- form
// Reka UI forbids SelectItem value ''; "belum diisi" is a sentinel.
const KOSONG = '__kosong__'
const formOpen = ref(false)
const formId = ref('')
const f = reactive<DataDiri>({ name: '', keterangan: '', noHp: '', talentaId: '', branch: '', organization: '', jobPosition: '', jobLevel: '', employmentStatus: '', joinDate: '' })
const sibuk = ref(false)
function bukaForm(u: KruJadwal | null) {
  formId.value = u?.id ?? ''
  Object.assign(f, {
    name: u?.name ?? '',
    keterangan: u?.keterangan ?? '',
    noHp: u?.noHp ?? '',
    talentaId: u?.talentaId ?? '',
    branch: u ? u.branch ?? '' : (HR_BRANCH[0] ?? ''),
    organization: u?.organization ?? '',
    jobPosition: u?.jobPosition ?? '',
    jobLevel: u?.jobLevel ?? '',
    employmentStatus: u?.employmentStatus ?? '',
    joinDate: u?.joinDate ?? '',
  })
  formOpen.value = true
}
/** A stored value outside the list stays selectable as "(lama)", so Simpan never silently replaces it (`opsiHR`). */
function opsiHR(daftar: string[], nilai: string) {
  const v = String(nilai || '').trim()
  return [
    { value: KOSONG, label: '— belum diisi —' },
    ...daftar.map(x => ({ value: x, label: x })),
    ...(v && !daftar.includes(v) ? [{ value: v, label: `${v} (lama)` }] : []),
  ]
}
const pilihHR = (k: 'branch' | 'organization' | 'jobLevel' | 'employmentStatus') => computed({
  get: () => f[k] || KOSONG,
  set: (v: string) => {
    f[k] = v === KOSONG ? '' : v
  },
})
const vBranch = pilihHR('branch')
const vOrg = pilihHR('organization')
const vLevel = pilihHR('jobLevel')
const vStatus = pilihHR('employmentStatus')
const hintDiv = computed(() => divisiDariTim(f.keterangan))

async function simpan() {
  const nama = f.name.trim()
  if (!nama) return toast.add({ title: 'Nama wajib diisi', color: 'error' })
  sibuk.value = true
  try {
    const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, String(v || '').trim()])) as unknown as DataDiri
    await saveDataDiri(formId.value, body)
    formOpen.value = false
    toast.add({ title: formId.value ? `Data ${nama} diperbarui` : `Kru ${nama} ditambahkan`, color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal menyimpan: ${pesanGagalRoster(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

// ---- active / delete
const aktifOpen = ref(false)
const hapusOpen = ref(false)
const pilih = ref<KruJadwal | null>(null)
const keAktif = ref(false)
function konfirmAktif(u: KruJadwal, aktif: boolean) {
  pilih.value = u
  keAktif.value = aktif
  aktifOpen.value = true
}
function konfirmHapus(u: KruJadwal) {
  pilih.value = u
  hapusOpen.value = true
}
async function jalanAktif() {
  if (!pilih.value) return
  sibuk.value = true
  try {
    await setAktifKru(pilih.value.id, keAktif.value)
    aktifOpen.value = false
    toast.add({ title: `${pilih.value.name} ${keAktif.value ? 'diaktifkan' : 'dinonaktifkan'}`, color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal: ${pesanGagalRoster(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
async function jalanHapus() {
  if (!pilih.value) return
  sibuk.value = true
  try {
    await hapusKru(pilih.value.id)
    hapusOpen.value = false
    toast.add({ title: `${pilih.value.name} dihapus permanen`, color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal menghapus: ${pesanGagalRoster(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <AppPage
    title="Data pegawai"
    description="Tambah kru baru, ubah data diri, nonaktifkan yang keluar."
  >
    <template
      v-if="peran.admin && !JADWAL_BACA_SAJA"
      #actions
    >
      <UButton
        label="Tambah kru"
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

    <AppPanel v-if="!pending && !peran.admin">
      <div class="py-6 text-center">
        <UIcon
          name="i-lucide-lock"
          class="size-8 text-dimmed"
        />
        <p class="mt-2 font-semibold text-highlighted">
          Halaman ini untuk HRD dan admin modul.
        </p>
        <p class="mt-1 text-sm text-muted">
          Data diri kru diurus di sini; hak akses modul tetap di <b>Kelola Akses</b> milik superadmin.
        </p>
      </div>
    </AppPanel>

    <fieldset
      v-else
      :disabled="JADWAL_BACA_SAJA"
      class="m-0 min-w-0 border-0 p-0"
    >
      <AppPanel
        title="Data pegawai"
        icon="i-lucide-users"
        :count="daftar.length"
        flush
      >
        <div class="space-y-3 p-4 lg:p-5">
          <p class="rounded-field bg-info/10 px-3 py-2 text-sm">
            Yang diurus di sini <b>data diri</b> kru: nama, Tim, nomor HP, Employee ID Talenta, jabatan, dan aktif/nonaktif.
            <b>Hak akses modul tidak bisa diubah dari sini</b> — itu tetap di <b>Kelola Akses</b> milik superadmin.
            Kolom <b>Tim</b> yang menentukan kru masuk lembar divisi mana.
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <AppSeg
              v-model="tapis"
              :options="opsiTapis"
              size="sm"
            />
            <USelect
              v-model="divTapis"
              :items="opsiDiv"
              class="w-44"
            />
            <UInput
              v-model="q"
              icon="i-lucide-search"
              placeholder="Cari nama, Tim, no HP, Employee ID, jabatan…"
              class="min-w-56 flex-1"
            />
            <UButton
              v-if="ketTapis"
              label="Bersihkan saringan"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="bersih"
            />
          </div>
          <p
            v-if="ketTapis"
            class="rounded-field px-3 py-2 text-sm"
            :class="daftar.length ? 'bg-muted' : 'bg-warning/12'"
          >
            <template v-if="daftar.length">
              Menampilkan <b>{{ daftar.length }}</b> dari {{ kru.length }} akun
            </template>
            <b v-else>Tidak ada yang cocok</b> — {{ ketTapis }}.
          </p>
        </div>

        <UTable
          class="hidden lg:block"
          :data="daftar"
          :columns="kolom"
          :loading="pending"
          empty="Tidak ada yang cocok dengan saringan ini."
          :meta="{ class: { tr: (row: { original: KruJadwal }) => (row.original.active === false ? 'opacity-60' : '') } }"
        >
          <template #no-cell="{ row }">
            <span class="text-muted num">{{ row.index + 1 }}</span>
          </template>
          <template #nama-cell="{ row }">
            <p class="font-semibold text-highlighted">
              {{ row.original.name }}
            </p>
            <p
              v-if="row.original.jobPosition"
              class="text-[13px] text-muted"
            >
              {{ row.original.jobPosition }}
            </p>
          </template>
          <template #keterangan-cell="{ row }">
            {{ row.original.keterangan || '—' }}
          </template>
          <template #divisi-cell="{ row }">
            <AppStatus
              size="sm"
              :class="row.original.divisi === DIV_NONSHIFT && 'opacity-60'"
            >
              {{ namaDivisiJadwal(row.original.divisi) }}
            </AppStatus>
            <p
              v-if="manual(row.original)"
              class="text-[12px] text-muted"
            >
              penempatan manual
            </p>
          </template>
          <template #noHp-cell="{ row }">
            <span class="num">{{ row.original.noHp || '—' }}</span>
          </template>
          <template #talentaId-cell="{ row }">
            <span class="num">{{ row.original.talentaId || '—' }}</span>
          </template>
          <template #status-cell="{ row }">
            <AppStatus
              size="sm"
              :color="row.original.active === false ? 'error' : 'success'"
              :icon="row.original.active === false ? 'i-lucide-user-x' : 'i-lucide-user-check'"
            >
              {{ row.original.active === false ? 'Nonaktif' : 'Aktif' }}
            </AppStatus>
          </template>
          <template #aksi-cell="{ row }">
            <div class="flex flex-wrap gap-1">
              <UButton
                label="Ubah"
                icon="i-lucide-pencil"
                color="neutral"
                variant="outline"
                size="xs"
                @click="bukaForm(row.original)"
              />
              <UButton
                v-if="row.original.active !== false"
                label="Nonaktifkan"
                color="error"
                variant="ghost"
                size="xs"
                @click="konfirmAktif(row.original, false)"
              />
              <template v-else>
                <UButton
                  label="Aktifkan"
                  color="success"
                  variant="ghost"
                  size="xs"
                  @click="konfirmAktif(row.original, true)"
                />
                <UButton
                  label="Hapus"
                  color="error"
                  variant="ghost"
                  size="xs"
                  title="Hapus permanen — nomor HP & Employee ID-nya bisa dipakai lagi"
                  @click="konfirmHapus(row.original)"
                />
              </template>
            </div>
          </template>
        </UTable>

        <div class="divide-y divide-default lg:hidden">
          <div
            v-for="u in daftar"
            :key="u.id"
            class="space-y-2 px-4 py-3"
            :class="u.active === false && 'opacity-70'"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="truncate font-semibold text-highlighted">
                  {{ u.name }}
                </p>
                <p class="text-sm text-muted">
                  {{ u.keterangan || '—' }} · {{ namaDivisiJadwal(u.divisi) }}<template v-if="u.noHp">
                    · <span class="num">{{ u.noHp }}</span>
                  </template>
                </p>
              </div>
              <AppStatus
                size="sm"
                :color="u.active === false ? 'error' : 'success'"
              >
                {{ u.active === false ? 'Nonaktif' : 'Aktif' }}
              </AppStatus>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <UButton
                label="Ubah"
                icon="i-lucide-pencil"
                color="neutral"
                variant="outline"
                size="sm"
                @click="bukaForm(u)"
              />
              <UButton
                v-if="u.active !== false"
                label="Nonaktifkan"
                color="error"
                variant="ghost"
                size="sm"
                @click="konfirmAktif(u, false)"
              />
              <template v-else>
                <UButton
                  label="Aktifkan"
                  color="success"
                  variant="ghost"
                  size="sm"
                  @click="konfirmAktif(u, true)"
                />
                <UButton
                  label="Hapus"
                  color="error"
                  variant="ghost"
                  size="sm"
                  @click="konfirmHapus(u)"
                />
              </template>
            </div>
          </div>
        </div>
        <p class="px-4 py-3 text-sm text-muted lg:px-5">
          {{ daftar.length }} dari {{ kru.length }} akun Office. Kru yang keluar <b>dinonaktifkan</b> dulu — jadwal bulan-bulan
          lalu tetap menyebut namanya. Yang sudah nonaktif bisa <b>dihapus permanen</b> kalau nomor HP atau Employee ID-nya perlu
          dipakai lagi; sesudah itu jadwal lamanya kehilangan nama pemiliknya.
        </p>
      </AppPanel>
    </fieldset>

    <ResponsiveSheet
      v-model:open="formOpen"
      :title="formId ? `Ubah data diri — ${f.name}` : 'Tambah kru'"
    >
      <div class="grid gap-3 lg:grid-cols-2">
        <UFormField
          label="Nama"
          required
          help="Dipakai juga untuk masuk ke Office, jadi harus unik."
          class="lg:col-span-2"
        >
          <UInput
            v-model="f.name"
            placeholder="Nama seperti yang dipakai masuk Office"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Tim / divisi"
          class="lg:col-span-2"
        >
          <UInput
            v-model="f.keterangan"
            placeholder="mis. Bar, Kitchen, Floor, Cashier, Office"
            class="w-full"
          />
          <div class="mt-2 flex flex-wrap gap-1.5">
            <UButton
              v-for="d in [...DIVISI.map(x => x.n), 'Office']"
              :key="d"
              :label="d"
              color="neutral"
              variant="outline"
              size="xs"
              @click="f.keterangan = d"
            />
          </div>
          <p
            class="mt-2 text-sm"
            :class="hintDiv === DIV_NONSHIFT ? 'text-warning' : 'text-muted'"
          >
            <template v-if="hintDiv === DIV_NONSHIFT">
              Belum menyebut divisi shift — kru ini <b>tidak akan muncul</b> di lembar jadwal. Bisa ditempatkan manual lewat Pengaturan → Penempatan Kru.
            </template>
            <template v-else>
              Masuk lembar <b>{{ namaDivisiJadwal(hintDiv) }}</b>.
            </template>
          </p>
        </UFormField>
        <UFormField
          label="Nomor HP"
          help="Dipakai modul lain untuk menghubungi; bukan untuk masuk."
        >
          <UInput
            v-model="f.noHp"
            placeholder="08xxxxxxxxxx"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Employee ID Talenta"
          help="Dipakai Talenta mencocokkan baris saat jadwal diimpor."
        >
          <UInput
            v-model="f.talentaId"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Branch">
          <USelect
            v-model="vBranch"
            :items="opsiHR(HR_BRANCH, f.branch)"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Organization"
          help="Berbeda dari Tim — yang menentukan lembar jadwal tetap Tim."
        >
          <USelect
            v-model="vOrg"
            :items="opsiHR(HR_ORG, f.organization)"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Job position">
          <UInput
            v-model="f.jobPosition"
            placeholder="mis. Bartender, Cook Helper"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Job level">
          <USelect
            v-model="vLevel"
            :items="opsiHR(HR_LEVEL, f.jobLevel)"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Employment status">
          <USelect
            v-model="vStatus"
            :items="opsiHR(HR_STATUS, f.employmentStatus)"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tanggal masuk">
          <UInput
            v-model="f.joinDate"
            type="date"
            class="w-full"
          />
        </UFormField>
        <p class="rounded-field bg-info/10 px-3 py-2 text-sm lg:col-span-2">
          <template v-if="!formId">
            Akun baru dibuat dengan <b>PIN 1111</b> — kru menggantinya sendiri lewat Laksamana Office. Modul yang bisa ia buka
            mengikuti <b>bawaan kolom Tim</b>; selebihnya diatur superadmin di Kelola Akses.
          </template>
          <template v-else>
            PIN, username, dan hak akses modul <b>tidak tersentuh</b> dari layar ini.
          </template>
        </p>
      </div>
      <template #footer>
        <UButton
          label="Simpan"
          :loading="sibuk"
          @click="simpan"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="formOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="aktifOpen"
      :title="`${keAktif ? 'Aktifkan kembali' : 'Nonaktifkan'} — ${pilih?.name ?? ''}`"
    >
      <p
        v-if="keAktif"
        class="rounded-field bg-info/10 px-3 py-2 text-sm"
      >
        <b>{{ pilih?.name }}</b> akan muncul lagi di lembar divisi <b>{{ namaDivisiJadwal(pilih?.divisi ?? '') }}</b> dan bisa masuk ke
        Laksamana Office seperti biasa. Shift lamanya yang masih tersimpan ikut tergambar lagi.
      </p>
      <div
        v-else
        class="space-y-2 text-sm"
      >
        <p class="rounded-field bg-warning/12 px-3 py-2">
          <b>{{ pilih?.name }}</b> tidak akan bisa masuk ke Laksamana Office, dan barisnya hilang dari <b>seluruh lembar jadwal —
            termasuk bulan-bulan yang sudah lewat</b>. Selnya tidak dihapus: begitu diaktifkan lagi, semuanya kembali.
        </p>
        <p>Ini yang dipakai untuk kru yang keluar. Sesudah nonaktif, barisnya masih bisa <b>dihapus permanen</b> kalau nomor HP atau Employee ID-nya perlu dipakai orang lain.</p>
      </div>
      <template #footer>
        <UButton
          :label="keAktif ? 'Ya, aktifkan' : 'Ya, nonaktifkan'"
          :color="keAktif ? 'primary' : 'error'"
          :loading="sibuk"
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
      :title="`Hapus permanen — ${pilih?.name ?? ''}`"
    >
      <div class="space-y-2 text-sm">
        <p class="rounded-field bg-error/12 px-3 py-2">
          <b>Tidak bisa dibatalkan.</b> Akun <b>{{ pilih?.name }}</b> dihapus dari Laksamana Office berikut seluruh hak akses modulnya.
        </p>
        <p>
          <b>Yang dibebaskan:</b> nomor HP<template v-if="pilih?.noHp">
            <span class="num"> {{ pilih.noHp }}</span>
          </template><template v-if="pilih?.talentaId">
            , Employee ID <span class="num">{{ pilih.talentaId }}</span>
          </template> — bisa dipakai akun lain.
        </p>
        <p><b>Yang hilang:</b> nama pemilik pada sel jadwal bulan-bulan lalu.</p>
      </div>
      <template #footer>
        <UButton
          label="Ya, hapus permanen"
          color="error"
          :loading="sibuk"
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
