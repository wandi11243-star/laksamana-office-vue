<!--
  Konten › Profil Saya (old VIEWS.profile, deploy/konten/index.html:
  4792-4812; konten.md D.20). Not in the menu: reached from the module
  sidebar's footer button. Name, division · email, the roles held ("rangkap
  kerja" when more than one), three figures (Total task = content where I am
  PIC, Selesai = of those Posted, Kapasitas) and the PIN note. "Keluar ke
  Office" goes back to Office without signing out, like the old logout().
-->
<script setup lang="ts">
import type { RoleKonten } from '~/utils/konten'
import { ROLES_KONTEN } from '~/utils/konten'
import { rolesKru } from '~/utils/sistem-konten'
import { angka } from '~/utils/format'

definePageMeta({ access: ['konten'] })

const { data: st, error } = useStateKonten()
const { saya } = useAksesKonten()
const u = computed(() => saya.value?.user ?? null)
const roles = computed(() => (saya.value?.super && !rolesKru(u.value).includes('super_admin') ? ['super_admin', ...rolesKru(u.value)] : rolesKru(u.value)))
const tugas = computed(() => st.value.content.filter(c => c.pic === u.value?.id))
const inisial = computed(() => String(u.value?.name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase())
</script>

<template>
  <AppPage
    title="Profil saya"
    description="Akun & preferensi"
  >
    <template #actions>
      <UButton
        label="Keluar ke Office"
        icon="i-lucide-power"
        color="neutral"
        variant="outline"
        to="/"
      />
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
    />

    <AppPanel
      v-if="u"
      class="max-w-2xl"
    >
      <div class="flex items-center gap-4">
        <span class="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-lg font-bold text-white">{{ inisial }}</span>
        <div class="min-w-0">
          <h2 class="text-xl font-semibold text-highlighted">
            {{ u.name }}
          </h2>
          <p class="text-sm text-muted">
            {{ [u.division, u.email].filter(Boolean).join(' - ') || '—' }}
          </p>
        </div>
      </div>
      <p class="mt-5 mb-2 text-xs font-semibold text-muted">
        Role kamu{{ roles.length > 1 ? ' (rangkap kerja)' : '' }}
      </p>
      <ul class="space-y-1.5">
        <li
          v-for="r in roles"
          :key="r"
          class="rounded-lg border-s-4 border-primary-400 bg-muted px-3 py-2"
        >
          <b class="text-sm">{{ ROLES_KONTEN[r as RoleKonten]?.label ?? r }}</b>
          <span class="block text-xs text-muted">{{ ROLES_KONTEN[r as RoleKonten]?.desc }}</span>
        </li>
      </ul>
      <p
        v-if="saya?.sementara"
        class="mt-2 text-xs text-muted"
      >
        Kamu belum punya baris kru di modul ini; role di atas sementara sampai admin modul menyinkronkan kru.
      </p>
      <AppStatGrid class="mt-5">
        <AppStat
          label="Total task"
          :value="angka(tugas.length)"
        />
        <AppStat
          label="Selesai"
          :value="angka(tugas.filter(c => c.status === 'Posted').length)"
          tone="success"
        />
        <AppStat
          label="Kapasitas"
          :value="angka(u.capacity ?? 0)"
          tone="info"
        />
      </AppStatGrid>
      <p class="text-xs text-muted">
        <b>PIN akses</b> — login kini dikelola lewat Office. Hubungi admin untuk mengubah PIN kamu.
      </p>
    </AppPanel>
  </AppPage>
</template>
