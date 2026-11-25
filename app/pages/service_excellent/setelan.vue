<!--
  Setelan — the Google review link, the WhatsApp invitation switch, and the
  reward (minimum + Jumlah/Bonus tiers). One save writes `reviewCfg` with its
  loaded version. Below manager level the screen is read-only copy.
  Source: laksamana-office/deploy/service_excellent/index.html:8850-8897,
  save :8215-8241.
-->
<script setup lang="ts">
import type { ReviewCfg } from '~/composables/useServiceExcellent'
import { useSectionVersi, postAudit, putSection } from '~/composables/useReservasi'
import { apiErrorMessage } from '~/composables/useApi'
import { tanganiKonflik, versiDari } from '~/utils/versi'
import { bolehAksiSe, bolehBukaSe, tingkatSe } from '~/utils/layar/service_excellent'
import { normalisasiReward } from '~/utils/service-excellent'
import { angka } from '~/utils/format'

definePageMeta({ access: ['service_excellent'] })

const me = useMe()
const toast = useToast()
const tingkat = computed(() => tingkatSe(me.value))
const bolehUbah = computed(() => bolehAksiSe('master', tingkat.value))

const cfgSec = useSectionVersi<ReviewCfg>('reviewCfg')
const cfg = computed(() => cfgSec.data.value?.data)

// --- working copy ----------------------------------------------------------------
// Rows are added/removed locally: pressing + must not change the cfg, so only
// what these rows hold at Save is stored (`:8868-8873`).

const form = reactive({
  link: '',
  waAktif: true,
  min: 30,
  tiers: [{ rv: 0, bonus: 0 }] as { rv: number, bonus: number }[],
})

watch(() => cfgSec.data.value, (v) => {
  const c = v?.data
  if (!c) return
  const aturan = normalisasiReward({
    min: (c as { reward?: { min?: unknown } })?.reward?.min,
    tiers: (c as { reward?: { tiers?: unknown } })?.reward?.tiers,
  })
  form.link = c.link || ''
  form.waAktif = c.waAktif !== false
  form.min = aturan.min
  form.tiers = aturan.tiers.length ? aturan.tiers.map(t => ({ ...t })) : [{ rv: 0, bonus: 0 }]
}, { immediate: true })

function tambahTangga() {
  form.tiers.push({ rv: 0, bonus: 0 })
}

function hapusTangga(i: number) {
  form.tiers.splice(i, 1)
  if (!form.tiers.length) form.tiers.push({ rv: 0, bonus: 0 })
}

