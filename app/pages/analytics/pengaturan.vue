<!--
  Analytics › Pengaturan. Shift bounds + the POS→HPP menu-name map + the
  package-code map (deploy/analytics/index.html:8124 vPengaturan). All three
  are written with PUT /analytics whole-state (If-Match + tanganiKonflik).
  The HPP recipe list is only a SUGGESTION for the code box (read-only,
  may fail); the code map itself stays free text. HPP codes win over the
  manual map — said on the screen, not just here.
-->
<script setup lang="ts">
import { saveAnalytics, useAnalyticsState } from '~/composables/useAnalytics'
import { ROLE_LABEL_ANALYTICS, useAnalyticsIzin } from '~/utils/layar/analytics'
import { batasShift } from '~/utils/analytics-agregat'
import { tanganiKonflik, versiDari } from '~/utils/versi'
import { angka } from '~/utils/format'

definePageMeta({ access: ['analytics'] })

const toast = useToast()
const izin = useAnalyticsIzin()
const bolehUbah = computed(() => izin.ubah('pengaturan'))
const roleSaya = computed(() => ROLE_LABEL_ANALYTICS[izin.role.value] ?? izin.role.value)

const { data: balasan, status, error, refresh } = useAnalyticsState()
const isi = computed(() => balasan.value?.data ?? null)
const versi = computed(() => versiDari(balasan.value))
const setting = computed(() => isi.value?.data.setting ?? {})

