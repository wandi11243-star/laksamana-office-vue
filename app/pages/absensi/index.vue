<!--
  Absen — the module's first screen (absensi/index.html viewAbsen, :1226-1252).
  Today's shift, server time, punches and status come from GET /absensi/context.
  The punch buttons themselves stay in the Absensi PWA until task #15 (K-02),
  so this screen tells the crew where they stand and opens that PWA.

  GPS and face are NOT checked here: the browser only shows what the API says,
  the server is the judge (absensi.md F.10/F.15).
-->
<script setup lang="ts">
import { PWA_ABSENSI } from '~/utils/layar/absensi'
import { durasi } from '~/utils/absensi'
import { lencanaHari } from '~/utils/status-absensi'
import { jam } from '~/utils/format'

definePageMeta({ access: ['absensi'] })

const PWA = PWA_ABSENSI

const { data: ctx, status, error } = useAbsensiContext()
const hari = computed(() => ctx.value?.hariIni ?? null)

// Skeleton only for the first load: there is no filter on this screen, the cards just wait for context.
const statMemuat = computed(() => !ctx.value && (status.value === 'pending' || status.value === 'idle'))

const shift = computed(() => {
  const s = ctx.value?.shift
  if (s === false) return { value: 'Jadwal tak terbaca', sub: 'Jadwal shift tidak menjawab; ketukan tetap dicatat.', tone: 'warning' as const }
  if (!s || !s.length) return { value: 'Tidak dijadwalkan', sub: 'Absen tetap bisa, tapi masuk antrean pengajuan HR.', tone: 'warning' as const }
  const first = s[0]!
  if (first.libur) return { value: `Libur (${first.kode})`, sub: 'Kalau tetap bekerja, absennya masuk antrean pengajuan.', tone: 'info' as const }
  return {
    value: `${first.mulai || '--:--'} – ${first.selesai || '--:--'}`,
    sub: `Shift ${first.kode}${first.sumber === 'DW' ? ' · pekerja harian' : ''}`,
    tone: 'gold' as const,
  }
})

const jamServer = computed(() => (ctx.value?.waktuServer ? jam(new Date(ctx.value.waktuServer).toISOString()) : '—'))

const masukJam = computed(() => hari.value?.masuk?.jam ?? '—')
const pulangJam = computed(() => hari.value?.pulang?.jam ?? '—')
const durasiTampil = computed(() => (hari.value?.hitung?.lengkap ? durasi(hari.value.hitung.durasi) : '—'))

const masukSub = computed(() => (!hari.value?.masuk ? 'Belum absen' : hari.value.masuk.status === 'MENUNGGU' ? 'Menunggu HR' : 'Tercatat'))
const pulangSub = computed(() => (!hari.value?.pulang ? 'Belum absen' : hari.value.pulang.status === 'MENUNGGU' ? 'Menunggu HR' : 'Tercatat'))
const durasiSub = computed(() => (hari.value?.hitung?.lengkap ? 'Masuk sampai pulang' : 'Butuh masuk & pulang'))

/** The old summary badges, minus "Belum pulang" (the recap-only badge). */
const lencana = computed(() => {
  const h = hari.value
  if (!h || (!h.masuk && !h.pulang)) return []
  return lencanaHari(h).filter(l => l.label !== 'Belum pulang')
})

const lokasiStatus = computed(() => (ctx.value?.lokasi?.length
  ? {
      label: `${ctx.value.lokasi.length} titik kerja`,
      color: 'success' as const,
      icon: 'i-lucide-map-pin',
      desc: ctx.value.lokasi.map(l => l.nama).join(', '),
    }
  : {
      label: 'Belum disetel',
      color: 'warning' as const,
      icon: 'i-lucide-map-pin-off',
      desc: 'Admin belum menandai titik kerja. Sementara ini semua absen dianggap di dalam area.',
    }))

const terdaftar = computed(() => ctx.value?.wajahTerdaftar === 1)
const wajib = computed(() => ctx.value?.setting?.wajahWajib === true)
const wajahStatus = computed(() => (terdaftar.value
  ? {
      label: 'Wajah terdaftar',
      color: 'success' as const,
      icon: 'i-lucide-scan-face',
      desc: 'Pencocokan dikerjakan server. Wajah yang tidak cocok tetap terekam, tapi masuk antrean HR.',
    }
  : wajib.value
    ? {
        label: 'Wajah wajib',
        color: 'error' as const,
        icon: 'i-lucide-scan-face',
        desc: 'Wajah belum didaftarkan — wajib sebelum bisa absen. Daftarkan di aplikasi Absensi.',
      }
    : {
        label: 'Belum didaftarkan',
        color: 'neutral' as const,
        icon: 'i-lucide-scan-face',
        desc: 'Belum wajib. Daftarkan supaya absenmu lebih kuat buktinya.',
      }))
