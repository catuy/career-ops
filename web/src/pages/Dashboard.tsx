import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type DashboardData } from '../lib/api'

function Metric({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-4">
      <div style={{ color: 'var(--tx-3)' }} className="text-xs uppercase tracking-wider mb-1">{label}</div>
      <div style={{ color: 'var(--tx-h)' }} className="text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div style={{ color: 'var(--tx-3)' }} className="text-xs mt-0.5">{sub}</div>}
    </div>
  )
}

function Score({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: 'var(--tx-3)' }}>—</span>
  const c = value >= 4 ? 'var(--green)' : value >= 3 ? 'var(--yellow)' : 'var(--red)'
  return <span className="font-mono text-sm font-bold" style={{ color: c }}>{value.toFixed(1)}</span>
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  useEffect(() => { api.dashboard().then(setData) }, [])
  if (!data) return <div style={{ color: 'var(--tx-3)' }} className="text-sm py-12 text-center">Loading...</div>
  const { metrics, pipelinePending, recentApps } = data

  return (
    <div className="space-y-8">
      <h1 style={{ color: 'var(--tx-h)' }} className="text-xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric label="Evaluated" value={metrics.total} />
        <Metric label="Avg Score" value={`${metrics.avgScore}/5`} />
        <Metric label="PDFs" value={metrics.withPDF} sub={`${metrics.total > 0 ? Math.round(metrics.withPDF / metrics.total * 100) : 0}%`} />
        <Metric label="Pipeline" value={pipelinePending} sub="pending" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {Object.entries(metrics.byStatus).map(([s, n]) => (
          <span key={s} className="pill">{s} <span style={{ opacity: 0.5 }}>{n}</span></span>
        ))}
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ color: 'var(--tx-h)' }} className="text-sm font-bold">Recent Evaluations</h2>
          <Link to="/applications" style={{ color: 'var(--blue)' }} className="text-xs hover:underline">View all →</Link>
        </div>
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead><tr><th>#</th><th>Company</th><th>Role</th><th>Score</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {recentApps.map(a => (
                <tr key={a.num}>
                  <td style={{ color: 'var(--tx-3)' }} className="font-mono text-xs">{String(a.num).padStart(3,'0')}</td>
                  <td style={{ color: 'var(--tx-h)' }} className="font-semibold">{a.company}</td>
                  <td>{a.role}</td>
                  <td><Score value={a.score} /></td>
                  <td><span className="pill text-xs">{a.status}</span></td>
                  <td>{a.reportPath && <Link to={`/reports/${a.reportPath.replace('reports/','')}`} style={{ color: 'var(--blue)' }} className="text-xs hover:underline">View</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {metrics.topScored.length > 0 && (
        <section>
          <h2 style={{ color: 'var(--tx-h)' }} className="text-sm font-bold mb-3">Top Scored</h2>
          <div className="space-y-1.5">
            {metrics.topScored.map(a => (
              <div key={a.num} className="card flex items-center justify-between px-4 py-3">
                <div><span style={{ color: 'var(--tx-h)' }} className="font-semibold">{a.company}</span> <span style={{ color: 'var(--tx-3)' }}>— {a.role}</span></div>
                <Score value={a.score} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
