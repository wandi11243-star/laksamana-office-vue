<!--
  Marketing › Menu Kalkulator (docs/migrasi/marketing.md D.19, issue #63; old
  deploy/marketing/index.html:18935-19885).

  "Hitung harga jual per pax lalu diskon dari harga deal customer." Menu &
  price = the active Prasmanan recipes of HPP & Resep, through the HPP engine
  (`hpp-mesin.ts` over `stock-hpp.ts`) — no formula is copied here. Only admins
  (module admin / Super Admin) see the cost per portion. The named history (old
  S.kalkHistori) is stored as the `documents/kalkHistori` document (G-09).
-->
<script setup lang="ts">
import { getHppIngredients, getHppRecipes, getProducts, hppSettings } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { hppMesin } from '~/utils/hpp-mesin'
import type { BarisKalkMkt, RiwayatKalkMkt } from '~/utils/marketing-kalk'
import {
  barisBaruKalkMkt, bolehHapusKalkMkt, cekHargaKalkMkt, dealKalkMkt, diskonRiwayatKalkMkt, idxWarnaKatKalkMkt,
  itemRefKalkMkt, menuKalkMkt, rasioKalkMkt, refKalkMkt, rekamKalkMkt, ringkasKalkMkt, semuaMenuKalkMkt,
  terapkanPilihKalkMkt, urutRiwayatKalkMkt, WARNA_KAT_KALK_MKT, yieldAnehKalkMkt,
} from '~/utils/marketing-kalk'
import { angka, fTgl, rupiah } from '~/utils/format'
import type { BahanHppHitung, ResepHitung } from '~/utils/stock-hpp'

definePageMeta({ access: ['marketing'] })

const toast = useToast()
const me = useMe()
const { saya } = useAksesMkt()
// kalkAdmin() = pfoAdminModul(): module admin, Superadmin, or the module's Super Admin role.
const admin = computed(() => isAdminOf(me.value, 'marketing') || saya.value?.user.role === 'super_admin')

const { data: hpp, status, error, refresh } = useAsyncData('mkt-kalk-hpp', async () => {
  const [b, r, s] = await Promise.all([getHppIngredients(), getHppRecipes(), hppSettings()])
  // Purchasing products only feed package-unit conversion of the COST — admins only;
  // a failure there must not take the calculator down (old muatHppKalk).
  const p = admin.value ? await getProducts().catch(() => ({ rows: [] })) : { rows: [] }
  return { bahan: b.rows, resep: r.rows, setting: s.data, produk: p.rows }
})

const mesin = computed(() => {
  const d = hpp.value
  if (!d) return null
  return hppMesin({
    bahan: d.bahan as unknown as BahanHppHitung[],
    resep: d.resep as unknown as ResepHitung[],
    setting: d.setting,
    produk: d.produk.map(p => ({ nama: String(p.nama ?? ''), satuanDasar: String(p.satuanDasar ?? ''), isi: (p.isi ?? {}) as Record<string, number> })),
  })
})
const items = computed(() => (mesin.value ? menuKalkMkt(mesin.value) : {}))
const semua = computed(() => semuaMenuKalkMkt(items.value))
const opsiMenu = computed(() => semua.value.map(m => ({
  value: refKalkMkt(m),
  label: `${m.kat} - ${m.n} (${m.h == null ? 'harga -' : `${rupiah(m.h)} / ${m.u}`})`,
})))

// Kept for the session, never saved (old KALK lived in a page global).
const k = useState('mkt-kalk', () => ({ rows: [{ ref: '', pcs: 100 }] as BarisKalkMkt[], pax: 100, deal: null as number | null }))
const pax = computed({
  get: () => k.value.pax,
  set: (v) => { k.value.pax = Math.max(0, Math.round(Number(v) || 0)) },
})
const dealTeks = computed({
  get: () => (k.value.deal == null ? '' : angka(k.value.deal)),
  set: (v: string) => {
    const t = String(v).replace(/\D/g, '')
    k.value.deal = t === '' ? null : Number(t)
  },
})
const rk = computed(() => ringkasKalkMkt(items.value, k.value.rows, k.value.pax))
const deal = computed(() => dealKalkMkt(rk.value.perPax, k.value.deal, rk.value.pax))