/* ---- shift bounds (local draft, validated 0–24 on save) ---- */
const s1a = ref(10)
const s1b = ref(18)
const s2a = ref(18)
const s2b = ref(24)
watch(setting, (s) => {
  const b = batasShift(s?.shift)
  s1a.value = b.s1a
  s1b.value = b.s1b
  s2a.value = b.s2a
  s2b.value = b.s2b
}, { immediate: true })
const menyimpanShift = ref(false)
async function simpanShift() {
  if (!bolehUbah.value || !isi.value) return
  const s = { s1a: s1a.value, s1b: s1b.value, s2a: s2a.value, s2b: s2b.value }
  for (const v of Object.values(s)) {
    if (!Number.isInteger(v) || v < 0 || v > 24) {
      toast.add({ title: 'Jam harus 0–24.', color: 'error' })
      return
    }
  }
  const v = versi.value
  if (v === undefined) {
    toast.add({ title: 'Data belum termuat', description: 'Tunggu pengaturannya dimuat dulu, lalu simpan lagi.', color: 'warning' })
    return
  }
  menyimpanShift.value = true
  try {
    await saveAnalytics({ ...isi.value.data, setting: { ...setting.value, shift: s } }, v)
    await refresh()
    toast.add({ title: 'Batas jam tersimpan.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpanShift.value = false
  }
}

/* ---- generic whole-state map editor (petaMenu / petaKode) ---- */
async function simpanPeta(kunci: 'petaMenu' | 'petaKode', peta: Record<string, string>, sukses: string) {
  if (!bolehUbah.value || !isi.value) return
  const v = versi.value
  if (v === undefined) {
    toast.add({ title: 'Data belum termuat', description: 'Tunggu pengaturannya dimuat dulu, lalu simpan lagi.', color: 'warning' })
    return
  }
  try {
    await saveAnalytics({ ...isi.value.data, setting: { ...setting.value, [kunci]: peta } }, v)
    await refresh()
    toast.add({ title: sukses, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}
const petaMenu = computed(() => {
  const p = setting.value?.petaMenu
  return p && typeof p === 'object' ? p as Record<string, string> : {}
})
const kunciMenu = computed(() => Object.keys(petaMenu.value).sort())
const pmPos = ref('')
const pmHpp = ref('')
async function petaTambah() {
  const pos = pmPos.value.trim()
  const hpp = pmHpp.value.trim()
  if (!pos || !hpp) {
    toast.add({ title: 'Kedua nama wajib diisi.', color: 'error' })
    return
  }
  await simpanPeta('petaMenu', { ...petaMenu.value, [pos]: hpp }, 'Dipetakan.')
  pmPos.value = ''
  pmHpp.value = ''
}
async function petaHapus(k: string) {
  const sisa: Record<string, string> = {}
  for (const key of Object.keys(petaMenu.value)) {
    if (key !== k) sisa[key] = petaMenu.value[key]!
  }
  await simpanPeta('petaMenu', sisa, 'Dihapus.')
}

const petaKode = computed(() => {
  const p = setting.value?.petaKode
  const out: Record<string, string> = {}
  if (p && typeof p === 'object') {
    for (const k of Object.keys(p)) {
      const v = String((p as Record<string, unknown>)[k] ?? '').trim()
      if (v) out[String(k).toUpperCase()] = v
    }
  }
  return out
})
const kunciKode = computed(() => Object.keys(petaKode.value).sort())
const pkKode = ref('')
const pkMenu = ref('')
async function kodeTambah() {
  const kode = pkKode.value.trim().toUpperCase()
  const menu = pkMenu.value.trim()
  if (!kode || !menu) {
    toast.add({ title: 'Kode dan nama menunya wajib diisi.', color: 'error' })
    return
  }
  await simpanPeta('petaKode', { ...petaKode.value, [kode]: menu }, 'Dipasangkan.')
  pkKode.value = ''
  pkMenu.value = ''
}
async function kodeHapus(k: string) {
  const sisa: Record<string, string> = {}
  for (const key of Object.keys(petaKode.value)) {
    if (key !== k) sisa[key] = petaKode.value[key]!
  }
  await simpanPeta('petaKode', sisa, 'Dihapus.')
}

/* HPP recipe names as SUGGESTIONS for the code box (read-only; may fail —
   the box stays free text either way). */
const { data: resepHpp } = useAsyncData(
  'analytics-hpp-resep',
  () => useApi()<Envelope<{ nama?: string }[] | Record<string, { nama?: string }>>>('/stock/hpp/recipes')
    .then((r) => {
      const d = r.data
      const list = Array.isArray(d) ? d : Object.values(d ?? {})
      return list.map(x => String(x?.nama ?? '').trim()).filter(Boolean).sort()
    })
    .catch(() => [] as string[]),
  { server: false, default: () => [] as string[] },
)
</script>

<template>
  <AppPage
    title="Pengaturan"
    description="Batas jam shift dan pemetaan nama menu"
  >
    <template #actions>
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="status === 'pending'"
        @click="refresh()"
      />
    </template>

    <AppPanel
      v-if="status === 'pending' && !isi"
      title="Memuat pengaturan"
    >
      <USkeleton class="mt-3 h-24 w-full" />
    </AppPanel>

    <div v-else-if="error || !isi">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Tidak bisa membaca data analytics"
        :description="apiErrorMessage(error, 'Periksa koneksi internet, lalu muat ulang halaman.')"
      />
    </div>

    <template v-else>
      <UAlert
        v-if="!bolehUbah"
        color="warning"
        variant="subtle"
        icon="i-lucide-lock"
        title="Hanya membaca"
        :description="`Hak akses kamu di halaman ini cuma &quot;${roleSaya}&quot;. Mengubahnya bisa dilakukan pemegang peran Staf — minta admin modul mengubahnya di Kelola Akses.`"
      />

      <AppPanel
        title="Batas Jam Shift"
        description="Dipakai halaman Hari & Jam untuk membagi omset jadi dua shift. Ditulis dalam jam 0–24; shift malam boleh melewati tengah malam (mis. 18 sampai 2)."
      >
        <AppFilterGrid>
          <UFormField label="Siang mulai">
            <UInput
              v-model.number="s1a"
              type="number"
              :min="0"
              :max="24"
              :disabled="!bolehUbah"
            />
          </UFormField>
          <UFormField label="Siang selesai">
            <UInput
              v-model.number="s1b"
              type="number"
              :min="0"
              :max="24"
              :disabled="!bolehUbah"
            />
          </UFormField>
          <UFormField label="Malam mulai">
            <UInput
              v-model.number="s2a"
              type="number"
              :min="0"
              :max="24"
              :disabled="!bolehUbah"
            />
          </UFormField>
          <UFormField label="Malam selesai">
            <UInput
              v-model.number="s2b"
              type="number"
              :min="0"
              :max="24"
              :disabled="!bolehUbah"
            />
          </UFormField>
        </AppFilterGrid>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <UButton
            v-if="bolehUbah"
            label="Simpan"
            icon="i-lucide-check"
            :loading="menyimpanShift"
            @click="simpanShift()"
          />
          <span class="text-xs text-muted">Bawaannya 10–18 dan 18–24, ditetapkan 28 Agustus 2026.</span>
        </div>
      </AppPanel>

      <AppPanel
        title="Pemetaan Nama Menu"
        description="Kalau nama menu di POS berbeda dari nama resep di HPP, samakan di sini. Mengganti namanya di POS akan memecah riwayat penjualan menu itu jadi dua, jadi memetakan lebih aman daripada mengganti."
      >
        <div
          v-if="bolehUbah"
          class="flex flex-wrap items-end gap-2"
        >
          <UFormField
            label="Nama di POS"
            class="min-w-40 flex-1"
          >
            <UInput
              v-model="pmPos"
              placeholder="mis. Kopi Susu Gula Aren (L)"
            />
          </UFormField>
          <UFormField
            label="Nama resep di HPP"
            class="min-w-40 flex-1"
          >
            <UInput
              v-model="pmHpp"
              placeholder="mis. Kopi Susu Aren Large"
            />
          </UFormField>
          <UButton
            label="Petakan"
            icon="i-lucide-plus"
            @click="petaTambah()"
          />
        </div>
        <div
          v-if="!kunciMenu.length"
          class="mt-3 text-sm text-muted"
        >
          Belum ada pemetaan. Nama yang belum cocok disebutkan di halaman <b>Menu &amp; Bahan Baku</b>.
        </div>
        <div
          v-else
          class="mt-3 divide-y divide-default"
        >
          <div
            v-for="k in kunciMenu"
            :key="k"
            class="flex items-center gap-3 py-2"
          >
            <div class="min-w-0 flex-1">
              <b class="block text-sm">{{ k }}</b>
              <span class="block text-xs text-muted">{{ petaMenu[k] }}</span>
            </div>
            <UButton
              v-if="bolehUbah"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              :title="`Hapus pemetaan ${k}`"
              @click="petaHapus(k)"
            />
          </div>
        </div>
        <p class="mt-2 text-xs text-muted">
          {{ angka(kunciMenu.length) }} pemetaan.
        </p>
      </AppPanel>

      <AppPanel
        title="Kode Menu Paket"
        description="Baris LARGE (PACKAGE) dan REGULAR (PACKAGE) di laporan POS tidak menyebut minumannya — yang menyebut kodenya. Pasangkan sekali di sini, dan porsinya digabungkan ke menu aslinya di seluruh bulan yang pernah diunggah."
      >
        <UAlert
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="Sumber utamanya kolom Kode menu di HPP"
          description="Daftar di bawah ini cadangan — dipakai hanya untuk kode yang belum diisi di HPP & Resep → Daftar Resep. Kode yang diisi di HPP mengalahkan pasangan di sini."
        />
        <div
          v-if="bolehUbah"
          class="mt-3 flex flex-wrap items-end gap-2"
        >
          <UFormField
            label="Kode di POS"
            class="min-w-32 flex-1"
          >
            <UInput
              v-model="pkKode"
              placeholder="mis. AMERICANO02"
            />
          </UFormField>
          <UFormField
            label="Menu yang dimaksud"
            class="min-w-40 flex-1"
          >
            <UInput
              v-model="pkMenu"
              placeholder="mis. LARGE ICE AMERICANO"
              list="an-pk-resep"
            />
            <datalist id="an-pk-resep">
              <option
                v-for="n in resepHpp"
                :key="n"
                :value="n"
              />
            </datalist>
          </UFormField>
          <UButton
            label="Pasangkan"
            icon="i-lucide-plus"
            @click="kodeTambah()"
          />
        </div>
        <p
          v-if="!resepHpp.length"
          class="mt-2 text-xs text-muted"
        >
          Daftar resep HPP tidak terbaca, jadi kotaknya teks bebas — menu yang belum punya resep tetap boleh dipasangkan.
        </p>
        <div
          v-if="!kunciKode.length"
          class="mt-3 text-sm text-muted"
        >
          Belum ada pasangan. Kode yang muncul di laporan tapi belum dipasangkan disebutkan berikut jumlah porsinya di halaman <b>Menu &amp; Bahan Baku</b>.
        </div>
        <div
          v-else
          class="mt-3 divide-y divide-default"
        >
          <div
            v-for="k in kunciKode"
            :key="k"
            class="flex items-center gap-3 py-2"
          >
            <div class="min-w-0 flex-1">
              <b class="num block text-sm">{{ k }}</b>
              <span class="block text-xs text-muted">{{ petaKode[k] }}</span>
            </div>
            <UButton
              v-if="bolehUbah"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              :title="`Hapus pasangan ${k}`"
              @click="kodeHapus(k)"
            />
          </div>
        </div>
      </AppPanel>
    </template>
  </AppPage>
</template>
