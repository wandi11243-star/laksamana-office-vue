<!--
  Konten › detail of one content item (old openContent drawer + its actions,
  deploy/konten/index.html:2243-2480; konten.md D.21). The old Panel opened it
  as a drawer over any screen; here it is a page every screen links to.

    /konten/detail/baru          → empty form (Konten baru)
    /konten/detail/<id>?ubah=1   → edit form
    /konten/detail/<id>          → the detail with its actions

  Every action is a PATCH of the changed fields with the row's version
  (`updatedAt`), plus the old activity line (logAct) and, where the old client
  notified, a notification row. Performance figures: KontenPerfBlok
  (renderPerfBlock, from performa-konten.ts).
-->
<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { KontenItem, ProdKind } from '~/utils/konten'
import {
  PIPELINE_KONTEN, PRINT_TYPES, PRIORITY_KONTEN, PROD_KINDS, PROD_TYPES, ROLES_KONTEN, contentDetail, contentPlatforms, contentRefs,
  contentTypes, kruDisebut, potongMention, printTypes, statusGeser, sudahArsip,
} from '~/utils/konten'
import { ikonStatusKonten, warnaPrioKonten, warnaStatusKonten } from '~/utils/status-konten'
import { fTgl } from '~/utils/format'

definePageMeta({ access: ['konten'] })

const route = useRoute()
const router = useRouter()
const toast = useToast()

const id = computed(() => String(route.params.id))
const baru = computed(() => id.value === 'baru')
const ubah = computed(() => baru.value || route.query.ubah === '1')
const { data: dict } = useDictKonten()
const { saya, can } = useAksesKontenRingan()
// Full row on demand (#141) — the list stays slim, photos load only here.
const { data: baris, status, error, refresh: muatUlangBaris } = useAsyncData(`konten-detail-${id.value}`, () => {
  // Creation mode has no row to fetch (same null the old find() gave).
  if (id.value === 'baru') return Promise.resolve(null)
  return useApi()<Envelope<KontenItem>>(`/konten/content/${encodeURIComponent(id.value)}`).then(r => r.data)
}, { watch: [id] })
const c = computed<KontenItem | null>(() => baris.value ?? null)

