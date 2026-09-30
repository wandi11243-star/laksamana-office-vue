// The screens of the Homepage module (greenfield: the old Office never had a
// website panel). One module, three access keys: `menu` opens the catalogue,
// `news` opens Berita and `homepage` opens the Event switch on the website; the
// overview shows whatever the person holds.
import type { Me } from '~/composables/useMe'

export const LAYAR_HOMEPAGE: Layar[] = [
  { key: 'ringkasan', label: 'Ringkasan', desc: 'Yang sedang tampil di website', icon: 'i-lucide-layout-dashboard', to: '/homepage' },
  { key: 'menu', label: 'Menu', desc: 'Katalog, harga, habis hari ini', icon: 'i-lucide-utensils', to: '/homepage/menu', boleh: (me: Me) => me.modules.includes('menu') },
  { key: 'berita', label: 'Berita', desc: 'Kabar dari Laksamana', icon: 'i-lucide-newspaper', to: '/homepage/berita', boleh: (me: Me) => me.modules.includes('news') },
  { key: 'event', label: 'Event', desc: 'Event yang tampil di website', icon: 'i-lucide-mic-vocal', to: '/homepage/event', boleh: (me: Me) => me.modules.includes('homepage') },
]
