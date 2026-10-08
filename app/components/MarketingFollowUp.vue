<!--
  Catat Follow Up (old logFollowUp + saveFollowUp, deploy/marketing/index.html:6618-6684).
  The follow-up is FOR an open event of the client (its result moves that
  event's stage, HASIL_FU_MKT), for a new opportunity (creates the event as a
  Lead), or "Umum / after-sales" (no stage; the next date goes on the client).
  Deal/Lost clear the event's next follow-up date.

  Writes, in order: [new event] → follow-up row → client lastContact → event
  stage/next date. Each with its version; the activity lines follow as before.

  Correction vs the old client: the follow-up time was written with
  toISOString() — UTC — so a follow-up before 07:00 WIB was dated yesterday
  and missed the Dashboard's "Follow Up Hari Ini". Here it is local time.
-->
<script setup lang="ts">
import type { ClientMkt, EventMkt, FollowupMkt } from '~/utils/marketing'
import { AKSI_FU_MKT, HASIL_FU_MKT, JENIS_EVENT_MKT, ingatTahapMkt, peluangClientMkt, tglFuBerikut, tglMkt, tugasDealMkt } from '~/utils/marketing'
import { hariIni } from '~/utils/format'

const props = defineProps<{ clientId: string | null, eventId?: string | null }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const router = useRouter()
const { data: st } = useStateMkt()
const { saya } = useAksesMkt()

const BARU = '__new__'
const UMUM = '__umum__'
const client = computed(() => st.value.clients.find(c => c.id === props.clientId) ?? null)
const terbuka = computed(() => (props.clientId ? peluangClientMkt(st.value.events, props.clientId) : []))
const riwayat = computed(() => st.value.followups.filter(f => f.clientId === props.clientId).sort((a, b) => String(b.at).localeCompare(String(a.at))))
const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? '—'
const namaEvent = (id?: string) => st.value.events.find(e => e.id === id)?.nama

const f = reactive({ target: BARU, nama: '', jenis: JENIS_EVENT_MKT[0]!, tanggal: '', action: AKSI_FU_MKT[0]!, hasil: Object.keys(HASIL_FU_MKT)[0]!, note: '', next: '' })
const sibuk = ref(false)

const opsiTarget = computed(() => [
  ...terbuka.value.map(e => ({ value: e.id, label: `${e.nama} · ${e.status} · ${tglMkt(e.tanggal)}` })),
  { value: BARU, label: '+ Peluang baru (buat event)' },
  { value: UMUM, label: 'Umum / after-sales (tidak mengubah status)' },
])

watch(open, (o) => {
  if (!o) return
  const hari = hariIni()
  Object.assign(f, {
    target: props.eventId || terbuka.value[0]?.id || BARU,
    nama: '', jenis: JENIS_EVENT_MKT[0], tanggal: hari, action: AKSI_FU_MKT[0], hasil: Object.keys(HASIL_FU_MKT)[0], note: '',
    next: tglFuBerikut(hari, +st.value.settings.fuNextDays),
  })
}, { immediate: true })

/** 'YYYY-MM-DDTHH:mm' in local time. */
function sekarangLokal() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

