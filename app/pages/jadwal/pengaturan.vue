<!--
  Jadwal Shift › Pengaturan — admin of `jadwal` (deploy/jadwal/index.html
  viewPengaturan :5133-5450).

  The setting is ONE blob. Shift definitions save on each change (as the old
  page did); Head Divisi and Penempatan Kru PILE UP until their Simpan, so
  placing twenty crew is one request and a failure never leaves a half-changed
  screen (:953). Saving MERGES: the latest blob is re-read and only the keys of
  the edited parts are replaced (`KUNCI_SETTING`, :984), so another admin's
  change elsewhere is not overwritten. A failed save keeps the edits on screen
  with a standing message; leaving with unsaved edits asks first.

  Mulai Dari Nol wipes every cell and request (settings kept) after the exact
  word HAPUS SEMUA; the server checks the same word.
-->
<script setup lang="ts">
import type { SettingJadwal, ShiftDef } from '~/utils/jadwal'
import {
  DIVISI, DIV_NONSHIFT, SHIFT_BAWAAN, daftarShift, divisiDariTim, isHeadUser, kruDivisi, namaDivisiJadwal,
  normalSetting, shiftDef, shiftKruBawaan, stafKantor,
} from '~/utils/jadwal'
import { kosongkanJadwal, saveJadwalSettings, useJadwalDasar } from '~/composables/useJadwal'

definePageMeta({ access: ['jadwal'] })

const toast = useToast()
const { set, kru, peran, pending, error, refresh } = useJadwalDasar()

/** The parts of the blob each panel owns (`KUNCI_SETTING`). A new panel MUST be added here. */
const KUNCI = {
  shift: ['shifts', 'maksBeruntun', 'jedaMin'],
  head: ['heads'],
  kru: ['divOverride', 'shiftKru', 'manajemen', 'jabatan'],
} as const
type Bagian = keyof typeof KUNCI

const draf = ref<SettingJadwal>(normalSetting({}))
const kotor = reactive<Record<Bagian, boolean>>({ shift: false, head: false, kru: false })
const adaKotor = computed(() => kotor.head || kotor.kru || kotor.shift)
const pesanGagal = ref('')
const sibuk = ref(false)

// Fresh server data replaces the draft only while nothing is pending.
watch(set, (v) => {
  if (!adaKotor.value) draf.value = JSON.parse(JSON.stringify(v))
}, { immediate: true, deep: true })

