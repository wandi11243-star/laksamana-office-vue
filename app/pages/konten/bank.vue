<!--
  Konten › Bank Konten (deploy/konten/analytics/index.html #bank; #133).
  Ide tersimpan; yang tidak dipakai diarsipkan, tidak dihapus. Hapus permanen
  hanya di tab Arsip. Generate = content planning AI → ide status IDE.
-->
<script setup lang="ts">
import type { IdeBank } from '~/composables/useCampaign'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['konten', 'campaign'] })

const { data: st, error, refresh } = useStateCampaign()

const tabStatus = ref('Ide')
const saringPlat = ref('Semua')
const daftar = computed(() => (st.value?.bank ?? []).filter(b =>
  (tabStatus.value === 'Semua' || b.status === tabStatus.value.toUpperCase())
  && (saringPlat.value === 'Semua' || b.platform === saringPlat.value)))
const hitung = (s: string) => (st.value?.bank ?? []).filter(b => b.status === s).length

// ---------------------------------------------------------------- generate
// dataDari/dataSampai bound the EVIDENCE window (optional pair, empty = no
// filter — they are not schedule dates). pilar[] filters ideas by content
// pilar; AI dates are kept when valid, emptied when not (the scheduler picks).
const genDataDari = ref('')
const genDataSampai = ref('')
const genPlat = ref('TikTok, Instagram')
const genJumlah = ref(10)
const genPilar = ref<string[]>([])
const genJalan = ref(false)
const genGalat = ref('')
const genHasil = ref('')

function alihkanPilar(p: string) {
  genPilar.value = genPilar.value.includes(p)
    ? genPilar.value.filter(x => x !== p)
    : [...genPilar.value, p]
}

async function generate() {
  genJalan.value = true
  genGalat.value = ''
  genHasil.value = ''
  if ((genDataDari.value && !genDataSampai.value) || (!genDataDari.value && genDataSampai.value)) {
    genGalat.value = 'Gagal membuat planning: rentang data bukti wajib sepasang (dari & sampai) atau dikosongkan.'
    genJalan.value = false
    return
  }
  try {
    const r = await generateBankCampaign({
      platform: genPlat.value, jumlah: genJumlah.value,
      dataDari: genDataDari.value || undefined, dataSampai: genDataSampai.value || undefined,
      pilar: genPilar.value.length ? genPilar.value : undefined,
    })
    genHasil.value = `${r.data.jumlah} ide masuk ke Bank Konten.${r.data.ringkasan ? ` ${r.data.ringkasan}` : ''}`
    await refresh()
  }
  catch (e) { genGalat.value = `Gagal membuat planning: ${apiErrorMessage(e)}` }
  genJalan.value = false
}

// ---------------------------------------------------------------- CRUD ide
const formBuka = ref(false)
const form = ref<Partial<IdeBank>>({
  judul: '', platform: 'TikTok', format: '', pilar: '', tanggal: '', jam: '', hook: '', caption: '', alasan: '',
})
function bukaForm(b?: IdeBank) {
  if (b) {
    form.value = { ...b }
  }
  else {
    form.value = {
      judul: '', platform: 'TikTok', format: '', pilar: '', tanggal: '', jam: '', hook: '', caption: '', alasan: '',
    }
  }
  formBuka.value = true
}
async function simpanForm() {
  const v = form.value
  const cur = v.id ? st.value?.bank.find(x => x.id === v.id) : undefined
  const ok = await campaignSimpan(
    () => simpanBankCampaign(v, cur ? (cur.diubah_at ?? cur.dibuat_at) : undefined), 'Ide disimpan.')
  if (ok) {
    formBuka.value = false
    refresh()
  }
}
async function arsipkan(b: IdeBank, arsip: boolean) {
  const ok = await campaignSimpan(() => arsipBankCampaign(b.id, arsip), arsip ? 'Ide diarsipkan.' : 'Ide dipulihkan.')
  if (ok) refresh()
}
async function hapus(b: IdeBank) {
  if (!confirm(`Hapus permanen ide "${b.judul}"? Tidak bisa dikembalikan. Jadwal yang pernah dibuat dari ide ini tetap ada di Kalender.`)) return
  const cur = st.value?.bank.find(x => x.id === b.id)
  const ok = await campaignSimpan(
    () => hapusBankCampaign(b.id, cur ? (cur.diubah_at ?? cur.dibuat_at) : undefined), 'Ide dihapus permanen.')
  if (ok) refresh()
}
</script>

