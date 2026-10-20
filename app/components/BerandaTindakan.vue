<!--
  Beranda: "Perlu tindakan". The red menu badges of the team's modules,
  gathered in one list from ONE endpoint (`GET /me/badges`, api#311), so
  the rules stay the module's own: a row here is exactly a badge the viewer
  would see in that module's sidebar. Roster carries two shells (jadwal +
  dw), as in the module menu. Full states load only on the module's own
  pages, never here.
-->
<script setup lang="ts">
import type { ModulShell } from '~/utils/modul-shell'

const props = defineProps<{ modul: string[] }>()

const me = useMe()
const { data: badges, refresh } = useBadges()
// One tiny answer per Beranda visit: counts must not go stale within a session.
onMounted(() => {
  void refresh()
})

// Roster's two shells each need their own key; other shells open on any key of their module.
const boleh = (k: string) => ['jadwal', 'dw'].includes(k)
  ? hasAccess(me.value, [k])
  : hasAccess(me.value, MODUL.find(m => m.key === k)?.access ?? [])

interface Sumber { modul: string, shell: ModulShell, hitung: Record<string, number> }

// Read at setup AND on every badges arrival: badge composables used to
// register their own async data; now the counts come from the one endpoint.
const sumber = computed<Sumber[]>(() => props.modul
  .flatMap(k => k === 'jadwal' ? ['jadwal', 'dw'] : [k])
  .filter(boleh)
  .flatMap((k) => {
    const shell = MODUL_SHELL[k]
    if (!shell?.lencana) return []
    return [{ modul: k, shell, hitung: badges.value[k] ?? {} }]
  }))

const baris = computed(() => sumber.value.flatMap(({ modul, shell, hitung }) => {
  const ada = Object.entries(hitung).filter(([, n]) => n > 0)
  const layar = shell.layar.filter(l => !l.boleh || (me.value && l.boleh(me.value)))
  const perLayar = ada
    .filter(([k]) => k !== 'lonceng')
    .flatMap(([k, n]) => {
      const l = layar.find(x => x.key === k)
      return l ? [{ key: `${modul}:${k}`, label: l.label, icon: l.icon, to: l.to, n }] : []
    })
  // The bell alone (Marketing notifications) is a row of its own.
  if (perLayar.length) return perLayar.map(r => ({ ...r, subjudul: shell.subjudul }))
  const bel = ada.find(([k]) => k === 'lonceng')
  return bel && shell.lonceng
    ? [{ key: `${modul}:lonceng`, label: shell.lonceng.label, icon: 'i-lucide-bell', to: shell.lonceng.to, n: bel[1], subjudul: shell.subjudul }]
    : []
}))
</script>

<template>
  <AppList
    v-if="baris.length"
    title="Perlu tindakan"
  >
    <AppListRow
      v-for="r in baris"
      :key="r.key"
      :title="r.label"
      :description="r.subjudul"
      :icon="r.icon"
      :to="r.to"
    >
      <template #trailing>
        <UBadge
          :label="String(r.n)"
          color="error"
          variant="solid"
        />
      </template>
    </AppListRow>
  </AppList>
</template>
