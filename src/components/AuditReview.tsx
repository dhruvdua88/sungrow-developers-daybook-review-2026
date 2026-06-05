import type { AuditResult } from '../types'
import { Section, DataTable, StatusTag, inr } from './ui'
import { IconShield } from './icons'

export function AuditReview({ audit }: { audit: AuditResult }) {
  return (
    <Section
      title="Audit Exceptions"
      subtitle="High-value, round-figure, manual journals, duplicates, related-party and missing-info flags."
      id="audit"
      icon={<IconShield className="h-5 w-5" />}
    >
      <div className="grid gap-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slatex">Exceptions (high value / round / backdated)</h3>
          <DataTable
            columns={['Date', 'Voucher', 'Ledger', 'Amount', 'Category', 'Status', 'Remarks']}
            rows={audit.exceptions
              .slice()
              .sort((a, b) => b.txn.absolute_amount - a.txn.absolute_amount)
              .slice(0, 100)
              .map((f) => [
                f.txn.date,
                f.txn.voucher_no,
                f.txn.ledger,
                inr(f.txn.absolute_amount),
                f.category,
                <StatusTag status={f.status} />,
                f.remarks,
              ])}
            empty="No audit exceptions."
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slatex">Manual journals</h3>
            <DataTable
              columns={['Date', 'Voucher', 'Ledger', 'Amount']}
              rows={audit.manualJournals
                .slice(0, 100)
                .map((f) => [f.txn.date, f.txn.voucher_no, f.txn.ledger, inr(f.txn.absolute_amount)])}
              empty="None."
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slatex">Related-party transactions</h3>
            <DataTable
              columns={['Date', 'Ledger / Vendor', 'Amount', 'Status']}
              rows={audit.relatedParty
                .slice(0, 100)
                .map((f) => [
                  f.txn.date,
                  f.txn.ledger || f.txn.vendor,
                  inr(f.txn.absolute_amount),
                  <StatusTag status={f.status} />,
                ])}
              empty="None."
            />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slatex">Duplicate invoice review</h3>
            <DataTable
              columns={['Reason', 'Count', 'Key']}
              rows={audit.duplicates.map((d) => [d.reason, d.txns.length, d.key.slice(0, 40)])}
              empty="No duplicates found."
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slatex">Missing vendor / PAN / GSTIN</h3>
            <DataTable
              columns={['Date', 'Ledger', 'Amount', 'Status', 'Remarks']}
              rows={audit.missingInfo
                .slice(0, 100)
                .map((f) => [
                  f.txn.date,
                  f.txn.ledger,
                  inr(f.txn.absolute_amount),
                  <StatusTag status={f.status} />,
                  f.remarks,
                ])}
              empty="None."
            />
          </div>
        </div>
      </div>
    </Section>
  )
}
