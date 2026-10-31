<!--
  The brand bar of the old Panel (brandBar, deploy/konten/index.html): "Semua
  Brand" + one pill per brand. One choice shared by every screen that shows it
  (useBrandKonten), like the old global `brandFilter`.
-->
<script setup lang="ts">
import type { BrandKonten } from '~/utils/konten'

const props = defineProps<{ brands: BrandKonten[] }>()
const brand = useBrandKonten()
const opsi = computed(() => [{ value: 'all', label: 'Semua Brand' }, ...props.brands.map(b => ({ value: b.id, label: b.name }))])
</script>

<template>
  <AppChips
    v-if="brands.length"
    v-model="brand"
    :options="opsi"
    class="mb-5"
  />
</template>
