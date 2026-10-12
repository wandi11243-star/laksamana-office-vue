<!--
  The old bisaLihat() gate (deploy/event/index.html:4755-4756,2129-2130) for one
  screen: a page set to Tak Terlihat leaves the menu AND refuses a typed
  address. The menu already hides it (layar/event.ts); this covers bookmarks
  and typed addresses. Same shape as KontenGerbang.
-->
<script setup lang="ts">
import { bolehBukaEvent, peranEvent } from '~/utils/layar/event'

const props = defineProps<{
  /** Screen key of app/utils/layar/event.ts (talents, ticketing, …). */
  lihat: string
}>()

const me = useMe()
const boleh = computed(() => bolehBukaEvent(props.lihat, peranEvent(me.value)))
</script>

<template>
  <slot v-if="boleh" />
  <AppPanel v-else>
    <div class="flex flex-col items-center gap-2 py-8 text-center">
      <UIcon
        name="i-lucide-lock"
        class="size-8 text-muted"
      />
      <p class="text-lg font-semibold text-highlighted">
        Akses ditolak
      </p>
      <p class="max-w-md text-sm text-muted">
        {{ me?.name }} tidak punya akses ke halaman ini.
      </p>
      <UButton
        label="Ke Dashboard"
        to="/event/dashboard"
        color="neutral"
        variant="outline"
        class="mt-2"
      />
    </div>
  </AppPanel>
</template>
