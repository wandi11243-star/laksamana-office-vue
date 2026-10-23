<!--
  Marketing › Approval Flow (docs/migrasi/marketing.md D.11, issue #60):
  "Meja putusan manajemen" — one list for penawaran rows (from the events)
  and negotiation rows (from /approvals). Only Manager/Approver decides;
  a rejected negotiation drops the event to Lost so it never reaches invoice.
-->
<script setup lang="ts">
import type { BarisApprovalMkt } from '~/utils/marketing-keuangan'
import { barisApprovalMkt, rekapApprovalMkt } from '~/utils/marketing-keuangan'
import {
  buatMkt, logMkt, mktSimpan, tambalMkt, useAksesMkt, useStateMkt, useTabelMkt,
} from '~/composables/useMarketing'
import type { EventMkt, KolomMkt } from '~/utils/marketing'
import { rupiah, tglPendek } from '~/utils/format'

definePageMeta({ access: ['marketing'] })

const toast = useToast()
const { data: st } = useStateMkt()
const { can, saya } = useAksesMkt()
const bisaPutus = computed(() => can('approve'))

const semua = computed(() => barisApprovalMkt(st.value.events, st.value.approvals, st.value.settings))
const rekap = computed(() => rekapApprovalMkt(semua.value))

const tab = useState<'antri' | 'riwayat' | 'semua'>('mkt-appr-tab', () => 'antri')
const daftar = computed(() => {
  if (tab.value === 'antri') return semua.value.filter(r => r.antri)
  if (tab.value === 'riwayat') return semua.value.filter(r => !r.antri)
  return semua.value
})

// ---- decide ----
const putus = ref<{ r: BarisApprovalMkt, setuju: boolean } | null>(null)
const putusBuka = computed({ get: () => !!putus.value, set: (v) => {
  if (!v) putus.value = null
} })
const tolakNote = ref('')
async function kirimPutus() {
  const p = putus.value
  if (!p || !bisaPutus.value) return
  const { r, setuju } = p
  if (!setuju && !tolakNote.value.trim()) {
    toast.add({ title: 'Alasan wajib', description: 'Tulis alasan penolakan untuk perkara ini.', color: 'error' })
    return
  }
  if (r.kind === 'pen') {
    // A decided offer moves its event too: rejected slides back to Prospect,
    // an approved Lead/Prospect steps up to Approval — otherwise the board lies.
    const tahap = !setuju ? 'Prospect' : ['Lead', 'Prospect'].includes(String(r.ev.status ?? '')) ? 'Approval' : undefined
    const ok = await mktSimpan(
      () => tambalMkt<EventMkt>('events', r.ev.id, {
        penawaran: {
          ...(r.ev.penawaran ?? {}),
          status: setuju ? 'Disetujui' : 'Ditolak',
          approvedBy: saya.value?.user.id ?? '', approvedAt: new Date().toISOString(),
          rejectNote: setuju ? '' : tolakNote.value.trim(),
        },
        ...(tahap ? { status: tahap, pipeCol: tahap } : {}),
      }, r.ev.updatedAt),
      setuju ? 'Penawaran disetujui' : 'Penawaran ditolak',
      { refType: 'event', refId: r.ev.id, action: setuju ? 'menyetujui penawaran' : 'menolak penawaran', detail: r.perkara },
    )
    if (ok) {
      await buatMkt('notifications', {
        type: 'approval', title: `Penawaran ${setuju ? 'disetujui' : 'ditolak'}`,
        body: `${r.ev.nama} — ${r.perkara}`, link: `/marketing/event/${r.ev.id}`,
        read: false, at: new Date().toISOString(),
      }).catch(() => {})
      putus.value = null
      tolakNote.value = ''
    }
  }
  else {
    const ok = await mktSimpan(async () => {
      await tambalMkt('approvals', r.rid, {
        status: setuju ? 'Approved' : 'Rejected', by2: saya.value?.user.id ?? '', decidedAt: new Date().toISOString(),
        ...(setuju ? {} : { note: tolakNote.value.trim() }),
      }, (st.value.approvals.find(a => String((a as { id?: string }).id) === r.rid) as { updatedAt?: number } | undefined)?.updatedAt)
      if (!setuju && !['Lost'].includes(r.ev.status)) {
        await tambalMkt<EventMkt>('events', r.ev.id, { status: 'Lost', pipeCol: 'Lost' }, r.ev.updatedAt)
      }
    }, setuju ? 'Negosiasi disetujui' : 'Negosiasi ditolak — event ke Lost',
    { refType: 'event', refId: r.ev.id, action: `Approval ${setuju ? 'Approved' : 'Rejected'}`, detail: `oleh ${saya.value?.user.name ?? ''}` })
    if (ok) {
      await buatMkt('notifications', {
        type: 'approval', title: `Approval ${setuju ? 'Approved' : 'Rejected'}`,
        body: `${r.ev.nama} telah di-${setuju ? 'approve' : 'reject'}.`, link: `/marketing/event/${r.ev.id}`,
        read: false, at: new Date().toISOString(),
      }).catch(() => {})
      await logMkt('event', r.ev.id, `Tahap → Lost`, 'otomatis: approval ditolak').catch(() => {})
      putus.value = null
      tolakNote.value = ''
    }
  }
}

// ---- table ----
const KOL: KolomMkt<BarisApprovalMkt>[] = [
  { k: 'event', t: 'Event', v: r => r.ev.nama },
  { k: 'jenis', t: 'Jenis', v: r => r.jenis },
  { k: 'perkara', t: 'Perkara', v: r => r.perkara },
  { k: 'nilai', t: 'Nilai', v: r => r.nilai },
  { k: 'pada', t: 'Diajukan', v: r => r.pada },
  { k: 'status', t: 'Status', v: r => r.status },
  { k: 'putus', t: 'Diputuskan', v: r => r.putusPada },
]
const tbl = useTabelMkt<BarisApprovalMkt>('approvals', KOL, () => `${tab.value}${semua.value.length}`)
const hal = computed(() => tbl.potong(tbl.susun(daftar.value)))
const warnaAntri = (r: BarisApprovalMkt) => {
  if (r.antri) return 'warning' as const
  return ['Disetujui', 'Approved', 'Terkirim'].includes(r.status) ? 'success' as const : 'error' as const
}
</script>

<template>
  <AppPage
    title="Approval Flow"
    description="Meja putusan manajemen."
  >
    <MarketingGerbang layar="approvals">
      <AppStatGrid>
        <AppStat
          label="Surat penawaran"
          :value="String(rekap.pen)"
          :sub="`menunggu dari ${rekap.penTotal} pengajuan`"
          tone="warning"
          icon="i-lucide-file-text"
        />
        <AppStat
          label="Negosiasi lanjutan"
          :value="String(rekap.rev)"
          :sub="`menunggu dari ${rekap.revTotal} perkara`"
          tone="info"
          icon="i-lucide-repeat"
        />
        <AppStat
          label="Menunggu keputusan"
          :value="String(rekap.antri)"
          :sub="`dari ${rekap.total} perkara`"
          tone="error"
          icon="i-lucide-hourglass"
        />
      </AppStatGrid>
      <p
        v-if="!bisaPutus"
        class="mb-4 text-sm text-muted"
      >
        Hanya Manager / Approver yang memutus — selebihnya hanya membaca.
      </p>

      <AppPanel flush>
        <template #head>
          <AppSeg
            v-model="tab"
            :options="[{ value: 'antri', label: 'Antrian' }, { value: 'riwayat', label: 'Riwayat Approval' }, { value: 'semua', label: 'Semua' }]"
          />
        </template>
        <div
          v-if="!daftar.length"
          class="p-8 text-center text-sm text-muted"
        >
          <b class="block text-base text-highlighted">Tidak ada perkara di sini</b>
        </div>
        <template v-else>
          <UTable
            :data="hal"
            :columns="[
              { accessorKey: 'event', header: 'Event' },
              { accessorKey: 'jenis', header: 'Jenis' },
              { accessorKey: 'perkara', header: 'Perkara' },
              { accessorKey: 'nilai', header: 'Nilai' },
              { accessorKey: 'pada', header: 'Diajukan' },
              { accessorKey: 'status', header: 'Status' },
              { id: 'putus', header: 'Diputuskan' },
              { id: 'aksi', header: 'Aksi' },
            ]"
            class="hidden lg:block"
          >
            <template #event-cell="{ row }">
              <NuxtLink
                :to="`/marketing/event/${row.original.ev.id}`"
                class="font-semibold text-primary-700 underline"
              >
                {{ row.original.ev.nama }}
              </NuxtLink>
              <p
                v-if="row.original.tolakNote"
                class="text-xs text-muted"
              >
                {{ row.original.tolakNote }}
              </p>
            </template>
            <template #perkara-cell="{ row }">
              <p>{{ row.original.perkara }}</p>
              <p
                v-if="row.original.sub"
                class="text-xs text-muted"
              >
                {{ row.original.sub }}
              </p>
            </template>
            <template #nilai-cell="{ row }">
              <span class="num">{{ rupiah(row.original.nilai) }}</span>
            </template>
            <template #status-cell="{ row }">
              <AppStatus
                :color="warnaAntri(row.original)"
                :icon="row.original.antri ? 'i-lucide-hourglass' : 'i-lucide-check'"
                size="sm"
              >
                {{ row.original.status }}
              </AppStatus>
            </template>
            <template #putus-cell="{ row }">
              <span class="text-xs text-muted num">{{ row.original.putusPada ? tglPendek(row.original.putusPada) : '—' }}</span>
            </template>
            <template #aksi-cell="{ row }">
              <div
                v-if="bisaPutus && row.original.antri"
                class="flex gap-1"
              >
                <UButton
                  size="xs"
                  label="Setujui"
                  @click="putus = { r: row.original, setuju: true }; tolakNote = ''"
                />
                <UButton
                  size="xs"
                  color="error"
                  variant="outline"
                  label="Tolak"
                  @click="putus = { r: row.original, setuju: false }; tolakNote = ''"
                />
              </div>
              <span
                v-else-if="row.original.tanpaBerkas"
                class="text-xs text-muted"
              >tanpa berkas</span>
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="r in hal"
              :key="`${r.kind}-${r.rid}`"
              class="p-4"
            >
              <NuxtLink
                :to="`/marketing/event/${r.ev.id}`"
                class="font-semibold text-highlighted"
              >
                {{ r.ev.nama }}
              </NuxtLink>
              <p class="text-xs text-muted">
                {{ r.jenis }} · {{ r.perkara }} · <span class="num">{{ rupiah(r.nilai) }}</span><span v-if="r.putusPada"> · diputus {{ tglPendek(r.putusPada) }}</span>
              </p>
              <div class="mt-1 flex flex-wrap items-center gap-1">
                <AppStatus
                  :color="warnaAntri(r)"
                  :icon="r.antri ? 'i-lucide-hourglass' : 'i-lucide-check'"
                  size="sm"
                >
                  {{ r.status }}
                </AppStatus>
                <span
                  v-if="bisaPutus && r.antri"
                  class="contents"
                >
                  <UButton
                    size="xs"
                    label="Setujui"
                    @click="putus = { r, setuju: true }; tolakNote = ''"
                  />
                  <UButton
                    size="xs"
                    color="error"
                    variant="outline"
                    label="Tolak"
                    @click="putus = { r, setuju: false }; tolakNote = ''"
                  />
                </span>
              </div>
            </li>
          </ul>
          <MarketingPager
            v-model="tbl.hal.value"
            :total="daftar.length"
          />
        </template>
      </AppPanel>

      <ResponsiveSheet
        v-model:open="putusBuka"
        :title="putus?.setuju ? 'Setujui perkara' : 'Tolak perkara'"
        :description="putus ? `${putus.r.ev.nama} — ${putus.r.perkara}` : ''"
      >
        <p
          v-if="putus && !putus.setuju && putus.r.kind === 'nego'"
          class="mb-3 text-sm text-muted"
        >
          Peluang otomatis dianggap batal (pindah ke tahap Lost), supaya event tidak nyangkut dan lolos ke invoice.
        </p>
        <p
          v-if="putus && !putus.setuju && putus.r.kind === 'pen'"
          class="mb-3 text-sm text-muted"
        >
          Event turun kembali ke tahap Prospect.
        </p>
        <UFormField
          v-if="putus && !putus.setuju"
          label="Alasan penolakan"
          required
        >
          <UTextarea
            v-model="tolakNote"
            autoresize
          />
        </UFormField>
        <div class="mt-4 flex justify-end gap-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="ghost"
            @click="putus = null"
          />
          <UButton
            :label="putus?.setuju ? 'Setujui' : 'Tolak'"
            :color="putus?.setuju ? 'primary' : 'error'"
            @click="kirimPutus"
          />
        </div>
      </ResponsiveSheet>
    </MarketingGerbang>
  </AppPage>
</template>
