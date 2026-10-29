<!--
  Marketing › Request Design & Video (docs/migrasi/marketing.md D.13, issue
  #61): requests stay HERE and Konten reads them through its narrow
  endpoints — never copied over. Progress flows back the other way
  (done/picNama/at). Cancelling keeps the trace (batalAt), never deletes.
  G-16 (laksamana-api#190) opens the queue to `marketing|konten`; a failure
  shows a ribbon + retry and never blocks.
-->
<script setup lang="ts">
import type { KolomMkt, RequestDesainMkt } from '~/utils/marketing'
import type { KatDesainMkt, ProgDesainMkt } from '~/utils/marketing-vip'
import {
  DR_JENIS_MKT, DR_KAT_MKT, DR_PRIO_MKT, drDataMkt, drHitungKatMkt, drPrioLabelMkt, drProgMkt, drSisaMkt, drStatusMkt,
} from '~/utils/marketing-vip'
import {
  ambilRequestDesainMkt, buatMkt, mktSimpan, bacaOpsiDesainMkt, progresDesainMkt, tambalMkt,
  useAksesMkt, useStateMkt, useTabelMkt, type OpsiDesainMkt,
} from '~/composables/useMarketing'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['marketing'] })

const toast = useToast()
const { data: st } = useStateMkt()
const { can, saya } = useAksesMkt()
const bisaUbah = computed(() => can('edit_designreq'))
const hari = hariIni()

const prog = ref<ProgDesainMkt>({})
const progGalat = ref('')
const progMuat = ref(false)
async function segarkanProgres() {
  progMuat.value = true
  progGalat.value = ''
  try {
    const r = await progresDesainMkt()
    const p: ProgDesainMkt = {}
    for (const x of r.data?.reqs ?? []) {
      if (x?.id && x.status === 'done') p[x.id] = { status: 'done', picNama: x.pic ?? '', at: x.doneAt ?? '' }
    }
    prog.value = p
  }
  catch (e) {
    progGalat.value = `Kemajuan dari modul Konten tidak terbaca: ${apiErrorMessage(e)}`
  }
  finally {
    progMuat.value = false
  }
}

const opsi = ref<OpsiDesainMkt | null>(null)
async function muatOpsi() {
  opsi.value = await bacaOpsiDesainMkt()
}
watch([() => st.value.designreqs.length], () => {
  void segarkanProgres()
  void muatOpsi()
}, { immediate: true })

const hitung = computed(() => drHitungKatMkt(st.value.designreqs, prog.value))
const fJenis = useState('mkt-req-jenis', () => '__semua')
const fKat = useState<KatDesainMkt>('mkt-req-kat', () => 'open')
const fQ = useState('mkt-req-q', () => '')
const daftar = computed(() => drDataMkt(st.value.designreqs, prog.value, fJenis.value === '__semua' ? '' : fJenis.value, fKat.value, fQ.value))
const labelJenis = (j?: string) => DR_JENIS_MKT[(j ?? 'design') as keyof typeof DR_JENIS_MKT]?.t ?? j ?? ''
const labelPrio = (p?: string) => DR_PRIO_MKT.find(x => x[0] === p)?.[1] ?? 'Sedang'

// ---- form ----
const formBuka = ref(false)
const formAwal = ref<RequestDesainMkt | null>(null)
function baru() {
  formAwal.value = null
  formBuka.value = true
}
// ---- reference photos ----
// `/state` sends them as stubs (laksamana-api#341: three requests were 77% of
// it). The detail and the edit form fetch the full request once per id.
type RefMkt = NonNullable<RequestDesainMkt['refs']>[number]
const refsPenuh = ref<Record<string, RefMkt[]>>({})
const refsGalat = ref<Record<string, string>>({})
const adaStub = (r: RequestDesainMkt) => (r.refs ?? []).some(x => x.t === 'img' && !x.v)
async function muatRefs(id: string): Promise<boolean> {
  if (refsPenuh.value[id]) return true
  try {
    const res = await ambilRequestDesainMkt(id)
    refsPenuh.value = { ...refsPenuh.value, [id]: res.data?.req?.refs ?? [] }
    refsGalat.value = { ...refsGalat.value, [id]: '' }
    return true
  }
  catch (e) {
    refsGalat.value = { ...refsGalat.value, [id]: apiErrorMessage(e) }
    return false
  }
}

