<!--
  Antrean Pengajuan (HR) — absensi/index.html viewAntrean, :1519-1573.
  Queued punches, longest-waiting first, with the photo, the reason and the
  evidence HR needs to decide. Setujui/Tolak go through a confirmation sheet
  and land as POST /absensi/punches/{id}/decision; a `berubah:0` answer means
  someone else decided first and is told, never silently swallowed.
-->
<script setup lang="ts">
import type { AbsensiPunch } from '~/composables/useAbsensi'
import { decidePunch, useAbsensiHr, useAbsensiQueue } from '~/composables/useAbsensi'
import { tglPendek } from '~/utils/format'
import { ikonSebab, teksSebab, warnaSebab } from '~/utils/status-absensi'

definePageMeta({ access: ['absensi'] })

const hr = useAbsensiHr()
const toast = useToast()

// HR only, so the read waits for `siapa.hr` (no needless 403 for crew).
const { data: queue, status, error, refresh } = useAbsensiQueue()
watch(hr, (v) => {
  if (v) {
    refresh()
  }
}, { immediate: true })

const rows = computed(() => queue.value ?? [])

// Skeleton only for the first load: the queue read is lazy (HR only), so idle counts as loading too.
const statMemuat = computed(() => !rows.value.length && (status.value === 'pending' || status.value === 'idle'))

const sheet = ref(false)
const sibuk = ref(false)
const pilihan = ref<{ id: string, status: 'VALID' | 'DITOLAK', nama: string } | null>(null)

function buka(p: AbsensiPunch, statusPutus: 'VALID' | 'DITOLAK') {
  pilihan.value = { id: p.id, status: statusPutus, nama: p.nama || p.uid }
  sheet.value = true
}

async function putus() {
  const p = pilihan.value
  if (!p) return
  sibuk.value = true
  try {
    const res = await decidePunch(p.id, p.status)
    sheet.value = false
    if (!res.data.berubah) {
      toast.add({ title: 'Pengajuan ini sudah diputus orang lain lebih dulu.', color: 'warning' })
    }
    else {
      toast.add({
        title: p.status === 'VALID' ? 'Disetujui — absen jadi sah.' : 'Ditolak.',
        color: p.status === 'VALID' ? 'success' : 'info',
      })
    }
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <AppPage
    title="Antrean"
    description="Absen di luar area kerja, di luar jam shift, atau tanpa jadwal. Yang paling lama menunggu di atas."
  >
    <p
      v-if="!hr"
      class="text-muted"
    >
      Tidak ada akses.
    </p>

    <template v-else>
      <p
        v-if="error"
        class="mb-4 text-error"
        role="alert"
      >
        {{ apiErrorMessage(error) }}
      </p>

      <AppStatGrid
        :loading="statMemuat"
        :count="1"
      >
        <AppStat
          label="Menunggu"
          icon="i-lucide-hourglass"
          :value="rows.length"
          :tone="rows.length ? 'warning' : 'gold'"
          sub="Pengajuan perlu diputus"
        />
      </AppStatGrid>

      <AppPanel
        title="Antrean pengajuan"
        :count="rows.length"
        description="Yang paling lama menunggu di atas."
        flush
      >
        <USkeleton
          v-if="status === 'pending' && !rows.length"
          class="m-4 h-16"
        />
        <div
          v-else-if="rows.length"
          class="grid gap-3 p-4 lg:grid-cols-2 lg:p-5"
        >
          <article
            v-for="p in rows"
            :key="p.id"
            class="rounded-panel border border-default bg-default p-3.5"
          >
            <div class="flex items-start gap-3">
              <img
                v-if="p.foto"
                :src="p.foto"
                alt=""
                class="size-14 shrink-0 rounded-field object-cover"
              >
              <div
                v-else
                class="size-14 shrink-0 rounded-field bg-muted"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold text-highlighted">
                  {{ p.nama || p.uid }}
                </p>
                <p class="text-sm text-muted num">
                  {{ p.arah === 'MASUK' ? 'Masuk' : 'Pulang' }} {{ p.jam }} · {{ tglPendek(p.tgl) }}
                </p>
                <div class="mt-1.5 flex flex-wrap gap-1">
                  <AppStatus
                    size="sm"
                    :color="warnaSebab(p.sebab)"
                    :icon="ikonSebab(p.sebab)"
                  >
                    {{ teksSebab(p.sebab) }}
                  </AppStatus>
                  <AppStatus
                    v-if="p.jarak >= 0"
                    size="sm"
                    color="neutral"
                  >
                    {{ p.jarak }} m dari titik
                  </AppStatus>
                  <AppStatus
                    v-if="p.shift"
                    size="sm"
                    color="neutral"
                  >
                    Shift {{ p.shift }} {{ p.m || '--:--' }}–{{ p.s || '--:--' }}
                  </AppStatus>
                  <AppStatus
                    v-else
                    size="sm"
                    color="neutral"
                  >
                    Tanpa shift
                  </AppStatus>
                  <AppStatus
                    v-if="p.wajahOk"
                    size="sm"
                    color="success"
                    icon="i-lucide-check"
                  >
                    Wajah cocok
                  </AppStatus>
                </div>
              </div>
            </div>

            <p
              v-if="p.alasan"
              class="mt-2.5 rounded-field bg-muted px-3 py-2 text-sm text-default"
            >
              {{ p.alasan }}
            </p>

            <div class="mt-3 grid grid-cols-2 gap-2">
              <UButton
                label="Setujui"
                color="success"
                class="justify-center"
                @click="buka(p, 'VALID')"
              />
              <UButton
                label="Tolak"
                color="error"
                variant="soft"
                class="justify-center"
                @click="buka(p, 'DITOLAK')"
              />
            </div>
          </article>
        </div>
        <p
          v-else
          class="px-4 py-8 text-center text-muted"
        >
          Tidak ada yang menunggu.
        </p>
      </AppPanel>
    </template>

    <ResponsiveSheet
      v-model:open="sheet"
      :title="pilihan?.status === 'VALID' ? 'Setujui pengajuan?' : 'Tolak pengajuan?'"
      :description="pilihan ? `${pilihan.nama} · absen jadi ${pilihan.status === 'VALID' ? 'sah' : 'ditolak'}.` : ''"
    >
      <p class="text-sm text-muted">
        Keputusan hanya berlaku selagi pengajuan masih menunggu. Kalau orang lain memutusnya lebih
        dulu, kamu akan diberi tahu — bukan diam-diam dianggap berhasil.
      </p>
      <template #footer>
        <UButton
          :label="pilihan?.status === 'VALID' ? 'Setujui' : 'Tolak'"
          :color="pilihan?.status === 'VALID' ? 'success' : 'error'"
          size="xl"
          :loading="sibuk"
          @click="putus"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheet = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
