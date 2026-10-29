<!--
  POS › Kasir. The till, rebuilt from deploy/pos/index.html in the same order:
  PIN gate → group tiles (FOOD/BEVERAGES/OTHERS from the HPP `jenis` column) →
  category row → menu grid (white tiles, blue for drinks, orange for food, with
  the breadcrumb) → cart → table plan (Lt.1 Weekday/Weekend, Lt.2, like
  Reservasi) → pay sheet → text/graphic receipt with black logo + tear space.
  The Pay button is full-width. Offline-first: every save queues in
  localStorage and the 15s poll uploads it (usePos).
-->
<script setup lang="ts">
import type { MenuPos, OrderPos } from '~/utils/pos'
import { CARA_BAYAR_POS, grupMenuPos, hariIniPos, hitungOrderPos, laporanHarianPos, rupiahPos, strukTeksPos } from '~/utils/pos'
import { LT_CFG, VENUE_LAYOUTS } from '~/utils/venue-layouts'
import { antreOrderPos, gabungMenuPos, mulaiPos, printerPos, usePosDb, usePosSetting, usePosSync, usePosUser, pilihUserPos } from '~/composables/usePos'

definePageMeta({ access: ['pos'] })

const toast = useToast()
const route = useRoute()
const db = usePosDb()
const setting = usePosSetting()
const siapa = usePosUser()
const sync = usePosSync()

onMounted(() => mulaiPos())

// ── PIN gate ────────────────────────────────────────────────────────────
const pin = ref('')
const pinSalah = ref('')
const penggunaAktif = computed(() => (setting.value?.users || []).filter(u => u.aktif !== false))

function tekanPin(d: string): void {
  pinSalah.value = ''
  if (pin.value.length < 6) {
    pin.value += d
  }
}
function masukPin(): void {
  const u = penggunaAktif.value.find(x => x.pin === pin.value && x.pin.length >= 4)
  if (!u) {
    pinSalah.value = 'PIN salah. Minta PIN ke admin bila lupa.'
    pin.value = ''
    return
  }
  if (u.role !== 'admin' && !penggunaAktif.value.some(x => x.role === 'admin')) {
    pinSalah.value = 'Belum ada Admin aktif. Minta admin membuka Pengaturan dulu.'
    pin.value = ''
    return
  }
  pilihUserPos(u)
  pin.value = ''
}

