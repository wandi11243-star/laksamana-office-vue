<!--
  One client (old viewClient + delClient, deploy/marketing/index.html:6016-6122).
  Tags, contact, Riwayat Event, Riwayat Follow Up; footer: delete (del_client),
  WhatsApp, Edit and Follow Up (edit_client).

  Deleting (F.6, F.7): a client that still holds events CANNOT be deleted — the
  sheet lists them instead. Otherwise the name must be typed exactly; its
  follow-ups go with it, as before.
-->
<script setup lang="ts">
import type { ClientMkt } from '~/utils/marketing'
import { BATAS_VIP_MKT, eventsClientMkt, menangClientMkt, namaCocok, peluangClientMkt, rentangTglMkt, selesaiClientMkt, tglMkt } from '~/utils/marketing'
import { belanjaClientMkt, eventFinance } from '~/utils/marketing-uang'
import { ikonStatusMkt, warnaStatusMkt } from '~/utils/status-marketing'
import { rupiah } from '~/utils/format'
import { waTautan } from '~/utils/wa'

const props = defineProps<{ clientId: string | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ edit: [c: ClientMkt], followUp: [id: string] }>()

const router = useRouter()
const { data: st } = useStateMkt()
const { saya, can } = useAksesMkt()

const c = computed(() => st.value.clients.find(x => x.id === props.clientId) ?? null)
const evs = computed(() => (c.value ? eventsClientMkt(st.value.events, c.value.id) : []))
const fus = computed(() => st.value.followups.filter(f => f.clientId === props.clientId).sort((a, b) => String(b.at).localeCompare(String(a.at))))
const belanja = computed(() => (c.value ? belanjaClientMkt(st.value.events, st.value.settings, c.value.id) : 0))
const peluang = computed(() => (c.value ? peluangClientMkt(st.value.events, c.value.id) : []))
const repeat = computed(() => (c.value ? selesaiClientMkt(st.value.events, c.value.id).length > 1 : false))
const pernahDeal = computed(() => (c.value ? menangClientMkt(st.value.events, c.value.id).length > 0 : false))
const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? '—'
const namaEvent = (id?: string) => st.value.events.find(e => e.id === id)?.nama
const grand = (id: string) => {
  const e = st.value.events.find(x => x.id === id)
  return e ? eventFinance(e, st.value.settings).grand : 0
}
const wa = computed(() => (c.value ? waTautan(c.value.hp, `Halo ${c.value.nama}, dari tim Laksamana Muda 👋`) : ''))

function buka(id: string) {
  open.value = false
  router.push(`/marketing/event/${id}`)
}

