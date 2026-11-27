<!--
  The sidebar of the old Office (DESIGN.md › Shell): brand with the module's name
  in small ink capitals, the menu in labelled groups, and the user at the foot.
  Inside a module with its own chrome (utils/modul-shell.ts) the menu is that
  module's screens; elsewhere it is Beranda and the modules the user holds.
  Desktop only; on a phone AppNavBawah draws the same menu (useMenuNav).
  Labelled groups collapse; unlabeled top items stay visible. Open groups are
  remembered per user in localStorage (`lm-nav-grup:<username>`). With `mini`
  the sidebar shrinks to an icon rail (tooltips carry the names).
-->
<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

withDefaults(defineProps<{ mini?: boolean }>(), { mini: false })

const { modul, shell } = useModulShell()
/** investor.laksamanamuda.id: no way back to the Office (utils/domain.ts). */
const domainInvestor = diDomainInvestor()
const { menu, siap } = useMenuNav()
const me = useMe()
const route = useRoute()
const { grouped } = useModulNav()

const namaPengguna = computed(() => me.value?.username ?? 'anon')
const kunciSimpan = computed(() => `lm-nav-grup:${namaPengguna.value}`)

// Labels of the groups the user collapsed. Everything else — including groups
// that appear later (a newly granted module) — starts open, so new access
// is always discovered. Stored per user; the menu filling in after login can
// never reopen a remembered collapse because opens are never written back.
const tutup = useState<string[]>('app-sidebar-grup-tutup', () => [])

const labelGrup = (grup: NavigationMenuItem[]): string | null =>
  grup[0]?.type === 'label' ? (grup[0]?.label ?? null) : null

// Menu groups in order: a label means collapsible, null means always visible.
const daftar = computed(() => menu.value.map(grup => ({
  label: labelGrup(grup),
  items: labelGrup(grup) ? grup.slice(1) : grup,
})))

const isTerbuka = (label: string) => !tutup.value.includes(label)

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
    localStorage.setItem(kunciSimpan.value, JSON.stringify(tutup.value))
  }
  catch {
    // Private mode or full quota: the menu still works for this session.
  }
}

function alihkan(label: string) {
  tutup.value = isTerbuka(label)
    ? [...tutup.value, label]
    : tutup.value.filter(l => l !== label)
  simpan()
}

// Expand the group of the module shown by the current route, if collapsed:
// landing in a module must never hide its own navigation.
function perluasModulAktif() {
  const segmen = route.path.split('/').filter(Boolean)[0]
  if (!segmen) return
  const grup = grouped.value.find(g => g.items.some(m => m.key === segmen))
  if (grup && !isTerbuka(grup.group)) {
    tutup.value = tutup.value.filter(l => l !== grup.group)
    simpan()
  }
}

function muat() {
  tutup.value = bacaSimpan() ?? []
  perluasModulAktif()
}

onMounted(muat)
watch(kunciSimpan, muat)
watch(() => route.path, perluasModulAktif)
watch(() => route.path, perluasModulAktif)

// Active-link check for the collapsed rail (UNavigationMenu does this itself
// in the full sidebar).
const isAktif = (item: NavigationMenuItem) => {
  if (typeof item.to !== 'string' || !item.to) return false
  // A grouped row says itself when one of its screens is open.
  if (item.active) return true
  return item.exact
    ? route.path === item.to
    : route.path === item.to || route.path.startsWith(`${item.to}/`)
}

function tipItem(item: NavigationMenuItem): string {
  const label = item.label ?? ''
  return item.disabled ? (label ? `${label} (Segera)` : 'Segera') : label
}

function teksLencana(item: NavigationMenuItem): string | null {
  const badge = item.badge
  if (badge == null || badge === 'Segera') return null
  if (typeof badge === 'string' || typeof badge === 'number') return String(badge)
  return badge.label != null ? String(badge.label) : null
}

const inisial = computed(() => (me.value?.name ?? '?').split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase())
</script>

