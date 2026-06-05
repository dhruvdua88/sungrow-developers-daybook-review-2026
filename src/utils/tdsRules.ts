import type {
  ClassifiedTxn,
  LedgerTdsSummary,
  RiskStatus,
  RuleConfig,
  TdsResult,
  TdsRule,
  Txn,
  VendorTdsSummary,
} from '../types'

// ---------------------------------------------------------------------------
// tdsRules: default editable rule config + TDS classification engine.
// ---------------------------------------------------------------------------

export const DEFAULT_RULES: RuleConfig = {
  tds: [
    {
      section: '194J',
      label: 'Professional / Technical fees',
      keywords: [
        'professional',
        'consultancy',
        'consulting',
        'technical',
        'legal',
        'audit',
        'accounting',
        'certification',
        'retainer',
        'advisory',
      ],
      rate: 10,
      thresholdSingle: 30000,
    },
    {
      section: '194C',
      label: 'Contractors',
      keywords: [
        'contract',
        'repair',
        'maintenance',
        'security',
        'housekeeping',
        'freight',
        'transport',
        'loading',
        'unloading',
        'job work',
        'installation',
        'service charges',
      ],
      rate: 2,
      thresholdSingle: 30000,
      thresholdAnnual: 100000,
      manualReview: true,
      note: '1% may apply for individual/HUF contractors — verify payee status.',
    },
    {
      section: '194I',
      label: 'Rent',
      keywords: ['rent', 'lease', 'office rent', 'warehouse rent'],
      rate: 10,
      thresholdAnnual: 240000,
      note: 'Plant & machinery rent attracts 2% — flag separately.',
    },
    {
      section: '194H',
      label: 'Commission / Brokerage',
      keywords: ['commission', 'brokerage', 'referral'],
      rate: 5,
      thresholdAnnual: 15000,
    },
    {
      section: '194A',
      label: 'Interest (other than securities)',
      keywords: ['interest', 'finance charge', 'loan interest'],
      rate: 10,
      thresholdAnnual: 5000,
      manualReview: true,
      note: 'Threshold 5,000 / 10,000 depending on payer/payee — verify manually.',
    },
    {
      section: '192',
      label: 'Salary',
      keywords: ['salary', 'payroll', 'employee cost', 'wages'],
      rate: 0,
      manualReview: true,
      note: 'Requires payroll-level computation — manual review.',
    },
    {
      section: '194Q',
      label: 'Purchase of goods',
      keywords: ['purchase', 'goods', 'material', 'trading purchase'],
      rate: 0.1,
      thresholdAnnual: 5000000,
      manualReview: true,
      note: 'Vendor-wise > 50L & buyer turnover condition — possible exposure only.',
    },
    {
      section: 'Excluded',
      label: 'No TDS expected',
      keywords: [
        'gst',
        'igst',
        'cgst',
        'sgst',
        'tds',
        'custom duty',
        'duty',
        'tax',
        'bank charges',
        'forex',
        'round off',
        'depreciation',
      ],
      rate: 0,
      excluded: true,
    },
  ],
  roundValueThreshold: 100000,
  highValueThreshold: 500000,
  relatedPartyKeywords: [
    'sungrow',
    'china',
    'holding',
    'group',
    'intercompany',
    'inter company',
    'service fee',
    'reimbursement',
  ],
}

function matchRule(text: string, rules: TdsRule[]): TdsRule | null {
  const t = text.toLowerCase()
  // Excluded rules checked first so e.g. "GST input" isn't taxed.
  const ordered = [...rules].sort((a, b) => Number(b.excluded) - Number(a.excluded))
  for (const r of ordered) {
    for (const kw of r.keywords) {
      if (kw && t.includes(kw.toLowerCase())) return r
    }
  }
  return null
}

