<!--
  Ganti PIN wajib (owner, Nov 2026). An account whose PIN was set by someone
  else — a new account, a PIN reset by an admin — lands here right after login
  (auth.global: me.harusGantiPin) and cannot open anything else until it picks
  its own PIN. PUT /me/pin clears the mark on the server.
-->
<script setup lang="ts">
definePageMeta({ layout: false })

const me = useMe()
const route = useRoute()
const form = reactive({ currentPin: '', newPin: '', ulang: '' })
const error = ref('')
const loading = ref(false)

// someone without the mark has nothing to do here
if (me.value && !me.value.harusGantiPin) await navigateTo('/')

async function submit() {
  error.value = ''
  if (!/^\d{4,8}$/.test(form.newPin)) {
    error.value = 'PIN baru harus 4–8 angka.'
    return
  }
  if (form.newPin !== form.ulang) {
    error.value = 'Ulangi PIN baru dengan angka yang sama.'
    return
  }
  loading.value = true
  try {
    await useApi()('/me/pin', { method: 'PUT', body: { currentPin: form.currentPin, newPin: form.newPin } })
    if (me.value) me.value = { ...me.value, harusGantiPin: false }
    useToast().add({ title: 'PIN baru disimpan', color: 'success' })
    await navigateTo(typeof route.query.next === 'string' ? route.query.next : '/')
  }
  catch (e) {
    const kode = apiErrorCode(e)
    error.value = kode === 'invalid_credentials' ? 'PIN sementara salah.' : kode === 'same_pin' ? 'PIN baru tidak boleh sama dengan PIN sementara.' : apiErrorMessage(e)
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="grid min-h-dvh place-items-center bg-muted px-8 py-10 sm:px-4">
    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <img
          src="/icon-512.png"
          alt=""
          class="mx-auto size-20 rounded-[22%] shadow-panel"
        >
        <h1 class="mt-4 text-2xl font-extrabold tracking-tight text-highlighted">
          Buat PIN baru
        </h1>
        <p class="mt-2 text-sm text-muted">
          Halo {{ me?.name }}. PIN kamu masih PIN sementara dari admin. Buat PIN sendiri dulu sebelum lanjut.
        </p>
      </div>

      <form
        class="space-y-4 rounded-panel border border-default bg-default p-6 shadow-panel sm:p-5"
        @submit.prevent="submit"
      >
        <UFormField
          label="PIN sementara (yang dipakai untuk masuk tadi)"
          name="currentPin"
        >
          <UInput
            v-model="form.currentPin"
            type="password"
            inputmode="numeric"
            autocomplete="current-password"
            size="xl"
            class="w-full"
            autofocus
          />
        </UFormField>
        <UFormField
          label="PIN baru (4–8 angka)"
          name="newPin"
        >
          <UInput
            v-model="form.newPin"
            type="password"
            inputmode="numeric"
            autocomplete="new-password"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Ulangi PIN baru"
          name="ulang"
        >
          <UInput
            v-model="form.ulang"
            type="password"
            inputmode="numeric"
            autocomplete="new-password"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <p
          v-if="error"
          class="text-sm font-medium text-error"
          role="alert"
        >
          {{ error }}
        </p>
        <UButton
          type="submit"
          label="Simpan PIN baru"
          size="xl"
          block
          :loading="loading"
        />
        <UButton
          label="Keluar"
          color="neutral"
          variant="ghost"
          block
          @click="logout()"
        />
      </form>
    </div>
  </div>
</template>
