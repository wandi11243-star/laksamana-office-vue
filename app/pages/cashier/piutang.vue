<!-- Cashier › Piutang / Bon. The panel is shared with Finance › Omset — see
     app/components/KompasPiutang.vue (extracted so the two cannot drift). -->
<script setup lang="ts">
definePageMeta({ access: ['cashier'] })
</script>

<template>
  <KompasPiutang />
</template>
