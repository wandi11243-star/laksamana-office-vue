<!--
  Status pill of an ajuan/permintaan (deploy/dw/index.html pilStatus :2561):
  colour + icon + word from utils/status-dw.ts, one source for every screen.
-->
<script setup lang="ts">
import { STATUS_AJU_DW } from '~/utils/dw'
import { STATUS_DW_IKON, STATUS_DW_WARNA } from '~/utils/status-dw'

withDefaults(defineProps<{ status: string, size?: 'sm' | 'md' }>(), { size: 'md' })
</script>

<template>
  <AppStatus
    :color="STATUS_DW_WARNA[status] ?? 'neutral'"
    :icon="STATUS_DW_IKON[status] ?? 'i-lucide-circle'"
    :size="size"
  >
    {{ STATUS_AJU_DW[status] ?? status }}
  </AppStatus>
</template>
