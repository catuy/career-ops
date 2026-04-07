import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import YAML from 'yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..', '..')

function readFile(rel: string): string {
  const p = join(ROOT, rel)
  return existsSync(p) ? readFileSync(p, 'utf-8') : ''
}

// --- Applications ---

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

export function parseApplications(): Application[] {
  const content = readFile('data/applications.md')
  const lines = content.split('\n').filter(l => l.startsWith('|'))
  // skip header + separator
  return lines.slice(2).map(line => {
    const cols = line.split('|').map(c => c.trim()).filter(Boolean)
    if (cols.length < 8) return null
    const scoreMatch = cols[4]?.match(/([\d.]+)\/5/)
    const reportMatch = cols[7]?.match(/\[(\d+)\]\((.*?)\)/)
    return {
      num: parseInt(cols[0]) || 0,
      date: cols[1] || '',
      company: cols[2] || '',
      role: cols[3] || '',
      score: scoreMatch ? parseFloat(scoreMatch[1]) : null,
      status: cols[5] || '',
      hasPDF: cols[6]?.includes('✅') || false,
      reportNum: reportMatch?.[1] || null,
      reportPath: reportMatch?.[2] || null,
      notes: cols[8] || ''
    }
  }).filter(Boolean) as Application[]
}

// --- Pipeline ---

export interface PipelineItem {
  url: string
  company: string
  role: string
  status: 'pending' | 'processed' | 'error'
  reportInfo?: string
}

export function parsePipeline(): { pending: PipelineItem[], processed: PipelineItem[] } {
  const content = readFile('data/pipeline.md')
  const pending: PipelineItem[] = []
  const processed: PipelineItem[] = []

  let section: 'pending' | 'processed' = 'pending'
  for (const line of content.split('\n')) {
    if (/## Procesad/i.test(line)) { section = 'processed'; continue }
    if (/## Pendiente/i.test(line)) { section = 'pending'; continue }

    const checkMatch = line.match(/^- \[([ x!])\] (.+)/)
    if (!checkMatch) continue

    const marker = checkMatch[1]
    const rest = checkMatch[2]
    const parts = rest.split('|').map(s => s.trim())

    if (section === 'pending') {
      pending.push({
        url: parts[0] || rest,
        company: parts[1] || '',
        role: parts[2] || '',
        status: marker === '!' ? 'error' : 'pending'
      })
    } else {
      processed.push({
        url: parts[1] || rest,
        company: parts[2] || '',
        role: parts[3] || '',
        status: 'processed',
        reportInfo: parts[0]
      })
    }
  }
  return { pending, processed }
}

// --- Reports ---

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

export function listReports(): ReportSummary[] {
  const dir = join(ROOT, 'reports')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f: string) => f.endsWith('.md'))
    .sort().reverse()
    .map((filename: string) => {
      const match = filename.match(/^(\d+)-(.+)-(\d{4}-\d{2}-\d{2})\.md$/)
      if (!match) return null
      // Quick scan for metadata
      const content = readFileSync(join(dir, filename), 'utf-8').slice(0, 1000)
      const archetype = content.match(/\*\*Archetype?:\*\*\s*(.+)/)?.[1]?.trim()
      const score = content.match(/\*\*Score:\*\*\s*(.+)/)?.[1]?.trim()
      const url = content.match(/\*\*URL:\*\*\s*(.+)/)?.[1]?.trim()
      const title = content.match(/^# .+?—\s*(.+)/m)?.[1]?.trim() || match[2].replace(/-/g, ' ')
      return {
        filename,
        num: match[1],
        company: match[2].replace(/-/g, ' '),
        date: match[3],
        title,
        archetype, score, url
      }
    }).filter(Boolean) as ReportSummary[]
}

export function readReport(filename: string): string {
  const p = join(ROOT, 'reports', filename)
  return existsSync(p) ? readFileSync(p, 'utf-8') : ''
}

// --- Config ---

export function readProfile(): Record<string, any> {
  const content = readFile('config/profile.yml')
  return content ? YAML.parse(content) : {}
}

export function readPortals(): Record<string, any> {
  const content = readFile('portals.yml')
  return content ? YAML.parse(content) : {}
}

// --- PDFs ---

export interface PDFFile {
  filename: string
  company: string
  date: string
  size: number
}

export function listPDFs(): PDFFile[] {
  const dir = join(ROOT, 'output')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f: string) => f.endsWith('.pdf'))
    .map((filename: string) => {
      const stat = statSync(join(dir, filename))
      const match = filename.match(/cv-.*?-(.+?)-(\d{4}-\d{2}-\d{2})\.pdf/)
      return {
        filename,
        company: match?.[1]?.replace(/-/g, ' ') || filename,
        date: match?.[2] || '',
        size: stat.size
      }
    }).sort((a: PDFFile, b: PDFFile) => b.date.localeCompare(a.date))
}

// --- Metrics ---

export interface Metrics {
  total: number
  byStatus: Record<string, number>
  avgScore: number
  withPDF: number
  topScored: Application[]
}

export function computeMetrics(apps: Application[]): Metrics {
  const byStatus: Record<string, number> = {}
  let scoreSum = 0, scoreCount = 0, withPDF = 0

  for (const a of apps) {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1
    if (a.score !== null) { scoreSum += a.score; scoreCount++ }
    if (a.hasPDF) withPDF++
  }

  const topScored = [...apps]
    .filter(a => a.score !== null)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 5)

  return {
    total: apps.length,
    byStatus,
    avgScore: scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : 0,
    withPDF,
    topScored
  }
}

// --- Writer ---

export function updateApplicationStatus(num: number, status: string, notes?: string) {
  const filePath = join(ROOT, 'data', 'applications.md')
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  const updated = lines.map((line: string) => {
    if (!line.startsWith('|')) return line
    const cols = line.split('|').map((c: string) => c.trim()).filter(Boolean)
    if (parseInt(cols[0]) !== num) return line

    cols[5] = status
    if (notes !== undefined) cols[8] = notes

    return '| ' + cols.join(' | ') + ' |'
  })

  writeFileSync(filePath, updated.join('\n'))
}
