<!--
  Content Pipeline — the old viewContent (howandi_life/index.html:667-678).
  Six Kanban columns, an account filter (settings/channels), and the channels
  editor. Kanban scrolls sideways on a phone; each card also has a move-stage
  sheet because HTML5 drag-and-drop is unreliable on touch.
-->
<script setup lang="ts">
import type { HlifeContent } from '~/composables/useHlife'
import {
  createHlifeRecord, deleteHlifeRecord, saveHlifeSetting, updateHlifeRecord,
  useHlifeResource, useHlifeSettings,
} from '~/composables/useHlife'
import { CSTAGES, PLATFORMS, fmtDue, tautanGcal } from '~/utils/hlife'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['howandi_life'] })

const toast = useToast()

const { data: kontenData, status, refresh: refreshKonten } = useHlifeResource<HlifeContent>('content')
const { data: setelan, refresh: refreshSetelan } = useHlifeSettings()

const konten = computed(() => kontenData.value.rows)
const channels = computed<string[]>(() => (Array.isArray(setelan.value.values.channels) ? setelan.value.values.channels as string[] : []))

const filterAkun = ref('all')
// If the active filter disappears after editing accounts, fall back to all (`:898`).
watch(channels, (v) => {
  if (filterAkun.value !== 'all' && !v.includes(filterAkun.value)) filterAkun.value = 'all'
})

const tampil = computed(() => (filterAkun.value === 'all' ? konten.value : konten.value.filter(c => c.channel === filterAkun.value)))
const kolom = computed(() => CSTAGES.map(st => ({ stage: st, items: tampil.value.filter(c => c.stage === st) })))

const hari = hariIni()

// --- drag and drop (`:677-678`) ---------------------------------------------

let dragId = ''
let baruSajaDrag = false
const dropAktif = ref('')

function mulaiDrag(e: DragEvent, c: HlifeContent) {
  dragId = c.id
  baruSajaDrag = true
  e.dataTransfer?.setData('text/plain', c.id)
}

async function gantiStage(c: HlifeContent, stage: string) {
  const versi = kontenData.value.versions[c.id]
  if (versi === undefined) {
    toast.add({ title: 'Versi konten belum terbaca. Muat ulang halaman.', color: 'error' })
    return
  }
  try {
    await updateHlifeRecord('content', c.id, { ...c, stage }, versi)
    await refreshKonten()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshKonten))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

async function jatuhkan(stage: string) {
  dropAktif.value = ''
  const c = konten.value.find(x => x.id === dragId)
  if (!c || c.stage === stage) return
  await gantiStage(c, stage)
}

function bukaKartu(c: HlifeContent) {
  if (baruSajaDrag) return
  buka(c)
}

const sheetPindah = ref(false)
const pindah = ref<HlifeContent | null>(null)
function bukaPindah(c: HlifeContent) {
  pindah.value = c
  sheetPindah.value = true
}
async function pilihStage(stage: string) {
  if (pindah.value) await gantiStage(pindah.value, stage)
  sheetPindah.value = false
}

// --- content sheet (`:888-895`) ---------------------------------------------

const sheet = ref(false)
const sibuk = ref(false)
const hapusSheet = ref(false)
const form = reactive<HlifeContent>({
  id: '',
  title: '',
  channel: '',
  platform: 'Instagram',
  stage: 'Idea',
  date: '',
  notes: '',
})

const opsiChannel = computed(() => channels.value.map(c => ({ value: c, label: c })))
const opsiPlatform = PLATFORMS.map(p => ({ value: p as string, label: p }))
const opsiStage = CSTAGES.map(s => ({ value: s as string, label: s }))

function buka(c?: HlifeContent) {
  Object.assign(form, c
    ? { ...c }
    : { id: '', title: '', channel: filterAkun.value === 'all' ? (channels.value[0] ?? '') : filterAkun.value, platform: 'Instagram', stage: 'Idea', date: '', notes: '' })
  sheet.value = true
}

function muatUlang() {
  return refreshKonten()
}

