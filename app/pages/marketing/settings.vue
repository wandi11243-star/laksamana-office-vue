<!--
  Marketing › Pengaturan (docs/migrasi/marketing.md D.21, issue #63; old
  deploy/marketing/index.html:20220-20300, galeri venue :9118-9160).

  "Aturan bisnis, tarif & data." One table Pengaturan | Nilai | Keterangan,
  saved to `documents/settings` under its content hash (read-modify-write, so
  kwSeq and the gallery are never overwritten by a stale copy). The "Reset ke
  Data Contoh" card stays removed (it wiped the whole module).
  discountThreshold / baseline are no longer read.
-->
<script setup lang="ts">
import { FREE_TEMPLATE_BAWAAN } from '~/utils/marketing-uang'
import { SETTING_MKT_BAWAAN, namaRoleMkt } from '~/utils/marketing'
import { apiErrorMessage } from '~/composables/useApi'

definePageMeta({ access: ['marketing'] })

const toast = useToast()
const { data: st } = useStateMkt()
const { saya } = useAksesMkt()

const f = ref({ dpPercent: 0, pb1: 0, serviceCharge: 0, fuTarget: 0, fuNextDays: 3, freeTemplate: '', kwPrefix: '', waBooking: '' })
watch(() => st.value.settings, (s) => {
  f.value = {
    dpPercent: Number(s.dpPercent) || 0,
    pb1: Number(s.pb1) || 0,
    serviceCharge: Number(s.serviceCharge) || 0,
    fuTarget: Number(s.fuTarget) || 0,
    fuNextDays: Number(s.fuNextDays) || 3,
    freeTemplate: String(s.freeTemplate || FREE_TEMPLATE_BAWAAN),
    kwPrefix: String(s.kwPrefix ?? ''),
    waBooking: String(s.waBooking ?? ''),
  }
}, { immediate: true })
const kwBerikut = computed(() => `${f.value.kwPrefix}${String(Math.max(1, Number(st.value.settings.kwSeq) || 1)).padStart(4, '0')}`)

const sibuk = ref(false)
async function simpan() {
  sibuk.value = true
  const nilai = {
    dpPercent: Number(f.value.dpPercent) || 0,
    pb1: Number(f.value.pb1) || 0,
    serviceCharge: Number(f.value.serviceCharge) || 0,
    fuTarget: Number(f.value.fuTarget) || 0,
    fuNextDays: Number(f.value.fuNextDays) || 3,
    kwPrefix: f.value.kwPrefix,
    waBooking: f.value.waBooking,
    freeTemplate: f.value.freeTemplate,
  }
  await mktSimpan(() => tulisDokumenMkt<Record<string, unknown>>('settings', lama => ({ ...SETTING_MKT_BAWAAN, ...(lama ?? {}), ...nilai })), 'Pengaturan diperbarui')
  sibuk.value = false
}

// ---- Galeri Venue (settings.venueGallery, shown in every Draft Negotiation)
interface FotoVenue { key: string, name?: string, size?: number, at?: string, by?: string }
const galeri = computed<FotoVenue[]>(() => (Array.isArray(st.value.settings.venueGallery) ? st.value.settings.venueGallery as FotoVenue[] : []))
// The files endpoint needs the Bearer token, so an <img src> cannot load it directly: fetch → blob URL, once per key.
const gambar = ref<Record<string, string>>({})
watch(galeri, async (list) => {
  for (const g of list) {
    if (gambar.value[g.key]) continue
    gambar.value = { ...gambar.value, [g.key]: '' }
    try {
      const b = await useApi()<Blob>(`/marketing/files/${encodeURIComponent(g.key)}`, { responseType: 'blob' })
      gambar.value = { ...gambar.value, [g.key]: URL.createObjectURL(b) }
    }
    catch {
      gambar.value = { ...gambar.value, [g.key]: 'gagal' }
    }
  }
}, { immediate: true })
onBeforeUnmount(() => {
  for (const u of Object.values(gambar.value)) if (u.startsWith('blob:')) URL.revokeObjectURL(u)
})

const unggah = ref(false)
const masukan = ref<HTMLInputElement | null>(null)
async function tambahFoto(ev: Event) {
  const el = ev.target as HTMLInputElement
  const files = [...(el.files ?? [])]
  el.value = ''
  if (!files.length) return
  unggah.value = true
  const baru: FotoVenue[] = []
  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      toast.add({ title: 'Harus gambar', description: `${file.name} bukan file gambar.`, color: 'error' })
      continue
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.add({ title: 'File terlalu besar', description: `${file.name} lebih dari 8MB.`, color: 'error' })
      continue
    }
    try {
      const r = await unggahBerkasMkt({ dataBase64: await berkasKeBase64(file), fileName: file.name, mimeType: file.type })
      baru.push({ key: r.data.key, name: file.name, size: file.size, at: new Date().toISOString(), by: saya.value?.user.name ?? '' })
    }
    catch (e) {
      toast.add({ title: 'Gagal unggah', description: `${file.name}: ${apiErrorMessage(e)}`, color: 'error' })
    }
  }
  if (baru.length) {
    await mktSimpan(() => tulisDokumenMkt<Record<string, unknown>>('settings', (lama) => {
      const s = { ...SETTING_MKT_BAWAAN, ...(lama ?? {}) } as Record<string, unknown>
      return { ...s, venueGallery: [...(Array.isArray(s.venueGallery) ? s.venueGallery : []), ...baru] }
    }), `${baru.length} foto ditambahkan ke galeri penawaran`)
  }
  unggah.value = false
}

