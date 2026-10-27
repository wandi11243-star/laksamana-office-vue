<!--
  The sidebar of the old Office (DESIGN.md › Shell): brand with the module's name
  in small ink capitals, the menu in labelled groups, and the user at the foot.
  Inside a module with its own chrome (utils/modul-shell.ts) the menu is that
  module's screens; elsewhere it is Beranda and the modules the user holds.
  Desktop only; on a phone AppNavBawah draws the same menu (useMenuNav).
  Labelled groups collapse; unlabeled top items stay visible. Open groups are
  remembered per user in localStorage (`lm-nav-grup:<username>`).
-->
<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { modul, shell } = useModulShell()
const menu = useMenuNav()
const me = useMe()
const route = useRoute()
const { grouped } = useModulNav()

const namaPengguna = computed(() => me.value?.username ?? 'anon')
const kunciSimpan = computed(() => `lm-nav-grup:${namaPengguna.value}`)

// Labels of the groups currently open. First use: everything open.
const terbuka = useState<string[]>('app-sidebar-grup-terbuka', () => [])
// Labels already seen, so newly appearing groups can start open without
// reopening groups the user collapsed on purpose.
const dikenal = new Set<string>()

const labelGrup = (grup: NavigationMenuItem[]): string | null =>
  grup[0]?.type === 'label' ? (grup[0]?.label ?? null) : null

// Menu groups in order: a label means collapsible, null means always visible.
const daftar = computed(() => menu.value.map(grup => ({
  label: labelGrup(grup),
  items: labelGrup(grup) ? grup.slice(1) : grup,
})))

const semuaLabel = computed(() => daftar.value
  .map(g => g.label)
  .filter((l): l is string => l != null))

const isTerbuka = (label: string) => terbuka.value.includes(label)

function bacaSimpan(): string[] | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const mentah = localStorage.getItem(kunciSimpan.value)
    if (mentah == null) return null
    const parsed: unknown = JSON.parse(mentah)
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : null
  }
  catch {
    return null
  }
}

function simpan() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(kunciSimpan.value, JSON.stringify(terbuka.value))
  }
  catch {
    // Private mode or full quota: the menu still works for this session.
  }
}

function alihkan(label: string) {
  terbuka.value = isTerbuka(label)
    ? terbuka.value.filter(l => l !== label)
    : [...terbuka.value, label]
  simpan()
}

// Expand the group of the module shown by the current route, if collapsed.
function perluasModulAktif() {
  const segmen = route.path.split('/').filter(Boolean)[0]
  if (!segmen) return
  const grup = grouped.value.find(g => g.items.some(m => m.key === segmen))
  if (grup && !isTerbuka(grup.group)) {
    terbuka.value = [...terbuka.value, grup.group]
    simpan()
  }
}

function muat() {
  const tersimpan = bacaSimpan()
  terbuka.value = tersimpan ?? [...semuaLabel.value]
  if (tersimpan) {
    const baru = semuaLabel.value.filter(l => !dikenal.has(l))
    if (baru.length) {
      terbuka.value = [...terbuka.value, ...baru]
      simpan()
    }
  }
  semuaLabel.value.forEach(l => dikenal.add(l))
  perluasModulAktif()
}

onMounted(muat)
watch(kunciSimpan, muat)
watch(semuaLabel, (baru) => {
  const tambahan = baru.filter(l => !dikenal.has(l))
  baru.forEach(l => dikenal.add(l))
  if (tambahan.length) {
    terbuka.value = [...terbuka.value, ...tambahan.filter(l => !isTerbuka(l))]
    simpan()
  }
})
watch(() => route.path, perluasModulAktif)
</script>

<template>
  <div class="flex h-full flex-col bg-default">
    <NuxtLink
      to="/"
      class="flex items-center gap-3 px-5 pb-3.5 pt-5"
    >
      <img
        src="/mark.png"
        alt=""
        class="size-9 shrink-0 object-contain"
      >
      <span class="leading-tight">
        <span class="block font-display text-base font-bold text-highlighted">Laksamana Muda</span>
        <span class="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-900">
          {{ shell?.subjudul ?? 'Office' }}
        </span>
      </span>
    </NuxtLink>

    <div class="flex-1 overflow-y-auto px-3">
      <template
        v-for="(grup, i) in daftar"
        :key="grup.label ?? `atas-${i}`"
      >
        <UNavigationMenu
          v-if="grup.label === null"
          :items="[grup.items]"
          orientation="vertical"
          :ui="{
            label: 'px-3 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-wider text-dimmed',
            link: 'text-[15px]',
            linkLeadingIcon: 'size-[18px]',
          }"
        />
        <div v-else>
          <button
            type="button"
            :aria-expanded="isTerbuka(grup.label)"
            :aria-label="grup.label"
            class="flex w-full items-center justify-between gap-2 px-3 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-wider text-dimmed"
            @click="alihkan(grup.label)"
          >
            <span>{{ grup.label }}</span>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-4 shrink-0 text-dimmed transition-transform duration-200"
              :class="{ 'rotate-180': isTerbuka(grup.label) }"
            />
          </button>
          <div v-show="isTerbuka(grup.label)">
            <UNavigationMenu
              :items="[grup.items]"
              orientation="vertical"
              :ui="{
                label: 'px-3 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-wider text-dimmed',
                link: 'text-[15px]',
                linkLeadingIcon: 'size-[18px]',
              }"
            />
          </div>
        </div>
      </template>
    </div>

    <NuxtLink
      v-if="modul && shell"
      to="/"
      class="mx-3 mb-2 flex items-center gap-2 rounded-field px-3 py-2 text-sm font-semibold text-muted hover:bg-muted"
    >
      <UIcon
        name="i-lucide-arrow-left"
        class="size-4"
      />
      Beranda Office
    </NuxtLink>

    <AppAkun class="border-t border-default p-3" />
  </div>
</template>
