<script setup lang="ts">
const me = useMe()
const { mine } = useModulNav()
const toast = useToast()

// Change PIN: PUT /me/pin {currentPin, newPin}
const pinOpen = ref(false)
const pin = reactive({ currentPin: '', newPin: '' })
const pinError = ref('')
const pinSaving = ref(false)

async function savePin() {
  pinError.value = ''
  if (!/^\d{4,8}$/.test(pin.newPin)) {
    pinError.value = 'PIN baru harus 4–8 angka.'
    return
  }
  pinSaving.value = true
  try {
    await useApi()('/me/pin', { method: 'PUT', body: pin })
    pinOpen.value = false
    Object.assign(pin, { currentPin: '', newPin: '' })
    toast.add({ title: 'PIN diganti', color: 'success' })
  }
  catch (e) {
    pinError.value = apiErrorCode(e) === 'invalid_credentials' ? 'PIN lama salah.' : apiErrorMessage(e)
  }
  finally {
    pinSaving.value = false
  }
}
</script>

<template>
  <AppPage
    :title="me?.name ?? ''"
    :description="me?.keterangan || undefined"
  >
    <div class="grid gap-x-8 lg:grid-cols-2">
      <div>
        <AppList title="Akun">
          <AppListRow
            title="Username"
            icon="i-lucide-at-sign"
          >
            <template #trailing>
              <span class="font-normal text-muted">{{ me?.username || '—' }}</span>
            </template>
          </AppListRow>
          <AppListRow
            title="Ganti PIN"
            icon="i-lucide-key-round"
            @click="pinOpen = true"
          />
          <AppListRow
            title="Keluar"
            icon="i-lucide-log-out"
            @click="logout"
          />
        </AppList>

        <AppList title="Pasang di HP">
          <p class="px-4 py-3 text-muted">
            Buka Office di Chrome atau Safari, lalu pilih <b class="text-highlighted">Tambahkan ke Layar Utama</b>.
            Office terbuka seperti aplikasi, tanpa Play Store.
          </p>
        </AppList>
      </div>

      <AppList title="Akses modul">
        <AppListRow
          v-for="m in mine"
          :key="m.key"
          :title="m.label"
          :description="m.desc"
          :icon="m.icon"
          :to="m.ready ? m.to : undefined"
        >
          <template
            v-if="!m.ready"
            #trailing
          >
            <AppStatus>Segera</AppStatus>
          </template>
        </AppListRow>
        <p
          v-if="!mine.length"
          class="px-4 py-3 text-muted"
        >
          Belum ada.
        </p>
      </AppList>
    </div>

    <ResponsiveSheet
      v-model:open="pinOpen"
      title="Ganti PIN"
      description="PIN dipakai untuk masuk ke semua modul."
    >
      <form
        id="pin-form"
        class="space-y-4"
        @submit.prevent="savePin"
      >
        <UFormField label="PIN lama">
          <UInput
            v-model="pin.currentPin"
            type="password"
            inputmode="numeric"
            autocomplete="current-password"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="PIN baru"
          help="4–8 angka"
        >
          <UInput
            v-model="pin.newPin"
            type="password"
            inputmode="numeric"
            autocomplete="new-password"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <p
          v-if="pinError"
          class="text-sm font-medium text-error"
          role="alert"
        >
          {{ pinError }}
        </p>
      </form>
      <template #footer>
        <UButton
          type="submit"
          form="pin-form"
          label="Simpan PIN"
          size="xl"
          :loading="pinSaving"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="soft"
          size="xl"
          @click="pinOpen = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
