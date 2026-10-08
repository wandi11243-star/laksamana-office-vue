<!--
  Marketing › Notification Center (docs/migrasi/marketing.md D.18, issue
  #60): live reminders that are easy to miss when manual (computed, never
  stored) + the stored history that feeds the shell bell. Rows open their
  target and mark themselves read.
-->
<script setup lang="ts">
import type { NotifMkt } from '~/utils/marketing-keuangan'
import { belumDibacaMkt, linkNotifMkt, pengingatMkt } from '~/utils/marketing-keuangan'
import { mktSimpan, tandaiDibacaMkt, useStateMkt } from '~/composables/useMarketing'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['marketing'] })

const router = useRouter()
const { data: st } = useStateMkt()
const hari = hariIni()

const live = computed(() => pengingatMkt(st.value.events, st.value.clients, st.value.settings, hari))
const riwayat = computed<NotifMkt[]>(() => [...((st.value.notifs as unknown as NotifMkt[] | undefined) ?? [])].sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? ''))))
const belum = computed(() => belumDibacaMkt(riwayat.value))

const ikon = (t?: string) => ({
  dp: 'i-lucide-wallet', event: 'i-lucide-calendar', fu: 'i-lucide-phone-call',
  inv: 'i-lucide-alarm-clock', approval: 'i-lucide-circle-check', payment: 'i-lucide-banknote',
}[String(t ?? '')] ?? 'i-lucide-bell')

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
        v-if="belum"
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
          class="grid gap-1"
        >
          <li
            v-for="(n, i) in live"
            :key="i"
          >
            <NuxtLink
              :to="n.link"
              class="flex items-center gap-3 rounded-field px-2 py-2.5 hover:bg-muted"
            >
              <UIcon
                :name="ikon(n.type)"
                class="size-5 shrink-0 text-muted"
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

      <AppPanel title="Riwayat Notifikasi">
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
          class="grid gap-1"
        >
          <li
            v-for="n in riwayat"
            :key="String(n.id)"
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
              <span class="shrink-0 text-xs text-muted">{{ n.at }}</span>
            </button>
          </li>
        </ul>
      </AppPanel>
    </MarketingGerbang>
  </AppPage>
</template>