/** Classify one transaction against the rule set. */
export function classifyTxn(txn: Txn, rules: RuleConfig): ClassifiedTxn {
  const rule = matchRule(txn.combined_text, rules.tds)
  const base = txn.absolute_amount

  let tdsSection = ''
  let tdsRate = 0
  let expectedTds = 0
  let tdsStatus: RiskStatus = 'Review'
  let tdsRemarks = ''
  let unmapped = false

  if (!rule) {
    unmapped = true
    tdsSection = ''
    tdsStatus = 'Review'
    tdsRemarks = 'Unmapped ledger — no rule keyword matched. Manual classification needed.'
  } else if (rule.excluded) {
    tdsSection = 'Excluded'
    tdsStatus = 'OK'
    tdsRemarks = 'No TDS expected (tax / statutory / non-TDS head).'
  } else {
    tdsSection = rule.section
    tdsRate = rule.rate
    const threshold = rule.thresholdSingle ?? rule.thresholdAnnual ?? 0
    const overThreshold = base >= threshold
    expectedTds = overThreshold ? Math.round((base * rule.rate) / 100) : 0

    if (rule.manualReview) {
      tdsStatus = 'Manual Check'
      tdsRemarks = rule.note ?? 'Manual review required.'
    } else if (overThreshold) {
      tdsStatus = 'Review'
      tdsRemarks = `Maps to ${rule.section} @ ${rule.rate}% (${rule.label}).`
    } else {
      tdsStatus = 'OK'
      tdsRemarks = `Below ${rule.section} threshold (₹${threshold.toLocaleString('en-IN')}).`
    }
    if (rule.note && !tdsRemarks.includes(rule.note)) tdsRemarks += ` ${rule.note}`
  }

  if (base >= rules.highValueThreshold && tdsStatus === 'OK') tdsStatus = 'Review'

  return {
    ...txn,
    tdsSection,
    tdsRate,
    expectedTds,
    tdsStatus,
    tdsRemarks,
    unmapped,
  }
}

function worstStatus(a: RiskStatus, b: RiskStatus): RiskStatus {
  const order: RiskStatus[] = ['OK', 'Review', 'Manual Check', 'High Risk']
  return order.indexOf(a) >= order.indexOf(b) ? a : b
}

/** Run the full TDS analysis over all transactions. */
export function runTds(txns: Txn[], rules: RuleConfig): TdsResult {
  const classified = txns.map((t) => classifyTxn(t, rules))

  // Potential TDS = mapped, taxable section, expected TDS > 0 or manual check.
  const potential = classified.filter(
    (c) =>
      c.tdsSection &&
      c.tdsSection !== 'Excluded' &&
      (c.expectedTds > 0 || c.tdsStatus === 'Manual Check'),
  )

  const highValue = classified
    .filter((c) => c.absolute_amount >= rules.highValueThreshold)
    .sort((a, b) => b.absolute_amount - a.absolute_amount)

  // Vendor-wise summary.
  const vendorMap = new Map<string, VendorTdsSummary>()
  for (const c of classified) {
    const key = c.vendor || c.ledger || '(blank)'
    let v = vendorMap.get(key)
    if (!v) {
      v = { vendor: key, txnCount: 0, totalAmount: 0, tdsBase: 0, expectedTds: 0, sections: [] }
      vendorMap.set(key, v)
    }
    v.txnCount++
    v.totalAmount += c.absolute_amount
    if (c.tdsSection && c.tdsSection !== 'Excluded') {
      v.tdsBase += c.absolute_amount
      v.expectedTds += c.expectedTds
      if (!v.sections.includes(c.tdsSection)) v.sections.push(c.tdsSection)
    }
  }
  const vendorSummary = [...vendorMap.values()].sort((a, b) => b.expectedTds - a.expectedTds)

  // Ledger-wise summary.
  const ledgerMap = new Map<string, LedgerTdsSummary>()
  for (const c of classified) {
    const key = c.ledger || '(blank)'
    let l = ledgerMap.get(key)
    if (!l) {
      l = {
        ledger: key,
        section: c.tdsSection || 'Unmapped',
        txnCount: 0,
        totalAmount: 0,
        expectedTds: 0,
        status: 'OK',
      }
      ledgerMap.set(key, l)
    }
    l.txnCount++
    l.totalAmount += c.absolute_amount
    l.expectedTds += c.expectedTds
    l.status = worstStatus(l.status, c.tdsStatus)
    if (c.tdsSection && c.tdsSection !== 'Excluded') l.section = c.tdsSection
  }
  const ledgerSummary = [...ledgerMap.values()].sort((a, b) => b.expectedTds - a.expectedTds)

  // Unmapped ledgers.
  const unmappedLedgers = ledgerSummary.filter(
    (l) => l.section === 'Unmapped' || l.section === '',
  )

  const totalTdsBase = vendorSummary.reduce((s, v) => s + v.tdsBase, 0)
  const totalExpectedTds = classified.reduce((s, c) => s + c.expectedTds, 0)

  return {
    classified,
    potential,
    unmappedLedgers,
    vendorSummary,
    ledgerSummary,
    highValue,
    totalTdsBase,
    totalExpectedTds,
  }
}
