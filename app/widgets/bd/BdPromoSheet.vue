<!--
  Promo form (old `promoModal`, deploy/bd/index.html:2580-2796). `paused` is NOT
  a field: it is toggled from the detail, so fixing a name never un-pauses a
  promo that was deliberately paused. The poster is shrunk in the browser (max
  800px, down to <400 KB) and any failure is spoken out loud.
-->
<script setup lang="ts">
import type { BdPromo } from '~/composables/useBd'
import { bdSimpan, putSetelan } from '~/composables/useBd'
import type { Versi } from '~/utils/versi'
import { PROMO_OUTLET_BAWAAN, promoOutletOpsi } from '~/utils/bd-promo'
import { uidBd } from '~/utils/bd-rumus'
import { PROMO_HARI, PROMO_HARI_PANJANG, PROMO_KAT, PROMO_TIPE, promoHariArr } from '~/utils/promo'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'

const props = defineProps<{
  promo?: BdPromo | null
  promos: BdPromo[]
  versi?: Versi
  namaAku?: string
}>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const f = reactive({
  nama: '',
  tipe: 'in_house',
  kategori: 'diskon',
  benefit: '',
  mulai: '',
  selesai: '',
  adaJam: false,
  jamMulai: '',
  jamSelesai: '',
  hari: [] as number[],
  hariLama: '',
  outlet: PROMO_OUTLET_BAWAAN,
  outletLain: '',
  kode: '',
  partner: '',
  partnerPIC: '',
  partnerKontak: '',
  lmPIC: '',
  kuota: 0,
  ketentuan: '',
})
const poster = ref('')

const opsiTipe = Object.entries(PROMO_TIPE).map(([k, v]) => ({ value: k, label: v.l }))
const opsiKat = Object.entries(PROMO_KAT).map(([k, v]) => ({ value: k, label: v.l }))
const opsiOutlet = computed(() => [
  ...[...new Set(promoOutletOpsi(props.promos, f.outlet))].map(o => ({ value: o, label: o })),
  { value: '__lain', label: '+ Lainnya (ketik sendiri)…' },
])

watch(open, (o) => {
  if (!o) return
  const p = props.promo
  if (p) {
    f.nama = p.nama
    f.tipe = p.tipe || 'in_house'
    f.kategori = p.kategori || 'diskon'
    f.benefit = p.benefit || ''
    f.mulai = p.mulai || ''
    f.selesai = p.selesai || ''
    f.adaJam = !!(p.jamMulai || p.jamSelesai)
    f.jamMulai = p.jamMulai || ''
    f.jamSelesai = p.jamSelesai || ''
    f.hari = promoHariArr(p.hari)
    f.hariLama = !Array.isArray(p.hari) && String(p.hari || '').trim() ? String(p.hari).trim() : ''
    f.outlet = p.outlet || PROMO_OUTLET_BAWAAN
    f.outletLain = ''
    f.kode = p.kode || ''
    f.partner = p.partner || ''
    f.partnerPIC = p.partnerPIC || ''
    f.partnerKontak = p.partnerKontak || ''
    f.lmPIC = p.lmPIC || props.namaAku || ''
    f.kuota = Number(p.kuota) || 0
    f.ketentuan = p.ketentuan || ''
    poster.value = p.poster || ''
  }
  else {
    f.nama = ''
    f.tipe = 'in_house'
    f.kategori = 'diskon'
    f.benefit = ''
    f.mulai = ''
    f.selesai = ''
    f.adaJam = false
    f.jamMulai = ''
    f.jamSelesai = ''
    f.hari = []
    f.hariLama = ''
    f.outlet = PROMO_OUTLET_BAWAAN
    f.outletLain = ''
    f.kode = ''
    f.partner = ''
    f.partnerPIC = ''
    f.partnerKontak = ''
    f.lmPIC = props.namaAku || ''
    f.kuota = 0
    f.ketentuan = ''
    poster.value = ''
  }
})

function toggleHari(i: number) {
  const s = new Set(f.hari)
  if (s.has(i)) s.delete(i)
  else s.add(i)
  f.hari = [...s].sort((a, b) => a - b)
}
function semuaHari() {
  f.hari = f.hari.length === 7 ? [] : [0, 1, 2, 3, 4, 5, 6]
}

