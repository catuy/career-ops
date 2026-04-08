import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Application } from '../lib/api'

const STATUSES = ['Pre-approved', 'Applied', 'Responded', 'Interview', 'Offer', 'Rejected', 'Discarded', 'SKIP']
const HIDDEN = ['Discarded', 'SKIP']
const ACTIVE = STATUSES.filter(s => !HIDDEN.includes(s))

type SortKey = 'num' | 'score' | 'date' | 'company' | 'status'
type View = 'active' | 'archived'

function Score({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: 'var(--tx-3)' }}>—</span>
  const c = value >= 4 ? 'var(--green)' : value >= 3 ? 'var(--yellow)' : 'var(--red)'
  return <span className="font-mono text-xs font-bold" style={{ color: c }}>{value.toFixed(1)}</span>
}

// Map legacy Spanish statuses to English
function normalizeStatus(s: string): string {
  const map: Record<string, string> = { 'Evaluada': 'Pre-approved', 'Aplicado': 'Applied', 'Respondido': 'Responded', 'Entrevista': 'Interview', 'Oferta': 'Offer', 'Rechazado': 'Rejected', 'Descartado': 'Discarded' }
  return map[s] || s
}

export function Applications() {
  const [apps, setApps] = useState<Application[]>([])
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [editing, setEditing] = useState<number | null>(null)
  const [view, setView] = useState<View>('active')
  useEffect(() => { api.applications().then(setApps) }, [])

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(key); setSortDir('desc') }
  }

  const mapped = apps.map(a => ({ ...a, displayStatus: normalizeStatus(a.status) }))
  const activeApps = mapped.filter(a => !HIDDEN.includes(a.displayStatus))
  const archivedApps = mapped.filter(a => HIDDEN.includes(a.displayStatus))
  const baseApps = view === 'active' ? activeApps : archivedApps

  const filtered = baseApps
    .filter(a => {
      if (statusFilter && a.displayStatus !== statusFilter) return false
      if (filter) { const q = filter.toLowerCase(); return a.company.toLowerCase().includes(q) || a.role.toLowerCase().includes(q) || a.notes.toLowerCase().includes(q) }
      return true
    })
    .sort((a, b) => {
      const d = sortDir === 'asc' ? 1 : -1
      switch (sortBy) {
        case 'score': return ((a.score||0) - (b.score||0)) * d
        case 'date': return a.date.localeCompare(b.date) * d
        case 'company': return a.company.localeCompare(b.company) * d
        case 'status': return a.displayStatus.localeCompare(b.displayStatus) * d
        default: return (a.num - b.num) * d
      }
    })

  const handleStatusChange = async (num: number, status: string) => {
    await api.updateApplication(num, { status })
    setApps(prev => prev.map(a => a.num === num ? { ...a, status } : a))
    setEditing(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 style={{ color: 'var(--tx-h)' }} className="text-xl font-bold">Applications</h1>
        <div className="flex items-center gap-3">
          <span style={{ color: 'var(--tx-3)' }} className="text-xs">{filtered.length} shown</span>
          <div className="flex gap-1">
            {(['active', 'archived'] as View[]).map(v => (
              <button key={v} onClick={() => { setView(v); setStatusFilter(null) }}
                className="px-2.5 py-1 rounded text-xs capitalize"
                style={{ background: view === v ? 'var(--ui)' : 'transparent', color: view === v ? 'var(--tx-h)' : 'var(--tx-3)', fontWeight: view === v ? 600 : 400 }}>
                {v} ({v === 'active' ? activeApps.length : archivedApps.length})
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <input type="text" placeholder="Search..." value={filter} onChange={e => setFilter(e.target.value)} className="input w-56" />
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setStatusFilter(null)} className={`pill text-xs ${!statusFilter ? 'pill-accent' : ''}`}>All</button>
          {(view === 'active' ? ACTIVE : HIDDEN).map(s => (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? null : s)} className={`pill text-xs ${statusFilter === s ? 'pill-accent' : ''}`}>{s}</button>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {(['score','company','status'] as SortKey[]).map(k => (
                <th key={k} onClick={() => toggleSort(k)} className="cursor-pointer select-none">
                  {k}{sortBy === k && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                </th>
              ))}
              <th>Role</th><th>Date</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.num}>
                <td><Score value={a.score} /></td>
                <td style={{ color: 'var(--tx-h)' }} className="font-semibold">{a.company}</td>
                <td>
                  {editing === a.num ? (
                    <select value={a.status} onChange={e => handleStatusChange(a.num, e.target.value)} onBlur={() => setEditing(null)} autoFocus className="input text-xs py-0.5 px-1">
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <button onClick={() => setEditing(a.num)} className="pill text-xs cursor-pointer">{a.displayStatus}</button>
                  )}
                </td>
                <td className="text-sm">{a.role}</td>
                <td style={{ color: 'var(--tx-3)' }} className="text-xs">{a.date}</td>
                <td>
                  {a.reportPath && <Link to={`/reports/${a.reportPath.replace('reports/','')}`} style={{ color: 'var(--blue)' }} className="text-xs hover:underline">View →</Link>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
