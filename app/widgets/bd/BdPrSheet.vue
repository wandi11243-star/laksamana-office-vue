<!--
  PR cover form (old `prModal`, deploy/bd/index.html:4082-4128). The signer names
  are COPIED into the document, not read again when it is drawn: a PR from last
  year must still show who signed it then. The job title is never typed here.
-->
<script setup lang="ts">
import type { BdApproval, BdPerson, BdPr, BdApproverSet } from '~/composables/useBd'
import { bdSimpan, ubahBd, versiBaris } from '~/composables/useBd'
import { penyetujuPr, todayISO } from '~/utils/bd-rumus'

const props = defineProps<{
  pr?: BdPr | null
  prAll: BdPr[]
  sets: BdApproverSet[]
  people: BdPerson[]
}>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const f = reactive({ no: '', tanggal: todayISO(), nama: '', dept: '', catatan: '' })
const apNama = reactive<Record<string, string>>({})

const penanda = computed(() => (props.pr ? penyetujuPr(props.pr, props.sets, props.people) : []))

watch(open, (o) => {
  if (!o || !props.pr) return
  const pr = props.pr
  f.no = pr.no || ''
  f.tanggal = pr.tanggal || todayISO()
  f.nama = pr.nama || ''
  f.dept = pr.dept || ''
  f.catatan = pr.catatan || ''
  penanda.value.forEach((s) => {
    apNama[s.k] = pr.approvals?.[s.k]?.nama || s.nama
  })
})

async function simpan() {
  const pr = props.pr
  if (!pr) return
  const no = f.no.trim()
  if (no && props.prAll.some(x => x.id !== pr.id && String(x.no) === no)) {
    toast.add({ title: `PR nomor ${no} sudah ada. Pakai nomor lain.`, color: 'error' })
    return
  }
  const approvals = { ...(pr.approvals || {}) }
  penanda.value.forEach((s) => {
    const a: BdApproval = approvals[s.k] || { nama: '', at: '', oleh: '' }
    a.nama = apNama[s.k]?.trim() || s.nama
    approvals[s.k] = a
  })
  const body: Partial<BdPr> = { no, tanggal: f.tanggal, nama: f.nama.trim(), dept: f.dept.trim(), catatan: f.catatan.trim(), approvals }
  const ok = await bdSimpan(() => ubahBd<BdPr>('purchase-requests', pr.id, { ...body, id: pr.id }, versiBaris(pr)), 'Kepala surat diperbarui')
  if (ok) open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="`Kepala surat PR-${pr?.no || '?'}`"
  >
    <div class="grid grid-cols-1 gap-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="PR No">
          <UInput
            v-model="f.no"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Request date">
          <UInput
            v-model="f.tanggal"
            type="date"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Name (penyusun)">
          <UInput
            v-model="f.nama"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Department">
          <UInput
            v-model="f.dept"
            class="w-full"
          />
        </UFormField>
      </div>
      <div>
        <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          Nama penyetuju
        </p>
        <div class="grid gap-4 sm:grid-cols-3">
          <UFormField
            v-for="s in penanda"
            :key="s.k"
            :label="s.l"
          >
            <UInput
              v-model="apNama[s.k]"
              class="w-full"
            />
          </UFormField>
        </div>
        <p class="mt-1.5 text-xs text-muted">
          Disimpan di dalam dokumen ini, bukan diambil ulang saat ditampilkan — PR lama tetap menunjukkan
          siapa yang menyetujuinya waktu itu.
        </p>
      </div>
      <UFormField label="Catatan kaki (opsional)">
        <UTextarea
          v-model="f.catatan"
          :rows="3"
          class="w-full"
        />
      </UFormField>
    </div>

    <template #footer>
      <UButton
        label="Simpan"
        icon="i-lucide-check"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
</template>
