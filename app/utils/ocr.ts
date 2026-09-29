// OCR: read a transfer proof into a SUGGESTION, never a filled-in value.
//
// tesseract.js (K-05) loads through a dynamic import the first time a scan
// runs — it is not in the first bundle. The language model itself still comes
// from the network at worker creation, exactly like the old CDN script: a scan
// needs internet, and the caller says so when it fails.
//
// Owned by reservasi (PLAN.md §4), read by DanaMasukPanel.
//
// Source: laksamana-office/deploy/reservasi/index.html:8515-8573 (loader,
// worker, prep, read), :9637-9696 (applyOcr, per-column suggestions).

import type { Worker } from 'tesseract.js'
import type { ReservasiDp } from '~/composables/useReservasi'
import { fmtRupiah, tglPendek } from './format'
import { parseTeksTransfer, tglSeharusnya, type HasilParseTransfer } from './ocr-transfer'

let memuat: Promise<typeof import('tesseract.js')> | null = null
let pekerja: Worker | null = null

async function muatOcr() {
  if (!memuat) {
    memuat = import('tesseract.js').catch((e: unknown) => {
      memuat = null
      throw e
    })
  }
  return memuat
}

/** The shared worker. Bank receipts are digits + bank names, so "eng" is the most stable model (`:8534`). */
export async function pekerjaOcr(): Promise<Worker> {
  if (!pekerja) {
    const T = await muatOcr()
    pekerja = await T.createWorker('eng')
  }
  return pekerja
}

/**
 * Proofs arrive small and slightly blurry (compressed at upload). Upscaled and
 * pushed to high-contrast black-and-white so digits read better (`:8536-8565`).
 * Gamma darkens mid-tones: grey date/time print (Livin, SeaBank) turns blacker
 * while white stays white. Never a contrast stretch around 128 — that bleaches
 * grey text away.
 */
export function siapkanGambarOcr(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(3, Math.max(1, 1700 / (img.width || 1)))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const x = c.getContext('2d')
      if (!x) {
        resolve(dataUrl)
        return
      }
      x.drawImage(img, 0, 0, w, h)
      try {
        const d = x.getImageData(0, 0, w, h)
        const p = d.data
        for (let i = 0; i < p.length; i += 4) {
          const g = (0.299 * p[i]! + 0.587 * p[i + 1]! + 0.114 * p[i + 2]!) / 255
          const v = Math.round(255 * Math.pow(g, 1.6))
          p[i] = p[i + 1] = p[i + 2] = v < 0 ? 0 : v > 255 ? 255 : v
        }
        x.putImageData(d, 0, 0)
        resolve(c.toDataURL('image/png'))
      }
      catch {
        resolve(dataUrl) // tainted canvas / failure -> use the original
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

/** Read the text out of a proof image (`:8567-8573`). */
export async function ocrBaca(dataUrl: string): Promise<string> {
  const w = await pekerjaOcr()
  const img = await siapkanGambarOcr(dataUrl)
  const { data } = await w.recognize(img)
  return (data && data.text) || ''
}

/**
 * Store the machine result as a suggestion (`:9637-9643`). Raw text is kept
 * verbatim for checking, capped so the row does not bloat. The passed object
 * is mutated — the caller hands over its own copy, never shared state.
 */
export function terapkanOcr(p: ReservasiDp, hasil: HasilParseTransfer, teks: string): ReservasiDp {
  p.tfOcrSaran = {
    date: hasil.date || '',
    time: hasil.time || '',
    bank: hasil.bank || '',
    name: hasil.name || '',
    amount: Number(hasil.amount) || 0,
  }
  p.tfOcrAt = Date.now()
  p.tfOcrText = String(teks || '').slice(0, 1200)
  return p
}

export type KunciSaran = 'date' | 'time' | 'bank' | 'name' | 'amount'

/**
 * The machine suggestion for ONE column — returned only when non-empty AND
 * different from what is stored. A suggestion echoing its own box teaches
 * people to stop reading (`:9645-9673`).
 */
export function saranOcr(p: ReservasiDp, kunci: KunciSaran): string | number {
  const s = p?.tfOcrSaran
  if (!s) return ''
  if (kunci === 'amount') {
    const v = Number(s.amount) || 0
    return (v > 0 && v !== (Number(p.tfAmount) || 0)) ? v : ''
  }
  const v = String(s[kunci] || '').trim()
  if (!v) return ''
  const kini = kunci === 'date'
    ? String(p.tfDate || '')
    : kunci === 'time'
      ? String(p.tfTime || '')
      : kunci === 'bank'
        ? String(p.tfBank || '')
        : String(p.tfName || '')
  if (kini === v) return ''
  /* A date equal to the Ref stamp is not drawn twice: the stamp hint sits
     right above it and is stronger — its time is proven to match, while this
     is only a date-line read (`:9668-9672`). */
  if (kunci === 'date' && tglSeharusnya(p.tfOcrText, p.tfTime, p.tfDate) === v) return ''
  return v
}

/** Parse + store in one step, for the scan buttons. Returns the parsed columns. */
export function pakaiHasilOcr(p: ReservasiDp, teks: string): HasilParseTransfer {
  const hasil = parseTeksTransfer(teks)
  terapkanOcr(p, hasil, teks)
  return hasil
}

export function saranTampil(kunci: KunciSaran, v: string | number): string {
  return kunci === 'amount' ? fmtRupiah(Number(v)) : kunci === 'date' ? tglPendek(String(v)) : String(v)
}
