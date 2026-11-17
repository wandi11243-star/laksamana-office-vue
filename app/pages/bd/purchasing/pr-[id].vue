<!--
  BD OS › Purchase Request sheet (old `vPrDetail`, deploy/bd/index.html:3593-3766).
  A printable weekly sheet: items point back through `prId`, never copied.

  Realisasi is what was REALLY paid; overbudget = amount − realisasi is COMPUTED
  and positive means a saving. An item is ALWAYS editable, even after the sheet
  is submitted — every revision after that needs the PDF sent again.

  Approving is a TRACE, not authorisation: it is checked in the browser, and the
  signed PDF stays the binding record.
-->
<script setup lang="ts">
import type { BdApproverSet, BdPo, BdPr } from '~/composables/useBd'
import {
  bdSimpan, bdTulisDiam, setRealisasi, tambalBd, useBdSettings, useBdState,
  versiBaris,
} from '~/composables/useBd'
import {
  PENYETUJU_BIBIT, cariAku, fRpPenuh, fieldsProses, labelMinggu, penyetujuPr, poBeres, poRequester,
  prBeres, prItems, prTotal, realisasiNum, rzFormat, todayISO,
} from '~/utils/bd-rumus'
import { WARNA_PO } from '~/utils/status-bd'
import BdPrSheet from '~/widgets/bd/BdPrSheet.vue'
import { fTgl } from '~/utils/format'

definePageMeta({ access: ['bd'] })

const route = useRoute()
const me = useMe()
const { data: state } = useBdState()
const { data: setelan } = useBdSettings()
const id = String(route.params.id || '')

const pr = computed<BdPr | undefined>(() => state.value.pr.find(x => x.id === id))
const people = computed(() => state.value.people)
const aku = computed(() => cariAku(people.value, me.value))
const admin = computed(() => isAdminOf(me.value, 'bd'))
const items = computed(() => (pr.value ? prItems(pr.value.id, state.value.po) : []))
const total = computed(() => (pr.value ? prTotal(pr.value.id, state.value.po) : { grand: 0, belum: 0 }))
const diajukan = computed(() => !!pr.value && pr.value.status !== 'Draft')

const setsEfektif = computed<BdApproverSet[]>(() => {
  const s = setelan.value?.data.approverSets || []
  if (s.length) return s
  return [{
    id: 'as-default',
    nama: 'Default',
    bawaan: true,
    orang: PENYETUJU_BIBIT.map(n => people.value.find(p => p.name.trim().toLowerCase() === n.toLowerCase())?.id).filter((x): x is string => !!x),
  }]
})
const setKini = computed(() => (pr.value?.setId ? setsEfektif.value.find(s => s.id === pr.value!.setId) : undefined) || setsEfektif.value.find(s => s.bawaan) || setsEfektif.value[0])
const penanda = computed(() => (pr.value ? penyetujuPr({ ...pr.value, setId: setKini.value?.id }, setsEfektif.value, people.value) : []))

// Items still free, to add to this sheet.
const bebas = computed(() => state.value.po.filter(p => !p.prId))

// ---- realisation inputs (local, debounced) ----
const rz = reactive<Record<string, number | null>>({})
watch(items, (l) => {
  l.forEach((p) => {
    if (rz[p.id] === undefined) rz[p.id] = realisasiNum(p)
  })
}, { immediate: true })
const rzTimer: Record<string, ReturnType<typeof setTimeout>> = {}
/** The pending realisation save per item: other writes on that item wait for it. */
const rzTunda: Record<string, () => Promise<unknown>> = {}
const rzJalan: Record<string, Promise<unknown>> = {}
function ubahRz(p: BdPo, nilai: string) {
  const d = String(nilai).replace(/[^0-9]/g, '')
  rz[p.id] = d === '' ? null : Number(d)
  if (rzTimer[p.id]) clearTimeout(rzTimer[p.id]!)
  rzTunda[p.id] = () => bdTulisDiam(() => setRealisasi(p.id, d === '' ? '' : Number(d)))
  rzTimer[p.id] = setTimeout(() => void kirimRz(p.id), 500)
}
function kirimRz(id: string): Promise<unknown> {
  clearTimeout(rzTimer[id])
  const kirim = rzTunda[id]
  Reflect.deleteProperty(rzTunda, id)
  if (kirim) rzJalan[id] = kirim().finally(() => Reflect.deleteProperty(rzJalan, id))
  return rzJalan[id] ?? Promise.resolve()
}

