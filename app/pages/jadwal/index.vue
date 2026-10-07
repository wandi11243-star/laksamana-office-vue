<!--
  Roster — the old panel picker (deploy/roster/index.html). The launcher card
  `jadwal` opens for `jadwal` OR `dw`, two backends that are deliberately not
  merged into one key.

  Only `jadwal` (almost everyone): straight to the Jadwal Shift dashboard, no
  picker, like the old `location.replace('../jadwal/')` (:110-149).
  With `dw`: the two cards. Only `dw` (almost always a mis-set grant): the
  picker still shows and the Jadwal Shift card is locked, naming the missing
  tick (:257-267).

  `/dw` exists, so the Daily Worker card is live; the `dwSiap` check below keeps
  the old "Segera" behaviour for any future move of the pages.
-->
<script setup lang="ts">
definePageMeta({ access: ['jadwal', 'dw'] })

const me = useMe()
const router = useRouter()
const punyaJadwal = computed(() => hasAccess(me.value, ['jadwal']))
const punyaDw = computed(() => hasAccess(me.value, ['dw']))

if (punyaJadwal.value && !punyaDw.value) await navigateTo('/jadwal/dashboard', { replace: true })

const descJadwal = computed(() => punyaJadwal.value
  ? 'Lembar shift kru tetap per divisi'
  : 'Belum diberi akses — minta admin mencentang "Roster · Jadwal Shift" di Kelola Akses Office')
/** The card unlocks itself the moment the `/dw` page exists (useModulNav does the same). */
const dwSiap = computed(() => router.getRoutes().some(r => r.path === '/dw'))
</script>

<template>
  <AppPage
    title="Roster kru & daily worker"
    description="Satu lembar untuk semua yang masuk hari itu."
  >
    <AppList>
      <AppListRow
        title="Jadwal Shift"
        :description="descJadwal"
        icon="i-lucide-calendar-days"
        :to="punyaJadwal ? '/jadwal/dashboard' : undefined"
        :dim="!punyaJadwal"
      >
        <template
          v-if="!punyaJadwal"
          #trailing
        >
          <UIcon
            name="i-lucide-lock"
            class="size-4 text-dimmed"
          />
        </template>
      </AppListRow>
      <AppListRow
        v-if="punyaDw"
        title="Daily Worker"
        description="Pekerja harian & part time"
        icon="i-lucide-user-plus"
        :to="dwSiap ? '/dw' : undefined"
        :dim="!dwSiap"
      >
        <template
          v-if="!dwSiap"
          #trailing
        >
          <span class="text-dimmed">Segera</span>
        </template>
      </AppListRow>
    </AppList>
    <ULink
      to="/"
      class="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-highlighted"
    >
      <UIcon
        name="i-lucide-chevron-left"
        class="size-4"
      />Kembali ke Office
    </ULink>
  </AppPage>
</template>
