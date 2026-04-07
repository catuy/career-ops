const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

async function patch(path: string, body: Record<string, any>) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export interface Application {
  num: number
  date: string
  company: string
  role: string
  score: number | null
  status: string
  hasPDF: boolean
  reportNum: string | null
  reportPath: string | null
  notes: string
}

export interface Metrics {
  total: number
  byStatus: Record<string, number>
  avgScore: number
  withPDF: number
  topScored: Application[]
}

export interface DashboardData {
  metrics: Metrics
  pipelinePending: number
  recentApps: Application[]
}

export interface PipelineItem {
  url: string
  company: string
  role: string
  status: 'pending' | 'processed' | 'error'
  reportInfo?: string
}

export interface PipelineData {
  pending: PipelineItem[]
  processed: PipelineItem[]
}

export interface ReportSummary {
  filename: string
  num: string
  company: string
  date: string
  title: string
  archetype?: string
  score?: string
  url?: string
}

export interface PDFFile {
  filename: string
  company: string
  date: string
  size: number
}

export const api = {
  dashboard: () => get<DashboardData>('/dashboard'),
  applications: () => get<Application[]>('/applications'),
  updateApplication: (num: number, data: { status?: string; notes?: string }) =>
    patch(`/applications/${num}`, data),
  pipeline: () => get<PipelineData>('/pipeline'),
  reports: () => get<ReportSummary[]>('/reports'),
  report: (filename: string) => get<{ content: string }>(`/reports/${filename}`),
  pdfs: () => get<PDFFile[]>('/pdfs'),
}
