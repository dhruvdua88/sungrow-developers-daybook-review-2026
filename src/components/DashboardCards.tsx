import type { Kpis } from '../types'
import { inr } from './ui'
import {
  IconLayers,
  IconWallet,
  IconScale,
  IconBolt,
  IconHash,
  IconChart,
  IconReceipt,
  IconAlert,
} from './icons'

type Card = {
  key: keyof Kpis
  label: string
  money?: boolean
  tone: string // gradient + text classes
  icon: (p: { className?: string }) => JSX.Element
}

const cards: Card[] = [
  { key: 'totalTxns', label: 'Transactions', tone: 'from-slate-500 to-slate-700', icon: IconLayers },
  { key: 'totalValue', label: 'Total value', money: true, tone: 'from-sky-500 to-blue-700', icon: IconWallet },
  { key: 'tdsBase', label: 'Potential TDS base', money: true, tone: 'from-indigo-500 to-indigo-700', icon: IconScale },
  { key: 'expectedTds', label: 'Expected TDS', money: true, tone: 'from-blue-500 to-brand-700', icon: IconBolt },
  { key: 'unmappedCount', label: 'Unmapped', tone: 'from-amber-400 to-amber-600', icon: IconHash },
  { key: 'highValueCount', label: 'High value', tone: 'from-orange-400 to-orange-600', icon: IconChart },
  { key: 'rcmCount', label: 'Possible RCM', tone: 'from-violet-500 to-purple-700', icon: IconReceipt },
  { key: 'auditExceptionCount', label: 'Audit exceptions', tone: 'from-rose-500 to-rose-700', icon: IconAlert },
]

export function DashboardCards({ kpis }: { kpis: Kpis }) {
  return (
    <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
      {cards.map((c, i) => {
        const v = kpis[c.key]
        const Icon = c.icon
        return (
          <div
            key={c.key}
            className="group card animate-fade-up relative overflow-hidden p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div
              className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${c.tone} opacity-90`}
            />
            <div className="flex items-start justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slatex">
                {c.label}
              </div>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${c.tone} text-white shadow-sm transition-transform duration-300 group-hover:scale-110`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink num">
              {c.money ? inr(v) : v.toLocaleString('en-IN')}
            </div>
          </div>
        )
      })}
    </div>
  )
}
