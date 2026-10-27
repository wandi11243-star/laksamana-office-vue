<!--
  Kru form (old Kelola User form + the Kelola Akses checkbox panel).

  Identity + HR save on Simpan (buatUser/ubahUser). Module grants, module
  admins and the Aktif switch write LIVE via simpanAkun (old panel parity:
  each toggle is its own PUT, there is no staged draft).

  PIN is write-only: the API never returns it, so the field always starts
  empty: blank means the server default (1111) on create, "keep the old
  one" on edit.
-->
<script setup lang="ts">
import {
  buatUser, setAkses, setAdmin, setAktif, simpanAkun, ubahUser,
  type AccountModule, type AccountUser, type SimpanUserBody,
} from '~/composables/useAccount'

const props = defineProps<{
  user: AccountUser | null
  modules: AccountModule[]
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
/** Toggle keys currently in flight (`akses:<key>`, `admin:<key>`, `aktif`). */
const sibuk = ref<string[]>([])
const tandaiSibuk = (k: string) => { sibuk.value.push(k) }
const selesaiSibuk = (k: string) => { sibuk.value = sibuk.value.filter(x => x !== k) }
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
  const ok = props.user
    ? await simpanAkun(() => ubahUser(props.user!.id, body), 'Data kru diperbarui')
    : await simpanAkun(() => buatUser(body), 'Kru ditambahkan')
  menyimpan.value = false
  if (ok) open.value = false
}

const punyaAkses = (key: string): boolean => props.user?.grants.includes(key) ?? false
const punyaAdmin = (key: string): boolean => props.user?.adminModules.includes(key) ?? false

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

function isiTim(t: string) {
  f.keterangan = t
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="user ? `Ubah ${user.name}` : 'Tambah kru'"
    description="Identitas, kepegawaian, modul, dan hak admin kru."
  >
    <div class="grid gap-4">
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
        <UInput
          v-model="f.keterangan"
          placeholder="Contoh: Bar, Kitchen, Kasir"
          class="w-full"
        />
        <div
          v-if="timTersedia.length"
          class="mt-1.5 flex flex-wrap gap-1"
        >
          <button
            v-for="t in timTersedia"
            :key="t"
            type="button"
            class="rounded-full border border-default px-2 py-0.5 text-[11px] text-muted hover:bg-elevated/50"
            @click="isiTim(t)"
          >
            {{ t }}
          </button>
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
      <div v-if="user">
        <div class="grid gap-1 rounded-field border border-default p-2">
          <label class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-elevated/50">
            <UCheckbox
              :model-value="punyaAkses('*')"
              :disabled="lagiSibuk('akses:*')"
              @update:model-value="(v) => toggleAkses('*', v)"
            />
            <span class="min-w-0 flex-1 truncate font-semibold text-highlighted">Semua modul</span>
          </label>
          <label
            v-for="m in modules"
            :key="m.key"
            class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-elevated/50"
          >
            <UCheckbox
              :model-value="punyaAkses(m.key)"
              :disabled="lagiSibuk(`akses:${m.key}`)"
              @update:model-value="(v) => toggleAkses(m.key, v)"
            />
            <span class="min-w-0 flex-1 truncate text-highlighted">{{ m.label || m.key }}</span>
          </label>
        </div>
        <p class="mt-1 text-xs text-muted">
          Centang langsung tersimpan. Tiap perubahan dikirim saat itu juga.
        </p>
      </div>
      <p
        v-else
        class="text-xs text-muted"
      >
        Modul diatur setelah kru dibuat. Simpan dulu, lalu buka lagi untuk mencentang modul.
      </p>

      <AppSectionTitle
        title="Kelola akses"
        icon="i-lucide-shield-check"
      />
      <div v-if="user">
        <div class="grid gap-1 rounded-field border border-default p-2">
          <label class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-elevated/50">
            <UCheckbox
              :model-value="punyaAdmin('*')"
              :disabled="lagiSibuk('admin:*')"
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
              :disabled="lagiSibuk(`admin:${m.key}`)"
              @update:model-value="(v) => toggleAdmin(m.key, v)"
            />
            <span class="min-w-0 flex-1 truncate text-highlighted">Admin {{ m.label || m.key }}</span>
          </label>
        </div>
        <p class="mt-1 text-xs text-muted">
          Admin roster tim HRD diatur lewat kolom Tim dan tidak diubah di sini.
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
