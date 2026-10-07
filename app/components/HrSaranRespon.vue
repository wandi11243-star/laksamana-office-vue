<!--
  Respon saran (deploy/hr/index.html respondSuggestion :2354-2357). HRD/CEO
  sets the status and writes the answer the crew member can read.
-->
<script setup lang="ts">
import type { HrSuggestion } from '~/utils/hr'
import { hrPostAudit, hrUpdate, useHrDasar } from '~/composables/useHr'

const props = defineProps<{ sg: HrSuggestion | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { refresh } = useHrDasar()
const sibuk = ref(false)
const status = ref('Baru')
const response = ref('')

watch(open, (v) => {
  if (!v) return
  status.value = props.sg?.status ?? 'Baru'
  response.value = props.sg?.response ?? ''
})

async function simpan() {
  if (!props.sg || sibuk.value) return
  sibuk.value = true
  try {
    await hrUpdate('suggestions', props.sg.id, { ...props.sg, status: status.value, response: response.value })
    try {
      await hrPostAudit('SUGGESTION_RESPON', status.value)
    }
    catch {
      // Audit is a bonus.
    }
    toast.add({ title: 'Respon tersimpan', color: 'success' })
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
    title="Respon saran"
  >
    <div
      v-if="sg"
      class="space-y-3"
    >
      <p class="rounded-field bg-muted px-3 py-2 text-sm">
        {{ sg.text }}
      </p>
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Status">
          <USelect
            v-model="status"
            :items="['Baru', 'Ditinjau', 'Diterapkan', 'Ditolak'].map(x => ({ value: x, label: x }))"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Respon">
          <UInput
            v-model="response"
            class="w-full"
          />
        </UFormField>
      </div>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Simpan respon'"
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
