<!--
  Stock › Ordering › Approval Order (old `deploy/stock/ordering/index.html:5112-5280`, 3 Nov 2026).

  A shopping order made by a member of Kitchen / Bar / Floor waits here for
  the division head (Jadwal › Head Divisi) before it reaches Purchasing. The
  guard is on the server; this screen shows what `GET /stock/approvals`
  answers for the signed-in user. Three tabs, as the old one: Menunggu
  approval and Riwayat approval (head / Ordering admin), Pengajuan saya
  (everyone). The head may change quantities before approving (0 = drop the
  item); rejecting needs a reason. Refreshes every 60 s while visible.
-->
<script setup lang="ts">
import type { BarisAcc, PengajuanAcc, StatusAcc } from '~/composables/useStock'
import { NAMA_DIVISI_ACC, cancelApproval, catatLog, decideApproval, useApprovals } from '~/composables/useStock'
import { apiErrorMessage } from '~/composables/useApi'
import { tglPendek } from '~/utils/format'

definePageMeta({ access: ['ordering'] })

const toast = useToast()
const q = useApprovals()
const d = computed(() => q.data.value)
const bolehPutus = computed(() => !!d.value && (d.value.head.length > 0 || d.value.admin))

const tab = ref<'menunggu' | 'riwayat' | 'milik'>('menunggu')
const opsiTab = computed(() => [
  ...(bolehPutus.value
    ? [
        { value: 'menunggu' as const, label: 'Menunggu approval', icon: 'i-lucide-hourglass', badge: d.value?.menunggu.length || undefined },
        { value: 'riwayat' as const, label: 'Riwayat approval', icon: 'i-lucide-history', jumlah: d.value?.riwayat.length || undefined },
      ]
    : []),
  { value: 'milik' as const, label: 'Pengajuan saya', icon: 'i-lucide-send', jumlah: d.value?.milik.length || undefined },
])
// The first tab until the crew picks one (a head lands on Menunggu, not on Pengajuan saya).
watch(opsiTab, (o) => {
  if (!o.some(x => x.value === tab.value)) tab.value = o[0]!.value
}, { immediate: true })

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    if (!document.hidden) q.refresh()
  }, 60_000)
})
onBeforeUnmount(() => clearInterval(timer))

const namaDiv = (ds: string[]) => ds.map(x => NAMA_DIVISI_ACC[x] ?? x).join('/')
const jam = (t?: string | null) => String(t ?? '').slice(11, 16)
const STATUS: Record<StatusAcc, { color: 'warning' | 'success' | 'error' | 'neutral', label: string, icon: string }> = {
  menunggu: { color: 'warning', label: 'Menunggu approval', icon: 'i-lucide-hourglass' },
  diproses: { color: 'warning', label: 'Diproses', icon: 'i-lucide-loader' },
  disetujui: { color: 'success', label: 'Disetujui', icon: 'i-lucide-check' },
  ditolak: { color: 'error', label: 'Ditolak', icon: 'i-lucide-x' },
  dibatalkan: { color: 'neutral', label: 'Ditarik pemohon', icon: 'i-lucide-undo-2' },
}

/** Quantities the head is editing, per request id, by row position. */
const qtyUbah = ref<Record<string, number[]>>({})
watch(() => d.value?.menunggu, (list) => {
  const baru: Record<string, number[]> = {}
  for (const x of list ?? []) baru[x.id] = qtyUbah.value[x.id] ?? x.orders.map(o => Number(o.qty) || 0)
  qtyUbah.value = baru
}, { immediate: true })

/** Approved quantity of one requested row ("5 → 3"); null when not approved. */
function akhirOf(x: PengajuanAcc, o: BarisAcc): number | null {
  if (x.status !== 'disetujui' || !Array.isArray(x.ordersAcc)) return null
  const a = x.ordersAcc.find(z => z.item === o.item && z.unit === o.unit)
  return a ? Number(a.qty) : 0
}

