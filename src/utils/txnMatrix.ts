import type { Txn } from '../types'

// ---------------------------------------------------------------------------
// txnMatrix: for each AP / AR party, decompose what HITS its account — the
// contra (non-party) lines of every voucher the party appears in, bucketed by
// category. Contra is split pro-rata when a voucher carries multiple parties.
// Repeatable rule (buckets cover ~99.9% of AP entries):
//   Bank (1002) · Expense (GL 6/7) · Inventory/FA (14-17,5) · TDS (2221010x)
//   · GST (2221013x) · Other (duty / statutory / misc).
// ---------------------------------------------------------------------------

export const MATRIX_CATS = ['bank', 'expense', 'inventory', 'tds', 'gst', 'other'] as const
export type MatrixCat = (typeof MATRIX_CATS)[number]

export interface MatrixRow {
  party: string
  kind: 'AP' | 'AR'
  total: number
  bank: number
  expense: number
  inventory: number
  tds: number
  gst: number
  other: number
  vouchers: number
}

export interface TxnMatrix {
  parties: MatrixRow[]
  ap: MatrixRow[]
  ar: MatrixRow[]
  apTotals: MatrixRow
  arTotals: MatrixRow
}

const isApLine = (t: Txn) =>
  t.gl_code.startsWith('2202') || t.gl_code.startsWith('2241') || (!t.gl_code && t.lineType === 'Vendor/AP')
const isArLine = (t: Txn) =>
  t.gl_code.startsWith('1122') ||
  (!t.gl_code && (t.lineType === 'Receivable' || /TRADE REC|RECEIVABLE|DEBTOR|CUSTOMER/i.test(t.ledger)))

function contraCat(t: Txn): MatrixCat {
  const g = t.gl_code
  const lt = t.lineType
  if (g.startsWith('1002') || lt === 'Bank') return 'bank'
  if (t.tdsLedgerSection || lt === 'TDS') return 'tds'
  if (lt === 'GST' || /\b(I?GST|CGST|SGST|UTGST|ITC)\b/i.test(t.ledger)) return 'gst'
  if (g[0] === '6' || g[0] === '7' || lt === 'Expense' || lt === 'Rev/COS') return 'expense'
  if (/^1[4567]/.test(g) || g[0] === '5' || lt === 'Inventory/FA') return 'inventory'
  return 'other'
}

const blank = (party: string, kind: 'AP' | 'AR' | ''): MatrixRow => ({
  party,
  kind: (kind || 'AP') as 'AP' | 'AR',
  total: 0,
  bank: 0,
  expense: 0,
  inventory: 0,
  tds: 0,
  gst: 0,
  other: 0,
  vouchers: 0,
})

export function runTxnMatrix(txns: Txn[]): TxnMatrix {
  const byDoc = new Map<string, Txn[]>()
  for (const t of txns) {
    const k = t.voucher_no || `row-${t.rowIndex}`
    const a = byDoc.get(k)
    if (a) a.push(t)
    else byDoc.set(k, [t])
  }
  const acc = new Map<string, MatrixRow>()

  for (const [, lines] of byDoc) {
    const apLines = lines.filter((l) => isApLine(l) && l.vendor)
    const arLines = lines.filter((l) => isArLine(l) && l.vendor)
    const partyLines = apLines.length ? apLines : arLines
    if (!partyLines.length) continue
    const kind: 'AP' | 'AR' = apLines.length ? 'AP' : 'AR'

    const partySet = new Set(partyLines)
    const cat: Record<MatrixCat, number> = { bank: 0, expense: 0, inventory: 0, tds: 0, gst: 0, other: 0 }
    for (const l of lines) {
      if (partySet.has(l)) continue
      cat[contraCat(l)] += Math.abs(l.debit - l.credit)
    }
    const amts = partyLines.map((l) => Math.abs(l.debit - l.credit))
    const sumAmt = amts.reduce((s, x) => s + x, 0) || 1
    partyLines.forEach((l, i) => {
      let row = acc.get(l.vendor)
      if (!row) {
        row = blank(l.vendor, kind)
        acc.set(l.vendor, row)
      }
      const share = amts[i] / sumAmt
      row.total += amts[i]
      for (const c of MATRIX_CATS) row[c] += cat[c] * share
      row.vouchers += 1
    })
  }

  const parties = [...acc.values()].sort((a, b) => b.total - a.total)
  const ap = parties.filter((p) => p.kind === 'AP')
  const ar = parties.filter((p) => p.kind === 'AR')
  const totals = (list: MatrixRow[]): MatrixRow => {
    const t = blank('ALL', '')
    for (const p of list) {
      t.total += p.total
      for (const c of MATRIX_CATS) t[c] += p[c]
      t.vouchers += p.vouchers
    }
    return t
  }
  return { parties, ap, ar, apTotals: totals(ap), arTotals: totals(ar) }
}
