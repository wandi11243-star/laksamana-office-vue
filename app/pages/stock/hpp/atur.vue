<!--
  Stock › HPP › Pengaturan (old `deploy/stock/hpp/index.html:245`, JUDUL atur `:838`).

  "Target COGS, buffer, dan ambang lampu selisih" — the five keys
  `PATCH /stock/hpp/settings` accepts — plus the one-time move from Excel
  (`POST /stock/hpp/import`, HPP admins, all-or-nothing, F.22).
-->
<script setup lang="ts">
import { isAdminOf } from '~/composables/useMe'
import { hppImport, hppSettings, patchHppSettings } from '~/composables/useStock'
import { apiErrorCode, apiErrorMessage } from '~/composables/useApi'
import { bacaBerkasTabel } from '~/utils/xlsx-baca'
import { SET_DEFAULT } from '~/utils/stock-hpp'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['hpp'] })

const me = useMe()
const toast = useToast()
const admin = computed(() => isAdminOf(me.value, 'hpp'))

const dataQ = useAsyncData('hpp-atur', hppSettings, {
  default: () => ({ data: { ...SET_DEFAULT }, versi: undefined }),
})
const f = ref({ targetFood: 33, targetDrink: 33, buffer: 5, lampuKuning: 3, lampuMerah: 8 })
watch(() => dataQ.data.value?.data, (d) => {
  if (!d) return
  f.value = {
    targetFood: Number(d.targetFood ?? 0.33) * 100,
    targetDrink: Number(d.targetDrink ?? 0.33) * 100,
    buffer: Number(d.buffer ?? 0.05) * 100,
    lampuKuning: Number(d.lampuKuning ?? 3),
    lampuMerah: Number(d.lampuMerah ?? 8),
  }
}, { immediate: true })

const menyimpan = ref(false)
async function simpan() {
  menyimpan.value = true
  try {
    await patchHppSettings({
      targetFood: Number(f.value.targetFood) / 100,
      targetDrink: Number(f.value.targetDrink) / 100,
      buffer: Number(f.value.buffer) / 100,
      lampuKuning: Number(f.value.lampuKuning),
      lampuMerah: Number(f.value.lampuMerah),
    }, dataQ.data.value?.versi)
    await dataQ.refresh()
    toast.add({ title: 'Pengaturan tersimpan', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => dataQ.refresh()))) toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}

// --- one-time import ---------------------------------------------------------------
const sheet = ref(false)
const timpa = ref(false)
const imporSibuk = ref(false)
async function impor(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  imporSibuk.value = true
  try {
    const tb = await bacaBerkasTabel(file)
    const bahan = tb.filter(r => String(r.Nama || r.nama || '').trim() && !String(r.Resep || r.resep || '').trim()).map(r => ({
      nama: String(r.Nama || r.nama || '').trim(),
      satuan: String(r.Satuan || r.satuan || ''),
      qty_beli: Number(r['Qty beli'] || r.qty_beli || 0),
      harga_beli: Number(r['Harga beli'] || r.harga_beli || 0),
    }))
    const resep = tb.filter(r => String(r.Resep || r.resep || '').trim()).map(r => ({
      nama: String(r.Resep || r.resep || '').trim(),
    }))
    await hppImport({ bahan, resep, replace: timpa.value || undefined })
    sheet.value = false
    toast.add({ title: 'Impor selesai', description: `${bahan.length} bahan, ${resep.length} resep.`, color: 'success' })
  }
  catch (err) {
    if (apiErrorCode(err) === 'hpp_not_empty' && !timpa.value) {
      toast.add({ title: 'HPP sudah berisi data', description: 'Centang “Timpa seluruh isi” untuk mengganti semuanya sekaligus.', color: 'warning' })
    }
    else toast.add({ title: 'Impor gagal', description: apiErrorMessage(err), color: 'error' })
  }
  finally {
    imporSibuk.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}
</script>

<template>
  <AppPage
    title="Pengaturan"
    description="Target COGS, buffer, dan ambang lampu selisih"
  >
    <AppPanel title="Target & ambang">
      <AppFilterGrid>
        <UFormField label="Target COGS makanan (%)">
          <UInput
            v-model.number="f.targetFood"
            type="number"
            step="any"
            min="0"
          />
        </UFormField>
        <UFormField label="Target COGS minuman (%)">
          <UInput
            v-model.number="f.targetDrink"
            type="number"
            step="any"
            min="0"
          />
        </UFormField>
        <UFormField label="Buffer / spare modal (%)">
          <UInput
            v-model.number="f.buffer"
            type="number"
            step="any"
            min="0"
          />
        </UFormField>
        <UFormField label="Lampu kuning di atas (%)">
          <UInput
            v-model.number="f.lampuKuning"
            type="number"
            step="any"
            min="0"
          />
        </UFormField>
        <UFormField label="Lampu merah di atas (%)">
          <UInput
            v-model.number="f.lampuMerah"
            type="number"
            step="any"
            min="0"
          />
        </UFormField>
      </AppFilterGrid>
      <p class="mt-2 text-sm text-muted">
        Buffer negatif diabaikan; nol = cara mematikan spare. Spare hanya dikenakan sekali, di menu jadi.
      </p>
      <UButton
        label="Simpan pengaturan"
        class="mt-3"
        :loading="menyimpan"
        @click="simpan"
      />
    </AppPanel>

    <AppPanel
      v-if="admin"
      title="Pindah dari Excel (sekali saja)"
      description="Hanya admin HPP. Gagal satu baris = seluruh impor dibatalkan."
    >
      <UButton
        label="Impor awal…"
        icon="i-lucide-upload"
        variant="outline"
        @click="sheet = true"
      />
    </AppPanel>

    <ResponsiveSheet
      v-model:open="sheet"
      title="Impor awal dari Excel"
    >
      <div class="flex flex-col gap-3">
        <p class="text-sm text-error">
          {{ timpa ? 'Mengganti SELURUH isi bahan & resep dengan berkas ini.' : 'Menolak bila HPP sudah berisi data.' }}
        </p>
        <UCheckbox
          v-model="timpa"
          label="Timpa seluruh isi (hapus dulu, lalu isi)"
        />
        <UFormField label="Berkas (.xlsx/.xls/.csv)">
          <UInput
            type="file"
            accept=".xlsx,.xls,.csv"
            :disabled="imporSibuk"
            @change="impor"
          />
        </UFormField>
        <div class="flex justify-end">
          <UButton
            label="Tutup"
            variant="outline"
            @click="sheet = false"
          />
        </div>
      </div>
    </ResponsiveSheet>
  </AppPage>
</template>
