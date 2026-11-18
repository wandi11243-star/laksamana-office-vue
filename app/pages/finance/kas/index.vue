<!--
  Finance › Kas Kecil › Buku Kas Kecil (old `viewKkBuku`, deploy/finance/kas/index.html:5185-5400).

  Layout as the old screen: Total Semua Pos + one card per active pos (a click
  filters the book), the book panel with four labelled filters and the two
  completeness cards, then the table oldest-first with Debet / Kredit / running
  Saldo, coloured Input/Bon cells and a total row.

  Balances are NEVER stored: the balance of every pos is computed from the FULL
  history (sorted by date, then id), exactly like the old page — a period filter
  never changes a balance. The administrative ticks (Input / Bon) are PATCHed on
  their own, deletes ask first, and every write carries the row's content-hash
  version (fetched right before the write; the bootstrap read has none).
-->
<script setup lang="ts">
import type { KkItem, KkTrx } from '~/composables/useFinance'
import { deleteKkTrx, getKk, getKkTrxSatu, patchKkTrx } from '~/composables/useFinance'
import { fmtRp } from '~/utils/cashier'
import { hariIni } from '~/utils/format'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['finance'] })

const izin = useKasIzin()
const toast = useToast()
const route = useRoute()
const periode = ref(typeof route.query.bulan === 'string' && route.query.bulan ? route.query.bulan : hariIni().slice(0, 7))
const tapisPos = ref('__semua')
const tapisKategori = ref('__semua')
const cari = ref('')
const tapisStatus = ref<'semua' | 'input_belum' | 'input_sudah' | 'bon_belum' | 'bon_sudah' | 'belum_lengkap'>('semua')

const { data, status, error, refresh } = useAsyncData('kas-kk', () => getKk())

const pos = computed<KkItem[]>(() => data.value?.data.pos ?? [])
const posAktif = computed(() => pos.value.filter(p => p.aktif !== false))
const kategori = computed<KkItem[]>(() => data.value?.data.kategori ?? [])
const trx = computed<KkTrx[]>(() => data.value?.data.trx ?? [])

const namaPos = (id: string) => pos.value.find(p => String(p.id) === String(id))?.nama ?? `pos ${id}`
const namaKategori = (id?: string | null) => (id ? kategori.value.find(k => String(k.id) === String(id))?.nama ?? `kategori ${id}` : '—')
const posTapis = computed(() => (tapisPos.value === '__semua' ? '' : tapisPos.value))

/** `kkNilai`: debet and kredit of one trx for one pos (or every pos when empty). */
function nilai(t: KkTrx, posId = '') {
  let debet = 0
  let kredit = 0
  for (const b of t.baris) {
    if (posId && String(b.pos_id) !== String(posId)) continue
    debet += Number(b.debet) || 0
    kredit += Number(b.kredit) || 0
  }
  return { debet, kredit }
}

/** The whole history, oldest first (`kkUrut`: date, then id) — balances run over all of it. */
const semua = computed(() => trx.value.slice().sort((a, b) => (a.tgl !== b.tgl ? (a.tgl < b.tgl ? -1 : 1) : Number(a.id) - Number(b.id))))
/** Balance of one pos (or all pos) over the WHOLE history (`kkSaldoPos`). */
const saldoPos = (posId: string) => semua.value.reduce((s, t) => {
  const v = nilai(t, posId)
  return s + v.debet - v.kredit
}, 0)
/** Running balance per trx id (`kkPetaSaldo`); null = the filtered pos is untouched by that trx. */
const petaSaldo = computed(() => {
  const peta: Record<string, number | null> = {}
  let s = 0
  for (const t of semua.value) {
    const v = nilai(t, posTapis.value)
    if (posTapis.value && !v.debet && !v.kredit) {
      peta[String(t.id)] = null
      continue
    }
    s += v.debet - v.kredit
    peta[String(t.id)] = s
  }
  return peta
})
const totalAktif = computed(() => posAktif.value.reduce((s, p) => s + saldoPos(String(p.id)), 0))
const selisihNonaktif = computed(() => saldoPos('') - totalAktif.value)

