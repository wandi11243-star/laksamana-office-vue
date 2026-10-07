<!--
  Isi / lihat satu review (deploy/hr/index.html openReview :2002-2028). The
  viewer fills THEIR layer only (self/manager/hr/ceo) on a 1–10 scale; other
  layers are shown read-only. Saving replaces the one review row with the layer
  updated; a review is created the first time any layer writes.
-->
<script setup lang="ts">
import type { HrEmployee } from '~/utils/hr'
import { LABEL_LAPISAN, REVIEW_ASPECTS, divName, lapisanReview } from '~/utils/hr'
import { hrCreate, hrPostAudit, hrUpdate, useHrDasar } from '~/composables/useHr'
import { labelBulanJadwal } from '~/utils/jadwal'
import { hariIni } from '~/utils/format'

const props = defineProps<{ e: HrEmployee | null, mk: string }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { s, cu, refresh } = useHrDasar()
const sibuk = ref(false)
const komentar = ref('')
const nilai = ref<Record<string, string>>({})

const lapisan = computed(() => lapisanReview(cu.value, props.e))
const review = computed(() => (props.e ? s.value.reviews.find(r => r.empId === props.e!.id && r.month === props.mk) : null))
const lain = computed(() => {
  const rv = review.value
  if (!rv || !lapisan.value) return [] as { k: string, aspects: Record<string, number | string> }[]
  return ['self', 'manager', 'hr', 'ceo']
    .filter(x => x !== lapisan.value && rv.layers?.[x]?.aspects)
    .map(k => ({ k, aspects: rv.layers[k]!.aspects! }))
})

watch(open, (v) => {
  if (!v) return
  const cur = review.value?.layers?.[lapisan.value ?? ''] ?? { aspects: {}, comment: '' }
  const out: Record<string, string> = {}
  for (const a of REVIEW_ASPECTS) out[a] = cur.aspects?.[a] == null ? '' : String(cur.aspects[a])
  nilai.value = out
  komentar.value = cur.comment ?? ''
})

async function simpan() {
  if (!props.e || sibuk.value) return
  if (!lapisan.value) return toast.add({ title: 'Anda tidak punya akses menilai kru ini.', color: 'error' })
  const aspects: Record<string, number> = {}
  let ada = false
  for (const a of REVIEW_ASPECTS) {
    const v = String(nilai.value[a] ?? '').trim()
    if (v !== '') {
      aspects[a] = Math.max(1, Math.min(10, Number(v) || 1))
      ada = true
    }
  }
  if (!ada) return toast.add({ title: 'Isi minimal satu aspek.', color: 'error' })
  const layer = { aspects, comment: komentar.value, by: cu.value?.id ?? '', at: hariIni() }
  sibuk.value = true
  try {
    const rv = review.value
    if (rv) {
      await hrUpdate('reviews', rv.id, { ...rv, layers: { ...rv.layers, [lapisan.value]: layer } })
    }
    else {
      await hrCreate('reviews', { empId: props.e.id, month: props.mk, layers: { [lapisan.value]: layer } })
    }
    try {
      await hrPostAudit('REVIEW_SAVE', `${props.e.name} ${props.mk} [${lapisan.value}]`)
    }
    catch {
      // Audit is a bonus.
    }
    toast.add({ title: 'Review tersimpan', color: 'success' })
    open.value = false
    emit('saved')
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal menyimpan: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="e ? `Review ${e.name}, ${labelBulanJadwal(mk)}` : 'Review'"
  >
    <div
      v-if="e"
      class="space-y-3"
    >
      <p class="rounded-field bg-info/10 px-3 py-2 text-sm">
        Anda mengisi sebagai layer <b>{{ LABEL_LAPISAN[lapisan ?? ''] ?? '—' }}</b>. Skala 1–10.
      </p>

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div
          v-for="a in REVIEW_ASPECTS"
          :key="a"
          class="flex items-center justify-between gap-2 rounded-field border border-default px-3 py-1.5"
        >
          <span class="text-sm">{{ a }}</span>
          <UInput
            :model-value="nilai[a] ?? ''"
            type="number"
            min="1"
            max="10"
            class="w-20"
            @update:model-value="(v: string | number) => nilai[a] = String(v ?? '')"
          />
        </div>
      </div>

      <UFormField label="Komentar">
        <UTextarea
          v-model="komentar"
          :rows="3"
          class="w-full"
        />
      </UFormField>

      <div v-if="lain.length">
        <p class="mb-1 text-sm font-semibold text-highlighted">
          Penilaian layer lain
        </p>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr>
                <th class="py-1.5 text-start text-[11px] font-bold uppercase tracking-wider text-muted">
                  Aspek
                </th>
                <th
                  v-for="o in lain"
                  :key="o.k"
                  class="py-1.5 text-end text-[11px] font-bold uppercase tracking-wider text-muted"
                >
                  {{ LABEL_LAPISAN[o.k] }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="a in REVIEW_ASPECTS"
                :key="a"
              >
                <td class="py-1.5">
                  {{ a }}
                </td>
                <td
                  v-for="o in lain"
                  :key="o.k"
                  class="py-1.5 text-end num"
                >
                  {{ o.aspects[a] ?? '–' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p
        v-else
        class="text-sm text-muted"
      >
        {{ e.name }}, {{ divName(s, e.divId) }} — layer ini belum diisi siapa pun.
      </p>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Simpan review'"
        :loading="sibuk"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="ghost"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
</template>
