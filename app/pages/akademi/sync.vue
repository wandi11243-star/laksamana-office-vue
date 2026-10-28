<!--
  Sinkronisasi & Backup (deploy/akademi/index.html vSync, :1744-1799), admin
  only and READ-ONLY. v1 has no whole-state write, so the old "Kirim Sekarang"
  (pushToServer), "Ambil Ulang dari Server" (ambilDariServer) and "Pulihkan dari
  Backup" (importJSON/doImportJSON) cannot be built — they replace or overwrite
  the entire database. They stay visible as "Segera". The manual JSON backup is
  built from GET /state and downloads.
-->
<script setup lang="ts">
import { muatAkademiKru, useAkademiData, useAkademiState } from '~/composables/useAkademi'
import { tanggalJamMs, tanggalMs } from '~/utils/akademi-hitung'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['akademi'] })

const { isAdmin } = useAkademiData()
muatAkademiKru()
const { data: state } = useAkademiState()
const { apiBase } = useRuntimeConfig().public

const aktivitasTerakhir = computed(() => state.value.activity?.[0]?.ts ?? null)
const dibuat = computed(() => tanggalMs(state.value.createdAt))

function unduhBackup() {
  const teks = JSON.stringify(state.value, null, 1)
  const blob = new Blob([teks], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `akademi_laksamana_backup_${hariIni()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <AppPage
    title="Sinkronisasi & Backup"
    description="Data akademi tersimpan di database server, dipakai bersama semua device"
  >
    <AppPanel
      v-if="!isAdmin"
      title="Khusus admin modul"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Halaman ini hanya untuk admin modul Akademi.
      </p>
    </AppPanel>

    <template v-else>
      <AppPanel
        title="Status"
        icon="i-lucide-cloud"
      >
        <AppStatus
          color="success"
          icon="i-lucide-circle-check"
        >
          Tersinkron dengan database
        </AppStatus>
        <p class="mt-3 text-xs text-muted">
          Aktivitas terakhir: {{ aktivitasTerakhir ? tanggalJamMs(aktivitasTerakhir) : '—' }}
        </p>
        <p class="mt-1 text-xs text-muted">
          Data dibuat: {{ dibuat }}
        </p>
        <p class="mt-2 text-xs text-muted">
          Server: <span class="font-mono">{{ apiBase }}</span>
        </p>
      </AppPanel>

      <AppPanel
        title="Database"
        icon="i-lucide-database"
      >
        <p class="text-[13px] leading-relaxed text-muted">
          Semua perubahan (materi, kru, progress belajar) otomatis tersimpan ke database dan langsung terlihat di device lain. Tidak ada yang perlu diatur.
        </p>
        <p class="mt-2 text-[13px] leading-relaxed text-muted">
          Dulu data hanya tersimpan di browser masing-masing kru, progress tiap orang terkurung di device-nya, dan hilang kalau cache dibersihkan.
        </p>
        <p class="mt-2 text-[12.5px] text-muted">
          Kirim dan ambil ulang seluruh state ditiadakan di v1, setiap perubahan sudah ditulis per record ke server, jadi tidak ada lagi payload besar yang bisa saling menimpa.
        </p>
        <AppStatus
          color="neutral"
          icon="i-lucide-hourglass"
          class="mt-3"
        >
          Segera: tidak ada antrean sync manual
        </AppStatus>
      </AppPanel>

      <AppPanel
        title="Backup Manual"
        icon="i-lucide-archive"
      >
        <p class="text-[13px] text-muted">
          Unduh seluruh data (kru, materi, progress, program) sebagai file JSON, bisa diarsipkan atau dipindahkan ke device lain.
        </p>
        <div class="mt-3">
          <UButton
            label="Unduh Backup (.json)"
            icon="i-lucide-download"
            @click="unduhBackup"
          />
        </div>
        <p class="mt-2 text-[12.5px] text-muted">
          Pulihkan dari backup akan mengganti seluruh data di server, v1 belum punya endpoint whole-state. Sampai ada, pulihkan dilakukan di level database.
        </p>
        <AppStatus
          color="neutral"
          icon="i-lucide-hourglass"
          class="mt-2"
        >
          Segera: pulihkan dari backup
        </AppStatus>
      </AppPanel>
    </template>
  </AppPage>
</template>
