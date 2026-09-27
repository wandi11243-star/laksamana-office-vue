<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const title = computed(() => ({
  403: 'Belum ada akses',
  404: 'Halaman tidak ditemukan',
} as Record<number, string>)[props.error.statusCode ?? 500] ?? 'Ada yang salah')
</script>

<template>
  <UApp>
    <div class="grid min-h-dvh place-items-center bg-muted px-4">
      <div class="max-w-sm text-center">
        <img
          src="/mark.png"
          alt=""
          class="mx-auto mb-6 size-14"
        >
        <h1 class="text-2xl font-extrabold tracking-tight text-highlighted">
          {{ title }}
        </h1>
        <p class="mt-2 text-muted">
          {{ error.statusMessage || error.message }}
        </p>
        <UButton
          class="mt-6"
          size="lg"
          label="Kembali ke beranda"
          @click="clearError({ redirect: '/' })"
        />
      </div>
    </div>
  </UApp>
</template>
