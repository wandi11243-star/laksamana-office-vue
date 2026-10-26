<!--
  Talent Detail (`renderTalentDetail :2672`): avatar header, Basic Information
  and Pembayaran as label/value cards (inline edit, `talentEditInline`),
  Documents as four cards, Performance History, Monthly Income.

  Income per month counts & sums fees from Done schedules. "Status bayar" is
  the schedule's own status until it is Done; a Done show is Paid when a Paid
  bill's period RANGE covers its date (`rentangPeriodeBayar`) — weekly keys
  'a..b' never equal 'YYYY-MM', so a month-only compare left paid shows
  "Waiting" forever.
-->
<script setup lang="ts">
import type { Berkas, JadwalTalent, TagihanTalent, Talent } from '~/composables/useEvent'
import { fileEventUrl, getEvent, updateEvent, uploadFileEvent, useDaftarEvent } from '~/composables/useEvent'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { TAL_CATS, fmtTglEms } from '~/utils/event-hitung'
import { angka, rupiah } from '~/utils/format'
import { inisial } from '~/utils/bd-rumus'
import { tanganiKonflik, versiDari } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const route = useRoute()
const me = useMe()
const toast = useToast()
const id = computed(() => String(route.params.id ?? ''))
const bolehUbah = computed(() => bolehUbahEvent('talents', peranEvent(me.value)))

const { data: env, status, refresh, error } = useAsyncData(`event-talent-${id.value}`, () => getEvent<Talent>('talents', id.value))
const talent = computed(() => env.value?.data ?? null)
const versi = computed(() => versiDari(env.value))

const { data: daftarJadwal } = useDaftarEvent<JadwalTalent>('schedules', { talent_id: id.value }, `event-talent-sched-${id.value}`)
const { data: daftarTagihan } = useDaftarEvent<TagihanTalent>('talent-payments', { talent_id: id.value }, `event-talent-bill-${id.value}`)

const jadwal = computed(() => [...daftarJadwal.value.rows]
  .filter(j => j.talent_id === id.value)
  .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))))
const tagihan = computed(() => daftarTagihan.value.rows.filter(p => p.talent_id === id.value))

const KONTRAK_LABEL: Record<string, string> = { None: 'Tanpa Kontrak', Active: 'Kontrak Berjalan', Expired: 'Kontrak Habis' }
const KONTRAK_WARNA: Record<string, 'info' | 'error' | 'neutral'> = { Active: 'info', Expired: 'error', None: 'neutral' }

