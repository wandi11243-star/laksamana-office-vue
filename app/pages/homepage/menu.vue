<!--
  Menu — the website's catalogue (laksamana-api docs/api/menu.md, Office).
  Built for the two jobs people do here most: flip an item to "Habis" during
  service, and keep names/prices/photos right. The quick switches (Tersedia,
  Tampil) write at once without a version; the star (Unggulan) is a versioned
  PATCH. Every write swaps in the row the API returns, so the next save carries
  the fresh version.
-->
<script setup lang="ts">
import type { KategoriBaris, MenuItem, MenuJenis, MenuKategori } from '~/composables/useHomepage'

definePageMeta({ access: ['menu'] })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const office = useMenuOffice()

const { data, status: muat, error, refresh } = useMenuState()

// Local copy so a toggle can update one row without reloading the lot.
const items = ref<MenuItem[]>([])
const kategori = ref<MenuKategori[]>([])
watch(data, (d) => {
  items.value = d?.item ? [...d.item] : []
  kategori.value = d?.kategori ? [...d.kategori] : []
}, { immediate: true })

function ganti(row: MenuItem) {
  const i = items.value.findIndex(x => x.id === row.id)
  if (i >= 0) items.value.splice(i, 1, row)
  else items.value.push(row)
}

// ─────────────────────────── filters ──

type Status = 'semua' | 'tampil' | 'draf' | 'habis' | 'unggulan' | 'tanpa-foto'
const STATUS: { value: Status, label: string }[] = [
  { value: 'semua', label: 'Semua status' },
  { value: 'tampil', label: 'Tampil di website' },
  { value: 'draf', label: 'Disembunyikan' },
  { value: 'habis', label: 'Habis' },
  { value: 'unggulan', label: 'Unggulan' },
  { value: 'tanpa-foto', label: 'Belum ada foto' },
]

const jenis = ref<MenuJenis>(route.query.jenis === 'minuman' ? 'minuman' : 'makanan')
const status = ref<Status>(STATUS.some(s => s.value === route.query.status) ? route.query.status as Status : 'semua')
const kat = ref<string | null>(null)
const q = ref(typeof route.query.q === 'string' ? route.query.q : '')

watch([jenis, status], () => {
  kat.value = null
  router.replace({ query: { ...route.query, jenis: jenis.value, status: status.value === 'semua' ? undefined : status.value } })
})

const jenisItem = (j: MenuJenis) => items.value.filter(i => i.jenis === j)

const cocokStatus = (i: MenuItem) => {
  switch (status.value) {
    case 'tampil': return i.tampil
    case 'draf': return !i.tampil
    case 'habis': return !i.tersedia
    case 'unggulan': return i.unggulan
    case 'tanpa-foto': return !i.foto_url
    default: return true
  }
}

const cari = computed(() => q.value.trim().toLowerCase())
const tersaring = computed(() => jenisItem(jenis.value).filter(i =>
  cocokStatus(i)
  && (!kat.value || i.kategori_id === kat.value)
  && (!cari.value || `${i.nama} ${i.komponen} ${i.deskripsi}`.toLowerCase().includes(cari.value)),
))

const kategoriJenis = computed(() => kategori.value
  .filter(k => k.jenis === jenis.value)
  .sort((a, b) => a.urutan - b.urutan || a.nama.localeCompare(b.nama)))

const chips = computed(() => kategoriJenis.value.map(k => ({
  ...k,
  jumlah: jenisItem(jenis.value).filter(i => i.kategori_id === k.id && cocokStatus(i)).length,
})))

const grup = computed(() => kategoriJenis.value
  .map(k => ({ k, rows: tersaring.value.filter(i => i.kategori_id === k.id).sort((a, b) => a.urutan - b.urutan || a.nama.localeCompare(b.nama)) }))
  .filter(g => g.rows.length))

// ─────────────────────────── summary ──

