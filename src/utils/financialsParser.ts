import type { FinancialsResult, PnlLine, RawSheet, WorkbookStructure } from '../types'
import { toNumber } from './normalizer'

// ---------------------------------------------------------------------------
// financialsParser: detect the P&L sheet in the financials pack and extract
// revenue / cost / profit lines. Bilingual (EN/中文) friendly.
// ---------------------------------------------------------------------------

const PNL_SHEET_KW = ['profit & loss', 'profit and loss', 'p&l', 'income statement', '利润表']
const MONTH_KW = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
  '月份',
  'month',
  'amount',
  'total',
  'ytd',
]

const LINE_KW: Record<string, string[]> = {
  revenue: ['revenue', 'turnover', 'total income', 'sales', '营业收入'],
  cost: ['cost of sales', 'cost of goods', 'cost of revenue', 'main business cost', '营业成本'],
  grossProfit: ['gross profit', 'gross margin', '毛利'],
  operatingExpenses: [
    'operating expense',
    'administration expense',
    'selling expense',
    'total expense',
    '管理费用',
  ],
  netProfit: ['net profit', 'profit for the', 'net income', 'profit after tax', '净利润'],
}

function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().trim()
}

function pickPnlSheet(wb: WorkbookStructure): RawSheet | null {
  // 1. Exact-ish name match.
  for (const s of wb.sheets) {
    const n = norm(s.name)
    if (PNL_SHEET_KW.some((k) => n.includes(k))) return s
  }
  // 2. Content scan: a sheet mentioning revenue + cost + profit.
  for (const s of wb.sheets) {
    const text = [s.headers.join(' '), ...s.rows.slice(0, 40).map((r) => r.join(' '))]
      .join(' ')
      .toLowerCase()
    const hits = ['revenue', 'cost', 'profit'].filter((k) => text.includes(k)).length
    if (hits >= 2) return s
  }
  return null
}

/** Find the column indices that hold period (month) values, and their labels. */
function detectPeriodColumns(sheet: RawSheet): { cols: number[]; labels: string[] } {
  // Scan top ~10 rows for a header row containing month tokens.
  const cols: number[] = []
  const labels: string[] = []
  const scanRows = [sheet.headers, ...sheet.rows.slice(0, 10)]
  let bestRow: unknown[] | null = null
  let bestHits = 0
  for (const row of scanRows) {
    const hits = row.filter((c) => MONTH_KW.some((k) => norm(c).includes(k))).length
    if (hits > bestHits) {
      bestHits = hits
      bestRow = row
    }
  }
  if (bestRow) {
    bestRow.forEach((c, i) => {
      if (MONTH_KW.some((k) => norm(c).includes(k))) {
        cols.push(i)
        labels.push(String(c).replace(/\s+/g, ' ').trim())
      }
    })
  }
  // Fallback: assume numeric columns to the right of the label column.
  if (cols.length === 0 && sheet.rows.length) {
    const sample = sheet.rows[Math.floor(sheet.rows.length / 2)]
    sample.forEach((c, i) => {
      if (typeof c === 'number' && i > 0) {
        cols.push(i)
        labels.push(`Col ${i + 1}`)
      }
    })
  }
  return { cols, labels }
}

/** Find the label column — the leftmost column with mostly text. */
function detectLabelColumn(sheet: RawSheet): number {
  const width = sheet.headers.length
  let best = 0
  let bestText = -1
  for (let c = 0; c < Math.min(width, 4); c++) {
    let textCount = 0
    for (const row of sheet.rows.slice(0, 60)) {
      if (typeof row[c] === 'string' && String(row[c]).trim().length > 1) textCount++
    }
    if (textCount > bestText) {
      bestText = textCount
      best = c
    }
  }
  return best
}

function lastNumber(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null && values[i] !== 0) return values[i]
  }
  // fall back to any non-null
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null) return values[i]
  }
  return null
}