// ---- hapus permanen ----
const hapusBuka = ref(false)
const ketik = ref('')
const sibuk = ref(false)
function mintaHapus() {
  ketik.value = ''
  hapusBuka.value = true
}
async function hapus() {
  const x = c.value
  if (!x || !can('del_client')) return
  if (!namaCocok(ketik.value, x.nama)) return
  const fu = st.value.followups.filter(f => f.clientId === x.id)
  sibuk.value = true
  const ok = await mktSimpan(async () => {
    // Re-checked at the moment of deleting: an event may have been added meanwhile.
    if (eventsClientMkt(st.value.events, x.id).length) throw new Error('Client ini sekarang memegang event. Bereskan event-nya lebih dulu.')
    await hapusMkt('clients', x.id, x.updatedAt)
    for (const f of fu) await hapusMkt('followups', f.id, f.updatedAt)
  }, `${x.nama} dihapus permanen.`, { refType: 'client', action: 'Client dihapus permanen', detail: `${x.nama}${x.perusahaan ? ` · ${x.perusahaan}` : ''} · ${fu.length} follow up · oleh ${saya.value?.user.name ?? ''}` })
  sibuk.value = false
  if (!ok) return
  hapusBuka.value = false
  open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="c?.nama ?? 'Client'"
    :description="c ? `${c.perusahaan || 'Perorangan'} · PIC ${namaUser(c.mktPIC)}${c.source ? ` · ${c.source}` : ''}` : ''"
  >
    <template v-if="c">
      <div class="mb-4 flex flex-wrap gap-1.5">
        <AppStatus
          v-for="e in peluang.slice(0, 3)"
          :key="e.id"
          :color="warnaStatusMkt(e.status)"
          :icon="ikonStatusMkt(e.status)"
          size="sm"
        >
          {{ e.status }}
        </AppStatus>
        <UBadge
          v-if="peluang.length > 3"
          :label="`+${peluang.length - 3}`"
          color="neutral"
          variant="soft"
        />
        <AppStatus
          v-if="repeat"
          color="gold"
          icon="i-lucide-repeat"
          size="sm"
        >
          Repeat
        </AppStatus>
        <AppStatus
          v-else-if="pernahDeal"
          color="success"
          icon="i-lucide-handshake"
          size="sm"
        >
          Pernah deal
        </AppStatus>
        <UBadge
          :label="`${evs.length} event`"
          color="neutral"
          variant="soft"
        />
        <UBadge
          v-if="belanja"
          :label="`Total ${rupiah(belanja)}`"
          variant="soft"
        />
        <UBadge
          v-if="belanja > BATAS_VIP_MKT"
          label="Klien VIP"
          icon="i-lucide-star"
          variant="soft"
        />
      </div>
      <dl class="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt class="text-muted">
          Kontak
        </dt>
        <dd>{{ [c.hp, c.email, c.ig].filter(Boolean).join(' · ') }}</dd>
        <dt class="text-muted">
          Alamat
        </dt>
        <dd>{{ c.alamat || '—' }}</dd>
        <dt class="text-muted">
          Input
        </dt>
        <dd>{{ tglMkt(c.createdAt) }}</dd>
        <dt class="text-muted">
          Kontak terakhir
        </dt>
        <dd>{{ tglMkt(c.lastContact) }}</dd>
        <dt class="text-muted">
          Next follow up
        </dt>
        <dd>{{ tglMkt(c.nextFU) }}</dd>
        <dt class="text-muted">
          Catatan
        </dt>
        <dd class="whitespace-pre-line">
          {{ c.catatan || '—' }}
        </dd>
      </dl>

      <USeparator class="my-4" />
      <h4 class="mb-2 font-semibold text-highlighted">
        Riwayat Event
      </h4>
      <p
        v-if="!evs.length"
        class="text-sm text-muted"
      >
        Belum ada event.
      </p>
      <ul
        v-else
        class="divide-y divide-default"
      >
        <li
          v-for="e in evs"
          :key="e.id"
        >
          <button
            type="button"
            class="flex w-full items-start justify-between gap-3 py-2 text-left"
            @click="buka(e.id)"
          >
            <span class="min-w-0">
              <b class="block truncate">{{ e.nama }}</b>
              <span class="text-xs text-muted">{{ rentangTglMkt(e) }}</span>
            </span>
            <span class="shrink-0 text-right">
              <AppStatus
                :color="warnaStatusMkt(e.status)"
                :icon="ikonStatusMkt(e.status)"
                size="sm"
              >{{ e.status }}</AppStatus>
              <span class="num block text-xs text-muted">{{ rupiah(grand(e.id)) }}</span>
            </span>
          </button>
        </li>
      </ul>

      <USeparator class="my-4" />
      <h4 class="mb-2 font-semibold text-highlighted">
        Riwayat Follow Up
      </h4>
      <p
        v-if="!fus.length"
        class="text-sm text-muted"
      >
        Belum ada follow up.
      </p>
      <ol
        v-else
        class="space-y-3 border-s border-default ps-4"
      >
        <li
          v-for="f in fus"
          :key="f.id"
          class="text-sm"
        >
          <p class="text-xs text-muted">
            {{ String(f.at).replace('T', ' ') }} · {{ namaUser(f.by) }} · {{ namaEvent(f.eventId) || 'Umum / after-sales' }}
          </p>
          <p class="font-semibold">
            {{ f.action }} → {{ f.hasil }}
          </p>
          <p
            v-if="f.note"
            class="whitespace-pre-line text-muted"
          >
            {{ f.note }}
          </p>
        </li>
      </ol>
    </template>
    <template #footer>
      <template v-if="c">
        <UButton
          v-if="can('edit_client')"
          label="Follow Up"
          icon="i-lucide-plus"
          @click="open = false; emit('followUp', c.id)"
        />
        <UButton
          v-if="can('edit_client')"
          label="Edit"
          icon="i-lucide-pencil"
          color="neutral"
          variant="outline"
          @click="open = false; emit('edit', c)"
        />
        <UButton
          label="WhatsApp"
          icon="i-lucide-message-circle"
          color="neutral"
          variant="outline"
          :to="wa"
          target="_blank"
        />
        <UButton
          v-if="can('del_client')"
          icon="i-lucide-trash-2"
          color="error"
          variant="outline"
          aria-label="Hapus client permanen"
          @click="mintaHapus"
        />
      </template>
    </template>
  </ResponsiveSheet>

  <ResponsiveSheet
    v-if="c"
    v-model:open="hapusBuka"
    title="Hapus Client Permanen"
    :description="`${c.nama} · ${c.perusahaan || 'Perorangan'}`"
  >
    <template v-if="evs.length">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Client ini tidak bisa dihapus karena masih memegang ${evs.length} event${belanja ? ` dengan total belanja ${rupiah(belanja)}` : ''}.`"
        description="Menghapusnya akan membuat event-event itu kehilangan nama client di daftar event, pipeline, invoice, brief, dan laporan — tanpa pesan galat apa pun."
      />
      <p class="my-3 text-sm text-muted">
        Pindahkan event ke client lain, atau hapus event-nya lebih dulu (butuh izin hapus event). Sesudah client ini tidak memegang event mana pun, tombol hapus akan muncul.
      </p>
      <h4 class="mb-2 font-semibold">
        Event yang masih terhubung ({{ evs.length }})
      </h4>
      <ul class="divide-y divide-default">
        <li
          v-for="e in evs"
          :key="e.id"
          class="flex items-center justify-between gap-3 py-2"
        >
          <span class="min-w-0">
            <b class="block truncate">{{ e.nama }}</b>
            <span class="text-xs text-muted">{{ rentangTglMkt(e) }} · {{ e.status }}</span>
          </span>
          <UButton
            label="Buka"
            size="xs"
            color="neutral"
            variant="outline"
            @click="hapusBuka = false; buka(e.id)"
          />
        </li>
      </ul>
    </template>
    <template v-else>
      <UAlert
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Tindakan ini permanen dan tidak bisa dibatalkan. Data di bawah ikut terhapus."
      />
      <dl class="mt-3 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1 text-sm">
        <dt class="text-muted">
          Kontak
        </dt>
        <dd class="num">
          {{ c.hp || '—' }}
        </dd>
        <dt class="text-muted">
          Source
        </dt>
        <dd>{{ c.source || '—' }}</dd>
        <dt class="text-muted">
          Event terhubung
        </dt>
        <dd class="num">
          0 · aman dihapus
        </dd>
        <dt class="text-muted">
          Riwayat follow up
        </dt>
        <dd
          class="num"
          :class="fus.length ? 'font-semibold text-error' : ''"
        >
          {{ fus.length }}{{ fus.length ? ' · ikut terhapus' : '' }}
        </dd>
        <dt class="text-muted">
          Terdaftar sejak
        </dt>
        <dd class="num">
          {{ tglMkt(c.createdAt) }}
        </dd>
      </dl>
      <UFormField
        :label="`Ketik ${c.nama} untuk konfirmasi`"
        required
        class="mt-4"
      >
        <UInput
          v-model="ketik"
          :placeholder="c.nama"
          autocomplete="off"
          class="w-full"
        />
      </UFormField>
    </template>
    <template #footer>
      <UButton
        v-if="!evs.length"
        label="Hapus permanen"
        icon="i-lucide-trash-2"
        color="error"
        :disabled="!namaCocok(ketik, c.nama)"
        :loading="sibuk"
        @click="hapus"
      />
      <UButton
        :label="evs.length ? 'Tutup' : 'Batal'"
        color="neutral"
        variant="outline"
        @click="hapusBuka = false"
      />
    </template>
  </ResponsiveSheet>
</template>
