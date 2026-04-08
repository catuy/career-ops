import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface LocationResult {
  url: string
  company: string
  role: string
  location: string
  remoteOk: 'YES' | 'NO' | 'MAYBE'
  reason: string
}

// Extract Greenhouse job ID and board from URL
function parseGreenhouseUrl(url: string): { board: string; jobId: string } | null {
  // https://job-boards.greenhouse.io/company/jobs/12345
  // https://boards.greenhouse.io/company/jobs/12345
  const m = url.match(/(?:job-boards|boards)\.greenhouse\.io\/(\w+)\/jobs\/(\d+)/)
  return m ? { board: m[1], jobId: m[2] } : null
}

async function checkGreenhouseJob(url: string): Promise<Partial<LocationResult>> {
  const parsed = parseGreenhouseUrl(url)
  if (!parsed) return { location: 'Unknown', remoteOk: 'MAYBE', reason: 'Could not parse URL' }

  try {
    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${parsed.board}/jobs/${parsed.jobId}`
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return { location: 'Closed/404', remoteOk: 'NO', reason: `API returned ${res.status}` }

    const data = await res.json() as any
    const loc = data.location?.name || ''
    const content = (data.content || '').toLowerCase()

    // Check location field
    const locLower = loc.toLowerCase()

    if (locLower.includes('worldwide') || locLower.includes('global') || locLower.includes('anywhere')) {
      return { location: loc, remoteOk: 'YES', reason: 'Global/worldwide' }
    }

    if (locLower.includes('latin america') || locLower.includes('latam') || locLower.includes('uruguay')) {
      return { location: loc, remoteOk: 'YES', reason: 'LATAM included' }
    }

    if (locLower.includes('americas') && !locLower.includes('north america')) {
      return { location: loc, remoteOk: 'MAYBE', reason: 'Americas — may include LATAM' }
    }

    // Check for restrictive locations
    const usOnly = /\b(united states|remote.*us\b|us only|u\.s\. only|remote - us|remote, us|new york|san francisco|sf|nyc|boston|seattle|austin|chicago|los angeles|denver)\b/i
    const euOnly = /\b(europe|eu only|uk only|london|berlin|amsterdam|paris|dublin|remote.*europe|remote.*eu)\b/i
    const canadaOnly = /\b(canada only|remote.*canada)\b/i

    if (usOnly.test(loc) || (usOnly.test(loc + ' ' + content.slice(0, 500)) && !content.includes('latin america') && !content.includes('latam'))) {
      // Check if content mentions broader eligibility
      if (content.includes('latin america') || content.includes('latam') || content.includes('uruguay') || content.includes('south america')) {
        return { location: loc, remoteOk: 'MAYBE', reason: 'US-listed but mentions LATAM in description' }
      }
      return { location: loc, remoteOk: 'NO', reason: 'US/Canada only' }
    }

    if (euOnly.test(loc)) {
      return { location: loc, remoteOk: 'NO', reason: 'Europe only' }
    }

    // Check content for remote policy
    if (content.includes('must be authorized to work in the united states') || content.includes('u.s. work authorization')) {
      return { location: loc || 'US', remoteOk: 'NO', reason: 'Requires US work authorization' }
    }

    if (content.includes('remote') && !usOnly.test(content.slice(0, 1000))) {
      return { location: loc || 'Remote', remoteOk: 'MAYBE', reason: 'Remote but region unclear' }
    }

    if (loc) {
      return { location: loc, remoteOk: 'MAYBE', reason: 'Location listed, remote policy unclear' }
    }

    return { location: 'Unknown', remoteOk: 'MAYBE', reason: 'No location data in API' }
  } catch (e: any) {
    return { location: 'Error', remoteOk: 'MAYBE', reason: e.message?.slice(0, 60) || 'Fetch failed' }
  }
}

async function checkGenericJob(url: string): Promise<Partial<LocationResult>> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; career-ops/1.0)' }
    })
    if (!res.ok) return { location: 'Closed/404', remoteOk: 'NO', reason: `HTTP ${res.status}` }

    const html = await res.text()
    const text = html.slice(0, 15000).toLowerCase()

    // Check for closed
    if (text.includes('no longer accepting') || text.includes('position has been filled') || text.includes('this job is no longer')) {
      return { location: 'Closed', remoteOk: 'NO', reason: 'Posting closed' }
    }

    // Look for location patterns
    if (text.includes('worldwide') || text.includes('work from anywhere') || text.includes('global remote')) {
      return { location: 'Remote (Global)', remoteOk: 'YES', reason: 'Global remote' }
    }

    if (text.includes('latin america') || text.includes('latam')) {
      return { location: 'Remote (LATAM)', remoteOk: 'YES', reason: 'LATAM included' }
    }

    const usPatterns = /remote[^.]{0,20}(united states|u\.s\.|within the us|us only|us-based)/i
    if (usPatterns.test(text)) {
      return { location: 'Remote (US only)', remoteOk: 'NO', reason: 'US only' }
    }

    if (text.includes('remote - europe') || text.includes('eu only') || text.includes('uk &amp; eu')) {
      return { location: 'Remote (EU)', remoteOk: 'NO', reason: 'EU only' }
    }

    if (text.includes('on-site') || text.includes('onsite') || text.includes('in-office')) {
      // Extract city if possible
      const cityMatch = html.match(/"location"[^}]*"(San Francisco|New York|London|Berlin|Austin|Seattle|Chicago|Boston|Toronto|Dublin)"/i)
      return { location: cityMatch ? `On-site (${cityMatch[1]})` : 'On-site', remoteOk: 'NO', reason: 'On-site required' }
    }

    if (text.includes('remote')) {
      return { location: 'Remote', remoteOk: 'MAYBE', reason: 'Remote mentioned, region unclear' }
    }

    return { location: 'Unknown', remoteOk: 'MAYBE', reason: 'Could not determine from page' }
  } catch (e: any) {
    // Ashby pages are SPAs — can't parse without browser
    if (url.includes('ashbyhq.com')) {
      return { location: 'Unknown (SPA)', remoteOk: 'MAYBE', reason: 'Ashby SPA — needs browser to check' }
    }
    return { location: 'Error', remoteOk: 'MAYBE', reason: e.message?.slice(0, 60) || 'Fetch failed' }
  }
}

export async function checkLocation(item: { url: string; company: string; role: string }): Promise<LocationResult> {
  const isGreenhouse = item.url.includes('greenhouse.io')
  const partial = isGreenhouse
    ? await checkGreenhouseJob(item.url)
    : await checkGenericJob(item.url)

  return {
    url: item.url,
    company: item.company,
    role: item.role,
    location: partial.location || 'Unknown',
    remoteOk: partial.remoteOk || 'MAYBE',
    reason: partial.reason || '',
  }
}

export async function checkAllLocations(
  items: { url: string; company: string; role: string }[],
  onProgress: (done: number, total: number, result: LocationResult) => void
): Promise<LocationResult[]> {
  const results: LocationResult[] = []

  // Process in batches of 5 for speed
  for (let i = 0; i < items.length; i += 5) {
    const batch = items.slice(i, i + 5)
    const batchResults = await Promise.all(batch.map(item => checkLocation(item)))
    results.push(...batchResults)
    batchResults.forEach(r => onProgress(results.length, items.length, r))
  }

  return results
}
