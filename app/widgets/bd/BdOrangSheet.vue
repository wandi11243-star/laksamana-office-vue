<!--
  Crew form (old `orangModal`, deploy/bd/index.html:4554-4609). Name and access
  belong to Office, so they cannot be edited here; only role/div/boss are BD OS's.
  The boss chain is checked for a cycle, which would otherwise freeze the page.
-->
<script setup lang="ts">
import type { BdPerson } from '~/composables/useBd'
import { bdSimpan, tambalBd, versiBaris } from '~/composables/useBd'
import { OWNER_DIVS, PILIHAN_TANPA } from '~/utils/bd-rumus'

const props = defineProps<{
  orang?: BdPerson | null
  people: BdPerson[]
}>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const f = reactive({ role: '', div: PILIHAN_TANPA, boss: PILIHAN_TANPA })

watch(open, (o) => {
  if (!o || !props.orang) return
  f.role = props.orang.role || ''
  f.div = props.orang.div || PILIHAN_TANPA
  f.boss = props.orang.boss || PILIHAN_TANPA
})

const opsiDiv = [{ value: PILIHAN_TANPA, label: '— belum diatur —' }, ...OWNER_DIVS.map(d => ({ value: d, label: d }))]
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
    div: f.div === PILIHAN_TANPA ? '' : f.div,
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
    <div class="grid gap-4">
      <p class="rounded-xl border border-default bg-muted p-3 text-xs text-muted">
        Nama dan hak akses tidak bisa diubah dari sini — perubahannya akan ditimpa saat daftar disegarkan.
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
        <UFormField label="Divisi">
          <USelect
            v-model="f.div"
            :items="opsiDiv"
            class="w-full"
          />
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
