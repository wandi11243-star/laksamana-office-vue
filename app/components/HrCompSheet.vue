<!--
  Competency Matrix satu kru (deploy/hr/index.html editComp :2051-2064).
  Rows of competency + level 1–5; a nameless row is dropped on save, exactly
  like the legacy loop. Level ≤2 surfaces as "perlu training" on the page.
-->
<script setup lang="ts">
import type { HrEmployee } from '~/utils/hr'
import { hrCreate, hrPostAudit, hrUpdate, useHrDasar } from '~/composables/useHr'

const props = defineProps<{ e: HrEmployee | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { s, refresh } = useHrDasar()
const sibuk = ref(false)
const skills = ref<{ name: string, level: string }[]>([])

const opsiLevel = [1, 2, 3, 4, 5].map(l => ({ value: String(l), label: `${l} / 5` }))

watch(open, (v) => {
  if (!v) return
  const cm = props.e ? s.value.competencies.find(x => x.empId === props.e!.id) : null
  skills.value = cm?.skills.length
    ? cm.skills.map(x => ({ name: x.name, level: String(x.level) }))
    : [{ name: '', level: '3' }]
})

function tambah() {
  skills.value.push({ name: '', level: '3' })
}
function hapus(i: number) {
  if (skills.value.length <= 1) return
  skills.value.splice(i, 1)
}

async function simpan() {
  if (!props.e || sibuk.value) return
  const out = skills.value
    .map(x => ({ name: x.name.trim(), level: Number(x.level) || 3 }))
    .filter(x => x.name)
  sibuk.value = true
  try {
    const cm = s.value.competencies.find(x => x.empId === props.e!.id)
    if (cm) await hrUpdate('competencies', cm.id, { ...cm, skills: out })
    else await hrCreate('competencies', { empId: props.e.id, skills: out })
    try {
      await hrPostAudit('COMP_SAVE', props.e.name)
    }
    catch {
      // Audit is a bonus.
    }
    toast.add({ title: 'Kompetensi tersimpan', color: 'success' })
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
    :title="e ? `Competency matrix, ${e.name}` : 'Competency matrix'"
  >
    <div class="space-y-3">
      <div
        v-for="(sk, i) in skills"
        :key="i"
        class="flex items-end gap-2 rounded-field border border-default p-3"
      >
        <UFormField
          label="Kompetensi"
          class="min-w-0 flex-1"
        >
          <UInput
            v-model="sk.name"
            placeholder="cth: Espresso / Latte Art / Upselling"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Level">
          <USelect
            v-model="sk.level"
            :items="opsiLevel"
            class="w-28"
          />
        </UFormField>
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="sm"
          :disabled="skills.length <= 1"
          aria-label="Hapus kompetensi"
          @click="hapus(i)"
        />
      </div>
      <UButton
        label="Tambah kompetensi"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        size="sm"
        @click="tambah"
      />
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Simpan kompetensi'"
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
