import type { FinancialsResult } from '../types'
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

  return (
    <Section
      title="Financial Performance"
      subtitle={
        fin.detectedSheet
          ? `Detected P&L sheet: ${fin.detectedSheet}`
          : 'Could not auto-detect a P&L sheet — preview shown for manual mapping.'
      }
      id="financials"
      icon={<IconChart className="h-5 w-5" />}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slatex">P&L summary</h3>
          <DataTable
            columns={['Metric', 'Amount']}
            rows={[
              ['Revenue', inr(fin.revenue)],
              ['Cost of sales', inr(fin.cost)],
              ['Gross profit', inr(fin.grossProfit)],
              ['Operating expenses', inr(fin.operatingExpenses)],
              ['Net profit', inr(fin.netProfit)],
            ]}
          />
          <div className="mt-3">
            <h3 className="mb-1 text-sm font-semibold text-slatex">Variance notes</h3>
            <ul className="list-disc pl-5 text-sm text-ink">
              {fin.variances.map((v, i) => (
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
