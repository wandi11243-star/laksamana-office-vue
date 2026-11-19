<!--
  Event Baru (old newEvent + submitNewEvent, deploy/marketing/index.html:6942-7061;
  marketing.md D.3). Client from the CRM (searchable) or "+ Client baru (isi
  cepat)"; Nama Event, Jenis Event (+ typed "Lainnya"), Tanggal, Estimasi Pax,
  and Pengakuan Omset — required, EMPTY by default (F.2).

  Order of the checks is the old one, on purpose: Pengakuan Omset is refused
  BEFORE a quick client is created, so a refusal never leaves a Lead behind
  without knowing where it came from.

  PIC: a marketing person owns what they create; anyone else hands it to the
  client's PIC (else themselves).
-->
<script setup lang="ts">
import type { ClientMkt, EventMkt } from '~/utils/marketing'
import { JENIS_EVENT_MKT, MENU_FIX_KOSONG_MKT, MENU_FIX_MKT } from '~/utils/marketing'
import { hariIni } from '~/utils/format'

const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const router = useRouter()
const { data: st } = useStateMkt()
const { saya } = useAksesMkt()

const BARU = '__new__'
const f = reactive({ client: '', cnama: '', chp: '', nama: '', jenis: JENIS_EVENT_MKT[0]!, jenisLain: '', tanggal: '', pax: '', menuFix: '' })
const sibuk = ref(false)

const label = (c: ClientMkt) => c.nama + (c.perusahaan && c.perusahaan !== c.nama ? ` — ${c.perusahaan}` : '') + (c.hp ? ` (${c.hp})` : '')
const opsiClient = computed(() => [
  ...st.value.clients.slice().sort((a, b) => String(a.nama).localeCompare(String(b.nama))).map(c => ({ value: c.id, label: label(c) })),
  { value: BARU, label: '+ Client baru (isi cepat)' },
])

watch(open, (o) => {
  if (o) Object.assign(f, { client: '', cnama: '', chp: '', nama: '', jenis: JENIS_EVENT_MKT[0], jenisLain: '', tanggal: hariIni(), pax: '', menuFix: '' })
}, { immediate: true })

