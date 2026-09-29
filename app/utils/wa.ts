// WhatsApp messages, composed in the browser. No API, no account token.
//
// The old client opened `whatsapp://send` — the APP only, with no web fallback on
// purpose ("if the app is not installed, the browser does nothing"). That reads
// as a dead button on a desktop browser, and crew do use desks, so these open
// wa.me (which WhatsApp itself redirects to the app when it is installed) and the
// text is copied to the clipboard either way: the message is written from the
// screen's data, so a copy-paste must always remain possible.
//
// Source: laksamana-office/deploy/reservasi/index.html:3285-3295.

// "0812…" -> "62812…", the form wa.me expects.
function nomorWa(phone?: string | null): string {
  let x = String(phone ?? '').replace(/\D/g, '')
  if (x.startsWith('0')) x = `62${x.slice(1)}`
  else if (x.length > 0 && !x.startsWith('62')) x = `62${x}`
  return x
}

/**
 * Open WhatsApp with `teks` for `phone` (blank phone = share to a contact), and
 * copy the text. Returns the url so a caller can show it if the tab was blocked.
 */
export async function waKirim(phone: string | null | undefined, teks: string): Promise<string> {
  const p = nomorWa(phone)
  const url = p
    ? `https://wa.me/${p}?text=${encodeURIComponent(teks)}`
    : `https://wa.me/?text=${encodeURIComponent(teks)}`

  try {
    await navigator.clipboard.writeText(teks)
  }
  catch {
    // A clipboard refusal (no permission, insecure context) must not stop the
    // message itself from being sent.
  }
  window.open(url, '_blank', 'noopener')
  return url
}

/** Just the link, for a button that offers to copy it. */
export const waTautan = (phone: string | null | undefined, teks: string) => {
  const p = nomorWa(phone)
  return p
    ? `https://wa.me/${p}?text=${encodeURIComponent(teks)}`
    : `https://wa.me/?text=${encodeURIComponent(teks)}`
}

/** "Kabari tamu dari antrean" (`:1975-1982`). Emoji inside the message is the old
 *  wording and stays: this text lands in a chat, not in the app. */
export const teksPanggilAntrean = (nama: string, pax: number, meja?: string) =>
  `Halo Kak ${nama} 👋\n\nMeja untuk ${pax} orang sudah siap${meja ? ` (${meja})` : ''} di *Laksamana Muda* ⚓\nSilakan menuju ke host kami ya.\n\nTerima kasih sudah menunggu 🙏`
