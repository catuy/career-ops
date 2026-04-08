import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api, type Application, type PDFFile } from '../lib/api'

const STATUSES = ['Pre-approved', 'Applied', 'Responded', 'Interview', 'Offer', 'Rejected', 'Discarded', 'SKIP']

interface ReportMeta {
  company: string; role: string; date: string; archetype: string; score: number | null; url: string; pdf: string
}

function extractMeta(content: string): { meta: ReportMeta; body: string } {
  const t = content.match(/^# .+?:\s*(.+?)\s*—\s*(.+)/m)
  const f = (k: string) => content.match(new RegExp(`\\*\\*${k}:\\*\\*\\s*(.+)`))?.[1]?.trim() || ''
  const s = f('Score').match(/([\d.]+)/)
  const meta: ReportMeta = {
    company: t?.[1] || '', role: t?.[2] || '', date: f('Date'),
    archetype: f('Archetype'), score: s ? parseFloat(s[1]) : null,
    url: f('URL'), pdf: f('PDF'),
  }
  const i = content.indexOf('\n## ')
  return { meta, body: i > -1 ? content.slice(i) : content }
}

function ScoreRing({ score }: { score: number | null }) {
  if (score === null) return null
  const color = score >= 4 ? 'var(--green)' : score >= 3 ? 'var(--yellow)' : 'var(--red)'
  const r = 26, circ = 2 * Math.PI * r, offset = circ - (score / 5) * circ
  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--ui)" strokeWidth="3" />
        <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold" style={{ color: 'var(--tx-h)' }}>{score.toFixed(1)}</span>
      </div>
    </div>
  )
}

const sectionInfo: Record<string, { label: string; color: string }> = {
  A: { label: 'Role Summary', color: 'var(--cyan)' },
  B: { label: 'CV Match', color: 'var(--green)' },
  C: { label: 'Level & Strategy', color: 'var(--purple)' },
  D: { label: 'Comp & Demand', color: 'var(--orange)' },
  E: { label: 'Personalization', color: 'var(--blue)' },
  F: { label: 'Interview Prep', color: 'var(--magenta)' },
  G: { label: 'Draft Answers', color: 'var(--green)' },
}

function copyToClipboard(text: string) { navigator.clipboard.writeText(text) }

