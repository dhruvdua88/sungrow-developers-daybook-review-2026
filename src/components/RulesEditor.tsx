import { useRef } from 'react'
import { saveAs } from 'file-saver'
import type { RuleConfig, TdsRule } from '../types'
import { DEFAULT_RULES } from '../utils/tdsRules'
import { Section } from './ui'
import { IconSliders } from './icons'

// View / edit the TDS rule mapping. Changes lift up via onChange and trigger
// a re-run of the review in App.

export function RulesEditor({
  rules,
  onChange,
}: {
  rules: RuleConfig
  onChange: (r: RuleConfig) => void
}) {
  const importRef = useRef<HTMLInputElement>(null)

  const updateRule = (i: number, patch: Partial<TdsRule>) => {
    const tds = rules.tds.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
    onChange({ ...rules, tds })
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json' })
    saveAs(blob, 'sungrow-rules.json')
  }

  const importJson = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as RuleConfig
        if (!parsed.tds) throw new Error('Missing tds array')
        onChange(parsed)
      } catch (e) {
        alert(`Invalid rules file: ${(e as Error).message}`)
      }
    }
    reader.readAsText(file)
  }

  return (
    <Section
      title="Rule Configuration"
      subtitle="Edit TDS keywords, section, rate and exclusions. Changes re-run the review instantly."
      id="rules"
      icon={<IconSliders className="h-5 w-5" />}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <button className="btn-outline" onClick={exportJson}>
          Export rules JSON
        </button>
        <button className="btn-outline" onClick={() => importRef.current?.click()}>
          Import rules JSON
        </button>
        <button className="btn-outline" onClick={() => onChange(structuredClone(DEFAULT_RULES))}>
          Reset to defaults
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <label className="text-sm">
          <span className="text-slatex">Round-value threshold (₹)</span>
          <input
            type="number"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
            value={rules.roundValueThreshold}
            onChange={(e) => onChange({ ...rules, roundValueThreshold: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          <span className="text-slatex">High-value threshold (₹)</span>
          <input
            type="number"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
            value={rules.highValueThreshold}
            onChange={(e) => onChange({ ...rules, highValueThreshold: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          <span className="text-slatex">Related-party keywords (comma)</span>
          <input
            type="text"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
            value={rules.relatedPartyKeywords.join(', ')}
            onChange={(e) =>
              onChange({
                ...rules,
                relatedPartyKeywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </label>
      </div>

      <div className="overflow-auto rounded border border-slate-200">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Section', 'Label', 'Rate %', 'Excl.', 'Manual', 'Keywords'].map((h) => (
                <th key={h} className="th">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.tds.map((r, i) => (
              <tr key={i} className="align-top">
                <td className="td">
                  <input
                    className="w-20 rounded border border-slate-300 px-1 py-0.5 text-sm"
                    value={r.section}
                    onChange={(e) => updateRule(i, { section: e.target.value })}
                  />
                </td>
                <td className="td">
                  <input
                    className="w-40 rounded border border-slate-300 px-1 py-0.5 text-sm"
                    value={r.label}
                    onChange={(e) => updateRule(i, { label: e.target.value })}
                  />
                </td>
                <td className="td">
                  <input
                    type="number"
                    step="0.1"
                    className="w-16 rounded border border-slate-300 px-1 py-0.5 text-sm"
                    value={r.rate}
                    onChange={(e) => updateRule(i, { rate: Number(e.target.value) })}
                  />
                </td>
                <td className="td text-center">
                  <input
                    type="checkbox"
                    checked={!!r.excluded}
                    onChange={(e) => updateRule(i, { excluded: e.target.checked })}
                  />
                </td>
                <td className="td text-center">
                  <input
                    type="checkbox"
                    checked={!!r.manualReview}
                    onChange={(e) => updateRule(i, { manualReview: e.target.checked })}
                  />
                </td>
                <td className="td">
                  <textarea
                    className="w-full rounded border border-slate-300 px-1 py-0.5 text-xs"
                    rows={2}
                    value={r.keywords.join(', ')}
                    onChange={(e) =>
                      updateRule(i, {
                        keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
