<!--
  The confirmation every bulk write goes through (deploy/jadwal/index.html
  konfirmasi + htmlTimpa :3586-3612): it names WHICH filled cells will be
  overwritten — name, day, from what to what — not just "cells will be
  overwritten". More than 40 are summarised as "+ N sel lagi". Cells that came
  from an approved request are flagged: overwriting them silently breaks a
  promise to that person. An optional second action ("Lewati yang terisi")
  writes only the empty cells.
-->
<script setup lang="ts">
import type { SettingJadwal, Timpa } from '~/utils/jadwal'
import { HARI_SENIN, idxHari, labelSel, shiftDef, tglSel } from '~/utils/jadwal'

const props = defineProps<{
  set: SettingJadwal
  title: string
  bentrok: Timpa[]
  /** How many of the overwritten cells came from an approved request. */
  dariAju?: number
  ya: string
  alt?: string
  sibuk?: boolean
}>()
const emit = defineEmits<{ ya: [], alt: [] }>()
const open = defineModel<boolean>('open', { default: false })

const BATAS = 40
const tampil = computed(() => props.bentrok.slice(0, BATAS))
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="title"
  >
    <div class="space-y-3 text-sm">
      <slot />
      <p
        v-if="dariAju"
        class="rounded-field bg-warning/12 px-3 py-2"
      >
        <b>{{ dariAju }} di antaranya menimpa hasil pengajuan yang sudah disetujui.</b>
        <template v-if="alt">
          Pakai "{{ alt }}" kalau tidak bermaksud membatalkannya.
        </template>
      </p>
      <div
        v-if="bentrok.length"
        class="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-default p-2"
      >
        <div
          v-for="(x, i) in tampil"
          :key="i"
          class="flex flex-wrap items-center gap-1.5"
        >
          <b class="min-w-0 flex-1 truncate text-highlighted">{{ x.nama }}</b>
          <span class="text-muted num">{{ HARI_SENIN[idxHari(x.tgl)]!.slice(0, 3) }} {{ tglSel(x.tgl) }}</span>
          <JadwalShiftPil
            :def="shiftDef(set, x.lama.t)"
            :label="labelSel(set, x.lama)"
            size="sm"
          />
          <UIcon
            name="i-lucide-arrow-right"
            class="size-3.5 text-muted"
          />
          <JadwalShiftPil
            :def="shiftDef(set, x.baru.t)"
            :label="labelSel(set, x.baru)"
            size="sm"
          />
        </div>
        <p
          v-if="bentrok.length > BATAS"
          class="font-semibold"
        >
          + {{ bentrok.length - BATAS }} sel lagi
        </p>
      </div>
    </div>
    <template #footer>
      <UButton
        :label="ya"
        :color="bentrok.length ? 'error' : 'primary'"
        :loading="sibuk"
        @click="emit('ya')"
      />
      <UButton
        v-if="alt"
        :label="alt"
        color="neutral"
        variant="outline"
        :disabled="sibuk"
        @click="emit('alt')"
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
