<!--
  BD OS › Kru BD (old `vTim`, deploy/bd/index.html:4494-4631).

  The roster comes from Office. "Segarkan dari Office" (T-01) compares
  `GET /account/modules/bd/members` against the `people` rows and creates the
  missing ones — it NEVER deletes: a crew member whose access was revoked is
  flagged `tanpaAkses`, because deleting them would erase who did what. Only
  role/boss belong to BD OS; divisi follows the Office Tim column (read-only
  here, managed in Office › Kelola User) and is never cleared — a crew with no
  matching Tim keeps the old division, marked "divisi lama".
-->
<script setup lang="ts">
import type { BdPerson } from '~/composables/useBd'
import { bdSimpan, buatBd, hapusBd, tambalBd, useBdState, versiBaris } from '~/composables/useBd'
import { LABEL_TIM, cariAku, inisial, punyaPic, selesai, timDariKet, todayISO, uidBd } from '~/utils/bd-rumus'
import { useRoster } from '~/composables/useRoster'
import { divTone } from '~/utils/status-bd'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
import BdOrangSheet from '~/widgets/bd/BdOrangSheet.vue'

definePageMeta({ access: ['bd'] })

const me = useMe()
const toast = useToast()
const { data: state } = useBdState()
const { data: roster } = useRoster()
const modulMembers = useModulMembers('bd')
const people = computed(() => state.value.people)
const aku = computed(() => cariAku(people.value, me.value))

/** Office Tim of one crew (roster `keterangan`, officeUserId first then name). */
function timOf(p: BdPerson): string[] {
  const list = roster.value ?? []
  const m = list.find(x => p.officeUserId && String(x.id) === String(p.officeUserId))
    || list.find(x => String(x.name || '').trim().toLowerCase() === String(p.name || '').trim().toLowerCase())
  return timDariKet(m?.keterangan)
}
/** A division outside the Office Tim list is kept as-is and marked, never cleared. */
const divLama = (p: BdPerson) => {
  const d = String(p.div || '')
  return !!d && !LABEL_TIM.includes(d)
}

async function segarkan() {
  await modulMembers.refresh()
  const members = modulMembers.data.value || []
  if (!members.length) {
    toast.add({ title: 'Daftar kru kosong — pastikan pemegang akses modul bd sudah ada di Office.', color: 'error' })
    return
  }
  const aksi = async () => {
    const adaId = new Set(members.map(m => m.id))
    for (const m of members) {
      let p = people.value.find(x => x.officeUserId === m.id)
      if (!p) {
        const byName = people.value.find(x => !x.officeUserId && String(x.name || '').toLowerCase() === String(m.name || '').toLowerCase())
        if (byName) {
          await tambalBd<BdPerson>('people', byName.id, { officeUserId: m.id }, versiBaris(byName))
          p = { ...byName, officeUserId: m.id }
        }
      }
      if (!p) {
        await buatBd<BdPerson>('people', {
          id: uidBd('u'),
          officeUserId: m.id,
          name: m.name || '(tanpa nama)',
          ket: m.keterangan || '',
          role: '',
          div: '',
          boss: '',
          active: m.active !== false,
        })
      }
      else {
        const patch: Partial<BdPerson> = {}
        if (p.name !== m.name && m.name) patch.name = m.name
        const ket = m.keterangan || ''
        if (String(p.ket || '') !== ket) patch.ket = ket
        const aktif = m.active !== false
        if (!!p.active !== aktif) patch.active = aktif
        if (p.tanpaAkses) patch.tanpaAkses = false
        if (Object.keys(patch).length) await tambalBd<BdPerson>('people', p.id, patch, versiBaris(p))
      }
    }
    for (const p of people.value) {
      const punya = p.officeUserId && adaId.has(p.officeUserId)
      if (!punya && !p.tanpaAkses) await tambalBd<BdPerson>('people', p.id, { tanpaAkses: true }, versiBaris(p))
    }
  }
  await bdSimpan(aksi, 'Daftar kru disegarkan dari Office')
}

interface Baris { p: BdPerson, level: number, yatim: boolean }
const baris = computed<Baris[]>(() => {
  const byBoss: Record<string, BdPerson[]> = {}
  people.value.forEach((p) => {
    const k = p.boss || ''
    byBoss[k] = [...(byBoss[k] || []), p]
  })
  const out: Baris[] = []
  const gambar = (bossId: string, level: number) => {
    (byBoss[bossId] || []).forEach((p) => {
      out.push({ p, level, yatim: false })
      gambar(p.id, level + 1)
    })
  }
  gambar('', 0)
  people.value.forEach((p) => {
    if (!out.some(b => b.p.id === p.id)) out.push({ p, level: 0, yatim: true })
  })
  return out
})

