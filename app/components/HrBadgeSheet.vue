<!--
  Beri badge (deploy/hr/index.html giveBadge :2215-2226). A badge also writes
  its points to the reward ledger in the same save — Employee of the Month
  pays more than a regular badge (pointRules).
-->
<script setup lang="ts">
import { BADGE_LIST, activeEmps } from '~/utils/hr'
import { hrCreate, hrPostAudit, useHrDasar } from '~/composables/useHr'
import { hariIni } from '~/utils/format'

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { s, refresh } = useHrDasar()
const sibuk = ref(false)

const empId = ref('__kosong__')
const badge = ref(BADGE_LIST[0]!)
const month = ref(hariIni().slice(0, 7))
const note = ref('')

const opsiEmp = computed(() => [
  { value: '__kosong__', label: '— pilih kru —' },
  ...activeEmps(s.value).filter(e => e.appRole !== 'ceo').map(e => ({ value: e.id, label: e.name })),
])

watch(open, (v) => {
  if (!v) return
  empId.value = opsiEmp.value[1]?.value ?? '__kosong__'
  badge.value = BADGE_LIST[0]!
  month.value = hariIni().slice(0, 7)
  note.value = ''
})

async function simpan() {
  if (sibuk.value) return
  if (empId.value === '__kosong__') return toast.add({ title: 'Pilih kru dulu.', color: 'error' })
  const poin = badge.value === 'Employee of the Month' ? s.value.settings.pointRules.eom : s.value.settings.pointRules.badge
  sibuk.value = true
  try {
    await hrCreate('badges', { empId: empId.value, badge: badge.value, month: month.value, note: note.value })
    await hrCreate('rewards', {
      empId: empId.value,
      date: hariIni(),
      type: 'earn',
      points: poin,
      reason: `Badge: ${badge.value} (${month.value})`,
    })
    try {
      await hrPostAudit('BADGE', `${s.value.employees.find(e => e.id === empId.value)?.name ?? ''}, ${badge.value}`)
    }
    catch {
      // Audit is a bonus.
    }
    toast.add({ title: `Badge diberikan +${poin} poin`, color: 'success' })
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
    title="Beri badge"
  >
    <div class="space-y-3">
      <UFormField label="Kru">
        <USelect
          v-model="empId"
          :items="opsiEmp"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Badge">
        <USelect
          v-model="badge"
          :items="BADGE_LIST.map(x => ({ value: x, label: x }))"
          class="w-full"
        />
      </UFormField>
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Bulan">
          <UInput
            v-model="month"
            type="month"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Catatan">
          <UInput
            v-model="note"
            placeholder="alasan singkat"
            class="w-full"
          />
        </UFormField>
      </div>
      <p class="rounded-field bg-info/10 px-3 py-2 text-sm">
        Employee of the Month memberi {{ s.settings.pointRules.eom }} poin; badge lain
        {{ s.settings.pointRules.badge }} poin.
      </p>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Beri badge'"
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
