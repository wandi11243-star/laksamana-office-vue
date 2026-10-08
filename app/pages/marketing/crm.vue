<!--
  Marketing › Database Client (old renderCRM + export/import, deploy/marketing/index.html:5543-5948;
  marketing.md D.2). Search (nama, perusahaan, hp, email, ig), the relation
  filter and the Source filter (SOURCES + any typed source in use). Columns
  KOL_CRM; a star marks a VIP client (spending on finished events above Rp20 juta).

  Export follows the CURRENT filter, as before. Import reads the file into a
  preview first — nothing changes until "Terapkan"; rows match by ID, then
  phone, then name. Each change is its own versioned write; a refusal stops the
  run and the screen reloads what was stored.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ClientMkt, KolomMkt, RencanaImporMkt } from '~/utils/marketing'
import {
  BATAS_VIP_MKT, KOLOM_CSV_CLIENT, OPSI_RELASI_MKT, SOURCE_CLIENT_MKT, TAHAP_TERBUKA_MKT, bacaCsvMkt, csvTeksMkt,
  eventsClientMkt, menangClientMkt, peluangClientMkt, rencanaImporClient, saringClientMkt, selesaiClientMkt, tglMkt,
} from '~/utils/marketing'
import { belanjaClientMkt } from '~/utils/marketing-uang'
import { ikonStatusMkt, warnaStatusMkt } from '~/utils/status-marketing'
import { hariIni, rupiah } from '~/utils/format'
import { unduhCsv } from '~/utils/riwayat'

definePageMeta({ access: ['marketing'] })

const toast = useToast()
const { data: st, error } = useStateMkt()
const { saya, can } = useAksesMkt()

const SEMUA = '__semua'
const f = useState('mkt-crm-filter', () => ({ q: '', rel: '', source: '' }))
const fRel = computed({ get: () => f.value.rel || SEMUA, set: (v: string) => {
  f.value.rel = v === SEMUA ? '' : v
} })
const fSource = computed({ get: () => f.value.source || SEMUA, set: (v: string) => {
  f.value.source = v === SEMUA ? '' : v
} })
const opsiRel = [{ value: SEMUA, label: 'Semua Client' }, ...OPSI_RELASI_MKT]
const opsiSource = computed(() => [
  { value: SEMUA, label: 'Semua Source' },
  ...[...new Set([...SOURCE_CLIENT_MKT, ...st.value.clients.map(c => c.source).filter((s): s is string => !!s)])].map(s => ({ value: s, label: s })),
])

const belanja = (id: string) => belanjaClientMkt(st.value.events, st.value.settings, id)
const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? '—'
const tags = (id: string) => ({
  open: peluangClientMkt(st.value.events, id),
  repeat: selesaiClientMkt(st.value.events, id).length > 1,
  deal: menangClientMkt(st.value.events, id).length > 0,
})

const KOL: KolomMkt<ClientMkt>[] = [
  { k: 'nama', t: 'Client', v: c => c.nama, def: true },
  { k: 'kontak', t: 'Kontak', v: c => c.hp },
  { k: 'source', t: 'Source', v: c => c.source },
  { k: 'pic', t: 'Marketing PIC', v: c => namaUser(c.mktPIC) },
  { k: 'peluang', t: 'Peluang', v: c => peluangClientMkt(st.value.events, c.id).length, turun: true },
  { k: 'spend', t: 'Total Spending', v: c => belanja(c.id), turun: true },
  { k: 'fu', t: 'Next FU', v: c => c.nextFU },
]
const tbl = useTabelMkt('crm', KOL, () => `${f.value.q}|${f.value.rel}|${f.value.source}`)
const data = computed(() => saringClientMkt(st.value.clients, st.value.events, f.value))
const urut = computed(() => tbl.susun(data.value))
const hal = computed(() => tbl.potong(urut.value))
const kolom: TableColumn<ClientMkt>[] = [
  ...KOL.map(k => ({ id: k.k, header: tbl.kepala(k.k, k.t) })),
  { id: 'buka', header: '' },
]

// ---- sheets ----
const detailId = ref<string | null>(null)
const detailBuka = ref(false)
const formBuka = ref(false)
const formClient = ref<ClientMkt | null>(null)
const fuBuka = ref(false)
const fuClient = ref<string | null>(null)
function lihat(c: ClientMkt) {
  detailId.value = c.id
  detailBuka.value = true
}
function baru() {
  formClient.value = null
  formBuka.value = true
}
function edit(c: ClientMkt) {
  formClient.value = c
  formBuka.value = true
}
function followUp(id: string) {
  fuClient.value = id
  fuBuka.value = true
}