/**
 * The row as it is NOW, for a versioned write: a realisation typed on it is
 * saved first (that save moves the row's version), then the freshest copy in
 * state is used, so a write never goes out with a version the page itself
 * already replaced — the "diubah orang lain" toast was our own earlier save.
 */
async function poSegar(p: BdPo): Promise<BdPo> {
  await kirimRz(p.id)
  return state.value.po.find(x => x.id === p.id) ?? p
}
const over = (p: BdPo): number | null => {
  const r = rz[p.id]
  return r === undefined || r === null ? null : (Number(p.amount) || 0) - r
}
const jumlah = computed(() => {
  const terisi = items.value.filter(p => rz[p.id] !== undefined && rz[p.id] !== null)
  return {
    terisi: terisi.length,
    realisasi: terisi.reduce((s, p) => s + (rz[p.id] || 0), 0),
    over: terisi.reduce((s, p) => s + ((Number(p.amount) || 0) - (rz[p.id] || 0)), 0),
  }
})

// ---- sheet actions ----
const bukaKepala = ref(false)
function cetak() {
  cetakPdf(namaBerkas(pr.value ? `PR-${pr.value.no || '?'}` : 'Purchase Request', pr.value ? labelMinggu(pr.value.weekStart || pr.value.tanggal) : '', pr.value?.dept))
}
async function statusPr(st: string) {
  const p = pr.value
  if (!p) return
  await bdSimpan(() => tambalBd<BdPr>('purchase-requests', p.id, { status: st }, versiBaris(p)), st === 'Draft' ? 'Kunci dibuka — item bisa diubah lagi' : `PR-${p.no} dikunci sebagai ${st}`)
}
async function lepas(p: BdPo) {
  if (!pr.value) return
  const po = await poSegar(p)
  if (!(await bdTulisDiam(() => tambalBd<BdPo>('purchase-orders', po.id, { prId: null }, versiBaris(po))))) return
  // Read the sheet again AFTER the first write reloaded state.
  const prNow = pr.value
  if (prNow) await bdTulisDiam(() => tambalBd<BdPr>('purchase-requests', prNow.id, { total: 0 }, versiBaris(prNow)))
}
async function masukkan(p: BdPo) {
  const prNow = pr.value
  if (!prNow) return
  const po = state.value.po.find(x => x.id === p.id) ?? p
  await bdTulisDiam(() => tambalBd<BdPo>('purchase-orders', po.id, { prId: prNow.id }, versiBaris(po)))
}
async function toggleProses(p: BdPo) {
  const po = await poSegar(p)
  const on = !poBeres(po)
  return bdTulisDiam(() => tambalBd<BdPo>('purchase-orders', po.id, fieldsProses(po, on, aku.value?.name || ''), versiBaris(po)))
}
async function pilihSet(setId: string) {
  const p = pr.value
  if (!p) return
  const approvals = { ...(p.approvals || {}) }
  penyetujuPr({ ...p, setId }, setsEfektif.value, people.value).forEach((s) => {
    if (!approvals[s.k]) approvals[s.k] = { nama: s.nama, at: '', oleh: '' }
  })
  await bdSimpan(() => tambalBd<BdPr>('purchase-requests', p.id, { setId, approvals }, versiBaris(p)), 'Susunan penanda tangan diganti')
}

function bolehSetuju(pid: string): boolean {
  if (admin.value) return true
  const p = people.value.find(x => x.id === pid)
  if (p && me.value && p.officeUserId && String(p.officeUserId) === String(me.value.id)) return true
  return !!aku.value && aku.value.id === pid
}
function alasan(pid: string): string {
  const p = people.value.find(x => x.id === pid)
  return p ? `Hanya ${p.name} atau admin BD yang bisa menekan ini.` : 'Orang ini belum terdaftar di User Database Office — mintakan akunnya dibuat dulu.'
}
async function setuju(kunci: string, batal: boolean) {
  const p = pr.value
  if (!p) return
  if (!bolehSetuju(kunci)) {
    toast.add({ title: alasan(kunci), color: 'error' })
    return
  }
  const def = penanda.value.find(s => s.k === kunci)
  const a = { ...(p.approvals?.[kunci] || { nama: def?.nama || '', at: '', oleh: '' }) }
  if (batal) {
    a.at = ''
    a.oleh = ''
  }
  else {
    a.at = todayISO()
    a.oleh = me.value?.name || '?'
  }
  const approvals = { ...(p.approvals || {}), [kunci]: a }
  const semua = penanda.value.every(s => (approvals[s.k] || {}).at)
  let status = p.status
  if (semua && status !== 'Selesai') status = 'Disetujui'
  else if (!semua && status === 'Disetujui') status = 'Diajukan'
  await bdSimpan(() => tambalBd<BdPr>('purchase-requests', p.id, { approvals, status }, versiBaris(p)), batal ? 'Persetujuan dibatalkan' : `${def?.l || kunci} disetujui`)
}

