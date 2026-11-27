<!--
  Kelola Akses (was "Kelola Role") — the module's own crew levels and its own access matrix.
  `seCrew` holds id + name + divisi + role; `sePerms` is this module's own
  section and never Reservasi's `perms`. Until one manager or admin exists,
  EVERYONE counts as System Admin — shown as a warning, not silently (F20).

  The office roster syncs names/divisions in; picking a level locks it
  (`roleSetAt`). Lowering the last manager/admin is refused: nothing else
  could reopen this screen.
  Source: laksamana-office/deploy/service_excellent/index.html:8952-9242.
-->
<script setup lang="ts">
import type { SeKru, SePerms, SeTingkat } from '~/composables/useServiceExcellent'
import { useSectionVersi, postAudit, putSection } from '~/composables/useReservasi'
import { useRoster } from '~/composables/useRoster'
import { apiErrorMessage } from '~/composables/useApi'
import { tanganiKonflik, versiDari } from '~/utils/versi'
import {
  BARIS_IZIN_SE, LABEL_TINGKAT_SE, LAYAR_SERVICE_EXCELLENT, TINGKAT_SE,
  bolehAksiSe, bolehBukaSe, seedPermsSE, tingkatSe,
} from '~/utils/layar/service_excellent'
import { DIVISI_KRU, kruTersaring } from '~/utils/service-excellent'
import { angka } from '~/utils/format'

definePageMeta({ access: ['service_excellent'] })

const me = useMe()
const toast = useToast()
const tingkat = computed(() => tingkatSe(me.value))
const bolehUbah = computed(() => bolehAksiSe('kelolaRole', tingkat.value))

const crew = useSectionVersi<SeKru[]>('seCrew')
const daftarCrew = computed(() => crew.data.value?.data ?? [])
const { data: roster } = useRoster()

const belumAdaPengurus = computed(() => !daftarCrew.value.some(k => k.role === 'manager' || k.role === 'admin'))

// --- roster sync -------------------------------------------------------------------
// Names and divisions flow in; a picked level is never overwritten by a sync.

