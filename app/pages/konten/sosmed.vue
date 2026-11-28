<!--
  Konten › Pengaturan Sosmed (deploy/konten/analytics/index.html #pengaturan;
  #133). Admin modul campaign saja: profil brand, kategori pola, AI, TikTok,
  Instagram. Kotak rahasia kosong = jangan diubah; hapus pakai kata HAPUS.
-->
<script setup lang="ts">
definePageMeta({ access: ['konten', 'campaign'] })

const { data: st, status, error, refresh } = useStateCampaign()

const menyimpan = ref(false)
const profil = ref('')
const kategori = ref('')
const ttKey = ref('')
const ttSecret = ref('')
const igId = ref('')
const igSecret = ref('')
const adsToken = ref('')
const adsAkun = ref('')

watchEffect(() => {
  if (!st.value) return
  profil.value = st.value.setting.profil
  kategori.value = st.value.setting.kategori.join('\n')
  adsAkun.value = st.value.setting.adsAkun ?? ''
})

async function simpan() {
  if (menyimpan.value || !st.value?.boleh.admin) return
  menyimpan.value = true
  try {
    const ok = await campaignSimpan(() => simpanPengaturanCampaign({
      profil: profil.value,
      kategori: kategori.value.split('\n'),
      tiktokKey: ttKey.value,
      tiktokSecret: ttSecret.value,
      igId: igId.value,
      igSecret: igSecret.value,
      adsToken: adsToken.value,
      adsAkun: adsAkun.value,
    }), 'Pengaturan disimpan.')
    if (ok) {
      ttKey.value = ''
      ttSecret.value = ''
      igId.value = ''
      igSecret.value = ''
      adsToken.value = ''
      await refresh()
    }
  }
  finally {
    menyimpan.value = false
  }
}
</script>

<template>
  <KontenGerbang lihat="sosmed">
    <AppPage
      title="Pengaturan Sosmed"
      description="Profil brand dan koneksi platform."
    >
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Analytics: ${apiErrorMessage(error)}`"
      />
      <UAlert
        v-if="st && !st.boleh.admin"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Halaman ini hanya untuk admin modul Campaign. Isinya tetap ditampilkan agar bisa dibaca."
      />

      <div
        v-if="!st && status === 'pending'"
        class="grid gap-3 lg:grid-cols-2"
        aria-label="Memuat pengaturan sosmed"
        role="status"
      >
        <USkeleton
          v-for="i in 4"
          :key="i"
          class="h-28 rounded-panel"
        />
      </div>
      <div
        v-if="st"
        class="grid min-w-0 gap-4 [&>section]:mb-0 [&>section]:min-w-0 [&>section>header]:px-5! [&>section>div]:p-5! lg:grid-cols-2"
      >
        <AppPanel
          title="Profil brand & kategori"
          class="lg:col-span-2"
        >
          <div class="space-y-3">
            <UFormField label="Profil brand">
              <UTextarea
                v-model="profil"
                :rows="7"
                autoresize
                class="w-full"
                :disabled="!st.boleh.admin || menyimpan"
              />
            </UFormField>
            <UFormField
              label="Kategori pola insight"
              help="Satu kategori per baris, maksimal 20 kategori."
            >
              <UTextarea
                v-model="kategori"
                :rows="7"
                autoresize
                class="w-full"
                :disabled="!st.boleh.admin || menyimpan"
              />
            </UFormField>
          </div>
        </AppPanel>
        <AppPanel
          title="TikTok"
          class="[&>div]:space-y-2"
        >
          <p class="text-sm text-muted">
            Scope harus sama persis dengan yang dicentang di Login Kit app TikTok. Redirect URI:
            <span class="break-all font-mono text-xs">{{ st?.setting.redirectUri }}</span>
          </p>
          <p
            v-if="st?.setting.tiktokDariConfig"
            class="text-xs text-muted"
          >
            Client key dikunci di env server.
          </p>
          <UFormField label="Client key">
            <UInput
              v-model="ttKey"
              size="sm"
              class="w-full"
              type="password"
              placeholder="Kosongkan = tidak diubah. Ketik HAPUS untuk menghapus."
              :disabled="menyimpan || !st?.boleh.admin || st?.setting.tiktokDariConfig"
            />
          </UFormField>
          <UFormField label="Client secret">
            <UInput
              v-model="ttSecret"
              size="sm"
              class="w-full"
              type="password"
              placeholder="Kosongkan = tidak diubah. Ketik HAPUS untuk menghapus."
              :disabled="menyimpan || !st?.boleh.admin"
            />
          </UFormField>
        </AppPanel>

        <AppPanel
          title="Instagram"
          class="[&>div]:space-y-2"
        >
          <p class="text-sm text-muted">
            ID aplikasi Instagram & Rahasia aplikasi Instagram (bukan App ID Facebook).
            Izin: instagram_business_basic, instagram_business_manage_insights. URI pengalihan:
            <span class="break-all font-mono text-xs">{{ st?.setting.igRedirectUri }}</span>
          </p>
          <UFormField label="ID aplikasi Instagram">
            <UInput
              v-model="igId"
              size="sm"
              class="w-full"
              type="password"
              placeholder="Kosongkan = tidak diubah. Ketik HAPUS untuk menghapus."
              :disabled="menyimpan || !st?.boleh.admin || st?.setting.igDariConfig"
            />
          </UFormField>
          <UFormField label="Rahasia aplikasi Instagram">
            <UInput
              v-model="igSecret"
              size="sm"
              class="w-full"
              type="password"
              placeholder="Kosongkan = tidak diubah. Ketik HAPUS untuk menghapus."
              :disabled="menyimpan || !st?.boleh.admin"
            />
          </UFormField>
        </AppPanel>
        <AppPanel
          title="Meta Ads"
          class="[&>div]:space-y-3"
        >
          <UFormField
            label="Token pengguna sistem"
            :help="st.setting.adsTokenAda ? 'Token sudah tersimpan.' : undefined"
          >
            <UInput
              v-model="adsToken"
              type="password"
              autocomplete="new-password"
              class="w-full"
              :disabled="!st.boleh.admin || menyimpan || st.setting.adsDariConfig"
            />
          </UFormField>
          <UFormField label="ID akun iklan">
            <UInput
              v-model="adsAkun"
              placeholder="act_1234567890"
              class="w-full"
              :disabled="!st.boleh.admin || menyimpan"
            />
          </UFormField>
        </AppPanel>
      </div>
      <p
        v-if="st?.boleh.admin"
        class="mt-3 text-xs text-muted"
      >
        Kosongkan isian rahasia untuk mempertahankan nilainya. Ketik HAPUS untuk menghapusnya.
      </p>

      <UButton
        class="mt-3"
        color="primary"
        :loading="menyimpan"
        :disabled="menyimpan || !st?.boleh.admin"
        @click="simpan()"
      >
        Simpan pengaturan
      </UButton>
    </AppPage>
  </KontenGerbang>
</template>
