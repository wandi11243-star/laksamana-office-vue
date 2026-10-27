<!--
  The sidebar of the old Office (DESIGN.md › Shell): brand with the module's name
  in small ink capitals, the menu in labelled groups, and the user at the foot.
  Inside a module with its own chrome (utils/modul-shell.ts) the menu is that
  module's screens; elsewhere it is Beranda and the modules the user holds.
  Desktop only; on a phone AppNavBawah draws the same menu (useMenuNav).
-->
<script setup lang="ts">
const { modul, shell } = useModulShell()
const menu = useMenuNav()
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

    <UNavigationMenu
      :items="menu"
      orientation="vertical"
      class="flex-1 overflow-y-auto px-3"
      :ui="{
        label: 'px-3 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-wider text-dimmed',
        link: 'text-[15px]',
        linkLeadingIcon: 'size-[18px]',
      }"
    />

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
