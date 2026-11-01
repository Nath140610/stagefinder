import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { clientAddress } from './clientAddress.js'
import { createSupabaseBackend, supabaseConfigured } from './database.js'

const SESSION_COOKIE = 'sf_admin'
const REF_COOKIE = 'sf_ref'
const ADMIN_LIFETIME = 12 * 60 * 60 * 1000
const ABANDON_DELAY = 30 * 60 * 1000
const adminSessions = new Map()
const loginAttempts = new Map()
const eventRates = new Map()

const empty = () => ({ visits:{}, flows:{}, links:{}, checkouts:{}, trackers:{} })
const cookie = (request, name) => (request.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) || ''
const secureCookie = request => request.socket.encrypted || request.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''
const sameOrigin = request => {
  try { return new URL(request.headers.origin).host === request.headers.host }
  catch { return false }
}
const json = (response, status, value) => {
  response.writeHead(status, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff' })
  response.end(JSON.stringify(value))
}
async function body(request) {
  let raw = ''
  for await (const chunk of request) {
    raw += chunk.toString('utf8')
    if (raw.length > 2048) throw new Error('Requête trop volumineuse.')
  }
  return JSON.parse(raw)
}
const validId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const validCode = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{8,24}$/.test(value)

function createFileBackend(path) {
  return {
    name:path,
    load:() => readFile(path, 'utf8').then(JSON.parse).catch(error => {
      if (error.code === 'ENOENT') return empty()
      throw error
    }),
    async save(data) {
      await mkdir(dirname(path), { recursive:true })
      const temporary = `${path}.${randomBytes(6).toString('hex')}.tmp`
      await writeFile(temporary, JSON.stringify(data), { mode:0o600 })
      await rename(temporary, path)
    }
  }
}

export function createAnalyticsStore(file, injectedBackend) {
  let loaded, activeBackend
  let saves = Promise.resolve()
  // An explicit file wins, so tests and local runs never write to the production database.
  const backend = () => activeBackend ||= injectedBackend || (!file && !process.env.ANALYTICS_DATA_FILE && supabaseConfigured() ? createSupabaseBackend() : createFileBackend(file || process.env.ANALYTICS_DATA_FILE || resolve(process.cwd(), 'data/analytics.json')))
  // A failed load is not kept: starting empty would overwrite real counters later.
  const state = () => loaded ||= backend().load().then(raw => ({ ...empty(), ...raw })).catch(error => {
    loaded = null
    throw error
  })
  const change = async fn => {
    const data = await state()
    const result = fn(data)
    saves = saves.catch(() => {}).then(() => backend().save(data))
    await saves
    return result
  }
  return {
    async ready() { await state(); return backend().name },
    async event(type, id, referral) {
      if (!validId(id) || !['visit','flow_started','form_completed','payment_viewed'].includes(type)) throw new Error('Événement invalide.')
      return change(data => {
        const now = Date.now(), flow = data.flows[id] ||= { firstSeen:now }
        if (type === 'visit') {
          data.visits[id] ||= now
          if (validCode(referral) && data.links[referral] && !flow.referrals?.includes(referral)) {
            flow.referrals ||= []
            flow.referrals.push(referral)
            data.links[referral].visits++
          }
        }
        if (type === 'flow_started') flow.startedAt ||= now
        if (type === 'form_completed') flow.completedAt ||= now
        if (type === 'payment_viewed') flow.paymentViewedAt ||= now
        return { ok:true }
      })
    },
    async createLink(label) {
      if (typeof label !== 'string' || label.trim().length < 2 || label.trim().length > 60) throw new Error('Donne un nom de 2 à 60 caractères au lien.')
      return change(data => {
        let code
        do { code = randomBytes(6).toString('base64url') } while (data.links[code])
        data.links[code] = { label:label.trim().replace(/\s+/g, ' '), visits:0, createdAt:Date.now() }
        return { code, ...data.links[code] }
      })
    },
    async link(code) { return (await state()).links[code] || null },
    async checkout(sessionId, amount, count, flowId, mode = 'test') {
      if (typeof sessionId !== 'string' || !/^cs_/.test(sessionId)) return
      return change(data => { data.checkouts[sessionId] ||= { amount, count, mode:mode === 'live' ? 'live' : 'test', flowId:validId(flowId) ? flowId : null, createdAt:Date.now() } })
    },
    async paid(sessionId, amount) {
      return change(data => {
        const checkout = data.checkouts[sessionId]
        if (!checkout || checkout.amount !== amount || checkout.paidAt) return
        checkout.paidAt = Date.now()
        if (checkout.flowId && data.flows[checkout.flowId]) data.flows[checkout.flowId].paidAt = checkout.paidAt
      })
    },
    async cancelled(sessionId) {
      return change(data => {
        const checkout = data.checkouts[sessionId]
        if (!checkout || checkout.paidAt) return
        checkout.cancelledAt ||= Date.now()
        if (checkout.flowId && data.flows[checkout.flowId]) data.flows[checkout.flowId].cancelledAt ||= checkout.cancelledAt
      })
    },
    async pendingCheckouts(limit = 10) {
      const data = await state(), now = Date.now()
      return Object.entries(data.checkouts).filter(([, item]) => !item.paidAt && !item.cancelledAt && (!item.checkedAt || now - item.checkedAt > 60000))
        .sort((a, b) => b[1].createdAt - a[1].createdAt).slice(0, limit)
        .map(([sessionId, item]) => ({ sessionId, amount:item.amount }))
    },
    async checked(sessionId) { return change(data => { if (data.checkouts[sessionId]) data.checkouts[sessionId].checkedAt = Date.now() }) },
    async registerTrackers(applications) {
      if (!Array.isArray(applications) || !applications.length || applications.length > 100 || applications.some(item => !/^[a-zA-Z0-9_-]{1,100}$/.test(item?.id || ''))) throw new Error('Liste des candidatures invalide.')
      if (new Set(applications.map(item => item.id)).size !== applications.length) throw new Error('Candidatures en double.')
      return change(data => applications.map(application => {
        let token
        do { token = randomBytes(24).toString('base64url') } while (data.trackers[token])
        data.trackers[token] = { createdAt:Date.now(), openedAt:null, opens:0 }
        return { applicationId:application.id, token }
      }))
    },
    async trackerStatuses(tokens) {
      const data = await state()
      return tokens.filter(token => typeof token === 'string' && /^[a-zA-Z0-9_-]{32}$/.test(token) && data.trackers[token])
        .map(token => ({ token, openedAt:data.trackers[token].openedAt, opens:data.trackers[token].opens }))
    },
    async trackOpen(token) {
      if (typeof token !== 'string' || !/^[a-zA-Z0-9_-]{32}$/.test(token)) return false
      return change(data => {
        const record = data.trackers[token]
        if (!record) return false
        record.opens++
        record.openedAt ||= new Date().toISOString()
        return true
      })
    },
    async stats() {
      const data = await state(), now = Date.now()
      const flows = Object.values(data.flows), checkouts = Object.values(data.checkouts)
      const paid = checkouts.filter(item => item.paidAt)
      const abandon = flow => flow.paymentViewedAt && !flow.paidAt && (flow.cancelledAt || now - flow.paymentViewedAt >= ABANDON_DELAY)
      const byDay = Array.from({ length:14 }, (_, index) => {
        const date = new Date(now - (13 - index) * 86400000).toISOString().slice(0, 10)
        return { date, visits:Object.values(data.visits).filter(time => new Date(time).toISOString().slice(0, 10) === date).length,
          forms:flows.filter(flow => flow.completedAt && new Date(flow.completedAt).toISOString().slice(0, 10) === date).length,
          payments:paid.filter(item => new Date(item.paidAt).toISOString().slice(0, 10) === date).length }
      })
      return { visits:Object.keys(data.visits).length, formsStarted:flows.filter(flow => flow.startedAt).length,
        formsCompleted:flows.filter(flow => flow.completedAt).length, paymentViewed:flows.filter(flow => flow.paymentViewedAt).length,
        abandonedAtPayment:flows.filter(abandon).length, pendingAtPayment:flows.filter(flow => flow.paymentViewedAt && !flow.paidAt && !abandon(flow)).length,
        checkouts:checkouts.length, payments:paid.length, revenueCents:paid.reduce((sum, item) => sum + item.amount, 0),
        livePayments:paid.filter(item => item.mode === 'live').length, liveRevenueCents:paid.filter(item => item.mode === 'live').reduce((sum, item) => sum + item.amount, 0),
        testPayments:paid.filter(item => item.mode !== 'live').length, testRevenueCents:paid.filter(item => item.mode !== 'live').reduce((sum, item) => sum + item.amount, 0),
        links:Object.entries(data.links).map(([code, link]) => ({ code, ...link })).sort((a, b) => b.createdAt - a.createdAt), byDay }
    }
  }
}

export const analytics = createAnalyticsStore()

function allowedRate(map, key, limit, windowMs) {
  const now = Date.now(), record = map.get(key)
  if (!record || now - record.start > windowMs) { map.set(key, { start:now, count:1 }); return true }
  record.count++
  return record.count <= limit
}
function adminAuthorized(request) {
  const token = cookie(request, SESSION_COOKIE)
  const expiry = adminSessions.get(token)
  if (!expiry) return false
  if (expiry < Date.now()) { adminSessions.delete(token); return false }
  return true
}
function validPassword(candidate) {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected || expected.length < 4 || typeof candidate !== 'string') return false
  const left = createHash('sha256').update(expected).digest(), right = createHash('sha256').update(candidate).digest()
  return timingSafeEqual(left, right)
}

