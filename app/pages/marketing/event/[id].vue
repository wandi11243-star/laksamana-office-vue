<!--
  Marketing › Detail Event — INTERIM (#58). Every list in the module opens
  `/marketing/event/<id>`; the full detailing form (four tabs, sections
  D.1–D.11, Finance, payments, offer letter) is #59 and replaces this page.
  Until then it shows the event's head (old renderEventForm :7065-7080), the
  same summary as the calendar popup, the money from eventFinance, and
  "Catat FU" for an open event — read-only otherwise.
-->
<script setup lang="ts">
import { TAHAP_TERBUKA_MKT, jenisEvent, menuFixMkt, rentangTglMkt } from '~/utils/marketing'
import { dpLabel, eventFinance, invStatus } from '~/utils/marketing-uang'
import { ikonInvoiceMkt, ikonStatusMkt, warnaInvoiceMkt, warnaStatusMkt } from '~/utils/status-marketing'
import { hariIni, rupiah } from '~/utils/format'

definePageMeta({ access: ['marketing'] })

const route = useRoute()
const { data: st, status } = useStateMkt()
const { can } = useAksesMkt()
const fuBuka = ref(false)

const ev = computed(() => st.value.events.find(e => e.id === String(route.params.id)) ?? null)
const d = computed(() => (ev.value?.detail ?? {}) as Record<string, string>)
const uang = computed(() => (ev.value ? eventFinance(ev.value, st.value.settings) : null))
const inv = computed(() => (ev.value ? invStatus(ev.value, st.value.settings, hariIni()) : ''))
const namaClient = (id: string) => st.value.clients.find(c => c.id === id)?.nama ?? '—'
const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? '—'
const jam = computed(() => [d.value.mulaiSetup ? `Setup ${d.value.mulaiSetup}` : '', d.value.tamuDatang ? `Mulai ${d.value.tamuDatang}` : '', d.value.selesai ? `Selesai ${d.value.selesai}` : ''].filter(Boolean).join(' · '))
</script>

<template>
  <AppPage
    :title="ev?.nama ?? 'Detail Event'"
    :description="ev ? `${namaClient(ev.clientId)} · ${rentangTglMkt(ev)}` : ''"
    :back="{ label: 'Daftar', to: '/marketing/pipeline?tab=events' }"
  >
    <template
      v-if="ev && can('edit_event') && TAHAP_TERBUKA_MKT.includes(ev.status)"
      #actions
    >
      <UButton
        label="Catat FU"
        icon="i-lucide-phone-call"
        color="neutral"
        variant="outline"
        @click="fuBuka = true"
      />
    </template>

    <MarketingGerbang layar="event">
      <AppPanel v-if="!ev">
        <p class="py-6 text-center text-sm text-muted">
          <b class="block text-base text-highlighted">{{ status === 'pending' ? 'Memuat…' : 'Event tidak ditemukan' }}</b>
          <template v-if="status !== 'pending'">
            Kembali ke daftar event.
          </template>
        </p>
      </AppPanel>
      <template v-else>
        <div class="mb-4 flex flex-wrap gap-1.5">
          <AppStatus
            :color="warnaStatusMkt(ev.status)"
            :icon="ikonStatusMkt(ev.status)"
          >
            {{ ev.status }}
          </AppStatus>
          <UBadge
            :label="jenisEvent(ev) || '—'"
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

        <UAlert
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="Form detailing event (Informasi Dasar, Operasional, Finance, Overview) menyusul."
          description="Halaman ini sementara hanya menampilkan ringkasan. Untuk mengisi detail event, pakai Office lama sampai bagian ini selesai (#59)."
          class="mb-5"
        />

        <div class="grid gap-5 lg:grid-cols-2">
          <AppPanel title="Ringkasan">
            <dl class="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt class="text-muted">
                Client
              </dt>
              <dd>{{ namaClient(ev.clientId) }}</dd>
              <dt class="text-muted">
                PIC Marketing
              </dt>
              <dd>{{ namaUser(ev.mktPIC) }}</dd>
              <dt class="text-muted">
                Tanggal
              </dt>
              <dd>{{ rentangTglMkt(ev) }}</dd>
              <dt class="text-muted">
                Jam
              </dt>
              <dd>{{ jam || '—' }}</dd>
              <dt class="text-muted">
                Lantai / Area
              </dt>
              <dd>{{ d.area || '—' }}</dd>
              <dt class="text-muted">
                Sifat Acara
              </dt>
              <dd>{{ d.privacy || '—' }}</dd>
              <dt class="text-muted">
                Format F&amp;B
              </dt>
              <dd>{{ d.fbFormat || '—' }}</dd>
            </dl>
          </AppPanel>
          <AppPanel
            v-if="uang"
            title="Finance"
          >
            <dl class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
              <dt class="text-muted">
                Subtotal
              </dt>
              <dd class="num text-right">
                {{ rupiah(uang.sub) }}
              </dd>
              <template v-if="uang.disc">
                <dt class="text-muted">
                  Discount
                </dt>
                <dd class="num text-right">
                  − {{ rupiah(uang.disc) }}
                </dd>
              </template>
              <dt class="text-muted">
                Service Charge
              </dt>
              <dd class="num text-right">
                {{ rupiah(uang.service) }}
              </dd>
              <dt class="text-muted">
                PB1 {{ uang.taxPct }}%{{ uang.taxInc ? ' (termasuk)' : '' }}
              </dt>
              <dd class="num text-right">
                {{ rupiah(uang.tax) }}
              </dd>
              <dt class="font-semibold">
                GRAND TOTAL
              </dt>
              <dd class="num text-right font-bold">
                {{ rupiah(uang.grand) }}
              </dd>
              <dt class="text-muted">
                {{ dpLabel(uang) }}
              </dt>
              <dd class="num text-right">
                {{ rupiah(uang.dp) }}
              </dd>
              <dt class="text-muted">
                Terbayar
              </dt>
              <dd class="num text-right">
                {{ rupiah(uang.paid) }}
              </dd>
              <dt class="text-muted">
                Sisa
              </dt>
              <dd class="num text-right font-semibold">
                {{ rupiah(uang.remaining) }}
              </dd>
              <dt class="text-muted">
                Status Invoice
              </dt>
              <dd class="text-right">
                <AppStatus
                  :color="warnaInvoiceMkt(inv)"
                  :icon="ikonInvoiceMkt(inv)"
                  size="sm"
                >
                  {{ inv }}
                </AppStatus>
              </dd>
            </dl>
          </AppPanel>
        </div>
      </template>
    </MarketingGerbang>

    <MarketingFollowUp
      v-if="ev"
      v-model:open="fuBuka"
      :client-id="ev.clientId"
      :event-id="ev.id"
    />
  </AppPage>
</template>
