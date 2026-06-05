import { saveAs } from 'file-saver'
import type { ReviewResult } from '../types'

// ---------------------------------------------------------------------------
// reportHtml: single-page, email-friendly HTML summary report.
// Inline styles only (no external CSS) so it renders inside email clients.
// ---------------------------------------------------------------------------

const inr = (n: number | null | undefined) =>
  n == null ? 'n/a' : '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function kpiCard(label: string, value: string): string {
  return `<td style="padding:8px;">
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;background:#f8fafc;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;">${esc(label)}</div>
      <div style="font-size:20px;font-weight:700;color:#0f4c81;margin-top:4px;">${esc(value)}</div>
    </div>
  </td>`
}

function table(headers: string[], rows: string[][]): string {
  if (!rows.length) return `<p style="color:#64748b;font-size:13px;">None.</p>`
  const th = headers
    .map(
      (h) =>
        `<th style="text-align:left;padding:6px 8px;border-bottom:2px solid #cbd5e1;font-size:11px;text-transform:uppercase;color:#475569;">${esc(h)}</th>`,
    )
    .join('')
  const body = rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (c) =>
              `<td style="padding:6px 8px;border-bottom:1px solid #eef2f7;font-size:13px;color:#1f2937;">${esc(c)}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('')
  return `<table style="width:100%;border-collapse:collapse;margin-top:6px;"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`
}

function section(title: string, inner: string): string {
  return `<div style="margin-top:26px;">
    <h2 style="font-size:16px;color:#0f4c81;border-left:4px solid #0f4c81;padding-left:8px;margin:0 0 8px;">${esc(title)}</h2>
    ${inner}
  </div>`
}

export function buildHtml(result: ReviewResult): string {
  const k = result.kpis
  const fin = result.financials

  const topVendors = result.tds.vendorSummary
    .filter((v) => v.expectedTds > 0)
    .slice(0, 10)
    .map((v) => [v.vendor, String(v.txnCount), inr(v.totalAmount), v.sections.join(', '), inr(v.expectedTds)])

  const topAudit = result.audit.exceptions
    .slice()
    .sort((a, b) => b.txn.absolute_amount - a.txn.absolute_amount)
    .slice(0, 10)
    .map((f) => [f.txn.date, f.txn.ledger || f.txn.vendor, inr(f.txn.absolute_amount), f.category, f.status])

  const rcm = result.gst.possibleRcm
    .slice(0, 10)
    .map((f) => [f.txn.date, f.txn.ledger || f.txn.vendor, inr(f.txn.absolute_amount), f.category, f.remarks])

  const actionItems: string[] = []
  if (k.unmappedCount > 0) actionItems.push(`Classify ${k.unmappedCount} unmapped ledger transactions.`)
  if (k.expectedTds > 0) actionItems.push(`Verify TDS deduction of ${inr(k.expectedTds)} across flagged vendors.`)
  if (k.rcmCount > 0) actionItems.push(`Review ${k.rcmCount} possible RCM items (legal / freight / import of service).`)
  if (k.highValueCount > 0) actionItems.push(`Vouch ${k.highValueCount} high-value transactions to supporting documents.`)
  if (result.audit.duplicates.length) actionItems.push(`Investigate ${result.audit.duplicates.length} duplicate-invoice groups.`)
  if (!actionItems.length) actionItems.push('No material exceptions flagged by the rule engine this month.')

  const kpiRow1 = [
    kpiCard('Transactions', String(k.totalTxns)),
    kpiCard('Total Value', inr(k.totalValue)),
    kpiCard('Potential TDS Base', inr(k.tdsBase)),
    kpiCard('Expected TDS', inr(k.expectedTds)),
  ].join('')
  const kpiRow2 = [
    kpiCard('Unmapped', String(k.unmappedCount)),
    kpiCard('High Value', String(k.highValueCount)),
    kpiCard('Possible RCM', String(k.rcmCount)),
    kpiCard('Audit Exceptions', String(k.auditExceptionCount)),
  ].join('')

  const finBlock = fin
    ? table(
        ['Metric', 'Amount'],
        [
          ['Detected P&L sheet', fin.detectedSheet ?? '(none)'],
          ['Revenue', inr(fin.revenue)],
          ['Cost of sales', inr(fin.cost)],
          ['Gross profit', inr(fin.grossProfit)],
          ['Operating expenses', inr(fin.operatingExpenses)],
          ['Net profit', inr(fin.netProfit)],
          ...fin.variances.map((v, i) => [`Note ${i + 1}`, v]),
        ],
      )
    : `<p style="color:#64748b;font-size:13px;">No financials file provided.</p>`

  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SDIPL Monthly Review — ${esc(result.month)}</title></head>
<body style="margin:0;background:#eef2f7;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
<div style="max-width:900px;margin:0 auto;padding:24px;">
  <div style="background:#0f4c81;color:#fff;border-radius:10px;padding:20px 24px;">
    <div style="font-size:22px;font-weight:700;">Sungrow Monthly Review Engine</div>
    <div style="font-size:14px;opacity:.9;margin-top:2px;">Sungrow Developers India Pvt Ltd (SDIPL) — ${esc(result.month || 'Monthly')} accounting review</div>
    <div style="font-size:12px;opacity:.8;margin-top:6px;">Generated ${esc(result.generatedAt)}</div>
  </div>

  ${section(
    'Executive KPIs',
    `<table style="width:100%;border-collapse:collapse;"><tr>${kpiRow1}</tr><tr>${kpiRow2}</tr></table>`,
  )}

  ${section('Top 10 TDS Vendors', table(['Vendor', 'Txns', 'Total Amount', 'Sections', 'Expected TDS'], topVendors))}

  ${section('Top 10 Audit Exceptions', table(['Date', 'Ledger / Vendor', 'Amount', 'Category', 'Status'], topAudit))}

  ${section('Possible RCM Items', table(['Date', 'Ledger / Vendor', 'Amount', 'Category', 'Remarks'], rcm))}

  ${section('P&L Summary', finBlock)}

  ${section(
    'Action Items',
    `<ul style="margin:6px 0 0;padding-left:20px;font-size:13px;line-height:1.6;">${actionItems
      .map((a) => `<li>${esc(a)}</li>`)
      .join('')}</ul>`,
  )}

  <div style="margin-top:28px;padding:12px 14px;background:#fff7ed;border:1px solid #fdba74;border-radius:8px;font-size:12px;color:#9a3412;">
    <strong>Disclaimer:</strong> This report is generated by an automated, rule-based engine for review facilitation only.
    TDS sections, rates, thresholds and RCM/GST positions are indicative and must be independently verified against the
    Income-tax Act, GST law and the underlying vouchers before any filing or payment. Final professional review is required.
  </div>
</div>
</body></html>`
}

export function downloadHtml(result: ReviewResult) {
  const html = buildHtml(result)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  saveAs(blob, `SDIPL_Monthly_Review_${result.month || 'report'}.html`)
}
