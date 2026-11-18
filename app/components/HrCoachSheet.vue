<!--
  Sesi coaching baru / edit (deploy/hr/index.html editCoach :2084-2099).
  Problem is required; the coach is the session user (or the original coach on
  an edit). The person coached is taken from scopeEmps minus the coach.
-->
<script setup lang="ts">
import type { HrCoaching } from '~/utils/hr'
import { scopeEmps } from '~/utils/hr'
import { hrCreate, hrPostAudit, hrUpdate, useHrDasar } from '~/composables/useHr'
import { hariIni } from '~/utils/format'

const props = defineProps<{ c: HrCoaching | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { s, cu, officeAdmin, refresh } = useHrDasar()
const sibuk = ref(false)

const empId = ref('')
const date = ref(hariIni())
const problem = ref('')
const actionPlan = ref('')
const deadline = ref('')
const followUp = ref('')
const status = ref('Berjalan')

const emps = computed(() => scopeEmps(s.value, cu.value, officeAdmin.value).filter(e => e.id !== cu.value?.id && e.appRole !== 'ceo'))
const opsiEmp = computed(() => [{ value: '__kosong__', label: '— pilih kru —' }, ...emps.value.map(e => ({ value: e.id, label: e.name }))])

watch(open, (v) => {
  if (!v) return
  const c = props.c
  empId.value = c?.empId ?? emps.value[0]?.id ?? '__kosong__'
  date.value = c?.date ?? hariIni()
  problem.value = c?.problem ?? ''
  actionPlan.value = c?.actionPlan ?? ''
  deadline.value = c?.deadline ?? ''
  followUp.value = c?.followUp ?? ''
  status.value = c?.status ?? 'Berjalan'
})

async function simpan() {
  if (sibuk.value) return
  if (empId.value === '__kosong__') return toast.add({ title: 'Pilih kru dulu.', color: 'error' })
  const problemBersih = problem.value.trim()
  if (!problemBersih) return toast.add({ title: 'Problem wajib diisi.', color: 'error' })
  const data = {
    empId: empId.value,
    coachId: props.c?.coachId || cu.value?.id || '',
    date: date.value,
    problem: problemBersih,
    actionPlan: actionPlan.value,
    deadline: deadline.value,
    followUp: followUp.value,
    status: status.value,
  }
  sibuk.value = true
  try {
    if (props.c) await hrUpdate('coachings', props.c.id, { ...props.c, ...data })
    else await hrCreate('coachings', data)
    try {
      await hrPostAudit('COACH_SAVE', emps.value.find(e => e.id === data.empId)?.name ?? '')
    }
    catch {
      // Audit is a bonus.
    }
    toast.add({ title: 'Coaching tersimpan', color: 'success' })
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
    :title="c ? 'Edit coaching' : 'Sesi coaching baru'"
  >
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Kru yang dicoaching">
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
      <UFormField label="Problem / temuan">
        <UTextarea
          v-model="problem"
          :rows="2"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Action plan">
        <UTextarea
          v-model="actionPlan"
          :rows="2"
          class="w-full"
        />
      </UFormField>
      <div class="grid grid-cols-3 gap-3">
        <UFormField label="Deadline">
          <AppTanggal
            v-model="deadline"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Status">
          <USelect
            v-model="status"
            :items="['Berjalan', 'Selesai', 'Batal'].map(x => ({ value: x, label: x }))"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Follow up">
          <UInput
            v-model="followUp"
            class="w-full"
          />
        </UFormField>
      </div>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Simpan coaching'"
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