<template>
  <KontenGerbang lihat="bank">
    <AppPage
      title="Bank Konten"
      :description="`Bank Konten — ${(st?.bank ?? []).length} ide tersimpan. Yang tidak dipakai diarsipkan, tidak dihapus.`"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Analytics: ${apiErrorMessage(error)}`"
      />

      <AppPanel
        title="Buat content planning dengan AI"
        description="Dari profil brand + insight aktif + pilar Pengaturan + postingan terbaik. Hasilnya masuk sebagai ide — dijadwalkan nanti lewat tombol Jadwalkan."
      >
        <div class="grid gap-2 md:grid-cols-2">
          <UFormField label="Platform">
            <USelect
              v-model="genPlat"
              :items="['TikTok, Instagram', 'TikTok', 'Instagram', 'YouTube']"
            />
          </UFormField>
          <UFormField label="Jumlah konten">
            <USelect
              v-model="genJumlah"
              :items="[5, 8, 10, 14, 20]"
            />
          </UFormField>
          <UFormField
            label="Dari data bukti (opsional)"
            help="Tanggal tayang postingan yang dibaca AI."
          >
            <UInput
              v-model="genDataDari"
              type="date"
            />
          </UFormField>
          <UFormField
            label="Sampai data bukti (opsional)"
            help="Wajib sepasang dengan Dari — kosongkan keduanya bila tanpa batas."
          >
            <UInput
              v-model="genDataSampai"
              type="date"
            />
          </UFormField>
        </div>
        <UFormField
          v-if="(st?.setting.kategori ?? []).length"
          label="Filter pilar (opsional)"
          help="Hanya ide dengan pilar terpilih yang disimpan."
        >
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="p in (st?.setting.kategori ?? [])"
              :key="p"
              size="xs"
              :color="genPilar.includes(p) ? 'primary' : 'neutral'"
              :variant="genPilar.includes(p) ? 'solid' : 'soft'"
              :icon="genPilar.includes(p) ? 'i-lucide-check' : undefined"
              @click="alihkanPilar(p)"
            >
              {{ p }}
            </UButton>
          </div>
        </UFormField>
        <UButton
          color="primary"
          icon="i-lucide-zap"
          :loading="genJalan"
          @click="generate()"
        >
          {{ genJalan ? 'Menyusun…' : 'Buat content planning' }}
        </UButton>
        <p
          v-if="genJalan"
          class="mt-1 text-xs text-muted"
        >
          AI sedang menyusun… biasanya 1–2 menit. Jangan tutup halaman ini.
        </p>
        <UAlert
          v-if="genGalat"
          class="mt-2"
          color="error"
          variant="subtle"
          :title="genGalat"
        />
        <UAlert
          v-if="genHasil"
          class="mt-2"
          color="success"
          variant="subtle"
          :title="genHasil"
        />
      </AppPanel>

      <AppPanel title="Ide tersimpan">
        <template #head>
          <div class="flex flex-wrap items-center gap-2">
            <AppSeg
              v-model="tabStatus"
              size="sm"
              :options="['Ide', 'Terjadwal', 'Arsip', 'Semua'].map(v => ({ value: v, label: v }))"
            />
            <span class="text-xs text-muted">Ide ({{ hitung('IDE') }}) · Terjadwal ({{ hitung('TERJADWAL') }}) · Arsip ({{ hitung('ARSIP') }})</span>
            <AppSeg
              v-model="saringPlat"
              size="sm"
              :options="['Semua', 'TikTok', 'Instagram', 'YouTube'].map(v => ({ value: v, label: v }))"
            />
            <UButton
              color="primary"
              icon="i-lucide-plus"
              size="xs"
              @click="bukaForm()"
            >
              Ide manual
            </UButton>
          </div>
        </template>
        <p
          v-if="!daftar.length"
          class="text-sm text-muted"
        >
          Belum ada ide di tab ini.
        </p>
        <div
          v-for="b in daftar"
          :key="b.id"
          class="border-b border-default py-2"
        >
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted">{{ b.platform }}{{ b.format ? ` · ${b.format}` : '' }}{{ b.pilar ? ` · ${b.pilar}` : '' }}</span>
            <span class="flex-1 truncate text-sm font-medium">{{ b.judul }}</span>
            <AppStatus
              v-if="b.status !== 'IDE'"
              :status="b.status === 'ARSIP' ? 'Arsip' : 'Terjadwal'"
            />
          </div>
          <p class="text-xs text-muted">
            {{ b.tanggal || 'tanpa tanggal' }}{{ b.jam ? ` · ${b.jam}` : '' }} · {{ b.sumber }} · {{ b.dibuat_oleh }}
          </p>
          <p
            v-if="b.hook"
            class="text-sm"
          >
            <UIcon
              name="i-lucide-clapperboard"
              class="size-4"
            /> {{ b.hook }}
          </p>
          <p
            v-if="b.caption"
            class="line-clamp-2 text-sm text-muted"
          >
            {{ b.caption }}
          </p>
          <p
            v-if="b.alasan"
            class="text-xs text-muted"
          >
            Kenapa: {{ b.alasan }}
          </p>
          <div class="mt-1 flex flex-wrap gap-2">
            <template v-if="b.status === 'IDE'">
              <UButton
                color="neutral"
                variant="soft"
                size="xs"
                loading-auto
                @click="arsipkan(b, true)"
              >
                Arsipkan
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                size="xs"
                @click="bukaForm(b)"
              >
                Sunting
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                size="xs"
                icon="i-lucide-calendar-plus"
                :to="`./kalender?tanggal=${b.tanggal || hariIni()}`"
              >
                Jadwalkan
              </UButton>
            </template>
            <template v-else-if="b.status === 'ARSIP'">
              <UButton
                color="error"
                variant="soft"
                size="xs"
                loading-auto
                @click="hapus(b)"
              >
                Hapus permanen
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                size="xs"
                loading-auto
                @click="arsipkan(b, false)"
              >
                Pulihkan
              </UButton>
            </template>
            <UButton
              v-else
              color="neutral"
              variant="soft"
              size="xs"
              to="./kalender"
            >
              Lihat di Kalender
            </UButton>
          </div>
        </div>
      </AppPanel>

      <ResponsiveSheet
        v-model="formBuka"
        :title="form.id ? 'Sunting ide' : 'Tambah ide ke Bank Konten'"
      >
        <UFormField label="Judul ide *">
          <UInput v-model="form.judul" />
        </UFormField>
        <UFormField label="Platform">
          <USelect
            v-model="form.platform"
            :items="['TikTok', 'Instagram', 'YouTube']"
          />
        </UFormField>
        <UFormField label="Format">
          <UInput
            v-model="form.format"
            placeholder="Reels, Carousel, Story…"
          />
        </UFormField>
        <UFormField label="Pilar">
          <USelect
            v-model="form.pilar"
            :items="['— tanpa pilar —', ...(st?.setting.kategori ?? [])]"
          />
        </UFormField>
        <UFormField label="Rencana tanggal">
          <UInput
            v-model="form.tanggal"
            type="date"
          />
        </UFormField>
        <UFormField label="Jam (WIB)">
          <UInput
            v-model="form.jam"
            type="time"
          />
        </UFormField>
        <UFormField label="Hook (3 detik pertama)">
          <UInput v-model="form.hook" />
        </UFormField>
        <UFormField label="Caption">
          <UTextarea
            v-model="form.caption"
            :rows="3"
          />
        </UFormField>
        <UFormField label="Alasan / catatan">
          <UTextarea
            v-model="form.alasan"
            :rows="2"
          />
        </UFormField>
        <template #actions>
          <UButton
            color="neutral"
            variant="soft"
            @click="formBuka = false"
          >
            Batal
          </UButton>
          <UButton
            color="primary"
            loading-auto
            @click="simpanForm()"
          >
            Simpan ide
          </UButton>
        </template>
      </ResponsiveSheet>
    </AppPage>
  </KontenGerbang>
</template>
