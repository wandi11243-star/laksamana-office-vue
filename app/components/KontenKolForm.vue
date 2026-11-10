<!--
  Tambah / Edit KOL & Media Partner (old openKolForm + saveKol + delKol,
  deploy/konten/index.html:3444-3499; konten.md D.14). Name required ("Nama
  wajib diisi"); usernames stored without "@"; several niches; the rate card
  image is shrunk in the browser (max side 1600px, ~900 KB, ≤10 MB in);
  the starting price history grows only when the price CHANGES (riwayatRate,
  computed before the record is overwritten). Old fields (rateDrive, rateTier,
  category) are kept on edit.
-->
<script setup lang="ts">
import type { KolKonten } from '~/utils/promosi-konten'
import { KOL_CATEGORIES, KOL_TYPES, kolCats, kolType, rateDelta, riwayatRate, tanpaAt } from '~/utils/promosi-konten'
import { rupiah } from '~/utils/format'

const props = defineProps<{ kol?: KolKonten | null }>()
const open = defineModel<boolean>('open', { default: false })

const { data: st } = useStateKonten()
const { saya, can } = useAksesKonten()
const toast = useToast()

const f = reactive({ name: '', type: 'KOL', whatsapp: '', instagram: '', tiktok: '', categories: [] as string[], rateImage: '', rateValue: '', note: '' })
const sibuk = ref(false)
const gambarSibuk = ref(false)
const hapusBuka = ref(false)
const salah = ref(false)
const memuatPenuh = ref(false)
const kolPenuh = ref<KolKonten | null>(null)

watch(open, async (o) => {
  if (!o) {
    kolPenuh.value = null
    memuatPenuh.value = false
    return
  }
  const k = props.kol
  salah.value = false
  kolPenuh.value = null

  if (k?.rateImageDipangkas) {
    // Populate form fields while loading full record
    Object.assign(f, {
      name: k.name ?? '',
      type: kolType(k),
      whatsapp: k.whatsapp ?? '',
      instagram: k.instagram ?? '',
      tiktok: k.tiktok ?? '',
      categories: [...kolCats(k)],
      rateImage: '',
      rateValue: k.rateValue ? String(k.rateValue) : '',
      note: k.note ?? '',
    })
    memuatPenuh.value = true
    try {
      const res = await getKonten<KolKonten>('kols', k.id)
      if (!open.value) return
      if (!res?.data) throw new Error('Data KOL kosong')
      kolPenuh.value = res.data
      const full = res.data
      Object.assign(f, {
        name: full.name ?? '',
        type: kolType(full),
        whatsapp: full.whatsapp ?? '',
        instagram: full.instagram ?? '',
        tiktok: full.tiktok ?? '',
        categories: [...kolCats(full)],
        rateImage: full.rateImage ?? '',
        rateValue: full.rateValue ? String(full.rateValue) : '',
        note: full.note ?? '',
      })
    }
    catch {
      if (!open.value) return
      toast.add({ title: 'Data KOL gagal dimuat, coba lagi', color: 'error' })
      open.value = false
    }
    finally {
      memuatPenuh.value = false
    }
    return
  }

  Object.assign(f, {
    name: k?.name ?? '',
    type: kolType(k),
    whatsapp: k?.whatsapp ?? '',
    instagram: k?.instagram ?? '',
    tiktok: k?.tiktok ?? '',
    categories: [...kolCats(k)],
    rateImage: k?.rateImage ?? '',
    rateValue: k?.rateValue ? String(k.rateValue) : '',
    note: k?.note ?? '',
  })
}, { immediate: true })

const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? (id || '')
const waktu = (v?: number) => (v ? new Date(v).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-')

function niche(c: string, on: boolean | 'indeterminate') {
  f.categories = on === true ? [...new Set([...f.categories, c])] : f.categories.filter(x => x !== c)
}

async function pilihGambar(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    input.value = ''
    return toast.add({ title: 'File harus berupa gambar', color: 'error' })
  }
  if (file.size > 10 * 1024 * 1024) {
    input.value = ''
    return toast.add({ title: 'Ukuran gambar maksimal 10 MB', color: 'error' })
  }
  gambarSibuk.value = true
  try {
    f.rateImage = await kecilkanGambarKonten(file, 1600, 900 * 1024)
    toast.add({ title: 'Gambar rate card siap disimpan', color: 'success' })
  }
  catch (err) {
    toast.add({ title: `Gambar rate card: ${(err as Error).message}`, color: 'error' })
  }
  gambarSibuk.value = false
}

async function simpan() {
  if (memuatPenuh.value) return
  const k = props.kol
  if (k?.rateImageDipangkas && !kolPenuh.value) return

  const name = f.name.trim()
  if (!name) {
    salah.value = true
    return
  }
  const rateValue = Number(f.rateValue) || 0
  const data = {
    name,
    type: f.type,
    whatsapp: f.whatsapp.trim(),
    instagram: tanpaAt(f.instagram.trim()),
    tiktok: tanpaAt(f.tiktok.trim()),
    rateImage: f.rateImage,
    rateValue,
    categories: f.categories,
    note: f.note.trim(),
  }
  const by = saya.value?.user.id ?? ''
  const basis = kolPenuh.value ?? k
  sibuk.value = true
  let ok = false
  if (basis) {
    const { rateImageDipangkas: _, ...bersih } = basis
    const payload: Partial<KolKonten> = {
      ...bersih,
      ...data,
      rateHistory: riwayatRate(basis, rateValue, by),
    }
    delete payload.rateImageDipangkas
    ok = await kontenSimpan(
      () => ubahKonten<KolKonten>('kols', basis.id, payload, basis.updatedAt),
      'Data diperbarui',
      { action: `mengubah data ${data.type}`, target: name },
    )
  }
  else {
    ok = await kontenSimpan(
      () => buatKonten<KolKonten>('kols', {
        createdAt: Date.now(),
        ...data,
        rateHistory: rateValue ? [{ value: rateValue, prev: 0, at: Date.now(), by }] : [],
      }),
      `${data.type} ditambahkan`,
      { action: `menambah ${data.type}`, target: name },
    )
  }
  sibuk.value = false
  if (ok) open.value = false
}

async function hapus() {
  const k = props.kol
  if (!k) return
  sibuk.value = true
  const basis = kolPenuh.value ?? k
  const ok = await kontenSimpan(() => hapusKonten('kols', basis.id, basis.updatedAt), 'Data dihapus', { action: `menghapus ${kolType(k)}`, target: k.name })
  sibuk.value = false
  if (!ok) return
  hapusBuka.value = false
  open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="kol ? 'Edit KOL / Medpar' : 'Tambah KOL / Medpar'"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        label="Nama KOL / Media Partner"
        required
        class="sm:col-span-2"
        :error="salah ? 'Nama wajib diisi' : false"
      >
        <UInput
          v-model="f.name"
          placeholder="Nama lengkap / nama panggung / nama media"
          class="w-full"
          @update:model-value="salah = false"
        />
      </UFormField>
      <UFormField
        label="Kategori tipe"
        required
      >
        <USelect
          v-model="f.type"
          :items="KOL_TYPES"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Nomor WhatsApp">
        <UInput
          v-model="f.whatsapp"
          inputmode="tel"
          placeholder="0812xxxxxxx"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Username Instagram">
        <UInput
          v-model="f.instagram"
          placeholder="tanpa @"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Username TikTok">
        <UInput
          v-model="f.tiktok"
          placeholder="tanpa @"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Kategori konten / niche (bisa pilih lebih dari satu)"
        class="sm:col-span-2"
      >
        <div class="flex flex-wrap gap-2">
          <UCheckbox
            v-for="c in KOL_CATEGORIES"
            :key="c"
            :model-value="f.categories.includes(c)"
            :label="c"
            class="rounded-md border border-default px-2.5 py-1.5"
            @update:model-value="niche(c, $event)"
          />
        </div>
      </UFormField>
      <UFormField
        label="Rate card — upload gambar (maks 10 MB)"
        class="sm:col-span-2"
      >
        <input
          type="file"
          accept="image/*"
          class="block w-full text-sm"
          :disabled="gambarSibuk || memuatPenuh"
          @change="pilihGambar"
        >
        <p
          v-if="memuatPenuh"
          class="mt-2 text-xs text-muted"
        >
          Memuat rate card…
        </p>
        <img
          v-else-if="f.rateImage"
          :src="f.rateImage"
          alt="Rate card"
          class="mt-2 max-h-64 rounded-lg border border-default"
        >
      </UFormField>
      <UFormField
        label="Starting price (Rp)"
        help="Harga mulai. Setiap perubahan nominal otomatis tercatat di riwayat."
      >
        <UInput
          v-model="f.rateValue"
          type="number"
          min="0"
          placeholder="mis. 1500000"
          class="w-full"
        />
      </UFormField>
      <UFormField
        v-if="kol"
        label="Riwayat starting price"
      >
        <div class="max-h-40 overflow-auto rounded-lg border border-default px-3 text-sm">
          <p
            v-if="!(kolPenuh?.rateHistory ?? kol.rateHistory)?.length"
            class="py-2 text-xs text-muted"
          >
            Belum ada perubahan harga tercatat.
          </p>
          <div
            v-for="(e, i) in (kolPenuh?.rateHistory ?? kol.rateHistory)"
            :key="i"
            class="border-b border-default py-2 last:border-0"
          >
            <p class="num font-semibold">
              {{ rupiah(e.value) }}
              <span
                class="text-xs"
                :class="!e.prev ? 'text-muted' : rateDelta(e) > 0 ? 'text-error' : 'text-success'"
              >{{ !e.prev ? 'ditetapkan' : `${rateDelta(e) > 0 ? '▲' : '▼'} ${rupiah(Math.abs(rateDelta(e)))}` }}</span>
            </p>
            <p class="text-xs text-muted">
              {{ e.prev ? `sebelumnya ${rupiah(e.prev)} - ` : '' }}{{ waktu(e.at) }}{{ e.by ? ` - ${namaUser(e.by)}` : '' }}
            </p>
          </div>
        </div>
      </UFormField>
      <UFormField
        label="Catatan"
        class="sm:col-span-2"
      >
        <UTextarea
          v-model="f.note"
          placeholder="Catatan tambahan (pengalaman, jangkauan, dsb)"
          class="w-full"
        />
      </UFormField>
    </div>
    <template #footer>
      <UButton
        v-if="can('kol')"
        :label="kol ? 'Simpan perubahan' : 'Simpan'"
        :loading="sibuk || gambarSibuk"
        :disabled="memuatPenuh"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
      <UButton
        v-if="kol && can('kol')"
        label="Hapus"
        color="error"
        variant="outline"
        @click="hapusBuka = true"
      />
    </template>
  </ResponsiveSheet>
  <KontenKonfirmasi
    v-model:open="hapusBuka"
    :title="`Hapus &quot;${kol?.name ?? ''}&quot; dari database?`"
    confirm-label="Hapus"
    color="error"
    :loading="sibuk"
    @konfirmasi="hapus"
  />
</template>
