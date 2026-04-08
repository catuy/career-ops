import { useEffect, useState, useCallback } from 'react'
import { api, type Job } from '../lib/api'

export function Evaluate() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<string | null>(null)

  const loadJobs = useCallback(() => { api.jobs().then(setJobs) }, [])
  useEffect(() => { loadJobs(); const i = setInterval(loadJobs, 5000); return () => clearInterval(i) }, [loadJobs])

  const selectedOutput = selectedJob ? jobs.find(j => j.id === selectedJob)?.output || [] : []

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ color: 'var(--tx-h)' }} className="text-xl font-bold">Activity</h1>
        <p style={{ color: 'var(--tx-3)' }} className="text-sm mt-1">
          Run evaluations and scans from CLI — results appear here automatically.
        </p>
      </div>

      {/* CLI instructions */}
      <div className="card p-5 space-y-3">
        <h2 style={{ color: 'var(--tx-h)' }} className="text-sm font-bold">How to use</h2>
        <div className="space-y-2 text-sm" style={{ color: 'var(--tx-2)' }}>
          <div className="flex gap-3 items-start">
            <code className="px-2 py-0.5 rounded text-xs font-mono flex-shrink-0" style={{ background: 'var(--ui)', color: 'var(--tx-h)' }}>/career-ops scan</code>
            <span>Scan all portals for new offers (uses Playwright)</span>
          </div>
          <div className="flex gap-3 items-start">
            <code className="px-2 py-0.5 rounded text-xs font-mono flex-shrink-0" style={{ background: 'var(--ui)', color: 'var(--tx-h)' }}>/career-ops {'{URL}'}</code>
            <span>Evaluate a single offer (full pipeline: report + PDF + tracker)</span>
          </div>
          <div className="flex gap-3 items-start">
            <code className="px-2 py-0.5 rounded text-xs font-mono flex-shrink-0" style={{ background: 'var(--ui)', color: 'var(--tx-h)' }}>/career-ops pipeline</code>
            <span>Process all pending URLs from the pipeline</span>
          </div>
          <div className="flex gap-3 items-start">
            <code className="px-2 py-0.5 rounded text-xs font-mono flex-shrink-0" style={{ background: 'var(--ui)', color: 'var(--tx-h)' }}>/career-ops batch</code>
            <span>Batch process with parallel workers</span>
          </div>
        </div>
      </div>

      {/* Job history */}
      {jobs.length > 0 && (
        <div className="space-y-2">
          <h2 style={{ color: 'var(--tx-h)' }} className="text-sm font-bold">Recent jobs (from web UI)</h2>
          {jobs.slice(0, 10).map(j => (
            <button key={j.id} onClick={() => setSelectedJob(selectedJob === j.id ? null : j.id)}
              className="card w-full text-left px-4 py-3 flex items-center gap-3 transition-colors"
              style={selectedJob === j.id ? { borderColor: 'var(--cyan)' } : {}}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{
                background: j.status === 'running' ? 'var(--yellow)' : j.status === 'done' ? 'var(--green)' : j.status === 'error' ? 'var(--red)' : 'var(--tx-3)'
              }} />
              <span style={{ color: 'var(--tx-h)' }} className="text-sm font-medium capitalize">{j.type}</span>
              <span style={{ color: 'var(--tx-3)' }} className="text-xs">
                {j.finishedAt ? `${Math.round((j.finishedAt - j.startedAt) / 1000)}s` : `${Math.round((Date.now() - j.startedAt) / 1000)}s...`}
              </span>
              <span style={{ color: 'var(--tx-3)' }} className="text-xs">{j.output.length} lines</span>
              <span className="text-xs capitalize ml-auto" style={{
                color: j.status === 'done' ? 'var(--green)' : j.status === 'error' ? 'var(--red)' : 'var(--tx-3)'
              }}>{j.status}</span>
            </button>
          ))}

          {selectedJob && selectedOutput.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-4 max-h-[400px] overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-wrap" style={{ background: 'var(--bg)', color: 'var(--tx-2)' }}>
                {selectedOutput.map((line, i) => (
                  <div key={i} style={{
                    color: line.startsWith('[stderr]') ? 'var(--red)'
                      : line.startsWith('[system]') || line.startsWith('[batch]') ? 'var(--cyan)'
                      : 'var(--tx-2)'
                  }}>{line}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