const item = (ref: string) => itemRefKalkMkt(items.value, ref)
const warna = (ref: string) => WARNA_KAT_KALK_MKT[idxWarnaKatKalkMkt(ref.slice(0, ref.indexOf('|')))]
const subBaris = (r: BarisKalkMkt) => {
  const it = item(r.ref)
  return !r.ref || it?.h == null ? null : it.h * (Math.max(0, Math.round(+r.pcs || 0)))
}
const modalBaris = (r: BarisKalkMkt) => {
  const it = item(r.ref)
  return it && mesin.value ? mesin.value.modalPorsi(it.r) : null
}

function setPcs(i: number, v: unknown) {
  const r = k.value.rows[i]
  if (r) r.pcs = Math.max(0, Math.round(Number(v) || 0))
}
function setRef(i: number, ref: unknown) {
  const r = k.value.rows[i]
  if (r) r.ref = typeof ref === 'string' ? ref : ''
}
function samakanPax(i: number) {
  setPcs(i, k.value.pax)
}
function tambahBaris() {
  k.value.rows.push(barisBaruKalkMkt(k.value.pax))
}
function hapusBaris(i: number) {
  k.value.rows.splice(i, 1)
  if (!k.value.rows.length) k.value.rows.push(barisBaruKalkMkt(k.value.pax))
}

// Picker: whole table, or one row (`baris` = its index).
const pilih = ref({ open: false, baris: -1 })
function bukaPilih(baris = -1) {
  pilih.value = { open: true, baris }
}
function pakai(refs: string[]) {
  if (pilih.value.baris >= 0) {
    setRef(pilih.value.baris, refs[0] ?? '')
    return
  }
  k.value.rows = terapkanPilihKalkMkt(k.value.rows, refs, k.value.pax)
  toast.add({ title: 'Menu diperbarui', description: `${refs.length} menu masuk hitungan.`, color: 'success' })
}
const awalPilih = computed(() => k.value.rows.map(r => r.ref).filter(Boolean))

// ---- named history (G-09, old S.kalkHistori) ----
// Saved as the documents/kalkHistori document (content-hash version), so one
// calculation never wipes another: ubahKalkHistoriMkt re-reads before writing.
const { data: hist, refresh: muatHist } = useAsyncData('mkt-kalk-histori', () =>
  getKalkHistoriMkt().then(r => urutRiwayatKalkMkt((r.data ?? []) as RiwayatKalkMkt[])),
{ default: () => [] as RiwayatKalkMkt[] })
const namaSimpan = ref('')
const bukaId = ref<string | null>(null)
const riwayat = computed(() => hist.value ?? [])
const bolehHapusRiwayat = (x: RiwayatKalkMkt) =>
  bolehHapusKalkMkt(x, admin.value, String(me.value?.id ?? ''), me.value?.name ?? '')

async function simpanRiwayat() {
  const nama = namaSimpan.value.trim()
  if (!nama) {
    toast.add({ title: 'Nama perhitungan wajib', description: 'Tulis untuk kebutuhan apa perhitungan ini (mis. "Event PT Maju 12 Okt").', color: 'error' })
    return
  }
  const rk = ringkasKalkMkt(items.value, k.value.rows, k.value.pax)
  if (!rk.baris.length) {
    toast.add({ title: 'Belum ada menu', description: 'Pilih minimal satu menu dulu sebelum menyimpan.', color: 'error' })
    return
  }
  const rec = rekamKalkMkt(
    `kh${Date.now().toString(36)}${Math.floor(Math.random() * 1e5).toString(36)}`,
    nama, rk, k.value.deal,
    me.value?.name ?? '', String(me.value?.id ?? ''),
    new Date().toISOString(), Date.now(),
  )
  const ok = await mktSimpan(
    () => ubahKalkHistoriMkt(list => [rec, ...list]),
    'Tersimpan',
    { refType: 'kalk', refId: rec.id, action: 'Simpan perhitungan kalkulator', detail: `${nama} · ${rk.pax} pax · ${rupiah(rk.perPax)}/pax` },
  )
  if (!ok) return
  await muatHist()
  namaSimpan.value = ''
  bukaId.value = rec.id
}

