<!--
  Cashier › Kelola Akses (old `viewAkses`, deploy/cashier/index.html:4002-4062).

  Who holds the module still comes from the Office (granting and revoking the
  module stays in the Office's own Kelola Akses). What this page adds, as in
  Task Management: a Cashier admin closes single screens per crew member. One
  row per holder, one column per screen, a tick = open. Saved as the document
  `{officeUserId: [closed screen keys]}` (`/kompas/cashier/access`); the menu
  hides closed screens and the route guard keeps their URLs closed. The module
  admin always sees everything. It hides screens, it is not a data permission.
-->
<script setup lang="ts">
import { LAYAR_DIATUR_CASHIER, getAksesCashier, putAksesCashier, setAksesCashier } from '~/composables/useCashier'
import type { AksesCashier } from '~/composables/useCashier'
import { isKonflik } from '~/utils/versi'
import { LAYAR_CASHIER } from '~/utils/layar/cashier'

definePageMeta({ access: ['cashier'] })

const me = useMe()
const toast = useToast()
const { data: anggota, status, error, refresh } = useModulMembers('cashier')
const { data: dok, refresh: muatUlang } = useAsyncData('cashier-akses-dok', () => getAksesCashier(), { dedupe: 'defer' })

const KOLOM = LAYAR_DIATUR_CASHIER.map(k => ({ key: k, label: LAYAR_CASHIER.find(l => l.key === k)?.label ?? k }))
const orang = computed(() => [...anggota.value].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'id')))
const jumlahAdmin = computed(() => orang.value.filter(m => m.isModuleAdmin).length)
const saya = (id: string) => me.value?.id === id

const simpanan = computed<AksesCashier>(() => dok.value?.value ?? {})

/** Draft: closed keys per Office user id. Reset from the saved document whenever it changes. */
const draf = ref<AksesCashier>({})
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
  draf.value = { ...draf.value, [id]: on ? [] : [...LAYAR_DIATUR_CASHIER] }
}
const jumlahBuka = (id: string) => KOLOM.filter(k => buka(id, k.key)).length

/** Only rows with something closed are stored; an all-open person is simply absent. */
const rapikan = (a: AksesCashier): AksesCashier => Object.fromEntries(Object.entries(a)
  .map(([id, l]) => [id, LAYAR_DIATUR_CASHIER.filter(k => (l || []).includes(k))] as const)
  .filter(([, l]) => l.length))
const berubah = computed(() => JSON.stringify(rapikan(draf.value)) !== JSON.stringify(rapikan(simpanan.value)))

const { jalan, lagi } = useSibuk()
async function simpan() {
  try {
    const p = await putAksesCashier(rapikan(draf.value), dok.value?.version ?? '')
    setAksesCashier(p)
    await muatUlang()
    toast.add({ title: 'Akses halaman tersimpan.', color: 'success' })
  }
  catch (e) {
    if (isKonflik(e)) {
      await muatUlang()
      toast.add({ title: 'Akses diubah admin lain. Daftar sudah dimuat ulang — ulangi perubahanmu.', color: 'warning' })
      return
    }
    toast.add({ title: `Gagal menyimpan: ${apiErrorMessage(e)}`, color: 'error' })
  }
}
</script>