const namaUser = (uid?: string) => dict.value?.users.find(u => u.id === uid)?.name ?? (uid || '-')
const brand = computed(() => dict.value?.brands.find(b => b.id === c.value?.brand))
const stepIdx = computed(() => PIPELINE_KONTEN.indexOf((c.value?.status ?? '') as typeof PIPELINE_KONTEN[number]))
// Flow pills reuse the badge palette (same tones as AppStatus) so each stage
// carries its status colour; the active stage adds a ring + bold as its marker.
const alurTone: Record<string, string> = {
  success: 'bg-teal-light text-moss-dark',
  warning: 'bg-yellow-light text-yellow-dark',
  error: 'bg-coral-light text-coral-dark',
  info: 'bg-accented text-blue-pressed',
  vip: 'bg-lilac-light text-ink-900',
  gold: 'bg-yellow-light text-yellow-dark',
  neutral: 'bg-muted text-ink-900',
}
const toneAlur = (s: string) => alurTone[warnaStatusKonten(s)] ?? alurTone.neutral
const checklist = computed(() => c.value?.checklist ?? [])
const chkDone = computed(() => checklist.value.filter(x => x.done).length)
const refsLink = computed(() => contentRefs(c.value).filter(r => r.t !== 'img'))
const refsImg = computed(() => contentRefs(c.value).filter(r => r.t === 'img' && !!r.v))
/** In-app zoom of a reference photo (old viewImage). */
const zoomImg = ref<{ v: string, n?: string } | null>(null)
const zoomBuka = computed({ get: () => !!zoomImg.value, set: (v: boolean) => {
  if (!v) zoomImg.value = null
} })
const detail = computed(() => contentDetail(c.value))
const namaKru = computed(() => (dict.value?.users ?? []).map(u => u.name))
const lalu = (ts?: number) => {
  if (!ts) return '-'
  const s = (Date.now() - ts) / 1000
  if (s < 60) return 'baru saja'
  if (s < 3600) return `${Math.floor(s / 60)}m lalu`
  if (s < 86400) return `${Math.floor(s / 3600)}j lalu`
  return `${Math.floor(s / 86400)}h lalu`
}
const waktu = (v?: number | string) => (v ? new Date(v).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-')

/** PATCH the item with its version, log, reload (row + nothing else). */
const tambal = async (fields: Partial<KontenItem>, sukses?: string, action?: string) => {
  const ok = await kontenSimpan(() => tambalKonten<KontenItem>('content', c.value!.id, fields, c.value!.updatedAt), sukses, action ? { action, target: c.value!.title } : undefined)
  if (ok) await muatUlangBaris()
  return ok
}

// ---- status flow (:2445-2448) ----
async function geser(arah: 1 | -1) {
  const s = statusGeser(c.value?.status, arah)
  if (!s || !c.value) return
  const fields: Partial<KontenItem> = { status: s }
  if (s === 'Approval') fields.approvals = c.value.approvals ?? []
  if (await tambal(fields, `Status → ${s}`, `mengubah status → ${s}`) && s === 'Approval') notifKonten('approval', `Menunggu approval: ${c.value.title}`)
}

// ---- revision (:2462-2468): KontenRevisiSheet ----
const revisiBuka = ref(false)

// ---- cancel / delete (:2469, :2478) ----
const batalBuka = ref(false)
async function batalkan() {
  if (await tambal({ status: 'Cancelled' }, 'Konten dibatalkan', 'membatalkan konten')) batalBuka.value = false
}
const hapusBuka = ref(false)
async function hapus() {
  const judul = c.value?.title ?? ''
  const ok = await kontenSimpan(() => hapusKonten('content', c.value!.id, c.value!.updatedAt), 'Konten dihapus', { action: 'menghapus konten', target: judul })
  if (ok) {
    hapusBuka.value = false
    router.replace('/konten/planning')
  }
}

// ---- production needs (:3268-3280): doneAt stamped when done, dropped when reopened ----
function toggleProd(k: ProdKind) {
  const p = { ...(c.value?.prod ?? {}) }
  const cur = { ...p[k] }
  const done = cur.status === 'done'
  cur.status = done ? 'todo' : 'done'
  if (done) delete cur.doneAt
  else cur.doneAt = Date.now()
  p[k] = cur
  tambal({ prod: p }, undefined, `${done ? 'membuka ulang' : 'menyelesaikan'} ${PROD_TYPES[k].short}`)
}

// ---- checklist (:2449-2451) ----
const chkBaru = ref('')
const setChecklist = (list: { t: string, done?: boolean }[]) => tambal({ checklist: list })
const toggleChk = (i: number) => setChecklist(checklist.value.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))
const rmChk = (i: number) => setChecklist(checklist.value.filter((_, j) => j !== i))
async function addChk() {
  const t = chkBaru.value.trim()
  if (!t) return
  if (await setChecklist([...checklist.value, { t, done: false }])) chkBaru.value = ''
}

