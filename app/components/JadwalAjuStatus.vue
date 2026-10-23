<!--
  A request's status with its trail (deploy/jadwal/index.html barisAju
  :4636-4660): the pill names who it waits for; under it, the head who
  forwarded it, who decided, and the rejection note — the note used to be
  stored but never shown, and the crew asked on WhatsApp instead.
-->
<script setup lang="ts">
import type { PengajuanJadwal } from '~/composables/useJadwal'
import { LABEL_STATUS_AJU } from '~/utils/jadwal'
import { STATUS_AJU_IKON, STATUS_AJU_WARNA } from '~/utils/status-jadwal'

defineProps<{ a: PengajuanJadwal }>()
</script>

<template>
  <div class="space-y-0.5">
    <AppStatus
      size="sm"
      :color="STATUS_AJU_WARNA[a.status]"
      :icon="STATUS_AJU_IKON[a.status]"
    >
      {{ LABEL_STATUS_AJU[a.status] ?? a.status }}
    </AppStatus>
    <template v-if="a.status !== 'MENUNGGU'">
      <p
        v-if="a.headOleh"
        class="flex items-center gap-1 text-[12px] text-success"
      >
        <UIcon
          name="i-lucide-check"
          class="size-3.5 shrink-0"
        />
        Disetujui head: {{ a.headOleh }}
      </p>
      <p
        v-if="a.status !== 'MENUNGGU_HRD'"
        class="text-[12px] text-muted"
      >
        {{ a.status === 'DISETUJUI' ? 'HRD: ' : '' }}{{ a.putusOleh || '—' }}
      </p>
      <p
        v-if="a.putusNota"
        class="text-[12px] text-error"
      >
        "{{ a.putusNota }}"
      </p>
    </template>
  </div>
</template>
