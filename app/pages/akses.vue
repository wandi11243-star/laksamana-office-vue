<!--
  Kelola Akses › Daftar kru (old Tab User, deploy/index.html:706-897).

  Superadmin only, but no single module key fits — so there is NO
  meta.access here. The guard below throws the standard 403 instead (same
  wording as the middleware). U2 builds the shell + user list; the write
  forms (U3/U4) hook into #actions and `sheet`.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import {
  hapusUser, imporMassal, setAktif, simpanAkun, ubahModul, useAccountModules, useAccountUsers,
  type AccountModule, type AccountUser, type BarisGagalImpor, type SimpanUserBody,
} from '~/composables/useAccount'
import { isAdminOf } from '~/composables/useMe'
import { bacaBerkasTabel, type BarisTabel } from '~/utils/xlsx-baca'

const me = useMe()
if (!isAdminOf(me.value, '*')) {
  throw createError({ statusCode: 403, statusMessage: 'Anda belum punya akses ke modul ini. Minta admin membukanya di Kelola Akses.' })
}
const toast = useToast()

const { data: akun, status, error, refresh } = useAccountUsers()
const { data: daftarModul } = useAccountModules()
const users = computed(() => akun.value.users)
const timTersedia = computed(() => [...new Set(
  users.value.map(u => u.keterangan.trim()).filter(t => t !== ''),
)].sort((a, b) => a.localeCompare(b)))

const nAktif = computed(() => users.value.filter(u => u.active).length)
const nNonaktif = computed(() => users.value.length - nAktif.value)
const nSuper = computed(() => users.value.filter(u => u.adminModules.includes('*')).length)

type Tapis = 'semua' | 'aktif' | 'nonaktif'
const cari = ref('')
const tapis = ref<Tapis>('aktif')

const kandidat = computed(() => {
  const k = cari.value.trim().toLowerCase()
  if (!k) return users.value
  return users.value.filter(u =>
    u.name.toLowerCase().includes(k) || u.username.toLowerCase().includes(k))
})
const tampil = computed(() => tapis.value === 'semua'
  ? kandidat.value
  : kandidat.value.filter(u => tapis.value === 'aktif' ? u.active : !u.active))

const opsiTapis = computed(() => [
  { value: 'semua' as Tapis, label: `Semua · ${kandidat.value.length}` },
  { value: 'aktif' as Tapis, label: `Aktif · ${kandidat.value.filter(u => u.active).length}` },
  { value: 'nonaktif' as Tapis, label: `Nonaktif · ${kandidat.value.filter(u => !u.active).length}` },
])

// Friendly module names for the grant chips; raw keys stay readable.
const labelModul = (key: string): string =>
  MODUL.find(m => m.access.includes(key))?.label ?? key

const superadmin = (u: AccountUser): boolean => u.adminModules.includes('*')
const saya = (u: AccountUser): boolean =>
  !!me.value && String(u.name || '').toLowerCase() === me.value.name.toLowerCase()
const inisial = (n: string): string =>
  String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()

const kolom: TableColumn<AccountUser>[] = [
  { accessorKey: 'name', header: 'Nama' },
  { accessorKey: 'keterangan', header: 'Tim' },
  { accessorKey: 'modules', header: 'Modul' },
  { accessorKey: 'adminModules', header: 'Akses admin' },
  { accessorKey: 'active', header: 'Status' },
  { id: 'aksi', header: '' },
]

// AksesUserSheet owns this form: tambah (pilih null) or ubah one kru.
const sheet = ref(false)
const pilih = ref<AccountUser | null>(null)
function bukaTambah() {
  pilih.value = null
  sheet.value = true
}
function bukaUbah(u: AccountUser) {
  pilih.value = u
  sheet.value = true
}

