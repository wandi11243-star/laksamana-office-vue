<!--
  Talent Schedule › editor of ONE roster row (a filled cell, a calendar card, a
  cell of the monthly attendance table). It works on a copy: nothing changes
  until "Terapkan", and even then only the DRAFT changes — the schedule is
  written by "Simpan jadwal" on the page. That includes the status: it is part
  of the draft here, not saved the moment it is pressed (the old sheet saved
  status at once).

  An empty cell whose talent has no default hours opens this editor with empty
  hours (`baru`); hours are then required.
-->
<script setup lang="ts">
import type { BarisEf, JamTalentDoc, NilaiJadwal } from '~/utils/event-jadwal'
import { STATUS_JADWAL, bedaDariBawaan, bentrokDengan, jam5, jamBawaan, pesanJam, slotBerlaku, slotKategori } from '~/utils/event-jadwal'
import { tglPanjang } from '~/utils/format'

const TIDAK_ADA = '__tidak_ada'

const props = defineProps<{
  /** The row being edited; null when closed. */
  target: { kunci: string, nilai: NilaiJadwal, baru: boolean, draf: BarisEf['draf'], basi: boolean } | null
  namaTalent: string
  doc: JamTalentDoc
  kategori: string[]
  acara: { id: string, title: string, tgl: string }[]
  /** Every row on the roster (saved + drafts), for the live clash hint. */
  semua: BarisEf[]
  bolehUbah: boolean
}>()
const emit = defineEmits<{
  terapkan: [nilai: NilaiJadwal]
  hapus: []
  buang: []
}>()
const open = defineModel<boolean>('open', { default: false })

const f = ref<NilaiJadwal | null>(null)
const acaraId = ref(TIDAK_ADA)
const galat = ref('')

watch(() => props.target, (t) => {
  f.value = t ? { ...t.nilai } : null
  acaraId.value = t?.nilai.event_id ?? TIDAK_ADA
  galat.value = ''
}, { immediate: true })

const slots = computed(() => (f.value ? slotKategori(props.doc, f.value.performance_type) : []))
const khusus = computed(() => (f.value ? props.doc.talent[f.value.talent_id] ?? null : null))
const bawaan = computed(() => (f.value ? jamBawaan(props.doc, f.value.talent_id, f.value.performance_type, f.value.date) : null))
const beda = computed(() => !!f.value && bedaDariBawaan(props.doc, f.value.talent_id, f.value.performance_type, f.value.date, f.value.start_time, f.value.end_time))
const bentrok = computed(() => {
  const x = f.value
  if (!x || x.status === 'Cancelled' || pesanJam(x.start_time, x.end_time)) return null
  return bentrokDengan(props.semua, x.talent_id, x.date, x.start_time, x.end_time, props.target?.kunci)
})
const opsiAcara = computed(() => [
  { value: TIDAK_ADA, label: 'Tidak terkait event' },
  ...props.acara.map(a => ({ value: a.id, label: `${a.title}${a.tgl ? ` · ${a.tgl}` : ''}` })),
])

function pakaiJam(mulai: string, selesai: string) {
  if (!f.value) return
  f.value.start_time = jam5(mulai)
  f.value.end_time = jam5(selesai)
}

