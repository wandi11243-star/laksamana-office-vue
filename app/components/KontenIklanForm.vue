<!--
  Buat / Edit Iklan = dana keluar (old openAdForm + saveAd + delAd,
  deploy/konten/index.html:4176-4263; konten.md D.15).

  - name required; target & age range: pick or type (datalist);
  - expense rows {date, purpose, amount}; subtotal, VAT 11% and total update
    while typing; rows with no amount are dropped on save; an old flat
    `spend` is shown as one row "Penggunaan awal";
  - "Mulai" decides the spending month; left empty it becomes today (local);
  - the promoted video link: missing https:// is added, a non-link is
    REJECTED (stored as-is it would open a relative path);
  - `createdDate` (old rule) is not written; existing values stay as fallback.
-->
<script setup lang="ts">
import type { IklanKonten, RincianIklan } from '~/utils/promosi-konten'
import { ADS_AGE_RANGES, ADS_OBJECTIVES, ADS_PLATFORMS, ADS_STATUS, ADS_TARGETS, pajakIklan, rapikanVideo } from '~/utils/promosi-konten'
import { hariIni, rupiah } from '~/utils/format'

const props = defineProps<{ iklan?: IklanKonten | null }>()
const open = defineModel<boolean>('open', { default: false })

const { data: st } = useStateKonten()
const { can } = useAksesKonten()
const brandPilih = useBrandKonten()
const toast = useToast()

const f = reactive({
  name: '', brand: '', platform: ADS_PLATFORMS[0]!, objective: ADS_OBJECTIVES[0]!, status: 'draft', target: '', ageRange: '',
  startDate: '', endDate: '', chats: '', videoUrl: '', note: '',
})
const rincian = ref<RincianIklan[]>([])
const sibuk = ref(false)
const salah = ref(false)
const hapusBuka = ref(false)
const opsiBrand = computed(() => st.value.brands.map(b => ({ value: b.id, label: b.name })))
const opsiStatus = Object.entries(ADS_STATUS).map(([value, s]) => ({ value, label: s.label }))
const id = useId()

watch(open, (o) => {
  if (!o) return
  const a = props.iklan
  salah.value = false
  Object.assign(f, {
    name: a?.name ?? '', brand: a?.brand || (brandPilih.value !== 'all' ? brandPilih.value : st.value.brands[0]?.id ?? ''),
    platform: a?.platform || ADS_PLATFORMS[0], objective: a?.objective || ADS_OBJECTIVES[0], status: a?.status || 'draft',
    target: a?.target ?? '', ageRange: a?.ageRange ?? '', startDate: a?.startDate ?? '', endDate: a?.endDate ?? '',
    chats: a?.chats ? String(a.chats) : '', videoUrl: a?.videoUrl ?? '', note: a?.note ?? '',
  })
  rincian.value = a?.expenses?.length
    ? a.expenses.map(x => ({ ...x }))
    : (a?.spend ? [{ date: a.startDate || hariIni(), purpose: 'Penggunaan awal', amount: a.spend }] : [])
}, { immediate: true })

const subtotal = computed(() => rincian.value.reduce((s, x) => s + (Number(x.amount) || 0), 0))
const pajak = computed(() => pajakIklan(subtotal.value))
const tambahRincian = () => rincian.value.push({ date: hariIni(), purpose: '', amount: '' })

async function simpan() {
  const name = f.name.trim()
  if (!name) {
    salah.value = true
    return
  }
  const vid = rapikanVideo(f.videoUrl)
  if (vid === null) return toast.add({ title: 'Link video tidak dikenali', description: 'Tempel alamat lengkapnya, mis. https://www.instagram.com/reel/…', color: 'error' })
  const expenses = rincian.value.filter(x => Number(x.amount) > 0).map(x => ({ date: x.date ?? '', purpose: (x.purpose ?? '').trim(), amount: Number(x.amount) }))
  const spendBase = expenses.reduce((s, x) => s + x.amount, 0)
  const tax = pajakIklan(spendBase)
  const data = {
    name, brand: f.brand, platform: f.platform, objective: f.objective, status: f.status || 'draft', target: f.target.trim(), ageRange: f.ageRange.trim(),
    expenses, spendBase, tax, spend: spendBase + tax, budget: 0, startDate: f.startDate || hariIni(), endDate: f.endDate,
    chats: Number(f.chats) || 0, note: f.note.trim(), videoUrl: vid,
  }
  const a = props.iklan
  sibuk.value = true
  const ok = a
    ? await kontenSimpan(() => ubahKonten<IklanKonten>('ads', a.id, { ...a, ...data }, a.updatedAt), 'Iklan diperbarui', { action: 'mengubah iklan', target: name })
    : await kontenSimpan(() => buatKonten<IklanKonten>('ads', { createdAt: Date.now(), ...data }), 'Iklan dibuat', { action: 'membuat iklan', target: name })
  sibuk.value = false
  if (ok) open.value = false
}

