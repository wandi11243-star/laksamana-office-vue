<!--
  Input KPI satu divisi untuk satu bulan (deploy/hr/index.html inputKpiActual
  :1880-1894). Empty box REMOVES the cell (the legacy `delete o[it.id]`), so a
  cleared indicator stops scoring instead of becoming 0. v1 has no whole-map
  write: each item is one PUT (docs/api/hr.md §Nested maps).

  A head may only fill their own division (`toast('Anda hanya bisa input KPI
  divisi sendiri.')`, :1882); the check is repeated here, not only where the
  button is drawn.
-->
<script setup lang="ts">
import { canHr, divName, kpiTemplateFor } from '~/utils/hr'
import { hrPostAudit, hrSaveKpiActual, useHrDasar } from '~/composables/useHr'
import { labelBulanJadwal } from '~/utils/jadwal'
import { angka } from '~/utils/format'

const props = defineProps<{ divId: string, mk: string }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { s, cu, officeAdmin, refresh } = useHrDasar()
const sibuk = ref(false)
const isi = ref<Record<string, string>>({})

const template = computed(() => kpiTemplateFor(s.value, props.divId))
watch(open, (v) => {
  if (!v || !template.value) return
  const acts = s.value.kpiActuals[props.divId]?.[props.mk] ?? {}
  const out: Record<string, string> = {}
  for (const it of template.value.items) out[it.id] = acts[it.id] == null ? '' : String(acts[it.id])
  isi.value = out
})

async function simpan() {
  if (sibuk.value) return
  if (!canHr('seeAll', cu.value, officeAdmin.value) && cu.value?.divId !== props.divId) {
    return toast.add({ title: 'Anda hanya bisa input KPI divisi sendiri.', color: 'error' })
  }
  if (!template.value) return
  sibuk.value = true
  let gagal = 0
  try {
    for (const it of template.value.items) {
      const v = String(isi.value[it.id] ?? '').trim()
      const nilai = v === '' ? null : Number(v)
      try {
        await hrSaveKpiActual(props.divId, props.mk, it.id, nilai == null || Number.isNaN(nilai) ? null : nilai)
      }
      catch {
        gagal++
      }
    }
    try {
      await hrPostAudit('KPI_INPUT', `${divName(s.value, props.divId)} ${props.mk}`)
    }
    catch {
      // Audit is a bonus.
    }
    if (gagal) toast.add({ title: `${gagal} indikator gagal tersimpan — coba lagi`, color: 'warning' })
    else toast.add({ title: 'KPI tersimpan', color: 'success' })
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
    :title="`Input KPI ${divName(s, divId)}, ${labelBulanJadwal(mk)}`"
  >
    <div
      v-if="template"
      class="space-y-3"
    >
      <div
        v-for="it in template.items"
        :key="it.id"
        class="rounded-field border border-default p-3"
      >
        <UFormField :label="`${it.name} (${it.unit}), target ${angka(it.target)}`">
          <UInput
            :model-value="isi[it.id] ?? ''"
            type="number"
            step="any"
            class="w-full"
            @update:model-value="(v: string | number) => isi[it.id] = String(v ?? '')"
          />
        </UFormField>
        <p class="mt-1 text-xs text-muted">
          {{ it.dir === 'down' ? 'Makin rendah makin baik' : 'Makin tinggi makin baik' }}, bobot {{ it.weight }}%.
          Kosongkan untuk menghapus isian bulan ini.
        </p>
      </div>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Simpan KPI'"
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