function terapkan() {
  const x = f.value
  if (!x || !props.bolehUbah) return
  const p = pesanJam(x.start_time, x.end_time)
  if (p) {
    galat.value = p
    return
  }
  if (!Number.isFinite(Number(x.fee)) || Number(x.fee) < 0) {
    galat.value = 'Fee tidak boleh kosong atau negatif.'
    return
  }
  emit('terapkan', { ...x, fee: Number(x.fee) || 0, event_id: acaraId.value === TIDAK_ADA ? null : acaraId.value, notes: x.notes.trim() })
  open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="namaTalent || 'Jadwal talent'"
    :description="f ? tglPanjang(f.date) : ''"
    lebar="sedang"
  >
    <div
      v-if="f"
      class="space-y-4 text-sm"
    >
      <UAlert
        v-if="target?.basi"
        color="warning"
        variant="soft"
        title="Baris ini diubah orang lain"
        description="Nilai di bawah masih nilai Anda. Periksa lalu tekan Terapkan untuk memakainya, atau Buang perubahan untuk memakai versi terbaru."
      />
      <UAlert
        v-if="!bolehUbah"
        color="neutral"
        variant="soft"
        title="Hanya lihat"
        description="Akun ini tidak boleh mengubah Talent Schedule."
      />

      <div v-if="slots.length || khusus">
        <p class="mb-1.5 text-xs font-semibold text-muted">
          Pilih slot jam
        </p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-if="khusus"
            type="button"
            class="rounded-full border px-2.5 py-1 text-xs font-semibold"
            :class="f.start_time === khusus.mulai && f.end_time === khusus.selesai ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-default text-muted'"
            :disabled="!bolehUbah"
            @click="pakaiJam(khusus.mulai, khusus.selesai)"
          >
            Jam khusus talent · {{ khusus.mulai }}–{{ khusus.selesai }}
          </button>
          <button
            v-for="s in slots"
            :key="s.id"
            type="button"
            class="rounded-full border px-2.5 py-1 text-xs font-semibold"
            :class="[f.start_time === s.mulai && f.end_time === s.selesai ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-default text-muted', slotBerlaku(s, f.date) ? '' : 'opacity-60']"
            :title="slotBerlaku(s, f.date) ? undefined : 'Slot ini biasanya tidak berlaku di hari ini'"
            :disabled="!bolehUbah"
            @click="pakaiJam(s.mulai, s.selesai)"
          >
            {{ s.nama || 'Slot' }} · {{ s.mulai }}–{{ s.selesai }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Jam mulai">
          <AppJam
            v-model="f.start_time"
            :disabled="!bolehUbah"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jam selesai">
          <AppJam
            v-model="f.end_time"
            :disabled="!bolehUbah"
            class="w-full"
          />
        </UFormField>
      </div>
      <p
        v-if="bawaan"
        class="-mt-2 flex items-center gap-1.5 text-xs text-muted"
      >
        <span
          v-if="beda"
          class="size-2 rounded-full bg-warning"
          aria-hidden="true"
        />
        Jam bawaan {{ f.performance_type }}: {{ bawaan.mulai }}–{{ bawaan.selesai }}<template v-if="beda">
          · jam ini berbeda dari bawaan
        </template>
      </p>
      <p
        v-else
        class="-mt-2 text-xs text-muted"
      >
        Belum ada jam bawaan untuk {{ namaTalent }} di {{ f.performance_type || 'kategori ini' }}: isi jamnya, atau atur di Jam talent.
      </p>
      <p
        v-if="bentrok"
        class="-mt-2 text-xs font-semibold text-error"
      >
        Bentrok: {{ namaTalent }} sudah punya jadwal {{ bentrok.start_time }}–{{ bentrok.end_time }} di hari ini.
      </p>

      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Fee">
          <UInput
            v-model.number="f.fee"
            type="number"
            min="0"
            :disabled="!bolehUbah"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tipe performance">
          <USelect
            v-model="f.performance_type"
            :items="kategori.map(c => ({ value: c, label: c }))"
            :disabled="!bolehUbah"
            class="w-full"
          />
        </UFormField>
      </div>

      <UFormField
        label="Event terkait"
        hint="Opsional"
      >
        <USelectMenu
          v-model="acaraId"
          :items="opsiAcara"
          value-key="value"
          :search-input="{ placeholder: 'Cari event…' }"
          :disabled="!bolehUbah"
          class="w-full"
        />
      </UFormField>

      <div>
        <p class="mb-1.5 text-xs font-semibold text-muted">
          Status
        </p>
        <AppSeg
          v-model="f.status"
          :options="STATUS_JADWAL.map(st => ({ value: st, label: st }))"
          size="sm"
        />
        <p class="mt-1.5 text-xs text-muted">
          Status ikut draf: baru tersimpan saat Anda menekan Simpan jadwal.
        </p>
      </div>

      <UFormField
        label="Catatan"
        hint="Opsional"
      >
        <UInput
          v-model="f.notes"
          maxlength="200"
          :disabled="!bolehUbah"
          class="w-full"
        />
      </UFormField>

      <p
        v-if="galat"
        class="text-sm font-semibold text-error"
        role="alert"
      >
        {{ galat }}
      </p>
    </div>

    <template #footer>
      <UButton
        v-if="bolehUbah"
        color="primary"
        @click="terapkan()"
      >
        Terapkan
      </UButton>
      <UButton
        color="neutral"
        variant="outline"
        @click="open = false"
      >
        Tutup
      </UButton>
      <UButton
        v-if="bolehUbah && target && target.draf === 'ubah'"
        color="neutral"
        variant="ghost"
        @click="emit('buang'); open = false"
      >
        Buang perubahan
      </UButton>
      <UButton
        v-if="bolehUbah && target && !target.baru"
        color="error"
        variant="outline"
        icon="i-lucide-trash-2"
        class="me-auto"
        @click="emit('hapus'); open = false"
      >
        {{ target.draf === 'baru' ? 'Buang baris' : 'Hapus' }}
      </UButton>
    </template>
  </ResponsiveSheet>
</template>
