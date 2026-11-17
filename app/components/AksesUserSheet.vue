<!--
  Kru form (old Kelola User form + the Kelola Akses checkbox panel).

  Identity + HR save on Simpan (buatUser/ubahUser). Module grants, module
  admins and the Aktif switch write LIVE via simpanAkun (old panel parity:
  each toggle is its own PUT). For a new user the access boxes stage locally
  and are applied right after buatUser, so access can be checked before save.

  PIN is write-only: the API never returns it, so the field always starts
  empty: blank means the server default (1111) on create, "keep the old
  one" on edit.
-->
<script setup lang="ts">
import {
  buatUser, setAkses, setAdmin, setAktif, simpanAkun, ubahUser,
  type AccountModule, type AccountUser, type SimpanUserBody,
} from '~/composables/useAccount'
import { TIM_OFFICE } from '~/utils/bd-rumus'

const props = defineProps<{
  user: AccountUser | null
  modules: AccountModule[]
  /**
   * Raw history of Tim strings (unique `keterangan` values). Kept only so the
   * caller (`akses.vue`) keeps compiling: the chips below deliberately ignore
   * it and read the canonical list instead.
   */
  timTersedia: string[]
}>()
const open = defineModel<boolean>('open', { default: false })

const modeBuat = computed(() => !props.user)

const f = reactive({
  name: '',
  username: '',
  pin: '',
  keterangan: '',
  noHp: '',
  talentaId: '',
  branch: '',
  organization: '',
  jobPosition: '',
  jobLevel: '',
  employmentStatus: '',
  joinDate: '',
})
const errNama = ref('')
const errUsername = ref('')
const menyimpan = ref(false)
const toast = useToast()
/** Bulk operations in flight for the two checkbox groups. */
const massalModul = ref(false)
const massalAdmin = ref(false)
/** Staged access keys for a not-yet-created user, applied right after buatUser. */
const pendingBaru = ref<string[]>([])
/** Toggle keys currently in flight (`akses:<key>`, `admin:<key>`, `aktif`). */
const sibuk = ref<string[]>([])
const tandaiSibuk = (k: string) => {
  sibuk.value.push(k)
}
const selesaiSibuk = (k: string) => {
  sibuk.value = sibuk.value.filter(x => x !== k)
}
const lagiSibuk = (k: string): boolean => sibuk.value.includes(k)

watch(open, (buka) => {
  if (!buka) return
  const u = props.user
  f.name = u?.name ?? ''
  f.username = u?.username ?? ''
  f.pin = ''
  f.keterangan = u?.keterangan ?? ''
  f.noHp = u?.noHp ?? ''
  f.talentaId = u?.talentaId ?? ''
  f.branch = u?.branch ?? ''
  f.organization = u?.organization ?? ''
  f.jobPosition = u?.jobPosition ?? ''
  f.jobLevel = u?.jobLevel ?? ''
  f.employmentStatus = u?.employmentStatus ?? ''
  f.joinDate = u?.joinDate ?? ''
  errNama.value = ''
  errUsername.value = ''
  pendingBaru.value = []
  massalModul.value = false
  massalAdmin.value = false
})

const POLA_USERNAME = /^[A-Za-z0-9._-]{3,40}$/

function valid(): boolean {
  errNama.value = f.name.trim() ? '' : 'Nama wajib diisi.'
  const u = f.username.trim()
  errUsername.value = !u
    ? ''
    : (POLA_USERNAME.test(u) ? '' : '3–40 karakter: huruf, angka, titik, garis bawah, strip.')
  return !errNama.value && !errUsername.value
}

