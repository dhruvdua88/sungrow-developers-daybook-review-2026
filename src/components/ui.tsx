import React from 'react'
import type { RiskStatus } from '../types'

// Shared UI primitives used across review panels.

export const inr = (n: number | null | undefined) =>
  n == null ? '—' : '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })

const STATUS_CLS: Record<RiskStatus, string> = {
  OK: 'bg-green-50 text-ok ring-1 ring-green-200',
  Review: 'bg-amber-50 text-review ring-1 ring-amber-200',
  'High Risk': 'bg-rose-50 text-risk ring-1 ring-rose-200',
  'Manual Check': 'bg-violet-50 text-manual ring-1 ring-violet-200',
}

export function StatusTag({ status }: { status: RiskStatus }) {
  return <span className={`tag ${STATUS_CLS[status]}`}>{status}</span>
}

export function Section({
  title,
  subtitle,
  children,
  id,
  icon,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  id?: string
  icon?: React.ReactNode
}) {
  return (
    <section id={id} className="card animate-fade-up overflow-hidden">
      <div className="border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/50 px-6 py-4">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand">
              {icon}
            </div>
          )}
          <div>
            <h2 className="font-display text-[17px] font-bold tracking-tight text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] leading-snug text-slatex">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  )
}

/** A heading used inside sections, above a table. */
export function SubHead({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slatex">{children}</h3>
      {count != null && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slatex num">
          {count}
        </span>
      )}
    </div>
  )
}

/** A scrollable, sticky-header data table. */
export function DataTable({
  columns,
  rows,
  empty = 'No items.',
  maxHeight = 360,
  rightAlign = [],
}: {
  columns: string[]
  rows: React.ReactNode[][]
  empty?: string
  maxHeight?: number
  /** column indices to right-align (numbers) */
  rightAlign?: number[]
}) {
  if (!rows.length)
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-sm text-slatex">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M9 12h6" strokeLinecap="round" />
        </svg>
        {empty}
      </div>
    )
  const ra = new Set(rightAlign)
  return (
    <div
      className="scroll-thin overflow-auto rounded-xl border border-slate-200 ring-1 ring-slate-900/[.02]"
      style={{ maxHeight }}
    >
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c} className={`th ${ra.has(i) ? 'text-right' : ''}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="transition-colors odd:bg-white even:bg-slate-50/40 hover:bg-brand-50/50">
              {r.map((cell, j) => (
                <td key={j} className={`td whitespace-nowrap ${ra.has(j) ? 'num text-right' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