const nAktif = (id: string) => state.value.tasks.filter(t => punyaPic(t, id) && !selesai(t)).length
const nLewat = (id: string) => state.value.tasks.filter(t => punyaPic(t, id) && !selesai(t) && !!t.deadline && t.deadline < todayISO()).length
const namaAtasan = (p: BdPerson) => (p.boss ? people.value.find(x => x.id === p.boss)?.name || '' : '')

const bukaOrang = ref(false)
const orangPilih = ref<BdPerson | null>(null)
function buka(p: BdPerson) {
  orangPilih.value = p
  bukaOrang.value = true
}

const orangHapus = ref<BdPerson | null>(null)
const hapusMau = computed({
  get: () => !!orangHapus.value,
  set: (v) => {
    if (!v) orangHapus.value = null
  },
})
function cobaHapus(p: BdPerson) {
  const dipakai = state.value.tasks.filter(t => punyaPic(t, p.id)).length
    + state.value.projects.filter(x => punyaPic(x, p.id)).length
    + state.value.po.filter(x => x.pic === p.id).length
    + state.value.routines.filter(x => x.pic === p.id).length
  if (dipakai) {
    toast.add({ title: `Tidak bisa dihapus — masih tercatat sebagai PIC di ${dipakai} baris.`, color: 'error' })
    return
  }
  orangHapus.value = p
}
async function hapus() {
  const p = orangHapus.value
  if (!p) return
  orangHapus.value = null
  const aksi = async () => {
    await hapusBd('people', p.id, versiBaris(p))
    for (const x of people.value.filter(y => y.boss === p.id)) await tambalBd<BdPerson>('people', x.id, { boss: '' }, versiBaris(x))
  }
  await bdSimpan(aksi, 'Kru dihapus dari daftar BD')
}
</script>

