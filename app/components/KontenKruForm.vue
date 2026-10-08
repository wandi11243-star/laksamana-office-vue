<!--
  Kelola Kru (old openUserForm + saveUser, deploy/konten/index.html:2861-2898;
  konten.md D.19). Only an Office admin of `konten` manages crew. Name and
  login come from Office (shown, not editable); here: division, email, task
  capacity, working hours, availability, skills and the internal roles (one or
  more — "Pilih minimal 1 role"). There is no "add" mode: crew rows come from
  the Office roster (useSinkronKruKonten).
-->
<script setup lang="ts">
import type { RoleKonten, UserKonten } from '~/utils/konten'
import { ROLES_KONTEN, ROLE_KEYS_KONTEN, pisahKoma } from '~/utils/konten'
import { rolesKru } from '~/utils/sistem-konten'

const props = defineProps<{ kru?: UserKonten | null }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const me = useMe()
const boleh = computed(() => isAdminOf(me.value, 'konten'))

const f = reactive({ division: '', email: '', capacity: '24', workHours: '09.00-18.00', avail: 'available', skills: '' })
const roles = ref<string[]>([])
const sibuk = ref(false)
const opsiAvail = [{ value: 'available', label: 'Tersedia' }, { value: 'busy', label: 'Sibuk' }]

watch(open, (o) => {
  if (!o) return
  const u = props.kru
  Object.assign(f, {
    division: u?.division ?? '', email: u?.email ?? '', capacity: String(u?.capacity || 24), workHours: u?.workHours || '09.00-18.00',
    avail: u?.avail === 'busy' ? 'busy' : 'available', skills: (u?.skills ?? []).join(', '),
  })
  roles.value = rolesKru(u)
}, { immediate: true })

const pilih = (r: string, on: boolean | 'indeterminate') => {
  roles.value = on === true ? [...new Set([...roles.value, r])] : roles.value.filter(x => x !== r)
}

async function simpan() {
  const u = props.kru
  if (!u) return toast.add({ title: 'Kru tidak ditemukan', color: 'error' })
  if (!roles.value.length) return toast.add({ title: 'Pilih minimal 1 role', color: 'error' })
  const data = {
    division: f.division, email: f.email, capacity: Number(f.capacity) || 24, workHours: f.workHours, avail: f.avail,
    skills: pisahKoma(f.skills), roles: [...roles.value],
  }
  sibuk.value = true
  const ok = await kontenSimpan(() => ubahKonten<UserKonten>('users', u.id, { ...u, ...data }, u.updatedAt), 'Kru diperbarui', { action: 'mengubah kru', target: u.name })
  sibuk.value = false
  if (ok) open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    title="Kelola kru"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        label="Nama"
        help="Nama & login dikelola di Office."
      >
        <UInput
          :model-value="kru?.name"
          disabled
          class="w-full"
        />
      </UFormField>
      <UFormField label="Divisi">
        <UInput
          v-model="f.division"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Email">
        <UInput
          v-model="f.email"
          type="email"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Kapasitas task">
        <UInput
          v-model="f.capacity"
          type="number"
          min="0"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Jam kerja">
        <UInput
          v-model="f.workHours"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Ketersediaan">
        <USelect
          v-model="f.avail"
          :items="opsiAvail"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Skill (pisah koma)"
        class="sm:col-span-2"
      >
        <UInput
          v-model="f.skills"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Role — bisa rangkap (pilih 1 atau lebih)"
        :help="`Dipilih: ${roles.length} role. Akses digabung dari semua role.`"
        class="sm:col-span-2"
      >
        <div class="grid gap-2 sm:grid-cols-2">
          <label
            v-for="r in ROLE_KEYS_KONTEN"
            :key="r"
            class="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5"
            :class="roles.includes(r) ? 'border-primary-400 bg-primary-50' : 'border-default'"
          >
            <UCheckbox
              :model-value="roles.includes(r)"
              @update:model-value="pilih(r, $event)"
            />
            <span class="min-w-0">
              <span class="block text-sm font-semibold">{{ ROLES_KONTEN[r as RoleKonten].label }}</span>
              <span class="block text-[11px] leading-tight text-muted">{{ ROLES_KONTEN[r as RoleKonten].desc }}</span>
            </span>
          </label>
        </div>
      </UFormField>
    </div>
    <template #footer>
      <UButton
        v-if="boleh"
        label="Simpan"
        :loading="sibuk"
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
