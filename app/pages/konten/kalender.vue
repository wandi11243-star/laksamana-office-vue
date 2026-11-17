<!--
  Konten › Kalender Posting (deploy/konten/analytics/index.html #kalender;
  #133). Pengingat manual (posting otomatis belum aktif): salin caption,
  posting dari HP, tandai Tayang + tautan.
-->
<script setup lang="ts">
import type { JadwalCampaign, JadwalInput } from '~/composables/useCampaign'
import { hariIni, ymdLokal } from '~/utils/format'

definePageMeta({ access: ['konten', 'campaign'] })

const toast = useToast()
const { data: st, error, refresh } = useStateCampaign()

const bulan = ref(new Date())
const bulanJudul = computed(() => bulan.value.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }))
const selTanggal = ref(hariIni())

const selHari = computed(() => {
  const y = bulan.value.getFullYear()
  const m = bulan.value.getMonth()
  const awal = new Date(y, m, 1)
  const mulai = (awal.getDay() + 6) % 7 // Senin pertama
  const hari: string[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(y, m, 1 - mulai + i)
    hari.push(ymdLokal(d)) // local midnight: toISOString() labelled every cell with the day before
  }
  return { y, m, hari }
})
const jadwalBulanIni = computed(() => (st.value?.jadwal ?? []).filter(j => j.tanggal.startsWith(`${selHari.value.y}-${String(selHari.value.m + 1).padStart(2, '0')}`)))
const jadwalTelat = computed(() => (st.value?.jadwal ?? []).filter((j) => {
  if (j.status !== 'TERJADWAL' || !j.tanggal) return false
  const kapan = new Date(`${j.tanggal}T${j.jam || '00:00'}:00+07:00`).getTime()
  return kapan < Date.now()
}))
const jadwalTanggal = computed(() => (st.value?.jadwal ?? []).filter(j => j.tanggal === selTanggal.value))

function geserBulan(n: number) {
  bulan.value = new Date(bulan.value.getFullYear(), bulan.value.getMonth() + n, 1)
}

const formBuka = ref(false)
const form = ref<JadwalInput>({
  platform: 'TikTok', status: 'TERJADWAL', judul: '', caption: '', tanggal: '', jam: '', pic: '', tautan: '', insightId: '', catatan: '',
})
function bukaForm(j?: JadwalCampaign, preset?: Partial<JadwalInput>) {
  form.value = j
    ? {
        id: j.id, platform: j.platform, judul: j.judul, caption: j.caption, tanggal: j.tanggal, jam: j.jam,
        status: j.status, insightId: j.insight_id, pic: j.pic, tautan: j.tautan, catatan: j.catatan,
      }
    : { platform: 'TikTok', status: 'TERJADWAL', judul: '', caption: '', tanggal: selTanggal.value, jam: '', pic: '', tautan: '', insightId: '', catatan: '', ...preset }
  formBuka.value = true
}
async function simpanForm() {
  const v = form.value
  const cur = v.id ? st.value?.jadwal.find(x => x.id === v.id) : undefined
  const ok = await campaignSimpan(
    () => simpanJadwalCampaign(v, cur ? (cur.diubah_at ?? cur.dibuat_at) : undefined), 'Jadwal disimpan.')
  if (ok) {
    formBuka.value = false
    refresh()
  }
}
async function salinCaption(caption: string) {
  try {
    await navigator.clipboard.writeText(caption)
    toast.add({ title: 'Caption disalin — tinggal paste di postingan.', color: 'success' })
  }
  catch { toast.add({ title: 'Gagal menyalin caption.', color: 'error' }) }
}
</script>

