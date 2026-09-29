<!--
  The menu of a module: its screens in AppList, grouped by `grup`. A screen
  whose page file is not built yet shows dimmed as "Segera" and cannot be
  clicked (the same rule the launcher uses, see useModulNav). Screens the
  in-module matrix hides for this person are dropped by `boleh`.
-->
<script setup lang="ts">
const props = defineProps<{
  layar: Layar[]
}>()

const me = useMe()
const router = useRouter()

const boleh = (l: Layar) => !l.boleh || (!!me.value && l.boleh(me.value))
const grups = computed(() => groupLayar(props.layar.filter(boleh)))
const ada = (to: string) => router.getRoutes().some(r => r.path === to)
</script>

<template>
  <div>
    <section
      v-for="g in grups"
      :key="g.grup"
      class="mb-7"
    >
      <h2
        v-if="g.grup"
        class="px-1 pb-2 text-sm font-semibold text-muted"
      >
        {{ g.grup }}
      </h2>
      <AppList>
        <AppListRow
          v-for="l in g.items"
          :key="l.key"
          :title="l.label"
          :description="l.desc"
          :icon="l.icon"
          :to="ada(l.to) ? l.to : undefined"
          :dim="!ada(l.to)"
        >
          <template
            v-if="!ada(l.to)"
            #trailing
          >
            <span class="text-dimmed">Segera</span>
          </template>
        </AppListRow>
      </AppList>
    </section>
  </div>
</template>
