<!--
  Reject a refund request with a REQUIRED reason (`tolakRefund :10230`): the
  buyer will ask why, and whoever answers is not the one who rejected it.
  The caller writes `{status:'Rejected', penyetuju, alasan_tolak, decided_at}`.
-->
<script setup lang="ts">
const props = defineProps<{
  /** Buyer · amount line under the title (`o.buyer_name · IDR(o.total)`). */
  ket?: string
  sibuk?: boolean
}>()
const emit = defineEmits<{ tolak: [alasan: string] }>()
const open = defineModel<boolean>('open', { default: false })

const alasan = ref('')
watch(open, (v) => {
  if (v) alasan.value = ''
})
const toast = useToast()
function kirim() {
  const a = alasan.value.trim()
  if (!a) {
    toast.add({ title: 'Alasan wajib diisi.', color: 'error' })
    return
  }
  emit('tolak', a)
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    title="Tolak refund"
    :description="props.ket"
  >
    <UFormField
      label="Alasan"
      required
      help="Alasannya wajib: pembeli akan menanyakannya, dan yang menjawab bukan orang yang menolak."
    >
      <UTextarea
        v-model="alasan"
        :rows="3"
        placeholder="mis. tiket sudah dipakai masuk, di luar batas waktu refund"
        class="w-full"
      />
    </UFormField>
    <template #footer>
      <UButton
        color="error"
        :loading="props.sibuk"
        @click="kirim"
      >
        Tolak
      </UButton>
      <UButton
        color="neutral"
        variant="outline"
        @click="open = false"
      >
        Batal
      </UButton>
    </template>
  </ResponsiveSheet>
</template>
