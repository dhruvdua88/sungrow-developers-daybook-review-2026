import React, { useMemo, useState } from 'react'
import type { Column } from './SortableTable'

// Expandable group table: parent rows are sortable + filterable; click a row to
// reveal its child breakdown underneath (indented).

export function GroupTable<P, C>({
  groups,
  parentCols,
  childCols,
  getChildren,
  rowKey,
  initialSort,
  maxRows = 300,
  maxHeight = 560,
  searchPlaceholder = 'Filter…',
}: {
  groups: P[]
  parentCols: Column<P>[]
  childCols: Column<C>[]
  getChildren: (p: P) => C[]
  rowKey: (p: P) => string
  initialSort?: string
  maxRows?: number
  maxHeight?: number
  searchPlaceholder?: string
}) {
  const [sortKey, setSortKey] = useState<string | undefined>(initialSort)
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())

  const valOf = <T,>(row: T, c: Column<T>): string | number => {
    if (c.value) return c.value(row)
    const r = c.render?.(row)
    return typeof r === 'string' || typeof r === 'number' ? r : ''
  }

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase()
    if (!n) return groups
    return groups.filter((g) => parentCols.some((c) => String(valOf(g, c)).toLowerCase().includes(n)))
  }, [groups, q, parentCols])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const col = parentCols.find((c) => c.key === sortKey)
    if (!col) return filtered
    const arr = [...filtered]
    arr.sort((a, b) => {
      const va = valOf(a, col)
      const vb = valOf(b, col)
      const cmp = col.numeric ? Number(va) - Number(vb) : String(va).localeCompare(String(vb))
      return dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filtered, sortKey, dir, parentCols])

  const shown = sorted.slice(0, maxRows)
  const clickSort = (k: string) => {
    if (sortKey === k) setDir(dir === 'asc' ? 'desc' : 'asc')
    else (setSortKey(k), setDir('desc'))
  }
  const toggle = (k: string) =>
    setOpen((s) => {
      const n = new Set(s)
      n.has(k) ? n.delete(k) : n.add(k)
      return n
    })

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="relative">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" strokeLinecap="round" />
          </svg>
          <input className="field !w-72 pl-8" placeholder={searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="ml-auto text-xs text-slatex num">
          {sorted.length.toLocaleString('en-IN')} rows{sorted.length > maxRows && ` · top ${maxRows}`} · click a row to expand
        </span>
      </div>
      <div className="scroll-thin overflow-auto rounded-xl border border-slate-200 ring-1 ring-slate-900/[.02]" style={{ maxHeight }}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="th w-8" />
              {parentCols.map((c) => (
                <th key={c.key} className={`th cursor-pointer select-none hover:bg-slate-100 ${c.numeric ? 'text-right' : ''}`} style={c.width ? { minWidth: c.width } : undefined} onClick={() => clickSort(c.key)}>
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    <span className="text-brand">{sortKey === c.key ? (dir === 'asc' ? '▲' : '▼') : ''}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((g) => {
              const k = rowKey(g)
              const isOpen = open.has(k)
              const kids = isOpen ? getChildren(g) : []
              return (
                <React.Fragment key={k}>
                  <tr className={`cursor-pointer transition-colors ${isOpen ? 'bg-brand-50/60' : 'odd:bg-white even:bg-slate-50/40 hover:bg-brand-50/40'}`} onClick={() => toggle(k)}>
                    <td className="td text-center text-slate-400">
                      <span className={`inline-block transition-transform ${isOpen ? 'rotate-90 text-brand' : ''}`}>▶</span>
                    </td>
                    {parentCols.map((c) => (
                      <td key={c.key} className={`td whitespace-nowrap font-medium ${c.numeric ? 'num text-right' : ''}`}>
                        {c.render ? c.render(g) : String(valOf(g, c))}
                      </td>
                    ))}
                  </tr>
                  {isOpen &&
                    kids.map((child, ci) => (
                      <tr key={ci} className="bg-slate-50/80">
                        <td className="td border-l-2 border-brand/30" />
                        {childCols.map((c, idx) => (
                          <td key={c.key} className={`td whitespace-nowrap text-[13px] text-slatex ${c.numeric ? 'num text-right' : ''} ${idx === 0 ? 'pl-6' : ''}`}>
                            {c.render ? c.render(child) : String(valOf(child, c))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  {isOpen && kids.length === 0 && (
                    <tr className="bg-slate-50/80">
                      <td />
                      <td className="td text-xs text-slate-400" colSpan={parentCols.length}>
                        No breakdown.
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
