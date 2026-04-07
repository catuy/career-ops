import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Application } from '../lib/api'

const STATUSES = ['Evaluada', 'Applied', 'Responded', 'Interview', 'Offer', 'Rejected', 'Discarded', 'SKIP']
type SortKey = 'num' | 'score' | 'date' | 'company' | 'status'

function Score({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: 'var(--tx-3)' }}>—</span>
  const c = value >= 4 ? 'var(--green)' : value >= 3 ? 'var(--yellow)' : 'var(--red)'
  return <span className="font-mono text-xs font-bold" style={{ color: c }}>{value.toFixed(1)}</span>
}

export function Applications() {
  const [apps, setApps] = useState<Application[]>([])
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('num')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [editing, setEditing] = useState<number | null>(null)
  useEffect(() => { api.applications().then(setApps) }, [])

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(key); setSortDir('desc') }
  }

  const filtered = apps
    .filter(a => {
      if (statusFilter && a.status !== statusFilter) return false
      if (filter) { const q = filter.toLowerCase(); return a.company.toLowerCase().includes(q) || a.role.toLowerCase().includes(q) || a.notes.toLowerCase().includes(q) }
      return true
    })
    .sort((a, b) => {
      const d = sortDir === 'asc' ? 1 : -1
      switch (sortBy) {
        case 'score': return ((a.score||0) - (b.score||0)) * d
        case 'date': return a.date.localeCompare(b.date) * d
        case 'company': return a.company.localeCompare(b.company) * d
        case 'status': return a.status.localeCompare(b.status) * d
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
        <span style={{ color: 'var(--tx-3)' }} className="text-xs">{filtered.length} of {apps.length}</span>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <input type="text" placeholder="Search..." value={filter} onChange={e => setFilter(e.target.value)} className="input w-56" />
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setStatusFilter(null)} className={`pill text-xs ${!statusFilter ? 'pill-accent' : ''}`}>All</button>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? null : s)} className={`pill text-xs ${statusFilter === s ? 'pill-accent' : ''}`}>{s}</button>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {(['num','date','company','score','status'] as SortKey[]).map(k => (
                <th key={k} onClick={() => toggleSort(k)} className="cursor-pointer select-none">
                  {k === 'num' ? '#' : k}{sortBy === k && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                </th>
              ))}
              <th>Role</th><th>PDF</th><th>Report</th><th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.num}>
                <td style={{ color: 'var(--tx-3)' }} className="font-mono text-xs">{String(a.num).padStart(3,'0')}</td>
                <td style={{ color: 'var(--tx-3)' }} className="text-xs">{a.date}</td>
                <td style={{ color: 'var(--tx-h)' }} className="font-semibold">{a.company}</td>
                <td><Score value={a.score} /></td>
                <td>
                  {editing === a.num ? (
                    <select value={a.status} onChange={e => handleStatusChange(a.num, e.target.value)} onBlur={() => setEditing(null)} autoFocus className="input text-xs py-0.5 px-1">
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <button onClick={() => setEditing(a.num)} className="pill text-xs cursor-pointer">{a.status}</button>
                  )}
                </td>
                <td className="text-xs max-w-[180px] truncate">{a.role}</td>
                <td>{a.hasPDF ? <span style={{ color: 'var(--green)' }} className="text-xs font-medium">PDF</span> : <span style={{ color: 'var(--tx-3)' }} className="text-xs">—</span>}</td>
                <td>{a.reportPath && <Link to={`/reports/${a.reportPath.replace('reports/','')}`} style={{ color: 'var(--blue)' }} className="text-xs hover:underline">#{a.reportNum}</Link>}</td>
                <td style={{ color: 'var(--tx-3)' }} className="text-xs max-w-[220px] truncate" title={a.notes}>{a.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
