<!-- Cashier › Pencocokan QRIS BRI. The panel is shared with Finance › Kas Kecil
     — see app/components/KompasBri.vue (old Office ran one shared engine). -->
<script setup lang="ts">
definePageMeta({ access: ['cashier'] })
</script>

<template>
  <KompasBri />
</template>
