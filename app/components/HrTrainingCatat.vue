<!--
  Catat hasil training (deploy/hr/index.html recordTraining :2169-2187).
  Passing grade decides Lulus/Gagal by itself. A pass mints the next internal
  certificate number (`nextCertNo`, F.16) and adds the trainingPass points as a
  reward ledger row — both in one save, as the old page did.
-->
<script setup lang="ts">
import type { HrTraining } from '~/utils/hr'
import { activeEmps } from '~/utils/hr'
import { nextCertNo } from '~/utils/people-score'
import { hrCreate, hrPostAudit, useHrDasar } from '~/composables/useHr'
import { hariIni } from '~/utils/format'

const props = defineProps<{ t: HrTraining | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { s, refresh } = useHrDasar()
const sibuk = ref(false)

const empId = ref('')
const nilai = ref('')
const tgl = ref(hariIni())

const emps = computed(() => {
  const t = props.t
  if (!t) return []
  const aktif = activeEmps(s.value)
  return (t.divId === 'all' ? aktif : aktif.filter(e => e.divId === t.divId)).filter(e => e.appRole !== 'ceo')
})
const opsiEmp = computed(() => [{ value: '__kosong__', label: '— pilih kru —' }, ...emps.value.map(e => ({ value: e.id, label: e.name }))])

watch(open, (v) => {
  if (!v) return
  empId.value = emps.value[0]?.id ?? '__kosong__'
  nilai.value = ''
  tgl.value = hariIni()
})

async function simpan() {
  if (!props.t || sibuk.value) return
  if (empId.value === '__kosong__') return toast.add({ title: 'Pilih kru dulu.', color: 'error' })
  if (String(nilai.value).trim() === '') return toast.add({ title: 'Nilai wajib diisi.', color: 'error' })
  const skor = Number(nilai.value)
  if (Number.isNaN(skor)) return toast.add({ title: 'Nilai wajib diisi.', color: 'error' })
  const lulus = skor >= props.t.passingGrade
  sibuk.value = true
  try {
    await hrCreate('training-records', {
      trainingId: props.t.id,
      empId: empId.value,
      score: skor,
      date: tgl.value,
      status: lulus ? 'Lulus' : 'Gagal',
      certNo: lulus ? nextCertNo(s.value, tgl.value) : '',
    })
    if (lulus) {
      await hrCreate('rewards', {
        empId: empId.value,
        date: hariIni(),
        type: 'earn',
        points: s.value.settings.pointRules.trainingPass,
        reason: `Lulus training: ${props.t.title}`,
      })
    }
    try {
      await hrPostAudit('TRAINING_RECORD', `${emps.value.find(e => e.id === empId.value)?.name ?? ''}, ${props.t.title} (${skor})`)
    }
    catch {
      // Audit is a bonus.
    }
    toast.add({ title: lulus ? 'Lulus! Sertifikat diterbitkan.' : 'Tercatat: belum lulus, bisa remedial.', color: lulus ? 'success' : 'info' })
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
    :title="t ? `Catat hasil, ${t.title}` : 'Catat hasil'"
    lebar="sedang"
  >
    <div
      v-if="t"
      class="space-y-3"
    >
      <UFormField label="Kru">
        <USelect
          v-model="empId"
          :items="opsiEmp"
          class="w-full"
        />
      </UFormField>
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Nilai">
          <UInput
            v-model="nilai"
            type="number"
            min="0"
            max="100"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tanggal">
          <AppTanggal
            v-model="tgl"
            class="w-full"
          />
        </UFormField>
      </div>
      <p class="rounded-field bg-info/10 px-3 py-2 text-sm">
        Status Lulus/Gagal otomatis dari passing grade ({{ t.passingGrade }}). Lulus → sertifikat internal +
        {{ s.settings.pointRules.trainingPass }} poin reward.
      </p>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Catat hasil'"
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
