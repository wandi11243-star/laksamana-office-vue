<!--
  Stock › Ordering › Form Order Belanja (old `deploy/stock/ordering/index.html:164-166,262-329`).

  "Pengajuan Order Barang Baru" (Tahap 1): PIC from the session with their
  division (read-only), arrival date (tomorrow by default + Hari ini/Besok/Lusa),
  material lines picked from the stock master — searchable per row or from
  category tiles (StockPilihBahan, like the Marketing Menu Kalkulator) — and
  "N baris siap dikirim". The batch choice (Baru vs Gabung, old `:894-899`) lives
  in the confirmation sheet, as on the old screen's "Konfirmasi Pesanan".
-->
<script setup lang="ts">
import { NAMA_DIVISI_ACC, bolehUbahOrdering, catatLog, createBatch, gudangDariBatch, joinableBatches, useProdukStock } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { hariIni, tambahHari, tglPendek } from '~/utils/format'
import { SATUAN_TERSEDIA } from '~/utils/stock-catat'

definePageMeta({ access: ['ordering'] })

const me = useMe()
const toast = useToast()
/** Old ORD_PERM_DEFAULT: "Check-in saja" may not submit shopping orders (the server refuses too). */
const bolehUbah = computed(() => bolehUbahOrdering('order'))

// The PIC's division, as the old form showed it under the name ("Keterangan Bar").
const divisi = computed(() => (me.value?.tim ?? []).map(t => t.label).join(', ') || me.value?.keterangan || '')

const produkQ = useProdukStock()
const produk = computed(() => produkQ.data.value?.rows ?? [])
const daftarNama = computed(() => produk.value.map(p => p.nama))
const satuanOf = (nama: string) => {
  const p = produk.value.find(x => x.nama === nama)
  return (p?.satuan as string[] | undefined)?.length ? (p!.satuan as string[]) : SATUAN_TERSEDIA
}
// Row search: one list grouped under category labels (empty category → Lainnya).
const opsiBahan = computed(() => {
  const grup = new Map<string, string[]>()
  for (const p of produk.value) {
    if (p.aktif === false) continue
    const k = (p.kategori || '').trim() || 'Lainnya'
    grup.set(k, [...(grup.get(k) ?? []), p.nama])
  }
  return [...grup.entries()]
    .sort(([a], [b]) => (a === 'Lainnya' ? 1 : b === 'Lainnya' ? -1 : a.localeCompare(b, 'id')))
    .map(([k, nama]) => [{ type: 'label' as const, label: k, value: `kategori:${k}` }, ...nama.sort((a, b) => a.localeCompare(b, 'id')).map(n => ({ label: n, value: n }))])
})

const tgl = ref(tambahHari(hariIni(), 1))
const pintas = [
  { label: 'Hari ini', value: hariIni() },
  { label: 'Besok', value: tambahHari(hariIni(), 1) },
  { label: 'Lusa', value: tambahHari(hariIni(), 2) },
]

interface BarisOrder { k: number, item: string, qty: number, unit: string, note: string }
let nomor = 0
const baris = ref<BarisOrder[]>([])
function barisBaru(item = ''): BarisOrder {
  return { k: ++nomor, item, qty: 5, unit: item ? satuanOf(item)[0] ?? SATUAN_TERSEDIA[0]! : SATUAN_TERSEDIA[0]!, note: '' }
}
function tambahBaris() {
  baris.value.push(barisBaru())
}
function hapusBaris(k: number) {
  if (baris.value.length <= 1) {
    toast.add({ title: 'Minimal satu baris', description: 'Kosongkan isinya kalau tidak dipakai.', color: 'warning' })
    return
  }
  baris.value = baris.value.filter(b => b.k !== k)
}
// Like the old `adjustQty`: the stepper clamps at 1, never 0 or empty.
function naikkan(b: BarisOrder) {
  b.qty = Math.max(1, Math.round((Number(b.qty) || 0) + 1))
}
function turunkan(b: BarisOrder) {
  b.qty = Math.max(1, Math.round((Number(b.qty) || 0) - 1))
}
function pilihBahan(b: BarisOrder, nama: string) {
  b.item = nama
  const daftar = satuanOf(nama)
  if (!daftar.includes(b.unit)) b.unit = daftar[0] ?? ''
}
// Like the old form: three empty rows ready, qty default 5.
tambahBaris()
tambahBaris()
tambahBaris()

const siap = computed(() => baris.value.filter(b => b.item.trim() && (Number(b.qty) || 0) > 0))

