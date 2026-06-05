import type { GstResult } from '../types'
import { Section, DataTable, StatusTag, inr } from './ui'
import { IconScale } from './icons'

export function GstReview({ gst }: { gst: GstResult }) {
  return (
    <Section
      title="GST / RCM Review"
      subtitle="Heuristic flags for reverse charge, missing GSTIN and GST ledger movement."
      id="gst"
      icon={<IconScale className="h-5 w-5" />}
    >
      <div className="grid gap-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slatex">Possible RCM items</h3>
          <DataTable
            columns={['Date', 'Ledger / Vendor', 'Amount', 'Category', 'Status', 'Remarks']}
            rows={gst.possibleRcm
              .slice(0, 100)
              .map((f) => [
                f.txn.date,
                f.txn.ledger || f.txn.vendor,
                inr(f.txn.absolute_amount),
                f.category,
                <StatusTag status={f.status} />,
                f.remarks,
              ])}
            empty="No RCM flags."
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slatex">Expenses without GSTIN</h3>
            <DataTable
              columns={['Date', 'Ledger', 'Amount', 'Status']}
              rows={gst.withoutGstin
                .slice(0, 100)
                .map((f) => [f.txn.date, f.txn.ledger, inr(f.txn.absolute_amount), <StatusTag status={f.status} />])}
              empty="None."
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slatex">GST ledger summary</h3>
            <DataTable
              columns={['Ledger', 'Txns', 'Debit', 'Credit', 'Net']}
              rows={gst.ledgerSummary.map((r) => [r.ledger, r.txnCount, inr(r.debit), inr(r.credit), inr(r.net)])}
              empty="No GST ledgers detected."
            />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slatex">GST exceptions</h3>
          <DataTable
            columns={['Date', 'Ledger', 'Amount', 'Category', 'Remarks']}
            rows={gst.exceptions
              .slice(0, 100)
              .map((f) => [f.txn.date, f.txn.ledger, inr(f.txn.absolute_amount), f.category, f.remarks])}
            empty="No GST exceptions."
          />
        </div>
      </div>
    </Section>
  )
}
