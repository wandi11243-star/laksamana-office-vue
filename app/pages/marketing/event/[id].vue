<!--
  Marketing › Detail Event (docs/migrasi/marketing.md D.4, issue #59), in the
  old renderEventForm order: head (status/jenis/tanggal/pax + Brief, Catat FU,
  Konfirmasi Deal, Tandai Selesai, Hapus), schedule-clash warning, stage
  reminder with "Pindah ke", four money/readiness stats, the offer-letter card,
  Pengakuan Omset, follow-up history, the fill summary, then the four tabs —
  1 Informasi Dasar, 2 Operasional, 3 Finance, 4 Overview — one card per
  section (D.1–D.11) with per-division visibility.

  Saving never waits for required fields: the old saveEventTab and its
  autosave stored whatever was typed; required marks only guide. The one hard
  stop left is the DP tick (MarketingFinanceEvent), as in the old app.
  Only the open tab is drawn. Every save is a versioned PATCH of {row keys,
  detail, payments}; 409/428 reloads through mktSimpan (marketing.md F.1).
-->
<script setup lang="ts">
import type { EventMkt, SettingsMkt } from '~/utils/marketing'
import {
  MENU_FIX_KOSONG_MKT, MENU_FIX_MKT, PIPE_COLS_MKT, TAHAP_TERBUKA_MKT, ingatTahapMkt, menuFixMkt, namaCocok,
  pindahBolehMkt, rentangTglMkt, tglMkt,
} from '~/utils/marketing'
import type { DrafEventMkt } from '~/utils/marketing-event'
import {
  KUNCI_ATAS_EVENT_MKT, adaIsiOverviewMkt, bentrokJadwalMkt,
  noKwitansiMkt, progresSeksiMkt, ringkasHapusMkt,
  ringkasNilaiMkt, seqBerikutMkt, sinkronDpMkt, tabTerlihatMkt, terlihatSeksiMkt,
} from '~/utils/marketing-event'
import { dpLabel, eventFinance, rincianPenawaran } from '~/utils/marketing-uang'
import { ikonStatusMkt, warnaStatusMkt } from '~/utils/status-marketing'
import { formatFbMkt, getDokumenMkt, hapusMkt, lepasKunciMejaMkt, mktSimpan, simpanDokumenMkt, tambalMkt, useAksesMkt, useStateMkt, versiDokumenMkt } from '~/composables/useMarketing'
import { rupiah } from '~/utils/format'

definePageMeta({ access: ['marketing'] })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { data: st, status } = useStateMkt()
const { saya, can, canView } = useAksesMkt()

const id = computed(() => String(route.params.id))

/** Kanban shortcut (?revisi=1) opens the revision sheet at once. */
const revisiMinta = ref(route.query.revisi === '1')
if (revisiMinta.value) router.replace({ query: { ...route.query, revisi: undefined } })
const ev = computed(() => st.value.events.find(e => e.id === id.value) ?? null)
const client = computed(() => st.value.clients.find(c => c.id === ev.value?.clientId))
const namaUser = (uid?: string) => st.value.users.find(u => u.id === uid)?.name ?? uid ?? '—'
const fuEvent = computed(() => st.value.followups.filter(f => f.eventId === id.value).sort((a, b) => String(b.at).localeCompare(String(a.at))))

const divSaya = computed(() => saya.value?.user.div || '')
const roleSaya = computed(() => saya.value?.user.role || '')
const seksiLihat = computed(() => terlihatSeksiMkt(divSaya.value, roleSaya.value))
const tabs = computed(() => tabTerlihatMkt(divSaya.value, roleSaya.value))
const tab = ref(String(route.query.tab ?? 'basic'))
watch(tabs, (ts) => {
  if (!ts.some(t => t.id === tab.value)) tab.value = ts[0]?.id ?? 'basic'
}, { immediate: true })
const seksiTab = (tabId: string) => {
  const t = tabs.value.find(x => x.id === tabId)
  return seksiLihat.value.filter(s => t?.secs.includes(s.id))
}
const tabKini = computed(() => tabs.value.find(t => t.id === tab.value) ?? null)
/** The next visible tab, for "Simpan & Lanjut" on every form tab. */
const tabLanjut = (tabId: string) => {
  const i = tabs.value.findIndex(t => t.id === tabId)
  const nx = tabs.value[i + 1]
  return nx && nx.id !== tabId ? nx : null
}

const uang = computed(() => (ev.value ? eventFinance(ev.value, st.value.settings) : null))
// First-load skeleton for the stat cards: while the event is not found yet
// the grid shows placeholders; later refetches keep the old cards on screen.
const statMemuat = computed(() => !ev.value && (status.value === 'pending' || status.value === 'idle'))
const bisaUbah = computed(() => can('edit_event'))
const bisaVerif = computed(() => can('verify_payment'))
const terbuka = computed(() => !!ev.value && TAHAP_TERBUKA_MKT.includes(ev.value.status))
const bentrok = computed(() => (ev.value ? bentrokJadwalMkt(ev.value, st.value.events) : []))
const sisaApprovalLama = computed(() => st.value.approvals.some(a => a.eventId === id.value && a.status === 'Pending'))

// ---- draft ----
const draf = ref<DrafEventMkt>({ atas: {}, detail: {}, payments: [] })
// Snapshot of the last SAVED draft: autosave fires only on real drift, and a
// server reload never clobbers keystrokes typed after the last save.
const drafBersih = ref('')
const tandaiBersih = () => {
  drafBersih.value = JSON.stringify(draf.value)
}
watch(() => ev.value?.updatedAt, () => {
  const e = ev.value
  if (!e) return
  if (drafBersih.value !== '' && JSON.stringify(draf.value) !== drafBersih.value) return
  const atas: Record<string, unknown> = {}
  for (const k of KUNCI_ATAS_EVENT_MKT) atas[k] = (e as unknown as Record<string, unknown>)[k]
  draf.value = { atas, detail: { ...(e.detail ?? {}) }, payments: [...(e.payments ?? [])] }
  tandaiBersih()
}, { immediate: true })
const evDraf = computed(() => (ev.value ? { ...ev.value, ...draf.value.atas, detail: draf.value.detail } as EventMkt : null))

// ---- autosave (old autoSaveBind): quiet, explicit on conflict, never finance ----
const autoState = ref<'bersih' | 'menunggu' | 'menyimpan'>('bersih')
const autoMati = ref(false)
const autoWaktu = ref('')
let autoTimer: ReturnType<typeof setTimeout> | undefined
onScopeDispose(() => clearTimeout(autoTimer))
watch(draf, () => {
  if (autoMati.value || JSON.stringify(draf.value) === drafBersih.value) {
    if (JSON.stringify(draf.value) === drafBersih.value) autoState.value = 'bersih'
    return
  }
  autoState.value = 'menunggu'
  clearTimeout(autoTimer)
  autoTimer = setTimeout(simpanOtomatis, 1200)
}, { deep: true })
async function simpanOtomatis() {
  const e = ev.value
  // Finance owns side effects (kwitansi numbers) — never autosaved. Overview is read-only.
  if (!e || !bisaUbah.value || autoMati.value || ['finance', 'overview'].includes(tab.value)) return
  const kirim = JSON.parse(JSON.stringify(draf.value)) as DrafEventMkt
  if (JSON.stringify(kirim) === drafBersih.value) {
    autoState.value = 'bersih'
    return
  }
  // Half-filled is fine: the old autosave stored whatever was typed.
  autoState.value = 'menyimpan'
  try {
    await tambalMkt<EventMkt>('events', e.id, { ...kirim.atas, detail: kirim.detail, payments: kirim.payments }, e.updatedAt)
    drafBersih.value = JSON.stringify(kirim)
    autoState.value = 'bersih'
    autoWaktu.value = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    await refreshNuxtData('marketing-state')
  }
  catch {
    // Someone saved in between: stop auto, say so loudly, keep the typing.
    // Nothing is overwritten and nothing is retried silently.
    autoMati.value = true
    autoState.value = 'bersih'
    toast.add({ title: 'Auto nonaktif — data berubah di tempat lain', description: 'Ketik ulang Simpan manual untuk menimpa, atau muat ulang dulu.', color: 'warning' })
  }
}

const sibuk = ref(false)
async function simpan(tabId: string, lanjut?: string) {
  const e = ev.value
  if (!e || !bisaUbah.value) return
  clearTimeout(autoTimer)
  sibuk.value = true
  try {
    const patch: Record<string, unknown> = { ...draf.value.atas, detail: draf.value.detail, payments: draf.value.payments }
    if (tabId === 'finance') {
      const centang = !!draf.value.detail.dpPaid
      const s = sinkronDpMkt({ ...e, detail: draf.value.detail, payments: draf.value.payments } as EventMkt, centang, noKwitansiMkt(st.value.settings), saya.value?.user.name ?? '')
      patch.payments = s.payments
      draf.value.payments = [...(s.payments ?? [])]
      if (s.lahir) {
        try {
          const dok = await getDokumenMkt('settings')
          const kini = (dok.data ?? {}) as SettingsMkt
          await simpanDokumenMkt('settings', { ...kini, kwSeq: seqBerikutMkt(kini as SettingsMkt) }, versiDokumenMkt(dok))
        }
        catch {
          // Number already handed out; a repeated sequence is a cutover check (K), not a blocker.
        }
      }
    }
    const judul = tabs.value.find(t => t.id === tabId)?.title ?? ''
    const grand = eventFinance({ ...e, detail: draf.value.detail, payments: patch.payments } as EventMkt, st.value.settings).grand
    const ok = await mktSimpan(
      () => tambalMkt<EventMkt>('events', e.id, patch, e.updatedAt),
      tabId === 'finance' ? `Finance tersimpan · Grand Total ${rupiah(grand)}` : `${judul} disimpan`,
      { refType: 'event', refId: e.id, action: `Detail diperbarui: ${judul}`, detail: `tab ${tabId}` },
    )
    if (!ok) return
    autoMati.value = false
    if (lanjut) tab.value = lanjut
    // Detailing never locks the stage, so remind (not on "Simpan & Lanjut": it breaks the flow).
    else if (TAHAP_TERBUKA_MKT.includes(e.status)) setTimeout(() => toast.add({ title: 'Jangan lupa tahapnya', description: `Peluang masih "${e.status}". Perbarui tahap pipeline bila sudah ada kemajuan.` }), 700)
  }
  finally {
    sibuk.value = false
  }
}

// ---- tahap: "Pindah ke" and Konfirmasi Deal share one confirm ----
const tahapKe = ref<string | null>(null)
const tahapBuka = computed({ get: () => !!tahapKe.value, set: (v) => {
  if (!v) tahapKe.value = null
} })
function mintaTahap(ke: string) {
  const e = ev.value
  if (!e || !bisaUbah.value || e.status === ke) return
  const tolak = pindahBolehMkt(e, ke)
  if (tolak) {
    toast.add({ title: 'Belum bisa ke Quotation Terkirim', description: tolak, color: 'error' })
    return
  }
  tahapKe.value = ke
}
async function pindahTahap() {
  const e = ev.value
  const ke = tahapKe.value
  if (!e || !ke) return
  const dari = e.status
  const ingat = ingatTahapMkt(e, ke)
  const ubah: Partial<EventMkt> = { pipeCol: ke, status: ke }
  tahapKe.value = null
  const ok = await mktSimpan(
    () => tambalMkt<EventMkt>('events', e.id, ubah, e.updatedAt),
    ke === 'Deal' ? undefined : `Tahap diperbarui · ${dari} → ${ke}`,
    { refType: 'event', refId: e.id, action: 'Tahap diubah', detail: `${dari} → ${ke}` },
  )
  if (!ok) return
  if (ke === 'Deal') toast.add({ title: 'Deal!', description: `${e.nama} masuk tahap eksekusi.`, color: 'success' })
  if (ingat) setTimeout(() => toast.add({ title: 'Data dasar belum lengkap', description: ingat, color: 'warning' }), 700)
}

// ---- Pengakuan Omset (menuFixCard) ----
const infoMenuFix = computed(() => MENU_FIX_MKT.find(x => x.v === menuFixMkt(ev.value)))
async function setMenuFix(v: string) {
  const e = ev.value
  if (!e || !bisaUbah.value || menuFixMkt(e) === v) return
  const t = MENU_FIX_MKT.find(x => x.v === v)?.t ?? '—'
  await mktSimpan(
    () => tambalMkt<EventMkt>('events', e.id, { menuFix: v } as Partial<EventMkt>, e.updatedAt),
    `${t}.`, { refType: 'event', refId: e.id, action: 'Pengakuan omset diubah', detail: `${t} · ${e.nama}` },
  )
}

// ---- Tandai Selesai ----
const selesaiBuka = ref(false)
async function tandaiSelesai() {
  const e = ev.value
  if (!e) return
  selesaiBuka.value = false
  await mktSimpan(
    () => tambalMkt<EventMkt>('events', e.id, { status: 'Event Done', pipeCol: 'Event Done' }, e.updatedAt),
    'Event selesai', { refType: 'event', refId: e.id, action: 'Status → Event Done', detail: 'ditandai manual' },
  )
}

// ---- Hapus permanen (ketik nama, lepas kunci dulu) ----
const hapusBuka = ref(false)
const hapusNama = ref('')
const hapusSibuk = ref(false)
const ringkasHapus = computed(() => (ev.value ? ringkasHapusMkt(ev.value, st.value.followups.filter(f => f.eventId === id.value).length) : null))
async function hapus() {
  const e = ev.value
  if (!e || !can('del_event')) return
  if (!namaCocok(hapusNama.value, e.nama)) {
    toast.add({ title: 'Nama tidak cocok', description: 'Ketik nama event persis untuk mengonfirmasi hapus permanen.', color: 'error' })
    return
  }
  hapusSibuk.value = true
  try {
    const lepas = await lepasKunciMejaMkt(e.id)
    toast.add({ title: lepas.ok ? 'Kunci meja' : 'Kunci meja gagal', description: lepas.pesan, color: lepas.ok ? 'success' : 'error' })
    const ok = await mktSimpan(
      () => hapusMkt('events', e.id, e.updatedAt),
      'Event dihapus permanen', { refType: 'event', refId: e.id, action: 'Event dihapus', detail: e.nama },
    )
    if (ok) {
      hapusBuka.value = false
      router.replace('/marketing/pipeline?tab=events')
    }
  }
  finally {
    hapusSibuk.value = false
  }
}

// ---- follow up ----
const fuBuka = ref(false)
const jumlahSurat = computed(() => st.value.events.filter(e => e.penawaran?.noSurat).length)
const keBrief = (mode: string) => router.push({ path: '/marketing/brief', query: { id: id.value, mode } })

// ---- Ringkasan Pengisian (ringkasIsianHTML): live from the draft ----

/**
 * A summary chip jumps to its section: switch tab, wait for the form to
 * render, scroll the section into view and ring it for a moment, so the move
 * is visible (a bare tab switch under the fold looked like nothing happened).
 */
async function lompatSeksi(s: { tab: string, id: string }) {
  tab.value = s.tab
  await nextTick()
  await new Promise(r => requestAnimationFrame(() => r(null)))
  const el = document.getElementById(`seksi-${s.id}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  el.classList.add('ring-2', 'ring-gold', 'shadow-lg')
  setTimeout(() => el.classList.remove('ring-2', 'ring-gold', 'shadow-lg'), 1600)
}
const ringkas = computed(() => {
  const e = evDraf.value
  if (!e) return null
  const secs = tabs.value.filter(t => t.id !== 'overview').flatMap(t => seksiTab(t.id).map((s) => {
    const p = progresSeksiMkt(e, s)
    return { tab: t.id, id: s.id, n: s.n, title: s.title, ...p }
  })).filter(s => s.total)
  if (!secs.length) return null
  const isi = secs.reduce((a, s) => a + s.isi, 0)
  const total = secs.reduce((a, s) => a + s.total, 0)
  return { secs, isi, total, pct: total ? Math.round(isi / total * 100) : 0, kurang: secs.filter(s => s.isi < s.total).length }
})

// ---- Overview (renderOverview): a read-only summary document ----
// Simple fields stay a label–value list; rundown/files/menu/item tables,
// images and the Rincian Tagihan table draw rich blocks (MarketingOverviewIsi).
const overview = computed(() => {
  const e = ev.value
  if (!e) return { secs: [], isi: 0, total: 0 }
  let isi = 0
  let total = 0
  const settings = st.value?.settings ?? {}
  const secs = seksiLihat.value.map((s) => {
    const p = progresSeksiMkt(e, s)
    isi += p.isi
    total += p.total
    const baris = s.fields
      .filter(f => !['head', 'mirror', 'salinlayout', 'mejalock'].includes(f.t) && f.k !== 'highlight')
      .map((f) => {
        const raw = (e.detail ?? {})[f.k] ?? (e as unknown as Record<string, unknown>)[f.k]
        // The tagihan table is computed, like the finance tab (rincianPenawaran).
        const t = f.k === 'rincianItem' ? 'rincitbl' : f.t
        const isi = t === 'rincitbl' ? rincianPenawaran(e, settings) : raw
        return { k: f.k, l: f.l, t, raw: isi, ringkas: ringkasNilaiMkt(f.t, raw) }
      })
      .filter(b => adaIsiOverviewMkt(b.t, b.raw, b.ringkas))
    return { id: s.id, n: s.n, title: s.title, baris }
  }).filter(s => s.baris.length)
  return { secs, isi, total }
})
const sorot = computed(() => String((ev.value?.detail ?? {}).highlight ?? '').trim())
</script>

<template>
  <AppPage
    :title="ev?.nama ?? 'Detail Event'"
    :description="ev ? `${client?.nama ?? ''} · ${rentangTglMkt(ev)}` : ''"
    :back="{ label: 'Daftar', to: '/marketing/pipeline?tab=events' }"
  >
    <template
      v-if="ev"
      #actions
    >
      <UButton
        label="Event Brief"
        icon="i-lucide-book-open"
        color="neutral"
        variant="outline"
        @click="keBrief('internal')"
      />
      <UButton
        v-if="bisaUbah && terbuka"
        label="Catat FU"
        icon="i-lucide-phone-call"
        color="neutral"
        variant="outline"
        @click="fuBuka = true"
      />
      <AppStatus
        v-if="sisaApprovalLama"
        color="warning"
        icon="i-lucide-hourglass"
      >
        Sisa approval lama menunggu
      </AppStatus>
      <UButton
        v-if="bisaUbah && !['Confirmed', 'Deal', 'Event Done', 'Lost'].includes(ev.status)"
        label="Konfirmasi Deal"
        icon="i-lucide-check"
        @click="mintaTahap('Deal')"
      />
      <UButton
        v-if="bisaUbah && ['Confirmed', 'Deal'].includes(ev.status)"
        label="Tandai Event Selesai"
        icon="i-lucide-flag"
        color="neutral"
        variant="outline"
        @click="selesaiBuka = true"
      />
      <UButton
        v-if="can('del_event')"
        icon="i-lucide-trash-2"
        color="error"
        variant="outline"
        aria-label="Hapus event permanen"
        title="Hapus event permanen"
        @click="hapusBuka = true; hapusNama = ''"
      />
    </template>

    <MarketingGerbang
      v-if="!ev"
      layar="event"
    >
      <AppPanel v-if="status === 'pending'">
        <div class="space-y-3">
          <div class="flex flex-wrap gap-1.5">
            <USkeleton class="h-6 w-24" />
            <USkeleton class="h-6 w-20" />
            <USkeleton class="h-6 w-28" />
          </div>
          <USkeleton class="h-24 w-full" />
          <USkeleton class="h-40 w-full" />
        </div>
      </AppPanel>
      <AppPanel v-else>
        <p class="py-6 text-center text-sm text-muted">
          <b class="block text-base text-highlighted">Event tidak ditemukan</b>
          Kembali ke daftar event.
        </p>
      </AppPanel>
    </MarketingGerbang>

    <template v-else>
      <div class="mb-4 flex flex-wrap gap-1.5">
        <AppStatus
          :color="warnaStatusMkt(ev.status)"
          :icon="ikonStatusMkt(ev.status)"
        >
          {{ ev.status }}
        </AppStatus>
        <UBadge
          :label="ev.jenis || '—'"
          color="neutral"
          variant="soft"
        />
        <UBadge
          :label="tglMkt(ev.tanggal)"
          color="neutral"
          variant="soft"
        />
        <UBadge
          :label="`${ev.pax || 0} pax`"
          color="neutral"
          variant="soft"
        />
      </div>

      <!-- double booking (bookingConflicts) -->
      <UAlert
        v-if="bentrok.length"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Bentrok jadwal — ${bentrok.length} event lain di tanggal yang sama`"
        class="mb-4"
      >
        <template #description>
          <p>
            <template
              v-for="(x, i) in bentrok"
              :key="x.id"
            >
              {{ i ? " · " : "" }}
              <NuxtLink
                :to="`/marketing/event/${x.id}`"
                class="underline"
              >{{ x.nama }}</NuxtLink>
              ({{ (x.detail ?? {}).area || 'area belum diisi' }} · {{ x.status }})
            </template>
          </p>
          <p class="mt-1">
            Cek ulang area/lantai sebelum konfirmasi supaya tidak dobel booking.
          </p>
        </template>
      </UAlert>

      <!-- stage reminder: detailing never locks the stage -->
      <div
        v-if="terbuka"
        class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-warning/40 bg-warning/10 px-4 py-3"
      >
        <div class="flex items-start gap-2.5">
          <UIcon
            name="i-lucide-triangle-alert"
            class="mt-0.5 size-5 shrink-0 text-warning"
          />
          <div>
            <b class="text-sm text-highlighted">Peluang masih di tahap {{ ev.status }}</b>
            <p class="text-xs text-muted">
              Boleh diisi kapan saja — tapi kalau sudah ada kemajuan, jangan lupa perbarui tahapnya.
            </p>
          </div>
        </div>
        <div
          v-if="bisaUbah"
          class="flex items-center gap-2"
        >
          <span class="text-xs text-muted">Pindah ke</span>
          <USelect
            :model-value="ev.status"
            :items="PIPE_COLS_MKT.map(c => String(c))"
            class="w-48"
            @update:model-value="mintaTahap(String($event))"
          />
        </div>
      </div>

      <AppStatGrid
        v-if="uang"
        :loading="statMemuat"
        :count="3"
      >
        <AppStat
          label="Grand Total"
          :value="rupiah(uang.grand)"
          sub="Total tagihan acara"
          icon="i-lucide-receipt"
        />
        <AppStat
          :label="dpLabel(uang)"
          :value="rupiah(uang.dp)"
          :sub="uang.paid >= uang.dp ? 'Terpenuhi' : 'Belum masuk'"
          icon="i-lucide-wallet"
          :tone="uang.paid >= uang.dp ? 'success' : 'warning'"
        />
        <AppStat
          label="Sisa Tagihan"
          :value="rupiah(uang.remaining)"
          :sub="`terbayar ${rupiah(uang.paid)} dari ${rupiah(uang.grand)}`"
          icon="i-lucide-hourglass"
          :tone="uang.remaining > 0 ? 'error' : 'success'"
        />
      </AppStatGrid>

      <MarketingPenawaran
        v-if="canView('pipeline')"
        :key="`pen-${ev.updatedAt}`"
        v-model:revisi="revisiMinta"
        :ev="ev"
        :settings="st.settings"
        :jumlah-surat="jumlahSurat"
        :nama-client="client?.nama ?? ''"
        :client-hp="client?.hp ?? ''"
        :bisa-ubah="bisaUbah"
        :bisa-putus="can('approve')"
        :saya-id="saya?.user.id ?? ''"
        :saya-nama="saya?.user.name ?? ''"
        class="mb-5"
        @deal="mintaTahap('Deal')"
      />

      <AppPanel
        title="Pengakuan Omset"
        icon="i-lucide-banknote"
      >
        <template #actions>
          <AppStatus
            v-if="infoMenuFix"
            color="success"
            icon="i-lucide-check"
          >
            {{ infoMenuFix.t }}
          </AppStatus>
          <AppStatus
            v-else
            color="warning"
            icon="i-lucide-circle-help"
          >
            Menu belum ditentukan
          </AppStatus>
        </template>
        <AppSeg
          :model-value="menuFixMkt(ev)"
          :options="MENU_FIX_MKT.map(x => ({ value: x.v as string, label: x.t }))"
          :class="bisaUbah ? '' : 'pointer-events-none opacity-70'"
          @update:model-value="setMenuFix(String($event))"
        />
        <p
          v-if="infoMenuFix"
          class="mt-2 text-xs text-muted"
        >
          {{ infoMenuFix.d }}
        </p>
        <p
          v-else
          class="mt-2 text-xs text-warning"
        >
          <b>Belum ditentukan.</b> {{ MENU_FIX_KOSONG_MKT }}
        </p>
      </AppPanel>

      <AppPanel
        title="Riwayat Follow Up"
        :count="fuEvent.length"
      >
        <p
          v-if="!fuEvent.length"
          class="text-sm text-muted"
        >
          Belum ada follow up untuk peluang ini.
        </p>
        <ol
          v-else
          class="grid gap-3 border-l-2 border-default pl-4"
        >
          <li
            v-for="f in fuEvent"
            :key="f.id"
            class="text-sm"
          >
            <p class="text-xs text-muted num">
              {{ String(f.at).replace('T', ' ').slice(0, 16) }} · {{ namaUser(f.by) }}
            </p>
            <p class="font-medium text-highlighted">
              {{ f.action }} → {{ f.hasil }}
            </p>
            <p
              v-if="f.note"
              class="text-muted"
            >
              {{ f.note }}
            </p>
          </li>
        </ol>
      </AppPanel>

      <AppPanel v-if="ringkas">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-primary-700">
              Ringkasan pengisian
            </p>
            <p class="mt-1 num">
              <b class="text-3xl text-highlighted">{{ ringkas.isi }}</b><span class="text-muted">/{{ ringkas.total }}</span>
              <span class="ml-2 text-sm font-semibold text-primary-700">{{ ringkas.pct }}%</span>
            </p>
          </div>
          <p class="text-sm text-muted">
            {{ ringkas.kurang ? `${ringkas.kurang} seksi masih ada yang kosong` : 'Semua isian sudah lengkap' }}
          </p>
        </div>
        <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-elevated">
          <div
            class="h-full rounded-full bg-primary-400"
            :style="{ width: `${ringkas.pct}%` }"
          />
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <!-- A chip is a jump: open its tab, scroll to the section, ring it briefly.
               Bigger targets with a hover lift; the open tab's chips are ringed. -->
          <button
            v-for="s in ringkas.secs"
            :key="s.id"
            type="button"
            class="group flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] transition-[transform,box-shadow,filter] duration-150 hover:-translate-y-px hover:shadow-md hover:brightness-[0.97] focus-visible:outline-2 focus-visible:outline-primary"
            :class="[
              s.isi >= s.total ? 'border-success/40 bg-teal-light' : s.isi === 0 ? 'border-error/40 bg-coral-light' : 'border-warning/40 bg-yellow-light',
              s.tab === tab ? 'ring-2 ring-gold/70' : '',
            ]"
            :title="`Buka ${s.n} ${s.title} — ${s.isi} dari ${s.total} isian terisi`"
            @click="lompatSeksi(s)"
          >
            <!-- Number and count follow the section status colour; title stays highlighted for readability. -->
            <span
              class="font-bold num"
              :class="s.isi >= s.total ? 'text-success' : s.isi === 0 ? 'text-error' : 'text-warning'"
            >{{ s.n }}</span>
            <span class="text-highlighted">{{ s.title }}</span>
            <span
              class="num"
              :class="s.isi >= s.total ? 'text-success' : s.isi === 0 ? 'text-error' : 'text-warning'"
            >{{ s.isi }}/{{ s.total }}</span>
            <UIcon
              name="i-lucide-arrow-down-right"
              class="size-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>
        </div>
      </AppPanel>

      <div class="sticky top-[52px] z-[5] -mx-4 mb-5 bg-default/95 px-4 py-2 backdrop-blur-sm lg:-mx-6 lg:top-[60px] lg:px-6 2xl:-mx-10 2xl:px-10">
        <AppSeg
          v-model="tab"
          :options="tabs.map(t => ({ value: t.id, label: `${t.n}. ${t.title}` }))"
        />
      </div>

      <template v-if="tabKini">
        <!-- Overview ↔ form replaces the working surface, so the swap crossfades. -->
        <Transition
          name="mkt-swap"
          mode="out-in"
        >
          <!-- 4 · Overview: the summary document, read-only -->
          <article
            v-if="tabKini.id === 'overview'"
            key="overview"
            class="mx-auto w-full max-w-[860px] rounded-xl border border-default bg-default p-4 text-sm sm:p-6 print:max-w-none print:rounded-none print:border-0 print:shadow-none"
          >
            <header class="mb-4 flex flex-wrap items-center gap-3 border-b-4 border-brand-yellow pb-4">
              <img
                src="/mark.png"
                alt=""
                class="size-11 shrink-0 object-contain"
              >
              <div class="min-w-[160px] flex-1">
                <p class="font-display text-xl font-bold text-highlighted">
                  Laksamana Muda
                </p>
                <p class="text-[10px] tracking-[0.2em] text-yellow-dark">
                  COFFEE &amp; LIVE SPACE
                </p>
              </div>
              <div class="min-w-[180px] text-right">
                <p class="text-[10px] font-bold tracking-[0.15em] text-yellow-dark">
                  RANGKUMAN EVENT
                </p>
                <p class="mt-1 font-display text-lg font-bold text-highlighted">
                  {{ ev.nama || '—' }}
                </p>
                <p class="text-xs text-muted">
                  {{ rentangTglMkt(ev) }}
                </p>
              </div>
            </header>

            <div class="mb-3 grid gap-x-6 gap-y-1 rounded-lg bg-muted px-4 py-3 text-sm sm:grid-cols-2">
              <p><b>Client</b> · {{ client?.nama ?? '—' }}{{ client?.perusahaan ? ` — ${client.perusahaan}` : '' }}</p>
              <p><b>Marketing PIC</b> · {{ namaUser(ev.mktPIC) }}</p>
              <p><b>Jenis</b> · {{ ev.jenis || '—' }}</p>
              <p><b>Estimasi</b> · {{ ev.pax || '—' }} pax</p>
            </div>
            <div class="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted">
              <div class="h-1.5 w-64 max-w-full overflow-hidden rounded-full bg-ink-200">
                <div
                  class="h-full bg-brand-yellow"
                  :style="{ width: `${overview.total ? Math.round(overview.isi / overview.total * 100) : 0}%` }"
                />
              </div>
              <span class="num"><b class="text-highlighted">{{ overview.isi }}</b> dari {{ overview.total }} isian terisi ({{ overview.total ? Math.round(overview.isi / overview.total * 100) : 0 }}%)</span>
            </div>
            <div
              v-if="sorot"
              class="mb-4 rounded-r-lg border-l-4 border-yellow-deep bg-yellow-light px-4 py-3 text-sm"
            >
              <p class="mb-1 text-[10px] font-bold tracking-[0.14em] text-yellow-dark">
                POIN PENTING
              </p>
              <p class="whitespace-pre-line leading-relaxed">
                {{ sorot }}
              </p>
            </div>
            <p
              v-if="!overview.secs.length"
              class="text-sm text-muted"
            >
              Belum ada isian sama sekali.
            </p>
            <section
              v-for="s in overview.secs"
              :key="s.id"
              class="mb-5 break-inside-avoid last:mb-0"
            >
              <h3 class="mb-2 flex items-center gap-2 border-b border-default pb-2 text-sm font-semibold text-highlighted">
                <span class="flex h-6 min-w-10 items-center justify-center rounded-md bg-yellow-light px-2 text-xs font-bold text-yellow-dark num">
                  {{ s.n }}
                </span>
                {{ s.title }}
              </h3>
              <MarketingOverviewIsi
                v-if="ev"
                :baris="s.baris"
                :ev="ev"
                :settings="st.settings"
              />
            </section>
          </article>

          <!-- 1–3 · form tabs: one card per section, one save row for the tab -->
          <div
            v-else
            key="form"
          >
            <MarketingEventForm
              :key="`${tabKini.id}-${ev.updatedAt}`"
              v-model:draft="draf"
              :ev="ev"
              :seksi="seksiTab(tabKini.id)"
              :bisa-ubah="bisaUbah"
              :fb-formats="formatFbMkt(st)"
              :staff-names="st.users.map(u => u.name)"
              :events="st.events"
            >
              <template #finance>
                <MarketingFinanceEvent
                  :key="`fin-${ev.updatedAt}`"
                  v-model:draft="draf"
                  :ev="ev"
                  :nama-client="client?.nama ?? ''"
                  :client-hp="client?.hp ?? ''"
                  :settings="st.settings"
                  :bisa-ubah="bisaUbah"
                  :bisa-verif="bisaVerif"
                  :saya-nama="saya?.user.name ?? ''"
                />
              </template>
            </MarketingEventForm>
            <div
              v-if="bisaUbah"
              class="flex flex-wrap items-center justify-end gap-2"
            >
              <span
                v-if="autoState === 'menyimpan'"
                class="text-xs text-muted"
              >Menyimpan…</span>
              <span
                v-else-if="autoMati"
                class="text-xs text-warning"
              >Auto nonaktif — data berubah di tempat lain.</span>
              <span
                v-else-if="autoWaktu && tabKini.id !== 'finance'"
                class="text-xs text-muted"
              >Tersimpan otomatis {{ autoWaktu }}</span>
              <UButton
                :label="`Simpan ${tabKini.title}`"
                icon="i-lucide-check"
                color="neutral"
                variant="outline"
                :loading="sibuk"
                @click="simpan(tabKini.id)"
              />
              <UButton
                v-if="tabLanjut(tabKini.id)"
                :label="`Simpan & Lanjut · ${tabLanjut(tabKini.id)!.title}`"
                trailing-icon="i-lucide-chevron-right"
                :loading="sibuk"
                @click="simpan(tabKini.id, tabLanjut(tabKini.id)!.id)"
              />
            </div>
          </div>
        </Transition>
      </template>

      <ResponsiveSheet
        v-model:open="tahapBuka"
        :title="tahapKe === 'Deal' ? 'Konfirmasi Deal?' : `Ubah tahap ke ${tahapKe}?`"
        :description="ev.nama"
      >
        <p class="text-sm text-muted">
          Tahapnya berubah dari <b>{{ ev.status }}</b> jadi <b>{{ tahapKe }}</b>.
          <template v-if="tahapKe === 'Deal'">
            Event masuk tahap eksekusi.
          </template>
          <template v-if="tahapKe === 'Lost'">
            Event ini berhenti dihitung sebagai peluang aktif.
          </template>
        </p>
        <UAlert
          v-if="tahapKe === 'Deal' && bentrok.length"
          color="error"
          variant="subtle"
          class="mt-3"
          :description="`Bentrok jadwal dengan ${bentrok.map(x => x.nama).join(', ')}. Cek ulang area sebelum Deal.`"
        />
        <div class="mt-4 flex justify-end gap-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="ghost"
            @click="tahapKe = null"
          />
          <UButton
            :label="tahapKe === 'Deal' ? 'Ya, Deal' : 'Ya, ubah'"
            loading-auto
            @click="pindahTahap"
          />
        </div>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="selesaiBuka"
        title="Tandai Event Selesai?"
        :description="`${ev.nama} · ${ev.tanggal}`"
      >
        <div class="grid gap-2 text-sm">
          <p class="text-muted">
            Statusnya berubah jadi <b>Event Done</b>: event keluar dari daftar peluang aktif dan omzetnya dihitung sebagai belanja klien.
          </p>
          <UAlert
            v-if="uang && uang.remaining > 0"
            color="error"
            variant="subtle"
            :description="`Sisa tagihan ${rupiah(uang.remaining)} belum lunas. Menandai selesai TIDAK menutup tagihannya — invoice tetap berjalan.`"
          />
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="ghost"
            @click="selesaiBuka = false"
          />
          <UButton
            label="Ya, Event Selesai"
            loading-auto
            @click="tandaiSelesai"
          />
        </div>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="hapusBuka"
        title="Hapus Event Permanen?"
        :description="ev.nama"
      >
        <div class="grid gap-2 text-sm">
          <p class="text-muted">
            Hapus = permanen: event, {{ ringkasHapus?.nBayar ?? 0 }} pembayaran ({{ (ringkasHapus?.kwitansi ?? []).join(', ') || '—' }}), follow up, approval & notifikasi terkait ikut terbuang. Meja dilepas dulu di modul Reservasi.
          </p>
          <UAlert
            v-if="(ringkasHapus?.terbayar ?? 0) > 0"
            color="error"
            variant="subtle"
            :description="`Sudah terbayar ${rupiah(ringkasHapus?.terbayar ?? 0)}. Menghapus tidak mengembalikan uangnya.`"
          />
          <UFormField
            label="Ketik nama event persis untuk mengonfirmasi"
            required
          >
            <UInput
              v-model="hapusNama"
              :placeholder="ev.nama"
            />
          </UFormField>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="ghost"
            @click="hapusBuka = false"
          />
          <UButton
            label="Hapus Permanen"
            color="error"
            :loading="hapusSibuk"
            @click="hapus"
          />
        </div>
      </ResponsiveSheet>

      <MarketingFollowUp
        v-model:open="fuBuka"
        :client-id="ev.clientId"
        :event-id="ev.id"
      />
    </template>
  </AppPage>
</template>