// --- category picker ----------------------------------------------------------
const pemilih = ref<{ open: boolean, k: number | null }>({ open: false, k: null })
const namaDiForm = computed(() => baris.value.map(b => b.item).filter(Boolean))
function bukaPemilih(k: number | null = null) {
  pemilih.value = { open: true, k }
}
function pakaiPilihan(nama: string[]) {
  const k = pemilih.value.k
  if (k !== null) {
    const b = baris.value.find(x => x.k === k)
    if (b && nama[0]) pilihBahan(b, nama[0])
    return
  }
  // Multi pick: unticked names leave the form, new names fill empty rows first.
  const pilih = new Set(nama)
  let sisa = baris.value.filter(b => !b.item || pilih.has(b.item))
  const ada = new Set(sisa.map(b => b.item).filter(Boolean))
  for (const n of nama) {
    if (ada.has(n)) continue
    const kosong = sisa.find(b => !b.item)
    if (kosong) pilihBahan(kosong, n)
    else sisa = [...sisa, barisBaru(n)]
  }
  baris.value = sisa.length ? sisa : [barisBaru()]
}

// --- batch (chosen in the confirmation sheet) ------------------------------------
const mode = ref<'baru' | 'gabung'>('baru')
const namaBatch = ref('')
const batchQ = useAsyncData('stock-order-batch', () => joinableBatches(), {
  default: () => ({ rows: [] }),
})
const batchPilih = ref('')
/**
 * Shopping batches only (old `daftarBatch = arr.filter(b => !dariFormCK(b))`):
 * joining a "Central Kitchen" / "Gudang Bar" batch would turn purchases into
 * warehouse requests and lower that warehouse's stock.
 */
const batchGabung = computed(() => (batchQ.data.value?.rows ?? []).filter(b => !gudangDariBatch(b.batchName)))
const batchTerpilih = computed(() => batchGabung.value.find(b => b.batchId === batchPilih.value))

// --- draft --------------------------------------------------------------------
const KUNCI_DRAF = 'stock-order-draf'
function simpanDraf() {
  try {
    localStorage.setItem(KUNCI_DRAF, JSON.stringify({ tgl: tgl.value, baris: baris.value }))
    toast.add({ title: 'Draf tersimpan', description: 'Draf order belanja tersimpan di perangkat ini.', color: 'success' })
  }
  catch {
    toast.add({ title: 'Draf gagal tersimpan', color: 'error' })
  }
}
onMounted(() => {
  try {
    const d = JSON.parse(localStorage.getItem(KUNCI_DRAF) || 'null')
    if (d && Array.isArray(d.baris) && d.baris.length) {
      tgl.value = d.tgl || tgl.value
      baris.value = d.baris.map((b: BarisOrder) => ({ k: ++nomor, item: b.item || '', qty: Number(b.qty) || 1, unit: b.unit || SATUAN_TERSEDIA[0]!, note: b.note || '' }))
    }
  }
  catch { /* no draft */ }
})

// --- pre-submit & kirim ----------------------------------------------------------
const sheet = ref(false)
const mengirim = ref(false)
const hasil = ref<{ created: number, merged: number, batchId: string, batchName: string, mergedItems: string[], menungguAcc?: boolean, divisi?: string[], jumlah?: number } | null>(null)

function cekSubmit() {
  if (siap.value.length === 0) {
    toast.add({ title: 'Belum ada baris', description: 'Isi minimal satu bahan dengan jumlah.', color: 'warning' })
    return
  }
  // Like the old screen (`ordering/index.html` Tahap 1 + `enforceSelection`):
  // the item must come from the master list — a free name is stored as an
  // order no vendor mapping can fulfil. Duplicates are refused the same way.
  const master = daftarNama.value
  if (master.length > 0 && siap.value.some(b => !master.includes(b.item.trim()))) {
    toast.add({ title: 'Data tidak valid', description: 'Ada bahan yang tidak terdaftar di master.', color: 'error' })
    return
  }
  const terlihat = new Set<string>()
  const ganda = siap.value.some((b) => {
    const k = b.item.trim().toLowerCase()
    if (terlihat.has(k)) return true
    terlihat.add(k)
    return false
  })
  if (ganda) {
    toast.add({ title: 'Terdapat duplikat input', description: 'Gabungkan jumlah bahan yang sama pada formulir.', color: 'error' })
    return
  }
  hasil.value = null
  sheet.value = true
}

