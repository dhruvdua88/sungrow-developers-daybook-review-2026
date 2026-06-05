import type { AuditFlag, AuditResult, DuplicateGroup, RuleConfig, Txn } from '../types'

// ---------------------------------------------------------------------------
// auditRules: audit exception detection.
// ---------------------------------------------------------------------------

const MANUAL_JOURNAL_KW = ['journal', 'jrnl', 'jv', 'manual', 'adjustment', 'provision', 'reclass']

function isRound(n: number): boolean {
  const a = Math.abs(n)
  if (a === 0) return false
  return a % 1000 === 0 // round to nearest thousand
}

function has(text: string, kws: string[]): boolean {
  const t = text.toLowerCase()
  return kws.some((k) => t.includes(k))
}

/** Detect related-party transactions by keyword. */
function isRelatedParty(t: Txn, kws: string[]): boolean {
  const text = `${t.combined_text} ${t.vendor}`.toLowerCase()
  return kws.some((k) => text.includes(k.toLowerCase()))
}

export function runAudit(txns: Txn[], rules: RuleConfig): AuditResult {
  const exceptions: AuditFlag[] = []
  const relatedParty: AuditFlag[] = []
  const missingInfo: AuditFlag[] = []
  const manualJournals: AuditFlag[] = []

  // Determine the dominant month to flag backdated/old entries.
  const dateValues = txns.map((t) => t.dateValue).filter((v): v is number => v != null)
  const maxDate = dateValues.length ? Math.max(...dateValues) : null

  for (const t of txns) {
    const amt = t.absolute_amount

    if (amt >= rules.highValueThreshold) {
      exceptions.push({
        txn: t,
        category: 'High value',
        remarks: `Transaction ≥ ₹${rules.highValueThreshold.toLocaleString('en-IN')}.`,
        status: 'High Risk',
      })
    } else if (amt >= rules.roundValueThreshold && isRound(t.amount)) {
      exceptions.push({
        txn: t,
        category: 'Round value',
        remarks: `Round-figure entry ≥ ₹${rules.roundValueThreshold.toLocaleString('en-IN')} — verify estimate/provision.`,
        status: 'Review',
      })
    }

    // Manual journals.
    if (has(t.voucher_type, MANUAL_JOURNAL_KW) || has(t.combined_text, ['manual journal'])) {
      manualJournals.push({
        txn: t,
        category: 'Manual journal',
        remarks: 'Manual / adjustment journal — verify supporting and approval.',
        status: 'Review',
      })
    }

    // Backdated / old-date entries (more than ~35 days before latest entry).
    if (maxDate && t.dateValue && maxDate - t.dateValue > 35 * 86400 * 1000) {
      exceptions.push({
        txn: t,
        category: 'Old / backdated',
        remarks: 'Entry dated well before the rest of the book — check period cut-off.',
        status: 'Review',
      })
    }

    // Missing vendor / PAN / GSTIN for material vendors.
    if (amt >= rules.roundValueThreshold) {
      const missing: string[] = []
      if (!t.vendor && !t.ledger) missing.push('vendor')
      if (!t.pan) missing.push('PAN')
      if (!t.gstin) missing.push('GSTIN')
      if (missing.length) {
        missingInfo.push({
          txn: t,
          category: 'Missing info',
          remarks: `Material entry missing: ${missing.join(', ')}.`,
          status: missing.includes('vendor') ? 'High Risk' : 'Review',
        })
      }
    }

    // Related party.
    if (isRelatedParty(t, rules.relatedPartyKeywords)) {
      relatedParty.push({
        txn: t,
        category: 'Related party',
        remarks: 'Matches related-party keyword — ensure ALP / disclosure / Sec 40A(2)(b).',
        status: 'Manual Check',
      })
    }
  }

  // Duplicate detection.
  const duplicates: DuplicateGroup[] = []

  // (a) Same invoice no + same vendor.
  const byInvoice = new Map<string, Txn[]>()
  for (const t of txns) {
    if (!t.invoice_no) continue
    const key = `${(t.vendor || t.ledger).toLowerCase()}|${t.invoice_no.toLowerCase()}`
    const arr = byInvoice.get(key) ?? []
    arr.push(t)
    byInvoice.set(key, arr)
  }
  for (const [key, arr] of byInvoice) {
    if (arr.length > 1) {
      duplicates.push({
        key,
        reason: 'Same invoice number for same vendor',
        txns: arr,
      })
    }
  }

  // (b) Same amount + same vendor + same date.
  const byTriple = new Map<string, Txn[]>()
  for (const t of txns) {
    if (t.absolute_amount === 0) continue
    const key = `${(t.vendor || t.ledger).toLowerCase()}|${t.absolute_amount.toFixed(2)}|${t.date}`
    const arr = byTriple.get(key) ?? []
    arr.push(t)
    byTriple.set(key, arr)
  }
  for (const [key, arr] of byTriple) {
    if (arr.length > 1) {
      // avoid double-reporting items already caught by invoice rule
      duplicates.push({
        key,
        reason: 'Same vendor + same amount + same date',
        txns: arr,
      })
    }
  }

  return { exceptions, duplicates, relatedParty, missingInfo, manualJournals }
}
