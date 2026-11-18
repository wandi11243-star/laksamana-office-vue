<!--
  Marketing › Dashboard (old renderDashboard, deploy/marketing/index.html:5130-5215;
  marketing.md D.1). Same order: greeting + "Lead Baru", four cards, the
  status tiles, Upcoming Event · 7 Hari on the left, Pendapatan 6 Bulan and
  Closing Bulan Ini on the right.

  A marketing person's Follow Up card counts their own follow-ups against the
  daily target; everyone else sees the team total.

  Correction vs the old client: "Pendapatan Bulan Ini" compared only the MONTH
  (`getMonth()===thisMonth`), so October of every past year was added to this
  October. Here it is this year's month, the same rule the 6-month chart and
  the closing board already used.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { EventMkt, KolomMkt } from '~/utils/marketing'
import { STATUS_EVENT_MKT, STATUS_OMSET_MKT, hMinusMkt, hariAntaraMkt, rentangTglMkt } from '~/utils/marketing'
import { eventFinance, papanClosing, pendapatanPerBulan } from '~/utils/marketing-uang'
import { ikonStatusMkt, warnaStatusMkt } from '~/utils/status-marketing'
import { BULAN, angka, hariIni, rupiah } from '~/utils/format'

definePageMeta({ access: ['marketing'] })

const router = useRouter()
const { data: st, status, error } = useStateMkt()
// First-load skeleton for the stat cards: while the module state is empty
// the grid shows placeholders; later refetches keep the old cards on screen.
const statMemuat = computed(() => !st.value.events.length && (status.value === 'pending' || status.value === 'idle'))
const { saya, can } = useAksesMkt()
const hari = hariIni()
const bulanIni = hari.slice(0, 7)
const leadBaru = ref(false)

const grand = (e: EventMkt) => eventFinance(e, st.value.settings).grand
const namaClient = (id: string) => st.value.clients.find(c => c.id === id)?.nama ?? '—'
const namaUser = (id: string) => st.value.users.find(u => u.id === id)?.name ?? '—'

const mine = computed(() => saya.value?.user.role === 'marketing')
const evHariIni = computed(() => st.value.events.filter(e => e.tanggal === hari))
const revBulan = computed(() => st.value.events
  .filter(e => STATUS_OMSET_MKT.includes(e.status) && String(e.tanggal ?? '').slice(0, 7) === bulanIni)
  .reduce((a, e) => a + grand(e), 0))
const dpPending = computed(() => st.value.events.filter(e => ['Confirmed', 'Deal'].includes(e.status) && eventFinance(e, st.value.settings).paid === 0))
const fuSaya = computed(() => st.value.followups.filter(f => (!mine.value || f.by === saya.value?.user.id) && String(f.at ?? '').slice(0, 10) === hari))
const fuTarget = computed(() => +st.value.settings.fuTarget || 0)
const tally = computed(() => {
  const t = Object.fromEntries(STATUS_EVENT_MKT.map(s => [s, 0])) as Record<string, number>
  for (const e of st.value.events) {
    const s = e.status === 'Confirmed' ? 'Deal' : e.status
    if (t[s] !== undefined) t[s]++
  }
  return t
})

// ---- Upcoming 7 hari (KOL_UPCOMING :5225) ----
const upcoming = computed(() => st.value.events
  .filter((e) => {
    if (!e.tanggal || e.status === 'Lost') return false
    const d = hariAntaraMkt(hari, e.tanggal)
    return d >= 0 && d <= 7
  }))
const KOL: KolomMkt<EventMkt>[] = [
  { k: 'nama', t: 'Event', v: e => e.nama },
  { k: 'tanggal', t: 'Tanggal', v: e => e.tanggal, def: true },
  { k: 'pax', t: 'Pax', v: e => +(e.pax ?? 0) || 0, turun: true },
  { k: 'nilai', t: 'Nilai', v: e => grand(e), turun: true },
]
const tbl = useTabelMkt('upcoming', KOL)
const upUrut = computed(() => tbl.susun(upcoming.value))
const upHal = computed(() => tbl.potong(upUrut.value))
const kolom: TableColumn<EventMkt>[] = [
  { id: 'nama', header: tbl.kepala('nama', 'Event') },
  { id: 'tanggal', header: tbl.kepala('tanggal', 'Tanggal') },
  { id: 'pax', header: tbl.kepala('pax', 'Pax') },
  { id: 'nilai', header: tbl.kepala('nilai', 'Nilai') },
]

