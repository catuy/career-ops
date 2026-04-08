import { useEffect, useState } from 'react'
import { api, type PortalsConfig, type TrackedCompany } from '../lib/api'

type Tab = 'commands' | 'companies' | 'filters' | 'profile' | 'tools'

export function Config() {
  const [tab, setTab] = useState<Tab>('commands')
  return (
    <div className="space-y-5">
      <h1 style={{ color: 'var(--tx-h)' }} className="text-xl font-bold">Configuration</h1>
      <nav className="flex gap-1">
        {(['commands', 'companies', 'filters', 'profile', 'tools'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-3 py-1.5 rounded text-sm capitalize"
            style={{ background: tab === t ? 'var(--ui)' : 'transparent', color: tab === t ? 'var(--tx-h)' : 'var(--tx-3)', fontWeight: tab === t ? 600 : 400 }}>
            {t}
          </button>
        ))}
      </nav>
      {tab === 'commands' && <Commands />}
      {tab === 'companies' && <Companies />}
      {tab === 'filters' && <Filters />}
      {tab === 'profile' && <Profile />}
      {tab === 'tools' && <Tools />}
    </div>
  )
}

// --- Commands ---

function Commands() {
  const [copied, setCopied] = useState<string | null>(null)

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const commands = [
    { cmd: '/career-ops scan', desc: 'Scan all portals for new offers (uses Playwright)', primary: true },
    { cmd: '/career-ops pipeline', desc: 'Process all pending URLs from pipeline' },
    { cmd: '/career-ops {URL}', desc: 'Evaluate a single offer (full pipeline: report + PDF + tracker)', placeholder: true },
    { cmd: '/career-ops apply {URL}', desc: 'Generate application form answers for an offer', placeholder: true },
    { cmd: '/career-ops pdf {URL}', desc: 'Generate personalized CV + cover letter PDF', placeholder: true },
    { cmd: '/career-ops batch', desc: 'Batch process with parallel workers' },
    { cmd: '/career-ops oferta', desc: 'Evaluation only (blocks A-F, no PDF)' },
    { cmd: '/career-ops ofertas', desc: 'Compare and rank multiple offers' },
    { cmd: '/career-ops contacto', desc: 'LinkedIn outreach: find contacts + draft message' },
    { cmd: '/career-ops deep', desc: 'Deep company research' },
    { cmd: '/career-ops tracker', desc: 'Application status overview' },
    { cmd: '/career-ops training', desc: 'Evaluate a course or certification' },
    { cmd: '/career-ops project', desc: 'Evaluate a portfolio project idea' },
  ]

  return (
    <div className="space-y-3">
      <p style={{ color: 'var(--tx-3)' }} className="text-xs">Copy and paste these commands in your Claude Code terminal.</p>
      {commands.map((c, i) => (
        <div key={i} className="card px-4 py-3 flex items-center gap-3"
          style={c.primary ? { borderLeft: '3px solid var(--green)' } : {}}>
          <div className="flex-1 min-w-0">
            <code style={{ color: 'var(--tx-h)', background: 'var(--ui)', padding: '2px 6px', borderRadius: '3px', fontSize: '12px' }}>{c.cmd}</code>
            <span style={{ color: 'var(--tx-3)' }} className="text-xs ml-2">{c.desc}</span>
          </div>
          {!c.placeholder && (
            <button onClick={() => copy(c.cmd, `cmd-${i}`)}
              className="px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 flex-shrink-0"
              style={{ background: copied === `cmd-${i}` ? 'var(--green)' : 'var(--ui)', color: copied === `cmd-${i}` ? '#fff' : 'var(--tx-h)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              {copied === `cmd-${i}` ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// --- Companies ---

function Companies() {
  const [portals, setPortals] = useState<PortalsConfig | null>(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newNotes, setNewNotes] = useState('')

  useEffect(() => { api.portals().then(setPortals) }, [])
  if (!portals) return <div style={{ color: 'var(--tx-3)' }} className="text-sm">Loading...</div>

  const companies = portals.tracked_companies || []

  const toggle = async (name: string, enabled: boolean) => {
    await api.toggleCompany(name, enabled)
    setPortals(p => p ? { ...p, tracked_companies: p.tracked_companies.map(c => c.name === name ? { ...c, enabled } : c) } : p)
  }

  const remove = async (name: string) => {
    await api.removeCompany(name)
    setPortals(p => p ? { ...p, tracked_companies: p.tracked_companies.filter(c => c.name !== name) } : p)
  }

  const add = async () => {
    if (!newName || !newUrl) return
    await api.addCompany({ name: newName, careers_url: newUrl, notes: newNotes || undefined })
    setPortals(p => p ? { ...p, tracked_companies: [...p.tracked_companies, { name: newName, careers_url: newUrl, notes: newNotes, enabled: true }] } : p)
    setNewName(''); setNewUrl(''); setNewNotes(''); setAdding(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span style={{ color: 'var(--tx-3)' }} className="text-xs">{companies.length} companies tracked</span>
        <button onClick={() => setAdding(!adding)} className="pill-accent pill text-xs cursor-pointer">+ Add</button>
      </div>

      {adding && (
        <div className="card p-4 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <input className="input text-sm" placeholder="Company name" value={newName} onChange={e => setNewName(e.target.value)} />
            <input className="input text-sm" placeholder="Careers URL" value={newUrl} onChange={e => setNewUrl(e.target.value)} />
            <input className="input text-sm" placeholder="Notes (optional)" value={newNotes} onChange={e => setNewNotes(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={add} className="px-3 py-1 rounded text-xs font-medium" style={{ background: 'var(--cyan)', color: '#fff' }}>Save</button>
            <button onClick={() => setAdding(false)} className="px-3 py-1 rounded text-xs" style={{ color: 'var(--tx-3)' }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {companies.map((c: TrackedCompany) => (
          <div key={c.name} className="card px-4 py-2.5 flex items-center gap-3">
            <button onClick={() => toggle(c.name, !c.enabled)}
              className="w-8 h-5 rounded-full relative transition-colors flex-shrink-0"
              style={{ background: c.enabled ? 'var(--cyan)' : 'var(--ui-2)' }}>
              <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ left: c.enabled ? '14px' : '2px' }} />
            </button>
            <div className="flex-1 min-w-0">
              <span style={{ color: c.enabled ? 'var(--tx-h)' : 'var(--tx-3)' }} className="text-sm font-medium">{c.name}</span>
              {c.notes && <span style={{ color: 'var(--tx-3)' }} className="text-xs ml-2">{c.notes}</span>}
            </div>
            <a href={c.careers_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }} className="text-xs hover:underline flex-shrink-0 hidden sm:inline">URL</a>
            <button onClick={() => remove(c.name)} style={{ color: 'var(--red)' }} className="text-xs hover:underline flex-shrink-0">Remove</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Filters ---

function Filters() {
  const [portals, setPortals] = useState<PortalsConfig | null>(null)
  const [positive, setPositive] = useState('')
  const [negative, setNegative] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.portals().then(p => {
      setPortals(p)
      setPositive(p.title_filter?.positive?.join(', ') || '')
      setNegative(p.title_filter?.negative?.join(', ') || '')
    })
  }, [])

  const save = async () => {
    const pos = positive.split(',').map(s => s.trim()).filter(Boolean)
    const neg = negative.split(',').map(s => s.trim()).filter(Boolean)
    await api.updateFilters(pos, neg)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!portals) return <div style={{ color: 'var(--tx-3)' }} className="text-sm">Loading...</div>

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-4">
        <div>
          <label style={{ color: 'var(--tx-h)' }} className="text-sm font-semibold block mb-1">Positive keywords</label>
          <p style={{ color: 'var(--tx-3)' }} className="text-xs mb-2">At least one must match in the job title. Comma-separated.</p>
          <textarea className="input w-full" rows={3} value={positive} onChange={e => setPositive(e.target.value)} />
        </div>
        <div>
          <label style={{ color: 'var(--tx-h)' }} className="text-sm font-semibold block mb-1">Negative keywords</label>
          <p style={{ color: 'var(--tx-3)' }} className="text-xs mb-2">None may match. Comma-separated.</p>
          <textarea className="input w-full" rows={3} value={negative} onChange={e => setNegative(e.target.value)} />
        </div>
        <button onClick={save} className="px-4 py-2 rounded text-sm font-medium" style={{ background: 'var(--cyan)', color: '#fff' }}>
          {saved ? '✓ Saved' : 'Save filters'}
        </button>
      </div>
    </div>
  )
}

// --- Profile ---

function Profile() {
  const [raw, setRaw] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/config/profile/raw').then(r => r.text()).then(setRaw)
  }, [])

  const save = async () => {
    const YAML = await import('yaml')
    const data = YAML.parse(raw)
    await api.saveProfile(data)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ color: 'var(--tx-h)' }} className="text-sm font-bold">profile.yml</h2>
          <p style={{ color: 'var(--tx-3)' }} className="text-xs mt-0.5">Your identity, target roles, narrative, compensation.</p>
        </div>
        <button onClick={save} className="px-4 py-2 rounded text-sm font-medium" style={{ background: 'var(--cyan)', color: '#fff' }}>
          {saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
      <textarea
        className="input w-full font-mono text-xs leading-relaxed"
        rows={24}
        value={raw}
        onChange={e => setRaw(e.target.value)}
        style={{ background: 'var(--bg)', tabSize: 2 }}
      />
    </div>
  )
}

// --- Tools ---

function Tools() {
  const [results, setResults] = useState<Record<string, { status: string; output: string[] }>>({})

  const run = async (name: string, fn: () => Promise<{ jobId: string }>) => {
    setResults(r => ({ ...r, [name]: { status: 'running', output: [] } }))
    const { jobId } = await fn()

    const { streamJob } = await import('../lib/api')
    streamJob(jobId,
      (line) => setResults(r => ({ ...r, [name]: { ...r[name], output: [...r[name].output, line] } })),
      () => setResults(r => ({ ...r, [name]: { ...r[name], status: 'done' } }))
    )
  }

  const tools = [
    { name: 'verify', label: 'Verify Pipeline', desc: 'Check statuses, duplicates, links', fn: api.verify },
    { name: 'normalize', label: 'Normalize', desc: 'Clean non-canonical statuses', fn: api.normalize },
    { name: 'dedup', label: 'Dedup', desc: 'Remove duplicate entries', fn: api.dedup },
    { name: 'merge', label: 'Merge Tracker', desc: 'Merge batch TSV additions', fn: api.merge },
    { name: 'sync-check', label: 'Sync Check', desc: 'Validate setup consistency', fn: api.syncCheck },
  ]

  return (
    <div className="space-y-3">
      {tools.map(t => (
        <div key={t.name} className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <span style={{ color: 'var(--tx-h)' }} className="text-sm font-semibold">{t.label}</span>
              <span style={{ color: 'var(--tx-3)' }} className="text-xs ml-2">{t.desc}</span>
            </div>
            <button onClick={() => run(t.name, t.fn)}
              disabled={results[t.name]?.status === 'running'}
              className="px-3 py-1 rounded text-xs font-medium"
              style={{ background: 'var(--ui)', color: 'var(--tx-h)' }}>
              {results[t.name]?.status === 'running' ? 'Running...' : 'Run'}
            </button>
          </div>
          {results[t.name]?.output.length > 0 && (
            <div className="mt-2 p-2 rounded font-mono text-xs leading-relaxed max-h-40 overflow-y-auto" style={{ background: 'var(--bg)', color: 'var(--tx-2)' }}>
              {results[t.name].output.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
