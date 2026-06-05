import type {
  RiskStatus,
  TdsWaterfall,
  Txn,
  WaterfallPartyRow,
  WaterfallSectionRow,
} from '../types'

// ---------------------------------------------------------------------------
// tdsWaterfall: actual-deducted TDS recon for books that already carry TDS
// ledgers (e.g. SAP "TDS - 194C"). Best practice from prior recon work:
//   - report the section that was ACTUALLY applied (from the booked TDS line),
//   - gross the deducted amount up to base at the statutory rate,
//   - attribute to the party on the voucher (Accounting pro.),
//   - roll up party × section and section totals.
// Deductions = CREDIT side of the TDS ledger. Debit side = challan payments
// (separate vouchers) and is excluded.
// ---------------------------------------------------------------------------

const STAT_RATE: Record<string, number> = {
  '194C': 2,
  '194J': 10,
  '194I': 10,
  '194H': 5,
  '194A': 10,
  '194Q': 0.1,
  '192B': 0,
  '192': 0,
}
const NATURE: Record<string, string> = {
  '194C': 'Contractor / freight / job-work',
  '194J': 'Professional / technical',
  '194I': 'Rent',
  '194H': 'Commission / brokerage',
  '194A': 'Interest',
  '194Q': 'Purchase of goods',
  '192B': 'Salary',
  '192': 'Salary',
}

const rate = (s: string) => STAT_RATE[s] ?? 0

/** Pick the party for a voucher: prefer the AP/vendor line, else any non-empty. */
function voucherParty(lines: Txn[]): string {
  const ap = lines.find((l) => l.lineType === 'Vendor/AP' && l.vendor)
  if (ap) return ap.vendor
  const any = lines.find((l) => l.vendor)
  return any ? any.vendor : '(no party)'
}

export function runTdsWaterfall(txns: Txn[]): TdsWaterfall {
  // Detect TDS ledgers present in the book.
  const detected = new Set<string>()
  for (const t of txns) if (t.tdsLedgerSection) detected.add(t.ledger)

  if (detected.size === 0) {
    return {
      available: false,
      sections: [],
      parties: [],
      totalDeducted: 0,
      detectedTdsLedgers: [],
    }
  }

  // Group by voucher (document).
  const byDoc = new Map<string, Txn[]>()
  for (const t of txns) {
    const key = t.voucher_no || `row-${t.rowIndex}`
    const arr = byDoc.get(key)
    if (arr) arr.push(t)
    else byDoc.set(key, [t])
  }

  // party -> section -> { deducted, docs:Set }
  const agg = new Map<string, Map<string, { deducted: number; docs: Set<string> }>>()

  for (const [doc, lines] of byDoc) {
    const party = voucherParty(lines)
    for (const l of lines) {
      const sec = l.tdsLedgerSection
      if (!sec) continue
      const deducted = l.credit // credits = deductions; ignore challan-payment debits
      if (deducted <= 0) continue
      let psec = agg.get(party)
      if (!psec) {
        psec = new Map()
        agg.set(party, psec)
      }
      let cell = psec.get(sec)
      if (!cell) {
        cell = { deducted: 0, docs: new Set() }
        psec.set(sec, cell)
      }
      cell.deducted += deducted
      cell.docs.add(doc)
    }
  }

  // Build party rows.
  const parties: WaterfallPartyRow[] = []
  for (const [party, psec] of agg) {
    for (const [section, cell] of psec) {
      const r = rate(section)
      const impliedBase = r ? cell.deducted / (r / 100) : 0
      const expected = impliedBase * (r / 100)
      const variance = cell.deducted - expected
      const flag: RiskStatus = !r ? 'Manual Check' : Math.abs(variance) > 1 ? 'Review' : 'OK'
      parties.push({
        party,
        section,
        rate: r,
        deducted: cell.deducted,
        impliedBase,
        expected,
        variance,
        flag,
        docs: [...cell.docs],
      })
    }
  }
  parties.sort((a, b) => b.deducted - a.deducted)

  // Section totals.
  const secMap = new Map<string, { deducted: number; parties: Set<string> }>()
  for (const p of parties) {
    let s = secMap.get(p.section)
    if (!s) {
      s = { deducted: 0, parties: new Set() }
      secMap.set(p.section, s)
    }
    s.deducted += p.deducted
    s.parties.add(p.party)
  }
  const order = ['194I', '194J', '194C', '194H', '194A', '194Q', '192B', '192']
  const sections: WaterfallSectionRow[] = [...secMap.entries()]
    .map(([section, s]) => {
      const r = rate(section)
      return {
        section,
        nature: NATURE[section] ?? section,
        rate: r,
        deducted: s.deducted,
        impliedBase: r ? s.deducted / (r / 100) : 0,
        parties: s.parties.size,
      }
    })
    .sort((a, b) => {
      const ia = order.indexOf(a.section)
      const ib = order.indexOf(b.section)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })

  const totalDeducted = sections.reduce((s, r) => s + r.deducted, 0)

  return {
    available: true,
    sections,
    parties,
    totalDeducted,
    detectedTdsLedgers: [...detected].sort(),
  }
}
