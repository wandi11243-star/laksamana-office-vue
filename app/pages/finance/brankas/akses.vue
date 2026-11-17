<!--
  Finance › Brankas › Kelola Akses (old `vAkses`, deploy/finance/brankas/index.html:1844-1935).

  Same shape as Kas › Kelola Kru: each person's ROLE (default = Staf Finance)
  plus the page × role matrix, stored as the DIFF from the defaults. Only a
  module admin changes anything here; everyone else still sees the matrix so
  they know their own rights. The admin column stays locked full — that
  column is the way back from a bad setting.
-->
<script setup lang="ts">
import type { ModulMember } from '~/composables/useRoster'
import { getVaultAkses, putVaultMatrix, putVaultRole } from '~/composables/useFinance'
import { AKS_HAL_ISI_BRANKAS, muatPeranBrankas, tingkatBawaanBrankas, useBrankasAksesSiap, useBrankasIzin } from '~/utils/layar/finance'
import { useModulMembers } from '~/composables/useRoster'

definePageMeta({ access: ['brankas'] })

const izin = useBrankasIzin()
const toast = useToast()

const HALAMAN: { key: string, label: string }[] = [
  { key: 'ringkasan', label: 'Ringkasan Brankas' },
  { key: 'saldo', label: 'Saldo & Rekening' },
  { key: 'mutasi', label: 'Mutasi & Transfer' },
  { key: 'pending', label: 'Uang Pending / Piutang' },
  { key: 'modal', label: 'Pengembalian Modal' },
  { key: 'pengaturan', label: 'Pengaturan' },
  { key: 'akses', label: 'Kelola Akses' },
]
const ROLE_KEYS = ['staf', 'manajemen', 'viewer'] as const
const ROLE_LABEL: Record<string, string> = { staf: 'Staf Finance', manajemen: 'Manajemen', viewer: 'View Only', admin: 'Admin Modul' }
const ROLE_KET: Record<string, string> = {
  staf: 'Kerja harian: mencatat rencana bayar dan pengembalian modal.',
  manajemen: 'Membaca posisi kas & keputusan besar; tidak mengetik isian harian.',
  viewer: 'Membaca saja — tidak pernah bisa mengubah apa pun.',
}
const PERM_LABEL = ['None', 'Lihat', 'Ubah']

const { data, error, refresh } = useAsyncData('brankas-akses-page', () => getVaultAkses())
const { data: anggotaData } = useModulMembers('brankas')
const anggota = computed<ModulMember[]>(() => anggotaData.value ?? [])

/** Effective level: stored override, else the default (`aksTingkat`). */
const stored = computed(() => data.value?.akses.matrix ?? {})
function tingkat(page: string, role: string): number {
  if (role === 'admin') return AKS_HAL_ISI_BRANKAS.includes(page) ? 2 : 1
  const b = stored.value[role]?.[page]
  let t = b !== undefined ? Number(b) : tingkatBawaanBrankas(page, role)
  t = Math.max(0, Math.min(2, t))
  if (!AKS_HAL_ISI_BRANKAS.includes(page) && t > 1) t = 1
  if (role === 'viewer' && t > 1) t = 1
  return t
}

// Local edits (page|role → level); matrix is saved as the DIFF from defaults.
const ubah = ref<Record<string, number>>({})
const nilai = (page: string, role: string) => ubah.value[`${page}|${role}`] ?? tingkat(page, role)
function geser(page: string, role: string) {
  if (!izin.ubah('akses')) return
  const now = nilai(page, role)
  const maks = role === 'viewer' || !AKS_HAL_ISI_BRANKAS.includes(page) ? 1 : 2
  const next = now >= maks ? 0 : now + 1
  ubah.value = { ...ubah.value, [`${page}|${role}`]: next }
}
const kotor = computed(() => Object.keys(ubah.value).length > 0)