async function segarkan() {
  if (!roster.value?.length) {
    toast.add({ title: 'Roster Office tidak bisa dimuat — coba lagi', color: 'error' })
    return
  }
  const next = [...daftarCrew.value]
  let berubah = false
  for (const m of roster.value) {
    if (!m?.id) continue
    const u = next.find(x => x.id === m.id)
      || next.find(x => String(x.name || '').toLowerCase() === String(m.name || '').toLowerCase())
    if (!u) {
      next.push({ id: m.id, name: m.name, divisi: String((m as { keterangan?: string }).keterangan || ''), role: 'staff' })
      berubah = true
    }
    else {
      if (m.id && u.id !== m.id) {
        u.id = m.id
        berubah = true
      }
      if (m.name && u.name !== m.name) {
        u.name = m.name
        berubah = true
      }
      const div = String((m as { keterangan?: string }).keterangan || '')
      if (u.divisi !== div) {
        u.divisi = div
        berubah = true
      }
      if (!TINGKAT_SE.includes(u.role as SeTingkat)) {
        u.role = 'staff'
        berubah = true
      }
    }
  }
  if (!berubah) {
    toast.add({ title: 'Daftar kru sudah paling baru' })
    return
  }
  try {
    await putSection('seCrew', next, versiDari(crew.data.value))
    await crew.refresh()
    toast.add({ title: `Daftar kru diperbarui (${roster.value.length} orang)`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => crew.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- the crew list -------------------------------------------------------------------
// Managers first, then names. Only Kasir/Host/Floor/Office stand here; the
// filtered-out are counted, not hidden silently.

const bobot: Record<string, number> = { admin: 0, manager: 1, staff: 2 }
const kruTampil = computed(() => {
  const { dipakai, tersembunyi } = kruTersaring(
    daftarCrew.value.map(u => ({ ...u })),
    DIVISI_KRU,
  )
  return {
    daftar: dipakai.sort((a, b) => (bobot[a.role] ?? 3) - (bobot[b.role] ?? 3) || String(a.name || '').localeCompare(String(b.name || ''))),
    tersembunyi,
  }
})

async function setTingkat(u: SeKru, role: string) {
  if (!bolehUbah.value) return
  if (!TINGKAT_SE.includes(role as SeTingkat)) {
    toast.add({ title: 'Tingkat tidak dikenal', color: 'error' })
    return
  }
  const ada = daftarCrew.value.find(x => x.id === u.id)
  if (!ada) {
    toast.add({ title: 'Kru belum ada di daftar modul ini — tekan Refresh dulu', color: 'error' })
    return
  }
  // Refusing to lower the last manager/admin: nothing else could reopen this screen.
  const pengurusLain = daftarCrew.value.filter(k => k.id !== u.id && (k.role === 'manager' || k.role === 'admin')).length
  if (!pengurusLain && role === 'staff') {
    toast.add({ title: 'Harus ada minimal satu Manajer/Admin di modul ini', color: 'error' })
    return
  }
  const dulu = ada.role
  try {
    const next = daftarCrew.value.map(k => k.id === u.id
      ? { ...k, role: role as SeTingkat, roleSetAt: Date.now(), roleSetBy: me.value?.name || '' }
      : k)
    await putSection('seCrew', next, versiDari(crew.data.value))
    await crew.refresh()
    if (dulu !== role) await postAudit({ action: 'Role Kru', detail: `${u.name}: ${LABEL_TINGKAT_SE[dulu as SeTingkat] || dulu} → ${LABEL_TINGKAT_SE[role as SeTingkat]}` })
    toast.add({ title: `${u.name} sekarang ${LABEL_TINGKAT_SE[role as SeTingkat]}`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => crew.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- the matrix --------------------------------------------------------------------------

const perms = useSectionVersi<SePerms>('sePerms')
const kerja = ref<Record<string, Record<string, number>>>({})
const tersimpanJson = ref('')
watch(() => perms.data.value, (v) => {
  const json = JSON.stringify(v?.data ?? seedPermsSE())
  if (json !== tersimpanJson.value) {
    tersimpanJson.value = json
    kerja.value = JSON.parse(json)
  }
}, { immediate: true })

const barisMatriks = computed(() => {
  const map = new Map<string, string>()
  for (const l of LAYAR_SERVICE_EXCELLENT) map.set(l.key, l.label)
  for (const b of BARIS_IZIN_SE) map.set(b.key, b.label)
  const keluar: { key: string, label: string, ekstra: boolean }[] = []
  for (const l of LAYAR_SERVICE_EXCELLENT) {
    keluar.push({ key: l.key, label: map.get(l.key) ?? l.key, ekstra: false })
    for (const b of BARIS_IZIN_SE.filter(b => b.afterPage === l.key && b.key !== l.key)) {
      keluar.push({ key: b.key, label: b.label, ekstra: true })
    }
  }
  return keluar
})

/** An extra row is useless for a level that cannot even SEE its parent page. */
const indukTerlihat = (row: string, t: string): boolean => {
  const b = BARIS_IZIN_SE.find(b => b.key === row)
  if (!b || b.key === b.page) return true
  return (kerja.value[b.page]?.[t] ?? 0) >= 1
}

async function simpanMatriks() {
  const next: SePerms = {}
  for (const { key } of barisMatriks.value) {
    next[key] = {}
    for (const t of TINGKAT_SE) {
      const v = kerja.value[key]?.[t]
      next[key]![t] = (typeof v === 'number' ? v : 1) as 0 | 1 | 2
    }
  }
  try {
    await putSection('sePerms', next, versiDari(perms.data.value))
    await perms.refresh()
    await postAudit({ action: 'Hak Akses', detail: 'Perbarui hak akses Service Excellent' })
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
    await putSection('sePerms', seedPermsSE(), versiDari(perms.data.value))
    await perms.refresh()
    await postAudit({ action: 'Hak Akses', detail: 'Reset ke default' })
    toast.add({ title: 'Hak akses direset', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => perms.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <AppPage
    title="Kelola akses"
    description="Kelola role dan hak akses Service Excellent."
  >
    <template v-if="bolehBukaSe('peran', tingkat)">
      <div
        v-if="belumAdaPengurus"
        class="mb-5 rounded-lg border border-default p-4 text-sm leading-relaxed"
      >
        Daftar ini belum punya satu pun <b>Manajer / Owner</b> atau <b>Admin Sistem</b>.
        Selama itu <b>semua orang</b> masuk sebagai <b>Admin Sistem</b> — termasuk yang di sini tertulis
        <b>Staff</b>. Ubah <b>satu</b> orang lewat pemilih di barisnya; sesudah itu
        yang lain benar-benar jadi Staff.
      </div>

      <AppList title="Role kru">
        <div class="flex items-center justify-between gap-3 px-4 py-3.5">
          <span class="text-sm text-muted">{{ angka(kruTampil.daftar.length) }} kru</span>
          <UButton
            v-if="bolehUbah"
            label="Refresh"
            color="neutral"
            variant="soft"
            size="sm"
            loading-auto
            @click="segarkan"
          />
        </div>
        <AppListRow
          v-for="u in kruTampil.daftar"
          :key="u.id"
          :title="`${u.name}${u.id === me?.id ? ' (kamu)' : ''}`"
          :description="`${u.divisi || '—'}${u.roleSetAt ? '' : ' · bawaan'}`"
          icon="i-lucide-user-round"
        >
          <template #trailing>
            <USelect
              v-if="bolehUbah"
              :model-value="u.role"
              :items="TINGKAT_SE.map(r => ({ value: r, label: LABEL_TINGKAT_SE[r] }))"
              size="sm"
              class="w-36"
              @update:model-value="(v) => setTingkat(u, String(v))"
            />
            <AppStatus v-else>
              {{ LABEL_TINGKAT_SE[u.role as SeTingkat] ?? u.role }}
            </AppStatus>
          </template>
        </AppListRow>
        <p
          v-if="!kruTampil.daftar.length"
          class="px-4 py-4 text-muted"
        >
          Daftar kru belum termuat dari Office.
        </p>
        <p class="px-4 py-3.5 text-sm leading-relaxed text-muted">
          Tingkat berlaku <b>hanya di modul ini</b>. Akun & login tetap dari Office.
          Yang tampil hanya tim <b>Kasir, Host, Floor, Office</b>{{ kruTampil.tersembunyi ? ` — ${angka(kruTampil.tersembunyi)} disembunyikan (tim lain atau keterangan masih kosong).` : '.' }}
        </p>
        <p class="px-4 py-3.5 text-sm leading-relaxed text-muted">
          Bertanda <i>bawaan</i> = tingkatnya belum pernah dipilih di sini. <b>Superadmin Office selalu Admin Sistem</b> dan tidak bisa dikunci dari sini.
        </p>
      </AppList>

      <AppList title="Hak akses per role">
        <MatriksIzin
          v-model="kerja"
          :baris="barisMatriks"
          :roles="TINGKAT_SE.filter(t => t !== 'admin').map(t => ({ key: t, label: LABEL_TINGKAT_SE[t] }))"
          :boleh-ubah="bolehUbah"
          :terkunci="(row, t) => !indukTerlihat(row, t)"
        />
        <div
          v-if="bolehUbah"
          class="flex flex-wrap gap-2 px-4 py-4"
        >
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
