<!--
  HR › Audit Log (deploy/hr/index.html RENDER.audit :2689-2693). Append-only,
  newest first; the server trims to the 800-row bound of the old client
  (`log() :692`) via `GET /hr/audit?limit=800`, and `meta.total` names the
  full count when the view is truncated (G-11).
-->
<script setup lang="ts">
import type { HrAudit } from '~/utils/hr'
import { canHr } from '~/utils/hr'
import { listHrAudit, useHrDasar } from '~/composables/useHr'

definePageMeta({ access: ['hr'] })

const { cu, officeAdmin, error } = useHrDasar()
const admin = computed(() => canHr('manageOps', cu.value, officeAdmin.value))

/** The old client's bound (800 rows), now enforced server-side. */
const BATAS = 800
const { data: audit } = useAsyncData('hr-audit', () => listHrAudit(BATAS), {
  default: () => ({ rows: [] as HrAudit[], total: 0 }),
})
const daftar = computed(() => audit.value.rows)
const total = computed(() => audit.value.total)
const terpotong = computed(() => total.value > daftar.value.length)
const waktu = (at: string) => String(at || '').slice(0, 16).replace('T', ' ')
</script>

<template>
  <AppPage
    title="Audit log"
    description="Jejak aksi terbaru."
  >
    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel
      v-if="!admin"
      title="Halaman ini untuk admin modul"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Jejak audit hanya terbuka untuk admin modul <b>hr</b> (server juga menolak membacanya).
      </p>
    </AppPanel>

    <AppPanel
      v-else
      title="Jejak aksi"
      icon="i-lucide-scroll-text"
      :count="daftar.length"
      :description="terpotong ? `Append-only; ${BATAS} terbaru dari ${total}.` : 'Append-only; 800 terbaru.'"
      flush
    >
      <div
        v-if="daftar.length"
        class="divide-y divide-default"
      >
        <div
          v-for="a in daftar"
          :key="a.id"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 lg:px-5"
        >
          <span class="w-28 shrink-0 text-xs text-muted num">{{ waktu(a.at) }}</span>
          <span class="w-28 shrink-0 truncate text-sm text-muted">{{ a.userName }}</span>
          <AppStatus
            color="info"
            size="sm"
          >
            {{ a.action }}
          </AppStatus>
          <span class="min-w-0 flex-1 truncate text-sm text-muted">{{ a.detail }}</span>
        </div>
      </div>
      <p
        v-else
        class="px-4 py-8 text-center text-muted"
      >
        Belum ada aktivitas.
      </p>
    </AppPanel>
  </AppPage>
</template>
