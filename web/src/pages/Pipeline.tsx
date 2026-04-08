import { useEffect, useState, useCallback } from 'react'
import { api, streamJob, type PipelineData, type PipelineItem, type Job } from '../lib/api'

export function Pipeline() {
  const [data, setData] = useState<PipelineData | null>(null)
  const [tab, setTab] = useState<'pending' | 'processed'>('pending')
  const [urlInput, setUrlInput] = useState('')
  const [addStatus, setAddStatus] = useState<string | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [activeJob, setActiveJob] = useState<string | null>(null)
  const [streamOutput, setStreamOutput] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')

  const load = useCallback(() => {
    api.pipeline().then(setData)
    api.jobs().then(setJobs)
  }, [])

  useEffect(() => { load(); const i = setInterval(load, 5000); return () => clearInterval(i) }, [load])

  const hasRunning = jobs.some(j => j.status === 'running' || j.status === 'queued')

  // Auto-attach to running job
  useEffect(() => {
    const running = jobs.find(j => j.status === 'running')
    if (running && !activeJob) {
      setActiveJob(running.id)
      setStreamOutput([])
      streamJob(running.id,
        (line) => setStreamOutput(prev => [...prev, line]),
        () => load()
      )
    }
  }, [jobs])

  const startJob = (jobId: string) => {
    setActiveJob(jobId)
    setStreamOutput([])
    load()
    streamJob(jobId,
      (line) => setStreamOutput(prev => [...prev, line]),
      () => { setActiveJob(null); load() }
    )
  }

  const evaluateOne = async (url: string) => {
    if (hasRunning) return
    const { jobId } = await api.evaluate(url)
    startJob(jobId)
  }

  const evaluateSelected = async () => {
    if (hasRunning || !selected.size || !data) return
    const items = data.pending.filter(p => selected.has(p.url))
    const { jobId } = await api.evaluateBatch(items.map(p => ({ url: p.url, company: p.company, role: p.role })))
    setSelected(new Set())
    startJob(jobId)
  }

  const evaluateAll = async () => {
    if (hasRunning || !data?.pending.length) return
    const visible = getFiltered(data.pending)
    const { jobId } = await api.evaluateBatch(visible.map(p => ({ url: p.url, company: p.company, role: p.role })))
    startJob(jobId)
  }

  const discardSelected = async () => {
    if (!selected.size) return
    await api.removeFromPipeline([...selected])
    setSelected(new Set())
    load()
  }

  const addUrls = async () => {
    const urls = urlInput.split('\n').map(u => u.trim()).filter(Boolean)
    if (!urls.length) return
    const { added } = await api.addToPipeline(urls)
    setAddStatus(`Added ${added}`)
    setUrlInput('')
    load()
    setTimeout(() => setAddStatus(null), 3000)
  }

  const toggleSelect = (url: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(url) ? next.delete(url) : next.add(url)
      return next
    })
  }

  const getFiltered = (items: PipelineItem[]) => {
    if (!filter) return items
    const q = filter.toLowerCase()
    return items.filter(p => p.company.toLowerCase().includes(q) || p.role.toLowerCase().includes(q) || p.url.toLowerCase().includes(q))
  }

  const toggleAll = () => {
    if (!data) return
    const visible = getFiltered(data.pending)
    if (selected.size === visible.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(visible.map(p => p.url)))
    }
  }

  if (!data) return <div style={{ color: 'var(--tx-3)' }} className="text-sm py-12 text-center">Loading...</div>

  const items = tab === 'pending' ? getFiltered(data.pending) : data.processed

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 style={{ color: 'var(--tx-h)' }} className="text-xl font-bold">Pipeline</h1>
        <span style={{ color: 'var(--tx-3)' }} className="text-xs">{data.pending.length} pending · {data.processed.length} processed</span>
      </div>

      {/* Running job */}
      {activeJob && streamOutput.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid var(--ui)' }}>
            <span style={{ color: 'var(--tx-h)' }} className="text-xs font-bold uppercase tracking-wider">
              {jobs.find(j => j.id === activeJob)?.type === 'batch-evaluate' ? 'Batch Evaluate' : 'Evaluating'}
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: hasRunning ? 'var(--yellow)' : 'var(--green)' }} />
              <span className="text-xs" style={{ color: hasRunning ? 'var(--yellow)' : 'var(--green)' }}>
                {hasRunning ? 'Running' : 'Complete'}
              </span>
            </div>
          </div>
          <div className="p-4 max-h-[300px] overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-wrap" style={{ background: 'var(--bg)', color: 'var(--tx-2)' }}>
            {streamOutput.map((line, i) => (
              <div key={i} style={{
                color: line.startsWith('[stderr]') ? 'var(--red)'
                  : line.startsWith('[system]') || line.startsWith('[batch]') ? 'var(--cyan)'
                  : 'var(--tx-2)'
              }}>{line}</div>
            ))}
          </div>
        </div>
      )}

      {/* Add URLs */}
      <div className="card p-4 space-y-2">
        <h2 style={{ color: 'var(--tx-h)' }} className="text-sm font-semibold">Add URLs</h2>
        <textarea className="input w-full text-sm" rows={2} placeholder="One URL per line..." value={urlInput} onChange={e => setUrlInput(e.target.value)} />
        <div className="flex items-center gap-3">
          <button onClick={addUrls} disabled={!urlInput.trim()} className="px-3 py-1.5 rounded text-sm font-medium"
            style={{ background: urlInput.trim() ? 'var(--cyan)' : 'var(--ui)', color: urlInput.trim() ? '#fff' : 'var(--tx-3)' }}>
            Add
          </button>
          {addStatus && <span style={{ color: 'var(--green)' }} className="text-xs">{addStatus}</span>}
        </div>
      </div>

      {/* Tabs + filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {(['pending', 'processed'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setSelected(new Set()) }}
              className="px-3 py-1.5 rounded text-sm capitalize"
              style={{ background: tab === t ? 'var(--ui)' : 'transparent', color: tab === t ? 'var(--tx-h)' : 'var(--tx-3)', fontWeight: tab === t ? 600 : 400 }}>
              {t} ({t === 'pending' ? data.pending.length : data.processed.length})
            </button>
          ))}
        </div>
        {tab === 'pending' && (
          <input type="text" placeholder="Filter by company or role..." value={filter} onChange={e => setFilter(e.target.value)} className="input text-sm w-56" />
        )}
      </div>

      {/* Bulk actions */}
      {tab === 'pending' && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={toggleAll} className="pill text-xs cursor-pointer">
            {selected.size === items.length && items.length > 0 ? 'Deselect all' : `Select all (${items.length})`}
          </button>

          {selected.size > 0 && (
            <>
              <span style={{ color: 'var(--tx-3)' }} className="text-xs">{selected.size} selected</span>
              <button onClick={evaluateSelected} disabled={hasRunning}
                className="px-3 py-1 rounded text-xs font-medium"
                style={{ background: hasRunning ? 'var(--ui)' : 'var(--cyan)', color: hasRunning ? 'var(--tx-3)' : '#fff' }}>
                Evaluate selected
              </button>
              <button onClick={discardSelected}
                className="px-3 py-1 rounded text-xs font-medium"
                style={{ background: 'var(--ui)', color: 'var(--red)' }}>
                Discard selected
              </button>
            </>
          )}

          {!selected.size && (
            <button onClick={evaluateAll} disabled={hasRunning || !items.length}
              className="px-3 py-1 rounded text-xs font-medium"
              style={{ background: hasRunning || !items.length ? 'var(--ui)' : 'var(--green)', color: hasRunning || !items.length ? 'var(--tx-3)' : '#fff' }}>
              {hasRunning ? 'Running...' : `Evaluate all (${items.length})`}
            </button>
          )}
        </div>
      )}

      {/* Items */}
      <div className="space-y-1">
        {items.length === 0 && <div style={{ color: 'var(--tx-3)' }} className="text-sm py-8 text-center">No items</div>}
        {items.map((item, i) => {
          const isSelected = selected.has(item.url)
          return (
            <div key={i} className="card px-4 py-2.5 flex items-center gap-3 transition-colors"
              style={isSelected ? { borderColor: 'var(--cyan)' } : {}}>
              {tab === 'pending' && (
                <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item.url)}
                  className="w-4 h-4 rounded flex-shrink-0 accent-cyan-600 cursor-pointer" />
              )}
              <div className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: item.status === 'pending' ? 'var(--yellow)' : item.status === 'error' ? 'var(--red)' : 'var(--green)' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {item.company && <span style={{ color: 'var(--tx-h)' }} className="font-semibold text-sm">{item.company}</span>}
                  {item.role && <span style={{ color: 'var(--tx-3)' }} className="text-xs">— {item.role}</span>}
                </div>
                <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tx-3)' }} className="text-xs hover:underline truncate block">{item.url}</a>
              </div>
              {item.status === 'pending' && (
                <button onClick={() => evaluateOne(item.url)} disabled={hasRunning}
                  className="px-3 py-1 rounded text-xs font-medium flex-shrink-0"
                  style={{ background: hasRunning ? 'var(--ui)' : 'var(--cyan)', color: hasRunning ? 'var(--tx-3)' : '#fff' }}>
                  Evaluate
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
