<!--
  "Sinkronkan dengan ESB" (kartuSinkronEsb + anSinkronEsb, :8133). One
  button, no month to pick: this month up to today, plus earlier months whose
  last sync did not reach their last day. Each month is pulled whole (a stored
  summary cannot take extra days without counting bills twice) and saved on
  its own, so a failure later on keeps the months already saved. A month
  that came from Excel is only replaced after asking.
  `ringkas` = the compact card on Ringkasan; otherwise the full card on Unggah.
-->
<script setup lang="ts">
import { saveAnalytics, useAnalyticsState } from '~/composables/useAnalytics'
import { tarikLaporanEsb } from '~/composables/useAnalyticsEsb'
import { esbAkhirBulan, esbBulanSinkron } from '~/utils/analytics-esb'
import { useAnalyticsIzin } from '~/utils/layar/analytics'
import { tanganiKonflik, versiDari } from '~/utils/versi'
import { BLN, angka } from '~/utils/format'

defineProps<{ ringkas?: boolean }>()

const toast = useToast()
const izin = useAnalyticsIzin()
const boleh = computed(() => izin.ubah('unggah'))
const { data: balasan, refresh } = useAnalyticsState()
const laporan = computed(() => balasan.value?.data?.data.laporan ?? {})
const fmtBln = (b: string) => {
  const p = b.split('-')
  return p.length === 2 ? `${BLN[Number(p[1]) - 1]} ${p[0]}` : b
}
const fmtTgl = (t: string) => new Date(`${t}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

const jalan = ref(false)
const teks = ref('')
const galat = ref('')
const ket = computed(() => {
  const L = laporan.value[hariIni().slice(0, 7)]
  if (L?.esb) {
    const at = L.esb.at ? new Date(L.esb.at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
    return `Bulan ini tersinkron s.d. ${fmtTgl(L.esb.sampai)}${at ? ` · ${at}` : ''}${L.esb.oleh ? ` oleh ${L.esb.oleh}` : ''}`
      + `${L.esb.billBatal ? ` · ${L.esb.billBatal} bill batal tidak dihitung` : ''}${L.esb.menuBatal ? ` · ${L.esb.menuBatal} menu batal tidak dihitung` : ''}`
  }
  return L ? 'Bulan ini diisi dari unggahan Excel — sinkron akan menggantinya dengan data ESB.' : 'Bulan ini belum pernah disinkronkan.'
})

async function sinkron() {
  if (!boleh.value || jalan.value || !balasan.value) return
  const daftar = esbBulanSinkron(laporan.value, hariIni())
  const dariExcel = daftar.filter(b => laporan.value[b] && !laporan.value[b]!.esb)
  if (dariExcel.length && !confirm(`Ringkasan ${dariExcel.map(fmtBln).join(', ')} saat ini dari unggahan Excel dan akan DIGANTI data ESB.\n\nLanjut?`)) return
  jalan.value = true
  galat.value = ''
  const hasil: string[] = []
  try {
    for (const b of daftar) {
      const sampai = esbAkhirBulan(b) < hariIni() ? esbAkhirBulan(b) : hariIni()
      const r = await tarikLaporanEsb(`${b}-01`, sampai, fmtBln(b), (t) => {
        teks.value = t
      })
      if (!r) {
        hasil.push(`${fmtBln(b)}: belum ada bill`)
        continue
      }
      if (r.bulan !== b) throw new Error(`ESB memulangkan data ${fmtBln(r.bulan)} untuk permintaan ${fmtBln(b)}.`)
      teks.value = `${fmtBln(b)}: menyimpan…`
      // saved month by month against the CURRENT version: a later failure keeps these
      await refresh()
      const isi = balasan.value?.data
      const v = versiDari(balasan.value)
      if (!isi || v === undefined) throw new Error('Data analytics belum termuat.')
      const L = { ...r.L, esb: { sampai, at: new Date().toISOString(), oleh: r.L.oleh, ...r.info, ganda: r.ganda } }
      try {
        await saveAnalytics({ ...isi.data, laporan: { ...isi.data.laporan, [b]: L } }, v)
      }
      catch (e) {
        if (await tanganiKonflik(e, refresh)) throw new Error(`${fmtBln(b)} disimpan orang lain duluan — tekan Sinkronkan lagi.`, { cause: e })
        throw new Error(`Gagal menyimpan ${fmtBln(b)} ke server: ${apiErrorMessage(e)}`, { cause: e })
      }
      hasil.push(`${fmtBln(b)}: ${angka(r.info.bill)} bill s.d. ${fmtTgl(sampai)}`)
    }
    await refresh()
    toast.add({ title: 'Tersinkron', description: hasil.join(' · '), color: 'success' })
    teks.value = ''
  }
  catch (e) {
    galat.value = `${(e as Error)?.message || String(e)}${hasil.length ? ` Yang sudah tersimpan: ${hasil.join(' · ')}.` : ''} Bulan yang gagal tidak berubah — tekan Sinkronkan lagi untuk mengulang.`
  }
  finally {
    jalan.value = false
  }
}
</script>

<template>
  <AppPanel
    v-if="boleh"
    :title="ringkas ? undefined : 'Sinkronkan dengan POS (ESB)'"
    :description="ringkas ? undefined : 'Menarik seluruh bill bulan ini sampai hari ini langsung dari ESB, lalu menyimpannya — tanpa memilih bulan dan tanpa berkas. Bulan lalu yang sinkron terakhirnya belum sampai akhir bulan ikut dilengkapi. Diringkas dengan aturan yang sama persis dengan unggahan Detail Report. Bulan-bulan lama tetap bisa diunggah dari Excel.'"
  >
    <UButton
      :label="jalan ? 'Menyinkronkan…' : 'Sinkronkan dengan ESB'"
      icon="i-lucide-refresh-cw"
      :loading="jalan"
      :disabled="jalan"
      @click="sinkron"
    />
    <p class="mt-2 text-xs text-muted">
      <template v-if="jalan">
        {{ teks || 'Menyinkronkan…' }} — jangan tutup halaman ini.
      </template>
      <template v-else>
        {{ ket }}
      </template>
    </p>
    <UAlert
      v-if="galat"
      class="mt-3"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :description="galat"
    />
  </AppPanel>
</template>
