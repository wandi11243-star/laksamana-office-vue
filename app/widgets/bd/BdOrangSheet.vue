<!--
  Crew form (old `orangModal`, deploy/bd/index.html:4554-4609). Name, access
  and division belong to Office, so they cannot be edited here; only role/boss
  are BD OS's. The boss chain is checked for a cycle, which would otherwise
  freeze the page. A division outside the Office Tim list is kept as-is and
  marked "divisi lama", never cleared.
-->
<script setup lang="ts">
import type { BdPerson } from '~/composables/useBd'
import { bdSimpan, tambalBd, versiBaris } from '~/composables/useBd'
import { LABEL_TIM, PILIHAN_TANPA, timDariKet } from '~/utils/bd-rumus'
import { useRoster } from '~/composables/useRoster'

const props = defineProps<{
  orang?: BdPerson | null
  people: BdPerson[]
}>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()
const { data: roster } = useRoster()

/** The Office Tim of this crew (roster `keterangan`, officeUserId first then name). Read-only here. */
const timOffice = computed(() => {
  const o = props.orang
  if (!o) return []
  const list = roster.value ?? []
  const m = list.find(x => o.officeUserId && String(x.id) === String(o.officeUserId))
    || list.find(x => String(x.name || '').trim().toLowerCase() === String(o.name || '').trim().toLowerCase())
  return timDariKet(m?.keterangan)
})
/** A division outside the Office Tim list is kept as-is and marked, never cleared. */
const divLama = computed(() => {
  const d = String(props.orang?.div || '')
  return !!d && !LABEL_TIM.includes(d)
})

const f = reactive({ role: '', boss: PILIHAN_TANPA })

watch(open, (o) => {
  if (!o || !props.orang) return
  f.role = props.orang.role || ''
  f.boss = props.orang.boss || PILIHAN_TANPA
})

const opsiBoss = computed(() => [
  { value: PILIHAN_TANPA, label: '— tidak ada (puncak) —' },
  ...props.people.filter(p => p.id !== props.orang?.id).map(p => ({ value: p.id, label: p.name })),
])

function melingkar(orangId: string, bossId: string): boolean {
  let jalan = bossId
  let langkah = 0
  while (jalan && langkah++ < 200) {
    if (jalan === orangId) return true
    jalan = props.people.find(x => x.id === jalan)?.boss || ''
  }
  return false
}

async function simpan() {
  const orang = props.orang
  if (!orang) return
  if (f.boss !== PILIHAN_TANPA && melingkar(orang.id, f.boss)) {
    toast.add({ title: 'Atasan melingkar — orang ini sudah jadi atasan dari kru tersebut.', color: 'error' })
    return
  }
  const body: Partial<BdPerson> = {
    role: f.role.trim(),
    boss: f.boss === PILIHAN_TANPA ? '' : f.boss,
  }
  const ok = await bdSimpan(() => tambalBd<BdPerson>('people', orang.id, body, versiBaris(orang)), 'Data kru diperbarui')
  if (ok) open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="orang?.name || 'Kru'"
    description="Nama dan hak akses dikelola di Office › Kelola Akses."
  >
    <div class="grid grid-cols-1 gap-4">
      <p class="rounded-xl border border-default bg-muted p-3 text-xs text-muted">
        Nama, hak akses, dan divisi tidak bisa diubah dari sini — divisinya mengikuti kolom Tim di
        Office › Kelola User, perubahannya akan terbaca saat daftar disegarkan.
        Yang di bawah ini milik BD OS.
      </p>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Jabatan">
          <UInput
            v-model="f.role"
            placeholder="mis. BD Manager"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Divisi (dari Office — hanya baca)">
          <p class="flex flex-wrap items-center gap-1.5 text-sm">
            <b class="text-highlighted">{{ orang?.div || 'belum diatur' }}</b>
            <AppStatus
              v-if="divLama"
              color="warning"
              size="sm"
              title="Divisi ini tidak ada di daftar Tim Office — dipertahankan, sesuaikan lewat Kelola User"
            >
              divisi lama
            </AppStatus>
          </p>
          <template #hint>
            <template v-if="timOffice.length">
              Tim Office: <b>{{ timOffice.join(', ') }}</b>.
            </template>
            <template v-else>
              Kru ini belum cocok dengan Tim mana pun di Office — divisinya dipertahankan apa adanya.
            </template>
            Ubah lewat Office › Kelola User (kolom Tim).
          </template>
        </UFormField>
      </div>
      <UFormField label="Atasan langsung">
        <USelect
          v-model="f.boss"
          :items="opsiBoss"
          class="w-full"
        />
        <template #hint>
          Atasan menentukan siapa melihat task siapa: seorang atasan melihat task seluruh anak buahnya.
        </template>
      </UFormField>
      <div>
        <p class="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">
          Dari database account
        </p>
        <p class="text-xs text-muted">
          ID Office: <code>{{ orang?.officeUserId || '—' }}</code><br>
          Status: <b
            v-if="orang?.tanpaAkses"
            class="text-error"
          >akses modul bd sudah dicabut</b>
          <span v-else-if="orang?.active === false">akun nonaktif</span>
          <span v-else>aktif, punya akses modul bd</span>
        </p>
      </div>
    </div>

    <template #footer>
      <UButton
        label="Simpan"
        icon="i-lucide-check"
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
