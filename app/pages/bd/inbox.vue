<!--
  BD OS › Undangan & Notifikasi (old `vInbox`, Okt 2026).

  Three tabs: Perlu respons (my unanswered invites + tasks waiting on my
  review, both decidable right here), Notifikasi (everything computed from
  data — invites, answers on my agendas, new assignments, reviewer tags,
  pending reviews, review verdicts), and Undangan saya (the agendas I
  organise, with one answer column per RSVP).

  The list is the board's truth; only the READ mark is stored, in this
  browser (localStorage, per account) — it never travels devices, and the
  screen says so.
-->
<script setup lang="ts">
import type { BdAgenda, BdTask } from '~/composables/useBd'
import { bdTulisDiam, kembalikanReview, setujuiReview, tambalBd, useBdState, versiBaris } from '~/composables/useBd'
import { cariAku, catIniAku, labelJam, todayISO, undanganTertunda } from '~/utils/bd-rumus'
import {
  agendaku, bacaStateNotif, bolehReview, fWaktuNotif, jumlahBelumDibacaNotif, kunciBacaNotif,
  notifBd, reviewTertunda, sudahDibacaNotif, tulisStateNotif, NOTIF_HARI, type BacaNotif, type BdNotif,
} from '~/utils/bd-notif'
import BdAgendaSheet from '~/widgets/bd/BdAgendaSheet.vue'
import BdTaskSheet from '~/widgets/bd/BdTaskSheet.vue'
import { fTgl } from '~/utils/format'

definePageMeta({ access: ['bd'] })

const me = useMe()
const { data: state } = useBdState()
const toast = useToast()

const people = computed(() => state.value.people)
const tasks = computed(() => state.value.tasks)
const projects = computed(() => state.value.projects)
const aku = computed(() => cariAku(people.value, me.value))

const tab = useState<'respons' | 'notif' | 'kirim'>('bd-inbox-tab', () => 'respons')
const undangan = computed(() => undanganTertunda(state.value.agenda, aku.value?.id, todayISO()))
const review = computed(() => reviewTertunda(tasks.value, aku.value?.id))
const daftarNotif = computed(() => notifBd(state.value.agenda, tasks.value, people.value, aku.value?.id))
const kirim = computed(() => agendaku(state.value.agenda, aku.value?.id))

// ---- read marks: per account, this device only ----
const kunci = computed(() => kunciBacaNotif(catIniAku(people.value, me.value?.id)))
const baca = ref<BacaNotif>({ all: 0, k: {} })
onMounted(() => {
  baca.value = bacaStateNotif(kunci.value)
})
watch(kunci, k => (baca.value = bacaStateNotif(k)))
const belum = computed(() => jumlahBelumDibacaNotif(daftarNotif.value, baca.value))

function simpanBaca(s: BacaNotif) {
  baca.value = s
  tulisStateNotif(kunci.value, s)
}
function tandai(n: BdNotif) {
  if (sudahDibacaNotif(n, baca.value)) return
  simpanBaca({ all: baca.value.all, k: { ...baca.value.k, [n.k]: 1 } })
}
function bacaSemua() {
  simpanBaca({ all: Date.now(), k: {} })
  toast.add({ title: 'Semua notifikasi ditandai dibaca', color: 'success' })
}

// ---- sheets for notification targets ----
const bukaAgenda = ref(false)
const agendaPilih = ref<BdAgenda | null>(null)
const bukaTask = ref(false)
const taskPilih = ref<BdTask | null>(null)

function bukaNotif(n: BdNotif) {
  tandai(n)
  const [jenis, ...sisa] = n.buka.split(':')
  const id = sisa.join(':')
  if (jenis === 'ag') {
    const e = state.value.agenda.find(x => x.id === id)
    if (e) {
      agendaPilih.value = e
      bukaAgenda.value = true
    }
  }
  else if (jenis === 't') {
    const t = tasks.value.find(x => x.id === id)
    if (t) {
      taskPilih.value = t
      bukaTask.value = true
    }
  }
}

