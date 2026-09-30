// The screens of the Homepage module (greenfield: the old Office never had a
// website panel). One module, two access keys: `menu` opens the catalogue,
// `news` opens Berita; the overview shows whatever the person holds.
import type { Me } from '~/composables/useMe'

export const LAYAR_HOMEPAGE: Layar[] = [
  { key: 'ringkasan', label: 'Ringkasan', desc: 'Yang sedang tampil di website', icon: 'i-lucide-layout-dashboard', to: '/homepage' },
  { key: 'menu', label: 'Menu', desc: 'Katalog, harga, habis hari ini', icon: 'i-lucide-utensils', to: '/homepage/menu', boleh: (me: Me) => me.modules.includes('menu') },
  { key: 'berita', label: 'Berita', desc: 'Kabar dari Laksamana', icon: 'i-lucide-newspaper', to: '/homepage/berita', boleh: (me: Me) => me.modules.includes('news') },
]
