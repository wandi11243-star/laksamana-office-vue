<!--
  Task Management › Kelola Akses › Akses halaman (owner request, Nov 2026).

  One row per holder of the `bd` module (Office roster), one column per screen a
  BD admin may close. A tick = the screen is open for that person. Saved as the
  settings document `aksesHalaman` = {officeUserId: [closed screen keys]} — the
  menu hides closed screens and the route guard keeps their URLs closed.
  Dashboard always stays open; module admins always see everything.
-->
<script setup lang="ts">
import type { ModulMember } from '~/composables/useRoster'
import { LAYAR_DIATUR_BD, bdSimpan, putSetelan, useBdSettings, versiSetelan } from '~/composables/useBd'
import { LAYAR_BD } from '~/utils/layar/bd'

const props = defineProps<{ members: ModulMember[] }>()

const { data: setelan } = useBdSettings()
const simpanan = computed(() => (setelan.value?.data.aksesHalaman || {}) as Record<string, string[]>)

const KOLOM = LAYAR_DIATUR_BD.map(k => ({ key: k, label: LAYAR_BD.find(l => l.key === k)?.label ?? k }))

const orang = computed(() => [...props.members].sort((a, b) => String(a.name).localeCompare(String(b.name), 'id')))

/** Draft: closed keys per Office user id. Reset from the saved document whenever it changes. */
const draf = ref<Record<string, string[]>>({})
function isiDraf() {
  draf.value = Object.fromEntries(Object.entries(simpanan.value).map(([id, l]) => [id, [...(l || [])]]))
}
watch(simpanan, isiDraf, { immediate: true })

const tutup = (id: string) => draf.value[id] ?? []
const buka = (id: string, key: string) => !tutup(id).includes(key)
function atur(id: string, key: string, on: boolean) {
  const s = new Set(tutup(id))
  if (on) s.delete(key)
  else s.add(key)
  draf.value = { ...draf.value, [id]: [...s] }
}
function aturSemua(id: string, on: boolean) {
  draf.value = { ...draf.value, [id]: on ? [] : [...LAYAR_DIATUR_BD] }
}
const jumlahBuka = (id: string) => KOLOM.filter(k => buka(id, k.key)).length

/** Only rows with something closed are stored; an all-open person is simply absent. */
const nilaiSimpan = computed(() => Object.fromEntries(Object.entries(draf.value)
  .map(([id, l]) => [id, LAYAR_DIATUR_BD.filter(k => l.includes(k))] as const)
  .filter(([, l]) => l.length)))
const berubah = computed(() => JSON.stringify(nilaiSimpan.value) !== JSON.stringify(Object.fromEntries(
  Object.entries(simpanan.value).map(([id, l]) => [id, LAYAR_DIATUR_BD.filter(k => (l || []).includes(k))] as const).filter(([, l]) => l.length))))

function simpan() {
  return bdSimpan(() => putSetelan('aksesHalaman', nilaiSimpan.value, versiSetelan(setelan.value, 'aksesHalaman')), 'Akses halaman tersimpan')
}
</script>

<template>
  <AppPanel
    title="Akses halaman"
    icon="i-lucide-key-round"
    description="Centang = halaman terbuka untuk orang itu. Dashboard selalu terbuka; admin modul selalu melihat semua."
    flush
  >
    <template #actions>
      <UButton
        v-if="berubah"
        label="Batalkan"
        color="neutral"
        variant="ghost"
        size="sm"
        @click="isiDraf"
      />
      <UButton
        label="Simpan akses"
        icon="i-lucide-save"
        size="sm"
        :disabled="!berubah"
        loading-auto
        @click="simpan"
      />
    </template>

    <p
      v-if="!orang.length"
      class="px-4 py-8 text-center text-sm text-muted"
    >
      Belum ada pemegang akses modul Task Management.
    </p>

    <template v-else>
      <!-- Desktop: person × screen grid. -->
      <div class="hidden overflow-x-auto lg:block">
        <table class="w-full text-sm">
          <thead class="bg-muted text-muted">
            <tr class="text-[11px] font-semibold uppercase tracking-wide">
              <th class="sticky left-0 z-10 bg-muted py-3 ps-4 pe-3 text-start">
                Kru
              </th>
              <th
                v-for="k in KOLOM"
                :key="k.key"
                class="px-2 py-3 text-center"
              >
                {{ k.label }}
              </th>
              <th class="py-3 pe-4 text-end">
                Semua
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="m in orang"
              :key="m.id"
              class="transition-colors hover:bg-muted/60"
            >
              <td class="sticky left-0 z-10 bg-default py-3 ps-4 pe-3">
                <span class="block font-semibold text-highlighted">{{ m.name }}</span>
                <span class="text-xs text-muted">
                  {{ m.isModuleAdmin ? 'Admin — semua halaman' : `${jumlahBuka(m.id)} dari ${KOLOM.length} halaman` }}
                </span>
              </td>
              <td
                v-for="k in KOLOM"
                :key="k.key"
                class="px-2 py-3 text-center"
              >
                <UCheckbox
                  :model-value="m.isModuleAdmin || buka(m.id, k.key)"
                  :disabled="m.isModuleAdmin"
                  class="inline-flex"
                  :aria-label="`${k.label} untuk ${m.name}`"
                  @update:model-value="(v: boolean | 'indeterminate') => atur(m.id, k.key, v === true)"
                />
              </td>
              <td class="py-3 pe-4 text-end">
                <div
                  v-if="!m.isModuleAdmin"
                  class="inline-flex gap-1"
                >
                  <UButton
                    label="Buka"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    @click="aturSemua(m.id, true)"
                  />
                  <UButton
                    label="Tutup"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    @click="aturSemua(m.id, false)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Phone: one card per person, the screens as toggle chips. -->
      <div class="flex flex-col gap-3 p-3 lg:hidden">
        <div
          v-for="m in orang"
          :key="m.id"
          class="rounded-xl border border-default p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="min-w-0">
              <span class="block truncate font-semibold text-highlighted">{{ m.name }}</span>
              <span class="text-xs text-muted">
                {{ m.isModuleAdmin ? 'Admin — semua halaman' : `${jumlahBuka(m.id)} dari ${KOLOM.length} halaman` }}
              </span>
            </span>
            <UButton
              v-if="!m.isModuleAdmin"
              :label="jumlahBuka(m.id) === KOLOM.length ? 'Tutup semua' : 'Buka semua'"
              color="neutral"
              variant="outline"
              size="xs"
              @click="aturSemua(m.id, jumlahBuka(m.id) !== KOLOM.length)"
            />
          </div>
          <div
            v-if="!m.isModuleAdmin"
            class="mt-3 flex flex-wrap gap-1.5"
          >
            <button
              v-for="k in KOLOM"
              :key="k.key"
              type="button"
              class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors"
              :class="buka(m.id, k.key) ? 'border-gold bg-gold-soft text-gold-deep' : 'border-default bg-default text-dimmed line-through'"
              :aria-pressed="buka(m.id, k.key)"
              @click="atur(m.id, k.key, !buka(m.id, k.key))"
            >
              <UIcon
                :name="buka(m.id, k.key) ? 'i-lucide-check' : 'i-lucide-x'"
                class="size-3"
              />
              {{ k.label }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </AppPanel>
</template>
