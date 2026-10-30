<!--
  Analytics › Kelola Akses. The page × role matrix plus per-crew roles
  (deploy/analytics/index.html:8270 vAkses). Only the module admin may change
  anything (saveAnalyticsAccess + accessVersion + tanganiKonflik); everyone
  else reads. Levels are explicit selects (None/Lihat/Ubah), never a
  one-click cycle. Only the DIFF from the defaults is sent — a full copy
  would freeze today's rules over tomorrow's pages.
-->
<script setup lang="ts">
import {
  accessVersionDari, getAnalyticsMembers, saveAnalyticsAccess, useAnalyticsState,
  type AnalyticsAkses, type AnalyticsAnggota,
} from '~/composables/useAnalytics'
import {
  AKS_HAL_ISI_ANALYTICS, LAYAR_ANALYTICS, ROLE_LABEL_ANALYTICS,
  tingkatBawaanAnalytics, useAnalyticsIzin,
} from '~/utils/layar/analytics'
import { isAdminOf } from '~/composables/useMe'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['analytics'] })

const toast = useToast()
const me = useMe()
const izin = useAnalyticsIzin()
const bolehLihat = computed(() => izin.lihat('akses'))
const sayaAdmin = computed(() => isAdminOf(me.value, 'analytics'))
const bisa = computed(() => sayaAdmin.value && izin.ubah('akses'))

const { data: balasan, status, error, refresh } = useAnalyticsState()
const isi = computed(() => balasan.value?.data ?? null)
const aksesVersi = computed(() => accessVersionDari(balasan.value))
const tersimpan = computed<AnalyticsAkses>(() => isi.value?.akses ?? {})
const peranTersimpan = computed(() => isi.value?.peran ?? {})