const hapus = ref<FotoVenue | null>(null)
async function hapusFoto() {
  const g = hapus.value
  if (!g) return
  const ok = await mktSimpan(() => tulisDokumenMkt<Record<string, unknown>>('settings', (lama) => {
    const s = { ...SETTING_MKT_BAWAAN, ...(lama ?? {}) } as Record<string, unknown>
    return { ...s, venueGallery: (Array.isArray(s.venueGallery) ? s.venueGallery as FotoVenue[] : []).filter(x => x.key !== g.key) }
  }), 'Foto dihapus')
  if (ok) hapus.value = null
}

const POIN = ['DP 30% vs 50%', 'Tarif pajak & service final', 'Integrasi POS in-scope?', 'Payment gateway vs manual', 'Ambang approval nominal/diskon', 'E-signature vs basah', 'Warna kalender kategori tambahan', 'Struktur approval (siapa)', 'Prioritas fasing 1–3']
</script>

<template>
  <AppPage
    title="Pengaturan"
    description="Aturan bisnis, tarif & data. Angka bisa dikalibrasi ulang setelah 2–3 bulan data aktual."
  >
    <MarketingGerbang layar="settings">
      <div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <AppPanel
          title="Aturan bisnis & tarif"
          icon="i-lucide-sliders-horizontal"
          flush
        >
          <div class="divide-y divide-default">
            <div class="grid gap-2 px-4 py-3 md:grid-cols-[12rem_10rem_minmax(0,1fr)] md:items-start">
              <b class="text-sm text-highlighted">DP default (%)</b>
              <UInput
                v-model.number="f.dpPercent"
                type="number"
              />
              <p class="text-xs text-muted">
                Cadangan saja. DP tiap event sekarang diisi NOMINAL rupiah di tab Finance; persentase ini hanya dipakai kalau nominalnya dikosongkan.
              </p>
            </div>
            <div class="grid gap-2 px-4 py-3 md:grid-cols-[12rem_10rem_minmax(0,1fr)] md:items-start">
              <b class="text-sm text-highlighted">PB1 / pajak (%)</b>
              <UInput
                v-model.number="f.pb1"
                type="number"
              />
              <p class="text-xs text-muted">
                Dihitung dari subtotal setelah diskon + service charge.
              </p>
            </div>
            <div class="grid gap-2 px-4 py-3 md:grid-cols-[12rem_10rem_minmax(0,1fr)] md:items-start">
              <b class="text-sm text-highlighted">Service charge (%)</b>
              <UInput
                v-model.number="f.serviceCharge"
                type="number"
              />
              <p class="text-xs text-muted">
                Dihitung dari subtotal setelah diskon.
              </p>
            </div>
            <div class="grid gap-2 px-4 py-3 md:grid-cols-[12rem_10rem_minmax(0,1fr)] md:items-start">
              <b class="text-sm text-highlighted">Target follow up / hari</b>
              <UInput
                v-model.number="f.fuTarget"
                type="number"
              />
              <p class="text-xs text-muted">
                Dipakai di Dashboard & Sales Pipeline untuk mengukur target harian marketing.
              </p>
            </div>
            <div class="grid gap-2 px-4 py-3 md:grid-cols-[12rem_10rem_minmax(0,1fr)] md:items-start">
              <b class="text-sm text-highlighted">Jeda follow up berikutnya (hari)</b>
              <UInput
                v-model.number="f.fuNextDays"
                type="number"
              />
              <p class="text-xs text-muted">
                Tanggal FU berikutnya diisi otomatis sejauh ini dari hari catat.
              </p>
            </div>
            <div class="grid gap-2 px-4 py-3 md:grid-cols-[12rem_minmax(0,1fr)] md:items-start">
              <b class="text-sm text-highlighted">Template fasilitas FREE</b>
              <div>
                <UTextarea
                  v-model="f.freeTemplate"
                  :rows="5"
                  autoresize
                  class="w-full"
                />
                <p class="mt-1 text-xs text-muted">
                  Satu baris satu fasilitas, muncul di penawaran bertuliskan FREE. Penanda <b>{jika-sewa-gratis}</b> / <b>{jika-teknis-gratis}</b> membuat barisnya hilang sendiri kalau komponen itu ternyata ditagihkan.
                  Bisa ditimpa per event di tab Finance.
                </p>
              </div>
            </div>
            <div class="grid gap-2 px-4 py-3 md:grid-cols-[12rem_10rem_minmax(0,1fr)] md:items-start">
              <b class="text-sm text-highlighted">Prefix kwitansi</b>
              <UInput v-model="f.kwPrefix" />
              <p class="text-xs text-muted">
                Penanda tiap baris pembayaran di riwayat — bukan nomor invoice resmi (itu diterbitkan Finance). Berikutnya: <em class="num">{{ kwBerikut }}</em>
              </p>
            </div>
            <div class="grid gap-2 px-4 py-3 md:grid-cols-[12rem_10rem_minmax(0,1fr)] md:items-start">
              <b class="text-sm text-highlighted">WA booking</b>
              <UInput
                v-model="f.waBooking"
                inputmode="tel"
              />
              <p class="text-xs text-muted">
                Nomor WhatsApp yang dicantumkan pada quotation & brief versi client.
              </p>
            </div>
          </div>
          <div class="flex justify-end border-t border-default px-4 py-3">
            <UButton
              icon="i-lucide-check"
              label="Simpan pengaturan"
              :loading="sibuk"
              @click="simpan"
            />
          </div>
        </AppPanel>

        <div class="space-y-4">
          <AppPanel
            title="Akun aktif"
            icon="i-lucide-user"
          >
            <div class="flex items-center gap-3">
              <UAvatar
                :text="String(saya?.user.name || '?')[0]"
                size="lg"
              />
              <div class="min-w-0">
                <b class="block truncate text-highlighted">{{ saya?.user.name }}</b>
                <span class="text-xs text-muted">{{ namaRoleMkt(saya?.user.role) }}{{ saya?.user.div ? ` · ${saya.user.div}` : '' }}</span>
              </div>
            </div>
            <UButton
              icon="i-lucide-log-out"
              label="Keluar ke Office"
              color="neutral"
              variant="outline"
              to="/"
              class="mt-3"
            />
          </AppPanel>

          <AppPanel
            title="Perlu konfirmasi (PRD bagian 14)"
            icon="i-lucide-list-checks"
          >
            <ol class="space-y-1.5 text-sm">
              <li
                v-for="(p, i) in POIN"
                :key="p"
                class="flex gap-2 border-b border-default pb-1.5 last:border-0"
              >
                <UBadge
                  :label="String(i + 1)"
                  color="neutral"
                  variant="soft"
                />{{ p }}
              </li>
            </ol>
          </AppPanel>
        </div>
      </div>

      <AppPanel
        title="Galeri venue"
        description="Draft Negotiation"
        icon="i-lucide-images"
        :count="galeri.length"
      >
        <p class="text-sm text-muted">
          Foto venue — mis. full house saat konser, panggung, suasana malam, penyesuaian layout. Tampil di <b>Draft Negotiation</b> sebagai bahan saat menyusun Surat Penawaran. Maks 8MB/foto.
        </p>
        <p
          v-if="!galeri.length"
          class="mt-3 text-sm text-dimmed"
        >
          Belum ada foto venue. Upload foto agar tampil di setiap Draft Negotiation.
        </p>
        <div
          v-else
          class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          <figure
            v-for="g in galeri"
            :key="g.key"
            class="relative overflow-hidden rounded-field border border-default"
          >
            <img
              v-if="gambar[g.key] && gambar[g.key] !== 'gagal'"
              :src="gambar[g.key]"
              :alt="g.name || 'venue'"
              class="aspect-video w-full object-cover"
            >
            <div
              v-else
              class="flex aspect-video items-center justify-center bg-muted text-xs text-dimmed"
            >
              {{ gambar[g.key] === 'gagal' ? 'Gambar tidak terbaca' : 'Memuat…' }}
            </div>
            <figcaption class="truncate px-2 py-1 text-xs text-muted">
              {{ g.name || g.key }}
            </figcaption>
            <UButton
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="solid"
              class="absolute right-1 top-1"
              title="Hapus foto"
              @click="hapus = g"
            />
          </figure>
        </div>
        <UButton
          icon="i-lucide-plus"
          label="Tambah foto venue"
          color="neutral"
          variant="outline"
          class="mt-3"
          :loading="unggah"
          @click="masukan?.click()"
        />
        <input
          ref="masukan"
          type="file"
          accept="image/*"
          multiple
          hidden
          @change="tambahFoto"
        >
      </AppPanel>

      <ResponsiveSheet
        :open="!!hapus"
        title="Hapus foto venue?"
        :description="`Hapus foto &quot;${hapus?.name || hapus?.key || ''}&quot; dari galeri venue?`"
        @update:open="v => { if (!v) hapus = null }"
      >
        <template #footer>
          <UButton
            color="neutral"
            variant="outline"
            label="Batal"
            @click="hapus = null"
          />
          <UButton
            color="error"
            label="Hapus"
            @click="hapusFoto"
          />
        </template>
      </ResponsiveSheet>
    </MarketingGerbang>
  </AppPage>
</template>
