<!--
  Hak Akses (deploy/dw/index.html viewAkses :8025-8168). Two panels, both
  admin-only:
    1. the page × role matrix a module admin may flip (stored as a DIFF, so a
       changed default rule still reaches an installed app, :1694);
       `akses` itself can never be loosened — whoever opens it can edit it;
    2. who is HRD — the list that decides who may approve, edit the talent
       pool and tick transfers. Admins always can; while the list is empty
       every module holder counts as HRD, so nobody locks themselves out
       (:1673).

  Heads come from Jadwal Shift (`GET /jadwal/heads`, T-11). A DW-only admin
  may lack module `jadwal`; the column then says so instead of failing (:2166).
-->
<script setup lang="ts">
import type { ModulMember } from '~/composables/useRoster'
import {
  AKSES_KOLOM_DW, bolehBukaBawaanDw, bolehBukaPeranDw, bolehSimpanSettingDw, HALAMAN_KUNCI_DW, versiSettingDw,
} from '~/utils/dw'
import { LAYAR_DW } from '~/utils/layar/dw'
import { simpanSettingDw, useDwDasar, useDwHeads, useDwSetting } from '~/composables/useDw'
import { isAdminOf } from '~/composables/useMe'
import { tanganiKonflik } from '~/utils/versi'
import type { Versi } from '~/utils/versi'

definePageMeta({ access: ['dw'] })

const toast = useToast()
const me = useMe()
const { peran, error, refresh } = useDwDasar()
/** The matrix comes from the versioned read (see pengaturan.vue). */
const { data: setting, status: statusSetting, error: errorSetting, refresh: muatSetting } = useDwSetting()
const set = computed(() => setting.value.blob)
/** The version the last save created — see pengaturan.vue. */
const versiRespon = useState<Versi | undefined>('dw-setting-versi', () => undefined)
/** The version we know is current: the last answer's, else the read's. */
const versi = computed(() => versiSettingDw(versiRespon.value, setting.value.version))
const pendingSetting = computed(() => statusSetting.value === 'pending')
const siap = computed(() => !pendingSetting.value)
const { data: members, status: membersStatus } = useModulMembers('dw')
const { peta: headsPeta, error: headsError, muat: muatHeads } = useDwHeads()
onMounted(() => {
  muatHeads()
})

const admin = computed(() => peran.value.admin || isAdminOf(me.value, 'dw'))
const halaman = computed(() => LAYAR_DW.map(l => ({ k: l.key, t: l.label })))
const diubah = computed(() => Object.keys(set.value.akses).length)

async function muatUlang() {
  versiRespon.value = undefined
  await muatSetting()
}

async function simpan(pesan: string) {
  const v = versi.value
  if (!bolehSimpanSettingDw(v)) {
    toast.add({ title: 'Hak akses belum punya versi', description: 'Muat ulang halamannya, lalu simpan lagi.', color: 'warning' })
    return
  }
  try {
    const r = await simpanSettingDw(set.value, v)
    // The next save sends the version the server just handed back; the matrix
    // stays as we sent it, so a click made during the save is not lost.
    versiRespon.value = r.data?.version ?? v
    // The sidebar reads the matrix from the overview, so it follows here too.
    await refresh()
    toast.add({ title: pesan, color: 'success' })
  }
  catch (e) {
    // 409 = someone else saved the matrix in between: reload and say so.
    if (!(await tanganiKonflik(e, muatUlang))) {
      toast.add({ title: `Gagal menyimpan: ${apiErrorMessage(e)}`, color: 'error' })
    }
  }
}

function boleh(k: string, peranK: string) {
  return bolehBukaPeranDw(set.value.akses, k, peranK)
}
function bawaan(k: string, peranK: string) {
  return bolehBukaBawaanDw(k, peranK)
}
const terkunci = (k: string) => HALAMAN_KUNCI_DW.includes(k)
const berbeda = (k: string, peranK: string) => boleh(k, peranK) !== bawaan(k, peranK)

