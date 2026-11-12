<!--
  Marketing › Purchase Order (docs/migrasi/marketing.md D.10, issue #62).
  This page has NO store of its own: rows go straight to the BD Purchasing
  board (insert-only batch, like legacy addPo — never a whole-state save,
  which would empty BD's board) and the "already sent" list is read LIVE
  from BD, so its status is BD's, not a frozen copy.
  v1 gates both calls with module `bd` while the old endpoint was open: a
  Marketing-only holder gets 403, shown as a ribbon + retry, never a crash.
-->
<script setup lang="ts">
import type { BarisPoMkt, PoBdMkt } from '~/utils/marketing-operasional'
import {
  DIVISI_PO_MKT, akhirMingguMkt, barisPoKosongMkt, formatRpKetikMkt, itemPoMkt, poMarketingMkt, warnaStatusPoMkt,
} from '~/utils/marketing-operasional'
import { tglMkt } from '~/utils/marketing'
import { hariIni, rupiah } from '~/utils/format'

definePageMeta({ access: ['marketing'] })

const toast = useToast()
const { data: st } = useStateMkt()
const { saya } = useAksesMkt()

const TANPA = '__none'
/** An API message without its own final period, so the sentence around it reads once. */
const pesanApi = (e: unknown) => apiErrorMessage(e).replace(/\.\s*$/, '')
const f = reactive({ div: 'Marketing' as (typeof DIVISI_PO_MKT)[number], need: akhirMingguMkt(hariIni()), event: TANPA })
const baris = ref<BarisPoMkt[]>([barisPoKosongMkt(), barisPoKosongMkt(), barisPoKosongMkt()])
const opsiEvent = computed(() => [
  { value: TANPA, label: '— tidak terkait event —' },
  ...st.value.events.slice().sort((a, b) => String(b.tanggal ?? '').localeCompare(String(a.tanggal ?? ''))).map(e => ({ value: e.nama, label: e.nama })),
])

function hapusBaris(i: number) {
  if (baris.value.length <= 1) baris.value = [barisPoKosongMkt()]
  else baris.value.splice(i, 1)
}

const mengirim = ref(false)
const hasil = ref<{ ok: boolean, teks: string } | null>(null)
async function kirim() {
  const items = itemPoMkt(baris.value, { needBy: f.need, div: f.div, event: f.event === TANPA ? '' : f.event, nama: saya.value?.user.name ?? '' })
  if (!items.length) return toast.add({ title: 'Belum ada baris', description: 'Isi minimal satu nama item.', color: 'error' })
  mengirim.value = true
  try {
    const r = await kirimPoBdMkt(items)
    const n = r.data?.added ?? 0
    hasil.value = { ok: true, teks: `${n} item masuk ke papan Purchasing BD OS berstatus Diajukan. Tim purchasing yang melanjutkan dari sana.` }
    baris.value = [barisPoKosongMkt(), barisPoKosongMkt(), barisPoKosongMkt()]
    toast.add({ title: 'Terkirim', description: `${n} item masuk ke BD OS.`, color: 'success' })
    void muat()
  }
  catch (e) {
    hasil.value = { ok: false, teks: `Belum terkirim: ${pesanApi(e)}. Isian tetap di sini — coba lagi.` }
  }
  finally {
    mengirim.value = false
  }
}

// ---- "already sent", read live from BD
const daftar = useState<PoBdMkt[] | null>('mkt-po-bd', () => null)
const galat = ref('')
const memuat = ref(false)
async function muat() {
  if (memuat.value) return
  memuat.value = true
  galat.value = ''
  try {
    const r = await daftarPoBdMkt()
    daftar.value = Array.isArray(r.data) ? r.data : []
  }
  catch (e) {
    daftar.value = daftar.value ?? []
    galat.value = pesanApi(e)
  }
  finally {
    memuat.value = false
  }
}
onMounted(muat)
const terkirim = computed(() => poMarketingMkt(daftar.value ?? []))
</script>

<template>
  <AppPage
    title="Purchase Order"
    description="Kebutuhan pembelian dari Marketing — terkirim ke papan Purchasing BD OS untuk direkap jadi lembar PR mingguan."
  >
    <MarketingGerbang layar="purchasing">
      <AppPanel>
        <UAlert
          color="primary"
          variant="subtle"
          icon="i-lucide-info"
          title="Cara kerjanya"
          description="Baris yang kamu kirim dari sini langsung masuk ke papan Purchasing BD OS berstatus Diajukan, bukan disimpan di Marketing. Tim purchasing yang melengkapi vendor dan harga akhirnya, lalu mengumpulkannya jadi satu lembar PR mingguan bernomor."
          class="mb-4"
        />
        <div class="grid gap-4 sm:grid-cols-3">
          <UFormField label="Divisi peminta">
            <USelect
              v-model="f.div"
              :items="[...DIVISI_PO_MKT]"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Dibutuhkan tanggal"
            help="Bawaannya akhir minggu ini — siklus belanja tim mingguan."
          >
            <UInput
              v-model="f.need"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Untuk event (opsional)"
            help="Ikut ditulis di kolom alasan, supaya purchasing tahu acaranya."
          >
            <USelect
              v-model="f.event"
              :items="opsiEvent"
              class="w-full"
            />
          </UFormField>
        </div>

        <p class="mt-4 mb-2 text-sm font-semibold">
          Daftar barang yang diminta
        </p>
        <div class="hidden grid-cols-[minmax(10rem,1fr)_5rem_6.5rem_minmax(10rem,1fr)_10rem_2.5rem] gap-2 px-1 text-xs font-semibold text-muted lg:grid">
          <span>Nama item</span><span>Jumlah</span><span>Satuan</span><span>Alasan / kebutuhan</span><span>Perkiraan harga (Rp)</span><span />
        </div>
        <div class="grid gap-3 lg:gap-2">
          <div
            v-for="(b, i) in baris"
            :key="i"
            class="grid grid-cols-[1fr_auto] gap-2 rounded-lg border bg-muted border-default p-2 lg:grid-cols-[minmax(10rem,1fr)_5rem_6.5rem_minmax(10rem,1fr)_10rem_2.5rem] lg:border-0 lg:p-0"
          >
            <UInput
              v-model="b.item"
              placeholder="Nama barang / jasa"
              aria-label="Nama item"
              class="w-full"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              aria-label="Hapus baris"
              class="lg:order-last"
              @click="hapusBaris(i)"
            />
            <div class="col-span-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:col-span-1 lg:contents">
              <UInput
                v-model="b.qty"
                type="number"
                min="1"
                aria-label="Jumlah"
                class="w-full"
              />
              <UInput
                v-model="b.unit"
                placeholder="Pack / Orang"
                aria-label="Satuan"
                class="w-full"
              />
              <UInput
                v-model="b.note"
                placeholder="Untuk apa / kebutuhannya"
                aria-label="Alasan / kebutuhan"
                class="col-span-2 w-full sm:col-span-1"
              />
              <UInput
                :model-value="b.amount"
                inputmode="numeric"
                autocomplete="off"
                placeholder="0"
                aria-label="Perkiraan harga (Rp)"
                class="col-span-2 w-full sm:col-span-1"
                :ui="{ base: 'text-end' }"
                @update:model-value="b.amount = formatRpKetikMkt(String($event))"
              >
                <template #leading>
                  <span class="text-xs text-muted">Rp</span>
                </template>
              </UInput>
            </div>
          </div>
        </div>
        <p class="mt-2 text-xs text-muted">
          Baris tanpa nama item diabaikan — tidak perlu dihapus satu per satu. Harga boleh dikosongkan kalau belum tahu.
        </p>
        <div class="mt-4 flex flex-wrap justify-between gap-2">
          <UButton
            icon="i-lucide-plus"
            label="Tambah baris"
            color="neutral"
            variant="outline"
            size="sm"
            @click="baris.push(barisPoKosongMkt())"
          />
          <UButton
            icon="i-lucide-send"
            label="Kirim ke Task Management"
            :loading="mengirim"
            @click="kirim"
          />
        </div>
        <UAlert
          v-if="hasil"
          :color="hasil.ok ? 'success' : 'error'"
          variant="subtle"
          :icon="hasil.ok ? 'i-lucide-check' : 'i-lucide-triangle-alert'"
          :title="hasil.ok ? 'Terkirim' : undefined"
          :description="hasil.teks"
          class="mt-4"
        />
      </AppPanel>

      <AppPanel
        title="Kebutuhan yang sudah dikirim"
        description="Dibaca langsung dari papan Purchasing BD OS. Statusnya berubah di sana, bukan di sini."
        class="mt-4"
        flush
      >
        <template #actions>
          <UButton
            icon="i-lucide-refresh-cw"
            label="Segarkan"
            size="sm"
            color="neutral"
            variant="outline"
            :loading="memuat"
            @click="muat"
          />
        </template>
        <UAlert
          v-if="galat"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="`Daftar tidak bisa dibaca dari BD OS: ${galat}. Yang sudah terkirim tetap ada di sana — ini cuma tampilannya.`"
          class="m-4"
        >
          <template #actions>
            <UButton
              label="Coba lagi"
              size="xs"
              color="neutral"
              variant="outline"
              :loading="memuat"
              @click="muat"
            />
          </template>
        </UAlert>
        <div
          v-if="daftar === null"
          class="space-y-2 p-6"
        >
          <!-- Loading rows mirror the request table below. -->
          <USkeleton
            v-for="i in 4"
            :key="i"
            class="h-12 w-full"
          />
          <p class="pt-1 text-center text-sm text-muted">
            Memuat dari BD OS…
          </p>
        </div>
        <p
          v-else-if="!terkirim.length && !galat"
          class="p-6 text-center text-sm text-muted"
        >
          Belum ada kebutuhan yang dikirim dari Marketing.
        </p>
        <template v-else-if="terkirim.length">
          <UTable
            :data="terkirim"
            :columns="[
              { accessorKey: 'item', header: 'Item' },
              { accessorKey: 'qty', header: 'Jumlah' },
              { accessorKey: 'needBy', header: 'Dibutuhkan' },
              { accessorKey: 'byName', header: 'Peminta' },
              { accessorKey: 'amount', header: 'Perkiraan' },
              { accessorKey: 'status', header: 'Status' },
              { accessorKey: 'vendor', header: 'Vendor / PR' },
            ]"
            class="hidden lg:block"
          >
            <template #item-cell="{ row }">
              <p class="font-semibold text-highlighted">
                {{ row.original.item || '—' }}
              </p>
              <p
                v-if="row.original.note"
                class="text-xs text-muted"
              >
                {{ row.original.note }}
              </p>
            </template>
            <template #qty-cell="{ row }">
              <span class="num">{{ +(row.original.qty ?? 0) || 1 }} {{ row.original.unit }}</span>
            </template>
            <template #needBy-cell="{ row }">
              <span class="num">{{ row.original.needBy ? tglMkt(row.original.needBy) : '—' }}</span>
            </template>
            <template #byName-cell="{ row }">
              {{ row.original.byName || row.original.input || '—' }}
            </template>
            <template #amount-cell="{ row }">
              <span
                v-if="+(row.original.amount ?? 0)"
                class="num"
              >{{ rupiah(+(row.original.amount ?? 0)) }}</span>
              <span
                v-else
                class="text-xs text-muted"
              >belum ditentukan</span>
            </template>
            <template #status-cell="{ row }">
              <AppStatus
                :color="warnaStatusPoMkt(row.original.status)"
                size="sm"
              >
                {{ String(row.original.status ?? '').trim() || '—' }}
              </AppStatus>
            </template>
            <template #vendor-cell="{ row }">
              <span v-if="row.original.vendor">{{ row.original.vendor }}</span>
              <span
                v-else
                class="text-muted"
              >—</span>
              <p
                v-if="row.original.prId"
                class="num text-xs text-muted"
              >
                PR {{ row.original.prId }}
              </p>
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="p in terkirim"
              :key="p.id"
              class="p-4"
            >
              <div class="flex items-start gap-2">
                <p class="min-w-0 flex-1 font-semibold text-highlighted">
                  {{ p.item || '—' }}
                </p>
                <AppStatus
                  :color="warnaStatusPoMkt(p.status)"
                  size="sm"
                >
                  {{ String(p.status ?? '').trim() || '—' }}
                </AppStatus>
              </div>
              <p class="text-xs text-muted">
                {{ +(p.qty ?? 0) || 1 }} {{ p.unit }} · {{ p.needBy ? tglMkt(p.needBy) : '—' }} · {{ p.byName || p.input || '—' }}
              </p>
              <p
                v-if="p.note"
                class="text-xs text-muted"
              >
                {{ p.note }}
              </p>
              <p class="mt-1 text-xs">
                <span class="num">{{ +(p.amount ?? 0) ? rupiah(+(p.amount ?? 0)) : 'belum ditentukan' }}</span>
                <span v-if="p.vendor"> · {{ p.vendor }}</span>
                <span v-if="p.prId"> · PR {{ p.prId }}</span>
              </p>
            </li>
          </ul>
        </template>
      </AppPanel>
    </MarketingGerbang>
  </AppPage>
</template>
