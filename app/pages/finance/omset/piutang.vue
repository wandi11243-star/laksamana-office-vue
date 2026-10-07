<!-- Finance › Omset › Piutang / Bon — the panel is SHARED with Cashier (both
     write one `piutang` object; doc F.19). Component: KompasPiutang.vue. -->
<script setup lang="ts">
definePageMeta({ access: ['kompas'] })
</script>

<template>
  <KompasPiutang kunci="omset-piutang" />
</template>