const formSiap = ref(false)
async function ubah(r: RequestDesainMkt) {
  // The form sends `refs` back whole. Opened with stubs it would save no photo
  // at all (the API restores them, but the form would also show them blank and
  // count them as zero MB), so the full request is read first — and the form
  // stays shut when that fails, rather than opening on missing photos.
  if (adaStub(r)) {
    formSiap.value = true
    const ok = await muatRefs(r.id)
    formSiap.value = false
    if (!ok) {
      toast.add({ title: 'Foto referensi belum termuat', description: `${refsGalat.value[r.id]} — coba lagi sebelum mengubah request ini.`, color: 'error' })
      return
    }
  }
  formAwal.value = { ...r, refs: refsPenuh.value[r.id] ?? r.refs }
  formBuka.value = true
  lihatId.value = null
}
async function simpanForm(v: RequestDesainMkt) {
  const lama = st.value.designreqs.find(x => x.id === v.id)
  if (lama) {
    const ok = await mktSimpan(
      () => tambalMkt<RequestDesainMkt>('design-requests', lama.id, v, lama.updatedAt),
      'Request diperbarui', { refType: 'event', refId: '-', action: `Request ${labelJenis(v.jenis)} diubah`, detail: v.judul ?? '' },
    )
    if (ok) {
      formBuka.value = false
      // The cached photos are the pre-edit list now.
      refsPenuh.value = Object.fromEntries(Object.entries(refsPenuh.value).filter(([k]) => k !== lama.id))
    }
  }
  else {
    const baris: RequestDesainMkt = {
      ...v, id: `dr${Date.now().toString(36)}`, by: saya.value?.user.id ?? '',
      byNama: saya.value?.user.name ?? '', at: new Date().toISOString().slice(0, 16), batalAt: '', // UTC on purpose: the old Office's stored stamp format (`followups.at`, index.html:6660), not a date
    }
    const ok = await mktSimpan(
      () => buatMkt<RequestDesainMkt>('design-requests', baris),
      'Request terkirim', { refType: 'event', refId: '-', action: `Request ${labelJenis(v.jenis)} diajukan`, detail: v.judul ?? '' },
    )
    if (ok) {
      formBuka.value = false
      toast.add({ title: `Masuk ke ${DR_JENIS_MKT[(v.jenis ?? 'design') as keyof typeof DR_JENIS_MKT]?.q ?? 'antrian'} modul Konten`, color: 'success' })
    }
  }
}

// ---- detail + batalkan ----
const lihatId = ref<string | null>(null)
const lihat = computed(() => st.value.designreqs.find(r => r.id === lihatId.value) ?? null)
const progLihat = computed(() => (lihat.value ? drProgMkt(prog.value, lihat.value.id) : null))
const refsLihat = computed<RefMkt[]>(() => (lihat.value ? (refsPenuh.value[lihat.value.id] ?? lihat.value.refs ?? []) : []))
watch(lihat, (r) => {
  if (r && adaStub(r)) void muatRefs(r.id)
})
async function batalkan() {
  const r = lihat.value
  if (!r || r.batalAt) return
  if (!confirm(`Batalkan request ${r.judul ?? ''}? Ia hilang dari antrian modul Konten. Riwayatnya tetap tersimpan di daftar ini.`)) return
  const ok = await mktSimpan(
    () => tambalMkt<RequestDesainMkt>('design-requests', r.id, { batalAt: new Date().toISOString().slice(0, 16) /* UTC on purpose: stored stamp format, as `at` */ }, r.updatedAt),
    'Request dibatalkan', { refType: 'event', refId: '-', action: `Request ${labelJenis(r.jenis)} dibatalkan`, detail: r.judul ?? '' },
  )
  if (ok) lihatId.value = null
}