const ringkas = computed(() => {
  const semua = items.value
  return [
    { key: 'semua' as Status, label: 'Menu', value: String(semua.length) },
    { key: 'tampil' as Status, label: 'Tampil di website', value: String(semua.filter(i => i.tampil).length) },
    { key: 'habis' as Status, label: 'Habis sekarang', value: String(semua.filter(i => !i.tersedia).length), alert: semua.some(i => !i.tersedia) },
    { key: 'unggulan' as Status, label: 'Unggulan di beranda', value: `${Math.min(semua.filter(i => i.unggulan && i.tampil).length, SLOT_UNGGULAN)}/${SLOT_UNGGULAN}` },
  ]
})

const jumlahUnggulan = computed(() => items.value.filter(i => i.unggulan && i.tampil).length)

// ─────────────────────────── quick writes ──

const sibuk = ref<Record<string, boolean>>({})

async function toggle(row: MenuItem, field: 'tersedia' | 'tampil', nilai: boolean) {
  const lama = row[field]
  ganti({ ...row, [field]: nilai })
  sibuk.value[row.id] = true
  try {
    ganti(field === 'tersedia' ? await office.setTersedia(row.id, nilai) : await office.setTampil(row.id, nilai))
  }
  catch (e) {
    ganti({ ...row, [field]: lama })
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value[row.id] = false
  }
}

async function bintang(row: MenuItem) {
  sibuk.value[row.id] = true
  try {
    ganti(await office.updateItem(row.id, { unggulan: !row.unggulan }, ifMatch(row.version)))
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value[row.id] = false
  }
}

// ─────────────────────────── sheets ──

const formBuka = ref(false)
const dipilih = ref<MenuItem | null>(null)
function buka(row: MenuItem | null) {
  dipilih.value = row
  formBuka.value = true
}
function terhapus(id: string) {
  items.value = items.value.filter(i => i.id !== id)
}

const kategoriBuka = ref(false)
const kategoriBaris = computed<KategoriBaris[]>(() => kategoriJenis.value.map(k => ({
  ...k,
  jumlah: items.value.filter(i => i.kategori_id === k.id).length,
})))
const kategoriApi = {
  create: (nama: string) => office.createKategori({ nama, jenis: jenis.value }),
  update: office.updateKategori,
  remove: office.deleteKategori,
  urutan: (list: { id: string, urutan: number }[]) => office.urutan({ kategori: list }),
}
</script>

