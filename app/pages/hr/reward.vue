<!--
  HR › Reward & Recognition (deploy/hr/index.html RENDER.reward :2189-2213).

  Gamification: monthly badges plus points that can be redeemed. The points
  shown are the ledger total (earn − redeem); a badge always writes its points
  first, so the leaderboard and the badge pills never disagree.
-->
<script setup lang="ts">
import { activeEmps, canHr } from '~/utils/hr'
import { useHrDasar } from '~/composables/useHr'
import { fTglP } from '~/utils/format'
import { labelBulanJadwal } from '~/utils/jadwal'

definePageMeta({ access: ['hr'] })

const { s, cu, officeAdmin, error, refresh } = useHrDasar()
const bisa = computed(() => canHr('manageReward', cu.value, officeAdmin.value))

const poin = computed<Record<string, number>>(() => {
  const out: Record<string, number> = {}
  for (const r of s.value.rewards) out[r.empId] = (out[r.empId] ?? 0) + (r.type === 'earn' ? r.points : -r.points)
  return out
})
const board = computed(() => activeEmps(s.value)
  .filter(e => e.appRole !== 'ceo')
  .map(e => ({ e, p: poin.value[e.id] ?? 0 }))
  .sort((a, b) => b.p - a.p))
const badgesKru = (id: string) => s.value.badges.filter(b => b.empId === id)

const eom = computed(() => s.value.badges
  .filter(b => b.badge === 'Employee of the Month')
  .sort((a, b) => b.month.localeCompare(a.month))[0])
const eomNama = computed(() => (eom.value ? s.value.employees.find(e => e.id === eom.value!.empId)?.name ?? '-' : '-'))
const riwayat = computed(() => s.value.rewards.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12))
const nama = (id: string) => s.value.employees.find(e => e.id === id)?.name ?? '-'

const badgeOpen = ref(false)
const poinOpen = ref(false)
async function sesudah() {
  await refresh()
}
</script>

<template>
  <AppPage
    title="Reward & recognition"
    description="Badge, poin & leaderboard."
  >
    <template
      v-if="bisa"
      #actions
    >
      <UButton
        label="Beri badge"
        icon="i-lucide-award"
        color="neutral"
        variant="outline"
        @click="badgeOpen = true"
      />
      <UButton
        label="Poin / redeem"
        icon="i-lucide-plus"
        @click="poinOpen = true"
      />
    </template>

    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel
      v-if="eom"
      flush
    >
      <div class="flex items-center gap-4 bg-primary-100/60 px-5 py-4">
        <UIcon
          name="i-lucide-trophy"
          class="size-9 shrink-0 text-primary-700"
        />
        <div class="min-w-0">
          <p class="text-[11px] font-bold uppercase tracking-wider text-primary-700">
            Employee of the month, {{ labelBulanJadwal(eom.month) }}
          </p>
          <p class="font-display text-xl font-bold text-highlighted">
            {{ eomNama }}
          </p>
          <p
            v-if="eom.note"
            class="text-sm text-muted"
          >
            {{ eom.note }}
          </p>
        </div>
      </div>
    </AppPanel>

    <AppPanel>
      <p class="rounded-field bg-muted px-3 py-2 text-sm text-muted">
        Gamification: badge bulanan (Top Attendance, Best SOP, Customer Favorite, dll) + poin yang bisa ditukar
        (voucher, dinner, hari libur, merchandise). Badge otomatis memberi
        {{ s.settings.pointRules.badge }} poin; Employee of the Month
        {{ s.settings.pointRules.eom }} poin.
      </p>
    </AppPanel>

    <div class="grid gap-0 lg:grid-cols-2 lg:gap-5">
      <AppPanel
        title="Leaderboard poin"
        icon="i-lucide-list-ordered"
      >
        <p
          v-if="!board.length"
          class="text-sm text-muted"
        >
          Belum ada kru.
        </p>
        <div
          v-else
          class="divide-y divide-default"
        >
          <div
            v-for="(x, i) in board.slice(0, 10)"
            :key="x.e.id"
            class="flex items-center gap-3 py-2.5"
          >
            <span class="w-5 shrink-0 text-center font-bold text-muted num">{{ i + 1 }}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold text-highlighted">
                {{ x.e.name }}
              </p>
              <div
                v-if="badgesKru(x.e.id).length"
                class="flex flex-wrap gap-1"
              >
                <span
                  v-for="b in badgesKru(x.e.id).slice(0, 4)"
                  :key="b.id"
                  class="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted"
                >{{ b.badge }}</span>
              </div>
            </div>
            <span class="shrink-0 font-display text-lg font-bold text-highlighted num">{{ x.p }}</span>
            <span class="shrink-0 text-xs text-muted">poin</span>
          </div>
        </div>
      </AppPanel>

      <AppPanel
        title="Riwayat poin terbaru"
        icon="i-lucide-history"
      >
        <p
          v-if="!riwayat.length"
          class="text-sm text-muted"
        >
          Belum ada transaksi poin.
        </p>
        <div
          v-else
          class="divide-y divide-default"
        >
          <div
            v-for="r in riwayat"
            :key="r.id"
            class="flex items-center gap-3 py-2.5"
          >
            <span class="w-20 shrink-0 text-xs text-muted num">{{ fTglP(r.date) }}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-highlighted">
                {{ nama(r.empId) }}
              </p>
              <p class="truncate text-[13px] text-muted">
                {{ r.reason }}
              </p>
            </div>
            <AppStatus
              :color="r.type === 'earn' ? 'success' : 'warning'"
              size="sm"
            >
              {{ r.type === 'earn' ? '+' : '−' }}{{ r.points }}
            </AppStatus>
          </div>
        </div>
      </AppPanel>
    </div>

    <HrBadgeSheet
      v-model:open="badgeOpen"
      @saved="sesudah"
    />
    <HrPoinSheet
      v-model:open="poinOpen"
      @saved="sesudah"
    />
  </AppPage>
</template>