/** Shrink the poster in the browser before storing it (`:2732-2756`). */
function pilihPoster(inp: Event) {
  const el = inp.target as HTMLInputElement
  const file = el.files?.[0]
  if (!file) return
  if (!/^image\//.test(file.type || '')) {
    toast.add({ title: 'Berkasnya bukan gambar.', color: 'error' })
    el.value = ''
    return
  }
  const fr = new FileReader()
  fr.onerror = () => toast.add({ title: 'Berkasnya gagal dibaca.', color: 'error' })
  fr.onload = () => {
    const img = new Image()
    img.onerror = () => toast.add({ title: 'Gambarnya tidak bisa dibaca — coba format JPG atau PNG.', color: 'error' })
    img.onload = () => {
      try {
        let w = img.width || 0
        let h = img.height || 0
        if (!w || !h) {
          toast.add({ title: 'Ukuran gambarnya tidak terbaca.', color: 'error' })
          return
        }
        const maks = 800
        if (w > maks || h > maks) {
          const s = Math.min(maks / w, maks / h)
          w = Math.round(w * s)
          h = Math.round(h * s)
        }
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        c.getContext('2d')!.drawImage(img, 0, 0, w, h)
        let hasil = ''
        for (const m of [0.75, 0.6, 0.45]) {
          hasil = c.toDataURL('image/jpeg', m)
          if (hasil.length <= 400000) break
        }
        if (!hasil || hasil.length > 400000) {
          toast.add({ title: 'Gambarnya masih terlalu besar — pakai poster yang lebih sederhana.', color: 'error' })
          return
        }
        poster.value = hasil
        toast.add({ title: `Poster siap (${Math.round(hasil.length / 1024)} KB)`, color: 'success' })
      }
      catch (e) {
        toast.add({ title: `Gagal memproses gambar: ${(e as Error)?.message || e}`, color: 'error' })
      }
    }
    img.src = String(fr.result)
  }
  fr.readAsDataURL(file)
}

async function simpan() {
  if (!f.nama.trim()) {
    toast.add({ title: 'Nama promo wajib diisi.', color: 'error' })
    return
  }
  if (!f.mulai || !f.selesai) {
    toast.add({ title: 'Tanggal mulai & selesai wajib diisi.', color: 'error' })
    return
  }
  if (f.selesai < f.mulai) {
    toast.add({ title: 'Tanggal selesai tidak boleh sebelum tanggal mulai.', color: 'error' })
    return
  }
  let outlet = f.outlet
  if (outlet === '__lain') {
    outlet = f.outletLain.trim()
    if (!outlet) {
      toast.add({ title: 'Nama outlet barunya belum diisi.', color: 'error' })
      return
    }
  }
  const isi = {
    nama: f.nama.trim(),
    tipe: f.tipe || 'in_house',
    kategori: f.kategori || 'diskon',
    benefit: f.benefit.trim(),
    mulai: f.mulai,
    selesai: f.selesai,
    jamMulai: f.adaJam ? f.jamMulai : '',
    jamSelesai: f.adaJam ? f.jamSelesai : '',
    hari: [...f.hari].sort((a, b) => a - b),
    outlet,
    partner: f.partner.trim(),
    partnerPIC: f.partnerPIC.trim(),
    partnerKontak: f.partnerKontak.trim(),
    lmPIC: f.lmPIC.trim(),
    kode: f.kode.trim().toUpperCase(),
    kuota: Math.max(0, Number(f.kuota) || 0),
    ketentuan: f.ketentuan.trim(),
    poster: poster.value || '',
  }
  const lama = props.promo
  // `paused` is deliberately NOT in `isi` — see the file comment.
  const daftar = lama
    ? props.promos.map(p => (p.id === lama.id ? { ...p, ...isi } : p))
    : [{ id: uidBd('pr'), paused: false, dibuatOleh: props.namaAku || '', dibuatAt: Date.now(), ...isi }, ...props.promos]
  const ok = await bdSimpan(() => putSetelan('promos', daftar, props.versi), lama ? 'Promo diperbarui' : 'Promo ditambahkan')
  if (ok) open.value = false
}

