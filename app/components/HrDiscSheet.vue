<!--
  Catat / sunting pelanggaran (deploy/hr/index.html editViolation :2290-2306).
  The hint below the form is the SYSTEM's suggestion only (suggestSP) — the
  decision stays with HRD/CEO (F.8).
-->
<script setup lang="ts">
import type { HrViolation } from '~/utils/hr'
import { VIO_TYPES, activeEmps } from '~/utils/hr'
import { suggestSP } from '~/utils/people-score'
import { hrCreate, hrPostAudit, hrUpdate, useHrDasar } from '~/composables/useHr'
import { hariIni } from '~/utils/format'

const props = defineProps<{ v: HrViolation | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { s, refresh } = useHrDasar()
const sibuk = ref(false)

const empId = ref('__kosong__')
const date = ref(hariIni())
const type = ref(VIO_TYPES[0]!)
const severity = ref('Ringan')
const sp = ref('')
const status = ref('Tercatat')
const note = ref('')

const opsiEmp = computed(() => [
  { value: '__kosong__', label: '— pilih kru —' },
  ...activeEmps(s.value).filter(e => e.appRole !== 'ceo').map(e => ({ value: e.id, label: e.name })),
])
const saran = computed(() => (empId.value === '__kosong__' ? '' : suggestSP(s.value, empId.value)))

watch(open, (v) => {
  if (!v) return
  const x = props.v
  empId.value = x?.empId || opsiEmp.value[1]?.value || '__kosong__'
  date.value = x?.date ?? hariIni()
  type.value = x?.type ?? VIO_TYPES[0]!
  severity.value = x?.severity ?? 'Ringan'
  sp.value = x?.sp ?? ''
  status.value = x?.status ?? 'Tercatat'
  note.value = x?.note ?? ''
})

async function simpan() {
  if (sibuk.value) return
  if (empId.value === '__kosong__') return toast.add({ title: 'Pilih kru dulu.', color: 'error' })
  const data = { empId: empId.value, date: date.value, type: type.value, severity: severity.value, sp: sp.value, note: note.value, status: status.value }
  sibuk.value = true
  try {
    if (props.v) await hrUpdate('violations', props.v.id, { ...props.v, ...data })
    else await hrCreate('violations', data)
    try {
      await hrPostAudit('VIOLATION_SAVE', `${s.value.employees.find(e => e.id === empId.value)?.name ?? ''}, ${type.value}${sp.value ? ` [${sp.value}]` : ''}`)
    }
    catch {
      // Audit is a bonus.
    }
    toast.add({ title: 'Pelanggaran tersimpan', color: 'success' })
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
    :title="v ? 'Edit pelanggaran' : 'Catat pelanggaran'"
    lebar="sedang"
  >
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Kru">
          <USelect
            v-model="empId"
            :items="opsiEmp"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tanggal">
          <AppTanggal
            v-model="date"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <UFormField label="Jenis">
          <USelect
            v-model="type"
            :items="VIO_TYPES.map(x => ({ value: x, label: x }))"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tingkat">
          <USelect
            v-model="severity"
            :items="['Ringan', 'Sedang', 'Berat'].map(x => ({ value: x, label: x }))"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Terbitkan SP">
          <USelect
            v-model="sp"
            :items="[{ value: '', label: 'Tidak / belum' }, { value: 'SP1', label: 'SP1' }, { value: 'SP2', label: 'SP2' }, { value: 'SP3', label: 'SP3' }]"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Status">
          <USelect
            v-model="status"
            :items="['Tercatat', 'Ditindaklanjuti', 'Selesai', 'Dibatalkan'].map(x => ({ value: x, label: x }))"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Catatan">
          <UInput
            v-model="note"
            class="w-full"
          />
        </UFormField>
      </div>
      <p
        v-if="saran"
        class="rounded-field bg-warning/12 px-3 py-2 text-sm"
      >
        Berdasarkan riwayat, sistem menyarankan eskalasi ke <b>{{ saran }}</b>. Keputusan tetap di HRD.
      </p>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Simpan pelanggaran'"
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