/** Reopen a saved calculation; prices that moved (or menus gone) are NAMED, not silently used. */
function bukaRiwayat(x: RiwayatKalkMkt) {
  k.value.rows = (x.rows ?? []).map(r => ({ ref: r.ref, pcs: Math.max(0, Math.round(+r.pcs || 0)) }))
  if (!k.value.rows.length) k.value.rows = [barisBaruKalkMkt(k.value.pax)]
  k.value.pax = Math.max(0, Math.round(+x.pax || 0))
  k.value.deal = x.deal == null ? null : +x.deal
  bukaId.value = x.id
  namaSimpan.value = x.nama ?? ''
  const { berubah, hilang } = cekHargaKalkMkt(x, items.value)
  if (hilang.length) {
    toast.add({ title: 'Ada menu yang sudah tidak ada di HPP', description: hilang.join(', '), color: 'error' })
  }
  else if (berubah.length) {
    toast.add({
      title: 'Harga HPP sudah berubah sejak disimpan',
      description: `Yang dipakai harga sekarang: ${berubah.map(b => `${b.n} (${b.dari == null ? '—' : rupiah(b.dari)} → ${b.ke == null ? '—' : rupiah(b.ke)})`).join(', ')}`,
      color: 'warning',
    })
  }
  else {
    toast.add({ title: 'Dibuka', description: `"${x.nama}" dimuat ke kalkulator.`, color: 'success' })
  }
}

async function hapusRiwayat(x: RiwayatKalkMkt) {
  if (!bolehHapusRiwayat(x)) {
    toast.add({ title: 'Tidak bisa', description: 'Hanya pembuatnya atau admin yang bisa menghapus riwayat ini.', color: 'error' })
    return
  }
  if (!confirm(`Hapus riwayat perhitungan "${x.nama || ''}"?\n\nDibuat ${x.by || '-'}. Tidak bisa dibatalkan.`)) return
  const ok = await mktSimpan(
    () => ubahKalkHistoriMkt(list => list.filter(y => y.id !== x.id)),
    'Riwayat dihapus',
    { refType: 'kalk', refId: x.id, action: 'Hapus riwayat kalkulator', detail: x.nama ?? '' },
  )
  if (!ok) return
  await muatHist()
  if (bukaId.value === x.id) bukaId.value = ''
}
</script>