// Delete flow: permanent delete is for deactivated rows only (the server
// refuses active accounts, self-deletes and Kepala Divisi —
// must_deactivate_first / cannot_delete_self / is_kepala_divisi). The own
// row never shows a delete button; an active row offers Nonaktifkan first.
const hapusBuka = ref(false)
const hapusTarget = ref<AccountUser | null>(null)
const hapusAktif = ref(false)
const menghapus = ref(false)
function bukaHapus(u: AccountUser) {
  hapusTarget.value = u
  hapusAktif.value = u.active
  hapusBuka.value = true
}
async function nonaktifkanTarget() {
  const t = hapusTarget.value
  if (!t) return
  menghapus.value = true
  const ok = await simpanAkun(() => setAktif(t.id, false), `${t.name} dinonaktifkan`)
  menghapus.value = false
  if (ok) hapusAktif.value = false
}
async function hapusTargetPermanen() {
  const t = hapusTarget.value
  if (!t) return
  menghapus.value = true
  const ok = await simpanAkun(() => hapusUser(t.id), `${t.name} dihapus`)
  menghapus.value = false
  if (ok) {
    hapusBuka.value = false
    hapusTarget.value = null
  }
}

// ---- Tab Pengguna | Modul (U4) ----
type TabAkses = 'pengguna' | 'modul'
const tab = ref<TabAkses>('pengguna')
const opsiTab = computed(() => [
  { value: 'pengguna' as TabAkses, label: `Pengguna · ${users.value.length}` },
  { value: 'modul' as TabAkses, label: `Modul · ${daftarModul.value.length}` },
])

// ---- Modul registry (U4) ----
// The server is ADD-ONLY here: POST /account/modules only adds new keys, and
// there is no DELETE — so this screen offers no create/delete UI, only relabel
// (PATCH label) and on/off (PATCH active). The key itself never changes.
const kolomModul: TableColumn<AccountModule>[] = [
  { accessorKey: 'label', header: 'Modul' },
  { accessorKey: 'active', header: 'Status' },
  { id: 'aksi', header: '' },
]
const modulBuka = ref(false)
const modulTarget = ref<AccountModule | null>(null)
const modulLabel = ref('')
const modulMenyimpan = ref(false)
const sibukModul = ref<string[]>([])
function bukaUbahModul(m: AccountModule) {
  modulTarget.value = m
  modulLabel.value = m.label || ''
  modulBuka.value = true
}
async function simpanModul() {
  const t = modulTarget.value
  const label = modulLabel.value.trim()
  if (!t || !label) return
  modulMenyimpan.value = true
  const ok = await simpanAkun(() => ubahModul(t.key, { label }), 'Label modul diperbarui')
  modulMenyimpan.value = false
  if (ok) modulBuka.value = false
}
async function toggleModul(m: AccountModule, v: boolean | 'indeterminate') {
  if (v === 'indeterminate') return
  const k = `modul:${m.key}`
  sibukModul.value.push(k)
  await simpanAkun(
    () => ubahModul(m.key, { active: v }),
    v ? `${m.label || m.key} diaktifkan` : `${m.label || m.key} dinonaktifkan`,
  )
  sibukModul.value = sibukModul.value.filter(x => x !== k)
}

