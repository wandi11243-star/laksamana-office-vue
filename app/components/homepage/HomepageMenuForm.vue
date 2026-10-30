<!--
  Add or edit one menu item. Laid out in the order a person fills it in: what
  it is (photo, name, category), what it costs (one price or several sizes),
  how it is described on the website, then its labels and status. The photo
  uploads on pick; everything else is written on Simpan with the item's
  version (If-Match). A `varian` list sent replaces the whole set.
-->
<script setup lang="ts">
import type { MenuBagian, MenuItem, MenuItemBody, MenuJenis, MenuKategori } from '~/composables/useHomepage'

const props = defineProps<{
  item: MenuItem | null
  kategori: MenuKategori[]
  /** Pre-selected category for a new item (the one being browsed). */
  kategoriAwal?: string | null
  jenisAwal?: MenuJenis
  /** Featured items already on the homepage, for the "6 slots" hint. */
  jumlahUnggulan: number
  muatUlang: () => Promise<unknown>
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ tersimpan: [MenuItem], terhapus: [string] }>()

const toast = useToast()
const office = useMenuOffice()

const kosong = () => ({
  foto_key: null as string | null,
  nama: '',
  kategori_id: '',
  bagian: 'main_course' as MenuBagian,
  deskripsi: '',
  komponen: '',
  varian: [{ label: '', harga: 0 }] as { label: string, harga: number }[],
  unggulan: false,
  rekomendasi: false,
  pedas: false,
  vegetarian: false,
  ramah_anak: false,
  tampil: true,
  tersedia: true,
  catatan_internal: '',
})
const form = reactive(kosong())
const menyimpan = ref(false)
const mengunggah = ref(false)
const yakinHapus = ref(false)

watch(open, (buka) => {
  if (!buka) return
  yakinHapus.value = false
  const i = props.item
  Object.assign(form, kosong())
  if (i) {
    Object.assign(form, {
      foto_key: fotoKeyDari(i.foto_url),
      nama: i.nama,
      kategori_id: i.kategori_id,
      bagian: i.bagian ?? 'main_course',
      deskripsi: i.deskripsi,
      komponen: i.komponen,
      varian: i.varian.length ? i.varian.map(v => ({ label: v.label, harga: v.harga })) : [{ label: '', harga: 0 }],
      unggulan: i.unggulan,
      rekomendasi: i.rekomendasi,
      pedas: i.pedas,
      vegetarian: i.vegetarian,
      ramah_anak: i.ramah_anak,
      tampil: i.tampil,
      tersedia: i.tersedia,
      catatan_internal: i.catatan_internal,
    })
  }
  else {
    const awal = props.kategori.find(k => k.id === props.kategoriAwal)
      ?? props.kategori.find(k => k.jenis === props.jenisAwal)
    form.kategori_id = awal?.id ?? ''
  }
})

const kategoriDipilih = computed(() => props.kategori.find(k => k.id === form.kategori_id))
const makanan = computed(() => kategoriDipilih.value?.jenis === 'makanan')

const opsiKategori = computed(() => (['makanan', 'minuman'] as MenuJenis[]).flatMap(j => [
  { type: 'label' as const, label: JENIS_LABEL[j] },
  ...props.kategori
    .filter(k => k.jenis === j)
    .sort((a, b) => a.urutan - b.urutan)
    .map(k => ({ label: k.aktif ? k.nama : `${k.nama} (disembunyikan)`, value: k.id })),
]))

const LABEL = [
  { key: 'unggulan', label: 'Unggulan', icon: 'i-lucide-star' },
  { key: 'rekomendasi', label: 'Rekomendasi', icon: 'i-lucide-thumbs-up' },
  { key: 'pedas', label: 'Pedas', icon: 'i-lucide-flame' },
  { key: 'vegetarian', label: 'Vegetarian', icon: 'i-lucide-leaf' },
  { key: 'ramah_anak', label: 'Ramah anak', icon: 'i-lucide-baby' },
] as const

const unggulanLain = computed(() => props.jumlahUnggulan - (props.item?.unggulan ? 1 : 0))

