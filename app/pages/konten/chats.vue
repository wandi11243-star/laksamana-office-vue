<!--
  Konten › Report Percakapan (old VIEWS.chats, deploy/konten/index.html:
  3938-4127; konten.md D.16). Which ads are "top" from TWO sides that often
  disagree: most chats, and cheapest per chat — plus which video.

  Month filter = the ad's START month, same rule as Ads Management. Cost per
  chat = spending incl. VAT ÷ chats, withheld when either is 0; the combined
  figure counts only ads that produced chats; ads with chats but no spending
  are named and kept out of "cheapest" (F.17). Clicking an ad opens its form.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { GrupChat, IklanKonten, UrutChat } from '~/utils/promosi-konten'
import {
  ADS_TANPA_TGL, CHAT_URUT, biayaChat, biayaGrup, bulanIklan, danaKeluarIklan, labelBulanIklan, platformVideo, rapikanVideo, rekapChat, urutChat,
} from '~/utils/promosi-konten'
import { angka, rupiah } from '~/utils/format'

definePageMeta({ access: ['konten'] })

const { data: st, error, status } = useStateKonten()
const brand = useBrandKonten()

/** First-load skeleton for the four chat-cost cards below: skeleton cells
 *  stand in until the first state lands. Refetch keeps old numbers, so the
 *  cards never blank. */
const statMemuat = computed(() => !st.value.ads.length && (status.value === 'pending' || status.value === 'idle'))
const pil = useState('konten-chats', () => ({ bulan: '', urut: 'chats' as UrutChat }))

const scope = computed(() => saringBrand(st.value.ads, brand.value))
const SEMUA = '__semua'
const opsiBulan = computed(() => [
  { value: SEMUA, label: 'Semua bulan' },
  ...[...new Set(scope.value.map(bulanIklan).filter(b => b && b !== ADS_TANPA_TGL))].sort().reverse().map(b => ({ value: b, label: labelBulanIklan(b) })),
])
const bulan = computed({
  get: () => pil.value.bulan || SEMUA,
  set: (v: string) => {
    pil.value.bulan = v === SEMUA ? '' : v
  },
})
const list = computed(() => (pil.value.bulan ? scope.value.filter(a => bulanIklan(a) === pil.value.bulan) : scope.value))
const r = computed(() => rekapChat(list.value))

const opsiUrut = (Object.keys(CHAT_URUT) as UrutChat[]).map(k => ({ value: k, label: CHAT_URUT[k].t }))
const urut = computed({
  get: () => pil.value.urut,
  set: (v: UrutChat) => {
    pil.value.urut = v
  },
})
const peringkat = computed(() => urutChat(pil.value.urut === 'murah' ? r.value.bisaMurah : r.value.berchat, pil.value.urut))
const hal = useState('konten-chats-hal', () => 1)
const per = useState('konten-chats-per', () => 10)
watch([pil, brand], () => {
  hal.value = 1
}, { deep: true })
const halaman = computed(() => peringkat.value.slice((hal.value - 1) * per.value, hal.value * per.value))

const rp = (v: number | null) => (v == null ? '—' : rupiah(Math.round(v)))
const namaBrand = (id?: string) => st.value.brands.find(b => b.id === id)?.name.split(' (')[0] ?? '-'

const R = { th: 'text-right', td: 'text-right' }
const kolom: TableColumn<IklanKonten>[] = [
  { id: 'no', header: '#' },
  { id: 'nama', header: 'Nama iklan' },
  { accessorKey: 'platform', header: 'Platform' },
  { id: 'brand', header: 'Brand' },
  { id: 'video', header: 'Video' },
  { id: 'chats', header: 'Chats', meta: { class: R } },
  { id: 'dana', header: 'Dana keluar', meta: { class: R } },
  { id: 'bpc', header: 'Biaya / chat', meta: { class: R } },
]
const kolomGrup = (nama: string): TableColumn<GrupChat>[] => [
  { id: 'key', header: nama },
  { id: 'n', header: 'Iklan', meta: { class: R } },
  { id: 'chats', header: 'Chats', meta: { class: R } },
  { id: 'bpc', header: 'Biaya / chat', meta: { class: R } },
]

