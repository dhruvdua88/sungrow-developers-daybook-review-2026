import type { DaybookPnl } from '../types'
import { Section, inr } from './ui'
import { IconChart } from './icons'

function pctStr(p: number | null): string {
  return p == null ? '—' : `${p >= 0 ? '' : ''}${p.toFixed(1)}%`
}

function Row({
  label,
  amount,
  pct,
  bold,
  tone,
  bar,
}: {
  label: string
  amount: number
  pct?: number | null
  bold?: boolean
  tone?: 'pos' | 'neg' | 'muted'
  bar?: number // 0..1 width of mini bar
}) {
  const amtCls =
    tone === 'neg' ? 'text-risk' : tone === 'pos' ? 'text-ok' : bold ? 'text-ink' : 'text-ink/80'
  return (
    <div className={`flex items-center gap-3 py-2 ${bold ? 'border-y border-slate-200' : ''}`}>
      <div className={`w-44 shrink-0 text-sm ${bold ? 'font-semibold text-ink' : 'text-slatex'}`}>
        {label}
      </div>
      <div className="hidden flex-1 sm:block">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-grad"
            style={{ width: `${Math.max(0, Math.min(1, bar ?? 0)) * 100}%` }}
          />
        </div>
      </div>
      <div className={`w-40 shrink-0 text-right num text-sm font-semibold ${amtCls}`}>{inr(amount)}</div>
      <div className="w-16 shrink-0 text-right num text-xs text-slatex">{pct != null ? pctStr(pct) : ''}</div>
    </div>
  )
}

export function PnlHero({ pnl }: { pnl: DaybookPnl }) {
  if (!pnl.available) {
    return (
      <Section title="Profit & Loss" subtitle="Built from the daybook (GL 6xxx / 7xxx)." id="pnl" icon={<IconChart className="h-5 w-5" />}>
        <p className="text-sm text-slatex">No P&L accounts (GL 6xxx/7xxx) detected in this book.</p>
      </Section>
    )
  }
  const rev = Math.max(pnl.revenue, 1)
  const loss = pnl.pbt < 0
  return (
    <Section
      title="Profit & Loss"
      subtitle="Built straight from the daybook — GL 6xxx (revenue / COGS / finance) and 7xxx (operating expense)."
      id="pnl"
      icon={<IconChart className="h-5 w-5" />}
    >
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Statement */}
        <div>
          <Row label="Revenue" amount={pnl.revenue} pct={100} bar={1} />
          <Row label="Less: Cost of sales" amount={-pnl.cogs} pct={pnl.revenue ? -(pnl.cogs / rev) * 100 : null} bar={pnl.cogs / rev} tone="neg" />
          <Row label="Gross Profit" amount={pnl.grossProfit} pct={pnl.grossMarginPct} bold tone={pnl.grossProfit < 0 ? 'neg' : 'pos'} bar={Math.abs(pnl.grossProfit) / rev} />
          <Row label="Less: Operating expenses" amount={-pnl.operatingExpenses} pct={pnl.revenue ? -(pnl.operatingExpenses / rev) * 100 : null} bar={pnl.operatingExpenses / rev} tone="neg" />
          <Row label="Less: Finance (net)" amount={-pnl.finance} pct={pnl.revenue ? -(pnl.finance / rev) * 100 : null} bar={Math.abs(pnl.finance) / rev} tone="neg" />
          <Row label={loss ? 'Loss before tax' : 'Profit before tax'} amount={pnl.pbt} pct={pnl.netMarginPct} bold tone={loss ? 'neg' : 'pos'} bar={Math.abs(pnl.pbt) / rev} />
        </div>

        {/* Top expense heads */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slatex">
            Top operating expense heads
          </h3>
          <div className="space-y-1.5">
            {pnl.opexLines.slice(0, 8).map((l) => {
              const max = Math.abs(pnl.opexLines[0]?.amount || 1)
              return (
                <div key={l.code} className="flex items-center gap-2">
                  <div className="w-36 shrink-0 truncate text-xs text-ink" title={l.name}>
                    {l.name}
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-brand/70" style={{ width: `${(Math.abs(l.amount) / max) * 100}%` }} />
                  </div>
                  <div className="w-24 shrink-0 text-right num text-xs font-medium text-ink">{inr(l.amount)}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Section>
  )
}
