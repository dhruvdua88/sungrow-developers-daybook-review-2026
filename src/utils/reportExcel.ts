import * as XLSX from '@e965/xlsx'
import { saveAs } from 'file-saver'
import type { ReviewResult, RuleConfig } from '../types'

// ---------------------------------------------------------------------------
// reportExcel: build the multi-sheet review workbook with SheetJS.
// Note: the community build of SheetJS does not write cell styles; we still
// apply column widths, freeze panes and bold-ish header rows via a fallback.
// ---------------------------------------------------------------------------

const inr = (n: number) =>
  (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

/** Create a worksheet from an array-of-objects with a header row + freeze. */
function sheetFromRows(rows: Record<string, unknown>[], cols?: string[]): XLSX.WorkSheet {
  const header = cols ?? (rows.length ? Object.keys(rows[0]) : [])
  const aoa: unknown[][] = [header, ...rows.map((r) => header.map((h) => r[h] ?? ''))]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  // Freeze the header row.
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' }
  ;(ws as any)['!panes'] = [{ ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }]
  // Auto column widths (cap at 60).
  ws['!cols'] = header.map((h) => {
    let w = String(h).length
    for (const r of rows) w = Math.max(w, String(r[h] ?? '').length)
    return { wch: Math.min(Math.max(w + 2, 10), 60) }
  })
  return ws
}

function addSheet(wb: XLSX.WorkBook, name: string, rows: Record<string, unknown>[], cols?: string[]) {
  // Excel sheet names: max 31 chars, no : \ / ? * [ ]
  const safe = name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31)
  const ws = rows.length ? sheetFromRows(rows, cols) : XLSX.utils.aoa_to_sheet([[`No ${name} items.`]])
  XLSX.utils.book_append_sheet(wb, ws, safe)
}

