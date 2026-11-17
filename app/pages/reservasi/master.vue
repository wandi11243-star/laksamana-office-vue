<!--
  Master Data — dropdown options, seating estimate, crew roles, the
  View/Edit matrix, backup. Every section writes with ITS OWN loaded version
  (§2.7); a change in between reloads the section instead of overwriting it.

  Restore-from-backup and wipe-everything are NOT brought to Vue (K-11 = A,
  owner 2026-10-08; data-deletion rule): a restore is done by a developer from
  the backup file, never from a button.
  Source: laksamana-office/deploy/reservasi/index.html:10516-10706.
-->
<script setup lang="ts">
import type { KruReservasi } from '~/composables/useReservasi'
import { getMaster, listReservations, postAudit, putSection, useSection, useSectionVersi } from '~/composables/useReservasi'
import {
  BARIS_IZIN_RESERVASI, LAYAR_RESERVASI, ROLE_LABEL_RESERVASI, ROLE_RESERVASI,
  bolehAksi, bolehBuka, roleReservasi, seedPermsReservasi, type PeranMatrix, type RoleReservasi,
} from '~/utils/layar/reservasi'
import { fmtMenit } from '~/utils/kunci-meja'
import { hariIni } from '~/utils/format'
import { apiErrorMessage } from '~/composables/useApi'
import { tanganiKonflik, versiDari } from '~/utils/versi'

definePageMeta({ access: ['reservasi'] })

const me = useMe()
const toast = useToast()
const role = computed(() => roleReservasi(me.value))
const kelolaOrang = computed(() => bolehAksi('manageUsers', role.value))

const catat = (action: string, detail: string) => postAudit({ action, detail })

// --- seating estimate ------------------------------------------------------------
// After this many minutes a table counts as free for the next booking — so one
// guest forgotten at "Selesai" does not block the table for days.

const dineEst = useSectionVersi<number>('dineEstMin')
const estimasi = ref<number>(180)
watch(() => dineEst.data.value, (v) => {
  if (typeof v?.data === 'number') estimasi.value = v.data
}, { immediate: true })

