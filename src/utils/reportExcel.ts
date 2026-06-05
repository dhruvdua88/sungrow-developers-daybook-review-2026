import * as XLSX from '@e965/xlsx'
import { saveAs } from 'file-saver'
import type { ReviewResult, RuleConfig } from '../types'

// ---------------------------------------------------------------------------
// reportExcel: lean MIS workbook — P&L, Expense→Party, Party→Heads, Transactions.
// ---------------------------------------------------------------------------

const inr = (n: number) => (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

function sheetFromRows(rows: Record<string, unknown>[], cols?: string[]): XLSX.WorkSheet {
  const header = cols ?? (rows.length ? Object.keys(rows[0]) : [])
  const aoa: unknown[][] = [header, ...rows.map((r) => header.map((h) => r[h] ?? ''))]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ;(ws as any)['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' }
  ws['!cols'] = header.map((h) => {
    let w = String(h).length
    for (const r of rows) w = Math.max(w, String(r[h] ?? '').length)
    return { wch: Math.min(Math.max(w + 2, 10), 60) }
  })
  return ws
}

function addSheet(wb: XLSX.WorkBook, name: string, rows: Record<string, unknown>[]) {
  const safe = name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31)
  const ws = rows.length ? sheetFromRows(rows) : XLSX.utils.aoa_to_sheet([[`No ${name} items.`]])
  XLSX.utils.book_append_sheet(wb, ws, safe)
}

