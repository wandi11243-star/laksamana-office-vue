<!--
  Delete one reservation, from its detail sheet (old `deleteRes`, behind
  `CAN.deleteReservation`). Permanent: the row and its DP proof photos go, and
  it disappears from Dashboard, Riwayat, Dana Masuk and Analitik.

  The caller only shows the opener to someone with the Hapus Reservasi row
  (`bolehAksi('deleteReservation')`); the API enforces the same row, so a stale
  screen cannot delete without it. The row is re-read first so the delete
  carries the CURRENT version: a booking someone just changed is not deleted
  from an outdated sheet (conflict → the caller reloads through `@konflik`).
-->
<script setup lang="ts">
import type { Reservasi } from '~/composables/useReservasi'
import { deleteReservation, getReservation, postAudit, versiReservasi } from '~/composables/useReservasi'
import { apiErrorMessage } from '~/composables/useApi'
import { tanganiKonflik } from '~/utils/versi'
import { tglPendek } from '~/utils/format'

const props = defineProps<{
  r: Reservasi | null
}>()

const emit = defineEmits<{
  terhapus: []
  konflik: []
}>()

const open = defineModel<boolean>('open', { default: false })
const toast = useToast()
const { mulai: mulaiProses } = useProses()
const menghapus = ref(false)

const ringkas = computed(() => (props.r
  ? `${props.r.name} · ${tglPendek(props.r.date)} ${props.r.time} · ${props.r.pax} pax${props.r.table ? ` · meja ${props.r.table}` : ''}`
  : ''))

async function hapus() {
  const asal = props.r
  if (!asal || menghapus.value) return
  menghapus.value = true
  const selesaiProses = mulaiProses(`Menghapus reservasi ${asal.name}`)
  try {
    const env = await getReservation(asal.id)
    const segar = env.data
    await deleteReservation(segar.id, versiReservasi(env, segar) ?? segar.updatedAt)
    try {
      await postAudit({
        action: 'Hapus Reservasi',
        detail: `${segar.name} · ${tglPendek(segar.date)} ${segar.time} · ${segar.pax} pax${segar.table ? ` · meja ${segar.table}` : ''} (status ${segar.status})`,
        res: segar.id,
      })
    }
    catch {
      // The row is already gone; a missing audit line is not a failed delete.
    }
    open.value = false
    toast.add({ title: `Reservasi ${asal.name} dihapus`, color: 'success' })
    emit('terhapus')
  }
  catch (e) {
    if (!(await tanganiKonflik(e, async () => emit('konflik')))) {
      toast.add({ title: apiErrorMessage(e), color: 'error' })
    }
  }
  finally {
    selesaiProses()
    menghapus.value = false
  }
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    title="Hapus reservasi ini?"
    :description="ringkas"
  >
    <div class="space-y-3">
      <p class="rounded-lg border-l-4 border-error bg-error/10 p-3 text-sm text-error">
        Reservasi dan foto bukti DP-nya dihapus <b>permanen</b> dan tidak bisa dikembalikan. Datanya ikut hilang dari
        Dashboard, Riwayat, Dana Masuk, dan Analitik.
      </p>
      <p class="text-sm text-muted">
        Kalau tamunya hanya batal atau tidak datang, ubah statusnya (Cancelled / No-show) supaya riwayatnya tetap ada.
        Penghapusan ini tercatat di Log Activity.
      </p>
    </div>
    <template #footer>
      <UButton
        label="Ya, hapus permanen"
        icon="i-lucide-trash-2"
        color="error"
        size="xl"
        :loading="menghapus"
        :disabled="menghapus"
        @click="hapus"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="ghost"
        size="xl"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
</template>