async function simpanEstimasi() {
  const n = Number(estimasi.value) || 0
  if (!n || n < 30) {
    toast.add({ title: 'Estimasi lama duduk minimal 30 menit', color: 'error' })
    return
  }
  try {
    await putSection('dineEstMin', n, versiDari(dineEst.data.value))
    await dineEst.refresh()
    await catat('Master', `Estimasi lama duduk → ${fmtMenit(n)}`)
    toast.add({ title: `Estimasi lama duduk disetel ${fmtMenit(n)}`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => dineEst.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- dropdown lists ----------------------------------------------------------------
// One section each, written immediately like the old screen (no save button).

const DAFTAR = [
  { key: 'categories', label: 'Jenis reservasi (tag)' },
  { key: 'dpMethods', label: 'Metode DP' },
  { key: 'infoSources', label: 'Sumber informasi' },
] as const

const sections = {
  categories: useSectionVersi<string[]>('categories'),
  dpMethods: useSectionVersi<string[]>('dpMethods'),
  infoSources: useSectionVersi<string[]>('infoSources'),
}

const draf = reactive<Record<string, string[]>>({ categories: [], dpMethods: [], infoSources: [] })
const daftar = (key: string): string[] => draf[key] ?? []
const tambahBaru = reactive<Record<string, string>>({ categories: '', dpMethods: '', infoSources: '' })
for (const d of DAFTAR) {
  watch(() => sections[d.key].data.value, (v) => {
    draf[d.key] = Array.isArray(v?.data) ? [...v.data] : []
  }, { immediate: true })
}

async function tambahItem(key: string) {
  const v = (tambahBaru[key] ?? '').trim()
  if (!v) return
  const sec = sections[key as keyof typeof sections]
  try {
    await putSection(key, [...(draf[key] ?? []), v], versiDari(sec.data.value))
    tambahBaru[key] = ''
    await sec.refresh()
    await catat('Master +', `${key}: ${v}`)
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => sec.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

async function hapusItem(key: string, i: number) {
  const sec = sections[key as keyof typeof sections]
  const v = (draf[key] ?? [])[i]
  try {
    await putSection(key, (draf[key] ?? []).filter((_, j) => j !== i), versiDari(sec.data.value))
    await sec.refresh()
    await catat('Master −', `${key}: ${v}`)
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => sec.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

const { data: waTargets } = useSection<{ id: string, name: string, type: string, includeDP: boolean }[]>('waTargets')

// --- crew roles ----------------------------------------------------------------------
// Names and logins live in Office, not here; only the in-module role is set.

const users = useSectionVersi<KruReservasi[]>('users')
const daftarKru = computed(() => users.data.value?.data ?? [])

const sheetRole = ref(false)
const roleForm = reactive({ id: '', nama: '', role: 'host' as RoleReservasi })

function bukaRole(u: KruReservasi) {
  Object.assign(roleForm, { id: u.id, nama: u.name, role: u.role })
  sheetRole.value = true
}

async function simpanRole() {
  try {
    const next = daftarKru.value.map(u => (u.id === roleForm.id ? { ...u, role: roleForm.role } : u))
    await putSection('users', next, versiDari(users.data.value))
    await users.refresh()
    await catat('Role Kru', `${roleForm.nama} -> ${roleForm.role}`)
    sheetRole.value = false
    toast.add({ title: 'Role kru disimpan', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => users.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- the View/Edit matrix ---------------------------------------------------------------
// Each cell: Tak Terlihat / Lihat / Boleh Ubah, one click cycles. "Ubah" only
// means something where an action is bound (see ACTION_PAGE) — pure
// information screens always act as view-only even when set to Ubah. Viewer
// caps at Lihat, everywhere: reading, cycling and saving (`:10560-10684`).

const perms = useSectionVersi<PeranMatrix>('perms')
const kolomRole = ROLE_RESERVASI.filter(r => r !== 'admin')

const kerja = ref<PeranMatrix>({})
const tersimpanJson = ref('')
watch(() => perms.data.value, (v) => {
  const json = JSON.stringify(v?.data ?? seedPermsReservasi())
  if (json !== tersimpanJson.value) {
    tersimpanJson.value = json
    kerja.value = JSON.parse(json) as PeranMatrix
  }
}, { immediate: true })

const labelBaris = computed(() => {
  const map = new Map<string, string>()
  for (const l of LAYAR_RESERVASI) map.set(l.key, l.label)
  for (const b of BARIS_IZIN_RESERVASI) map.set(b.key, b.label)
  return map
})

const barisMatriks = computed(() => {
  const keluar: { key: string, label: string, ekstra: boolean }[] = []
  for (const l of LAYAR_RESERVASI) {
    keluar.push({ key: l.key, label: labelBaris.value.get(l.key) ?? l.key, ekstra: false })
    for (const b of BARIS_IZIN_RESERVASI.filter(b => b.afterPage === l.key && b.key !== l.key)) {
      keluar.push({ key: b.key, label: b.label, ekstra: true })
    }
  }
  return keluar
})

/** An extra row is useless for a role that cannot even SEE its parent page — locked, not clickable. */
const indukTerlihat = (row: string, r: string): boolean => {
  const b = BARIS_IZIN_RESERVASI.find(b => b.key === row)
  if (!b || b.key === b.page) return true
  return (kerja.value[b.page]?.[r as RoleReservasi] ?? 0) >= 1
}

const bacaSel = (row: string, r: RoleReservasi): number => {
  const v = kerja.value[row]?.[r]
  return typeof v === 'number' ? v : 1
}

async function simpanMatriks() {
  const next: PeranMatrix = {}
  for (const { key } of barisMatriks.value) {
    next[key] = {}
    for (const r of ROLE_RESERVASI) {
      if (r === 'admin') next[key]![r] = 2
      else if (r === 'viewer') next[key]![r] = Math.min(bacaSel(key, r), 1) as 0 | 1
      else next[key]![r] = bacaSel(key, r) as 0 | 1 | 2
    }
  }
  try {
    await putSection('perms', next, versiDari(perms.data.value))
    await perms.refresh()
    await catat('Hak Akses', 'Perbarui matriks hak akses')
    toast.add({ title: 'Hak akses diperbarui', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => perms.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

const sheetReset = ref(false)

async function resetMatriks() {
  sheetReset.value = false
  try {
    await putSection('perms', seedPermsReservasi(), versiDari(perms.data.value))
    await perms.refresh()
    await catat('Hak Akses', 'Reset ke default')
    toast.add({ title: 'Hak akses direset', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => perms.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- backup (read-only) ------------------------------------------------------------------
// Restore and wipe are not in Vue (K-11 = A): they overwrite/erase everything.

async function backupJson() {
  try {
    const [baris, master] = await Promise.all([
      listReservations(undefined, undefined).then(r => r.data),
      getMaster().then(r => r.data),
    ])
    const blob = new Blob([JSON.stringify({ reservations: baris, master }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `backup_laksamana_${hariIni()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    toast.add({ title: 'Backup diunduh', color: 'success' })
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <AppPage
    title="Master data"
    description="Kelola pilihan dropdown & pengaturan sistem."
  >
    <template v-if="bolehBuka('master', role)">
      <div class="mb-3 flex flex-wrap gap-2">
        <UButton
          label="Data & backup"
          color="neutral"
          variant="soft"
          size="sm"
          loading-auto
          @click="backupJson"
        />
      </div>

      <AppList title="Estimasi lama tamu duduk">
        <div class="flex flex-wrap items-end gap-2 px-4 py-3">
          <UFormField
            label="Lama duduk (menit)"
            class="max-w-36"
          >
            <UInput
              v-model.number="estimasi"
              type="number"
              :min="30"
              step="15"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UButton
            label="Simpan"
            size="xl"
            loading-auto
            @click="simpanEstimasi"
          />
          <div class="flex gap-1">
            <UButton
              v-for="v in [90, 120, 150, 180, 240, 300]"
              :key="v"
              :label="fmtMenit(v)"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="estimasi = v"
            />
          </div>
        </div>
        <p class="px-4 pb-3 text-sm text-muted">
          Setelah tamu duduk selama ini, mejanya otomatis dianggap bebas untuk booking berikutnya.
          Sekarang: <b>{{ fmtMenit(Number(dineEst.data.value?.data) || 0) }}</b>.
        </p>
      </AppList>

      <AppList
        v-for="d in DAFTAR"
        :key="d.key"
        :title="d.label"
      >
        <div class="flex flex-wrap gap-2 px-4 py-3">
          <span
            v-for="(v, i) in daftar(d.key)"
            :key="`${v}${i}`"
            class="inline-flex items-center gap-1 rounded-lg border border-default px-2.5 py-1 text-sm"
          >
            {{ v }}
            <UButton
              label="×"
              color="neutral"
              variant="ghost"
              size="xs"
              loading-auto
              @click="hapusItem(d.key, i)"
            />
          </span>
          <span
            v-if="!daftar(d.key).length"
            class="text-sm text-muted"
          >Kosong</span>
        </div>
        <div class="flex gap-2 px-4 pb-3">
          <UInput
            v-model="tambahBaru[d.key]"
            placeholder="Tambah baru…"
            class="min-w-40 flex-1"
            @keyup.enter="tambahItem(d.key)"
          />
          <UButton
            label="Tambah"
            size="sm"
            loading-auto
            @click="tambahItem(d.key)"
          />
        </div>
      </AppList>

      <AppList title="Tujuan WhatsApp">
        <AppListRow
          v-for="t in (waTargets ?? [])"
          :key="t.id"
          :title="t.name"
          :description="t.type"
          icon="i-lucide-message-circle"
        >
          <template #trailing>
            <AppStatus :color="t.includeDP ? 'success' : 'neutral'">
              {{ t.includeDP ? '+ DP' : 'tanpa DP' }}
            </AppStatus>
          </template>
        </AppListRow>
        <p class="px-4 pb-3 text-sm text-muted">
          Grup Cashier & Koordinasi sudah otomatis dengan template siap pakai. Untuk grup lain, gunakan opsi custom saat kirim WA.
        </p>
      </AppList>

      <template v-if="kelolaOrang">
        <AppList title="Role kru">
          <AppListRow
            v-for="u in daftarKru"
            :key="u.id"
            :title="u.name"
            :description="ROLE_LABEL_RESERVASI[(u.role as RoleReservasi)] ?? u.role"
            icon="i-lucide-user-round"
          >
            <template #trailing>
              <UButton
                label="Atur role"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="bukaRole(u)"
              />
            </template>
          </AppListRow>
          <p
            v-if="!daftarKru.length"
            class="px-4 py-3 text-muted"
          >
            Belum ada daftar kru.
          </p>
          <p class="px-4 pb-3 text-sm text-muted">
            Atur <b>role</b> tiap kru untuk menentukan halaman apa yang bisa mereka buka (lihat tabel Hak Akses per Role). Akun kru & login dikelola di Office, bukan di sini.
          </p>
        </AppList>

        <AppList title="Hak akses per role">
          <MatriksIzin
            v-model="kerja"
            :baris="barisMatriks"
            :roles="kolomRole.map(r => ({ key: r, label: ROLE_LABEL_RESERVASI[r] ?? r }))"
            :putaran="(r) => r === 'viewer' ? 2 : 3"
            :terkunci="(row, r) => !indukTerlihat(row, r)"
          />
          <div class="flex flex-wrap gap-2 px-4 pb-4">
            <UButton
              label="Simpan hak akses"
              size="sm"
              loading-auto
              @click="simpanMatriks"
            />
            <UButton
              label="Kembalikan default"
              color="neutral"
              variant="soft"
              size="sm"
              @click="sheetReset = true"
            />
          </div>
        </AppList>
      </template>

      <AppList title="Data & backup">
        <div class="flex flex-wrap gap-2 px-4 py-3">
          <UButton
            label="Backup semua data (JSON)"
            color="neutral"
            variant="soft"
            size="sm"
            loading-auto
            @click="backupJson"
          />
          <p class="basis-full text-sm text-muted">
            Restore dari backup dan Hapus semua data tidak tersedia di Office Vue (K-11): keduanya menimpa atau
            menghapus seluruh data. Kalau perlu restore, minta developer memulihkannya dari berkas backup.
          </p>
        </div>
      </AppList>

      <ResponsiveSheet
        v-model:open="sheetRole"
        title="Atur role kru"
        :description="roleForm.nama"
      >
        <UFormField label="Role / jabatan">
          <USelect
            v-model="roleForm.role"
            :items="ROLE_RESERVASI.map(r => ({ value: r, label: ROLE_LABEL_RESERVASI[r] }))"
            size="xl"
            class="w-full"
          />
          <p class="mt-1 text-xs text-muted">
            Role menentukan halaman apa yang bisa dibuka kru ini. Nama & login dikelola di Office.
          </p>
        </UFormField>
        <template #footer>
          <UButton
            label="Simpan"
            size="xl"
            loading-auto
            @click="simpanRole"
          />
          <UButton
            label="Batal"
            color="neutral"
            variant="ghost"
            size="xl"
            @click="sheetRole = false"
          />
        </template>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="sheetReset"
        title="Kembalikan default"
      >
        <p class="text-sm text-muted">
          Kembalikan semua hak akses ke pengaturan default?
        </p>
        <template #footer>
          <UButton
            label="Kembalikan"
            color="error"
            size="xl"
            loading-auto
            @click="resetMatriks"
          />
          <UButton
            label="Batal"
            color="neutral"
            variant="ghost"
            size="xl"
            @click="sheetReset = false"
          />
        </template>
      </ResponsiveSheet>
    </template>
    <p
      v-else
      class="text-muted"
    >
      Tidak ada akses.
    </p>
  </AppPage>
</template>