// ---- export ----
function ekspor() {
  const rows = data.value
  if (!rows.length) return toast.add({ title: 'Tidak ada yang diekspor', description: 'Saringan saat ini tidak memulangkan satu client pun. Longgarkan dulu saringannya.', color: 'error' })
  const baris: unknown[][] = [KOLOM_CSV_CLIENT.map(k => k.k)]
  for (const c of rows) {
    baris.push(KOLOM_CSV_CLIENT.map((kol) => {
      if (kol.k === 'Marketing PIC') return c.mktPIC ? namaUser(c.mktPIC) : ''
      if (kol.k === 'Jumlah Event') return eventsClientMkt(st.value.events, c.id).length
      if (kol.k === 'Peluang Aktif') return peluangClientMkt(st.value.events, c.id).length
      if (kol.k === 'Total Spending') return belanja(c.id)
      return kol.b ? (c[kol.b] ?? '') : ''
    }))
  }
  unduhCsv(`database_client_${hariIni()}.csv`, csvTeksMkt(baris))
  logMkt('client', '-', 'Database Client diekspor', `${rows.length} baris · oleh ${saya.value?.user.name ?? ''}`).catch(() => {})
  toast.add({ title: 'Export selesai', description: `${rows.length} client diunduh. Buka langsung di Excel, sunting, lalu Import Excel untuk mengembalikannya.`, color: 'success' })
}

// ---- import ----
const berkas = ref<HTMLInputElement | null>(null)
const rencana = ref<(RencanaImporMkt & { berkas: string }) | null>(null)
const imporBuka = ref(false)
const sibuk = ref(false)
function pilihBerkas() {
  if (!can('edit_client')) return toast.add({ title: 'Akses ditolak', description: 'Kamu tidak punya izin mengubah data client.', color: 'error' })
  berkas.value?.click()
}
function bacaBerkas(ev: Event) {
  const inp = ev.target as HTMLInputElement
  const file = inp.files?.[0]
  inp.value = ''
  if (!file) return
  const fr = new FileReader()
  fr.onerror = () => toast.add({ title: 'Gagal membaca berkas', description: 'Berkasnya tidak bisa dibuka. Dari Excel: Save As → CSV UTF-8.', color: 'error' })
  fr.onload = () => {
    const r = rencanaImporClient(bacaCsvMkt(String(fr.result ?? '')), st.value.clients, st.value.users, saya.value?.user.id ?? '')
    if ('judul' in r) return toast.add({ title: r.judul, description: r.pesan, color: 'error' })
    rencana.value = { ...r, berkas: file.name }
    imporBuka.value = true
  }
  fr.readAsText(file, 'utf-8')
}
const labelKolom = (b: string) => KOLOM_CSV_CLIENT.find(k => k.b === b)?.k ?? b
async function terapkan() {
  const R = rencana.value
  if (!R || !can('edit_client')) return
  const hari = hariIni()
  sibuk.value = true
  const ok = await mktSimpan(async () => {
    for (const x of R.ubah) await tambalMkt<ClientMkt>('clients', x.c.id, { ...x.nilai, lastContact: hari }, x.c.updatedAt)
    for (const x of R.baru) await buatMkt<ClientMkt>('clients', { ...x.c, createdAt: hari, lastContact: hari })
  }, `${R.baru.length} client baru, ${R.ubah.length} diperbarui.`, {
    refType: 'client', action: 'Impor Database Client dari Excel',
    detail: `${R.baru.length} baru · ${R.ubah.length} diperbarui · ${R.lewat.length} dilewati · berkas ${R.berkas || '-'} · oleh ${saya.value?.user.name ?? ''}`,
  })
  sibuk.value = false
  if (!ok) return
  imporBuka.value = false
  rencana.value = null
}
</script>

