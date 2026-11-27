<!--
  Investor Compass › Kelola Akses (Nov 2026). People only (owner): the list is
  exactly who holds the investor module in Office › Kelola Akses (members API,
  reloaded on every visit); here each person gets a role, and each role opens
  the pages shown in words (the stored page matrix, no longer edited here and
  sent back unchanged). The investor admin also sets the Management Fee
  composition (total 100%). Only the investor admin may save (If-Match).
-->
<script setup lang="ts">
import {
  getInvestorMembers, saveInvestorSetelan, useInvestorIzin, useInvestorSetelan,
  type HalInvestor, type PenerimaFee, type PeranInvestor, type TingkatInvestor,
} from '~/composables/useInvestor'

definePageMeta({ access: ['investor'] })

const toast = useToast()
const izin = useInvestorIzin()
const bolehLihat = computed(() => izin.lihat('akses'))
const admin = computed(() => izin.admin.value)

const { data: balasan, status, error, refresh } = useInvestorSetelan()
const isi = computed(() => balasan.value?.data ?? null)
const versi = computed(() => balasan.value?.meta?.version ?? '')
const { data: anggota, refresh: muatAnggota } = useAsyncData('investor-members', () => (bolehLihat.value ? getInvestorMembers() : Promise.resolve([])), { watch: [bolehLihat], default: () => [] })
// always the current holders: a change in Office › Kelola Akses must show here at once
onMounted(() => {
  void muatAnggota()
  void refresh()
})

const LABEL_HAL: Record<HalInvestor, string> = {
  labarugi: 'Laba Rugi', dividen: 'Dividen', fee: 'Management Fee', event: 'Upcoming event', promo: 'Promo', akses: 'Kelola Akses',
}
const LABEL_PERAN: Record<PeranInvestor, string> = { investor: 'Investor', mitra: 'Mitra', pengurus: 'Pengurus' }
/** What a role opens, in words (the page matrix is no longer edited here, owner Nov 2026). */
const halamanPeran = (p: PeranInvestor) => {
  const s = isi.value
  if (!s) return ''
  const buka = s.halaman.filter(h => (matriks.value[p]?.[h] ?? 0) >= 1 && h !== 'fee').map(h => LABEL_HAL[h])
  return buka.length ? buka.join(', ') : 'Tidak ada halaman'
}

// ─── working copies (reset whenever the server copy changes) ──
const matriks = ref<Record<string, Record<string, TingkatInvestor>>>({})
const peran = ref<Record<string, PeranInvestor>>({})
const penerima = ref<PenerimaFee[]>([])
function muatDraf() {
  const s = isi.value
  if (!s) return
  const m: Record<string, Record<string, TingkatInvestor>> = {}
  for (const p of s.peranList) {
    m[p] = {}
    for (const h of s.halaman) m[p]![h] = (s.matrix?.[p]?.[h] ?? s.bawaan[p][h]) as TingkatInvestor
  }
  matriks.value = m
  peran.value = { ...(s.roles ?? {}) }
  penerima.value = (s.fee?.penerima ?? []).map(x => ({ ...x }))
}
watch(isi, muatDraf, { immediate: true })

const totalPersen = computed(() => Math.round(penerima.value.reduce((a, p) => a + (Number(p.persen) || 0), 0) * 100) / 100)
const opsiAnggota = computed(() => (anggota.value ?? []).map(a => ({ value: a.id, label: a.name || a.username || a.id })))
const namaAnggota = (id: string) => (anggota.value ?? []).find(a => a.id === id)?.name ?? ''
function tambahPenerima() {
  penerima.value.push({ akunId: '', nama: '', persen: Math.max(0, Math.round((100 - totalPersen.value) * 100) / 100) })
}

const salahFee = computed(() => {
  const p = penerima.value
  if (!p.length) return ''
  if (p.some(x => !x.akunId)) return 'Pilih akun untuk setiap penerima.'
  if (new Set(p.map(x => x.akunId)).size !== p.length) return 'Satu akun hanya boleh muncul sekali.'
  if (p.some(x => !(Number(x.persen) > 0))) return 'Persen tiap penerima harus di atas 0.'
  if (Math.abs(totalPersen.value - 100) > 0.01) return `Jumlah persen harus 100%, sekarang ${totalPersen.value.toLocaleString('id-ID')}%.`
  return ''
})

