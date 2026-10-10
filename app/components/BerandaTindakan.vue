<!--
  Beranda: "Perlu tindakan". The red menu badges (MODUL_SHELL[].lencana) of the
  team's modules, gathered in one list, so the rules stay the module's own: a
  row here is exactly a badge the viewer would see in that module's sidebar.
  Roster carries two shells (jadwal + dw), as in the module menu.
-->
<script setup lang="ts">
import type { ComputedRef } from 'vue'
import type { ModulShell } from '~/utils/modul-shell'

const props = defineProps<{ modul: string[] }>()

const me = useMe()

interface Sumber { modul: string, shell: ModulShell, lencana: ComputedRef<Record<string, number>> }

// Roster's two shells each need their own key; other shells open on any key of their module.
const boleh = (k: string) => ['jadwal', 'dw'].includes(k)
  ? hasAccess(me.value, [k])
  : hasAccess(me.value, MODUL.find(m => m.key === k)?.access ?? [])

// Read once at setup: the badge composables register their own async data.
const sumber: Sumber[] = props.modul
  .flatMap(k => k === 'jadwal' ? ['jadwal', 'dw'] : [k])
  .filter(boleh)
  .flatMap((k) => {
    const shell = MODUL_SHELL[k]
    if (!shell?.lencana) return []
    shell.siapkan?.()
    return [{ modul: k, shell, lencana: shell.lencana() }]
  })

const baris = computed(() => sumber.flatMap(({ modul, shell, lencana }) => {
  const hitung = Object.entries(lencana.value).filter(([, n]) => n > 0)
  const layar = shell.layar.filter(l => !l.boleh || (me.value && l.boleh(me.value)))
  const perLayar = hitung
    .filter(([k]) => k !== 'lonceng')
    .flatMap(([k, n]) => {
      const l = layar.find(x => x.key === k)
      return l ? [{ key: `${modul}:${k}`, label: l.label, icon: l.icon, to: l.to, n }] : []
    })
  // The bell alone (Marketing notifications) is a row of its own.
  if (perLayar.length) return perLayar.map(r => ({ ...r, subjudul: shell.subjudul }))
  const bel = hitung.find(([k]) => k === 'lonceng')
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
