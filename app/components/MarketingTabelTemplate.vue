<!--
  One group of template items (tmplTable, deploy/marketing/index.html:12703):
  Task, PIC, H-, Deadline, Catatan + edit/delete. Table on lg+, cards below.
  An empty group says so and offers "Tambah item" right there.
-->
<script setup lang="ts">
import type { TemplateTugasMkt } from '~/utils/marketing-tugas'

defineProps<{ items: TemplateTugasMkt[], bisaUbah: boolean, tgl: (d?: string) => string }>()
const emit = defineEmits<{ ubah: [t: TemplateTugasMkt], hapus: [t: TemplateTugasMkt], tambah: [] }>()
</script>

<template>
  <div
    v-if="!items.length"
    class="flex flex-wrap items-center gap-2 px-4 py-3 text-sm text-muted"
  >
    Belum ada item.
    <UButton
      v-if="bisaUbah"
      icon="i-lucide-plus"
      label="Tambah item"
      size="xs"
      color="neutral"
      variant="outline"
      @click="emit('tambah')"
    />
  </div>
  <template v-else>
    <table class="hidden w-full text-sm lg:table">
      <thead>
        <tr class="border-b border-default text-start text-xs text-muted">
          <th class="px-4 py-2 text-start font-semibold">
            Task
          </th>
          <th class="px-2 py-2 text-start font-semibold">
            PIC
          </th>
          <th class="px-2 py-2 text-start font-semibold">
            H-
          </th>
          <th class="px-2 py-2 text-start font-semibold">
            Deadline
          </th>
          <th class="px-2 py-2 text-start font-semibold">
            Catatan
          </th>
          <th
            v-if="bisaUbah"
            class="w-20"
          />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="t in items"
          :key="t.id"
          class="border-b border-default last:border-b-0"
        >
          <td class="px-4 py-2 font-semibold text-highlighted">
            {{ t.task }}
          </td>
          <td class="px-2 py-2">
            {{ t.pic || '—' }}
          </td>
          <td class="px-2 py-2">
            <UBadge
              v-if="t.hminus != null"
              :label="`H-${t.hminus}`"
              color="info"
              variant="soft"
              size="sm"
            />
            <span v-else>—</span>
          </td>
          <td class="num px-2 py-2">
            {{ t.deadline ? tgl(t.deadline) : '—' }}
          </td>
          <td class="px-2 py-2 text-xs text-muted">
            {{ t.note }}
          </td>
          <td
            v-if="bisaUbah"
            class="px-2 py-2"
          >
            <div class="flex justify-end gap-1">
              <UButton
                icon="i-lucide-pencil"
                size="xs"
                color="neutral"
                variant="ghost"
                aria-label="Edit template task"
                @click="emit('ubah', t)"
              />
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                color="neutral"
                variant="ghost"
                aria-label="Hapus template task"
                @click="emit('hapus', t)"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <ul class="divide-y divide-default lg:hidden">
      <li
        v-for="t in items"
        :key="t.id"
        class="flex items-start gap-2 px-4 py-2.5"
      >
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-highlighted">
            {{ t.task }}
          </p>
          <p class="text-xs text-muted">
            {{ [t.pic, t.hminus != null ? `H-${t.hminus}` : '', t.deadline ? tgl(t.deadline) : ''].filter(Boolean).join(' · ') || '—' }}
          </p>
          <p
            v-if="t.note"
            class="text-xs text-muted"
          >
            {{ t.note }}
          </p>
        </div>
        <template v-if="bisaUbah">
          <UButton
            icon="i-lucide-pencil"
            size="xs"
            color="neutral"
            variant="ghost"
            aria-label="Edit template task"
            @click="emit('ubah', t)"
          />
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            color="neutral"
            variant="ghost"
            aria-label="Hapus template task"
            @click="emit('hapus', t)"
          />
        </template>
      </li>
    </ul>
  </template>
</template>
