<!--
  Konten › Pengaturan (old VIEWS.settings, deploy/konten/index.html:
  4672-4790; konten.md D.19, F.23–F.26).

  CARDS ARE GATED ONE BY ONE (F.26): Organisasi, Manajemen Data and the role
  matrix need the `settings` row; Kru & Rangkap Kerja needs the `team` row —
  so a Content Director keeps the crew list. Nobody with neither sees one
  card saying so.

  - Organisasi: `PUT /documents/settings` against the current hash.
  - Manajemen Data: CSV exports (konten, performa per platform, tim) and a
    JSON backup of the state, in the browser. Restore JSON is "Segera"
    (K-01 / G-13): v1 has no whole-state write, and replacing every record
    would overwrite other people's work.
  - Kru: Office admins of `konten` manage crew (KontenKruForm); the roster
    sync runs once per session for them (useSinkronKruKonten).
  - Role matrix: super admin edits (cell cycles None → Lihat → Ubah, saved
    with the current hash; Reset to default asks first); others see the
    read-only catalogue. Retired rows (bank, reports) stay stored, unseen.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { FilterKru } from '~/utils/sistem-konten'
import type { PermsKonten, RoleKonten, UserKonten } from '~/utils/konten'
import { ROLES_KONTEN, ROLE_KEYS_KONTEN, modPermKonten, permDefaultKonten } from '~/utils/konten'
import {
  LABEL_MODUL_KONTEN, LEVEL_KONTEN, LEVEL_PANJANG, ROLE_MATRIKS, csvKonten, csvPerforma, csvTim, filterKruBawaan, hitungRoleKru, labelRole,
  modulMatriks, permSimpan, rolesKru, saringKru, shortRole, siklusLevel,
} from '~/utils/sistem-konten'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['konten'] })

const me = useMe()
const { data: st, error } = useStateKonten()
const { saya } = useAksesKonten()
const kembar = useSinkronKruKonten()

const level = (row: string) => levelSayaKonten(me.value, st.value.users, st.value.perms, row)
const bolehSetting = computed(() => !!saya.value?.super || level('settings') >= 1)
const ubahSetting = computed(() => !!saya.value?.super || level('settings') >= 2)
const bolehKru = computed(() => !!saya.value?.super || level('team') >= 1)
const adminOffice = computed(() => isAdminOf(me.value, 'konten'))

// ---- organisasi
const orgName = ref('')
watch(() => st.value.settings.orgName, (v) => {
  orgName.value = v ?? ''
}, { immediate: true })
async function simpanOrg() {
  await kontenSimpan(() => simpanDokumenKonten<{ orgName?: string }>('settings', lama => ({ ...(lama ?? {}), orgName: orgName.value })), 'Pengaturan disimpan')
}

// ---- manajemen data
const namaBrand = (id?: string) => st.value.brands.find(b => b.id === id)?.name ?? ''
const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? ''
function ekspor(jenis: 'content' | 'performance' | 'team') {
  if (jenis === 'content') unduhKonten('COMS_konten.csv', csvKonten(st.value.content, namaBrand, namaUser), 'text/csv')
  else if (jenis === 'performance') unduhKonten('COMS_performa.csv', csvPerforma(st.value.content, namaBrand), 'text/csv')
  else unduhKonten('COMS_tim.csv', csvTim(st.value.users), 'text/csv')
  logKonten('mengekspor laporan', jenis).catch(() => {})
}
const backup = () => unduhKonten(`COMS_backup_${hariIni()}.json`, JSON.stringify(st.value, null, 2), 'application/json')

// ---- kru
const fk = useState<FilterKru>('konten-kru-filter', filterKruBawaan)
const hal = useState('konten-kru-hal', () => 1)
const per = useState('konten-kru-per', () => 10)
const list = computed(() => saringKru(st.value.users, fk.value))
watch(fk, () => {
  hal.value = 1
}, { deep: true })
const halaman = computed(() => list.value.slice((hal.value - 1) * per.value, hal.value * per.value))
const rangkap = computed(() => st.value.users.filter(u => rolesKru(u).length > 1).length)
const SEMUA = '__semua'
const fRole = computed({
  get: () => fk.value.role || SEMUA,
  set: (v: string) => {
    fk.value.role = v === SEMUA ? '' : v
  },
})
const opsiRole = computed(() => [
  { value: SEMUA, label: `Semua role (${st.value.users.length})` },
  ...ROLE_KEYS_KONTEN.map(r => ({ value: r, label: `${labelRole(r)} (${hitungRoleKru(st.value.users, r)})` })),
])
const kolomKru: TableColumn<UserKonten>[] = [
  { id: 'kru', header: 'Kru' },
  { id: 'divisi', header: 'Divisi / email' },
  { id: 'role', header: 'Role' },
  { id: 'aksi', header: '' },
]
const kruBuka = ref(false)
const kruId = ref('')
const kruItem = computed(() => st.value.users.find(u => u.id === kruId.value) ?? null)
function kelola(u: UserKonten) {
  kruId.value = u.id
  kruBuka.value = true
}

