<!--
  Finance & Aset — the old viewFinance (howandi_life/index.html:745-790).
  Three sub-views: Ringkasan, Bulanan (the ledger, amounts in MILLIONS of
  rupiah), and Aset & Utang. Every ledger change is one record: upsert by
  (month, scope), and a row that ends up all-zero is deleted (F, `:786`).
-->
<script setup lang="ts">
import type { HlifeAsset, HlifeBusiness, HlifeLedger } from '~/composables/useHlife'
import {
  createHlifeRecord, deleteHlifeRecord, updateHlifeRecord,
  useHlifeResource,
} from '~/composables/useHlife'
import {
  ASSET_CATS, UNIT_LIST, bulanAgg, bulanLedger, labelScope, netWorth, rupiahRingkas,
  totalAssets, totalLiab,
} from '~/utils/hlife'
import { rupiah } from '~/utils/format'

definePageMeta({ access: ['howandi_life'] })

const toast = useToast()

const { data: ledgerData, status, refresh: refreshLedger } = useHlifeResource<HlifeLedger>('ledger')
const { data: assetData, refresh: refreshAset } = useHlifeResource<HlifeAsset>('assets')
const { data: bizData } = useHlifeResource<HlifeBusiness>('businesses')

const ledger = computed(() => ledgerData.value.rows)
const aset = computed(() => assetData.value.rows)
const bisnis = computed(() => bizData.value.rows)

const tampilan = ref<'summary' | 'monthly' | 'assets'>('summary')
const TAMPILAN: { value: 'summary' | 'monthly' | 'assets', label: string }[] = [
  { value: 'summary', label: 'Ringkasan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'assets', label: 'Aset & utang' },
]

const p2 = (n: number) => String(n).padStart(2, '0')
const kunciBulan = (off = 0) => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + off)
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`
}
const bulanPanjang = (mk: string) => (mk ? new Date(`${mk}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : '')

// --- summary ----------------------------------------------------------------

const bulanList = computed(() => bulanLedger(ledger.value))
const bulanTerakhir = computed(() => bulanList.value.slice(-1)[0])
const aggTerakhir = computed(() => (bulanTerakhir.value ? bulanAgg(ledger.value, bulanTerakhir.value) : null))

const kategoriAset = computed(() => {
  const peta = new Map<string, number>()
  aset.value.filter(a => !a.liab).forEach((a) => {
    peta.set(a.cat, (peta.get(a.cat) ?? 0) + (+a.value || 0))
  })
  return [...peta].sort((a, b) => b[1] - a[1])
})
const ta = computed(() => totalAssets(aset.value))

// --- monthly ledgers --------------------------------------------------------

const bulanInput = ref(kunciBulan())
const pIn = ref(0)
const pOut = ref(0)
const pNote = ref('')
const barisBisnis = ref<{ id: string, name: string, masuk: number, keluar: number }[]>([])

function entri(mk: string, scope: string) {
  return ledger.value.find(e => e.month === mk && e.scope === scope)
}

function sinkronInput() {
  const mk = bulanInput.value
  const per = entri(mk, 'personal') || { income: 0, expense: 0, note: '' }
  pIn.value = per.income || 0
  pOut.value = per.expense || 0
  pNote.value = per.note || ''
  barisBisnis.value = bisnis.value.map((b) => {
    const e = entri(mk, b.id)
    return { id: b.id, name: b.name, masuk: e?.income || 0, keluar: e?.expense || 0 }
  })
}
watch([bulanInput, ledger, bisnis], sinkronInput, { immediate: true, deep: true })

