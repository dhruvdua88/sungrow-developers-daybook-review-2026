import type { SaleVoucher, SalesCustomerRow, SalesResult } from '../types'
import { Section, inr } from './ui'
import { SortableTable, type Column } from './SortableTable'
import { GroupTable } from './GroupTable'
import { IconWallet } from './icons'

const BUCKET_CLS: Record<string, string> = {
  '0%': 'bg-rose-50 text-risk ring-rose-200',
  '5%': 'bg-sky-50 text-sky-700 ring-sky-200',
  '12%': 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  '18%': 'bg-violet-50 text-manual ring-violet-200',
  '28%': 'bg-amber-50 text-review ring-amber-200',
  other: 'bg-amber-50 text-review ring-amber-200',
}
const tag = (b: string) => <span className={`tag ring-1 ${BUCKET_CLS[b] ?? BUCKET_CLS.other}`}>{b}</span>

export function SalesGstView({ sales }: { sales: SalesResult }) {
  if (!sales.available) {
    return (
      <Section title="Sales & GST" subtitle="Revenue vouchers + output GST." id="sales" icon={<IconWallet className="h-5 w-5" />}>
        <p className="text-sm text-slatex">No sale vouchers (revenue GL 6xxx) detected in this book.</p>
      </Section>
    )
  }

  // Customer grouped -> per-rate breakdown
  const custParent: Column<SalesCustomerRow>[] = [
    { key: 'customer', label: 'Customer', value: (r) => r.customer, width: 230 },
    { key: 'taxable', label: 'Taxable Sales', numeric: true, value: (r) => r.taxable, render: (r) => inr(r.taxable) },
    { key: 'gst', label: 'Output GST', numeric: true, value: (r) => r.gst, render: (r) => inr(r.gst) },
    { key: 'rate', label: 'Blended %', numeric: true, value: (r) => r.rate ?? 0, render: (r) => (r.rate != null ? `${r.rate.toFixed(1)}%` : '—') },
    { key: 'vouchers', label: 'Vouchers', numeric: true, value: (r) => r.vouchers },
  ]
  type Br = SalesCustomerRow['byRate'][number]
  const custChild: Column<Br>[] = [
    { key: 'rate', label: 'Rate', value: (r) => r.rate, render: (r) => tag(r.rate), width: 230 },
    { key: 'taxable', label: 'Taxable', numeric: true, value: (r) => r.taxable, render: (r) => inr(r.taxable) },
    { key: 'gst', label: 'GST', numeric: true, value: (r) => r.gst, render: (r) => inr(r.gst) },
    { key: 'v', label: 'Vch', numeric: true, value: (r) => r.vouchers },
    { key: 'sp', label: '', value: () => '' },
  ]

  // Voucher explorer
  const vCols: Column<SaleVoucher>[] = [
    { key: 'date', label: 'Date', value: (r) => r.date },
    { key: 'docType', label: 'Type', value: (r) => r.docType },
    { key: 'docNo', label: 'Doc No', value: (r) => r.docNo },
    { key: 'customer', label: 'Customer', value: (r) => r.customer, width: 200 },
    { key: 'taxable', label: 'Taxable', numeric: true, value: (r) => r.taxable, render: (r) => inr(r.taxable) },
    { key: 'sgst', label: 'SGST', numeric: true, value: (r) => r.sgst, render: (r) => (r.sgst ? inr(r.sgst) : '—') },
    { key: 'cgst', label: 'CGST', numeric: true, value: (r) => r.cgst, render: (r) => (r.cgst ? inr(r.cgst) : '—') },
    { key: 'igst', label: 'IGST', numeric: true, value: (r) => r.igst, render: (r) => (r.igst ? inr(r.igst) : '—') },
    { key: 'rate', label: 'GST Rate', numeric: true, value: (r) => r.rate, render: (r) => tag(r.rateBucket) },
    {
      key: 'flag',
      label: 'GST charged?',
      value: (r) => (r.hasGst ? 'Yes' : 'No'),
      render: (r) =>
        r.hasGst ? (
          <span className="text-ok">✓ Yes</span>
        ) : (
          <span className="font-semibold text-risk">✗ No GST</span>
        ),
    },
  ]

  const salesPct = (n: number) => (sales.totalTaxable ? ((n / sales.totalTaxable) * 100).toFixed(1) + '%' : '—')

  return (
    <Section
      title="Sales & GST"
      subtitle="Every sale voucher (revenue GL 6xxx) with its output SGST/CGST/IGST and the effective GST rate. Checks whether GST was charged on each sale."
      id="sales"
      icon={<IconWallet className="h-5 w-5" />}
    >
      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <Kpi label="Taxable sales" value={inr(sales.totalTaxable)} />
        <Kpi label="Output GST" value={inr(sales.totalGst)} accent="text-brand" />
        <Kpi label="Blended rate" value={sales.blendedRate != null ? `${sales.blendedRate.toFixed(2)}%` : '—'} accent="text-ok" />
        <Kpi label="Sale vouchers" value={String(sales.vouchers.length)} />
        <Kpi
          label="Sales without GST"
          value={`${sales.noGstCount} · ${inr(sales.noGstValue)}`}
          accent={sales.noGstCount ? 'text-risk' : 'text-ok'}
        />
      </div>

      {/* Rate distribution */}
      <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-slatex">GST rate distribution</h3>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {sales.rateBuckets.map((b) => (
          <div key={b.rate} className="card relative overflow-hidden p-4">
            <div className="absolute inset-x-0 top-0 h-1 bg-brand-grad" />
            <div className="flex items-baseline justify-between">
              <span className="font-display text-lg font-extrabold text-brand">{b.rate}</span>
              <span className="text-[11px] text-slatex num">{b.vouchers} vch</span>
            </div>
            <div className="mt-1 text-base font-bold text-ink num">{inr(b.taxable)}</div>
            <div className="mt-0.5 text-[11px] text-slatex num">GST {inr(b.gst)} · {salesPct(b.taxable)}</div>
          </div>
        ))}
      </div>

      {sales.noGstCount > 0 && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-risk">
          <span>⚠</span>
          <span>
            <strong>{sales.noGstCount}</strong> sale voucher(s) totalling <strong>{inr(sales.noGstValue)}</strong> carry{' '}
            <strong>no output GST</strong>. Verify zero-rated (export/SEZ), stock-transfer, or a missed charge — see the
            explorer below (filter “No GST”).
          </span>
        </div>
      )}

      {/* Customer breakdown (grouped) */}
      <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-slatex">Sales by customer — click to see rate split</h3>
      <div className="mb-6">
        <GroupTable
          groups={sales.customers}
          parentCols={custParent}
          childCols={custChild}
          getChildren={(c) => c.byRate}
          rowKey={(c) => c.customer}
          initialSort="taxable"
          searchPlaceholder="Filter customer…"
          maxHeight={320}
        />
      </div>

      {/* Sales explorer */}
      <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-slatex">Sales voucher explorer</h3>
      <SortableTable
        columns={vCols}
        rows={sales.vouchers}
        initialSort="taxable"
        searchPlaceholder="Filter customer / doc / rate / No GST…"
        maxRows={1000}
        maxHeight={460}
      />
    </Section>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card p-3">
      <div className="text-[11px] uppercase tracking-wide text-slatex">{label}</div>
      <div className={`mt-0.5 text-base font-bold num ${accent ?? 'text-ink'}`}>{value}</div>
    </div>
  )
}
