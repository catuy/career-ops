import { useEffect, useState } from 'react'
import { api, type PDFFile } from '../lib/api'

export function PDFs() {
  const [pdfs, setPdfs] = useState<PDFFile[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => { api.pdfs().then(setPdfs) }, [])

  return (
    <div className="space-y-5">
      <h1 style={{ color: 'var(--tx-h)' }} className="text-xl font-bold">Generated PDFs</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          {pdfs.length === 0 && <div style={{ color: 'var(--tx-3)' }} className="text-sm">No PDFs yet</div>}
          {pdfs.map(pdf => (
            <button key={pdf.filename} onClick={() => setSelected(pdf.filename)}
              className="card w-full text-left px-4 py-3 transition-colors"
              style={selected === pdf.filename ? { borderColor: 'var(--cyan)' } : {}}>
              <div style={{ color: 'var(--tx-h)' }} className="text-sm font-semibold capitalize">{pdf.company}</div>
              <div style={{ color: 'var(--tx-3)' }} className="text-xs mt-0.5">{pdf.date} · {Math.round(pdf.size / 1024)} KB</div>
            </button>
          ))}
        </div>
        <div className="lg:col-span-2">
          {selected ? (
            <div className="card overflow-hidden" style={{ height: '80vh' }}>
              <iframe src={`/files/output/${selected}`} className="w-full h-full" title="PDF" />
            </div>
          ) : (
            <div className="card flex items-center justify-center" style={{ height: '80vh', color: 'var(--tx-3)' }}>
              Select a PDF to preview
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