// --- inline edit (`talentEditInline :2715`): the often-changed fields only;
// name and notes stay in "Edit Lengkap" on the list page.
const modeEdit = ref(false)
const draft = ref({ category: '', phone: '', whatsapp: '', instagram: '', email: '', manager_name: '', address: '', npwp: '', default_fee: 0, bank_name: '', bank_account: '', status: 'Active', contract_status: 'None' })
function mulaiEdit() {
  const t = talent.value
  if (!t) return
  draft.value = {
    category: t.category ?? TAL_CATS[0]!,
    phone: t.phone ?? '',
    whatsapp: t.whatsapp ?? '',
    instagram: t.instagram ?? '',
    email: t.email ?? '',
    manager_name: t.manager_name ?? '',
    address: String(t.address ?? ''),
    npwp: String(t.npwp ?? ''),
    default_fee: Number(t.default_fee) || 0,
    bank_name: t.bank_name ?? '',
    bank_account: t.bank_account ?? '',
    status: t.status === 'Inactive' ? 'Inactive' : 'Active',
    contract_status: t.contract_status || 'None',
  }
  modeEdit.value = true
}
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
async function simpanInline() {
  const t = talent.value
  if (!t) return
  if (!draft.value.phone.trim()) {
    toast.add({ title: 'Phone wajib diisi.', color: 'error' })
    return
  }
  if (draft.value.email.trim() && !EMAIL_RE.test(draft.value.email.trim())) {
    toast.add({ title: 'Email tidak valid.', color: 'error' })
    return
  }
  try {
    await updateEvent('talents', t.id, { ...t, ...draft.value, updatedAt: Date.now() }, versi.value)
    modeEdit.value = false
    toast.add({ title: 'Talent disimpan', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- documents (≤8MB jpg/png/webp/gif/pdf, portfolio multi-file) ---
type KunciDok = 'ktp' | 'npwp' | 'contract' | 'portfolio'
const DOKS: { k: KunciDok, l: string, multi?: boolean }[] = [
  { k: 'ktp', l: 'KTP' }, { k: 'npwp', l: 'NPWP' }, { k: 'contract', l: 'Contract' }, { k: 'portfolio', l: 'Portfolio', multi: true },
]
const berkasDok = (k: KunciDok): Berkas[] => {
  const v = (talent.value?.docs as Record<string, unknown> | undefined)?.[k]
  return Array.isArray(v) ? v as Berkas[] : v ? [v as Berkas] : []
}
const gambar = (b: Berkas) => /\.(?:jpe?g|png|webp|gif)$/i.test(b.name ?? '')
const ukuran = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

const inputBerkas = ref<HTMLInputElement | null>(null)
const dokTarget = ref<KunciDok>('ktp')
const mengunggah = ref(false)
function pilihDok(k: KunciDok) {
  dokTarget.value = k
  inputBerkas.value?.click()
}
async function unggahDok(ev: Event) {
  const t = talent.value
  const f = (ev.target as HTMLInputElement).files?.[0]
  if (!t || !f) return
  try {
    mengunggah.value = true
    const buf = await f.arrayBuffer()
    let bin = ''
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
    const up = await uploadFileEvent({ dataBase64: btoa(bin), fileName: f.name, mimeType: f.type || 'application/octet-stream' })
    const b: Berkas = up.data
    const docs = { ...(t.docs ?? { portfolio: [] }) }
    if (dokTarget.value === 'portfolio') docs.portfolio = [...berkasDok('portfolio'), b]
    else (docs as Record<string, unknown>)[dokTarget.value] = b
    await updateEvent('talents', t.id, { ...t, docs, updatedAt: Date.now() }, versi.value)
    toast.add({ title: 'Dokumen diunggah', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    mengunggah.value = false
    if (inputBerkas.value) inputBerkas.value.value = ''
  }
}
/** `hapusDoc`: the whole slot (all portfolio files at once, like the old card). */
async function hapusDok(k: KunciDok) {
  const t = talent.value
  if (!t) return
  const docs = { ...(t.docs ?? { portfolio: [] }) }
  if (k === 'portfolio') docs.portfolio = []
  else (docs as Record<string, unknown>)[k] = null
  try {
    await updateEvent('talents', t.id, { ...t, docs, updatedAt: Date.now() }, versi.value)
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- performance history + monthly income ---
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
const labelBulan = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return `${BLN[m! - 1]} ${y}`
}
/** `rentangPeriodeBayar :4041` — 'YYYY-MM' or 'a..b'. */
function rentangPeriode(kunci?: string): { a: string, b: string } | null {
  const k = String(kunci ?? '')
  const p = k.split('..')
  if (p.length === 2) return { a: p[0]!, b: p[1]! }
  if (/^\d{4}-\d{2}$/.test(k)) {
    const akhir = new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)), 0).getDate()
    return { a: `${k}-01`, b: `${k}-${String(akhir).padStart(2, '0')}` }
  }
  return null
}
const STATUS_BAYAR_WARNA: Record<string, 'success' | 'warning' | 'info' | 'error' | 'neutral'> = {
  Paid: 'success', Waiting: 'warning', Confirmed: 'info', Scheduled: 'neutral', Cancelled: 'error',
}
const riwayat = computed(() => jadwal.value.map((j) => {
  let bayar = String(j.status ?? '')
  if (j.status === 'Done') {
    const lunas = tagihan.value.some((p) => {
      if ((p.status ?? '') !== 'Paid') return false
      const r = rentangPeriode(p.period_month)
      return !!r && j.date >= r.a && j.date <= r.b
    })
    bayar = lunas ? 'Paid' : 'Waiting'
  }
  return { ...j, bayar }
}))
const perBulan = computed(() => {
  const m = new Map<string, { bulan: string, show: number, fee: number }>()
  for (const j of jadwal.value) {
    if (j.status !== 'Done') continue
    const k = j.date.slice(0, 7)
    const s = m.get(k) ?? { bulan: k, show: 0, fee: 0 }
    s.show += 1
    s.fee += Number(j.fee) || 0
    m.set(k, s)
  }
  return [...m.values()].sort((a, b) => b.bulan.localeCompare(a.bulan))
})
</script>

<template>
  <EventGerbang lihat="talents">
    <AppPage
      :title="talent?.name ?? 'Rincian talent'"
      description="Profil, pembayaran, dokumen & riwayat tampil"
      :back="{ label: 'Talent', to: '/event/talents' }"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :title="apiErrorMessage(error)"
        class="mb-4"
      />
      <template v-if="talent">
        <div class="mb-4 flex items-center gap-3.5">
          <span class="grid size-14 shrink-0 place-items-center rounded-full bg-primary-100 text-xl font-bold text-primary-700">{{ inisial(talent.name) }}</span>
          <div class="min-w-0">
            <h2 class="truncate text-xl font-bold text-highlighted">
              {{ talent.name }}
            </h2>
            <p class="text-sm text-muted">
              {{ talent.category }}{{ talent.instagram ? ` · ${talent.instagram}` : '' }}
            </p>
          </div>
        </div>

        <div class="mb-4 grid items-start gap-4 lg:grid-cols-2">
          <AppPanel
            title="Basic information"
            icon="i-lucide-id-card"
          >
            <template #actions>
              <UButton
                v-if="bolehUbah && !modeEdit"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-pencil"
                @click="mulaiEdit()"
              >
                Edit
              </UButton>
            </template>
            <dl
              v-if="!modeEdit"
              class="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm"
            >
              <dt class="text-muted">
                Kategori
              </dt>
              <dd>
                <UBadge
                  color="info"
                  variant="soft"
                >
                  {{ talent.category }}
                </UBadge>
              </dd>
              <dt class="text-muted">
                Phone / WA
              </dt>
              <dd>{{ talent.phone || '—' }} · {{ talent.whatsapp || '—' }}</dd>
              <dt class="text-muted">
                Instagram
              </dt>
              <dd>{{ talent.instagram || '—' }}</dd>
              <dt class="text-muted">
                Email
              </dt>
              <dd class="break-all">
                {{ talent.email || '—' }}
              </dd>
              <dt class="text-muted">
                Manager
              </dt>
              <dd>{{ talent.manager_name || '—' }}</dd>
              <dt class="text-muted">
                Alamat
              </dt>
              <dd>{{ talent.address || '—' }}</dd>
              <dt class="text-muted">
                NPWP
              </dt>
              <dd>{{ talent.npwp || '—' }}</dd>
              <dt class="text-muted">
                Status talent
              </dt>
              <dd>
                <AppStatus
                  :color="talent.status === 'Inactive' ? 'neutral' : 'success'"
                  :icon="talent.status === 'Inactive' ? 'i-lucide-circle-pause' : 'i-lucide-circle-check'"
                  size="sm"
                >
                  {{ talent.status === 'Inactive' ? 'Nonaktif' : 'Aktif' }}
                </AppStatus>
              </dd>
              <dt class="text-muted">
                Status kontrak
              </dt>
              <dd>
                <AppStatus
                  :color="KONTRAK_WARNA[talent.contract_status || 'None'] ?? 'neutral'"
                  icon="i-lucide-file-signature"
                  size="sm"
                >
                  {{ KONTRAK_LABEL[talent.contract_status || 'None'] ?? talent.contract_status }}
                </AppStatus>
              </dd>
              <dt class="text-muted">
                Notes
              </dt>
              <dd class="whitespace-pre-line">
                {{ talent.notes || '—' }}
              </dd>
            </dl>
            <div
              v-else
              class="grid gap-3 sm:grid-cols-2"
            >
              <UFormField label="Kategori">
                <USelect
                  v-model="draft.category"
                  :items="[...new Set([...TAL_CATS, draft.category])].map(c => ({ value: c, label: c }))"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Phone">
                <UInput
                  v-model="draft.phone"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="WhatsApp">
                <UInput
                  v-model="draft.whatsapp"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Instagram">
                <UInput
                  v-model="draft.instagram"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Email">
                <UInput
                  v-model="draft.email"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Manager">
                <UInput
                  v-model="draft.manager_name"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Alamat">
                <UInput
                  v-model="draft.address"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="NPWP">
                <UInput
                  v-model="draft.npwp"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Default fee">
                <UInput
                  v-model.number="draft.default_fee"
                  type="number"
                  min="0"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Bank">
                <UInput
                  v-model="draft.bank_name"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="No. rekening">
                <UInput
                  v-model="draft.bank_account"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Status talent">
                <USelect
                  v-model="draft.status"
                  :items="[{ value: 'Active', label: 'Aktif' }, { value: 'Inactive', label: 'Nonaktif' }]"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Status kontrak">
                <USelect
                  v-model="draft.contract_status"
                  :items="Object.entries(KONTRAK_LABEL).map(([value, label]) => ({ value, label }))"
                  class="w-full"
                />
              </UFormField>
              <div class="flex gap-2 sm:col-span-2">
                <UButton
                  color="primary"
                  @click="simpanInline()"
                >
                  Simpan
                </UButton>
                <UButton
                  color="neutral"
                  variant="outline"
                  @click="modeEdit = false"
                >
                  Batal
                </UButton>
              </div>
            </div>
          </AppPanel>

          <AppPanel
            title="Pembayaran"
            icon="i-lucide-banknote"
          >
            <template #actions>
              <UButton
                v-if="bolehUbah && !modeEdit"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-pencil"
                @click="mulaiEdit()"
              >
                Edit
              </UButton>
            </template>
            <dl class="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt class="text-muted">
                Default fee
              </dt>
              <dd>
                <b class="text-highlighted num">{{ rupiah(Number(talent.default_fee) || 0) }}</b> / show
              </dd>
              <dt class="text-muted">
                Bank
              </dt>
              <dd>{{ talent.bank_name || '—' }}</dd>
              <dt class="text-muted">
                No. rekening
              </dt>
              <dd class="num">
                {{ talent.bank_account || '—' }}
              </dd>
              <dt class="text-muted">
                A/N
              </dt>
              <dd>{{ talent.account_holder || '—' }}</dd>
            </dl>
          </AppPanel>
        </div>

        <AppPanel
          title="Documents"
          icon="i-lucide-folder-open"
          class="mb-4"
        >
          <input
            ref="inputBerkas"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.gif,.pdf"
            class="hidden"
            @change="unggahDok($event)"
          >
          <p class="mb-3 text-xs text-muted">
            KTP, NPWP, Kontrak & Portfolio — PDF/JPG/PNG, maks 8MB per berkas. Tersimpan di server sendiri, di luar folder web.
          </p>
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div
              v-for="d in DOKS"
              :key="d.k"
              class="flex flex-col items-center gap-2 rounded-card bg-muted p-3 text-center text-sm"
            >
              <b class="text-highlighted">{{ d.l }}</b>
              <template v-if="!berkasDok(d.k).length">
                <UIcon
                  name="i-lucide-file-text"
                  class="size-8 text-dimmed"
                />
                <span class="text-xs text-muted">belum ada</span>
              </template>
              <template v-else>
                <a
                  v-for="(b, i) in berkasDok(d.k)"
                  :key="i"
                  :href="fileEventUrl(b.key)"
                  target="_blank"
                  rel="noopener"
                  :title="b.name"
                  class="block max-w-full"
                >
                  <img
                    v-if="gambar(b)"
                    :src="fileEventUrl(b.key)"
                    :alt="d.l"
                    class="h-16 w-full rounded-field object-cover"
                  >
                  <span
                    v-else
                    class="flex flex-col items-center"
                  ><UIcon
                    name="i-lucide-file-text"
                    class="size-8 text-primary-700"
                  /><span class="max-w-full truncate text-xs text-muted">{{ b.name }}</span></span>
                </a>
                <span class="text-xs text-muted">{{ berkasDok(d.k).length }} berkas · {{ ukuran(berkasDok(d.k).reduce((a, f) => a + (Number(f.size) || 0), 0)) }}</span>
              </template>
              <div
                v-if="bolehUbah"
                class="flex flex-wrap justify-center gap-1"
              >
                <UButton
                  color="neutral"
                  variant="outline"
                  size="xs"
                  :loading="mengunggah && dokTarget === d.k"
                  @click="pilihDok(d.k)"
                >
                  {{ berkasDok(d.k).length && !d.multi ? 'Ganti' : 'Unggah' }}
                </UButton>
                <UButton
                  v-if="berkasDok(d.k).length"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="hapusDok(d.k)"
                >
                  Hapus
                </UButton>
              </div>
            </div>
          </div>
        </AppPanel>

        <AppPanel
          title="Performance history"
          icon="i-lucide-history"
          flush
          class="mb-4"
        >
          <UTable
            :columns="[{ id: 'tgl', header: 'Tanggal' }, { id: 'show', header: 'Jenis show' }, { id: 'jam', header: 'Jam' }, { id: 'fee', header: 'Fee' }, { id: 'bayar', header: 'Status bayar' }]"
            :data="riwayat"
            class="hidden lg:block"
          >
            <template #tgl-cell="{ row }">
              {{ fmtTglEms(row.original.date) }}
            </template>
            <template #show-cell="{ row }">
              {{ row.original.performance_type || '—' }}
            </template>
            <template #jam-cell="{ row }">
              {{ row.original.start_time }}–{{ row.original.end_time }}
            </template>
            <template #fee-cell="{ row }">
              <span class="num">{{ rupiah(Number(row.original.fee) || 0) }}</span>
            </template>
            <template #bayar-cell="{ row }">
              <AppStatus
                :color="STATUS_BAYAR_WARNA[row.original.bayar] ?? 'neutral'"
                size="sm"
              >
                {{ row.original.bayar }}
              </AppStatus>
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="j in riwayat"
              :key="j.id"
              class="flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
            >
              <span class="min-w-0">
                <b class="text-highlighted">{{ fmtTglEms(j.date) }}</b> · {{ j.performance_type || '—' }}
                <span class="block text-xs text-muted num">{{ j.start_time }}–{{ j.end_time }} · {{ rupiah(Number(j.fee) || 0) }}</span>
              </span>
              <AppStatus
                :color="STATUS_BAYAR_WARNA[j.bayar] ?? 'neutral'"
                size="sm"
              >
                {{ j.bayar }}
              </AppStatus>
            </li>
          </ul>
          <p
            v-if="!riwayat.length"
            class="px-4 py-6 text-center text-sm text-dimmed"
          >
            Belum ada riwayat tampil.
          </p>
        </AppPanel>

        <AppPanel
          title="Monthly income"
          icon="i-lucide-wallet"
          flush
        >
          <UTable
            :columns="[{ id: 'bulan', header: 'Bulan' }, { id: 'show', header: 'Jumlah show' }, { id: 'fee', header: 'Total fee' }]"
            :data="perBulan"
            class="hidden lg:block"
          >
            <template #bulan-cell="{ row }">
              {{ labelBulan(row.original.bulan) }}
            </template>
            <template #show-cell="{ row }">
              <span class="num">{{ angka(row.original.show) }} show</span>
            </template>
            <template #fee-cell="{ row }">
              <b class="text-highlighted num">{{ rupiah(row.original.fee) }}</b>
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="b in perBulan"
              :key="b.bulan"
              class="flex justify-between px-4 py-2.5 text-sm"
            >
              <b class="text-highlighted">{{ labelBulan(b.bulan) }}</b>
              <span class="num">{{ b.show }} show · {{ rupiah(b.fee) }}</span>
            </li>
          </ul>
          <p
            v-if="!perBulan.length"
            class="px-4 py-6 text-center text-sm text-dimmed"
          >
            Belum ada income (show Done).
          </p>
        </AppPanel>
      </template>
      <p
        v-else-if="status !== 'pending'"
        class="py-10 text-center text-sm text-dimmed"
      >
        Talent tidak ditemukan.
      </p>
    </AppPage>
  </EventGerbang>
</template>
