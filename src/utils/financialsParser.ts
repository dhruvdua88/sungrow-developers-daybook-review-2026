import type { FinancialsResult, PnlLine, RawSheet, WorkbookStructure } from '../types'
import { toNumber } from './normalizer'

// ---------------------------------------------------------------------------
// financialsParser: detect the P&L sheet in the financials pack and extract
// revenue / cost / profit lines. Bilingual (EN/中文) friendly.
// ---------------------------------------------------------------------------

const PNL_SHEET_KW = ['profit & loss', 'profit and loss', 'p&l', 'income statement', '利润表']

// Calendar-month tokens only. Audited / cumulative / RMB summary columns are
// detected separately (see AUDITED_KW) so we can DEFAULT to the review month
// (the latest populated month) rather than silently grabbing a YTD column.
const MONTH_TOKENS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月',
]
// Audited / period-total / summary columns (kept selectable, not the default).
const AUDITED_KW = ['audited', 'unaudited', 'end of period', 'ytd', '审定', '未审', '本位币', 'rmb', '人民币', 'total']
// Noise columns that are NOT periods at all.
const NOISE_KW = ['decimal', 'digit', '小数', 'conversion rate', '折算', 'direction', '方向', 'accounting subject', 'subject']

type PeriodKind = 'month' | 'audited'
function classifyPeriod(label: string): PeriodKind | null {
  const l = label.toLowerCase()
  if (NOISE_KW.some((k) => l.includes(k))) return null
  if (MONTH_TOKENS.some((k) => l.includes(k))) return 'month'
  if (AUDITED_KW.some((k) => l.includes(k))) return 'audited'
  return null
}

const LINE_KW: Record<string, string[]> = {
  revenue: ['operating revenue', 'revenue', 'turnover', 'total income', '营业收入'],
  cost: ['cost of sales', 'cost of goods', 'cost of revenue', 'main business cost', '营业成本'],
  grossProfit: ['gross profit', 'gross margin', '毛利'],
  netProfit: ['net profit', 'profit for the', 'net income', 'profit after tax', '净利润'],
}

// Operating-expense component lines (summed) — the CN/EN statement has no single
// "operating expenses" total, so add up the period-cost rows between cost and
// operating profit. Matched leniently; missing lines just contribute 0.
const OPEX_COMPONENT_KW: string[][] = [
  ['taxes and surcharge', 'taxes and surcharges', '税金及附加'],
  ['selling expense', 'selling and distribution', '销售费用'],
  ['administration expense', 'administrative expense', 'general and admin', '管理费用'],
  ['research and dev', 'research & dev', 'r&d', '研发费用'],
  ['financial expense', 'finance expense', 'finance cost', '财务费用'],
]

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

/**
 * Find the period columns (month + audited/summary) with their labels & kinds.
 * Picks the header row with the most classifiable period tokens.
 */