const labelPeriode = computed(() => new Date(`${periode.value}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }))

const tampil = computed(() => semua.value.filter((t) => {
  if (t.tgl.slice(0, 7) !== periode.value) return false
  if (posTapis.value) {
    const v = nilai(t, posTapis.value)
    if (!v.debet && !v.kredit) return false
  }
  if (tapisKategori.value !== '__semua' && String(t.kategori_id ?? '') !== tapisKategori.value) return false
  if (tapisStatus.value === 'input_belum' && t.input) return false
  if (tapisStatus.value === 'input_sudah' && !t.input) return false
  if (tapisStatus.value === 'bon_belum' && t.bon) return false
  if (tapisStatus.value === 'bon_sudah' && !t.bon) return false
  if (tapisStatus.value === 'belum_lengkap' && t.input && t.bon) return false
  const q = cari.value.trim().toLowerCase()
  if (q && !String(t.keterangan || '').toLowerCase().includes(q)) return false
  return true
}))

const total = computed(() => {
  let debet = 0
  let kredit = 0
  for (const t of tampil.value) {
    const v = nilai(t, posTapis.value)
    debet += v.debet
    kredit += v.kredit
  }
  return { debet, kredit }
})
/** Completeness cards: counted over the rows ON SCREEN (after every filter), value = debet + kredit. */
const lengkap = computed(() => {
  const rp = (t: KkTrx) => {
    const v = nilai(t, posTapis.value)
    return v.debet + v.kredit
  }
  const semuaRp = tampil.value.reduce((s, t) => s + rp(t), 0)
  const kotak = (f: (t: KkTrx) => boolean) => {
    const rows = tampil.value.filter(f)
    const isi = rows.reduce((s, t) => s + rp(t), 0)
    return { n: rows.length, rp: isi, sisaN: tampil.value.length - rows.length, sisaRp: semuaRp - isi }
  }
  return { input: kotak(t => !!t.input), bon: kotak(t => !!t.bon) }
})
const subLengkap = (k: { n: number, sisaN: number, sisaRp: number }) =>
  `${k.n} dari ${tampil.value.length} transaksi${k.sisaN ? ` · sisa ${k.sisaN} senilai ${fmtRp(k.sisaRp)}` : ' · sudah lengkap'}`

const pilihPos = (id: string) => {
  tapisPos.value = tapisPos.value === id ? '__semua' : id
}

const sibuk = ref(false)
async function tandai(t: KkTrx, k: 'input' | 'bon') {
  if (sibuk.value) return
  sibuk.value = true
  try {
    const { trx: live, version } = await getKkTrxSatu(String(t.id))
    await patchKkTrx(String(t.id), { [k]: !live[k] } as { input?: boolean, bon?: boolean }, version ?? '')
    toast.add({ title: k === 'input' ? 'Tanda Input diperbarui.' : 'Tanda Bon diperbarui.', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

const hapusOpen = ref(false)
const hapusTarget = ref<KkTrx | null>(null)
async function jalanHapus() {
  const t = hapusTarget.value
  if (!t || sibuk.value) return
  sibuk.value = true
  try {
    const { version } = await getKkTrxSatu(String(t.id))
    await deleteKkTrx(String(t.id), version ?? '')
    hapusOpen.value = false
    hapusTarget.value = null
    toast.add({ title: 'Transaksi dihapus (baris posnya ikut).', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <AppPage
    title="Buku kas kecil"
    description="Semua transaksi berikut saldo berjalan tiap pos."
  >
    <template #actions>
      <AppBulan
        v-model="periode"
        size="sm"
        class="w-40"
      />
    </template>

    <UAlert
      v-if="!izin.lihat('kk_buku')"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak dibuka untuk peranmu."
      description="Hubungi admin modul Finance kalau memang perlu."
      class="mb-4"
    />
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Kas Kecil tidak bisa dimuat: ${apiErrorMessage(error)}`"
      :actions="[{ label: 'Coba muat lagi', color: 'neutral', variant: 'outline', onClick: () => refresh() }]"
      class="mb-4"
    />
    <div
      v-if="status === 'pending' && !data"
      class="mb-4 space-y-2"
    >
      <!-- Loading rows mirror the petty-cash summary below. -->
      <USkeleton
        v-for="i in 4"
        :key="i"
        class="h-10 w-full"
      />
      <p class="pt-1 text-sm text-muted">
        Memuat kas kecil…
      </p>
    </div>

    <template v-if="izin.lihat('kk_buku') && data">
      <UAlert
        v-if="!posAktif.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Belum ada pos pembayaran."
        description="Tambahkan dulu di Pos & Kategori — tanpa pos, transaksi tidak punya tempat untuk dicatat."
        class="mb-4"
      />
      <!-- Total Semua Pos (leftmost) + one card per active pos; a click filters the book -->
      <div
        v-else
        class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]"
      >
        <button
          type="button"
          class="rounded-panel text-start"
          :class="!posTapis ? 'ring-2 ring-primary-300' : ''"
          title="Klik untuk menampilkan seluruh pos di buku di bawah"
          @click="tapisPos = '__semua'"
        >
          <AppStat
            label="Total semua pos"
            :value="fmtRp(totalAktif)"
            icon="i-lucide-wallet"
            class="h-full bg-primary-50"
          >
            gabungan {{ posAktif.length }} pos<template v-if="!posTapis">
              · <b>sedang ditampilkan</b>
            </template>
            <template v-if="selisihNonaktif">
              <br>+ {{ fmtRp(selisihNonaktif) }} di pos nonaktif
            </template>
          </AppStat>
        </button>
        <button
          v-for="p in posAktif"
          :key="p.id"
          type="button"
          class="rounded-panel text-start"
          :class="posTapis === String(p.id) ? 'ring-2 ring-primary-300' : ''"
          title="Klik untuk menyaring buku ke pos ini"
          @click="pilihPos(String(p.id))"
        >
          <AppStat
            :label="p.nama"
            :value="fmtRp(saldoPos(String(p.id)))"
            :tone="saldoPos(String(p.id)) < 0 ? 'error' : 'gold'"
            class="h-full"
          >
            saldo seluruh riwayat<template v-if="posTapis === String(p.id)">
              · <b>sedang disaring</b>
            </template>
          </AppStat>
        </button>
      </div>

      <AppPanel
        :title="`Buku Kas Kecil — ${labelPeriode}`"
        class="mb-4"
      >
        <template #description>
          {{ tampil.length }} transaksi ditampilkan<template v-if="posTapis">
            · pos <b>{{ namaPos(posTapis) }}</b>
          </template>
        </template>
        <template
          v-if="izin.ubah('kk_buku')"
          #actions
        >
          <UButton
            label="Transaksi"
            icon="i-lucide-plus"
            size="sm"
            to="/finance/kas/input"
          />
        </template>
        <AppFilterGrid>
          <UFormField label="Cari keterangan">
            <UInput
              v-model="cari"
              placeholder="mis. bensin"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Pos">
            <USelect
              v-model="tapisPos"
              :items="[{ label: 'Semua pos', value: '__semua' }, ...posAktif.map(p => ({ label: p.nama, value: String(p.id) }))]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Kategori">
            <USelect
              v-model="tapisKategori"
              :items="[{ label: 'Semua kategori', value: '__semua' }, ...kategori.filter(k => k.aktif !== false).map(k => ({ label: k.nama, value: String(k.id) }))]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Kelengkapan">
            <USelect
              v-model="tapisStatus"
              :items="[
                { label: 'Semua transaksi', value: 'semua' },
                { label: 'Belum lengkap (input / bon)', value: 'belum_lengkap' },
                { label: 'Belum masuk pembukuan', value: 'input_belum' },
                { label: 'Sudah masuk pembukuan', value: 'input_sudah' },
                { label: 'Bon belum ada', value: 'bon_belum' },
                { label: 'Bon sudah ada', value: 'bon_sudah' },
              ]"
              class="w-full"
            />
          </UFormField>
        </AppFilterGrid>
        <div
          v-if="tampil.length"
          class="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <AppStat
            label="Sudah masuk pembukuan"
            :value="fmtRp(lengkap.input.rp)"
            tone="success"
            icon="i-lucide-book-check"
            class="bg-success/8"
            :sub="subLengkap(lengkap.input)"
          />
          <AppStat
            label="Bon sudah ada"
            :value="fmtRp(lengkap.bon.rp)"
            tone="info"
            icon="i-lucide-receipt"
            class="bg-info/8"
            :sub="subLengkap(lengkap.bon)"
          />
        </div>
      </AppPanel>

      <AppPanel flush>
        <!-- desktop -->
        <table class="hidden w-full text-sm lg:table">
          <thead class="bg-table-head text-table-head-text">
            <tr class="text-xs font-bold uppercase tracking-wider">
              <th class="px-3 py-2.5 text-start">
                Tanggal
              </th>
              <th class="px-3 py-2.5 text-start">
                Keterangan
              </th>
              <th class="px-3 py-2.5 text-start">
                Kategori
              </th>
              <th class="px-3 py-2.5 text-start">
                Pos
              </th>
              <th class="px-3 py-2.5 text-end">
                Debet
              </th>
              <th class="px-3 py-2.5 text-end">
                Kredit
              </th>
              <th class="px-3 py-2.5 text-end">
                Saldo
              </th>
              <th
                class="px-3 py-2.5 text-center"
                title="Sudah masuk pembukuan"
              >
                Input
              </th>
              <th
                class="px-3 py-2.5 text-center"
                title="Nota fisik sudah ada"
              >
                Bon
              </th>
              <th class="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="t in tampil"
              :key="t.id"
            >
              <td class="px-3 py-2.5 whitespace-nowrap num">
                {{ t.tgl }}
              </td>
              <td class="px-3 py-2.5">
                <b class="text-highlighted">{{ t.keterangan || '(tanpa keterangan)' }}</b>
              </td>
              <td class="px-3 py-2.5 text-[13px] text-muted">
                {{ namaKategori(t.kategori_id) }}
              </td>
              <td class="px-3 py-2.5">
                <span
                  v-for="b in t.baris.filter(x => Number(x.debet) || Number(x.kredit))"
                  :key="b.pos_id"
                  class="me-1 mb-0.5 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted"
                >{{ namaPos(String(b.pos_id)) }} <span class="num">{{ fmtRp(Number(b.debet) || Number(b.kredit)) }}</span></span>
                <span
                  v-if="!t.baris.some(x => Number(x.debet) || Number(x.kredit))"
                  class="text-muted"
                >—</span>
              </td>
              <td class="px-3 py-2.5 text-end num">
                {{ nilai(t, posTapis).debet ? fmtRp(nilai(t, posTapis).debet) : '—' }}
              </td>
              <td class="px-3 py-2.5 text-end num">
                {{ nilai(t, posTapis).kredit ? fmtRp(nilai(t, posTapis).kredit) : '—' }}
              </td>
              <td class="px-3 py-2.5 text-end font-bold num">
                {{ petaSaldo[String(t.id)] == null ? '—' : fmtRp(petaSaldo[String(t.id)]!) }}
              </td>
              <td
                class="px-3 py-2.5 text-center"
                :class="t.input ? 'bg-success/12' : 'bg-warning/15'"
                :title="t.input ? 'Sudah masuk pembukuan' : 'BELUM masuk pembukuan'"
              >
                <UCheckbox
                  :model-value="!!t.input"
                  :disabled="sibuk || !izin.ubah('kk_buku')"
                  class="justify-center"
                  aria-label="Sudah masuk pembukuan"
                  @update:model-value="() => tandai(t, 'input')"
                />
              </td>
              <td
                class="px-3 py-2.5 text-center"
                :class="t.bon ? 'bg-info/12' : 'bg-warning/15'"
                :title="t.bon ? 'Nota fisik sudah ada' : 'Nota fisik BELUM ada'"
              >
                <UCheckbox
                  :model-value="!!t.bon"
                  :disabled="sibuk || !izin.ubah('kk_buku')"
                  class="justify-center"
                  aria-label="Nota fisik sudah ada"
                  @update:model-value="() => tandai(t, 'bon')"
                />
              </td>
              <td class="px-3 py-2.5">
                <div
                  v-if="izin.ubah('kk_buku')"
                  class="flex justify-end gap-1"
                >
                  <UButton
                    label="Ubah"
                    color="neutral"
                    variant="outline"
                    size="xs"
                    :to="`/finance/kas/input?ubah=${t.id}`"
                  />
                  <UButton
                    label="Hapus"
                    color="error"
                    variant="soft"
                    size="xs"
                    @click="hapusTarget = t; hapusOpen = true"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="!tampil.length">
              <td
                colspan="10"
                class="px-3 py-8 text-center text-sm text-muted"
              >
                Belum ada transaksi pada {{ labelPeriode }}{{ (cari || posTapis || tapisKategori !== '__semua' || tapisStatus !== 'semua') ? ' dengan saringan ini' : '' }}.
              </td>
            </tr>
          </tbody>
          <tfoot
            v-if="tampil.length"
            class="border-t-2 border-default text-xs font-bold uppercase tracking-wide text-muted"
          >
            <tr>
              <th
                colspan="4"
                class="px-3 py-2.5 text-end"
              >
                Total {{ labelPeriode }}
              </th>
              <th class="px-3 py-2.5 text-end num">
                {{ fmtRp(total.debet) }}
              </th>
              <th class="px-3 py-2.5 text-end num">
                {{ fmtRp(total.kredit) }}
              </th>
              <th class="px-3 py-2.5 text-end num">
                {{ fmtRp(total.debet - total.kredit) }}
              </th>
              <th colspan="3" />
            </tr>
          </tfoot>
        </table>

        <!-- phone -->
        <div class="divide-y divide-default lg:hidden">
          <article
            v-for="t in tampil"
            :key="t.id"
            class="space-y-1.5 px-4 py-3"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-highlighted">
                  {{ t.keterangan || '(tanpa keterangan)' }}
                </p>
                <p class="text-[11px] text-muted">
                  {{ t.tgl }} · {{ namaKategori(t.kategori_id) }}
                </p>
              </div>
              <div class="shrink-0 text-end">
                <b
                  class="num"
                  :class="nilai(t, posTapis).kredit ? 'text-error' : 'text-highlighted'"
                >{{ nilai(t, posTapis).debet ? `+ ${fmtRp(nilai(t, posTapis).debet)}` : `− ${fmtRp(nilai(t, posTapis).kredit)}` }}</b>
                <p class="text-[11px] text-muted num">
                  saldo {{ petaSaldo[String(t.id)] == null ? '—' : fmtRp(petaSaldo[String(t.id)]!) }}
                </p>
              </div>
            </div>
            <p class="text-[13px] text-muted">
              {{ t.baris.filter(x => Number(x.debet) || Number(x.kredit)).map(b => `${namaPos(String(b.pos_id))} ${fmtRp(Number(b.debet) || Number(b.kredit))}`).join(' · ') }}
            </p>
            <div class="flex flex-wrap items-center gap-3 pt-1">
              <UCheckbox
                :model-value="!!t.input"
                :disabled="sibuk || !izin.ubah('kk_buku')"
                label="Input"
                @update:model-value="() => tandai(t, 'input')"
              />
              <UCheckbox
                :model-value="!!t.bon"
                :disabled="sibuk || !izin.ubah('kk_buku')"
                label="Bon"
                @update:model-value="() => tandai(t, 'bon')"
              />
              <template v-if="izin.ubah('kk_buku')">
                <div class="flex-1" />
                <UButton
                  label="Ubah"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  :to="`/finance/kas/input?ubah=${t.id}`"
                />
                <UButton
                  label="Hapus"
                  color="error"
                  variant="soft"
                  size="xs"
                  @click="hapusTarget = t; hapusOpen = true"
                />
              </template>
            </div>
          </article>
          <p
            v-if="!tampil.length"
            class="px-4 py-6 text-center text-sm text-muted"
          >
            Belum ada transaksi pada {{ labelPeriode }}.
          </p>
          <p
            v-else
            class="px-4 py-3 text-sm text-muted"
          >
            Total: debet <b class="num">{{ fmtRp(total.debet) }}</b> · kredit <b class="num">{{ fmtRp(total.kredit) }}</b>
          </p>
        </div>
      </AppPanel>
      <p class="mt-3 text-xs text-muted">
        Sel <b>kuning</b> di kolom Input/Bon = belum dicentang; hijau = sudah masuk pembukuan, biru = notanya sudah ada. Pakai kotak
        <b>Kelengkapan</b> di atas untuk menyaringnya. Kolom Saldo dihitung dari seluruh riwayat{{ posTapis ? ' pos ini' : ' semua pos digabung' }}, bukan dari awal periode.
      </p>
    </template>

    <ResponsiveSheet
      v-model:open="hapusOpen"
      :title="hapusTarget ? `Hapus transaksi ${hapusTarget.keterangan}?` : 'Hapus transaksi?'"
    >
      <p class="text-sm">
        Barisnya dihapus dari server bersama pecahan posnya. Tindakan ini tidak bisa dikembalikan dari layar ini.
      </p>
      <template #footer>
        <UButton
          label="Ya, hapus"
          color="error"
          :loading="sibuk"
          @click="jalanHapus"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="hapusOpen = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
