<!--
  One claim's "Cek Google" result: a status chip (colour + icon + word), then
  the Google review that was found — author, stars, date, text, link — and the
  warnings a verifier must see. `lengkap` (the review sheet) shows the whole
  text; in the table it is cut to two lines.
-->
<script setup lang="ts">
import type { Review } from '~/composables/useServiceExcellent'
import { HARI_CEK_GOOGLE } from '~/utils/cek-google'
import { tglPendek } from '~/utils/format'

const props = defineProps<{
  rv: Review
  /** Guest name of another claim already holding this Google review. */
  dipakai?: string
  lengkap?: boolean
}>()

const c = computed(() => props.rv.googleCek)
const temuan = computed(() => (c.value && ['cocok', 'mirip'].includes(c.value.jenis) ? c.value : null))
const sudahDicocokkan = computed(() => props.rv.status === 'terverifikasi' && !!props.rv.googleReviewId)

const status = computed(() => {
  if (sudahDicocokkan.value) return { color: 'success' as const, icon: 'i-lucide-badge-check', teks: 'Dicocokkan saat verifikasi' }
  switch (c.value?.jenis) {
    case 'cocok': return { color: 'success' as const, icon: 'i-lucide-badge-check', teks: 'Ada di Google' }
    case 'mirip': return { color: 'warning' as const, icon: 'i-lucide-circle-help', teks: 'Nama mirip' }
    case 'tidak': return { color: 'neutral' as const, icon: 'i-lucide-search-x', teks: 'Tidak ditemukan' }
    case 'luar':
    case 'tanpaNama': return { color: 'neutral' as const, icon: 'i-lucide-hand', teks: 'Cek manual' }
    default: return { color: 'neutral' as const, icon: 'i-lucide-clock', teks: 'Belum dicek' }
  }
})
const catatan = computed(() => {
  if (c.value?.jenis === 'luar') return `Klaim lebih dari ${HARI_CEK_GOOGLE} hari.`
  if (c.value?.jenis === 'tanpaNama') return 'Nama akun Google di klaim kosong.'
  if (c.value?.jenis !== 'tidak') return ''
  if (props.rv.reviewerName.includes('@')) return 'Yang diisi email, sedangkan Google hanya menampilkan nama akun.'
  return c.value.lemah ? 'Data Google masih terbatas, jadi belum berarti palsu.' : ''
})
const bintang = (n?: number) => '★'.repeat(Math.max(0, Math.min(5, Number(n) || 0)))
const bedaBintang = computed(() => !!(props.rv.rating && temuan.value?.rating && Number(props.rv.rating) !== Number(temuan.value.rating)))
const kapan = computed(() => (c.value?.at
  ? `Dicek ${new Date(c.value.at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${c.value.by ? ` · ${c.value.by}` : ''}`
  : ''))
</script>

<template>
  <div class="space-y-1.5 whitespace-normal text-[13px] leading-snug">
    <AppStatus
      :color="status.color"
      :icon="status.icon"
      size="sm"
    >
      {{ status.teks }}
    </AppStatus>

    <template v-if="temuan">
      <p class="flex flex-wrap items-center gap-x-2">
        <b class="text-highlighted">{{ temuan.penulis }}</b>
        <span
          class="tracking-tight text-gold"
          :aria-label="`${temuan.rating} bintang`"
        >{{ bintang(temuan.rating) }}</span>
        <span
          v-if="temuan.tgl"
          class="text-muted num"
        >{{ tglPendek(temuan.tgl) }}</span>
      </p>
      <p
        v-if="temuan.teks"
        class="italic text-muted"
        :class="lengkap ? '' : 'line-clamp-2'"
      >
        “{{ temuan.teks }}”
      </p>
      <p
        v-if="lengkap && temuan.tempat"
        class="text-muted"
      >
        Tempat: {{ temuan.tempat }}
      </p>
      <p class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <a
          v-if="temuan.url"
          :href="temuan.url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 font-semibold text-gold-deep underline-offset-4 hover:underline"
          @click.stop
        >Buka di Google<UIcon
          name="i-lucide-external-link"
          class="size-3.5"
        /></a>
        <span
          v-if="temuan.lain"
          class="text-muted"
        >+{{ temuan.lain }} kandidat lain</span>
      </p>
    </template>

    <p
      v-if="catatan"
      class="text-muted"
    >
      {{ catatan }}
    </p>
    <p
      v-if="bedaBintang"
      class="flex items-start gap-1.5 font-semibold text-warning"
    >
      <UIcon
        name="i-lucide-triangle-alert"
        class="mt-0.5 size-3.5 shrink-0"
      />Bintang di Google {{ temuan?.rating }}, di klaim {{ rv.rating }}
    </p>
    <p
      v-if="dipakai"
      class="flex items-start gap-1.5 font-semibold text-error"
    >
      <UIcon
        name="i-lucide-copy-x"
        class="mt-0.5 size-3.5 shrink-0"
      />Sudah dipakai klaim {{ dipakai }}
    </p>
    <p
      v-if="kapan"
      class="text-[11px] text-dimmed"
    >
      {{ kapan }}
    </p>
  </div>
</template>