async function kirim() {
  if (!bolehUbah.value) {
    toast.add({ title: 'Hanya bisa dilihat', description: 'Peran Ordering kamu (Check-in saja) tidak boleh mengajukan order belanja.', color: 'warning' })
    return
  }
  // A warehouse batch name would make the server treat a purchase as a CK /
  // Gudang Bar request (Gudang Bar even lowers its stock at once).
  if (mode.value === 'baru' && gudangDariBatch(namaBatch.value)) {
    toast.add({ title: 'Nama batch tidak boleh dipakai', description: `"${namaBatch.value.trim()}" khusus untuk menu gudangnya. Pakai nama lain.`, color: 'warning' })
    return
  }
  if (mode.value === 'gabung' && !batchPilih.value) {
    toast.add({ title: 'Batch belum dipilih', description: 'Pilih batch tujuan, atau kirim sebagai batch baru.', color: 'warning' })
    return
  }
  mengirim.value = true
  try {
    const r = await createBatch({
      orders: siap.value.map(b => ({
        item: b.item.trim(),
        qty: Math.max(1, Number(b.qty) || 1),
        unit: b.unit,
        note: b.note.trim() || '-',
        tglDatang: tgl.value,
      })),
      batchId: mode.value === 'gabung' ? batchPilih.value : undefined,
      batchName: mode.value === 'baru' ? (namaBatch.value.trim() || undefined) : undefined,
      // Approval Order (old 3 Nov 2026): the server holds a member's order for the head.
      accHead: true,
    })
    hasil.value = r
    await catatLog([r.menungguAcc
      ? { modul: 'ordering', aksi: 'order_acc_ajukan', ringkas: `Order belanja ${tgl.value} menunggu approval head (${(r.divisi ?? []).join('/')}): ${r.jumlah ?? 0} barang` }
      : { modul: 'ordering', aksi: 'order_baru', ringkas: `${r.created} baris baru, ${r.merged} gabung (${r.batchName})` }])
    try {
      localStorage.removeItem(KUNCI_DRAF)
    }
    catch { /* keep going */ }
    baris.value = []
    tambahBaris()
    tambahBaris()
    tambahBaris()
    namaBatch.value = ''
    batchPilih.value = ''
    mode.value = 'baru'
    await batchQ.refresh()
  }
  catch (e) {
    toast.add({ title: 'Pengiriman gagal', description: `${apiErrorMessage(e)} Pastikan internet stabil & coba lagi.`, color: 'error' })
  }
  finally {
    mengirim.value = false
  }
}
</script>

