<!--
  Konten › Riset Tren (deploy/konten/analytics/index.html #riset; #133).
  AI membaca postingan brand yang paling jalan. AI tidak punya akses
  internet: tren adalah perkiraan, bukan data pasar langsung.
-->
<script setup lang="ts">
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['konten', 'campaign'] })

const toast = useToast()
const { data: st, error, refresh } = useStateCampaign()

const topik = ref('')
const platform = ref('TikTok, Instagram')
const catatan = ref('')
// Evidence window for the AI (tayang date, WIB): 7/30/90 = last N days,
// rentang = dari/sampai required, semua = no filter (legacy behaviour).
const periode = ref('semua')
const dari = ref('')
const sampai = ref('')
// Team pilar filter (setting.kategori); off-list values are emptied server-side.
const FOKUS_SEMUA = '— semua pilar —'
const fokus = ref(FOKUS_SEMUA)
const jalan = ref(false)
const galat = ref('')
const aktifId = ref('')

const opsiPeriode = [
  { value: '7', label: '7 hari' },
  { value: '30', label: '30 hari' },
  { value: '90', label: '90 hari' },
  { value: 'rentang', label: 'Rentang…' },
  { value: 'semua', label: 'Semua' },
]

async function jalankan() {
  jalan.value = true
  galat.value = ''
  if (periode.value === 'rentang' && (!dari.value || !sampai.value)) {
    galat.value = 'Riset gagal: rentang tanggal wajib diisi (dari & sampai).'
    jalan.value = false
    return
  }
  try {
    const r = await jalankanRisetCampaign({
      topik: topik.value, platform: platform.value, catatan: catatan.value,
      periode: periode.value,
      dari: periode.value === 'rentang' ? dari.value : undefined,
      sampai: periode.value === 'rentang' ? sampai.value : undefined,
      fokus: fokus.value === FOKUS_SEMUA ? undefined : fokus.value,
    })
    aktifId.value = r.data.id
    await refresh()
    toast.add({ title: 'Riset selesai.', color: 'success' })
  }
  catch (e) { galat.value = `Riset gagal: ${apiErrorMessage(e)}` }
  jalan.value = false
}

const riwayat = computed(() => st.value?.riset ?? [])
const aktif = computed(() => riwayat.value.find(r => r.id === aktifId.value) ?? riwayat.value[0])

const bankBuka = ref(false)
const bankForm = ref({ judul: '', platform: 'TikTok', hook: '', caption: '', alasan: '', sumber: 'riset' as string })
function simpanKeBank(ide: Record<string, unknown>) {
  bankForm.value = {
    judul: String(ide.judul ?? ''), platform: String(ide.platform ?? 'TikTok'),
    hook: String(ide.hook ?? ''), caption: String(ide.caption ?? ''),
    alasan: String(ide.alasan ?? ''), sumber: 'riset',
  }
  bankBuka.value = true
}
async function simpanBank() {
  const ok = await campaignSimpan(() => simpanBankCampaign({ ...bankForm.value }), 'Ide masuk ke Bank Konten.')
  if (ok) bankBuka.value = false
}
</script>

