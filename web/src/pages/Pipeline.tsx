import { useEffect, useState, useCallback } from 'react'
import { api, type PipelineData, type PipelineItem } from '../lib/api'

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}

export function Pipeline() {
  const [data, setData] = useState<PipelineData | null>(null)
  const [tab, setTab] = useState<'pending' | 'processed'>('pending')
  const [urlInput, setUrlInput] = useState('')
  const [addStatus, setAddStatus] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [cleaning, setCleaning] = useState(false)
  const [cleanResult, setCleanResult] = useState<{ total: number; removed: number; remaining: number; kept: any[]; discarded: any[] } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(() => { api.pipeline().then(setData) }, [])
  useEffect(() => { load() }, [load])

  const getFiltered = (items: PipelineItem[]) => {
    if (!filter) return items
    const q = filter.toLowerCase()
    return items.filter(p => p.company.toLowerCase().includes(q) || p.role.toLowerCase().includes(q) || p.url.toLowerCase().includes(q))
  }

  const toggleSelect = (url: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(url) ? n.delete(url) : n.add(url); return n })
  }

  const toggleAll = () => {
    if (!data) return
    const visible = getFiltered(data.pending)
    setSelected(selected.size === visible.length ? new Set() : new Set(visible.map(p => p.url)))
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

  const runAutoFilter = async () => {
    setCleaning(true); setCleanResult(null)
    try { const r = await api.autoCleanPipeline(); setCleanResult(r); load() }
    finally { setCleaning(false) }
  }

  const copyCommand = (url: string, label?: string) => {
    const cmd = `/career-ops ${url}`
    copyToClipboard(cmd)
    setCopied(url)
    setTimeout(() => setCopied(null), 2000)
  }

  const copyBatchCommand = () => {
    if (!data) return
    const urls = data.pending.filter(p => selected.has(p.url)).map(p => p.url)
    const cmd = urls.length === 1
      ? `/career-ops ${urls[0]}`
      : `/career-ops pipeline`
    copyToClipboard(cmd)
    setCopied('batch')
    setTimeout(() => setCopied(null), 2000)
  }

  if (!data) return <div style={{ color: 'var(--tx-3)' }} className="text-sm py-12 text-center">Loading...</div>
  const items = tab === 'pending' ? getFiltered(data.pending) : data.processed

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 style={{ color: 'var(--tx-h)' }} className="text-xl font-bold">Pipeline</h1>
        <span style={{ color: 'var(--tx-3)' }} className="text-xs">{data.pending.length} pending · {data.processed.length} processed</span>
      </div>

      {/* Evaluate URL manually */}
      <div className="card p-5 space-y-3">
        <h2 style={{ color: 'var(--tx-h)' }} className="text-sm font-bold">Evaluate an Offer</h2>
        <p style={{ color: 'var(--tx-3)' }} className="text-xs">Paste a job URL — copies the CLI command to run the full evaluation with Playwright.</p>
        <div className="flex gap-2">
          <input type="text" placeholder="https://jobs.ashbyhq.com/company/..." value={urlInput} onChange={e => setUrlInput(e.target.value)}
            className="input flex-1 text-sm"
            onKeyDown={e => { if (e.key === 'Enter' && urlInput.trim()) { copyCommand(urlInput.trim()); setUrlInput('') } }}
          />
          <button onClick={() => { if (urlInput.trim()) { copyCommand(urlInput.trim()); setUrlInput('') } }}
            disabled={!urlInput.trim()}
            className="px-4 py-2 rounded text-sm font-medium flex-shrink-0 flex items-center gap-1.5"
            style={{ background: urlInput.trim() ? 'var(--cyan)' : 'var(--ui)', color: urlInput.trim() ? '#fff' : 'var(--tx-3)' }}>
            <ClipboardIcon />
            {copied === urlInput.trim() ? 'Copied!' : 'Copy command'}
          </button>
        </div>
        {copied && copied !== 'batch' && (
          <div className="flex items-center gap-2 p-2 rounded text-xs" style={{ background: 'color-mix(in srgb, var(--green) 10%, var(--bg))', color: 'var(--green)' }}>
            <span>✓ Copied to clipboard. Paste in your Claude Code terminal:</span>
            <code style={{ background: 'var(--ui)', padding: '2px 6px', borderRadius: '3px', color: 'var(--tx-h)' }}>
              /career-ops {copied.length > 50 ? copied.slice(0, 50) + '...' : copied}
            </code>
          </div>
        )}
      </div>

      {/* Auto-filter */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 style={{ color: 'var(--tx-h)' }} className="text-sm font-bold">Auto-filter by Location</h2>
            <p style={{ color: 'var(--tx-3)' }} className="text-xs mt-0.5">Checks URLs via HTTP (zero tokens). Removes US-only, EU-only, on-site, closed.</p>
          </div>
          <button onClick={runAutoFilter} disabled={cleaning}
            className="px-4 py-2 rounded text-sm font-medium flex-shrink-0"
            style={{ background: cleaning ? 'var(--ui)' : 'var(--orange)', color: cleaning ? 'var(--tx-3)' : '#fff', cursor: cleaning ? 'wait' : 'pointer' }}>
            {cleaning ? 'Checking...' : 'Auto-filter'}
          </button>
        </div>
        {cleanResult && (
          <div className="mt-4 space-y-3">
            <div className="flex gap-3 text-sm">
              <span style={{ color: 'var(--red)' }} className="font-semibold">{cleanResult.removed} removed</span>
              <span style={{ color: 'var(--green)' }} className="font-semibold">{cleanResult.remaining} remaining</span>
              <span style={{ color: 'var(--tx-3)' }}>of {cleanResult.total} checked</span>
            </div>
            {cleanResult.kept.length > 0 && (
              <div>
                <h3 style={{ color: 'var(--green)' }} className="text-xs font-bold uppercase tracking-wider mb-2">Kept ({cleanResult.kept.length})</h3>
                <div className="space-y-1">
                  {cleanResult.kept.map((k, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-1" style={{ borderBottom: '1px solid var(--ui)' }}>
                      <span className="pill text-xs" style={{
                        background: k.remoteOk === 'YES' ? 'color-mix(in srgb, var(--green) 15%, var(--bg))' : 'color-mix(in srgb, var(--yellow) 15%, var(--bg))',
                        color: k.remoteOk === 'YES' ? 'var(--green)' : 'var(--yellow)',
                      }}>{k.remoteOk}</span>
                      <span style={{ color: 'var(--tx-h)' }} className="font-medium">{k.company || 'Unknown'}</span>
                      <span style={{ color: 'var(--tx-3)' }}>— {k.role || 'No role'}</span>
                      <span style={{ color: 'var(--tx-3)' }} className="ml-auto text-xs">{k.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {cleanResult.discarded.length > 0 && (
              <details className="mt-2">
                <summary style={{ color: 'var(--red)' }} className="text-xs font-bold uppercase tracking-wider cursor-pointer">Discarded ({cleanResult.discarded.length}) — click to see</summary>
                <div className="space-y-1 mt-2">
                  {cleanResult.discarded.map((k, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-1" style={{ borderBottom: '1px solid var(--ui)', opacity: 0.6 }}>
                      <span className="pill text-xs" style={{ background: 'color-mix(in srgb, var(--red) 10%, var(--bg))', color: 'var(--red)' }}>NO</span>
                      <span>{k.company || 'Unknown'}</span>
                      <span style={{ color: 'var(--tx-3)' }}>— {k.role || ''}</span>
                      <span style={{ color: 'var(--tx-3)' }} className="ml-auto text-xs">{k.reason}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
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
          <input type="text" placeholder="Filter..." value={filter} onChange={e => setFilter(e.target.value)} className="input text-sm w-48" />
        )}
      </div>

      {/* Bulk actions */}
      {tab === 'pending' && items.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={toggleAll} className="pill text-xs cursor-pointer">
            {selected.size === items.length ? 'Deselect all' : `Select all (${items.length})`}
          </button>
          {selected.size > 0 && (
            <>
              <span style={{ color: 'var(--tx-3)' }} className="text-xs">{selected.size} selected</span>
              <button onClick={copyBatchCommand}
                className="px-3 py-1 rounded text-xs font-medium flex items-center gap-1"
                style={{ background: 'var(--cyan)', color: '#fff' }}>
                <ClipboardIcon />
                {copied === 'batch' ? 'Copied!' : 'Copy evaluate command'}
              </button>
              <button onClick={discardSelected}
                className="px-3 py-1 rounded text-xs font-medium"
                style={{ background: 'var(--ui)', color: 'var(--red)' }}>
                Discard
              </button>
            </>
          )}
        </div>
      )}

      {copied === 'batch' && (
        <div className="flex items-center gap-2 p-2 rounded text-xs" style={{ background: 'color-mix(in srgb, var(--green) 10%, var(--bg))', color: 'var(--green)' }}>
          <span>✓ Copied. Paste in your Claude Code terminal to evaluate {selected.size > 1 ? 'all selected' : 'the offer'}.</span>
        </div>
      )}

      {/* Items */}
      <div className="space-y-1">
        {items.length === 0 && <div style={{ color: 'var(--tx-3)' }} className="text-sm py-8 text-center">No items</div>}
        {items.map((item, i) => (
          <div key={i} className="card px-4 py-2.5 flex items-center gap-3"
            style={selected.has(item.url) ? { borderColor: 'var(--cyan)' } : {}}>
            {tab === 'pending' && (
              <input type="checkbox" checked={selected.has(item.url)} onChange={() => toggleSelect(item.url)}
                className="w-4 h-4 rounded flex-shrink-0 cursor-pointer" />
            )}
            <div className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: item.status === 'pending' ? 'var(--yellow)' : item.status === 'error' ? 'var(--red)' : 'var(--green)' }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--tx-h)' }} className="font-semibold text-sm">
                  {item.company || (() => { try { return new URL(item.url).hostname.replace('www.', '').split('.')[0] } catch { return 'Unknown' } })()}
                </span>
                {item.role && <span style={{ color: 'var(--tx-3)' }} className="text-xs">— {item.role}</span>}
              </div>
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tx-3)' }} className="text-xs hover:underline truncate block">{item.url}</a>
            </div>
            {item.status === 'pending' && (
              <button onClick={() => copyCommand(item.url)}
                className="px-3 py-1 rounded text-xs font-medium flex-shrink-0 flex items-center gap-1 transition-colors"
                style={{ background: copied === item.url ? 'var(--green)' : 'var(--ui)', color: copied === item.url ? '#fff' : 'var(--tx-h)' }}>
                <ClipboardIcon />
                {copied === item.url ? 'Copied!' : 'Evaluate'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ClipboardIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  )
}