<template>
  <AppPage
    title="Form Order Belanja"
    description="Pengajuan Order Barang Baru — Tahap 1"
  >
    <p
      v-if="!bolehUbah"
      class="mb-4 rounded-xl border-l-4 border-warning bg-warning/10 p-3 text-sm text-warning"
    >
      Peran Ordering kamu <b>Check-in saja</b> — form ini hanya bisa dilihat. Minta admin Ordering mengubah peranmu bila perlu mengajukan order.
    </p>
    <!-- TAHAP 1 head card: the old dark-gold step panel, rebuilt as a DESIGN.md
      card (white, soft shadow, deep-gold step label). PIC + arrival date live
      inside, like old. -->
    <section class="mb-6 rounded-panel bg-default p-5 shadow-panel lg:p-7">
      <p class="text-[11px] font-bold uppercase tracking-widest text-gold-deep">
        Tahap 1
      </p>
      <h2 class="font-display text-lg font-bold text-highlighted lg:text-xl">
        Pengajuan Order Barang Baru
      </h2>
      <div class="mt-4 grid gap-3 border-t border-default pt-4 lg:grid-cols-2">
        <UFormField
          label="PIC pemesan"
          :ui="{ label: 'text-xs font-bold uppercase tracking-wider text-muted' }"
        >
          <!-- Read-only: the session's name and division, on the layer below. -->
          <div class="flex min-h-11 flex-wrap items-center gap-2 rounded-field bg-muted px-3 py-1.5 lg:min-h-9">
            <UIcon
              name="i-lucide-user-round"
              class="size-4 shrink-0 text-gold-deep"
            />
            <b class="text-sm text-highlighted">{{ me?.name ?? '—' }}</b>
            <AppStatus
              v-if="divisi"
              color="gold"
              icon="i-lucide-users"
              size="sm"
            >
              {{ divisi }}
            </AppStatus>
          </div>
        </UFormField>
        <div>
          <UFormField
            label="Tanggal rencana kedatangan"
            :ui="{ label: 'text-xs font-bold uppercase tracking-wider text-muted' }"
          >
            <AppTanggal v-model="tgl" />
          </UFormField>
          <AppChips
            v-model="tgl"
            :options="pintas.map(p => ({ value: p.value, label: p.label }))"
            class="mt-2"
          />
        </div>
      </div>
    </section>

    <AppPanel
      title="Item pesanan belanja"
      icon="i-lucide-shopping-cart"
      :count="baris.length"
    >
      <div class="flex flex-col gap-3">
        <div
          v-for="b in baris"
          :key="b.k"
          class="rounded-xl border border-default bg-muted p-3"
        >
          <UFormField label="Bahan">
            <div class="flex items-center gap-2">
              <USelectMenu
                :model-value="b.item || undefined"
                :items="opsiBahan"
                value-key="value"
                placeholder="Cari bahan…"
                :search-input="{ placeholder: 'Ketik nama bahan…' }"
                class="min-w-0 flex-1"
                @update:model-value="pilihBahan(b, String($event ?? ''))"
              />
              <UButton
                icon="i-lucide-layout-grid"
                color="neutral"
                variant="soft"
                square
                class="size-10 shrink-0 justify-center lg:size-8"
                title="Pilih dari kategori"
                aria-label="Pilih bahan dari kategori"
                @click="bukaPemilih(b.k)"
              />
            </div>
          </UFormField>
          <div class="mt-2 flex flex-wrap items-end gap-2">
            <div
              class="flex items-center gap-1.5"
              role="group"
              aria-label="Jumlah"
            >
              <UButton
                icon="i-lucide-minus"
                variant="outline"
                square
                class="size-10 justify-center lg:size-8"
                aria-label="Kurangi jumlah"
                @click="turunkan(b)"
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
                class="size-10 justify-center lg:size-8"
                aria-label="Tambah jumlah"
                @click="naikkan(b)"
              />
            </div>
            <UFormField
              label="Satuan"
              class="min-w-28 flex-1"
            >
              <USelect
                v-model="b.unit"
                :items="satuanOf(b.item)"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Catatan (opsional)"
              class="min-w-40 flex-[2]"
            >
              <UInput
                v-model="b.note"
                placeholder="Kosongkan bila tidak ada"
                class="w-full"
              />
            </UFormField>
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              square
              class="size-10 justify-center lg:size-8"
              aria-label="Hapus baris"
              @click="hapusBaris(b.k)"
            />
          </div>
        </div>
      </div>
      <!-- Add rows where the eye already is: right under the last row (owner
           request, Nov 2026). One empty row, or several at once by category. -->
      <div class="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold/40 text-sm font-semibold text-gold-deep transition-colors hover:border-gold hover:bg-gold-soft/40 lg:min-h-10"
          @click="tambahBaris"
        >
          <UIcon
            name="i-lucide-plus"
            class="size-4"
          />
          Tambah baris bahan
        </button>
        <button
          type="button"
          class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold/40 text-sm font-semibold text-gold-deep transition-colors hover:border-gold hover:bg-gold-soft/40 lg:min-h-10"
          @click="bukaPemilih()"
        >
          <UIcon
            name="i-lucide-layout-grid"
            class="size-4"
          />
          Pilih bahan dari kategori
        </button>
      </div>

      <div class="mt-4 flex flex-col gap-3 border-t border-default pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm font-bold text-muted">
          {{ siap.length }} baris siap dikirim
        </p>
        <div class="flex flex-col gap-2 sm:flex-row">
          <UButton
            label="Simpan draft"
            icon="i-lucide-save"
            color="neutral"
            variant="soft"
            @click="simpanDraf"
          />
          <UButton
            label="Cek & submit pesanan"
            icon="i-lucide-send"
            @click="cekSubmit"
          />
        </div>
      </div>
    </AppPanel>

    <StockPilihBahan
      v-model:open="pemilih.open"
      :produk="produk"
      :awal="namaDiForm"
      :tunggal="pemilih.k !== null"
      @pakai="pakaiPilihan"
    />

    <!-- Konfirmasi pesanan (old "Konfirmasi Pesanan" modal): who/when, where
         it goes (new batch or join one), the list to double-check, then send. -->
    <ResponsiveSheet
      v-model:open="sheet"
      :title="hasil ? (hasil.menungguAcc ? 'Menunggu approval head' : 'Pesanan terkirim') : 'Konfirmasi pesanan'"
      :description="hasil ? undefined : 'Periksa sekali lagi sebelum dikirim ke purchasing.'"
    >
      <div
        v-if="hasil?.menungguAcc"
        class="flex flex-col items-center gap-3 py-2 text-center"
      >
        <span class="grid size-14 place-items-center rounded-full bg-warning/10 text-warning">
          <UIcon
            name="i-lucide-user-check"
            class="size-7"
          />
        </span>
        <p class="text-sm text-default">
          <b class="text-highlighted">{{ hasil.jumlah ?? 0 }} barang</b> dikirim ke head
          <b class="text-highlighted">{{ (hasil.divisi ?? []).map(d => NAMA_DIVISI_ACC[d] ?? d).join('/') }}</b> untuk disetujui.
        </p>
        <p class="text-sm text-muted">
          Belum diteruskan ke Purchasing. Pantau statusnya di menu Approval Order › Pengajuan saya.
        </p>
      </div>
      <div
        v-else-if="hasil"
        class="flex flex-col items-center gap-3 py-2 text-center"
      >
        <span class="grid size-14 place-items-center rounded-full bg-success/10 text-success">
          <UIcon
            name="i-lucide-check"
            class="size-7"
          />
        </span>
        <p class="text-sm text-default">
          <b class="text-highlighted">{{ hasil.created }} baris baru</b>
          <template v-if="hasil.merged">
            dan <b class="text-highlighted">{{ hasil.merged }} digabung</b>
          </template>
          masuk ke batch <b class="text-gold-deep">“{{ hasil.batchName }}”</b>.
        </p>
        <p
          v-if="hasil.mergedItems.length"
          class="text-sm text-muted"
        >
          Digabung: {{ hasil.mergedItems.join(', ') }}
        </p>
      </div>

      <div
        v-else
        class="flex flex-col gap-4"
      >
        <!-- Who and when -->
        <div class="grid grid-cols-2 gap-3 rounded-xl border border-default bg-muted p-3">
          <div class="min-w-0">
            <p class="text-[11px] font-bold uppercase tracking-wider text-muted">
              PIC (pemesan)
            </p>
            <p class="mt-1 truncate font-semibold text-gold-deep">
              {{ me?.name ?? '—' }}
            </p>
            <p
              v-if="divisi"
              class="truncate text-xs text-muted"
            >
              {{ divisi }}
            </p>
          </div>
          <div class="min-w-0">
            <p class="text-[11px] font-bold uppercase tracking-wider text-muted">
              Tgl datang
            </p>
            <p class="mt-1 font-semibold text-gold-deep">
              {{ tglPendek(tgl) }}
            </p>
          </div>
        </div>

        <!-- Where it goes -->
        <div class="rounded-xl border border-default bg-muted p-3">
          <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
            Masukkan ke
          </p>
          <AppPilihan
            v-model="mode"
            name="order-batch"
            :options="[{ value: 'baru', label: 'Batch baru', icon: 'i-lucide-plus' }, { value: 'gabung', label: 'Gabung batch', icon: 'i-lucide-git-merge' }]"
          />
          <UInput
            v-if="mode === 'baru'"
            v-model="namaBatch"
            maxlength="60"
            placeholder="Nama batch (opsional, boleh dikosongkan)"
            class="mt-2 w-full"
          />
          <template v-else>
            <USelect
              v-model="batchPilih"
              :items="batchGabung.map(b => ({ value: b.batchId, label: `${b.batchName || b.batchId}${b.terarsip ? ' (arsip)' : ''}` }))"
              placeholder="Pilih batch yang masih terbuka"
              class="mt-2 w-full"
            />
            <p
              v-if="batchTerpilih"
              class="mt-2 text-xs text-muted"
            >
              Tanggal batch yang menang dipakai; item + satuan yang sama digabung ke baris lama.
            </p>
          </template>
        </div>

        <!-- What -->
        <div>
          <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
            Daftar barang ({{ siap.length }}) — pastikan benar
          </p>
          <ul class="flex max-h-72 flex-col gap-1.5 overflow-y-auto rounded-xl border border-default bg-muted p-2">
            <li
              v-for="b in siap"
              :key="b.k"
              class="flex items-center gap-3 rounded-lg bg-default px-3 py-2 shadow-panel"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold text-highlighted">{{ b.item.trim() }}</span>
                <span
                  v-if="b.note.trim()"
                  class="block truncate text-xs text-muted"
                >{{ b.note.trim() }}</span>
              </span>
              <span class="shrink-0 rounded-md bg-gold-soft px-2 py-0.5 text-xs font-bold text-gold-deep num">
                {{ Math.max(1, Number(b.qty) || 1) }} {{ b.unit }}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <template #footer>
        <template v-if="hasil">
          <UButton
            label="Tutup"
            class="w-full justify-center sm:w-auto"
            @click="sheet = false"
          />
        </template>
        <div
          v-else
          class="grid w-full grid-cols-2 gap-2"
        >
          <UButton
            label="Batal (edit form)"
            color="neutral"
            variant="soft"
            class="justify-center"
            @click="sheet = false"
          />
          <UButton
            label="Kirim pesanan"
            icon="i-lucide-send"
            :loading="mengirim"
            class="justify-center"
            @click="kirim"
          />
        </div>
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
