import type {
  DaybookPnl,
  ExpenseTdsRow,
  GlLine,
  MisResult,
  Txn,
  VendorApRow,
} from '../types'

// ---------------------------------------------------------------------------
// mis: management view straight from the daybook.
//  - P&L from GL 6xxx (revenue / COGS / finance) and 7xxx (operating expense)
//  - Expense -> AP -> TDS/RCM: for each expense ledger hitting a vendor invoice,
//    total expense booked, total TDS deducted and total RCM, with effective rate.
//  - Vendor (AP party) rollup.
// ---------------------------------------------------------------------------

const isExpenseGl = (g: string) => g.length > 0 && (g[0] === '6' || g[0] === '7')
// AP-vendor operating expense subject to TDS: 7xxx, plus 6xxx that is NOT
// cost-of-sales (64xx) or finance/forex revaluation (66xx) — those are not
// vendor-service spend and would swamp the expense->TDS view.
const isApExpenseGl = (g: string) =>
  g.startsWith('7') || (g[0] === '6' && !g.startsWith('64') && !g.startsWith('66'))
const isRevenueGl = (g: string) => g.startsWith('6001') || g.startsWith('6051')
const isCogsGl = (g: string) => g.startsWith('64')
const isFinanceGl = (g: string) => g.startsWith('66')
const isOpexGl = (g: string) => g.startsWith('7')
const isApGl = (g: string) => g.startsWith('2202') || g.startsWith('2241')
const isApLine = (t: Txn) => isApGl(t.gl_code) || (!t.gl_code && t.lineType === 'Vendor/AP')
const isRcm = (t: Txn) => /REVE\s*CH|REVERSE\s*CHARGE|\bRCM\b/i.test(t.ledger)
const isTds = (t: Txn) => !!t.tdsLedgerSection || (t.lineType === 'TDS' && !isRcm(t))

/** Infer a display section from an expense ledger name + effective rate. */
function inferSection(name: string, effRate: number | null): string {
  const n = name.toUpperCase()
  if (/RENT|LEASE/.test(n)) return '194I'
  if (/PROFE|LEGAL|CONSULT|AUDIT|TECHNICAL/.test(n)) return '194J'
  if (/COMMISSION|BROKERAGE/.test(n)) return '194H'
  if (/SALAR|WAGE|PAYROLL|BASIC|OVERTIME|MEAL/.test(n)) return '192B'
  if (/TRANSPORT|FREIGHT|REPAIR|HOUSEKEEP|SECURITY|CONTRACT|CARTAGE/.test(n)) return '194C'
  if (effRate != null) {
    if (effRate >= 9) return '194I/J'
    if (effRate >= 4) return '194C/H'
    if (effRate >= 1) return '194C'
  }
  return ''
}

function pct(n: number, d: number): number | null {
  return d ? (n / d) * 100 : null
}

