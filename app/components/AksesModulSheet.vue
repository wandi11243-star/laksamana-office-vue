<!--
  Kelola Akses › Daftar modul › one module (owner, Nov 2026): who holds it and
  who administers it, changed right here. Rows are the accounts of the list
  (useAccountUsers, refreshed after every save, so a box always shows the server
  truth). "Akses" ticks the explicit grant (PUT /account/users/{id}/access);
  an account that opens the module through "Semua modul" or a default rule says
  so instead of a box it cannot untick. "Admin" is the module admin
  (PUT /account/users/{id}/admin). The label of the module can be edited too.
-->
<script setup lang="ts">
import type { AccountModule, AccountUser } from '~/composables/useAccount'
import { setAdmin, setAkses, simpanAkun, ubahModul } from '~/composables/useAccount'

const props = defineProps<{ modul: AccountModule | null, users: AccountUser[] }>()
const open = defineModel<boolean>('open', { default: false })

const label = ref('')
watch(() => [open.value, props.modul?.key], () => {
  label.value = props.modul?.label || ''
  cari.value = ''
  tampil.value = 'punya'
})
const menyimpanLabel = ref(false)
async function simpanLabel() {
  const m = props.modul
  if (!m || !label.value.trim()) return
  menyimpanLabel.value = true
  await simpanAkun(() => ubahModul(m.key, { label: label.value.trim() }), 'Label modul diperbarui')
  menyimpanLabel.value = false
}

const k = computed(() => props.modul?.key ?? '')
const diberi = (u: AccountUser) => u.grants.includes(k.value)
/** Opens it without its own grant: "Semua modul" or a default rule. */
const lewatLain = (u: AccountUser) => !diberi(u) && u.modules.includes(k.value)
const punya = (u: AccountUser) => u.modules.includes(k.value)
const admin = (u: AccountUser) => u.adminModules.includes(k.value)
const superadmin = (u: AccountUser) => u.adminModules.includes('*')

const cari = ref('')
const tampil = ref<'punya' | 'semua'>('punya')
const baris = computed(() => {
  const q = cari.value.trim().toLowerCase()
  return props.users
    .filter(u => tampil.value === 'semua' || punya(u) || admin(u))
    .filter(u => !q || `${u.name} ${u.username} ${u.keterangan}`.toLowerCase().includes(q))
    .sort((a, b) => Number(punya(b)) - Number(punya(a)) || a.name.localeCompare(b.name, 'id'))
})
const jumlahPunya = computed(() => props.users.filter(punya).length)
const jumlahAdmin = computed(() => props.users.filter(admin).length)

const sibuk = ref<string[]>([])
async function ubah(u: AccountUser, jenis: 'akses' | 'admin', v: boolean | 'indeterminate') {
  if (v === 'indeterminate' || !k.value) return
  const kunci = `${jenis}:${u.id}`
  sibuk.value.push(kunci)
  await simpanAkun(
    () => (jenis === 'akses' ? setAkses(u.id, k.value, v) : setAdmin(u.id, k.value, v)),
    jenis === 'akses' ? (v ? `Akses ${u.name} dibuka` : `Akses ${u.name} ditutup`) : (v ? `${u.name} jadi admin` : `Admin ${u.name} dicabut`),
  )
  sibuk.value = sibuk.value.filter(x => x !== kunci)
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="modul ? `Akses ${modul.label || modul.key}` : 'Akses modul'"
    :description="`${jumlahPunya} orang punya akses · ${jumlahAdmin} admin. Centang langsung tersimpan.`"
  >
    <div
      v-if="modul"
      class="flex flex-col gap-4"
    >
      <div class="flex flex-wrap items-end gap-2">
        <UFormField
          label="Label modul"
          class="min-w-52 flex-1"
          :description="`Kunci: ${modul.key}`"
        >
          <UInput
            v-model="label"
            class="w-full"
          />
        </UFormField>
        <UButton
          label="Simpan label"
          icon="i-lucide-check"
          color="neutral"
          variant="outline"
          :loading="menyimpanLabel"
          :disabled="!label.trim() || label.trim() === modul.label"
          @click="simpanLabel"
        />
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UInput
          v-model="cari"
          icon="i-lucide-search"
          placeholder="Cari nama, username, atau tim"
          class="min-w-52 flex-1"
        />
        <AppSeg
          v-model="tampil"
          size="sm"
          :options="[{ value: 'punya', label: `Punya akses (${jumlahPunya})` }, { value: 'semua', label: `Semua kru (${users.length})` }]"
        />
      </div>

      <p
        v-if="!baris.length"
        class="py-4 text-center text-sm text-muted"
      >
        {{ tampil === 'punya' ? 'Belum ada yang punya akses. Pilih "Semua kru" untuk menambahkan.' : 'Tidak ada yang cocok.' }}
      </p>
      <ul
        v-else
        class="divide-y divide-default rounded-panel border border-default"
      >
        <li
          v-for="u in baris"
          :key="u.id"
          class="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5"
          :class="u.active ? '' : 'opacity-60'"
        >
          <span class="min-w-0 flex-1">
            <b class="block truncate text-highlighted">{{ u.name }}</b>
            <span class="block truncate text-xs text-muted">{{ [u.username && `@${u.username}`, u.keterangan, u.active ? '' : 'nonaktif'].filter(Boolean).join(' · ') }}</span>
          </span>
          <span
            v-if="lewatLain(u)"
            class="text-xs text-muted"
            title="Akses datang dari &quot;Semua modul&quot; atau aturan bawaan, bukan centang modul ini. Ubah di lembar kru."
          >Akses lewat semua modul</span>
          <label
            v-else
            class="flex cursor-pointer items-center gap-2 text-sm"
          >
            <UCheckbox
              :model-value="diberi(u)"
              :disabled="sibuk.includes(`akses:${u.id}`)"
              @update:model-value="(v) => ubah(u, 'akses', v)"
            />Akses
          </label>
          <span
            v-if="superadmin(u)"
            class="text-xs font-semibold text-gold-deep"
          >Superadmin</span>
          <label
            v-else
            class="flex cursor-pointer items-center gap-2 text-sm"
          >
            <UCheckbox
              :model-value="admin(u)"
              :disabled="sibuk.includes(`admin:${u.id}`)"
              @update:model-value="(v) => ubah(u, 'admin', v)"
            />Admin
          </label>
        </li>
      </ul>
    </div>
  </ResponsiveSheet>
</template>
