<!--
  Request Order (old `requestModal`, deploy/bd/index.html:4175-4238): many rows in
  one sitting, because that is how the need arrives. Division, date needed and
  project are set ONCE on top. Blank item rows are ignored, not rejected, and
  every row enters as status "Diajukan".
-->
<script setup lang="ts">
import type { BdPerson, BdPo, BdProject } from '~/composables/useBd'
import { bdSimpan, tambahPurchaseOrders } from '~/composables/useBd'
import { OWNER_DIVS, PILIHAN_TANPA, akhirMinggu, nowStamp, opsiProject as opsiProjectBd, todayISO } from '~/utils/bd-rumus'

const props = defineProps<{
  projects: BdProject[]
  people: BdPerson[]
  aku?: BdPerson | null
}>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

interface Baris { item: string, qty: number, unit: string, note: string, by: string, amount: number }

const f = reactive({ div: OWNER_DIVS[0]!, needBy: akhirMinggu(todayISO()), project: null as string | null })
const baris = ref<Baris[]>([])

const kru = computed(() => props.people.filter(p => p.active !== false && !p.tanpaAkses))
const opsiPeminta = computed(() => kru.value.map(p => ({ value: p.id, label: p.name })))
const opsiProject = computed(() => opsiProjectBd(props.projects, f.project))

function barisBaru(): Baris {
  return { item: '', qty: 1, unit: 'Unit', note: '', by: props.aku?.id || '', amount: 0 }
}

watch(open, (o) => {
  if (!o) return
  const aku = props.aku
  f.div = aku && OWNER_DIVS.includes(aku.div) ? aku.div : OWNER_DIVS[0]!
  f.needBy = akhirMinggu(todayISO())
  f.project = null
  baris.value = [barisBaru(), barisBaru(), barisBaru()]
})

function tambahBaris() {
  baris.value.push(barisBaru())
}
function hapusBaris(i: number) {
  baris.value.splice(i, 1)
}

async function simpan() {
  const isi: Partial<BdPo>[] = []
  baris.value.forEach((b) => {
    const nama = b.item.trim()
    if (!nama) return
    const by = b.by || ''
    isi.push({
      item: nama,
      vendor: '',
      amount: Number(b.amount) || 0,
      qty: Number(b.qty) || 1,
      unit: b.unit.trim() || 'Unit',
      needBy: f.needBy,
      div: f.div,
      prId: null,
      by,
      pic: by,
      input: props.aku?.name || '',
      at: nowStamp(),
      status: 'Diajukan',
      project: f.project || null,
      note: b.note.trim(),
    })
  })
  if (!isi.length) {
    toast.add({ title: 'Belum ada baris yang diisi nama itemnya.', color: 'error' })
    return
  }
  const ok = await bdSimpan(() => tambahPurchaseOrders(isi), `${isi.length} request diajukan — menunggu diproses purchasing`)
  if (ok) open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    title="Request order"
    description="Tulis semua kebutuhan sekaligus — satu baris per barang."
  >
    <div class="grid grid-cols-1 gap-4">
      <p class="rounded-panel border border-default bg-muted p-3 text-xs text-muted">
        Harga boleh dikosongkan kalau belum tahu; tim purchasing yang melengkapinya.
        Semua baris masuk berstatus <b>Diajukan</b>.
      </p>
      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField label="Divisi peminta">
          <USelect
            v-model="f.div"
            :items="OWNER_DIVS"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Dibutuhkan tanggal">
          <UInput
            v-model="f.needBy"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Project (opsional)">
          <USelect
            :model-value="f.project ?? PILIHAN_TANPA"
            :items="opsiProject"
            class="w-full"
            @update:model-value="(v: string | undefined) => { f.project = !v || v === PILIHAN_TANPA ? null : v }"
          />
        </UFormField>
      </div>

      <div class="grid grid-cols-1 gap-3">
        <div
          v-for="(b, i) in baris"
          :key="i"
          class="rounded-panel border border-default p-3"
        >
          <div class="mb-2 flex items-center justify-between">
            <span class="text-[11px] font-bold uppercase tracking-wider text-muted">Baris {{ i + 1 }}</span>
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Hapus baris"
              @click="hapusBaris(i)"
            />
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField label="Nama item">
              <UInput
                v-model="b.item"
                placeholder="Nama barang / jasa"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Alasan / kebutuhan">
              <UInput
                v-model="b.note"
                placeholder="Untuk apa / kebutuhannya"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="mt-3 grid gap-3 sm:grid-cols-4">
            <UFormField label="Jumlah">
              <UInput
                v-model.number="b.qty"
                type="number"
                min="1"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Satuan">
              <UInput
                v-model="b.unit"
                placeholder="Pack / Orang"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Request">
              <USelect
                v-model="b.by"
                :items="opsiPeminta"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Perkiraan harga">
              <UInput
                v-model.number="b.amount"
                type="number"
                min="0"
                placeholder="0"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>
      </div>

      <div>
        <UButton
          label="Tambah baris"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          size="sm"
          @click="tambahBaris"
        />
        <span class="ms-2 text-[11px] text-muted">Baris yang nama itemnya kosong diabaikan.</span>
      </div>
    </div>

    <template #footer>
      <UButton
        label="Ajukan semua"
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
    </template>
  </ResponsiveSheet>
</template>