async function simpan() {
  const c = client.value
  const me = saya.value?.user
  if (!c || !me) return
  if (f.target === BARU && !f.nama.trim()) return toast.add({ title: 'Nama event wajib', description: 'Isi nama peluang/event baru dulu.', color: 'error' })
  const hari = hariIni()
  const note = f.note.trim()
  const tahap = HASIL_FU_MKT[f.hasil] ?? null
  const fuNext = tglFuBerikut(hari, +st.value.settings.fuNextDays)
  const fb = formatFbMkt(st.value)
  let ingat = ''
  let judulToast = ''
  sibuk.value = true
  const ok = await mktSimpan(async () => {
    let ev: EventMkt | null = null
    if (f.target === BARU) {
      const nama = f.nama.trim()
      const draf: Partial<EventMkt> = {
        clientId: c.id, nama, jenis: f.jenis, tanggal: f.tanggal, status: 'Lead', pipeCol: 'Lead', mktPIC: c.mktPIC || me.id,
        pax: 0, invoiceSent: false, createdAt: hari, detail: { jenis: f.jenis, tanggal: f.tanggal }, payments: [], tasks: {},
      }
      ev = (await buatMkt<EventMkt>('events', draf)).data
      await logMkt('event', ev.id, 'Peluang baru dibuat (dari Follow Up)', nama).catch(() => {})
    }
    else if (f.target !== UMUM) {
      ev = st.value.events.find(e => e.id === f.target) ?? null
    }
    await buatMkt<FollowupMkt>('followups', { clientId: c.id, eventId: ev?.id ?? '', by: me.id, action: f.action, hasil: f.hasil, note, at: sekarangLokal(), next: f.next })
    await tambalMkt<ClientMkt>('clients', c.id, ev ? { lastContact: hari } : { lastContact: hari, nextFU: f.next }, c.updatedAt)
    if (ev) {
      const ubah: Partial<EventMkt> = {}
      let status = ev.status
      if (tahap && tahap !== ev.status) {
        ingat = ingatTahapMkt(ev, tahap)
        ubah.status = tahap
        ubah.pipeCol = tahap
        status = tahap
        if (tahap === 'Deal') ubah.tasks = tugasDealMkt(ev, fb)
        await logMkt('event', ev.id, `Follow up: ${f.action}`, `${f.hasil} · ${ev.status} → ${tahap}${note ? ` · ${note}` : ''}`).catch(() => {})
      }
      else {
        await logMkt('event', ev.id, `Follow up: ${f.action}`, f.hasil + (note ? ` · ${note}` : '')).catch(() => {})
      }
      ubah.nextFU = ['Deal', 'Lost'].includes(status) ? '' : (f.next || fuNext)
      await tambalMkt<EventMkt>('events', ev.id, ubah, ev.updatedAt)
      judulToast = `${ev.nama} → ${f.hasil}`
    }
    else {
      await logMkt('client', c.id, `Follow up umum: ${f.action}`, f.hasil + (note ? ` · ${note}` : '')).catch(() => {})
      judulToast = `${c.nama} → ${f.hasil}`
    }
  })
  sibuk.value = false
  if (!ok) return
  open.value = false
  toast.add({ title: 'Follow up dicatat', description: judulToast, color: 'success' })
  if (ingat) setTimeout(() => toast.add({ title: 'Data dasar belum lengkap', description: ingat, color: 'warning' }), 700)
  router.push('/marketing/pipeline')
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    title="Catat Follow Up"
    :description="client?.nama"
  >
    <details
      v-if="riwayat.length"
      class="mb-4"
    >
      <summary class="cursor-pointer text-sm font-semibold text-muted">
        Riwayat follow up sebelumnya ({{ riwayat.length }})
      </summary>
      <ul class="mt-2 max-h-56 divide-y divide-default overflow-auto">
        <li
          v-for="x in riwayat"
          :key="x.id"
          class="py-2 text-xs"
        >
          <p class="text-muted">
            {{ String(x.at).replace('T', ' ') }} · {{ namaUser(x.by) }} · {{ namaEvent(x.eventId) || 'Umum / after-sales' }}
          </p>
          <p><b>{{ x.action }}</b> → {{ x.hasil }}</p>
          <p
            v-if="x.note"
            class="text-muted"
          >
            {{ x.note }}
          </p>
        </li>
      </ul>
    </details>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        label="Follow up ini untuk"
        required
        help="Hasil follow up akan menggerakkan tahap event yang dipilih di Pipeline."
        class="sm:col-span-2"
      >
        <USelect
          v-model="f.target"
          :items="opsiTarget"
          class="w-full"
        />
      </UFormField>
      <template v-if="f.target === BARU">
        <UFormField
          label="Nama Event"
          required
        >
          <UInput
            v-model="f.nama"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jenis Event">
          <USelect
            v-model="f.jenis"
            :items="JENIS_EVENT_MKT"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tanggal (perkiraan)">
          <UInput
            v-model="f.tanggal"
            type="date"
            class="w-full"
          />
        </UFormField>
      </template>
      <UFormField label="Jenis Aktivitas">
        <USelect
          v-model="f.action"
          :items="AKSI_FU_MKT"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Hasil">
        <USelect
          v-model="f.hasil"
          :items="Object.keys(HASIL_FU_MKT)"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Catatan"
        class="sm:col-span-2"
      >
        <UTextarea
          v-model="f.note"
          placeholder="Ringkasan hasil follow up..."
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Jadwalkan Follow Up Berikutnya"
        :help="`Otomatis +${+st.settings.fuNextDays || 3} hari (atur di Pengaturan). Kosongkan bila peluang sudah Deal/Lost.`"
        class="sm:col-span-2"
      >
        <UInput
          v-model="f.next"
          type="date"
          class="w-full"
        />
      </UFormField>
    </div>
    <template #footer>
      <UButton
        label="Simpan Follow Up"
        :loading="sibuk"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
</template>