function tambahVarian() {
  form.varian.push({ label: '', harga: 0 })
}
function hapusVarian(i: number) {
  form.varian.splice(i, 1)
  if (!form.varian.length) form.varian.push({ label: '', harga: 0 })
}

async function simpan() {
  if (!form.nama.trim()) {
    toast.add({ title: 'Nama menu wajib diisi.', color: 'error' })
    return
  }
  if (!form.kategori_id) {
    toast.add({ title: 'Pilih kategori.', color: 'error' })
    return
  }
  const varian = form.varian
    .map(v => ({ label: v.label.trim(), harga: Math.max(0, Math.round(Number(v.harga) || 0)) }))
    .filter(v => v.label || v.harga > 0)
  const body: MenuItemBody = {
    nama: form.nama.trim(),
    kategori_id: form.kategori_id,
    bagian: makanan.value ? form.bagian : null,
    deskripsi: form.deskripsi.trim(),
    komponen: form.komponen.trim(),
    foto_key: form.foto_key,
    varian,
    unggulan: form.unggulan,
    rekomendasi: form.rekomendasi,
    pedas: form.pedas,
    vegetarian: form.vegetarian,
    ramah_anak: form.ramah_anak,
    tampil: form.tampil,
    tersedia: form.tersedia,
    catatan_internal: form.catatan_internal.trim(),
  }
  menyimpan.value = true
  try {
    const hasil = props.item
      ? await office.updateItem(props.item.id, body, ifMatch(props.item.version))
      : await office.createItem(body)
    emit('tersimpan', hasil)
    toast.add({ title: props.item ? 'Menu disimpan' : 'Menu ditambahkan', color: 'success' })
    open.value = false
  }
  catch (e) {
    if (await tanganiKonflik(e, props.muatUlang)) open.value = false
    else toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}

async function hapus() {
  if (!props.item) return
  if (!yakinHapus.value) {
    yakinHapus.value = true
    return
  }
  menyimpan.value = true
  try {
    await office.deleteItem(props.item.id, ifMatch(props.item.version))
    emit('terhapus', props.item.id)
    toast.add({ title: `${props.item.nama} dihapus`, color: 'success' })
    open.value = false
  }
  catch (e) {
    if (await tanganiKonflik(e, props.muatUlang)) open.value = false
    else toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="item ? 'Ubah menu' : 'Tambah menu'"
    :description="item ? item.nama : 'Muncul di halaman Menu website setelah disimpan.'"
  >
    <div class="space-y-6">
      <div class="grid gap-4 sm:grid-cols-[160px_1fr]">
        <HomepageFoto
          v-model="form.foto_key"
          :url="item?.foto_url ?? null"
          :upload="office.uploadFoto"
          aspect="aspect-square"
          @sibuk="mengunggah = $event"
        />
        <div class="space-y-4">
          <UFormField
            label="Nama menu"
            required
          >
            <UInput
              v-model="form.nama"
              placeholder="mis. Nasi Goreng Laksamana"
              class="w-full"
              size="lg"
            />
          </UFormField>
          <UFormField
            label="Kategori"
            required
          >
            <USelect
              v-model="form.kategori_id"
              :items="opsiKategori"
              placeholder="Pilih kategori"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="makanan"
            label="Bagian"
          >
            <AppSeg
              v-model="form.bagian"
              size="sm"
              :options="[{ value: 'main_course', label: 'Main course' }, { value: 'snack', label: 'Snack' }]"
            />
          </UFormField>
        </div>
      </div>

      <section>
        <h3 class="mb-1 text-sm font-semibold text-highlighted">
          Harga
        </h3>
        <p class="mb-2.5 text-xs text-muted">
          Satu harga: kosongkan labelnya. Beberapa ukuran atau rasa: beri label (R / L, Kaya / Matcha).
        </p>
        <div class="space-y-2">
          <div
            v-for="(v, i) in form.varian"
            :key="i"
            class="flex items-center gap-2"
          >
            <UInput
              v-model="v.label"
              placeholder="Label (opsional)"
              class="w-32 sm:w-40"
              :aria-label="`Label harga ${i + 1}`"
            />
            <UInput
              v-model.number="v.harga"
              type="number"
              :min="0"
              :step="1000"
              placeholder="45000"
              class="min-w-0 flex-1"
              :aria-label="`Harga ${i + 1}`"
            >
              <template #leading>
                <span class="text-sm text-muted">Rp</span>
              </template>
            </UInput>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="`Hapus harga ${i + 1}`"
              @click="hapusVarian(i)"
            />
          </div>
        </div>
        <UButton
          label="Tambah ukuran / varian"
          icon="i-lucide-plus"
          color="neutral"
          variant="soft"
          size="sm"
          class="mt-2"
          @click="tambahVarian"
        />
      </section>

      <section class="space-y-4">
        <UFormField
          label="Komponen"
          hint="Tampil di daftar menu"
        >
          <UInput
            v-model="form.komponen"
            placeholder="nasi, telur mata sapi, sambal"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Deskripsi"
          hint="Tampil di kartu Our Best Menu"
        >
          <UTextarea
            v-model="form.deskripsi"
            :rows="3"
            autoresize
            placeholder="Satu-dua kalimat yang membuat tamu ingin memesan."
            class="w-full"
          />
        </UFormField>
      </section>

      <section>
        <h3 class="mb-2 text-sm font-semibold text-highlighted">
          Label
        </h3>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="l in LABEL"
            :key="l.key"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary"
            :class="form[l.key]
              ? 'border-yellow-deep bg-yellow-light text-yellow-dark'
              : 'border-default bg-muted text-muted hover:text-highlighted'"
            :aria-pressed="form[l.key]"
            @click="form[l.key] = !form[l.key]"
          >
            <UIcon
              :name="l.icon"
              class="size-4"
            />
            {{ l.label }}
          </button>
        </div>
        <p
          v-if="form.unggulan"
          class="mt-2 text-xs"
          :class="unggulanLain >= SLOT_UNGGULAN ? 'text-warning' : 'text-muted'"
        >
          <template v-if="unggulanLain >= SLOT_UNGGULAN">
            Beranda hanya memuat {{ SLOT_UNGGULAN }} menu unggulan dan sudah penuh; menu ini tampil jika ada yang dilepas.
          </template>
          <template v-else>
            Tampil di Our Best Menu ({{ unggulanLain + 1 }} dari {{ SLOT_UNGGULAN }} slot).
          </template>
        </p>
      </section>

      <section class="divide-y divide-default rounded-panel border border-default">
        <label class="flex cursor-pointer items-center justify-between gap-4 px-3.5 py-3">
          <span>
            <span class="block text-sm font-semibold text-highlighted">Tampil di website</span>
            <span class="block text-xs text-muted">Matikan untuk menyimpan sebagai draf.</span>
          </span>
          <USwitch v-model="form.tampil" />
        </label>
        <label class="flex cursor-pointer items-center justify-between gap-4 px-3.5 py-3">
          <span>
            <span class="block text-sm font-semibold text-highlighted">Tersedia</span>
            <span class="block text-xs text-muted">Matikan saat habis; tamu melihat label “Habis”.</span>
          </span>
          <USwitch v-model="form.tersedia" />
        </label>
      </section>

      <UFormField
        label="Catatan internal"
        hint="Hanya terlihat di Office"
      >
        <UTextarea
          v-model="form.catatan_internal"
          :rows="2"
          autoresize
          class="w-full"
        />
      </UFormField>
    </div>

    <template #footer>
      <UButton
        :label="item ? 'Simpan' : 'Tambah menu'"
        :loading="menyimpan"
        :disabled="mengunggah"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
      <UButton
        v-if="item"
        :label="yakinHapus ? 'Yakin hapus?' : 'Hapus'"
        icon="i-lucide-trash-2"
        color="error"
        :variant="yakinHapus ? 'solid' : 'ghost'"
        class="lg:me-auto"
        :disabled="menyimpan"
        @click="hapus"
      />
    </template>
  </ResponsiveSheet>
</template>
