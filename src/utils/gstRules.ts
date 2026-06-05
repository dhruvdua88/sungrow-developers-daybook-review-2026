import type { GstFlag, GstLedgerRow, GstResult, RuleConfig, Txn } from '../types'

// ---------------------------------------------------------------------------
// gstRules: rule-based GST / RCM flags (first version, heuristic).
// ---------------------------------------------------------------------------

const GST_LEDGER_KW = ['gst', 'igst', 'cgst', 'sgst', 'utgst', 'input tax', 'output tax']
const RCM_SERVICE_KW = [
  'legal',
  'professional',
  'advocate',
  'consultanc',
  'import of service',
  'manpower',
  'security',
  'sponsorship',
  'director',
]
const GTA_KW = ['freight', 'transport', 'gta', 'carriage', 'cartage', 'logistics']
const FOREIGN_KW = ['sungrow', 'china', 'overseas', 'foreign', 'intercompany', 'inter company', 'import']

function has(text: string, kws: string[]): boolean {
  const t = text.toLowerCase()
  return kws.some((k) => t.includes(k))
}

function isGstLedger(text: string): boolean {
  return has(text, GST_LEDGER_KW)
}

/** Run rule-based GST / RCM analysis. */
export function runGst(txns: Txn[], _rules: RuleConfig): GstResult {
  const possibleRcm: GstFlag[] = []
  const withoutGstin: GstFlag[] = []
  const exceptions: GstFlag[] = []

  // GST ledger summary.
  const ledgerMap = new Map<string, GstLedgerRow>()

  for (const t of txns) {
    const text = t.combined_text

    if (isGstLedger(t.ledger) || isGstLedger(text)) {
      const key = t.ledger || '(gst)'
      let row = ledgerMap.get(key)
      if (!row) {
        row = { ledger: key, txnCount: 0, debit: 0, credit: 0, net: 0 }
        ledgerMap.set(key, row)
      }
      row.txnCount++
      row.debit += t.debit
      row.credit += t.credit
      row.net += t.debit - t.credit
    }

    // RCM: legal/professional/import of service/manpower/security/director.
    if (has(text, RCM_SERVICE_KW)) {
      possibleRcm.push({
        txn: t,
        category: 'Service RCM',
        remarks: 'Professional/legal/manpower/import service — review RCM applicability u/s 9(3)/9(4).',
        status: 'Manual Check',
      })
    } else if (has(text, GTA_KW)) {
      possibleRcm.push({
        txn: t,
        category: 'GTA freight',
        remarks: 'Freight / transport — review GTA RCM (5% / 12% & exemption).',
        status: 'Manual Check',
      })
    } else if (has(text, FOREIGN_KW) && !isGstLedger(text)) {
      possibleRcm.push({
        txn: t,
        category: 'Import / Intercompany',
        remarks: 'Foreign party / intercompany service fee — import of services RCM likely.',
        status: 'Manual Check',
      })
    }

    // Expenses without GSTIN but vendor looks like a regular supplier.
    const looksExpense = t.absolute_amount >= 5000 && !isGstLedger(t.ledger) && t.amount !== 0
    const vendorish = (t.vendor || t.ledger || '').length > 0
    if (looksExpense && vendorish && !t.gstin && !isGstLedger(text)) {
      withoutGstin.push({
        txn: t,
        category: 'No GSTIN',
        remarks: 'Expense booked without a GSTIN — verify supplier registration / ITC eligibility.',
        status: 'Review',
      })
    }

    // GST booked to cost / leakage heuristic: GST keyword inside an expense narration
    // but no separate GST ledger split.
    if (has(text, ['gst inclusive', 'incl gst', 'including gst', 'gst @'])) {
      exceptions.push({
        txn: t,
        category: 'GST in cost',
        remarks: 'GST appears embedded in expense value — possible ITC leakage / wrong booking.',
        status: 'Review',
      })
    }
  }

  const ledgerSummary = [...ledgerMap.values()].sort(
    (a, b) => Math.abs(b.net) - Math.abs(a.net),
  )

  return { ledgerSummary, possibleRcm, withoutGstin, exceptions }
}