const sibuk = ref(false)
async function simpanMatriks() {
  if (!data.value || !izin.ubah('akses') || sibuk.value) return
  sibuk.value = true
  try {
    const diff: Record<string, Record<string, number>> = {}
    for (const role of ROLE_KEYS) {
      for (const h of HALAMAN) {
        const v = nilai(h.key, role)
        if (v !== tingkatBawaanBrankas(h.key, role)) {
          diff[role] = { ...(diff[role] ?? {}), [h.key]: v }
        }
      }
    }
    await putVaultMatrix(diff, data.value.version ?? '')
    ubah.value = {}
    toast.add({ title: 'Matriks hak akses disimpan.', color: 'success' })
    await refresh()
    useBrankasAksesSiap().value = null
    muatPeranBrankas()
  }
  catch (e) {
    toast.add({ title: `Gagal menyimpan: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

const roleOf = (m: ModulMember): string =>
  data.value?.akses.roles[`#${m.id}`] ?? data.value?.akses.roles[`@${String(m.name).trim().toLowerCase()}`] ?? ''
const drafRole = ref<Record<string, string>>({})
const rolePilih = (m: ModulMember) => drafRole.value[m.id] ?? (roleOf(m) || '__bawaan')
async function simpanRole(m: ModulMember) {
  if (!data.value || !izin.ubah('akses') || sibuk.value) return
  const v = rolePilih(m)
  if ((v === '__bawaan' ? '' : v) === roleOf(m)) return
  sibuk.value = true
  try {
    await putVaultRole(m.id, v === '__bawaan' ? '' : v, undefined)
    toast.add({ title: `Role ${m.name} disimpan.`, color: 'success' })
    await refresh()
    useBrankasAksesSiap().value = null
    muatPeranBrankas()
  }
  catch (e) {
    toast.add({ title: `Gagal menyimpan role: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <AppPage
    title="Kelola akses"
    description="Siapa boleh membuka dan mengubah halaman mana."
  >
    <template #actions>
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        size="sm"
        @click="refresh()"
      />
    </template>

    <UAlert
      v-if="!izin.lihat('akses')"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak dibuka untuk peranmu."
    />
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
    />

    <template v-else>
      <UAlert
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        title="Matriks di bawah cuma bisa diubah admin modul. Kamu tetap bisa melihatnya supaya tahu hak akses role kamu sendiri."
        class="mb-4"
      />
      <UAlert
        v-if="izin.ubah('akses')"
        color="warning"
        variant="subtle"
        icon="i-lucide-shield-alert"
        title="Baris Kelola Akses memberi kunci, bukan cuma tampilan."
        description="Role dengan Ubah di halaman ini bisa menaikkan haknya sendiri. Kolom Admin Modul tetap terkunci penuh — itulah jalan pulang kalau setelannya terlanjur salah."
        class="mb-4"
      />

      <AppPanel
        title="Hak akses per halaman"
        description="Klik selnya untuk memutar None → Lihat → Ubah. Halaman informasi (Ringkasan, Pending) tidak mengenal Ubah."
        flush
      >
        <div class="overflow-x-auto">
          <table class="w-full min-w-[640px] text-sm">
            <thead class="bg-table-head text-table-head-text">
              <tr>
                <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
                  Halaman
                </th>
                <th class="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider">
                  Staf Finance
                </th>
                <th class="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider">
                  Manajemen
                </th>
                <th class="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider">
                  View Only
                </th>
                <th class="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider">
                  Admin Modul
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="h in HALAMAN"
                :key="h.key"
              >
                <td class="px-3 py-2">
                  {{ h.label }}
                  <span
                    v-if="!AKS_HAL_ISI_BRANKAS.includes(h.key)"
                    class="text-[11px] text-muted"
                  >(baca saja)</span>
                </td>
                <td
                  v-for="role in (['staf', 'manajemen', 'viewer'] as const)"
                  :key="role"
                  class="px-3 py-2 text-center"
                >
                  <UButton
                    :label="PERM_LABEL[nilai(h.key, role)]"
                    :color="nilai(h.key, role) === 2 ? 'primary' : nilai(h.key, role) === 1 ? 'neutral' : 'error'"
                    :variant="nilai(h.key, role) === 0 ? 'outline' : 'soft'"
                    size="xs"
                    :disabled="!izin.ubah('akses')"
                    @click="geser(h.key, role)"
                  />
                </td>
                <td class="px-3 py-2 text-center">
                  <AppStatus
                    color="success"
                    size="sm"
                  >
                    {{ PERM_LABEL[tingkat(h.key, 'admin')] }}
                  </AppStatus>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex flex-wrap items-center gap-3 border-t border-default px-4 py-3 lg:px-5">
          <p class="text-sm text-muted">
            Klik sel untuk menggeser status. Yang tersimpan hanya selisih dari bawaan.
          </p>
          <div class="flex-1" />
          <UButton
            v-if="izin.ubah('akses')"
            label="Simpan matriks"
            icon="i-lucide-save"
            :disabled="!kotor"
            :loading="sibuk"
            @click="simpanMatriks"
          />
        </div>
      </AppPanel>

      <AppPanel
        title="Role tiap kru"
        :description="`Kru yang belum pernah ditentukan rolenya dihitung sebagai Staf Finance. ${ROLE_KEYS.map(r => `${ROLE_LABEL[r]}: ${ROLE_KET[r]}`).join(' ')}`"
        flush
      >
        <div class="divide-y divide-default">
          <div
            v-for="m in anggota"
            :key="m.id"
            class="flex flex-wrap items-center gap-3 px-4 py-2.5 lg:px-5"
          >
            <div class="min-w-0 flex-1">
              <b class="text-highlighted">{{ m.name || '(tanpa nama)' }}</b>
              <span class="block text-xs text-muted">{{ m.keterangan || '—' }}</span>
            </div>
            <AppStatus
              v-if="m.active === false"
              color="warning"
              size="sm"
            >
              Nonaktif
            </AppStatus>
            <template v-if="m.isModuleAdmin">
              <AppStatus
                color="success"
                icon="i-lucide-shield-check"
                size="sm"
              >
                Admin modul
              </AppStatus>
            </template>
            <template v-else>
              <USelect
                :model-value="rolePilih(m)"
                :items="[
                  { label: `${ROLE_LABEL.staf} (bawaan)`, value: '__bawaan' },
                  { label: ROLE_LABEL.staf, value: 'staf' },
                  { label: ROLE_LABEL.manajemen, value: 'manajemen' },
                  { label: ROLE_LABEL.viewer, value: 'viewer' },
                ]"
                size="sm"
                class="w-48"
                :disabled="!izin.ubah('akses')"
                @update:model-value="(v: string) => { drafRole = { ...drafRole, [m.id]: v } }"
              />
              <UButton
                v-if="izin.ubah('akses') && rolePilih(m) !== (roleOf(m) || '__bawaan')"
                label="Simpan"
                size="xs"
                loading-auto
                @click="simpanRole(m)"
              />
            </template>
          </div>
          <p
            v-if="!anggota.length"
            class="px-4 py-6 text-center text-sm text-muted"
          >
            Belum ada kru dengan akses modul Brankas.
          </p>
        </div>
      </AppPanel>
    </template>
  </AppPage>
</template>
