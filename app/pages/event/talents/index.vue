<!--
  Talent Management — filter row, talent table, talent form
  (`event/index.html:2495-2538`).

  Table columns, in the old order: Talent (initial avatar + name + Instagram),
  Kategori, Kontak (WhatsApp + email), Manager, Default Fee, Status Kontrak,
  Status Talent, delete. Two statuses stay distinct on purpose (`:2470`).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Talent } from '~/composables/useEvent'
import { createEvent, removeEvent, updateEvent, useDaftarEvent } from '~/composables/useEvent'
import { TAL_CATS } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { angka, rupiah } from '~/utils/format'
import { nadaKategori, TALENT_IKON, TALENT_WARNA } from '~/utils/status-event'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const me = useMe()
const toast = useToast()
const peran = computed(() => peranEvent(me.value))
const bolehUbah = computed(() => bolehUbahEvent('talents', peran.value))

const SEMUA = 'semua'
const q = ref('')
const fKategori = ref(SEMUA)
const fStatus = ref('Active')
const fKontrak = ref(SEMUA)

const query = computed<Record<string, string>>(() => {
  const o: Record<string, string> = {}
  if (fKategori.value !== SEMUA) o.category = fKategori.value
  if (fStatus.value !== SEMUA) o.status = fStatus.value
  return o
})
const { data: daftar, status, refresh } = useDaftarEvent<Talent>('talents', query, 'event-talents')

const list = computed(() => {
  const cari = q.value.trim().toLowerCase()
  return daftar.value.rows.filter((t) => {
    // filtered here too, like talFilter (:2571): a server that ignores the query must not show inactive talent
    if (fKategori.value !== SEMUA && t.category !== fKategori.value) return false
    if (fStatus.value !== SEMUA && t.status !== fStatus.value) return false
    if (fKontrak.value !== SEMUA && (t.contract_status ?? 'None') !== fKontrak.value) return false
    if (cari && !(t.name ?? '').toLowerCase().includes(cari) && !(t.phone ?? '').includes(cari)) return false
    return true
  }).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
})