async function hapus() {
  const a = props.iklan
  if (!a) return
  sibuk.value = true
  const ok = await kontenSimpan(() => hapusKonten('ads', a.id, a.updatedAt), 'Iklan dihapus', { action: 'menghapus iklan', target: a.name })
  sibuk.value = false
  if (!ok) return
  hapusBuka.value = false
  open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="iklan ? 'Edit iklan — dana keluar' : 'Buat iklan — dana keluar'"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        label="Nama iklan / kampanye"
        required
        class="sm:col-span-2"
        :error="salah ? 'Nama iklan wajib diisi' : false"
      >
        <UInput
          v-model="f.name"
          placeholder="mis. Promo Ramadhan - Conversion"
          class="w-full"
          @update:model-value="salah = false"
        />
      </UFormField>
      <UFormField label="Brand">
        <USelect
          v-model="f.brand"
          :items="opsiBrand"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Platform">
        <USelect
          v-model="f.platform"
          :items="ADS_PLATFORMS"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Objective">
        <USelect
          v-model="f.objective"
          :items="ADS_OBJECTIVES"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Status">
        <USelect
          v-model="f.status"
          :items="opsiStatus"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Target (pilih / ketik manual)">
        <UInput
          v-model="f.target"
          :list="`${id}-target`"
          placeholder="Pilih atau ketik target baru"
          class="w-full"
        />
        <datalist :id="`${id}-target`">
          <option
            v-for="t in ADS_TARGETS"
            :key="t"
            :value="t"
          />
        </datalist>
      </UFormField>
      <UFormField label="Usia range (pilih / ketik manual)">
        <UInput
          v-model="f.ageRange"
          :list="`${id}-usia`"
          placeholder="mis. 25-34"
          class="w-full"
        />
        <datalist :id="`${id}-usia`">
          <option
            v-for="t in ADS_AGE_RANGES"
            :key="t"
            :value="t"
          />
        </datalist>
      </UFormField>
      <UFormField
        label="Mulai"
        required
        help="Tanggal iklan ini mulai jalan — inilah yang menentukan dananya masuk pengeluaran bulan mana di Report per Bulan. Kosong = hari ini."
      >
        <UInput
          v-model="f.startDate"
          type="date"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Selesai">
        <UInput
          v-model="f.endDate"
          type="date"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Hasil — chats">
        <UInput
          v-model="f.chats"
          type="number"
          min="0"
          placeholder="0"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Link video yang dipromosikan (Instagram / Facebook / TikTok)"
        help="Materi mana yang didorong iklan ini — dipakai Report Percakapan untuk menjawab video mana yang paling banyak menghasilkan chat."
        class="sm:col-span-2"
      >
        <UInput
          v-model="f.videoUrl"
          placeholder="mis. https://www.instagram.com/reel/Cxxxxxxx/"
          class="w-full"
        />
      </UFormField>
      <div class="rounded-lg border bg-muted border-default p-3 sm:col-span-2">
        <p class="text-sm font-semibold">
          Dana keluar (penggunaan ads)
        </p>
        <p class="mb-2 text-xs text-muted">
          Rincian penggunaan — untuk keperluan apa saja. Pajak PPN 11% dihitung otomatis.
        </p>
        <p
          v-if="!rincian.length"
          class="py-1 text-xs text-muted"
        >
          Belum ada rincian dana keluar.
        </p>
        <div
          v-for="(x, i) in rincian"
          :key="i"
          class="mb-2 grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[9rem_1fr_9rem_auto]"
        >
          <UInput
            v-model="x.date"
            type="date"
            aria-label="Tanggal"
            class="col-span-2 sm:col-span-1"
          />
          <UInput
            v-model="x.purpose"
            placeholder="Keperluan (mis. Boosting Reel)"
            aria-label="Keperluan"
            class="col-span-2 sm:col-span-1"
          />
          <UInput
            v-model="x.amount"
            type="number"
            min="0"
            placeholder="Nominal (Rp)"
            aria-label="Nominal"
          />
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            aria-label="Hapus rincian"
            @click="rincian.splice(i, 1)"
          />
        </div>
        <UButton
          label="Tambah rincian dana keluar"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          size="sm"
          @click="tambahRincian"
        />
        <dl class="mt-3 space-y-1 border-t border-default pt-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-muted">
              Subtotal
            </dt><dd class="num">
              {{ rupiah(subtotal) }}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted">
              Pajak (PPN 11%)
            </dt><dd class="num">
              {{ rupiah(pajak) }}
            </dd>
          </div>
          <div class="flex justify-between font-semibold">
            <dt>Total dana keluar</dt><dd class="num text-error">
              {{ rupiah(subtotal + pajak) }}
            </dd>
          </div>
        </dl>
      </div>
      <UFormField
        label="Catatan"
        class="sm:col-span-2"
      >
        <UTextarea
          v-model="f.note"
          placeholder="Catatan optimasi, audiens, dsb"
          class="w-full"
        />
      </UFormField>
    </div>
    <template #footer>
      <UButton
        v-if="can('ads')"
        :label="iklan ? 'Simpan perubahan' : 'Simpan iklan'"
        :loading="sibuk"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
      <UButton
        v-if="iklan && can('ads')"
        label="Hapus"
        color="error"
        variant="outline"
        @click="hapusBuka = true"
      />
    </template>
  </ResponsiveSheet>
  <KontenKonfirmasi
    v-model:open="hapusBuka"
    :title="`Hapus iklan &quot;${iklan?.name ?? ''}&quot;?`"
    confirm-label="Hapus"
    color="error"
    :loading="sibuk"
    @konfirmasi="hapus"
  />
</template>
