import { useMemo, useState } from 'react'
import type { TxnMatrix, MatrixRow } from '../utils/txnMatrix'
import { Section, inr } from './ui'
import { IconScale } from './icons'

const COLS: { key: keyof MatrixRow; label: string; numeric: boolean }[] = [
  { key: 'party', label: 'Party', numeric: false },
  { key: 'total', label: 'Account Total', numeric: true },
  { key: 'bank', label: 'Bank', numeric: true },
  { key: 'expense', label: 'Expense / Sales', numeric: true },
  { key: 'inventory', label: 'Inventory/FA', numeric: true },
  { key: 'tds', label: 'TDS', numeric: true },
  { key: 'gst', label: 'GST', numeric: true },
  { key: 'other', label: 'Other', numeric: true },
  { key: 'vouchers', label: 'Vch', numeric: true },
]
const CATS: (keyof MatrixRow)[] = ['bank', 'expense', 'inventory', 'tds', 'gst', 'other']

export function TransactionMatrix({ matrix }: { matrix: TxnMatrix }) {
  const [kind, setKind] = useState<'AP' | 'AR' | 'All'>('AP')
  const [sortKey, setSortKey] = useState<keyof MatrixRow>('total')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [q, setQ] = useState('')

  const base = kind === 'AP' ? matrix.ap : kind === 'AR' ? matrix.ar : matrix.parties
  const totals = kind === 'AR' ? matrix.arTotals : matrix.apTotals

  const rows = useMemo(() => {
    let r = base
    const n = q.trim().toLowerCase()
    if (n) r = r.filter((x) => x.party.toLowerCase().includes(n))
    const col = COLS.find((c) => c.key === sortKey)!
    return [...r].sort((a, b) => {
      const va = a[sortKey] as number | string
      const vb = b[sortKey] as number | string
      const cmp = col.numeric ? Number(va) - Number(vb) : String(va).localeCompare(String(vb))
      return dir === 'asc' ? cmp : -cmp
    })
  }, [base, q, sortKey, dir])

  const click = (k: keyof MatrixRow) => {
    if (sortKey === k) setDir(dir === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(k)
      setDir('desc')
    }
  }
  const shown = rows.slice(0, 500)

  return (
    <Section
      title="Party Transaction Matrix"
      subtitle="For each AP / AR party, what hits the account — Bank · Expense/Sales · Inventory · TDS · GST · Other (contra split pro-rata across parties in a voucher). Toggle AP/AR and click a category to sort."
      id="matrix"
      icon={<IconScale className="h-5 w-5" />}
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {(['AP', 'AR', 'All'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                kind === k ? 'bg-white text-brand shadow-sm' : 'text-slatex hover:text-brand'
              }`}
            >
              {k === 'AP' ? 'Accounts Payable' : k === 'AR' ? 'Accounts Receivable' : 'All parties'}
            </button>
          ))}
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Sort by</span>
        <div className="flex flex-wrap gap-1.5">
          {COLS.filter((c) => c.numeric).map((c) => (
            <button
              key={c.key}
              onClick={() => click(c.key)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                sortKey === c.key ? 'border-transparent bg-brand-grad text-white' : 'border-slate-300 bg-white text-slatex hover:border-brand/50'
              }`}
            >
              {c.label}
              {sortKey === c.key ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <input className="field !w-72" placeholder="Filter party…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="ml-auto text-xs text-slatex num">
          {rows.length.toLocaleString('en-IN')} parties{rows.length > 500 ? ' · top 500' : ''}
        </span>
      </div>

      <div className="scroll-thin overflow-auto rounded-xl border border-slate-200" style={{ maxHeight: 520 }}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.key} className={`th cursor-pointer hover:bg-slate-100 ${c.numeric ? 'text-right' : ''}`} onClick={() => click(c.key)}>
                  {c.label}
                  {sortKey === c.key ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-brand-50 font-bold">
              <td className="td">— {kind === 'All' ? 'AP' : kind} TOTAL —</td>
              <td className="td num text-right">{inr(totals.total)}</td>
              {CATS.map((c) => (
                <td key={c} className="td num text-right">
                  {inr(totals[c] as number)}
                </td>
              ))}
              <td className="td num text-right">{totals.vouchers}</td>
            </tr>
            {shown.map((p, i) => (
              <tr key={i} className="odd:bg-white even:bg-slate-50/40 hover:bg-brand-50/50">
                <td className="td whitespace-nowrap">
                  {p.party}
                  {kind === 'All' && (
                    <span className="ml-1.5 rounded bg-indigo-50 px-1.5 text-[10px] font-bold text-indigo-700">{p.kind}</span>
                  )}
                </td>
                <td className="td num text-right font-semibold">{inr(p.total)}</td>
                {CATS.map((c) => (
                  <td key={c} className="td num text-right">
                    {(p[c] as number) ? inr(p[c] as number) : '—'}
                  </td>
                ))}
                <td className="td num text-right">{p.vouchers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
