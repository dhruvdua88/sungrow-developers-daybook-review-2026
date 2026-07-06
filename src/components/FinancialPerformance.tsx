import { useMemo, useState } from 'react'
import type { FinancialsResult } from '../types'
import { computeMetrics } from '../utils/financialsParser'
import { Section, DataTable, inr } from './ui'
import { IconChart } from './icons'

export function FinancialPerformance({ fin }: { fin: FinancialsResult | null }) {
  if (!fin) {
    return (
      <Section title="Financial Performance" id="financials" icon={<IconChart className="h-5 w-5" />}>
        <p className="text-sm text-slatex">No financials file uploaded.</p>
      </Section>
    )
  }

  // Period is user-switchable; defaults to the review month the parser picked.
  const [periodIdx, setPeriodIdx] = useState<number>(fin.selectedPeriod)
  const idx = periodIdx >= 0 && periodIdx < fin.periods.length ? periodIdx : fin.selectedPeriod
  const m = useMemo(() => computeMetrics(fin.lines, idx), [fin.lines, idx])

  const periodLabel = idx >= 0 ? fin.periods[idx] : '—'

  return (
    <Section
      title="Financial Performance"
      subtitle={
        fin.detectedSheet
          ? `Detected P&L sheet: ${fin.detectedSheet} · period: ${periodLabel}`
          : 'Could not auto-detect a P&L sheet — preview shown for manual mapping.'
      }
      id="financials"
      icon={<IconChart className="h-5 w-5" />}
    >
      {fin.periods.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slatex">Period</span>
          <select
            className="field !w-auto"
            value={idx}
            onChange={(e) => setPeriodIdx(Number(e.target.value))}
          >
            {fin.periods.map((p, i) => (
              <option key={i} value={i}>
                {(fin.periodKinds[i] === 'audited' ? '∑ ' : '') + p}
              </option>
            ))}
          </select>
          <span className="text-xs text-slatex">
            month columns show that single month; ∑ columns are audited / cumulative totals
          </span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slatex">P&L summary — {periodLabel}</h3>
          <DataTable
            columns={['Metric', 'Amount']}
            rows={[
              ['Revenue', inr(m.revenue)],
              ['Cost of sales', inr(m.cost)],
              ['Gross profit', inr(m.grossProfit)],
              ['Operating expenses', inr(m.operatingExpenses)],
              ['Net profit', inr(m.netProfit)],
            ]}
          />
          <div className="mt-3">
            <h3 className="mb-1 text-sm font-semibold text-slatex">Variance notes</h3>
            <ul className="list-disc pl-5 text-sm text-ink">
              {m.variances.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slatex">
            Workbook structure ({fin.sheetsAvailable.length} sheets)
          </h3>
          <DataTable
            maxHeight={260}
            columns={['Available sheets']}
            rows={fin.sheetsAvailable.map((s) => [s])}
            empty="—"
          />
        </div>
      </div>

      {fin.lines.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-slatex">Extracted P&L lines (preview)</h3>
          <DataTable
            maxHeight={300}
            columns={['Line', ...fin.periods]}
            rows={fin.lines
              .slice(0, 60)
              .map((l) => [l.label, ...l.values.map((v) => (v == null ? '—' : inr(v)))])}
          />
        </div>
      )}
    </Section>
  )
}
