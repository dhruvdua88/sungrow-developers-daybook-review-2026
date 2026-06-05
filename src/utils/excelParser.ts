import * as XLSX from '@e965/xlsx'
import type { RawSheet, WorkbookStructure } from '../types'

// ---------------------------------------------------------------------------
// excelParser: read an uploaded File into a normalized WorkbookStructure.
// Robust against blank rows, odd headers, merged cells and weird structures.
// ---------------------------------------------------------------------------

/** Read a browser File into an XLSX workbook. */
export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer()
  // cellDates keeps real dates; raw values preserved otherwise.
  return XLSX.read(buf, { type: 'array', cellDates: true })
}

/** Count non-empty cells in a row. */
function nonEmpty(row: unknown[]): number {
  return row.filter((c) => c !== null && c !== undefined && String(c).trim() !== '').length
}

/**
 * Guess the header row: scan the first ~25 rows and pick the row with the most
 * non-empty *string* cells (headers are usually text). Falls back to row 0.
 */
function guessHeaderRow(matrix: unknown[][]): number {
  const scan = Math.min(matrix.length, 25)
  let best = 0
  let bestScore = -1
  for (let i = 0; i < scan; i++) {
    const row = matrix[i] ?? []
    const textCells = row.filter(
      (c) => typeof c === 'string' && String(c).trim().length > 0,
    ).length
    const filled = nonEmpty(row)
    // Prefer rows with many text cells AND decent fill; penalise near-empty rows.
    const score = textCells * 2 + filled
    if (filled >= 2 && score > bestScore) {
      bestScore = score
      best = i
    }
  }
  return best
}

/** Build clean header labels; synthesise names for blank header cells. */
function buildHeaders(headerRow: unknown[], width: number): string[] {
  const headers: string[] = []
  for (let c = 0; c < width; c++) {
    const raw = headerRow[c]
    let label = raw === null || raw === undefined ? '' : String(raw).trim()
    label = label.replace(/\s+/g, ' ')
    if (!label) label = `Column ${c + 1}`
    headers.push(label)
  }
  return headers
}

/** Parse a single worksheet into a RawSheet. */
function parseSheet(name: string, ws: XLSX.WorkSheet): RawSheet {
  // sheet_to_json with header:1 gives an array-of-arrays matrix.
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: false,
    defval: null,
    raw: true,
  })

  const totalRows = matrix.length
  if (totalRows === 0) {
    return { name, headerRowIndex: 0, headers: [], rows: [], totalRows: 0 }
  }

  const headerRowIndex = guessHeaderRow(matrix)
  const width = matrix.reduce((m, r) => Math.max(m, r?.length ?? 0), 0)
  const headers = buildHeaders(matrix[headerRowIndex] ?? [], width)

  const rows: unknown[][] = []
  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? []
    if (nonEmpty(row) === 0) continue // skip blank rows
    // pad/truncate to width
    const aligned: unknown[] = []
    for (let c = 0; c < width; c++) aligned.push(row[c] ?? null)
    rows.push(aligned)
  }

  return { name, headerRowIndex, headers, rows, totalRows }
}

/** Parse an uploaded file into a full WorkbookStructure. */
export async function parseFile(file: File): Promise<WorkbookStructure> {
  const warnings: string[] = []
  let wb: XLSX.WorkBook
  try {
    wb = await readWorkbook(file)
  } catch (e) {
    warnings.push(
      `Could not read "${file.name}": ${(e as Error).message}. The file may be corrupt or truncated.`,
    )
    return { fileName: file.name, sheets: [], warnings }
  }

  const sheets: RawSheet[] = []
  for (const name of wb.SheetNames) {
    try {
      const ws = wb.Sheets[name]
      if (!ws) continue
      const sheet = parseSheet(name, ws)
      sheets.push(sheet)
    } catch (e) {
      warnings.push(`Sheet "${name}" skipped: ${(e as Error).message}`)
    }
  }

  if (sheets.length === 0) {
    warnings.push(`No readable sheets found in "${file.name}".`)
  }

  return { fileName: file.name, sheets, warnings }
}
