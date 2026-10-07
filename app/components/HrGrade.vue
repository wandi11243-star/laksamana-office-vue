<!--
  Grade pill (`gradeTag`, deploy/hr/index.html:1406). Below the completeness
  threshold it says "data kurang" instead of a letter: a score made mostly of
  default values must not read as a judgement (F.5).
-->
<script setup lang="ts">
import type { HrState } from '~/utils/hr'
import { gradeInfo } from '~/utils/people-score'

const props = defineProps<{ s: HrState, score: number, completeness?: number }>()
const info = computed(() => gradeInfo(props.s, props.score, props.completeness))
</script>

<template>
  <AppStatus
    :color="info.tone"
    :icon="info.kurang ? 'i-lucide-circle-help' : 'i-lucide-award'"
    size="sm"
  >
    {{ info.kurang ? 'data kurang' : info.grade }}
  </AppStatus>
</template>