// ---- discussion (:2452-2461, mention scan :2394-2435): mentions = "@<full name>", notified one by one ----
const komentar = ref('')
const bungkusKomentar = ref<ComponentPublicInstance | null>(null)
const elKomentar = () => {
  const root = bungkusKomentar.value?.$el as HTMLElement | undefined
  return root?.querySelector('input') ?? null
}
/** Popup state: query behind the cursor, its start, the highlighted row. */
const mntBuka = ref(false)
const mntIdx = ref(0)
const mntQuery = ref('')
const mntAwal = ref(-1)
const inisial = (nama?: string) => String(nama ?? '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
/** Full name, any word start, or initials — like the old mentionCandidates (:2386-2393). */
const mntCalon = computed(() => {
  const q = mntQuery.value.toLowerCase()
  return (dict.value?.users ?? []).filter(u => u.id !== saya.value?.user.id && u.name
    && (!q || u.name.toLowerCase().includes(q)
      || u.name.toLowerCase().split(/\s+/).some(w => w.startsWith(q))
      || inisial(u.name).toLowerCase().startsWith(q))).slice(0, 6)
})
const peranSingkat = (u: { roles?: string[], division?: string }) =>
  (u.roles ?? []).map(r => ROLES_KONTEN[r as keyof typeof ROLES_KONTEN]?.label).filter(Boolean).join(', ')
  || u.division || ''
/** On each keystroke: when the cursor sits behind "@…", show the crew list. */
function pindaiMention() {
  const el = elKomentar()
  if (!el || typeof el.selectionStart !== 'number') {
    mntBuka.value = false
    return
  }
  const m = el.value.slice(0, el.selectionStart).match(/(?:^|\s)@([^@\s]{0,24})$/)
  if (!m) {
    mntBuka.value = false
    return
  }
  mntQuery.value = m[1] ?? ''
  mntAwal.value = (el.selectionStart ?? 0) - mntQuery.value.length - 1
  mntIdx.value = 0
  mntBuka.value = mntCalon.value.length > 0
}
/** Insert "@Full Name " over the "@query" being typed (old pickMention). */
function pilihMention(u: { id: string, name?: string }) {
  const el = elKomentar()
  const awal = mntAwal.value
  if (!u.name || awal < 0) {
    mntBuka.value = false
    return
  }
  const teks = el?.value ?? komentar.value
  const pos = el?.selectionStart ?? teks.length
  const caret = awal + u.name.length + 2
  komentar.value = `${teks.slice(0, awal)}@${u.name} ${teks.slice(pos)}`
  mntBuka.value = false
  nextTick(() => {
    const ulang = elKomentar()
    if (!ulang) return
    ulang.focus()
    ulang.setSelectionRange(caret, caret)
  })
}
function onTombolKomentar(e: KeyboardEvent) {
  if (mntBuka.value && mntCalon.value.length) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      mntIdx.value = (mntIdx.value + 1) % mntCalon.value.length
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      mntIdx.value = (mntIdx.value - 1 + mntCalon.value.length) % mntCalon.value.length
      return
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const u = mntCalon.value[mntIdx.value]
      if (u) pilihMention(u)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      mntBuka.value = false
      return
    }
  }
  if (e.key === 'Enter') kirimKomentar()
}
async function kirimKomentar() {
  const text = komentar.value.trim()
  if (!text || !c.value) return
  const saya_ = saya.value?.user.id ?? ''
  const mentions = kruDisebut(dict.value?.users ?? [], text).map(u => u.id).filter(u => u !== saya_)
  const comments = [...(c.value.comments ?? []), { by: saya_, at: Date.now(), text, mentions }]
  if (await tambal({ comments }, undefined, 'berkomentar di')) {
    for (const uid of mentions) notifKonten('mention', `${namaUser(saya_)} menyebut ${namaUser(uid)} di diskusi "${c.value.title}"`, uid)
    komentar.value = ''
    mntBuka.value = false
  }
}

// ---- publish (:2470-2477): KontenTayangSheet ----
const tayangBuka = ref(false)

async function salin() {
  try {
    await navigator.clipboard.writeText(detail.value)
    toast.add({ title: 'Disalin ke clipboard', color: 'success' })
  }
  catch {
    toast.add({ title: 'Gagal menyalin', color: 'error' })
  }
}
const setelahSimpan = (nid: string) => router.replace(`/konten/detail/${nid}`)
</script>

