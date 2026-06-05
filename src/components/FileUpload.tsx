import React, { useRef } from 'react'
import { IconUpload } from './icons'

// A labelled drag/drop + click file input with premium styling.

export function FileUpload({
  label,
  hint,
  fileName,
  onFile,
}: {
  label: string
  hint?: string
  fileName?: string | null
  onFile: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)

  const handle = (files: FileList | null) => {
    if (files && files[0]) onFile(files[0])
  }

  const done = !!fileName

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handle(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-300 ${
        dragging
          ? 'scale-[1.01] border-brand bg-brand-50 shadow-glow'
          : done
            ? 'border-green-300 bg-green-50/60'
            : 'border-slate-300 bg-white hover:border-brand/60 hover:bg-brand-50/40 hover:shadow-card'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
      <div
        className={`mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300 ${
          done
            ? 'bg-green-100 text-ok'
            : 'bg-brand-50 text-brand group-hover:scale-110 group-hover:bg-brand group-hover:text-white'
        }`}
      >
        {done ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m5 12 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <IconUpload className="h-5 w-5" />
        )}
      </div>
      <div className="text-sm font-semibold text-ink">{label}</div>
      {done ? (
        <div className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-green-100 px-3 py-0.5 text-xs font-medium text-ok">
          {fileName}
        </div>
      ) : (
        <div className="mt-1 text-xs text-slatex">{hint ?? 'Click or drop an .xlsx file'}</div>
      )}
    </div>
  )
}