export function buildWorkbook(result: ReviewResult, rules: RuleConfig): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const k = result.kpis

  // 1. Executive Summary
  addSheet(wb, 'Executive Summary', [
    { Metric: 'Entity', Value: 'Sungrow Developers India Pvt Ltd (SDIPL)' },
    { Metric: 'Month', Value: result.month },
    { Metric: 'Generated', Value: result.generatedAt },
    { Metric: 'Transactions reviewed', Value: k.totalTxns },
    { Metric: 'Total transaction value (₹)', Value: inr(k.totalValue) },
    { Metric: 'Potential TDS base (₹)', Value: inr(k.tdsBase) },
    { Metric: 'Expected TDS as per rules (₹)', Value: inr(k.expectedTds) },
    { Metric: 'Unmapped transactions', Value: k.unmappedCount },
    { Metric: 'High-value transactions', Value: k.highValueCount },
    { Metric: 'Possible RCM items', Value: k.rcmCount },
    { Metric: 'Audit exceptions', Value: k.auditExceptionCount },
  ])

  // 2. File Structure
  const structRows: Record<string, unknown>[] = []
  for (const wbk of [result.daybookStructure, result.financialsStructure]) {
    if (!wbk) continue
    for (const s of wbk.sheets) {
      structRows.push({
        File: wbk.fileName,
        Sheet: s.name,
        'Header row': s.headerRowIndex + 1,
        'Data rows': s.rows.length,
        Columns: s.headers.join(' | '),
      })
    }
  }
  addSheet(wb, 'File Structure', structRows)

  // 3. TDS Vendor Summary
  addSheet(
    wb,
    'TDS Vendor Summary',
    result.tds.vendorSummary.map((v) => ({
      Vendor: v.vendor,
      Txns: v.txnCount,
      'Total Amount': inr(v.totalAmount),
      'TDS Base': inr(v.tdsBase),
      'Expected TDS': inr(v.expectedTds),
      Sections: v.sections.join(', '),
    })),
  )

  // 3b. TDS Waterfall (actual-deducted) — only when available.
  if (result.tdsWaterfall.available) {
    addSheet(
      wb,
      'TDS Waterfall',
      result.tdsWaterfall.sections.map((s) => ({
        Section: s.section,
        Nature: s.nature,
        'Rate %': s.rate || 'salary',
        'TDS Deducted': inr(s.deducted),
        'Implied Base': s.rate ? inr(s.impliedBase) : 'n/a',
        Parties: s.parties,
      })),
    )
    addSheet(
      wb,
      'Party TDS Waterfall',
      result.tdsWaterfall.parties.map((p) => ({
        'Party (Accounting pro.)': p.party,
        Section: p.section,
        'Rate %': p.rate || 'n/a',
        'TDS Deducted': inr(p.deducted),
        'Implied Base': p.rate ? inr(p.impliedBase) : 'n/a',
        Vouchers: p.docs.length,
        Flag: p.flag,
      })),
    )
  }

  // 4. TDS Ledger Summary
  addSheet(
    wb,
    'TDS Ledger Summary',
    result.tds.ledgerSummary.map((l) => ({
      Ledger: l.ledger,
      Section: l.section,
      Txns: l.txnCount,
      'Total Amount': inr(l.totalAmount),
      'Expected TDS': inr(l.expectedTds),
      Status: l.status,
    })),
  )

  // 5. Potential TDS Transactions
  addSheet(
    wb,
    'Potential TDS Txns',
    result.tds.potential.map((c) => ({
      Date: c.date,
      Voucher: c.voucher_no,
      Ledger: c.ledger,
      Vendor: c.vendor,
      Narration: c.narration,
      Amount: inr(c.absolute_amount),
      Section: c.tdsSection,
      'Rate %': c.tdsRate,
      'Expected TDS': inr(c.expectedTds),
      Status: c.tdsStatus,
      Remarks: c.tdsRemarks,
    })),
  )

  // 6. Unmapped Ledgers
  addSheet(
    wb,
    'Unmapped Ledgers',
    result.tds.unmappedLedgers.map((l) => ({
      Ledger: l.ledger,
      Txns: l.txnCount,
      'Total Amount': inr(l.totalAmount),
      Status: 'Review',
    })),
  )

  // 7. GST RCM Review
  addSheet(
    wb,
    'GST RCM Review',
    result.gst.possibleRcm.map((f) => ({
      Date: f.txn.date,
      Ledger: f.txn.ledger,
      Vendor: f.txn.vendor,
      Narration: f.txn.narration,
      Amount: inr(f.txn.absolute_amount),
      Category: f.category,
      Status: f.status,
      Remarks: f.remarks,
    })),
  )

  // 8. GST Exceptions
  addSheet(
    wb,
    'GST Exceptions',
    [...result.gst.withoutGstin, ...result.gst.exceptions].map((f) => ({
      Date: f.txn.date,
      Ledger: f.txn.ledger,
      Vendor: f.txn.vendor,
      Amount: inr(f.txn.absolute_amount),
      Category: f.category,
      Status: f.status,
      Remarks: f.remarks,
    })),
  )

  // 9. Audit Exceptions
  addSheet(
    wb,
    'Audit Exceptions',
    result.audit.exceptions.map((f) => ({
      Date: f.txn.date,
      Voucher: f.txn.voucher_no,
      Ledger: f.txn.ledger,
      Vendor: f.txn.vendor,
      Amount: inr(f.txn.absolute_amount),
      Category: f.category,
      Status: f.status,
      Remarks: f.remarks,
    })),
  )

  // 10. Related Party Review
  addSheet(
    wb,
    'Related Party Review',
    result.audit.relatedParty.map((f) => ({
      Date: f.txn.date,
      Ledger: f.txn.ledger,
      Vendor: f.txn.vendor,
      Narration: f.txn.narration,
      Amount: inr(f.txn.absolute_amount),
      Status: f.status,
      Remarks: f.remarks,
    })),
  )

  // 11. Financial Performance
  const fin = result.financials
  const finRows: Record<string, unknown>[] = []
  if (fin) {
    finRows.push({ Item: 'Detected P&L sheet', Value: fin.detectedSheet ?? '(none)' })
    finRows.push({ Item: 'Revenue', Value: fin.revenue != null ? inr(fin.revenue) : 'n/a' })
    finRows.push({ Item: 'Cost', Value: fin.cost != null ? inr(fin.cost) : 'n/a' })
    finRows.push({ Item: 'Gross Profit', Value: fin.grossProfit != null ? inr(fin.grossProfit) : 'n/a' })
    finRows.push({
      Item: 'Operating Expenses',
      Value: fin.operatingExpenses != null ? inr(fin.operatingExpenses) : 'n/a',
    })
    finRows.push({ Item: 'Net Profit', Value: fin.netProfit != null ? inr(fin.netProfit) : 'n/a' })
    fin.variances.forEach((v, i) => finRows.push({ Item: `Note ${i + 1}`, Value: v }))
  }
  addSheet(wb, 'Financial Performance', finRows)

  // 12. Normalized Daybook
  addSheet(
    wb,
    'Normalized Daybook',
    result.transactions.map((t) => ({
      Date: t.date,
      'Doc Type': t.voucher_type,
      'Doc No': t.voucher_no,
      'G/L Account': t.gl_code,
      'G/L Account Text (Ledger)': t.ledger,
      'Accounting pro. (Party)': t.vendor,
      Reference: t.reference,
      Text: t.narration,
      'Line Type': t.lineType,
      'TDS Section': t.tdsLedgerSection,
      Debit: t.debit,
      Credit: t.credit,
      PAN: t.pan,
      GSTIN: t.gstin,
    })),
  )

  // 13. Rule Mapping
  addSheet(
    wb,
    'Rule Mapping',
    rules.tds.map((r) => ({
      Section: r.section,
      Label: r.label,
      'Rate %': r.rate,
      'Threshold (single)': r.thresholdSingle ?? '',
      'Threshold (annual)': r.thresholdAnnual ?? '',
      Excluded: r.excluded ? 'Yes' : '',
      'Manual Review': r.manualReview ? 'Yes' : '',
      Keywords: r.keywords.join(', '),
      Note: r.note ?? '',
    })),
  )

  return wb
}

export function downloadWorkbook(result: ReviewResult, rules: RuleConfig) {
  const wb = buildWorkbook(result, rules)
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  saveAs(blob, `SDIPL_Monthly_Review_${result.month || 'report'}.xlsx`)
}

/** Download the normalized daybook as CSV. */
export function downloadNormalizedCsv(result: ReviewResult) {
  const rows = result.transactions.map((t) => ({
    date: t.date,
    voucher_no: t.voucher_no,
    voucher_type: t.voucher_type,
    ledger: t.ledger,
    vendor: t.vendor,
    narration: t.narration,
    invoice_no: t.invoice_no,
    debit: t.debit,
    credit: t.credit,
    amount: t.amount,
    absolute_amount: t.absolute_amount,
    pan: t.pan,
    gstin: t.gstin,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const csv = XLSX.utils.sheet_to_csv(ws)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  saveAs(blob, `SDIPL_Normalized_Daybook_${result.month || 'report'}.csv`)
}