async function simpan(bagian: Bagian[]) {
  sibuk.value = true
  try {
    await refresh()
    const gabung: SettingJadwal = JSON.parse(JSON.stringify(set.value))
    const parts = new Set<Bagian>([...bagian, ...(Object.keys(kotor) as Bagian[]).filter(k => kotor[k])])
    for (const b of parts) {
      for (const k of KUNCI[b]) (gabung as Record<string, unknown>)[k] = JSON.parse(JSON.stringify(draf.value[k]))
    }
    await saveJadwalSettings(gabung)
    for (const b of parts) kotor[b] = false
    pesanGagal.value = ''
    await refresh()
    toast.add({ title: 'Pengaturan disimpan', color: 'success' })
  }
  catch (e) {
    pesanGagal.value = apiErrorMessage(e)
    toast.add({ title: `Gagal menyimpan: ${pesanGagal.value}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

// ---- shifts (saved per change)
const shifts = computed(() => daftarShift(draf.value).map(k => ({ k, def: shiftDef(draf.value, k) })))
function ubahShift(k: string, f: keyof ShiftDef, v: string | number) {
  const cur = { ...(draf.value.shifts[k] ?? SHIFT_BAWAAN[k]!) }
  ;(cur as Record<string, unknown>)[f] = v
  draf.value.shifts[k] = cur
  kotor.shift = true
  simpan(['shift'])
}
const tambahOpen = ref(false)
const namaBaru = ref('')
function tambahShift() {
  const nama = namaBaru.value.trim()
  if (!nama) return
  let k = nama.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12) || 'SHIFT'
  if (draf.value.shifts[k]) {
    let n = 2
    while (draf.value.shifts[k + n]) n++
    k = k + n
  }
  // After the working shifts, before OFF (urut 50). Colour is data the admin changes next.
  draf.value.shifts[k] = { n: nama.toUpperCase().slice(0, 12), m: '16:00', s: '23:00', w: '#7C6BD6', libur: 0, urut: 45 }
  kotor.shift = true
  tambahOpen.value = false
  namaBaru.value = ''
  simpan(['shift'])
  toast.add({ title: `Shift ${k} ditambahkan — atur jam & warnanya di barisnya`, color: 'info' })
}
const hapusK = ref('')
const hapusOpen = ref(false)
function hapusShift() {
  const k = hapusK.value
  draf.value.shifts = Object.fromEntries(Object.entries(draf.value.shifts).filter(([x]) => x !== k))
  kotor.shift = true
  hapusOpen.value = false
  simpan(['shift'])
}

// ---- heads (pile up)
function ubahHead(div: string, uid: string, on: boolean) {
  const l = (draf.value.heads[div] ?? []).filter(x => x !== uid)
  if (on) l.push(uid)
  draf.value.heads = { ...draf.value.heads, [div]: l }
  kotor.head = true
}
const peranDraf = computed(() => ({ ...peran.value, heads: draf.value.heads }))

// ---- crew placement (pile up)
const tampilKantor = ref(false)
const kruAktif = computed(() => kru.value.filter(u => u.active !== false).sort((a, b) => String(a.name).localeCompare(String(b.name))))
const kantor = computed(() => kruAktif.value.filter(u => stafKantor(u.keterangan) && !draf.value.divOverride[u.id]))
const barisKru = computed(() => (tampilKantor.value ? kruAktif.value : kruAktif.value.filter(u => !kantor.value.includes(u))))
// Reka UI forbids SelectItem value ''.
const IKUT = '__ikut__'
const opsiPenempatan = (ket: string) => [
  { value: IKUT, label: `Ikut Office (${namaDivisiJadwal(divisiDariTim(ket))})` },
  ...DIVISI.map(d => ({ value: d.k as string, label: d.n })),
  { value: DIV_NONSHIFT, label: 'Tidak dijadwalkan' },
]
function ubahDivisi(uid: string, v: string) {
  const m = Object.fromEntries(Object.entries(draf.value.divOverride).filter(([x]) => x !== uid))
  if (v && v !== IKUT) m[uid] = v
  draf.value.divOverride = m
  kotor.kru = true
}
const divisiKru = (uid: string, ket: string) => draf.value.divOverride[uid] || divisiDariTim(ket)
const opsiShiftKru = (uid: string) => [
  { value: IKUT, label: `Cadangan: ${shiftDef(draf.value, shiftKruBawaan({ ...draf.value, shiftKru: {} }, new Map(), uid, '')).n}` },
  ...daftarShift(draf.value).map(k => ({ value: k, label: shiftDef(draf.value, k).n })),
]
function ubahShiftKru(uid: string, v: string) {
  const m = Object.fromEntries(Object.entries(draf.value.shiftKru).filter(([x]) => x !== uid))
  if (v && v !== IKUT) m[uid] = v
  draf.value.shiftKru = m
  kotor.kru = true
}
function ubahManajemen(uid: string, on: boolean) {
  const l = draf.value.manajemen.filter(x => x !== uid)
  if (on) l.push(uid)
  draf.value.manajemen = l
  kotor.kru = true
}

// ---- unsaved guard
function cegahTutup(e: BeforeUnloadEvent) {
  if (adaKotor.value) e.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', cegahTutup))
onBeforeUnmount(() => window.removeEventListener('beforeunload', cegahTutup))
onBeforeRouteLeave(() => {
  if (adaKotor.value && !window.confirm('Ada perubahan Head Divisi / Penempatan Kru yang belum disimpan. Tinggalkan halaman ini?')) return false
})

// ---- Mulai dari nol
const SANDI = 'HAPUS SEMUA'
const nolOpen = ref(false)
const kode = ref('')
async function kosongkan() {
  if (kode.value.trim().toUpperCase() !== SANDI) {
    toast.add({ title: `Ketik ${SANDI} persis untuk melanjutkan`, color: 'error' })
    return
  }
  sibuk.value = true
  try {
    const r = await kosongkanJadwal()
    nolOpen.value = false
    kode.value = ''
    toast.add({ title: `Terhapus: ${r.data.sel ?? 0} sel jadwal, ${r.data.pengajuan ?? 0} pengajuan`, color: 'success' })
    await refreshNuxtData()
  }
  catch (e) {
    toast.add({ title: `Gagal mengosongkan: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <AppPage
    title="Pengaturan"
    description="Definisi shift, head divisi, penempatan kru."
  >
    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel v-if="!pending && !peran.admin">
      <div class="py-6 text-center">
        <UIcon
          name="i-lucide-lock"
          class="size-8 text-dimmed"
        />
        <p class="mt-2 font-semibold text-highlighted">
          Halaman ini hanya untuk admin modul Jadwal.
        </p>
        <p class="mt-1 text-sm text-muted">
          Admin modul ditetapkan di <b>Kelola Akses</b> milik Laksamana Office.
        </p>
      </div>
    </AppPanel>

    <template v-else>
      <p
        v-if="pesanGagal"
        class="mb-4 rounded-field bg-error/12 px-3 py-2 text-sm"
        role="alert"
      >
        <b>Pengaturan terakhir GAGAL disimpan.</b> Sebab dari server: <b>{{ pesanGagal }}</b>. Perubahan Anda masih ada di
        layar ini — tekan <b>Simpan</b> lagi.
      </p>

      <AppPanel
        title="Definisi shift"
        icon="i-lucide-settings"
      >
        <template #actions>
          <UButton
            label="Tambah shift"
            icon="i-lucide-plus"
            size="sm"
            @click="tambahOpen = true"
          />
        </template>
        <p class="mb-3 text-sm text-muted">
          Nama, jam bawaan, dan warna tiap shift. Mengubah jam di sini berlaku untuk sel yang <b>belum</b> punya jam khusus.
        </p>
        <div class="divide-y divide-default">
          <div
            v-for="s in shifts"
            :key="s.k"
            class="flex flex-wrap items-center gap-2 py-2.5"
          >
            <JadwalShiftPil
              :def="s.def"
              class="min-w-20 justify-center"
            />
            <UInput
              :model-value="s.def.n"
              class="min-w-28 flex-1"
              title="Nama yang tampil di sel"
              @change="ubahShift(s.k, 'n', ($event.target as HTMLInputElement).value)"
            />
            <UInput
              :model-value="s.def.m"
              type="time"
              :disabled="!!s.def.libur"
              class="w-32"
              @change="ubahShift(s.k, 'm', ($event.target as HTMLInputElement).value)"
            />
            <UInput
              :model-value="s.def.s"
              type="time"
              :disabled="!!s.def.libur"
              class="w-32"
              @change="ubahShift(s.k, 's', ($event.target as HTMLInputElement).value)"
            />
            <input
              type="color"
              :value="s.def.w"
              aria-label="Warna shift"
              class="h-9 w-11 cursor-pointer rounded-field border border-default bg-default p-0.5"
              @change="ubahShift(s.k, 'w', ($event.target as HTMLInputElement).value)"
            >
            <UCheckbox
              :model-value="!!s.def.libur"
              label="tidak masuk"
              @update:model-value="ubahShift(s.k, 'libur', $event ? 1 : 0)"
            />
            <UButton
              v-if="!SHIFT_BAWAAN[s.k]"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              aria-label="Hapus shift ini"
              @click="hapusK = s.k; hapusOpen = true"
            />
          </div>
        </div>
        <p class="mt-3 text-sm text-muted">
          Shift buatan sendiri bisa dihapus. Shift bawaan (PAGI, MIDDLE, SPLIT, SIANG, OFF, IZIN, CUTI, LAIN) sengaja tidak —
          kodenya sudah tertulis di sel jadwal dan pengajuan lama.
        </p>
      </AppPanel>

      <AppPanel
        title="Head divisi"
        icon="i-lucide-crown"
      >
        <template #actions>
          <AppStatus
            v-if="kotor.head"
            color="warning"
            size="sm"
            icon="i-lucide-circle-alert"
          >
            belum disimpan
          </AppStatus>
          <UButton
            label="Simpan"
            icon="i-lucide-save"
            size="sm"
            :disabled="!kotor.head"
            :loading="sibuk && kotor.head"
            @click="simpan(['head'])"
          />
        </template>
        <p class="mb-3 text-sm text-muted">
          Head menyusun jadwal divisinya dan meneruskan pengajuan kru divisinya. Sengaja ditunjuk manual, bukan ditebak dari
          jabatan. Boleh lebih dari satu per divisi.
        </p>
        <div class="grid gap-3 lg:grid-cols-2">
          <div
            v-for="d in DIVISI"
            :key="d.k"
            class="rounded-field border border-default p-3"
          >
            <div class="mb-2 flex items-center gap-2">
              <b class="text-highlighted">{{ d.n }}</b>
              <span class="text-xs text-muted">{{ kruDivisi(peranDraf, kru, d.k).length }} kru</span>
              <AppStatus
                class="ms-auto"
                size="sm"
                :color="(draf.heads[d.k] ?? []).length ? 'success' : 'warning'"
              >
                {{ (draf.heads[d.k] ?? []).length ? `${(draf.heads[d.k] ?? []).length} head` : 'belum ada head' }}
              </AppStatus>
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-2">
              <UCheckbox
                v-for="u in kruDivisi(peranDraf, kru, d.k)"
                :key="u.id"
                :model-value="(draf.heads[d.k] ?? []).includes(u.id)"
                :label="u.name"
                @update:model-value="ubahHead(d.k, u.id, !!$event)"
              />
              <span
                v-if="!kruDivisi(peranDraf, kru, d.k).length"
                class="text-sm text-muted"
              >Belum ada kru di divisi ini.</span>
            </div>
          </div>
        </div>
      </AppPanel>

      <AppPanel
        title="Penempatan kru"
        icon="i-lucide-users"
        flush
      >
        <template #actions>
          <AppStatus
            v-if="kotor.kru"
            color="warning"
            size="sm"
            icon="i-lucide-circle-alert"
          >
            belum disimpan
          </AppStatus>
          <UButton
            label="Simpan"
            icon="i-lucide-save"
            size="sm"
            :disabled="!kotor.kru"
            :loading="sibuk && kotor.kru"
            @click="simpan(['kru'])"
          />
        </template>
        <div class="space-y-2 p-4 text-sm text-muted lg:p-5">
          <p>
            Divisi diambil dari kolom <b>Tim</b> di Laksamana Office. Ubah di sini hanya kalau kru itu memang dijadwalkan di
            divisi lain — lebih baik perbaiki di Office supaya modul lain ikut benar.
          </p>
          <p>
            Centang <b>Rekap</b> untuk memberi orang itu akses ke halaman <b>Rekap Pegawai</b>. <b>Head divisi dan admin modul
              otomatis berhak</b> — barisnya bertanda <i>otomatis</i>.
          </p>
          <p>
            Kolom <b>shift kebiasaan</b> dipakai sebagai <b>cadangan saja</b>, untuk kru yang belum punya riwayat minggu lalu.
          </p>
          <p v-if="kantor.length">
            <b>{{ kantor.length }} akun staf kantor</b> (kolom Tim-nya menyebut Office/Kantor)
            {{ tampilKantor ? 'sedang ikut ditampilkan' : 'tidak ditampilkan di daftar ini' }} — mereka tidak pernah masuk lembar shift.
            <UButton
              :label="tampilKantor ? 'Sembunyikan lagi' : 'Tampilkan'"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="tampilKantor = !tampilKantor"
            />
          </p>
        </div>
        <div class="divide-y divide-default border-t border-default">
          <div
            v-for="u in barisKru"
            :key="u.id"
            class="flex flex-wrap items-center gap-2 px-4 py-2.5 lg:px-5"
          >
            <div class="min-w-40 flex-1">
              <b class="text-highlighted">{{ u.name }}</b>
              <p class="text-[13px] text-muted">
                Tim di Office: {{ u.keterangan || '— kosong —' }}
              </p>
            </div>
            <USelect
              :model-value="draf.divOverride[u.id] || IKUT"
              :items="opsiPenempatan(u.keterangan)"
              class="w-52"
              @update:model-value="ubahDivisi(u.id, String($event))"
            />
            <USelect
              v-if="divisiKru(u.id, u.keterangan) !== DIV_NONSHIFT"
              :model-value="draf.shiftKru[u.id] || IKUT"
              :items="opsiShiftKru(u.id)"
              class="w-40"
              title="Shift kebiasaan"
              @update:model-value="ubahShiftKru(u.id, String($event))"
            />
            <AppStatus
              v-if="isHeadUser(peranDraf, u.id, divisiKru(u.id, u.keterangan))"
              color="success"
              size="sm"
              icon="i-lucide-chart-line"
            >
              otomatis
            </AppStatus>
            <UCheckbox
              v-else
              :model-value="draf.manajemen.includes(u.id)"
              label="Rekap"
              title="Boleh membuka halaman Rekap Pegawai"
              @update:model-value="ubahManajemen(u.id, !!$event)"
            />
          </div>
          <p
            v-if="!barisKru.length"
            class="px-4 py-6 text-center text-muted"
          >
            Roster kosong.
          </p>
        </div>
      </AppPanel>

      <AppPanel
        title="Mulai dari nol"
        icon="i-lucide-eraser"
      >
        <p class="mb-2 text-sm text-muted">
          Menghapus <b>seluruh sel jadwal</b> (semua bulan, semua divisi) dan <b>seluruh pengajuan</b> di server.
          <b>Definisi shift, head divisi, penempatan kru, dan akses rekap TIDAK ikut terhapus.</b>
        </p>
        <p class="mb-3 text-sm text-muted">
          Tidak ada pembatalan. Jadwal yang terhapus tidak bisa dikembalikan dari layar mana pun, termasuk oleh admin.
        </p>
        <UButton
          label="Kosongkan semua data jadwal"
          color="error"
          size="sm"
          @click="nolOpen = true"
        />
      </AppPanel>
    </template>

    <ResponsiveSheet
      v-model:open="tambahOpen"
      title="Tambah shift"
    >
      <UFormField
        label="Nama shift"
        help="Inilah yang tampil di sel jadwal. Jam dan warnanya diatur di baris barunya setelah ini."
      >
        <UInput
          v-model="namaBaru"
          maxlength="12"
          placeholder="Mis. MALAM"
          autofocus
          class="w-full"
        />
      </UFormField>
      <template #footer>
        <UButton
          label="Tambahkan"
          @click="tambahShift"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="tambahOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="hapusOpen"
      :title="`Hapus shift ${hapusK ? shiftDef(draf, hapusK).n : ''}?`"
    >
      <p class="text-sm">
        Sel jadwal yang masih memakai shift ini TIDAK ikut terhapus — ia tetap ada tapi kehilangan nama, jam, dan warnanya.
        Lebih aman ganti dulu sel-sel itu ke shift lain.
      </p>
      <template #footer>
        <UButton
          label="Ya, hapus"
          color="error"
          @click="hapusShift"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="hapusOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="nolOpen"
      title="Kosongkan semua data jadwal?"
    >
      <div class="space-y-3 text-sm">
        <p>
          Seluruh <b>sel jadwal</b> dan <b>pengajuan</b> di semua bulan dan semua divisi akan dihapus dari server. Definisi
          shift, head divisi, dan penempatan kru tetap.
        </p>
        <p>Tindakan ini <b>tidak bisa dibatalkan</b>.</p>
        <UFormField :label="`Ketik ${SANDI} untuk melanjutkan`">
          <UInput
            v-model="kode"
            autocomplete="off"
            :placeholder="SANDI"
            class="w-full"
          />
        </UFormField>
      </div>
      <template #footer>
        <UButton
          label="Kosongkan"
          color="error"
          :loading="sibuk"
          @click="kosongkan"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="nolOpen = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