export function runFinancials(wb: WorkbookStructure | null): FinancialsResult {
  if (!wb || !wb.sheets.length) {
    return {
      detectedSheet: null,
      periods: [],
      lines: [],
      revenue: null,
      cost: null,
      grossProfit: null,
      operatingExpenses: null,
      netProfit: null,
      variances: ['No financials file provided.'],
      sheetsAvailable: [],
      previewRows: [],
    }
  }

  const sheetsAvailable = wb.sheets.map((s) => s.name)
  const sheet = pickPnlSheet(wb)

  if (!sheet) {
    return {
      detectedSheet: null,
      periods: [],
      lines: [],
      revenue: null,
      cost: null,
      grossProfit: null,
      operatingExpenses: null,
      netProfit: null,
      variances: ['Could not auto-detect a P&L sheet. Use manual mapping (future version).'],
      sheetsAvailable,
      previewRows: wb.sheets[0]?.rows.slice(0, 15) ?? [],
    }
  }

  const labelCol = detectLabelColumn(sheet)
  const { cols, labels } = detectPeriodColumns(sheet)

  const lines: PnlLine[] = []
  for (const row of sheet.rows) {
    const label = String(row[labelCol] ?? '').replace(/\s+/g, ' ').trim()
    if (!label) continue
    const values = cols.map((c) => {
      const v = row[c]
      if (v === null || v === undefined || v === '') return null
      return toNumber(v)
    })
    if (values.every((v) => v == null)) continue
    lines.push({ label, values })
  }

  // Find the line matching a metric's keywords (first hit with any value).
  function findLine(keys: string[]): PnlLine | null {
    for (const line of lines) {
      const l = line.label.toLowerCase()
      if (keys.some((k) => l.includes(k)) && line.values.some((v) => v != null)) return line
    }
    return null
  }

  // Pick ONE primary period column so all metrics are internally consistent
  // (e.g. gross profit = revenue − cost in the same period). Use the column
  // where the revenue line carries the largest magnitude (the active month /
  // total column); fall back to the last populated column.
  const revLine = findLine(LINE_KW.revenue)
  let primaryCol = -1
  if (revLine) {
    let bestAbs = -1
    revLine.values.forEach((v, i) => {
      if (v != null && Math.abs(v) > bestAbs) {
        bestAbs = Math.abs(v)
        primaryCol = i
      }
    })
  }
  const metricAt = (keys: string[]): number | null => {
    const line = findLine(keys)
    if (!line) return null
    if (primaryCol >= 0 && line.values[primaryCol] != null) return line.values[primaryCol]
    return lastNumber(line.values) // fallback when primary col empty for this line
  }

  const revenue = metricAt(LINE_KW.revenue)
  const cost = metricAt(LINE_KW.cost)
  let grossProfit = metricAt(LINE_KW.grossProfit)
  if (grossProfit == null && revenue != null && cost != null) grossProfit = revenue - cost
  const operatingExpenses = metricAt(LINE_KW.operatingExpenses)
  const netProfit = metricAt(LINE_KW.netProfit)

  // Variance notes.
  const variances: string[] = []
  if (revenue != null && grossProfit != null && revenue !== 0) {
    const gm = (grossProfit / revenue) * 100
    variances.push(`Gross margin ≈ ${gm.toFixed(1)}%.`)
    if (gm < 0) variances.push('⚠ Negative gross margin — investigate cost booking.')
  }
  if (revenue != null && netProfit != null && revenue !== 0) {
    const nm = (netProfit / revenue) * 100
    variances.push(`Net margin ≈ ${nm.toFixed(1)}%.`)
  }
  if (operatingExpenses != null && revenue != null && revenue !== 0) {
    const ratio = (operatingExpenses / revenue) * 100
    if (ratio > 40) variances.push(`⚠ Operating expense ${ratio.toFixed(0)}% of revenue — high.`)
  }
  if (!variances.length) variances.push('Extracted P&L preview shown; refine mapping as needed.')

  return {
    detectedSheet: sheet.name,
    periods: labels.length ? labels : cols.map((c) => `Col ${c + 1}`),
    lines,
    revenue,
    cost,
    grossProfit,
    operatingExpenses,
    netProfit,
    variances,
    sheetsAvailable,
    previewRows: sheet.rows.slice(0, 25),
  }
}
