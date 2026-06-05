import type { ExpenseTdsRow, HeadBreak, PartyBreak, VendorApRow } from '../types'
import { Section, inr } from './ui'
import { GroupTable } from './GroupTable'
import type { Column } from './SortableTable'
import { IconReceipt, IconScale } from './icons'

const pctCell = (p: number | null) => {
  if (p == null) return <span className="text-slate-400">—</span>
  const cls = p >= 0.1 ? 'text-ok' : p > 0 ? 'text-review' : 'text-slate-400'
  return <span className={`num font-semibold ${cls}`}>{p.toFixed(1)}%</span>
}
const eff = (tds: number, amt: number) => (amt ? (tds / amt) * 100 : null)

// ---- View 1: Expense head -> party breakdown ----
export function ExpenseHeadView({ rows }: { rows: ExpenseTdsRow[] }) {
  const parentCols: Column<ExpenseTdsRow>[] = [
    { key: 'ledger', label: 'Expense Head (Ledger)', value: (r) => r.ledger, width: 210 },
    { key: 'glCode', label: 'G/L', value: (r) => r.glCode },
    { key: 'section', label: 'Sec', value: (r) => r.section || '—' },
    { key: 'expense', label: 'Total Amount', numeric: true, value: (r) => r.expense, render: (r) => inr(r.expense) },
    { key: 'tds', label: 'TDS', numeric: true, value: (r) => r.tds, render: (r) => inr(r.tds) },
    { key: 'eff', label: 'TDS %', numeric: true, value: (r) => r.effRate ?? -1, render: (r) => pctCell(r.effRate) },
    { key: 'rcm', label: 'RCM', numeric: true, value: (r) => r.rcm, render: (r) => (r.rcm ? inr(r.rcm) : '—') },
    { key: 'vendors', label: 'Parties', numeric: true, value: (r) => r.vendors },
  ]
  const childCols: Column<PartyBreak>[] = [
    { key: 'party', label: 'Party', value: (r) => r.party, width: 210 },
    { key: 'g', label: '', value: () => '' },
    { key: 's', label: '', value: () => '' },
    { key: 'amount', label: 'Amount', numeric: true, value: (r) => r.amount, render: (r) => inr(r.amount) },
    { key: 'tds', label: 'TDS', numeric: true, value: (r) => r.tds, render: (r) => inr(r.tds) },
    { key: 'eff', label: 'TDS %', numeric: true, value: (r) => eff(r.tds, r.amount) ?? -1, render: (r) => pctCell(eff(r.tds, r.amount)) },
    { key: 'rcm', label: 'RCM', numeric: true, value: (r) => r.rcm, render: (r) => (r.rcm ? inr(r.rcm) : '—') },
    { key: 'docs', label: 'Vch', numeric: true, value: (r) => r.docs },
  ]
  const totExp = rows.reduce((s, r) => s + r.expense, 0)
  const totTds = rows.reduce((s, r) => s + r.tds, 0)
  const totRcm = rows.reduce((s, r) => s + r.rcm, 0)
  return (
    <Section
      title="Expense Head → Party"
      subtitle="Each expense ledger (GL 6xxx/7xxx) with its TDS, effective rate and RCM. Click a head to see the party-wise split."
      id="expense-head"
      icon={<IconReceipt className="h-5 w-5" />}
    >
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total expense (AP)" value={inr(totExp)} />
        <Kpi label="TDS deducted" value={inr(totTds)} accent="text-brand" />
        <Kpi label="Effective TDS %" value={totExp ? `${((totTds / totExp) * 100).toFixed(2)}%` : '—'} accent="text-ok" />
        <Kpi label="RCM (REVE CH)" value={inr(totRcm)} accent="text-manual" />
      </div>
      <GroupTable
        groups={rows}
        parentCols={parentCols}
        childCols={childCols}
        getChildren={(r) => r.parties}
        rowKey={(r) => r.glCode + r.ledger}
        initialSort="expense"
        searchPlaceholder="Filter expense head / GL / section…"
      />
    </Section>
  )
}

// ---- View 2: Party (AP) -> expense heads (bird's-eye) ----
export function PartyApView({ rows }: { rows: VendorApRow[] }) {
  const parentCols: Column<VendorApRow>[] = [
    { key: 'party', label: 'Party (AP / Accounting pro.)', value: (r) => r.party, width: 230 },
    { key: 'expense', label: 'Total Amount', numeric: true, value: (r) => r.expense, render: (r) => inr(r.expense) },
    { key: 'tds', label: 'TDS', numeric: true, value: (r) => r.tds, render: (r) => inr(r.tds) },
    { key: 'eff', label: 'TDS %', numeric: true, value: (r) => eff(r.tds, r.expense) ?? -1, render: (r) => pctCell(eff(r.tds, r.expense)) },
    { key: 'rcm', label: 'RCM', numeric: true, value: (r) => r.rcm, render: (r) => (r.rcm ? inr(r.rcm) : '—') },
    { key: 'apCredit', label: 'AP Invoiced', numeric: true, value: (r) => r.apCredit, render: (r) => inr(r.apCredit) },
    { key: 'apDebit', label: 'AP Paid', numeric: true, value: (r) => r.apDebit, render: (r) => inr(r.apDebit) },
    { key: 'out', label: 'Outstanding', numeric: true, value: (r) => r.apCredit - r.apDebit, render: (r) => inr(r.apCredit - r.apDebit) },
  ]
  const childCols: Column<HeadBreak>[] = [
    { key: 'ledger', label: 'Expense head', value: (r) => r.ledger, width: 230 },
    { key: 'amount', label: 'Amount', numeric: true, value: (r) => r.amount, render: (r) => inr(r.amount) },
    { key: 'tds', label: 'TDS', numeric: true, value: (r) => r.tds, render: (r) => inr(r.tds) },
    { key: 'eff', label: 'TDS %', numeric: true, value: (r) => eff(r.tds, r.amount) ?? -1, render: (r) => pctCell(eff(r.tds, r.amount)) },
    { key: 'rcm', label: 'RCM', numeric: true, value: (r) => r.rcm, render: (r) => (r.rcm ? inr(r.rcm) : '—') },
    { key: 'docs', label: 'Vch', numeric: true, value: (r) => r.docs },
    { key: 'sp1', label: '', value: () => '' },
    { key: 'sp2', label: '', value: () => '' },
  ]
  return (
    <Section
      title="Party / AP — Bird's-eye"
      subtitle="Every accounts-payable party: total spend, TDS, RCM, and AP invoiced vs paid (outstanding). Click a party to see where the money is going."
      id="party-ap"
      icon={<IconScale className="h-5 w-5" />}
    >
      <GroupTable
        groups={rows}
        parentCols={parentCols}
        childCols={childCols}
        getChildren={(r) => r.heads}
        rowKey={(r) => r.party}
        initialSort="expense"
        searchPlaceholder="Filter party…"
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