async function simpan() {
  if (!bolehUbah.value) return
  try {
    const lama = cfg.value
    const aturan = normalisasiReward({
      min: Math.max(0, Math.round(Number(form.min) || 0)),
      tiers: form.tiers.map(t => ({ rv: t.rv, bonus: t.bonus })),
    })
    const next: ReviewCfg = {
      link: form.link.trim(),
      waAktif: form.waAktif,
      target: lama?.target ?? 30,
      targets: (lama?.targets ?? {}) as ReviewCfg['targets'],
      counts: (lama?.counts ?? {}) as ReviewCfg['counts'],
      reward: aturan,
    }
    await putSection('reviewCfg', next, versiDari(cfgSec.data.value))
    await cfgSec.refresh()
    await postAudit({
      action: 'Google Review',
      detail: `Setelan review diperbarui (link, ajakan WA ${next.waAktif ? 'AKTIF' : 'DIMATIKAN'}, reward min ${aturan.min} & ${aturan.tiers.length} tangga)`,
    })
    toast.add({ title: 'Setelan review disimpan', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => cfgSec.refresh()))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <AppPage
    title="Setelan"
    description="Link Google Review, saklar ajakan WhatsApp, dan reward. Cukup diisi sekali."
  >
    <template v-if="bolehBukaSe('setelan', tingkat)">
      <div
        v-if="cfg && cfg.waAktif === false"
        class="mb-5 rounded-lg border border-default p-4 text-sm"
      >
        Ajakan WhatsApp <b>dimatikan</b> — tombol Minta Review hilang untuk semua orang. Data review tetap utuh.
      </div>

      <template v-if="bolehUbah">
        <AppList title="Google Review">
          <UFormField
            label="Link Google Review"
            class="px-4 py-4"
          >
            <UInput
              v-model="form.link"
              placeholder="https://g.page/r/xxxxxxxx/review"
              size="xl"
              class="w-full"
            />
            <p class="mt-1 text-xs text-muted">
              Dari Google Business Profile → Minta ulasan → Salin tautan. Link inilah yang dikirim ke WhatsApp tamu.
            </p>
          </UFormField>
          <div class="px-4 py-4">
            <label class="flex cursor-pointer items-start gap-3 rounded-lg border border-default p-4">
              <input
                v-model="form.waAktif"
                type="checkbox"
                class="mt-0.5 size-4.5"
              >
              <span class="text-sm">
                <b>Izinkan kru meminta review lewat WhatsApp</b>
                <span class="block text-xs text-muted">Kalau dimatikan, tombol Minta Review hilang. Catatan yang sudah ada tidak terpengaruh.</span>
              </span>
            </label>
          </div>
          <p class="px-4 py-3.5 text-sm text-muted">
            Target sebulan per nama diatur di <b>Dashboard → Atur target</b>.
          </p>
        </AppList>

        <AppList title="Reward review">
          <p class="px-4 py-3.5 text-sm leading-relaxed text-muted">
            Dari review <b>terverifikasi</b>. Dibayar <b>satu tangga tertinggi</b> yang dilewati, bukan dijumlah.
          </p>
          <UFormField
            label="Minimal review untuk ikut program"
            class="px-4 py-4"
          >
            <UInput
              v-model.number="form.min"
              type="number"
              :min="0"
              size="xl"
              class="w-full max-w-36"
            />
          </UFormField>
          <p class="px-4 py-3.5 text-sm text-muted">
            Tangga bonus — jumlah review dan nominalnya. Yang jumlahnya 0 dibuang saat disimpan.
          </p>
          <div
            v-for="(t, i) in form.tiers"
            :key="i"
            class="flex items-end gap-3 px-4 py-3.5"
          >
            <UFormField
              :label="`Tangga ${i + 1} — jumlah review`"
              class="max-w-36 flex-1"
            >
              <UInput
                v-model.number="t.rv"
                type="number"
                :min="0"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Bonus (Rp)"
              class="max-w-44 flex-1"
            >
              <UInput
                v-model.number="t.bonus"
                type="number"
                :min="0"
                class="w-full"
              />
            </UFormField>
            <UButton
              label="Hapus"
              color="error"
              variant="ghost"
              size="sm"
              @click="hapusTangga(i)"
            />
          </div>
          <div class="flex flex-wrap gap-2 px-4 py-4">
            <UButton
              label="Tambah tangga"
              color="neutral"
              variant="soft"
              size="sm"
              @click="tambahTangga"
            />
          </div>
        </AppList>

        <div class="mb-7 max-w-xl">
          <AppFocus
            label="Setelan"
            :value="`${angka(form.tiers.filter(t => t.rv > 0).length)} tangga`"
            :hint="`minimal ${angka(form.min)} review · link ${form.link ? 'terisi' : 'kosong'} · WA ${form.waAktif ? 'aktif' : 'mati'}`"
          >
            <UButton
              label="Simpan setelan"
              size="xl"
              loading-auto
              @click="simpan"
            />
          </AppFocus>
        </div>
      </template>
      <p
        v-else
        class="text-muted"
      >
        Setelan diatur oleh manager.
      </p>
    </template>
    <p
      v-else
      class="text-muted"
    >
      Tidak ada akses.
    </p>
  </AppPage>
</template>
