<!--
  The phone menu (DESIGN.md › Shell): a bar fixed to the bottom, in place of the
  desktop sidebar. Each headed group of the menu is one icon that opens a sheet
  of its screens; a screen outside any group opens directly. "Lainnya" holds the
  groups that do not fit, Beranda Office and the user. See utils/nav-bawah.ts.
  Keyed by module in the layout, so its counts are read once per module.
-->
<script setup lang="ts">
const NuxtLink = resolveComponent('NuxtLink')
const route = useRoute()
const { modul, shell } = useModulShell()

// The open sheet, by slot index: slots are rebuilt whenever a count changes.
const terbuka = ref<number | null>(null)
const tutup = () => {
  terbuka.value = null
}
const menu = useMenuNav(tutup)
watch(() => route.fullPath, tutup)

const susun = computed(() => slotNavBawah(menu.value))
const slots = computed<SlotNav[]>(() => {
  const sisa = susun.value.sisa
  // With nothing left over, the last slot only holds Beranda Office and the user.
  const akhir = sisa.length
    ? { label: 'Lainnya', icon: 'i-lucide-ellipsis', grup: sisa, lencana: jumlahLencana(sisa.flat()) }
    : { label: 'Akun', icon: 'i-lucide-circle-user-round', lencana: 0 }
  return [...susun.value.slot, akhir]
})
const kolom = computed(() => ['grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5'][slots.value.length - 1])
const buka = computed(() => (terbuka.value === null ? null : slots.value[terbuka.value] ?? null))
const akhir = computed(() => terbuka.value === slots.value.length - 1)

const aktif = (s: SlotNav) => s.to
  ? cocokRute(route.path, s.to)
  : (s.grup ?? []).flat().some(i => typeof i.to === 'string' && cocokRute(route.path, i.to))
const nyala = (s: SlotNav, i: number) => aktif(s) || terbuka.value === i

const sheet = computed({
  get: () => terbuka.value !== null,
  set: (v) => {
    if (!v) tutup()
  },
})
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-20 border-t border-default bg-default/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"
    aria-label="Menu"
  >
    <ul
      class="grid"
      :class="kolom"
    >
      <li
        v-for="(s, i) in slots"
        :key="i"
      >
        <component
          :is="s.to ? NuxtLink : 'button'"
          :to="s.to"
          :type="s.to ? undefined : 'button'"
          :aria-current="s.to && aktif(s) ? 'page' : undefined"
          :aria-haspopup="s.to ? undefined : 'dialog'"
          :aria-expanded="s.to ? undefined : terbuka === i"
          class="flex w-full flex-col items-center gap-0.5 px-1 pb-2 pt-1.5"
          @click="s.to ? tutup() : (terbuka = i)"
        >
          <span
            class="relative flex h-7 w-12 items-center justify-center rounded-full transition-colors"
            :class="nyala(s, i) ? 'bg-yellow-light text-yellow-dark' : 'text-muted'"
          >
            <UIcon
              :name="s.icon"
              class="size-5"
            />
            <span
              v-if="s.lencana"
              class="absolute -top-1 end-0 min-w-4 rounded-full bg-error px-1 text-center text-[10px] font-bold leading-4 text-white"
            >
              {{ s.lencana }}
            </span>
          </span>
          <span
            class="max-w-full truncate text-[11px] font-semibold"
            :class="nyala(s, i) ? 'text-yellow-dark' : 'text-muted'"
          >
            {{ s.label }}
          </span>
        </component>
      </li>
    </ul>

    <UDrawer
      v-model:open="sheet"
      :title="buka?.label ?? 'Menu'"
      :ui="{ body: 'px-2' }"
    >
      <template #body>
        <UNavigationMenu
          v-if="buka?.grup?.length"
          :items="buka.grup"
          orientation="vertical"
          :ui="{
            label: 'px-3 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-wider text-dimmed',
            link: 'py-2.5 text-[14px]',
            linkLeadingIcon: 'size-[18px]',
          }"
        />
        <template v-if="akhir">
          <NuxtLink
            v-if="modul && shell"
            to="/"
            class="mt-2 flex items-center gap-2 rounded-field px-3 py-2.5 text-[14px] font-semibold text-muted hover:bg-muted"
          >
            <UIcon
              name="i-lucide-arrow-left"
              class="size-[18px]"
            />
            Beranda Office
          </NuxtLink>
          <AppAkun class="mt-2 border-t border-default px-2 pt-3" />
        </template>
      </template>
    </UDrawer>
  </nav>
</template>