// ---- right panel ----
const grafik = computed(() => {
  const data = pendapatanPerBulan(st.value.events, st.value.settings, hari, 6)
  const maks = Math.max(1, ...data.map(x => x.nilai))
  return data.map(x => ({ ...x, label: BULAN[+x.kunci.slice(5, 7) - 1]!.slice(0, 3), tinggi: Math.round(x.nilai / maks * 100) }))
})
const closing = computed(() => papanClosing(st.value.events, st.value.settings, bulanIni).slice(0, 6))
const namaDepan = computed(() => String(saya.value?.user.name ?? '').split(' ')[0])
</script>

<template>
  <AppPage
    :title="`Selamat datang, ${namaDepan}`"
    description="&quot;Pagi Meeting, Malam Healing&quot; — ini yang perlu perhatianmu hari ini."
  >
    <template
      v-if="can('edit_client')"
      #actions
    >
      <UButton
        label="Lead Baru"
        icon="i-lucide-plus"
        @click="leadBaru = true"
      />
    </template>

    <MarketingGerbang layar="dashboard">
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Marketing: ${apiErrorMessage(error)}`"
        class="mb-5"
      />

      <div
        v-if="status === 'pending' && !st.events.length"
        class="space-y-5"
      >
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
          <USkeleton
            v-for="i in 4"
            :key="i"
            class="h-20 rounded-xl"
          />
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <USkeleton
            v-for="i in 7"
            :key="i"
            class="h-16 rounded-panel"
          />
        </div>
        <div class="space-y-2 rounded-panel border border-default bg-default p-4">
          <USkeleton
            v-for="i in 5"
            :key="i"
            class="h-10 w-full"
          />
        </div>
      </div>

      <AppStatGrid
        :loading="statMemuat"
        :count="4"
      >
        <AppStat
          label="Event Hari Ini"
          :value="evHariIni.length"
          icon="i-lucide-calendar-check"
          :sub="evHariIni.length ? evHariIni.map(e => e.nama).join(', ') : 'Tidak ada event'"
        />
        <AppStat
          v-if="mine"
          label="Follow Up Hari Ini"
          :value="fuSaya.length"
          :satuan="`/ ${fuTarget}`"
          icon="i-lucide-phone-call"
          tone="info"
        >
          <span class="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
            <span
              class="block h-full rounded-full bg-info"
              :style="{ width: `${Math.min(100, fuTarget ? Math.round(fuSaya.length / fuTarget * 100) : 0)}%` }"
            />
          </span>
        </AppStat>
        <AppStat
          v-else
          label="Total Follow Up"
          :value="fuSaya.length"
          icon="i-lucide-phone-call"
          tone="info"
          sub="aktivitas hari ini"
        />
        <AppStat
          label="Pendapatan Bulan Ini"
          :value="rupiah(revBulan)"
          icon="i-lucide-wallet"
          tone="success"
          :sub="`${BULAN[+bulanIni.slice(5, 7) - 1]} (berjalan)`"
        />
        <AppStat
          label="DP Pending"
          :value="dpPending.length"
          icon="i-lucide-triangle-alert"
          tone="warning"
          :sub="dpPending.length ? 'perlu ditagih' : 'semua lunas'"
        />
      </AppStatGrid>

      <div class="mb-2.5 flex items-center justify-between px-0.5">
        <p class="text-xs font-bold tracking-wider text-muted uppercase">
          Status Event
        </p>
        <UBadge
          :label="`Total ${st.events.length} event`"
          color="neutral"
          variant="soft"
        />
      </div>
      <div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <div
          v-for="s in STATUS_EVENT_MKT"
          :key="s"
          class="rounded-panel border border-default bg-default p-3 shadow-panel"
        >
          <AppStatus
            :color="warnaStatusMkt(s)"
            :icon="ikonStatusMkt(s)"
            size="sm"
          >
            {{ s }}
          </AppStatus>
          <p class="num mt-2 font-display text-2xl font-bold text-highlighted">
            {{ tally[s] }}
          </p>
          <p class="text-xs text-muted">
            event
          </p>
        </div>
      </div>

      <div class="grid items-start gap-5 lg:grid-cols-[1.5fr_1fr]">
        <AppPanel
          title="Upcoming Event · 7 Hari"
          :count="`${upcoming.length} event`"
          flush
        >
          <p
            v-if="!upcoming.length"
            class="p-6 text-center text-sm text-muted"
          >
            Belum ada event dekat. Event 7 hari ke depan akan tampil di sini.
          </p>
          <template v-else>
            <UTable
              :data="upHal"
              :columns="kolom"
              class="hidden lg:block"
              :ui="{ tr: 'cursor-pointer' }"
              @select="(_e: Event, r: { original: EventMkt }) => router.push(`/marketing/event/${r.original.id}`)"
            >
              <template #nama-cell="{ row }">
                <p class="font-semibold text-highlighted">
                  {{ row.original.nama }}
                </p>
                <p class="text-xs text-muted">
                  {{ namaClient(row.original.clientId) }}
                </p>
              </template>
              <template #tanggal-cell="{ row }">
                <p class="num">
                  {{ rentangTglMkt(row.original) }}
                </p>
                <p class="text-xs text-muted">
                  {{ hMinusMkt(row.original.tanggal, hari) }}
                </p>
              </template>
              <template #pax-cell="{ row }">
                <span class="num">{{ row.original.pax || '—' }}</span>
              </template>
              <template #nilai-cell="{ row }">
                <span class="num">{{ rupiah(grand(row.original)) }}</span>
              </template>
            </UTable>
            <ul class="divide-y divide-default lg:hidden">
              <li
                v-for="e in upHal"
                :key="e.id"
              >
                <NuxtLink
                  :to="`/marketing/event/${e.id}`"
                  class="flex items-start justify-between gap-3 p-4 hover:bg-muted"
                >
                  <div class="min-w-0">
                    <p class="font-semibold text-highlighted">{{ e.nama }}</p>
                    <p class="text-xs text-muted">{{ namaClient(e.clientId) }} · {{ e.pax || '—' }} pax</p>
                    <p class="num text-xs text-muted">{{ rentangTglMkt(e) }} · {{ hMinusMkt(e.tanggal, hari) }}</p>
                  </div>
                  <span class="num shrink-0 text-sm font-semibold">{{ rupiah(grand(e)) }}</span>
                </NuxtLink>
              </li>
            </ul>
            <MarketingPager
              v-model="tbl.hal.value"
              :total="upcoming.length"
            />
          </template>
        </AppPanel>

        <AppPanel>
          <h3 class="font-semibold text-highlighted">
            Pendapatan 6 Bulan
          </h3>
          <p class="mb-3 text-xs text-muted">
            Dari event yang sudah Deal / selesai · nominal dalam Rupiah.
          </p>
          <div class="grid h-44 grid-cols-6 items-end gap-2">
            <div
              v-for="x in grafik"
              :key="x.kunci"
              class="flex h-full min-w-0 flex-col items-center justify-end gap-1"
              :title="`${x.label}: ${rupiah(x.nilai)}`"
            >
              <!-- Full amount, no "Rp" (named once in the caption) so it fits one line over a narrow bar. -->
              <span class="num whitespace-nowrap text-center text-[10px] font-semibold leading-tight text-muted sm:text-[11px]">{{ x.nilai ? angka(x.nilai) : '—' }}</span>
              <div
                class="w-full min-h-[3px] rounded-t"
                :class="x.kini ? 'bg-primary-400' : x.nilai ? 'bg-primary-200' : 'bg-muted'"
                :style="{ height: `${x.tinggi}%` }"
              />
              <span
                class="text-xs"
                :class="x.kini ? 'font-bold text-primary-700' : 'text-muted'"
              >{{ x.label }}</span>
            </div>
          </div>

          <USeparator class="my-4" />
          <h3 class="font-semibold text-highlighted">
            Closing Bulan Ini
          </h3>
          <p class="mb-2 text-xs text-muted">
            Nilai event yang ditutup tiap marketing.
          </p>
          <p
            v-if="!closing.length"
            class="py-1.5 text-sm text-muted"
          >
            Belum ada event yang ditutup bulan ini.
          </p>
          <ol
            v-else
            class="divide-y divide-default"
          >
            <li
              v-for="(r, i) in closing"
              :key="r.id"
              class="flex items-center gap-3 py-2 text-sm"
            >
              <span class="num w-5 text-center font-bold text-muted">{{ i + 1 }}</span>
              <span class="min-w-0 flex-1 truncate">
                <b>{{ r.id === '-' ? 'Tanpa PIC' : namaUser(r.id) }}</b>
                <span class="text-muted"> · {{ r.n }} event</span>
              </span>
              <span class="num font-semibold">{{ rupiah(r.v) }}</span>
            </li>
          </ol>
        </AppPanel>
      </div>
    </MarketingGerbang>

    <MarketingClientForm
      v-model:open="leadBaru"
      @tersimpan="router.push('/marketing/crm')"
    />
  </AppPage>
</template>
