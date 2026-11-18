<!--
  Marketing › VIP reservation form (vipFormUI, :16982). New rows and edits
  share it; the table lock lives in MarketingVipKunci (same data also goes to
  Reservasi). DP proofs upload at once; each row needs nominal + rekening.
  Assisted asks who owns the turnover (menuFix); Regular never does.
-->
<script setup lang="ts">
import type { BuktiVipMkt, ClientMkt, UserMkt, VipMkt } from '~/utils/marketing'
import { MENU_FIX_MKT, menuFixMkt } from '~/utils/marketing'
import { MAKS_BERKAS_MKT } from '~/utils/marketing-event'
import { REKENING_VIP_MKT } from '~/utils/marketing-vip'
import { berkasKeBase64, unggahBerkasMkt, urlBerkasMkt } from '~/composables/useMarketing'

const props = defineProps<{
  awal?: VipMkt | null
  clients: ClientMkt[]
  users: UserMkt[]
  bisaUbah: boolean
}>()

const emit = defineEmits<{ simpan: [v: VipMkt] }>()

const uid = () => `b${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
const f = reactive<VipMkt & { bukti: BuktiVipMkt[] }>({
  id: props.awal?.id ?? `v${Date.now().toString(36)}`,
  jenis: props.awal?.jenis ?? 'Assisted',
  nominal: props.awal?.nominal ?? '',
  menuFix: props.awal?.menuFix ?? '',
  nama: props.awal?.nama ?? '',
  clientId: props.awal?.clientId ?? '',
  hp: props.awal?.hp ?? '',
  tanggal: props.awal?.tanggal ?? '',
  jamMulai: props.awal?.jamMulai ?? '',
  jamSelesai: props.awal?.jamSelesai ?? '',
  paxMin: props.awal?.paxMin ?? '',
  paxMax: props.awal?.paxMax ?? '',
  layoutReq: props.awal?.layoutReq ?? '',
  tv: !!props.awal?.tv,
  speaker: !!props.awal?.speaker,
  catatan: props.awal?.catatan ?? '',
  meja: [...(props.awal?.meja ?? [])],
  mktPIC: props.awal?.mktPIC ?? '',
  resId: props.awal?.resId ?? '',
  bukti: (props.awal?.bukti ?? []).map(b => ({ ...b })),
  batalAt: props.awal?.batalAt ?? '',
})
const toast = useToast()
const assisted = computed(() => f.jenis === 'Assisted')

const labelClient = (c: ClientMkt) => [c.perusahaan || c.nama, c.nama && c.perusahaan ? `(${c.nama})` : ''].filter(Boolean).join(' ')
watch(() => f.clientId, (id) => {
  const c = props.clients.find(x => x.id === id)
  if (c) {
    if (!f.hp) f.hp = c.hp ?? ''
    if (!f.mktPIC && c.mktPIC) f.mktPIC = c.mktPIC
  }
})

const salah = ref('')
function kirim() {
  if (!f.nama?.trim()) {
    salah.value = 'Isi nama tamu dulu.'
    return
  }
  if (!f.hp?.trim()) {
    salah.value = 'Isi nomor HP dulu.'
    return
  }
  if (!f.tanggal) {
    salah.value = 'Isi tanggal dulu.'
    return
  }
  if (!f.jamMulai) {
    salah.value = 'Isi jam kedatangan dulu.'
    return
  }
  if (!(+(f.paxMin ?? 0) > 0)) {
    salah.value = 'Isi jumlah orang (min) dulu.'
    return
  }
  if (assisted.value && !menuFixMkt(f)) {
    salah.value = 'Pilih Pengakuan Omset dulu.'
    return
  }
  const kosong = (f.bukti ?? []).filter(b => !(+(b.nominal ?? 0) > 0) || !String(b.metode ?? '').trim())
  if (kosong.length) {
    salah.value = 'Tiap baris DP wajib nominal + rekening tujuan.'
    return
  }
  salah.value = ''
  emit('simpan', { ...f, nominal: f.nominal === '' ? '' : +(f.nominal as number) || 0 })
}

// ---- DP proofs ----
const mengunggah = ref(false)
function tambahBukti() {
  f.bukti.push({ id: uid(), nominal: '', metode: '', name: '' })
}
function hapusBukti(id: string) {
  f.bukti = f.bukti.filter(b => b.id !== id)
}
async function pilihBerkas(b: BuktiVipMkt, files: FileList | null) {
  const file = files?.[0]
  if (!file) return
  if (file.size > MAKS_BERKAS_MKT) {
    toast.add({ title: 'File terlalu besar', description: 'Bukti maksimal 8MB.', color: 'error' })
    return
  }
  mengunggah.value = true
  try {
    const r = await unggahBerkasMkt({ dataBase64: await berkasKeBase64(file), fileName: file.name, mimeType: file.type || 'application/octet-stream' })
    if (r.data?.key) {
      b.key = r.data.key
      b.url = urlBerkasMkt(r.data.key)
      b.name = r.data.name || file.name
    }
  }
  catch (e) {
    toast.add({ title: 'Gagal mengunggah bukti', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    mengunggah.value = false
  }
}
</script>

<template>
  <div class="grid grid-cols-1 gap-3">
    <UFormField
      label="Jenis reservasi"
      required
    >
      <AppPilihan
        v-model="f.jenis"
        :options="[{ value: 'Assisted', label: 'Assisted' }, { value: 'Regular', label: 'Regular' }]"
        name="vip-jenis"
      />
      <template #hint>
        Assisted ikut dihitung sebagai omzet di Marketing Performance. Regular tidak.
      </template>
    </UFormField>

    <template v-if="assisted">
      <UFormField
        label="Nominal pendapatan (Rp)"
        hint="Boleh dikosongkan dulu — diisi setelah acaranya selesai lewat tombol Isi Nominal di daftar. Nominalnya sudah termasuk tax & service."
      >
        <AppNominal
          v-model="f.nominal"
        />
      </UFormField>
      <div class="grid grid-cols-1 gap-2">
        <p class="text-sm font-semibold">
          DP & bukti transfer
        </p>
        <div
          v-for="b in f.bukti"
          :key="b.id"
          class="grid gap-2 rounded-xl border bg-muted border-default p-2.5"
        >
          <div class="grid grid-cols-2 gap-2">
            <UFormField
              label="Nominal (Rp)"
              required
            >
              <AppNominal
                :model-value="String(b.nominal ?? '')"
                @update:model-value="b.nominal = String($event).replace(/\D/g, '') === '' ? '' : +String($event).replace(/\D/g, '')"
              />
            </UFormField>
            <UFormField
              label="Rekening tujuan"
              required
            >
              <USelect
                v-model="b.metode"
                :items="REKENING_VIP_MKT"
                placeholder="Pilih…"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="flex items-center gap-2">
            <a
              v-if="b.url"
              :href="b.url"
              target="_blank"
              rel="noopener"
              class="min-w-0 flex-1 truncate text-sm text-primary-700 underline"
            >{{ b.name }}</a>
            <UInput
              type="file"
              accept="image/*,application/pdf"
              :disabled="mengunggah"
              @change="pilihBerkas(b, ($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''"
            />
            <UButton
              icon="i-lucide-minus"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Buang baris"
              @click="hapusBukti(b.id)"
            />
          </div>
        </div>
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          size="sm"
          label="Tambah baris DP"
          @click="tambahBukti"
        />
      </div>
      <UFormField
        label="Pengakuan omset"
        required
      >
        <AppPilihan
          v-model="f.menuFix"
          :options="MENU_FIX_MKT.map(x => ({ value: x.v as string, label: x.t }))"
          name="vip-menufix"
        />
      </UFormField>
    </template>

    <div class="grid gap-3 lg:grid-cols-2">
      <UFormField
        label="Atas nama"
        required
      >
        <UInput v-model="f.nama" />
      </UFormField>
      <UFormField label="Client / perusahaan">
        <UInput
          v-model="f.clientId"
          list="vip-clientlist"
          placeholder="Ketik untuk cari client…"
        />
        <datalist id="vip-clientlist">
          <option
            v-for="c in clients"
            :key="c.id"
            :value="c.id"
          >
            {{ labelClient(c) }}
          </option>
        </datalist>
      </UFormField>
      <UFormField
        label="No. HP"
        required
      >
        <UInput v-model="f.hp" />
      </UFormField>
      <UFormField
        label="Tanggal"
        required
      >
        <AppTanggal
          v-model="f.tanggal"
        />
      </UFormField>
      <UFormField
        label="Jam kedatangan"
        required
      >
        <AppJam
          v-model="f.jamMulai"
        />
      </UFormField>
      <UFormField label="Sampai jam">
        <AppJam
          v-model="f.jamSelesai"
        />
      </UFormField>
      <UFormField
        label="Jumlah orang (min)"
        required
      >
        <UInput
          v-model="f.paxMin"
          type="number"
        />
      </UFormField>
      <UFormField label="Jumlah orang (maks)">
        <UInput
          v-model="f.paxMax"
          type="number"
        />
      </UFormField>
    </div>
    <UFormField label="Request layout">
      <UInput v-model="f.layoutReq" />
    </UFormField>
    <div class="grid grid-cols-2 gap-3">
      <USwitch
        v-model="f.tv"
        label="Penggunaan TV"
      />
      <USwitch
        v-model="f.speaker"
        label="Butuh speaker & mic"
      />
    </div>
    <UFormField label="Catatan">
      <UTextarea
        v-model="f.catatan"
        autoresize
      />
    </UFormField>

    <p
      v-if="salah"
      class="text-sm text-error"
    >
      {{ salah }}
    </p>
    <div class="flex justify-end gap-2">
      <UButton
        :label="awal ? 'Simpan' : 'Simpan Reservasi'"
        :disabled="!bisaUbah"
        @click="kirim"
      />
    </div>
  </div>
</template>
