<!--
  Marketing › Detail Event (docs/migrasi/marketing.md D.4, issue #59): the full
  four-tab form — 1 Informasi Dasar, 2 Operasional, 3 Finance, 4 Overview —
  over sections D.1–D.11 with per-division visibility, the offer-letter card,
  payment recording with mandatory proof, WhatsApp invoice + DP reminder, table
  locks against Reservasi, and permanent delete by typed name.

  Every save is a versioned PATCH of {row keys, detail, payments}; 409/428
  reloads through mktSimpan (marketing.md F.1).
-->
<script setup lang="ts">
import type { EventMkt, SettingsMkt } from '~/utils/marketing'
import {
  TAHAP_TERBUKA_MKT, ingatTahapMkt, menuFixMkt, namaCocok,
  pindahBolehMkt, rentangTglMkt, tugasDealMkt,
} from '~/utils/marketing'
import type { DrafEventMkt } from '~/utils/marketing-event'
import {
  KUNCI_ATAS_EVENT_MKT, kurangWajibMkt,
  noKwitansiMkt, progresSeksiMkt, ringkasHapusMkt,
  ringkasNilaiMkt, seqBerikutMkt, sinkronDpMkt, tabTerlihatMkt, terlihatSeksiMkt,
} from '~/utils/marketing-event'
import { dpLabel, eventFinance, invStatus } from '~/utils/marketing-uang'
import { ikonStatusMkt, warnaStatusMkt } from '~/utils/status-marketing'
import { formatFbMkt, getDokumenMkt, hapusMkt, lepasKunciMejaMkt, mktSimpan, simpanDokumenMkt, tambalMkt, useAksesMkt, useStateMkt, versiDokumenMkt } from '~/composables/useMarketing'
import { hariIni, rupiah } from '~/utils/format'

definePageMeta({ access: ['marketing'] })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { data: st, status } = useStateMkt()
const { saya, can, canView } = useAksesMkt()

const id = computed(() => String(route.params.id))
const ev = computed(() => st.value.events.find(e => e.id === id.value) ?? null)
const client = computed(() => st.value.clients.find(c => c.id === ev.value?.clientId))
const fuEvent = computed(() => st.value.followups.filter(f => f.eventId === id.value).slice(-3).reverse())

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

const uang = computed(() => (ev.value ? eventFinance(ev.value, st.value.settings) : null))
const inv = computed(() => (ev.value ? invStatus(ev.value, st.value.settings, hariIni()) : ''))
const bisaUbah = computed(() => can('edit_event'))
const bisaVerif = computed(() => can('verify_payment'))

// ---- draft ----
const draf = ref<DrafEventMkt>({ atas: {}, detail: {}, payments: [] })
watch(() => ev.value?.updatedAt, () => {
  const e = ev.value
  if (!e) return
  const atas: Record<string, unknown> = {}
  for (const k of KUNCI_ATAS_EVENT_MKT) atas[k] = (e as unknown as Record<string, unknown>)[k]
  draf.value = { atas, detail: { ...(e.detail ?? {}) }, payments: [...(e.payments ?? [])] }
}, { immediate: true })

const sibuk = ref(false)
async function simpan(tabId: string, lanjut?: string) {
  const e = ev.value
  if (!e || !bisaUbah.value) return
  const kurang = tabId === 'finance'
    ? []
    : kurangWajibMkt({ ...e, ...draf.value.atas, detail: draf.value.detail } as EventMkt, tabId === 'overview' ? seksiLihat.value : seksiTab(tabId))
  if (kurang.length) {
    toast.add({ title: 'Belum lengkap', description: `Lengkapi dulu: ${kurang.slice(0, 3).join('; ')}${kurang.length > 3 ? ` (+${kurang.length - 3} lagi)` : ''}.`, color: 'error' })
    return
  }
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
    const ok = await mktSimpan(
      () => tambalMkt<EventMkt>('events', e.id, patch, e.updatedAt),
      tabId === 'finance' ? 'Finance tersimpan' : `Tab ${tabs.value.find(t => t.id === tabId)?.title ?? ''} tersimpan`,
      { refType: 'event', refId: e.id, action: 'Detail event diubah', detail: `tab ${tabId}` },
    )
    if (ok && lanjut) tab.value = lanjut
  }
  finally {
    sibuk.value = false
  }
}

