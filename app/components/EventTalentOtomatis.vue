<!--
  Talent Schedule › "Isi otomatis": talents + weekdays + from/to dates give
  DRAFTS with each talent's default hours (replaces Input mingguan, Recurring
  and Generate bulanan). Cells that already have a non-cancelled schedule are
  skipped and counted; so are cells where the talent has no default hours.
  The page loads the schedules of the range first (`muat`), so the preview
  counts what is really there.
-->
<script setup lang="ts">
import type { BarisEf, GrupKategori, HasilIsi, JamTalentDoc, TalentRingkas } from '~/utils/event-jadwal'
import { HARI_PENDEK, MAKS_HARI_ISI, isiOtomatis } from '~/utils/event-jadwal'
import { hariKe } from '~/utils/kalender'

const props = defineProps<{
  grup: GrupKategori[]
  talents: TalentRingkas[]
  rows: BarisEf[]
  doc: JamTalentDoc
  memuat: boolean
  /** Starting range (Monday of the viewed week, end of its month). */
  awal: { dari: string, sampai: string }
}>()
const emit = defineEmits<{
  muat: [dari: string, sampai: string]
  terapkan: [hasil: HasilIsi]
}>()
const open = defineModel<boolean>('open', { default: false })

const pilih = ref<string[]>([])
const hari = ref<number[]>([4, 5])
const dari = ref('')
const sampai = ref('')

watch(open, (v) => {
  if (!v) return
  pilih.value = []
  hari.value = [4, 5]
  dari.value = props.awal.dari
  sampai.value = props.awal.sampai
})

const jumlahHari = computed(() => (dari.value && sampai.value ? hariKe(sampai.value) - hariKe(dari.value) + 1 : 0))
const galatRentang = computed(() => {
  if (!dari.value || !sampai.value) return 'Isi tanggal dari dan sampai.'
  if (sampai.value < dari.value) return 'Tanggal sampai harus sama dengan atau setelah tanggal dari.'
  if (jumlahHari.value > MAKS_HARI_ISI) return `Rentang paling lama ${MAKS_HARI_ISI} hari (sekitar 3 bulan).`
  return ''
})

// Load what the range already holds before counting.
watchEffect(() => {
  if (open.value && !galatRentang.value) emit('muat', dari.value, sampai.value)
})

const hasil = computed<HasilIsi>(() => {
  if (galatRentang.value || !pilih.value.length || !hari.value.length) return { baru: [], dilewati: 0, tanpaJam: 0, nonaktif: 0 }
  return isiOtomatis({ talents: props.talents.filter(t => pilih.value.includes(t.id)), hari: hari.value, dari: dari.value, sampai: sampai.value, rows: props.rows, doc: props.doc })
})
const siap = computed(() => !galatRentang.value && !props.memuat && hasil.value.baru.length > 0)

const toggle = (l: string[], id: string) => (l.includes(id) ? l.filter(x => x !== id) : [...l, id])
const semuaKat = (g: GrupKategori) => g.talents.every(t => pilih.value.includes(t.id))
function pilihKategori(g: GrupKategori) {
  const ids = g.talents.map(t => t.id)
  pilih.value = semuaKat(g) ? pilih.value.filter(x => !ids.includes(x)) : [...new Set([...pilih.value, ...ids])]
}
function terapkan() {
  if (!siap.value) return
  emit('terapkan', hasil.value)
  open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    title="Isi otomatis"
    description="Membuat draf dengan jam bawaan masing-masing talent. Belum tersimpan sampai Anda menekan Simpan jadwal."
    lebar="sedang"
  >
    <div class="space-y-4 text-sm">
      <div>
        <p class="mb-1.5 text-xs font-semibold text-muted">
          Talent
        </p>
        <div
          v-for="g in grup"
          :key="g.kategori"
          class="mb-2"
        >
          <button
            type="button"
            class="mb-1 text-[11px] font-bold text-muted uppercase hover:text-highlighted"
            :title="semuaKat(g) ? 'Lepas semua di kategori ini' : 'Pilih semua di kategori ini'"
            @click="pilihKategori(g)"
          >
            {{ g.kategori }} · {{ semuaKat(g) ? 'lepas semua' : 'pilih semua' }}
          </button>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="t in g.talents"
              :key="t.id"
              type="button"
              class="rounded-full border px-2.5 py-1 text-xs font-semibold"
              :class="pilih.includes(t.id) ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-default text-muted'"
              :aria-pressed="pilih.includes(t.id)"
              @click="pilih = toggle(pilih, t.id)"
            >
              {{ t.nama }}
            </button>
          </div>
        </div>
      </div>

      <div>
        <p class="mb-1.5 text-xs font-semibold text-muted">
          Hari
        </p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="(h, i) in HARI_PENDEK"
            :key="h"
            type="button"
            class="rounded-full border px-3 py-1 text-xs font-semibold"
            :class="hari.includes(i) ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-default text-muted'"
            :aria-pressed="hari.includes(i)"
            @click="hari = toggle(hari.map(String), String(i)).map(Number)"
          >
            {{ h }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Dari tanggal">
          <AppTanggal
            v-model="dari"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Sampai tanggal">
          <AppTanggal
            v-model="sampai"
            class="w-full"
          />
        </UFormField>
      </div>

      <p
        v-if="galatRentang"
        class="text-xs font-semibold text-error"
      >
        {{ galatRentang }}
      </p>
      <div
        v-else
        class="rounded-field bg-muted px-3 py-2.5 text-xs num"
      >
        <p v-if="memuat">
          Memuat jadwal yang sudah ada…
        </p>
        <template v-else>
          <p class="font-semibold text-highlighted">
            {{ hasil.baru.length }} draf akan dibuat
          </p>
          <p
            v-if="hasil.dilewati"
            class="text-muted"
          >
            {{ hasil.dilewati }} dilewati: talent itu sudah punya jadwal di hari tersebut.
          </p>
          <p
            v-if="hasil.tanpaJam"
            class="text-muted"
          >
            {{ hasil.tanpaJam }} dilewati: belum ada jam bawaan (atur di Jam talent).
          </p>
          <p
            v-if="!pilih.length || !hari.length"
            class="text-muted"
          >
            Pilih minimal satu talent dan satu hari.
          </p>
        </template>
      </div>
    </div>
    <template #footer>
      <UButton
        color="primary"
        :disabled="!siap"
        @click="terapkan()"
      >
        Buat {{ hasil.baru.length }} draf
      </UButton>
      <UButton
        color="neutral"
        variant="outline"
        @click="open = false"
      >
        Batal
      </UButton>
    </template>
  </ResponsiveSheet>
</template>
