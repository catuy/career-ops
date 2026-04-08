import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'
import { streamSSE } from 'hono/streaming'
import {
  parseApplications, parsePipeline, listReports, readReport,
  listPDFs, computeMetrics, updateApplicationStatus
} from './services/parser.js'
import {
  createJob, getJob, listJobs, subscribe, runClaude, runClaudeBatch, runScript
} from './services/jobs.js'
import {
  readPortals, writePortals, toggleCompany, addCompany, removeCompany,
  updateTitleFilter, readProfile, writeProfile, addToPipeline, removeFromPipeline, readPortalsRaw, readProfileRaw
} from './services/config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')

const app = new Hono()
app.use('/api/*', cors())

// ============================================
// Dashboard
// ============================================

app.get('/api/dashboard', (c) => {
  const apps = parseApplications()
  const metrics = computeMetrics(apps)
  const pipeline = parsePipeline()
  return c.json({ metrics, pipelinePending: pipeline.pending.length, recentApps: apps.slice(-10).reverse() })
})

// ============================================
// Applications
// ============================================

app.get('/api/applications', (c) => c.json(parseApplications()))

app.patch('/api/applications/:num', async (c) => {
  const num = parseInt(c.req.param('num'))
  const body = await c.req.json()
  updateApplicationStatus(num, body.status, body.notes)
  return c.json({ ok: true })
})

// ============================================
// Pipeline
// ============================================

app.get('/api/pipeline', (c) => c.json(parsePipeline()))

app.post('/api/pipeline/add', async (c) => {
  const { urls } = await c.req.json()
  const count = addToPipeline(urls)
  return c.json({ added: count })
})

app.post('/api/pipeline/remove', async (c) => {
  const { urls } = await c.req.json()
  const count = removeFromPipeline(urls)
  return c.json({ removed: count })
})

// ============================================
// Reports
// ============================================

app.get('/api/reports', (c) => c.json(listReports()))
app.get('/api/reports/:filename', (c) => {
  const content = readReport(c.req.param('filename'))
  if (!content) return c.json({ error: 'Not found' }, 404)
  return c.json({ content })
})

// ============================================
// Config — Portals
// ============================================

app.get('/api/config/portals', (c) => c.json(readPortals()))
app.get('/api/config/portals/raw', (c) => c.text(readPortalsRaw()))

app.put('/api/config/portals', async (c) => {
  const data = await c.req.json()
  writePortals(data)
  return c.json({ ok: true })
})

app.post('/api/config/portals/company', async (c) => {
  const company = await c.req.json()
  addCompany(company)
  return c.json({ ok: true })
})

app.delete('/api/config/portals/company/:name', (c) => {
  removeCompany(c.req.param('name'))
  return c.json({ ok: true })
})

app.patch('/api/config/portals/company/:name/toggle', async (c) => {
  const { enabled } = await c.req.json()
  toggleCompany(c.req.param('name'), enabled)
  return c.json({ ok: true })
})

app.put('/api/config/portals/filters', async (c) => {
  const { positive, negative } = await c.req.json()
  updateTitleFilter(positive, negative)
  return c.json({ ok: true })
})

// ============================================
// Config — Profile
// ============================================

app.get('/api/config/profile', (c) => c.json(readProfile()))
app.get('/api/config/profile/raw', (c) => c.text(readProfileRaw()))

app.put('/api/config/profile', async (c) => {
  const data = await c.req.json()
  writeProfile(data)
  return c.json({ ok: true })
})

// ============================================
// PDFs
// ============================================

app.get('/api/pdfs', (c) => c.json(listPDFs()))

app.get('/files/output/:filename', (c) => {
  const filePath = join(ROOT, 'output', c.req.param('filename'))
  if (!existsSync(filePath)) return c.json({ error: 'Not found' }, 404)
  const buffer = readFileSync(filePath)
  return new Response(buffer, { headers: { 'Content-Type': 'application/pdf' } })
})

// ============================================
// Jobs — AI operations
// ============================================

app.get('/api/jobs', (c) => c.json(listJobs()))
app.get('/api/jobs/:id', (c) => {
  const job = getJob(c.req.param('id'))
  if (!job) return c.json({ error: 'Not found' }, 404)
  return c.json(job)
})

// SSE stream for job output
app.get('/api/jobs/:id/stream', (c) => {
  const job = getJob(c.req.param('id'))
  if (!job) return c.json({ error: 'Not found' }, 404)

  return streamSSE(c, async (stream) => {
    // Send existing output
    for (const line of job.output) {
      await stream.writeSSE({ data: line })
    }

    if (job.status === 'done' || job.status === 'error') {
      await stream.writeSSE({ data: `[done] ${job.status}`, event: 'done' })
      return
    }

    // Subscribe to new output
    await new Promise<void>((resolve) => {
      const unsub = subscribe(job.id, async (line) => {
        await stream.writeSSE({ data: line })
        if (line.startsWith('[system]')) {
          unsub()
          await stream.writeSSE({ data: `[done] ${job.status}`, event: 'done' })
          resolve()
        }
      })
    })
  })
})