<template>
  <AppPage
    title="Menu"
    description="Katalog di halaman Menu website. Tandai yang habis, rapikan harga dan foto, pilih unggulan beranda."
  >
    <template #actions>
      <UButton
        label="Kategori"
        icon="i-lucide-tags"
        color="neutral"
        variant="outline"
        @click="kategoriBuka = true"
      />
      <UButton
        label="Tambah menu"
        icon="i-lucide-plus"
        @click="buka(null)"
      />
    </template>

    <div
      v-if="error"
      class="rounded-panel border border-default bg-default p-6 text-center"
    >
      <p class="font-semibold text-highlighted">
        Menu tidak bisa dimuat.
      </p>
      <p class="mt-1 text-sm text-muted">
        {{ apiErrorMessage(error) }}
      </p>
      <UButton
        label="Coba lagi"
        class="mt-4"
        @click="refresh()"
      />
    </div>

    <template v-else>
      <div class="mb-6 grid grid-cols-2 overflow-hidden rounded-panel border border-default bg-default sm:grid-cols-4">
        <button
          v-for="(s, i) in ringkas"
          :key="s.key"
          type="button"
          class="px-4 py-3.5 text-start transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
          :class="[
            i % 2 === 1 && 'border-s border-default',
            i >= 2 && 'border-t border-default sm:border-t-0',
            i === 2 && 'sm:border-s',
            status === s.key && s.key !== 'semua' && 'bg-yellow-light',
          ]"
          @click="status = s.key"
        >
          <span class="block text-xs font-semibold text-muted">
            {{ s.label }}
          </span>
          <span
            class="mt-0.5 block font-display text-2xl font-bold num"
            :class="s.alert ? 'text-error' : 'text-highlighted'"
          >
            {{ muat === 'pending' && !items.length ? '—' : s.value }}
          </span>
        </button>
      </div>

      <div class="mb-3 flex flex-wrap items-center gap-2">
        <AppSeg
          v-model="jenis"
          :options="[
            { value: 'makanan', label: `Makanan · ${jenisItem('makanan').length}` },
            { value: 'minuman', label: `Minuman · ${jenisItem('minuman').length}` },
          ]"
        />
        <UInput
          v-model="q"
          icon="i-lucide-search"
          placeholder="Cari nama atau komponen"
          class="min-w-48 flex-1 sm:max-w-72"
        />
        <USelect
          v-model="status"
          :items="STATUS"
          value-key="value"
          class="w-44"
          aria-label="Saring status"
        />
      </div>

      <div class="-mx-4 mb-6 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
        <div class="flex w-max gap-1.5 lg:w-auto lg:flex-wrap">
          <button
            type="button"
            class="shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors"
            :class="!kat ? 'border-yellow-deep bg-yellow-light text-yellow-dark' : 'border-default bg-default text-muted hover:text-highlighted'"
            @click="kat = null"
          >
            Semua kategori
          </button>
          <button
            v-for="c in chips"
            :key="c.id"
            type="button"
            class="shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors"
            :class="kat === c.id ? 'border-yellow-deep bg-yellow-light text-yellow-dark' : 'border-default bg-default text-muted hover:text-highlighted'"
            @click="kat = kat === c.id ? null : c.id"
          >
            <span :class="!c.aktif && 'line-through decoration-1'">{{ c.nama }}</span>
            <span class="ms-1 font-normal text-dimmed num">{{ c.jumlah }}</span>
          </button>
        </div>
      </div>

      <div
        v-if="muat === 'pending' && !items.length"
        class="space-y-2"
      >
        <USkeleton
          v-for="n in 5"
          :key="n"
          :ui="{ base: 'bg-accented/70' }"
          class="h-16 rounded-field"
        />
      </div>

      <div
        v-else-if="!items.length"
        class="rounded-panel border border-dashed border-accented bg-default px-6 py-12 text-center"
      >
        <UIcon
          name="i-lucide-utensils"
          class="size-8 text-dimmed"
        />
        <p class="mt-3 font-semibold text-highlighted">
          Belum ada menu
        </p>
        <p class="mx-auto mt-1 max-w-md text-sm text-muted">
          Selama katalog kosong, website menampilkan menu contoh. Tambahkan menu pertama dan tandai sampai enam sebagai unggulan untuk beranda.
        </p>
        <UButton
          label="Tambah menu"
          icon="i-lucide-plus"
          class="mt-5"
          @click="buka(null)"
        />
      </div>

      <p
        v-else-if="!grup.length"
        class="rounded-panel border border-default bg-default px-6 py-10 text-center text-sm text-muted"
      >
        Tidak ada menu yang cocok dengan saringan ini.
      </p>

      <section
        v-for="g in grup"
        :key="g.k.id"
        class="mb-7"
      >
        <header class="mb-2 flex items-baseline gap-2 px-1">
          <h2 class="font-display text-base font-bold text-highlighted">
            {{ g.k.nama }}
          </h2>
          <span class="text-sm text-muted num">{{ g.rows.length }}</span>
          <UBadge
            v-if="!g.k.aktif"
            label="Kategori disembunyikan"
            color="neutral"
            variant="soft"
            size="sm"
          />
        </header>

        <ul class="divide-y divide-default overflow-hidden rounded-panel border border-default bg-default">
          <li
            v-for="row in g.rows"
            :key="row.id"
            class="grid grid-cols-[56px_1fr_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 lg:grid-cols-[56px_minmax(0,1fr)_11rem_auto_auto_auto] lg:gap-x-5 lg:px-4"
          >
            <button
              type="button"
              class="row-span-2 size-14 overflow-hidden rounded-field bg-muted lg:row-span-1"
              :aria-label="`Ubah ${row.nama}`"
              @click="buka(row)"
            >
              <img
                v-if="row.foto_url"
                :src="apiFileUrl(row.foto_url)!"
                alt=""
                loading="lazy"
                class="size-full object-cover"
                :class="!row.tampil && 'opacity-50'"
              >
              <UIcon
                v-else
                name="i-lucide-image"
                class="size-5 text-dimmed"
              />
            </button>

            <button
              type="button"
              class="min-w-0 text-start"
              @click="buka(row)"
            >
              <span class="flex items-center gap-1.5">
                <span
                  class="truncate font-semibold"
                  :class="row.tampil ? 'text-highlighted' : 'text-muted'"
                >{{ row.nama }}</span>
                <UIcon
                  v-if="row.pedas"
                  name="i-lucide-flame"
                  class="size-3.5 shrink-0 text-error"
                />
                <UIcon
                  v-if="row.vegetarian"
                  name="i-lucide-leaf"
                  class="size-3.5 shrink-0 text-success"
                />
              </span>
              <span class="mt-0.5 block truncate text-xs text-muted">
                <template v-if="!row.tampil">Disembunyikan · </template>
                <template v-if="row.bagian">{{ BAGIAN_LABEL[row.bagian] }} · </template>{{ row.komponen || row.deskripsi || 'Belum ada keterangan' }}
              </span>
              <span class="mt-0.5 block text-sm font-semibold text-default num lg:hidden">{{ hargaRingkas(row.varian) }}</span>
            </button>

            <span class="hidden text-sm font-semibold num lg:block">{{ hargaRingkas(row.varian) }}</span>

            <UTooltip :text="row.unggulan ? 'Lepas dari Our Best Menu' : 'Jadikan unggulan beranda'">
              <UButton
                :icon="row.unggulan ? 'i-lucide-star' : 'i-lucide-star-off'"
                :color="row.unggulan ? 'primary' : 'neutral'"
                :variant="row.unggulan ? 'soft' : 'ghost'"
                size="sm"
                :aria-pressed="row.unggulan"
                :aria-label="row.unggulan ? `${row.nama}: unggulan` : `${row.nama}: bukan unggulan`"
                :disabled="sibuk[row.id]"
                class="justify-self-end lg:justify-self-auto"
                @click="bintang(row)"
              />
            </UTooltip>

            <div class="col-span-2 col-start-2 flex items-center gap-5 lg:contents">
              <label class="flex cursor-pointer items-center gap-2 text-sm">
                <USwitch
                  :model-value="row.tersedia"
                  :disabled="sibuk[row.id]"
                  color="success"
                  @update:model-value="toggle(row, 'tersedia', $event)"
                />
                <span
                  class="w-14 font-semibold"
                  :class="row.tersedia ? 'text-success' : 'text-error'"
                >{{ row.tersedia ? 'Tersedia' : 'Habis' }}</span>
              </label>
              <label class="flex cursor-pointer items-center gap-2 text-sm">
                <USwitch
                  :model-value="row.tampil"
                  :disabled="sibuk[row.id]"
                  @update:model-value="toggle(row, 'tampil', $event)"
                />
                <span class="w-12 text-muted">{{ row.tampil ? 'Tampil' : 'Draf' }}</span>
              </label>
            </div>
          </li>
        </ul>
      </section>
    </template>

    <HomepageMenuForm
      v-model:open="formBuka"
      :item="dipilih"
      :kategori="kategori"
      :kategori-awal="kat"
      :jenis-awal="jenis"
      :jumlah-unggulan="jumlahUnggulan"
      :muat-ulang="refresh"
      @tersimpan="ganti"
      @terhapus="terhapus"
    />

    <HomepageKategori
      v-model:open="kategoriBuka"
      :title="`Kategori ${JENIS_LABEL[jenis].toLowerCase()}`"
      description="Urutan di sini adalah urutan tab kategori di website."
      :rows="kategoriBaris"
      satuan="menu"
      :api="kategoriApi"
      :muat-ulang="refresh"
    />
  </AppPage>
</template>
