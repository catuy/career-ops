import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api, type Application, type PipelineData } from '../lib/api'

const HIDDEN = ['Discarded', 'SKIP', 'Descartado']
const STATUS_MAP: Record<string, string> = { 'Evaluada': 'Pre-approved', 'Aplicado': 'Applied', 'Respondido': 'Responded', 'Entrevista': 'Interview', 'Oferta': 'Offer', 'Rechazado': 'Rejected', 'Descartado': 'Discarded' }

function displayStatus(s: string) { return STATUS_MAP[s] || s }

function Score({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: 'var(--tx-3)' }}>—</span>
  const c = value >= 4 ? 'var(--green)' : value >= 3 ? 'var(--yellow)' : 'var(--red)'
  return <span className="font-mono text-sm font-bold" style={{ color: c }}>{value.toFixed(1)}</span>
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <div style={{ color: 'var(--tx-3)' }} className="text-xs uppercase tracking-wider mb-1">{label}</div>
      <div style={{ color: 'var(--tx-h)' }} className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  )
}

function copyCmd(text: string, setCopied: (v: string | null) => void, key: string) {
  navigator.clipboard.writeText(text)
  setCopied(key)
  setTimeout(() => setCopied(null), 2000)
}

export function Dashboard() {
  const [apps, setApps] = useState<Application[]>([])
  const [pipeline, setPipeline] = useState<PipelineData | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(() => {
    api.applications().then(setApps)
    api.pipeline().then(setPipeline)
  }, [])

  useEffect(() => { load() }, [load])

  if (!pipeline) return <div style={{ color: 'var(--tx-3)' }} className="text-sm py-12 text-center">Loading...</div>

  const activeApps = apps
    .filter(a => !HIDDEN.includes(a.status) && !HIDDEN.includes(displayStatus(a.status)))
    .sort((a, b) => (b.score || 0) - (a.score || 0))

  const avgScore = activeApps.length > 0
    ? Math.round(activeApps.reduce((s, a) => s + (a.score || 0), 0) / activeApps.filter(a => a.score).length * 10) / 10
    : 0

  const discard = async (url: string) => {
    await api.removeFromPipeline([url])
    load()
  }

  return (
    <div className="space-y-8">
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric label="Evaluated" value={apps.length} />
        <Metric label="Avg Score" value={`${avgScore}/5`} />
        <Metric label="Pre-approved" value={activeApps.filter(a => ['Pre-approved', 'Evaluada'].includes(a.status)).length} />
        <Metric label="Roles Found" value={pipeline.pending.length} />
      </div>

      {/* Applications */}
      {activeApps.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ color: 'var(--tx-h)' }} className="text-sm font-bold">Applications ({activeApps.length})</h2>
            <Link to="/applications" style={{ color: 'var(--blue)' }} className="text-xs hover:underline">All applications →</Link>
          </div>
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead><tr><th>Score</th><th>Company</th><th>Role</th><th>Status</th><th>Date</th><th></th></tr></thead>
              <tbody>
                {activeApps.map(a => (
                  <tr key={a.num}>
                    <td><Score value={a.score} /></td>
                    <td style={{ color: 'var(--tx-h)' }} className="font-semibold">{a.company}</td>
                    <td className="text-sm">{a.role}</td>
                    <td><span className="pill text-xs">{displayStatus(a.status)}</span></td>
                    <td style={{ color: 'var(--tx-3)' }} className="text-xs">{a.date}</td>
                    <td>
                      {a.reportPath && <Link to={`/reports/${a.reportPath.replace('reports/','')}`} style={{ color: 'var(--blue)' }} className="text-xs hover:underline">View →</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Roles Found */}
      {pipeline.pending.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ color: 'var(--tx-h)' }} className="text-sm font-bold">Roles Found ({pipeline.pending.length})</h2>
            <Link to="/pipeline" style={{ color: 'var(--blue)' }} className="text-xs hover:underline">Manage →</Link>
          </div>
          <div className="space-y-1">
            {pipeline.pending.slice(0, 15).map((item, i) => (
              <div key={i} className="card px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'var(--tx-h)' }} className="font-semibold text-sm">
                      {item.company || (() => { try { return new URL(item.url).hostname.replace('www.', '').split('.')[0] } catch { return 'Unknown' } })()}
                    </span>
                    {item.role && <span style={{ color: 'var(--tx-3)' }} className="text-xs">— {item.role}</span>}
                  </div>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tx-3)' }} className="text-xs hover:underline truncate block">{item.url}</a>
                </div>
                <button onClick={() => copyCmd(`/career-ops ${item.url}`, setCopied, item.url)}
                  className="px-3 py-1 rounded text-xs font-medium flex-shrink-0"
                  style={{ background: copied === item.url ? 'var(--green)' : 'color-mix(in srgb, var(--green) 15%, var(--bg))', color: copied === item.url ? '#fff' : 'var(--green)' }}>
                  {copied === item.url ? 'Copied!' : 'Evaluate'}
                </button>
                <button onClick={() => discard(item.url)}
                  className="px-3 py-1 rounded text-xs font-medium flex-shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--red) 10%, var(--bg))', color: 'var(--red)' }}>
                  Discard
                </button>
              </div>
            ))}
            {pipeline.pending.length > 15 && (
              <Link to="/pipeline" style={{ color: 'var(--blue)' }} className="text-xs hover:underline block text-center py-2">
                +{pipeline.pending.length - 15} more →
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