<template>
  <!-- Collapsed state: an icon rail. Every screen stays one tap away, the
    name appears as a tooltip on hover/focus. All targets stay 44px. -->
  <div
    v-if="mini"
    class="flex h-full flex-col items-center bg-shell px-2.5 py-5"
  >
    <UTooltip
      text="Beranda Office"
      :delay-duration="0"
    >
      <NuxtLink
        to="/"
        aria-label="Beranda Office"
        class="flex size-11 items-center justify-center rounded-field transition-colors hover:bg-muted"
      >
        <img
          src="/mark.png"
          alt=""
          class="size-8 object-contain"
        >
      </NuxtLink>
    </UTooltip>

    <nav
      aria-label="Menu"
      class="mt-4 flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto"
      :aria-busy="!siap"
    >
      <template v-if="!siap">
        <USkeleton
          v-for="n in 6"
          :key="n"
          class="size-11 shrink-0 rounded-field"
        />
      </template>
      <template
        v-for="(grup, gi) in daftar"
        :key="grup.label ?? `atas-${gi}`"
      >
        <div
          v-if="gi > 0"
          class="my-1 w-8 border-t border-default"
          aria-hidden="true"
        />
        <UTooltip
          v-for="item in grup.items"
          :key="String(item.label ?? item.to)"
          :text="tipItem(item)"
          :delay-duration="0"
        >
          <span class="relative block">
            <span
              v-if="item.disabled"
              class="flex size-11 cursor-not-allowed items-center justify-center rounded-field text-dimmed/60"
            >
              <UIcon
                :name="item.icon ?? 'i-lucide-circle'"
                class="size-5"
              />
            </span>
            <NuxtLink
              v-else
              :to="item.to"
              :aria-label="item.label ?? ''"
              :aria-current="isAktif(item) ? 'page' : undefined"
              class="flex size-11 items-center justify-center rounded-field transition-colors"
              :class="isAktif(item) ? 'bg-default font-semibold text-gold-deep shadow-panel' : 'text-muted hover:bg-default/60 hover:text-highlighted'"
            >
              <UIcon
                :name="item.icon ?? 'i-lucide-circle'"
                class="size-5"
              />
            </NuxtLink>
            <span
              v-if="teksLencana(item)"
              class="absolute -right-0.5 -top-0.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white"
            >
              {{ teksLencana(item) }}
            </span>
          </span>
        </UTooltip>
      </template>
    </nav>

    <div class="mt-3 flex flex-col items-center gap-1 border-t border-default pt-3">
      <UTooltip
        v-if="modul && shell && !domainInvestor"
        text="Beranda Office"
        :delay-duration="0"
      >
        <NuxtLink
          to="/"
          aria-label="Beranda Office"
          class="flex size-11 items-center justify-center rounded-field text-muted transition-colors hover:bg-default/60"
        >
          <UIcon
            name="i-lucide-arrow-left"
            class="size-5"
          />
        </NuxtLink>
      </UTooltip>
      <UTooltip
        :text="me?.name ?? 'Profil'"
        :delay-duration="0"
      >
        <NuxtLink
          to="/profil"
          aria-label="Profil"
          :aria-current="route.path === '/profil' ? 'page' : undefined"
          class="flex size-11 items-center justify-center rounded-field text-[13px] font-bold transition-colors hover:bg-muted"
          :class="route.path === '/profil' ? 'bg-default text-gold-deep shadow-panel' : 'bg-ink-900 text-white'"
        >
          {{ inisial }}
        </NuxtLink>
      </UTooltip>
    </div>
  </div>

  <div
    v-else
    class="flex h-full flex-col bg-shell"
  >
    <NuxtLink
      to="/"
      class="flex items-center gap-3 px-5 pb-6 pt-6"
    >
      <!-- WattVision brand block: a tinted icon tile, the name in the accent
           colour, the module in small spaced caps. -->
      <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-default shadow-panel">
        <img
          src="/mark.png"
          alt=""
          class="size-7 object-contain"
        >
      </span>
      <span class="min-w-0 leading-tight">
        <span class="block truncate font-display text-lg font-extrabold text-gold-deep">Laksamana Muda</span>
        <span class="mt-0.5 block truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          {{ shell?.subjudul ?? 'Office' }}
        </span>
      </span>
    </NuxtLink>

    <div
      class="flex-1 overflow-y-auto px-4"
      :aria-busy="!siap"
    >
      <div
        v-if="!siap"
        class="flex flex-col gap-2"
        role="status"
        aria-label="Memuat menu"
      >
        <USkeleton
          v-for="n in 6"
          :key="n"
          class="h-10 w-full rounded-field"
        />
      </div>
      <template
        v-for="(grup, i) in daftar"
        :key="grup.label ?? `atas-${i}`"
      >
        <UNavigationMenu
          v-if="grup.label === null"
          :items="[grup.items]"
          orientation="vertical"
          :ui="{
            list: 'flex flex-col gap-1',
            label: 'px-4 pb-2 pt-5 text-[11px] font-bold uppercase tracking-wider text-dimmed',
            link: 'gap-3 px-4 py-2.5 text-[14px] capitalize text-muted',
            linkLeadingIcon: 'size-5',
          }"
        />
        <div v-else>
          <button
            type="button"
            :aria-expanded="isTerbuka(grup.label)"
            :aria-label="grup.label"
            class="flex w-full items-center justify-between gap-2 px-4 pb-2 pt-5 text-[11px] font-bold uppercase tracking-wider text-dimmed"
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
                list: 'flex flex-col gap-1',
                label: 'px-4 pb-2 pt-5 text-[11px] font-bold uppercase tracking-wider text-dimmed',
                link: 'gap-3 px-4 py-2.5 text-[14px] capitalize text-muted',
                linkLeadingIcon: 'size-5',
              }"
            />
          </div>
        </div>
      </template>
    </div>

    <NuxtLink
      v-if="modul && shell && !domainInvestor"
      to="/"
      class="mx-4 mb-3 flex items-center gap-2.5 rounded-field px-4 py-2.5 text-sm font-semibold text-muted hover:bg-default/60 hover:text-highlighted"
    >
      <UIcon
        name="i-lucide-arrow-left"
        class="size-4"
      />
      Beranda Office
    </NuxtLink>

    <AppAkun class="border-t border-ink-900/5 p-4" />
  </div>
</template>
