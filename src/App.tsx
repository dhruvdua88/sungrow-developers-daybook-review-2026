import { useEffect, useMemo, useState } from 'react'
import type { RuleConfig, WorkbookStructure } from './types'
import { parseFile } from './utils/excelParser'
import { runReview } from './utils/review'
import { DEFAULT_RULES } from './utils/tdsRules'

import { FileUpload } from './components/FileUpload'
import { MisKpis } from './components/MisKpis'
import { PnlHero } from './components/PnlHero'
import { ExpenseTdsMis, VendorApMis } from './components/ExpenseMis'
import { StructurePreview } from './components/StructurePreview'
import { TdsWaterfallView } from './components/TdsWaterfallView'
import { TransactionsExplorer } from './components/TransactionsExplorer'
import { GstReview } from './components/GstReview'
import { AuditReview } from './components/AuditReview'
import { FinancialPerformance } from './components/FinancialPerformance'
import { RulesEditor } from './components/RulesEditor'
import { DownloadPanel } from './components/DownloadPanel'
import { Section } from './components/ui'
import { IconUpload, IconGrid, IconBolt } from './components/icons'

const NAV = [
  ['overview', 'Overview'],
  ['pnl', 'P&L'],
  ['expense-tds', 'Expense · TDS'],
  ['vendors', 'Vendors (AP)'],
  ['transactions', 'Transactions'],
  ['waterfall', 'TDS Waterfall'],
  ['gst', 'GST / RCM'],
  ['audit', 'Audit'],
  ['financials', 'Financials'],
  ['rules', 'Rules'],
  ['download', 'Download'],
] as const

export default function App() {
  const [month, setMonth] = useState('May-26')
  const [rules, setRules] = useState<RuleConfig>(() => structuredClone(DEFAULT_RULES))
  const [daybook, setDaybook] = useState<WorkbookStructure | null>(null)
  const [financials, setFinancials] = useState<WorkbookStructure | null>(null)
  const [daybookName, setDaybookName] = useState<string | null>(null)
  const [financialsName, setFinancialsName] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [active, setActive] = useState<string>('overview')

  const onDaybook = async (file: File) => {
    setBusy('Parsing daybook…')
    setParseError(null)
    try {
      const wb = await parseFile(file)
      setDaybook(wb)
      setDaybookName(file.name)
      if (wb.sheets.length === 0)
        setParseError(`Daybook "${file.name}" had no readable sheets — it may be corrupt/truncated.`)
    } catch (e) {
      setParseError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const onFinancials = async (file: File) => {
    setBusy('Parsing financials…')
    try {
      const wb = await parseFile(file)
      setFinancials(wb)
      setFinancialsName(file.name)
    } catch (e) {
      setParseError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const result = useMemo(
    () => runReview(month, daybook, financials, rules),
    [month, daybook, financials, rules],
  )

  const hasData = result.transactions.length > 0

  useEffect(() => {
    document.title = `SDIPL Review — ${month}`
  }, [month])

  // Scroll-spy for active nav pill.
  useEffect(() => {
    const ids = NAV.map(([id]) => id)
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (vis) setActive(vis.target.id)
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.25, 0.6] },
    )
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [hasData])

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 shadow-lg">
        <div className="bg-brand-grad">
          <div className="mx-auto max-w-7xl px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
                  <IconBolt className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="font-display text-xl font-extrabold leading-tight tracking-tight text-white">
                    Sungrow Monthly Review Engine
                  </h1>
                  <p className="text-[12px] font-medium text-white/75">
                    SDIPL · in-browser TDS / GST / audit / financial review · no data leaves your machine
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1.5 ring-1 ring-white/25 backdrop-blur">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/80">Month</span>
                <input
                  className="w-24 rounded-lg border-0 bg-white/95 px-2 py-1 text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-white"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  placeholder="May-26"
                />
              </div>
            </div>
          </div>
        </div>
        {/* Nav */}
        <div className="border-b border-slate-200 bg-white/85 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 py-2">
            <nav className="pillbar flex-wrap">
              {NAV.map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className={`nav-pill ${
                    active === id ? 'bg-brand-grad text-white shadow-sm hover:text-white' : ''
                  }`}
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6">
        {/* Upload */}
        <Section
          title="Upload Monthly Files"
          subtitle="Daybook is required; financials pack is optional. Everything is processed locally."
          icon={<IconUpload className="h-5 w-5" />}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FileUpload
              label="Upload Daybook (transactions)"
              hint="Daybook .xlsx — TDS / GST / audit source"
              fileName={daybookName}
              onFile={onDaybook}
            />
            <FileUpload
              label="Upload Financials (reporting pack)"
              hint="Financials .xlsx — P&L / BS / cash flow"
              fileName={financialsName}
              onFile={onFinancials}
            />
          </div>
          {busy && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand">
              <span className="h-2 w-2 animate-ping rounded-full bg-brand" />
              {busy}
            </div>
          )}
          {parseError && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-risk">
              <span className="mt-0.5">⚠</span>
              <span>{parseError}</span>
            </div>
          )}
          {result.warnings.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-review">
              {result.warnings.map((w, i) => (
                <li key={i} className="list-disc">
                  {w}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Overview — MIS KPIs */}
        <Section
          title="Management Overview"
          subtitle={`Generated ${result.generatedAt}`}
          icon={<IconGrid className="h-5 w-5" />}
          id="overview"
        >
          <MisKpis mis={result.mis} kpis={result.kpis} />
        </Section>

        {hasData ? (
          <>
            {/* MIS-first */}
            <PnlHero pnl={result.mis.pnl} />
            <ExpenseTdsMis rows={result.mis.expenseTds} />
            <VendorApMis rows={result.mis.vendors} />
            <TransactionsExplorer txns={result.transactions} />

            {/* Tax & audit (actual-basis) */}
            <TdsWaterfallView wf={result.tdsWaterfall} />
            <GstReview gst={result.gst} />
            <AuditReview audit={result.audit} />

            <FinancialPerformance fin={result.financials} />
            <StructurePreview
              daybook={daybook}
              financials={financials}
              columnMap={result.columnMap}
              detectedSheet={result.detectedDaybookSheet}
            />
          </>
        ) : (
          <Section title="Get started" icon={<IconBolt className="h-5 w-5" />} id="pnl">
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
              <IconUpload className="h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slatex">
                Upload a daybook to build the P&amp;L, expense → TDS / RCM MIS and vendor ledger.
              </p>
            </div>
          </Section>
        )}

        <RulesEditor rules={rules} onChange={setRules} />

        <DownloadPanel result={result} rules={rules} />

        <footer className="pb-10 pt-2 text-center text-xs text-slate-400">
          Rule-based engine · indicative only · verify against the Act, GST law and vouchers before filing.
        </footer>
      </main>
    </div>
  )
}
