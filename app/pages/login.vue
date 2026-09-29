<script setup lang="ts">
definePageMeta({ layout: false, public: true })

const route = useRoute()
if (useToken().value) await navigateTo('/')

const form = reactive({ login: '', pin: '' })
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  if (!form.login.trim() || !form.pin) {
    error.value = 'Isi nama atau username, dan PIN.'
    return
  }
  loading.value = true
  try {
    await login(form.login.trim(), form.pin)
    await navigateTo(typeof route.query.next === 'string' ? route.query.next : '/')
  }
  catch (e) {
    error.value = apiErrorCode(e) === 'invalid_credentials'
      ? 'Nama atau PIN salah, atau akun belum aktif.'
      : apiErrorMessage(e)
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="grid min-h-dvh place-items-center bg-muted px-4 py-10">
    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <img
          src="/mark.png"
          alt=""
          class="mx-auto size-16"
        >
        <h1 class="mt-4 text-3xl font-extrabold tracking-tight text-highlighted">
          Laksamana Office
        </h1>
        <p class="mt-1 text-xs font-semibold tracking-[0.3em] text-muted">
          COFFEE &amp; LIVE SPACE
        </p>
      </div>

      <form
        class="space-y-4 rounded-panel border border-default bg-default shadow-panel p-5"
        @submit.prevent="submit"
      >
        <UFormField
          label="Nama atau username"
          name="login"
        >
          <UInput
            v-model="form.login"
            autocomplete="username"
            size="xl"
            class="w-full"
            autofocus
          />
        </UFormField>
        <UFormField
          label="PIN"
          name="pin"
        >
          <UInput
            v-model="form.pin"
            type="password"
            inputmode="numeric"
            autocomplete="current-password"
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
          label="Masuk"
          size="xl"
          block
          :loading="loading"
        />
      </form>
    </div>
  </div>
</template>
