import { useMemo, useState } from 'react'
import type { LineType, Txn } from '../types'
import { Section, inr } from './ui'
import { SortableTable, type Column } from './SortableTable'
import { IconLayers } from './icons'

const LINE_TYPES: LineType[] = [
  'Expense',
  'TDS',
  'GST',
  'Vendor/AP',
  'Bank',
  'Inventory/FA',
  'Rev/COS',
  'Receivable',
  'Other',
]

const TYPE_CLS: Record<LineType, string> = {
  TDS: 'bg-amber-50 text-review ring-amber-200',
  GST: 'bg-sky-50 text-sky-700 ring-sky-200',
  'Vendor/AP': 'bg-violet-50 text-manual ring-violet-200',
  Bank: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Expense: 'bg-green-50 text-ok ring-green-200',
  'Rev/COS': 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  'Inventory/FA': 'bg-slate-100 text-slatex ring-slate-200',
  Receivable: 'bg-blue-50 text-blue-700 ring-blue-200',
  Other: 'bg-slate-50 text-slatex ring-slate-200',
}

export function TransactionsExplorer({ txns }: { txns: Txn[] }) {
  const [type, setType] = useState<LineType | 'All'>('All')

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const t of txns) c[t.lineType] = (c[t.lineType] ?? 0) + 1
    return c
  }, [txns])

  const rows = useMemo(
    () => (type === 'All' ? txns : txns.filter((t) => t.lineType === type)),
    [txns, type],
  )

  const cols: Column<Txn>[] = [
    { key: 'date', label: 'Date', value: (r) => r.dateValue ?? r.date, render: (r) => r.date },
    { key: 'voucher_type', label: 'Doc Type', value: (r) => r.voucher_type },
    { key: 'voucher_no', label: 'Doc No', value: (r) => r.voucher_no },
    { key: 'gl_code', label: 'G/L Account', value: (r) => r.gl_code },
    { key: 'ledger', label: 'G/L Account Text (Ledger)', value: (r) => r.ledger, width: 200 },
    { key: 'vendor', label: 'Accounting pro. (Party)', value: (r) => r.vendor, width: 200 },
    { key: 'reference', label: 'Reference', value: (r) => r.reference },
    { key: 'narration', label: 'Text', value: (r) => r.narration, width: 160 },
    {
      key: 'lineType',
      label: 'Type',
      value: (r) => r.lineType,
      render: (r) => (
        <span className={`tag ring-1 ${TYPE_CLS[r.lineType]}`}>
          {r.lineType}
          {r.tdsLedgerSection ? ` ${r.tdsLedgerSection}` : ''}
        </span>
      ),
    },
    { key: 'debit', label: 'Debit', numeric: true, value: (r) => r.debit, render: (r) => (r.debit ? inr(r.debit) : '') },
    { key: 'credit', label: 'Credit', numeric: true, value: (r) => r.credit, render: (r) => (r.credit ? inr(r.credit) : '') },
  ]

  const chip = (label: string, key: LineType | 'All', n: number) => (
    <button
      key={key}
      onClick={() => setType(key)}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
        type === key ? 'bg-brand-grad text-white shadow-sm' : 'bg-slate-100 text-slatex hover:bg-slate-200'
      }`}
    >
      {label} <span className="num opacity-80">{n.toLocaleString('en-IN')}</span>
    </button>
  )

  return (
    <Section
      title="Transactions Explorer"
      subtitle="Every normalized line — G/L Account #, Ledger name, Party and Reference side by side. Sort any column, filter by text or line type."
      id="transactions"
      icon={<IconLayers className="h-5 w-5" />}
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {chip('All', 'All', txns.length)}
        {LINE_TYPES.filter((t) => counts[t]).map((t) => chip(t, t, counts[t]))}
      </div>
      <SortableTable
        columns={cols}
        rows={rows}
        initialSort="debit"
        searchPlaceholder="Filter GL / ledger / party / reference / text…"
        maxRows={1000}
        maxHeight={560}
      />
    </Section>
  )
}