<template>
  <div v-if="ubah">
    <KontenForm
      v-if="baru || c"
      :key="c?.updatedAt ?? 'baru'"
      :item="baru ? null : c"
      @simpan="setelahSimpan"
      @batal="baru ? router.back() : router.replace(`/konten/detail/${id}`)"
    />
    <div
      v-else-if="status === 'pending'"
      class="space-y-2 py-2"
    >
      <!-- Loading paper mirrors the content form below. -->
      <USkeleton class="h-5 w-1/3" />
      <USkeleton class="h-3 w-full" />
      <USkeleton class="h-3 w-full" />
      <USkeleton class="h-3 w-5/6" />
      <USkeleton class="mt-4 h-5 w-1/4" />
      <USkeleton class="h-3 w-full" />
      <USkeleton class="h-3 w-4/6" />
      <p class="pt-1 text-center text-sm text-muted">
        Memuat…
      </p>
    </div>
  </div>

  <AppPage
    v-else-if="c"
    :title="c.title || '(tanpa judul)'"
    :description="[brand?.name, contentPlatforms(c).join(' · '), c.pillar].filter(Boolean).join(' · ')"
  >
    <template #actions>
      <UButton
        label="Kembali"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="outline"
        @click="router.back()"
      />
      <UButton
        v-if="can('content')"
        label="Edit"
        icon="i-lucide-pencil"
        color="neutral"
        variant="outline"
        :to="`/konten/detail/${c.id}?ubah=1`"
      />
    </template>

    <div class="mb-5 flex flex-wrap items-center gap-1.5">
      <AppStatus
        :color="warnaStatusKonten(c.status)"
        :icon="ikonStatusKonten(c.status)"
      >
        {{ c.status }}
      </AppStatus>
      <AppStatus :color="warnaPrioKonten(c.priority)">
        {{ PRIORITY_KONTEN[c.priority || 'medium']?.label }}
      </AppStatus>
      <UBadge
        :color="c.deadline && !sudahArsip(c) && new Date(`${c.deadline}T23:59:59`) < new Date() ? 'error' : 'neutral'"
        variant="soft"
        icon="i-lucide-calendar"
        :label="`Deadline ${fTgl(c.deadline)}`"
      />
      <UBadge
        color="neutral"
        variant="soft"
        icon="i-lucide-send"
        :label="`Tayang ${fTgl(c.publishDate)} ${c.publishTime || ''}`"
      />
      <UBadge
        v-for="t in contentTypes(c)"
        :key="t"
        color="neutral"
        variant="soft"
        icon="i-lucide-film"
        :label="t"
      />
      <UBadge
        v-if="!contentTypes(c).length"
        color="neutral"
        variant="soft"
        icon="i-lucide-film"
        label="-"
      />
      <UBadge
        v-for="r in printTypes(c)"
        :key="r"
        color="neutral"
        variant="soft"
        icon="i-lucide-printer"
        :label="PRINT_TYPES[r] ? `${r} - ${PRINT_TYPES[r]}` : r"
      />
    </div>

    <AppPanel title="Alur status">
      <ol class="flex flex-wrap gap-1.5">
        <li
          v-for="(s, i) in PIPELINE_KONTEN"
          :key="s"
          class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
          :class="i === stepIdx ? [toneAlur(s), 'font-bold ring-1 ring-inset ring-current'] : i < stepIdx ? toneAlur(s) : 'bg-muted text-muted'"
        >
          <UIcon
            v-if="i < stepIdx"
            name="i-lucide-check"
            class="size-3.5"
          />
          <span v-else>{{ i + 1 }}</span>
          {{ s }}
        </li>
      </ol>
      <div
        v-if="can('content') && c.status !== 'Cancelled'"
        class="mt-4 flex flex-wrap gap-2"
      >
        <UButton
          v-if="stepIdx > 0"
          label="Mundur"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="outline"
          size="sm"
          @click="geser(-1)"
        />
        <UButton
          v-if="stepIdx >= 0 && stepIdx < PIPELINE_KONTEN.length - 1"
          :label="`Lanjut ke ${PIPELINE_KONTEN[stepIdx + 1]}`"
          trailing-icon="i-lucide-arrow-right"
          size="sm"
          @click="geser(1)"
        />
        <UButton
          v-if="c.status !== 'Revision'"
          label="Minta revisi"
          icon="i-lucide-rotate-ccw"
          color="warning"
          variant="outline"
          size="sm"
          @click="revisiBuka = true"
        />
        <UButton
          label="Batalkan"
          icon="i-lucide-x"
          color="error"
          variant="soft"
          size="sm"
          @click="batalBuka = true"
        />
      </div>
    </AppPanel>

    <AppPanel
      v-if="refsLink.length || refsImg.length"
      title="Referensi"
      :description="`${refsLink.length} link - ${refsImg.length} foto`"
    >
      <div class="space-y-1.5">
        <a
          v-for="(r, i) in refsLink"
          :key="i"
          :href="r.v"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-1.5 text-sm break-all text-info"
        >
          <UIcon
            name="i-lucide-link"
            class="size-4 flex-none"
          />{{ r.n || r.v }}
        </a>
      </div>
      <div
        v-if="refsImg.length"
        class="mt-3 flex flex-wrap gap-2"
      >
        <button
          v-for="(r, i) in refsImg"
          :key="i"
          type="button"
          :title="`Perbesar ${r.n || 'referensi'}`"
          @click="zoomImg = { v: r.v ?? '', n: r.n }"
        >
          <img
            :src="r.v"
            :alt="r.n || 'Referensi'"
            class="size-24 rounded-field border border-default object-cover"
          >
        </button>
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="zoomBuka"
      :title="zoomImg?.n || 'Referensi'"
    >
      <img
        v-if="zoomImg"
        :src="zoomImg.v"
        :alt="zoomImg.n || 'Referensi'"
        class="w-full rounded-lg border border-default"
      >
      <template #footer>
        <UButton
          label="Tutup"
          color="neutral"
          variant="soft"
          size="xl"
          @click="zoomImg = null"
        />
      </template>
    </ResponsiveSheet>

    <AppPanel
      v-if="detail"
      title="Detailing"
    >
      <template #actions>
        <UButton
          label="Salin"
          icon="i-lucide-copy"
          color="neutral"
          variant="outline"
          size="sm"
          loading-auto
          @click="salin"
        />
      </template>
      <p class="text-sm leading-relaxed whitespace-pre-wrap">
        {{ detail }}
      </p>
    </AppPanel>

    <AppPanel
      v-if="c.prod && Object.keys(c.prod).length"
      title="Kebutuhan produksi"
      description="shoot - desain - editing"
      flush
    >
      <ul class="divide-y divide-default">
        <li
          v-for="k in PROD_KINDS.filter(x => c?.prod?.[x])"
          :key="k"
          class="flex items-center gap-3 px-4 py-3"
        >
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold">
              {{ PROD_TYPES[k].label }}
            </p>
            <KontenDeadline
              :tgl="c.prod[k]?.date"
              :selesai="c.prod[k]?.status === 'done'"
              kosong="Tanpa deadline"
            />
          </div>
          <AppStatus
            :color="c.prod[k]?.status === 'done' ? 'success' : 'info'"
            size="sm"
          >
            {{ c.prod[k]?.status === 'done' ? 'Selesai' : 'Dikerjakan' }}
          </AppStatus>
          <UButton
            v-if="can(PROD_TYPES[k].view)"
            :icon="c.prod[k]?.status === 'done' ? 'i-lucide-rotate-ccw' : 'i-lucide-check'"
            :color="c.prod[k]?.status === 'done' ? 'neutral' : 'primary'"
            :variant="c.prod[k]?.status === 'done' ? 'outline' : 'solid'"
            size="sm"
            :aria-label="c.prod[k]?.status === 'done' ? 'Buka ulang' : 'Tandai selesai'"
            @click="toggleProd(k)"
          />
        </li>
      </ul>
    </AppPanel>

    <AppPanel
      title="Checklist produksi"
      :count="`${chkDone}/${checklist.length}`"
    >
      <UProgress
        :model-value="checklist.length ? chkDone / checklist.length * 100 : 0"
        size="sm"
        class="mb-3"
      />
      <ul class="space-y-1">
        <li
          v-for="(x, i) in checklist"
          :key="i"
          class="flex items-center gap-2"
        >
          <UCheckbox
            :model-value="!!x.done"
            :label="x.t"
            :ui="{ label: x.done ? 'line-through opacity-60' : '' }"
            class="flex-1"
            @update:model-value="toggleChk(i)"
          />
          <UButton
            v-if="can('content')"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Hapus item"
            @click="rmChk(i)"
          />
        </li>
      </ul>
      <div
        v-if="can('content')"
        class="mt-3 flex gap-2"
      >
        <UInput
          v-model="chkBaru"
          placeholder="Tambah item checklist…"
          class="flex-1"
          @keydown.enter="addChk"
        />
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          aria-label="Tambah"
          loading-auto
          @click="addChk"
        />
      </div>
    </AppPanel>

    <KontenPerfBlok :item="c" />

    <AppPanel
      v-if="c.publishRecord"
      title="Publishing record"
      icon="i-lucide-send"
    >
      <div class="grid gap-2 text-sm sm:grid-cols-2">
        <p><span class="text-muted">Tayang:</span> {{ waktu(c.publishRecord.at) }}</p>
        <p><span class="text-muted">Oleh:</span> {{ namaUser(c.publishRecord.pic) }}</p>
        <p class="sm:col-span-2 break-all">
          <span class="text-muted">URL:</span> <a
            :href="c.publishRecord.url"
            target="_blank"
            rel="noopener"
            class="text-info"
          >{{ c.publishRecord.url }}</a>
        </p>
      </div>
    </AppPanel>
    <UButton
      v-if="c.status === 'Scheduled' && can('publish')"
      label="Tandai sudah tayang"
      icon="i-lucide-circle-check"
      block
      class="mb-5"
      @click="tayangBuka = true"
    />

    <AppPanel
      v-if="c.approvals?.length"
      title="Approval trail"
      flush
    >
      <ul class="divide-y divide-default">
        <li
          v-for="(a, i) in c.approvals"
          :key="i"
          class="flex items-center gap-3 px-4 py-2.5 text-sm"
        >
          <AppStatus
            color="success"
            icon="i-lucide-check"
            size="sm"
          >
            {{ a.stage }}
          </AppStatus>
          <span class="flex-1">{{ namaUser(a.by) }}</span>
          <span class="text-xs text-muted">{{ lalu(a.at) }}</span>
        </li>
      </ul>
    </AppPanel>

    <AppPanel
      title="Diskusi tim"
      icon="i-lucide-message-circle"
    >
      <p
        v-if="!c.comments?.length"
        class="py-3 text-center text-xs text-muted"
      >
        Belum ada diskusi. Mulai percakapan!
      </p>
      <ul
        v-else
        class="space-y-3"
      >
        <li
          v-for="(m, i) in c.comments"
          :key="i"
          class="text-sm"
        >
          <p class="text-xs">
            <b>{{ namaUser(m.by).split(' ')[0] }}</b> <span class="text-muted">{{ lalu(m.at) }}</span>
          </p>
          <p class="mt-0.5 text-default">
            <template
              v-for="(bag, j) in potongMention(m.text ?? '', namaKru)"
              :key="j"
            >
              <b
                v-if="bag.mention"
                class="text-primary-700"
              >{{ bag.t }}</b>
              <template v-else>
                {{ bag.t }}
              </template>
            </template>
          </p>
        </li>
      </ul>
      <div class="mt-3 flex items-start gap-2">
        <UInput
          ref="bungkusKomentar"
          v-model="komentar"
          placeholder="Tulis komentar… ketik @ untuk mention"
          class="flex-1"
          @keydown="onTombolKomentar"
          @input="pindaiMention"
          @click="pindaiMention"
        />
        <UButton
          label="Kirim"
          loading-auto
          @click="kirimKomentar"
        />
      </div>
      <div
        v-if="mntBuka && mntCalon.length"
        class="mt-2 overflow-hidden rounded-field border border-default"
      >
        <button
          v-for="(u, i) in mntCalon"
          :key="u.id"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-muted"
          :class="i === mntIdx ? 'bg-muted' : ''"
          @mousedown.prevent
          @click="pilihMention(u)"
          @mousemove="mntIdx = i"
        >
          <span class="flex size-7 flex-none items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">{{ inisial(u.name) }}</span>
          <span class="min-w-0">
            <b class="block truncate">{{ u.name }}</b>
            <span
              v-if="peranSingkat(u)"
              class="block truncate text-xs text-muted"
            >{{ peranSingkat(u) }}</span>
          </span>
        </button>
      </div>
    </AppPanel>

    <AppPanel
      v-if="c.revisions?.length"
      title="Riwayat revisi"
    >
      <ul class="space-y-2">
        <li
          v-for="(r, i) in c.revisions"
          :key="i"
          class="text-sm"
        >
          <p class="text-xs font-semibold">
            {{ namaUser(r.by) }} <span class="font-normal text-muted">- {{ lalu(r.at) }}</span>
          </p>
          <p class="text-muted">
            {{ r.note }}
          </p>
        </li>
      </ul>
    </AppPanel>

    <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
      <UBadge
        color="neutral"
        variant="soft"
        :label="`Dibuat ${namaUser(c.createdBy)} - ${lalu(c.createdAt)}`"
      />
      <UBadge
        v-if="c.pic"
        color="neutral"
        variant="soft"
        :label="`PIC: ${namaUser(c.pic)}`"
      />
      <span class="flex-1" />
      <UButton
        v-if="can('content')"
        label="Hapus"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        size="sm"
        @click="hapusBuka = true"
      />
    </div>

    <KontenRevisiSheet
      v-model:open="revisiBuka"
      :item="c"
    />
    <KontenTayangSheet
      v-model:open="tayangBuka"
      :item="c"
    />

    <KontenKonfirmasi
      v-model:open="batalBuka"
      :title="`Batalkan konten &quot;${c.title}&quot;?`"
      confirm-label="Batalkan konten"
      @konfirmasi="batalkan"
    />
    <KontenKonfirmasi
      v-model:open="hapusBuka"
      :title="`Hapus permanen &quot;${c.title}&quot;?`"
      confirm-label="Hapus permanen"
      @konfirmasi="hapus"
    />
  </AppPage>

  <AppPage
    v-else
    title="Konten"
  >
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
    />
    <div
      v-else-if="status === 'pending'"
      class="space-y-2 p-6"
    >
      <!-- Loading paper mirrors the content detail below. -->
      <USkeleton class="h-5 w-1/3" />
      <USkeleton class="h-3 w-full" />
      <USkeleton class="h-3 w-full" />
      <USkeleton class="h-3 w-5/6" />
      <p class="pt-1 text-center text-sm text-muted">
        Memuat…
      </p>
    </div>
    <UAlert
      v-else
      color="warning"
      variant="subtle"
      icon="i-lucide-search-x"
      title="Konten tidak ditemukan."
      description="Mungkin sudah dihapus. Buka Content Planning untuk melihat daftarnya."
    />
  </AppPage>
</template>
