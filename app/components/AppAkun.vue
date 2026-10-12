<!--
  The user at the foot of the menu (old Office sidebar): initials, name, the
  role inside this module, and the power button (or the module's `kaki`).
  Used by the desktop sidebar and the phone "Lainnya" sheet.
-->
<script setup lang="ts">
const me = useMe()
const { shell } = useModulShell()

const inisial = computed(() => (me.value?.name ?? '?').split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase())
const peran = computed(() => shell.value?.peran?.(me.value) ?? me.value?.keterangan ?? '')
</script>

<template>
  <div class="flex items-center gap-2.5">
    <NuxtLink
      to="/profil"
      class="flex min-w-0 flex-1 items-center gap-2.5"
    >
      <span class="flex size-9 shrink-0 items-center justify-center rounded-field bg-primary-600 text-[13px] font-bold text-white">
        {{ inisial }}
      </span>
      <span class="min-w-0 leading-tight">
        <span class="block truncate text-sm font-semibold text-highlighted">{{ me?.name }}</span>
        <span class="block truncate text-xs text-muted">{{ peran }}</span>
      </span>
    </NuxtLink>
    <UButton
      v-if="shell?.kaki"
      :to="shell.kaki.to"
      :icon="shell.kaki.icon ?? 'i-lucide-power'"
      color="neutral"
      variant="outline"
      size="sm"
      :aria-label="shell.kaki.label"
      :title="shell.kaki.label"
    />
    <UButton
      v-else
      icon="i-lucide-power"
      color="neutral"
      variant="outline"
      size="sm"
      aria-label="Keluar"
      @click="logout()"
    />
  </div>
</template>
