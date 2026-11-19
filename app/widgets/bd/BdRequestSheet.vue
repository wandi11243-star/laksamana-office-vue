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

interface Baris { item: string, qty: number, unit: string, note: string, by: string, amount: number | string }

const f = reactive({ div: OWNER_DIVS[0]!, needBy: akhirMinggu(todayISO()), project: null as string | null })
const baris = ref<Baris[]>([])

const kru = computed(() => props.people.filter(p => p.active !== false && !p.tanpaAkses))
const opsiPeminta = computed(() => kru.value.map(p => ({ value: p.id, label: p.name })))
const opsiProject = computed(() => opsiProjectBd(props.projects, f.project))

function barisBaru(): Baris {
  return { item: '', qty: 1, unit: 'Unit', note: '', by: props.aku?.id || '', amount: '' }
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
    lebar
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
          <AppTanggal
            v-model="f.needBy"
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

      <!-- Item rows laid out like Stock › Form Order Belanja (owner request,
           Nov 2026): a tinted card per row, the item on top, then a qty
           stepper, unit, requester, price and the delete button on one line,
           and the dashed "add row" right under the last row. -->
      <div class="flex flex-col gap-3">
        <div
          v-for="(b, i) in baris"
          :key="i"
          class="rounded-xl border border-default bg-muted p-3"
        >
          <div class="grid gap-2 sm:grid-cols-2">
            <UFormField :label="`Item ${i + 1}`">
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
          <div class="mt-2 flex flex-wrap items-end gap-2">
            <UFormField label="Jumlah">
              <div
                class="flex items-center gap-1.5"
                role="group"
                aria-label="Jumlah"
              >
                <UButton
                  icon="i-lucide-minus"
                  variant="outline"
                  square
                  class="size-10 justify-center lg:size-9"
                  aria-label="Kurangi jumlah"
                  @click="b.qty = Math.max(1, (Number(b.qty) || 1) - 1)"
                />
                <UInput
                  v-model.number="b.qty"
                  type="number"
                  min="1"
                  class="w-16"
                  :ui="{ base: 'text-center font-bold' }"
                  aria-label="Jumlah"
                />
                <UButton
                  icon="i-lucide-plus"
                  variant="outline"
                  square
                  class="size-10 justify-center lg:size-9"
                  aria-label="Tambah jumlah"
                  @click="b.qty = (Number(b.qty) || 0) + 1"
                />
              </div>
            </UFormField>
            <UFormField
              label="Satuan"
              class="min-w-24 flex-1"
            >
              <UInput
                v-model="b.unit"
                placeholder="Pack / Orang"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Request"
              class="min-w-36 flex-1"
            >
              <USelect
                v-model="b.by"
                :items="opsiPeminta"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Perkiraan harga"
              class="min-w-40 flex-[1.5]"
            >
              <AppNominal
                v-model="b.amount"
                placeholder="Boleh kosong"
                class="w-full"
              />
            </UFormField>
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              square
              class="size-10 justify-center lg:size-9"
              aria-label="Hapus baris"
              @click="hapusBaris(i)"
            />
          </div>
        </div>
      </div>

      <div>
        <button
          type="button"
          class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold/40 text-sm font-semibold text-gold-deep transition-colors hover:border-gold hover:bg-gold-soft/40 lg:min-h-10"
          @click="tambahBaris"
        >
          <UIcon
            name="i-lucide-plus"
            class="size-4"
          />
          Tambah baris
        </button>
        <p class="mt-1.5 text-[11px] text-muted">
          Baris yang nama itemnya kosong diabaikan.
        </p>
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
