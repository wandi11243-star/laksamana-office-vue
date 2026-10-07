<!--
  Kandidat suksesi baru / edit (deploy/hr/index.html editSuccession :2404-2419).
  Both the position and a chosen candidate are required: a row without a
  candidate shows forever as "-" without pointing at anyone.
-->
<script setup lang="ts">
import type { HrSuccession } from '~/utils/hr'
import { activeEmps } from '~/utils/hr'
import { hrCreate, hrPostAudit, hrUpdate, useHrDasar } from '~/composables/useHr'

const props = defineProps<{ sc: HrSuccession | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { s, refresh } = useHrDasar()
const sibuk = ref(false)

const position = ref('')
const empId = ref('__kosong__')
const readiness = ref('6 Bulan')
const gap = ref('')

const opsiEmp = computed(() => [
  { value: '__kosong__', label: '— pilih kandidat —' },
  ...activeEmps(s.value).filter(e => e.appRole !== 'ceo').map(e => ({ value: e.id, label: e.name })),
])

watch(open, (v) => {
  if (!v) return
  const sc = props.sc
  position.value = sc?.position ?? ''
  empId.value = sc?.empId || '__kosong__'
  readiness.value = sc?.readiness ?? '6 Bulan'
  gap.value = sc?.gap ?? ''
})

async function simpan() {
  if (sibuk.value) return
  if (!position.value.trim()) return toast.add({ title: 'Posisi wajib diisi.', color: 'error' })
  if (empId.value === '__kosong__') return toast.add({ title: 'Pilih kandidat dulu.', color: 'error' })
  const data = { position: position.value.trim(), empId: empId.value, readiness: readiness.value, gap: gap.value }
  sibuk.value = true
  try {
    if (props.sc) await hrUpdate('successions', props.sc.id, { ...props.sc, ...data })
    else await hrCreate('successions', data)
    try {
      await hrPostAudit('SUCCESSION_SAVE', data.position)
    }
    catch {
      // Audit is a bonus.
    }
    toast.add({ title: 'Kandidat tersimpan', color: 'success' })
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
    :title="sc ? 'Edit kandidat' : 'Kandidat suksesi'"
  >
    <div class="space-y-3">
      <UFormField label="Posisi target">
        <UInput
          v-model="position"
          placeholder="cth: Store Manager Outlet 2"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Kandidat">
        <USelect
          v-model="empId"
          :items="opsiEmp"
          class="w-full"
        />
      </UFormField>
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Kesiapan">
          <USelect
            v-model="readiness"
            :items="['Ready Now', '6 Bulan', '1 Tahun'].map(x => ({ value: x, label: x }))"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Gap kompetensi">
          <UInput
            v-model="gap"
            placeholder="cth: leadership, P&L, hiring"
            class="w-full"
          />
        </UFormField>
      </div>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Simpan kandidat'"
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
