import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import YAML from 'yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..', '..')

function path(rel: string) { return join(ROOT, rel) }

// --- Portals ---

export function readPortalsRaw(): string {
  const p = path('portals.yml')
  return existsSync(p) ? readFileSync(p, 'utf-8') : ''
}

export function readPortals(): any {
  const content = readPortalsRaw()
  return content ? YAML.parse(content) : {}
}

export function writePortals(data: any): void {
  writeFileSync(path('portals.yml'), YAML.stringify(data, { lineWidth: 120 }))
}

export function toggleCompany(name: string, enabled: boolean): void {
  const portals = readPortals()
  const company = portals.tracked_companies?.find((c: any) => c.name === name)
  if (company) {
    company.enabled = enabled
    writePortals(portals)
  }
}

export function addCompany(company: { name: string; careers_url: string; notes?: string }): void {
  const portals = readPortals()
  if (!portals.tracked_companies) portals.tracked_companies = []
  portals.tracked_companies.push({ ...company, enabled: true })
  writePortals(portals)
}

export function removeCompany(name: string): void {
  const portals = readPortals()
  portals.tracked_companies = portals.tracked_companies?.filter((c: any) => c.name !== name) || []
  writePortals(portals)
}

export function updateTitleFilter(positive: string[], negative: string[]): void {
  const portals = readPortals()
  portals.title_filter = { ...portals.title_filter, positive, negative }
  writePortals(portals)
}

// --- Profile ---

export function readProfileRaw(): string {
  const p = path('config/profile.yml')
  return existsSync(p) ? readFileSync(p, 'utf-8') : ''
}

export function readProfile(): any {
  const content = readProfileRaw()
  return content ? YAML.parse(content) : {}
}

export function writeProfile(data: any): void {
  writeFileSync(path('config/profile.yml'), YAML.stringify(data, { lineWidth: 120 }))
}

// --- Pipeline ---

export function removeFromPipeline(urls: string[]): number {
  const p = path('data/pipeline.md')
  if (!existsSync(p)) return 0
  let content = readFileSync(p, 'utf-8')
  let removed = 0
  for (const url of urls) {
    const regex = new RegExp(`^- \\[ \\] [^\n]*${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\n]*\n?`, 'gm')
    const before = content
    content = content.replace(regex, '')
    if (content !== before) removed++
  }
  writeFileSync(p, content)
  return removed
}

export function addToPipeline(urls: string[]): number {
  const p = path('data/pipeline.md')
  let content = existsSync(p) ? readFileSync(p, 'utf-8') : '# Pipeline\n\n## Pendientes\n\n## Procesadas\n'

  const pendingIdx = content.indexOf('## Pendientes')
  const processedIdx = content.indexOf('## Procesadas')
  if (pendingIdx === -1) return 0

  const insertAt = processedIdx > pendingIdx ? processedIdx : content.length
  const newLines = urls.map(url => `- [ ] ${url}`).join('\n')

  content = content.slice(0, insertAt) + newLines + '\n\n' + content.slice(insertAt)
  writeFileSync(p, content)
  return urls.length
}