async function simpan() {
  const title = form.title.trim()
  if (!title) {
    toast.add({ title: 'Judul wajib diisi.', color: 'error' })
    return
  }
  const body = { title, channel: form.channel, platform: form.platform, stage: form.stage, date: form.date, notes: form.notes }
  sibuk.value = true
  try {
    if (form.id) {
      const versi = kontenData.value.versions[form.id]
      if (versi === undefined) {
        toast.add({ title: 'Versi konten belum terbaca. Muat ulang halaman.', color: 'error' })
        return
      }
      await updateHlifeRecord('content', form.id, { ...body, id: form.id }, versi)
    }
    else {
      await createHlifeRecord<HlifeContent>('content', body)
    }
    await refreshKonten()
    sheet.value = false
    toast.add({ title: 'Konten tersimpan.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

async function hapus() {
  if (!form.id) return
  const versi = kontenData.value.versions[form.id]
  hapusSheet.value = false
  if (versi === undefined) {
    toast.add({ title: 'Versi konten belum terbaca. Muat ulang halaman.', color: 'error' })
    return
  }
  sibuk.value = true
  try {
    await deleteHlifeRecord('content', form.id, versi)
    await refreshKonten()
    sheet.value = false
    toast.add({ title: 'Konten dihapus.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

// --- channels sheet (`:897-898`) --------------------------------------------

const channelSheet = ref(false)
const channelTeks = ref('')
function bukaChannel() {
  channelTeks.value = channels.value.join('\n')
  channelSheet.value = true
}

async function simpanChannel() {
  const versi = setelan.value.versions.channels
  if (versi === undefined) {
    toast.add({ title: 'Versi akun belum terbaca. Muat ulang halaman.', color: 'error' })
    return
  }
  const list = channelTeks.value.split('\n').map(s => s.trim()).filter(Boolean)
  sibuk.value = true
  try {
    await saveHlifeSetting('channels', list, versi)
    await refreshSetelan()
    channelSheet.value = false
    toast.add({ title: 'Akun diperbarui.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshSetelan))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

function keGcal(c: HlifeContent) {
  window.open(tautanGcal(`Konten: ${c.title}`, c.date, undefined, undefined, 'Content'), '_blank')
}
</script>

<template>
  <AppPage
    title="Content Pipeline"
    description="Konten pribadi + side project. Pilih akun untuk fokus ke satu pipeline."
  >
    <template #actions>
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          label="Kelola akun"
          icon="i-lucide-settings"
          color="neutral"
          variant="outline"
          @click="bukaChannel"
        />
        <UButton
          label="Konten"
          icon="i-lucide-plus"
          @click="buka()"
        />
      </div>
    </template>

    <div class="mb-4">
      <AppChips
        :model-value="filterAkun"
        :options="[{ value: 'all', label: 'Semua akun' }, ...channels.map(c => ({ value: c, label: c }))]"
        @update:model-value="v => filterAkun = v ?? 'all'"
      />
    </div>

    <p
      v-if="status === 'pending' && !konten.length"
      class="mb-4 text-sm text-muted"
    >
      Memuat konten…
    </p>

    <div class="-mx-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
      <div class="flex min-w-max gap-3">
        <section
          v-for="k in kolom"
          :key="k.stage"
          class="w-60 shrink-0"
          @dragover.prevent="dropAktif = k.stage"
          @dragleave="dropAktif = ''"
          @drop.prevent="jatuhkan(k.stage)"
        >
          <div
            class="mb-2 flex items-center justify-between rounded-xl border px-3 py-2"
            :class="dropAktif === k.stage ? 'border-primary-400 bg-primary-100' : 'border-default bg-muted'"
          >
            <span class="text-sm font-semibold text-highlighted">{{ k.stage }}</span>
            <span class="rounded-full bg-table-head px-2 py-0.5 text-xs font-bold text-table-head-text num">{{ k.items.length }}</span>
          </div>
          <div class="space-y-2">
            <article
              v-for="c in k.items"
              :key="c.id"
              class="cursor-pointer rounded-lg border border-default bg-default p-3 shadow-panel transition-colors hover:border-accented"
              draggable="true"
              @dragstart="mulaiDrag($event, c)"
              @dragend="baruSajaDrag = false"
              @click="bukaKartu(c)"
            >
              <h3 class="font-semibold text-highlighted">
                {{ c.title }}
              </h3>
              <div class="mt-2 flex flex-wrap gap-1">
                <AppStatus
                  v-if="c.platform"
                  size="sm"
                  color="vip"
                  icon="i-lucide-hash"
                >
                  {{ c.platform }}
                </AppStatus>
                <AppStatus
                  v-if="c.date"
                  size="sm"
                  :color="c.date < hari && c.stage !== 'Posted' ? 'warning' : 'info'"
                  icon="i-lucide-calendar"
                >
                  {{ fmtDue(c.date) }}
                </AppStatus>
              </div>
              <p
                v-if="c.channel"
                class="mt-2 text-xs text-muted"
              >
                {{ c.channel }}
              </p>
              <div class="mt-2 flex justify-end">
                <UButton
                  label="Pindah stage"
                  icon="i-lucide-move-right"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click.stop="bukaPindah(c)"
                />
              </div>
            </article>
            <p
              v-if="!k.items.length"
              class="rounded-field border border-dashed border-default px-3 py-4 text-center text-xs text-dimmed"
            >
              —
            </p>
          </div>
        </section>
      </div>
    </div>

    <ResponsiveSheet
      v-model:open="sheetPindah"
      :title="pindah ? `Pindah: ${pindah.title}` : 'Pindah stage'"
      description="Pilih kolom baru untuk konten ini."
    >
      <div class="grid gap-2">
        <UButton
          v-for="s in CSTAGES"
          :key="s"
          :label="s"
          :color="pindah && pindah.stage === s ? 'primary' : 'neutral'"
          :variant="pindah && pindah.stage === s ? 'soft' : 'outline'"
          block
          class="justify-start"
          @click="pilihStage(s)"
        />
      </div>
    </ResponsiveSheet>

    <!-- Content form -->
    <ResponsiveSheet
      v-model:open="sheet"
      :title="form.id ? 'Edit konten' : 'Konten baru'"
    >
      <div class="space-y-4">
        <UFormField
          label="Judul / ide"
          required
        >
          <UInput
            v-model="form.title"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Akun">
            <USelect
              v-model="form.channel"
              :items="opsiChannel"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Platform">
            <USelect
              v-model="form.platform"
              :items="opsiPlatform"
              size="xl"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Stage">
            <USelect
              v-model="form.stage"
              :items="opsiStage"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Tanggal publish">
            <UInput
              v-model="form.date"
              type="date"
              size="xl"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Catatan (hook / angle)">
          <UTextarea
            v-model="form.notes"
            :rows="3"
            placeholder="Hook, CTA, angle…"
            class="w-full"
          />
        </UFormField>
        <UButton
          v-if="form.id && form.date"
          label="+ Google Calendar"
          icon="i-lucide-calendar-plus"
          color="neutral"
          variant="soft"
          block
          @click="keGcal(form)"
        />
        <UButton
          v-if="form.id"
          label="Hapus konten"
          color="error"
          variant="soft"
          block
          @click="hapusSheet = true"
        />
      </div>
      <template #footer>
        <UButton
          :label="form.id ? 'Simpan' : 'Tambah'"
          size="xl"
          :loading="sibuk"
          @click="simpan"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheet = false"
        />
      </template>
    </ResponsiveSheet>

    <!-- Channels form -->
    <ResponsiveSheet
      v-model:open="channelSheet"
      title="Akun yang dikelola"
    >
      <UFormField
        label="Satu akun per baris"
        help="Contoh: @howandichandra (Personal), Podcast (Side Project). Hanya akun yang kamu kelola sendiri."
      >
        <UTextarea
          v-model="channelTeks"
          :rows="6"
          class="w-full"
        />
      </UFormField>
      <template #footer>
        <UButton
          label="Simpan"
          size="xl"
          :loading="sibuk"
          @click="simpanChannel"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="channelSheet = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="hapusSheet"
      title="Hapus konten?"
    >
      <p class="text-sm text-muted">
        Kartu konten ini akan dihapus permanen.
      </p>
      <template #footer>
        <UButton
          label="Hapus"
          color="error"
          size="xl"
          :loading="sibuk"
          @click="hapus"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="hapusSheet = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
