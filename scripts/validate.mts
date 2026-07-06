/**
 * Headless validation harness — runs the REAL app pipeline over a daybook +
 * financials file, prints control totals, and asserts basic sanity. Use it to
 * validate a new monthly file BEFORE trusting the browser, and as a regression
 * guard after code changes.
 *
 *   npx tsx scripts/validate.mts <daybook.xlsx> [financials.xlsx]
 *
 * Everything here mirrors what the browser does (parseFile → detect → normalize
 * → runReview → runFinancials), so a pass here means the browser will not crash.
 */
import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { parseFile } from '../src/utils/excelParser'
import { detectDaybookSheet, describeColumnMap } from '../src/utils/structureDetector'
import { runReview } from '../src/utils/review'
import { runFinancials } from '../src/utils/financialsParser'
import { DEFAULT_RULES } from '../src/utils/tdsRules'

const [dbPath, finPath] = process.argv.slice(2)
if (!dbPath) {
  console.error('usage: tsx scripts/validate.mts <daybook.xlsx> [financials.xlsx]')
  process.exit(2)
}

function fileFrom(path: string): File {
  const buf = readFileSync(path)
  const name = path.split('/').pop() ?? path
  return {
    name,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  } as unknown as File
}
const fmt = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: 0 })

let failures = 0
const check = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? '✓' : '✗'} ${msg}`)
  if (!ok) failures++
}

const t0 = performance.now()
const dbWb = await parseFile(fileFrom(dbPath))
const finWb = finPath ? await parseFile(fileFrom(finPath)) : null

console.log('\n=== DAYBOOK ===', dbWb.fileName)
const det = detectDaybookSheet(dbWb)
console.log('  sheet:', det.sheet?.name, '· rows:', det.sheet?.rows.length)
for (const d of describeColumnMap(det.sheet?.headers ?? [], det.columnMap))
  if (d.index !== null) console.log(`    ${d.field.padEnd(13)} <- [${d.index}] "${d.header}"`)

const result = runReview('validate', dbWb, finWb, DEFAULT_RULES)
const drSum = result.transactions.reduce((s, t) => s + t.debit, 0)
const crSum = result.transactions.reduce((s, t) => s + t.credit, 0)
console.log('  DR:', fmt(drSum), '· CR:', fmt(crSum))
console.log('  KPIs:', JSON.stringify(result.kpis))

check(result.transactions.length > 0, `normalized ${result.transactions.length} transactions`)
check(Math.abs(drSum - crSum) < 1, 'daybook balances (ΣDR = ΣCR)')
check(det.columnMap.debit !== undefined && det.columnMap.credit !== undefined, 'DR/CR columns detected')

if (finWb) {
  console.log('\n=== FINANCIALS ===', finWb.fileName)
  const fin = runFinancials(finWb)
  const period = fin.selectedPeriod >= 0 ? fin.periods[fin.selectedPeriod] : '—'
  console.log('  P&L sheet:', fin.detectedSheet, '· default period:', period)
  console.log('  revenue:', fmt(fin.revenue), '· cost:', fmt(fin.cost), '· net:', fmt(fin.netProfit))
  check(fin.detectedSheet !== null, 'P&L sheet detected')
  check(fin.selectedPeriod >= 0, 'a review period was selected')
  check(fin.periodKinds[fin.selectedPeriod] === 'month', 'default period is a single month (not a YTD/audited total)')
}

console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`} · ${(performance.now() - t0).toFixed(0)}ms`)
process.exit(failures === 0 ? 0 : 1)
