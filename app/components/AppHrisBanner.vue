<!--
  Migration notice for the two modules HRIS takes over (ADR-0012 J9):
  Jadwal and HR stay readable in Office during the two-week parallel period,
  while new work happens in laksamana-hris. The link opens HRIS in a new tab so
  the Office session is never lost.
-->
<script setup lang="ts">
import { HRIS } from '~/utils/hris'

const props = defineProps<{ modul: 'jadwal' | 'hr' }>()

const isi = computed(() => props.modul === 'jadwal'
  ? {
      judul: 'Jadwal dan master shift sekarang di HRIS',
      pesan: 'Roster, master shift, blok SPLIT, pengajuan, dan data kru diubah di HRIS. Layar Jadwal di Office sekarang hanya bisa dibaca.',
      aksi: 'Buka roster HRIS',
      ke: HRIS.roster,
    }
  : {
      judul: 'Data HR sekarang di HRIS',
      pesan: 'Karyawan, divisi, jabatan, struktur, shift, roster, pelanggaran, KPI tim, dan penilaian atasan pindah ke HRIS. Selama masa paralel, panel HR di Office masih bisa dibaca.',
      aksi: 'Buka HRIS',
      ke: HRIS.kelola,
    })
</script>

<template>
  <UAlert
    color="info"
    variant="subtle"
    icon="i-lucide-external-link"
    orientation="vertical"
    :title="isi.judul"
    :description="isi.pesan"
    :actions="[{
      label: isi.aksi,
      to: isi.ke,
      target: '_blank',
      rel: 'noopener',
      color: 'neutral',
      variant: 'outline',
      icon: 'i-lucide-arrow-up-right',
    }]"
  />
</template>
