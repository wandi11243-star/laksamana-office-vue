<!--
  Event › Pengaturan › Jam talent — the default hours the Talent Schedule roster
  fills in when a cell is clicked (the `jamTalent` setting of laksamana-api).

  Per category a list of slots (name, start, end, weekdays, "bawaan" marker);
  per talent an optional override. Order used by the roster: talent override →
  category slot for that weekday → category slot for all days → none.

  Suggested hours can be loaded into the draft when the settings are empty.
  Changing the setting does not change schedules that are already saved.
-->
<script setup lang="ts">
import type { Talent } from '~/composables/useEvent'
import { getJamTalent, putJamTalent, useDaftarEvent } from '~/composables/useEvent'
import type { JamTalentDoc, SlotJam } from '~/utils/event-jadwal'
import {
  HARI_PENDEK, JAM_USULAN, daftarKategori, dokumenKosong, galatDokumen, rapikanDokumen, salinDokumen,
} from '~/utils/event-jadwal'
import { TAL_CATS } from '~/utils/event-hitung'
import { apiErrorCode, apiErrorMessage } from '~/composables/useApi'
import { bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { versiDari } from '~/utils/versi'
import type { Versi } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const toast = useToast()
const me = useMe()
const bolehUbah = computed(() => bolehUbahEvent('jamtalent', peranEvent(me.value)))

const { data: dataTalent } = useDaftarEvent<Talent>('talents', {}, 'event-jamtalent-talents')
const talents = computed(() => dataTalent.value.rows)
const namaTalent = (id: string) => talents.value.find(t => t.id === id)?.name ?? id

const form = ref<JamTalentDoc>(dokumenKosong())
const awal = ref('')
const versi = ref<Versi | undefined>()
const memuat = ref(true)
const galatMuat = ref('')
const konflik = ref(false)
const galatServer = ref<string[]>([])
const menyimpan = ref(false)

const snapshot = (d: JamTalentDoc) => JSON.stringify(d)
const kotor = computed(() => awal.value !== '' && snapshot(form.value) !== awal.value)
const perluSimpan = computed(() => bolehUbah.value && !memuat.value && !galatMuat.value && kotor.value)

async function muat() {
  memuat.value = true
  galatMuat.value = ''
  konflik.value = false
  galatServer.value = []
  try {
    const r = await getJamTalent()
    versi.value = versiDari(r)
    form.value = rapikanDokumen(r.data)
    awal.value = snapshot(form.value)
  }
  catch (e) {
    galatMuat.value = (e as { statusCode?: number })?.statusCode === 404
      ? 'API belum punya pengaturan Jam talent (butuh versi API terbaru).'
      : apiErrorMessage(e)
  }
  finally {
    memuat.value = false
  }
}
onMounted(muat)

const kategoriSemua = computed(() => Object.keys(form.value.kategori))
const pilihanKategori = computed(() => daftarKategori(TAL_CATS, talents.value)
  .filter(k => !Object.hasOwn(form.value.kategori, k)))
const kategoriLama = ref('')
const kategoriPilihan = ref('')
const sheetKategori = ref(false)
const kategoriHapus = ref('')

function bukaKategori(kategori = '') {
  kategoriLama.value = kategori
  kategoriPilihan.value = ''
  sheetKategori.value = true
}

function simpanKategori() {
  const tujuan = kategoriPilihan.value
  if (!pilihanKategori.value.includes(tujuan)) return
  const { [kategoriLama.value]: slotLama, ...sisa } = form.value.kategori
  form.value.kategori = { ...sisa, [tujuan]: slotLama ?? [] }
  sheetKategori.value = false
}

function hapusKategori() {
  const { [kategoriHapus.value]: _, ...sisa } = form.value.kategori
  form.value.kategori = sisa
  kategoriHapus.value = ''
}

const sheetHapusKategori = computed({
  get: () => !!kategoriHapus.value,
  set: (open) => { if (!open) kategoriHapus.value = '' },
})

function pakaiUsulan() {
  form.value.kategori = salinDokumen(JAM_USULAN).kategori
}

const slots = (kat: string) => form.value.kategori[kat] ?? []
const idSlot = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
function tambahSlot(kat: string) {
  const l = slots(kat)
  form.value.kategori[kat] = [...l, { id: idSlot(), nama: l.length ? `Slot ${l.length + 1}` : 'Utama', mulai: '19:45', selesai: '22:30', hari: [], bawaan: !l.some(s => s.bawaan) }]
}
function hapusSlot(kat: string, id: string) {
  form.value.kategori[kat] = slots(kat).filter(s => s.id !== id)
}
function ubahHari(s: SlotJam, h: number) {
  s.hari = s.hari.includes(h) ? s.hari.filter(x => x !== h) : [...s.hari, h].sort()
}

// per-talent overrides
const idTalentKhusus = computed(() => Object.keys(form.value.talent))
const talentBebas = computed(() => talents.value
  .filter(t => !idTalentKhusus.value.includes(t.id))
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(t => ({ value: t.id, label: `${t.name} · ${t.category}` })))
const talentBaru = ref('')
function tambahKhusus() {
  if (!talentBaru.value) return
  form.value.talent[talentBaru.value] = { mulai: '20:00', selesai: '22:00' }
  talentBaru.value = ''
}
function hapusKhusus(id: string) {
  const { [id]: _, ...sisa } = form.value.talent
  form.value.talent = sisa
}

const galatLokal = computed(() => galatDokumen(form.value))

async function simpan() {
  if (!perluSimpan.value || menyimpan.value) return
  galatServer.value = []
  if (galatLokal.value.length) {
    toast.add({ title: 'Masih ada isian yang salah', description: galatLokal.value[0], color: 'error' })
    return
  }
  menyimpan.value = true
  try {
    await putJamTalent(form.value, versi.value)
    toast.add({ title: 'Jam talent tersimpan', description: 'Jadwal yang sudah tersimpan tidak berubah.', color: 'success' })
    await muat()
  }
  catch (e) {
    const kode = apiErrorCode(e)
    if (kode === 'version_conflict' || kode === 'version_required') {
      // Keep the person's edits on screen; they choose between the live version and their own.
      konflik.value = true
      toast.add({ title: kode === 'version_conflict' ? 'Pengaturan sudah diubah orang lain' : 'Versi pengaturan belum terbaca', color: 'warning' })
    }
    else if (kode === 'validation_failed') {
      const det = (e as { data?: { error?: { details?: { errors?: unknown } } } })?.data?.error?.details
      galatServer.value = Array.isArray(det?.errors) ? det.errors.map(String) : [apiErrorMessage(e)]
    }
    else {
      toast.add({ title: apiErrorMessage(e), color: 'error' })
    }
  }
  finally {
    menyimpan.value = false
  }
}

function batal() {
  if (kotor.value && !window.confirm('Buang perubahan yang belum disimpan?')) return
  muat()
}

function cegahTutup(e: BeforeUnloadEvent) {
  if (kotor.value) e.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', cegahTutup))
onBeforeUnmount(() => window.removeEventListener('beforeunload', cegahTutup))
onBeforeRouteLeave(() => {
  if (kotor.value && !window.confirm('Ada perubahan Jam talent yang belum disimpan. Tinggalkan halaman ini?')) return false
})
</script>

<template>
  <EventGerbang lihat="jamtalent">
    <AppPage
      title="Jam talent"
      description="Jam bawaan yang mengisi sel Talent Schedule saat diklik"
      :back="{ label: 'Talent Schedule', to: '/event/schedule' }"
    >
      <template
        v-if="bolehUbah"
        #actions
      >
        <UButton
          color="neutral"
          variant="outline"
          :disabled="menyimpan || memuat"
          @click="batal()"
        >
          {{ kotor ? 'Buang perubahan' : 'Muat ulang' }}
        </UButton>
        <UButton
          color="primary"
          icon="i-lucide-save"
          :disabled="!perluSimpan"
          :loading="menyimpan"
          @click="simpan()"
        >
          Simpan
        </UButton>
      </template>

      <UAlert
        v-if="galatMuat"
        color="error"
        variant="soft"
        :title="galatMuat"
        class="mb-4"
        :actions="[{ label: 'Coba lagi', onClick: () => muat() }]"
      />
      <template v-else-if="!memuat">
        <UAlert
          v-if="konflik"
          color="warning"
          variant="soft"
          title="Pengaturan sudah diubah orang lain"
          description="Perubahan Anda belum tersimpan dan masih ada di layar. Muat versi terbaru untuk melihat isinya (perubahan Anda akan hilang), lalu ulangi."
          class="mb-4"
          :actions="[{ label: 'Muat versi terbaru', onClick: () => muat() }]"
        />
        <UAlert
          v-if="galatServer.length"
          color="error"
          variant="soft"
          title="Server menolak isian ini"
          class="mb-4"
        >
          <template #description>
            <ul class="list-disc ps-4">
              <li
                v-for="g in galatServer"
                :key="g"
              >
                {{ g }}
              </li>
            </ul>
          </template>
        </UAlert>
        <p class="mb-4 text-sm text-muted">
          Urutan yang dipakai: jam khusus talent, lalu slot kategori untuk hari itu, lalu slot kategori untuk semua hari. Slot bertanda Bawaan menang bila ada beberapa yang cocok.
          Mengubah pengaturan ini tidak mengubah jadwal yang sudah tersimpan.
        </p>

        <div
          v-if="bolehUbah"
          class="mb-4 flex flex-wrap gap-2"
        >
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-plus"
            :disabled="!pilihanKategori.length"
            @click="bukaKategori()"
          >
            Tambah kategori
          </UButton>
          <UButton
            v-if="!kategoriSemua.length"
            color="neutral"
            variant="outline"
            @click="pakaiUsulan()"
          >
            Pakai usulan jam Band, DJ, dan MC DJ
          </UButton>
        </div>
        <p
          v-if="!kategoriSemua.length"
          class="mb-4 text-sm text-muted"
        >
          Belum ada kategori dengan pengaturan jam bawaan.
        </p>

        <AppPanel
          v-for="kat in kategoriSemua"
          :key="kat"
          :title="kat"
          :count="slots(kat).length"
          icon="i-lucide-timer"
        >
          <template
            v-if="bolehUbah"
            #actions
          >
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              :disabled="!pilihanKategori.length"
              :aria-label="`Ubah kategori ${kat}`"
              @click="bukaKategori(kat)"
            />
            <UButton
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              :aria-label="`Hapus kategori ${kat}`"
              @click="kategoriHapus = kat"
            />
          </template>
          <p
            v-if="!slots(kat).length"
            class="mb-3 text-sm text-muted"
          >
            Belum ada slot. Sel talent {{ kat }} yang diklik akan membuka editor dengan jam kosong.
          </p>
          <div class="space-y-3">
            <div
              v-for="s in slots(kat)"
              :key="s.id"
              class="rounded-field border border-default p-3"
            >
              <div class="grid grid-cols-2 gap-3 lg:grid-cols-[1fr_8rem_8rem_auto]">
                <UFormField
                  label="Nama slot"
                  class="col-span-2 lg:col-span-1"
                >
                  <UInput
                    v-model="s.nama"
                    maxlength="40"
                    :disabled="!bolehUbah"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Mulai">
                  <AppJam
                    v-model="s.mulai"
                    :disabled="!bolehUbah"
                    :clearable="false"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Selesai">
                  <AppJam
                    v-model="s.selesai"
                    :disabled="!bolehUbah"
                    :clearable="false"
                    class="w-full"
                  />
                </UFormField>
                <div class="col-span-2 flex items-end justify-between gap-2 lg:col-span-1">
                  <UCheckbox
                    v-model="s.bawaan"
                    label="Bawaan"
                    :disabled="!bolehUbah"
                  />
                  <UButton
                    v-if="bolehUbah"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    :aria-label="`Hapus slot ${s.nama}`"
                    @click="hapusSlot(kat, s.id)"
                  />
                </div>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-1.5">
                <span class="me-1 text-xs font-semibold text-muted">Hari</span>
                <button
                  v-for="(h, i) in HARI_PENDEK"
                  :key="h"
                  type="button"
                  class="rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                  :class="s.hari.includes(i) ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-default text-muted'"
                  :aria-pressed="s.hari.includes(i)"
                  :disabled="!bolehUbah"
                  @click="ubahHari(s, i)"
                >
                  {{ h }}
                </button>
                <span class="text-xs text-muted">{{ s.hari.length ? '' : 'Tidak ada yang dipilih = semua hari' }}</span>
              </div>
            </div>
          </div>
          <UButton
            v-if="bolehUbah"
            class="mt-3"
            color="neutral"
            variant="outline"
            icon="i-lucide-plus"
            @click="tambahSlot(kat)"
          >
            Tambah slot
          </UButton>
        </AppPanel>

        <AppPanel
          title="Jam khusus per talent"
          :count="idTalentKhusus.length"
          description="Opsional. Menimpa jam kategorinya, di semua hari."
          icon="i-lucide-user-round-cog"
        >
          <div class="space-y-2">
            <div
              v-for="id in idTalentKhusus"
              :key="id"
              class="flex flex-wrap items-center gap-2 rounded-field border border-default p-2.5"
            >
              <b class="min-w-0 flex-1 truncate text-highlighted">{{ namaTalent(id) }}</b>
              <AppJam
                v-model="form.talent[id]!.mulai"
                :disabled="!bolehUbah"
                :clearable="false"
                class="w-28"
              />
              <span>–</span>
              <AppJam
                v-model="form.talent[id]!.selesai"
                :disabled="!bolehUbah"
                :clearable="false"
                class="w-28"
              />
              <UButton
                v-if="bolehUbah"
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                :aria-label="`Hapus jam khusus ${namaTalent(id)}`"
                @click="hapusKhusus(id)"
              />
            </div>
          </div>
          <div
            v-if="bolehUbah"
            class="mt-3 flex flex-wrap items-center gap-2"
          >
            <USelectMenu
              v-model="talentBaru"
              :items="talentBebas"
              value-key="value"
              placeholder="Pilih talent…"
              :search-input="{ placeholder: 'Cari talent…' }"
              class="w-64 max-w-full"
            />
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-plus"
              :disabled="!talentBaru"
              @click="tambahKhusus()"
            >
              Tambah jam khusus
            </UButton>
          </div>
        </AppPanel>

        <ResponsiveSheet
          v-model:open="sheetKategori"
          :title="kategoriLama ? 'Ubah kategori' : 'Tambah kategori'"
        >
          <p
            v-if="kategoriLama"
            class="mb-3 text-sm text-muted"
          >
            Slot jam {{ kategoriLama }} akan dipindahkan ke kategori yang dipilih.
          </p>
          <UFormField label="Kategori talent">
            <USelectMenu
              v-model="kategoriPilihan"
              :items="pilihanKategori"
              placeholder="Pilih kategori"
              class="w-full"
            />
          </UFormField>
          <template #footer>
            <UButton
              :disabled="!kategoriPilihan"
              @click="simpanKategori()"
            >
              Terapkan
            </UButton>
          </template>
        </ResponsiveSheet>

        <ResponsiveSheet
          v-model:open="sheetHapusKategori"
          title="Hapus kategori?"
        >
          <p class="text-sm text-muted">
            Jam bawaan {{ kategoriHapus }} akan dihapus setelah pengaturan disimpan. Profil talent dan jadwal yang ada tetap tersimpan.
          </p>
          <template #footer>
            <UButton
              color="error"
              @click="hapusKategori()"
            >
              Hapus kategori
            </UButton>
            <UButton
              color="neutral"
              variant="outline"
              @click="sheetHapusKategori = false"
            >
              Batal
            </UButton>
          </template>
        </ResponsiveSheet>

        <p
          v-if="galatLokal.length"
          class="text-sm font-semibold text-error"
        >
          {{ galatLokal[0] }}<template v-if="galatLokal.length > 1">
            (dan {{ galatLokal.length - 1 }} lagi)
          </template>
        </p>
      </template>
    </AppPage>
  </EventGerbang>
</template>
