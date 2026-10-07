<!--
  Attendance pill (deploy/dw/index.html pilHadir :1164). The empty value is
  "Belum dikonfirmasi" and stays paid (hadirDibayar), so it never looks like
  "Tidak hadir".
-->
<script setup lang="ts">
import type { AjuanDw } from '~/utils/dw'
import { HADIR_LBL, hadirNilai } from '~/utils/dw'
import { HADIR_DW_IKON, HADIR_DW_WARNA } from '~/utils/status-dw'

withDefaults(defineProps<{ a: Pick<AjuanDw, 'hadir'>, size?: 'sm' | 'md' }>(), { size: 'md' })
</script>

<template>
  <AppStatus
    :color="HADIR_DW_WARNA[hadirNilai(a)] ?? 'neutral'"
    :icon="HADIR_DW_IKON[hadirNilai(a)] ?? 'i-lucide-circle-help'"
    :size="size"
  >
    {{ hadirNilai(a) === '' ? 'Belum dikonfirmasi' : (HADIR_LBL[hadirNilai(a)] ?? hadirNilai(a)) }}
  </AppStatus>
</template>
