import type {
  GstRateBucket,
  SaleVoucher,
  SalesCustomerRow,
  SalesResult,
  Txn,
} from '../types'

// ---------------------------------------------------------------------------
// sales: output-GST analysis on sale vouchers.
//  Sale voucher = a document that credits a revenue ledger (GL 6001/6051 or a
//  "SALES REV / REVENUE" ledger). Taxable = net revenue credit. Output GST =
//  SGST/CGST/IGST PAYABLE credits in the same voucher. Rate = GST / taxable.
//  Flags vouchers where taxable > 0 but no GST was charged.
// ---------------------------------------------------------------------------

const isRevenue = (t: Txn) => {
  const g = t.gl_code
  if (g.startsWith('6001') || g.startsWith('6051')) return true
  const n = t.ledger.toUpperCase()
  return g.startsWith('6') && /(SALES|REVENUE|TURNOVER)/.test(n) && !/COST/.test(n)
}
const isSgstOut = (t: Txn) => t.gl_code === '2221013110' || /\bSGST\b.*PAYABLE|OUTPUT.*SGST/i.test(t.ledger)
const isCgstOut = (t: Txn) => t.gl_code === '2221013120' || /\bCGST\b.*PAYABLE|OUTPUT.*CGST/i.test(t.ledger)
const isIgstOut = (t: Txn) => /\bIGST\b.*PAYABLE|OUTPUT.*IGST/i.test(t.ledger)
const isAr = (t: Txn) => t.gl_code.startsWith('1122') || /TRADE REC|RECEIVABLE|DEBTOR|CUSTOMER/i.test(t.ledger)

function bucketOf(rate: number, hasGst: boolean): string {
  if (!hasGst) return '0%'
  for (const b of [0, 5, 12, 18, 28]) if (Math.abs(rate - b) < 0.6) return `${b}%`
  return 'other'
}

export function runSales(txns: Txn[]): SalesResult {
  const byDoc = new Map<string, Txn[]>()
  for (const t of txns) {
    const k = t.voucher_no || `row-${t.rowIndex}`
    const arr = byDoc.get(k)
    if (arr) arr.push(t)
    else byDoc.set(k, [t])
  }

  const vouchers: SaleVoucher[] = []
  for (const [doc, lines] of byDoc) {
    const taxable = lines.filter(isRevenue).reduce((s, l) => s + (l.credit - l.debit), 0)
    if (Math.abs(taxable) < 1) continue
    const sgst = lines.filter(isSgstOut).reduce((s, l) => s + (l.credit - l.debit), 0)
    const cgst = lines.filter(isCgstOut).reduce((s, l) => s + (l.credit - l.debit), 0)
    const igst = lines.filter(isIgstOut).reduce((s, l) => s + (l.credit - l.debit), 0)
    const gst = sgst + cgst + igst
    const rate = taxable ? (gst / taxable) * 100 : 0
    const hasGst = Math.abs(gst) >= 1
    const customer = lines.find((l) => isAr(l) && l.vendor)?.vendor || lines.find((l) => l.vendor)?.vendor || '(no customer)'
    vouchers.push({
      docNo: doc,
      docType: lines[0].voucher_type,
      date: lines[0].date,
      customer,
      taxable,
      sgst,
      cgst,
      igst,
      gst,
      rate: Math.round(rate * 10) / 10,
      rateBucket: bucketOf(rate, hasGst),
      hasGst,
    })
  }

  if (vouchers.length === 0) {
    return {
      available: false,
      vouchers: [],
      rateBuckets: [],
      customers: [],
      totalTaxable: 0,
      totalGst: 0,
      blendedRate: null,
      noGstCount: 0,
      noGstValue: 0,
    }
  }

  vouchers.sort((a, b) => b.taxable - a.taxable)

  // Rate buckets.
  const rbMap = new Map<string, GstRateBucket>()
  for (const v of vouchers) {
    let r = rbMap.get(v.rateBucket)
    if (!r) {
      r = { rate: v.rateBucket, vouchers: 0, taxable: 0, gst: 0 }
      rbMap.set(v.rateBucket, r)
    }
    r.vouchers++
    r.taxable += v.taxable
    r.gst += v.gst
  }
  const order = ['0%', '5%', '12%', '18%', '28%', 'other']
  const rateBuckets = [...rbMap.values()].sort(
    (a, b) => order.indexOf(a.rate) - order.indexOf(b.rate),
  )

  // Customers (with per-rate breakdown).
  type C = { taxable: number; gst: number; vouchers: number; byRate: Map<string, { taxable: number; gst: number; vouchers: number }> }
  const cMap = new Map<string, C>()
  for (const v of vouchers) {
    let c = cMap.get(v.customer)
    if (!c) {
      c = { taxable: 0, gst: 0, vouchers: 0, byRate: new Map() }
      cMap.set(v.customer, c)
    }
    c.taxable += v.taxable
    c.gst += v.gst
    c.vouchers++
    let br = c.byRate.get(v.rateBucket)
    if (!br) {
      br = { taxable: 0, gst: 0, vouchers: 0 }
      c.byRate.set(v.rateBucket, br)
    }
    br.taxable += v.taxable
    br.gst += v.gst
    br.vouchers++
  }
  const customers: SalesCustomerRow[] = [...cMap.entries()]
    .map(([customer, c]) => ({
      customer,
      taxable: c.taxable,
      gst: c.gst,
      rate: c.taxable ? (c.gst / c.taxable) * 100 : null,
      vouchers: c.vouchers,
      byRate: [...c.byRate.entries()]
        .map(([rate, b]) => ({ rate, ...b }))
        .sort((a, b) => order.indexOf(a.rate) - order.indexOf(b.rate)),
    }))
    .sort((a, b) => b.taxable - a.taxable)

  const totalTaxable = vouchers.reduce((s, v) => s + v.taxable, 0)
  const totalGst = vouchers.reduce((s, v) => s + v.gst, 0)
  const noGst = vouchers.filter((v) => v.taxable > 1 && !v.hasGst)

  return {
    available: true,
    vouchers,
    rateBuckets,
    customers,
    totalTaxable,
    totalGst,
    blendedRate: totalTaxable ? (totalGst / totalTaxable) * 100 : null,
    noGstCount: noGst.length,
    noGstValue: noGst.reduce((s, v) => s + v.taxable, 0),
  }
}