</script>

<template>
  <AppPage
    title="Absen"
    description="Ringkasan absensi hari ini. Ketukan masuk & pulang lewat aplikasi Absensi."
  >
    <template #actions>
      <UButton
        :to="PWA"
        target="_blank"
        rel="noopener"
        icon="i-lucide-external-link"
        label="Buka aplikasi absen"
      />
    </template>

    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppStatGrid
      :loading="statMemuat"
      :count="5"
    >
      <AppStat
        label="Shift"
        icon="i-lucide-calendar-clock"
        :value="shift.value"
        :sub="shift.sub"
        :tone="shift.tone"
      />
      <AppStat
        label="Jam server"
        icon="i-lucide-clock"
        :value="jamServer"
        sub="Waktu server, bukan jam HP"
      />
      <AppStat
        label="Masuk"
        icon="i-lucide-log-in"
        :value="masukJam"
        :sub="masukSub"
        :tone="hari?.masuk ? 'success' : 'gold'"
      />
      <AppStat
        label="Pulang"
        icon="i-lucide-log-out"
        :value="pulangJam"
        :sub="pulangSub"
        :tone="hari?.pulang ? 'info' : 'gold'"
      />
      <AppStat
        label="Durasi"
        icon="i-lucide-timer"
        :value="durasiTampil"
        :sub="durasiSub"
        :tone="hari?.hitung?.lengkap ? 'info' : 'gold'"
      />
    </AppStatGrid>

    <AppPanel
      title="Status hari ini"
      icon="i-lucide-badge-check"
    >
      <USkeleton
        v-if="status === 'pending'"
        class="h-6 w-40"
      />
      <div
        v-else-if="lencana.length"
        class="flex flex-wrap gap-2"
      >
        <AppStatus
          v-for="l in lencana"
          :key="l.label"
          :color="l.color"
          :icon="l.icon"
        >
          {{ l.label }}
        </AppStatus>
      </div>
      <p
        v-else
        class="text-muted"
      >
        Belum ada absen hari ini. Absen masuk dulu di aplikasi Absensi.
      </p>
      <p class="mt-3 text-sm text-muted">
        Telat, lembur, dan durasi dihitung server dari ketukan dan shift — tidak disimpan, jadi ikut
        berubah bila pengajuanmu baru disetujui.
      </p>
    </AppPanel>

    <AppList title="Syarat absen">
      <AppListRow
        title="Lokasi kerja"
        :description="lokasiStatus.desc"
        icon="i-lucide-map-pin"
      >
        <template #trailing>
          <AppStatus
            :color="lokasiStatus.color"
            :icon="lokasiStatus.icon"
          >
            {{ lokasiStatus.label }}
          </AppStatus>
        </template>
      </AppListRow>
      <AppListRow
        title="Wajah"
        :description="wajahStatus.desc"
        icon="i-lucide-scan-face"
      >
        <template #trailing>
          <AppStatus
            :color="wajahStatus.color"
            :icon="wajahStatus.icon"
          >
            {{ wajahStatus.label }}
          </AppStatus>
        </template>
      </AppListRow>
      <AppListRow
        title="Absen di Office Vue"
        description="Tombol masuk & pulang dengan kamera wajah + GPS menyusul di tugas terakhir."
        icon="i-lucide-camera"
        dim
      >
        <template #trailing>
          <span class="text-dimmed">Segera · K-02</span>
        </template>
      </AppListRow>
    </AppList>

    <AppPanel
      title="Aplikasi Absensi"
      icon="i-lucide-smartphone"
    >
      <p class="text-sm text-muted">
        Ketukan absen memakai kamera wajah dan GPS, dan hanya tersedia di
        <a
          :href="PWA"
          target="_blank"
          rel="noopener"
          class="font-semibold text-primary-700 underline-offset-4 hover:underline dark:text-primary-300"
        >absensi.laksamanamuda.id</a>.
        Masuk dengan akun Office yang sama.
      </p>
    </AppPanel>
  </AppPage>
</template>
