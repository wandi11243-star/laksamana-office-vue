<!--
  Reviewing one claim before verifying it (owner request, Nov 2026: easier to
  look at and to judge): what the guest claimed and what Google shows, side by
  side, with both proof photos underneath — everything needed to decide, in one
  place. The page does the writing; this sheet only asks.
-->
<script setup lang="ts">
import type { Review } from '~/composables/useServiceExcellent'
import { getFile } from '~/composables/useReservasi'
import { tglPendek } from '~/utils/format'

const props = defineProps<{
  rv: Review | undefined
  pencatat: string
  dipakai?: string
  bolehVerif: boolean
  bolehUbah: boolean
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ verifikasi: [], tolak: [], ubah: [] }>()

const foto = reactive<{ 1: string, 2: string, memuat: boolean, galat: string }>({ 1: '', 2: '', memuat: false, galat: '' })
let giliran = 0

watch(() => [open.value, props.rv?.id, props.rv?.proofData, props.rv?.proof2Data] as const, async () => {
  const saya = ++giliran
  Object.assign(foto, { 1: '', 2: '', memuat: false, galat: '' })
  const rv = props.rv
  if (!open.value || !rv) return
  const ambil = async (ref?: string) => {
    if (!ref) return ''
    return ref.startsWith('@f:') ? (await getFile(ref.replace(/^@f:/, ''))).data.data : ref
  }
  foto.memuat = true
  try {
    const [a, b] = await Promise.all([ambil(rv.proofData), ambil(rv.proof2Data)])
    if (saya === giliran) Object.assign(foto, { 1: a, 2: b })
  }
  catch (e) {
    if (saya === giliran) foto.galat = apiErrorMessage(e)
  }
  finally {
    if (saya === giliran) foto.memuat = false
  }
}, { immediate: true })

const rincian = computed<[string, string][]>(() => {
  const rv = props.rv
  if (!rv) return []
  return [
    ['Tamu', `${rv.name}${rv.phone ? ` · ${rv.phone}` : ''}`],
    ['Akun Google', rv.reviewerName || '—'],
    ['Tanggal review', rv.date ? tglPendek(rv.date) : '—'],
    ['Meja / bill', rv.tableNo || '—'],
    ['Pencatat', props.pencatat || '—'],
  ]
})
const adaBuktiPoin = computed(() => !!props.rv?.proof2Data)
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    title="Tinjau klaim review"
    :description="rv ? `${rv.name} · ${rv.reviewerName || 'tanpa akun'}` : ''"
    detail
  >
    <div
      v-if="rv"
      class="space-y-4"
    >
      <div class="grid gap-4 lg:grid-cols-2">
        <section class="rounded-xl border border-default p-4">
          <h3 class="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
            Yang diklaim
          </h3>
          <dl class="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
            <template
              v-for="[k, v] in rincian"
              :key="k"
            >
              <dt class="text-muted">
                {{ k }}
              </dt>
              <dd class="break-words font-semibold text-highlighted">
                {{ v }}
              </dd>
            </template>
          </dl>
        </section>
        <section class="rounded-xl border border-default p-4">
          <h3 class="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
            Temuan di Google
          </h3>
          <SeCekGoogle
            :rv="rv"
            :dipakai="dipakai"
            lengkap
          />
          <p
            v-if="!rv.googleCek"
            class="mt-2 text-sm text-muted"
          >
            Cocokkan sendiri di Google Business Profile.
          </p>
        </section>
      </div>

      <section>
        <h3 class="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
          Bukti
        </h3>
        <UAlert
          v-if="foto.galat"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="`Foto tidak terbaca: ${foto.galat}`"
        />
        <div
          v-else
          class="grid gap-3 sm:grid-cols-2"
        >
          <figure
            v-for="n in ([1, 2] as const)"
            :key="n"
            class="rounded-xl border border-default p-3"
          >
            <figcaption class="mb-2 text-sm font-semibold text-highlighted">
              {{ n === 1 ? '1. Screenshot review' : '2. Bukti poin bertambah' }}
            </figcaption>
            <USkeleton
              v-if="foto.memuat"
              class="h-48 w-full rounded-lg"
            />
            <img
              v-else-if="foto[n]"
              :src="foto[n]"
              :alt="n === 1 ? 'Screenshot review' : 'Bukti poin bertambah'"
              class="max-h-96 w-full rounded-lg bg-muted object-contain"
            >
            <p
              v-else
              class="grid h-32 place-items-center rounded-lg bg-muted text-sm text-muted"
            >
              Belum dilampirkan
            </p>
          </figure>
        </div>
      </section>

      <p
        v-if="bolehVerif"
        class="rounded-xl bg-muted p-3 text-sm text-muted"
      >
        <template v-if="!adaBuktiPoin">
          Belum bisa diverifikasi: foto 2 (bukti poin bertambah) belum dilampirkan. Minta pencatat melengkapinya lewat Ubah.
        </template>
        <template v-else>
          Hasil Cek Google hanya saran. Verifikasi hanya kalau review-nya benar-benar ada di Google.
        </template>
      </p>
    </div>

    <template #footer>
      <UButton
        v-if="bolehVerif"
        label="Verifikasi"
        icon="i-lucide-check"
        :disabled="!adaBuktiPoin"
        loading-auto
        @click="emit('verifikasi')"
      />
      <UButton
        v-if="bolehVerif"
        label="Tolak"
        icon="i-lucide-x"
        color="error"
        variant="soft"
        @click="emit('tolak')"
      />
      <UButton
        v-if="bolehUbah"
        label="Ubah"
        icon="i-lucide-pencil"
        color="neutral"
        variant="soft"
        @click="emit('ubah')"
      />
      <UButton
        label="Tutup"
        color="neutral"
        variant="ghost"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
</template>