// ---- answers & verdicts, decided right here ----
async function jawabUndangan(e: BdAgenda, nilai: 'hadir' | 'mungkin' | 'tidak') {
  if (!aku.value) return
  const ok = await bdTulisDiam(() => tambalBd<BdAgenda>(
    'agenda', e.id,
    { resp: { ...(e.resp || {}), [aku.value!.id]: nilai } },
    versiBaris(e),
  ))
  if (ok) toast.add({ title: `Jawaban terkirim: ${nilai === 'hadir' ? 'Hadir' : nilai === 'mungkin' ? 'Mungkin' : 'Tidak'} — ${e.title}`, color: 'success' })
}

async function setujui(t: BdTask) {
  if (!aku.value || !bolehReview(t, aku.value.id)) return
  await setujuiReview(t, tasks.value, aku.value.id)
}

// Sending back needs the reviewer's note, which rides to the PIC as a notification.
const balikId = ref<string | null>(null)
const balikCatatan = ref('')
function mulaiBalik(t: BdTask) {
  balikId.value = t.id
  balikCatatan.value = ''
}
async function kirimBalik(t: BdTask) {
  if (!aku.value) return
  // The note IS the verdict payload — sending back empty says nothing.
  if (!balikCatatan.value.trim()) {
    toast.add({ title: 'Tulis dulu apa yang perlu dibetulkan.', color: 'error' })
    return
  }
  const ok = await kembalikanReview(t, tasks.value, aku.value.id, balikCatatan.value.trim())
  if (ok) balikId.value = null
}

const namaOrang = (id?: string | null) => people.value.find(p => p.id === id)?.name || '—'

/** Answer recap of one organised agenda: hadir / mungkin / tidak / belum. */
function rekap(e: BdAgenda) {
  const c = { hadir: 0, mungkin: 0, tidak: 0, belum: 0 }
  for (const id of e.peserta || []) {
    const j = (e.resp || {})[id]
    if (j === 'hadir' || j === 'mungkin' || j === 'tidak') c[j]++
    else c.belum++
  }
  return c
}
const barisKirim = computed(() => kirim.value.map(e => ({ ...e, ...rekap(e) })))
</script>

