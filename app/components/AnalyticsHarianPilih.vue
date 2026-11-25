<!--
  "Per hari" picker for the one-period Analytics pages (pilihHari, :1586):
  a date pulls that day from ESB and replaces the month on this page only.
  While loading / empty / failed it draws that state itself (kosongHarian),
  so the page shows nothing else for the day.
-->
<script setup lang="ts">
import { useAnalyticsHarian } from '~/composables/useAnalyticsEsb'
import { angka } from '~/utils/format'

const h = useAnalyticsHarian()
const hari0 = hariIni()
const fmtTgl = (t: string) => {
  const d = new Date(`${t}T00:00:00`)
  return Number.isNaN(d.getTime()) ? t : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
const st = computed(() => h.status.value)
const L = computed(() => h.laporanHari.value)
</script>

<template>
  <div class="mb-4 rounded-panel border border-default bg-default px-4 py-3">
    <div class="flex flex-wrap items-center gap-2">
      <b class="text-sm">Per hari</b>
      <UButton
        v-if="h.hari.value"
        icon="i-lucide-chevron-left"
        size="xs"
        color="neutral"
        variant="outline"
        title="Hari sebelumnya"
        @click="h.geser(-1)"
      />
      <AppTanggal
        :max="hari0"
        :model-value="h.hari.value"
        @update:model-value="(v) => h.pilih(String(v ?? ''))"
      />
      <template v-if="h.hari.value">
        <UButton
          icon="i-lucide-chevron-right"
          size="xs"
          color="neutral"
          variant="outline"
          title="Hari berikutnya"
          :disabled="h.hari.value >= hari0"
          @click="h.geser(1)"
        />
        <UButton
          label="Kembali ke bulanan"
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="ghost"
          @click="h.pilihBulan(h.hari.value.slice(0, 7))"
        />
        <UButton
          v-if="L"
          icon="i-lucide-refresh-cw"
          size="xs"
          color="neutral"
          variant="outline"
          title="Tarik ulang dari ESB"
          @click="h.muat(h.hari.value, true)"
        />
      </template>
    </div>
    <p class="mt-2 text-xs text-muted">
      <template v-if="!h.hari.value">
        Pilih tanggal untuk melihat halaman ini per hari — datanya ditarik langsung dari ESB.
      </template>
      <template v-else-if="st === 'memuat'">
        Menarik {{ fmtTgl(h.hari.value) }} dari ESB…
      </template>
      <template v-else-if="L">
        Menampilkan <b>{{ fmtTgl(h.hari.value) }}</b> saja · {{ angka(L.esb?.bill ?? 0) }} bill dari ESB<template v-if="h.hari.value === hari0">
          (hari ini — masih berjalan)
        </template><template v-if="L.esb?.billBatal">
          · {{ L.esb.billBatal }} bill batal tidak dihitung
        </template> · tidak disimpan, ringkasan bulanan tidak berubah
      </template>
    </p>
  </div>

  <template v-if="h.hari.value && !L">
    <div
      v-if="st && st !== 'memuat' && 'kosong' in st"
      class="rounded-panel border border-default bg-elevated p-8 text-center"
    >
      <p class="font-semibold">
        Tidak ada bill di ESB pada {{ fmtTgl(h.hari.value) }}.
      </p>
      <p class="mt-1 text-sm text-muted">
        Kalau venue memang buka hari itu, tekan Tarik ulang.
      </p>
      <UButton
        class="mt-3"
        label="Tarik ulang"
        icon="i-lucide-refresh-cw"
        size="sm"
        color="neutral"
        variant="outline"
        @click="h.muat(h.hari.value, true)"
      />
    </div>
    <UAlert
      v-else-if="st && st !== 'memuat' && 'galat' in st"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`${fmtTgl(h.hari.value)} gagal ditarik dari ESB.`"
      :description="st.galat"
      :actions="[{ label: 'Coba lagi', color: 'neutral', variant: 'outline', onClick: () => h.muat(h.hari.value, true) }]"
    />
    <div
      v-else
      class="rounded-panel border border-default bg-elevated p-8 text-center"
    >
      <p class="font-semibold">
        Menarik {{ fmtTgl(h.hari.value) }} dari ESB…
      </p>
      <p class="mt-1 text-sm text-muted">
        Satu hari biasanya selesai dalam beberapa detik.
      </p>
    </div>
  </template>
</template>
