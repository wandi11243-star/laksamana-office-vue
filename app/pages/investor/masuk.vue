<!--
  Investor Compass › Masuk. The module's own gate: same Office account (name or
  username + PIN), but the `investor` key is checked here so the refusal can
  name the exact checkbox — the API enforces it again server-side.

    laksamana-office/investor/index.html:433-443  login form
    laksamana-office/investor/index.html:668-697  doLogin + gate message
-->
<script setup lang="ts">
import { loginInvestor } from '~/composables/useInvestor'

definePageMeta({ layout: false, public: true })

if (useToken().value) await navigateTo('/investor')

const form = reactive({ login: '', pin: '' })
const error = ref('')
const gate = ref(false)
const loading = ref(false)

async function submit() {
  error.value = ''
  gate.value = false
  if (!form.login.trim() || !form.pin) {
    error.value = 'Nama dan PIN harus diisi.'
    return
  }
  loading.value = true
  try {
    await loginInvestor(form.login.trim(), form.pin)
    const me = useMe().value
    const modules = me?.modules ?? []
    if (!modules.includes('*') && !modules.includes('investor')) {
      // Not a gate, only manners: the server refuses without the key too.
      // The session is dropped so the Office shell does not treat this
      // account as signed in to a module it may never open.
      useToken().value = null
      useMe().value = null
      gate.value = true
      return
    }
    await navigateTo('/investor')
  }
  catch (e) {
    error.value = apiErrorCode(e) === 'invalid_credentials'
      ? 'Nama atau PIN salah.'
      : apiErrorMessage(e, 'Tidak bisa masuk. Coba lagi sebentar lagi.')
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
          Investor Compass
        </h1>
        <p class="mt-1 text-xs font-semibold tracking-[0.3em] text-muted">
          LAKSAMANA MUDA — RUANG INVESTOR
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
          v-if="gate"
          class="text-sm font-medium text-error"
          role="alert"
        >
          Akun Anda belum diberi akses. Minta admin mencentang <b>Investor Compass</b> lewat Kelola Akses di Laksamana Office.
        </p>
        <p
          v-else-if="error"
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
        <p class="text-[13px] leading-relaxed text-muted">
          Memakai akun Laksamana Office yang sama.<br>Belum bisa masuk? Minta admin mencentang <b>Investor Compass</b> di Kelola Akses.
        </p>
      </form>
    </div>
  </div>
</template>
