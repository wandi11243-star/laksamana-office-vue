<!--
  Talent Detail — basic information (inline edit), payment, documents,
  performance history, monthly income (`renderTalentDetail :2596`).

  Income per month counts & sums fees from Done schedules (`:2604`); per-show
  pay state is matched through the bill period key (`:2618`).
-->
<script setup lang="ts">
import type { Berkas, JadwalTalent, TagihanTalent, Talent } from '~/composables/useEvent'
import { getEvent, updateEvent, uploadFileEvent, useDaftarEvent } from '~/composables/useEvent'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { angka, rupiah, tglPendek } from '~/utils/format'
import { TALENT_IKON, TALENT_WARNA } from '~/utils/status-event'
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

// --- inline edit (`talentEditInline :2659`, `talentSimpanInline :2686`) ---
const modeEdit = ref(false)
const draft = ref({ name: '', phone: '', whatsapp: '', instagram: '', email: '', manager_name: '', notes: '' })
function mulaiEdit() {
  const t = talent.value
  if (!t) return
  draft.value = {
    name: t.name ?? '',
    phone: t.phone ?? '',
    whatsapp: t.whatsapp ?? '',
    instagram: t.instagram ?? '',
    email: t.email ?? '',
    manager_name: t.manager_name ?? '',
    notes: t.notes ?? '',
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
const inputBerkas = ref<HTMLInputElement | null>(null)
const dokTarget = ref<'ktp' | 'npwp' | 'contract' | 'portfolio'>('ktp')
const mengunggah = ref(false)
function pilihDok(k: typeof dokTarget.value) {
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
    if (dokTarget.value === 'portfolio') docs.portfolio = [...(docs.portfolio ?? []), b]
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
async function hapusDok(k: 'ktp' | 'npwp' | 'contract', idx = -1) {
  const t = talent.value
  if (!t) return
  const docs = { ...(t.docs ?? { portfolio: [] }) }
  if (k === 'ktp' || k === 'npwp' || k === 'contract') {
    if (idx >= 0) docs.portfolio = (docs.portfolio ?? []).filter((_, i) => i !== idx)
    else (docs as Record<string, unknown>)[k] = null
  }
  try {
    await updateEvent('talents', t.id, { ...t, docs, updatedAt: Date.now() }, versi.value)
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- performance history + monthly income (`:2604-2625`) ---
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
const labelBulan = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return `${BLN[m! - 1]} ${y}`
}
const riwayat = computed(() => jadwal.value.map(j => ({
  ...j,
  lunas: tagihan.value.some(p => (p.status ?? '') === 'Paid' && kunciPeriode(j.date) === p.period_month),
})))
function kunciPeriode(tgl: string) {
  return tgl.slice(0, 7)
}
const perBulan = computed(() => {
  const m = new Map<string, { bulan: string, show: number, fee: number }>()
  for (const j of jadwal.value) {
    if (j.status !== 'Done') continue
    const k = kunciPeriode(j.date)
    const s = m.get(k) ?? { bulan: k, show: 0, fee: 0 }
    s.show += 1
    s.fee += Number(j.fee) || 0
    m.set(k, s)
  }
  return [...m.values()].sort((a, b) => b.bulan.localeCompare(a.bulan))
})

const DOK_LABEL = { ktp: 'KTP', npwp: 'NPWP', contract: 'Contract', portfolio: 'Portfolio' } as const
</script>

<template>
  <AppPage
    title="Rincian talent"
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
      <AppPanel
        title="Basic information"
        icon="i-lucide-id-card"
        class="mb-4"
      >
        <template #actions>
          <UButton
            v-if="bolehUbah && !modeEdit"
            color="neutral"
            variant="outline"
            icon="i-lucide-pencil"
            @click="mulaiEdit()"
          >
            Edit
          </UButton>
        </template>
        <div
          v-if="!modeEdit"
          class="grid gap-x-6 gap-y-2 text-sm lg:grid-cols-2"
        >
          <p><b class="text-highlighted">{{ talent.name }}</b> · {{ talent.category }}</p>
          <p class="text-muted">
            {{ talent.phone }} · {{ talent.whatsapp || '—' }}
          </p>
          <p class="text-muted">
            {{ talent.email || '—' }} · {{ talent.instagram || '—' }}
          </p>
          <p class="text-muted">
            Manager: {{ talent.manager_name || '—' }}
          </p>
          <p>
            <AppStatus
              :color="TALENT_WARNA[String(talent.status)] ?? 'neutral'"
              :icon="TALENT_IKON[String(talent.status)]"
              size="sm"
            >
              {{ talent.status }}
            </AppStatus>
          </p>
          <p
            v-if="talent.notes"
            class="text-muted lg:col-span-2"
          >
            {{ talent.notes }}
          </p>
        </div>
        <div
          v-else
          class="grid gap-3 lg:grid-cols-2"
        >
          <UFormField label="Nama">
            <UInput
              v-model="draft.name"
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
          <UFormField
            label="Notes"
            class="lg:col-span-2"
          >
            <UTextarea
              v-model="draft.notes"
              class="w-full"
            />
          </UFormField>
          <div class="flex gap-2 lg:col-span-2">
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
        class="mb-4"
      >
        <dl class="grid gap-x-6 gap-y-2 text-sm lg:grid-cols-2">
          <div class="flex justify-between gap-3">
            <dt class="text-muted">
              Default fee
            </dt>
            <dd class="font-semibold text-highlighted num">
              {{ rupiah(Number(talent.default_fee) || 0) }}
            </dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-muted">
              Bank
            </dt>
            <dd class="font-semibold text-highlighted">
              {{ talent.bank_name || '—' }} {{ talent.bank_account || '' }}
            </dd>
          </div>
        </dl>
      </AppPanel>

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
        <ul class="grid gap-2 lg:grid-cols-2">
          <li
            v-for="k in (['ktp', 'npwp', 'contract'] as const)"
            :key="k"
            class="flex items-center justify-between gap-2 rounded-field border border-default px-3 py-2 text-sm"
          >
            <span><b class="text-highlighted">{{ DOK_LABEL[k] }}</b> · <span class="text-muted">{{ (talent.docs?.[k] as Berkas | null)?.name ?? 'belum ada' }}</span></span>
            <span class="flex gap-1">
              <UButton
                v-if="bolehUbah"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-upload"
                :loading="mengunggah"
                @click="pilihDok(k)"
              >
                {{ (talent.docs?.[k] as Berkas | null) ? 'Ganti' : 'Unggah' }}
              </UButton>
              <UButton
                v-if="bolehUbah && (talent.docs?.[k] as Berkas | null)"
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                @click="hapusDok(k)"
              />
            </span>
          </li>
        </ul>
        <div class="mt-3">
          <p class="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
            Portfolio ({{ (talent.docs?.portfolio ?? []).length }} berkas)
          </p>
          <ul
            v-if="(talent.docs?.portfolio ?? []).length"
            class="grid gap-2 lg:grid-cols-2"
          >
            <li
              v-for="(b, i) in (talent.docs?.portfolio ?? [])"
              :key="i"
              class="flex items-center justify-between gap-2 rounded-field border border-default px-3 py-2 text-sm"
            >
              <span class="truncate text-muted">{{ b.name }}</span>
              <UButton
                v-if="bolehUbah"
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                @click="hapusDok('ktp', i)"
              />
            </li>
          </ul>
          <UButton
            v-if="bolehUbah"
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-upload"
            class="mt-2"
            @click="pilihDok('portfolio')"
          >
            Unggah portfolio
          </UButton>
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
            {{ tglPendek(row.original.date) }}
          </template>
          <template #show-cell="{ row }">
            {{ row.original.type || '—' }}
          </template>
          <template #jam-cell="{ row }">
            {{ row.original.start_time }}–{{ row.original.end_time }}
          </template>
          <template #fee-cell="{ row }">
            <span class="num">{{ rupiah(Number(row.original.fee) || 0) }}</span>
          </template>
          <template #bayar-cell="{ row }">
            <AppStatus
              :color="row.original.lunas ? 'success' : 'warning'"
              :icon="row.original.lunas ? 'i-lucide-check' : 'i-lucide-hourglass'"
              size="sm"
            >
              {{ row.original.lunas ? 'Lunas' : 'Menunggu' }}
            </AppStatus>
          </template>
        </UTable>
        <ul class="divide-y divide-default lg:hidden">
          <li
            v-for="j in riwayat"
            :key="j.id"
            class="px-4 py-2.5 text-sm"
          >
            <b class="text-highlighted">{{ tglPendek(j.date) }}</b> · {{ j.type }} · <span class="num">{{ rupiah(Number(j.fee) || 0) }}</span>
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
            <span class="num">{{ angka(row.original.show) }}</span>
          </template>
          <template #fee-cell="{ row }">
            <span class="num">{{ rupiah(row.original.fee) }}</span>
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
      </AppPanel>
    </template>
    <p
      v-else-if="status !== 'pending'"
      class="py-10 text-center text-sm text-dimmed"
    >
      Talent tidak ditemukan.
    </p>
  </AppPage>
</template>
