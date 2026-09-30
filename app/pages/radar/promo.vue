<!--
  Radar › Promo (deploy/radar vPromo). From BD OS → Promotion, read-only.

  Only promos that are RUNNING or UPCOMING (the API decides from the dates;
  paused and ended ones are only counted as `arsip`). Running first, then the
  nearest start — the same order as the list in BD: two boards showing the
  same data in different orders make people think one has not refreshed.

  The poster sits ABOVE the description: it is what the floor crew looks for
  when a guest asks, and the fastest thing to read at a glance.
-->
<script setup lang="ts">
import type { RadarPromo } from '~/composables/useRadar'
import { PROMO_TIPE, promoHariTeks, promoKat, promoSisa, promoTglPendek, promoTipe } from '~/utils/radar'

definePageMeta({ access: ['radar'] })

const { data, status, error, refresh } = useRadarPromos()
const f = useState('radar-fPromo', () => ({ q: '', tipe: '' }))

const aktif = computed(() => data.value?.promos ?? [])
const list = computed(() => {
  const q = f.value.q.trim().toLowerCase()
  return aktif.value
    .filter(p => (!f.value.tipe || (p.tipe || '') === f.value.tipe)
      && (!q || [p.nama, p.benefit, p.partner, p.kode, p.ketentuan, p.outlet].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => {
      const sa = a.status === 'running' ? 0 : 1
      const sb = b.status === 'running' ? 0 : 1
      return sa !== sb ? sa - sb : String(a.mulai || '').localeCompare(String(b.mulai || ''))
    })
})
const nRun = computed(() => aktif.value.filter(p => p.status === 'running').length)
const nTipe = computed(() => new Set(aktif.value.map(p => p.tipe || '?')).size)
const opsiTipe = [{ value: '', label: 'Semua tipe' }, ...Object.entries(PROMO_TIPE).map(([k, v]) => ({ value: k, label: v.l }))]

const jamTeks = (p: RadarPromo) =>
  (p.jamMulai || p.jamSelesai ? `${p.jamMulai || '—'}–${p.jamSelesai || '—'}` : 'Sepanjang jam buka')
const baris = (p: RadarPromo) => ([
  ['i-lucide-tag', promoTipe(p.tipe).l],
  ['i-lucide-calendar', promoHariTeks(p.hari)],
  ['i-lucide-clock', jamTeks(p)],
  ['i-lucide-map-pin', p.outlet],
  ['i-lucide-handshake', p.partner],
  ['i-lucide-user', p.lmPIC],
  ['i-lucide-ticket', Number(p.kuota) > 0 ? `${Number(p.kuota)} pemakaian` : ''],
] as [string, string | undefined][]).filter(([, v]) => v)

/**
 * Posters are data URIs, and Chrome blocks top-level navigation to `data:`
 * (a plain target=_blank link silently does nothing). Turn it into a blob URL
 * inside the click handler, so the popup permission still holds. The URL is
 * released a minute later — revoking it at once blanks the new tab.
 */
function bukaPoster(e: MouseEvent, src: string) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(src)
  if (!m) return
  e.preventDefault()
  const isi = m[2] ? atob(m[3]!) : decodeURIComponent(m[3]!)
  const byte = Uint8Array.from(isi, c => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([byte], { type: m[1] || 'image/png' }))
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

useSegarSenyap(refresh)
</script>

<template>
  <AppPage
    title="Promo Berjalan & Akan Datang"
    description="Dari BD OS → Promotion."
  >
    <RadarPitaGagal :sumber="data?.sumber" />
    <p
      v-if="error"
      class="mb-4 rounded-field border border-error/30 bg-error/10 p-3 text-sm"
    >
      <b>Promo tidak terbaca:</b> {{ apiErrorMessage(error) }}
    </p>

    <AppStatGrid>
      <AppStat
        label="Berlangsung"
        icon="i-lucide-circle-play"
        tone="success"
        :value="nRun"
        sub="bisa ditawarkan hari ini"
      />
      <AppStat
        label="Akan datang"
        icon="i-lucide-calendar-clock"
        tone="info"
        :value="aktif.length - nRun"
        sub="sudah dijadwalkan"
      />
      <AppStat
        label="Tipe promo"
        icon="i-lucide-tags"
        :value="nTipe"
        sub="kategori berbeda sedang aktif"
      />
    </AppStatGrid>

    <AppPanel>
      <AppFilterGrid>
        <UFormField label="Cari">
          <UInput
            v-model="f.q"
            placeholder="Promo, partner, kode…"
            icon="i-lucide-search"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tipe">
          <USelect
            v-model="f.tipe"
            :items="opsiTipe"
            class="w-full"
          />
        </UFormField>
      </AppFilterGrid>
    </AppPanel>

    <p
      v-if="status === 'pending' && !data"
      class="text-sm text-muted"
    >
      Memuat…
    </p>
    <AppPanel v-else-if="!list.length">
      <p class="text-center text-sm">
        <template v-if="aktif.length">
          <b class="block text-highlighted">Tidak ada promo yang cocok</b>Ubah kata pencarian atau penyaring tipenya.
        </template>
        <template v-else-if="data?.arsip">
          <b class="block text-highlighted">Tidak ada promo yang berlaku saat ini</b>Semua promo yang terdaftar sudah berakhir atau sedang dijeda.
        </template>
        <template v-else>
          <b class="block text-highlighted">Belum ada promo terdaftar</b>Promo didaftarkan tim BD di modul BD OS → Promotion, dan langsung muncul di sini.
        </template>
      </p>
    </AppPanel>
    <div
      v-else
      class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      <div
        v-for="(p, i) in list"
        :key="p.id || i"
        class="rounded-panel border border-default bg-default p-4 shadow-panel"
      >
        <div class="mb-2 flex items-start justify-between gap-2">
          <p class="flex items-start gap-1.5 font-semibold leading-snug text-highlighted">
            <UIcon
              :name="promoTipe(p.tipe).icon"
              class="mt-0.5 size-4 shrink-0 text-primary-700"
            />{{ p.nama || '—' }}
          </p>
          <AppStatus
            :color="p.status === 'running' ? 'success' : 'info'"
            size="sm"
          >
            {{ p.status === 'running' ? 'Berlangsung' : 'Akan Datang' }}
          </AppStatus>
        </div>
        <a
          v-if="p.poster"
          :href="p.poster"
          target="_blank"
          rel="noopener"
          title="Buka poster ukuran penuh"
          @click="bukaPoster($event, p.poster)"
        >
          <img
            :src="p.poster"
            :alt="`Poster ${p.nama || ''}`"
            loading="lazy"
            class="mb-2 block w-full rounded-field border border-default"
          >
        </a>
        <p
          v-if="p.benefit"
          class="mb-2 font-semibold"
        >
          {{ p.benefit }}
        </p>
        <div class="mb-2 flex flex-wrap gap-1.5">
          <AppStatus size="sm">
            {{ promoTglPendek(p.mulai) }} → {{ promoTglPendek(p.selesai) }}
          </AppStatus>
          <AppStatus
            v-if="promoSisa(p)"
            size="sm"
          >
            {{ promoSisa(p) }}
          </AppStatus>
          <AppStatus
            v-if="promoKat(p.kategori)"
            :icon="promoKat(p.kategori)!.icon"
            size="sm"
          >
            {{ promoKat(p.kategori)!.l }}
          </AppStatus>
          <AppStatus
            v-if="p.kode"
            color="gold"
            size="sm"
          >
            kode {{ p.kode }}
          </AppStatus>
        </div>
        <ul class="space-y-1 text-sm">
          <li
            v-for="[ic, v] in baris(p)"
            :key="ic"
            class="flex items-start gap-2"
          >
            <UIcon
              :name="ic"
              class="mt-0.5 size-4 shrink-0 text-muted"
            /><span>{{ v }}</span>
          </li>
        </ul>
        <details
          v-if="p.ketentuan"
          class="mt-2"
        >
          <summary class="cursor-pointer text-xs text-muted">
            Ketentuan
          </summary>
          <p class="mt-1 whitespace-pre-wrap text-xs text-muted">
            {{ p.ketentuan }}
          </p>
        </details>
      </div>
    </div>

    <p class="mt-3 text-xs text-muted">
      Menampilkan promo yang <b>berlangsung</b> dan <b>akan datang</b> saja<template v-if="data?.arsip">
        · {{ data.arsip }} promo lain sudah berakhir atau sedang dijeda
      </template>
      · didaftarkan tim BD di <b>BD OS → Promotion</b>.
    </p>
  </AppPage>
</template>