// ── current order ───────────────────────────────────────────────────────
const kosongkan = (kasir: string): OrderPos => ({
  id: `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  no: '', tgl: hariIniPos(), status: 'open', items: [], meja: 'Quick Service',
  notes: '', pax: 1, mode: 'DINE IN', diskon: 0, diskonRp: 0, payments: [],
  kasir, at: Date.now(), scPct: setting.value?.sc ?? 5, pb1Pct: setting.value?.pb1 ?? 10,
  updatedAt: Date.now(),
})

const order = ref<OrderPos>(kosongkan(''))
const promoBuka = ref(false)
watch(siapa, (u) => {
  if (u && !order.value.items.length && !order.value._base) order.value = kosongkan(u.nama)
}, { immediate: true })
watch(() => route.query.order, (id) => {
  const temu = typeof id === 'string' && id ? db.value.find(o => o.id === id) : undefined
  if (temu && (temu.status === 'open' || temu.status === 'draft')) order.value = { ...temu, items: temu.items.map(i => ({ ...i })), payments: [] }
})

const menu = computed<MenuPos[]>(() => gabungMenuPos(setting.value))
const grup = ref<'FOOD' | 'BEVERAGES' | 'OTHERS' | ''>('')
const kat = ref('')
const cari = ref('')

const grupHitung = computed(() => {
  const g: Record<string, { kats: Record<string, number> }> = {}
  for (const m of menu.value) {
    const gk = grupMenuPos(m)
    g[gk] ??= { kats: {} }
    g[gk].kats[m.kat || '(tanpa kategori)'] = (g[gk].kats[m.kat || '(tanpa kategori)'] || 0) + 1
  }
  return (['FOOD', 'BEVERAGES', 'OTHERS'] as const).filter(k => g[k]).map(k => ({ k, n: Object.values(g[k]!.kats).reduce((a, b) => a + b, 0) }))
})
const katDaftar = computed(() => {
  const k: Record<string, number> = {}
  for (const m of menu.value.filter(m => !grup.value || grupMenuPos(m) === grup.value)) k[m.kat || '(tanpa kategori)'] = (k[m.kat || '(tanpa kategori)'] || 0) + 1
  return Object.keys(k).sort((a, b) => a.localeCompare(b)).map(nama => ({ nama, n: k[nama]! }))
})
const menuTampil = computed(() => menu.value.filter((m) => {
  if (grup.value && grupMenuPos(m) !== grup.value) return false
  if (kat.value && (m.kat || '(tanpa kategori)') !== kat.value) return false
  if (cari.value && !m.nama.toLowerCase().includes(cari.value.toLowerCase())) return false
  return true
}))

const total = computed(() => hitungOrderPos(order.value, setting.value?.sc ?? 5, setting.value?.pb1 ?? 10))

function tambah(m: MenuPos): void {
  const baris = order.value.items.find(i => i.id === m.id)
  if (baris) baris.qty += 1
  else order.value.items.push({ id: m.id, nama: m.nama, harga: m.harga, qty: 1 })
}
function ubahQty(i: number, d: number): void {
  const baris = order.value.items[i]
  if (!baris) return
  baris.qty += d
  if (baris.qty <= 0) order.value.items.splice(i, 1)
}

const simpan = (status: 'open' | 'draft'): void => {
  if (!order.value.items.length) {
    toast.add({ title: 'Keranjang masih kosong', description: 'Ketuk menu untuk menambah item.', color: 'warning' })
    return
  }
  const o = { ...order.value, status, _base: order.value._base ?? order.value.updatedAt }
  antreOrderPos(o)
  order.value = kosongkan(siapa.value?.nama || '')
}

// ── table plan ──────────────────────────────────────────────────────────
const lantai = ref<1 | 2>(1)
const layoutAktif = computed(() => {
  if (lantai.value === 2) return VENUE_LAYOUTS[LT_CFG[2]!.wd] ?? Object.values(VENUE_LAYOUTS)[0]!
  return VENUE_LAYOUTS[weekendPos(order.value.tgl) ? LT_CFG[1]!.we : LT_CFG[1]!.wd] ?? Object.values(VENUE_LAYOUTS)[0]!
})
const weekendPos = (iso: string): boolean => {
  const g = new Date(`${iso}T00:00:00`).getDay()
  return g === 0 || g === 5 || g === 6
}
const mejaTerisi = computed(() => db.value.filter(o => (o.status === 'open' || o.status === 'draft') && o.id !== order.value.id).map(o => o.meja))

// ── pay sheet + receipt ─────────────────────────────────────────────────
const bayarBuka = ref(false)
const cara = ref('CASH')
const nominal = ref('')
const strukBuka = ref(false)
const strukTerakhir = ref<OrderPos | null>(null)
const cetakMode = ref<'teks' | 'grafis'>('teks')

const tambahBayar = (): void => {
  const n = Math.round(Number(String(nominal.value).replace(/[^0-9]/g, '')) || 0)
  if (n <= 0) return
  order.value.payments.push({ cara: cara.value, amount: n })
  nominal.value = ''
}
/** Quick cash buttons like the old till: exact, then rounded up to 10/50/100rb. */
const saranNominal = computed<number[]>(() => {
  const o = total.value.outstanding
  const atas = (v: number, k: number): number => Math.ceil(v / k) * k
  return [...new Set([o, atas(o, 10000), atas(o, 50000), atas(o, 100000)])].filter(v => v > 0).slice(0, 3)
})
const bayarLunas = (): void => {
  if (total.value.outstanding > 0) {
    toast.add({ title: 'Belum lunas', description: `Kurang ${rupiahPos(total.value.outstanding)}.`, color: 'warning' })
    return
  }
  const o = {
    ...order.value, status: 'paid' as const, paidAt: Date.now(),
    no: order.value.no || `B${String(laporanHarianPos(db.value, order.value.tgl, 0, 0).trx + 1).padStart(4, '0')}`,
    _base: order.value._base ?? order.value.updatedAt,
  }
  antreOrderPos(o)
  strukTerakhir.value = o
  strukBuka.value = true
  bayarBuka.value = false
  if (printerPos().otomatis) setTimeout(() => cetakStruk(), 300)
  order.value = kosongkan(siapa.value?.nama || '')
}
const strukTeks = computed(() => {
  const o = strukTerakhir.value
  if (!o) return ''
  return strukTeksPos(o, hitungOrderPos(o, setting.value?.sc ?? 5, setting.value?.pb1 ?? 10), {
    outlet: 'Laksamana Muda', station: 'A', kasir: o.kasir, kaki: printerPos().kaki,
  }, printerPos().kolom)
})

/** Print the receipt in its own document: text mode is a plain <pre> (fits any
 * driver, incl. Generic/Text Only), graphic mode adds the black logo block.
 * Repeats the body for the configured copy count. */
function cetakStruk(): void {
  const o = strukTerakhir.value
  if (!o) return
  const p = printerPos()
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const logo = cetakMode.value === 'grafis' && p.logo
    ? `<div style="background:#000;color:#fff;font-weight:900;text-align:center;padding:6px;margin-bottom:8px;">LAKSAMANA MUDA</div>`
    : ''
  const dok = window.open('', '_blank', 'width=320,height=600')
  if (!dok) {
    toast.add({ title: 'Popup diblokir', description: 'Izinkan popup untuk mencetak struk.', color: 'warning' })
    return
  }
  dok.document.write(`<html><head><title>Struk ${esc(o.no || o.id)}</title></head><body style="width:${p.lebar}mm;margin:0 auto;padding-bottom:20mm;font-family:monospace;">${`<div>${logo}<pre style="font-size:12px;white-space:pre-wrap;">${esc(strukTeks.value)}</pre></div>`.repeat(Math.max(1, Math.min(3, +p.salinan || 1)))}<scr` + `ipt>onload=()=>{print();}</scr` + `ipt></body></html>`)
  dok.document.close()
}

function keluar(): void {
  pilihUserPos(null)
  navigateTo('/pos/kasir')
}

const sinkronLabel = computed(() => {
  if (sync.value.sedang) return 'Menyinkron…'
  if (sync.value.gagal) return `Belum sinkron: ${sync.value.gagal}`
  return 'Tersinkron'
})
</script>

<template>
  <div>
    <!-- PIN gate -->
    <AppPage
      v-if="!siapa"
      title="POS"
      description="Ketuk PIN untuk membuka kasir."
    >
      <AppPanel
        title="Masuk kasir"
        icon="i-lucide-key-round"
      >
        <p class="mb-3 text-sm text-muted">
          Kasir: Andy · Tasya · Gita · Faila. Admin membuka Laporan & Pengaturan.
        </p>
        <div class="mx-auto max-w-60">
          <div class="mb-2 text-center text-2xl font-bold tracking-widest num">
            {{ '•'.repeat(pin.length) || '––––––' }}
          </div>
          <p
            v-if="pinSalah"
            class="mb-2 text-center text-sm text-error"
          >
            {{ pinSalah }}
          </p>
          <div class="grid grid-cols-3 gap-2">
            <UButton
              v-for="d in ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']"
              :key="d"
              :label="d"
              color="neutral"
              variant="soft"
              size="xl"
              class="min-h-11 justify-center"
              @click="d === '⌫' ? pin = pin.slice(0, -1) : d && tekanPin(d)"
            />
          </div>
          <UButton
            label="Masuk"
            color="neutral"
            size="xl"
            block
            class="mt-3 bg-ink-900 text-white"
            @click="masukPin()"
          />
        </div>
      </AppPanel>
    </AppPage>

    <AppPage
      v-else
      title="Kasir"
      :description="`Halo, ${siapa.nama} · ${sinkronLabel}`"
    >
      <template #actions>
        <UButton
          :label="siapa.nama"
          icon="i-lucide-user-round"
          color="neutral"
          variant="soft"
          @click="keluar()"
        />
      </template>

      <div class="grid gap-5 lg:grid-cols-[1fr_360px]">
        <!-- menu grid -->
        <AppPanel
          title="Menu"
          icon="i-lucide-utensils"
        >
          <template #head>
            <AppSeg
              v-model="grup"
              :options="[{ value: '', label: 'Semua' }, ...grupHitung.map(g => ({ value: g.k, label: `${g.k} (${g.n})` }))]"
              size="sm"
            />
          </template>
          <div class="mb-3 flex flex-wrap gap-2">
            <UButton
              v-for="k in katDaftar"
              :key="k.nama"
              :label="`${k.nama} (${k.n})`"
              :color="kat === k.nama ? 'neutral' : undefined"
              :variant="kat === k.nama ? 'solid' : 'soft'"
              size="sm"
              @click="kat = kat === k.nama ? '' : k.nama"
            />
          </div>
          <UInput
            v-model="cari"
            placeholder="Cari menu…"
            icon="i-lucide-search"
            class="mb-3"
          />
          <p
            v-if="grup || kat"
            class="mb-2 text-sm text-muted"
          >
            {{ grup || 'Semua' }}{{ kat ? ` › ${kat}` : '' }}
          </p>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <UButton
              v-for="m in menuTampil"
              :key="m.id"
              color="neutral"
              variant="soft"
              class="h-auto min-h-11 flex-col items-start gap-0.5 p-2.5 text-left"
              @click="tambah(m)"
            >
              <span class="text-sm font-semibold text-highlighted">{{ m.nama }}</span>
              <span class="text-xs text-muted num">{{ rupiahPos(m.harga) }}</span>
            </UButton>
          </div>
          <p
            v-if="!menuTampil.length"
            class="py-6 text-center text-sm text-dimmed"
          >
            Tidak ada menu di kelompok ini.
          </p>
        </AppPanel>

        <!-- cart -->
        <div>
          <AppPanel
            title="Order"
            icon="i-lucide-receipt-text"
            :count="total.qty"
          >
            <div class="mb-3 grid grid-cols-2 gap-2">
              <UFormField label="Meja">
                <UInput v-model="order.meja" />
              </UFormField>
              <UFormField label="Pax">
                <UInput
                  v-model.number="order.pax"
                  type="number"
                  min="1"
                />
              </UFormField>
            </div>
            <AppSeg
              v-model="order.mode"
              :options="[{ value: 'DINE IN', label: 'Dine in' }, { value: 'TAKE AWAY', label: 'Take away' }]"
              size="sm"
              class="mb-2"
            />
            <UFormField label="Catatan order">
              <UInput
                v-model="order.notes"
                placeholder="Dicetak di struk checker"
              />
            </UFormField>
            <div class="mt-2 flex items-center justify-between text-sm">
              <span class="text-muted">{{ order.diskon ? `Promo ${order.diskon}%` : 'Tanpa promo' }}</span>
              <UButton
                label="Promo"
                icon="i-lucide-badge-percent"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="promoBuka = true"
              />
            </div>
            <AppList>
              <AppListRow
                v-for="(it, i) in order.items"
                :key="`${it.id}-${i}`"
                :title="`${it.qty}x ${it.nama}`"
                :description="rupiahPos(it.harga * it.qty)"
              >
                <template #trailing>
                  <div class="flex items-center gap-1">
                    <UButton
                      icon="i-lucide-minus"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      aria-label="Kurangi"
                      @click="ubahQty(i, -1)"
                    />
                    <UButton
                      icon="i-lucide-plus"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      aria-label="Tambah"
                      @click="ubahQty(i, 1)"
                    />
                  </div>
                </template>
              </AppListRow>
            </AppList>
            <p
              v-if="!order.items.length"
              class="py-4 text-center text-sm text-dimmed"
            >
              Ketuk menu untuk menambah item.
            </p>
            <dl class="mt-3 space-y-1 text-sm">
              <div class="flex justify-between">
                <dt class="text-muted">
                  Subtotal
                </dt><dd class="num">
                  {{ rupiahPos(total.sub) }}
                </dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted">
                  SC ({{ total.scPct }}%)
                </dt><dd class="num">
                  {{ rupiahPos(total.sc) }}
                </dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted">
                  PB1 ({{ total.pb1Pct }}%)
                </dt><dd class="num">
                  {{ rupiahPos(total.pb1) }}
                </dd>
              </div>
              <div class="flex justify-between text-base font-bold text-highlighted">
                <dt>Total</dt><dd class="num">
                  {{ rupiahPos(total.grand) }}
                </dd>
              </div>
            </dl>
            <div class="mt-3 grid gap-2">
              <UButton
                label="Simpan (tetap terbuka)"
                icon="i-lucide-save"
                color="neutral"
                variant="soft"
                block
                @click="simpan('open')"
              />
              <UButton
                label="Bayar"
                icon="i-lucide-banknote"
                color="neutral"
                size="xl"
                block
                class="bg-ink-900 text-white"
                @click="bayarBuka = true"
              />
            </div>
          </AppPanel>

          <!-- table plan -->
          <AppPanel
            title="Denah meja"
            icon="i-lucide-layout-grid"
            :description="lantai === 2 ? 'Lantai 2' : (weekendPos(order.tgl) ? 'Lt. 1 · Weekend (Jum–Min)' : 'Lt. 1 · Weekday')"
          >
            <template #actions>
              <AppSeg
                v-model="lantai"
                :options="[{ value: 1, label: 'Lt. 1' }, { value: 2, label: 'Lt. 2' }]"
                size="sm"
              />
            </template>
            <PosDenah
              :layout="layoutAktif"
              :terisi="mejaTerisi"
              :terpilih="order.meja"
              @pilih="(m) => order.meja = m"
            />
            <p class="mt-2 text-xs text-muted">
              Bingkai merah = ada order terbuka. Ketuk meja untuk memakai di order ini.
            </p>
          </AppPanel>
        </div>
      </div>
    </AppPage>

    <!-- pay sheet -->
    <ResponsiveSheet
      v-model:open="bayarBuka"
      title="Bayar"
      :description="`Total ${rupiahPos(total.grand)}`"
    >
      <div class="grid gap-3">
        <AppSeg
          v-model="cara"
          :options="CARA_BAYAR_POS.map(c => ({ value: c, label: c }))"
          size="sm"
        />
        <div class="flex gap-2">
          <UInput
            v-model="nominal"
            placeholder="Nominal"
            inputmode="numeric"
            class="flex-1"
          />
          <UButton
            label="Pas"
            color="neutral"
            variant="soft"
            @click="nominal = String(total.outstanding)"
          />
          <UButton
            label="Tambah"
            color="neutral"
            @click="tambahBayar()"
          />
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="s in saranNominal"
            :key="s"
            :label="rupiahPos(s)"
            color="neutral"
            variant="soft"
            size="sm"
            @click="nominal = String(s)"
          />
        </div>
        <AppList>
          <AppListRow
            v-for="(p, i) in order.payments"
            :key="i"
            :title="p.cara"
            :description="rupiahPos(p.amount)"
          >
            <template #trailing>
              <UButton
                icon="i-lucide-x"
                color="error"
                variant="ghost"
                size="sm"
                aria-label="Hapus pembayaran"
                @click="order.payments.splice(i, 1)"
              />
            </template>
          </AppListRow>
        </AppList>
        <p class="text-sm">
          Sudah dibayar <b class="num">{{ rupiahPos(total.bayar) }}</b> ·
          kurang <b class="num">{{ rupiahPos(total.outstanding) }}</b>
          <span v-if="total.kembali">· kembali <b class="num">{{ rupiahPos(total.kembali) }}</b></span>
        </p>
      </div>
      <template #footer>
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="bayarBuka = false"
        />
        <UButton
          label="Terapkan pembayaran"
          icon="i-lucide-check"
          color="neutral"
          class="bg-ink-900 text-white"
          @click="bayarLunas()"
        />
      </template>
    </ResponsiveSheet>

    <!-- receipt -->
    <ResponsiveSheet
      v-model:open="strukBuka"
      title="Struk"
      description="Pratinjau sama dengan yang dicetak."
    >
      <AppSeg
        v-model="cetakMode"
        :options="[{ value: 'teks', label: 'Teks (42 kolom)' }, { value: 'grafis', label: 'Grafis + logo' }]"
        size="sm"
      />
      <pre
        v-if="cetakMode === 'teks'"
        class="mt-3 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre"
      >{{ strukTeks }}</pre>
      <div
        v-else
        class="struk-grafis mx-auto mt-3"
      >
        <div class="struk-logo">
          LOGO
        </div>
        <pre class="font-mono text-xs whitespace-pre">{{ strukTeks }}</pre>
      </div>
      <template #footer>
        <UButton
          label="Tutup"
          color="neutral"
          variant="ghost"
          @click="strukBuka = false"
        />
        <UButton
          label="Cetak"
          icon="i-lucide-printer"
          color="neutral"
          class="bg-ink-900 text-white"
          @click="cetakStruk()"
        />
      </template>
    </ResponsiveSheet>

    <!-- promo -->
    <ResponsiveSheet
      v-model:open="promoBuka"
      title="Promo"
      description="Diskon persen untuk order ini."
    >
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="n in [0, 5, 10, 15, 20, 25, 50]"
          :key="n"
          :label="n ? `${n}%` : 'Tanpa promo'"
          :color="order.diskon === n ? 'neutral' : undefined"
          :variant="order.diskon === n ? 'solid' : 'soft'"
          size="sm"
          @click="order.diskon = n; promoBuka = false"
        />
      </div>
    </ResponsiveSheet>
  </div>
</template>

<style scoped>
.struk-grafis {
  width: 70mm;
  max-width: 100%;
  border: 1px solid var(--ui-border);
  padding: 8mm 4mm 20mm;
}
.struk-logo {
  background: var(--ui-text);
  color: var(--ui-bg);
  font-weight: 900;
  text-align: center;
  padding: 6px;
  margin-bottom: 8px;
}
</style>
