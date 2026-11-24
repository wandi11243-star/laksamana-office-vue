<!--
  The Cashier panel opens on its Daily Report, like the old Office: the screen
  menu is the sidebar (utils/modul-shell.ts). When a Cashier admin closed the
  Daily Report for this person (Kelola Akses), it opens on the first screen
  that is still open.
-->
<script setup lang="ts">
import { LAYAR_CASHIER } from '~/utils/layar/cashier'

definePageMeta({ access: ['cashier'] })

const me = useMe()
await muatAksesCashier()
const buka = LAYAR_CASHIER.find(l => !l.boleh || (me.value ? l.boleh(me.value) : true))

await navigateTo(buka?.to ?? '/cashier/report', { replace: true })
</script>

<template>
  <div />
</template>
