<!--
  A View/Edit permission matrix, shared by the Reservasi master screen and the
  Service Excellent peran screen. Rows are screens plus their EXTRA delete
  rows; columns are the panel's editable levels; Admin is always locked to
  Ubah. The caller owns the values (v-model) and the save; this only draws
  the table and cycles cells. Locked cells (e.g. an extra row whose parent
  page the role cannot see) render as text, never as buttons.
-->
<script setup lang="ts">
export interface BarisMatriks {
  key: string
  label: string
  ekstra: boolean
}

const props = withDefaults(defineProps<{
  modelValue: Record<string, Record<string, number>>
  baris: BarisMatriks[]
  roles: { key: string, label: string }[]
  bolehUbah?: boolean
  /** Cycle length per role (viewer in Reservasi stops at Lihat). */
  putaran?: (role: string) => number
  /** A cell that must not be pressed (extra row, hidden parent page). */
  terkunci?: (row: string, role: string) => boolean
}>(), {
  bolehUbah: true,
  putaran: () => 3,
  terkunci: () => false,
})

const emit = defineEmits<{
  'update:modelValue': [v: Record<string, Record<string, number>>]
}>()

const TEKS = ['Tak terlihat', 'Lihat', 'Ubah']

const tampil = (row: string, role: string): number => {
  const mentah = props.modelValue[row]?.[role]
  const n = typeof mentah === 'number' ? mentah : 1
  return Math.min(Math.max(0, n), props.putaran(role) - 1)
}

function geser(row: string, role: string) {
  if (!props.bolehUbah || props.terkunci(row, role)) return
  const next = { ...props.modelValue, [row]: { ...props.modelValue[row], [role]: (tampil(row, role) + 1) % props.putaran(role) } }
  emit('update:modelValue', next)
}
</script>

<template>
  <div>
    <p class="px-4 py-3.5 text-sm text-muted">
      Tak terlihat = hilang dari menu · Lihat = boleh buka, tombol ubah disembunyikan · Boleh ubah = penuh. <b>Admin</b> selalu penuh.
    </p>
    <div class="hidden overflow-x-auto lg:block">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default">
            <th class="px-4 py-3 text-start font-semibold">
              Halaman
            </th>
            <th
              v-for="r in roles"
              :key="r.key"
              class="px-3 py-3 text-start font-semibold"
            >
              {{ r.label }}
            </th>
            <th class="px-3 py-3 text-start font-semibold">
              Admin
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="b in baris"
            :key="b.key"
            class="border-b border-default"
          >
            <td class="px-4 py-3">
              {{ b.label }}
            </td>
            <td
              v-for="r in roles"
              :key="r.key"
              class="px-3 py-2"
            >
              <UButton
                v-if="!terkunci(b.key, r.key)"
                :label="TEKS[tampil(b.key, r.key)] ?? 'Lihat'"
                color="neutral"
                variant="ghost"
                size="xs"
                :disabled="!bolehUbah"
                :title="`${TEKS[tampil(b.key, r.key)]} — klik untuk ubah`"
                @click="geser(b.key, r.key)"
              />
              <span
                v-else
                class="text-xs text-dimmed"
              >Tak terlihat</span>
            </td>
            <td class="px-3 py-2">
              <AppStatus>Ubah</AppStatus>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="px-4 py-3.5 text-sm text-muted lg:hidden">
      Matriks butuh layar lebar — buka di desktop untuk mengubah hak akses.
    </p>
  </div>
</template>