// --- Evaluate offer ---
app.post('/api/evaluate', async (c) => {
  const { input } = await c.req.json()  // URL or JD text
  const job = createJob('evaluate')

  const prompt = `You are career-ops. The user wants to evaluate this offer. Run the full auto-pipeline mode:
1. If this is a URL, fetch the JD with WebFetch
2. Read cv.md and config/profile.yml
3. Read modes/_shared.md for archetypes and framing
4. Read modes/oferta.md for evaluation blocks A-F
5. Execute the full evaluation (blocks A-F with scoring)
6. Save the report to reports/ with the next sequential number
7. Generate a personalized PDF using templates/cv-template.html and generate-pdf.mjs
8. Write tracker TSV to batch/tracker-additions/
9. Run: node merge-tracker.mjs

Input: ${input}

IMPORTANT: Execute ALL steps. Generate the report, PDF, and tracker entry.`

  runClaude(job.id, prompt)
  return c.json({ jobId: job.id })
})

// --- Scan portals ---
app.post('/api/scan', async (c) => {
  const job = createJob('scan')

  const prompt = `You are career-ops scan mode. Read portals.yml and execute a full portal scan:
1. Read portals.yml for tracked_companies and search_queries
2. Read data/scan-history.tsv, data/applications.md, data/pipeline.md for dedup
3. For each tracked company with a Greenhouse API URL, use WebFetch to get job listings
4. Run all enabled search_queries with WebSearch
5. Filter results by title_filter (positive/negative keywords)
6. Deduplicate against scan-history and existing pipeline/applications
7. Add new offers to data/pipeline.md under "## Pendientes"
8. Update data/scan-history.tsv with all URLs seen
9. Print a summary of findings

Execute ALL levels: Greenhouse API + WebSearch. Be thorough.`

  runClaude(job.id, prompt)
  return c.json({ jobId: job.id })
})

// --- Quick location check (direct HTTP, no Claude, zero tokens) ---
app.post('/api/pipeline/check', async (c) => {
  const { checkAllLocations } = await import('./services/location-check.js')
  const pipeline = parsePipeline()
  const items = pipeline.pending.map(p => ({ url: p.url, company: p.company, role: p.role }))

  // Run checks and return results
  const results = await checkAllLocations(items, () => {})
  return c.json(results)
})

// Auto-discard NO items from pipeline
app.post('/api/pipeline/auto-clean', async (c) => {
  const { checkAllLocations } = await import('./services/location-check.js')
  const pipeline = parsePipeline()
  const items = pipeline.pending.map(p => ({ url: p.url, company: p.company, role: p.role }))

  const results = await checkAllLocations(items, () => {})
  const toRemove = results.filter(r => r.remoteOk === 'NO').map(r => r.url)

  if (toRemove.length > 0) {
    removeFromPipeline(toRemove)
  }

  return c.json({
    total: results.length,
    removed: toRemove.length,
    remaining: results.length - toRemove.length,
    kept: results.filter(r => r.remoteOk !== 'NO').map(r => ({
      company: r.company, role: r.role, location: r.location, remoteOk: r.remoteOk, reason: r.reason
    })),
    discarded: results.filter(r => r.remoteOk === 'NO').map(r => ({
      company: r.company, role: r.role, location: r.location, reason: r.reason
    }))
  })
})

// --- Batch evaluate ---
app.post('/api/evaluate/batch', async (c) => {
  const { urls } = await c.req.json() // [{ url, company, role }]
  const job = createJob('batch-evaluate')
  const items = urls.map((u: any) => ({
    url: u.url,
    label: `${u.company || 'Unknown'} — ${u.role || u.url.slice(0, 50)}`
  }))
  runClaudeBatch(job.id, items)
  return c.json({ jobId: job.id })
})

// --- Utility scripts ---
app.post('/api/tools/verify', (c) => {
  const job = createJob('verify')
  runScript(job.id, 'verify-pipeline.mjs')
  return c.json({ jobId: job.id })
})

app.post('/api/tools/normalize', (c) => {
  const job = createJob('normalize')
  runScript(job.id, 'normalize-statuses.mjs')
  return c.json({ jobId: job.id })
})

app.post('/api/tools/dedup', (c) => {
  const job = createJob('dedup')
  runScript(job.id, 'dedup-tracker.mjs')
  return c.json({ jobId: job.id })
})

app.post('/api/tools/merge', (c) => {
  const job = createJob('merge')
  runScript(job.id, 'merge-tracker.mjs')
  return c.json({ jobId: job.id })
})

app.post('/api/tools/sync-check', (c) => {
  const job = createJob('sync-check')
  runScript(job.id, 'cv-sync-check.mjs')
  return c.json({ jobId: job.id })
})

// ============================================
// Start
// ============================================

const port = 3001
console.log(`career-ops API → http://localhost:${port}`)
serve({ fetch: app.fetch, port })
