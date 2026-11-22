<!--
  The "Memproses…" pill for writes still running in the background (useProses).
  Pinned bottom-centre, above the phone's bottom nav, and announced to screen
  readers. Nothing is drawn while no write is running.
-->
<script setup lang="ts">
const { daftar } = useProses()
const utama = computed(() => daftar.value[daftar.value.length - 1] ?? null)
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-200 ease-in"
      leave-to-class="translate-y-2 opacity-0"
    >
      <div
        v-if="utama"
        class="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex justify-center px-4 lg:bottom-6"
      >
        <div
          role="status"
          aria-live="polite"
          class="flex max-w-full items-center gap-3 rounded-full bg-inverted px-4 py-2.5 text-sm text-inverted shadow-lg"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-5 shrink-0 animate-spin"
          />
          <span class="min-w-0">
            <b>Memproses…</b>
            <span class="ms-1">{{ utama.teks }}</span>
            <span
              v-if="daftar.length > 1"
              class="ms-1 opacity-75"
            >(+{{ daftar.length - 1 }} lagi)</span>
          </span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