function detectPeriodColumns(sheet: RawSheet): {
  cols: number[]
  labels: string[]
  kinds: PeriodKind[]
} {
  const scanRows = [sheet.headers, ...sheet.rows.slice(0, 10)]
  let bestRow: unknown[] | null = null
  let bestHits = 0
  for (const row of scanRows) {
    const hits = row.filter((c) => classifyPeriod(String(c ?? '')) !== null).length
    if (hits > bestHits) {
      bestHits = hits
      bestRow = row
    }
  }
  const cols: number[] = []
  const labels: string[] = []
  const kinds: PeriodKind[] = []
  if (bestRow) {
    bestRow.forEach((c, i) => {
      const kind = classifyPeriod(String(c ?? ''))
      if (kind) {
        cols.push(i)
        labels.push(String(c).replace(/\s+/g, ' ').trim())
        kinds.push(kind)
      }
    })
  }
  // Fallback: numeric columns right of the label column.
  if (cols.length === 0 && sheet.rows.length) {
    const sample = sheet.rows[Math.floor(sheet.rows.length / 2)]
    sample.forEach((c, i) => {
      if (typeof c === 'number' && i > 0) {
        cols.push(i)
        labels.push(`Col ${i + 1}`)
        kinds.push('audited')
      }
    })
  }
  return { cols, labels, kinds }
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

export interface FinancialMetrics {
  revenue: number | null
  cost: number | null
  grossProfit: number | null
  operatingExpenses: number | null
  netProfit: number | null
  variances: string[]
}

/**
 * Compute P&L metrics for ONE period column, so every figure is internally
 * consistent (gross profit = revenue − cost in the same period). Exported so
 * the UI can recompute instantly when the user switches period.
 */
export function computeMetrics(lines: PnlLine[], col: number): FinancialMetrics {
  const findLine = (keys: string[]): PnlLine | null => {
    for (const line of lines) {
      const l = line.label.toLowerCase()
      if (keys.some((k) => l.includes(k)) && line.values.some((v) => v != null)) return line
    }
    return null
  }
  const at = (keys: string[]): number | null => {
    const line = findLine(keys)
    if (!line) return null
    if (col >= 0 && line.values[col] != null) return line.values[col]
    return lastNumber(line.values)
  }

  const revenue = at(LINE_KW.revenue)
  const cost = at(LINE_KW.cost)
  let grossProfit = at(LINE_KW.grossProfit)
  if (grossProfit == null && revenue != null && cost != null) grossProfit = revenue - cost
  const netProfit = at(LINE_KW.netProfit)

  // Operating expenses = Σ component lines (taxes, selling, admin, R&D, finance).
  let opex: number | null = null
  for (const comp of OPEX_COMPONENT_KW) {
    const v = at(comp)
    if (v != null) opex = (opex ?? 0) + v
  }

  const variances: string[] = []
  if (revenue != null && grossProfit != null && revenue !== 0) {
    const gm = (grossProfit / revenue) * 100
    variances.push(`Gross margin ≈ ${gm.toFixed(1)}%.`)
    if (gm < 0) variances.push('⚠ Negative gross margin — investigate cost booking.')
  }
  if (revenue != null && netProfit != null && revenue !== 0) {
    variances.push(`Net margin ≈ ${((netProfit / revenue) * 100).toFixed(1)}%.`)
  }
  if (opex != null && revenue != null && revenue !== 0) {
    const ratio = (opex / revenue) * 100
    if (ratio > 40) variances.push(`⚠ Operating expense ${ratio.toFixed(0)}% of revenue — high.`)
  }
  if (!variances.length) variances.push('Extracted P&L preview shown; refine mapping as needed.')

  return { revenue, cost, grossProfit, operatingExpenses: opex, netProfit, variances }
}

export function runFinancials(wb: WorkbookStructure | null): FinancialsResult {
  if (!wb || !wb.sheets.length) {
    return {
      detectedSheet: null,
      periods: [],
      periodKinds: [],
      selectedPeriod: -1,
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
      periodKinds: [],
      selectedPeriod: -1,
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
  const { cols, labels, kinds } = detectPeriodColumns(sheet)

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

  // Default period = the review month: the LAST populated *month* column.
  // (Was: the largest-magnitude column, which wrongly picked the YTD/audited
  // total. For a June review that yielded April's numbers.) Fall back to the
  // last populated audited column, then to any populated column.
  const populated = (i: number) => lines.some((l) => l.values[i] != null && l.values[i] !== 0)
  let selectedPeriod = -1
  for (let i = cols.length - 1; i >= 0; i--) {
    if (kinds[i] === 'month' && populated(i)) { selectedPeriod = i; break }
  }
  if (selectedPeriod < 0)
    for (let i = cols.length - 1; i >= 0; i--) {
      if (populated(i)) { selectedPeriod = i; break }
    }

  const periods = labels.length ? labels : cols.map((c) => `Col ${c + 1}`)
  const m = computeMetrics(lines, selectedPeriod)

  return {
    detectedSheet: sheet.name,
    periods,
    periodKinds: kinds,
    selectedPeriod,
    lines,
    ...m,
    sheetsAvailable,
    previewRows: sheet.rows.slice(0, 25),
  }
}
