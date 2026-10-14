<!-- Connected social account card (TikTok / Instagram) for Insight. -->
<script setup lang="ts">
import type { AkunCampaign } from '~/composables/useCampaign'

const props = defineProps<{ akun: AkunCampaign, jenis: 'tiktok' | 'instagram', sinkronJalan: boolean }>()
const emit = defineEmits<{ hubungkan: [], sinkronkan: [], putuskan: [akun: AkunCampaign] }>()

const scopeKurang = computed(() => props.jenis === 'tiktok'
  && !['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list']
    .every(s => (props.akun.scope || '').split(',').map(x => x.trim()).includes(s)))
const izinHabisHari = computed(() => {
  if (props.jenis !== 'instagram') return null
  const sisa = Math.floor(((props.akun.token_exp || 0) - Date.now()) / 86400000)
  return sisa >= 0 && sisa < 14 ? sisa : null
})
const sinkronTerakhir = computed(() => {
  if (!props.akun.sync_at) return 'belum pernah'
  const d = new Date(props.akun.sync_at)
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
})
</script>

<template>
  <div class="flex items-center gap-2">
    <UAvatar
      :src="props.akun.avatar || undefined"
      :alt="props.akun.nama"
    />
    <div class="min-w-0">
      <p class="truncate text-sm font-medium">
        {{ props.akun.nama || '—' }}<span v-if="props.akun.terverifikasi"> ✓</span>
      </p>
      <p
        v-if="props.akun.bio"
        class="truncate text-xs text-muted"
      >
        {{ props.akun.bio }}
      </p>
    </div>
  </div>
  <p
    v-if="props.akun.stats_ada"
    class="mt-1 text-xs text-muted"
  >
    {{ props.akun.follower }} follower · {{ props.akun.jml_video }} video
  </p>
  <p
    v-if="scopeKurang"
    class="mt-1 text-xs text-warning"
  >
    Izin {{ props.akun.scope || '—' }} belum lengkap — tekan Hubungkan ulang.
  </p>
  <p
    v-if="izinHabisHari !== null"
    class="mt-1 text-xs text-warning"
  >
    Izin habis {{ izinHabisHari }} hari lagi — tekan Hubungkan ulang kalau sinkron berikutnya tidak memperbaruinya.
  </p>
  <p class="mt-1 text-xs text-muted">
    Sinkron terakhir {{ sinkronTerakhir }}. Diperbarui otomatis tiap 6 jam saat halaman ini dibuka.
  </p>
  <p
    v-if="props.akun.sync_galat"
    class="mt-1 text-xs text-error"
  >
    {{ props.akun.sync_galat }}
  </p>
  <div class="mt-2 flex flex-wrap gap-2">
    <UButton
      color="neutral"
      variant="soft"
      size="xs"
      :loading="props.sinkronJalan"
      @click="emit('sinkronkan')"
    >
      {{ props.sinkronJalan ? 'Menyinkronkan…' : 'Sinkronkan' }}
    </UButton>
    <UButton
      v-if="scopeKurang || izinHabisHari !== null"
      color="neutral"
      variant="soft"
      size="xs"
      @click="emit('hubungkan')"
    >
      Hubungkan ulang
    </UButton>
    <UButton
      color="neutral"
      variant="ghost"
      size="xs"
      @click="emit('putuskan', props.akun)"
    >
      Putuskan
    </UButton>
  </div>
</template>