async function simpan() {
  const me = saya.value?.user
  if (!me) return
  const nama = f.nama.trim()
  if (!f.client || !nama) return toast.add({ title: 'Lengkapi data', description: 'Client & Nama Event wajib.', color: 'error' })
  const jenisLain = f.jenis === 'Lainnya' ? f.jenisLain.trim() : ''
  if (f.jenis === 'Lainnya' && !jenisLain) return toast.add({ title: 'Jenis event belum ditulis', description: 'Pilihan "Lainnya" harus ditulis jenisnya.', color: 'error' })
  if (!MENU_FIX_MKT.some(x => x.v === f.menuFix)) {
    return toast.add({ title: 'Pengakuan Omset wajib', description: 'Pilih: menunya sudah ditetapkan, atau dipilih di tempat. Finance memakainya untuk tahu apakah omset acara ini memotong kasir.', color: 'error' })
  }
  if (f.client === BARU && !f.cnama.trim()) return toast.add({ title: 'Nama client wajib', description: 'Isi nama client baru dulu.', color: 'error' })
  const hari = hariIni()
  const pax = +f.pax || 0
  let evId = ''
  sibuk.value = true
  const ok = await mktSimpan(async () => {
    let cl: ClientMkt | undefined
    if (f.client === BARU) {
      const cn = f.cnama.trim()
      cl = (await buatMkt<ClientMkt>('clients', {
        status: 'Lead', pipeCol: 'Lead', createdAt: hari, lastContact: hari, nama: cn, perusahaan: '', pic: '', hp: f.chp.trim(),
        email: '', ig: '', alamat: '', source: '', mktPIC: me.id, birthday: '', nextFU: '', catatan: '',
      })).data
      const clBaru = cl
      await logDenganCobaLagi(() => logMkt('client', clBaru.id, 'Lead baru masuk (dari Input Event)', cn))
    }
    else cl = st.value.clients.find(c => c.id === f.client)
    if (!cl) throw new Error('Client tidak ditemukan. Pilih client yang valid.')
    const pic = me.role === 'marketing' ? me.id : (cl.mktPIC || me.id)
    const ev = (await buatMkt<EventMkt>('events', {
      clientId: cl.id, nama, jenis: f.jenis, tanggal: f.tanggal, status: 'Lead', pipeCol: 'Lead', mktPIC: pic, pax,
      menuFix: f.menuFix, invoiceSent: false, createdAt: hari,
      detail: { jenis: f.jenis, jenisLain, tanggal: f.tanggal, pax }, payments: [], tasks: {},
    })).data
    evId = ev.id
    await logDenganCobaLagi(() => logMkt('event', ev.id, 'Event dibuat', nama))
  })
  sibuk.value = false
  if (!ok) return
  open.value = false
  router.push(`/marketing/event/${evId}`)
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    title="Event Baru"
    description="Pilih client dari CRM, atau buat client baru langsung di sini."
    lebar="sedang"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        label="Client"
        required
        help="Ketik untuk mencari. Belum terdaftar? Pilih + Client baru — nanti otomatis masuk Database Client sebagai Lead."
        class="sm:col-span-2"
      >
        <USelectMenu
          v-model="f.client"
          size="lg"
          :items="opsiClient"
          value-key="value"
          placeholder="cari nama client atau perusahaan…"
          :search-input="{ placeholder: 'Cari…' }"
          class="w-full"
        />
      </UFormField>
      <template v-if="f.client === BARU">
        <UFormField
          label="Nama Client"
          required
        >
          <UInput
            v-model="f.cnama"
            size="lg"
            class="w-full"
          />
        </UFormField>
        <UFormField label="No. HP">
          <UInput
            v-model="f.chp"
            size="lg"
            inputmode="tel"
            class="w-full"
          />
        </UFormField>
      </template>
      <UFormField
        label="Nama Event"
        required
      >
        <UInput
          v-model="f.nama"
          size="lg"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Jenis Event"
        required
      >
        <USelect
          v-model="f.jenis"
          size="lg"
          :items="JENIS_EVENT_MKT"
          class="w-full"
        />
        <UInput
          v-if="f.jenis === 'Lainnya'"
          v-model="f.jenisLain"
          size="lg"
          placeholder="Tulis jenis eventnya"
          class="mt-2 w-full"
        />
      </UFormField>
      <UFormField
        label="Tanggal"
        required
      >
        <AppTanggal
          v-model="f.tanggal"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Estimasi Pax">
        <UInput
          v-model="f.pax"
          size="lg"
          type="number"
          min="0"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Pengakuan Omset"
        required
        class="sm:col-span-2"
      >
        <!-- Two choice cards; until one is picked the block is ringed in warning
             and says it must be chosen (owner request, Nov 2026). -->
        <div
          class="rounded-xl p-2 transition-colors"
          :class="f.menuFix ? '' : 'bg-warning/5 ring-2 ring-warning/50'"
        >
          <p
            v-if="!f.menuFix"
            class="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold text-warning"
          >
            <UIcon
              name="i-lucide-alert-triangle"
              class="size-4"
            />
            Wajib dipilih — {{ MENU_FIX_KOSONG_MKT }}
          </p>
          <div class="grid gap-2 sm:grid-cols-2">
            <button
              v-for="x in MENU_FIX_MKT"
              :key="x.v"
              type="button"
              class="flex items-start gap-2.5 rounded-xl border-2 bg-default p-3 text-left transition-colors"
              :class="f.menuFix === x.v ? 'border-gold bg-gold-soft/40' : 'border-default hover:border-accented'"
              :aria-pressed="f.menuFix === x.v"
              @click="f.menuFix = x.v"
            >
              <span
                class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2"
                :class="f.menuFix === x.v ? 'border-gold-deep bg-gold-deep' : 'border-accented'"
              >
                <span
                  v-if="f.menuFix === x.v"
                  class="size-2 rounded-full bg-white"
                />
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-semibold text-highlighted">{{ x.t }}</span>
                <span class="mt-0.5 block text-xs leading-relaxed text-muted">{{ x.d }}</span>
              </span>
            </button>
          </div>
        </div>
      </UFormField>
    </div>
    <template #footer>
      <UButton
        label="Buat & Detailing →"
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
