<!--
  Konten › Performa Iklan (deploy/konten/analytics/index.html #iklan).
  Facebook & Instagram ads from the last sync (GET /analytics/ads): cost,
  result and cost per result. "Works / boros" is judged ONLY against ads with
  the same kind of result (chat, click, reach… are not comparable), like the
  old screen. AI verdict via POST /analytics/ads/ai.
-->
<script setup lang="ts">
import type { AiIklan, BarisIklan } from '~/composables/useCampaign'

definePageMeta({ access: ['konten', 'campaign'] })

const route = useRoute()
const toast = useToast()
const demo = computed(() => import.meta.dev && route.query.demo === '1')
const { data: st } = useStateCampaign()

const periode = ref<'7' | '30' | 'max'>('30')
const status = ref<'semua' | 'aktif' | 'berhenti'>('semua')
const jenisHasil = ref('Semua hasil')
const urut = ref<'spend' | 'hasil' | 'cpr' | 'ctr'>('spend')
const cari = ref('')

const baris = ref<BarisIklan[]>([])
const syncAt = ref(0)
const galatSync = ref('')
const memuat = ref(false)
const galat = ref('')
const sinkron = ref(false)
const ai = ref<AiIklan | null>(null)
const aiJalan = ref(false)

function dataDemo(): BarisIklan[] {
  const hasil = ['Chat dimulai', 'Chat dimulai', 'Jangkauan', 'Klik tautan', 'Chat dimulai', 'Interaksi', 'Klik tautan', 'Jangkauan']
  return Array.from({ length: 12 }, (_, i) => {
    const spend = [850000, 620000, 410000, 380000, 300000, 260000, 190000, 140000, 90000, 60000, 35000, 20000][i]!
    const label = hasil[i % hasil.length]!
    const n = label === 'Jangkauan' ? Math.round(spend / 9) : label === 'Klik tautan' ? Math.round(spend / (900 + i * 300)) : Math.round(spend / (9000 + i * 4000))
    return {
      ad_id: String(1000 + i), akun: '1', nama: ['Promo Ube Series', 'Live Music Jumat', '2nd Anniversary', 'Paket Hemat Siang', 'Reservasi Ultah', 'Teacher of Champions', 'Menu Baru Matcha', 'Brand Awareness Nov', 'Weekend Brunch', 'Nobar Bola', 'Happy Hour', 'Story Promo'][i]!,
      kampanye: i < 6 ? 'Chat WhatsApp — Nov' : 'Awareness Pekanbaru', adset: 'Pekanbaru 18-34', objective: label === 'Jangkauan' ? 'OUTCOME_AWARENESS' : label === 'Klik tautan' ? 'OUTCOME_TRAFFIC' : 'OUTCOME_ENGAGEMENT',
      status: i % 4 === 3 ? 'PAUSED' : 'ACTIVE', thumb: '', permalink: '', spend, impresi: spend / 12, reach: spend / 18, klik: Math.round(spend / 1500),
      ctr: 0.6 + (i % 5) * 0.35, cpm: 12000 + i * 500, frekuensi: 1.2 + (i % 4) * 0.4, video_view: 0, hasil_label: label, hasil_n: n,
      tgl_mulai: '2026-11-01', tgl_selesai: '2026-11-28', post: null,
    }
  })
}

let reqId = 0
async function muat() {
  const id = ++reqId
  memuat.value = true
  galat.value = ''
  try {
    if (demo.value) {
      baris.value = dataDemo()
      syncAt.value = Date.now()
    }
    else {
      const d = (await getIklan(periode.value)).data
      if (id !== reqId) return
      baris.value = d.baris
      syncAt.value = d.syncAt
      galatSync.value = d.galat
    }
  }
  catch (e) {
    if (id === reqId) galat.value = apiErrorMessage(e)
  }
  finally {
    if (id === reqId) memuat.value = false
  }
}
onMounted(muat)
watch([periode, demo], () => {
  ai.value = null
  muat()
})

async function sinkronkan() {
  if (demo.value) return
  sinkron.value = true
  try {
    const r = (await sinkronIklan()).data
    toast.add({ title: `${r.jumlah} iklan disinkronkan`, color: 'success' })
    await muat()
  }
  catch (e) {
    toast.add({ title: 'Sinkron iklan gagal', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sinkron.value = false
  }
}

async function analisa() {
  if (demo.value) {
    ai.value = { ringkasan: 'Contoh analisa: iklan chat paling efisien, awareness masih wajar.', model: 'demo', lanjutkan: [{ ad_id: '1000', nama: 'Promo Ube Series', alasan: 'Biaya per chat terendah.', saran: 'Naikkan budget bertahap 20%.' }], perbaiki: [{ ad_id: '1003', nama: 'Paket Hemat Siang', alasan: 'CTR di bawah rata-rata.', saran: 'Ganti hook 3 detik pertama.' }], hentikan: [], saranUmum: ['Pisahkan iklan chat & awareness saat membandingkan.'] }
    return
  }
  aiJalan.value = true
  try {
    ai.value = (await aiIklan(periode.value)).data
  }
  catch (e) {
    toast.add({ title: 'Analisa AI gagal', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    aiJalan.value = false
  }
}

// ---- cost per result; reach is priced per 1.000 people
const cpr = (r: BarisIklan) => r.hasil_n > 0 ? (r.hasil_label === 'Jangkauan' ? r.spend / r.hasil_n * 1000 : r.spend / r.hasil_n) : null
const aktif = (r: BarisIklan) => r.status === 'ACTIVE'

/** Median cost per result per kind of result: the yardstick for works / boros. */
const median = computed(() => {
  const per = new Map<string, number[]>()
  for (const r of baris.value) {
    const c = cpr(r)
    if (c == null || r.spend < 50000) continue
    per.set(r.hasil_label, [...(per.get(r.hasil_label) ?? []), c])
  }
  const out: Record<string, number> = {}
  for (const [k, v] of per) {
    const s = [...v].sort((a, b) => a - b)
    out[k] = s[Math.floor(s.length / 2)]!
  }
  return out
})
type Nilai = { label: string, color: 'success' | 'error' | 'warning' | 'neutral', icon: string }
function nilai(r: BarisIklan): Nilai {
  const c = cpr(r)
  if (r.spend < 50000) return { label: 'Data kurang', color: 'neutral', icon: 'i-lucide-hourglass' }
  if (c == null) return { label: 'Tanpa hasil', color: 'error', icon: 'i-lucide-circle-x' }
  const m = median.value[r.hasil_label]
  if (!m) return { label: 'Wajar', color: 'neutral', icon: 'i-lucide-minus' }
  if (c <= m * 0.8) return { label: 'Works', color: 'success', icon: 'i-lucide-thumbs-up' }
  if (c >= m * 1.5) return { label: 'Boros', color: 'error', icon: 'i-lucide-thumbs-down' }
  return { label: 'Wajar', color: 'warning', icon: 'i-lucide-minus' }
}

const opsiHasil = computed(() => ['Semua hasil', ...new Set(baris.value.map(r => r.hasil_label).filter(Boolean))])
const tampil = computed(() => {
  const q = cari.value.trim().toLowerCase()
  const rows = baris.value.filter(r =>
    (status.value === 'semua' || (status.value === 'aktif') === aktif(r))
    && (jenisHasil.value === 'Semua hasil' || r.hasil_label === jenisHasil.value)
    && (!q || `${r.nama} ${r.kampanye} ${r.adset}`.toLowerCase().includes(q)))
  const key = (r: BarisIklan) => urut.value === 'spend' ? -r.spend : urut.value === 'hasil' ? -r.hasil_n : urut.value === 'ctr' ? -r.ctr : (cpr(r) ?? Infinity)
  return rows.sort((a, b) => key(a) - key(b))
})

const total = computed(() => {
  const r = tampil.value
  const sum = (k: keyof BarisIklan) => r.reduce((a, b) => a + Number(b[k] || 0), 0)
  const imp = sum('impresi')
  return { spend: sum('spend'), impresi: imp, reach: sum('reach'), klik: sum('klik'), ctr: imp ? sum('klik') / imp * 100 : 0, aktif: r.filter(aktif).length, works: r.filter(x => nilai(x).label === 'Works').length, boros: r.filter(x => nilai(x).label === 'Boros').length }
})
const rupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const angka = (n: number) => Math.round(n).toLocaleString('id-ID')

/** Cost per result kind, for the bar overview. */
const perHasil = computed(() => {
  const m = new Map<string, { spend: number, n: number }>()
  for (const r of tampil.value) {
    if (!r.hasil_label) continue
    const x = m.get(r.hasil_label) ?? { spend: 0, n: 0 }
    m.set(r.hasil_label, { spend: x.spend + r.spend, n: x.n + r.hasil_n })
  }
  const maks = Math.max(1, ...[...m.values()].map(v => v.spend))
  return [...m.entries()].map(([label, v]) => ({ label, ...v, lebar: v.spend / maks * 100, cpr: v.n ? (label === 'Jangkauan' ? v.spend / v.n * 1000 : v.spend / v.n) : null }))
    .sort((a, b) => b.spend - a.spend)
})
const topBiaya = computed(() => {
  const rows = [...tampil.value].sort((a, b) => b.spend - a.spend).slice(0, 8)
  const maks = Math.max(1, ...rows.map(r => r.spend))
  return rows.map(r => ({ r, lebar: r.spend / maks * 100, n: nilai(r) }))
})

const tokenSiap = computed(() => demo.value || !!st.value?.setting.adsSiap)
const KELOMPOK_AI = [
  { key: 'lanjutkan', label: 'Lanjutkan', color: 'success', icon: 'i-lucide-thumbs-up' },
  { key: 'perbaiki', label: 'Perbaiki', color: 'warning', icon: 'i-lucide-wrench' },
  { key: 'hentikan', label: 'Hentikan', color: 'error', icon: 'i-lucide-octagon-x' },
] as const
</script>

<template>
  <AppPage
    title="Performa Iklan"
    description="Iklan Facebook & Instagram: mana yang works, mana yang tidak"
  >
    <template #actions>
      <UButton
        label="Analisa AI"
        icon="i-lucide-sparkles"
        color="neutral"
        variant="outline"
        :loading="aiJalan"
        :disabled="!baris.length || memuat"
        @click="analisa"
      />
      <UButton
        label="Sinkronkan"
        icon="i-lucide-refresh-cw"
        color="primary"
        :loading="sinkron"
        :disabled="!tokenSiap || memuat"
        @click="sinkronkan"
      />
    </template>

    <div class="space-y-4">
      <UAlert
        v-if="!tokenSiap"
        color="warning"
        variant="subtle"
        icon="i-lucide-key-round"
        title="Token iklan & ID akun iklan belum diisi"
        description="Isi di Pengaturan Sosmed › Meta Ads, lalu tekan Sinkronkan."
      >
        <template #actions>
          <UButton
            label="Buka pengaturan"
            to="/konten/sosmed"
            color="neutral"
            variant="outline"
            size="xs"
          />
        </template>
      </UAlert>
      <UAlert
        v-if="galat || galatSync"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="galat ? `Data iklan tidak bisa dimuat: ${galat}` : `Sinkron terakhir gagal: ${galatSync}`"
      />

      <AppPanel>
        <div class="flex flex-wrap items-center gap-3">
          <AppSeg
            v-model="periode"
            :options="[{ value: '7', label: '7 hari' }, { value: '30', label: '30 hari' }, { value: 'max', label: 'Sepanjang waktu' }]"
          />
          <AppSeg
            v-model="status"
            :options="[{ value: 'semua', label: 'Semua' }, { value: 'aktif', label: 'Aktif' }, { value: 'berhenti', label: 'Berhenti' }]"
          />
          <USelect
            v-model="jenisHasil"
            :items="opsiHasil"
            class="w-44"
          />
          <USelect
            v-model="urut"
            :items="[{ value: 'spend', label: 'Urut: biaya' }, { value: 'hasil', label: 'Urut: hasil' }, { value: 'cpr', label: 'Urut: biaya per hasil' }, { value: 'ctr', label: 'Urut: CTR' }]"
            class="w-48"
          />
          <UInput
            v-model="cari"
            icon="i-lucide-search"
            placeholder="Cari iklan atau kampanye…"
            class="min-w-48 flex-1"
          />
        </div>
        <p class="mt-3 text-xs text-muted">
          {{ syncAt ? `Sinkron terakhir ${new Date(syncAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Belum pernah disinkronkan.' }}
          Penilaian Works/Boros dibandingkan hanya dengan iklan yang jenis hasilnya sama; biaya di bawah Rp50.000 dianggap data kurang.
        </p>
      </AppPanel>

      <AppStatGrid
        :loading="memuat && !baris.length"
        :count="6"
        satu-baris
      >
        <AppStat
          label="Total biaya"
          :value="rupiah(total.spend)"
          icon="i-lucide-wallet"
        />
        <AppStat
          label="Impresi"
          :value="angka(total.impresi)"
          icon="i-lucide-eye"
        />
        <AppStat
          label="Jangkauan"
          :value="angka(total.reach)"
          icon="i-lucide-radio-tower"
        />
        <AppStat
          label="CTR rata-rata"
          :value="total.ctr.toLocaleString('id-ID', { maximumFractionDigits: 2 }) + '%'"
          icon="i-lucide-mouse-pointer-click"
        />
        <AppStat
          label="Iklan aktif"
          :value="total.aktif"
          :satuan="`/ ${tampil.length}`"
          icon="i-lucide-play"
        />
        <AppStat
          label="Works / Boros"
          :value="`${total.works} / ${total.boros}`"
          icon="i-lucide-scale"
          :tone="total.boros > total.works ? 'warning' : 'success'"
        />
      </AppStatGrid>

      <AppPanel
        v-if="ai"
        title="Analisa AI"
        :description="ai.ringkasan"
      >
        <template #actions>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Tutup analisa"
            @click="ai = null"
          />
        </template>
        <div class="grid gap-4 lg:grid-cols-3">
          <div
            v-for="k in KELOMPOK_AI"
            :key="k.key"
          >
            <AppStatus
              :color="k.color"
              :icon="k.icon"
            >
              {{ k.label }} · {{ ai[k.key].length }}
            </AppStatus>
            <ul class="mt-2 space-y-2">
              <li
                v-for="x in ai[k.key]"
                :key="x.ad_id"
                class="rounded-lg border border-default p-3 text-sm"
              >
                <b class="block text-highlighted">{{ x.nama }}</b>
                <span class="block text-muted">{{ x.alasan }}</span>
                <span class="mt-1 block">→ {{ x.saran }}</span>
              </li>
              <li
                v-if="!ai[k.key].length"
                class="text-sm text-muted"
              >
                Tidak ada.
              </li>
            </ul>
          </div>
        </div>
        <ul
          v-if="ai.saranUmum.length"
          class="mt-4 list-disc space-y-1 pl-5 text-sm"
        >
          <li
            v-for="s in ai.saranUmum"
            :key="s"
          >
            {{ s }}
          </li>
        </ul>
      </AppPanel>

      <div
        class="grid gap-4 transition-opacity lg:grid-cols-2"
        :class="memuat ? 'pointer-events-none opacity-60' : ''"
      >
        <AppPanel
          title="Biaya terbesar"
          description="8 iklan dengan biaya tertinggi pada filter ini."
        >
          <div class="space-y-2.5">
            <div
              v-for="t in topBiaya"
              :key="t.r.ad_id"
              class="text-sm"
            >
              <div class="mb-1 flex items-center justify-between gap-2">
                <span class="min-w-0 truncate">{{ t.r.nama }}</span>
                <b class="shrink-0 tabular-nums">{{ rupiah(t.r.spend) }}</b>
              </div>
              <span class="block h-2.5 overflow-hidden rounded-full bg-elevated">
                <span
                  class="block h-full rounded-full"
                  :class="t.n.color === 'success' ? 'bg-success' : t.n.color === 'error' ? 'bg-error' : 'bg-primary'"
                  :style="{ width: t.lebar + '%' }"
                />
              </span>
            </div>
            <p
              v-if="!topBiaya.length"
              class="py-6 text-center text-sm text-muted"
            >
              Belum ada iklan.
            </p>
          </div>
        </AppPanel>
        <AppPanel
          title="Per jenis hasil"
          description="Biaya & biaya per hasil (Jangkauan = per 1.000 orang)."
        >
          <div class="space-y-3">
            <div
              v-for="h in perHasil"
              :key="h.label"
              class="text-sm"
            >
              <div class="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span><b>{{ h.label }}</b> <span class="text-muted">· {{ angka(h.n) }}</span></span>
                <span class="tabular-nums">{{ rupiah(h.spend) }} <span class="text-muted">· {{ h.cpr == null ? '–' : rupiah(h.cpr) }}/hasil</span></span>
              </div>
              <span class="block h-2.5 overflow-hidden rounded-full bg-elevated">
                <span
                  class="block h-full rounded-full bg-primary"
                  :style="{ width: h.lebar + '%' }"
                />
              </span>
            </div>
          </div>
        </AppPanel>
      </div>

      <AppPanel
        title="Daftar iklan"
        :count="tampil.length"
        flush
      >
        <div class="hidden overflow-x-auto lg:block">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-muted">
                <th class="px-5 py-2.5 font-medium">
                  Iklan
                </th>
                <th class="px-3 py-2.5 font-medium">
                  Status
                </th>
                <th class="px-3 py-2.5 text-right font-medium">
                  Biaya
                </th>
                <th class="px-3 py-2.5 text-right font-medium">
                  Hasil
                </th>
                <th class="px-3 py-2.5 text-right font-medium">
                  Biaya / hasil
                </th>
                <th class="px-3 py-2.5 text-right font-medium">
                  CTR
                </th>
                <th class="px-3 py-2.5 text-right font-medium">
                  Frekuensi
                </th>
                <th class="px-5 py-2.5 font-medium">
                  Penilaian
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in tampil"
                :key="r.ad_id"
                class="border-t border-default"
              >
                <td class="max-w-80 px-5 py-2.5">
                  <div class="flex items-center gap-3">
                    <img
                      v-if="r.thumb"
                      :src="r.thumb"
                      alt=""
                      class="size-10 shrink-0 rounded-md object-cover"
                      loading="lazy"
                    >
                    <div class="min-w-0">
                      <b class="block truncate text-highlighted">{{ r.nama }}</b>
                      <span class="block truncate text-xs text-muted">{{ r.kampanye }}</span>
                    </div>
                    <UButton
                      v-if="r.permalink"
                      :to="r.permalink"
                      target="_blank"
                      icon="i-lucide-external-link"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      aria-label="Buka postingan"
                    />
                  </div>
                </td>
                <td class="px-3 py-2.5">
                  <AppStatus
                    :color="aktif(r) ? 'success' : 'neutral'"
                    :icon="aktif(r) ? 'i-lucide-play' : 'i-lucide-pause'"
                    size="sm"
                  >
                    {{ aktif(r) ? 'Aktif' : 'Berhenti' }}
                  </AppStatus>
                </td>
                <td class="px-3 py-2.5 text-right tabular-nums">
                  {{ rupiah(r.spend) }}
                </td>
                <td class="px-3 py-2.5 text-right tabular-nums">
                  {{ angka(r.hasil_n) }} <span class="block text-xs text-muted">{{ r.hasil_label || '–' }}</span>
                </td>
                <td class="px-3 py-2.5 text-right tabular-nums">
                  {{ cpr(r) == null ? '–' : rupiah(cpr(r)!) }}
                </td>
                <td class="px-3 py-2.5 text-right tabular-nums">
                  {{ r.ctr.toLocaleString('id-ID', { maximumFractionDigits: 2 }) }}%
                </td>
                <td class="px-3 py-2.5 text-right tabular-nums">
                  {{ r.frekuensi.toLocaleString('id-ID', { maximumFractionDigits: 1 }) }}
                </td>
                <td class="px-5 py-2.5">
                  <AppStatus
                    :color="nilai(r).color"
                    :icon="nilai(r).icon"
                    size="sm"
                  >
                    {{ nilai(r).label }}
                  </AppStatus>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="divide-y divide-default lg:hidden">
          <div
            v-for="r in tampil"
            :key="r.ad_id"
            class="space-y-2 p-4"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <b class="block truncate text-highlighted">{{ r.nama }}</b>
                <span class="block truncate text-xs text-muted">{{ r.kampanye }}</span>
              </div>
              <AppStatus
                :color="nilai(r).color"
                :icon="nilai(r).icon"
                size="sm"
              >
                {{ nilai(r).label }}
              </AppStatus>
            </div>
            <div class="grid grid-cols-3 gap-2 text-xs">
              <span><span class="block text-muted">Biaya</span><b class="tabular-nums">{{ rupiah(r.spend) }}</b></span>
              <span><span class="block text-muted">{{ r.hasil_label || 'Hasil' }}</span><b class="tabular-nums">{{ angka(r.hasil_n) }}</b></span>
              <span><span class="block text-muted">Per hasil</span><b class="tabular-nums">{{ cpr(r) == null ? '–' : rupiah(cpr(r)!) }}</b></span>
            </div>
          </div>
        </div>
        <p
          v-if="!tampil.length && !memuat"
          class="p-6 text-center text-sm text-muted"
        >
          {{ baris.length ? 'Tidak ada iklan yang cocok dengan filter.' : 'Belum ada data iklan. Tekan Sinkronkan.' }}
        </p>
      </AppPanel>
    </div>
  </AppPage>
</template>