async function simpan() {
  if (!valid()) return
  menyimpan.value = true
  const nul = (v: string): string | null => {
    const t = v.trim()
    return t === '' ? null : t
  }
  const body: SimpanUserBody = {
    name: f.name.trim(),
    username: nul(f.username),
    keterangan: f.keterangan.trim(),
    noHp: nul(f.noHp),
    talentaId: nul(f.talentaId),
    branch: nul(f.branch),
    organization: nul(f.organization),
    jobPosition: nul(f.jobPosition),
    jobLevel: nul(f.jobLevel),
    employmentStatus: nul(f.employmentStatus),
    joinDate: nul(f.joinDate),
  }
  if (f.pin) body.pin = f.pin
  // Edit mode only rewrites identity/HR here: access checkboxes save live.
  // Create mode applies the staged checkboxes right after the user exists.
  if (props.user) {
    const ok = await simpanAkun(() => ubahUser(props.user!.id, body), 'Data kru diperbarui')
    menyimpan.value = false
    if (ok) open.value = false
    return
  }
  try {
    const r = await buatUser(body)
    const idBaru = r.data.id
    const staged = [...pendingBaru.value]
    if (staged.length && idBaru) {
      for (const k of staged)
        await setAkses(idBaru, k, true)
    }
    await refreshNuxtData(['account-users', 'account-modules'])
    toast.add({
      title: staged.length ? `Kru ditambahkan, ${staged.length} akses dibuka` : 'Kru ditambahkan',
      color: 'success',
    })
    menyimpan.value = false
    open.value = false
  }
  catch (e) {
    menyimpan.value = false
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

const punyaAkses = (key: string): boolean => props.user?.grants.includes(key) ?? false
const punyaAdmin = (key: string): boolean => props.user?.adminModules.includes(key) ?? false

// ---- Checkbox system: one box per Modul, checked = granted ----
// Create mode stages into pendingBaru (no user id yet); edit mode reads grants
// directly so every box always shows the server truth. '*' is the "Semua modul"
// box and joins the access bulk actions; the superadmin box stays manual.
const kunciAkses = computed(() => ['*', ...props.modules.map(m => m.key)])
const aksesDicentang = (key: string): boolean =>
  props.user ? punyaAkses(key) : pendingBaru.value.includes(key)
const nAksesDipilih = computed(() => kunciAkses.value.filter(k => aksesDicentang(k)).length)
const semuaAksesDipilih = computed(() =>
  kunciAkses.value.length > 0 && nAksesDipilih.value >= kunciAkses.value.length)
const adaAksesDipilih = computed(() => nAksesDipilih.value > 0)

// The admin bulk actions only touch per-Modul admin keys: superadmin ('*') is
// granted or revoked one box at a time, never by "pilih/hapus semua".
const kunciAdmin = computed(() => props.modules.map(m => m.key))
const nAdminDipilih = computed(() => kunciAdmin.value.filter(k => punyaAdmin(k)).length)
const semuaAdminDipilih = computed(() =>
  kunciAdmin.value.length > 0 && nAdminDipilih.value >= kunciAdmin.value.length)
const adaAdminDipilih = computed(() => nAdminDipilih.value > 0)

function toggleAksesBaru(key: string, v: boolean) {
  pendingBaru.value = v
    ? [...new Set([...pendingBaru.value, key])]
    : pendingBaru.value.filter(k => k !== key)
}

async function onToggleAkses(key: string, v: boolean | 'indeterminate') {
  if (v === 'indeterminate') return
  if (!props.user) {
    toggleAksesBaru(key, v)
    return
  }
  await toggleAkses(key, v)
}

/** Idempotent bulk save: only keys that differ are sent, then one toast. */
async function bulkAkses(buka: boolean) {
  // Create mode has no user yet: just stage every box locally.
  if (!props.user) {
    pendingBaru.value = buka ? [...kunciAkses.value] : []
    return
  }
  if (massalModul.value) return
  const perlu = kunciAkses.value.filter(k => punyaAkses(k) !== buka)
  if (!perlu.length) {
    toast.add({ title: 'Sudah sesuai, tidak ada perubahan', color: 'success' })
    return
  }
  massalModul.value = true
  try {
    for (const k of perlu)
      await setAkses(props.user.id, k, buka)
    await refreshNuxtData(['account-users', 'account-modules'])
    toast.add({
      title: buka ? `Semua akses dibuka (${perlu.length} modul)` : 'Semua akses ditutup',
      color: 'success',
    })
  }
  catch (e) {
    await refreshNuxtData(['account-users', 'account-modules'])
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    massalModul.value = false
  }
}

async function bulkAdmin(buka: boolean) {
  if (!props.user || massalAdmin.value) return
  const perlu = kunciAdmin.value.filter(k => punyaAdmin(k) !== buka)
  if (!perlu.length) {
    toast.add({ title: 'Sudah sesuai, tidak ada perubahan', color: 'success' })
    return
  }
  massalAdmin.value = true
  try {
    for (const k of perlu)
      await setAdmin(props.user.id, k, buka)
    await refreshNuxtData(['account-users', 'account-modules'])
    toast.add({
      title: buka ? `Semua hak admin diberikan (${perlu.length} modul)` : 'Semua hak admin dicabut',
      color: 'success',
    })
  }
  catch (e) {
    await refreshNuxtData(['account-users', 'account-modules'])
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    massalAdmin.value = false
  }
}

async function toggleAkses(key: string, v: boolean | 'indeterminate') {
  if (!props.user || v === 'indeterminate') return
  const k = `akses:${key}`
  tandaiSibuk(k)
  await simpanAkun(() => setAkses(props.user!.id, key, v), v ? 'Akses dibuka' : 'Akses ditutup')
  selesaiSibuk(k)
}

async function toggleAdmin(key: string, v: boolean | 'indeterminate') {
  if (!props.user || v === 'indeterminate') return
  const k = `admin:${key}`
  tandaiSibuk(k)
  await simpanAkun(
    () => setAdmin(props.user!.id, key, v),
    v ? 'Hak admin diberikan' : 'Hak admin dicabut',
  )
  selesaiSibuk(k)
}

async function toggleAktif(v: boolean | 'indeterminate') {
  if (!props.user || v === 'indeterminate') return
  const k = 'aktif'
  tandaiSibuk(k)
  await simpanAkun(
    () => setAktif(props.user!.id, v),
    v ? `${props.user!.name} diaktifkan` : `${props.user!.name} dinonaktifkan`,
  )
  selesaiSibuk(k)
}

/**
 * Canonical team labels for the Tim chips: the labels of `App\Support\Tim::TIM`
 * on the API, mirrored in Vue as `TIM_OFFICE`. Chips come from here — never
 * from the raw history strings — so merged values ("Floor, Kasir, FOH") cannot
 * spawn one chip per history row.
 */
const DAFTAR_TIM = TIM_OFFICE.map(t => t.label)

/** Raw tokens of the Tim box: split on comma/semicolon, trimmed, never empty. */
const tokenTim = (v: string): string[] =>
  v.split(/[,;]/).map(s => s.trim()).filter(s => s !== '')

/** Non-canonical tokens kept verbatim (legacy values like "Office, CEO"):
 * shown as removable muted chips since there is no text box anymore. */
const timLain = computed(() =>
  tokenTim(f.keterangan).filter(t => !DAFTAR_TIM.some(l => l.toLowerCase() === t.toLowerCase())),
)
function hapusTimLain(hapus: string) {
  const kunci = hapus.toLowerCase()
  f.keterangan = tokenTim(f.keterangan).filter(t => t.toLowerCase() !== kunci).join(', ')
}
/** Canonical teams currently named (exact label match, case-insensitive). */
const timDipilih = computed(() => {
  const ada = new Set(tokenTim(f.keterangan).map(t => t.toLowerCase()))
  return DAFTAR_TIM.filter(l => ada.has(l.toLowerCase()))
})

/**
 * Toggle one canonical team in the box: clicking ADDS the team when absent
 * and REMOVES it when present. The old `isiTim` overwrote the whole box, so
 * picking a second team wiped the first — toggling keeps multi-team values
 * ("Bar, Kitchen") intact. Text the chips do not know (legacy "Office, CEO")
 * is kept verbatim at the end; the box, not the chips, owns it. The save
 * contract is unchanged: one `keterangan` string, joined with ", ".
 */
function toggleTim(label: string) {
  const kunci = label.toLowerCase()
  const pilih = new Set(timDipilih.value.map(l => l.toLowerCase()))
  if (pilih.has(kunci)) pilih.delete(kunci)
  else pilih.add(kunci)
  const sisa = tokenTim(f.keterangan)
    .filter(t => !DAFTAR_TIM.some(l => l.toLowerCase() === t.toLowerCase()))
  f.keterangan = [...DAFTAR_TIM.filter(l => pilih.has(l.toLowerCase())), ...sisa].join(', ')
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    detail
    :title="user ? `Ubah ${user.name}` : 'Tambah kru'"
    description="Identitas, kepegawaian, modul, dan hak admin kru."
  >
    <div class="grid grid-cols-1 gap-4">
      <AppSectionTitle
        title="Identitas dan akun"
        icon="i-lucide-user"
      />
      <UFormField
        label="Nama"
        required
        :error="errNama || undefined"
      >
        <UInput
          v-model="f.name"
          placeholder="Nama lengkap kru"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Username (nama panggilan)"
        :error="errUsername || undefined"
      >
        <UInput
          v-model="f.username"
          placeholder="mis. wandi"
          autocapitalize="off"
          autocomplete="off"
          class="w-full"
        />
        <p class="mt-1 text-xs text-muted">
          3–40 karakter: huruf, angka, titik, garis bawah, strip.
        </p>
      </UFormField>
      <UFormField label="PIN">
        <UInput
          v-model="f.pin"
          type="password"
          :placeholder="modeBuat ? 'Kosongkan = default 1111' : 'Kosongkan = tidak diubah'"
          autocomplete="new-password"
          class="w-full"
        />
        <p class="mt-1 text-xs text-muted">
          {{ modeBuat ? 'PIN default 1111 bila dikosongkan.' : 'PIN tidak pernah ditampilkan; kosongkan bila tidak diubah.' }}
        </p>
      </UFormField>
      <UFormField label="Tim">
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="t in DAFTAR_TIM"
            :key="t"
            type="button"
            class="flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors"
            :class="timDipilih.some(l => l === t)
              ? 'border-yellow-deep bg-yellow-light font-semibold text-yellow-dark'
              : 'border-default text-muted hover:bg-elevated/50'"
            :aria-pressed="timDipilih.some(l => l === t)"
            @click="toggleTim(t)"
          >
            <UIcon
              v-if="timDipilih.some(l => l === t)"
              name="i-lucide-check"
              class="size-3.5 shrink-0"
            />
            {{ t }}
          </button>
          <span
            v-for="t in timLain"
            :key="`lain-${t}`"
            class="flex min-h-9 items-center gap-1 rounded-full border border-dashed border-default px-3 text-[13px] text-muted"
            :title="`Nilai lama, klik × untuk menghapus: ${t}`"
          >
            {{ t }}
            <button
              type="button"
              :aria-label="`Hapus ${t}`"
              class="flex size-5 items-center justify-center rounded-full hover:bg-elevated"
              @click="hapusTimLain(t)"
            >
              <UIcon
                name="i-lucide-x"
                class="size-3.5"
              />
            </button>
          </span>
        </div>
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="No HP">
          <UInput
            v-model="f.noHp"
            placeholder="08…"
            inputmode="tel"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Talenta ID">
          <UInput
            v-model="f.talentaId"
            placeholder="ID Talenta"
            class="w-full"
          />
        </UFormField>
      </div>

      <AppSectionTitle
        title="Data kepegawaian"
        icon="i-lucide-briefcase"
      />
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Branch">
          <UInput
            v-model="f.branch"
            placeholder="Contoh: Pekanbaru"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Organisasi">
          <UInput
            v-model="f.organization"
            placeholder="Contoh: Operasional"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Posisi">
          <UInput
            v-model="f.jobPosition"
            placeholder="Contoh: Barista"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Level">
          <UInput
            v-model="f.jobLevel"
            placeholder="Contoh: Staff"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Status kerja">
          <UInput
            v-model="f.employmentStatus"
            placeholder="Contoh: Tetap"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tanggal masuk">
          <UInput
            v-model="f.joinDate"
            placeholder="2026-01-15"
            class="w-full"
          />
        </UFormField>
      </div>

      <AppSectionTitle
        title="Modul yang boleh dibuka"
        icon="i-lucide-key-round"
      />
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs text-muted">
          {{ nAksesDipilih }} dari {{ kunciAkses.length }} dipilih
        </p>
        <div class="flex gap-1">
          <UButton
            label="Pilih semua"
            icon="i-lucide-check-check"
            color="neutral"
            variant="ghost"
            size="xs"
            :disabled="semuaAksesDipilih || massalModul"
            :loading="massalModul"
            @click="bulkAkses(true)"
          />
          <UButton
            label="Hapus semua"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            :disabled="!adaAksesDipilih || massalModul"
            :loading="massalModul"
            @click="bulkAkses(false)"
          />
        </div>
      </div>
      <div class="grid gap-1 rounded-xl border bg-muted border-default p-2 sm:grid-cols-2 xl:grid-cols-3">
        <label class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-elevated/50 sm:col-span-2 xl:col-span-3">
          <UCheckbox
            :model-value="aksesDicentang('*')"
            :disabled="lagiSibuk('akses:*') || massalModul"
            @update:model-value="(v) => onToggleAkses('*', v)"
          />
          <span class="min-w-0 flex-1 truncate font-semibold text-highlighted">Semua modul</span>
        </label>
        <label
          v-for="m in modules"
          :key="m.key"
          class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-elevated/50"
        >
          <UCheckbox
            :model-value="aksesDicentang(m.key)"
            :disabled="lagiSibuk(`akses:${m.key}`) || massalModul"
            @update:model-value="(v) => onToggleAkses(m.key, v)"
          />
          <span class="min-w-0 flex-1 truncate text-highlighted">{{ m.label || m.key }}</span>
        </label>
      </div>
      <p
        v-if="user"
        class="mt-1 text-xs text-muted"
      >
        Centang langsung tersimpan. Tiap perubahan dikirim saat itu juga.
      </p>
      <p
        v-else
        class="mt-1 text-xs text-muted"
      >
        Centang dulu modulnya, lalu Simpan: akses dibuka otomatis setelah kru dibuat.
      </p>

      <AppSectionTitle
        title="Kelola akses"
        icon="i-lucide-shield-check"
      />
      <div v-if="user">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-xs text-muted">
            {{ nAdminDipilih }} dari {{ kunciAdmin.length }} dipilih
          </p>
          <div class="flex gap-1">
            <UButton
              label="Pilih semua"
              icon="i-lucide-check-check"
              color="neutral"
              variant="ghost"
              size="xs"
              :disabled="semuaAdminDipilih || massalAdmin"
              :loading="massalAdmin"
              @click="bulkAdmin(true)"
            />
            <UButton
              label="Hapus semua"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              :disabled="!adaAdminDipilih || massalAdmin"
              :loading="massalAdmin"
              @click="bulkAdmin(false)"
            />
          </div>
        </div>
        <div class="grid gap-1 rounded-xl border bg-muted border-default p-2 sm:grid-cols-2 xl:grid-cols-3">
          <label class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-elevated/50 sm:col-span-2 xl:col-span-3">
            <UCheckbox
              :model-value="punyaAdmin('*')"
              :disabled="lagiSibuk('admin:*') || massalAdmin"
              @update:model-value="(v) => toggleAdmin('*', v)"
            />
            <span class="min-w-0 flex-1 truncate font-semibold text-highlighted">Superadmin (semua modul)</span>
          </label>
          <label
            v-for="m in modules"
            :key="m.key"
            class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-elevated/50"
          >
            <UCheckbox
              :model-value="punyaAdmin(m.key)"
              :disabled="lagiSibuk(`admin:${m.key}`) || massalAdmin"
              @update:model-value="(v) => toggleAdmin(m.key, v)"
            />
            <span class="min-w-0 flex-1 truncate text-highlighted">Admin {{ m.label || m.key }}</span>
          </label>
        </div>
        <p class="mt-1 text-xs text-muted">
          Superadmin dicentang manual per orang. Admin roster tim HRD diatur lewat kolom Tim dan tidak diubah di sini.
        </p>
        <USwitch
          :model-value="user.active"
          :disabled="lagiSibuk('aktif')"
          label="Aktif, bisa login"
          class="mt-3"
          @update:model-value="toggleAktif"
        />
      </div>
      <p
        v-else
        class="text-xs text-muted"
      >
        Kru baru langsung aktif. Hak admin dan status diatur setelah kru dibuat.
      </p>
    </div>

    <template #footer>
      <UButton
        label="Simpan"
        icon="i-lucide-check"
        :loading="menyimpan"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
</template>