function toggleAkses(k: string, peranK: string) {
  if (!admin.value) return toast.add({ title: 'Hanya admin modul yang bisa mengubah hak akses', color: 'error' })
  if (terkunci(k)) return toast.add({ title: 'Halaman Hak Akses tidak bisa dibagikan — yang bisa membukanya bisa mengubah seluruh matriks ini', color: 'error' })
  const nilai = !boleh(k, peranK)
  const baris: Record<string, number> = {}
  for (const key of Object.keys(set.value.akses[k] ?? {})) {
    if (key !== peranK) baris[key] = set.value.akses[k]![key]!
  }
  if (nilai !== bawaan(k, peranK)) baris[peranK] = nilai ? 1 : 0
  const akses: Record<string, Record<string, number>> = {}
  for (const key of Object.keys(set.value.akses)) {
    if (key !== k) akses[key] = set.value.akses[key]!
  }
  if (Object.keys(baris).length) akses[k] = baris
  set.value.akses = akses
  simpan(`Halaman ${LAYAR_DW.find(l => l.key === k)?.label ?? k} — ${AKSES_KOLOM_DW.find(c => c.k === peranK)?.t ?? peranK}: ${nilai ? 'boleh dibuka' : 'tidak terlihat'}`)
}

const resetOpen = ref(false)
async function resetAkses() {
  set.value.akses = {}
  resetOpen.value = false
  await simpan('Matriks dikembalikan ke bawaan')
}

// ---- HRD list
const daftar = computed<ModulMember[]>(() => (members.value ?? []).filter(u => u.active !== false).sort((a, b) => String(a.name).localeCompare(String(b.name))))
const hr = computed(() => set.value.hr.map(String))
const peranOrang = (u: ModulMember): string[] => {
  const out: string[] = []
  if (u.isModuleAdmin) out.push('Admin modul')
  if (hr.value.includes(String(u.id))) out.push('HRD')
  const dv = headsPeta.value[String(u.id)]
  if (Array.isArray(dv) && dv.length) out.push('Head divisi')
  if (!out.length) out.push('Staf')
  return out
}
const bolehPutus = (u: ModulMember) => u.isModuleAdmin || hr.value.includes(String(u.id)) || !hr.value.length
const sebabPutus = (u: ModulMember) => (u.isModuleAdmin ? 'admin modul' : hr.value.includes(String(u.id)) ? 'dicentang di sini' : !hr.value.length ? 'daftar masih kosong' : '')

function toggleHR(u: ModulMember) {
  if (!admin.value) return toast.add({ title: 'Hanya admin modul yang bisa mengubah hak akses', color: 'error' })
  const list = hr.value.slice()
  const i = list.indexOf(String(u.id))
  if (i > -1) list.splice(i, 1)
  else list.push(String(u.id))
  set.value.hr = list
  simpan(i > -1 ? `HRD ${u.name} dicabut` : `${u.name} jadi HRD`)
}
</script>

