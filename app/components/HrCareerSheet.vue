<!--
  Track karier baru / edit (deploy/hr/index.html editCareer :2389-2403).
  Steps are one per line, at least two; a delete from the form is handed to the
  page, which confirms it like every other destructive action.
-->
<script setup lang="ts">
import type { HrCareerPath } from '~/utils/hr'
import { hrCreate, hrPostAudit, hrUpdate, useHrDasar } from '~/composables/useHr'

const props = defineProps<{ cp: HrCareerPath | null }>()
const emit = defineEmits<{ saved: [], hapus: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { refresh } = useHrDasar()
const sibuk = ref(false)
const track = ref('')
const steps = ref('')
const req = ref('')

watch(open, (v) => {
  if (!v) return
  const cp = props.cp
  track.value = cp?.track ?? ''
  steps.value = cp ? cp.steps.join('\n') : '\n'
  req.value = cp?.req ?? ''
})

async function simpan() {
  if (sibuk.value) return
  const langkah = steps.value.split('\n').map(x => x.trim()).filter(Boolean)
  if (!track.value.trim() || langkah.length < 2) {
    return toast.add({ title: 'Track dan minimal 2 jenjang wajib.', color: 'error' })
  }
  const data = { track: track.value.trim(), steps: langkah, req: req.value.trim() }
  sibuk.value = true
  try {
    if (props.cp) await hrUpdate('career-paths', props.cp.id, { ...props.cp, ...data })
    else await hrCreate('career-paths', data)
    try {
      await hrPostAudit('CAREER_SAVE', data.track)
    }
    catch {
      // Audit is a bonus.
    }
    toast.add({ title: 'Track tersimpan', color: 'success' })
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
    :title="cp ? 'Edit track' : 'Track baru'"
  >
    <div class="space-y-3">
      <UFormField label="Nama track">
        <UInput
          v-model="track"
          placeholder="cth: Service / Bar / Kitchen / Marketing"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Jenjang (satu per baris, dari bawah ke atas)">
        <UTextarea
          v-model="steps"
          :rows="5"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Syarat naik level">
        <UTextarea
          v-model="req"
          :rows="2"
          class="w-full"
        />
      </UFormField>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Simpan track'"
        :loading="sibuk"
        @click="simpan"
      />
      <UButton
        v-if="cp"
        label="Hapus track"
        color="error"
        variant="ghost"
        @click="emit('hapus')"
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
