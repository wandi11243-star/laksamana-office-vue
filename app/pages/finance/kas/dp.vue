<!--
  Finance › Kas Kecil › Dana Masuk (DP). The old page was an <iframe> of the
  Reservasi module with `effRole='cashier'` (`deploy/finance/kas/index.html:6429-6454`);
  here the SAME panel is mounted (T-12, U5). Holders of `finance` verify and
  reject exactly like cashiers do — never delete, never the manager's direct
  receipt (the G-14 door has no DELETE). The page matrix can hide it entirely
  (`dp`: viewer NONE) — its content follows the Reservasi module's own rights.
-->
<script setup lang="ts">
definePageMeta({ access: ['finance'] })

const izin = useKasIzin()
</script>

<template>
  <AppPage
    title="Dana masuk (DP)"
    description="DP reservasi yang sudah masuk — halaman milik modul Reservasi, verifikasinya tersimpan di sana."
  >
    <UAlert
      v-if="!izin.lihat('dp')"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak dibuka untuk peranmu."
      description="Isinya milik modul Reservasi — yang boleh membuka bisa memverifikasi."
    />
    <DanaMasukPanel
      v-else
      boleh-verifikasi
    />
  </AppPage>
</template>