export async function analyticsApi(request, response, pathname, reconcile = async () => {}) {
  if (pathname === '/api/analytics/event') {
    if (request.method !== 'POST') return json(response, 405, { error:'Méthode non autorisée.' })
    if (!sameOrigin(request)) return json(response, 403, { error:'Origine non autorisée.' })
    if (!allowedRate(eventRates, clientAddress(request), 30, 60000)) return json(response, 429, { error:'Trop de requêtes.' })
    try {
      const input = await body(request)
      const result = await analytics.event(input.type, input.id, cookie(request, REF_COOKIE))
      if (input.type === 'visit') response.setHeader('Set-Cookie', `${REF_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secureCookie(request)}`)
      return json(response, 200, result)
    } catch { return json(response, 400, { error:'Événement invalide.' }) }
  }
  if (!pathname.startsWith('/api/admin/')) return false
  if (pathname === '/api/admin/login') {
    if (request.method !== 'POST') return json(response, 405, { error:'Méthode non autorisée.' })
    if (!sameOrigin(request)) return json(response, 403, { error:'Origine non autorisée.' })
    if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 4) return json(response, 503, { error:'Mot de passe administrateur non configuré.' })
    const address = clientAddress(request)
    if (!allowedRate(loginAttempts, address, 5, 15 * 60000)) return json(response, 429, { error:'Trop de tentatives. Réessaie plus tard.' })
    try {
      const input = await body(request)
      if (!validPassword(input.password)) return json(response, 401, { error:'Mot de passe incorrect.' })
      loginAttempts.delete(address)
      const token = randomBytes(32).toString('base64url')
      adminSessions.set(token, Date.now() + ADMIN_LIFETIME)
      response.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${ADMIN_LIFETIME / 1000}${secureCookie(request)}`)
      return json(response, 200, { ok:true })
    } catch { return json(response, 400, { error:'Requête invalide.' }) }
  }
  if (!adminAuthorized(request)) return json(response, 401, { error:'Connexion administrateur requise.' })
  if (pathname === '/api/admin/logout' && request.method === 'POST') {
    if (!sameOrigin(request)) return json(response, 403, { error:'Origine non autorisée.' })
    adminSessions.delete(cookie(request, SESSION_COOKIE))
    response.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0${secureCookie(request)}`)
    return json(response, 200, { ok:true })
  }
  if (pathname === '/api/admin/stats' && request.method === 'GET') {
    await reconcile().catch(() => {})
    return json(response, 200, await analytics.stats())
  }
  if (pathname === '/api/admin/links' && request.method === 'POST') {
    if (!sameOrigin(request)) return json(response, 403, { error:'Origine non autorisée.' })
    try { return json(response, 201, await analytics.createLink((await body(request)).label)) }
    catch (error) { return json(response, 400, { error:error.message }) }
  }
  return json(response, 404, { error:'Service introuvable.' })
}

export async function referralRedirect(request, response, code) {
  if (request.method !== 'GET') { response.writeHead(405); return response.end() }
  if (!validCode(code) || !await analytics.link(code)) { response.writeHead(404); return response.end('Lien introuvable') }
  response.writeHead(302, { location:'/', 'set-cookie':`${REF_COOKIE}=${code}; Path=/; Max-Age=86400; SameSite=Lax${secureCookie(request)}`, 'cache-control':'no-store', 'referrer-policy':'no-referrer' })
  response.end()
}
