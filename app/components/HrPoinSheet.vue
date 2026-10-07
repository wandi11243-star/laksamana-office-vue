<!--
  Transaksi poin (deploy/hr/index.html pointTx :2227-2238): add (earn) or
  redeem points to one worker; both the amount and the reason are required.
-->
<script setup lang="ts">
import { activeEmps } from '~/utils/hr'
import { hrCreate, hrPostAudit, useHrDasar } from '~/composables/useHr'
import { hariIni } from '~/utils/format'

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { s, refresh } = useHrDasar()
const sibuk = ref(false)

const empId = ref('__kosong__')
const type = ref('earn')
const points = ref('20')
const reason = ref('')

const opsiEmp = computed(() => [
  { value: '__kosong__', label: '— pilih kru —' },
  ...activeEmps(s.value).filter(e => e.appRole !== 'ceo').map(e => ({ value: e.id, label: e.name })),
])

watch(open, (v) => {
  if (!v) return
  empId.value = opsiEmp.value[1]?.value ?? '__kosong__'
  type.value = 'earn'
  points.value = '20'
  reason.value = ''
})

async function simpan() {
  if (sibuk.value) return
  if (empId.value === '__kosong__') return toast.add({ title: 'Pilih kru dulu.', color: 'error' })
  const p = Number(points.value) || 0
  if (p <= 0 || !reason.value.trim()) return toast.add({ title: 'Poin dan alasan wajib diisi.', color: 'error' })
  sibuk.value = true
  try {
    await hrCreate('rewards', { empId: empId.value, date: hariIni(), type: type.value, points: p, reason: reason.value.trim() })
    try {
      await hrPostAudit('POINT_TX', `${type.value} ${p}, ${s.value.employees.find(e => e.id === empId.value)?.name ?? ''}`)
    }
    catch {
      // Audit is a bonus.
    }
    toast.add({ title: 'Transaksi poin tersimpan', color: 'success' })
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
    title="Transaksi poin"
  >
    <div class="space-y-3">
      <UFormField label="Kru">
        <USelect
          v-model="empId"
          :items="opsiEmp"
          class="w-full"
        />
      </UFormField>
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Jenis">
          <USelect
            v-model="type"
            :items="[{ value: 'earn', label: 'Tambah poin' }, { value: 'redeem', label: 'Redeem / tukar' }]"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Poin">
          <UInput
            v-model="points"
            type="number"
            min="1"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField label="Alasan / hadiah">
        <UInput
          v-model="reason"
          placeholder="cth: Redeem voucher makan 100rb / inisiatif handle komplain VIP"
          class="w-full"
        />
      </UFormField>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Simpan transaksi'"
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
