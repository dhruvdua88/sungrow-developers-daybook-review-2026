import type { TdsResult } from '../types'
import { Section, DataTable, StatusTag, inr } from './ui'
import { IconReceipt } from './icons'

export function TdsReview({ tds }: { tds: TdsResult }) {
  return (
    <Section
      title="TDS Review"
      subtitle="Rule-engine classification — indicative sections, rates and expected TDS. Verify before deduction."
      id="tds"
      icon={<IconReceipt className="h-5 w-5" />}
    >
      <div className="grid gap-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slatex">Vendor-wise TDS summary</h3>
          <DataTable
            columns={['Vendor', 'Txns', 'Total Amount', 'TDS Base', 'Expected TDS', 'Sections']}
            rows={tds.vendorSummary
              .slice(0, 50)
              .map((v) => [
                v.vendor,
                v.txnCount,
                inr(v.totalAmount),
                inr(v.tdsBase),
                inr(v.expectedTds),
                v.sections.join(', ') || '—',
              ])}
          />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slatex">Ledger-wise TDS summary</h3>
          <DataTable
            columns={['Ledger', 'Section', 'Txns', 'Total Amount', 'Expected TDS', 'Status']}
            rows={tds.ledgerSummary
              .slice(0, 50)
              .map((l) => [
                l.ledger,
                l.section,
                l.txnCount,
                inr(l.totalAmount),
                inr(l.expectedTds),
                <StatusTag status={l.status} />,
              ])}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slatex">Unmapped ledgers</h3>
            <DataTable
              columns={['Ledger', 'Txns', 'Total Amount']}
              rows={tds.unmappedLedgers.map((l) => [l.ledger, l.txnCount, inr(l.totalAmount)])}
              empty="All ledgers mapped."
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slatex">Potential TDS transactions</h3>
            <DataTable
              columns={['Date', 'Ledger', 'Amount', 'Sec', 'Exp TDS', 'Status']}
              rows={tds.potential
                .slice(0, 100)
                .map((c) => [
                  c.date,
                  c.ledger,
                  inr(c.absolute_amount),
                  c.tdsSection,
                  inr(c.expectedTds),
                  <StatusTag status={c.tdsStatus} />,
                ])}
              empty="No potential TDS transactions."
            />
          </div>
        </div>
      </div>
    </Section>
  )
}
