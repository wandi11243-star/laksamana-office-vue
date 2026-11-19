// Lightweight cross-tab event bus for parallel browser tabs.
// Uses BroadcastChannel when available, with a localStorage `storage` event
// fallback. Same-tab echoes and duplicate deliveries are ignored via (asal, ts).

export type JenisSinkronTab = 'marketing-state' | 'auth-logout'

interface PesanTab {
  jenis: JenisSinkronTab
  asal: string
  ts: number
}

const SALURAN = 'laksamana-office-sync'
const KUNCI_STORAGE = 'lm-tab-sync'
const ASAL = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

let kanal: BroadcastChannel | null = null

function bukaKanal(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  if (!kanal) {
    try {
      kanal = new BroadcastChannel(SALURAN)
    }
    catch {
      kanal = null
    }
  }
  return kanal
}

/** Notify other open tabs of the same origin that shared state or auth changed. */
export function siarkanTab(jenis: JenisSinkronTab): void {
  if (typeof window === 'undefined') return
  const pesan: PesanTab = { jenis, asal: ASAL, ts: Date.now() }
  try {
    bukaKanal()?.postMessage(pesan)
  }
  catch {
    // Channel unavailable: fall through to localStorage below.
  }
  try {
    localStorage.setItem(KUNCI_STORAGE, JSON.stringify(pesan))
  }
  catch {
    // Private mode or blocked storage: ignore silently.
  }
}

/** Subscribe to cross-tab notifications from OTHER tabs. Returns an unsubscribe fn. */
export function dengarTab(aksi: (jenis: JenisSinkronTab) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  let terakhir = ''
  const terima = (raw: unknown) => {
    if (!raw || typeof raw !== 'object') return
    const p = raw as Partial<PesanTab>
    if (!p.jenis || !p.asal || !p.ts || p.asal === ASAL) return
    const kunci = `${p.asal}:${p.ts}:${p.jenis}`
    if (kunci === terakhir) return
    terakhir = kunci
    aksi(p.jenis)
  }

  const ch = bukaKanal()
  const onMsg = (ev: MessageEvent) => terima(ev.data)
  ch?.addEventListener('message', onMsg)

  const onStorage = (ev: StorageEvent) => {
    if (ev.key !== KUNCI_STORAGE || !ev.newValue) return
    try {
      terima(JSON.parse(ev.newValue))
    }
    catch {
      // Malformed storage payload: ignore.
    }
  }
  window.addEventListener('storage', onStorage)

  return () => {
    ch?.removeEventListener('message', onMsg)
    window.removeEventListener('storage', onStorage)
  }
}
