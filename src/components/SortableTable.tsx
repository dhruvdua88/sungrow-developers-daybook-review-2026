import React, { useMemo, useState } from 'react'

// Generic sortable + filterable table.
// Columns declare an accessor; numeric columns sort numerically and right-align.

export interface Column<T> {
  key: string
  label: string
  numeric?: boolean
  /** value used for sorting/filtering (defaults to render output if string) */
  value?: (row: T) => string | number
  render?: (row: T) => React.ReactNode
  width?: number
}

export function SortableTable<T>({
  columns,
  rows,
  initialSort,
  initialDir = 'desc',
  maxRows = 1000,
  maxHeight = 460,
  searchPlaceholder = 'Filter…',
  toolbar,
}: {
  columns: Column<T>[]
  rows: T[]
  initialSort?: string
  initialDir?: 'asc' | 'desc'
  maxRows?: number
  maxHeight?: number
  searchPlaceholder?: string
  toolbar?: React.ReactNode
}) {
  const [sortKey, setSortKey] = useState<string | undefined>(initialSort)
  const [dir, setDir] = useState<'asc' | 'desc'>(initialDir)
  const [q, setQ] = useState('')

  const valOf = (row: T, c: Column<T>): string | number => {
    if (c.value) return c.value(row)
    const r = c.render?.(row)
    return typeof r === 'string' || typeof r === 'number' ? r : ''
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      columns.some((c) => String(valOf(row, c)).toLowerCase().includes(needle)),
    )
  }, [rows, q, columns])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const col = columns.find((c) => c.key === sortKey)
    if (!col) return filtered
    const arr = [...filtered]
    arr.sort((a, b) => {
      const va = valOf(a, col)
      const vb = valOf(b, col)
      let cmp: number
      if (col.numeric) cmp = Number(va) - Number(vb)
      else cmp = String(va).localeCompare(String(vb))
      return dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filtered, sortKey, dir, columns])

  const shown = sorted.slice(0, maxRows)
  const clickSort = (key: string) => {
    if (sortKey === key) setDir(dir === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setDir('desc')
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" strokeLinecap="round" />
          </svg>
          <input
            className="field !w-64 pl-8"
            placeholder={searchPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {toolbar}
        <span className="ml-auto text-xs text-slatex num">
          {sorted.length.toLocaleString('en-IN')} rows
          {sorted.length > maxRows && ` · showing top ${maxRows.toLocaleString('en-IN')}`}
        </span>
      </div>
      <div
        className="scroll-thin overflow-auto rounded-xl border border-slate-200 ring-1 ring-slate-900/[.02]"
        style={{ maxHeight }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`th cursor-pointer select-none hover:bg-slate-100 ${
                    c.numeric ? 'text-right' : ''
                  }`}
                  style={c.width ? { minWidth: c.width } : undefined}
                  onClick={() => clickSort(c.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    <span className="text-brand">
                      {sortKey === c.key ? (dir === 'asc' ? '▲' : '▼') : ''}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={i} className="transition-colors odd:bg-white even:bg-slate-50/40 hover:bg-brand-50/50">
                {columns.map((c) => (
                  <td key={c.key} className={`td whitespace-nowrap ${c.numeric ? 'num text-right' : ''}`}>
                    {c.render ? c.render(row) : String(valOf(row, c))}
                  </td>
                ))}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td className="td text-slatex" colSpan={columns.length}>
                  No matching rows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