const toast = useToast()

// Plain buttons that write: no double click while the write runs.
const { jalan, lagi } = useSibuk()
</script>

<template>
  <AppPage
    :title="pr ? `PR-${pr.no || '?'}` : 'Purchase Request'"
    :description="pr ? `Purchase Request · ${labelMinggu(pr.weekStart || pr.tanggal)} · ${items.filter(poBeres).length} dari ${items.length} item diproses${prBeres(pr.id, state.po) ? ' · sudah diarsipkan' : ''}` : undefined"
    :back="{ label: 'Semua dokumen PR', to: '/bd/purchasing' }"
  >
    <template #actions>
      <UButton
        v-if="pr"
        label="Kepala surat"
        icon="i-lucide-pencil"
        color="neutral"
        variant="outline"
        @click="bukaKepala = true"
      />
      <UButton
        label="Cetak / Simpan PDF"
        icon="i-lucide-printer"
        color="neutral"
        variant="outline"
        @click="cetak"
      />
      <UButton
        v-if="pr && pr.status === 'Draft'"
        label="Kunci & ajukan"
        icon="i-lucide-lock"
        loading-auto
        @click="statusPr('Diajukan')"
      />
      <UButton
        v-else-if="pr"
        label="Kembalikan ke Draft"
        color="neutral"
        variant="outline"
        loading-auto
        @click="statusPr('Draft')"
      />
    </template>

    <AppPanel v-if="!pr">
      <p class="py-6 text-center text-sm text-muted">
        <b class="block text-highlighted">Dokumen PR tidak ditemukan</b>
        Mungkin sudah dihapus. Kembali ke daftar dokumen PR.
      </p>
    </AppPanel>

    <template v-else>
      <p
        v-if="diajukan"
        class="no-print mb-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm"
      >
        Lembar ini sudah <b>{{ pr.status }}</b>. Itemnya <b>masih bisa diubah</b> — tapi kalau PDF-nya sudah
        dikirim ke Finance, <b>kirim ulang</b> sesudah merevisi.
      </p>
      <p
        v-else
        class="no-print mb-4 rounded-xl border border-gold/40 bg-gold-soft p-3.5 text-sm text-ink-900 [&_b]:text-gold-deep"
      >
        Masih <b>Draft</b> — belum terkirim ke siapa pun. Tekan <b>Kunci & ajukan</b> saat lembarnya siap dikirim.
      </p>

      <!-- ── printable document (old sheet: gold-ruled letterhead, one-line info box,
           a fully ruled table with the totals in its foot) ── -->
      <div class="bd-cetak mx-auto max-w-6xl rounded-panel bg-default p-5 shadow-panel lg:p-10">
        <div class="flex flex-wrap items-start justify-between gap-4 border-b-2 border-gold pb-5">
          <div class="flex items-center gap-4">
            <img
              src="/mark.png"
              alt="Laksamana Muda"
              class="size-14 object-contain"
            >
            <div>
              <p class="font-display text-2xl font-bold text-highlighted">
                Laksamana Muda
              </p>
              <p class="mt-0.5 text-[11px] font-bold uppercase tracking-[0.25em] text-gold-deep">
                Coffee & Live Space
              </p>
              <p class="mt-2 text-xs text-muted">
                Jl. Soekarno Hatta No. 39, Payung Sekaki, Pekanbaru
              </p>
            </div>
          </div>
          <div class="text-end">
            <p class="text-[11px] font-bold uppercase tracking-[0.25em] text-gold-deep">
              Purchase Request
            </p>
            <p class="mt-1 font-display text-2xl font-bold text-highlighted">
              PR-{{ pr.no || '?' }}
            </p>
            <p class="mt-1 text-sm text-muted">
              {{ labelMinggu(pr.weekStart || pr.tanggal) }}
            </p>
          </div>
        </div>

        <dl class="bd-info mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-xl bg-muted px-5 py-4 text-sm sm:grid-cols-[auto_1fr_auto_1fr] xl:grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto_1fr]">
          <dt class="font-semibold text-muted">
            PR No
          </dt>
          <dd class="text-highlighted">
            {{ pr.no || '—' }}
          </dd>
          <dt class="font-semibold text-muted">
            Name
          </dt>
          <dd class="text-highlighted">
            {{ pr.nama || '—' }}
          </dd>
          <dt class="font-semibold text-muted">
            Department
          </dt>
          <dd class="text-highlighted">
            {{ pr.dept || '—' }}
          </dd>
          <dt class="font-semibold text-muted">
            Request Date
          </dt>
          <dd class="text-highlighted">
            {{ fTgl(pr.tanggal) }}
          </dd>
        </dl>

        <div class="mt-5 overflow-x-auto">
          <table class="bd-tabel w-full border-collapse text-sm">
            <thead class="bg-muted">
              <tr class="text-[11px] font-bold uppercase tracking-wide text-highlighted">
                <th class="w-12 text-center">
                  No
                </th>
                <th class="text-start">
                  Nama item
                </th>
                <th class="text-center">
                  Jumlah
                </th>
                <th class="text-center">
                  Satuan
                </th>
                <th class="text-start">
                  Alasan / kebutuhan
                </th>
                <th class="text-start">
                  Request
                </th>
                <th class="text-end">
                  Harga
                </th>
                <th class="text-start">
                  Realisasi
                </th>
                <th class="text-end">
                  Overbudget
                </th>
                <th class="no-print text-center">
                  Proses
                </th>
                <th class="no-print w-12" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(p, i) in items"
                :key="p.id"
                class="align-top"
              >
                <td class="text-center text-muted num">
                  {{ i + 1 }}
                </td>
                <td class="min-w-32 font-semibold text-highlighted">
                  {{ p.item }}
                </td>
                <td class="text-center num">
                  {{ Number(p.qty) || 0 }}
                </td>
                <td class="text-center text-default">
                  {{ p.unit || '' }}
                </td>
                <td class="min-w-44 text-default">
                  {{ p.note || '—' }}
                </td>
                <td class="text-default">
                  {{ String(poRequester(p, people)).split(' ')[0] }}
                </td>
                <td class="text-end whitespace-nowrap num">
                  <span v-if="Number(p.amount)">{{ fRpPenuh(p.amount) }}</span>
                  <span
                    v-else
                    class="text-muted"
                  >belum</span>
                </td>
                <td>
                  <input
                    :value="rz[p.id] === null || rz[p.id] === undefined ? '' : rzFormat(rz[p.id])"
                    inputmode="numeric"
                    placeholder="belum dibeli"
                    class="no-print w-32 rounded-field border border-default bg-default px-2.5 py-1.5 text-end text-sm num focus:border-gold focus:outline-none"
                    @input="ubahRz(p, ($event.target as HTMLInputElement).value)"
                  >
                  <span class="only-print hidden">{{ rz[p.id] === null || rz[p.id] === undefined ? '—' : fRpPenuh(rz[p.id]) }}</span>
                </td>
                <td class="text-end whitespace-nowrap num">
                  <span
                    v-if="over(p) === null"
                    class="text-muted"
                  >—</span>
                  <span
                    v-else-if="over(p) === 0"
                    class="text-muted"
                  >Rp0</span>
                  <span
                    v-else
                    class="font-semibold"
                    :class="over(p)! < 0 ? 'text-error' : 'text-success'"
                  >{{ over(p)! < 0 ? '−' : '' }}{{ fRpPenuh(Math.abs(over(p)!)) }}</span>
                </td>
                <td class="no-print text-center">
                  <button
                    type="button"
                    class="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors"
                    :class="p.proses ? 'bg-success/12 text-success hover:bg-success/20' : 'bg-muted text-muted hover:bg-accented'"
                    :disabled="lagi(p)"
                    @click="jalan(p, () => toggleProses(p))"
                  >
                    {{ p.proses ? 'Selesai' : 'Belum' }}
                  </button>
                </td>
                <td class="no-print">
                  <div class="flex flex-col items-center gap-1">
                    <UButton
                      icon="i-lucide-pencil"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      aria-label="Ubah item"
                      @click="navigateTo('/bd/purchasing')"
                    />
                    <UButton
                      icon="i-lucide-x"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      aria-label="Keluarkan dari PR ini"
                      loading-auto
                      @click="lepas(p)"
                    />
                  </div>
                </td>
              </tr>
              <tr v-if="!items.length">
                <td
                  colspan="11"
                  class="py-6 text-center text-muted"
                >
                  Belum ada item di lembar ini
                </td>
              </tr>
            </tbody>
            <!-- Totals in the table foot, ruled like the rows (old sheet). -->
            <tfoot>
              <tr>
                <td
                  colspan="7"
                  class="text-end font-semibold uppercase tracking-wide text-muted"
                >
                  Jumlah item
                </td>
                <td
                  colspan="2"
                  class="text-end font-bold text-highlighted num"
                >
                  {{ items.length }}
                </td>
                <td
                  colspan="2"
                  class="no-print"
                />
              </tr>
              <tr v-if="total.belum">
                <td
                  colspan="7"
                  class="text-end font-semibold uppercase tracking-wide text-muted"
                >
                  Belum berharga
                </td>
                <td
                  colspan="2"
                  class="text-end num"
                >
                  {{ total.belum }} item
                </td>
                <td
                  colspan="2"
                  class="no-print"
                />
              </tr>
              <tr class="bd-grand bg-gold-soft">
                <td
                  colspan="7"
                  class="text-end font-bold uppercase tracking-wide text-gold-deep"
                >
                  Grand total
                </td>
                <td
                  colspan="2"
                  class="text-end font-bold text-gold-deep num"
                >
                  {{ fRpPenuh(total.grand) }}
                </td>
                <td
                  colspan="2"
                  class="no-print"
                />
              </tr>
              <template v-if="jumlah.terisi">
                <tr>
                  <td
                    colspan="7"
                    class="text-end font-semibold uppercase tracking-wide text-muted"
                  >
                    Total realisasi
                  </td>
                  <td
                    colspan="2"
                    class="text-end num"
                  >
                    {{ fRpPenuh(jumlah.realisasi) }}
                    <span class="block text-xs font-normal text-muted">{{ jumlah.terisi }} dari {{ items.length }} item</span>
                  </td>
                  <td
                    colspan="2"
                    class="no-print"
                  />
                </tr>
                <tr>
                  <td
                    colspan="7"
                    class="text-end font-semibold uppercase tracking-wide text-muted"
                  >
                    Overbudget
                  </td>
                  <td
                    colspan="2"
                    class="text-end num"
                  >
                    <span :class="jumlah.over < 0 ? 'text-error' : 'text-success'">{{ jumlah.over < 0 ? '−' : '' }}{{ fRpPenuh(Math.abs(jumlah.over)) }}</span>
                    <span class="block text-xs font-normal text-muted">{{ jumlah.over < 0 ? 'lebih mahal dari pengajuan' : 'hemat dari pengajuan' }}</span>
                  </td>
                  <td
                    colspan="2"
                    class="no-print"
                  />
                </tr>
              </template>
            </tfoot>
          </table>
        </div>

        <div class="no-print mt-4 flex flex-wrap items-center gap-2">
          <span class="text-[11px] font-bold uppercase tracking-wide text-muted">Susunan penanda tangan</span>
          <USelect
            :model-value="setKini?.id"
            :items="setsEfektif.map(s => ({ value: s.id, label: s.nama + (s.bawaan ? ' (bawaan)' : '') }))"
            class="min-w-52"
            @update:model-value="(v: string | number) => pilihSet(String(v))"
          />
          <span class="text-xs text-muted">Atur daftarnya di <b>Purchasing › Penyetuju</b>.</span>
        </div>

        <div class="mt-5">
          <p class="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
            Approve by
          </p>
          <div class="grid gap-4 sm:grid-cols-3">
            <div
              v-for="s in penanda"
              :key="s.k"
              class="rounded-panel border border-default p-3 text-center"
            >
              <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
                {{ s.l }}
              </p>
              <div class="my-3 flex min-h-10 items-center justify-center">
                <span
                  v-if="(pr.approvals?.[s.k] || {}).at"
                  class="text-sm font-semibold text-success"
                >
                  Disetujui<br>{{ fTgl((pr.approvals?.[s.k] || {}).at) }}
                </span>
                <UButton
                  v-else-if="bolehSetuju(s.k)"
                  label="Setujui"
                  size="sm"
                  class="no-print"
                  loading-auto
                  @click="setuju(s.k, false)"
                />
                <span
                  v-else
                  class="no-print text-xs text-muted"
                >{{ alasan(s.k) }}</span>
              </div>
              <p class="text-xs text-muted">
                {{ (pr.approvals?.[s.k] || {}).nama || s.nama }}
                <UButton
                  v-if="(pr.approvals?.[s.k] || {}).at && bolehSetuju(s.k)"
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  class="no-print ms-1"
                  aria-label="Batalkan persetujuan"
                  loading-auto
                  @click="setuju(s.k, true)"
                />
              </p>
            </div>
          </div>
        </div>

        <p
          v-if="pr.catatan"
          class="mt-4 whitespace-pre-wrap border-t border-default pt-3 text-sm text-muted"
        >
          {{ pr.catatan }}
        </p>
      </div>

      <!-- ── add other requests ── -->
      <AppPanel
        class="no-print mt-5"
        title="Tambahkan request lain ke lembar ini"
        icon="i-lucide-plus-circle"
        :count="bebas.length"
        description="Belum masuk PR"
      >
        <div class="divide-y divide-default">
          <div
            v-for="p in bebas"
            :key="p.id"
            class="flex flex-wrap items-center gap-2 py-2"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate font-semibold text-highlighted">{{ p.item }}</span>
              <span class="text-xs text-muted">{{ Number(p.qty) || 0 }} {{ p.unit }} · {{ poRequester(p, people) }} · butuh {{ p.needBy ? p.needBy : '—' }}</span>
            </span>
            <AppStatus
              :color="WARNA_PO[p.status] || 'neutral'"
              size="sm"
            >
              {{ p.status }}
            </AppStatus>
            <UButton
              label="Masukkan"
              icon="i-lucide-plus"
              color="neutral"
              variant="outline"
              size="sm"
              loading-auto
              @click="masukkan(p)"
            />
          </div>
          <p
            v-if="!bebas.length"
            class="py-4 text-center text-sm text-muted"
          >
            Semua request sudah masuk dokumen.
          </p>
        </div>
      </AppPanel>

      <BdPrSheet
        v-model:open="bukaKepala"
        :pr="pr"
        :pr-all="state.pr"
        :sets="setsEfektif"
        :people="people"
      />
    </template>
  </AppPage>
