<!--
  Category detail (`renderKategoriDetail :7128`): four cards — Terjual (n /
  quota, what is left), Uang Masuk, Pembeli, Kursi Terpakai — then the buyers
  of this class, ONE ROW PER ORDER (`salesRingkas :7262`): a person buying six
  VIP tickets is one buyer bringing six people. Refunded orders stay listed
  (marked) but add neither money nor valid tickets. Biggest buyers first,
  8 per page (KAT_PER_HAL). The dimmed-floor-plan card is not ported (the
  canvas floor plan lives in the old app only).
-->
<script setup lang="ts">
import type { Kursi, OrderTiket, Tiket } from '~/composables/useEvent'
import { getEvent, useDaftarEvent } from '~/composables/useEvent'
import { apiErrorMessage } from '~/composables/useApi'
import { fmtTglJamEms } from '~/utils/event-hitung'
import { angka, rupiah } from '~/utils/format'

definePageMeta({ access: ['event'] })

const route = useRoute()
const id = computed(() => String(route.params.id ?? ''))
const kelasId = computed(() => String(route.params.kelas ?? ''))

const { data: envAcara, error } = useAsyncData(`event-kat-acara-${id.value}`, () => getEvent('events', id.value))
const acara = computed(() => envAcara.value?.data as Record<string, unknown> | undefined)

const q = computed<Record<string, string>>(() => ({ event_id: id.value }))
const { data: daftarKelas } = useDaftarEvent('ticket-classes', q, `event-kat-kelas-${id.value}`)
const { data: daftarOrder } = useDaftarEvent<OrderTiket>('orders', q, `event-kat-order-${id.value}`)
const { data: daftarKursi } = useDaftarEvent<Kursi>('seats', q, `event-kat-kursi-${id.value}`)
// scoped by ticket_class_id: legacy tickets carry no event_id, so filtering on it dropped them
const { data: daftarTiket, status } = useDaftarEvent<Tiket>('tickets', { ticket_class_id: kelasId.value } as never, `event-kat-tiket-${id.value}-${kelasId.value}`)

const kelas = computed(() => daftarKelas.value.rows.find(c => c.id === kelasId.value))
const harga = computed(() => Number(kelas.value?.price) || 0)
const kuota = computed(() => Number(kelas.value?.quota) || 0)
const kursiDari = computed(() => new Map(daftarKursi.value.rows.map(s => [String(s.id), s])))

interface Pembeli { order: OrderTiket, nama: string, hp: string, email: string, jml: number, rp: number, refund: boolean, kursi: Map<string, number>, masuk: number }
const ringkas = computed(() => {
  const tiket = daftarTiket.value.rows.filter(t => t.ticket_class_id === kelasId.value)
  const per = new Map<string, Pembeli>()
  let n = 0
  let rp = 0
  for (const o of daftarOrder.value.rows.filter(x => x.event_id === id.value)) {
    const refund = o.payment_status === 'Refunded'
    for (const t of tiket) {
      if (String(t.order_item_id ?? t.order_id ?? '') !== o.id) continue
      let b = per.get(o.id)
      if (!b) {
        b = { order: o, nama: o.buyer_name ?? '—', hp: o.phone ?? '', email: o.email ?? '', jml: 0, rp: 0, refund, kursi: new Map(), masuk: 0 }
        per.set(o.id, b)
      }
      b.jml += 1
      if (t.status === 'Checked-In') b.masuk += 1
      const s = t.seat_id ? kursiDari.value.get(String(t.seat_id)) : undefined
      if (s) {
        const l = String(s.table_no ?? s.seat_no ?? '')
        b.kursi.set(l, (b.kursi.get(l) ?? 0) + 1)
      }
      if (refund) continue
      b.rp += harga.value
      n += 1
      rp += harga.value
    }
  }
  const pembeli = [...per.values()].sort((a, b) => b.jml - a.jml || a.nama.localeCompare(b.nama))
  return { n, rp, pembeli }
})
const sisa = computed(() => (kuota.value ? Math.max(0, kuota.value - ringkas.value.n) : null))
// Kursi Terpakai: this class's seats on the plan, sold = a valid ticket sits on it.
const denah = computed(() => {
  const milik = daftarKursi.value.rows.filter(s => String(s.class_id ?? '') === kelasId.value)
  const ids = new Set(milik.map(s => String(s.id)))
  const terpakai = new Set(daftarTiket.value.rows
    .filter(t => t.seat_id && ids.has(String(t.seat_id)) && t.status !== 'Refunded' && t.status !== 'Cancelled')
    .map(t => String(t.seat_id)))
  return { total: milik.length, terpakai: terpakai.size }
})

const kursiTeks = (b: Pembeli) => [...b.kursi].map(([l, c]) => (c > 1 ? `${l} (${c})` : l)).join(', ') || '—'

const hal = ref(1)
const PER_HAL = 8
const total = computed(() => ringkas.value.pembeli.length)
const maxHal = computed(() => Math.max(1, Math.ceil(total.value / PER_HAL)))
const kini = computed(() => Math.min(hal.value, maxHal.value))
const mulai = computed(() => (kini.value - 1) * PER_HAL)
const halaman = computed(() => ringkas.value.pembeli.slice(mulai.value, mulai.value + PER_HAL))
</script>

