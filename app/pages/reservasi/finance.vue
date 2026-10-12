<!--
  Dana Masuk (DP) — thin page: AppPage + DanaMasukPanel. Permissions come from
  the in-module matrix (bagian B): `finance` to verify, `financeDelete` to
  erase a money record (System Admin alone), `master` for the direct receipt
  path. Cashier and Finance/Kas mount the same panel later (T-12).
-->
<script setup lang="ts">
import { bolehAksi, bolehBuka, roleReservasi } from '~/utils/layar/reservasi'

definePageMeta({ access: ['reservasi'] })

const me = useMe()
const role = computed(() => roleReservasi(me.value))
const route = useRoute()
/** A reservation detail links here with `?q=` (name/HP search). */
const cariAwal = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''))
</script>

<template>
  <AppPage
    title="Dana masuk (DP)"
    description="Cek uang DP yang benar-benar masuk."
  >
    <DanaMasukPanel
      v-if="bolehBuka('finance', role)"
      :boleh-verifikasi="bolehAksi('finance', role)"
      :boleh-hapus="bolehAksi('financeDelete', role)"
      :boleh-hapus-demo="bolehAksi('financeDelete', role)"
      :boleh-kwitansi-langsung="bolehAksi('master', role)"
      :cari-awal="cariAwal"
    />
    <p
      v-else
      class="text-muted"
    >
      Tidak ada akses.
    </p>
  </AppPage>
</template>
