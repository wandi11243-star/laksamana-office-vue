<!--
  Program Training baru / edit (deploy/hr/index.html editTraining :2134-2148).
  Title is required; passing grade defaults from settings; "Wajib" decides
  whether the program counts in the People Score training component (F.6).
-->
<script setup lang="ts">
import type { HrTraining } from '~/utils/hr'
import { hrCreate, hrPostAudit, hrUpdate, useHrDasar } from '~/composables/useHr'

const props = defineProps<{ t: HrTraining | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { s, refresh } = useHrDasar()
const sibuk = ref(false)

const TIPE = ['Product Knowledge', 'SOP', 'Quiz', 'Assessment', 'Sertifikasi', 'Video Training', 'Hygiene']
const title = ref('')
const type = ref(TIPE[0]!)
const divId = ref('all')
const passingGrade = ref('80')
const mandatory = ref('1')
const desc = ref('')

const opsiDiv = computed(() => [
  { value: 'all', label: 'Semua divisi' },
  ...s.value.divisions.map(d => ({ value: d.id, label: d.name })),
])

watch(open, (v) => {
  if (!v) return
  const t = props.t
  title.value = t?.title ?? ''
  type.value = t?.type ?? TIPE[0]!
  divId.value = t?.divId ?? 'all'
  passingGrade.value = String(t?.passingGrade ?? s.value.settings.passingGrade)
  mandatory.value = (t?.mandatory ?? true) ? '1' : '0'
  desc.value = t?.desc ?? ''
})

async function simpan() {
  if (sibuk.value) return
  const data = {
    title: title.value.trim(),
    type: type.value,
    divId: divId.value,
    passingGrade: Number(passingGrade.value) || 80,
    mandatory: mandatory.value === '1',
    desc: desc.value,
  }
  if (!data.title) return toast.add({ title: 'Judul wajib diisi.', color: 'error' })
  sibuk.value = true
  try {
    if (props.t) await hrUpdate('trainings', props.t.id, { ...props.t, ...data })
    else await hrCreate('trainings', data)
    try {
      await hrPostAudit('TRAINING_SAVE', data.title)
    }
    catch {
      // Audit is a bonus.
    }
    toast.add({ title: 'Program tersimpan', color: 'success' })
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
    :title="t ? 'Edit program' : 'Program training baru'"
  >
    <div class="space-y-3">
      <UFormField label="Judul">
        <UInput
          v-model="title"
          placeholder="cth: Product Knowledge Menu Signature"
          class="w-full"
        />
      </UFormField>
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Jenis">
          <USelect
            v-model="type"
            :items="TIPE.map(x => ({ value: x, label: x }))"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Divisi">
          <USelect
            v-model="divId"
            :items="opsiDiv"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Passing grade">
          <UInput
            v-model="passingGrade"
            type="number"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Wajib?">
          <USelect
            v-model="mandatory"
            :items="[{ value: '1', label: 'Wajib' }, { value: '0', label: 'Opsional' }]"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField label="Deskripsi / link materi (opsional)">
        <UTextarea
          v-model="desc"
          :rows="2"
          placeholder="cth: materi ada di Akademi, atau tempel link Drive/SOP"
          class="w-full"
        />
      </UFormField>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Simpan program'"
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
