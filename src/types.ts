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
  | 'gl_code'
  | 'ledger'
  | 'vendor'
  | 'narration'
  | 'reference'
  | 'invoice_no'
  | 'debit'
  | 'credit'
  | 'amount'
  | 'pan'
  | 'gstin'

/** Line classification by GL prefix / ledger text — used for the explorer filter. */
export type LineType =
  | 'TDS'
  | 'GST'
  | 'Vendor/AP'
  | 'Bank'
  | 'Expense'
  | 'Rev/COS'
  | 'Inventory/FA'
  | 'Receivable'
  | 'Other'

/** A normalized daybook transaction. */
export interface Txn {
  rowIndex: number
  date: string
  dateValue: number | null // sortable numeric (epoch ms) when parseable
  voucher_no: string // SAP: DocumentNo
  voucher_type: string // SAP: Document Type
  gl_code: string // SAP: G/L Account (number)
  ledger: string // SAP: G/L Account Text (ledger name)
  vendor: string // SAP: Accounting pro. (party)
  narration: string // SAP: Text
  reference: string // SAP: reference
  invoice_no: string
  debit: number
  credit: number
  amount: number
  absolute_amount: number
  pan: string
  gstin: string
  combined_text: string
  lineType: LineType
  /** TDS section parsed from the ledger text when this line is a TDS ledger. */
  tdsLedgerSection: string
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
// TDS Waterfall (actual-deducted basis) — for books that already carry TDS
// ledgers (e.g. SAP "TDS - 194C"). We report what was ACTUALLY deducted,
// gross it up to base at the statutory rate, and roll up by party × section.
// ---------------------------------------------------------------------------

export interface WaterfallSectionRow {
  section: string // 194C / 194J / 194I / 194Q / 192B
  nature: string
  rate: number // statutory %, 0 when n/a (salary)
  deducted: number // sum of TDS credits booked
  impliedBase: number // deducted / rate
  parties: number
}

export interface WaterfallPartyRow {
  party: string
  section: string
  rate: number
  deducted: number
  impliedBase: number
  expected: number // impliedBase * rate (tautological here; kept for layout/extension)
  variance: number
  flag: RiskStatus
  docs: string[]
}

export interface TdsWaterfall {
  /** true when the book already carries TDS ledgers (actual-deducted mode available). */
  available: boolean
  sections: WaterfallSectionRow[]
  parties: WaterfallPartyRow[]
  totalDeducted: number
  /** TDS ledger names detected in the book. */
  detectedTdsLedgers: string[]
}

// ---------------------------------------------------------------------------
// MIS — management view built directly from the daybook (no financials file).
// P&L from GL 6xxx/7xxx, and expense -> AP -> TDS/RCM rollups.
// ---------------------------------------------------------------------------

export interface GlLine {
  code: string
  name: string
  amount: number
}

export interface DaybookPnl {
  available: boolean
  revenue: number
  cogs: number
  grossProfit: number
  grossMarginPct: number | null
  operatingExpenses: number
  finance: number
  pbt: number
  netMarginPct: number | null
  revenueLines: GlLine[]
  cogsLines: GlLine[]
  opexLines: GlLine[]
  financeLines: GlLine[]
}

/** Party slice within an expense head. */
export interface PartyBreak {
  party: string
  amount: number
  tds: number
  rcm: number
  docs: number
}

/** Expense-head slice within a party. */
export interface HeadBreak {
  glCode: string
  ledger: string
  amount: number
  tds: number
  rcm: number
  docs: number
}

/** Expense ledger (GL 6xxx/7xxx) rolled up against the TDS & RCM booked on its
 *  vendor invoices. Effective rate = TDS / expense. */
export interface ExpenseTdsRow {
  glCode: string
  ledger: string
  section: string // inferred section label (194I/194J/194C…) from name/rate
  expense: number
  tds: number
  effRate: number | null
  rcm: number
  rcmRate: number | null
  vendors: number
  docs: number
  parties: PartyBreak[] // party-wise breakdown (for expand)
}

/** Vendor (AP party) rolled up: expense booked, TDS, RCM, AP movement. */
export interface VendorApRow {
  party: string
  expense: number
  tds: number
  rcm: number
  apCredit: number // invoices booked to AP
  apDebit: number // payments / debits to AP
  docs: number
  topLedger: string
  heads: HeadBreak[] // where the party's spend is going (for expand)
}

export interface MisResult {
  pnl: DaybookPnl
  expenseTds: ExpenseTdsRow[]
  vendors: VendorApRow[]
  totalExpense: number
  totalTds: number
  totalRcm: number
  effTdsRate: number | null
}

// ---------------------------------------------------------------------------
// Sales & output-GST analysis (revenue GL 6xxx + SGST/CGST/IGST PAYABLE).
// ---------------------------------------------------------------------------

export interface SaleVoucher {
  docNo: string
  docType: string
  date: string
  customer: string
  taxable: number
  sgst: number
  cgst: number
  igst: number
  gst: number
  rate: number // (gst/taxable)*100
  rateBucket: string // '0%' | '5%' | '12%' | '18%' | '28%' | 'other'
  hasGst: boolean
}

export interface GstRateBucket {
  rate: string
  vouchers: number
  taxable: number
  gst: number
}

export interface SalesCustomerRow {
  customer: string
  taxable: number
  gst: number
  rate: number | null
  vouchers: number
  byRate: { rate: string; taxable: number; gst: number; vouchers: number }[]
}

export interface SalesResult {
  available: boolean
  vouchers: SaleVoucher[]
  rateBuckets: GstRateBucket[]
  customers: SalesCustomerRow[]
  totalTaxable: number
  totalGst: number
  blendedRate: number | null
  noGstCount: number
  noGstValue: number
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
  mis: MisResult
  sales: SalesResult
  matrix: import('./utils/txnMatrix').TxnMatrix
  tds: TdsResult
  tdsWaterfall: TdsWaterfall
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
