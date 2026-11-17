<!--
  Marketing › Notification Center (docs/migrasi/marketing.md D.18, issue
  #60): live reminders that are easy to miss when manual (computed, never
  stored) + the stored history that feeds the shell bell. Rows open their
  target and mark themselves read.
-->
<script setup lang="ts">
import type { NotifMkt } from '~/utils/marketing-keuangan'
import { belumDibacaMkt, laluMkt, linkNotifMkt, pengingatMkt } from '~/utils/marketing-keuangan'
import { formatFbMkt, mktSimpan, tandaiDibacaMkt, useStateMkt } from '~/composables/useMarketing'
import type { EventMkt } from '~/utils/marketing'
import { kategoriEventMkt } from '~/utils/marketing'
import type { TemplateTugasMkt } from '~/utils/marketing-tugas'
import { progresDivMkt } from '~/utils/marketing-tugas'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['marketing'] })

const router = useRouter()
const { data: st } = useStateMkt()
const hari = hariIni()

// taskProgress(e): the average readiness of the event's to-do categories.
const progres = (e: EventMkt) => {
  const kat = kategoriEventMkt(e, formatFbMkt(st.value))
  if (!kat.length) return 0
  const tpl = st.value.taskTemplates as unknown as TemplateTugasMkt[]
  return Math.round(kat.reduce((a, d) => a + progresDivMkt(e, d, tpl), 0) / kat.length)
}
const live = computed(() => pengingatMkt(st.value.events, st.value.clients, st.value.settings, hari, progres))
const riwayat = computed<NotifMkt[]>(() => [...((st.value.notifs as unknown as NotifMkt[] | undefined) ?? [])].sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? ''))))
const belum = computed(() => belumDibacaMkt(riwayat.value))

const ikon = (t?: string) => ({
  dp: 'i-lucide-wallet', event: 'i-lucide-calendar', fu: 'i-lucide-phone-call',
  inv: 'i-lucide-alarm-clock', approval: 'i-lucide-circle-check', payment: 'i-lucide-banknote',
}[String(t ?? '')] ?? 'i-lucide-bell')
// colMap of the old screen: the icon carries the reminder's colour.
const warna = (t?: string) => ({
  dp: 'text-warning', event: 'text-info', fu: 'text-primary-700', inv: 'text-error', approval: 'text-vip', payment: 'text-success',
}[String(t ?? '')] ?? 'text-muted')

async function buka(n: NotifMkt) {
  if (!n.read && n.id) {
    await mktSimpan(() => tandaiDibacaMkt(n.id as string, n.updatedAt))
  }
  const ke = linkNotifMkt(n.link)
  if (ke) router.push(ke)
}

async function tandaiSemua() {
  const antre = riwayat.value.filter(n => !n.read && n.id)
  for (const n of antre) {
    await mktSimpan(() => tandaiDibacaMkt(n.id as string, n.updatedAt))
  }
}
</script>

<template>
  <AppPage
    title="Notification Center"
    description="Semua pengingat yang mudah kelewat kalau manual."
  >
    <template #actions>
      <UButton
        label="Tandai semua dibaca"
        color="neutral"
        variant="outline"
        @click="tandaiSemua"
      />
    </template>
    <MarketingGerbang layar="notifications">
      <AppPanel title="Pengingat Aktif">
        <p
          v-if="!live.length"
          class="text-sm text-muted"
        >
          Tidak ada pengingat. Semua terkendali.
        </p>
        <ul
          v-else
          class="grid grid-cols-1 gap-1"
        >
          <li
            v-for="(n, i) in live"
            :key="i"
            class="min-w-0"
          >
            <NuxtLink
              :to="n.link"
              class="flex items-center gap-3 rounded-field px-2 py-2.5 hover:bg-muted"
            >
              <UIcon
                :name="ikon(n.type)"
                class="size-5 shrink-0"
                :class="warna(n.type)"
              />
              <span class="min-w-0 flex-1">
                <b class="block text-sm text-highlighted">{{ n.title }}</b>
                <span class="block truncate text-xs text-muted">{{ n.body }}</span>
              </span>
              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 shrink-0 text-dimmed"
              />
            </NuxtLink>
          </li>
        </ul>
      </AppPanel>

      <AppPanel
        title="Riwayat Notifikasi"
        description="Kejadian yang tercatat sistem — sama dengan isi popup lonceng."
      >
        <template #head>
          <UBadge
            v-if="belum"
            :label="`${belum} belum dibaca`"
            color="warning"
            variant="soft"
          />
        </template>
        <p
          v-if="!riwayat.length"
          class="text-sm text-muted"
        >
          Belum ada notifikasi.
        </p>
        <ul
          v-else
          class="grid grid-cols-1 gap-1"
        >
          <li
            v-for="n in riwayat"
            :key="String(n.id)"
            class="min-w-0"
          >
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-field px-2 py-2.5 text-start hover:bg-muted"
              @click="buka(n)"
            >
              <span
                v-if="!n.read"
                class="size-2 shrink-0 rounded-full bg-warning"
                aria-label="Belum dibaca"
              />
              <span
                v-else
                class="size-2 shrink-0"
              />
              <span class="min-w-0 flex-1">
                <b class="block text-sm text-highlighted">{{ n.title ?? n.type }}</b>
                <span class="block truncate text-xs text-muted">{{ n.body }}</span>
              </span>
              <span class="shrink-0 text-xs text-muted">{{ laluMkt(n.at) }}</span>
            </button>
          </li>
        </ul>
      </AppPanel>
    </MarketingGerbang>
  </AppPage>
</template>