<template>
  <AppPage
    title="Menu kalkulator"
    description="Hitung harga jual per pax lalu diskon dari harga deal customer. Menu & harga dari Prasmanan di HPP & Resep. Tidak tersimpan — alat hitung cepat."
  >
    <MarketingGerbang layar="kalkulator">
      <div
        v-if="status === 'pending'"
        class="space-y-3"
      >
        <USkeleton class="h-20" />
        <USkeleton class="h-48" />
      </div>

      <UAlert
        v-else-if="error"
        color="error"
        variant="soft"
        icon="i-lucide-triangle-alert"
        title="Menu Prasmanan dari HPP & Resep tidak terbaca"
        :description="`${apiErrorMessage(error).replace(/\.\s*$/, '')}. Kalkulator mengambil menu & harganya dari sana, jadi belum bisa dipakai. Akun yang hanya memegang modul Marketing belum diberi izin membaca HPP oleh API (lihat catatan migrasi).`"
        :actions="[{ label: 'Coba lagi', color: 'neutral', variant: 'outline', onClick: () => { refresh() } }]"
      />

      <AppPanel v-else-if="!semua.length">
        <div class="py-8 text-center">
          <p class="font-semibold text-highlighted">
            Belum ada menu Prasmanan di HPP
          </p>
          <p class="mx-auto mt-1 max-w-md text-sm text-muted">
            Isi resep berkategori Prasmanan (seksi "PRASMANAN - …") beserta harga jualnya di modul HPP & Resep, lalu kembali ke sini.
          </p>
        </div>
      </AppPanel>

      <template v-else>
        <AppPanel>
          <div class="flex flex-wrap items-end gap-4">
            <UFormField
              label="Jumlah pax"
              class="w-36"
            >
              <UInput
                v-model.number="pax"
                type="number"
                min="1"
                class="w-full"
              />
            </UFormField>
            <p class="w-full min-w-0 text-sm text-muted sm:w-auto sm:flex-1">
              Menu & harga jual diambil dari kategori <b>Prasmanan</b> di modul <b>HPP & Resep</b>.
              <b>Satuannya ikut resep di HPP</b> — ada yang per Porsi, ada yang per Pcs; lihat tulisan di sebelah kotak jumlah.
              Kolom jumlah diisi yang benar-benar dipesan dalam satuan itu — kalau 100 pax tapi menunya cuma 80, tulis <b>80</b>.
              Rasio per pax dihitung sendiri.
            </p>
          </div>
        </AppPanel>

        <AppPanel
          title="Menu"
          icon="i-lucide-utensils"
          flush
        >
          <table class="hidden w-full text-sm lg:table">
            <thead class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
              <tr>
                <th class="w-10 px-3 py-2">
                  #
                </th>
                <th class="px-3 py-2">
                  Menu
                </th>
                <th class="w-64 px-3 py-2">
                  Jumlah (satuan HPP)
                </th>
                <th class="w-36 px-3 py-2 text-right">
                  Harga satuan
                </th>
                <th class="w-36 px-3 py-2 text-right">
                  Subtotal
                </th>
                <th
                  v-if="admin"
                  class="w-36 px-3 py-2 text-right"
                  title="Khusus admin — dari rumus modal HPP"
                >
                  Modal / porsi
                </th>
                <th class="w-10" />
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="(r, i) in k.rows"
                :key="i"
              >
                <td class="px-3 py-2 num text-muted">
                  {{ i + 1 }}
                </td>
                <td class="px-3 py-2">
                  <div class="flex items-center gap-2">
                    <span
                      v-if="r.ref"
                      class="size-2.5 shrink-0 rounded-full"
                      :class="warna(r.ref)"
                    />
                    <USelectMenu
                      :model-value="r.ref || undefined"
                      :items="opsiMenu"
                      value-key="value"
                      placeholder="Ketik untuk mencari menu…"
                      :search-input="{ placeholder: 'Cari menu atau kategori…' }"
                      class="min-w-0 flex-1"
                      @update:model-value="setRef(i, $event)"
                    />
                    <UButton
                      icon="i-lucide-layout-grid"
                      color="neutral"
                      variant="outline"
                      title="Pilih dari kategori"
                      @click="bukaPilih(i)"
                    />
                  </div>
                </td>
                <td class="px-3 py-2">
                  <div class="flex items-center gap-1.5">
                    <UInput
                      :model-value="r.pcs"
                      type="number"
                      min="0"
                      class="w-24"
                      @update:model-value="setPcs(i, $event)"
                    />
                    <span class="text-xs font-bold text-muted">{{ r.ref ? (item(r.ref)?.u ?? 'Porsi') : '' }}</span>
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="outline"
                      label="=pax"
                      title="Samakan dengan jumlah pax"
                      @click="samakanPax(i)"
                    />
                  </div>
                  <p class="mt-1 text-xs text-muted">
                    {{ r.ref ? rasioKalkMkt(r.pcs, k.pax, item(r.ref)?.u ?? 'Porsi') : '—' }}
                  </p>
                </td>
                <td class="px-3 py-2 text-right num">
                  {{ r.ref && item(r.ref)?.h != null ? `${rupiah(item(r.ref)!.h)} / ${item(r.ref)!.u}` : '—' }}
                </td>
                <td class="px-3 py-2 text-right num">
                  {{ subBaris(r) == null ? '—' : rupiah(subBaris(r)) }}
                </td>
                <td
                  v-if="admin"
                  class="px-3 py-2 text-right num"
                >
                  <template v-if="modalBaris(r) != null">
                    {{ rupiah(Math.round(modalBaris(r)!)) }}
                    <span
                      v-if="yieldAnehKalkMkt(item(r.ref)?.r)"
                      class="block text-xs text-warning"
                      title="Hasil resep ini dalam Kg/Liter, jadi modal per satuannya tidak sebanding dengan harga per porsi"
                    >per {{ item(r.ref)?.r.yield_unit }}</span>
                  </template>
                  <template v-else>
                    —
                  </template>
                </td>
                <td class="px-1 py-2">
                  <UButton
                    icon="i-lucide-x"
                    color="neutral"
                    variant="ghost"
                    title="Hapus baris"
                    @click="hapusBaris(i)"
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="(r, i) in k.rows"
              :key="i"
              class="space-y-2 px-4 py-3"
            >
              <div class="flex items-center gap-2">
                <span class="num text-xs text-muted">{{ i + 1 }}</span>
                <span
                  v-if="r.ref"
                  class="size-2.5 shrink-0 rounded-full"
                  :class="warna(r.ref)"
                />
                <button
                  type="button"
                  class="min-h-11 min-w-0 flex-1 truncate rounded-field border border-default px-3 text-left text-sm"
                  @click="bukaPilih(i)"
                >
                  {{ r.ref ? r.ref.slice(r.ref.indexOf('|') + 1) : 'Pilih menu…' }}
                </button>
                <UButton
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  title="Hapus baris"
                  @click="hapusBaris(i)"
                />
              </div>
              <div class="flex flex-wrap items-center gap-1.5">
                <UInput
                  :model-value="r.pcs"
                  type="number"
                  min="0"
                  class="w-24"
                  @update:model-value="setPcs(i, $event)"
                />
                <span class="text-xs font-bold text-muted">{{ r.ref ? (item(r.ref)?.u ?? 'Porsi') : '' }}</span>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="outline"
                  label="=pax"
                  @click="samakanPax(i)"
                />
                <span class="ml-auto text-right num text-sm font-semibold text-highlighted">
                  {{ subBaris(r) == null ? '—' : rupiah(subBaris(r)) }}
                </span>
              </div>
              <p class="text-xs text-muted">
                {{ r.ref && item(r.ref)?.h != null ? `${rupiah(item(r.ref)!.h)} / ${item(r.ref)!.u}` : (r.ref ? 'harga belum diisi' : '') }}
                <template v-if="r.ref">
                  · {{ rasioKalkMkt(r.pcs, k.pax, item(r.ref)?.u ?? 'Porsi') }}
                </template>
                <template v-if="admin && modalBaris(r) != null">
                  · modal {{ rupiah(Math.round(modalBaris(r)!)) }}{{ yieldAnehKalkMkt(item(r.ref)?.r) ? ` per ${item(r.ref)?.r.yield_unit}` : '' }}
                </template>
              </p>
            </li>
          </ul>

          <div class="flex flex-wrap gap-2 border-t border-default px-4 py-3">
            <UButton
              icon="i-lucide-layout-grid"
              label="Pilih menu dari kategori"
              @click="bukaPilih()"
            />
            <UButton
              icon="i-lucide-plus"
              label="Tambah baris kosong"
              color="neutral"
              variant="outline"
              @click="tambahBaris"
            />
          </div>
        </AppPanel>

        <div class="grid gap-4 lg:grid-cols-2">
          <AppPanel
            title="Hasil hitung"
            icon="i-lucide-calculator"
          >
            <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt class="text-muted">
                Total jumlah
              </dt>
              <dd class="text-right num">
                {{ rk.perSatuan.length ? rk.perSatuan.map(s => `${angka(s.jml)} ${s.u}`).join(' · ') : '—' }}
              </dd>
              <dt class="text-muted">
                Total biaya menu
              </dt>
              <dd class="text-right num">
                {{ rupiah(rk.total) }}
                <UIcon
                  v-if="rk.adaHargaKosong"
                  name="i-lucide-triangle-alert"
                  class="size-4 text-warning"
                  title="Ada menu yang harganya belum diisi di HPP — tidak ikut terhitung"
                />
              </dd>
              <dt class="text-muted">
                Harga jual / pax
              </dt>
              <dd class="text-right num text-lg font-bold text-highlighted">
                {{ rupiah(rk.perPax) }} / pax
              </dd>
            </dl>
            <p class="mt-3 text-xs text-muted">
              Harga jual / pax = total biaya menu ÷ jumlah pax. Menu yang porsinya kurang dari jumlah pax tetap terhitung apa adanya.
            </p>
          </AppPanel>

          <AppPanel
            title="Harga deal customer"
            icon="i-lucide-handshake"
          >
            <UFormField label="Harga deal / pax (Rp)">
              <UInput
                v-model="dealTeks"
                inputmode="numeric"
                placeholder="mis. 45.000"
                class="w-full"
              />
            </UFormField>
            <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt class="text-muted">
                Selisih / pax
              </dt>
              <dd class="text-right num">
                {{ deal ? `${deal.selisih >= 0 ? '−' : '+'}${rupiah(Math.abs(deal.selisih))} / pax` : '—' }}
              </dd>
              <dt class="text-muted">
                Diskon
              </dt>
              <dd
                class="text-right font-bold"
                :class="!deal ? '' : deal.jenis === 'diskon' ? 'text-success' : deal.jenis === 'markup' ? 'text-error' : 'text-muted'"
              >
                {{ deal ? deal.teks : '—' }}
              </dd>
              <dt class="text-muted">
                Total deal ({{ angka(k.pax) }} pax)
              </dt>
              <dd class="text-right num">
                {{ deal ? rupiah(deal.totalDeal) : '—' }}
              </dd>
            </dl>
          </AppPanel>
        </div>

        <AppPanel
          title="Simpan perhitungan"
          icon="i-lucide-save"
        >
          <p class="mb-3 text-sm text-muted">
            Beri nama untuk kebutuhan apa perhitungan ini, lalu simpan — isinya menu, porsi, pax, harga jual saat ini, dan harga deal.
          </p>
          <p
            v-if="bukaId"
            class="mb-3 text-sm text-primary-700"
          >
            Sedang membuka riwayat <b>{{ namaSimpan }}</b>. Menyimpan lagi membuat riwayat baru — yang lama tetap ada.
          </p>
          <div class="flex flex-wrap items-end gap-3">
            <UFormField
              label="Untuk kebutuhan apa"
              required
              class="min-w-56 flex-1"
            >
              <UInput
                v-model="namaSimpan"
                placeholder="mis. Event PT Maju — 12 Okt, 150 pax"
                @keydown.enter.prevent="simpanRiwayat"
              />
            </UFormField>
            <UButton
              icon="i-lucide-check"
              label="Simpan ke riwayat"
              loading-auto
              @click="simpanRiwayat"
            />
          </div>
        </AppPanel>

        <AppPanel
          title="Riwayat perhitungan"
          icon="i-lucide-history"
          flush
        >
          <div
            v-if="!riwayat.length"
            class="p-6 text-center text-sm text-muted"
          >
            Belum ada perhitungan yang disimpan.
          </div>
          <template v-else>
            <table class="hidden w-full text-sm lg:table">
              <thead class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
                <tr>
                  <th class="px-3 py-2">
                    Kebutuhan
                  </th>
                  <th class="px-3 py-2">
                    Disimpan
                  </th>
                  <th class="w-20 px-3 py-2 text-right">
                    Pax
                  </th>
                  <th class="w-32 px-3 py-2 text-right">
                    Harga jual / pax
                  </th>
                  <th class="w-28 px-3 py-2 text-right">
                    Deal / pax
                  </th>
                  <th class="w-24 px-3 py-2 text-right">
                    Diskon
                  </th>
                  <th class="w-28" />
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="x in riwayat"
                  :key="x.id"
                  class="baris-sorot transition-colors duration-150 ease-laks"
                  :class="x.id === bukaId ? 'bg-primary-50' : ''"
                >
                  <td class="px-3 py-2">
                    <p class="font-semibold text-highlighted">
                      {{ x.nama || '—' }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ (x.rows ?? []).length }} menu
                    </p>
                  </td>
                  <td class="px-3 py-2">
                    <p>{{ fTgl(String(x.at || '').slice(0, 10)) }}</p>
                    <p class="text-xs text-muted">
                      {{ x.by || '—' }}
                    </p>
                  </td>
                  <td class="px-3 py-2 text-right num">
                    {{ +x.pax || 0 }}
                  </td>
                  <td class="px-3 py-2 text-right num">
                    {{ rupiah(x.perPax) }}
                  </td>
                  <td class="px-3 py-2 text-right num">
                    {{ x.deal == null ? '—' : rupiah(x.deal) }}
                  </td>
                  <td class="px-3 py-2 text-right">
                    {{ diskonRiwayatKalkMkt(x) }}
                  </td>
                  <td class="px-3 py-1">
                    <div class="flex justify-end gap-1">
                      <UButton
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        label="Buka"
                        @click="bukaRiwayat(x)"
                      />
                      <UButton
                        v-if="bolehHapusRiwayat(x)"
                        size="xs"
                        color="error"
                        variant="ghost"
                        icon="i-lucide-trash-2"
                        aria-label="Hapus riwayat"
                        loading-auto
                        @click="hapusRiwayat(x)"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <ul class="divide-y divide-default lg:hidden">
              <li
                v-for="x in riwayat"
                :key="x.id"
                class="space-y-1.5 p-4"
                :class="x.id === bukaId ? 'bg-primary-50' : ''"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="font-semibold text-highlighted">
                      {{ x.nama || '—' }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ (x.rows ?? []).length }} menu · {{ fTgl(String(x.at || '').slice(0, 10)) }} · {{ x.by || '—' }}
                    </p>
                  </div>
                  <div class="flex shrink-0 gap-1">
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="outline"
                      label="Buka"
                      @click="bukaRiwayat(x)"
                    />
                    <UButton
                      v-if="bolehHapusRiwayat(x)"
                      size="xs"
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      aria-label="Hapus riwayat"
                      loading-auto
                      @click="hapusRiwayat(x)"
                    />
                  </div>
                </div>
                <p class="text-xs text-muted">
                  {{ +x.pax || 0 }} pax · jual {{ rupiah(x.perPax) }}/pax · deal {{ x.deal == null ? '—' : `${rupiah(x.deal)}/pax` }} · {{ diskonRiwayatKalkMkt(x) }}
                </p>
              </li>
            </ul>
          </template>
        </AppPanel>
      </template>

      <MarketingKalkPilih
        v-model:open="pilih.open"
        :items="items"
        :awal="awalPilih"
        :tunggal="pilih.baris >= 0"
        @pakai="pakai"
      />
    </MarketingGerbang>
  </AppPage>
</template>