// ---- role matrix
const mods = computed(() => modulMatriks(st.value.perms))
const draf = ref<Record<string, Record<string, number>>>({})
watch(() => st.value.perms, (p) => {
  draf.value = Object.fromEntries(Object.keys(p).map(m => [m, Object.fromEntries(ROLE_KEYS_KONTEN.map(r => [r, modPermKonten(p, m, r)]))]))
}, { immediate: true, deep: true })
const geser = (m: string, r: string) => {
  draf.value[m]![r] = siklusLevel(draf.value[m]![r] ?? 0)
}
const warnaLevel = (v: number) => (v === 2 ? 'success' : v === 1 ? 'info' : 'neutral')
const sibukPerm = ref(false)
async function simpanPerm() {
  sibukPerm.value = true
  await kontenSimpan(() => simpanDokumenKonten<PermsKonten>('perms', () => permSimpan(st.value.perms, draf.value)), 'Hak akses diperbarui')
  sibukPerm.value = false
}
const resetBuka = ref(false)
async function resetPerm() {
  sibukPerm.value = true
  const ok = await kontenSimpan(() => simpanDokumenKonten<PermsKonten>('perms', () => permDefaultKonten()), 'Hak akses direset ke default')
  sibukPerm.value = false
  if (ok) resetBuka.value = false
}
const katalog = computed(() => ROLE_KEYS_KONTEN.map(r => ({
  r,
  edit: r === 'super_admin' ? ['Semua modul'] : mods.value.filter(m => modPermKonten(st.value.perms, m, r) >= 2).map(m => LABEL_MODUL_KONTEN[m] ?? m),
  view: r === 'super_admin' ? [] : mods.value.filter(m => modPermKonten(st.value.perms, m, r) === 1).map(m => LABEL_MODUL_KONTEN[m] ?? m),
})))
</script>

