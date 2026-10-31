<!--
  Konten › Approval (old VIEWS.approval + approveFinal,
  deploy/konten/index.html:4307-4337; konten.md D.9).

  ONE approval: review the final result, then approve. "Approve final &
  jadwalkan" appends {stage 'Final Review', by, ok, at} and moves the item to
  Scheduled; "Tolak / revisi" opens the revision note (KontenRevisiSheet).
  Only who may edit the `approve` row of the matrix sees the buttons — the
  others read "Menunggu persetujuan dari Account Manager / Content Director."
-->
<script setup lang="ts">
import type { KontenItem } from '~/utils/konten'
import { contentDetail, contentPlatforms } from '~/utils/konten'
import { fTgl } from '~/utils/format'

definePageMeta({ access: ['konten'] })

const { data: st, error, status } = useStateKonten()
const { saya, can } = useAksesKonten()
const brand = useBrandKonten()

const list = computed(() => saringBrand(st.value.content, brand.value).filter(c => c.status === 'Approval'))
const bolehApprove = computed(() => can('approve'))

const namaBrand = (id?: string) => st.value.brands.find(b => b.id === id)?.name.split(' (')[0] ?? ''
const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? ''
const ringkas = (c: KontenItem) => {
  const d = contentDetail(c)
  return d.length > 140 ? `${d.slice(0, 140)}…` : d
}

const sibuk = ref('')
async function approve(c: KontenItem) {
  sibuk.value = c.id
  const approvals = [...(c.approvals ?? []), { stage: 'Final Review', by: saya.value?.user.id, ok: true, at: Date.now() }]
  const ok = await kontenSimpan(
    () => tambalKonten<KontenItem>('content', c.id, { approvals, status: 'Scheduled' }, c.updatedAt),
    'Konten disetujui & dijadwalkan',
    { action: 'approve final & jadwalkan', target: c.title },
  )
  sibuk.value = ''
  if (ok) notifKonten('approval', `Disetujui & dijadwalkan: ${c.title}`)
}

const revisiBuka = ref(false)
// by id, so the sheet always writes with the row's CURRENT version
const revisiId = ref('')
const revisiItem = computed(() => st.value.content.find(x => x.id === revisiId.value) ?? null)
function mintaRevisi(c: KontenItem) {
  revisiId.value = c.id
  revisiBuka.value = true
}
</script>

<template>
  <KontenGerbang lihat="approval">
    <AppPage
      title="Approval"
      :description="`${list.length} konten menunggu approval`"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
      />

      <KontenBrandBar :brands="st.brands" />

      <UAlert
        color="neutral"
        variant="subtle"
        icon="i-lucide-circle-check"
      >
        <template #description>
          Approval sekali — cukup review <b>hasil akhir/final</b> lalu setujui. Tidak ada approval bertahap.
          {{ bolehApprove ? 'Kamu punya wewenang approve.' : 'Hanya Account Manager & Content Director yang bisa approve. Kamu bisa memantau statusnya.' }}
        </template>
      </UAlert>

      <div
        v-if="status === 'pending' && !st.content.length"
        class="space-y-2 p-6"
      >
        <!-- Loading rows mirror the approval queue below. -->
        <USkeleton
          v-for="i in 4"
          :key="i"
          class="h-12 w-full"
        />
        <p class="pt-1 text-center text-sm text-muted">
          Memuat…
        </p>
      </div>
      <AppPanel v-else-if="!list.length">
        <div class="p-6 text-center">
          <UIcon
            name="i-lucide-circle-check"
            class="mx-auto size-7 text-dimmed"
          />
          <p class="mt-2 font-semibold">
            Tidak ada yang menunggu approval
          </p>
          <p class="text-sm text-muted">
            Semua konten sudah direview.
          </p>
        </div>
      </AppPanel>
      <div
        v-else
        class="grid gap-4 lg:grid-cols-2"
      >
        <AppPanel
          v-for="c in list"
          :key="c.id"
        >
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="text-xs text-muted">{{ namaBrand(c.brand) }}</span>
            <UBadge
              v-for="p in contentPlatforms(c).slice(0, 3)"
              :key="p"
              :label="p"
              color="neutral"
              variant="soft"
              size="sm"
            />
            <AppStatus
              class="ms-auto"
              color="vip"
              icon="i-lucide-hourglass"
              size="sm"
            >
              Menunggu approval
            </AppStatus>
          </div>
          <NuxtLink
            :to="`/konten/detail/${c.id}`"
            class="mt-2 block text-base font-semibold text-highlighted hover:underline"
          >
            {{ c.title || '(tanpa judul)' }}
          </NuxtLink>
          <p
            v-if="ringkas(c)"
            class="mt-1 text-sm text-muted"
          >
            {{ ringkas(c) }}
          </p>
          <div class="mt-3 flex flex-wrap gap-1.5 text-xs">
            <UBadge
              :label="`Tayang ${c.publishDate ? fTgl(c.publishDate) : '-'}${c.publishTime ? ` ${c.publishTime}` : ''}`"
              icon="i-lucide-calendar"
              color="neutral"
              variant="outline"
              size="sm"
            />
            <UBadge
              v-if="c.pic"
              :label="`PIC ${namaUser(c.pic).split(' ')[0] || c.pic}`"
              color="neutral"
              variant="outline"
              size="sm"
            />
            <UButton
              :to="`/konten/detail/${c.id}`"
              label="Lihat detail final"
              icon="i-lucide-eye"
              color="neutral"
              variant="link"
              size="xs"
            />
          </div>
          <div
            v-if="bolehApprove"
            class="mt-4 flex gap-2"
          >
            <UButton
              label="Approve final & jadwalkan"
              icon="i-lucide-circle-check"
              class="flex-1 justify-center"
              :loading="sibuk === c.id"
              @click="approve(c)"
            />
            <UButton
              label="Tolak / revisi"
              icon="i-lucide-rotate-ccw"
              color="neutral"
              variant="outline"
              @click="mintaRevisi(c)"
            />
          </div>
          <p
            v-else
            class="mt-4 text-xs text-muted"
          >
            Menunggu persetujuan dari Account Manager / Content Director.
          </p>
        </AppPanel>
      </div>

      <KontenRevisiSheet
        v-model:open="revisiBuka"
        :item="revisiItem"
      />
    </AppPage>
  </KontenGerbang>
</template>