const menyimpan = ref(false)
async function simpan() {
  const s = isi.value
  if (!s || salahFee.value) return
  // only the diff from the defaults
  const diff: Record<string, Record<string, TingkatInvestor>> = {}
  for (const p of s.peranList) {
    for (const h of s.halaman) {
      const v = matriks.value[p]?.[h]
      if (v !== undefined && v !== s.bawaan[p][h]) (diff[p] ||= {})[h] = v
    }
  }
  menyimpan.value = true
  try {
    await saveInvestorSetelan({
      matrix: diff,
      roles: Object.fromEntries(Object.entries(peran.value).filter(([, r]) => r && r !== 'investor')),
      fee: { penerima: penerima.value.map(x => ({ akunId: x.akunId, nama: namaAnggota(x.akunId) || x.nama, persen: Number(x.persen) })) },
    }, versi.value)
    toast.add({ title: 'Pengaturan akses investor disimpan', color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
    if ((e as { statusCode?: number }).statusCode === 409) await refresh()
  }
  finally {
    menyimpan.value = false
  }
}
</script>

<template>
  <AppPage
    title="Kelola Akses"
    description="Atur peran orang yang punya akses Investor Compass, dan komposisi penerima management fee"
  >
    <template #actions>
      <UButton
        v-if="admin"
        label="Simpan"
        icon="i-lucide-save"
        size="lg"
        :loading="menyimpan"
        :disabled="!isi || !!salahFee"
        @click="simpan"
      />
    </template>

    <UAlert
      v-if="!bolehLihat"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak boleh dibuka"
      description="Kelola Akses hanya untuk admin investor dan peran yang diberi akses."
    />
    <AppPanel
      v-else-if="status === 'pending' && !isi"
      title="Memuat pengaturan"
    >
      <USkeleton class="h-24 w-full" />
    </AppPanel>
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Pengaturan belum bisa dibaca"
      :description="apiErrorMessage(error)"
    />
    <template v-else-if="isi">
      <UAlert
        v-if="!admin"
        class="mb-6"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        title="Hanya bisa dilihat"
        description="Perubahan hanya bisa dilakukan admin modul investor."
      />

      <!-- people (from Office › Kelola Akses) and their role -->
      <AppPanel
        title="Orang dengan akses Investor Compass"
        description="Daftar ini mengikuti Kelola Akses Office: hanya orang yang sudah diberi akses modul Investor Compass. Di sini kamu mengatur perannya, yang menentukan halaman apa saja yang bisa dibuka."
      >
        <ul class="mb-4 grid gap-1 rounded-panel bg-muted p-3 text-sm sm:grid-cols-3">
          <li
            v-for="p in isi.peranList"
            :key="p"
          >
            <b>{{ LABEL_PERAN[p] }}</b>
            <span class="block text-muted">{{ halamanPeran(p) }}</span>
          </li>
        </ul>
        <p
          v-if="!anggota?.length"
          class="text-muted"
        >
          Belum ada yang memegang modul investor.
        </p>
        <ul
          v-else
          class="divide-y divide-default"
        >
          <li
            v-for="a in anggota"
            :key="a.id"
            class="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <span>
              <b>{{ a.name || a.username }}</b>
              <UBadge
                v-if="a.isModuleAdmin"
                class="ml-2"
                label="Admin"
                variant="subtle"
                color="primary"
              />
            </span>
            <USelect
              :model-value="peran[a.id] ?? 'investor'"
              :items="isi.peranList.map(p => ({ value: p, label: LABEL_PERAN[p] }))"
              :disabled="!admin"
              class="w-40"
              @update:model-value="(v: PeranInvestor) => (peran[a.id] = v)"
            />
          </li>
        </ul>
      </AppPanel>

      <!-- 3. fee composition (admin only; the server sends it to the admin alone) -->
      <AppPanel
        v-if="admin"
        title="Komposisi management fee"
        description="Penerima management fee dan persennya (jumlah 100%). Komposisi ini terpisah dari kepemilikan investor. Tiap penerima hanya melihat bagiannya sendiri."
        class="mt-6"
      >
        <div class="flex flex-col gap-3">
          <div
            v-for="(p, i) in penerima"
            :key="i"
            class="flex flex-wrap items-center gap-3"
          >
            <USelectMenu
              v-model="p.akunId"
              :items="opsiAnggota"
              value-key="value"
              placeholder="Pilih akun"
              class="w-64"
            />
            <UInput
              v-model.number="p.persen"
              type="number"
              min="0"
              max="100"
              step="0.01"
              class="w-32"
            >
              <template #trailing>
                <span class="text-sm text-muted">%</span>
              </template>
            </UInput>
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              aria-label="Hapus penerima"
              @click="penerima.splice(i, 1)"
            />
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <UButton
              label="Tambah penerima"
              icon="i-lucide-plus"
              color="neutral"
              variant="outline"
              @click="tambahPenerima"
            />
            <span
              class="text-sm"
              :class="penerima.length && Math.abs(totalPersen - 100) > 0.01 ? 'text-error' : 'text-muted'"
            >Jumlah: <b>{{ totalPersen.toLocaleString('id-ID') }}%</b></span>
          </div>
          <p
            v-if="salahFee"
            class="text-sm text-error"
          >
            {{ salahFee }}
          </p>
          <p class="text-sm text-muted">
            Penerima harus memegang modul Investor Compass agar bisa membuka halaman Management Fee.
          </p>
        </div>
      </AppPanel>
    </template>
  </AppPage>
</template>