export function buildWorkbook(result: ReviewResult, _rules: RuleConfig): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const mis = result.mis
  const p = mis.pnl

  // 1. Executive Summary
  addSheet(wb, 'Summary', [
    { Metric: 'Entity', Value: 'Sungrow Developers India Pvt Ltd (SDIPL)' },
    { Metric: 'Month', Value: result.month },
    { Metric: 'Generated', Value: result.generatedAt },
    { Metric: 'Transactions', Value: result.transactions.length },
    { Metric: 'Revenue', Value: inr(p.revenue) },
    { Metric: 'Gross Profit', Value: inr(p.grossProfit) },
    { Metric: 'Profit/Loss before tax', Value: inr(p.pbt) },
    { Metric: 'Expense thru AP', Value: inr(mis.totalExpense) },
    { Metric: 'TDS deducted', Value: inr(mis.totalTds) },
    { Metric: 'Effective TDS %', Value: mis.effTdsRate != null ? mis.effTdsRate.toFixed(2) + '%' : '—' },
    { Metric: 'RCM (REVE CH)', Value: inr(mis.totalRcm) },
  ])

  // 2. P&L (daybook)
  if (p.available) {
    addSheet(wb, 'P&L (Daybook)', [
      { Line: 'Revenue', Amount: inr(p.revenue), '%': '100%' },
      { Line: 'Less: Cost of sales', Amount: inr(-p.cogs), '%': '' },
      { Line: 'Gross Profit', Amount: inr(p.grossProfit), '%': p.grossMarginPct?.toFixed(1) + '%' },
      { Line: 'Less: Operating expenses', Amount: inr(-p.operatingExpenses), '%': '' },
      { Line: 'Less: Finance (net)', Amount: inr(-p.finance), '%': '' },
      { Line: p.pbt < 0 ? 'Loss before tax' : 'Profit before tax', Amount: inr(p.pbt), '%': p.netMarginPct?.toFixed(1) + '%' },
      { Line: '', Amount: '', '%': '' },
      ...p.opexLines.map((l) => ({ Line: `  ${l.name} (${l.code})`, Amount: inr(l.amount), '%': '' })),
    ])
  }

  // 2b. Sales & GST
  const sales = result.sales
  if (sales.available) {
    addSheet(
      wb,
      'GST Rate Summary',
      sales.rateBuckets.map((b) => ({
        'GST Rate': b.rate,
        Vouchers: b.vouchers,
        'Taxable Sales': inr(b.taxable),
        'Output GST': inr(b.gst),
        '% of sales': sales.totalTaxable ? ((b.taxable / sales.totalTaxable) * 100).toFixed(1) + '%' : '',
      })),
    )
    addSheet(
      wb,
      'Sales Vouchers',
      sales.vouchers.map((v) => ({
        Date: v.date,
        Type: v.docType,
        'Doc No': v.docNo,
        Customer: v.customer,
        'Taxable': inr(v.taxable),
        SGST: inr(v.sgst),
        CGST: inr(v.cgst),
        IGST: inr(v.igst),
        'GST Rate': v.rateBucket,
        'GST charged?': v.hasGst ? 'Yes' : 'NO GST',
      })),
    )
  }

  // 3. Expense Head → Party (flat)
  const ehp: Record<string, unknown>[] = []
  for (const r of mis.expenseTds) {
    ehp.push({
      'Expense Head': r.ledger,
      'G/L': r.glCode,
      Party: '— TOTAL —',
      Sec: r.section,
      Amount: inr(r.expense),
      TDS: inr(r.tds),
      'TDS %': r.effRate != null ? r.effRate.toFixed(1) + '%' : '',
      RCM: inr(r.rcm),
      Vch: r.docs,
    })
    for (const pr of r.parties) {
      ehp.push({
        'Expense Head': r.ledger,
        'G/L': r.glCode,
        Party: pr.party,
        Sec: '',
        Amount: inr(pr.amount),
        TDS: inr(pr.tds),
        'TDS %': pr.amount ? ((pr.tds / pr.amount) * 100).toFixed(1) + '%' : '',
        RCM: inr(pr.rcm),
        Vch: pr.docs,
      })
    }
  }
  addSheet(wb, 'Expense Head x Party', ehp)

  // 4. Party (AP) → Heads (flat)
  const pah: Record<string, unknown>[] = []
  for (const v of mis.vendors) {
    pah.push({
      Party: v.party,
      'Expense Head': '— TOTAL —',
      Amount: inr(v.expense),
      TDS: inr(v.tds),
      RCM: inr(v.rcm),
      'AP Invoiced': inr(v.apCredit),
      'AP Paid': inr(v.apDebit),
      Outstanding: inr(v.apCredit - v.apDebit),
      Vch: v.docs,
    })
    for (const h of v.heads) {
      pah.push({
        Party: v.party,
        'Expense Head': h.ledger,
        Amount: inr(h.amount),
        TDS: inr(h.tds),
        RCM: inr(h.rcm),
        'AP Invoiced': '',
        'AP Paid': '',
        Outstanding: '',
        Vch: h.docs,
      })
    }
  }
  addSheet(wb, 'Party AP x Head', pah)

  // 4b. Party Transaction Matrix (AP + AR)
  const mx = result.matrix
  const mrow = (p: (typeof mx.parties)[number]) => ({
    Party: p.party,
    Kind: p.kind,
    'Account Total': inr(p.total),
    Bank: inr(p.bank),
    'Expense/Sales': inr(p.expense),
    'Inventory/FA': inr(p.inventory),
    TDS: inr(p.tds),
    GST: inr(p.gst),
    Other: inr(p.other),
    Vch: p.vouchers,
  })
  addSheet(wb, 'Txn Matrix', [...mx.ap, ...mx.ar].map(mrow))

  // 5. Normalized transactions
  addSheet(
    wb,
    'Transactions',
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
  saveAs(blob, `SDIPL_Daybook_MIS_${result.month || 'report'}.xlsx`)
}

/** Download the normalized daybook as CSV. */
export function downloadNormalizedCsv(result: ReviewResult) {
  const rows = result.transactions.map((t) => ({
    date: t.date,
    doc_type: t.voucher_type,
    doc_no: t.voucher_no,
    gl_account: t.gl_code,
    ledger: t.ledger,
    party: t.vendor,
    reference: t.reference,
    text: t.narration,
    line_type: t.lineType,
    tds_section: t.tdsLedgerSection,
    debit: t.debit,
    credit: t.credit,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const csv = XLSX.utils.sheet_to_csv(ws)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  saveAs(blob, `SDIPL_Daybook_${result.month || 'report'}.csv`)
}
