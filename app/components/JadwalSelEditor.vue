<!--
  The cell editor (deploy/jadwal/index.html bukaEditor/gambarEditor :3469-3545).

  An empty cell opens with NO shift picked and Simpan stays off until one is
  chosen: the old editor once pre-filled a guess, and closing it with Simpan
  saved that guess as a real schedule nobody chose (:3475). Picking a shift
  resets the hours to that shift's defaults; clearing an hour field falls back
  to the default again. A note (max 20) replaces the shift name in the cell.
  Request-born shifts (IZIN/CUTI/LAIN) are only offered when already in the cell.
-->
<script setup lang="ts">
import type { SelJadwal, SettingJadwal } from '~/utils/jadwal'
import { HARI_SENIN, idxHari, kelasTeksShift, shiftDef, shiftPilihan } from '~/utils/jadwal'
import { saveCells } from '~/composables/useJadwal'
import { fTgl } from '~/utils/format'

const props = defineProps<{
  set: SettingJadwal
  /** The cell being edited; null when nothing is open. */
  target: { uid: string, nama: string, tgl: string, sel: SelJadwal | null } | null
}>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const t = ref('')
const m = ref('')
const s = ref('')
const n = ref('')
const sibuk = ref(false)

watch(() => props.target, (v) => {
  t.value = v?.sel?.t ?? ''
  m.value = v?.sel?.m ?? ''
  s.value = v?.sel?.s ?? ''
  n.value = v?.sel?.n ?? ''
}, { immediate: true })

const pilihan = computed(() => shiftPilihan(props.set, t.value).map(k => ({ k, def: shiftDef(props.set, k) })))
const def = computed(() => (t.value ? shiftDef(props.set, t.value) : null))

function pilih(k: string) {
  t.value = k
  const d = shiftDef(props.set, k)
  m.value = d.m
  s.value = d.s
}

async function tulis(cells: SelJadwal[], clear: { u: string, d: string }[], pesan: string) {
  sibuk.value = true
  try {
    await saveCells(cells, clear)
    open.value = false
    toast.add({ title: pesan, color: 'success' })
    emit('saved')
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

function simpan() {
  const x = props.target
  if (!x) return
  if (!t.value) {
    toast.add({ title: 'Pilih shift dulu', color: 'error' })
    return
  }
  const libur = !!shiftDef(props.set, t.value).libur
  tulis([{ u: x.uid, d: x.tgl, t: t.value, m: libur ? '' : m.value, s: libur ? '' : s.value, n: n.value.trim() }], [], 'Jadwal disimpan')
}

function kosongkan() {
  const x = props.target
  if (x) tulis([], [{ u: x.uid, d: x.tgl }], 'Sel dikosongkan')
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="target?.nama ?? ''"
    :description="target ? `${HARI_SENIN[idxHari(target.tgl)]} · ${fTgl(target.tgl)}` : ''"
  >
    <div class="space-y-4">
      <div>
        <p class="mb-2 text-sm font-semibold text-highlighted">
          Shift / status
        </p>
        <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
          <button
            v-for="p in pilihan"
            :key="p.k"
            type="button"
            class="flex min-h-11 flex-col items-center justify-center rounded-field border-2 px-1 py-1.5 text-xs font-bold focus-visible:outline-2 focus-visible:outline-primary"
            :class="[kelasTeksShift(p.def.w), t === p.k ? 'border-ink-900 ring-2 ring-primary-400' : 'border-transparent']"
            :style="{ backgroundColor: p.def.w }"
            :aria-pressed="t === p.k"
            @click="pilih(p.k)"
          >
            {{ p.def.n }}
            <small class="font-medium opacity-90">{{ p.def.libur ? '' : `${p.def.m}–${p.def.s}` }}</small>
          </button>
        </div>
        <p
          v-if="!t"
          class="mt-2 text-sm text-muted"
        >
          Belum ada shift yang dipilih — tekan salah satu di atas dulu.
        </p>
      </div>

      <template v-if="def && !def.libur">
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Jam masuk">
            <UInput
              v-model="m"
              type="time"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Jam pulang">
            <UInput
              v-model="s"
              type="time"
              class="w-full"
            />
          </UFormField>
        </div>
        <p class="-mt-2 text-sm text-muted">
          Kosongkan salah satunya untuk kembali ke jam bawaan shift ({{ def.m || '—' }}–{{ def.s || '—' }}).
        </p>
      </template>

      <UFormField
        label="Catatan di dalam sel"
        hint="Opsional"
        help="Kalau diisi, teks ini yang tampil di sel menggantikan nama shift — warnanya tetap ikut shift yang dipilih."
      >
        <UInput
          v-model="n"
          maxlength="20"
          placeholder="mis. HARAU!!!, TRAINING"
          class="w-full"
        />
      </UFormField>
    </div>

    <template #footer>
      <UButton
        label="Simpan"
        :disabled="!t"
        :loading="sibuk"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="ghost"
        @click="open = false"
      />
      <UButton
        v-if="target?.sel"
        label="Kosongkan"
        color="neutral"
        variant="outline"
        :disabled="sibuk"
        class="me-auto"
        @click="kosongkan"
      />
    </template>
  </ResponsiveSheet>
</template>
