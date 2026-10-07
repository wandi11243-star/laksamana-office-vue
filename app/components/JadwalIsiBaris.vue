<!--
  "Input Mingguan" on one row (deploy/jadwal/index.html isiBaris :4206-4300):
  a pointer walks the week — tap PAGI, Monday is PAGI and the pointer moves to
  the next EMPTY day; after the seventh day it saves by itself. Filled days load
  as they are, so a row missing two days does not make the head retype five.
  A day emptied here is deleted on save; days that never existed are not sent.
-->
<script setup lang="ts">
import type { PetaSel, SelJadwal, SettingJadwal } from '~/utils/jadwal'
import { HARI_SENIN, kelasTeksShift, kunciSel, shiftDef, shiftPilihan, tglSel, tujuhHari } from '~/utils/jadwal'
import { fTgl } from '~/utils/format'

type Isi = { t: string, m: string, s: string, n: string } | null

const props = defineProps<{
  set: SettingJadwal
  peta: PetaSel
  target: { uid: string, nama: string } | null
  senin: string
}>()
const emit = defineEmits<{ simpan: [rows: SelJadwal[], clear: { u: string, d: string }[], pesan: string] }>()
const open = defineModel<boolean>('open', { default: false })

const tgl = computed(() => tujuhHari(props.senin))
const isi = ref<Isi[]>([])
const i = ref(0)

const kosongBerikut = (dari: number) => {
  for (let n = 0; n < 7; n++) {
    const k = (dari + n) % 7
    if (!isi.value[k]) return k
  }
  return -1
}

watch(open, (v) => {
  if (!v || !props.target) return
  isi.value = tgl.value.map((d) => {
    const c = props.peta.get(kunciSel(props.target!.uid, d))
    return c ? { t: c.t, m: c.m || '', s: c.s || '', n: c.n || '' } : null
  })
  i.value = kosongBerikut(0)
})

const terisi = computed(() => isi.value.filter(Boolean).length)
const shifts = computed(() => shiftPilihan(props.set, '').map(k => ({ k, def: shiftDef(props.set, k) })))

function pilih(k: string) {
  if (i.value < 0) return
  const d = shiftDef(props.set, k)
  isi.value[i.value] = { t: k, m: d.libur ? '' : d.m, s: d.libur ? '' : d.s, n: '' }
  const lanjut = kosongBerikut(i.value + 1)
  i.value = lanjut
  if (lanjut < 0) simpan()
}

function simpan() {
  const x = props.target
  if (!x) return
  const rows: SelJadwal[] = []
  const clear: { u: string, d: string }[] = []
  tgl.value.forEach((d, k) => {
    const c = isi.value[k]
    if (c) rows.push({ u: x.uid, d, ...c })
    else if (props.peta.get(kunciSel(x.uid, d))) clear.push({ u: x.uid, d })
  })
  open.value = false
  if (!rows.length && !clear.length) return
  emit('simpan', rows, clear, `${x.nama}: ${rows.length} hari terisi${clear.length ? `, ${clear.length} dikosongkan` : ''}`)
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="`Isi satu baris — ${target?.nama ?? ''} · ${terisi}/7`"
  >
    <div class="space-y-3 text-sm">
      <div class="grid grid-cols-7 gap-1">
        <button
          v-for="(d, k) in tgl"
          :key="d"
          type="button"
          class="flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-field border px-0.5 py-1 text-[11px] focus-visible:outline-2 focus-visible:outline-primary"
          :class="k === i ? 'border-primary-500 ring-2 ring-primary-400' : 'border-default'"
          @click="i = k"
        >
          <b class="uppercase text-muted">{{ HARI_SENIN[k]!.slice(0, 3) }}</b>
          <span class="num">{{ tglSel(d).slice(0, 5) }}</span>
          <JadwalShiftPil
            v-if="isi[k]"
            :def="shiftDef(set, isi[k]!.t)"
            size="sm"
            class="max-w-full truncate"
          />
          <span
            v-else
            class="text-dimmed"
          >·</span>
        </button>
      </div>
      <p class="text-muted">
        <template v-if="i >= 0">
          <b>{{ fTgl(tgl[i]) }}</b> — pilih shift di bawah, lalu pointer pindah sendiri ke hari berikutnya.
        </template>
        <template v-else>
          <b>Tujuh hari sudah terisi.</b> Klik salah satu hari di atas kalau mau membetulkan, atau tekan Simpan.
        </template>
      </p>
      <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <button
          v-for="p in shifts"
          :key="p.k"
          type="button"
          class="flex min-h-11 flex-col items-center justify-center rounded-field px-1 py-1.5 text-xs font-bold focus-visible:outline-2 focus-visible:outline-primary"
          :class="kelasTeksShift(p.def.w)"
          :style="{ backgroundColor: p.def.w }"
          @click="pilih(p.k)"
        >
          {{ p.def.n }}
          <small class="font-medium opacity-90">{{ p.def.libur ? '' : `${p.def.m}–${p.def.s}` }}</small>
        </button>
      </div>
    </div>
    <template #footer>
      <UButton
        label="Simpan"
        :disabled="!terisi && !tgl.some(d => target && peta.get(kunciSel(target.uid, d)))"
        @click="simpan"
      />
      <UButton
        label="Kosongkan hari ini"
        color="neutral"
        variant="outline"
        :disabled="i < 0 || !isi[i]"
        @click="isi[i] = null"
      />
      <UButton
        label="Mundur"
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        :disabled="i === 0"
        @click="i = i < 0 ? 6 : i - 1"
      />
    </template>
  </ResponsiveSheet>
</template>