// ---- Ekspor CSV (U4) ----
// Column contract, shared with the import below: one saveUser body per row, so
// the CSV header is exactly the bulk body keys. `pin` stays empty on export —
// v1 never returns PINs. On import `pin_kosong` and `tim` are accepted as
// aliases of `pin` and `keterangan`; unknown columns are ignored.
const KOLOM_KRU = [
  'nama', 'username', 'pin', 'keterangan', 'noHp', 'talentaId', 'email',
  'branch', 'organization', 'jobPosition', 'jobLevel', 'employmentStatus', 'joinDate',
] as const
const selCsv = (v: unknown): string => {
  const t = String(v ?? '')
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}
function eksporCsv() {
  const baris = tampil.value.map(u => [
    u.name, u.username, '', u.keterangan, u.noHp ?? '', u.talentaId ?? '', u.email ?? '',
    u.branch ?? '', u.organization ?? '', u.jobPosition ?? '', u.jobLevel ?? '',
    u.employmentStatus ?? '', u.joinDate ?? '',
  ])
  const isi = [KOLOM_KRU.join(','), ...baris.map(b => b.map(selCsv).join(','))].join('\r\n')
  const blob = new Blob([`\uFEFF${isi}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `kru-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  toast.add({ title: `${baris.length} baris diekspor`, color: 'success' })
}

// ---- Impor .xlsx/.csv (U4) ----
const imporInput = ref<HTMLInputElement | null>(null)
const membacaImpor = ref(false)
const imporGalat = ref('')
const imporBuka = ref(false)
const mengimpor = ref(false)
interface CalonImpor { nama: string, body: SimpanUserBody & { _baris?: number } }
interface BarisBuruk { baris: number, nama: string, sebab: string }
const imporValid = ref<CalonImpor[]>([])
const imporBuruk = ref<BarisBuruk[]>([])

/** Spreadsheet header -> bulk body key. Lowercased, spaces/underscores dropped. */
function kunciKolomImpor(h: string): string | null {
  const k = h.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_]+/g, '')
  switch (k) {
    case 'nama': case 'name': return 'name'
    case 'username': case 'user': return 'username'
    case 'pin': case 'pinkosong': return 'pin'
    case 'keterangan': case 'tim': return 'keterangan'
    case 'nohp': case 'hp': case 'telepon': return 'noHp'
    case 'talentaid': case 'talenta': return 'talentaId'
    case 'email': return 'email'
    case 'branch': case 'cabang': return 'branch'
    case 'organization': case 'organisasi': return 'organization'
    case 'jobposition': case 'posisi': case 'jabatan': return 'jobPosition'
    case 'joblevel': case 'level': return 'jobLevel'
    case 'employmentstatus': case 'statuskerja': return 'employmentStatus'
    case 'joindate': case 'tanggalmasuk': case 'tglmasuk': return 'joinDate'
    default: return null
  }
}

async function pilihBerkasImpor(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  membacaImpor.value = true
  imporGalat.value = ''
  try {
    const tabel: BarisTabel[] = await bacaBerkasTabel(f)
    if (!tabel.length) throw new Error('Berkasnya kosong.')
    const peta = new Map<string, string>()
    for (const [huruf, judul] of Object.entries(tabel[0] ?? {})) {
      const k = kunciKolomImpor(String(judul ?? ''))
      if (k && ![...peta.values()].includes(k)) peta.set(huruf, k)
    }
    if (![...peta.values()].includes('name')) {
      throw new Error('Kolom nama tidak ketemu. Kepala kolomnya harus memuat “nama”.')
    }
    const data = tabel.slice(1)
    if (!data.length) throw new Error('Tidak ada baris data di bawah kepala kolom.')
    if (data.length > 500) throw new Error(`Berkasnya ${data.length} baris — maksimal 500 per impor. Pecah jadi dua berkas.`)
    const valid: CalonImpor[] = []
    const buruk: BarisBuruk[] = []
    data.forEach((r, i) => {
      const noBaris = i + 2 // 1-based, counting the header row
      const nilai: Record<string, string> = {}
      for (const [huruf, k] of peta) {
        const v = String(r[huruf] ?? '').trim()
        if (v) nilai[k] = v
      }
      if (!Object.keys(nilai).length) return // skip blank rows silently
      const nama = nilai.name ?? ''
      if (!nama) {
        buruk.push({ baris: noBaris, nama: '(tanpa nama)', sebab: 'Nama wajib diisi' })
        return
      }
      const body: SimpanUserBody & { _baris?: number } = { name: nama, _baris: noBaris }
      for (const k of ['username', 'pin', 'keterangan', 'noHp', 'talentaId', 'email', 'branch', 'organization', 'jobPosition', 'jobLevel', 'employmentStatus', 'joinDate'] as const) {
        const v = nilai[k]
        if (v) (body as unknown as Record<string, string>)[k] = v
      }
      valid.push({ nama, body })
    })
    imporValid.value = valid
    imporBuruk.value = buruk
    if (!valid.length && !buruk.length) throw new Error('Tidak ada baris data di bawah kepala kolom.')
    imporBuka.value = true
  }
  catch (err) {
    imporGalat.value = (err as Error)?.message || 'Berkasnya tidak bisa dibaca.'
  }
  finally {
    membacaImpor.value = false
  }
}

