import type { ColumnMap, DaybookField, RawSheet, WorkbookStructure } from '../types'

// ---------------------------------------------------------------------------
// structureDetector: fuzzy keyword detection of daybook columns + sheet pick.
// No fixed column names assumed.
// ---------------------------------------------------------------------------

/** Keyword sets per logical field. Order matters: earlier = higher priority. */
const FIELD_KEYWORDS: Record<DaybookField, string[]> = {
  date: ['voucher date', 'posting date', 'document date', 'trans date', 'date'],
  voucher_no: ['voucher no', 'voucher number', 'vch no', 'voucher', 'doc no', 'document no'],
  voucher_type: ['voucher type', 'vch type', 'type', 'transaction type'],
  ledger: ['ledger', 'account name', 'g/l', 'gl', 'account', 'head', 'particulars', 'nominal'],
  vendor: ['vendor', 'supplier', 'party', 'customer', 'name'],
  narration: ['narration', 'description', 'remarks', 'remark', 'text', 'note', 'particular'],
  invoice_no: ['invoice no', 'invoice number', 'bill no', 'ref no', 'reference', 'invoice', 'bill'],
  debit: ['debit', 'dr amount', 'dr'],
  credit: ['credit', 'cr amount', 'cr'],
  amount: ['net amount', 'amount', 'value', 'gross amount'],
  pan: ['pan no', 'pan'],
  gstin: ['gstin', 'gst no', 'gst number', 'gst'],
}

function norm(s: string): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9 /]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Match a single header against a field's keywords; returns score (0 = none). */
function scoreHeader(header: string, keywords: string[]): number {
  const h = norm(header)
  if (!h) return 0
  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i]
    if (h === kw) return 100 - i // exact match, highest
    if (h.includes(kw)) return 60 - i // substring
  }
  return 0
}

/**
 * Detect column indices for all daybook fields within one sheet's headers.
 * Each header column can map to at most one field (best score wins).
 */
export function detectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {}
  const used = new Set<number>()

  // Build (field, col, score) candidates, then assign greedily by score.
  const candidates: { field: DaybookField; col: number; score: number }[] = []
  ;(Object.keys(FIELD_KEYWORDS) as DaybookField[]).forEach((field) => {
    headers.forEach((h, col) => {
      const score = scoreHeader(h, FIELD_KEYWORDS[field])
      if (score > 0) candidates.push({ field, col, score })
    })
  })
  candidates.sort((a, b) => b.score - a.score)

  for (const c of candidates) {
    if (map[c.field] !== undefined) continue // field already assigned
    if (used.has(c.col)) continue // column already taken
    map[c.field] = c.col
    used.add(c.col)
  }
  return map
}

/** Score a sheet for "looks like a daybook" — many detected money/date columns. */
function daybookScore(sheet: RawSheet): number {
  const map = detectColumns(sheet.headers)
  let score = 0
  if (map.date !== undefined) score += 3
  if (map.ledger !== undefined) score += 3
  if (map.debit !== undefined) score += 2
  if (map.credit !== undefined) score += 2
  if (map.amount !== undefined) score += 2
  if (map.vendor !== undefined) score += 1
  if (map.narration !== undefined) score += 1
  // Prefer sheets with real data volume.
  score += Math.min(sheet.rows.length, 100) / 100
  return score
}

/**
 * Pick the most daybook-like sheet from a workbook. Returns the sheet plus its
 * column map. Falls back to the largest sheet.
 */
export function detectDaybookSheet(
  wb: WorkbookStructure,
): { sheet: RawSheet | null; columnMap: ColumnMap } {
  if (!wb.sheets.length) return { sheet: null, columnMap: {} }
  let best = wb.sheets[0]
  let bestScore = -1
  for (const s of wb.sheets) {
    const sc = daybookScore(s)
    if (sc > bestScore) {
      bestScore = sc
      best = s
    }
  }
  return { sheet: best, columnMap: detectColumns(best.headers) }
}

/** Human-readable summary of detected fields for the UI. */
export function describeColumnMap(headers: string[], map: ColumnMap): {
  field: DaybookField
  header: string | null
  index: number | null
}[] {
  return (Object.keys(FIELD_KEYWORDS) as DaybookField[]).map((field) => {
    const idx = map[field]
    return {
      field,
      header: idx !== undefined ? headers[idx] ?? null : null,
      index: idx ?? null,
    }
  })
}
