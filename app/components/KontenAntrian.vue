<!--
  One production queue — Shooting Schedule, Design Queue or Editing Queue
  (old prodQueue + renderQueueTable, deploy/konten/index.html:2924-3320;
  konten.md D.5–D.7, D.23b, F.3, F.21–F.22).

  Rows: production needs of content (`c.prod[kind]`), standalone tasks
  (`prod-tasks`), and — Design & Editing only — Marketing's design/video
  requests, READ from the Marketing module, never copied. A Marketing row is
  read-only except "✓ Tandai Selesai". G-16 (laksamana-api#190) opens these
  queue reads/writes to `marketing|konten`, so a Konten-only crew member can
  finish them; if the API cannot be reached the queue still works: a warning
  says what is missing, with "Coba lagi".

  Default filter hides the archive (status `todo`); the total and the archived
  count stay visible so nobody thinks work vanished. Reset returns to that.
  After the first successful read of Marketing, our brands/crew/platforms are
  lent to Marketing's request form once per session (T-07).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BarisAntrian, FilterAntrian, KontenItem, ProdKind, ProdTask, ReqDesainMkt } from '~/utils/konten'
import { PRIORITY_KONTEN, PROD_TYPES, barisAntrian, filterAntrianBawaan, reqMktUntuk, saringAntrian } from '~/utils/konten'
import { warnaPrioKonten } from '~/utils/status-konten'
import { fTgl } from '~/utils/format'
import { UButton } from '#components'

const props = defineProps<{ kind: ProdKind }>()

const router = useRouter()
const toast = useToast()
const { data: st } = useStateKonten()
const { saya, can } = useAksesKonten()
const brand = useBrandKonten()
const p = computed(() => PROD_TYPES[props.kind])
const pakaiMkt = computed(() => props.kind === 'design' || props.kind === 'edit')

// ---- Marketing requests (design / edit only) ----
// The kind of a page never changes, so the read is set up only where it is shown.
const mkt = props.kind === 'shoot' ? null : useReqDesainMkt()
const reqs = computed(() => mkt?.data.value ?? [])
const reqErr = computed(() => mkt?.error.value ?? null)
const reqStatus = computed(() => mkt?.status.value ?? 'idle')
const reqUlang = () => mkt?.refresh()
const disembunyikan = ref(new Set<string>())
// Waits for BOTH reads: with the Konten state not in yet there is nothing to
// lend, and the old client likewise did not mark it sent (kirimOpsiMkt :3033).
watch([reqStatus, () => st.value.users.length + st.value.brands.length], ([s, n]) => {
  if (s === 'success' && n && pakaiMkt.value) kirimOpsiDesainMkt(st.value)
}, { immediate: true })
const mktRows = computed(() => (pakaiMkt.value && !reqErr.value
  ? reqMktUntuk(props.kind, reqs.value.filter(r => !disembunyikan.value.has(r.id)), st.value.brands, st.value.users)
  : []))

// ---- rows ----
const f = useState<FilterAntrian>(`konten-antrian-${props.kind}`, filterAntrianBawaan)
const hal = useState(`konten-antrian-${props.kind}-hal`, () => 1)
const per = useState(`konten-antrian-${props.kind}-per`, () => 10)
const namaBrand = (id?: string) => st.value.brands.find(b => b.id === id)?.name.split(' (')[0] ?? ''
const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? ''
const semua = computed(() => barisAntrian(props.kind, saringBrand(st.value.content, brand.value), saringBrand(st.value.prodTasks, brand.value), mktRows.value))
const list = computed(() => saringAntrian(semua.value, f.value, namaBrand, namaUser))
const arsipN = computed(() => semua.value.filter(r => r.done).length)
watch([() => ({ ...f.value }), brand], () => {
  hal.value = 1
}, { deep: true })
const halaman = computed(() => list.value.slice((hal.value - 1) * per.value, hal.value * per.value))

const SEMUA = '__semua'
const fStatus = computed({ get: () => f.value.status || SEMUA, set: (v: string) => {
  f.value.status = (v === SEMUA ? '' : v) as FilterAntrian['status']
} })
const fPrio = computed({ get: () => f.value.priority || SEMUA, set: (v: string) => {
  f.value.priority = v === SEMUA ? '' : v
} })
const opsiStatus = [{ value: 'todo', label: 'Aktif (belum selesai)' }, { value: 'done', label: 'Arsip (sudah selesai)' }, { value: SEMUA, label: 'Semua' }]
const opsiPrio = [{ value: SEMUA, label: 'Semua Prioritas' }, ...Object.entries(PRIORITY_KONTEN).map(([value, x]) => ({ value, label: x.label }))]
const reset = () => {
  f.value = filterAntrianBawaan()
}

// ---- sortable headers (queueSort / qHead) ----
function urut(k: string) {
  f.value = f.value.sort === k ? { ...f.value, dir: f.value.dir === 1 ? -1 : 1 } : { ...f.value, sort: k, dir: 1 }
}
const kepala = (k: string, t: string) => () => h(UButton, {
  'label': t,
  'color': 'neutral',
  'variant': 'link',
  'class': '-mx-1 px-1 text-xs font-semibold tracking-wide text-table-head-text uppercase',
  'trailingIcon': f.value.sort === k ? (f.value.dir === 1 ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down') : 'i-lucide-arrow-up-down',
  'aria-label': `Urutkan berdasarkan ${t}`,
  'onClick': () => urut(k),
})
const kolom = computed<TableColumn<BarisAntrian>[]>(() => [
  { id: 'prio', header: kepala('priority', 'Prioritas') },
  { id: 'kerja', header: kepala('title', 'Pekerjaan') },
  { id: 'brand', header: kepala('brand', 'Brand') },
  { id: 'platform', header: props.kind === 'shoot' ? 'Talent/Platform' : 'Platform' },
  { id: 'pic', header: kepala('pic', 'PIC') },
  { id: 'deadline', header: kepala('date', `Deadline ${p.value.short}`) },
  { id: 'status', header: kepala('status', 'Status') },
  { id: 'aksi', header: '' },
])

// ---- open / toggle ----
const tugasBuka = ref(false)
const tugas = ref<ProdTask | null>(null)
const reqBuka = ref<ReqDesainMkt | null>(null)
const reqSheet = computed({ get: () => !!reqBuka.value, set: (v: boolean) => {
  if (!v) reqBuka.value = null
} })
function tambah() {
  tugas.value = null
  tugasBuka.value = true
}
function buka(r: BarisAntrian) {
  if (r.src === 'content') return router.push(`/konten/detail/${r.id}`)
  if (r.src === 'mkt') {
    reqBuka.value = reqs.value.find(x => x.id === r.id) ?? null
    return
  }
  tugas.value = st.value.prodTasks.find(x => x.id === r.id) ?? null
  tugasBuka.value = true
}

async function toggle(r: BarisAntrian) {
  if (r.src === 'mkt') return selesaiMkt(r.id)
  if (r.src === 'content') {
    const c = st.value.content.find(x => x.id === r.id)
    const need = c?.prod?.[props.kind]
    if (!c || !need) return
    const done = need.status !== 'done'
    const { doneAt: _lama, ...sisa } = need
    const baru = done ? { ...sisa, status: 'done', doneAt: Date.now() } : { ...sisa, status: 'todo' }
    return kontenSimpan(
      () => tambalKonten<KontenItem>('content', c.id, { prod: { ...c.prod, [props.kind]: baru } }, c.updatedAt),
      undefined,
      { action: `${done ? 'menyelesaikan' : 'membuka ulang'} ${p.value.short}`, target: c.title },
    )
  }
  const x = st.value.prodTasks.find(t => t.id === r.id)
  if (!x) return
  const { doneAt: _lama, ...sisa } = x
  return kontenSimpan(() => ubahKonten<ProdTask>('prod-tasks', x.id, x.status === 'done' ? { ...sisa, status: 'todo' } : { ...sisa, status: 'done', doneAt: Date.now() }, x.updatedAt))
}

/** reqMktSelesai (:3137-3154): hide at once, tell Marketing; on failure show it again. */
async function selesaiMkt(id: string) {
  if (!can('design') && !can('editing') && !can('content')) return toast.add({ title: 'Kamu tidak punya akses menandai pekerjaan ini', color: 'error' })
  disembunyikan.value = new Set([...disembunyikan.value, id])
  reqBuka.value = null
  try {
    await selesaiReqDesainMkt(id, saya.value?.user.name ?? '')
    toast.add({ title: 'Ditandai selesai - marketing sudah bisa melihatnya', color: 'success' })
    await reqUlang()
  }
  catch (e) {
    toast.add({ title: `Gagal mengabari Marketing: ${apiErrorMessage(e)} - permintaannya dimunculkan lagi`, color: 'error' })
    const s = new Set(disembunyikan.value)
    s.delete(id)
    disembunyikan.value = s
  }
}

// ---- request references, read when the sheet opens ----
const refs = ref<{ t: string, v: string, n?: string }[] | null>(null)
const refGagal = ref(false)
watch(reqBuka, async (r) => {
  refs.value = null
  refGagal.value = false
  if (!r?.nRef) return
  try {
    const x = (await getReqDesainMkt(r.id)).data
    if (reqBuka.value?.id !== r.id) return
    refs.value = Array.isArray(x?.refs) ? x.refs : []
    if (!refs.value.length) refGagal.value = true
  }
  catch {
    refGagal.value = true
  }
})
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-end gap-2">
      <UButton
        v-if="can(p.view)"
        :label="`Tambah ${p.short}`"
        icon="i-lucide-plus"
        @click="tambah"
      />
    </div>

    <UAlert
      v-if="pakaiMkt && reqErr"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Request dari modul Marketing tidak terbaca (${apiErrorMessage(reqErr)}).`"
      description="Antrian di bawah hanya berisi pekerjaan dari modul ini."
      :actions="[{ label: 'Coba lagi', color: 'neutral', variant: 'outline', onClick: () => reqUlang() }]"
      class="mb-4"
    />

    <AppPanel>
      <div class="flex flex-wrap items-center gap-2.5">
        <UInput
          v-model="f.q"
          icon="i-lucide-search"
          placeholder="Cari pekerjaan..."
          class="w-full sm:w-60"
        />
        <USelect
          v-model="fStatus"
          :items="opsiStatus"
          class="w-full sm:w-52"
          aria-label="Status"
        />
        <USelect
          v-model="fPrio"
          :items="opsiPrio"
          class="w-full sm:w-44"
          aria-label="Prioritas"
        />
        <UButton
          label="Reset"
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="outline"
          size="sm"
          @click="reset"
        />
        <span class="ml-auto text-xs text-muted">
          {{ list.length }} / {{ semua.length }} pekerjaan<template v-if="f.status === 'todo' && arsipN"> · <b>{{ arsipN }}</b> diarsipkan</template>
        </span>
      </div>
    </AppPanel>

    <AppPanel flush>
      <div
        v-if="!list.length"
        class="p-8 text-center text-sm text-muted"
      >
        <b class="block text-base text-highlighted">{{ semua.length ? 'Tidak ada yang cocok' : 'Antrian kosong' }}</b>
        {{ semua.length ? 'Ubah / reset filter untuk melihat pekerjaan lain.' : `Belum ada pekerjaan ${p.label.toLowerCase()}. Tambahkan lewat konten atau tombol di atas.` }}
      </div>
      <template v-else>
        <UTable
          class="hidden lg:block"
          :data="halaman"
          :columns="kolom"
        >
          <template #prio-cell="{ row }">
            <AppStatus
              :color="warnaPrioKonten(row.original.priority)"
              size="sm"
            >
              {{ PRIORITY_KONTEN[row.original.priority]?.label ?? row.original.priority }}
            </AppStatus>
          </template>
          <template #kerja-cell="{ row }">
            <button
              type="button"
              class="text-left"
              @click="buka(row.original)"
            >
              <span class="flex flex-wrap items-center gap-1.5 font-semibold text-highlighted">
                {{ row.original.title }}
                <UBadge
                  v-if="row.original.src === 'task'"
                  label="mandiri"
                  color="neutral"
                  variant="outline"
                  size="sm"
                />
                <UBadge
                  v-else-if="row.original.src === 'mkt'"
                  label="dari Marketing"
                  variant="outline"
                  size="sm"
                />
              </span>
              <span class="block text-xs text-muted">{{ row.original.sub }}</span>
            </button>
          </template>
          <template #brand-cell="{ row }">
            {{ namaBrand(row.original.brand) }}
          </template>
          <template #platform-cell="{ row }">
            <span
              v-if="row.original.platforms.length"
              class="flex flex-wrap gap-1"
            >
              <UBadge
                v-for="x in row.original.platforms"
                :key="x"
                :label="x"
                color="neutral"
                variant="soft"
                size="sm"
              />
            </span>
            <span
              v-else
              class="text-xs text-dimmed"
            >-</span>
          </template>
          <template #pic-cell="{ row }">
            {{ namaUser(row.original.pic).split(' ')[0] || '-' }}
          </template>
          <template #deadline-cell="{ row }">
            <KontenDeadline
              :tgl="row.original.date"
              :selesai="row.original.done"
            />
          </template>
          <template #status-cell="{ row }">
            <AppStatus
              :color="row.original.done ? 'success' : 'info'"
              :icon="row.original.done ? 'i-lucide-circle-check' : 'i-lucide-loader'"
              size="sm"
            >
              {{ row.original.done ? 'Selesai' : 'Dikerjakan' }}
            </AppStatus>
          </template>
          <template #aksi-cell="{ row }">
            <UButton
              v-if="can(p.view)"
              :label="row.original.done ? 'Buka' : 'Selesai'"
              :icon="row.original.done ? 'i-lucide-rotate-ccw' : 'i-lucide-check'"
              :color="row.original.done ? 'neutral' : 'primary'"
              :variant="row.original.done ? 'outline' : 'solid'"
              size="xs"
              @click="toggle(row.original)"
            />
          </template>
        </UTable>

        <ul class="divide-y divide-default lg:hidden">
          <li
            v-for="r in halaman"
            :key="`${r.src}-${r.id}`"
            class="flex items-start gap-3 p-4"
          >
            <button
              type="button"
              class="min-w-0 flex-1 text-left"
              @click="buka(r)"
            >
              <span class="flex flex-wrap items-center gap-1.5 font-semibold text-highlighted">
                {{ r.title }}
                <UBadge
                  v-if="r.src === 'mkt'"
                  label="dari Marketing"
                  variant="outline"
                  size="sm"
                />
              </span>
              <span class="block text-xs text-muted">{{ [namaBrand(r.brand), r.platforms.join(' · '), namaUser(r.pic).split(' ')[0]].filter(Boolean).join(' · ') }}</span>
              <span class="mt-1 flex flex-wrap items-center gap-1.5">
                <AppStatus
                  :color="warnaPrioKonten(r.priority)"
                  size="sm"
                >{{ PRIORITY_KONTEN[r.priority]?.label ?? r.priority }}</AppStatus>
                <KontenDeadline
                  :tgl="r.date"
                  :selesai="r.done"
                />
              </span>
            </button>
            <UButton
              v-if="can(p.view)"
              :icon="r.done ? 'i-lucide-rotate-ccw' : 'i-lucide-check'"
              :color="r.done ? 'neutral' : 'primary'"
              :variant="r.done ? 'outline' : 'solid'"
              size="sm"
              :aria-label="r.done ? 'Buka lagi' : 'Tandai selesai'"
              @click="toggle(r)"
            />
          </li>
        </ul>
        <KontenPager
          v-model:hal="hal"
          v-model:per="per"
          :total="list.length"
          satuan="pekerjaan"
        />
      </template>
    </AppPanel>

    <KontenTugasForm
      v-model:open="tugasBuka"
      :kind="kind"
      :task="tugas"
    />

    <ResponsiveSheet
      v-model:open="reqSheet"
      :title="reqBuka?.judul || 'Request'"
      description="Judul, brief & deadline diubah dari modul Marketing - halaman ini hanya menandai selesai."
    >
      <template v-if="reqBuka">
        <div class="mb-3 flex flex-wrap gap-1.5">
          <UBadge
            :label="reqBuka.jenis === 'edit' ? 'Video / Editing' : 'Desain'"
            :icon="reqBuka.jenis === 'edit' ? 'i-lucide-clapperboard' : 'i-lucide-palette'"
            color="neutral"
            variant="soft"
          />
          <UBadge
            label="dari Marketing"
            variant="soft"
          />
          <UBadge
            v-if="reqBuka.brandNama"
            :label="reqBuka.brandNama"
            icon="i-lucide-tag"
            color="neutral"
            variant="soft"
          />
          <UBadge
            v-for="x in reqBuka.platforms ?? []"
            :key="x"
            :label="x"
            color="neutral"
            variant="soft"
          />
          <UBadge
            v-if="reqBuka.pemohon"
            :label="reqBuka.pemohon"
            icon="i-lucide-user"
            color="neutral"
            variant="soft"
          />
          <UBadge
            v-if="reqBuka.picMinta"
            :label="`diminta: ${reqBuka.picMinta}`"
            color="neutral"
            variant="soft"
          />
          <UBadge
            v-if="reqBuka.deadline"
            :label="fTgl(reqBuka.deadline)"
            icon="i-lucide-calendar"
            color="neutral"
            variant="soft"
          />
        </div>
        <p
          v-if="reqBuka.acara"
          class="mb-2 text-sm text-muted"
        >
          Untuk acara: <b class="text-default">{{ reqBuka.acara }}</b>
        </p>
        <div class="whitespace-pre-wrap rounded-field border border-default bg-muted p-3 text-sm leading-relaxed">
          {{ reqBuka.brief || '(brief kosong)' }}
        </div>
        <div
          v-if="reqBuka.nRef"
          class="mt-3"
        >
          <p
            v-if="refGagal"
            class="text-xs text-error"
          >
            Referensi gagal dimuat - buka di modul Marketing.
          </p>
          <p
            v-else-if="!refs"
            class="text-xs text-muted"
          >
            Memuat {{ reqBuka.nRef }} referensi…
          </p>
          <template v-else>
            <p class="mb-1.5 text-[11px] font-bold tracking-wide text-muted uppercase">
              Referensi
            </p>
            <div class="flex flex-wrap gap-2">
              <template
                v-for="(x, i) in refs"
                :key="i"
              >
                <a
                  v-if="x.t === 'img'"
                  :href="x.v"
                  target="_blank"
                  rel="noopener"
                >
                  <img
                    :src="x.v"
                    :alt="x.n || 'Referensi'"
                    class="size-24 rounded-field border border-default object-cover"
                  >
                </a>
                <UButton
                  v-else
                  :label="x.n || x.v"
                  :to="x.v"
                  target="_blank"
                  icon="i-lucide-link"
                  color="neutral"
                  variant="outline"
                  size="xs"
                />
              </template>
            </div>
          </template>
        </div>
      </template>
      <template #footer>
        <UButton
          label="Tandai Selesai"
          icon="i-lucide-check"
          @click="reqBuka && selesaiMkt(reqBuka.id)"
        />
        <UButton
          label="Tutup"
          color="neutral"
          variant="outline"
          @click="reqBuka = null"
        />
      </template>
    </ResponsiveSheet>
  </div>
</template>