async function kirimImpor() {
  if (!imporValid.value.length || mengimpor.value) return
  mengimpor.value = true
  try {
    const r = await imporMassal(imporValid.value.map(v => v.body))
    const d = r.data
    await refresh()
    imporBuka.value = false
    imporValid.value = []
    imporBuruk.value = []
    const gagal: BarisGagalImpor[] = d.baris ?? []
    const rincian = gagal.slice(0, 3).map(b => `${b.nama || `baris ${b.baris}`}: ${b.error}`).join('; ')
    toast.add({
      title: `Impor selesai: ${d.sukses} berhasil, ${d.gagal} gagal`,
      description: rincian || undefined,
      color: d.gagal ? 'warning' : 'success',
    })
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    mengimpor.value = false
  }
}
</script>

<template>
  <AppPage
    title="Kelola Akses"
    description="Akun dan modul yang boleh dibuka. Tidak ada role: akses diberikan langsung per modul."
  >
    <template #actions>
      <template v-if="tab === 'pengguna'">
        <UButton
          label="Ekspor"
          icon="i-lucide-download"
          color="neutral"
          variant="outline"
          @click="eksporCsv"
        />
        <UButton
          label="Impor"
          icon="i-lucide-upload"
          color="neutral"
          variant="outline"
          :loading="membacaImpor"
          @click="imporInput?.click()"
        />
      </template>
      <UButton
        label="Tambah kru"
        icon="i-lucide-plus"
        @click="bukaTambah"
      />
      <input
        ref="imporInput"
        type="file"
        accept=".xlsx,.csv"
        class="sr-only"
        tabindex="-1"
        @change="pilihBerkasImpor"
      >
    </template>

    <div class="mb-4">
      <AppSeg
        v-model="tab"
        :options="opsiTab"
      />
    </div>

    <template v-if="tab === 'pengguna'">
      <AppStatGrid>
      <AppStat
        label="Total kru"
        :value="users.length"
        icon="i-lucide-users"
        tone="gold"
        sub="Terdaftar di Office"
      />
      <AppStat
        label="Aktif"
        :value="nAktif"
        icon="i-lucide-user-check"
        tone="success"
        sub="Bisa login"
      />
      <AppStat
        label="Nonaktif"
        :value="nNonaktif"
        icon="i-lucide-user-x"
        tone="warning"
        sub="Tidak bisa login"
      />
      <AppStat
        label="Superadmin"
        :value="nSuper"
        icon="i-lucide-shield-check"
        tone="info"
        sub="Kelola semua modul"
      />
    </AppStatGrid>

    <AppPanel
      title="Daftar kru"
      icon="i-lucide-users"
      :count="tampil.length"
      flush
    >
      <div class="flex flex-wrap items-center gap-2 px-4 pt-4 lg:px-5">
        <UInput
          v-model="cari"
          icon="i-lucide-search"
          placeholder="Cari nama atau username"
          class="min-w-48 flex-1 sm:max-w-72"
        />
        <AppSeg
          v-model="tapis"
          size="sm"
          :options="opsiTapis"
        />
      </div>
      <p class="px-4 pt-2 text-xs text-muted lg:px-5">
        Ekspor mengunduh daftar yang tampil. Impor menerima .xlsx/.csv dengan kolom nama, username, pin, keterangan, noHp, talentaId — modul dan hak admin diatur setelah kru dibuat.
      </p>
      <p
        v-if="membacaImpor"
        class="px-4 pt-1 text-xs text-muted lg:px-5"
      >
        Membaca berkas…
      </p>
      <p
        v-if="imporGalat"
        class="mx-4 mt-2 rounded-field bg-error/12 px-3 py-2 text-sm text-error lg:mx-5"
      >
        Gagal membaca berkasnya: {{ imporGalat }}
      </p>

      <div
        v-if="status === 'pending' && !tampil.length"
        class="p-6 text-center text-sm text-muted"
      >
        Memuat daftar kru dari Office…
      </div>

      <div
        v-else-if="error"
        class="p-4 lg:p-5"
      >
        <UAlert
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Tidak bisa memuat daftar kru"
          :description="apiErrorMessage(error, 'Periksa koneksi internet, lalu muat ulang halaman.')"
        />
        <UButton
          label="Coba lagi"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="outline"
          class="mt-3"
          @click="refresh()"
        />
      </div>

      <div
        v-else-if="!tampil.length"
        class="p-6 text-center text-sm text-muted"
      >
        <b class="block text-highlighted">Tidak ada kru yang cocok</b>
        <template v-if="cari">
          Tidak ada kru{{ tapis === 'semua' ? '' : ` ${tapis}` }} yang cocok dengan “{{ cari.trim() }}”.{{ tapis === 'semua' ? '' : ' Coba tapis Semua.' }}
        </template>
        <template v-else>
          {{ tapis === 'semua' ? 'Belum ada kru terdaftar.' : `Tidak ada kru ${tapis}.` }}
        </template>
      </div>

      <template v-else>
        <UTable
          class="hidden lg:block"
          :data="tampil"
          :columns="kolom"
        >
          <template #name-cell="{ row }">
            <span class="flex items-center gap-2">
              <span class="flex size-7 flex-none items-center justify-center rounded-md bg-yellow-light text-[11px] font-bold text-yellow-dark">{{ inisial(row.original.name) }}</span>
              <span class="min-w-0">
                <b class="block truncate text-highlighted">{{ row.original.name || '(tanpa nama)' }}</b>
                <span
                  v-if="row.original.username"
                  class="block truncate text-xs text-muted"
                >@{{ row.original.username }}</span>
              </span>
              <AppStatus
                v-if="saya(row.original)"
                color="info"
                size="sm"
              >kamu</AppStatus>
            </span>
          </template>
          <template #keterangan-cell="{ row }">
            <span class="text-muted">{{ row.original.keterangan || '—' }}</span>
          </template>
          <template #modules-cell="{ row }">
            <div
              v-if="row.original.modules.length"
              class="flex flex-wrap gap-1"
            >
              <span
                v-for="m in row.original.modules.slice(0, 3)"
                :key="m"
                class="rounded-full border border-default px-2 py-0.5 text-[11px] text-muted"
              >{{ labelModul(m) }}</span>
              <span
                v-if="row.original.modules.length > 3"
                class="rounded-full border border-default px-2 py-0.5 text-[11px] font-semibold text-muted"
              >+{{ row.original.modules.length - 3 }}</span>
            </div>
            <span
              v-else
              class="text-dimmed"
            >—</span>
          </template>
          <template #adminModules-cell="{ row }">
            <AppStatus
              v-if="superadmin(row.original)"
              color="gold"
              icon="i-lucide-shield-check"
              size="sm"
            >
              Superadmin
            </AppStatus>
            <span
              v-else-if="row.original.adminModules.length"
              class="text-xs text-muted"
            >Admin: {{ row.original.adminModules.map(labelModul).join(', ') }}</span>
            <span
              v-else
              class="text-dimmed"
            >—</span>
          </template>
          <template #active-cell="{ row }">
            <AppStatus
              :color="row.original.active ? 'success' : 'neutral'"
              :icon="row.original.active ? 'i-lucide-check' : 'i-lucide-minus'"
              size="sm"
            >
              {{ row.original.active ? 'Aktif' : 'Nonaktif' }}
            </AppStatus>
          </template>
          <template #aksi-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="outline"
                size="xs"
                :aria-label="`Ubah ${row.original.name}`"
                @click="bukaUbah(row.original)"
              />
              <UButton
                v-if="!saya(row.original)"
                icon="i-lucide-trash-2"
                color="error"
                variant="outline"
                size="xs"
                :aria-label="`Hapus ${row.original.name}`"
                @click="bukaHapus(row.original)"
              />
            </div>
          </template>
        </UTable>

        <div class="divide-y divide-default lg:hidden">
          <div
            v-for="u in tampil"
            :key="u.id"
            class="flex items-start gap-3 p-4"
          >
            <span class="flex size-8 flex-none items-center justify-center rounded-md bg-yellow-light text-xs font-bold text-yellow-dark">{{ inisial(u.name) }}</span>
            <div class="min-w-0 flex-1">
              <b class="block truncate text-highlighted">{{ u.name || '(tanpa nama)' }}</b>
              <span class="block truncate text-xs text-muted">
                <template v-if="u.username">@{{ u.username }}</template>
                <template v-if="u.username && u.keterangan"> · </template>
                <template v-if="u.keterangan">{{ u.keterangan }}</template>
                <template v-if="!u.username && !u.keterangan">—</template>
              </span>
              <div class="mt-1.5 flex flex-wrap gap-1.5">
                <AppStatus
                  :color="u.active ? 'success' : 'neutral'"
                  :icon="u.active ? 'i-lucide-check' : 'i-lucide-minus'"
                  size="sm"
                >
                  {{ u.active ? 'Aktif' : 'Nonaktif' }}
                </AppStatus>
                <AppStatus
                  v-if="superadmin(u)"
                  color="gold"
                  icon="i-lucide-shield-check"
                  size="sm"
                >
                  Superadmin
                </AppStatus>
                <AppStatus
                  v-else-if="u.adminModules.length"
                  color="neutral"
                  size="sm"
                >
                  Admin: {{ u.adminModules.map(labelModul).join(', ') }}
                </AppStatus>
                <AppStatus
                  v-if="saya(u)"
                  color="info"
                  size="sm"
                >
                  kamu
                </AppStatus>
              </div>
              <div
                v-if="u.modules.length"
                class="mt-1.5 flex flex-wrap gap-1"
              >
                <span
                  v-for="m in u.modules.slice(0, 3)"
                  :key="m"
                  class="rounded-full border border-default px-2 py-0.5 text-[11px] text-muted"
                >{{ labelModul(m) }}</span>
                <span
                  v-if="u.modules.length > 3"
                  class="rounded-full border border-default px-2 py-0.5 text-[11px] font-semibold text-muted"
                >+{{ u.modules.length - 3 }}</span>
              </div>
            </div>
            <div class="flex gap-1">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="outline"
                size="xs"
                :aria-label="`Ubah ${u.name}`"
                @click="bukaUbah(u)"
              />
              <UButton
                v-if="!saya(u)"
                icon="i-lucide-trash-2"
                color="error"
                variant="outline"
                size="xs"
                :aria-label="`Hapus ${u.name}`"
                @click="bukaHapus(u)"
              />
            </div>
          </div>
        </div>
      </template>
    </AppPanel>
    </template>

    <AppPanel
      v-else
      title="Daftar modul"
      icon="i-lucide-key-round"
      :count="daftarModul.length"
      description="Modul baru didaftarkan lewat sinkronisasi server — daftar ini hanya mengganti label dan mengaktifkan/menonaktifkan."
      flush
    >
      <div
        v-if="!daftarModul.length"
        class="p-6 text-center text-sm text-muted"
      >
        Belum ada modul terdaftar.
      </div>
      <template v-else>
        <UTable
          class="hidden lg:block"
          :data="daftarModul"
          :columns="kolomModul"
        >
          <template #label-cell="{ row }">
            <b class="block text-highlighted">{{ row.original.label || row.original.key }}</b>
            <span class="block text-xs text-muted">{{ row.original.key }}</span>
          </template>
          <template #active-cell="{ row }">
            <AppStatus
              :color="row.original.active ? 'success' : 'neutral'"
              :icon="row.original.active ? 'i-lucide-check' : 'i-lucide-minus'"
              size="sm"
            >
              {{ row.original.active ? 'Aktif' : 'Nonaktif' }}
            </AppStatus>
          </template>
          <template #aksi-cell="{ row }">
            <div class="flex items-center justify-end gap-3">
              <USwitch
                :model-value="row.original.active"
                :disabled="sibukModul.includes(`modul:${row.original.key}`)"
                :aria-label="`${row.original.active ? 'Nonaktifkan' : 'Aktifkan'} ${row.original.label || row.original.key}`"
                @update:model-value="(v) => toggleModul(row.original, v)"
              />
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="outline"
                size="xs"
                :aria-label="`Ubah label ${row.original.label || row.original.key}`"
                @click="bukaUbahModul(row.original)"
              />
            </div>
          </template>
        </UTable>

        <div class="divide-y divide-default lg:hidden">
          <div
            v-for="m in daftarModul"
            :key="m.key"
            class="flex items-center gap-3 p-4"
          >
            <div class="min-w-0 flex-1">
              <b class="block truncate text-highlighted">{{ m.label || m.key }}</b>
              <span class="block truncate text-xs text-muted">{{ m.key }}</span>
              <div class="mt-1.5">
                <AppStatus
                  :color="m.active ? 'success' : 'neutral'"
                  :icon="m.active ? 'i-lucide-check' : 'i-lucide-minus'"
                  size="sm"
                >
                  {{ m.active ? 'Aktif' : 'Nonaktif' }}
                </AppStatus>
              </div>
            </div>
            <USwitch
              :model-value="m.active"
              :disabled="sibukModul.includes(`modul:${m.key}`)"
              :aria-label="`${m.active ? 'Nonaktifkan' : 'Aktifkan'} ${m.label || m.key}`"
              @update:model-value="(v) => toggleModul(m, v)"
            />
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="outline"
              size="xs"
              :aria-label="`Ubah label ${m.label || m.key}`"
              @click="bukaUbahModul(m)"
            />
          </div>
        </div>
      </template>
    </AppPanel>

    <AksesUserSheet
      v-model:open="sheet"
      :user="pilih"
      :modules="daftarModul"
      :tim-tersedia="timTersedia"
    />

    <ResponsiveSheet
      v-model:open="hapusBuka"
      :title="hapusAktif ? 'Nonaktifkan dulu?' : `Hapus ${hapusTarget?.name || 'kru'}?`"
      :description="hapusAktif
        ? `${hapusTarget?.name || 'Kru'} masih aktif — hapus hanya berlaku untuk kru nonaktif. Nonaktifkan dulu, lalu hapus bila perlu.`
        : 'Kru nonaktif ini dihapus permanen beserta semua aksesnya.'"
    >
      <template #footer>
        <UButton
          v-if="hapusAktif"
          label="Nonaktifkan"
          icon="i-lucide-user-x"
          :loading="menghapus"
          @click="nonaktifkanTarget"
        />
        <UButton
          v-else
          label="Hapus permanen"
          icon="i-lucide-trash-2"
          color="error"
          :loading="menghapus"
          @click="hapusTargetPermanen"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="hapusBuka = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="modulBuka"
      :title="`Ubah label ${modulTarget?.key || 'modul'}`"
      description="Kunci modul tidak bisa diganti — yang berubah hanya label tampilannya."
    >
      <UFormField label="Label modul">
        <UInput
          v-model="modulLabel"
          placeholder="Nama tampilan modul"
          class="w-full"
        />
      </UFormField>
      <template #footer>
        <UButton
          label="Simpan"
          icon="i-lucide-check"
          :loading="modulMenyimpan"
          :disabled="!modulLabel.trim()"
          @click="simpanModul"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="modulBuka = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="imporBuka"
      title="Impor kru dari berkas"
      :description="`${imporValid.length} baris valid${imporBuruk.length ? `, ${imporBuruk.length} bermasalah` : ''} — periksa dulu, baru kirim. PIN yang dikosongkan jadi 1111.`"
    >
      <div
        v-if="imporBuruk.length"
        class="grid gap-1.5"
      >
        <p class="text-sm font-semibold text-highlighted">
          Baris bermasalah (dilewati):
        </p>
        <p
          v-for="b in imporBuruk.slice(0, 5)"
          :key="b.baris"
          class="rounded-field bg-error/12 px-3 py-2 text-sm text-error"
        >
          Baris {{ b.baris }} · {{ b.nama }} — {{ b.sebab }}
        </p>
        <p
          v-if="imporBuruk.length > 5"
          class="text-xs text-muted"
        >
          +{{ imporBuruk.length - 5 }} baris bermasalah lainnya.
        </p>
      </div>
      <p
        v-else
        class="text-sm text-muted"
      >
        Semua baris punya nama — siap dikirim. Modul dan hak admin diatur setelah kru dibuat.
      </p>
      <template #footer>
        <UButton
          :label="`Impor ${imporValid.length} kru`"
          icon="i-lucide-upload"
          :loading="mengimpor"
          :disabled="!imporValid.length"
          @click="kirimImpor"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="imporBuka = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
