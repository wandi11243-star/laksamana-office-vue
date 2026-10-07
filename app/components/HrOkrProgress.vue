<!--
  Update one key result's progress (deploy/hr/index.html updKr :1962-1969).
  Replaces the OKR row with the KR updated (v1 is per-record, not whole-doc).
-->
<script setup lang="ts">
import type { HrOkr } from '~/utils/hr'
import { hrPostAudit, hrUpdate, useHrDasar } from '~/composables/useHr'
import { angka } from '~/utils/format'

const props = defineProps<{ okr: HrOkr | null, index: number }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { refresh } = useHrDasar()
const sibuk = ref(false)
const nilai = ref('')

const kr = computed(() => (props.okr ? props.okr.krs[props.index] ?? null : null))

watch(open, (v) => {
  if (v && kr.value) nilai.value = String(kr.value.progress)
})

async function simpan() {
  if (!props.okr || !kr.value || sibuk.value) return
  sibuk.value = true
  try {
    const krs = props.okr.krs.map((k, i) => (i === props.index ? { ...k, progress: Number(nilai.value) || 0 } : k))
    await hrUpdate('okrs', props.okr.id, { ...props.okr, krs })
    try {
      await hrPostAudit('OKR_PROGRESS', `${props.okr.objective} / ${kr.value.name}`)
    }
    catch {
      // Audit is a bonus.
    }
    toast.add({ title: 'Progress diperbarui', color: 'success' })
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
    v-if="kr && okr"
    v-model:open="open"
    :title="`Update progress, ${kr.name}`"
  >
    <UFormField :label="`Progress (${kr.unit || 'tanpa unit'}), target ${angka(kr.target)}`">
      <UInput
        v-model="nilai"
        type="number"
        step="any"
        class="w-full"
      />
    </UFormField>
    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Simpan progress'"
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