export function ReportView() {
  const { filename } = useParams<{ filename: string }>()
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [app, setApp] = useState<Application | null>(null)
  const [statusSaved, setStatusSaved] = useState(false)
  const [pdfFile, setPdfFile] = useState<PDFFile | null>(null)
  const [showPdf, setShowPdf] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const reportNum = filename ? parseInt(filename.match(/^(\d+)/)?.[1] || '0') : 0

  useEffect(() => {
    if (!filename) return
    api.report(filename).then(r => setContent(r.content)).catch(() => setError(true))
    api.applications().then(apps => {
      const match = apps.find(a => a.reportNum === String(reportNum).padStart(3, '0') || a.num === reportNum)
      if (match) setApp(match)
    })
    // Check if PDF exists — match by company slug from report filename
    api.pdfs().then(pdfs => {
      // Extract company slug: "014-automattic-senior-product-designer-2026-04-07" → "automattic"
      const parts = filename?.replace(/^\d+-/, '').replace(/-\d{4}-\d{2}-\d{2}\.md$/, '').split('-') || []
      const companySlug = parts[0] || '___'
      // Try matching: first by full slug, then by company name only
      const fullSlug = parts.join('-')
      const match = pdfs.find(p => p.filename.includes(fullSlug)) || pdfs.find(p => p.filename.includes(companySlug))
      if (match) setPdfFile(match)
    })
  }, [filename])

  const handleStatusChange = async (status: string) => {
    if (!app) return
    await api.updateApplication(app.num, { status })
    setApp({ ...app, status })
    setStatusSaved(true)
    setTimeout(() => setStatusSaved(false), 2000)
  }

  const handleCopy = (text: string, key: string) => {
    copyToClipboard(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  if (error) return <div className="text-center py-16"><p style={{ color: 'var(--red)' }}>Report not found</p><Link to="/" style={{ color: 'var(--blue)' }} className="text-sm hover:underline mt-2 inline-block">Back</Link></div>
  if (content === null) return <div style={{ color: 'var(--tx-3)' }} className="text-sm py-16 text-center">Loading...</div>

  const { meta, body } = extractMeta(content)
  const parts = body.split(/(?=\n## [A-G]\))/).filter(s => s.trim())
  const statusDisplay = app ? ({'Evaluada': 'Pre-approved'}[app.status] || app.status) : ''

  return (
    <div className="space-y-5">
      <Link to="/" style={{ color: 'var(--tx-3)' }} className="text-sm hover:underline inline-block">← Back</Link>

      {/* Hero */}
      <div className="card p-5">
        <div className="flex items-start gap-5">
          <ScoreRing score={meta.score} />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--tx-h)' }}>
              {meta.company} <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>—</span> {meta.role}
            </h1>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="pill-accent pill text-xs">{meta.archetype}</span>
              <span style={{ color: 'var(--tx-3)' }} className="text-xs">{meta.date}</span>
            </div>
            <div className="flex gap-4 flex-wrap text-sm items-center">
              {meta.url && (
                <a href={meta.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }} className="hover:underline flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Job posting
                </a>
              )}
              {pdfFile && (
                <button onClick={() => setShowPdf(!showPdf)} style={{ color: 'var(--green)' }} className="hover:underline flex items-center gap-1 text-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  {showPdf ? 'Hide CV' : 'View CV'}
                </button>
              )}
              {app && (
                <div className="flex items-center gap-2 ml-auto">
                  <select value={app.status} onChange={e => handleStatusChange(e.target.value)} className="input text-xs py-1 px-2" style={{ minWidth: '130px' }}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {statusSaved && <span style={{ color: 'var(--green)' }} className="text-xs">Saved</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PDF preview */}
      {showPdf && pdfFile && (
        <div className="card overflow-hidden" style={{ height: '70vh' }}>
          <iframe src={`/files/output/${pdfFile.filename}`} className="w-full h-full" title="CV PDF" />
        </div>
      )}

      {/* Prepare Application CTA */}
      <div className="card p-5">
        <h2 style={{ color: 'var(--tx-h)' }} className="text-sm font-bold mb-2">Prepare Application</h2>
        <p style={{ color: 'var(--tx-3)' }} className="text-xs mb-3">Generate a tailored CV and draft application answers for this role.</p>
        <div className="flex gap-2 flex-wrap">
          {!pdfFile && (
            <button onClick={() => handleCopy(`/career-ops pdf ${meta.url}`, 'pdf')}
              className="px-4 py-2 rounded text-sm font-medium flex items-center gap-1.5"
              style={{ background: copied === 'pdf' ? 'var(--green)' : 'var(--cyan)', color: '#fff' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {copied === 'pdf' ? 'Copied!' : 'Generate CV (copy CLI command)'}
            </button>
          )}
          <button onClick={() => handleCopy(`/career-ops apply ${meta.url}`, 'apply')}
            className="px-4 py-2 rounded text-sm font-medium flex items-center gap-1.5"
            style={{ background: copied === 'apply' ? 'var(--green)' : 'var(--blue)', color: '#fff' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            {copied === 'apply' ? 'Copied!' : 'Fill application form (copy CLI command)'}
          </button>
        </div>
        {(copied === 'pdf' || copied === 'apply') && (
          <div className="mt-2 p-2 rounded text-xs" style={{ background: 'color-mix(in srgb, var(--green) 10%, var(--bg))', color: 'var(--green)' }}>
            Paste the command in your Claude Code terminal.
          </div>
        )}
      </div>

      {/* Section nav */}
      <nav className="flex gap-1 overflow-x-auto">
        {parts.map((sec, i) => {
          const letter = sec.match(/## ([A-G])\)/)?.[1]
          const info = letter ? sectionInfo[letter] : null
          if (!info) return null
          return (
            <a key={i} href={`#section-${letter}`}
              className="px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap"
              style={{ color: info.color, background: `color-mix(in srgb, ${info.color} 8%, var(--bg))` }}>
              {letter}) {info.label}
            </a>
          )
        })}
      </nav>

      {/* Sections */}
      {parts.map((sec, i) => {
        const letter = sec.match(/## ([A-G])\)/)?.[1]
        const info = letter ? sectionInfo[letter] : null
        const sectionBody = info ? sec.replace(/^## [A-G]\)[^\n]*\n/, '') : sec
        const isKeywords = /## Keywords/i.test(sec)

        if (isKeywords) {
          const kw = sec.split('\n')
            .filter((l: string) => l.trim().match(/^[-•]/) || l.includes(','))
            .flatMap((l: string) => l.replace(/^[-•]\s*/, '').split(',').map((k: string) => k.trim()))
            .filter(Boolean)
          return (
            <div key={i} className="card p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--tx-3)' }}>Keywords</h2>
              <div className="flex flex-wrap gap-1.5">
                {kw.map((k: string, j: number) => <span key={j} className="pill text-xs">{k}</span>)}
              </div>
            </div>
          )
        }

        return (
          <section key={i} id={`section-${letter}`} className="card overflow-hidden"
            style={info ? { borderLeft: `3px solid ${info.color}` } : {}}>
            {info && (
              <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--ui)' }}>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: info.color }}>{letter})</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--tx-h)' }}>{info.label}</span>
              </div>
            )}
            <div className="report-section px-5 py-4">
              <Markdown remarkPlugins={[remarkGfm]}>{info ? sectionBody : sec}</Markdown>
            </div>
          </section>
        )
      })}
    </div>
  )
}
