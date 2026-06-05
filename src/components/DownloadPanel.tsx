import type { ReviewResult, RuleConfig } from '../types'
import { downloadWorkbook, downloadNormalizedCsv } from '../utils/reportExcel'
import { downloadHtml } from '../utils/reportHtml'
import { Section } from './ui'
import { IconDownload } from './icons'

export function DownloadPanel({
  result,
  rules,
}: {
  result: ReviewResult
  rules: RuleConfig
}) {
  const disabled = result.transactions.length === 0
  return (
    <Section
      title="Download Reports"
      subtitle="Export the formatted Excel review workbook, a single-page HTML summary, or the normalized CSV."
      id="download"
      icon={<IconDownload className="h-5 w-5" />}
    >
      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" disabled={disabled} onClick={() => downloadWorkbook(result, rules)}>
          ⬇ Download Excel Review Workbook
        </button>
        <button className="btn-outline" disabled={disabled} onClick={() => downloadHtml(result)}>
          ⬇ Download HTML Summary
        </button>
        <button className="btn-outline" disabled={disabled} onClick={() => downloadNormalizedCsv(result)}>
          ⬇ Download Normalized CSV
        </button>
      </div>
      {disabled && (
        <p className="mt-2 text-sm text-review">Upload a daybook with transactions to enable downloads.</p>
      )}
    </Section>
  )
}
