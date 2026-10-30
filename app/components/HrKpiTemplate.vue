<!--
  Edit Template KPI (deploy/hr/index.html editKpiTemplate :1895-1933).
  Weight and target edits apply to EVERY month — history is recomputed from
  them, so the warning is part of the form, not decoration (F.21). The legacy
  screen edits existing indicators only; adding or removing one is not part of
  the migration.
-->
<script setup lang="ts">
import { divName } from '~/utils/hr'
import { hrPostAudit, hrUpdate, useHrDasar } from '~/composables/useHr'

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { s, refresh } = useHrDasar()
const sibuk = ref(false)
/** itemId -> editable fields. */
const isi = ref<Record<string, { name: string, weight: string, target: string, unit: string, dir: string }>>({})

watch(open, (v) => {
  if (!v) return
  const out: typeof isi.value = {}
  for (const t of s.value.kpiTemplates) {
    for (const it of t.items) {
      out[it.id] = { name: it.name, weight: String(it.weight), target: String(it.target), unit: it.unit, dir: it.dir }
    }
  }
  isi.value = out
})

function setField(id: string, k: 'name' | 'weight' | 'target' | 'unit' | 'dir', v: string | number) {
  const r = isi.value[id]
  if (r) r[k] = String(v ?? '')
}

async function simpan() {
  if (sibuk.value) return
  sibuk.value = true
  let gagal = 0
  try {
    for (const t of s.value.kpiTemplates) {
      const items = t.items.map((it) => {
        const v = isi.value[it.id]!
        return {
          ...it,
          name: v.name,
          weight: Number(v.weight) || 0,
          target: Number(v.target) || 0,
          unit: v.unit,
          dir: v.dir === 'down' ? 'down' : 'up',
        }
      })
      try {
        await hrUpdate('kpi-templates', t.id, { ...t, items })
      }
      catch {
        gagal++
      }
    }
    try {
      await hrPostAudit('KPI_TEMPLATE_EDIT', '')
    }
    catch {
      // Audit is a bonus.
    }
    if (gagal) toast.add({ title: `${gagal} template gagal tersimpan — coba lagi`, color: 'warning' })
    else toast.add({ title: 'Template KPI diperbarui', color: 'success' })
    open.value = false
    emit('saved')
    await refresh()
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    title="Edit template KPI"
    description="Mengubah bobot/target berlaku untuk semua bulan (histori dihitung ulang). Ubah dengan sadar."
  >
    <div class="space-y-4">
      <div
        v-for="t in s.kpiTemplates"
        :key="t.id"
      >
        <p class="mb-1 font-semibold text-highlighted">
          {{ divName(s, t.divId) }}
        </p>
        <div class="space-y-2">
          <div
            v-for="it in t.items"
            :key="it.id"
            class="grid grid-cols-2 gap-2 rounded-panel border border-default p-3"
          >
            <UFormField
              label="Indikator"
              class="col-span-2"
            >
              <UInput
                :model-value="isi[it.id]?.name ?? ''"
                class="w-full"
                @update:model-value="(v: string | number) => setField(it.id, 'name', v)"
              />
            </UFormField>
            <UFormField label="Bobot %">
              <UInput
                :model-value="isi[it.id]?.weight ?? ''"
                type="number"
                class="w-full"
                @update:model-value="(v: string | number) => setField(it.id, 'weight', v)"
              />
            </UFormField>
            <UFormField label="Target">
              <UInput
                :model-value="isi[it.id]?.target ?? ''"
                type="number"
                step="any"
                class="w-full"
                @update:model-value="(v: string | number) => setField(it.id, 'target', v)"
              />
            </UFormField>
            <UFormField label="Unit">
              <UInput
                :model-value="isi[it.id]?.unit ?? ''"
                class="w-full"
                @update:model-value="(v: string | number) => setField(it.id, 'unit', v)"
              />
            </UFormField>
            <UFormField label="Arah">
              <USelect
                :model-value="isi[it.id]?.dir ?? 'up'"
                :items="[{ value: 'up', label: 'Tinggi baik' }, { value: 'down', label: 'Rendah baik' }]"
                class="w-full"
                @update:model-value="(v: string | number) => setField(it.id, 'dir', v)"
              />
            </UFormField>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Simpan template'"
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