<template>
  <AppPage
    title="Kelola akses"
    description="Atur halaman Cashier yang boleh dibuka tiap kru."
  >
    <template #actions>
      <UButton
        label="Refresh"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="status === 'pending'"
        @click="refresh(); muatUlang()"
      />
    </template>

    <UAlert
      color="info"
      variant="subtle"
      icon="i-lucide-key-round"
      title="Centang = halaman terbuka untuk orang itu."
      description="Menutup halaman menyembunyikannya dari menu dan dari alamatnya, bukan mengunci datanya. Admin modul selalu melihat semua halaman. Menambah atau mencabut akses modul Cashier sendiri tetap dilakukan di Kelola Akses milik Office."
    />

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
    />

    <AppPanel
      v-else
      title="Akses halaman"
      icon="i-lucide-users"
      :count="orang.length"
      flush
    >
      <template #actions>
        <UButton
          v-if="berubah"
          label="Batalkan"
          color="neutral"
          variant="ghost"
          @click="isiDraf"
        />
        <UButton
          label="Simpan akses"
          icon="i-lucide-save"
          :disabled="!berubah || lagi('simpan')"
          :loading="lagi('simpan')"
          @click="jalan('simpan', simpan)"
        />
      </template>

      <div
        v-if="status === 'pending' && !orang.length"
        class="space-y-2 p-6"
      >
        <USkeleton
          v-for="i in 5"
          :key="i"
          class="h-12 w-full"
        />
        <p class="pt-2 text-center text-base text-muted">
          Memuat daftar akses dari Office…
        </p>
      </div>
      <p
        v-else-if="!orang.length"
        class="px-6 py-10 text-center text-base text-muted"
      >
        Belum ada kru dengan akses modul Cashier. Beri akses lewat Kelola Akses di Office.
      </p>

      <template v-else>
        <!-- Desktop: person × screen grid. -->
        <div class="hidden overflow-x-auto lg:block">
          <table class="tabel-padat w-full text-base">
            <thead class="bg-muted text-muted">
              <tr class="text-xs font-semibold uppercase tracking-wide">
                <th class="sticky left-0 z-10 min-w-52 bg-muted py-3.5 ps-6 pe-4 text-start">
                  Kru
                </th>
                <th
                  v-for="k in KOLOM"
                  :key="k.key"
                  class="px-1.5 py-3.5 text-center"
                >
                  {{ k.label }}
                </th>
                <th class="py-3.5 pe-6 text-end">
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
                <td class="sticky left-0 z-10 bg-default py-3.5 ps-6 pe-4">
                  <span class="flex items-center gap-2">
                    <b class="text-highlighted">{{ m.name || '(tanpa nama)' }}</b>
                    <AppStatus
                      v-if="saya(m.id)"
                      color="info"
                      size="sm"
                    >kamu</AppStatus>
                    <AppStatus
                      v-if="m.active === false"
                      color="warning"
                      size="sm"
                    >Nonaktif</AppStatus>
                  </span>
                  <span class="block text-sm text-muted">
                    {{ m.isModuleAdmin ? 'Admin — semua halaman' : `${jumlahBuka(m.id)} dari ${KOLOM.length} halaman` }}
                    <template v-if="m.keterangan"> · {{ m.keterangan }}</template>
                  </span>
                </td>
                <td
                  v-for="k in KOLOM"
                  :key="k.key"
                  class="px-1.5 py-3.5 text-center"
                >
                  <UCheckbox
                    :model-value="m.isModuleAdmin || buka(m.id, k.key)"
                    :disabled="m.isModuleAdmin"
                    class="inline-flex"
                    :aria-label="`${k.label} untuk ${m.name}`"
                    @update:model-value="(v: boolean | 'indeterminate') => atur(m.id, k.key, v === true)"
                  />
                </td>
                <td class="py-3.5 pe-6 text-end">
                  <UCheckbox
                    v-if="!m.isModuleAdmin"
                    :model-value="jumlahBuka(m.id) === KOLOM.length ? true : jumlahBuka(m.id) ? 'indeterminate' : false"
                    class="inline-flex"
                    :aria-label="`Semua halaman untuk ${m.name}`"
                    @update:model-value="() => aturSemua(m.id, jumlahBuka(m.id) !== KOLOM.length)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Phone: one card per person, the screens as toggle chips. -->
        <div class="flex flex-col gap-3 p-4 lg:hidden">
          <div
            v-for="m in orang"
            :key="m.id"
            class="rounded-xl border border-default p-4"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="min-w-0">
                <span class="flex items-center gap-2">
                  <b class="truncate text-base text-highlighted">{{ m.name || '(tanpa nama)' }}</b>
                  <AppStatus
                    v-if="saya(m.id)"
                    color="info"
                    size="sm"
                  >kamu</AppStatus>
                </span>
                <span class="block text-sm text-muted">
                  {{ m.isModuleAdmin ? 'Admin — semua halaman' : `${jumlahBuka(m.id)} dari ${KOLOM.length} halaman` }}
                </span>
              </span>
              <UButton
                v-if="!m.isModuleAdmin"
                :label="jumlahBuka(m.id) === KOLOM.length ? 'Tutup semua' : 'Buka semua'"
                color="neutral"
                variant="outline"
                size="sm"
                @click="aturSemua(m.id, jumlahBuka(m.id) !== KOLOM.length)"
              />
            </div>
            <div
              v-if="!m.isModuleAdmin"
              class="mt-3 flex flex-wrap gap-2"
            >
              <button
                v-for="k in KOLOM"
                :key="k.key"
                type="button"
                class="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors"
                :class="buka(m.id, k.key) ? 'border-gold bg-gold-soft text-gold-deep' : 'border-default bg-default text-dimmed line-through'"
                :aria-pressed="buka(m.id, k.key)"
                @click="atur(m.id, k.key, !buka(m.id, k.key))"
              >
                <UIcon
                  :name="buka(m.id, k.key) ? 'i-lucide-check' : 'i-lucide-x'"
                  class="size-3.5"
                />
                {{ k.label }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </AppPanel>

    <p
      v-if="!error"
      class="text-sm text-muted"
    >
      {{ orang.length }} kru memegang akses Cashier · {{ jumlahAdmin }} di antaranya admin modul.
    </p>
  </AppPage>
</template>