<template>
  <AppPage
    title="Kru BD"
    description="Siapa mengerjakan apa, dan siapa atasannya."
  >
    <template #actions>
      <UButton
        label="Segarkan dari Office"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        @click="segarkan"
      />
    </template>

    <p class="mb-5 rounded-xl border border-info/30 bg-info/10 p-3 text-sm">
      Daftar ini datang dari <b>database account</b> — isinya persis pemegang hak akses modul <b>bd</b>.
      Menambah/menghapus orang dilakukan di <b>Kelola Akses</b> di Office, bukan di sini. Divisi kru mengikuti
      kolom Tim di <b>Office › Kelola User</b> dan hanya bisa dibaca di sini — tidak bisa dikosongkan dari
      halaman ini. Yang diatur di sini hanya <b>jabatan dan atasan</b>, karena atasanlah yang menentukan
      siapa melihat task siapa.
    </p>

    <AppPanel v-if="!people.length">
      <p class="py-6 text-center text-sm text-muted">
        <b class="block text-highlighted">Belum ada kru dengan akses modul ini</b>
        Beri akses modul <code>bd</code> lewat Kelola Akses di Office, lalu tekan Segarkan.
      </p>
    </AppPanel>

    <template v-else>
      <div class="grid gap-3 lg:hidden">
        <div
          v-for="b in baris"
          :key="b.p.id"
          class="rounded-panel border border-default bg-default px-4 py-3.5 shadow-panel lg:px-5"
          :style="{ marginInlineStart: `${b.level * 14}px` }"
        >
          <div class="flex items-start justify-between gap-2">
            <button
              type="button"
              class="min-w-0 flex-1 text-start"
              @click="buka(b.p)"
            >
              <span class="flex items-center gap-2 font-semibold text-highlighted">
                <span class="flex size-6 items-center justify-center rounded-full bg-yellow-light text-[10px] font-bold text-yellow-dark">{{ inisial(b.p.name) }}</span>
                {{ b.p.name }}
                <AppStatus
                  v-if="aku?.id === b.p.id"
                  color="gold"
                  size="sm"
                >kamu</AppStatus>
              </span>
              <span class="mt-1 block text-xs text-muted">
                {{ b.p.role || '—' }} · {{ b.p.div || 'belum diatur' }}
                <span
                  v-if="divLama(b.p)"
                  class="font-semibold text-warning"
                  title="Divisi ini tidak ada di daftar Tim Office — dipertahankan, sesuaikan lewat Kelola User"
                >· divisi lama</span>
              </span>
            </button>
            <AppStatus
              :color="b.p.tanpaAkses ? 'error' : b.p.active === false ? 'neutral' : 'success'"
              size="sm"
            >
              {{ b.p.tanpaAkses ? 'dicabut' : b.p.active === false ? 'nonaktif' : 'aktif' }}
            </AppStatus>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            <AppStatus size="sm">
              {{ nAktif(b.p.id) }} task aktif
            </AppStatus>
            <AppStatus
              v-if="nLewat(b.p.id)"
              color="error"
              size="sm"
            >
              {{ nLewat(b.p.id) }} lewat
            </AppStatus>
            <UButton
              v-if="b.p.tanpaAkses && !nAktif(b.p.id)"
              label="Hapus dari daftar"
              icon="i-lucide-trash-2"
              color="error"
              variant="soft"
              size="xs"
              @click="cobaHapus(b.p)"
            />
          </div>
        </div>
      </div>

      <AppPanel
        class="hidden lg:block"
        flush
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted text-muted">
              <tr>
                <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
                  Nama
                </th>
                <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
                  Jabatan
                </th>
                <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
                  Divisi
                </th>
                <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
                  Atasan
                </th>
                <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
                  Task aktif
                </th>
                <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
                  Akses
                </th>
                <th class="px-3 py-2" />
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="b in baris"
                :key="b.p.id"
                class="cursor-pointer hover:bg-elevated/50"
                @click="buka(b.p)"
              >
                <td
                  class="px-3 py-2"
                  :style="{ paddingInlineStart: `${13 + b.level * 18}px` }"
                >
                  <span class="flex items-center gap-2">
                    <span class="flex size-6 items-center justify-center rounded-full bg-yellow-light text-[10px] font-bold text-yellow-dark">{{ inisial(b.p.name) }}</span>
                    <span class="font-semibold text-highlighted">{{ b.p.name }}</span>
                    <AppStatus
                      v-if="aku?.id === b.p.id"
                      color="gold"
                      size="sm"
                    >kamu</AppStatus>
                  </span>
                </td>
                <td class="px-3 py-2 text-muted">
                  {{ b.p.role || '—' }}
                </td>
                <td class="px-3 py-2">
                  <AppStatus
                    v-if="b.p.div"
                    :color="divTone(b.p.div)"
                    size="sm"
                  >
                    {{ b.p.div }}
                  </AppStatus>
                  <span
                    v-else
                    class="text-muted"
                  >belum diatur</span>
                  <AppStatus
                    v-if="divLama(b.p)"
                    color="warning"
                    size="sm"
                    class="ms-1"
                    title="Divisi ini tidak ada di daftar Tim Office — dipertahankan, sesuaikan lewat Kelola User"
                  >
                    divisi lama
                  </AppStatus>
                </td>
                <td class="px-3 py-2 text-muted">
                  {{ b.p.boss ? namaAtasan(b.p) : (b.yatim ? '(atasan tidak ditemukan)' : '—') }}
                </td>
                <td class="px-3 py-2">
                  <span class="num">{{ nAktif(b.p.id) }}</span>
                  <AppStatus
                    v-if="nLewat(b.p.id)"
                    color="error"
                    size="sm"
                    class="ms-1"
                  >
                    {{ nLewat(b.p.id) }} lewat
                  </AppStatus>
                </td>
                <td class="px-3 py-2">
                  <AppStatus
                    :color="b.p.tanpaAkses ? 'error' : b.p.active === false ? 'neutral' : 'success'"
                    size="sm"
                  >
                    {{ b.p.tanpaAkses ? 'dicabut' : b.p.active === false ? 'nonaktif' : 'aktif' }}
                  </AppStatus>
                </td>
                <td class="px-3 py-2">
                  <div class="flex justify-end">
                    <UButton
                      v-if="b.p.tanpaAkses && !nAktif(b.p.id)"
                      icon="i-lucide-trash-2"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      aria-label="Hapus dari daftar"
                      @click.stop="cobaHapus(b.p)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AppPanel>
    </template>

    <BdOrangSheet
      v-model:open="bukaOrang"
      :orang="orangPilih"
      :people="people"
    />
    <BdKonfirmasi
      v-model:open="hapusMau"
      :title="`Hapus ${orangHapus?.name || 'kru'} dari daftar kru BD?`"
      description="Ini tidak mencabut apa pun di Office. Kalau akses modulnya diberikan lagi, barisnya akan muncul kembali saat disegarkan."
      @konfirmasi="hapus"
    />
  </AppPage>
</template>
