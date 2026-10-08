<!--
  Marketing › official-invoice slot (slotInvIsi, :13602): per event & kind —
  "waiting for money" note, checking, retry, issued PDF button + number,
  waiting-for-Finance chip, rejected chip + re-request, or the request button.
-->
<script setup lang="ts">
import type { EventMkt } from '~/utils/marketing'
import type { StatusInvMkt } from '~/utils/marketing-keuangan'
import { resIdInvMkt } from '~/utils/marketing-keuangan'

const props = defineProps<{
  ev: EventMkt
  jenis: 'INV_DP' | 'INV_LUNAS'
  label: string
  siap: boolean
  menungguKet: string
  peta: Record<string, StatusInvMkt>
  memuat: boolean
  galat: string
  bisaMinta: boolean
}>()

const emit = defineEmits<{ minta: [], pdf: [] }>()

const rid = computed(() => resIdInvMkt(props.ev.id, props.jenis === 'INV_LUNAS' ? 'lunas' : 'dp'))
const inv = computed(() => props.peta[rid.value])
</script>

<template>
  <div class="text-sm">
    <p
      v-if="!siap"
      class="text-muted"
    >
      {{ label }}: {{ menungguKet }}
    </p>
    <p
      v-else-if="memuat && inv === undefined"
      class="text-muted"
    >
      {{ label }}: memeriksa ke Finance…
    </p>
    <UButton
      v-else-if="inv === undefined"
      color="neutral"
      variant="outline"
      size="sm"
      :label="`${label}: status ${galat ? 'gagal dibaca — coba lagi' : '…'}`"
      :title="galat || 'Status invoice belum terbaca dari modul Finance'"
      @click="emit('minta')"
    />
    <template v-else-if="inv && inv.status === 'DIBUAT'">
      <UButton
        icon="i-lucide-printer"
        size="sm"
        :label="`${label} PDF`"
        :title="`Invoice resmi ${inv.no ?? ''} — bertanda tangan & cap perusahaan`"
        @click="emit('pdf')"
      />
      <p class="num mt-1 text-xs text-muted">
        {{ inv.no ?? '' }}
      </p>
    </template>
    <AppStatus
      v-else-if="inv && inv.status === 'MENUNGGU'"
      color="warning"
      icon="i-lucide-hourglass"
      size="sm"
    >
      {{ label }} menunggu Finance
    </AppStatus>
    <template v-else-if="inv && inv.status === 'DITOLAK'">
      <AppStatus
        color="error"
        icon="i-lucide-x"
        size="sm"
        :title="inv.catatan ?? ''"
      >
        {{ label }} ditolak
      </AppStatus>
      <div class="mt-1">
        <UButton
          v-if="bisaMinta"
          color="neutral"
          variant="outline"
          size="sm"
          label="Request ulang"
          :title="`Alasan: ${inv.catatan || '-'}`"
          @click="emit('minta')"
        />
        <p
          v-else
          class="text-xs text-muted"
        >
          {{ inv.catatan ?? '' }}
        </p>
      </div>
    </template>
    <UButton
      v-else-if="bisaMinta"
      color="neutral"
      variant="outline"
      size="sm"
      :label="`Minta invoice ${label}`"
      @click="emit('minta')"
    />
    <p
      v-else
      class="text-muted"
    >
      {{ label }}: belum diminta
    </p>
  </div>
</template>
