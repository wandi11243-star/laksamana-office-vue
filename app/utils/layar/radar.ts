// The screens of Radar (laksamana-office deploy/radar, NAV + JUDUL). No role
// matrix: every holder of `radar` sees every screen (the old page had none),
// and since 27 Sep 2026 `radar` is built in for every account. Money figures
// are the API's call (`bolehUang`), not a screen rule.
//
// The Detail Lengkap page (`detail`) is opened from a card, not the menu.

export const LAYAR_RADAR: Layar[] = [
  { key: 'radar', label: 'Radar', desc: 'Pusat koordinasi', icon: 'i-lucide-radar', to: '/radar' },
  { key: 'kalender', label: 'Kalender terpadu', desc: 'Tiga modul, satu jadwal', icon: 'i-lucide-calendar-range', to: '/radar/kalender' },
  { key: 'agenda', label: 'Event', desc: 'Marketing + Event', icon: 'i-lucide-star', to: '/radar/agenda' },
  { key: 'reservasi', label: 'Reservasi', desc: 'Dari modul Reservasi', icon: 'i-lucide-book-open', to: '/radar/reservasi' },
  { key: 'promo', label: 'Promo', desc: 'Dari BD OS', icon: 'i-lucide-tag', to: '/radar/promo' },
]
