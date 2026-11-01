import { analytics } from './analytics.js'
import { clientAddress } from './clientAddress.js'

const TRANSPARENT_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64')
const rates = new Map()

function allowedOrigin(request) {
  const origin = request.headers.origin
  if (!origin) return false
  try { return new URL(origin).host === request.headers.host || origin === process.env.TRACKING_ALLOWED_ORIGIN }
  catch { return false }
}
function json(request, response, status, value) {
  const headers = { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', vary:'Origin' }
  if (allowedOrigin(request)) headers['access-control-allow-origin'] = request.headers.origin
  response.writeHead(status, headers)
  response.end(JSON.stringify(value))
}
async function body(request) {
  let raw = ''
  for await (const chunk of request) {
    raw += chunk.toString('utf8')
    if (raw.length > 20000) throw new Error('Requête trop volumineuse.')
  }
  return JSON.parse(raw)
}
function limited(request, max) {
  const key = `${clientAddress(request)}:${request.url?.split('?')[0]}`, now = Date.now()
  const record = rates.get(key)
  if (!record || now - record.start >= 60000) { rates.set(key, { start:now, count:1 }); return false }
  record.count++
  return record.count > max
}

export async function handleTracking(request, response, pathname) {
  if (pathname.startsWith('/api/tracking/pixel/')) {
    if (request.method !== 'GET') { response.writeHead(405); return response.end() }
    await analytics.trackOpen(pathname.slice('/api/tracking/pixel/'.length)).catch(() => {})
    response.writeHead(200, { 'content-type':'image/gif', 'content-length':String(TRANSPARENT_GIF.length), 'cache-control':'no-store, no-cache, must-revalidate, max-age=0', pragma:'no-cache', expires:'0', 'x-content-type-options':'nosniff' })
    return response.end(TRANSPARENT_GIF)
  }
  if (!['/api/tracking/register','/api/tracking/status'].includes(pathname)) return json(request, response, 404, { error:'Service introuvable.' })
  if (request.method === 'OPTIONS') {
    if (!allowedOrigin(request)) { response.writeHead(403); return response.end() }
    response.writeHead(204, { 'access-control-allow-origin':request.headers.origin, 'access-control-allow-methods':'POST', 'access-control-allow-headers':'content-type', vary:'Origin', 'access-control-max-age':'600' })
    return response.end()
  }
  if (request.method !== 'POST') return json(request, response, 405, { error:'Méthode non autorisée.' })
  if (!allowedOrigin(request)) return json(request, response, 403, { error:'Origine non autorisée.' })
  if (!request.headers['content-type']?.startsWith('application/json')) return json(request, response, 415, { error:'JSON requis.' })
  if (limited(request, pathname.endsWith('register') ? 10 : 30)) return json(request, response, 429, { error:'Trop de requêtes.' })
  try {
    const input = await body(request)
    if (pathname.endsWith('register')) return json(request, response, 200, { trackers:await analytics.registerTrackers(input.applications) })
    if (!Array.isArray(input.tokens) || input.tokens.length > 100) throw new Error('Liste des pixels invalide.')
    return json(request, response, 200, { trackers:await analytics.trackerStatuses(input.tokens) })
  } catch (error) { return json(request, response, 400, { error:error.message || 'Suivi indisponible.' }) }
}
