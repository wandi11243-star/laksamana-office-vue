<!--
  The right end of the top bar inside a module: the gold "+" and the bell with
  its red dot (old Office appbar, deploy/reservasi/index.html:868-870). Keyed by
  module in the layout, so its counts are read once per module.
-->
<script setup lang="ts">
const { shell } = useModulShell()
const lencana = shell.value?.lencana?.()
const menyala = computed(() => (lencana?.value.lonceng ?? 0) > 0)
</script>

<template>
  <div class="flex items-center gap-2.5">
    <UButton
      v-if="shell?.tambah"
      :to="shell.tambah.to"
      icon="i-lucide-plus"
      size="lg"
      :aria-label="shell.tambah.label"
      :title="shell.tambah.label"
    />
    <UButton
      v-if="shell?.lonceng"
      :to="shell.lonceng.to"
      icon="i-lucide-bell"
      color="neutral"
      variant="outline"
      size="lg"
      class="relative"
      :aria-label="shell.lonceng.label + (menyala ? ' — ada tamu belum konfirmasi' : '')"
      :title="shell.lonceng.label"
    >
      <span
        v-if="menyala"
        class="absolute end-2 top-2 size-2 rounded-full bg-error"
        aria-hidden="true"
      />
    </UButton>
  </div>
</template>
