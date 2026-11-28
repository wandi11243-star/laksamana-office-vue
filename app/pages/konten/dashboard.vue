<!--
  Konten › Dashboard (old VIEWS.dashboard, deploy/konten/index.html:1796-1872;
  konten.md D.1). Read-only: four stat cards, Today's Schedule, Menunggu
  Approval, Tugas Saya, Top Konten.

  Parity notes:
  - the four stat cards count ALL content; the lists below follow the brand bar
    (the old cards read DB.content, the lists filterByBrand);
  - Top Konten ranks by the per-platform figures (performa-konten.ts, #49):
    the old screen read `metrics.reach`, a field nothing ever wrote (F.4), so
    its list was always zeros; old flat records still count;
-->
<script setup lang="ts">
import type { AcaraKalender, FilterKalender } from '~/utils/konten'
import { pkAggER, pkKumpul, pkPersen, pkUrutKonten } from '~/utils/performa-konten'
import {
  DEADLINE_DEKAT, PROD_TYPES, acaraKalender, contentPlatforms, sisaHariKonten, sudahArsip, tugasSaya,
} from '~/utils/konten'
import { ikonAcaraKonten, ikonStatusKonten, warnaAcaraKonten, warnaStatusKonten } from '~/utils/status-konten'
import { angka, hariIni, tglPanjang, tglPendek } from '~/utils/format'

definePageMeta({ access: ['konten'] })
useSinkronKruKonten()

const me = useMe()
const { data: st, error, status } = useStateKonten()
const { saya, can } = useAksesKonten()
const brand = useBrandKonten()

const hari = hariIni()
const cs = computed(() => st.value.content)
const posted = computed(() => cs.value.filter(c => c.status === 'Posted'))
const scheduled = computed(() => cs.value.filter(c => c.status === 'Scheduled'))
const pending = computed(() => cs.value.filter(c => !['Posted', 'Cancelled', 'Scheduled'].includes(c.status ?? '')))
const overdue = computed(() => cs.value.filter((c) => {
  const d = sisaHariKonten(c.deadline)
  return d != null && d < 0 && !sudahArsip(c)
}))
const todayPub = computed(() => cs.value.filter(c => c.publishDate === hari))

/** First-load skeleton for the four recap cards below: skeleton cells stand
 *  in until the first state lands. Refetch keeps old numbers, so the cards
 *  never blank. */
const statMemuat = computed(() => !st.value.content.length && (status.value === 'pending' || status.value === 'idle'))

const kontenBrand = computed(() => saringBrand(cs.value, brand.value))
const my = computed(() => (saya.value ? tugasSaya(saya.value.user.id, kontenBrand.value, saringBrand(st.value.prodTasks, brand.value)) : []))
const myLewat = computed(() => my.value.filter(x => x.sisa != null && x.sisa < 0))
const myDekat = computed(() => my.value.filter(x => x.sisa != null && x.sisa >= 0 && x.sisa <= DEADLINE_DEKAT))
const approvalPending = computed(() => kontenBrand.value.filter(c => c.status === 'Approval'))
const top = computed(() => pkUrutKonten(pkKumpul(posted.value).konten, 'reach').slice(0, 5))

/** The calendar legend toggles, shared with the Calendar page: turning a kind
 *  off there hides it here too (old collectCalEvents + calFilter). */
const fKal = useState<FilterKalender>('konten-cal-filter', () => ({ publish: true, shoot: true, design: true, edit: true, visit: true }))
const agenda = computed(() => acaraKalender({
  content: kontenBrand.value,
  prodTasks: saringBrand(st.value.prodTasks, brand.value),
  shootings: saringBrand(st.value.shootings, brand.value),
  visits: saringBrand(st.value.visits, brand.value),
  namaKol: id => st.value.kols.find(k => k.id === id)?.name ?? '',
}, fKal.value).filter(e => e.date === hari).sort((a, b) => String(a.time).localeCompare(String(b.time))))

const namaBrand = (id?: string) => st.value.brands.find(b => b.id === id)?.name.split(' (')[0] ?? ''
const sapaan = computed(() => String(saya.value?.user.name || me.value?.name || '').split(' ')[0])

/** Where an agenda row leads (old calOpenEvent): content → detail, visit → its
 *  form, standalone task → its form, shooting → queue. */
function tujuanAcara(e: AcaraKalender): string {
  if (e.cid) return `/konten/detail/${e.cid}`
  if (e.vid) return `/konten/kol?tab=visit&buka=${e.vid}`
  if (e.kind && e.tid) return `/konten/${PROD_TYPES[e.kind].view}?buka=${e.tid}`
  if (e.kind) return `/konten/${PROD_TYPES[e.kind].view}`
  return '/konten/shooting'
}
function tujuanTugas(x: { jenis: string, kind?: keyof typeof PROD_TYPES, ref: string }) {
  if (x.jenis === 'mandiri' && x.kind) return `/konten/${PROD_TYPES[x.kind].view}?buka=${x.ref}`
  return `/konten/detail/${x.ref}`
}
</script>

<template>
  <AppPage
    :title="`Selamat datang, ${sapaan}`"
    :description="`Berikut kondisi anjungan hari ini - ${tglPanjang(hari)}`"
  >
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
    />

    <KontenBrandBar :brands="st.brands" />

    <AppStatGrid
      :loading="statMemuat"
      :count="4"
    >
      <AppStat
        label="Total konten"
        icon="i-lucide-layers"
        :value="angka(cs.length)"
        :sub="`${posted.length} tayang`"
      />
      <AppStat
        label="Perlu dikerjakan"
        icon="i-lucide-list-todo"
        tone="info"
        :value="angka(pending.length)"
        :sub="`${scheduled.length} terjadwal`"
      />
      <AppStat
        label="Terlambat"
        icon="i-lucide-alarm-clock"
        :tone="overdue.length ? 'error' : 'success'"
        :value="angka(overdue.length)"
        :sub="myLewat.length ? `${myLewat.length} punya saya` : (overdue.length ? 'Perlu perhatian' : 'Aman')"
      />
      <AppStat
        label="Tayang hari ini"
        icon="i-lucide-send"
        tone="success"
        :value="angka(todayPub.length)"
      />
    </AppStatGrid>

    <div class="grid items-start gap-4 lg:grid-cols-2">
      <AppPanel
        title="Today's schedule"
        icon="i-lucide-calendar-days"
        :description="`${agenda.length} agenda - ${tglPendek(hari)}`"
        flush
      >
        <div
          v-if="!agenda.length"
          class="p-8 text-center"
        >
          <UIcon
            name="i-lucide-coffee"
            class="mx-auto size-7 text-dimmed"
          />
          <p class="mt-2 font-semibold">
            Tidak ada agenda hari ini
          </p>
          <p class="text-sm text-muted">
            Nikmati harimu - cek kembali besok.
          </p>
        </div>
        <ul
          v-else
          class="divide-y divide-default"
        >
          <li
            v-for="(e, i) in agenda"
            :key="i"
          >
            <NuxtLink
              :to="tujuanAcara(e)"
              class="flex items-center gap-3 px-4 py-2.5 hover:bg-muted"
              :class="e.done ? 'opacity-55 line-through' : ''"
            >
              <AppStatus
                :color="warnaAcaraKonten(e.type)"
                :icon="ikonAcaraKonten(e.type)"
                size="sm"
              >
                {{ e.label }}
              </AppStatus>
              <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ e.title }}</span>
              <span
                v-if="e.time"
                class="num text-xs text-muted"
              >{{ e.time }}</span>
            </NuxtLink>
          </li>
        </ul>
      </AppPanel>

      <AppPanel
        title="Menunggu approval"
        icon="i-lucide-hourglass"
        :description="`${approvalPending.length} item`"
        flush
      >
        <div
          v-if="!approvalPending.length"
          class="p-8 text-center"
        >
          <UIcon
            name="i-lucide-circle-check"
            class="mx-auto size-7 text-success"
          />
          <p class="mt-2 font-semibold">
            Tidak ada yang pending
          </p>
          <p class="text-sm text-muted">
            Semua konten sudah direview.
          </p>
        </div>
        <template v-else>
          <ul class="divide-y divide-default">
            <li
              v-for="c in approvalPending.slice(0, 7)"
              :key="c.id"
            >
              <NuxtLink
                :to="`/konten/detail/${c.id}`"
                class="flex items-center gap-3 px-4 py-2.5 hover:bg-muted"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold">
                    {{ c.title }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ contentPlatforms(c).slice(0, 2).join(' · ') }}<template v-if="namaBrand(c.brand)">
                      - {{ namaBrand(c.brand) }}
                    </template>
                  </p>
                </div>
                <AppStatus
                  color="vip"
                  size="sm"
                >
                  Review
                </AppStatus>
              </NuxtLink>
            </li>
          </ul>
          <div
            v-if="can('approve')"
            class="p-3"
          >
            <UButton
              to="/konten/approval"
              label="Buka halaman approval"
              trailing-icon="i-lucide-arrow-right"
              color="neutral"
              variant="outline"
              size="sm"
              block
            />
          </div>
        </template>
      </AppPanel>

      <AppPanel
        title="Tugas saya"
        icon="i-lucide-user-check"
        flush
      >
        <template #actions>
          <span
            v-if="myLewat.length"
            class="text-sm"
          ><b class="text-error">{{ myLewat.length }} terlambat</b><template v-if="myDekat.length"> · {{ myDekat.length }} ≤{{ DEADLINE_DEKAT }} hari</template></span>
          <span
            v-else
            class="text-sm text-muted"
          >{{ myDekat.length ? `${myDekat.length} jatuh tempo ≤${DEADLINE_DEKAT} hari` : `${my.length} aktif` }}</span>
        </template>
        <div
          v-if="!my.length"
          class="p-8 text-center"
        >
          <UIcon
            name="i-lucide-party-popper"
            class="mx-auto size-7 text-dimmed"
          />
          <p class="mt-2 font-semibold">
            Bersih!
          </p>
          <p class="text-sm text-muted">
            Tidak ada tugas aktif untukmu.
          </p>
        </div>
        <template v-else>
          <ul class="divide-y divide-default">
            <li
              v-for="(x, i) in my.slice(0, 7)"
              :key="i"
            >
              <NuxtLink
                :to="tujuanTugas(x)"
                class="flex items-center gap-3 px-4 py-2.5 hover:bg-muted"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold">
                    {{ x.title }}
                  </p>
                  <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <AppStatus
                      v-if="x.jenis === 'konten'"
                      :color="warnaStatusKonten(x.status)"
                      :icon="ikonStatusKonten(x.status)"
                      size="sm"
                    >
                      {{ x.status }}
                    </AppStatus>
                    <span v-else-if="x.kind">{{ x.jenis === 'mandiri' ? 'mandiri · ' : '' }}{{ PROD_TYPES[x.kind].label }}</span>
                  </div>
                </div>
                <KontenDeadline :tgl="x.deadline" />
              </NuxtLink>
            </li>
          </ul>
          <p
            v-if="my.length > 7"
            class="p-3 text-center text-xs text-muted"
          >
            +{{ my.length - 7 }} tugas lain — buka Content Planning / antrian produksi
          </p>
        </template>
      </AppPanel>

      <AppPanel
        title="Top konten minggu ini"
        icon="i-lucide-trophy"
        description="by reach"
        flush
      >
        <p
          v-if="!top.length"
          class="p-8 text-center text-sm text-muted"
        >
          Belum ada konten tayang.
        </p>
        <ul
          v-else
          class="divide-y divide-default"
        >
          <li
            v-for="({ c, agg }, i) in top"
            :key="c.id"
          >
            <NuxtLink
              :to="`/konten/detail/${c.id}`"
              class="flex items-center gap-3 px-4 py-2.5 hover:bg-muted"
            >
              <span class="w-6 font-display text-lg text-primary-700">{{ i + 1 }}</span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold">
                  {{ c.title }}
                </p>
                <p class="text-xs text-muted">
                  {{ contentPlatforms(c).slice(0, 2).join(' · ') }} - ER {{ pkAggER(agg) == null ? '—' : `${pkPersen(pkAggER(agg))}%` }}
                </p>
              </div>
              <span class="num font-bold text-primary-700">{{ angka(agg.dasar) }}</span>
            </NuxtLink>
          </li>
        </ul>
      </AppPanel>
    </div>
  </AppPage>
</template>