<template>
  <KontenGerbang lihat="kalender">
    <AppPage
      title="Kalender Posting"
      description="Rencana posting & pengingat tayang"
    >
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Analytics: ${apiErrorMessage(error)}`"
      />
      <UAlert
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        title="Posting otomatis belum aktif. TikTok mewajibkan audit aplikasi untuk Content Posting API, jadi untuk sekarang kalender ini jadi pengingat: saat jamnya tiba, salin caption-nya, posting dari HP, lalu tandai Tayang berikut tautannya."
      />

      <AppPanel
        v-if="jadwalTelat.length"
        title="Sudah waktunya diposting"
      >
        <div
          v-for="j in jadwalTelat"
          :key="j.id"
          class="border-b border-default py-2"
        >
          <p class="text-sm font-medium">
            {{ j.judul }}
          </p>
          <p class="text-xs text-muted">
            {{ j.platform }} · {{ j.tanggal }}{{ j.jam ? ` · ${j.jam}` : '' }}
          </p>
          <UButton
            color="neutral"
            variant="soft"
            size="xs"
            class="mt-1"
            @click="bukaForm(j)"
          >
            Sunting
          </UButton>
        </div>
      </AppPanel>

      <AppPanel
        title="Kalender konten"
        :description="`${jadwalBulanIni.length} konten di kalender. Bawa insight & ide riset ke sini lewat tombol Kalender / Jadwalkan.`"
      >
        <template #actions>
          <UButton
            color="primary"
            size="xs"
            @click="bukaForm()"
          >
            + Jadwalkan konten
          </UButton>
        </template>
        <div class="flex items-center gap-2">
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="ghost"
            @click="geserBulan(-1)"
          />
          <span class="text-sm font-medium capitalize">{{ bulanJudul }}</span>
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="ghost"
            @click="geserBulan(1)"
          />
          <UButton
            color="neutral"
            variant="soft"
            size="xs"
            @click="bulan = new Date(); selTanggal = hariIni()"
          >
            Hari ini
          </UButton>
        </div>
        <div class="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-muted">
          <span
            v-for="h in ['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg']"
            :key="h"
          >{{ h }}</span>
        </div>
        <div class="grid grid-cols-7 gap-1">
          <button
            v-for="t in selHari.hari"
            :key="t"
            class="min-h-11 rounded border p-1 text-left text-xs"
            :class="t === selTanggal ? 'border-primary' : 'border-default'"
            @click="selTanggal = t"
          >
            <span :class="t.slice(0, 7) !== `${selHari.y}-${String(selHari.m + 1).padStart(2, '0')}` ? 'text-muted' : ''">
              {{ Number(t.slice(8)) }}
            </span>
            <span
              v-if="(st?.jadwal ?? []).some(j => j.tanggal === t)"
              class="ml-1 inline-block size-1.5 rounded-full bg-primary"
            />
          </button>
        </div>
        <div class="mt-3 flex items-center justify-between">
          <p class="text-sm font-medium">
            {{ selTanggal }}
          </p>
          <UButton
            color="neutral"
            variant="soft"
            size="xs"
            @click="bukaForm()"
          >
            + Jadwalkan di tanggal ini
          </UButton>
        </div>
        <div
          v-for="j in jadwalTanggal"
          :key="j.id"
          class="mt-2 rounded border border-default p-2"
        >
          <div class="flex items-center gap-2">
            <AppStatus :status="j.status" />
            <span class="text-xs text-muted">{{ j.platform }}</span>
            <span class="flex-1 truncate text-sm font-medium">{{ j.judul }}</span>
          </div>
          <p class="mt-1 text-xs text-muted">
            {{ j.tanggal }}{{ j.jam ? ` · ${j.jam}` : '' }}{{ j.pic ? ` · PIC: ${j.pic}` : '' }}
          </p>
          <p
            v-if="j.caption"
            class="mt-1 line-clamp-2 text-sm"
          >
            {{ j.caption }}
          </p>
          <div class="mt-1 flex gap-2">
            <UButton
              v-if="j.caption"
              color="neutral"
              variant="soft"
              size="xs"
              loading-auto
              @click="salinCaption(j.caption)"
            >
              Salin caption
            </UButton>
            <UButton
              v-if="j.tautan"
              color="neutral"
              variant="ghost"
              size="xs"
              :to="j.tautan"
              target="_blank"
            >
              ↗ Postingan
            </UButton>
            <UButton
              color="neutral"
              variant="soft"
              size="xs"
              @click="bukaForm(j)"
            >
              Sunting
            </UButton>
          </div>
        </div>
      </AppPanel>

      <ResponsiveSheet
        v-model="formBuka"
        :title="form.id ? 'Sunting jadwal' : 'Jadwalkan konten'"
      >
        <UFormField label="Platform">
          <USelect
            v-model="form.platform"
            :items="['TikTok', 'Instagram', 'YouTube']"
          />
        </UFormField>
        <UFormField label="Status">
          <USelect
            v-model="form.status"
            :items="['DRAF', 'TERJADWAL', 'TAYANG', 'BATAL']"
          />
        </UFormField>
        <UFormField label="Judul konten *">
          <UInput v-model="form.judul" />
        </UFormField>
        <UFormField label="Caption">
          <UTextarea
            v-model="form.caption"
            :rows="3"
          />
        </UFormField>
        <UFormField label="Tanggal tayang *">
          <UInput
            v-model="form.tanggal"
            type="date"
          />
        </UFormField>
        <UFormField label="Jam tayang (WIB)">
          <UInput
            v-model="form.jam"
            type="time"
          />
        </UFormField>
        <UFormField label="PIC (siapa yang memposting)">
          <UInput v-model="form.pic" />
        </UFormField>
        <UFormField label="Tautan postingan (wajib kalau Tayang)">
          <UInput
            v-model="form.tautan"
            placeholder="https://…"
          />
        </UFormField>
        <UFormField label="Dari insight">
          <USelect
            v-model="form.insightId"
            :items="[{ label: '— tanpa insight —', value: '' },
                     ...((st?.insight ?? []).filter(i => !i.arsip).map(i => ({ label: `${i.platform} · ${i.temuan.slice(0, 60)}`, value: i.id })))]"
          />
        </UFormField>
        <UFormField label="Catatan">
          <UTextarea
            v-model="form.catatan"
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
            Simpan jadwal
          </UButton>
        </template>
      </ResponsiveSheet>
    </AppPage>
  </KontenGerbang>
</template>
