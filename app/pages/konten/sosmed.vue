<!--
  Konten › Pengaturan Sosmed (deploy/konten/analytics/index.html #pengaturan;
  #133). Admin modul campaign saja: profil brand, kategori pola, AI, TikTok,
  Instagram. Kotak rahasia kosong = jangan diubah; hapus pakai kata HAPUS.
-->
<script setup lang="ts">
definePageMeta({ access: ['konten', 'campaign'] })

const { data: st, error, refresh } = useStateCampaign()

const profil = ref('')
const kategori = ref('')
const aiKey = ref('')
const aiModel = ref('')
const ttKey = ref('')
const ttSecret = ref('')
const igId = ref('')
const igSecret = ref('')

watchEffect(() => {
  if (!st.value) return
  profil.value = st.value.setting.profil
  kategori.value = st.value.setting.kategori.join('\n')
  aiModel.value = st.value.setting.aiModel
})

async function simpan() {
  const ok = await campaignSimpan(() => simpanPengaturanCampaign({
    profil: profil.value,
    kategori: kategori.value.split('\n'),
    aiKeyMeta: aiKey.value,
    aiModelMeta: aiModel.value,
    tiktokKey: ttKey.value,
    tiktokSecret: ttSecret.value,
    igId: igId.value,
    igSecret: igSecret.value,
  }), 'Pengaturan disimpan.')
  if (ok) {
    aiKey.value = ''
    ttKey.value = ''
    ttSecret.value = ''
    igId.value = ''
    igSecret.value = ''
    refresh()
  }
}
</script>

<template>
  <KontenGerbang lihat="sosmed">
    <AppPage
      title="Pengaturan Sosmed"
      description="Profil brand, kunci AI, TikTok & Instagram"
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

      <AppPanel title="Profil brand">
        <UTextarea
          v-model="profil"
          :rows="3"
          :disabled="!st?.boleh.admin"
        />
      </AppPanel>

      <AppPanel
        title="Kategori pola insight"
        description="Satu baris satu kategori, maksimal 20, tiap kategori maksimal 60 huruf."
      >
        <UTextarea
          v-model="kategori"
          :rows="5"
          :disabled="!st?.boleh.admin"
        />
      </AppPanel>

      <AppPanel title="AI">
        <p class="text-sm text-muted">
          Meta (Muse Spark). Model -contributor jauh lebih murah karena Meta boleh memakai data yang dikirim
          (judul & angka postingan, profil brand, topik riset) untuk melatih modelnya.
        </p>
        <div
          v-for="p in st?.setting.ai ?? []"
          :key="p.id"
          class="mt-2"
        >
          <p class="text-sm font-medium">
            {{ p.label }} <span
              v-if="p.siap"
              class="text-xs text-muted"
            >(terisi)</span>
          </p>
          <p
            v-if="p.dariConfig"
            class="text-xs text-muted"
          >
            API key dikunci di env server; isian key di bawah tidak dipakai.
          </p>
          <UFormField label="API key">
            <UInput
              v-model="aiKey"
              type="password"
              placeholder="Kosongkan = tidak diubah. Ketik HAPUS untuk menghapus."
              :disabled="!st?.boleh.admin || p.dariConfig"
            />
          </UFormField>
          <UFormField label="Model">
            <USelect
              v-model="aiModel"
              :items="p.model"
              :disabled="!st?.boleh.admin"
            />
          </UFormField>
        </div>
      </AppPanel>

      <AppPanel title="TikTok">
        <p class="text-sm text-muted">
          Scope harus sama persis dengan yang dicentang di Login Kit app TikTok. Redirect URI:
          <span class="font-mono text-xs">{{ st?.setting.redirectUri }}</span>
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
            type="password"
            placeholder="Kosongkan = tidak diubah. Ketik HAPUS untuk menghapus."
            :disabled="!st?.boleh.admin || st?.setting.tiktokDariConfig"
          />
        </UFormField>
        <UFormField label="Client secret">
          <UInput
            v-model="ttSecret"
            type="password"
            placeholder="Kosongkan = tidak diubah. Ketik HAPUS untuk menghapus."
            :disabled="!st?.boleh.admin"
          />
        </UFormField>
      </AppPanel>

      <AppPanel title="Instagram">
        <p class="text-sm text-muted">
          ID aplikasi Instagram & Rahasia aplikasi Instagram (bukan App ID Facebook).
          Izin: instagram_business_basic, instagram_business_manage_insights. URI pengalihan:
          <span class="font-mono text-xs">{{ st?.setting.igRedirectUri }}</span>
        </p>
        <UFormField label="ID aplikasi Instagram">
          <UInput
            v-model="igId"
            type="password"
            placeholder="Kosongkan = tidak diubah. Ketik HAPUS untuk menghapus."
            :disabled="!st?.boleh.admin || st?.setting.igDariConfig"
          />
        </UFormField>
        <UFormField label="Rahasia aplikasi Instagram">
          <UInput
            v-model="igSecret"
            type="password"
            placeholder="Kosongkan = tidak diubah. Ketik HAPUS untuk menghapus."
            :disabled="!st?.boleh.admin"
          />
        </UFormField>
      </AppPanel>

      <UButton
        color="primary"
        :disabled="!st?.boleh.admin"
        @click="simpan()"
      >
        Simpan pengaturan
      </UButton>
    </AppPage>
  </KontenGerbang>
</template>
