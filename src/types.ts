// ---------------------------------------------------------------------------
// Shared types for the Sungrow Monthly Review Engine
// ---------------------------------------------------------------------------

/** A raw parsed sheet: header row + data rows as arrays of cell values. */
export interface RawSheet {
  name: string
  /** Best-guessed header row index (0-based) within `rows`. */
  headerRowIndex: number
  /** Detected header labels (strings). */
  headers: string[]
  /** All non-empty data rows (each row is an array aligned to `headers`). */
  rows: unknown[][]
  /** Total raw rows in the sheet (before header detection / trimming). */
  totalRows: number
}

export interface WorkbookStructure {
  fileName: string
  sheets: RawSheet[]
  warnings: string[]
}

/** Maps a logical field to the detected column index in a sheet. */
export type ColumnMap = Partial<Record<DaybookField, number>>

export type DaybookField =
  | 'date'
  | 'voucher_no'
  | 'voucher_type'
  | 'ledger'
  | 'vendor'
  | 'narration'
  | 'invoice_no'
  | 'debit'
  | 'credit'
  | 'amount'
  | 'pan'
  | 'gstin'

/** A normalized daybook transaction. */
export interface Txn {
  rowIndex: number
  date: string
  dateValue: number | null // sortable numeric (epoch ms) when parseable
  voucher_no: string
  voucher_type: string
  ledger: string
  vendor: string
  narration: string
  invoice_no: string
  debit: number
  credit: number
  amount: number
  absolute_amount: number
  pan: string
  gstin: string
  combined_text: string
}

// ---------------------------------------------------------------------------
// Rule engine
// ---------------------------------------------------------------------------

export interface TdsRule {
  section: string // e.g. '194J'
  label: string
  keywords: string[]
  rate: number // percent, e.g. 10
  thresholdSingle?: number
  thresholdAnnual?: number
  excluded?: boolean // true => "No TDS expected"
  manualReview?: boolean // flag for manual check regardless
  note?: string
}

export interface RuleConfig {
  tds: TdsRule[]
  /** Round-value audit threshold. */
  roundValueThreshold: number
  /** High-value audit threshold. */
  highValueThreshold: number
  /** Related-party keyword list. */
  relatedPartyKeywords: string[]
}

// ---------------------------------------------------------------------------
// Classification output
// ---------------------------------------------------------------------------

export type RiskStatus = 'OK' | 'Review' | 'High Risk' | 'Manual Check'

export interface ClassifiedTxn extends Txn {
  tdsSection: string // matched section or '' / 'Excluded'
  tdsRate: number
  expectedTds: number
  tdsStatus: RiskStatus
  tdsRemarks: string
  unmapped: boolean
}

export interface VendorTdsSummary {
  vendor: string
  txnCount: number
  totalAmount: number
  tdsBase: number
  expectedTds: number
  sections: string[]
}

export interface LedgerTdsSummary {
  ledger: string
  section: string
  txnCount: number
  totalAmount: number
  expectedTds: number
  status: RiskStatus
}

export interface TdsResult {
  classified: ClassifiedTxn[]
  potential: ClassifiedTxn[]
  unmappedLedgers: LedgerTdsSummary[]
  vendorSummary: VendorTdsSummary[]
  ledgerSummary: LedgerTdsSummary[]
  highValue: ClassifiedTxn[]
  totalTdsBase: number
  totalExpectedTds: number
}

// ---------------------------------------------------------------------------
// GST / RCM
// ---------------------------------------------------------------------------

export interface GstFlag {
  txn: Txn
  category: string
  remarks: string
  status: RiskStatus
}

export interface GstLedgerRow {
  ledger: string
  txnCount: number
  debit: number
  credit: number
  net: number
}

export interface GstResult {
  ledgerSummary: GstLedgerRow[]
  possibleRcm: GstFlag[]
  withoutGstin: GstFlag[]
  exceptions: GstFlag[]
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface AuditFlag {
  txn: Txn
  category: string
  remarks: string
  status: RiskStatus
}

export interface DuplicateGroup {
  key: string
  reason: string
  txns: Txn[]
}

export interface AuditResult {
  exceptions: AuditFlag[]
  duplicates: DuplicateGroup[]
  relatedParty: AuditFlag[]
  missingInfo: AuditFlag[]
  manualJournals: AuditFlag[]
}

// ---------------------------------------------------------------------------
// Financials
// ---------------------------------------------------------------------------

export interface PnlLine {
  label: string
  values: (number | null)[] // aligned to `periods`
}

export interface FinancialsResult {
  detectedSheet: string | null
  periods: string[]
  lines: PnlLine[]
  // Key extracted metrics (best effort; null when not found)
  revenue: number | null
  cost: number | null
  grossProfit: number | null
  operatingExpenses: number | null
  netProfit: number | null
  variances: string[]
  sheetsAvailable: string[]
  previewRows: unknown[][]
}

// ---------------------------------------------------------------------------
// Top-level review bundle
// ---------------------------------------------------------------------------

export interface ReviewResult {
  month: string
  generatedAt: string
  daybookStructure: WorkbookStructure | null
  financialsStructure: WorkbookStructure | null
  columnMap: ColumnMap
  detectedDaybookSheet: string | null
  transactions: Txn[]
  tds: TdsResult
  gst: GstResult
  audit: AuditResult
  financials: FinancialsResult | null
  warnings: string[]
  kpis: Kpis
}

export interface Kpis {
  totalTxns: number
  totalValue: number
  tdsBase: number
  expectedTds: number
  unmappedCount: number
  highValueCount: number
  rcmCount: number
  auditExceptionCount: number
}
