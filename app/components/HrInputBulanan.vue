<!--
  Input Data Bulanan (deploy/hr/index.html openMonthlyInput :1603-1628): the
  manual source for components the system cannot see — customer review, an
  individual KPI override, and a legacy attendance % for months without a
  Talenta upload. Talenta and Akademi win whenever they exist (F.6/F.7), and
  the sheet says so.
-->
<script setup lang="ts">
import type { HrEmployee } from '~/utils/hr'
import { divName } from '~/utils/hr'
import { hrSaveMonthlyInput, useHrDasar } from '~/composables/useHr'
import { labelBulanJadwal } from '~/utils/jadwal'

const props = defineProps<{ mk: string, employees: HrEmployee[] }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { s } = useHrDasar()
const sibuk = ref(false)
const isi = ref<Record<string, { attendance: string, review: string, kpiOverride: string }>>({})

watch(open, (v) => {
  if (!v) return
  const out: typeof isi.value = {}
  for (const e of props.employees) {
    const mi = s.value.monthlyInputs[e.id]?.[props.mk] ?? {}
    out[e.id] = {
      attendance: mi.attendance == null ? '' : String(mi.attendance),
      review: mi.review == null ? '' : String(mi.review),
      kpiOverride: mi.kpiOverride == null ? '' : String(mi.kpiOverride),
    }
  }
  isi.value = out
})

function baris(id: string) {
  if (!isi.value[id]) isi.value[id] = { attendance: '', review: '', kpiOverride: '' }
  return isi.value[id]
}
function setNilai(id: string, k: 'attendance' | 'review' | 'kpiOverride', v: string | number) {
  baris(id)[k] = String(v ?? '')
}

async function simpan() {
  if (sibuk.value) return
  sibuk.value = true
  let gagal = 0
  try {
    for (const e of props.employees) {
      const v = isi.value[e.id]
      if (!v) continue
      try {
        await hrSaveMonthlyInput(e.id, props.mk, {
          attendance: v.attendance,
          review: v.review,
          kpiOverride: v.kpiOverride,
        })
      }
      catch {
        gagal++
      }
    }
    if (gagal) toast.add({ title: `${gagal} baris gagal tersimpan — simpan lagi`, color: 'warning' })
    else toast.add({ title: 'Data bulanan tersimpan', color: 'success' })
    open.value = false
    emit('saved')
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="`Input data bulanan, ${labelBulanJadwal(mk)}`"
    lebar="sedang"
  >
    <div class="space-y-3">
      <p class="rounded-field bg-info/10 px-3 py-2 text-sm">
        Input manual komponen yang sumbernya di luar sistem: <b>Customer Review</b> dan override KPI individu bila
        perlu. Kosongkan jika tidak ada.
      </p>
      <p class="rounded-field bg-warning/12 px-3 py-2 text-sm">
        Kolom <b>Attend %</b> hanya dipakai untuk bulan yang report Talenta-nya belum diunggah. Begitu bulan itu
        diunggah di halaman <b>Kehadiran</b>, angka hasil hitungan yang dipakai dan isian di sini diabaikan.
      </p>

      <div class="space-y-3">
        <div
          v-for="e in employees"
          :key="e.id"
          class="rounded-panel border border-default p-3"
        >
          <p class="font-semibold text-highlighted">
            {{ e.name }}
          </p>
          <p class="mb-2 text-[13px] text-muted">
            {{ divName(s, e.divId) }}
          </p>
          <div class="grid grid-cols-3 gap-2">
            <UFormField label="Attend %">
              <UInput
                :model-value="isi[e.id]?.attendance ?? ''"
                type="number"
                min="0"
                max="100"
                class="w-full"
                @update:model-value="(v: string | number) => setNilai(e.id, 'attendance', v)"
              />
            </UFormField>
            <UFormField label="Review 0–100">
              <UInput
                :model-value="isi[e.id]?.review ?? ''"
                type="number"
                min="0"
                max="100"
                class="w-full"
                @update:model-value="(v: string | number) => setNilai(e.id, 'review', v)"
              />
            </UFormField>
            <UFormField label="KPI override">
              <UInput
                :model-value="isi[e.id]?.kpiOverride ?? ''"
                type="number"
                min="0"
                max="120"
                class="w-full"
                @update:model-value="(v: string | number) => setNilai(e.id, 'kpiOverride', v)"
              />
            </UFormField>
          </div>
        </div>
        <p
          v-if="!employees.length"
          class="text-sm text-muted"
        >
          Tidak ada kru dalam jangkauan Anda.
        </p>
      </div>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Simpan data bulanan'"
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
