<!-- Cashier › Compliment. The panel is shared with Finance › Omset — see
     app/components/KompasCompliment.vue (extracted so the two cannot drift). -->
<script setup lang="ts">
definePageMeta({ access: ['cashier'] })
</script>

<template>
  <KompasCompliment />
</template>
