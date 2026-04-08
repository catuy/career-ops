import { spawn, type ChildProcess } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..', '..')

export type JobStatus = 'queued' | 'running' | 'done' | 'error'

export interface Job {
  id: string
  type: string
  status: JobStatus
  output: string[]
  result?: any
  error?: string
  startedAt: number
  finishedAt?: number
}

const jobs = new Map<string, Job>()
const listeners = new Map<string, Set<(line: string) => void>>()
let jobCounter = 0

export function createJob(type: string): Job {
  const id = `${Date.now()}-${++jobCounter}`
  const job: Job = { id, type, status: 'queued', output: [], startedAt: Date.now() }
  jobs.set(id, job)
  return job
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id)
}

export function listJobs(): Job[] {
  return [...jobs.values()].sort((a, b) => b.startedAt - a.startedAt).slice(0, 50)
}

export function subscribe(jobId: string, cb: (line: string) => void) {
  if (!listeners.has(jobId)) listeners.set(jobId, new Set())
  listeners.get(jobId)!.add(cb)
  return () => { listeners.get(jobId)?.delete(cb) }
}

function emit(jobId: string, line: string) {
  const job = jobs.get(jobId)
  if (job) job.output.push(line)
  listeners.get(jobId)?.forEach(cb => cb(line))
}

// Run a claude -p command with prompt via stdin
export function runClaude(jobId: string, prompt: string): void {
  const job = jobs.get(jobId)
  if (!job) return
  job.status = 'running'

  // Use --dangerously-skip-permissions so claude can write files
  const proc = spawn('claude', ['-p', '--dangerously-skip-permissions'], {
    cwd: ROOT,
    env: { ...process.env, FORCE_COLOR: '0' },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  // Write prompt to stdin and close it
  proc.stdin!.write(prompt)
  proc.stdin!.end()

  handleProcess(jobId, proc)
}

// Run a node script
export function runScript(jobId: string, script: string, args: string[] = []): void {
  const job = jobs.get(jobId)
  if (!job) return
  job.status = 'running'

  const proc = spawn('node', [script, ...args], {
    cwd: ROOT,
    env: { ...process.env, FORCE_COLOR: '0' },
  })

  handleProcess(jobId, proc)
}

// Run a batch of claude -p commands sequentially
export function runClaudeBatch(jobId: string, items: { url: string; label: string }[]): void {
  const job = jobs.get(jobId)
  if (!job) return
  job.status = 'running'
  job.result = { total: items.length, completed: 0, current: '' }

  const processNext = (index: number) => {
    if (index >= items.length) {
      job.status = 'done'
      job.finishedAt = Date.now()
      emit(jobId, `[system] done — ${items.length} evaluations completed`)
      return
    }

    const item = items[index]
    job.result = { total: items.length, completed: index, current: item.label }
    emit(jobId, `\n[batch] ━━━ ${index + 1}/${items.length}: ${item.label} ━━━`)

    const prompt = `You are career-ops. Run the full auto-pipeline for this offer:
1. Fetch the JD from this URL with WebFetch
2. Read cv.md and config/profile.yml for candidate data
3. Read modes/_shared.md for archetypes and framing
4. Execute evaluation blocks A-F with scoring (1-5 across 10 dimensions)
5. Save report to reports/ with next sequential number
6. Generate personalized PDF using templates/cv-template.html and node generate-pdf.mjs
7. Write tracker TSV to batch/tracker-additions/
8. Run: node merge-tracker.mjs

URL: ${item.url}

IMPORTANT: Execute ALL steps. Be concise in output — this is a batch run.`

    const proc = spawn('claude', ['-p', '--dangerously-skip-permissions'], {
      cwd: ROOT,
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    proc.stdin!.write(prompt)
    proc.stdin!.end()

    proc.stdout?.on('data', (data: Buffer) => {
      data.toString().split('\n').filter(Boolean).forEach(l => emit(jobId, l))
    })
    proc.stderr?.on('data', (data: Buffer) => {
      data.toString().split('\n').filter(Boolean).forEach(l => emit(jobId, `[stderr] ${l}`))
    })

    proc.on('close', (code) => {
      if (code === 0) {
        emit(jobId, `[batch] ✓ ${item.label} — done`)
      } else {
        emit(jobId, `[batch] ✗ ${item.label} — failed (exit ${code})`)
      }
      job.result = { ...job.result, completed: index + 1 }
      // Process next item
      processNext(index + 1)
    })

    proc.on('error', (err) => {
      emit(jobId, `[batch] ✗ ${item.label} — error: ${err.message}`)
      processNext(index + 1)
    })
  }

  processNext(0)
}

function handleProcess(jobId: string, proc: ChildProcess) {
  const job = jobs.get(jobId)!

  proc.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean)
    lines.forEach(l => emit(jobId, l))
  })

  proc.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean)
    lines.forEach(l => emit(jobId, `[stderr] ${l}`))
  })

  proc.on('close', (code) => {
    job.status = code === 0 ? 'done' : 'error'
    job.finishedAt = Date.now()
    if (code !== 0) job.error = `Process exited with code ${code}`
    emit(jobId, `[system] ${job.status} (exit ${code})`)
  })

  proc.on('error', (err) => {
    job.status = 'error'
    job.error = err.message
    job.finishedAt = Date.now()
    emit(jobId, `[system] error: ${err.message}`)
  })
}
