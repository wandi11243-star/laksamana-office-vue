<!--
  OKR Baru / Edit OKR (deploy/hr/index.html editOkr :1935-1961). The owner may
  be a division or one person; the KR table is edited in place and a KR without
  a name is dropped, exactly like the legacy save loop (:1946). Objective and
  at least one KR are required.
-->
<script setup lang="ts">
import type { HrOkr } from '~/utils/hr'
import { activeEmps, divName } from '~/utils/hr'
import { hrCreate, hrPostAudit, hrUpdate, useHrDasar } from '~/composables/useHr'

const props = defineProps<{ okr: HrOkr | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { s, refresh } = useHrDasar()
const sibuk = ref(false)

const ownerType = ref<'div' | 'emp'>('div')
const ownerId = ref('')
const period = ref('')
const objective = ref('')
const krs = ref<{ name: string, target: string, unit: string, progress: string }[]>([])

const opsiOwner = computed(() => (ownerType.value === 'div'
  ? s.value.divisions.map(d => ({ value: d.id, label: d.name }))
  : activeEmps(s.value).filter(e => e.appRole !== 'ceo').map(e => ({ value: e.id, label: `${e.name}, ${divName(s.value, e.divId)}` }))))

watch(open, (v) => {
  if (!v) return
  const o = props.okr
  ownerType.value = o?.ownerType === 'emp' ? 'emp' : 'div'
  ownerId.value = o?.ownerId ?? s.value.divisions.find(d => d.id === 'd_marketing')?.id ?? s.value.divisions[0]?.id ?? ''
  period.value = o?.period ?? 'Q3 2026'
  objective.value = o?.objective ?? ''
  krs.value = o
    ? o.krs.map(k => ({ name: k.name, target: String(k.target), unit: k.unit, progress: String(k.progress) }))
    : [{ name: '', target: '0', unit: '', progress: '0' }]
})

watch(ownerType, () => {
  // Keep the selection valid for the new owner kind.
  if (!opsiOwner.value.some(o => o.value === ownerId.value)) ownerId.value = opsiOwner.value[0]?.value ?? ''
})

function tambahKr() {
  krs.value.push({ name: '', target: '0', unit: '', progress: '0' })
}
function hapusKr(i: number) {
  if (krs.value.length <= 1) return
  krs.value.splice(i, 1)
}

async function simpan() {
  if (sibuk.value) return
  const bersih = krs.value
    .map(k => ({ name: k.name.trim(), target: Number(k.target) || 0, unit: k.unit, progress: Number(k.progress) || 0 }))
    .filter(k => k.name)
  if (!objective.value.trim() || !bersih.length) {
    return toast.add({ title: 'Objective dan minimal 1 key result wajib diisi.', color: 'error' })
  }
  const data = { ownerType: ownerType.value, ownerId: ownerId.value, period: period.value, objective: objective.value.trim(), krs: bersih }
  sibuk.value = true
  try {
    if (props.okr) await hrUpdate('okrs', props.okr.id, data)
    else await hrCreate('okrs', data)
    try {
      await hrPostAudit('OKR_SAVE', data.objective)
    }
    catch {
      // Audit is a bonus.
    }
    toast.add({ title: 'OKR tersimpan', color: 'success' })
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
    :title="okr ? 'Edit OKR' : 'OKR Baru'"
    lebar="sedang"
  >
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Pemilik">
          <USelect
            v-model="ownerType"
            :items="[{ value: 'div', label: 'Divisi' }, { value: 'emp', label: 'Individu' }]"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="ownerType === 'div' ? 'Divisi' : 'Kru'">
          <USelect
            v-model="ownerId"
            :items="opsiOwner"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField label="Periode">
        <UInput
          v-model="period"
          placeholder="Q3 2026 / Jul 2026"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Objective">
        <UInput
          v-model="objective"
          placeholder="cth: Amankan 50 juta sponsorship untuk low season Sep–Nov"
          class="w-full"
        />
      </UFormField>

      <div>
        <p class="mb-1 text-sm font-semibold text-highlighted">
          Key results
        </p>
        <div class="space-y-2">
          <div
            v-for="(k, i) in krs"
            :key="i"
            class="grid grid-cols-[1fr_auto] gap-2 rounded-panel border border-default p-3"
          >
            <div class="grid grid-cols-3 gap-2">
              <UFormField
                label="Nama"
                class="col-span-3"
              >
                <UInput
                  v-model="k.name"
                  placeholder="Key result"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Target">
                <UInput
                  v-model="k.target"
                  type="number"
                  step="any"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Unit">
                <UInput
                  v-model="k.unit"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Progress">
                <UInput
                  v-model="k.progress"
                  type="number"
                  step="any"
                  class="w-full"
                />
              </UFormField>
            </div>
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              class="self-end"
              :disabled="krs.length <= 1"
              aria-label="Hapus key result"
              @click="hapusKr(i)"
            />
          </div>
        </div>
        <UButton
          label="Tambah key result"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          size="sm"
          class="mt-2"
          @click="tambahKr"
        />
      </div>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Simpan OKR'"
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