</template>

<style>
/* The sheet table is ruled on every side, on screen and on paper (old sheet). */
.bd-tabel th,
.bd-tabel td {
  border: 1px solid var(--ui-border-accented);
  padding: 0.75rem 0.85rem;
}
.bd-tabel th {
  padding-block: 0.7rem;
  white-space: nowrap;
}
.bd-tabel .bd-grand td {
  border-color: var(--color-gold, var(--ui-border-accented));
}

@media print {
  @page {
    size: A4;
    margin: 12mm;
  }
  body * {
    visibility: hidden !important;
  }
  .bd-cetak,
  .bd-cetak * {
    visibility: visible !important;
  }
  .bd-cetak {
    position: absolute;
    inset: 0;
    margin: 0;
    max-width: none;
    padding: 0 !important;
    border: 0;
    box-shadow: none;
  }
  /* Keep the tints (info box, table head, grand total) and the rules on paper. */
  .bd-cetak,
  .bd-cetak * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* Fit the page width: no sideways scroll box, no minimum column widths,
     long words and amounts may wrap, smaller type and tighter cells. */
  .bd-cetak .overflow-x-auto {
    overflow: visible !important;
  }
  .bd-tabel {
    width: 100% !important;
    table-layout: auto;
    font-size: 9.5px;
  }
  .bd-tabel th,
  .bd-tabel td {
    min-width: 0 !important;
    white-space: normal !important;
    overflow-wrap: break-word;
    border-color: var(--ui-text-dimmed);
    padding: 0.3rem 0.4rem;
  }
  .bd-tabel th {
    font-size: 8px;
    letter-spacing: 0;
  }
  .bd-tabel td .text-xs {
    font-size: 8px;
  }
  .bd-tabel tr {
    break-inside: avoid;
  }
  .no-print {
    display: none !important;
  }
  .only-print {
    display: inline !important;
  }
}
</style>
