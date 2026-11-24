<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import BdProjectGroup from '~/widgets/bd/BdProjectGroup.vue'

const props = defineProps<{
  items: { value: string, label: string, color?: string }[]
}>()
const model = defineModel<string>({ required: true })
const emit = defineEmits<{ create: [nama: string] }>()
const root = useTemplateRef('root')
const searchInput = useTemplateRef('searchInput')
const expanded = ref(false)
const query = ref('')
const selectedIndex = ref(0)
const listId = useId()
const normalize = (s: string) => s.trim().toLocaleLowerCase('id')
const matches = computed(() => props.items.filter(i => normalize(i.label).includes(normalize(query.value))))
const newName = computed(() => query.value.trim())
const canCreate = computed(() => !!newName.value && newName.value.length <= 80
  && !props.items.some(i => normalize(i.value) === normalize(newName.value)))
const selected = computed(() => props.items.find(i => i.value === model.value))
const count = computed(() => matches.value.length + Number(canCreate.value))

function close(restoreFocus = false) {
  expanded.value = false
  if (restoreFocus) root.value?.querySelector('button')?.focus()
}
async function toggle() {
  if (expanded.value) return close()
  query.value = ''
  selectedIndex.value = 0
  expanded.value = true
  await nextTick()
  searchInput.value?.inputRef?.focus()
}
function choose(value: string) {
  model.value = value
  close(true)
}
function create() {
  emit('create', newName.value)
  close(true)
}
function keydown(e: KeyboardEvent) {
  if (!expanded.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    close(true)
  }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(0, Math.min(count.value - 1, selectedIndex.value + (e.key === 'ArrowDown' ? 1 : -1)))
    nextTick(() => root.value?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }))
  }
  else if (e.key === 'Enter') {
    e.preventDefault()
    const option = matches.value[selectedIndex.value]
    if (option) choose(option.value)
    else if (canCreate.value) create()
  }
}
watch(query, () => {
  selectedIndex.value = 0
})
onClickOutside(root, () => close())
</script>

<template>
  <div
    ref="root"
    @keydown="keydown"
  >
    <button
      type="button"
      class="flex min-h-10 w-full items-center justify-between gap-2 rounded-field border border-default bg-default px-3 py-2 text-start text-sm focus-visible:outline-2 focus-visible:outline-primary"
      aria-label="Pilih grup bisnis"
      aria-haspopup="listbox"
      :aria-expanded="expanded"
      :aria-controls="listId"
      @click="toggle"
    >
      <BdProjectGroup
        v-if="model"
        :nama="model"
        :warna="selected?.color"
      />
      <span
        v-else
        class="text-muted"
      >Tanpa grup bisnis</span>
      <UIcon
        :name="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        class="size-4 shrink-0 text-muted"
      />
    </button>
    <div
      v-if="expanded"
      class="mt-2 rounded-xl border border-default bg-muted p-2"
    >
      <UInput
        ref="searchInput"
        v-model="query"
        aria-label="Cari atau tambah grup bisnis"
        placeholder="Cari atau ketik grup baru"
        maxlength="80"
        class="mb-2 w-full"
      />
      <ul
        :id="listId"
        role="listbox"
        aria-label="Grup bisnis"
        class="max-h-48 space-y-1 overflow-y-auto overscroll-contain"
      >
        <li
          v-for="(item, index) in matches"
          :key="item.value"
          role="option"
          :aria-selected="model === item.value"
        >
          <button
            type="button"
            class="flex min-h-10 w-full items-center justify-between gap-2 rounded-field px-2 py-2 text-start text-sm hover:bg-default"
            :class="selectedIndex === index ? 'bg-default' : ''"
            :data-active="selectedIndex === index"
            @click="choose(item.value)"
          >
            <BdProjectGroup
              v-if="item.value"
              :nama="item.label"
              :warna="item.color"
            />
            <span v-else>{{ item.label }}</span>
            <UIcon
              v-if="model === item.value"
              name="i-lucide-check"
              class="size-4 shrink-0"
            />
          </button>
        </li>
        <li
          v-if="canCreate"
          role="option"
          :aria-selected="false"
        >
          <button
            type="button"
            class="min-h-10 w-full rounded-field px-2 py-2 text-start text-sm font-semibold text-primary hover:bg-default"
            :class="selectedIndex === matches.length ? 'bg-default' : ''"
            :data-active="selectedIndex === matches.length"
            @click="create"
          >
            Tambahkan "{{ newName }}"
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
