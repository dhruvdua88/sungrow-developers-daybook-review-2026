import type { ColumnMap, WorkbookStructure } from '../types'
import { describeColumnMap } from '../utils/structureDetector'
import { Section, DataTable } from './ui'
import { IconLayers } from './icons'

// Shows detected sheets, guessed header rows, and daybook column detection.

export function StructurePreview({
  daybook,
  financials,
  columnMap,
  detectedSheet,
}: {
  daybook: WorkbookStructure | null
  financials: WorkbookStructure | null
  columnMap: ColumnMap
  detectedSheet: string | null
}) {
  const sheet = daybook?.sheets.find((s) => s.name === detectedSheet)
  const colDesc = sheet ? describeColumnMap(sheet.headers, columnMap) : []

  return (
    <Section
      title="File Structure Review"
      subtitle="Auto-detected sheets, header rows and daybook columns. No fixed column names assumed."
      id="structure"
      icon={<IconLayers className="h-5 w-5" />}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slatex">Sheets detected</h3>
          <DataTable
            maxHeight={220}
            columns={['File', 'Sheet', 'Header row', 'Data rows']}
            rows={[daybook, financials]
              .filter(Boolean)
              .flatMap((wb) =>
                (wb as WorkbookStructure).sheets.map((s) => [
                  (wb as WorkbookStructure).fileName.slice(0, 22),
                  s.name,
                  s.headerRowIndex + 1,
                  s.rows.length,
                ]),
              )}
            empty="No files uploaded yet."
          />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slatex">
            Daybook columns detected {detectedSheet && <span className="text-slate-400">— {detectedSheet}</span>}
          </h3>
          <DataTable
            maxHeight={220}
            columns={['Field', 'Mapped header', 'Col #']}
            rows={colDesc.map((d) => [
              d.field,
              d.header ?? <span className="text-slate-400">not found</span>,
              d.index != null ? d.index + 1 : '—',
            ])}
            empty="Upload a daybook to detect columns."
          />
        </div>
      </div>
    </Section>
  )
}