export function runMis(txns: Txn[]): MisResult {
  // -------- P&L --------
  const glAgg = new Map<string, { name: string; dr: number; cr: number }>()
  for (const t of txns) {
    const g = t.gl_code
    if (!g || !isExpenseGl(g)) continue
    let a = glAgg.get(g)
    if (!a) {
      a = { name: t.ledger, dr: 0, cr: 0 }
      glAgg.set(g, a)
    }
    a.dr += t.debit
    a.cr += t.credit
    if (!a.name && t.ledger) a.name = t.ledger
  }

  const revenueLines: GlLine[] = []
  const cogsLines: GlLine[] = []
  const opexLines: GlLine[] = []
  const financeLines: GlLine[] = []
  let revenue = 0
  let cogs = 0
  let operatingExpenses = 0
  let finance = 0

  for (const [code, a] of glAgg) {
    if (isRevenueGl(code)) {
      const amt = a.cr - a.dr // income = credit positive
      revenue += amt
      revenueLines.push({ code, name: a.name, amount: amt })
    } else if (isCogsGl(code)) {
      const amt = a.dr - a.cr
      cogs += amt
      cogsLines.push({ code, name: a.name, amount: amt })
    } else if (isFinanceGl(code)) {
      const amt = a.dr - a.cr // net cost positive
      finance += amt
      financeLines.push({ code, name: a.name, amount: amt })
    } else if (isOpexGl(code)) {
      const amt = a.dr - a.cr
      operatingExpenses += amt
      opexLines.push({ code, name: a.name, amount: amt })
    }
  }
  const grossProfit = revenue - cogs
  const pbt = grossProfit - operatingExpenses - finance

  const sortDesc = (a: GlLine, b: GlLine) => Math.abs(b.amount) - Math.abs(a.amount)
  revenueLines.sort(sortDesc)
  cogsLines.sort(sortDesc)
  opexLines.sort(sortDesc)
  financeLines.sort(sortDesc)

  const pnl: DaybookPnl = {
    available: glAgg.size > 0,
    revenue,
    cogs,
    grossProfit,
    grossMarginPct: pct(grossProfit, revenue),
    operatingExpenses,
    finance,
    pbt,
    netMarginPct: pct(pbt, revenue),
    revenueLines,
    cogsLines,
    opexLines,
    financeLines,
  }

  // -------- Expense -> AP -> TDS/RCM (document-level) --------
  // Group by voucher; for vouchers that carry an AP/vendor line, attribute the
  // doc's TDS & RCM pro-rata across its expense (6xxx/7xxx debit) lines.
  const byDoc = new Map<string, Txn[]>()
  for (const t of txns) {
    const k = t.voucher_no || `row-${t.rowIndex}`
    const arr = byDoc.get(k)
    if (arr) arr.push(t)
    else byDoc.set(k, [t])
  }

  type Ex = { name: string; expense: number; tds: number; rcm: number; vendors: Set<string>; docs: Set<string> }
  const exMap = new Map<string, Ex>()
  type Ven = { expense: number; tds: number; rcm: number; apCredit: number; apDebit: number; docs: Set<string>; ledgers: Map<string, number> }
  const venMap = new Map<string, Ven>()

  for (const [doc, lines] of byDoc) {
    const apLine = lines.find((l) => isApLine(l) && l.vendor)
    const party = apLine?.vendor || lines.find((l) => l.vendor)?.vendor || ''
    const hasAp = lines.some(isApLine)

    const tdsTot = lines.filter(isTds).reduce((s, l) => s + l.credit, 0)
    const rcmTot = lines.filter(isRcm).reduce((s, l) => s + l.credit, 0)
    const expLines = lines.filter((l) => isApExpenseGl(l.gl_code) && l.debit > 0)
    const expTot = expLines.reduce((s, l) => s + l.debit, 0)

    // Vendor (AP) rollup — only vouchers that touch AP.
    if (hasAp && party) {
      let v = venMap.get(party)
      if (!v) {
        v = { expense: 0, tds: 0, rcm: 0, apCredit: 0, apDebit: 0, docs: new Set(), ledgers: new Map() }
        venMap.set(party, v)
      }
      v.expense += expTot
      v.tds += tdsTot
      v.rcm += rcmTot
      v.docs.add(doc)
      for (const l of lines) {
        if (isApLine(l)) {
          v.apCredit += l.credit
          v.apDebit += l.debit
        }
      }
      for (const l of expLines) v.ledgers.set(l.ledger, (v.ledgers.get(l.ledger) ?? 0) + l.debit)
    }

    // Expense-ledger rollup — only attribute TDS/RCM for vendor-invoice vouchers.
    if (!hasAp || expTot <= 0) continue
    for (const l of expLines) {
      const code = l.gl_code
      let ex = exMap.get(code)
      if (!ex) {
        ex = { name: l.ledger, expense: 0, tds: 0, rcm: 0, vendors: new Set(), docs: new Set() }
        exMap.set(code, ex)
      }
      const share = l.debit / expTot
      ex.expense += l.debit
      ex.tds += tdsTot * share
      ex.rcm += rcmTot * share
      ex.docs.add(doc)
      if (party) ex.vendors.add(party)
    }
  }

  const expenseTds: ExpenseTdsRow[] = [...exMap.entries()]
    .map(([glCode, ex]) => {
      const effRate = pct(ex.tds, ex.expense)
      return {
        glCode,
        ledger: ex.name,
        section: inferSection(ex.name, effRate),
        expense: ex.expense,
        tds: ex.tds,
        effRate,
        rcm: ex.rcm,
        rcmRate: pct(ex.rcm, ex.expense),
        vendors: ex.vendors.size,
        docs: ex.docs.size,
      }
    })
    .filter((r) => r.expense > 0)
    .sort((a, b) => b.expense - a.expense)

  const vendors: VendorApRow[] = [...venMap.entries()]
    .map(([party, v]) => {
      let topLedger = ''
      let max = -1
      for (const [lg, amt] of v.ledgers) if (amt > max) ((max = amt), (topLedger = lg))
      return {
        party,
        expense: v.expense,
        tds: v.tds,
        rcm: v.rcm,
        apCredit: v.apCredit,
        apDebit: v.apDebit,
        docs: v.docs.size,
        topLedger,
      }
    })
    .sort((a, b) => b.expense - a.expense)

  const totalExpense = expenseTds.reduce((s, r) => s + r.expense, 0)
  const totalTds = expenseTds.reduce((s, r) => s + r.tds, 0)
  const totalRcm = expenseTds.reduce((s, r) => s + r.rcm, 0)

  return {
    pnl,
    expenseTds,
    vendors,
    totalExpense,
    totalTds,
    totalRcm,
    effTdsRate: pct(totalTds, totalExpense),
  }
}