const memproses = ref('')
const konfirmasi = ref<{ open: boolean, x: PengajuanAcc | null }>({ open: false, x: null })
const ringkasSetuju = computed(() => {
  const x = konfirmasi.value.x
  if (!x) return { ada: 0, ubah: 0 }
  const qs = qtyUbah.value[x.id] ?? []
  return {
    ada: qs.filter(n => n > 0).length,
    ubah: x.orders.filter((o, i) => Number(o.qty) !== (qs[i] ?? Number(o.qty))).length,
  }
})
function bukaSetuju(x: PengajuanAcc) {
  konfirmasi.value = { open: true, x }
}
async function setujui() {
  const x = konfirmasi.value.x
  if (!x) return
  memproses.value = x.id
  try {
    const orders = (qtyUbah.value[x.id] ?? x.orders.map(o => Number(o.qty))).map(n => ({ qty: Math.max(0, Number(n) || 0) }))
    const r = await decideApproval(x.id, { keputusan: 'setuju', orders })
    await catatLog([{ modul: 'ordering', aksi: 'order_acc_setuju', ringkas: `Approval order ${x.pemohon} (${x.orders.length} barang, tgl ${x.tglDatang})`, data: { accId: x.id, batchId: r.batchId } }])
    konfirmasi.value = { open: false, x: null }
    toast.add({ title: 'Disetujui', description: `Order ${x.pemohon} diteruskan ke Purchasing.`, color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Gagal', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    memproses.value = ''
    await q.refresh()
  }
}

const tolak = ref<{ open: boolean, x: PengajuanAcc | null, alasan: string }>({ open: false, x: null, alasan: '' })
function bukaTolak(x: PengajuanAcc) {
  tolak.value = { open: true, x, alasan: '' }
}
async function kirimTolak() {
  const x = tolak.value.x
  if (!x) return
  if (!tolak.value.alasan.trim()) {
    toast.add({ title: 'Alasan kosong', description: 'Penolakan wajib menyebut alasannya.', color: 'warning' })
    return
  }
  memproses.value = x.id
  try {
    await decideApproval(x.id, { keputusan: 'tolak', alasan: tolak.value.alasan.trim() })
    tolak.value = { open: false, x: null, alasan: '' }
    toast.add({ title: 'Ditolak', description: `Order ${x.pemohon} ditolak.`, color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Gagal', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    memproses.value = ''
    await q.refresh()
  }
}

const tarik = ref<{ open: boolean, x: PengajuanAcc | null }>({ open: false, x: null })
async function kirimTarik() {
  const x = tarik.value.x
  if (!x) return
  memproses.value = x.id
  try {
    await cancelApproval(x.id)
    tarik.value = { open: false, x: null }
    toast.add({ title: 'Ditarik', description: 'Pengajuan dibatalkan.', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Gagal', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    memproses.value = ''
    await q.refresh()
  }
}

const daftarTab = computed<PengajuanAcc[]>(() => (d.value ? d.value[tab.value] : []))
</script>

<template>
  <AppPage
    title="Approval Order"
    description="Order belanja anggota disetujui head divisinya sebelum sampai ke Purchasing"
  >
    <template #actions>
      <UButton
        label="Refresh"
        icon="i-lucide-refresh-cw"
        variant="outline"
        :loading="q.status.value === 'pending'"
        @click="q.refresh()"
      />
    </template>

    <AppStatGrid>
      <AppStat
        v-if="bolehPutus"
        label="Menunggu approval"
        :value="String(d?.menunggu.length ?? 0)"
        satuan="pengajuan"
        icon="i-lucide-hourglass"
        tone="warning"
      />
      <AppStat
        v-if="bolehPutus"
        label="Diputuskan (60 hari)"
        :value="String(d?.riwayat.length ?? 0)"
        satuan="pengajuan"
        icon="i-lucide-history"
        tone="info"
      />
      <AppStat
        label="Pengajuan saya"
        :value="String(d?.milik.length ?? 0)"
        satuan="pengajuan"
        icon="i-lucide-send"
      />
    </AppStatGrid>

    <AppPanel title="Approval Order">
      <template #head>
        <AppSeg
          v-model="tab"
          :options="opsiTab"
        />
      </template>

      <p
        v-if="q.error.value"
        class="text-sm text-error"
      >
        Daftar approval tidak terbaca ({{ apiErrorMessage(q.error.value) }}).
      </p>
      <p
        v-else-if="d && !d.tersedia"
        class="text-sm text-muted"
      >
        Approval order belum aktif di server ini — order belanja langsung diteruskan ke Purchasing.
      </p>

      <!-- Waiting: quantities editable, then approve or reject. -->
      <div
        v-if="tab === 'menunggu'"
        class="flex flex-col gap-3"
      >
        <p
          v-if="daftarTab.length"
          class="text-sm text-warning"
        >
          Belum diteruskan ke Purchasing sampai disetujui.
        </p>
        <div
          v-for="x in daftarTab"
          :key="x.id"
          class="rounded-xl border border-default p-3"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="text-sm">
              <b class="text-highlighted">{{ x.pemohon }}</b>
              <span class="text-muted"> · {{ namaDiv(x.divisi) }} · datang {{ tglPendek(x.tglDatang) }} · diajukan {{ tglPendek(x.waktu.slice(0, 10)) }} {{ jam(x.waktu) }}</span>
            </div>
            <div class="flex gap-2">
              <UButton
                label="Tolak"
                color="error"
                variant="outline"
                size="sm"
                :disabled="!!memproses"
                @click="bukaTolak(x)"
              />
              <UButton
                label="Setujui"
                icon="i-lucide-check"
                size="sm"
                :loading="memproses === x.id"
                :disabled="!!memproses"
                @click="bukaSetuju(x)"
              />
            </div>
          </div>
          <ul class="mt-2 flex flex-col divide-y divide-default">
            <li
              v-for="(o, i) in x.orders"
              :key="i"
              class="flex items-center gap-2 py-1.5"
            >
              <span class="min-w-0 flex-1 text-sm">
                <span class="font-semibold text-highlighted">{{ o.item }}</span>
                <span
                  v-if="o.note && o.note !== '-'"
                  class="text-muted"
                > — {{ o.note }}</span>
              </span>
              <UInput
                v-if="qtyUbah[x.id]"
                v-model.number="qtyUbah[x.id]![i]"
                type="number"
                min="0"
                step="any"
                class="w-24"
                :aria-label="`Jumlah ${o.item}`"
                title="Ubah jumlah sebelum disetujui; 0 = barang ini tidak dipesan"
              />
              <span class="w-16 text-sm text-muted">{{ o.unit }}</span>
            </li>
          </ul>
        </div>
        <p
          v-if="!daftarTab.length"
          class="text-sm text-dimmed"
        >
          Tidak ada order yang menunggu approval.
        </p>
      </div>

      <!-- Decided (head) and own requests: read-only, "5 → 3" when changed. -->
      <div
        v-else
        class="flex flex-col gap-3"
      >
        <p
          v-if="tab === 'riwayat' && daftarTab.length"
          class="text-sm text-muted"
        >
          Yang sudah diputuskan di divisimu, 60 hari terakhir.
        </p>
        <div
          v-for="x in daftarTab"
          :key="x.id"
          class="rounded-xl border border-default p-3"
        >
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <AppStatus
              :color="STATUS[x.status]?.color ?? 'neutral'"
              :icon="STATUS[x.status]?.icon"
              size="sm"
            >
              {{ STATUS[x.status]?.label ?? x.status }}
            </AppStatus>
            <template v-if="tab === 'riwayat'">
              <b class="text-highlighted">{{ x.pemohon }}</b>
              <span class="text-muted">· {{ namaDiv(x.divisi) }}</span>
            </template>
            <span class="text-muted">· datang {{ tglPendek(x.tglDatang) }} · diajukan {{ tglPendek(x.waktu.slice(0, 10)) }} {{ jam(x.waktu) }}</span>
            <UButton
              v-if="tab === 'milik' && x.status === 'menunggu'"
              label="Tarik"
              variant="ghost"
              color="error"
              size="sm"
              class="ml-auto"
              :disabled="!!memproses"
              @click="tarik = { open: true, x }"
            />
          </div>
          <p
            v-if="x.putusOleh && x.status !== 'menunggu'"
            class="mt-1 text-xs text-muted"
          >
            {{ x.status === 'dibatalkan' ? 'Ditarik' : 'Diputuskan' }} oleh <b>{{ x.putusOleh }}</b> · {{ tglPendek(String(x.putusAt ?? '').slice(0, 10)) }} {{ jam(x.putusAt) }}
          </p>
          <p
            v-if="x.status === 'ditolak' && x.alasan"
            class="mt-1 text-xs font-semibold text-error"
          >
            Alasan: {{ x.alasan }}
          </p>
          <ul class="mt-2 flex flex-col divide-y divide-default border-t border-default">
            <li
              v-for="(o, i) in x.orders"
              :key="i"
              class="flex items-center justify-between gap-2 py-1 text-sm"
            >
              <span
                class="min-w-0 truncate font-semibold"
                :class="akhirOf(x, o) === 0 ? 'text-dimmed line-through' : 'text-highlighted'"
              >{{ o.item }}</span>
              <span
                class="num shrink-0"
                :class="akhirOf(x, o) !== null && akhirOf(x, o) !== Number(o.qty) ? 'font-bold text-warning' : 'text-muted'"
              >
                <template v-if="akhirOf(x, o) !== null && akhirOf(x, o) !== Number(o.qty)">{{ o.qty }} → {{ akhirOf(x, o) }}</template>
                <template v-else>{{ o.qty }}</template>
                {{ o.unit }}
              </span>
            </li>
          </ul>
        </div>
        <p
          v-if="!daftarTab.length"
          class="text-sm text-dimmed"
        >
          {{ tab === 'riwayat' ? 'Belum ada riwayat approval 60 hari terakhir.' : 'Belum ada pengajuan.' }}
        </p>
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="konfirmasi.open"
      title="Setujui order"
    >
      <div class="flex flex-col gap-3">
        <p class="text-sm text-default">
          Setujui <b>{{ ringkasSetuju.ada }} barang</b> dari <b>{{ konfirmasi.x?.pemohon }}</b><template v-if="ringkasSetuju.ubah">
            ({{ ringkasSetuju.ubah }} jumlah diubah)
          </template>? Order langsung diteruskan ke Purchasing.
        </p>
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            variant="outline"
            @click="konfirmasi.open = false"
          />
          <UButton
            label="Setujui"
            icon="i-lucide-check"
            :loading="!!memproses"
            @click="setujui"
          />
        </div>
      </div>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="tolak.open"
      title="Tolak order"
    >
      <div class="flex flex-col gap-3">
        <p class="text-sm text-default">
          Tolak order <b>{{ tolak.x?.pemohon }}</b>? Tulis alasannya.
        </p>
        <UFormField
          label="Alasan"
          required
        >
          <UTextarea
            v-model="tolak.alasan"
            :rows="3"
            placeholder="Mis. stok masih cukup sampai minggu depan"
            class="w-full"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            variant="outline"
            @click="tolak.open = false"
          />
          <UButton
            label="Tolak"
            color="error"
            :loading="!!memproses"
            @click="kirimTolak"
          />
        </div>
      </div>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="tarik.open"
      title="Tarik pengajuan"
    >
      <div class="flex flex-col gap-3">
        <p class="text-sm text-default">
          Tarik pengajuan ini? Barangnya tidak jadi dipesan.
        </p>
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            variant="outline"
            @click="tarik.open = false"
          />
          <UButton
            label="Tarik"
            color="error"
            :loading="!!memproses"
            @click="kirimTarik"
          />
        </div>
      </div>
    </ResponsiveSheet>
  </AppPage>
</template>
