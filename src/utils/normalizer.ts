import type { ColumnMap, LineType, RawSheet, Txn } from '../types'

// Parse a TDS section (194C/194J/194I/194Q/194H/194A/192B...) from a ledger name
// like "TDS - 194C" or "TDS 194I". Returns '' when not a TDS ledger.
export function parseTdsSection(ledger: string): string {
  const m = ledger.toUpperCase().match(/\b(19[0-9][A-Z]?|192B|192)\b/)
  if (!m) return ''
  if (!/TDS|T\.?D\.?S|WITHHOLD|TAX DED/.test(ledger.toUpperCase())) return ''
  return m[1]
}

// Classify a line by GL prefix + ledger text, for the transaction explorer filter.
export function classifyLine(glCode: string, ledger: string, tdsSection: string): LineType {
  const g = glCode.replace(/\s/g, '')
  const l = ledger.toUpperCase()
  if (tdsSection || /\bTDS\b|TCS|WITHHOLD/.test(l)) return 'TDS'
  if (/GST|IGST|CGST|SGST|UTGST|ITC/.test(l)) return 'GST'
  // SAP GL ranges (2202 AP, 1002 bank, 7 expense, 6 rev/cos, 14/15/16/17 inventory/FA, 112 receivable)
  if (g.startsWith('2202') || g.startsWith('2241')) return 'Vendor/AP'
  if (g.startsWith('1002')) return 'Bank'
  if (g.startsWith('7')) return 'Expense'
  if (g.startsWith('6')) return 'Rev/COS'
  if (/^1(4|5|6|7)/.test(g) || g.startsWith('5')) return 'Inventory/FA'
  if (g.startsWith('112') || /RECEIVABLE|TRADE REC/.test(l)) return 'Receivable'
  // Fallbacks by ledger text when no GL code column.
  if (/PAYABLE|VENDOR|CREDITOR/.test(l)) return 'Vendor/AP'
  if (/BANK|CASH/.test(l)) return 'Bank'
  if (/EXPENSE|RENT|SALAR|FREIGHT|REPAIR|PROFE|COMMISSION/.test(l)) return 'Expense'
  return 'Other'
}

// ---------------------------------------------------------------------------
// normalizer: turn raw daybook rows + column map into normalized Txn records.
// ---------------------------------------------------------------------------

const PAN_RE = /[A-Z]{5}[0-9]{4}[A-Z]/
const GSTIN_RE = /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}/

/** Parse a cell into a number, tolerating commas, currency symbols, parens. */
export function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return isFinite(v) ? v : 0
  let s = String(v).trim()
  if (!s) return 0
  let neg = false
  if (/^\(.*\)$/.test(s)) {
    neg = true
    s = s.slice(1, -1)
  }
  s = s.replace(/[₹$,\s]/g, '').replace(/[^0-9.\-]/g, '')
  if (s === '' || s === '-' || s === '.') return 0
  const n = parseFloat(s)
  if (!isFinite(n)) return 0
  return neg ? -n : n
}

/** Format a cell as a clean string. */
function toStr(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return formatDate(v)
  return String(v).trim()
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Excel serial date -> JS Date (1900 date system). */
function excelSerialToDate(serial: number): Date | null {
  if (!isFinite(serial) || serial <= 0 || serial > 80000) return null
  // Excel epoch: 1899-12-30 (accounts for the 1900 leap-year bug).
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  const d = new Date(ms)
  return isNaN(d.getTime()) ? null : d
}

/** Parse a date cell into {display, value(ms)}. Handles Date, serial, strings. */
function parseDate(v: unknown): { display: string; value: number | null } {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return { display: formatDate(v), value: v.getTime() }
  }
  if (typeof v === 'number') {
    const d = excelSerialToDate(v)
    if (d) return { display: formatDate(d), value: d.getTime() }
    return { display: String(v), value: null }
  }
  const s = String(v ?? '').trim()
  if (!s) return { display: '', value: null }
  const parsed = Date.parse(s)
  if (!isNaN(parsed)) return { display: s, value: parsed }
  return { display: s, value: null }
}

function cell(row: unknown[], idx: number | undefined): unknown {
  if (idx === undefined) return null
  return row[idx] ?? null
}

/**
 * Normalize raw sheet rows into Txn[].
 * - amount falls back to debit - credit when no amount column.
 * - PAN/GSTIN extracted from explicit columns OR scanned from combined text.
 */
export function normalize(sheet: RawSheet, map: ColumnMap): Txn[] {
  const txns: Txn[] = []

  sheet.rows.forEach((row, i) => {
    const dateInfo = parseDate(cell(row, map.date))
    const debit = toNumber(cell(row, map.debit))
    const credit = toNumber(cell(row, map.credit))
    let amount: number
    if (map.amount !== undefined) {
      amount = toNumber(cell(row, map.amount))
      if (amount === 0 && (debit !== 0 || credit !== 0)) amount = debit - credit
    } else {
      amount = debit - credit
    }

    const ledger = toStr(cell(row, map.ledger))
    const vendor = toStr(cell(row, map.vendor))
    const narration = toStr(cell(row, map.narration))
    const voucher_type = toStr(cell(row, map.voucher_type))
    const voucher_no = toStr(cell(row, map.voucher_no))
    const invoice_no = toStr(cell(row, map.invoice_no))
    const gl_code = toStr(cell(row, map.gl_code))
    const reference = toStr(cell(row, map.reference))

    const combined_text = [ledger, vendor, narration, voucher_type, invoice_no]
      .filter(Boolean)
      .join(' | ')

    const tdsLedgerSection = parseTdsSection(ledger)
    const lineType = classifyLine(gl_code, ledger, tdsLedgerSection)

    // PAN / GSTIN: explicit column first, else regex scan of the whole row.
    const rowText = row.map(toStr).join(' ').toUpperCase()
    let pan = toStr(cell(row, map.pan)).toUpperCase()
    if (!PAN_RE.test(pan)) {
      const m = rowText.match(PAN_RE)
      pan = m ? m[0] : pan
    }
    let gstin = toStr(cell(row, map.gstin)).toUpperCase()
    if (!GSTIN_RE.test(gstin)) {
      const m = rowText.match(GSTIN_RE)
      gstin = m ? m[0] : gstin
    }

    // Skip totally empty / total rows (no money, no ledger).
    if (!ledger && !vendor && amount === 0 && debit === 0 && credit === 0) return

    txns.push({
      rowIndex: i,
      date: dateInfo.display,
      dateValue: dateInfo.value,
      voucher_no,
      voucher_type,
      gl_code,
      ledger,
      vendor,
      narration,
      reference,
      invoice_no,
      debit,
      credit,
      amount,
      absolute_amount: Math.abs(amount),
      pan: PAN_RE.test(pan) ? pan : '',
      gstin: GSTIN_RE.test(gstin) ? gstin : '',
      combined_text,
      lineType,
      tdsLedgerSection,
    })
  })

  return txns
}