// ---- table ----
const KOL: KolomMkt<RequestDesainMkt>[] = [
  { k: 'judul', t: 'Permintaan', v: r => r.judul ?? '', def: true },
  { k: 'jenis', t: 'Jenis', v: r => labelJenis(r.jenis) },
  { k: 'brand', t: 'Brand', v: r => r.brandNama ?? '' },
  { k: 'acara', t: 'Untuk Acara', v: r => r.acara ?? '' },
  { k: 'dl', t: 'Deadline', v: r => r.deadline ?? '' },
  { k: 'prio', t: 'Prioritas', v: r => drPrioLabelMkt(r.prioritas) },
  { k: 'pic', t: 'PIC Diminta', v: r => r.picNama ?? '' },
  { k: 'status', t: 'Status', v: r => drStatusMkt(r, prog.value) },
]
const tbl = useTabelMkt<RequestDesainMkt>('designreq', KOL, () => `${fJenis.value}${fKat.value}${fQ.value}${st.value.designreqs.length}`)
const hal = computed(() => tbl.potong(tbl.susun(daftar.value)))
// Chrome blocks top-level navigation to data: URLs (since v60): window.open on
// a base64 photo opened nothing at all. A blob: URL opens; revoked a minute
// later, not at once — the new tab is still loading it.
function bukaRef(v: string) {
  if (!v.startsWith('data:')) {
    window.open(v, '_blank', 'noopener')
    return
  }
  try {
    const [kepala, isi = ''] = v.split(',', 2)
    const mime = /data:([^;]+)/.exec(kepala ?? '')?.[1] ?? 'application/octet-stream'
    const bin = atob(isi)
    const buf = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
    const url = URL.createObjectURL(new Blob([buf], { type: mime }))
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  catch {
    toast.add({ title: 'Foto tidak bisa dibuka', color: 'error' })
  }
}
const warnaStatus = (r: RequestDesainMkt) => {
  const s = drStatusMkt(r, prog.value)
  return s === 'Selesai' ? 'success' as const : s === 'Dibatalkan' ? 'neutral' as const : 'warning' as const
}
</script>

<template>
  <AppPage
    title="Request Design & Video"
    description="Ajukan kebutuhan desain atau video. Permintaannya langsung muncul sebagai to-do di Design Queue / Editing Queue modul Konten."
  >
    <template #actions>
      <UButton
        v-if="bisaUbah"
        icon="i-lucide-plus"
        label="Request Baru"
        @click="baru"
      />
    </template>
    <MarketingGerbang layar="designreq">
      <AppStatGrid>
        <AppStat
          label="Menunggu dikerjakan"
          :value="String(hitung.open)"
          sub="Ada di antrian modul Konten"
          tone="warning"
          icon="i-lucide-list-checks"
        />
        <AppStat
          label="Permintaan desain"
          :value="String(st.designreqs.filter(r => r.jenis === 'design' && !r.batalAt).length)"
          sub="Masuk Design Queue"
          tone="info"
          icon="i-lucide-palette"
        />
        <AppStat
          label="Permintaan video"
          :value="String(st.designreqs.filter(r => r.jenis === 'edit' && !r.batalAt).length)"
          sub="Masuk Editing Queue"
          tone="info"
          icon="i-lucide-clapperboard"
        />
      </AppStatGrid>

      <UAlert
        v-if="progGalat"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :description="progGalat"
        class="mb-4"
      >
        <template #actions>
          <UButton
            size="xs"
            color="neutral"
            variant="outline"
            label="Coba lagi"
            :loading="progMuat"
            @click="segarkanProgres"
          />
        </template>
      </UAlert>

      <AppPanel flush>
        <template #head>
          <div class="grid w-full gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <USelect
                v-model="fJenis"
                :items="[{ value: '__semua', label: 'Semua jenis' }, { value: 'design', label: 'Desain' }, { value: 'edit', label: 'Video / Editing' }]"
                value-key="value"
                label-key="label"
                class="w-44"
              />
              <AppSeg
                v-model="fKat"
                :options="DR_KAT_MKT.map(x => ({ value: x[0] as KatDesainMkt, label: `${x[1]} (${hitung[x[0] as keyof typeof hitung]})` }))"
              />
            </div>
            <UInput
              v-model="fQ"
              placeholder="Cari permintaan / acara…"
              icon="i-lucide-search"
            />
          </div>
        </template>
        <div
          v-if="!daftar.length"
          class="p-8 text-center text-sm text-muted"
        >
          <b class="block text-base text-highlighted">Tidak ada request di sini</b>
        </div>
        <template v-else>
          <UTable
            :data="hal"
            :columns="[
              { id: 'judul', header: tbl.kepala('judul', 'Permintaan') },
              { id: 'jenis', header: tbl.kepala('jenis', 'Jenis') },
              { id: 'brand', header: tbl.kepala('brand', 'Brand') },
              { id: 'acara', header: tbl.kepala('acara', 'Untuk Acara') },
              { id: 'dl', header: tbl.kepala('dl', 'Deadline') },
              { id: 'prio', header: tbl.kepala('prio', 'Prioritas') },
              { id: 'pic', header: tbl.kepala('pic', 'PIC Diminta') },
              { id: 'status', header: tbl.kepala('status', 'Status') },
              { id: 'aksi', header: 'Aksi' },
            ]"
            class="hidden lg:block"
            :ui="{ tr: 'cursor-pointer' }"
            @select="(_e: Event, r: { original: RequestDesainMkt }) => { lihatId = r.original.id }"
          >
            <template #judul-cell="{ row }">
              <p class="font-semibold text-highlighted">
                {{ row.original.judul }}
              </p>
              <p class="max-w-64 truncate text-xs text-muted">
                {{ row.original.brief }}
              </p>
            </template>
            <template #jenis-cell="{ row }">
              <p>{{ labelJenis(row.original.jenis) }}</p>
              <p
                v-if="(row.original.platforms ?? []).length"
                class="text-xs text-muted"
              >
                {{ (row.original.platforms ?? []).join(' · ') }}
              </p>
              <p
                v-if="(row.original.refs ?? []).length"
                class="text-xs text-muted"
              >
                {{ (row.original.refs ?? []).length }} referensi
              </p>
            </template>
            <template #brand-cell="{ row }">
              {{ row.original.brandNama || '—' }}
            </template>
            <template #acara-cell="{ row }">
              {{ row.original.acara || '—' }}
            </template>
            <template #dl-cell="{ row }">
              <span class="num">{{ row.original.deadline || '—' }}</span>
              <p
                v-if="drSisaMkt(row.original, prog, hari)"
                class="text-xs"
                :class="drSisaMkt(row.original, prog, hari).startsWith('lewat') ? 'text-error' : 'text-muted'"
              >
                {{ drSisaMkt(row.original, prog, hari) }}
              </p>
            </template>
            <template #prio-cell="{ row }">
              {{ drPrioLabelMkt(row.original.prioritas) }}
            </template>
            <template #pic-cell="{ row }">
              <p>{{ row.original.picNama || '—' }}</p>
              <p class="text-xs text-muted">
                diajukan {{ row.original.byNama || '—' }}
              </p>
            </template>
            <template #status-cell="{ row }">
              <AppStatus
                :color="warnaStatus(row.original)"
                :icon="warnaStatus(row.original) === 'success' ? 'i-lucide-check' : warnaStatus(row.original) === 'warning' ? 'i-lucide-hourglass' : 'i-lucide-ban'"
                size="sm"
              >
                {{ drStatusMkt(row.original, prog) }}
              </AppStatus>
            </template>
            <template #aksi-cell="{ row }">
              <div
                class="flex gap-1"
                @click.stop
              >
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  label="Lihat"
                  @click="lihatId = row.original.id"
                />
                <UButton
                  v-if="bisaUbah && !row.original.batalAt"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  label="Ubah"
                  @click="ubah(row.original)"
                />
              </div>
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="r in hal"
              :key="r.id"
              class="p-4"
            >
              <button
                type="button"
                class="block w-full text-start"
                @click="lihatId = r.id"
              >
                <b class="text-highlighted">{{ r.judul }}</b>
                <span class="block text-xs text-muted">{{ labelJenis(r.jenis) }} · {{ r.brandNama }} · {{ r.acara }}</span>
                <span class="mt-1">
                  <AppStatus
                    :color="warnaStatus(r)"
                    size="sm"
                  >
                    {{ drStatusMkt(r, prog) }}
                  </AppStatus>
                </span>
              </button>
            </li>
          </ul>
          <MarketingPager
            v-model="tbl.hal.value"
            :total="daftar.length"
          />
        </template>
      </AppPanel>

      <ResponsiveSheet
        v-model:open="formBuka"
        :title="formAwal ? 'Edit Request' : 'Request Design & Video'"
        description="Permintaan ini muncul sebagai to-do di modul Konten."
      >
        <MarketingReqForm
          :key="formAwal?.id ?? 'baru'"
          :awal="formAwal"
          :events="st.events"
          :opsi="opsi"
          @simpan="simpanForm"
        />
      </ResponsiveSheet>

      <ResponsiveSheet
        :open="!!lihat"
        :title="lihat?.judul ?? ''"
        :description="lihat ? `${labelJenis(lihat.jenis)} · ${DR_JENIS_MKT[(lihat.jenis ?? 'design') as keyof typeof DR_JENIS_MKT]?.q ?? 'antrian'} modul Konten` : ''"
        @update:open="lihatId = $event ? lihatId : null"
      >
        <dl
          v-if="lihat"
          class="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-sm"
        >
          <dt class="text-muted">
            Status
          </dt>
          <dd>{{ drStatusMkt(lihat, prog) }}{{ progLihat?.picNama ? ` · ${progLihat.picNama}` : '' }}</dd>
          <dt class="text-muted">
            Brand
          </dt>
          <dd>{{ lihat.brandNama || '—' }}</dd>
          <dt class="text-muted">
            Platform
          </dt>
          <dd>{{ (lihat.platforms ?? []).join(', ') || '—' }}</dd>
          <dt class="text-muted">
            PIC diminta
          </dt>
          <dd>{{ lihat.picNama || '— belum ditentukan —' }}</dd>
          <dt class="text-muted">
            Untuk acara
          </dt>
          <dd>{{ lihat.acara || '—' }}</dd>
          <dt class="text-muted">
            Deadline
          </dt>
          <dd>{{ lihat.deadline || '—' }}</dd>
          <dt class="text-muted">
            Prioritas
          </dt>
          <dd>{{ labelPrio(lihat.prioritas) }}</dd>
          <dt class="text-muted">
            Diajukan
          </dt>
          <dd>{{ lihat.byNama || '—' }}{{ lihat.at ? ` · ${lihat.at}` : '' }}</dd>
        </dl>
        <div
          v-if="lihat?.brief"
          class="mt-3"
        >
          <p class="mb-1 text-sm font-semibold">
            Brief
          </p>
          <p class="whitespace-pre-wrap rounded-xl border border-default p-2.5 text-sm">
            {{ lihat.brief }}
          </p>
        </div>
        <div
          v-if="refsLihat.length"
          class="mt-3"
        >
          <p class="mb-1 text-sm font-semibold">
            Referensi
          </p>
          <div class="flex flex-wrap gap-2">
            <template
              v-for="(r, i) in refsLihat"
              :key="i"
            >
              <div
                v-if="r.t === 'img' && !r.v"
                class="flex size-20 items-center justify-center rounded border border-default p-1 text-center text-xs text-muted"
                :title="r.n ?? ''"
              >
                {{ lihat && refsGalat[lihat.id] ? 'Foto tidak termuat' : 'Memuat foto…' }}
              </div>
              <img
                v-else-if="r.t === 'img'"
                :src="r.v"
                :alt="r.n ?? ''"
                class="size-20 cursor-zoom-in rounded object-cover"
                @click="bukaRef(r.v)"
              >
              <a
                v-else
                :href="r.v"
                target="_blank"
                rel="noopener"
                class="flex items-center gap-1 text-sm text-info underline"
              ><UIcon
                name="i-lucide-link"
                class="size-4"
              />{{ r.n || r.v }}</a>
            </template>
          </div>
        </div>
        <div
          v-if="lihat && bisaUbah && !lihat.batalAt"
          class="mt-4 flex flex-wrap gap-2"
        >
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="outline"
            size="sm"
            label="Ubah"
            :loading="formSiap"
            @click="ubah(lihat)"
          />
          <UButton
            icon="i-lucide-ban"
            color="error"
            variant="outline"
            size="sm"
            label="Batalkan"
            @click="batalkan"
          />
        </div>
      </ResponsiveSheet>
    </MarketingGerbang>
  </AppPage>
</template>