<template>
  <AppPage
    title="Hak akses"
    description="Siapa yang berhak memutuskan di modul ini."
  >
    <p
      v-if="error || errorSetting"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error ?? errorSetting) }}
    </p>

    <AppPanel
      v-if="!siap"
      title="Memuat hak akses…"
    >
      <!-- Loading rows mirror the access table below. -->
      <div class="space-y-2 py-2">
        <USkeleton
          v-for="i in 5"
          :key="i"
          class="h-10 w-full"
        />
      </div>
      <p class="py-2 text-center text-sm text-muted">
        Memuat…
      </p>
    </AppPanel>

    <AppPanel
      v-else-if="!admin"
      title="Halaman ini untuk admin modul"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Isinya daftar siapa yang menjadi HRD di modul ini — dan yang menentukannya bukan orang yang ada di dalam
        daftar itu.
      </p>
    </AppPanel>

    <template v-else>
      <AppPanel
        title="Siapa melihat halaman apa"
        icon="i-lucide-table"
        :count="diubah ? `${diubah} halaman diubah` : 'semua bawaan'"
      >
        <p class="mb-2 text-sm text-muted">
          Dibaca menurun: tiap baris satu menu di sidebar. <b>✓</b> berarti menunya muncul, titik berarti menunya
          tidak ada sama sekali. <b>Klik selnya untuk membalik.</b> Titik kecil <span class="font-bold">•</span>
          menandai sel yang sudah diubah dari aturan bawaan modul. Peran bisa bertumpuk — head divisi yang juga
          dicentang HRD mendapat gabungan keduanya.
        </p>
        <p class="mb-3 rounded-field bg-info/10 px-3 py-2 text-sm">
          Yang diatur di sini <b>hanya halaman mana yang terlihat</b>. Siapa yang boleh <b>memutuskan</b> (menyetujui,
          menyunting talent pool, menandai transfer) tetap ditentukan daftar HRD di bawah, dan tetap diperiksa ulang
          oleh server. Sebaliknya, membuka <b>Pembayaran</b> atau <b>Rekap Pegawai</b> berarti angka upah ikut
          terlihat.
        </p>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[40rem] text-sm">
            <thead>
              <tr>
                <th class="py-2 text-start text-[11px] font-bold uppercase tracking-wider text-muted">
                  Halaman
                </th>
                <th
                  v-for="c in AKSES_KOLOM_DW"
                  :key="c.k"
                  class="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-muted"
                >
                  {{ c.t }}
                  <span class="block text-[10px] font-medium normal-case">{{ c.ket }}</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="h in halaman"
                :key="h.k"
              >
                <td class="py-2 font-semibold">
                  {{ h.t }}
                  <span
                    v-if="terkunci(h.k)"
                    class="block text-[11px] font-medium text-muted"
                  >terkunci — admin modul saja</span>
                </td>
                <td
                  v-for="c in AKSES_KOLOM_DW"
                  :key="c.k"
                  class="px-2 py-2 text-center"
                >
                  <button
                    v-if="!terkunci(h.k)"
                    type="button"
                    class="min-h-8 min-w-8 rounded-field border border-default font-bold"
                    :class="boleh(h.k, c.k) ? 'bg-success/12 text-success' : 'bg-muted text-dimmed'"
                    :title="`${h.t} — ${c.t}: ${boleh(h.k, c.k) ? 'boleh dibuka' : 'tidak terlihat'}${berbeda(h.k, c.k) ? ' (diubah dari bawaan)' : ''} — klik untuk membalik`"
                    @click="toggleAkses(h.k, c.k)"
                  >
                    {{ boleh(h.k, c.k) ? '✓' : '·' }}<span
                      v-if="berbeda(h.k, c.k)"
                      class="text-primary-700"
                    >•</span>
                  </button>
                  <span
                    v-else
                    class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-field border border-default font-bold"
                    :class="boleh(h.k, c.k) ? 'bg-success/12 text-success' : 'bg-muted text-dimmed'"
                    :title="`${h.t} — ${c.t}: tidak bisa diubah`"
                  >{{ boleh(h.k, c.k) ? '✓' : '·' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <UButton
            v-if="diubah"
            label="Kembalikan ke bawaan"
            color="neutral"
            variant="outline"
            size="sm"
            @click="resetOpen = true"
          />
          <span
            v-else
            class="text-sm text-muted"
          >Semua masih bawaan aturan modul.</span>
        </div>
      </AppPanel>

      <AppPanel
        title="Siapa yang boleh memutuskan"
        icon="i-lucide-shield-check"
        :count="hr.length ? `${hr.length} orang dicentang HRD` : 'belum disetel'"
      >
        <p class="mb-2 text-sm text-muted">
          Yang berhak boleh <b>menyetujui & menolak</b> permintaan dan pengajuan, <b>menyunting talent pool</b>, dan
          <b>menandai transfer</b>. Daftarnya hanya memuat orang yang sudah punya akses modul
          <b>Roster · Daily Worker</b> di Office.
        </p>
        <p
          v-if="!hr.length"
          class="mb-3 rounded-field bg-warning/12 px-3 py-2 text-sm"
        >
          <b>Daftarnya masih kosong</b>, jadi untuk sementara <b>semua anggota modul ini dianggap berhak</b> —
          supaya tidak ada yang mendadak terkunci di luar. Tekan <b>Jadikan HRD</b> pada minimal satu orang untuk
          mulai membatasi.
        </p>
        <p
          v-if="headsError"
          class="mb-3 rounded-field bg-warning/12 px-3 py-2 text-sm"
        >
          Kolom head divisi kosong — {{ headsError }}.
        </p>

        <div
          v-if="membersStatus === 'pending' && !daftar.length"
          class="space-y-2"
        >
          <!-- Loading rows mirror the member table below. -->
          <USkeleton
            v-for="i in 4"
            :key="i"
            class="h-10 w-full"
          />
          <p class="pt-1 text-sm text-muted">
            Mengambil daftar anggota modul…
          </p>
        </div>
        <div
          v-else
          class="overflow-x-auto"
        >
          <table class="w-full min-w-[42rem] text-sm">
            <thead>
              <tr>
                <th class="w-10 py-2 text-start text-[11px] font-bold uppercase tracking-wider text-muted">
                  No.
                </th>
                <th class="py-2 text-start text-[11px] font-bold uppercase tracking-wider text-muted">
                  Nama
                </th>
                <th class="py-2 text-start text-[11px] font-bold uppercase tracking-wider text-muted">
                  Tim di Office
                </th>
                <th class="py-2 text-start text-[11px] font-bold uppercase tracking-wider text-muted">
                  Peran di modul ini
                </th>
                <th class="py-2 text-start text-[11px] font-bold uppercase tracking-wider text-muted">
                  Boleh memutuskan?
                </th>
                <th class="py-2" />
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="(u, i) in daftar"
                :key="u.id"
              >
                <td class="py-2 text-muted num">
                  {{ i + 1 }}
                </td>
                <td class="py-2">
                  <p class="font-semibold text-highlighted">
                    {{ u.name }}
                  </p>
                  <p
                    v-if="headsPeta[u.id]?.length"
                    class="text-[12px] text-muted"
                  >
                    head {{ headsPeta[u.id]!.join(', ') }}
                  </p>
                </td>
                <td class="py-2 text-[13px] text-muted">
                  {{ u.keterangan || '—' }}
                </td>
                <td class="py-2">
                  <span
                    v-for="p in peranOrang(u)"
                    :key="p"
                    class="me-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted"
                  >{{ p }}</span>
                </td>
                <td class="py-2">
                  <b :class="bolehPutus(u) ? 'text-success' : 'text-muted'">{{ bolehPutus(u) ? 'Ya' : 'Tidak' }}</b>
                  <p
                    v-if="sebabPutus(u)"
                    class="text-[12px] text-muted"
                  >
                    {{ sebabPutus(u) }}
                  </p>
                </td>
                <td class="py-2 text-end">
                  <span
                    v-if="u.isModuleAdmin"
                    class="text-[12px] text-muted"
                  >selalu berhak</span>
                  <UButton
                    v-else
                    :label="hr.includes(String(u.id)) ? 'Cabut' : 'Jadikan HRD'"
                    :color="hr.includes(String(u.id)) ? 'error' : 'primary'"
                    :variant="hr.includes(String(u.id)) ? 'ghost' : 'solid'"
                    size="xs"
                    @click="toggleHR(u)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AppPanel>
    </template>

    <ResponsiveSheet
      v-model:open="resetOpen"
      title="Kembalikan matriks ke aturan bawaan?"
    >
      <p class="text-sm">
        Seluruh sel yang pernah diubah kembali ke aturan asli modul. Daftar HRD di bawah tidak ikut berubah.
      </p>
      <template #footer>
        <UButton
          label="Kembalikan ke bawaan"
          @click="resetAkses"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="resetOpen = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
