<!--
  Marketing › Pegawai & Akses (docs/migrasi/marketing.md D.20, issue #63; old
  deploy/marketing/index.html:19915-20220, sync :3705-3820).

  One list for everyone: identity follows the Office user database (roster
  U2: GET /account/roster + /account/modules/marketing/members), and the
  module's role & access are set here. The roster is synced on its own when
  this page opens (again when the last one failed or is over 5 minutes old) —
  no "Sinkron Sekarang" button: the ribbon says whether the list is current.
  Only the phone can be edited here; Tim, name and active come from Office.
-->
<script setup lang="ts">
import type { KolomMkt, UserMkt } from '~/utils/marketing'
import { DIVISI_MKT, namaRoleMkt, roleAccMkt, ROLES_MKT, userAccMkt, VIEW_KEYS_MKT } from '~/utils/marketing'
import {
  aksesKhususMkt, JUDUL_VIEW_MKT, LABEL_LEVEL_MKT, putarLevelMkt, RAGAM_LEVEL_MKT, rencanaSinkronMkt,
  simpanAksesUserMkt, simpanMatriksMkt, timUserMkt,
} from '~/utils/marketing-pegawai'
import type { ModulMember, RosterUser } from '~/composables/useRoster'
import { apiErrorMessage } from '~/composables/useApi'
import { angka } from '~/utils/format'

definePageMeta({ access: ['marketing'] })

const toast = useToast()
const { data: st } = useStateMkt()
const { can } = useAksesMkt()
const canEdit = computed(() => can('edit_staff'))
const canMU = computed(() => can('manage_users'))

