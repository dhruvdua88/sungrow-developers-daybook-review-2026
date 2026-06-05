import type { ExpenseTdsRow, VendorApRow } from '../types'
import { Section, inr } from './ui'
import { SortableTable, type Column } from './SortableTable'
import { IconReceipt, IconScale } from './icons'

const pctCell = (p: number | null, good: (p: number) => boolean) => {
  if (p == null) return <span className="text-slate-400">—</span>
  const cls = good(p) ? 'text-ok' : p > 0 ? 'text-review' : 'text-slate-400'
  return <span className={`num font-semibold ${cls}`}>{p.toFixed(1)}%</span>
}

export function ExpenseTdsMis({ rows }: { rows: ExpenseTdsRow[] }) {
  const cols: Column<ExpenseTdsRow>[] = [
    { key: 'glCode', label: 'G/L Account', value: (r) => r.glCode },
    { key: 'ledger', label: 'Expense Ledger', value: (r) => r.ledger, width: 200 },
    { key: 'section', label: 'TDS Sec', value: (r) => r.section || '—' },
    { key: 'expense', label: 'Expense (DR)', numeric: true, value: (r) => r.expense, render: (r) => inr(r.expense) },
    { key: 'tds', label: 'TDS Deducted', numeric: true, value: (r) => r.tds, render: (r) => inr(r.tds) },
    {
      key: 'effRate',
      label: 'TDS %',
      numeric: true,
      value: (r) => r.effRate ?? -1,
      render: (r) => pctCell(r.effRate, (p) => p >= 0.1),
    },
    { key: 'rcm', label: 'RCM GST', numeric: true, value: (r) => r.rcm, render: (r) => (r.rcm ? inr(r.rcm) : '—') },
    { key: 'vendors', label: 'Vendors', numeric: true, value: (r) => r.vendors },
    { key: 'docs', label: 'Vouchers', numeric: true, value: (r) => r.docs },
  ]

  const totalExp = rows.reduce((s, r) => s + r.expense, 0)
  const totalTds = rows.reduce((s, r) => s + r.tds, 0)
  const totalRcm = rows.reduce((s, r) => s + r.rcm, 0)

  return (
    <Section
      title="Expense → TDS / RCM (MIS)"
      subtitle="Every expense ledger (GL 6xxx/7xxx) that hits a vendor invoice — total expense booked, TDS deducted and RCM GST in the same vouchers, with the effective rate. Sort/filter any column."
      id="expense-tds"
      icon={<IconReceipt className="h-5 w-5" />}
    >
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Expense thru AP" value={inr(totalExp)} />
        <Kpi label="TDS deducted" value={inr(totalTds)} accent="text-brand" />
        <Kpi label="Effective TDS %" value={totalExp ? `${((totalTds / totalExp) * 100).toFixed(2)}%` : '—'} accent="text-ok" />
        <Kpi label="RCM GST" value={inr(totalRcm)} accent="text-manual" />
      </div>
      <SortableTable
        columns={cols}
        rows={rows}
        initialSort="expense"
        searchPlaceholder="Filter ledger / GL / section…"
        maxRows={500}
      />
      <p className="mt-2 text-xs text-slatex">
        TDS &amp; RCM are attributed pro-rata across the expense lines of each vendor voucher. A low
        TDS % on a contractor/rent/professional head is a possible short / non-deduction — drill in
        the Transactions tab (filter Line&nbsp;Type = Expense / TDS).
      </p>
    </Section>
  )
}

export function VendorApMis({ rows }: { rows: VendorApRow[] }) {
  const cols: Column<VendorApRow>[] = [
    { key: 'party', label: 'Vendor (Accounting pro.)', value: (r) => r.party, width: 230 },
    { key: 'topLedger', label: 'Main expense head', value: (r) => r.topLedger, width: 180 },
    { key: 'expense', label: 'Expense (DR)', numeric: true, value: (r) => r.expense, render: (r) => inr(r.expense) },
    { key: 'tds', label: 'TDS', numeric: true, value: (r) => r.tds, render: (r) => inr(r.tds) },
    {
      key: 'eff',
      label: 'TDS %',
      numeric: true,
      value: (r) => (r.expense ? (r.tds / r.expense) * 100 : -1),
      render: (r) => pctCell(r.expense ? (r.tds / r.expense) * 100 : null, (p) => p >= 0.1),
    },
    { key: 'rcm', label: 'RCM', numeric: true, value: (r) => r.rcm, render: (r) => (r.rcm ? inr(r.rcm) : '—') },
    { key: 'apCredit', label: 'AP Invoiced (CR)', numeric: true, value: (r) => r.apCredit, render: (r) => inr(r.apCredit) },
    { key: 'apDebit', label: 'AP Paid (DR)', numeric: true, value: (r) => r.apDebit, render: (r) => inr(r.apDebit) },
    { key: 'docs', label: 'Vouchers', numeric: true, value: (r) => r.docs },
  ]
  return (
    <Section
      title="Vendor / AP Ledger (MIS)"
      subtitle="All accounts payable parties — expense booked, TDS & RCM, and AP invoiced vs paid. The party reference is SAP “Accounting pro.”."
      id="vendors"
      icon={<IconScale className="h-5 w-5" />}
    >
      <SortableTable
        columns={cols}
        rows={rows}
        initialSort="expense"
        searchPlaceholder="Filter vendor / expense head…"
        maxRows={500}
      />
    </Section>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card p-3">
      <div className="text-[11px] uppercase tracking-wide text-slatex">{label}</div>
      <div className={`mt-0.5 text-lg font-bold num ${accent ?? 'text-ink'}`}>{value}</div>
    </div>
  )
}