async function upsertLedger(mk: string, scope: string, income: number, expense: number, note: string) {
  const ex = entri(mk, scope)
  if (!income && !expense && !note) {
    if (ex) {
      const v = ledgerData.value.versions[ex.id]
      if (v !== undefined) await deleteHlifeRecord('ledger', ex.id, v)
    }
    return
  }
  if (ex) {
    const v = ledgerData.value.versions[ex.id]
    if (v === undefined) throw new Error('versi ledger tidak terbaca')
    await updateHlifeRecord('ledger', ex.id, { ...ex, income, expense, note }, v)
  }
  else {
    await createHlifeRecord<HlifeLedger>('ledger', { month: mk, scope, income, expense, note })
  }
}

const sibuk = ref(false)

function muatUlang() {
  return refreshLedger()
}

async function simpanBulan() {
  const mk = bulanInput.value
  sibuk.value = true
  try {
    await upsertLedger(mk, 'personal', Number(pIn.value) || 0, Number(pOut.value) || 0, pNote.value)
    for (const b of barisBisnis.value) {
      await upsertLedger(mk, b.id, Number(b.masuk) || 0, Number(b.keluar) || 0, '')
    }
    await refreshLedger()
    toast.add({ title: `Bulan ${bulanPanjang(mk)} tersimpan.`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

const hapusLedSheet = ref(false)
const ledHapus = ref<HlifeLedger | null>(null)
function tanyaHapusLed(e: HlifeLedger) {
  ledHapus.value = e
  hapusLedSheet.value = true
}
async function hapusLed() {
  const e = ledHapus.value
  hapusLedSheet.value = false
  if (!e) return
  const v = ledgerData.value.versions[e.id]
  if (v === undefined) return
  sibuk.value = true
  try {
    await deleteHlifeRecord('ledger', e.id, v)
    await refreshLedger()
  }
  catch (err) {
    if (!(await tanganiKonflik(err, muatUlang))) toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

/** `Riwayat per bulan`: newest first, personal row first (`:783`). */
const riwayatBulan = computed(() => bulanList.value.slice().reverse().map((mk) => {
  const es = ledger.value.filter(e => e.month === mk).slice().sort(a => (a.scope === 'personal' ? -1 : 1))
  const surplus = es.reduce((s, e) => s + ((+e.income || 0) - (+e.expense || 0)), 0)
  return { mk, es, surplus }
}))

// --- assets (`:933-936`) ----------------------------------------------------

const sheetAset = ref(false)
const hapusAsetSheet = ref(false)
const formAset = reactive({ id: '', name: '', cat: 'Properti', loc: '', qty: 0, unit: '', value: 0, liab: false })

const opsiCat = ASSET_CATS.map(c => ({ value: c as string, label: c }))

function bukaAset(a?: HlifeAsset) {
  Object.assign(formAset, a
    ? { id: a.id, name: a.name, cat: a.cat || 'Properti', loc: a.loc || '', qty: a.qty || 0, unit: a.unit || '', value: a.value || 0, liab: !!a.liab }
    : { id: '', name: '', cat: 'Properti', loc: '', qty: 0, unit: '', value: 0, liab: false })
  sheetAset.value = true
}

function setLiab(v: boolean) {
  formAset.liab = v
  if (v) formAset.cat = 'Utang'
}

async function simpanAset() {
  const name = formAset.name.trim()
  if (!name) {
    toast.add({ title: 'Nama wajib diisi.', color: 'error' })
    return
  }
  const body = {
    name,
    cat: formAset.cat,
    loc: formAset.loc,
    qty: Number(formAset.qty) || 0,
    unit: formAset.unit,
    value: Number(formAset.value) || 0,
    liab: !!formAset.liab,
  }
  sibuk.value = true
  try {
    if (formAset.id) {
      const v = assetData.value.versions[formAset.id]
      if (v === undefined) {
        toast.add({ title: 'Versi aset belum terbaca. Muat ulang halaman.', color: 'error' })
        return
      }
      await updateHlifeRecord('assets', formAset.id, { ...body, id: formAset.id }, v)
    }
    else {
      await createHlifeRecord<HlifeAsset>('assets', body)
    }
    await refreshAset()
    sheetAset.value = false
    toast.add({ title: 'Aset tersimpan.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshAset))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

function tanyaHapusAset(a: HlifeAsset) {
  formAset.id = a.id
  formAset.name = a.name
  hapusAsetSheet.value = true
}

async function hapusAset() {
  if (!formAset.id) return
  const v = assetData.value.versions[formAset.id]
  hapusAsetSheet.value = false
  if (v === undefined) return
  sibuk.value = true
  try {
    await deleteHlifeRecord('assets', formAset.id, v)
    await refreshAset()
    sheetAset.value = false
    toast.add({ title: 'Aset dihapus.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshAset))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

const persenKategori = (v: number) => (ta.value ? Math.round((v / ta.value) * 100) : 0)
</script>

<template>
  <AppPage
    title="Finance & Aset"
    description="Kekayaan pribadi + bisnis, ledger bulanan, dan semua aset — di mana pun tersimpan."
  >
    <template #actions>
      <AppSeg
        v-model="tampilan"
        :options="TAMPILAN"
        size="sm"
      />
    </template>

    <div
      v-if="status === 'pending' && !ledger.length && !aset.length"
      class="mb-4 space-y-2"
    >
      <!-- Loading stats mirror the finance summary below. -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <USkeleton
          v-for="i in 4"
          :key="i"
          class="h-20 rounded-xl"
        />
      </div>
      <USkeleton
        v-for="i in 4"
        :key="`r${i}`"
        class="h-10 w-full"
      />
      <p class="pt-1 text-sm text-muted">
        Memuat keuangan…
      </p>
    </div>

    <!-- Summary -->
    <template v-if="tampilan === 'summary'">
      <AppStatGrid>
        <AppStat
          label="Net worth"
          icon="i-lucide-landmark"
          :value="rupiahRingkas(netWorth(aset))"
          sub="Aset − utang"
          tone="gold"
        />
        <AppStat
          label="Total aset"
          icon="i-lucide-trending-up"
          :value="rupiahRingkas(ta)"
          :sub="`${aset.filter(a => !a.liab).length} pos aset`"
          tone="success"
        />
        <AppStat
          label="Total utang"
          icon="i-lucide-trending-down"
          :value="rupiahRingkas(totalLiab(aset))"
          :sub="`${aset.filter(a => a.liab).length} pos utang`"
          tone="error"
        />
      </AppStatGrid>

      <div class="grid gap-5 lg:grid-cols-3">
        <AppPanel
          title="Komposisi aset"
          icon="i-lucide-pie-chart"
          class="lg:col-span-2"
        >
          <AppBar
            v-for="[cat, v] in kategoriAset"
            :key="cat"
            :label="cat"
            :value="`${rupiahRingkas(v)} · ${persenKategori(v)}%`"
            :persen="persenKategori(v)"
          />
          <p
            v-if="!kategoriAset.length"
            class="text-sm text-muted"
          >
            Belum ada aset.
          </p>
        </AppPanel>

        <AppPanel
          :title="`Cashflow ${bulanTerakhir ? bulanPanjang(bulanTerakhir) : '—'}`"
          icon="i-lucide-wallet"
        >
          <template #actions>
            <UButton
              label="Ledger"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="tampilan = 'monthly'"
            />
          </template>
          <template v-if="aggTerakhir">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
                  Surplus personal
                </p>
                <p class="font-display text-lg font-bold text-primary-700 num">
                  {{ rupiahRingkas((aggTerakhir.pi - aggTerakhir.pe) * 1e6) }}
                </p>
              </div>
              <div>
                <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
                  Surplus bisnis
                </p>
                <p class="font-display text-lg font-bold text-primary-700 num">
                  {{ rupiahRingkas((aggTerakhir.bi - aggTerakhir.be) * 1e6) }}
                </p>
              </div>
            </div>
            <p class="mt-3 text-sm text-muted">
              Personal: masuk {{ rupiahRingkas(aggTerakhir.pi * 1e6) }} · keluar {{ rupiahRingkas(aggTerakhir.pe * 1e6) }}<br>
              Bisnis: masuk {{ rupiahRingkas(aggTerakhir.bi * 1e6) }} · keluar {{ rupiahRingkas(aggTerakhir.be * 1e6) }}
            </p>
          </template>
          <p
            v-else
            class="text-sm text-muted"
          >
            Belum ada catatan bulanan.
          </p>
        </AppPanel>
      </div>
    </template>

    <!-- Monthly ledger -->
    <template v-else-if="tampilan === 'monthly'">
      <AppPanel :title="`Input / edit — ${bulanPanjang(bulanInput)}`">
        <UFormField
          label="Bulan"
          class="max-w-[220px]"
        >
          <UInput
            v-model="bulanInput"
            type="month"
            class="w-full"
          />
        </UFormField>

        <p class="mt-4 text-[11px] font-bold uppercase tracking-wide text-muted">
          Personal (juta Rp)
        </p>
        <div class="mt-2 grid gap-3 sm:grid-cols-3">
          <UFormField label="Pemasukan">
            <UInput
              v-model.number="pIn"
              type="number"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Pengeluaran">
            <UInput
              v-model.number="pOut"
              type="number"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Catatan personal">
            <UInput
              v-model="pNote"
              class="w-full"
            />
          </UFormField>
        </div>

        <p class="mt-4 text-[11px] font-bold uppercase tracking-wide text-muted">
          Per bisnis / brand (juta Rp)
        </p>
        <div class="mt-2 overflow-hidden rounded-xl border border-default">
          <div
            v-for="(b, i) in barisBisnis"
            :key="b.id"
            class="grid grid-cols-[1.3fr_1fr_1fr] items-center gap-3 px-3 py-2"
            :class="i % 2 ? 'bg-muted/60' : 'bg-default'"
          >
            <span class="truncate text-sm font-medium">{{ b.name }}</span>
            <UInput
              v-model.number="b.masuk"
              type="number"
              placeholder="masuk"
              size="sm"
              class="w-full"
            />
            <UInput
              v-model.number="b.keluar"
              type="number"
              placeholder="keluar"
              size="sm"
              class="w-full"
            />
          </div>
          <p
            v-if="!barisBisnis.length"
            class="px-3 py-3 text-sm text-muted"
          >
            Belum ada bisnis.
          </p>
        </div>

        <div class="mt-4">
          <UButton
            :label="`Simpan ${bulanPanjang(bulanInput)}`"
            icon="i-lucide-check"
            :loading="sibuk"
            @click="simpanBulan"
          />
        </div>
        <p class="mt-2 text-xs text-muted">
          Kosongkan (0) untuk bisnis yang tidak ada transaksi bulan itu — otomatis tidak dicatat.
          Angka dalam juta rupiah.
        </p>
      </AppPanel>

      <AppPanel
        title="Riwayat per bulan"
        icon="i-lucide-history"
        :count="riwayatBulan.length"
      >
        <div
          v-for="r in riwayatBulan"
          :key="r.mk"
          class="mb-4 last:mb-0"
        >
          <div class="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
            <p class="font-display font-semibold text-highlighted">
              {{ bulanPanjang(r.mk) }}
              <UButton
                label="edit"
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="bulanInput = r.mk"
              />
            </p>
            <p class="text-sm text-muted">
              Total surplus:
              <b
                class="num"
                :class="r.surplus >= 0 ? 'text-success' : 'text-error'"
              >{{ rupiahRingkas(r.surplus * 1e6) }}</b>
            </p>
          </div>
          <div class="hidden lg:block">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-[11px] font-bold uppercase tracking-wide text-table-head-text">
                  <th class="bg-table-head px-3 py-2 text-start">
                    Untuk
                  </th>
                  <th class="bg-table-head px-3 py-2 text-end">
                    Masuk
                  </th>
                  <th class="bg-table-head px-3 py-2 text-end">
                    Keluar
                  </th>
                  <th class="bg-table-head px-3 py-2 text-end">
                    Surplus
                  </th>
                  <th class="bg-table-head px-3 py-2" />
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="e in r.es"
                  :key="e.id"
                >
                  <td class="px-3 py-2">
                    {{ labelScope(e.scope, bisnis) }}
                    <span
                      v-if="e.note"
                      class="block text-xs text-muted"
                    >{{ e.note }}</span>
                  </td>
                  <td class="px-3 py-2 text-end text-success num">
                    {{ e.income }}
                  </td>
                  <td class="px-3 py-2 text-end text-error num">
                    {{ e.expense }}
                  </td>
                  <td
                    class="px-3 py-2 text-end num"
                    :class="(e.income - e.expense) >= 0 ? 'text-success' : 'text-error'"
                  >
                    {{ e.income - e.expense }}
                  </td>
                  <td class="px-3 py-2 text-end">
                    <UButton
                      icon="i-lucide-trash-2"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      aria-label="Hapus baris"
                      @click="tanyaHapusLed(e)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Phone: the same rows as a card list (no sideways scroll). -->
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="e in r.es"
              :key="`m-${e.id}`"
              class="flex items-center gap-2 py-2"
            >
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-highlighted">
                  {{ labelScope(e.scope, bisnis) }}
                </p>
                <p
                  v-if="e.note"
                  class="text-xs text-muted"
                >
                  {{ e.note }}
                </p>
              </div>
              <div class="shrink-0 text-end text-xs">
                <p class="text-success num">
                  masuk {{ e.income }}
                </p>
                <p class="text-error num">
                  keluar {{ e.expense }}
                </p>
                <p
                  class="font-semibold num"
                  :class="(e.income - e.expense) >= 0 ? 'text-success' : 'text-error'"
                >
                  surplus {{ e.income - e.expense }}
                </p>
              </div>
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Hapus baris"
                @click="tanyaHapusLed(e)"
              />
            </div>
          </div>
        </div>
        <p
          v-if="!riwayatBulan.length"
          class="text-sm text-muted"
        >
          Belum ada catatan.
        </p>
        <p class="mt-2 text-xs text-muted">
          Angka dalam juta rupiah. Surplus = masuk − keluar.
        </p>
      </AppPanel>
    </template>

    <!-- Assets -->
    <template v-else>
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-muted">
          Catat aset & utang beserta lokasinya — bank, wallet, properti, equity bisnis.
        </p>
        <UButton
          label="Aset / utang"
          icon="i-lucide-plus"
          @click="bukaAset()"
        />
      </div>

      <AppPanel>
        <div
          v-if="aset.length"
          class="divide-y divide-default"
        >
          <div
            v-for="a in aset"
            :key="a.id"
            class="flex items-center gap-3 py-2.5"
          >
            <span
              class="size-2 shrink-0 rounded-full"
              :class="a.liab ? 'bg-error' : 'bg-success'"
              aria-hidden="true"
            />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-highlighted">
                {{ a.name }}
              </p>
              <div class="mt-1 flex flex-wrap gap-1">
                <AppStatus
                  size="sm"
                  :color="a.liab ? 'error' : 'success'"
                  :icon="a.liab ? 'i-lucide-trending-down' : 'i-lucide-trending-up'"
                >
                  {{ a.cat }}
                </AppStatus>
                <AppStatus
                  v-if="a.unit"
                  size="sm"
                  color="neutral"
                  icon="i-lucide-ruler"
                >
                  {{ a.qty ? `${a.qty} ` : '' }}{{ a.unit }}
                </AppStatus>
                <AppStatus
                  v-if="a.loc"
                  size="sm"
                  color="info"
                  icon="i-lucide-map-pin"
                >
                  {{ a.loc }}
                </AppStatus>
              </div>
            </div>
            <span
              class="whitespace-nowrap font-semibold num"
              :class="a.liab ? 'text-error' : 'text-highlighted'"
            >
              {{ a.liab ? '−' : '' }}{{ rupiah(a.value) }}
            </span>
            <div class="flex shrink-0 gap-1">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Ubah aset"
                @click="bukaAset(a)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Hapus aset"
                @click="tanyaHapusAset(a)"
              />
            </div>
          </div>
        </div>
        <p
          v-else
          class="py-6 text-center text-muted"
        >
          Belum ada aset.
        </p>
        <div class="mt-3 flex items-center justify-between border-t border-default pt-3">
          <span class="font-semibold text-highlighted">Net worth</span>
          <span class="font-display text-lg font-bold text-primary-700 num">{{ rupiah(netWorth(aset)) }}</span>
        </div>
      </AppPanel>
    </template>

    <!-- Asset form -->
    <ResponsiveSheet
      v-model:open="sheetAset"
      :title="formAset.id ? 'Edit aset' : 'Aset / utang baru'"
    >
      <div class="space-y-4">
        <UFormField
          label="Nama aset"
          required
        >
          <UInput
            v-model="formAset.name"
            placeholder="mis. Kas BCA / rumah / crypto"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Kategori">
            <USelect
              v-model="formAset.cat"
              :items="opsiCat"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Lokasi / di mana">
            <UInput
              v-model="formAset.loc"
              placeholder="BCA / metamask / rumah"
              size="xl"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Jumlah / berat (opsional)">
            <UInput
              v-model.number="formAset.qty"
              type="number"
              step="any"
              placeholder="mis. 100 / 2"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Satuan">
            <UInput
              v-model="formAset.unit"
              list="hlife-unit"
              placeholder="gram / hektar / unit"
              size="xl"
              class="w-full"
            />
            <datalist id="hlife-unit">
              <option
                v-for="u in UNIT_LIST"
                :key="u"
                :value="u"
              />
            </datalist>
          </UFormField>
        </div>
        <UFormField label="Nilai / total (Rp)">
          <UInput
            v-model.number="formAset.value"
            type="number"
            placeholder="120000000"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jenis">
          <AppPilihan
            :model-value="formAset.liab"
            name="aset-liab"
            :options="[{ value: false, label: 'Aset', icon: 'i-lucide-trending-up' }, { value: true, label: 'Utang', icon: 'i-lucide-trending-down' }]"
            @update:model-value="v => setLiab(!!v)"
          />
        </UFormField>
        <UButton
          v-if="formAset.id"
          label="Hapus aset"
          color="error"
          variant="soft"
          block
          @click="hapusAsetSheet = true"
        />
      </div>
      <template #footer>
        <UButton
          :label="formAset.id ? 'Simpan' : 'Tambah'"
          size="xl"
          :loading="sibuk"
          @click="simpanAset"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheetAset = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="hapusAsetSheet"
      title="Hapus aset?"
      :description="formAset.name"
    >
      <p class="text-sm text-muted">
        Aset ini akan dihapus permanen.
      </p>
      <template #footer>
        <UButton
          label="Hapus"
          color="error"
          size="xl"
          :loading="sibuk"
          @click="hapusAset"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="hapusAsetSheet = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="hapusLedSheet"
      title="Hapus baris ledger?"
      :description="ledHapus ? `${bulanPanjang(ledHapus.month)} · ${labelScope(ledHapus.scope, bisnis)}` : undefined"
    >
      <p class="text-sm text-muted">
        Baris ini akan dihapus; bulan lain tidak terpengaruh.
      </p>
      <template #footer>
        <UButton
          label="Hapus"
          color="error"
          size="xl"
          :loading="sibuk"
          @click="hapusLed"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="hapusLedSheet = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