// ---------------------------------------------------------------- roster sync
interface SinkronMkt { status: 'diam' | 'jalan' | 'gagal' | 'ok', at: number | null, baru: number, ubah: number, pesan: string, tertahan?: number }
const sinkron = useState<SinkronMkt>('mkt-roster-sinkron', () => ({ status: 'diam', at: null, baru: 0, ubah: 0, pesan: '' }))
const BASI_MS = 5 * 60 * 1000
const jamSinkron = computed(() => (sinkron.value.at ? new Date(sinkron.value.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''))

async function sinkronkan() {
  sinkron.value = { status: 'jalan', at: null, baru: 0, ubah: 0, pesan: '' }
  let semua: RosterUser[]
  try {
    semua = (await useApi()<Envelope<RosterUser[]>>('/account/roster')).data ?? []
  }
  catch (e) {
    sinkron.value = { status: 'gagal', at: Date.now(), baru: 0, ubah: 0, pesan: apiErrorMessage(e) }
    return
  }
  // Members decide roles only; a failed read means "unknown" — roles untouched.
  const anggota = await useApi()<Envelope<ModulMember[]>>('/account/modules/marketing/members').then(r => r.data ?? []).catch(() => null)
  const cats = st.value.categories.length ? st.value.categories : [...DIVISI_MKT, ...(st.value.taskCategories as { name?: string }[]).map(c => String(c?.name ?? c ?? ''))]
  const r = rencanaSinkronMkt(st.value.users, semua, anggota, cats, namaRoleMkt)
  let gagal = 0
  let galat = ''
  let baru = 0
  let ubah = 0
  for (const u of r.baru) {
    try {
      await buatMkt<UserMkt>('users', u)
      baru++
    }
    catch (e) {
      gagal++
      galat ||= apiErrorMessage(e)
    }
  }
  for (const u of r.ubah) {
    try {
      await tambalMkt<UserMkt>('users', u.id, u.fields, u.versi)
      ubah++
    }
    catch (e) {
      gagal++
      galat ||= apiErrorMessage(e)
    }
  }
  if (baru + ubah > 0) {
    await logDenganCobaLagi(() => logMkt('user', '-', 'Data pegawai disinkronkan dari Office', `${baru} baru · ${ubah} diperbarui`))
    if (r.roleBerubah.length) await logDenganCobaLagi(() => logMkt('user', '-', 'Role menyesuaikan Tim di Office', r.roleBerubah.join(' · ')))
    await refreshNuxtData('marketing-state')
  }
  const pesan: string[] = []
  if (r.roleBerubah.length) pesan.push(`${r.roleBerubah.length} role disesuaikan dengan Tim di Office.`)
  if (r.tanpaDiv) pesan.push(`${r.tanpaDiv} orang belum punya Tim di Office — role mereka jatuh ke bawaan sampai kolom Tim-nya diisi di sana.`)
  if (gagal) pesan.push(`${gagal} perubahan belum tersimpan: ${galat}`)
  sinkron.value = { status: 'ok', at: Date.now(), baru, ubah, pesan: pesan.join(' '), tertahan: gagal }
}
// Run when the page opens, once the module state is in — unless a fresh one already ran.
const { status: statusSt } = useStateMkt()
let sudahPicu = false
watch(statusSt, (s) => {
  if (sudahPicu || s !== 'success') return
  sudahPicu = true
  const k = sinkron.value
  if (k.status === 'jalan') return
  if (k.status === 'gagal' || !k.at || Date.now() - k.at > BASI_MS) void sinkronkan()
}, { immediate: true })

// ---------------------------------------------------------------- list
const daftar = computed(() => st.value.users.filter(u => u?.name))
// First-load skeleton for the stat cards: while the user list is empty the
// grid shows placeholders; later refetches keep the old cards on screen.
const statMemuat = computed(() => !st.value.users.length && (statusSt.value === 'pending' || statusSt.value === 'idle'))
const KOL: KolomMkt<UserMkt>[] = [
  { k: 'nama', t: 'Nama', v: u => u.name, def: true },
  { k: 'tim', t: 'Tim', v: u => timUserMkt(u) },
  { k: 'hp', t: 'No. HP', v: u => u.hp ?? '' },
  { k: 'role', t: 'Role', v: u => namaRoleMkt(u.role) },
  { k: 'status', t: 'Status', v: u => (u.active === false ? 'Nonaktif' : 'Aktif') },
]
const tbl = useTabelMkt<UserMkt>('pegawai', KOL, () => String(daftar.value.length))
const halaman = computed(() => tbl.potong(tbl.susun([...daftar.value])))
const opsiRole = [{ value: '__none', label: 'Belum ada akses' }, ...Object.entries(ROLES_MKT).map(([k, v]) => ({ value: k, label: v.t }))]

async function ubahRole(u: UserMkt, v: string) {
  const role = v === '__none' ? '' : v
  if ((u.role ?? '') === role) return
  await mktSimpan(() => tambalMkt<UserMkt>('users', u.id, { role }, u.updatedAt), `${u.name} sekarang ${namaRoleMkt(role).toLowerCase()}`,
    { refType: 'user', refId: u.id, action: 'Role diubah', detail: `${namaRoleMkt(u.role)} → ${namaRoleMkt(role)}` })
}

// ---- edit phone
const edit = ref<{ open: boolean, u: UserMkt | null, hp: string }>({ open: false, u: null, hp: '' })
function bukaEdit(u: UserMkt) {
  edit.value = { open: true, u, hp: u.hp ?? '' }
}
async function simpanHp() {
  const u = edit.value.u
  if (!u) return
  if (!canEdit.value) {
    toast.add({ title: 'Akses ditolak', description: 'Kamu tidak punya izin mengubah data pegawai.', color: 'error' })
    return
  }
  const hp = edit.value.hp.trim()
  const ok = await mktSimpan(() => tambalMkt<UserMkt>('users', u.id, { hp }, u.updatedAt), `${u.name} diperbarui`,
    { refType: 'user', refId: u.id, action: 'No. HP pegawai diperbarui', detail: `${u.name} · ${hp || 'dikosongkan'}` })
  if (ok) edit.value.open = false
}

// ---- per-person access
const akses = ref<{ open: boolean, u: UserMkt | null, draft: Record<string, number> }>({ open: false, u: null, draft: {} })
function bukaAkses(u: UserMkt) {
  akses.value = { open: true, u, draft: { ...userAccMkt(u, st.value.roleAcc) } }
}
async function simpanAkses() {
  const u = akses.value.u
  if (!u) return
  const acc = simpanAksesUserMkt(akses.value.draft)
  const nLihat = Object.values(acc).filter(v => v >= 1).length
  const nUbah = Object.values(acc).filter(v => v >= 2).length
  const ok = await mktSimpan(() => tambalMkt<Record<string, unknown>>('users', u.id, { acc, nav: null, perms: null }, u.updatedAt),
    `Akses ${u.name} diperbarui`, { refType: 'user', refId: u.id, action: 'Hak akses diperbarui', detail: `${nLihat} menu terlihat · ${nUbah} boleh diubah` })
  if (ok) akses.value.open = false
}
async function resetAkses() {
  const u = akses.value.u
  if (!u) return
  const ok = await mktSimpan(() => tambalMkt<Record<string, unknown>>('users', u.id, { acc: null, nav: null, perms: null }, u.updatedAt),
    `Akses ${u.name} kembali ke default role`, { refType: 'user', refId: u.id, action: 'Hak akses direset', detail: `kembali ke default role ${namaRoleMkt(u.role)}` })
  if (ok) akses.value.open = false
}

// ---- role matrix
const ROLE_KEYS = Object.keys(ROLES_MKT)
const matriks = ref<Record<string, Record<string, number>>>({})
watch(() => st.value.roleAcc, (ra) => {
  matriks.value = Object.fromEntries(ROLE_KEYS.map(r => [r, { ...roleAccMkt(ra, r) }]))
}, { immediate: true, deep: true })
function putar(r: string, v: string) {
  const row = matriks.value[r]
  if (row) row[v] = putarLevelMkt(row[v] ?? 0)
}
async function simpanMatriks() {
  if (!canMU.value) {
    toast.add({ title: 'Akses ditolak', description: 'Kamu tidak punya izin kelola user.', color: 'error' })
    return
  }
  const baru = simpanMatriksMkt(matriks.value)
  await mktSimpan(() => tulisDokumenMkt('roleAcc', lama => ({ ...(lama as Record<string, unknown> ?? {}), ...baru })),
    'Matriks disimpan', { refType: 'user', refId: '-', action: 'Matriks hak akses role diperbarui' })
}
const warnaLevel = (v: number) => (v === 2 ? 'success' : v === 1 ? 'info' : 'neutral') as 'success' | 'info' | 'neutral'
</script>

<template>
  <AppPage
    title="Kelola akses"
    description="Satu daftar untuk semua orang: identitas pegawai otomatis mengikuti database user Office, dan di sini pula role & hak aksesnya diatur. Daftar ini jadi sumber pilihan PIC di Matriks PIC Hari-H, Template Task & papan to-do."
  >
    <MarketingGerbang layar="staff">
      <UAlert
        v-if="sinkron.status === 'jalan' || sinkron.status === 'diam'"
        color="neutral"
        variant="soft"
        icon="i-lucide-refresh-cw"
        class="mb-5"
        title="Menyinkronkan daftar pegawai dari Office…"
      />
      <UAlert
        v-else-if="sinkron.status === 'gagal'"
        color="error"
        variant="soft"
        icon="i-lucide-triangle-alert"
        class="mb-5"
        :title="`Office tidak bisa dihubungi${jamSinkron ? ` (${jamSinkron})` : ''}`"
        :description="`Daftar di bawah adalah data terakhir yang tersimpan, bukan yang terbaru. Sinkronisasi dicoba lagi otomatis saat halaman ini dibuka ulang. ${sinkron.pesan}`"
      />
      <UAlert
        v-else
        :color="sinkron.tertahan ? 'warning' : 'success'"
        variant="soft"
        :icon="sinkron.tertahan ? 'i-lucide-triangle-alert' : 'i-lucide-check'"
        class="mb-5"
        :title="sinkron.tertahan ? `Office terbaca${jamSinkron ? ` pukul ${jamSinkron}` : ''}, tapi sebagian perubahan belum tersimpan` : `Tersinkron otomatis dari database user Office${jamSinkron ? ` pukul ${jamSinkron}` : ''}`"
        :description="`${sinkron.baru || sinkron.ubah ? `${sinkron.baru} pegawai baru, ${sinkron.ubah} diperbarui.` : 'Tidak ada perubahan.'} ${sinkron.pesan}`"
      />

      <AppStatGrid
        :loading="statMemuat"
        :count="4"
      >
        <AppStat
          label="Total pegawai"
          :value="daftar.length"
          sub="dari database user Office"
          icon="i-lucide-users"
        />
        <AppStat
          label="Aktif"
          :value="daftar.filter(x => x.active !== false).length"
          sub="bisa dipilih jadi PIC"
          tone="success"
        />
        <AppStat
          label="Tim terisi"
          :value="daftar.filter(x => timUserMkt(x)).length"
          sub="sisanya kosong di Office"
          tone="info"
        />
        <AppStat
          label="No. HP terisi"
          :value="daftar.filter(x => x.hp).length"
          sub="dipakai reminder WhatsApp"
          tone="success"
        />
      </AppStatGrid>

      <AppPanel
        flush
        :count="daftar.length"
      >
        <div
          v-if="!daftar.length"
          class="p-8 text-center text-sm text-muted"
        >
          <b class="block text-highlighted">Belum ada pegawai</b>
          Daftar ini datang langsung dari database user Office dan tersegarkan sendiri. Kalau tetap kosong, berarti Office belum bisa dihubungi — lihat pita status di atas.
        </div>
        <template v-else>
          <UTable
            :data="halaman"
            :columns="[
              { id: 'nama', header: tbl.kepala('nama', 'Nama') },
              { id: 'tim', header: tbl.kepala('tim', 'Tim') },
              { id: 'hp', header: tbl.kepala('hp', 'No. HP') },
              { id: 'role', header: tbl.kepala('role', 'Role') },
              { id: 'status', header: tbl.kepala('status', 'Status') },
              { id: 'aksi', header: 'Aksi' },
            ]"
            class="hidden lg:block"
          >
            <template #nama-cell="{ row }">
              <div class="flex items-center gap-2">
                <UAvatar
                  :text="String(row.original.name || '?')[0]"
                  size="xs"
                />
                <b class="text-highlighted">{{ row.original.name }}</b>
              </div>
            </template>
            <template #tim-cell="{ row }">
              {{ timUserMkt(row.original) || '—' }}
            </template>
            <template #hp-cell="{ row }">
              <span class="num">{{ row.original.hp || '—' }}</span>
            </template>
            <template #role-cell="{ row }">
              <div class="flex items-center gap-1.5">
                <USelect
                  v-if="canMU"
                  :model-value="row.original.role || '__none'"
                  :items="opsiRole"
                  size="sm"
                  class="w-44"
                  @update:model-value="ubahRole(row.original, String($event))"
                />
                <span v-else>{{ namaRoleMkt(row.original.role) }}</span>
                <UBadge
                  v-if="aksesKhususMkt(row.original)"
                  label="custom"
                  color="neutral"
                  variant="soft"
                  class="text-vip"
                />
              </div>
            </template>
            <template #status-cell="{ row }">
              <AppStatus
                :color="row.original.active === false ? 'neutral' : 'success'"
              >
                {{ row.original.active === false ? 'Nonaktif' : 'Aktif' }}
              </AppStatus>
            </template>
            <template #aksi-cell="{ row }">
              <div class="flex gap-1.5">
                <UButton
                  v-if="canEdit"
                  icon="i-lucide-pencil"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  title="Ubah No. HP"
                  @click="bukaEdit(row.original)"
                />
                <UButton
                  v-if="canMU"
                  icon="i-lucide-shield-check"
                  label="Hak akses"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  @click="bukaAkses(row.original)"
                />
                <span
                  v-if="!canEdit && !canMU"
                  class="text-dimmed"
                >—</span>
              </div>
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="u in halaman"
              :key="u.id"
              class="space-y-2 p-4"
            >
              <div class="flex items-center gap-2">
                <UAvatar
                  :text="String(u.name || '?')[0]"
                  size="xs"
                />
                <b class="min-w-0 flex-1 truncate text-highlighted">{{ u.name }}</b>
                <AppStatus
                  :color="u.active === false ? 'neutral' : 'success'"
                >
                  {{ u.active === false ? 'Nonaktif' : 'Aktif' }}
                </AppStatus>
              </div>
              <p class="text-xs text-muted">
                {{ timUserMkt(u) || 'Tim belum diisi' }} · <span class="num">{{ u.hp || 'tanpa No. HP' }}</span>
                <template v-if="aksesKhususMkt(u)">
                  · akses custom
                </template>
              </p>
              <div class="flex flex-wrap items-center gap-1.5">
                <USelect
                  v-if="canMU"
                  :model-value="u.role || '__none'"
                  :items="opsiRole"
                  size="sm"
                  class="w-44"
                  @update:model-value="ubahRole(u, String($event))"
                />
                <span
                  v-else
                  class="text-sm"
                >{{ namaRoleMkt(u.role) }}</span>
                <UButton
                  v-if="canEdit"
                  icon="i-lucide-pencil"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  title="Ubah No. HP"
                  @click="bukaEdit(u)"
                />
                <UButton
                  v-if="canMU"
                  icon="i-lucide-shield-check"
                  label="Hak akses"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  @click="bukaAkses(u)"
                />
              </div>
            </li>
          </ul>
          <MarketingPager
            v-model="tbl.hal.value"
            :total="daftar.length"
          />
        </template>
      </AppPanel>

      <UAlert
        color="neutral"
        variant="soft"
        icon="i-lucide-info"
        title="Semuanya mengikuti Office"
        description="Nama, status aktif, dan Tim datang dari Kelola User → kolom Tim / Keterangan — perbaiki di sana, perubahannya terbawa saat halaman ini dibuka berikutnya. Role diturunkan dari Tim itu, jadi memindahkan orang ke tim lain di Office otomatis mengubah rolenya di sini; admin modul Office tetap Super Admin."
      />

      <AppPanel
        title="Matriks hak akses per role"
        icon="i-lucide-grid-3x3"
        flush
      >
        <template #actions>
          <UButton
            v-if="canMU"
            icon="i-lucide-check"
            label="Simpan matriks"
            size="sm"
            loading-auto
            @click="simpanMatriks"
          />
        </template>
        <p class="px-4 pt-3 text-sm text-muted">
          Tak Terlihat / Lihat / Boleh Ubah per menu. Berlaku untuk semua user dengan role tersebut, kecuali yang punya hak akses <em>custom</em>. Klik sel untuk geser status.
        </p>
        <div class="overflow-x-auto">
          <table class="mt-3 w-full min-w-[44rem] text-sm">
            <thead class="bg-table-head text-xs font-bold uppercase tracking-wide text-table-head-text">
              <tr>
                <th class="sticky left-0 bg-table-head px-3 py-2 text-left">
                  Menu
                </th>
                <th
                  v-for="r in ROLE_KEYS"
                  :key="r"
                  class="px-2 py-2 text-center"
                >
                  {{ ROLES_MKT[r]!.t }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="v in VIEW_KEYS_MKT"
                :key="v"
              >
                <td class="sticky left-0 bg-default px-3 py-1.5 font-medium text-highlighted">
                  {{ JUDUL_VIEW_MKT[v] ?? v }}
                </td>
                <td
                  v-for="r in ROLE_KEYS"
                  :key="r"
                  class="px-2 py-1.5 text-center"
                >
                  <UButton
                    :label="LABEL_LEVEL_MKT[matriks[r]?.[v] ?? 0]"
                    :color="warnaLevel(matriks[r]?.[v] ?? 0)"
                    variant="soft"
                    size="xs"
                    class="min-w-16 justify-center"
                    :disabled="r === 'super_admin' || !canMU"
                    :title="r === 'super_admin' ? 'Super Admin selalu akses penuh' : !canMU ? 'Perlu izin kelola user untuk mengubah' : `${RAGAM_LEVEL_MKT[matriks[r]?.[v] ?? 0]} — klik untuk ubah`"
                    @click="putar(r, v)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="px-4 py-3 text-xs text-muted">
          Kolom <em>Super Admin</em> terkunci penuh — supaya tidak ada yang bisa terkunci dari sistem.
        </p>
      </AppPanel>

      <ResponsiveSheet
        v-model:open="edit.open"
        title="Edit pegawai"
        :description="`${edit.u?.name ?? ''} · dari database user Office`"
      >
        <UFormField label="No. HP">
          <UInput
            v-model="edit.hp"
            inputmode="tel"
            class="w-full"
          />
        </UFormField>
        <p class="mt-3 text-xs text-muted">
          <b>Tim: {{ timUserMkt(edit.u) || 'belum diisi' }}</b> — diambil dari Office → Kelola User, kolom Tim / Keterangan, dan role orang ini diturunkan dari sana.
          Tim, nama, dan status aktif memang tidak bisa diubah dari sini: apa pun yang diketik akan diputar balik oleh sinkronisasi berikutnya. No. HP pun tertimpa kalau Office punya nomor untuk orang ini.
        </p>
        <template #footer>
          <UButton
            color="neutral"
            variant="outline"
            label="Batal"
            @click="edit.open = false"
          />
          <UButton
            label="Simpan"
            loading-auto
            @click="simpanHp"
          />
        </template>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="akses.open"
        :title="`Hak akses · ${akses.u?.name ?? ''}`"
        :description="namaRoleMkt(akses.u?.role)"
      >
        <UAlert
          v-if="akses.u?.role === 'super_admin'"
          color="neutral"
          variant="soft"
          title="Super Admin selalu punya akses penuh dan tidak bisa dibatasi — supaya tidak ada yang terkunci dari sistem."
          class="mb-3"
        />
        <ul class="divide-y divide-default rounded-panel border border-default">
          <li
            v-for="v in VIEW_KEYS_MKT"
            :key="v"
            class="flex items-center justify-between gap-2 px-3 py-1.5 text-sm"
          >
            <span class="text-highlighted">{{ JUDUL_VIEW_MKT[v] ?? v }}</span>
            <UButton
              :label="LABEL_LEVEL_MKT[akses.u?.role === 'super_admin' ? 2 : (akses.draft[v] ?? 0)]"
              :color="warnaLevel(akses.u?.role === 'super_admin' ? 2 : (akses.draft[v] ?? 0))"
              variant="soft"
              size="xs"
              class="min-w-16 justify-center"
              :disabled="akses.u?.role === 'super_admin'"
              @click="akses.draft[v] = putarLevelMkt(akses.draft[v] ?? 0)"
            />
          </li>
        </ul>
        <p class="mt-2 text-xs text-muted">
          Menentukan menu yang muncul di sidebar DAN apa yang boleh diubah untuk user ini. {{ angka(VIEW_KEYS_MKT.length) }} menu.
        </p>
        <template
          v-if="akses.u?.role !== 'super_admin'"
          #footer
        >
          <UButton
            color="neutral"
            variant="outline"
            label="Reset ke default role"
            loading-auto
            @click="resetAkses"
          />
          <UButton
            label="Simpan"
            loading-auto
            @click="simpanAkses"
          />
        </template>
      </ResponsiveSheet>
    </MarketingGerbang>
  </AppPage>
</template>