const hapusMau = ref(false)
async function hapus() {
  const lama = props.promo
  if (!lama) return
  hapusMau.value = false
  const daftar = props.promos.filter(p => p.id !== lama.id)
  const ok = await bdSimpan(() => putSetelan('promos', daftar, props.versi), 'Promo dihapus')
  if (ok) open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="promo ? 'Ubah promo' : 'Promo baru'"
  >
    <div class="grid grid-cols-1 gap-4">
      <UFormField label="Nama promo *">
        <UInput
          v-model="f.nama"
          placeholder="cth. Lunch Deal Weekday, Promo 17 Agustus"
          class="w-full"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Tipe promo">
          <USelect
            v-model="f.tipe"
            :items="opsiTipe"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Kategori">
          <USelect
            v-model="f.kategori"
            :items="opsiKat"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField label="Benefit / nilai diskon">
        <UInput
          v-model="f.benefit"
          placeholder="cth. Diskon 20%, Buy 1 Get 1, Free Birthday Cake"
          class="w-full"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Tanggal mulai *">
          <AppTanggal
            v-model="f.mulai"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tanggal selesai *">
          <AppTanggal
            v-model="f.selesai"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField label="Berlaku pada jam tertentu saja">
        <UCheckbox
          v-model="f.adaJam"
          label="Batasi jam berlaku"
        />
      </UFormField>
      <div
        v-if="f.adaJam"
        class="grid gap-4 sm:grid-cols-2"
      >
        <UFormField label="Jam mulai">
          <AppJam
            v-model="f.jamMulai"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jam selesai">
          <AppJam
            v-model="f.jamSelesai"
            class="w-full"
          />
        </UFormField>
      </div>
      <div>
        <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          Hari berlaku
        </p>
        <p
          v-if="f.hariLama"
          class="mb-2 rounded-xl border border-warning/30 bg-warning/10 p-2 text-xs"
        >
          Isian lama berbunyi <b>{{ f.hariLama }}</b>. Pilih ulang dengan tombol di bawah — bentuk teksnya sudah tidak dipakai lagi.
        </p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="(nama, i) in PROMO_HARI_PANJANG"
            :key="i"
            type="button"
            class="rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors"
            :class="f.hari.includes(i) ? 'border-yellow-deep bg-yellow-light text-yellow-dark' : 'border-default bg-muted text-muted'"
            :title="nama"
            @click="toggleHari(i)"
          >
            {{ PROMO_HARI[i] }}
          </button>
          <UButton
            :label="f.hari.length === 7 ? 'Kosongkan semua' : 'Pilih semua hari'"
            color="neutral"
            variant="outline"
            size="xs"
            @click="semuaHari"
          />
        </div>
        <p class="mt-1 text-xs text-muted">
          Tidak ada yang dipilih = berlaku setiap hari.
        </p>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Outlet / cabang">
          <USelect
            v-model="f.outlet"
            :items="opsiOutlet"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Kode / voucher">
          <UInput
            v-model="f.kode"
            placeholder="cth. TIKTOKGO"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField
        v-if="f.outlet === '__lain'"
        label="Nama outlet / cabang baru"
      >
        <UInput
          v-model="f.outletLain"
          placeholder="Ketik nama cabangnya"
          class="w-full"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Kerjasama dengan">
          <UInput
            v-model="f.partner"
            placeholder="cth. BCA, Komunitas Lari, SMA 3"
            class="w-full"
          />
        </UFormField>
        <UFormField label="PIC partner">
          <UInput
            v-model="f.partnerPIC"
            placeholder="Nama kontak dari partner"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Kontak partner">
          <UInput
            v-model="f.partnerKontak"
            placeholder="No. HP / email"
            class="w-full"
          />
        </UFormField>
        <UFormField label="PIC Laksamana">
          <UInput
            v-model="f.lmPIC"
            placeholder="Penanggung jawab internal"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField label="Kuota (0 = tanpa batas)">
        <UInput
          v-model.number="f.kuota"
          type="number"
          min="0"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Syarat & ketentuan">
        <UTextarea
          v-model="f.ketentuan"
          :rows="5"
          placeholder="Tulis ringkasan promonya lalu ketentuannya, satu per baris."
          class="w-full"
        />
      </UFormField>
      <div>
        <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          Poster promo
        </p>
        <input
          type="file"
          accept="image/*"
          class="block w-full text-sm"
          @change="pilihPoster"
        >
        <div
          v-if="poster"
          class="mt-2"
        >
          <img
            :src="poster"
            alt="Pratinjau poster"
            class="max-w-[220px] rounded-field border border-default"
          >
          <div class="mt-1 flex items-center gap-2">
            <span class="text-xs text-muted">{{ Math.round(poster.length / 1024) }} KB</span>
            <UButton
              label="Hapus poster"
              color="neutral"
              variant="outline"
              size="xs"
              @click="poster = ''"
            />
          </div>
        </div>
        <p class="mt-1 text-xs text-muted">
          Gambarnya dikecilkan otomatis (maks 800px) supaya halaman tetap ringan.
        </p>
      </div>
    </div>

    <template #footer>
      <UButton
        label="Simpan"
        icon="i-lucide-check"
        loading-auto
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
      <UButton
        v-if="promo"
        label="Hapus"
        icon="i-lucide-trash-2"
        color="error"
        variant="soft"
        @click="hapusMau = true"
      />
    </template>
  </ResponsiveSheet>

  <BdKonfirmasi
    v-model:open="hapusMau"
    :title="`Hapus promo &quot;${promo?.nama || ''}&quot;?`"
    description="Ia juga akan hilang dari modul Radar untuk seluruh kru."
    @konfirmasi="hapus"
  />
</template>