// ---- Konfirmasi Deal (pipeline minta flow) ----
const dealBuka = ref(false)
function mintaDeal() {
  const e = ev.value
  if (!e || !bisaUbah.value) return
  const tolak = pindahBolehMkt(e, 'Deal')
  if (tolak) {
    toast.add({ title: 'Belum bisa Deal', description: tolak, color: 'error' })
    return
  }
  dealBuka.value = true
}
async function pindahDeal() {
  const e = ev.value
  if (!e) return
  const ingat = ingatTahapMkt(e, 'Deal')
  dealBuka.value = false
  const ok = await mktSimpan(
    () => tambalMkt<EventMkt>('events', e.id, { pipeCol: 'Deal', status: 'Deal', tasks: tugasDealMkt(e, formatFbMkt(st.value)) }, e.updatedAt),
    undefined, { refType: 'event', refId: e.id, action: 'Pipeline dipindah', detail: `${e.status} → Deal` },
  )
  if (!ok) return
  toast.add({ title: 'Deal!', description: `${e.nama} masuk tahap eksekusi & handover divisi.`, color: 'success' })
  if (ingat) setTimeout(() => toast.add({ title: 'Data dasar belum lengkap', description: ingat, color: 'warning' }), 700)
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
const progresTab = (tabId: string) => {
  const ss = tabId === 'overview' ? seksiLihat.value : seksiTab(tabId)
  return ss.reduce((a, s) => {
    const p = progresSeksiMkt({ ...(ev.value as EventMkt), ...draf.value.atas, detail: draf.value.detail } as EventMkt, s)
    return { isi: a.isi + p.isi, total: a.total + p.total }
  }, { isi: 0, total: 0 })
}
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
        v-if="bisaUbah && TAHAP_TERBUKA_MKT.includes(ev.status)"
        label="Catat FU"
        icon="i-lucide-phone-call"
        color="neutral"
        variant="outline"
        @click="fuBuka = true"
      />
    </template>

    <MarketingGerbang
      v-if="!ev"
      layar="event"
    >
      <AppPanel>
        <p class="py-6 text-center text-sm text-muted">
          <b class="block text-base text-highlighted">{{ status === 'pending' ? 'Memuat…' : 'Event tidak ditemukan' }}</b>
          <template v-if="status !== 'pending'">
            Kembali ke daftar event.
          </template>
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
          :label="`${ev.pax || 0} pax`"
          color="neutral"
          variant="soft"
        />
        <AppStatus
          v-if="!menuFixMkt(ev)"
          color="warning"
          icon="i-lucide-circle-help"
        >
          Menu belum ditentukan
        </AppStatus>
      </div>

      <AppPanel
        v-if="uang"
        title="Keuangan"
        class="mb-5"
      >
        <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <p><span class="text-muted">Grand total </span><b class="num">{{ rupiah(uang.grand) }}</b></p>
          <p><span class="text-muted">{{ dpLabel(uang) }}&nbsp;</span><b class="num">{{ rupiah(uang.dp) }}</b></p>
          <p><span class="text-muted">Terbayar </span><b class="num">{{ rupiah(uang.paid) }}</b></p>
          <p><span class="text-muted">Sisa </span><b class="num">{{ rupiah(uang.remaining) }}</b></p>
          <p><span class="text-muted">Invoice </span><b>{{ inv }}</b></p>
        </div>
      </AppPanel>

      <MarketingPenawaran
        v-if="canView('pipeline')"
        :key="`pen-${ev.updatedAt}`"
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
        @deal="mintaDeal"
      />

      <AppSeg
        v-model="tab"
        :options="tabs.map(t => ({ value: t.id, label: `${t.n}. ${t.title}` }))"
        class="mb-5"
      />

      <template
        v-for="t in tabs"
        :key="t.id"
      >
        <div v-show="tab === t.id">
          <template v-if="t.id === 'finance'">
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
            <div
              v-if="bisaUbah"
              class="mt-4 flex flex-wrap gap-2"
            >
              <UButton
                label="Simpan Finance"
                :loading="sibuk"
                @click="simpan('finance')"
              />
            </div>
          </template>
          <template v-else-if="t.id === 'overview'">
            <div class="grid gap-5">
              <AppPanel
                v-for="s in seksiLihat"
                :key="s.id"
                :title="`${s.n} · ${s.title}`"
              >
                <dl
                  v-if="s.id !== 'finance' || roleSaya !== 'operational'"
                  class="grid gap-x-4 gap-y-1.5 text-sm lg:grid-cols-2"
                >
                  <template
                    v-for="f in s.fields.filter(x => !['head', 'mirror', 'salinlayout'].includes(x.t))"
                    :key="f.k"
                  >
                    <div
                      v-if="ringkasNilaiMkt(f.t, (ev.detail ?? {})[f.k] ?? (ev as unknown as Record<string, unknown>)[f.k])"
                      class="grid grid-cols-[10rem_1fr] gap-2"
                    >
                      <dt class="text-muted">
                        {{ f.l }}
                      </dt>
                      <dd class="whitespace-pre-line">
                        {{ ringkasNilaiMkt(f.t, (ev.detail ?? {})[f.k] ?? (ev as unknown as Record<string, unknown>)[f.k]) }}
                      </dd>
                    </div>
                  </template>
                </dl>
                <p class="mt-2 text-xs text-muted">
                  Terisi {{ progresSeksiMkt(ev, s).isi }}/{{ progresSeksiMkt(ev, s).total }}
                </p>
              </AppPanel>
              <AppPanel title="Tindak lanjut">
                <div class="flex flex-wrap gap-2">
                  <UButton
                    icon="i-lucide-users"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    label="Internal"
                    @click="keBrief('internal')"
                  />
                  <UButton
                    icon="i-lucide-handshake"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    label="Client"
                    @click="keBrief('client')"
                  />
                  <UButton
                    icon="i-lucide-file-edit"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    label="Draft"
                    @click="keBrief('quote')"
                  />
                  <UButton
                    v-if="bisaUbah && !['Event Done', 'Lost'].includes(ev.status)"
                    icon="i-lucide-flag"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    label="Tandai Selesai"
                    @click="selesaiBuka = true"
                  />
                  <UButton
                    v-if="can('del_event')"
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="outline"
                    size="sm"
                    label="Hapus Event"
                    @click="hapusBuka = true; hapusNama = ''"
                  />
                </div>
                <ul
                  v-if="fuEvent.length"
                  class="mt-3 grid gap-1.5 text-sm"
                >
                  <li
                    v-for="f in fuEvent"
                    :key="f.id"
                    class="text-muted"
                  >
                    <b class="text-highlighted">{{ f.action }}</b> · {{ f.hasil }} — {{ f.note }}
                  </li>
                </ul>
              </AppPanel>
            </div>
          </template>
          <template v-else>
            <MarketingEventForm
              :key="`${t.id}-${ev.updatedAt}`"
              v-model:draft="draf"
              :ev="ev"
              :seksi="seksiTab(t.id)"
              :bisa-ubah="bisaUbah"
              :fb-formats="formatFbMkt(st)"
              :staff-names="st.users.map(u => u.name)"
              :events="st.events"
            />
            <div
              v-if="bisaUbah"
              class="mt-4 flex flex-wrap gap-2"
            >
              <UButton
                :label="`Simpan ${t.title}`"
                :loading="sibuk"
                @click="simpan(t.id)"
              />
              <UButton
                v-if="t.id === 'basic'"
                label="Simpan & Lanjut · Operasional"
                color="neutral"
                variant="outline"
                :loading="sibuk"
                @click="simpan('basic', 'operasional')"
              />
            </div>
          </template>
          <p class="mt-2 text-xs text-muted">
            Terisi {{ progresTab(t.id).isi }}/{{ progresTab(t.id).total }} isian tab ini.
          </p>
        </div>
      </template>

      <ResponsiveSheet
        v-model:open="dealBuka"
        title="Konfirmasi Deal?"
        :description="ev.nama"
      >
        <p class="text-sm text-muted">
          Event masuk tahap eksekusi & handover divisi. Tahap selalu boleh naik — datanya dilengkapi menyusul.
        </p>
        <div class="mt-4 flex justify-end gap-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="ghost"
            @click="dealBuka = false"
          />
          <UButton
            label="Ya, Deal"
            @click="pindahDeal"
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
