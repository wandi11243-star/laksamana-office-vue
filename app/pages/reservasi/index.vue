<!--
  Reservasi panel home. The screens live in app/utils/layar/reservasi.ts, together
  with the in-module role matrix (six roles of the panel's own, not the Office
  module keys). `hariH` and the ghost `review` are not screens: review belongs to
  Service Excellent (T-21).
-->
<script setup lang="ts">
definePageMeta({ access: ['reservasi'] })

// master.users + master.perms decide which screens this person may open, so they
// are loaded before the menu is drawn.
muatPeranReservasi()
</script>

<template>
  <AppPage
    title="Reservasi"
    description="Meja, tamu, denah, dan DP"
  >
    <ModulMenu :layar="LAYAR_RESERVASI" />
  </AppPage>
</template>