const iklanBuka = ref(false)
const iklanId = ref('')
const iklanItem = computed(() => st.value.ads.find(a => a.id === iklanId.value) ?? null)
function buka(a: IklanKonten) {
  iklanId.value = a.id
  iklanBuka.value = true
}
</script>

<template>
  <KontenGerbang lihat="chats">
    <AppPage
      title="Report Percakapan"
      description="Rekap chat / percakapan hasil dari iklan"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
      />

      <KontenBrandBar :brands="st.brands" />

      <AppPanel>
        <div class="flex flex-wrap items-center gap-3">
          <USelect
            v-model="bulan"
            :items="opsiBulan"
            aria-label="Pilih bulan"
            class="w-full sm:w-56"
          />
          <span class="text-xs text-muted">Bulan diambil dari <b>tanggal iklan mulai jalan</b> — sama dengan rekap di Ads Management.</span>
        </div>
      </AppPanel>

      <AppStatGrid
        :loading="statMemuat"
        :count="4"
      >
        <AppStat
          label="Total percakapan"
          :value="angka(r.totChats)"
          :sub="`dari ${r.berchat.length} iklan yang menghasilkan chat`"
          tone="info"
        />
        <AppStat
          label="Dana keluar"
          :value="rupiah(r.totDana)"
          sub="hanya iklan yang menghasilkan chat, sudah termasuk PPN 11%"
          tone="error"
        />
        <AppStat
          label="Biaya per chat"
          :value="rp(r.bpc)"
          :sub="r.bpc == null ? 'belum ada chat atau dana keluarnya belum diisi' : 'gabungan — makin kecil makin murah'"
        />
        <AppStat
          label="Iklan menghasilkan chat"
          :value="angka(r.berchat.length)"
          :sub="list.length ? `dari ${list.length} iklan pada periode ini` : 'belum ada iklan'"
          tone="success"
        />
      </AppStatGrid>

      <AppPanel
        v-if="r.berchat.length"
        title="Yang paling top"
        icon="i-lucide-trophy"
        description="Dua sisi yang sering tidak sama."
      >
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-lg border border-default p-3">
            <p class="text-xs font-semibold text-muted">
              Chat terbanyak
            </p>
            <p class="mt-1 font-semibold">
              {{ r.topChat?.name || '(tanpa nama)' }}
            </p>
            <p class="text-xs text-muted">
              <b>{{ angka(r.topChat?.chats ?? 0) }}</b> chat · {{ rp(r.topChat ? biayaChat(r.topChat) : null) }} per chat
            </p>
          </div>
          <div class="rounded-lg border border-default p-3">
            <p class="text-xs font-semibold text-muted">
              Biaya per chat termurah
            </p>
            <p class="mt-1 font-semibold">
              {{ r.topMurah ? (r.topMurah.name || '(tanpa nama)') : '—' }}
            </p>
            <p class="text-xs text-muted">
              <template v-if="r.topMurah">
                <b>{{ rp(biayaChat(r.topMurah)) }}</b> per chat · {{ angka(r.topMurah.chats ?? 0) }} chat
              </template>
              <template v-else>
                belum ada iklan yang punya chat DAN dana keluar sekaligus
              </template>
            </p>
          </div>
          <div class="rounded-lg border border-default p-3">
            <p class="text-xs font-semibold text-muted">
              Video paling banyak chat
            </p>
            <UButton
              v-if="r.topVideo"
              :to="r.topVideo.url"
              target="_blank"
              :label="platformVideo(r.topVideo.url) ?? 'Tautan'"
              icon="i-lucide-play"
              size="xs"
              color="neutral"
              variant="soft"
              class="mt-1"
            />
            <p
              v-else
              class="mt-1 font-semibold"
            >
              —
            </p>
            <p class="text-xs text-muted">
              <template v-if="r.topVideo">
                <b>{{ angka(r.topVideo.chats) }}</b> chat dari {{ r.topVideo.n }} iklan
              </template>
              <template v-else>
                belum ada iklan berchat yang diisi link videonya
              </template>
            </p>
          </div>
        </div>
        <p class="mt-3 text-xs text-muted">
          Yang paling banyak chat <b>belum tentu</b> yang paling murah — iklan berbudget besar hampir selalu menang di kolom
          jumlah. Yang dipakai memutuskan anggaran biasanya kolom <b>biaya per chat</b>.
        </p>
      </AppPanel>

      <UAlert
        v-if="r.tanpaDana.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`${r.tanpaDana.length} iklan punya chat tapi dana keluarnya belum diisi`"
        description="Biaya per chatnya tidak dihitung dan iklan itu tidak ikut di peringkat termurah — dihitung, ia akan selalu menang dengan Rp0 per chat. Isi rinciannya lewat Ads Management → rincian dana keluar."
        class="mb-5"
      />

      <AppPanel
        title="Peringkat iklan"
        icon="i-lucide-message-circle"
        :description="`Total: ${angka(r.totChats)} chat`"
        flush
      >
        <div class="space-y-2 border-b border-default p-4">
          <AppSeg
            v-model="urut"
            :options="opsiUrut"
            size="sm"
          />
          <p class="text-xs text-muted">
            Diurut menurut <b>{{ CHAT_URUT[pil.urut].t }}</b>.
            <template v-if="pil.urut === 'murah'">
              Yang ditampilkan hanya iklan yang punya chat DAN dana keluar — sisanya tidak punya biaya per chat yang bisa dihitung.
            </template>
          </p>
        </div>
        <div
          v-if="!peringkat.length"
          class="p-8 text-center"
        >
          <UIcon
            name="i-lucide-message-circle"
            class="mx-auto size-7 text-dimmed"
          />
          <p class="mt-2 font-semibold">
            Belum ada percakapan
          </p>
          <p class="text-sm text-muted">
            Isi kolom "Hasil - chats" saat buat iklan agar tercatat di sini.
          </p>
        </div>
        <template v-else>
          <UTable
            class="hidden lg:block"
            :data="halaman"
            :columns="kolom"
            :ui="{ th: 'px-2.5 whitespace-normal leading-tight', td: 'px-2.5 py-2 text-[13px]' }"
          >
            <template #no-cell="{ row }">
              <span class="font-display text-lg text-primary-700">{{ (hal - 1) * per + row.index + 1 }}</span>
            </template>
            <template #nama-cell="{ row }">
              <button
                type="button"
                class="text-left"
                @click="buka(row.original)"
              >
                <b class="text-highlighted">{{ row.original.name || '(tanpa nama)' }}</b>
                <span class="block text-xs text-muted">{{ row.original.target }}</span>
              </button>
            </template>
            <template #brand-cell="{ row }">
              {{ namaBrand(row.original.brand) }}
            </template>
            <template #video-cell="{ row }">
              <UButton
                v-if="platformVideo(row.original.videoUrl)"
                :to="rapikanVideo(row.original.videoUrl) || undefined"
                target="_blank"
                :label="platformVideo(row.original.videoUrl)!"
                icon="i-lucide-play"
                size="xs"
                color="neutral"
                variant="soft"
              />
              <span
                v-else
                class="text-dimmed"
              >—</span>
            </template>
            <template #chats-cell="{ row }">
              <b class="num text-info">{{ angka(row.original.chats ?? 0) }}</b>
            </template>
            <template #dana-cell="{ row }">
              <span class="num text-error">{{ rupiah(danaKeluarIklan(row.original)) }}</span>
            </template>
            <template #bpc-cell="{ row }">
              <b class="num">{{ rp(biayaChat(row.original)) }}</b>
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="(a, i) in halaman"
              :key="a.id"
            >
              <button
                type="button"
                class="block w-full p-4 text-left"
                @click="buka(a)"
              >
                <span class="flex items-start justify-between gap-2">
                  <b class="min-w-0 text-highlighted">{{ (hal - 1) * per + i + 1 }}. {{ a.name || '(tanpa nama)' }}</b>
                  <b class="num shrink-0 text-info">{{ angka(a.chats ?? 0) }} chat</b>
                </span>
                <span class="block text-xs text-muted">{{ [a.platform, namaBrand(a.brand), platformVideo(a.videoUrl)].filter(Boolean).join(' · ') }}</span>
                <span class="num block text-xs text-muted">{{ rupiah(danaKeluarIklan(a)) }} · {{ rp(biayaChat(a)) }} per chat</span>
              </button>
            </li>
          </ul>
          <KontenPager
            v-model:hal="hal"
            v-model:per="per"
            :total="peringkat.length"
            satuan="iklan"
          />
        </template>
      </AppPanel>

      <div class="grid items-start gap-4 lg:grid-cols-2">
        <AppPanel
          title="Per video yang dipromosikan"
          icon="i-lucide-play"
          description="Satu video bisa didorong beberapa iklan sekaligus; chatnya digabung di sini. Iklan yang link videonya belum diisi berdiri di barisnya sendiri — ia tidak ditebak dari nama iklannya."
          flush
        >
          <p
            v-if="!r.perVideo.length"
            class="p-6 text-center text-sm text-muted"
          >
            Belum ada iklan pada periode ini.
          </p>
          <UTable
            v-else
            :data="r.perVideo"
            :columns="kolomGrup('Video')"
            :ui="{ th: 'px-2.5 whitespace-normal leading-tight', td: 'px-2.5 py-2 text-[13px]' }"
          >
            <template #key-cell="{ row }">
              <template v-if="row.original.url">
                <UButton
                  :to="row.original.url"
                  target="_blank"
                  :label="platformVideo(row.original.url) ?? 'Tautan'"
                  icon="i-lucide-play"
                  size="xs"
                  color="neutral"
                  variant="soft"
                />
                <span class="block max-w-64 break-all text-[11px] text-muted">{{ row.original.url }}</span>
              </template>
              <span
                v-else
                class="text-xs text-warning"
              >(tanpa link video)</span>
            </template>
            <template #n-cell="{ row }">
              <span class="num">{{ row.original.n }}</span>
            </template>
            <template #chats-cell="{ row }">
              <b class="num text-info">{{ angka(row.original.chats) }}</b>
            </template>
            <template #bpc-cell="{ row }">
              <span class="num">{{ rp(biayaGrup(row.original)) }}</span>
            </template>
          </UTable>
        </AppPanel>
        <AppPanel
          title="Per platform iklan"
          icon="i-lucide-chart-bar"
          description="Platform tempat iklannya dipasang — beda dari platform videonya, yang dibaca dari tautannya sendiri."
          flush
        >
          <p
            v-if="!r.perPlat.length"
            class="p-6 text-center text-sm text-muted"
          >
            Belum ada iklan pada periode ini.
          </p>
          <UTable
            v-else
            :data="r.perPlat"
            :columns="kolomGrup('Platform')"
            :ui="{ th: 'px-2.5 whitespace-normal leading-tight', td: 'px-2.5 py-2 text-[13px]' }"
          >
            <template #key-cell="{ row }">
              <UBadge
                :label="row.original.key"
                color="neutral"
                variant="soft"
                size="sm"
              />
            </template>
            <template #n-cell="{ row }">
              <span class="num">{{ row.original.n }}</span>
            </template>
            <template #chats-cell="{ row }">
              <b class="num text-info">{{ angka(row.original.chats) }}</b>
            </template>
            <template #bpc-cell="{ row }">
              <span class="num">{{ rp(biayaGrup(row.original)) }}</span>
            </template>
          </UTable>
        </AppPanel>
      </div>

      <KontenIklanForm
        v-model:open="iklanBuka"
        :iklan="iklanItem"
      />
    </AppPage>
  </KontenGerbang>
</template>
