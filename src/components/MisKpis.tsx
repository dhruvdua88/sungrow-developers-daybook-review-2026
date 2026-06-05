import type { Kpis, MisResult } from '../types'
import { inr } from './ui'
import {
  IconWallet,
  IconChart,
  IconBolt,
  IconReceipt,
  IconScale,
  IconLayers,
  IconAlert,
  IconHash,
} from './icons'

export function MisKpis({ mis, kpis }: { mis: MisResult; kpis: Kpis }) {
  const p = mis.pnl
  const cards: {
    label: string
    value: string
    sub?: string
    tone: string
    icon: (q: { className?: string }) => JSX.Element
    danger?: boolean
  }[] = [
    { label: 'Revenue', value: inr(p.revenue), tone: 'from-sky-500 to-blue-700', icon: IconWallet },
    {
      label: 'Gross margin',
      value: p.grossMarginPct != null ? `${p.grossMarginPct.toFixed(1)}%` : '—',
      sub: `GP ${inr(p.grossProfit)}`,
      tone: 'from-indigo-500 to-indigo-700',
      icon: IconChart,
    },
    {
      label: p.pbt < 0 ? 'Loss before tax' : 'Profit before tax',
      value: inr(p.pbt),
      sub: p.netMarginPct != null ? `${p.netMarginPct.toFixed(1)}% margin` : '',
      tone: p.pbt < 0 ? 'from-rose-500 to-rose-700' : 'from-emerald-500 to-emerald-700',
      icon: IconBolt,
      danger: p.pbt < 0,
    },
    { label: 'Operating expense', value: inr(p.operatingExpenses), tone: 'from-slate-500 to-slate-700', icon: IconLayers },
    { label: 'Expense thru AP', value: inr(mis.totalExpense), sub: `${mis.expenseTds.length} heads`, tone: 'from-blue-500 to-brand-700', icon: IconReceipt },
    { label: 'TDS deducted', value: inr(mis.totalTds), sub: mis.effTdsRate != null ? `${mis.effTdsRate.toFixed(2)}% eff.` : '', tone: 'from-amber-400 to-amber-600', icon: IconScale },
    { label: 'RCM GST', value: inr(mis.totalRcm), tone: 'from-violet-500 to-purple-700', icon: IconHash },
    { label: 'Audit exceptions', value: kpis.auditExceptionCount.toLocaleString('en-IN'), tone: 'from-rose-500 to-rose-700', icon: IconAlert },
  ]
  return (
    <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
      {cards.map((c, i) => {
        const Icon = c.icon
        return (
          <div
            key={c.label}
            className="group card animate-fade-up relative overflow-hidden p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${c.tone} opacity-90`} />
            <div className="flex items-start justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slatex">{c.label}</div>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${c.tone} text-white shadow-sm transition-transform duration-300 group-hover:scale-110`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className={`mt-2 font-display text-xl font-extrabold tracking-tight num ${c.danger ? 'text-risk' : 'text-ink'}`}>
              {c.value}
            </div>
            {c.sub && <div className="mt-0.5 text-[11px] text-slatex num">{c.sub}</div>}
          </div>
        )
      })}
    </div>
  )
}
