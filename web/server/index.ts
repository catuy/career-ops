import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
import {
  parseApplications, parsePipeline, listReports, readReport,
  readProfile, readPortals, listPDFs, computeMetrics, updateApplicationStatus
} from './services/parser.js'

const app = new Hono()

app.use('/api/*', cors())

// --- Dashboard metrics ---
app.get('/api/dashboard', (c) => {
  const apps = parseApplications()
  const metrics = computeMetrics(apps)
  const pipeline = parsePipeline()
  return c.json({
    metrics,
    pipelinePending: pipeline.pending.length,
    recentApps: apps.slice(-10).reverse()
  })
})

// --- Applications ---
app.get('/api/applications', (c) => {
  return c.json(parseApplications())
})

app.patch('/api/applications/:num', async (c) => {
  const num = parseInt(c.req.param('num'))
  const body = await c.req.json()
  updateApplicationStatus(num, body.status, body.notes)
  return c.json({ ok: true })
})

// --- Pipeline ---
app.get('/api/pipeline', (c) => {
  return c.json(parsePipeline())
})

// --- Reports ---
app.get('/api/reports', (c) => {
  return c.json(listReports())
})

app.get('/api/reports/:filename', (c) => {
  const content = readReport(c.req.param('filename'))
  if (!content) return c.json({ error: 'Not found' }, 404)
  return c.json({ content })
})

// --- Config ---
app.get('/api/config/profile', (c) => {
  return c.json(readProfile())
})

app.get('/api/config/portals', (c) => {
  return c.json(readPortals())
})

// --- PDFs ---
app.get('/api/pdfs', (c) => {
  return c.json(listPDFs())
})

// Serve PDF files
const ROOT = join(__dirname, '..', '..')
app.get('/files/output/:filename', (c) => {
  const filePath = join(ROOT, 'output', c.req.param('filename'))
  if (!existsSync(filePath)) return c.json({ error: 'Not found' }, 404)
  const buffer = readFileSync(filePath)
  return new Response(buffer, {
    headers: { 'Content-Type': 'application/pdf' }
  })
})

// --- Start ---
const port = 3001
console.log(`career-ops API → http://localhost:${port}`)
serve({ fetch: app.fetch, port })
