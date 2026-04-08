import { useState, useEffect, useCallback } from 'react'
import { api, streamJob, type Job } from '../lib/api'

export function Evaluate() {
  const [input, setInput] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [activeStream, setActiveStream] = useState<string | null>(null)
  const [streamOutput, setStreamOutput] = useState<string[]>([])

  // Poll jobs on mount and every 5s
  const loadJobs = useCallback(() => { api.jobs().then(setJobs) }, [])
  useEffect(() => { loadJobs(); const i = setInterval(loadJobs, 5000); return () => clearInterval(i) }, [loadJobs])

  const hasRunning = jobs.some(j => j.status === 'running' || j.status === 'queued')

  const startStream = (jobId: string) => {
    setActiveStream(jobId)
    setStreamOutput([])
    streamJob(jobId,
      (line) => setStreamOutput(prev => [...prev, line]),
      () => { loadJobs() }
    )
  }

  const handleEvaluate = async () => {
    if (!input.trim() || hasRunning) return
    const { jobId } = await api.evaluate(input.trim())
    setInput('')
    loadJobs()
    startStream(jobId)
  }

  const handleScan = async () => {
    if (hasRunning) return
    const { jobId } = await api.scan()
    loadJobs()
    startStream(jobId)
  }

  // Auto-attach to a running job on page load
  useEffect(() => {
    const running = jobs.find(j => j.status === 'running')
    if (running && !activeStream) {
      startStream(running.id)
    }
  }, [jobs])

  return (
    <div className="space-y-6">
      <h1 style={{ color: 'var(--tx-h)' }} className="text-xl font-bold">Evaluate & Scan</h1>

      {/* Evaluate */}
      <div className="card p-5 space-y-4">
        <h2 style={{ color: 'var(--tx-h)' }} className="text-sm font-bold">Evaluate an Offer</h2>
        <p style={{ color: 'var(--tx-3)' }} className="text-xs">Paste a job URL or JD text. Runs full auto-pipeline: evaluation A-F → report → PDF → tracker.</p>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Paste a job URL or job description..."
          rows={4}
          className="input w-full resize-y"
          style={{ minHeight: '80px' }}
          disabled={hasRunning}
        />
        <button
          onClick={handleEvaluate}
          disabled={!input.trim() || hasRunning}
          className="px-4 py-2 rounded text-sm font-medium transition-colors"
          style={{
            background: hasRunning || !input.trim() ? 'var(--ui)' : 'var(--cyan)',
            color: hasRunning || !input.trim() ? 'var(--tx-3)' : '#fff',
            cursor: hasRunning || !input.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {hasRunning ? 'Job running...' : 'Evaluate'}
        </button>
      </div>

      {/* Scan */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 style={{ color: 'var(--tx-h)' }} className="text-sm font-bold">Scan Portals</h2>
            <p style={{ color: 'var(--tx-3)' }} className="text-xs mt-0.5">Search all configured portals for new offers.</p>
          </div>
          <button
            onClick={handleScan}
            disabled={hasRunning}
            className="px-4 py-2 rounded text-sm font-medium transition-colors"
            style={{
              background: hasRunning ? 'var(--ui)' : 'var(--blue)',
              color: hasRunning ? 'var(--tx-3)' : '#fff',
              cursor: hasRunning ? 'not-allowed' : 'pointer',
            }}
          >
            {hasRunning ? 'Job running...' : 'Run Scan'}
          </button>
        </div>
      </div>

      {/* Active stream output */}
      {activeStream && streamOutput.length > 0 && (
        <OutputConsole lines={streamOutput} status={jobs.find(j => j.id === activeStream)?.status || 'running'} />
      )}

      {/* Recent jobs */}
      {jobs.length > 0 && (
        <div className="space-y-2">
          <h2 style={{ color: 'var(--tx-h)' }} className="text-sm font-bold">Recent Jobs</h2>
          {jobs.slice(0, 10).map(j => (
            <div key={j.id} className="card px-4 py-3 flex items-center gap-3">
              <StatusDot status={j.status} />
              <div className="flex-1 min-w-0">
                <span style={{ color: 'var(--tx-h)' }} className="text-sm font-medium capitalize">{j.type}</span>
                <span style={{ color: 'var(--tx-3)' }} className="text-xs ml-2">
                  {j.finishedAt ? `${Math.round((j.finishedAt - j.startedAt) / 1000)}s` : `${Math.round((Date.now() - j.startedAt) / 1000)}s...`}
                </span>
                {j.output.length > 0 && (
                  <span style={{ color: 'var(--tx-3)' }} className="text-xs ml-2">{j.output.length} lines</span>
                )}
              </div>
              {j.status !== 'running' && j.output.length > 0 && (
                <button onClick={() => { setActiveStream(j.id); setStreamOutput(j.output) }}
                  style={{ color: 'var(--blue)' }} className="text-xs hover:underline">
                  View output
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'running' ? 'var(--yellow)' : status === 'done' ? 'var(--green)' : status === 'error' ? 'var(--red)' : 'var(--tx-3)'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="text-xs capitalize" style={{ color }}>{status}</span>
    </div>
  )
}

function OutputConsole({ lines, status }: { lines: string[]; status: string }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid var(--ui)' }}>
        <span style={{ color: 'var(--tx-h)' }} className="text-xs font-bold uppercase tracking-wider">Output</span>
        <StatusDot status={status} />
      </div>
      <div className="p-4 max-h-[500px] overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-wrap" style={{ background: 'var(--bg)', color: 'var(--tx-2)' }}>
        {lines.map((line, i) => (
          <div key={i} style={{
            color: line.startsWith('[stderr]') ? 'var(--red)'
              : line.startsWith('[system]') ? 'var(--cyan)'
              : 'var(--tx-2)'
          }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}
