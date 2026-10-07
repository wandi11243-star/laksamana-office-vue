<!--
  Kru baru / edit data diri (deploy/hr/index.html editEmp :2464-2487).

  This form manages PERFORMANCE data only: name, job, division, level, in-app
  role, dates, status. Login and PIN live in Office — the note says so, and no
  field here touches them. The empty division option must exist: a crew row
  that appeared from Office login has no division yet, and without it a select
  would silently pick the first one.
-->
<script setup lang="ts">
import type { HrEmployee } from '~/utils/hr'
import { ROLE_LABEL } from '~/utils/hr'
import { hrCreate, hrPostAudit, hrUpdate, useHrDasar } from '~/composables/useHr'
import { hariIni } from '~/utils/format'

const props = defineProps<{ e: HrEmployee | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { s, refresh } = useHrDasar()
const sibuk = ref(false)
/** Reka UI forbids SelectItem value ''; "belum diisi" is a sentinel. */
const KOSONG = '__kosong__'

const name = ref('')
const role = ref('')
const divId = ref(KOSONG)
const level = ref('Staff')
const appRole = ref('staff')
const joinDate = ref('')
const birthDate = ref('')
const status = ref('Aktif')
const contractEnd = ref('')
const probationEnd = ref('')
const notes = ref('')

const opsiDiv = computed(() => [
  { value: KOSONG, label: 'Belum diisi' },
  ...s.value.divisions.map(d => ({ value: d.id, label: d.name })),
])
const opsiRole = Object.keys(ROLE_LABEL).map(k => ({ value: k, label: ROLE_LABEL[k]! }))

watch(open, (v) => {
  if (!v) return
  const e = props.e
  name.value = e?.name ?? ''
  role.value = e?.role ?? ''
  divId.value = e?.divId || KOSONG
  level.value = e?.level ?? 'Staff'
  appRole.value = e?.appRole ?? 'staff'
  joinDate.value = e?.joinDate ?? hariIni()
  birthDate.value = e?.birthDate ?? ''
  status.value = e?.status ?? 'Aktif'
  contractEnd.value = e?.contractEnd ?? ''
  probationEnd.value = e?.probationEnd ?? ''
  notes.value = e?.notes ?? ''
})

async function simpan() {
  if (sibuk.value) return
  const data = {
    name: name.value.trim(),
    role: role.value.trim(),
    divId: divId.value === KOSONG ? '' : divId.value,
    level: level.value,
    appRole: appRole.value,
    joinDate: joinDate.value,
    birthDate: birthDate.value,
    status: status.value,
    contractEnd: contractEnd.value,
    probationEnd: probationEnd.value,
    notes: notes.value,
  }
  if (!data.name) return toast.add({ title: 'Nama wajib diisi.', color: 'error' })
  sibuk.value = true
  try {
    if (props.e) await hrUpdate('employees', props.e.id, { ...props.e, ...data })
    else await hrCreate('employees', { ...data, phone: '', email: '', talentaId: '' })
    try {
      await hrPostAudit('EMP_SAVE', data.name)
    }
    catch {
      // Audit is a bonus.
    }
    toast.add({ title: 'Data kru tersimpan', color: 'success' })
    open.value = false
    emit('saved')
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal menyimpan: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="e ? 'Edit kru' : 'Kru baru'"
  >
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Nama">
          <UInput
            v-model="name"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jabatan">
          <UInput
            v-model="role"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <UFormField label="Divisi">
          <USelect
            v-model="divId"
            :items="opsiDiv"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Level">
          <USelect
            v-model="level"
            :items="['Staff', 'Supervisor', 'Manager', 'C-Level'].map(x => ({ value: x, label: x }))"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Akses aplikasi">
          <USelect
            v-model="appRole"
            :items="opsiRole"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <UFormField label="Bergabung">
          <UInput
            v-model="joinDate"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Ulang tahun">
          <UInput
            v-model="birthDate"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Status">
          <USelect
            v-model="status"
            :items="['Aktif', 'Nonaktif'].map(x => ({ value: x, label: x }))"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Kontrak berakhir">
          <UInput
            v-model="contractEnd"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Probation selesai">
          <UInput
            v-model="probationEnd"
            type="date"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField label="Catatan">
        <UInput
          v-model="notes"
          class="w-full"
        />
      </UFormField>
      <p class="rounded-field bg-muted px-3 py-2 text-sm text-muted">
        Login dan PIN diatur di Office, bukan di sini. "Akses aplikasi" hanya mengatur apa yang boleh dibuka di
        dalam modul ini.
      </p>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Simpan data kru'"
        :loading="sibuk"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="ghost"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
</template>
