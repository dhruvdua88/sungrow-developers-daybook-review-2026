import type { TdsWaterfall, WaterfallPartyRow } from '../types'
import { Section, StatusTag, inr } from './ui'
import { SortableTable, type Column } from './SortableTable'
import { IconScale } from './icons'

export function TdsWaterfallView({ wf }: { wf: TdsWaterfall }) {
  if (!wf.available) {
    return (
      <Section
        title="TDS Waterfall"
        subtitle="Actual-deducted recon — appears when the book carries TDS ledgers (e.g. SAP “TDS - 194C”)."
        id="waterfall"
        icon={<IconScale className="h-5 w-5" />}
      >
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-sm text-slatex">
          No TDS ledgers detected in this book. The waterfall reconciles{' '}
          <em>actually-deducted</em> TDS (credits on “TDS - 194x” ledgers) by party and section. For
          books that don’t self-deduct, use the rule-based TDS Review instead.
        </div>
      </Section>
    )
  }

  const partyCols: Column<WaterfallPartyRow>[] = [
    { key: 'party', label: 'Party (Accounting pro.)', value: (r) => r.party, width: 220 },
    { key: 'section', label: 'Section', value: (r) => r.section },
    { key: 'rate', label: 'Rate %', numeric: true, value: (r) => r.rate },
    { key: 'deducted', label: 'TDS Deducted', numeric: true, value: (r) => r.deducted, render: (r) => inr(r.deducted) },
    {
      key: 'impliedBase',
      label: 'Implied Base',
      numeric: true,
      value: (r) => r.impliedBase,
      render: (r) => (r.rate ? inr(r.impliedBase) : '—'),
    },
    { key: 'docs', label: 'Vouchers', numeric: true, value: (r) => r.docs.length },
    { key: 'flag', label: 'Flag', value: (r) => r.flag, render: (r) => <StatusTag status={r.flag} /> },
  ]

  return (
    <Section
      title="TDS Waterfall"
      subtitle={`Actual-deducted basis — ${wf.detectedTdsLedgers.length} TDS ledgers detected. Deductions grossed up to base at statutory rate, rolled up by party × section.`}
      id="waterfall"
      icon={<IconScale className="h-5 w-5" />}
    >
      {/* Section cascade */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {wf.sections.map((s) => (
          <div key={s.section} className="card relative overflow-hidden p-4">
            <div className="absolute inset-x-0 top-0 h-1 bg-brand-grad" />
            <div className="flex items-baseline justify-between">
              <span className="font-display text-lg font-extrabold text-brand">{s.section}</span>
              <span className="text-[11px] text-slatex">{s.rate ? `${s.rate}%` : 'salary'}</span>
            </div>
            <div className="mt-0.5 truncate text-[11px] text-slatex">{s.nature}</div>
            <div className="mt-2 text-xl font-bold text-ink num">{inr(s.deducted)}</div>
            <div className="mt-1 text-[11px] text-slatex num">
              base {s.rate ? inr(s.impliedBase) : '—'} · {s.parties} parties
            </div>
          </div>
        ))}
        <div className="card relative overflow-hidden bg-brand-grad p-4 text-white">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white/80">
            Total TDS deducted
          </div>
          <div className="mt-2 font-display text-2xl font-extrabold num">{inr(wf.totalDeducted)}</div>
          <div className="mt-1 text-[11px] text-white/80 num">{wf.parties.length} party-section rows</div>
        </div>
      </div>

      {/* Party-wise waterfall — sortable + filterable */}
      <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-slatex">
        Party × Section — click headers to sort, type to filter
      </h3>
      <SortableTable
        columns={partyCols}
        rows={wf.parties}
        initialSort="deducted"
        searchPlaceholder="Filter party / section…"
        maxRows={500}
      />
    </Section>
  )
}