<template>
  <AppPage
    title="Undangan & Notifikasi"
    description="Undangan agenda, task yang menunggu review kamu, dan kabar tentang task-mu."
  >
    <template #actions>
      <UButton
        v-if="tab === 'notif' && belum"
        label="Tandai semua dibaca"
        icon="i-lucide-check"
        color="neutral"
        variant="outline"
        size="sm"
        @click="bacaSemua"
      />
    </template>

    <p
      v-if="!aku && people.length"
      class="mb-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm"
    >
      Akunmu belum tercocokkan ke daftar kru, jadi belum ada undangan atau notifikasi yang bisa ditujukan
      kepadamu. Tekan Segarkan dari Office di <NuxtLink
        to="/bd/tim"
        class="font-semibold text-ink-900 underline"
      >Kru BD</NuxtLink>.
    </p>

    <AppSeg
      v-model="tab"
      :options="[
        { value: 'respons', label: 'Perlu respons', jumlah: undangan.length + review.length },
        { value: 'notif', label: 'Notifikasi', jumlah: belum },
        { value: 'kirim', label: 'Undangan saya', jumlah: kirim.length },
      ]"
      size="sm"
      class="mb-4"
    />

    <!-- Perlu respons -->
    <div
      v-if="tab === 'respons'"
      class="grid gap-5 lg:grid-cols-2"
    >
      <AppPanel
        title="Undangan agenda"
        icon="i-lucide-calendar-days"
        :count="undangan.length"
      >
        <div
          v-if="undangan.length"
          class="divide-y divide-default rounded-xl border border-default"
        >
          <div
            v-for="e in undangan"
            :key="e.id"
            class="px-3 py-2.5"
          >
            <button
              type="button"
              class="block w-full text-left"
              @click="agendaPilih = e; bukaAgenda = true"
            >
              <span class="block font-semibold text-highlighted">{{ e.title }}</span>
              <span class="text-xs text-muted">
                Undangan dari {{ namaOrang(e.owner) }} · {{ fTgl(e.date) }}{{ labelJam(e.start) }}{{ e.end ? `–${e.end}` : '' }}{{ e.lokasi ? ` · ${e.lokasi}` : '' }}
              </span>
            </button>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <UButton
                label="Hadir"
                color="neutral"
                variant="outline"
                size="xs"
                @click="jawabUndangan(e, 'hadir')"
              />
              <UButton
                label="Mungkin"
                color="neutral"
                variant="outline"
                size="xs"
                @click="jawabUndangan(e, 'mungkin')"
              />
              <UButton
                label="Tidak"
                color="error"
                variant="soft"
                size="xs"
                @click="jawabUndangan(e, 'tidak')"
              />
            </div>
          </div>
        </div>
        <p
          v-else
          class="py-6 text-center text-sm text-muted"
        >
          <b class="block text-highlighted">Tidak ada undangan yang menunggu</b>
          Undangan yang tanggalnya sudah lewat tidak ditagih lagi.
        </p>
      </AppPanel>

      <AppPanel
        title="Menunggu review kamu"
        icon="i-lucide-eye"
        :count="review.length"
      >
        <div
          v-if="review.length"
          class="divide-y divide-default rounded-xl border border-default"
        >
          <div
            v-for="t in review"
            :key="t.id"
            class="px-3 py-2.5"
          >
            <p class="font-semibold text-highlighted">
              {{ t.name }}
            </p>
            <p class="text-xs text-muted">
              Review untuk {{ t.pics?.map(namaOrang).join(', ') || '—' }}{{ t.deadline ? ` · deadline ${fTgl(t.deadline)}` : '' }}
            </p>
            <div
              v-if="balikId === t.id"
              class="mt-2 grid gap-2"
            >
              <UTextarea
                v-model="balikCatatan"
                placeholder="Apa yang perlu dibetulkan? (catatan ini dikirim ke PIC)"
                class="w-full"
              />
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  label="Kirim kembali"
                  icon="i-lucide-undo-2"
                  color="error"
                  variant="soft"
                  size="xs"
                  :disabled="!balikCatatan.trim()"
                  @click="kirimBalik(t)"
                />
                <UButton
                  label="Batal"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="balikId = null"
                />
              </div>
            </div>
            <div
              v-else
              class="mt-2 flex flex-wrap gap-1.5"
            >
              <UButton
                label="Setujui"
                icon="i-lucide-check"
                size="xs"
                @click="setujui(t)"
              />
              <UButton
                label="Kembalikan"
                color="neutral"
                variant="outline"
                size="xs"
                @click="mulaiBalik(t)"
              />
            </div>
          </div>
        </div>
        <p
          v-else
          class="py-6 text-center text-sm text-muted"
        >
          <b class="block text-highlighted">Tidak ada task yang menunggu review</b>
          Task berstatus Review yang menandaimu sebagai reviewer muncul di sini.
        </p>
      </AppPanel>
    </div>

    <!-- Notifikasi -->
    <div v-else-if="tab === 'notif'">
      <AppPanel
        title="Notifikasi"
        icon="i-lucide-bell"
        :count="daftarNotif.length"
      >
        <div v-if="daftarNotif.length">
          <button
            v-for="n in daftarNotif.slice(0, 150)"
            :key="n.k"
            type="button"
            class="flex w-full items-start gap-3 border-b border-default px-3 py-3 text-left last:border-0 hover:bg-muted/60"
            :class="sudahDibacaNotif(n, baca) ? '' : 'bg-yellow-light/40'"
            @click="bukaNotif(n)"
          >
            <span class="grid size-8 flex-none place-items-center rounded-lg bg-muted text-ink-900">
              <UIcon
                :name="n.icon"
                class="size-4"
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[13px] leading-snug text-highlighted">{{ n.teks }}</span>
              <span class="mt-0.5 block text-[11px] text-muted">{{ fWaktuNotif(n.at) }}</span>
            </span>
            <span
              v-if="!sudahDibacaNotif(n, baca)"
              class="mt-2 size-2 flex-none rounded-full bg-ink-900"
            />
          </button>
        </div>
        <p
          v-else
          class="py-6 text-center text-sm text-muted"
        >
          <b class="block text-highlighted">Belum ada notifikasi</b>
          Notifikasi muncul saat kamu diundang ke agenda, ditugaskan task, ditandai reviewer, atau task-mu direview.
        </p>
      </AppPanel>
      <p class="mt-3 text-xs text-muted">
        Tanda “sudah dibaca” disimpan di perangkat ini saja · notifikasi lebih tua dari {{ NOTIF_HARI }} hari tidak ditampilkan.
      </p>
    </div>

    <!-- Undangan saya -->
    <div v-else>
      <AppPanel
        title="Undangan saya"
        icon="i-lucide-send"
        :count="kirim.length"
      >
        <template v-if="barisKirim.length">
          <UTable
            class="hidden lg:block"
            :data="barisKirim"
            :columns="[
              { accessorKey: 'title', header: 'Agenda' },
              { accessorKey: 'date', header: 'Waktu' },
              { accessorKey: 'hadir', header: 'Hadir' },
              { accessorKey: 'mungkin', header: 'Mungkin' },
              { accessorKey: 'tidak', header: 'Tidak' },
              { accessorKey: 'belum', header: 'Belum' },
            ]"
            empty="Belum ada agenda berpeserta."
            @select="(_e: Event, row: { original: BdAgenda }) => { agendaPilih = row.original; bukaAgenda = true }"
          >
            <template #title-cell="{ row }">
              <span class="font-semibold text-highlighted">{{ row.original.title }}</span>
              <div class="text-xs text-muted">
                {{ row.original.type || 'Agenda' }}{{ row.original.date < todayISO() ? ' · sudah lewat' : '' }}
              </div>
            </template>
            <template #date-cell="{ row }">
              <span>{{ fTgl(row.original.date) }}</span>
              <div class="text-xs text-muted">
                {{ row.original.start ? `${row.original.start}${row.original.end ? `–${row.original.end}` : ''}` : 'Sepanjang hari' }}
              </div>
            </template>
            <template #tidak-cell="{ row }">
              <span :class="row.original.tidak ? 'font-bold text-error' : ''">{{ row.original.tidak || '0' }}</span>
            </template>
            <template #belum-cell="{ row }">
              <span :class="row.original.belum ? 'font-bold text-warning' : ''">{{ row.original.belum || '0' }}</span>
            </template>
          </UTable>
          <div class="grid gap-2 lg:hidden">
            <button
              v-for="e in barisKirim"
              :key="e.id"
              type="button"
              class="rounded-xl border border-default p-3 text-left"
              @click="agendaPilih = kirim.find(x => x.id === e.id) || null; bukaAgenda = true"
            >
              <span class="block font-semibold text-highlighted">{{ e.title }}</span>
              <span class="text-xs text-muted">
                {{ fTgl(e.date) }} · {{ e.start ? `${e.start}${e.end ? `–${e.end}` : ''}` : 'Sepanjang hari' }}
              </span>
              <span class="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-bold">
                <span class="rounded-full bg-muted px-2 py-0.5">{{ e.hadir }} hadir</span>
                <span class="rounded-full bg-muted px-2 py-0.5">{{ e.mungkin }} mungkin</span>
                <span
                  v-if="e.tidak"
                  class="rounded-full bg-error/10 px-2 py-0.5 text-error"
                >{{ e.tidak }} tidak</span>
                <span
                  v-if="e.belum"
                  class="rounded-full bg-warning/10 px-2 py-0.5 text-warning"
                >{{ e.belum }} belum</span>
              </span>
            </button>
          </div>
        </template>
        <p
          v-else
          class="py-6 text-center text-sm text-muted"
        >
          <b class="block text-highlighted">Belum ada agenda berpeserta</b>
          Agenda yang kamu buat dengan peserta muncul di sini berikut jawaban tiap orang.
        </p>
      </AppPanel>
    </div>

    <BdAgendaSheet
      v-model:open="bukaAgenda"
      :agenda="agendaPilih"
      :people="people"
      :aku="aku"
    />
    <BdTaskSheet
      v-model:open="bukaTask"
      :task="taskPilih"
      :tasks="tasks"
      :projects="projects"
      :people="people"
      :aku="aku"
    />
  </AppPage>
</template>
