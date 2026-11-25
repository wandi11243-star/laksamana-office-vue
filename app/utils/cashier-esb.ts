import type { ComplimentKasir, RokokItem, VoidItemForm } from './cashier'

type Obj = Record<string, unknown>
const arr = (v: unknown): Obj[] => Array.isArray(v) ? v.filter(x => x && typeof x === 'object') as Obj[] : []
const n = (v: unknown) => Number(v) || 0
const batal = /cancel|void|batal/i
const baku = (v: unknown) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
const ORDER_RE = /^\s*ESB\s*ORDER\s*$/i
const PETA_BAYAR: Record<string, string> = {
  CASH: 'cash', TUNAI: 'cash', COMPLIMENT: 'compliment', COMPLIMENTARY: 'compliment',
  EDCBCA: 'edc_bca', EDCBRI: 'edc_bri', EDCMANDIRI: 'edc_mandiri',
  ERRORBAR: 'error_bar', ERRORCUSTOMER: 'error_customer', ERRORFLOOR: 'error_floor',
  ERRORKASIR: 'error_kasir', ERRORCASHIER: 'error_kasir', ERRORKITCHEN: 'error_kitchen',
  GOFOOD: 'gofood', GRABFOOD: 'grabfood', MEMBERDEPOSIT: 'member_dep', DEPOSIT: 'member_dep',
  QRISBCA: 'qris_bca', QRISBRI: 'qris_bri', QRISMANDIRI: 'qris_mandiri', QRISESB: 'qris_esb', QRISPOS: 'qris_esb',
  TIKTOKGO: 'tiktokgo', TRANSFERUOB: 'transfer_uob', TRANSFER: 'transfer_uob', VOUCHER: 'voucher',
  XENDIT: 'xendit',
}
const BUKAN_QRIS = new Set(['cash', 'voucher', 'compliment', 'member_dep', 'edc_bca', 'edc_bri', 'edc_mandiri', 'error_bar', 'error_customer', 'error_floor', 'error_kasir', 'error_kitchen'])
const keyBayar = (v: unknown) => PETA_BAYAR[String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')] || ''
const nilaiMenu = (m: Obj) => n(m.price) * n(m.qty) + arr(m.extras).reduce((s, x) => s + n(x.price) * n(x.qty), 0)

export interface EsbVoid { bill: string, utuh: boolean, waiter: string, alasan: string, items: { item: string, qty: number, sub: number }[], meja: string }
export interface EsbCompliment { bill: string, jenis: string, nominal: number, tax: number, service: number, subTotal: number, info: string, menu: string[], akun: string, kasir: string, meja: string }
export interface EsbKasirAkun { amount: number, disc: number, n: number }
export interface EsbHari { kasir: Record<string, EsbKasirAkun>, self: EsbKasirAkun, food: number, bev: number, lainnya: number, disc: number, svc: number, tax: number, grand: number, pax: number, qty: { food: number, bev: number, lainnya: number }, nBill: number, nBatal: number, bayar: Record<string, number>, asing: Record<string, number>, order: { n: number, nil: number }, void: EsbVoid[], komp: EsbCompliment[], menuQty: Record<string, { qty: number, kat: string, kel: string }> }

/** Shared one-day POS summarizer used by the cashier import panels. */
export function ringkasEsb(bills: unknown[]): EsbHari {
  const R: EsbHari = { kasir: {}, self: { amount: 0, disc: 0, n: 0 }, food: 0, bev: 0, lainnya: 0, disc: 0, svc: 0, tax: 0, grand: 0, pax: 0, qty: { food: 0, bev: 0, lainnya: 0 }, nBill: 0, nBatal: 0, bayar: {}, asing: {}, order: { n: 0, nil: 0 }, void: [], komp: [], menuQty: {} }
  for (const B of arr(bills)) {
    const bill = String(B.salesNum ?? '')
    if (!bill) continue
    const menus = arr(B.salesMenus)
    if (batal.test(String(B.statusName ?? ''))) {
      R.nBatal++
      const items = menus.map(M => ({ item: String(M.menuName ?? '').trim(), qty: n(M.qty), sub: nilaiMenu(M) })).filter(x => x.item)
      if (items.length) R.void.push({ bill, utuh: true, waiter: namaKasirEsb(B.createdBy), alasan: String(B.cancelNotes || B.additionalInfo || '').trim(), items, meja: String(B.tableName ?? '') })
      continue
    }
    R.nBill++
    const order = ORDER_RE.test(String(B.visitPurposeName ?? ''))
    const grand = n(B.grandTotal)
    const live = menus.filter(M => !batal.test(String(M.statusName ?? '')))
    const kat = { food: 0, bev: 0, lainnya: 0 }
    for (const menu of live) {
      const category = String(menu.menuCategoryName ?? '').trim().toUpperCase()
      const key = category === 'FOOD' ? 'food' : category === 'BEVERAGE' || category === 'BEVERAGES' ? 'bev' : 'lainnya'
      kat[key] += nilaiMenu(menu)
      R.qty[key] += n(menu.qty)
    }
    const svc = n(B.otherTaxTotal), tax = n(B.vatTotal), net = grand - svc - tax
    const sum = kat.food + kat.bev + kat.lainnya
    const gross = Math.max(sum, net)
    if (gross > sum) {
      if (sum > 0) for (const key of ['food', 'bev', 'lainnya'] as const) kat[key] *= gross / sum
      else kat.lainnya = gross
    }
    R.food += kat.food
    R.bev += kat.bev
    R.lainnya += kat.lainnya
    R.disc += gross - net
    R.svc += svc
    R.tax += tax
    R.grand += grand
    R.pax += Math.max(1, n(B.paxTotal))
    // Section A of the breakdown: bruto and discount per cashier account (the one that processed the bill);
    // ESB Order bills are Self Order, no cashier served them.
    {
      const x = order ? R.self : (R.kasir[String(B.editedBy || B.createdBy || '').trim() || '(tanpa nama kasir)'] ??= { amount: 0, disc: 0, n: 0 })
      x.amount += gross
      x.disc += gross - net
      x.n++
    }
    const pays = arr(B.salesPayments).filter(p => p.paymentMethodName).map(p => ({ name: String(p.paymentMethodName).trim(), amount: n(p.paymentAmount) }))
    const change = grand > 0 ? Math.max(0, pays.reduce((s, p) => s + p.amount, 0) - grand) : 0
    const cash = pays.find(p => keyBayar(p.name) === 'cash')
    if (change && cash) cash.amount = Math.max(0, cash.amount - change)
    let compliment = 0, deposit = 0
    for (const p of pays) {
      let k = keyBayar(p.name)
      if (order && !BUKAN_QRIS.has(k)) k = 'qris_esb'
      if (k) R.bayar[k] = (R.bayar[k] || 0) + p.amount
      else R.asing[p.name] = (R.asing[p.name] || 0) + p.amount
      if (order && k === 'qris_esb') R.order.nil += p.amount
      if (k === 'compliment') compliment += p.amount
      if (k === 'member_dep') deposit += p.amount
    }
    if (order) R.order.n++
    for (const [jenis, nominal] of [['compliment', compliment], ['member_dep', deposit]] as const) {
      if (nominal <= 0) continue
      const svc = n(B.otherTaxTotal), tax = n(B.vatTotal), share = grand > 0 ? Math.min(1, nominal / grand) : 1
      const menu = live.map(M => String(M.menuName ?? '').trim()).filter(Boolean)
      R.komp.push({ bill, jenis, nominal: Math.round(nominal), tax: Math.round(tax * share), service: Math.round(svc * share), subTotal: Math.round(nominal - Math.round(tax * share) - Math.round(svc * share)), info: String(B.additionalInfo ?? '').trim(), menu, akun: String(B.editedBy || B.createdBy || '').trim(), kasir: String(B.editedBy || B.createdBy || '').trim(), meja: String(B.tableName ?? '') })
    }
    const dead = menus.filter(M => batal.test(String(M.statusName ?? ''))).map(M => ({ item: String(M.menuName ?? '').trim(), qty: n(M.qty), sub: nilaiMenu(M) })).filter(x => x.item)
    if (dead.length) {
      const deadMenus = menus.filter(M => batal.test(String(M.statusName ?? '')))
      const reasons = deadMenus.map(M => String(M.cancelNotes ?? '').trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)
      R.void.push({ bill, utuh: false, waiter: namaKasirEsb(deadMenus[0]?.createdBy), alasan: reasons.join('; '), items: dead, meja: String(B.tableName ?? '') })
    }
    for (const M of live) {
      const name = String(M.menuName ?? '').trim().toUpperCase()
      if (!name) continue
      const row = R.menuQty[name] ??= { qty: 0, kat: String(M.menuCategoryDetailName ?? '').trim().toUpperCase(), kel: String(M.menuCategoryName ?? '').trim().toUpperCase() }
      row.qty += n(M.qty)
    }
  }
  return R
}

const tokens = (s: unknown) => baku(s).split(' ').filter(t => t.length >= 2 || /\d/.test(t))
const cocokToken = (a: unknown, b: unknown) => {
  const aa = tokens(a), bb = tokens(b)
  return !!aa.length && aa.every(t => bb.some(u => u === t || (t.length >= 3 && u.startsWith(t))))
}
const ROKOK_POS_BAWAAN: Record<string, string> = {
  la_purple: 'LA ICE PURPLE, LA PURPLE', la_mango: 'LA MANGGO, LA MANGO', la_bold: 'LA BOLD', la_ice: 'LA ICE', la_light: 'LA LIGHT',
  djarum_super: 'SUPER, DJARUM SUPER', djarum_mild: 'MILD, DJARUM MILD', insta: 'INSTA', korek: 'KOREK', dos_hermanos: 'DOS HERMANOS', dos_h_rojo: 'DOS H. ROJO',
  dos_h_maduro: 'DOS H. MADURO', dos_h_corona: 'DOS H. CORONA', dos_h_torito: 'DOS H. TORITO', gold_seal_petit: 'GOLD SEAL PETIT',
  gold_seal_senor: 'GOLD SEAL SENOR', coin: 'KOIN 2 PCS x2, KOIN, COIN',
}
export function rokokPosTeks(it: RokokItem) {
  return typeof it.pos === 'string' ? it.pos : (ROKOK_POS_BAWAAN[it.k] || '')
}
export function aliasRokok(it: RokokItem) {
  const raw = rokokPosTeks(it)
  return raw.split(',').map((s) => {
    const m = s.trim().match(/^(.*?)\s*[xX×]\s*(\d+)$/)
    return { nama: (m?.[1] || s).trim(), kali: m ? Number(m[2]) : 1 }
  }).filter(x => x.nama)
}
export function petakanRokokEsb(items: RokokItem[], menuQty: EsbHari['menuQty']) {
  const out: Record<string, number> = Object.fromEntries(items.map(it => [it.k, 0]))
  const kena: Record<string, boolean> = {}, ambigu: { nama: string, qty: number, ke: string[] }[] = [], takKenal: { nama: string, qty: number }[] = []
  const exact = new Map<string, { it: RokokItem, kali: number }[]>()
  for (const it of items) for (const p of aliasRokok(it)) {
    const k = baku(p.nama)
    exact.set(k, [...(exact.get(k) ?? []), { it, kali: p.kali > 0 ? p.kali : 1 }])
  }
  const free = items.filter(it => !aliasRokok(it).length)
  for (const [nama, m] of Object.entries(menuQty)) {
    const match = exact.get(baku(nama))
    if (match?.length === 1) {
      const k = match[0]!.it.k
      out[k] = (out[k] ?? 0) + m.qty * match[0]!.kali
      kena[k] = true
      continue
    }
    if (match && match.length > 1) {
      ambigu.push({ nama, qty: m.qty, ke: match.map(x => x.it.n) })
      continue
    }
    const candidates = free.filter(it => cocokToken(it.n, nama))
    if (!candidates.length) {
      if (/ROKOK|CIGAR|TOBACCO|SMOK|COIN|KOIN/.test(m.kat)) takKenal.push({ nama, qty: m.qty })
      continue
    }
    const score = Math.max(...candidates.map(it => tokens(it.n).length)), best = candidates.filter(it => tokens(it.n).length === score)
    if (best.length > 1) ambigu.push({ nama, qty: m.qty, ke: best.map(it => it.n) })
    else {
      const k = best[0]!.k
      out[k] = (out[k] ?? 0) + m.qty
      kena[k] = true
    }
  }
  return { out, kena, ambigu, takKenal }
}

const EMPLOYEE_ESB: Record<string, string> = { MUDAKASIR2: 'ANDY', MUDACINDY: 'CINDY', MUDADEVANI: 'DEVANI', MUDADEVI: 'DEVI', MUDAFEILA: 'FEILA', MUDAGITA: 'GITA', MUDAGRACE: 'GRACE', MUDAKASIR1: 'NOVI', MUDARIZKI: 'RIZKI', MUDASPV: 'SPV', MUDASULIS: 'SULIS', MUDANINDY: 'TASYA', MUDAYASMIN: 'YASMIN' }
const OFFICE_ALIAS: Record<string, string> = { FEILA: 'FAILA', ANDY: 'SAFRIANDI', NOVI: 'NOVIANTI', GRACE: 'GRESYA' }
export const namaKasirEsb = (u: unknown) => {
  const b = baku(u).replace(/ /g, '')
  return EMPLOYEE_ESB[b] || (b.replace(/^MUDA/, ''))
}
export function cariPicEsb(akun: string, roster: { id: string, name: string }[], mapping: Record<string, string> = {}, employees: { id: string, name: string, officeUserId?: string | null }[] = []) {
  const mapped = mapping[baku(akun).replace(/ /g, '')] ?? mapping[akun]
  const employee = employees.find(e => String(e.id) === String(mapped))
  if (employee) {
    const user = employee.officeUserId ? roster.find(r => String(r.id) === String(employee.officeUserId)) : roster.find(r => r.name.trim().toLowerCase() === employee.name.trim().toLowerCase())
    if (user) return user
  }
  const name = namaKasirEsb(akun), target = OFFICE_ALIAS[name] || name
  const matches = roster.filter(r => cocokToken(target, r.name) || cocokToken(r.name, target))
  return matches.length === 1 ? matches[0] : null
}

export function complimentBaru(R: EsbHari, date: string, old: ComplimentKasir[], recorder: string, roster: { id: string, name: string }[], mapping: Record<string, string>, employees: { id: string, name: string, officeUserId?: string | null }[]) {
  const keys = new Set(old.filter(c => c.date === date && c.esbBill).map(c => `${c.esbBill}|${c.esbJenis || 'compliment'}`))
  const out: ComplimentKasir[] = []
  for (const [i, x] of R.komp.entries()) {
    const key = `${x.bill}|${x.jenis}`
    if (keys.has(key)) continue
    keys.add(key)
    const pic = cariPicEsb(x.akun, roster, mapping, employees)
    const name = x.info || `${x.menu.slice(0, 3).join(', ')}${x.menu.length > 3 ? ' …' : ''}` || `Bill ${x.bill}`
    out.push({ id: `c${Date.now().toString(36)}${i}${Math.floor(Math.random() * 1e4)}`, date, nama: `${x.jenis === 'member_dep' ? 'Member Deposit — ' : ''}${name}`, alasan: '', subTotal: x.subTotal, tax: x.tax, service: x.service, nominal: x.nominal,
      picName: pic?.name || 'Tamu', picOfficeId: pic?.id || '', picDiv: pic ? 'kasir' : 'tamu', pemberiName: 'Tamu', pemberiOfficeId: '', pemberiDiv: 'tamu', pemberiStatus: 'menunggu', putusOleh: '', putusAt: 0,
      esbBill: x.bill, esbJenis: x.jenis, esbKasir: x.akun, by: recorder, at: Date.now() })
  }
  const updated = old.map((c) => {
    if (c.date !== date || !c.esbBill || c.picDiv !== 'tamu' || c.ubahOleh) return c
    const x = R.komp.find(item => item.bill === c.esbBill && item.jenis === (c.esbJenis || 'compliment'))
    const pic = x && cariPicEsb(x.akun, roster, mapping, employees)
    return pic ? { ...c, picName: pic.name, picOfficeId: pic.id, picDiv: 'kasir', esbKasir: x!.akun } : c
  })
  const corrected = updated.filter((c, i) => c !== old[i]).length
  return { records: [...updated, ...out], added: out, corrected }
}

export function voidItemsEsb(items: EsbVoid['items']): VoidItemForm[] {
  return items.map(x => ({ item: `${x.item}${x.qty > 1 ? ` x${x.qty}` : ''}`, sub: Math.round(x.sub) }))
}

/**
 * Pair each ESB cashier account with ONE Kompas cashier (old petakanKasir): the saved mapping first, then the
 * name. An account that matches nobody, or two people, is never guessed — it comes back in `takKenal` so the
 * screen can say so and let the person pick.
 */
export function petakanKasirEsb(
  employees: { id: string, name: string }[],
  kasirEsb: Record<string, EsbKasirAkun>,
  peta: Record<string, string> = {},
) {
  const hasil: Record<string, { amount: number, disc: number, akun: string[] }> = {}
  const takKenal: Record<string, EsbKasirAkun & { nama: string, ambigu: boolean }> = {}
  for (const akun of Object.keys(kasirEsb)) {
    const idPeta = peta[baku(akun)] ?? peta[baku(akun).replace(/ /g, '')] ?? peta[akun]
    const lewatPeta = idPeta ? employees.filter(e => String(e.id) === String(idPeta)) : []
    const nama = namaKasirEsb(akun)
    const inti = OFFICE_ALIAS[nama] || nama
    const cand = lewatPeta.length ? lewatPeta : employees.filter(e => cocokToken(inti, e.name) || cocokToken(e.name, inti))
    const x = kasirEsb[akun]!
    if (cand.length === 1) {
      const r = hasil[cand[0]!.id] ??= { amount: 0, disc: 0, akun: [] }
      r.amount += x.amount
      r.disc += x.disc
      r.akun.push(`${nama} (${akun})`)
    }
    else {
      takKenal[akun] = { ...x, nama, ambigu: cand.length > 1 }
    }
  }
  return { hasil, takKenal }
}
/** Key of the saved account → cashier mapping (same spelling the old Office writes). */
export const kunciPetaKasir = (akun: string) => baku(akun)
