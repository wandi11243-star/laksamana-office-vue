<!--
  Konten › Activity Log (old VIEWS.activity, deploy/konten/index.html:
  4605-4610; konten.md D.18). The last 80 entries of the append-only `logs`
  (newest first): who, action, target, date-time and "x lalu". The server
  keeps the newest 5000.
-->
<script setup lang="ts">
import { lamaKonten } from '~/utils/konten'

definePageMeta({ access: ['konten'] })

const { data: st, error, status } = useStateKonten()
const logs = computed(() => st.value.logs.slice().sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0)))
const namaUser = (by?: string) => st.value.users.find(u => u.id === by)?.name ?? (by || '-')
const waktu = (v?: number) => (v ? new Date(v).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-')
</script>

<template>
  <KontenGerbang lihat="activity">
    <AppPage
      title="Activity Log"
      :description="`${st.logs.length} aktivitas tercatat - jejak audit`"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
      />
      <AppPanel flush>
        <div
          v-if="!logs.length"
          class="space-y-2 p-6"
        >
          <!-- Loading rows mirror the activity list below. -->
          <template v-if="status === 'pending'">
            <USkeleton
              v-for="i in 4"
              :key="i"
              class="h-10 w-full"
            />
          </template>
          <p class="pt-1 text-center text-sm text-muted">
            {{ status === 'pending' ? 'Memuat…' : 'Belum ada aktivitas.' }}
          </p>
        </div>
        <ul
          v-else
          class="divide-y divide-default"
        >
          <li
            v-for="(l, i) in logs.slice(0, 80)"
            :key="l.id ?? i"
            class="flex gap-3 px-4 py-3"
          >
            <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">
              {{ namaUser(l.by).slice(0, 1).toUpperCase() }}
            </span>
            <div class="min-w-0 text-sm">
              <p>
                <b>{{ namaUser(l.by) }}</b> {{ l.action }}{{ l.target ? ' ' : '' }}<span
                  v-if="l.target"
                  class="text-primary-700"
                >{{ l.target }}</span>
              </p>
              <p class="text-xs text-muted">
                {{ waktu(l.at) }} - {{ lamaKonten(l.at) }}
              </p>
            </div>
          </li>
        </ul>
      </AppPanel>
    </AppPage>
  </KontenGerbang>
</template>