<template>
  <KontenGerbang lihat="settings">
  <AppPage
    title="Pengaturan"
    description="Konfigurasi sistem, daftar kru & hak akses"
  >
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
    />

    <AppPanel v-if="!bolehSetting && !bolehKru">
      <div class="p-6 text-center">
        <UIcon
          name="i-lucide-lock"
          class="mx-auto size-7 text-dimmed"
        />
        <p class="mt-2 font-semibold">
          Tidak ada yang bisa kamu buka di sini
        </p>
        <p class="text-sm text-muted">
          Minta admin modul Konten membuka akses Pengaturan atau Tim untuk role kamu.
        </p>
      </div>
    </AppPanel>

    <div
      v-if="bolehSetting"
      class="grid items-start gap-4 lg:grid-cols-2"
    >
      <AppPanel
        title="Organisasi"
        icon="i-lucide-building-2"
      >
        <UFormField label="Nama organisasi">
          <UInput
            v-model="orgName"
            :disabled="!ubahSetting"
            class="w-full"
          />
        </UFormField>
        <UButton
          v-if="ubahSetting"
          label="Simpan"
          size="sm"
          class="mt-3"
          @click="simpanOrg"
        />
      </AppPanel>
      <AppPanel
        title="Manajemen data"
        icon="i-lucide-database"
        description="Ekspor rekap untuk dibuka di Excel / Sheets, atau backup seluruh data modul ini. Backup rutin disarankan."
      >
        <div class="flex flex-wrap gap-2">
          <UButton
            label="Ekspor konten (CSV)"
            icon="i-lucide-file-text"
            size="sm"
            @click="ekspor('content')"
          />
          <UButton
            label="Ekspor performa (CSV)"
            icon="i-lucide-chart-column"
            size="sm"
            color="neutral"
            variant="outline"
            @click="ekspor('performance')"
          />
          <UButton
            label="Ekspor tim (CSV)"
            icon="i-lucide-users"
            size="sm"
            color="neutral"
            variant="outline"
            @click="ekspor('team')"
          />
          <UButton
            label="Backup (JSON)"
            icon="i-lucide-save"
            size="sm"
            color="neutral"
            variant="outline"
            @click="backup"
          />
          <UButton
            label="Restore (JSON)"
            icon="i-lucide-folder-open"
            size="sm"
            color="neutral"
            variant="outline"
            disabled
            title="Segera — memulihkan seluruh data sekaligus belum tersedia di sistem baru"
          >
            <template #trailing>
              <span class="text-[11px] text-dimmed">Segera</span>
            </template>
          </UButton>
        </div>
        <p class="mt-3 text-xs text-muted">
          Ekspor performa berisi <b>satu baris per platform</b> — reach, impression, engagement, dan ketiga rasionya dihitung
          mesin yang sama dengan layar Performa Konten. Restore JSON belum tersedia: memulihkan seluruh data sekaligus akan
          menimpa pekerjaan kru lain.
        </p>
      </AppPanel>
    </div>

    <AppPanel
      v-if="bolehKru"
      title="Kru & rangkap kerja"
      icon="i-lucide-users"
      :description="`${st.users.length} kru · ${rangkap} memegang lebih dari satu role`"
      flush
    >
      <div class="space-y-3 border-b border-default p-4">
        <p class="text-sm text-muted">
          Satu kru bisa memegang beberapa role sekaligus (mis. Planner + Designer). Hak akses & tugas otomatis <b>digabung</b>
          dari seluruh role yang dipegang — yang paling longgar yang berlaku. Nama & akunnya datang dari Office; yang disetel di
          sini role internal & data operasionalnya.
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <UInput
            v-model="fk.q"
            placeholder="Cari nama, divisi, email…"
            icon="i-lucide-search"
            class="w-full sm:w-60"
          />
          <USelect
            v-model="fRole"
            :items="opsiRole"
            class="w-full sm:w-56"
          />
          <UButton
            label="Reset"
            icon="i-lucide-rotate-ccw"
            color="neutral"
            variant="outline"
            size="sm"
            @click="fk = filterKruBawaan()"
          />
          <span class="text-xs text-muted sm:ms-auto">{{ list.length }} kru</span>
        </div>
        <UAlert
          v-if="kembar.length"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`${kembar.length} kru tersimpan dengan id lama`"
          :description="`Cocok dengan Office lewat nama saja: ${kembar.map(k => k.nama).join(', ')}. Barisnya tidak dipindah otomatis — minta admin teknis menyatukannya.`"
        />
      </div>
      <p
        v-if="!list.length"
        class="p-6 text-center text-sm text-muted"
      >
        Tidak ada kru yang cocok. Ubah kata kunci atau pilihan role, atau tekan Reset.
      </p>
      <template v-else>
        <UTable
          class="hidden md:block"
          :data="halaman"
          :columns="kolomKru"
          :ui="{ th: 'px-2.5 whitespace-normal leading-tight', td: 'px-2.5 py-2 text-[13px]' }"
        >
          <template #kru-cell="{ row }">
            <b>{{ row.original.name }}</b>
            <UBadge
              v-if="row.original.id === me?.id"
              label="kamu"
              color="primary"
              variant="outline"
              size="sm"
              class="ms-1"
            />
            <span
              v-if="rolesKru(row.original).length > 1"
              class="block text-[11px] text-primary-700"
            >rangkap ×{{ rolesKru(row.original).length }}</span>
          </template>
          <template #divisi-cell="{ row }">
            <span class="text-xs">{{ row.original.division || '—' }}</span>
            <span class="block text-[11px] text-muted">{{ row.original.email }}</span>
          </template>
          <template #role-cell="{ row }">
            <span class="flex flex-wrap gap-1">
              <UBadge
                v-for="r in rolesKru(row.original)"
                :key="r"
                :label="labelRole(r)"
                color="neutral"
                variant="soft"
                size="sm"
              />
              <span
                v-if="!rolesKru(row.original).length"
                class="text-xs text-warning"
              >belum ada role</span>
            </span>
          </template>
          <template #aksi-cell="{ row }">
            <UButton
              v-if="adminOffice"
              label="Kelola"
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="kelola(row.original)"
            />
          </template>
        </UTable>
        <ul class="divide-y divide-default md:hidden">
          <li
            v-for="u in halaman"
            :key="u.id"
            class="flex items-start gap-3 p-4"
          >
            <div class="min-w-0 flex-1">
              <b>{{ u.name }}</b>
              <span class="block text-xs text-muted">{{ [u.division, u.email].filter(Boolean).join(' · ') || '—' }}</span>
              <span class="block text-xs">{{ rolesKru(u).map(labelRole).join(' + ') || 'belum ada role' }}</span>
            </div>
            <UButton
              v-if="adminOffice"
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Kelola"
              @click="kelola(u)"
            />
          </li>
        </ul>
        <KontenPager
          v-model:hal="hal"
          v-model:per="per"
          :total="list.length"
          satuan="kru"
        />
        <p
          v-if="!adminOffice"
          class="border-t border-default px-4 py-3 text-xs text-muted"
        >
          Kamu bisa melihat daftarnya, tapi yang bisa mengubah role & data kru hanya admin modul Konten.
        </p>
      </template>
    </AppPanel>

    <template v-if="bolehSetting">
      <AppPanel
        v-if="saya?.super"
        title="Editor hak akses"
        icon="i-lucide-shield"
        description="Atur akses tiap role per modul — Super Admin selalu penuh. Perubahan memengaruhi menu & tombol tiap kru sesudah disimpan."
        flush
      >
        <div class="flex flex-wrap items-center gap-3 border-b border-default p-4 text-xs text-muted">
          <span
            v-for="(l, i) in LEVEL_PANJANG"
            :key="l"
          ><AppStatus
            :color="warnaLevel(i)"
            size="sm"
          >{{ l }}</AppStatus></span>
          <span>Klik sel untuk geser status.</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default text-xs text-muted">
                <th class="px-4 py-2 text-left font-semibold">
                  Modul
                </th>
                <th
                  v-for="r in ROLE_MATRIKS"
                  :key="r"
                  class="px-2 py-2 font-semibold"
                  :title="ROLES_KONTEN[r as RoleKonten].desc"
                >
                  {{ shortRole(r) }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="m in mods"
                :key="m"
              >
                <td class="px-4 py-2">
                  <b>{{ LABEL_MODUL_KONTEN[m] ?? m }}</b>
                  <span class="block text-[10px] text-muted">{{ m }}</span>
                </td>
                <td
                  v-for="r in ROLE_MATRIKS"
                  :key="r"
                  class="px-2 py-2 text-center"
                >
                  <UButton
                    :label="LEVEL_KONTEN[draf[m]?.[r] ?? 0]"
                    :color="warnaLevel(draf[m]?.[r] ?? 0)"
                    :variant="(draf[m]?.[r] ?? 0) ? 'soft' : 'outline'"
                    size="xs"
                    class="w-16 justify-center"
                    :title="`${LEVEL_PANJANG[draf[m]?.[r] ?? 0]} — klik untuk ubah`"
                    @click="geser(m, r)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex flex-wrap gap-2 border-t border-default p-4">
          <UButton
            label="Simpan hak akses"
            icon="i-lucide-save"
            size="sm"
            :loading="sibukPerm"
            @click="simpanPerm"
          />
          <UButton
            label="Kembalikan default"
            icon="i-lucide-rotate-ccw"
            size="sm"
            color="neutral"
            variant="outline"
            @click="resetBuka = true"
          />
        </div>
      </AppPanel>
      <AppPanel
        v-else
        title="Katalog role & hak akses"
        icon="i-lucide-shield"
        description="Rangkap kerja: akses digabung."
        flush
      >
        <ul class="divide-y divide-default">
          <li
            v-for="k in katalog"
            :key="k.r"
            class="px-4 py-3 text-sm"
          >
            <b>{{ labelRole(k.r) }}</b>
            <span class="block text-xs text-muted">{{ ROLES_KONTEN[k.r as RoleKonten].desc }}</span>
            <span class="mt-1 flex flex-wrap gap-1">
              <UBadge
                v-for="x in k.edit"
                :key="x"
                :label="x"
                color="success"
                variant="soft"
                size="sm"
              />
              <UBadge
                v-for="x in k.view"
                :key="x"
                :label="`${x} (lihat)`"
                color="neutral"
                variant="soft"
                size="sm"
              />
            </span>
          </li>
        </ul>
      </AppPanel>
    </template>

    <KontenKruForm
      v-model:open="kruBuka"
      :kru="kruItem"
    />
    <KontenKonfirmasi
      v-model:open="resetBuka"
      title="Kembalikan semua hak akses ke pengaturan default?"
      confirm-label="Kembalikan default"
      :loading="sibukPerm"
      @konfirmasi="resetPerm"
    />
  </AppPage>
  </KontenGerbang>
</template>