<template>
  <KontenGerbang lihat="riset">
    <AppPage
      title="Riset Tren"
      description="AI membaca postingan brand yang paling jalan"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Analytics: ${apiErrorMessage(error)}`"
      />
      <AppStatGrid :count="3">
        <AppStat
          label="Riset tersimpan"
          :value="riwayat.length"
          icon="i-lucide-file-search"
        />
        <AppStat
          label="Platform dipilih"
          :value="platform"
          icon="i-lucide-layout-grid"
          wrap
        />
        <AppStat
          label="Model AI"
          :value="st?.setting.aiSiap ? 'Siap' : 'Belum siap'"
          icon="i-lucide-sparkles"
          :tone="st?.setting.aiSiap ? 'success' : 'warning'"
        />
      </AppStatGrid>
      <AppPanel title="Mulai riset tren">
        <div class="mb-4 grid items-start gap-4 sm:grid-cols-2">
          <UFormField label="Topik riset *">
            <UInput
              v-model="topik"
              class="w-full"
              placeholder="Contoh: konten malam minggu & live music"
            />
          </UFormField>
          <UFormField label="Platform">
            <USelect
              v-model="platform"
              class="w-full"
              :items="['TikTok, Instagram', 'TikTok', 'Instagram', 'YouTube']"
            />
          </UFormField>
          <UFormField
            label="Catatan / fokus (opsional)"
            class="sm:col-span-2"
          >
            <UTextarea
              v-model="catatan"
              class="w-full"
              :rows="2"
            />
          </UFormField>
          <UFormField
            label="Periode data bukti"
            help="Bukti dibaca dari tanggal tayang postingan (WIB)."
          >
            <AppSeg
              v-model="periode"
              :options="opsiPeriode"
            />
          </UFormField>
          <div
            v-if="periode === 'rentang'"
            class="grid gap-2 sm:col-span-2 sm:grid-cols-2"
          >
            <UFormField label="Dari tanggal *">
              <AppTanggal
                v-model="dari"
              />
            </UFormField>
            <UFormField label="Sampai tanggal *">
              <AppTanggal
                v-model="sampai"
              />
            </UFormField>
          </div>
          <UFormField label="Fokus pilar (opsional)">
            <USelect
              v-model="fokus"
              :items="[FOKUS_SEMUA, ...(st?.setting.kategori ?? [])]"
            />
          </UFormField>
        </div>
        <UButton
          color="primary"
          icon="i-lucide-zap"
          :loading="jalan"
          :disabled="!topik || !st?.setting.aiSiap"
          @click="jalankan()"
        >
          {{ jalan ? 'Menganalisa…' : 'Jalankan riset' }}
        </UButton>
        <p
          v-if="!st?.setting.aiSiap"
          class="mt-1 text-xs text-muted"
        >
          API key AI belum diisi. Minta admin modul mengisinya di Pengaturan.
        </p>
        <p
          v-if="jalan"
          class="mt-1 text-xs text-muted"
        >
          AI sedang meriset… biasanya 1–2 menit. Jangan tutup halaman ini.
        </p>
        <UAlert
          v-if="galat"
          class="mt-2"
          color="error"
          variant="subtle"
          :title="galat"
        />
      </AppPanel>

      <AppPanel
        v-if="riwayat.length"
        title="Riwayat riset"
      >
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="r in riwayat"
            :key="r.id"
            size="xs"
            :color="aktif?.id === r.id ? 'primary' : 'neutral'"
            :variant="aktif?.id === r.id ? 'solid' : 'soft'"
            @click="aktifId = r.id"
          >
            {{ r.topik }} · {{ new Date(r.at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) }}
          </UButton>
        </div>
        <template v-if="aktif?.hasil">
          <p class="mt-3 text-sm font-medium">
            Hasil riset: {{ aktif.topik }}
          </p>
          <p class="text-xs text-muted">
            {{ aktif.platform }} · {{ aktif.oleh }} · {{ new Date(aktif.at).toLocaleString('id-ID') }} · {{ aktif.model }}
          </p>
          <UAlert
            class="mt-2"
            color="info"
            variant="subtle"
            title="Estimasi AI, bukan data pasar. Pola di bawah dibaca dari postingan brand ini; tren dan ide adalah perkiraan AI."
          />
          <p class="mt-2 text-sm">
            {{ String((aktif.hasil as Record<string, unknown>).ringkasan ?? '') }}
          </p>
          <AppSectionTitle
            title="Pola dari konten brand"
            class="mt-3"
          />
          <ul class="list-disc pl-5 text-sm">
            <li
              v-for="(p, i) in ((aktif.hasil as Record<string, unknown>).pola as Record<string, unknown>[] ?? [])"
              :key="i"
            >
              {{ String(p.temuan ?? '') }}{{ p.aksi ? ` — ${p.aksi}` : '' }}
            </li>
          </ul>
          <AppSectionTitle
            title="Tren"
            class="mt-3"
          />
          <ul class="list-disc pl-5 text-sm">
            <li
              v-for="(t, i) in ((aktif.hasil as Record<string, unknown>).tren as Record<string, unknown>[] ?? [])"
              :key="i"
            >
              {{ String(t.judul ?? '') }} (keyakinan {{ String(t.keyakinan ?? '—') }}) — {{ String(t.penjelasan ?? '') }}
            </li>
          </ul>
          <AppSectionTitle
            title="Ide konten"
            class="mt-3"
          />
          <div
            v-for="(ide, i) in ((aktif.hasil as Record<string, unknown>).ide as Record<string, unknown>[] ?? [])"
            :key="i"
            class="mt-2 rounded border border-default p-2"
          >
            <p class="text-sm font-medium">
              {{ String(ide.judul ?? '') }}
            </p>
            <p class="text-xs text-muted">
              {{ String(ide.platform ?? '') }}{{ ide.format ? ` · ${ide.format}` : '' }}{{ ide.hari ? ` · ${ide.hari}` : '' }}
            </p>
            <p
              v-if="ide.hook"
              class="text-sm"
            >
              <UIcon
                name="i-lucide-clapperboard"
                class="size-4"
              /> {{ String(ide.hook) }}
            </p>
            <p
              v-if="ide.caption"
              class="text-sm text-muted"
            >
              {{ String(ide.caption) }}
            </p>
            <div class="mt-1 flex gap-2">
              <UButton
                color="neutral"
                variant="soft"
                size="xs"
                icon="i-lucide-plus"
                @click="simpanKeBank(ide)"
              >
                Simpan ke Bank
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                size="xs"
                icon="i-lucide-calendar-plus"
                :to="`./kalender?tanggal=${hariIni()}`"
              >
                Jadwalkan
              </UButton>
            </div>
          </div>
          <AppSectionTitle
            title="Waktu tayang & hashtag"
            class="mt-3"
          />
          <p class="text-sm text-muted">
            {{ (((aktif.hasil as Record<string, unknown>).waktuTayang as string[]) ?? []).join(' · ') }}
          </p>
          <p class="text-sm text-muted">
            {{ (((aktif.hasil as Record<string, unknown>).hashtag as string[]) ?? []).join(' ') }}
          </p>
        </template>
      </AppPanel>

      <ResponsiveSheet
        v-model="bankBuka"
        title="Simpan ide ke Bank Konten"
      >
        <UFormField label="Judul ide *">
          <UInput v-model="bankForm.judul" />
        </UFormField>
        <UFormField label="Platform">
          <USelect
            v-model="bankForm.platform"
            :items="['TikTok', 'Instagram', 'YouTube']"
          />
        </UFormField>
        <UFormField label="Hook">
          <UInput v-model="bankForm.hook" />
        </UFormField>
        <UFormField label="Caption">
          <UTextarea
            v-model="bankForm.caption"
            :rows="3"
          />
        </UFormField>
        <UFormField label="Alasan">
          <UTextarea
            v-model="bankForm.alasan"
            :rows="2"
          />
        </UFormField>
        <template #actions>
          <UButton
            color="neutral"
            variant="soft"
            @click="bankBuka = false"
          >
            Batal
          </UButton>
          <UButton
            color="primary"
            loading-auto
            @click="simpanBank()"
          >
            Simpan ide
          </UButton>
        </template>
      </ResponsiveSheet>
    </AppPage>
  </KontenGerbang>
</template>