<template>
  <EventGerbang lihat="ticketing">
    <AppPage
      :title="`${kelas?.name ?? 'Kategori tiket'} — ${acara?.title ?? ''}`"
      :description="`Ticketing / ${acara?.title ?? ''} / ${kelas?.name ?? ''}`"
      :back="{ label: 'Kembali ke Penjualan', to: `/event/ticketing/${id}` }"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :title="apiErrorMessage(error)"
        class="mb-4"
      />
      <div
        v-if="kelas"
        class="mb-4 flex flex-wrap items-center gap-2"
      >
        <b class="text-highlighted">{{ kelas.name }}</b>
        <UBadge
          :color="kelas.is_seated ? 'secondary' : 'info'"
          variant="soft"
        >
          {{ kelas.is_seated ? 'Kursi bernomor' : 'Bebas berdiri' }}
        </UBadge>
      </div>

      <AppStatGrid class="mb-4">
        <AppStat
          label="Terjual"
          :value="kuota ? `${angka(ringkas.n)} / ${angka(kuota)}` : angka(ringkas.n)"
          :sub="kuota ? (sisa ? `sisa ${angka(sisa)} tiket` : 'kuota habis') : 'kuota belum disetel'"
          icon="i-lucide-ticket-check"
          tone="success"
        />
        <AppStat
          label="Uang masuk"
          :value="rupiah(ringkas.rp)"
          :sub="harga ? `${rupiah(harga)} / tiket` : 'harga belum disetel'"
          icon="i-lucide-banknote"
          tone="gold"
        />
        <AppStat
          label="Pembeli"
          :value="angka(total)"
          sub="pesanan di kategori ini"
          icon="i-lucide-users"
          tone="info"
        />
        <AppStat
          label="Kursi terpakai"
          :value="denah.total ? `${angka(denah.terpakai)} / ${angka(denah.total)}` : '—'"
          :sub="denah.total ? 'menurut denah' : 'kategori tanpa denah'"
          icon="i-lucide-armchair"
          tone="vip"
        />
      </AppStatGrid>

      <AppPanel
        :title="`Penjualan ${kelas?.name ?? ''}`"
        icon="i-lucide-users"
        flush
      >
        <div
          v-if="status === 'pending'"
          class="space-y-2 p-4"
        >
          <USkeleton
            v-for="i in 3"
            :key="i"
            class="h-10"
          />
        </div>
        <p
          v-else-if="!total"
          class="px-4 py-6 text-center text-sm text-dimmed"
        >
          Belum ada yang membeli kategori ini.
        </p>
        <template v-else>
          <UTable
            :columns="[{ id: 'pembeli', header: 'Pembeli' }, { id: 'kontak', header: 'Kontak' }, { id: 'tiket', header: 'Tiket' }, { id: 'tempat', header: 'Tempat' }, { id: 'nilai', header: 'Nilai' }, { id: 'ci', header: 'Check-in' }]"
            :data="halaman"
            class="hidden lg:block"
          >
            <template #pembeli-cell="{ row }">
              <b class="text-highlighted">{{ row.original.nama }}</b>
              <UBadge
                v-if="row.original.refund"
                color="neutral"
                variant="soft"
                size="sm"
                class="ml-1"
              >
                Refunded
              </UBadge>
              <span class="block text-xs text-muted">{{ fmtTglJamEms(row.original.order.created || row.original.order.createdAt) }}</span>
            </template>
            <template #kontak-cell="{ row }">
              <span class="text-xs text-muted">{{ row.original.hp || '—' }}<template v-if="row.original.email"><br>{{ row.original.email }}</template></span>
            </template>
            <template #tiket-cell="{ row }">
              <b class="num">{{ angka(row.original.jml) }}</b> tiket
            </template>
            <template #tempat-cell="{ row }">
              <span class="text-xs text-muted">{{ kursiTeks(row.original) }}</span>
            </template>
            <template #nilai-cell="{ row }">
              <span
                v-if="row.original.refund"
                class="text-xs text-muted"
              >dikembalikan</span>
              <span
                v-else
                class="num"
              >{{ rupiah(row.original.rp) }}</span>
            </template>
            <template #ci-cell="{ row }">
              <span class="text-xs text-muted num">{{ row.original.masuk ? `${row.original.masuk} / ${row.original.jml}` : '—' }}</span>
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="b in halaman"
              :key="b.order.id"
              class="space-y-0.5 px-4 py-3 text-sm"
            >
              <div class="flex items-start justify-between gap-2">
                <b class="truncate text-highlighted">{{ b.nama }}</b>
                <span class="shrink-0 num">{{ b.refund ? 'dikembalikan' : rupiah(b.rp) }}</span>
              </div>
              <p class="text-xs text-muted">
                {{ angka(b.jml) }} tiket · {{ kursiTeks(b) }} · check-in {{ b.masuk ? `${b.masuk} / ${b.jml}` : '—' }}
              </p>
              <p class="text-xs text-muted">
                {{ b.hp || '—' }}<template v-if="b.email">
                  · {{ b.email }}
                </template> · {{ fmtTglJamEms(b.order.created || b.order.createdAt) }}
              </p>
            </li>
          </ul>
          <div
            v-if="maxHal > 1"
            class="flex items-center justify-between gap-2 border-t border-default px-4 py-2.5 text-sm text-muted"
          >
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-chevron-left"
              label="Sebelumnya"
              :disabled="kini <= 1"
              @click="hal = kini - 1"
            />
            <span class="num text-xs">{{ mulai + 1 }}–{{ Math.min(mulai + PER_HAL, total) }} dari {{ total }} pembeli</span>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              trailing-icon="i-lucide-chevron-right"
              label="Berikutnya"
              :disabled="kini >= maxHal"
              @click="hal = kini + 1"
            />
          </div>
        </template>
      </AppPanel>
    </AppPage>
  </EventGerbang>
</template>
