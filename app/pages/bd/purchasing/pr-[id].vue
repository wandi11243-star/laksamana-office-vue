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
  bdSimpan, bdTulisDiam, hapusBd, setRealisasi, tambalBd, useBdSettings, useBdState,
  versiBaris,
} from '~/composables/useBd'
import {
  PENYETUJU_BIBIT, cariAku, fRpPenuh, fieldsProses, labelMinggu, penyetujuPr, poBeres, poRequester,
  prBeres, prItems, prTotal, realisasiNum, rzFormat, todayISO,
} from '~/utils/bd-rumus'
import { WARNA_PO } from '~/utils/status-bd'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
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
function ubahRz(p: BdPo, nilai: string) {
  const d = String(nilai).replace(/[^0-9]/g, '')
  rz[p.id] = d === '' ? null : Number(d)
  if (rzTimer[p.id]) clearTimeout(rzTimer[p.id]!)
  rzTimer[p.id] = setTimeout(() => {
    bdTulisDiam(() => setRealisasi(p.id, d === '' ? '' : Number(d)))
  }, 500)
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
  window.print()
}
async function statusPr(st: string) {
  const p = pr.value
  if (!p) return
  await bdSimpan(() => tambalBd<BdPr>('purchase-requests', p.id, { status: st }, versiBaris(p)), st === 'Draft' ? 'Kunci dibuka — item bisa diubah lagi' : `PR-${p.no} dikunci sebagai ${st}`)
}
async function lepas(p: BdPo) {
  const prNow = pr.value
  if (!prNow) return
  await bdTulisDiam(() => tambalBd<BdPo>('purchase-orders', p.id, { prId: null }, versiBaris(p)))
  await bdTulisDiam(() => tambalBd<BdPr>('purchase-requests', prNow.id, { total: 0 }, versiBaris(prNow)))
}
async function masukkan(p: BdPo) {
  const prNow = pr.value
  if (!prNow) return
  await bdTulisDiam(() => tambalBd<BdPo>('purchase-orders', p.id, { prId: prNow.id }, versiBaris(p)))
}
function toggleProses(p: BdPo) {
  const on = !poBeres(p)
  bdTulisDiam(() => tambalBd<BdPo>('purchase-orders', p.id, fieldsProses(p, on, aku.value?.name || ''), versiBaris(p)))
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

async function hapusPr() {
  const p = pr.value
  if (!p) return
  hapusMau.value = false
  const aksi = async () => {
    for (const it of items.value) await tambalBd<BdPo>('purchase-orders', it.id, { prId: null }, versiBaris(it))
    await hapusBd('purchase-requests', p.id, versiBaris(p))
  }
  const ok = await bdSimpan(aksi, 'Dokumen PR dihapus, itemnya dilepas')
  if (ok) navigateTo('/bd/purchasing')
}
const hapusMau = ref(false)

const toast = useToast()
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
        @click="statusPr('Diajukan')"
      />
      <UButton
        v-else-if="pr"
        label="Kembalikan ke Draft"
        color="neutral"
        variant="outline"
        @click="statusPr('Draft')"
      />
      <UButton
        v-if="pr"
        label="Hapus"
        icon="i-lucide-trash-2"
        color="error"
        variant="soft"
        @click="hapusMau = true"
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
        class="no-print mb-4 rounded-field border border-warning/30 bg-warning/10 p-3 text-sm"
      >
        Lembar ini sudah <b>{{ pr.status }}</b>. Itemnya <b>masih bisa diubah</b> — tapi kalau PDF-nya sudah
        dikirim ke Finance, <b>kirim ulang</b> sesudah merevisi.
      </p>
      <p
        v-else
        class="no-print mb-4 rounded-field border border-default bg-muted p-3 text-sm"
      >
        Masih <b>Draft</b> — belum terkirim ke siapa pun. Tekan <b>Kunci & ajukan</b> saat lembarnya siap dikirim.
      </p>

      <!-- ── printable document ── -->
      <div class="bd-cetak rounded-panel border border-default bg-default p-5 shadow-panel lg:p-8">
        <div class="flex flex-wrap items-start justify-between gap-4 border-b-2 border-default pb-4">
          <div class="flex items-center gap-3">
            <img
              src="/mark.png"
              alt="Laksamana Muda"
              class="h-10 w-10"
            >
            <div>
              <p class="font-display text-xl font-bold text-highlighted">
                Laksamana Muda
              </p>
              <p class="text-xs uppercase tracking-widest text-muted">
                Coffee & Live Space
              </p>
              <p class="mt-1 text-xs text-muted">
                Jl. Soekarno Hatta No. 39, Payung Sekaki, Pekanbaru
              </p>
            </div>
          </div>
          <div class="text-end">
            <p class="text-[11px] font-bold uppercase tracking-widest text-primary-700">
              Purchase Request
            </p>
            <p class="font-display text-2xl font-bold text-highlighted">
              PR-{{ pr.no || '?' }}
            </p>
            <p class="text-xs text-muted">
              {{ labelMinggu(pr.weekStart || pr.tanggal) }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 border-b border-default py-4 text-sm sm:grid-cols-4">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
              PR No
            </p>
            <p class="text-highlighted">
              {{ pr.no || '—' }}
            </p>
          </div>
          <div>
            <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
              Name
            </p>
            <p class="text-highlighted">
              {{ pr.nama || '—' }}
            </p>
          </div>
          <div>
            <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
              Department
            </p>
            <p class="text-highlighted">
              {{ pr.dept || '—' }}
            </p>
          </div>
          <div>
            <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
              Request Date
            </p>
            <p class="text-highlighted">
              {{ fTgl(pr.tanggal) }}
            </p>
          </div>
        </div>

        <div class="mt-4 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default">
                <th class="py-2 text-start text-[11px] uppercase tracking-wide text-muted">
                  No
                </th>
                <th class="py-2 text-start text-[11px] uppercase tracking-wide text-muted">
                  Nama item
                </th>
                <th class="py-2 text-center text-[11px] uppercase tracking-wide text-muted">
                  Jumlah
                </th>
                <th class="py-2 text-start text-[11px] uppercase tracking-wide text-muted">
                  Satuan
                </th>
                <th class="py-2 text-start text-[11px] uppercase tracking-wide text-muted">
                  Alasan / kebutuhan
                </th>
                <th class="py-2 text-start text-[11px] uppercase tracking-wide text-muted">
                  Request
                </th>
                <th class="py-2 text-end text-[11px] uppercase tracking-wide text-muted">
                  Harga
                </th>
                <th class="py-2 text-end text-[11px] uppercase tracking-wide text-muted">
                  Realisasi
                </th>
                <th class="py-2 text-end text-[11px] uppercase tracking-wide text-muted">
                  Overbudget
                </th>
                <th class="no-print py-2 text-center text-[11px] uppercase tracking-wide text-muted">
                  Proses
                </th>
                <th class="no-print py-2" />
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="(p, i) in items"
                :key="p.id"
              >
                <td class="py-2 text-muted">
                  {{ i + 1 }}
                </td>
                <td class="py-2 font-semibold text-highlighted">
                  {{ p.item }}
                </td>
                <td class="py-2 text-center num">
                  {{ Number(p.qty) || 0 }}
                </td>
                <td class="py-2 text-muted">
                  {{ p.unit || '' }}
                </td>
                <td class="py-2 text-muted">
                  {{ p.note || '—' }}
                </td>
                <td class="py-2 text-muted">
                  {{ String(poRequester(p, people)).split(' ')[0] }}
                </td>
                <td class="py-2 text-end whitespace-nowrap num">
                  <span v-if="Number(p.amount)">{{ fRpPenuh(p.amount) }}</span>
                  <span
                    v-else
                    class="text-muted"
                  >belum</span>
                </td>
                <td class="py-2 text-end">
                  <input
                    :value="rz[p.id] === null || rz[p.id] === undefined ? '' : rzFormat(rz[p.id])"
                    inputmode="numeric"
                    placeholder="belum dibeli"
                    class="no-print w-28 rounded-field border border-default px-2 py-1 text-end text-sm num"
                    @input="ubahRz(p, ($event.target as HTMLInputElement).value)"
                  >
                  <span class="only-print hidden">{{ rz[p.id] === null || rz[p.id] === undefined ? '—' : fRpPenuh(rz[p.id]) }}</span>
                </td>
                <td class="py-2 text-end whitespace-nowrap num">
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
                <td class="no-print py-2 text-center">
                  <button
                    type="button"
                    class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    :class="p.proses ? 'bg-success/12 text-success' : 'bg-muted text-muted'"
                    @click="toggleProses(p)"
                  >
                    {{ p.proses ? 'Selesai' : 'Belum' }}
                  </button>
                </td>
                <td class="no-print py-2">
                  <div class="flex justify-end gap-1">
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
          </table>
        </div>

        <div class="mt-4 flex justify-end">
          <table class="text-sm">
            <tbody>
              <tr>
                <td class="pe-6 py-1 text-muted">
                  JUMLAH ITEM
                </td>
                <td class="py-1 text-end font-semibold num">
                  {{ items.length }}
                </td>
              </tr>
              <tr v-if="total.belum">
                <td class="pe-6 py-1 text-muted">
                  BELUM BERHARGA
                </td>
                <td class="py-1 text-end num">
                  {{ total.belum }} item
                </td>
              </tr>
              <tr class="border-t border-default">
                <td class="pe-6 py-1 font-bold text-highlighted">
                  GRAND TOTAL
                </td>
                <td class="py-1 text-end font-bold text-highlighted num">
                  {{ fRpPenuh(total.grand) }}
                </td>
              </tr>
              <template v-if="jumlah.terisi">
                <tr>
                  <td class="pe-6 py-1 text-muted">
                    TOTAL REALISASI
                  </td>
                  <td class="py-1 text-end num">
                    {{ fRpPenuh(jumlah.realisasi) }}
                    <span class="text-xs font-normal text-muted">({{ jumlah.terisi }} dari {{ items.length }} item)</span>
                  </td>
                </tr>
                <tr>
                  <td class="pe-6 py-1 text-muted">
                    OVERBUDGET
                  </td>
                  <td class="py-1 text-end num">
                    <span :class="jumlah.over < 0 ? 'text-error' : 'text-success'">{{ jumlah.over < 0 ? '−' : '' }}{{ fRpPenuh(Math.abs(jumlah.over)) }}</span>
                    <span class="text-xs font-normal text-muted">{{ jumlah.over < 0 ? 'lebih mahal dari pengajuan' : 'hemat dari pengajuan' }}</span>
                  </td>
                </tr>
              </template>
            </tbody>
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
              class="rounded-field border border-default p-3 text-center"
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
      <BdKonfirmasi
        v-model:open="hapusMau"
        title="Hapus dokumen PR ini?"
        :description="`${items.length} item di dalamnya TIDAK ikut terhapus — mereka kembali jadi request bebas.`"
        @konfirmasi="hapusPr"
      />
    </template>
  </AppPage>
</template>

<style>
@media print {
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
    border: 0;
    box-shadow: none;
  }
  .no-print {
    display: none !important;
  }
  .only-print {
    display: inline !important;
  }
}
</style>