<template>
  <AppPage
    title="Database Client"
    description="Semua klien dalam satu tempat — riwayat komunikasi & event tersimpan permanen."
  >
    <template #actions>
      <UButton
        label="Export Excel"
        icon="i-lucide-download"
        color="neutral"
        variant="outline"
        @click="ekspor"
      />
      <UButton
        v-if="can('edit_client')"
        label="Import Excel"
        icon="i-lucide-upload"
        color="neutral"
        variant="outline"
        @click="pilihBerkas"
      />
      <UButton
        v-if="can('edit_client')"
        label="Client Baru"
        icon="i-lucide-plus"
        @click="baru"
      />
    </template>
    <input
      ref="berkas"
      type="file"
      accept=".csv,.txt,text/csv"
      class="hidden"
      @change="bacaBerkas"
    >

    <MarketingGerbang layar="crm">
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Marketing: ${apiErrorMessage(error)}`"
        class="mb-5"
      />

      <AppPanel>
        <div class="flex flex-wrap items-center gap-3">
          <UInput
            v-model="f.q"
            icon="i-lucide-search"
            placeholder="Cari nama, perusahaan, kontak..."
            class="w-full sm:w-72"
          />
          <USelect
            v-model="fRel"
            :items="opsiRel"
            class="w-full sm:w-60"
            aria-label="Relasi"
          />
          <USelect
            v-model="fSource"
            :items="opsiSource"
            class="w-full sm:w-48"
            aria-label="Source"
          />
        </div>
      </AppPanel>

      <AppPanel flush>
        <p
          v-if="!data.length"
          class="p-8 text-center text-sm text-muted"
        >
          <b class="block text-base text-highlighted">Tidak ada client</b>
          Ubah filter atau tambah client baru.
        </p>
        <template v-else>
          <UTable
            :data="hal"
            :columns="kolom"
            class="hidden lg:block"
            :ui="{ tr: 'cursor-pointer' }"
            @select="(_e: Event, r: { original: ClientMkt }) => lihat(r.original)"
          >
            <template #nama-cell="{ row }">
              <p class="flex items-center gap-1 font-semibold text-highlighted">
                {{ row.original.nama }}
                <UIcon
                  v-if="belanja(row.original.id) > BATAS_VIP_MKT"
                  name="i-lucide-star"
                  class="size-3.5 text-primary-500"
                  title="Klien VIP — total belanja di atas Rp20 juta"
                />
              </p>
              <p class="text-xs text-muted">
                {{ row.original.perusahaan || 'Perorangan' }}
              </p>
            </template>
            <template #kontak-cell="{ row }">
              <p class="text-xs">
                {{ row.original.hp }}
              </p>
              <p class="text-xs text-muted">
                {{ row.original.email || row.original.ig || '' }}
              </p>
            </template>
            <template #source-cell="{ row }">
              <UBadge
                v-if="row.original.source"
                :label="row.original.source"
                color="neutral"
                variant="soft"
              />
            </template>
            <template #pic-cell="{ row }">
              {{ namaUser(row.original.mktPIC) }}
            </template>
            <template #peluang-cell="{ row }">
              <div class="flex flex-wrap gap-1">
                <AppStatus
                  v-for="e in tags(row.original.id).open.slice(0, 3)"
                  :key="e.id"
                  :color="warnaStatusMkt(e.status)"
                  :icon="ikonStatusMkt(e.status)"
                  size="sm"
                >
                  {{ e.status }}
                </AppStatus>
                <UBadge
                  v-if="tags(row.original.id).open.length > 3"
                  :label="`+${tags(row.original.id).open.length - 3}`"
                  color="neutral"
                  variant="soft"
                />
                <AppStatus
                  v-if="tags(row.original.id).repeat"
                  color="gold"
                  icon="i-lucide-repeat"
                  size="sm"
                >
                  Repeat
                </AppStatus>
                <AppStatus
                  v-else-if="tags(row.original.id).deal"
                  color="success"
                  icon="i-lucide-handshake"
                  size="sm"
                >
                  Pernah deal
                </AppStatus>
                <span
                  v-if="!tags(row.original.id).open.length && !tags(row.original.id).deal"
                  class="text-muted"
                >—</span>
              </div>
            </template>
            <template #spend-cell="{ row }">
              <span class="num">{{ belanja(row.original.id) ? rupiah(belanja(row.original.id)) : '—' }}</span>
            </template>
            <template #fu-cell="{ row }">
              <span class="num">{{ row.original.nextFU ? tglMkt(row.original.nextFU) : '—' }}</span>
            </template>
            <template #buka-cell>
              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 text-muted"
              />
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="c in hal"
              :key="c.id"
            >
              <button
                type="button"
                class="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-muted"
                @click="lihat(c)"
              >
                <span class="min-w-0">
                  <span class="flex items-center gap-1 font-semibold text-highlighted">
                    {{ c.nama }}
                    <UIcon
                      v-if="belanja(c.id) > BATAS_VIP_MKT"
                      name="i-lucide-star"
                      class="size-3.5 text-primary-500"
                    />
                  </span>
                  <span class="block text-xs text-muted">{{ c.perusahaan || 'Perorangan' }} · {{ c.hp }}</span>
                  <span class="block text-xs text-muted">{{ [c.source, namaUser(c.mktPIC)].filter(Boolean).join(' · ') }}</span>
                  <span class="mt-1 flex flex-wrap gap-1">
                    <AppStatus
                      v-for="e in tags(c.id).open.slice(0, 3)"
                      :key="e.id"
                      :color="warnaStatusMkt(e.status)"
                      :icon="ikonStatusMkt(e.status)"
                      size="sm"
                    >{{ e.status }}</AppStatus>
                  </span>
                </span>
                <span class="shrink-0 text-right text-xs">
                  <span class="num block font-semibold">{{ belanja(c.id) ? rupiah(belanja(c.id)) : '—' }}</span>
                  <span
                    v-if="c.nextFU"
                    class="block text-muted"
                  >FU {{ tglMkt(c.nextFU) }}</span>
                </span>
              </button>
            </li>
          </ul>
          <MarketingPager
            v-model="tbl.hal.value"
            :total="data.length"
          />
        </template>
      </AppPanel>
      <p class="flex gap-2 px-1 text-xs text-muted">
        <UIcon
          name="i-lucide-info"
          class="mt-0.5 size-4 shrink-0"
        />
        <span>
          <em>Peluang aktif</em> = event yang tahapnya masih {{ TAHAP_TERBUKA_MKT.join(' / ') }}. Event <em>Deal</em>, <em>Event Done</em>,
          dan <em>Lost</em> tidak dihitung sebagai peluang. Ikon bintang = <em>klien VIP</em> — total belanjanya di atas Rp20 juta.
        </span>
      </p>
    </MarketingGerbang>

    <MarketingClientDetail
      v-model:open="detailBuka"
      :client-id="detailId"
      @edit="edit"
      @follow-up="followUp"
    />
    <MarketingClientForm
      v-model:open="formBuka"
      :client="formClient"
    />
    <MarketingFollowUp
      v-model:open="fuBuka"
      :client-id="fuClient"
    />

    <ResponsiveSheet
      v-model:open="imporBuka"
      title="Import Database Client"
      description="Periksa dulu sebelum diterapkan"
    >
      <template v-if="rencana">
        <UAlert
          color="neutral"
          variant="subtle"
          icon="i-lucide-info"
          :title="`Berkas ${rencana.berkas}`"
          description="Perubahan di bawah belum disimpan — tidak ada yang berubah sampai tombol Terapkan ditekan, dan sesudah itu tidak bisa dibatalkan."
        />
        <div class="my-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p class="text-xs text-muted">
              Client baru
            </p>
            <b class="num text-xl text-success">{{ rencana.baru.length }}</b>
          </div>
          <div>
            <p class="text-xs text-muted">
              Diperbarui
            </p>
            <b class="num text-xl text-primary-700">{{ rencana.ubah.length }}</b>
          </div>
          <div>
            <p class="text-xs text-muted">
              Tidak berubah
            </p>
            <b class="num text-xl">{{ rencana.sama.length }}</b>
          </div>
          <div>
            <p class="text-xs text-muted">
              Dilewati
            </p>
            <b
              class="num text-xl"
              :class="rencana.lewat.length ? 'text-error' : ''"
            >{{ rencana.lewat.length }}</b>
          </div>
        </div>
        <div
          v-if="rencana.ubah.length"
          class="mb-4"
        >
          <p class="mb-1 text-sm font-semibold">
            Yang diperbarui (10 pertama)
          </p>
          <ul class="divide-y divide-default text-sm">
            <li
              v-for="x in rencana.ubah.slice(0, 10)"
              :key="x.c.id"
              class="py-1.5"
            >
              <b>{{ x.c.nama }}</b>
              <span class="block text-xs text-muted">{{ x.beda.map(labelKolom).join(', ') }}</span>
            </li>
          </ul>
          <p
            v-if="rencana.ubah.length > 10"
            class="text-xs text-muted"
          >
            …dan {{ rencana.ubah.length - 10 }} client lagi.
          </p>
        </div>
        <div
          v-if="rencana.baru.length"
          class="mb-4"
        >
          <p class="mb-1 text-sm font-semibold">
            Client baru (10 pertama)
          </p>
          <div class="flex flex-wrap gap-1">
            <UBadge
              v-for="x in rencana.baru.slice(0, 10)"
              :key="x.n"
              :label="x.c.nama"
              color="neutral"
              variant="soft"
            />
            <span
              v-if="rencana.baru.length > 10"
              class="text-xs text-muted"
            >+{{ rencana.baru.length - 10 }} lagi</span>
          </div>
        </div>
        <UAlert
          v-if="rencana.lewat.length"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`${rencana.lewat.length} baris dilewati.`"
          :description="rencana.lewat.slice(0, 6).map(x => `baris ${x.n} (${x.sebab})`).join(' · ') + (rencana.lewat.length > 6 ? ' …' : '')"
          class="mb-3"
        />
        <UAlert
          v-if="rencana.ingat.length"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="rencana.ingat.slice(0, 6).join('\n') + (rencana.ingat.length > 6 ? `\n…dan ${rencana.ingat.length - 6} lagi.` : '')"
          :ui="{ description: 'whitespace-pre-line' }"
        />
      </template>
      <template #footer>
        <UButton
          :label="`Terapkan ${rencana ? rencana.baru.length + rencana.ubah.length : 0} perubahan`"
          icon="i-lucide-check"
          :disabled="!rencana || !(rencana.baru.length + rencana.ubah.length)"
          :loading="sibuk"
          @click="terapkan"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="imporBuka = false; rencana = null"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
