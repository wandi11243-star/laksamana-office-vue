<!--
  The old pager row (deploy/finance/kas .pager): "Menampilkan 1–25 dari 304 baris",
  numbered pages, and "Per halaman 25 · 50 · 100". The parent slices its own rows:

    const hal = ref(1), per = ref(25)
    const rows = computed(() => list.value.slice((hal.value - 1) * per.value, hal.value * per.value))
    <AppPager v-model:page="hal" v-model:per="per" :total="list.length" />

  Hidden when everything fits on one page of the smallest size.
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{ total: number, sizes?: number[], satuan?: string }>(), { sizes: () => [25, 50, 100], satuan: 'baris' })
const page = defineModel<number>('page', { default: 1 })
const per = defineModel<number>('per', { default: 25 })

const halMaks = computed(() => Math.max(1, Math.ceil(props.total / per.value)))
watch([halMaks, per], () => {
  if (page.value > halMaks.value) page.value = halMaks.value
})
const mulai = computed(() => (props.total ? (page.value - 1) * per.value + 1 : 0))
const akhir = computed(() => Math.min(page.value * per.value, props.total))
</script>

<template>
  <div
    v-if="total > (sizes[0] ?? 25)"
    class="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted"
  >
    <span>Menampilkan <b class="text-highlighted num">{{ mulai }}–{{ akhir }}</b> dari <b class="text-highlighted num">{{ total }}</b> {{ satuan }}</span>
    <div class="flex flex-wrap items-center gap-3">
      <UPagination
        v-if="halMaks > 1"
        v-model:page="page"
        :total="total"
        :items-per-page="per"
        size="xs"
        :sibling-count="1"
      />
      <div class="flex items-center gap-1">
        <span class="me-1">Per halaman</span>
        <UButton
          v-for="n in sizes"
          :key="n"
          :label="String(n)"
          size="xs"
          :color="per === n ? 'primary' : 'neutral'"
          :variant="per === n ? 'solid' : 'outline'"
          @click="per = n; page = 1"
        />
      </div>
    </div>
  </div>
</template>