const inisial = (n?: string) => (n ?? '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
// The stored values are the old ones (Active / Expired / None, :2558 badgeKontrak):
// 'Berjalan'/'Habis' never matched a real row, so every contract read as raw text.
const KONTRAK_LABEL: Record<string, string> = { None: 'Tanpa Kontrak', Active: 'Kontrak Berjalan', Expired: 'Kontrak Habis' }
const KONTRAK_WARNA: Record<string, 'info' | 'error' | 'neutral'> = { Active: 'info', Expired: 'error', None: 'neutral' }
const STATUS_LABEL: Record<string, string> = { Active: 'Aktif', Inactive: 'Nonaktif' }
const OPSI_KONTRAK = [
  { value: 'None', label: 'Tanpa Kontrak' },
  { value: 'Active', label: 'Kontrak Berjalan' },
  { value: 'Expired', label: 'Kontrak Habis' },
]
const OPSI_STATUS = [
  { value: 'Active', label: 'Aktif — masih dipakai' },
  { value: 'Inactive', label: 'Nonaktif — tidak dijadwalkan lagi' },
]

const kolom: TableColumn<Talent>[] = [
  { id: 'talent', header: 'Talent' },
  { id: 'kategori', header: 'Kategori' },
  { id: 'kontak', header: 'Kontak' },
  { id: 'manager', header: 'Manager' },
  { id: 'fee', header: 'Default fee' },
  { id: 'kontrak', header: 'Status kontrak' },
  { id: 'status', header: 'Status talent' },
  { id: 'aksi', header: '' },
]

// --- form (`talentForm :2522`, `saveTalent :2542`) ---
const sheet = ref(false)
const suntingId = ref('')
const form = ref({
  name: '',
  category: TAL_CATS[0] as string,
  phone: '',
  whatsapp: '',
  instagram: '',
  email: '',
  manager_name: '',
  default_fee: 1000000,
  bank_name: '',
  bank_account: '',
  contract_status: 'None',
  status: 'Active',
  notes: '',
})

function bukaBaru() {
  suntingId.value = ''
  form.value = {
    name: '',
    category: TAL_CATS[0]!,
    phone: '',
    whatsapp: '',
    instagram: '',
    email: '',
    manager_name: '',
    default_fee: 1000000,
    bank_name: '',
    bank_account: '',
    contract_status: 'None',
    status: 'Active',
    notes: '',
  }
  sheet.value = true
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
async function simpan() {
  const f = form.value
  if (!f.name.trim() || !f.phone.trim()) {
    toast.add({ title: 'Nama & phone wajib diisi.', color: 'error' })
    return
  }
  if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) {
    toast.add({ title: 'Email tidak valid.', color: 'error' })
    return
  }
  const body = {
    ...f,
    name: f.name.trim(),
    phone: f.phone.trim(),
    email: f.email.trim(),
    account_holder: f.name.trim(),
    updatedAt: Date.now(),
  }
  try {
    if (suntingId.value) {
      const lama = daftar.value.rows.find(t => t.id === suntingId.value)
      const versi = daftar.value.versions[suntingId.value]
      await updateEvent('talents', suntingId.value, { ...lama, ...body }, versi)
      toast.add({ title: 'Talent disimpan', color: 'success' })
    }
    else {
      await createEvent('talents', { ...body, docs: { portfolio: [] }, createdAt: Date.now() })
      toast.add({ title: 'Talent baru ditambahkan', color: 'success' })
    }
    sheet.value = false
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

const hapusId = ref('')
const sheetHapus = computed({
  get: () => hapusId.value !== '',
  set: v => (hapusId.value = v ? hapusId.value : ''),
})
async function hapus() {
  const id = hapusId.value
  if (!id) return
  hapusId.value = ''
  try {
    await removeEvent('talents', id, daftar.value.versions[id])
    toast.add({ title: 'Talent dihapus', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <EventGerbang lihat="talents">
    <AppPage
      title="Talent management"
      description="Kelola profil, jadwal & fee talent"
    >
      <template #actions>
        <UButton
          v-if="bolehUbah"
          color="primary"
          icon="i-lucide-plus"
          @click="bukaBaru()"
        >
          Talent baru
        </UButton>
      </template>

      <AppPanel class="mb-4">
        <AppFilterGrid>
          <UFormField label="Cari nama talent">
            <UInput
              v-model="q"
              placeholder="Cari nama talent…"
              icon="i-lucide-search"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Kategori">
            <USelect
              v-model="fKategori"
              :items="[{ value: SEMUA, label: 'Semua kategori' }, ...TAL_CATS.map(c => ({ value: c, label: c }))]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Status talent">
            <USelect
              v-model="fStatus"
              :items="[{ value: SEMUA, label: 'Semua status talent' }, { value: 'Active', label: 'Aktif' }, { value: 'Inactive', label: 'Nonaktif' }]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Kontrak">
            <USelect
              v-model="fKontrak"
              :items="[{ value: SEMUA, label: 'Semua kontrak' }, ...OPSI_KONTRAK]"
              class="w-full"
            />
          </UFormField>
        </AppFilterGrid>
        <p class="mt-2 text-xs text-muted num">
          {{ angka(list.length) }} talent
        </p>
      </AppPanel>

      <AppPanel flush>
        <UTable
          :columns="kolom"
          :data="list"
          :loading="status === 'pending'"
          class="hidden lg:block"
        >
          <template #talent-cell="{ row }">
            <ULink
              :to="`/event/talents/${row.original.id}`"
              class="flex items-center gap-2.5"
            >
              <UAvatar
                :text="inisial(row.original.name)"
                size="md"
              />
              <span>
                <b class="block text-highlighted">{{ row.original.name }}</b>
                <span
                  v-if="row.original.instagram"
                  class="block text-xs text-muted"
                >{{ row.original.instagram }}</span>
              </span>
            </ULink>
          </template>
          <template #kategori-cell="{ row }">
            <AppStatus
              :color="nadaKategori(String(row.original.category ?? ''), TAL_CATS)"
              :icon="'i-lucide-tag'"
              size="sm"
            >
              {{ row.original.category || '—' }}
            </AppStatus>
          </template>
          <template #kontak-cell="{ row }">
            <span class="block text-sm">{{ row.original.whatsapp || row.original.phone || '—' }}</span>
            <span class="block text-xs text-muted">{{ row.original.email || '' }}</span>
          </template>
          <template #manager-cell="{ row }">
            {{ row.original.manager_name || '—' }}
          </template>
          <template #fee-cell="{ row }">
            <span class="num">{{ rupiah(Number(row.original.default_fee) || 0) }}</span>
          </template>
          <template #kontrak-cell="{ row }">
            <AppStatus
              :color="KONTRAK_WARNA[String(row.original.contract_status ?? 'None')] ?? 'neutral'"
              icon="i-lucide-file-text"
              size="sm"
            >
              {{ KONTRAK_LABEL[String(row.original.contract_status ?? 'None')] ?? KONTRAK_LABEL.None }}
            </AppStatus>
          </template>
          <template #status-cell="{ row }">
            <AppStatus
              :color="TALENT_WARNA[String(row.original.status)] ?? 'neutral'"
              :icon="TALENT_IKON[String(row.original.status)]"
              size="sm"
            >
              {{ STATUS_LABEL[String(row.original.status)] ?? row.original.status }}
            </AppStatus>
          </template>
          <template #aksi-cell="{ row }">
            <span class="flex gap-1">
              <UButton
                v-if="bolehUbah"
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                @click="hapusId = row.original.id"
              />
            </span>
          </template>
        </UTable>
        <ul class="divide-y divide-default lg:hidden">
          <li
            v-for="t in list"
            :key="t.id"
          >
            <ULink
              :to="`/event/talents/${t.id}`"
              class="flex items-center gap-3 px-4 py-3"
            >
              <UAvatar
                :text="inisial(t.name)"
                size="md"
              />
              <span class="min-w-0 flex-1">
                <b class="block truncate text-sm text-highlighted">{{ t.name }}</b>
                <span class="block truncate text-xs text-muted">{{ t.category }} · {{ rupiah(Number(t.default_fee) || 0) }}</span>
              </span>
              <AppStatus
                :color="TALENT_WARNA[String(t.status)] ?? 'neutral'"
                :icon="TALENT_IKON[String(t.status)]"
                size="sm"
              >
                {{ STATUS_LABEL[String(t.status)] ?? t.status }}
              </AppStatus>
            </ULink>
          </li>
        </ul>
        <p
          v-if="!list.length && status !== 'pending'"
          class="px-4 py-6 text-center text-sm text-dimmed"
        >
          Tidak ada talent.
        </p>
      </AppPanel>

      <ResponsiveSheet
        v-model:open="sheet"
        :title="suntingId ? 'Edit talent' : 'Talent baru'"
      >
        <div class="grid gap-3 lg:grid-cols-2">
          <UFormField
            label="Nama"
            required
          >
            <UInput
              v-model="form.name"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Kategori">
            <USelect
              v-model="form.category"
              :items="TAL_CATS.map(c => ({ value: c, label: c }))"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Phone"
            required
          >
            <UInput
              v-model="form.phone"
              class="w-full"
            />
          </UFormField>
          <UFormField label="WhatsApp">
            <UInput
              v-model="form.whatsapp"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Instagram">
            <UInput
              v-model="form.instagram"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Email">
            <UInput
              v-model="form.email"
              type="email"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Manager">
            <UInput
              v-model="form.manager_name"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Default fee (IDR)">
            <UInput
              v-model.number="form.default_fee"
              type="number"
              min="0"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Bank">
            <UInput
              v-model="form.bank_name"
              class="w-full"
            />
          </UFormField>
          <UFormField label="No. rekening">
            <UInput
              v-model="form.bank_account"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Status kontrak">
            <USelect
              v-model="form.contract_status"
              :items="OPSI_KONTRAK"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Status talent">
            <USelect
              v-model="form.status"
              :items="OPSI_STATUS"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Notes"
            class="lg:col-span-2"
          >
            <UTextarea
              v-model="form.notes"
              class="w-full"
            />
          </UFormField>
        </div>
        <template #footer>
          <UButton
            color="primary"
            loading-auto
            @click="simpan()"
          >
            Simpan talent
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            @click="sheet = false"
          >
            Batal
          </UButton>
        </template>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="sheetHapus"
        title="Hapus talent?"
      >
        <p class="text-sm text-muted">
          Talent ini dihapus dari daftar. Jadwal yang sudah tersimpan tetap ada.
        </p>
        <template #footer>
          <UButton
            color="error"
            loading-auto
            @click="hapus()"
          >
            Ya, hapus
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            @click="hapusId = ''"
          >
            Batal
          </UButton>
        </template>
      </ResponsiveSheet>
    </AppPage>
  </EventGerbang>
</template>
