<!--
  Finance › Kas Kecil › Kelola Kru (old `viewAkses`, deploy/finance/kas/index.html:4817-5010).

  Two settings in one place: the ROLE of each person (default = Staf Finance,
  the role whose behaviour matches the day before roles existed) and the page ×
  role matrix. Only cells that differ from the default are stored; the admin
  column is locked full on purpose — that column is the way back from a bad
  setting. Giving a role "Ubah" on this page hands it the module's keys.
-->
<script setup lang="ts">
import type { ModulMember } from '~/composables/useRoster'
import { getKkAkses, putKkMatrix, putKkRole } from '~/composables/useFinance'
import { AKS_HAL_ISI_KAS, muatPeranKas, tingkatBawaanKas, useKasAksesSiap, useKasIzin } from '~/utils/layar/finance'
import { useModulMembers } from '~/composables/useRoster'
import type { Versi } from '~/utils/versi'

definePageMeta({ access: ['finance'] })

const izin = useKasIzin()
const toast = useToast()

const HALAMAN: { key: string, label: string }[] = [
  { key: 'kk_input', label: 'Input Transaksi Kas Kecil' },
  { key: 'kk_buku', label: 'Buku Kas Kecil' },
  { key: 'kk_pos', label: 'Pos & Kategori' },
  { key: 'tagihan', label: 'Tagihan Rutin' },
  { key: 'bayar', label: 'Planning Pembayaran' },
  { key: 'rekap', label: 'Rekap Penjualan' },
  { key: 'dp', label: 'Dana Masuk (DP)' },
  { key: 'bri', label: 'Pencocokan QRIS BRI' },
  { key: 'invoice', label: 'Invoice & Kwitansi' },
  { key: 'voidb', label: 'Laporan Void' },
  { key: 'bulanan', label: 'Dashboard Omset' },
  { key: 'analytics', label: 'Dashboard Analytics' },
  { key: 'marketing', label: 'Performa Marketing' },
  { key: 'event', label: 'Performa Event' },
  { key: 'kasir', label: 'Performa Kasir' },
  { key: 'akses', label: 'Kelola Kru' },
]
const ROLE_KEYS = ['staf', 'manajemen', 'viewer'] as const
const ROLE_LABEL: Record<string, string> = { staf: 'Staf Finance', manajemen: 'Manajemen', viewer: 'View Only', admin: 'Admin Modul' }
const PERM_LABEL = ['None', 'Lihat', 'Ubah']

const { data, error, refresh } = useAsyncData('kas-akses-page', () => getKkAkses())
const { data: anggotaData } = useModulMembers('finance')
const anggota = computed<ModulMember[]>(() => anggotaData.value ?? [])

/** Effective level: stored override, else the default (`aksTingkat`). */
const stored = computed(() => data.value?.akses.matrix ?? {})
function tingkat(page: string, role: string): number {
  if (role === 'admin') return AKS_HAL_ISI_KAS.includes(page) ? 2 : 1
  const b = stored.value[role]?.[page]
  let t = b !== undefined ? Number(b) : tingkatBawaanKas(page, role)
  t = Math.max(0, Math.min(2, t))
  if (!AKS_HAL_ISI_KAS.includes(page) && t > 1) t = 1
  if (role === 'viewer' && t > 1) t = 1
  return t
}

// Local edits (page|role → level); matrix is saved as the DIFF from defaults.
const ubah = ref<Record<string, number>>({})
const nilai = (page: string, role: string) => ubah.value[`${page}|${role}`] ?? tingkat(page, role)
function geser(page: string, role: string) {
  if (!izin.ubah('akses')) return
  const now = nilai(page, role)
  const maks = role === 'viewer' || !AKS_HAL_ISI_KAS.includes(page) ? 1 : 2
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
        if (v !== tingkatBawaanKas(h.key, role)) {
          diff[role] = { ...(diff[role] ?? {}), [h.key]: v }
        }
      }
    }
    await putKkMatrix(diff, data.value.version ?? '')
    ubah.value = {}
    toast.add({ title: 'Matriks hak akses disimpan.', color: 'success' })
    await refresh()
    useKasAksesSiap().value = null
    muatPeranKas()
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
    const versi: Versi | undefined = data.value.roleVersions?.[`#${m.id}`]
    await putKkRole(m.id, v === '__bawaan' ? '' : v, versi)
    toast.add({ title: `Role ${m.name} disimpan.`, color: 'success' })
    await refresh()
    useKasAksesSiap().value = null
    muatPeranKas()
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
    title="Kelola kru"
    description="Siapa saja yang bisa membuka modul Finance."
  >
    <template #actions>
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="sibuk"
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
        v-if="izin.ubah('akses')"
        color="warning"
        variant="subtle"
        icon="i-lucide-shield-alert"
        title="Baris Kelola Kru memberi kunci, bukan cuma tampilan."
        description="Role dengan Ubah di halaman ini bisa menaikkan haknya sendiri. Kolom Admin Modul tetap terkunci penuh — itulah jalan pulang kalau setelannya terlanjur salah."
      />

      <AppPanel
        title="Role & hak akses modul Finance"
        description="Menambah dan mencabut AKSES modul tetap di Kelola Akses milik Office; yang disetel di sini hanya role tiap kru dan apa yang boleh dilakukan tiap role."
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
                    v-if="!AKS_HAL_ISI_KAS.includes(h.key)"
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
        :description="`Kru yang belum pernah ditentukan rolenya dihitung sebagai Staf Finance. ${anggota.length} kru memegang modul ini.`"
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
                v-if="izin.ubah('akses') && rolePilih(m) !== roleOf(m)"
                label="Simpan"
                size="xs"
                @click="simpanRole(m)"
              />
            </template>
          </div>
          <p
            v-if="!anggota.length"
            class="px-4 py-6 text-center text-sm text-muted"
          >
            Belum ada kru dengan akses modul Finance.
          </p>
        </div>
      </AppPanel>
    </template>
  </AppPage>
</template>
