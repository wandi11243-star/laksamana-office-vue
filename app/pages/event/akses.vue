<!--
  Hak Akses — people & roles plus the permission matrix
  (`event/index.html:5963-6073`).

  K-08 (owner decision): the matrix is NEVER persisted — the old backend kept only
  `entertainmentRules`/`role`/`layoutTemplates`, and v1 has no endpoint for
  it either. Changes apply in memory and reset on reload, exactly like the
  old client. Management may not lock itself out of this page (`:6066`).
-->
<script setup lang="ts">
import { useModulMembers } from '~/composables/useRoster'
import type { ModulMember } from '~/composables/useRoster'
import type { Me } from '~/composables/useMe'
import type { PeranEvent } from '~/utils/layar/event'
import { bolehUbahEvent, EMS_HALAMAN_LABEL, peranEvent, PERAN_EVENT, PERAN_LABEL_EVENT, setIzinEvent, useMatriksEvent } from '~/utils/layar/event'

definePageMeta({ access: ['event'] })

const me = useMe()
const toast = useToast()
const peran = computed(() => peranEvent(me.value))
const bolehUbah = computed(() => bolehUbahEvent('akses', peran.value))

/** Legacy `peranDariRoster` (`:4591`): a module admin is always Manajemen;
 *  everyone else goes through the same Tim-column mapping as yourself
 *  (`peranEvent`) — never a binary admin/non-admin split. */
const peranAnggota = (m: ModulMember): PeranEvent =>
  m.isModuleAdmin ? 'manajemen' : peranEvent({ keterangan: m.keterangan ?? '', adminModules: [] } as unknown as Me)

const { data: anggota, status } = useModulMembers('event')
const daftarAnggota = computed(() => [...(anggota.value ?? [])].sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''))))
const matriks = useMatriksEvent()

const OPSI_TINGKAT = [
  { value: 0, label: 'Tak Terlihat' },
  { value: 1, label: 'Lihat' },
  { value: 2, label: 'Boleh Ubah' },
] as { value: 0 | 1 | 2, label: string }[]

function setIzin(halaman: string, p: PeranEvent, tingkat: 0 | 1 | 2) {
  if (halaman === 'akses' && p === 'manajemen' && tingkat < 2) {
    toast.add({ title: 'Manajemen tidak boleh dikunci dari halaman ini.', color: 'error' })
    return
  }
  setIzinEvent(halaman, p, tingkat)
}
</script>

<template>
  <EventGerbang lihat="akses">
    <AppPage
      title="Hak akses"
      description="Siapa berperan apa, dan peran itu boleh membuka apa"
    >
      <AppPanel
        title="Orang & perannya"
        icon="i-lucide-users"
        flush
        class="mb-4"
      >
        <p class="px-4 pt-3 text-xs text-muted">
          Ditarik otomatis dari database user Office: isinya kru yang diberi akses modul Event. Perannya diturunkan dari kolom Tim / Keterangan di Office, dan admin modul Event selalu Manajemen — tidak ada lagi yang perlu diketik di sini. Kalau ada peran yang salah, yang dibetulkan adalah kolom Tim orang itu di Office → Kelola User.
        </p>
        <UTable
          :columns="[{ id: 'nama', header: 'Pengguna' }, { id: 'tim', header: 'Tim / keterangan' }, { id: 'status', header: 'Status' }, { id: 'peran', header: 'Peran EMS' }]"
          :data="daftarAnggota"
          :loading="status === 'pending'"
          class="hidden lg:block"
        >
          <template #nama-cell="{ row }">
            <b class="text-highlighted">{{ row.original.name }}</b><span
              v-if="row.original.id === me?.id"
              class="text-xs text-muted"
            > (kamu)</span>
          </template>
          <template #tim-cell="{ row }">
            {{ row.original.keterangan || '—' }}
          </template>
          <template #status-cell="{ row }">
            <AppStatus
              :color="row.original.active ? 'success' : 'neutral'"
              :icon="row.original.active ? 'i-lucide-check' : 'i-lucide-pause'"
              size="sm"
            >
              {{ row.original.active ? 'Aktif' : 'Nonaktif' }}
            </AppStatus>
          </template>
          <template #peran-cell="{ row }">
            {{ PERAN_LABEL_EVENT[peranAnggota(row.original)] }}{{ row.original.isModuleAdmin ? ' (admin modul)' : '' }}
          </template>
        </UTable>
        <ul class="divide-y divide-default lg:hidden">
          <li
            v-for="m in daftarAnggota"
            :key="m.id"
            class="px-4 py-2.5 text-sm"
          >
            <b class="text-highlighted">{{ m.name }}</b><span
              v-if="m.id === me?.id"
              class="text-xs text-muted"
            > (kamu)</span>
            <span class="block text-xs text-muted">{{ PERAN_LABEL_EVENT[peranAnggota(m)] }}{{ m.isModuleAdmin ? ' (admin modul)' : '' }} · {{ m.keterangan || '—' }}</span>
          </li>
        </ul>
        <p class="px-4 pb-3 text-xs text-muted">
          Roster ditarik otomatis dari Office tiap kali halaman ini dibuka.
        </p>
      </AppPanel>

      <AppPanel
        title="Matriks izin"
        icon="i-lucide-shield"
        class="mb-4"
      >
        <p class="mb-3 text-xs text-muted">
          Halaman yang disetel Tak Terlihat hilang dari menu dan ditolak kalau alamatnya diketik langsung.
        </p>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[560px] text-sm">
            <thead>
              <tr class="border-b border-default text-left text-[11px] font-bold uppercase tracking-wide text-muted">
                <th class="py-2 pe-3">
                  Halaman
                </th>
                <th
                  v-for="p in PERAN_EVENT"
                  :key="p"
                  class="px-2 py-2"
                >
                  {{ PERAN_LABEL_EVENT[p] }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(label, halaman) in EMS_HALAMAN_LABEL"
                :key="halaman"
                class="border-b border-default last:border-0"
              >
                <td class="py-1.5 pe-3 font-medium text-highlighted">
                  {{ label }}
                </td>
                <td
                  v-for="p in PERAN_EVENT"
                  :key="p"
                  class="px-2 py-1.5"
                >
                  <span class="inline-flex overflow-hidden rounded-field border border-default text-[11px] font-semibold">
                    <button
                      v-for="o in OPSI_TINGKAT"
                      :key="o.value"
                      type="button"
                      class="whitespace-nowrap px-2 py-1 transition-colors disabled:cursor-not-allowed"
                      :class="(matriks[halaman]?.[p] ?? 1) === o.value ? 'bg-primary-500 text-white' : 'text-muted hover:bg-muted'"
                      :disabled="!bolehUbah"
                      @click="setIzin(halaman, p, o.value)"
                    >
                      {{ o.label }}
                    </button>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AppPanel>
    </AppPage>
  </EventGerbang>
</template>
