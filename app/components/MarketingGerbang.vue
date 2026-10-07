<!--
  The old go() gate (deploy/marketing/index.html:4959-4994) for one screen:
  a person with no screen at all sees "Akses belum aktif"; a person without
  this screen is told so and pointed back — the menu already hides it, this
  covers bookmarks and typed addresses. Shows nothing until the state is in,
  so the role defaults never flash a page the matrix closes.
-->
<script setup lang="ts">
import { punyaLayarMkt } from '~/utils/marketing'

const props = defineProps<{ layar: string }>()

const { data: st, status, error } = useStateMkt()
const { saya, canView } = useAksesMkt()
const siap = computed(() => status.value === 'success' || !!error.value)
const boleh = computed(() => canView(props.layar))
const adaLayar = computed(() => punyaLayarMkt(saya.value?.user, st.value.roleAcc))
</script>

<template>
  <slot v-if="siap && (boleh || error)" />
  <AppPanel v-else-if="siap">
    <div class="flex flex-col items-center gap-2 py-8 text-center">
      <UIcon
        name="i-lucide-lock"
        class="size-8 text-muted"
      />
      <p class="text-lg font-semibold text-highlighted">
        {{ adaLayar ? 'Akses ditolak' : 'Akses belum aktif' }}
      </p>
      <p
        v-if="adaLayar"
        class="max-w-md text-sm text-muted"
      >
        {{ saya?.user.name }} tidak punya akses ke halaman ini.
      </p>
      <p
        v-else
        class="max-w-md text-sm text-muted"
      >
        Akun <b>{{ saya?.user.name }}</b> belum punya satu halaman pun di modul ini — rolenya masih
        <b>Belum ada akses</b>, atau seluruh menunya disetel Tak Terlihat di matriks Hak Akses.
        Minta admin modul mengaturnya di <b>Pegawai &amp; Akses</b>.
      </p>
      <UButton
        v-if="adaLayar"
        label="Ke Dashboard"
        to="/marketing/dashboard"
        color="neutral"
        variant="outline"
        class="mt-2"
      />
    </div>
  </AppPanel>
</template>
