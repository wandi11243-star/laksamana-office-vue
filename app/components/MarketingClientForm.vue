<!--
  Client Baru / Edit Client (old clientForm + saveClient,
  deploy/marketing/index.html:5950-6015; marketing.md D.2). Same fields and
  order; Email & Instagram are no longer asked but stay in the data.
  Validation: "Lengkapi data — Nama & No. HP wajib diisi."

  Marketing PIC lists the users whose role is `marketing`, as before. A new
  client defaults to me when I am one of them — the old <select> silently took
  the FIRST name in the list, which handed new leads to whoever sorted first.
-->
<script setup lang="ts">
import type { ClientMkt } from '~/utils/marketing'
import { SOURCE_CLIENT_MKT } from '~/utils/marketing'
import { hariIni } from '~/utils/format'

const props = defineProps<{ client?: ClientMkt | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ tersimpan: [id: string] }>()

const toast = useToast()
const { data: st } = useStateMkt()
const { saya } = useAksesMkt()

const KOSONG = '__kosong'
const LAIN = '__lain__'
const f = reactive({ nama: '', perusahaan: '', pic: '', hp: '', alamat: '', source: KOSONG, sourceLain: '', mktPIC: '', birthday: '', nextFU: '', catatan: '' })
const sibuk = ref(false)

const opsiPic = computed(() => st.value.users.filter(u => u.role === 'marketing').map(u => ({ label: u.name, value: u.id })))
const opsiSource = [{ label: '— pilih —', value: KOSONG }, ...SOURCE_CLIENT_MKT.map(s => ({ label: s, value: s })), { label: 'Lainnya — tulis sendiri', value: LAIN }]

watch(open, (o) => {
  if (!o) return
  const c = props.client
  const lain = !!c?.source && !SOURCE_CLIENT_MKT.includes(c.source)
  const sayaId = saya.value?.user.id ?? ''
  Object.assign(f, {
    nama: c?.nama ?? '', perusahaan: c?.perusahaan ?? '', pic: c?.pic ?? '', hp: c?.hp ?? '', alamat: c?.alamat ?? '',
    source: lain ? LAIN : (c?.source || KOSONG), sourceLain: lain ? c!.source! : '',
    mktPIC: c ? (c.mktPIC ?? '') : (opsiPic.value.some(o => o.value === sayaId) ? sayaId : (opsiPic.value[0]?.value ?? '')),
    birthday: c?.birthday ?? '', nextFU: c?.nextFU ?? '', catatan: c?.catatan ?? '',
  })
}, { immediate: true })

async function simpan() {
  const t = (s: string) => s.trim()
  if (!t(f.nama) || !t(f.hp)) return toast.add({ title: 'Lengkapi data', description: 'Nama & No. HP wajib diisi.', color: 'error' })
  const source = f.source === LAIN ? t(f.sourceLain) : (f.source === KOSONG ? '' : f.source)
  const isi = {
    nama: t(f.nama), perusahaan: t(f.perusahaan), pic: t(f.pic), hp: t(f.hp), alamat: t(f.alamat), source,
    mktPIC: f.mktPIC, birthday: f.birthday, nextFU: f.nextFU, catatan: t(f.catatan), lastContact: hariIni(),
  }
  sibuk.value = true
  const c = props.client
  let id = c?.id ?? ''
  const ok = c
    ? await mktSimpan(() => tambalMkt<ClientMkt>('clients', c.id, isi, c.updatedAt), `Data ${isi.nama} diperbarui.`, { refType: 'client', refId: c.id, action: 'Data client diperbarui', detail: isi.nama })
    : await mktSimpan(async () => {
        const r = await buatMkt<ClientMkt>('clients', { ...isi, mktPIC: isi.mktPIC || saya.value?.user.id, createdAt: hariIni(), email: '', ig: '' })
        id = r.data.id
        await logDenganCobaLagi(() => logMkt('client', id, 'Lead baru masuk', isi.nama + (source ? ` · ${source}` : '')))
      }, `Lead ${isi.nama} masuk pipeline.`)
  sibuk.value = false
  if (!ok) return
  open.value = false
  emit('tersimpan', id)
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="client ? 'Edit Client' : 'Client Baru'"
    :description="client ? client.nama : 'Tambah kontak ke CRM. Tahapan Lead→Deal hidup di event, bukan di client.'"
    lebar="sedang"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        label="Nama"
        required
      >
        <UInput
          v-model="f.nama"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Perusahaan / Organisasi">
        <UInput
          v-model="f.perusahaan"
          class="w-full"
        />
      </UFormField>
      <UFormField label="PIC (sisi client)">
        <UInput
          v-model="f.pic"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="No. HP / WhatsApp"
        required
      >
        <UInput
          v-model="f.hp"
          inputmode="tel"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Alamat">
        <UInput
          v-model="f.alamat"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Source">
        <USelect
          v-model="f.source"
          :items="opsiSource"
          class="w-full"
        />
        <UInput
          v-if="f.source === LAIN"
          v-model="f.sourceLain"
          placeholder="Tulis sumbernya"
          class="mt-2 w-full"
          autofocus
        />
      </UFormField>
      <UFormField label="Marketing PIC">
        <USelect
          v-model="f.mktPIC"
          :items="opsiPic"
          placeholder="Belum ada user Marketing"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Tanggal Lahir (opsional)">
        <AppTanggal
          v-model="f.birthday"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Next Follow Up">
        <AppTanggal
          v-model="f.nextFU"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Catatan"
        class="sm:col-span-2"
      >
        <UTextarea
          v-model="f.catatan"
          placeholder="Preferensi, sensitivitas harga, dsb."
          class="w-full"
        />
      </UFormField>
    </div>
    <template #footer>
      <UButton
        :label="client ? 'Simpan Perubahan' : 'Simpan Client'"
        :loading="sibuk"
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