const TINGKAT_OPSI = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Lihat' },
  { value: 2, label: 'Ubah' },
]
/* ---- matrix draft: effective level per page × role ---- */
const draf = ref<Record<string, Record<string, number>>>({})
function muatDraf() {
  const m: Record<string, Record<string, number>> = {}
  for (const l of LAYAR_ANALYTICS) {
    for (const r of ['staf', 'manajemen', 'viewer']) {
      const simpan = tersimpan.value[r]?.[l.key]
      const t = simpan !== undefined ? Number(simpan) : tingkatBawaanAnalytics(l.key, r)
      ;(m[r] ||= {})[l.key] = Number.isFinite(t) ? t : tingkatBawaanAnalytics(l.key, r)
    }
  }
  draf.value = m
}
watch(tersimpan, muatDraf, { immediate: true })
const tingkat = (hal: string, role: string) => draf.value[role]?.[hal] ?? tingkatBawaanAnalytics(hal, role)
function setTingkat(hal: string, role: string, v: number) {
  ;(draf.value[role] ||= {})[hal] = v
}
const menyimpan = ref(false)
async function simpanMatriks() {
  if (!bisa.value || !isi.value) return
  // Only the diff from the defaults is sent.
  const peta: AnalyticsAkses = {}
  for (const r of Object.keys(draf.value)) {
    for (const l of LAYAR_ANALYTICS) {
      const v = draf.value[r]?.[l.key]
      if (v === undefined || v === tingkatBawaanAnalytics(l.key, r)) continue
      ;(peta[r] ||= {})[l.key] = v
    }
  }
  const v = aksesVersi.value
  if (v === undefined) {
    toast.add({ title: 'Data belum termuat', description: 'Tunggu matriksnya dimuat dulu, lalu simpan lagi.', color: 'warning' })
    return
  }
  menyimpan.value = true
  try {
    await saveAnalyticsAccess({ matrix: peta }, v)
    await refresh()
    toast.add({ title: 'Matriks tersimpan.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}

/* ---- crew roles ---- */
const { data: anggota, status: anggotaStatus } = useAsyncData(
  'analytics-anggota',
  () => getAnalyticsMembers().catch(() => [] as AnalyticsAnggota[]),
  { server: false, default: () => [] as AnalyticsAnggota[] },
)
const kunciAnggota = (u: AnalyticsAnggota) => `#${u.id}`
const peranAnggota = (u: AnalyticsAnggota) => {
  const k = kunciAnggota(u)
  const byId = peranTersimpan.value[k]
  if (byId) return String(byId)
  const byName = peranTersimpan.value[`@${String(u.name ?? '').trim().toLowerCase()}`]
  return String(byName ?? 'staf')
}
async function setPeran(u: AnalyticsAnggota, peran: string) {
  if (!bisa.value || !isi.value || u.isModuleAdmin) return
  const v = aksesVersi.value
  if (v === undefined) {
    toast.add({ title: 'Data belum termuat', description: 'Tunggu matriksnya dimuat dulu, lalu simpan lagi.', color: 'warning' })
    return
  }
  try {
    await saveAnalyticsAccess({ roles: { ...peranTersimpan.value, [kunciAnggota(u)]: peran } }, v)
    await refresh()
    toast.add({ title: 'Role tersimpan.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}
const opsiPeran = ['staf', 'manajemen', 'viewer'].map(r => ({ value: r, label: ROLE_LABEL_ANALYTICS[r] ?? r }))
</script>

<template>
  <AppPage
    title="Kelola Akses"
    description="Siapa boleh membuka dan mengubah halaman mana"
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
      title="Memuat matriks akses"
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

    <UAlert
      v-else-if="!bolehLihat"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak boleh dibuka"
      description="Minta admin modul mengubahnya di Kelola Akses."
    />

    <template v-else>
      <UAlert
        v-if="!sayaAdmin"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        title="Matriks di bawah cuma bisa diubah admin modul"
        description="Kamu tetap bisa melihatnya supaya tahu hak akses role kamu sendiri."
      />

      <AppPanel
        title="Hak Akses per Halaman"
        description="Kolom Admin Modul selalu penuh dan tidak bisa diturunkan — kalau bisa, satu klik salah membuat modul ini tidak punya siapa pun yang bisa membetulkannya lagi."
        flush
      >
        <div class="flex flex-wrap gap-3 px-4 pt-4 text-xs text-muted">
          <span
            v-for="o in TINGKAT_OPSI"
            :key="o.value"
          ><b>{{ o.label }}</b>{{ o.value === 0 ? ' = tak terlihat' : o.value === 1 ? ' = membuka' : ' = membuka + mengisi' }}</span>
        </div>
        <UTable
          class="hidden lg:block"
          :data="LAYAR_ANALYTICS"
          :columns="[{ accessorKey: 'label', header: 'Halaman' }, { accessorKey: 'staf', header: 'Staf' }, { accessorKey: 'manajemen', header: 'Manajemen' }, { accessorKey: 'viewer', header: 'View Only' }, { accessorKey: 'admin', header: 'Admin Modul' }]"
        >
          <template #label-cell="{ row }">
            <b>{{ row.original.label }}</b>
            <span
              v-if="!AKS_HAL_ISI_ANALYTICS.includes(row.original.key)"
              class="block text-xs text-muted"
            >halaman informasi — "Ubah" tidak berlaku</span>
          </template>
          <template #staf-cell="{ row }">
            <USelect
              :model-value="tingkat(row.original.key, 'staf')"
              :items="TINGKAT_OPSI"
              size="xs"
              :disabled="!bisa"
              @update:model-value="(v) => setTingkat(row.original.key, 'staf', Number(v))"
            />
          </template>
          <template #manajemen-cell="{ row }">
            <USelect
              :model-value="tingkat(row.original.key, 'manajemen')"
              :items="TINGKAT_OPSI"
              size="xs"
              :disabled="!bisa"
              @update:model-value="(v) => setTingkat(row.original.key, 'manajemen', Number(v))"
            />
          </template>
          <template #viewer-cell="{ row }">
            <USelect
              :model-value="tingkat(row.original.key, 'viewer')"
              :items="TINGKAT_OPSI"
              size="xs"
              :disabled="!bisa"
              @update:model-value="(v) => setTingkat(row.original.key, 'viewer', Number(v))"
            />
          </template>
          <template #admin-cell="{ row }">
            <AppStatus
              color="gold"
              size="sm"
              icon="i-lucide-lock"
            >
              {{ AKS_HAL_ISI_ANALYTICS.includes(row.original.key) ? 'Ubah' : 'Lihat' }}
            </AppStatus>
          </template>
        </UTable>
        <div class="divide-y divide-default lg:hidden">
          <div
            v-for="l in LAYAR_ANALYTICS"
            :key="l.key"
            class="px-4 py-2.5"
          >
            <b class="block text-sm">{{ l.label }}</b>
            <div class="mt-1.5 grid grid-cols-3 gap-2">
              <UFormField
                v-for="r in ['staf', 'manajemen', 'viewer']"
                :key="r"
                :label="ROLE_LABEL_ANALYTICS[r] ?? r"
              >
                <USelect
                  :model-value="tingkat(l.key, r)"
                  :items="TINGKAT_OPSI"
                  size="xs"
                  :disabled="!bisa"
                  @update:model-value="(v) => setTingkat(l.key, r, Number(v))"
                />
              </UFormField>
            </div>
          </div>
        </div>
        <div
          v-if="bisa"
          class="px-4 py-3"
        >
          <UButton
            label="Simpan Matriks"
            icon="i-lucide-check"
            :loading="menyimpan"
            @click="simpanMatriks()"
          />
        </div>
        <p class="px-4 py-3 text-xs text-muted">
          Viewer tidak pernah lebih dari Lihat; halaman informasi tidak mengenal Ubah. Yang dikirim ke server cuma selisih dari bawaan.
        </p>
      </AppPanel>

      <AppPanel
        title="Role Tiap Kru"
      >
        <template #description>
          Kru yang belum pernah ditentukan rolenya dihitung sebagai <b>Staf</b>.
          <b>Staf:</b> Mengunggah laporan POS dan membaca seluruh analisanya.
          <b>Manajemen:</b> Membaca analisanya; tidak mengunggah berkas.
          <b>View Only:</b> Membaca saja — tidak pernah bisa mengubah apa pun.
        </template>
        <div
          v-if="anggotaStatus === 'pending'"
          class="text-sm text-muted"
        >
          Memuat daftar kru…
        </div>
        <div
          v-else-if="!anggota.length"
          class="rounded-panel border border-default bg-elevated p-8 text-center"
        >
          <p class="font-semibold">
            Belum ada kru yang diberi kunci modul analytics di Kelola Akses Office.
          </p>
        </div>
        <template v-else>
          <!-- Old role table (:8130): Nama | Tim | Role, the role as a three-way segment. -->
          <table class="hidden w-full text-sm lg:table">
            <thead class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
              <tr>
                <th class="px-3 py-2">
                  Nama
                </th>
                <th class="px-3 py-2">
                  Tim
                </th>
                <th class="px-3 py-2">
                  Role
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="u in anggota"
                :key="u.id"
              >
                <td class="px-3 py-2">
                  <b>{{ u.name }}</b>
                  <AppStatus
                    v-if="u.isModuleAdmin"
                    size="sm"
                    color="gold"
                    class="ms-2"
                  >
                    admin modul
                  </AppStatus>
                </td>
                <td class="px-3 py-2 text-muted">
                  {{ u.keterangan || u.username || '—' }}
                </td>
                <td class="px-3 py-2">
                  <span
                    v-if="u.isModuleAdmin"
                    class="text-xs text-muted"
                  >Admin modul — selalu akses penuh</span>
                  <AppSeg
                    v-else-if="bisa"
                    :model-value="peranAnggota(u)"
                    :options="opsiPeran"
                    size="sm"
                    @update:model-value="(v) => setPeran(u, String(v))"
                  />
                  <span v-else>{{ ROLE_LABEL_ANALYTICS[peranAnggota(u)] ?? peranAnggota(u) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="u in anggota"
              :key="u.id"
              class="space-y-1.5 py-2.5"
            >
              <div>
                <b class="block text-sm">{{ u.name }}</b>
                <span class="block text-xs text-muted">{{ u.keterangan || u.username || '—' }}{{ u.isModuleAdmin ? ' · admin modul' : '' }}</span>
              </div>
              <span
                v-if="u.isModuleAdmin"
                class="text-xs text-muted"
              >Admin modul — selalu akses penuh</span>
              <AppSeg
                v-else-if="bisa"
                :model-value="peranAnggota(u)"
                :options="opsiPeran"
                size="sm"
                @update:model-value="(v) => setPeran(u, String(v))"
              />
              <span
                v-else
                class="text-sm"
              >{{ ROLE_LABEL_ANALYTICS[peranAnggota(u)] ?? peranAnggota(u) }}</span>
            </div>
          </div>
        </template>
        <p class="mt-2 text-xs text-muted">
          Kunci penetapannya <b class="num">#id</b> user, bukan namanya. Role kamu saat ini: <b>{{ sayaAdmin ? 'Admin modul' : (ROLE_LABEL_ANALYTICS[izin.role.value] ?? izin.role.value) }}</b>.
        </p>
      </AppPanel>
    </template>
  </AppPage>
</template>
