import { useEffect, useState } from 'react'
import { api, type PipelineData } from '../lib/api'

export function Pipeline() {
  const [data, setData] = useState<PipelineData | null>(null)
  const [tab, setTab] = useState<'pending' | 'processed'>('pending')
  useEffect(() => { api.pipeline().then(setData) }, [])
  if (!data) return <div style={{ color: 'var(--tx-3)' }} className="text-sm py-12 text-center">Loading...</div>
  const items = tab === 'pending' ? data.pending : data.processed

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 style={{ color: 'var(--tx-h)' }} className="text-xl font-bold">Pipeline</h1>
        <span style={{ color: 'var(--tx-3)' }} className="text-xs">{data.pending.length} pending · {data.processed.length} processed</span>
      </div>
      <div className="flex gap-1">
        {(['pending', 'processed'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-3 py-1.5 rounded text-sm capitalize transition-colors"
            style={{ background: tab === t ? 'var(--ui)' : 'transparent', color: tab === t ? 'var(--tx-h)' : 'var(--tx-3)', fontWeight: tab === t ? 600 : 400 }}
          >
            {t} ({t === 'pending' ? data.pending.length : data.processed.length})
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {items.length === 0 && <div style={{ color: 'var(--tx-3)' }} className="text-sm py-12 text-center">No items</div>}
        {items.map((item, i) => (
          <div key={i} className="card px-4 py-3 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: item.status === 'pending' ? 'var(--yellow)' : item.status === 'error' ? 'var(--red)' : 'var(--green)' }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {item.company && <span style={{ color: 'var(--tx-h)' }} className="font-semibold text-sm">{item.company}</span>}
                {item.role && <span style={{ color: 'var(--tx-3)' }} className="text-xs">— {item.role}</span>}
              </div>
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tx-3)' }} className="text-xs hover:underline truncate block">{item.url}</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
