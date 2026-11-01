import { createHash } from 'node:crypto'
import { analytics } from './analytics.js'

export const amountCents = count => 200 + 50 * count
export const TERMS_VERSION = '2026-11-01'
const LIVE_KEY = /^(?:sk|rk)_live_/
// A test key in production would unlock real e-mail sending with a fake card.
const stripeKey = () => {
  const key = process.env.STRIPE_SECRET_KEY
  return !key || (process.env.RENDER === 'true' && !LIVE_KEY.test(key)) ? null : key
}
const paymentMode = () => LIVE_KEY.test(stripeKey() || '') ? 'live' : 'test'
const acceptedAll = consent => consent?.version === TERMS_VERSION && ['terms', 'risks', 'waiver', 'age'].every(name => consent[name] === true)
const digest = value => createHash('sha256').update(value).digest('hex')
const selection = ids => {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || ids.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id))) throw new Error('Sélection d’entreprises invalide.')
  const unique = [...new Set(ids)].sort()
  if (unique.length !== ids.length) throw new Error('Sélection d’entreprises en double.')
  return { count: unique.length, hash:digest(unique.join('\n')) }
}
async function body(request) {
  let size = 0, text = ''
  for await (const chunk of request) {
    size += chunk.length
    if (size > 16000) throw new Error('Requête trop volumineuse.')
    text += chunk.toString('utf8')
  }
  return JSON.parse(text)
}
function send(response, status, value) {
  response.writeHead(status, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' })
  response.end(JSON.stringify(value))
}
async function stripe(path, options = {}) {
  const key = stripeKey()
  if (!key) throw Object.assign(new Error('Stripe n’est pas encore configuré sur ce serveur.'), { status:503 })
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(`https://api.stripe.com/v1/${path}`, { ...options, signal:controller.signal, headers:{ authorization:`Bearer ${key}`, ...(options.body ? { 'content-type':'application/x-www-form-urlencoded' } : {}) } })
    const result = await response.json()
    if (!response.ok) throw Object.assign(new Error(result.error?.message || 'Stripe a refusé la demande.'), { status:response.status < 500 ? 400 : 502 })
    return result
  } finally { clearTimeout(timeout) }
}
const originFor = request => {
  const origin = request.headers.origin
  if (!origin || new URL(origin).host !== request.headers.host) throw new Error('Origine du paiement invalide.')
  return origin
}
export async function createCheckout({ ids, nonce, request, consent }) {
  const { count, hash } = selection(ids)
  if (typeof nonce !== 'string' || !/^[a-f0-9]{32,64}$/.test(nonce)) throw new Error('Session de paiement invalide.')
  const origin = originFor(request)
  if (!acceptedAll(consent)) throw new Error('Accepte les conditions avant de commander.')
  const params = new URLSearchParams({ mode:'payment', locale:'fr', 'allowed_payment_method_types[0]':'card', 'line_items[0][price_data][currency]':'eur', 'line_items[0][price_data][unit_amount]':'200', 'line_items[0][price_data][product_data][name]':'Préparation des candidatures', 'line_items[0][quantity]':'1', 'line_items[1][price_data][currency]':'eur', 'line_items[1][price_data][unit_amount]':'50', 'line_items[1][price_data][product_data][name]':'Entreprise sélectionnée', 'line_items[1][quantity]':String(count), 'metadata[count]':String(count), 'metadata[selection_hash]':hash, 'metadata[nonce_hash]':digest(nonce), 'metadata[terms_version]':TERMS_VERSION, 'metadata[withdrawal_waiver_at]':new Date().toISOString(), success_url:`${origin}/payment-return?session_id={CHECKOUT_SESSION_ID}`, cancel_url:`${origin}/payment-return?cancelled=1` })
  const session = await stripe('checkout/sessions', { method:'POST', body:params })
  if (!session.id || !session.url || !/^https:\/\/checkout\.stripe\.com\//.test(session.url)) throw Object.assign(new Error('Stripe n’a pas renvoyé de page de paiement valide.'), { status:502 })
  return { sessionId:session.id, url:session.url, count, amount:amountCents(count) }
}
export async function verifyCheckout({ sessionId, ids, nonce }) {
  const { count, hash } = selection(ids)
  if (typeof sessionId !== 'string' || !/^cs_(?:test_|live_)?[a-zA-Z0-9]{10,100}$/.test(sessionId) || typeof nonce !== 'string' || !/^[a-f0-9]{32,64}$/.test(nonce)) throw new Error('Session de paiement invalide.')
  const session = await stripe(`checkout/sessions/${encodeURIComponent(sessionId)}`)
  const belongsToDraft = session.metadata?.selection_hash === hash && session.metadata?.nonce_hash === digest(nonce) && session.metadata?.count === String(count)
  const paid = belongsToDraft && session.mode === 'payment' && session.payment_status === 'paid' && session.status === 'complete' && session.currency === 'eur' && session.amount_total === amountCents(count)
  return { paid:Boolean(paid), status:belongsToDraft ? session.payment_status : 'mismatch', sessionStatus:belongsToDraft ? session.status : 'mismatch', amount:amountCents(count), count }
}
export async function cancelCheckout(data) {
  const check = await verifyCheckout(data)
  if (check.status === 'mismatch') throw new Error('Ce paiement ne correspond pas à ta sélection.')
  if (check.paid) throw new Error('Le paiement est déjà confirmé. Continue avec Google.')
  if (check.sessionStatus !== 'open') return { cancelled:true }
  await stripe(`checkout/sessions/${encodeURIComponent(data.sessionId)}/expire`, { method:'POST' })
  return { cancelled:true }
}
export async function reconcilePayments() {
  if (!stripeKey()) return
  const pending = await analytics.pendingCheckouts(10)
  let next = 0
  await Promise.all(Array.from({ length:Math.min(3, pending.length) }, async () => {
    while (next < pending.length) {
      const { sessionId, amount } = pending[next++]
      try {
        const session = await stripe(`checkout/sessions/${encodeURIComponent(sessionId)}`)
        if (session.status === 'complete' && session.payment_status === 'paid' && session.currency === 'eur' && session.amount_total === amount) await analytics.paid(sessionId, amount)
        else if (session.status === 'expired') await analytics.cancelled(sessionId)
      } catch { /* A temporary Stripe error must not hide the dashboard. */ }
      await analytics.checked(sessionId).catch(() => {})
    }
  }))
}
export async function paymentApi(request, response, pathname) {
  if (pathname === '/api/payment/config' && request.method === 'GET') return send(response, 200, { configured:Boolean(stripeKey()), mode:paymentMode(), termsVersion:TERMS_VERSION })
  if (!['/api/payment/checkout','/api/payment/verify','/api/payment/cancel'].includes(pathname)) return send(response, 404, { error:'Service introuvable.' })
  if (request.method !== 'POST') return send(response, 405, { error:'Méthode non autorisée.' })
  if (!request.headers['content-type']?.startsWith('application/json')) return send(response, 415, { error:'JSON requis.' })
  try {
    const data = await body(request)
    const value = pathname.endsWith('checkout') ? await createCheckout({ ...data, request }) : pathname.endsWith('cancel') ? await cancelCheckout(data) : await verifyCheckout(data)
    if (pathname.endsWith('checkout')) await analytics.checkout(value.sessionId, value.amount, value.count, data.flowId, paymentMode()).catch(() => {})
    if (pathname.endsWith('verify') && value.paid) await analytics.paid(data.sessionId, value.amount).catch(() => {})
    if (pathname.endsWith('cancel') && value.cancelled) await analytics.cancelled(data.sessionId).catch(() => {})
    return send(response, 200, value)
  } catch (error) { return send(response, error.status || 400, { error:error.message || 'Paiement indisponible.' }) }
}

export function paymentReturn(request, response) {
  const url = new URL(request.url, 'http://localhost')
  const cancelled = url.searchParams.has('cancelled')
  response.writeHead(200, { 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store', 'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'" })
  response.end(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Retour Stripe · Stage Finder</title><body style="font:18px system-ui;max-width:500px;margin:15vh auto;padding:24px;color:#193529"><h1>${cancelled ? 'Paiement annulé' : 'Retour du paiement'}</h1><p>${cancelled ? 'Aucun accès n’a été débloqué.' : 'Reviens à l’onglet Stage Finder : le paiement y est vérifié directement auprès de Stripe avant la connexion Google.'}</p><p>Tu peux fermer cet onglet.</p></body></html>`)
}
