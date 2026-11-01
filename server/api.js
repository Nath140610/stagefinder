import { handleEmailSearch } from './emailCrawler.js'
import { paymentApi, paymentReturn, reconcilePayments } from './payment.js'
import { analyticsApi } from './analytics.js'
import { handleTracking } from './tracking.js'
import { clientAddress } from './clientAddress.js'

const clients = new Map()
let active = 0
function reject(response, status, error) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify({ error }))
}
export async function api(request, response, next) {
  const pathname = request.url?.split('?')[0]
  if (!pathname?.startsWith('/api/')) return next()
  if (pathname === '/api/payment/return') return paymentReturn(request, response)
  if (pathname === '/api/health') {
    response.writeHead(200, { 'content-type': 'application/json' })
    return response.end(JSON.stringify({ status: 'ok' }))
  }
  if (pathname === '/api/analytics/event' || pathname.startsWith('/api/admin/')) return analyticsApi(request, response, pathname, reconcilePayments)
  if (pathname.startsWith('/api/tracking/')) return handleTracking(request, response, pathname)
  if (pathname !== '/api/find-emails' && !pathname.startsWith('/api/payment/')) return reject(response, 404, 'Service introuvable')
  const origin = request.headers.origin
  if (origin) {
    try { if (new URL(origin).host !== request.headers.host) return reject(response, 403, 'Origine non autorisée') }
    catch { return reject(response, 403, 'Origine invalide') }
  }
  if (pathname.startsWith('/api/payment/')) return paymentApi(request, response, pathname)
  if (request.method !== 'POST') return reject(response, 405, 'Méthode non autorisée')
  if (!request.headers['content-type']?.startsWith('application/json')) return reject(response, 415, 'JSON requis')
  const now = Date.now(), address = clientAddress(request)
  for (const [key, entry] of clients) if (now - entry.start > 60000) clients.delete(key)
  const entry = clients.get(address) || { start: now, count: 0 }
  if (active >= 6 || entry.count >= 12) return reject(response, 429, 'Trop de recherches. Réessaie dans une minute.')
  entry.count++; clients.set(address, entry); active++
  try { await handleEmailSearch(request, response) }
  finally { active-- }
}
