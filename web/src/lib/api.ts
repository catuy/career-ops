const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

async function post<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

async function put(path: string, body: any) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

async function patch(path: string, body: any) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

async function del(path: string) {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

// Types

export interface Application {
  num: number; date: string; company: string; role: string
  score: number | null; status: string; hasPDF: boolean
  reportNum: string | null; reportPath: string | null; notes: string
}

export interface Metrics {
  total: number; byStatus: Record<string, number>; avgScore: number
  withPDF: number; topScored: Application[]
}

export interface DashboardData {
  metrics: Metrics; pipelinePending: number; recentApps: Application[]
}

export interface PipelineItem {
  url: string; company: string; role: string
  status: 'pending' | 'processed' | 'error'; reportInfo?: string
}

export interface PipelineData { pending: PipelineItem[]; processed: PipelineItem[] }

export interface ReportSummary {
  filename: string; num: string; company: string; date: string
  title: string; archetype?: string; score?: string; url?: string
}

export interface PDFFile { filename: string; company: string; date: string; size: number }

export interface Job {
  id: string; type: string; status: 'queued' | 'running' | 'done' | 'error'
  output: string[]; error?: string; startedAt: number; finishedAt?: number
}

export interface TrackedCompany {
  name: string; careers_url: string; api?: string
  notes?: string; enabled: boolean
}

export interface PortalsConfig {
  title_filter: { positive: string[]; negative: string[]; seniority_boost?: string[] }
  search_queries: any[]
  tracked_companies: TrackedCompany[]
}

// API

export const api = {
  // Dashboard
  dashboard: () => get<DashboardData>('/dashboard'),

  // Applications
  applications: () => get<Application[]>('/applications'),
  updateApplication: (num: number, data: { status?: string; notes?: string }) => patch(`/applications/${num}`, data),

  // Pipeline
  pipeline: () => get<PipelineData>('/pipeline'),
  addToPipeline: (urls: string[]) => post<{ added: number }>('/pipeline/add', { urls }),
  removeFromPipeline: (urls: string[]) => post<{ removed: number }>('/pipeline/remove', { urls }),

  // Reports & PDFs
  reports: () => get<ReportSummary[]>('/reports'),
  report: (filename: string) => get<{ content: string }>(`/reports/${filename}`),
  pdfs: () => get<PDFFile[]>('/pdfs'),

  // Config
  portals: () => get<PortalsConfig>('/config/portals'),
  savePortals: (data: PortalsConfig) => put('/config/portals', data),
  addCompany: (company: { name: string; careers_url: string; notes?: string }) => post('/config/portals/company', company),
  removeCompany: (name: string) => del(`/config/portals/company/${name}`),
  toggleCompany: (name: string, enabled: boolean) => patch(`/config/portals/company/${name}/toggle`, { enabled }),
  updateFilters: (positive: string[], negative: string[]) => put('/config/portals/filters', { positive, negative }),
  profile: () => get<any>('/config/profile'),
  saveProfile: (data: any) => put('/config/profile', data),

  // Jobs (AI operations)
  jobs: () => get<Job[]>('/jobs'),
  job: (id: string) => get<Job>(`/jobs/${id}`),
  evaluate: (input: string) => post<{ jobId: string }>('/evaluate', { input }),
  evaluateBatch: (urls: { url: string; company: string; role: string }[]) => post<{ jobId: string }>('/evaluate/batch', { urls }),
  scan: () => post<{ jobId: string }>('/scan'),

  // Tools
  verify: () => post<{ jobId: string }>('/tools/verify'),
  normalize: () => post<{ jobId: string }>('/tools/normalize'),
  dedup: () => post<{ jobId: string }>('/tools/dedup'),
  merge: () => post<{ jobId: string }>('/tools/merge'),
  syncCheck: () => post<{ jobId: string }>('/tools/sync-check'),
}

// SSE stream helper
export function streamJob(jobId: string, onLine: (line: string) => void, onDone: () => void): () => void {
  const evtSource = new EventSource(`${BASE}/jobs/${jobId}/stream`)
  evtSource.onmessage = (e) => onLine(e.data)
  evtSource.addEventListener('done', () => { evtSource.close(); onDone() })
  evtSource.onerror = () => { evtSource.close(); onDone() }
  return () => evtSource.close()
}
