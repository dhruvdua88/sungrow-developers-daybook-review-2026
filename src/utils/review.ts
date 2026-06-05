import type { ColumnMap, ReviewResult, RuleConfig, Txn, WorkbookStructure } from '../types'
import { detectDaybookSheet } from './structureDetector'
import { normalize } from './normalizer'
import { runMis } from './mis'
import { runTds } from './tdsRules'
import { runTdsWaterfall } from './tdsWaterfall'
import { runGst } from './gstRules'
import { runAudit } from './auditRules'
import { runFinancials } from './financialsParser'

// ---------------------------------------------------------------------------
// review: orchestrate the full monthly review from parsed workbooks + rules.
// ---------------------------------------------------------------------------

function now(): string {
  const d = new Date()
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function runReview(
  month: string,
  daybook: WorkbookStructure | null,
  financials: WorkbookStructure | null,
  rules: RuleConfig,
  /** optional manual overrides */
  overrideSheet?: string,
  overrideMap?: ColumnMap,
): ReviewResult {
  const warnings: string[] = []
  if (daybook) warnings.push(...daybook.warnings)
  if (financials) warnings.push(...financials.warnings)

  let detectedDaybookSheet: string | null = null
  let columnMap: ColumnMap = {}
  let transactions: Txn[] = []

  if (daybook && daybook.sheets.length) {
    const det = detectDaybookSheet(daybook)
    let sheet = det.sheet
    columnMap = det.columnMap
    if (overrideSheet) {
      const found = daybook.sheets.find((s) => s.name === overrideSheet)
      if (found) {
        sheet = found
        columnMap = overrideMap ?? det.columnMap
      }
    }
    if (sheet) {
      detectedDaybookSheet = sheet.name
      transactions = normalize(sheet, columnMap)
      if (transactions.length === 0)
        warnings.push(`Daybook sheet "${sheet.name}" produced 0 transactions — check column detection.`)
      if (columnMap.debit === undefined && columnMap.credit === undefined && columnMap.amount === undefined)
        warnings.push('No debit/credit/amount column detected — amounts may be zero.')
    }
  } else {
    warnings.push('No daybook file provided — TDS / GST / audit analysis is empty.')
  }

  const mis = runMis(transactions)
  const tds = runTds(transactions, rules)
  const tdsWaterfall = runTdsWaterfall(transactions)
  const gst = runGst(transactions, rules)
  const audit = runAudit(transactions, rules)
  const fin = runFinancials(financials)

  const totalValue = transactions.reduce((s, t) => s + t.absolute_amount, 0)

  return {
    month,
    generatedAt: now(),
    daybookStructure: daybook,
    financialsStructure: financials,
    columnMap,
    detectedDaybookSheet,
    transactions,
    mis,
    tds,
    tdsWaterfall,
    gst,
    audit,
    financials: fin,
    warnings,
    kpis: {
      totalTxns: transactions.length,
      totalValue,
      tdsBase: tds.totalTdsBase,
      expectedTds: tds.totalExpectedTds,
      unmappedCount: tds.classified.filter((c) => c.unmapped).length,
      highValueCount: tds.highValue.length,
      rcmCount: gst.possibleRcm.length,
      auditExceptionCount: audit.exceptions.length,
    },
  }
}
