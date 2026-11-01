import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { amountCents, createCheckout, verifyCheckout, cancelCheckout, TERMS_VERSION } from '../server/payment.js'
import { initial, reducer, STEPS, selectionKey } from '../src/state/flow.js'

const originalKey = process.env.STRIPE_SECRET_KEY, originalFetch = globalThis.fetch
const request = { headers:{ origin:'http://localhost:3000', host:'localhost:3000' } }
const ids = ['siret-12300001', 'osm-node-2', 'siret-12300003'], nonce = 'a'.repeat(48)
const consent = { terms:true, risks:true, waiver:true, age:true, version:TERMS_VERSION }
afterEach(() => {
  if (originalKey == null) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = originalKey
  globalThis.fetch = originalFetch
})
test('the server calculates 2 € + 0.50 € per company in cents', () => {
  assert.equal(amountCents(1), 250); assert.equal(amountCents(3), 350); assert.equal(amountCents(10), 700)
})
test('checkout price comes from validated IDs, not a client supplied amount', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
  let params
  globalThis.fetch = async (_url, options) => {
    params = new URLSearchParams(options.body)
    return { ok:true, json:async () => ({ id:'cs_test_123456789012345', url:'https://checkout.stripe.com/c/pay/test' }) }
  }
  const result = await createCheckout({ request, ids, nonce, consent, amount:1 })
  assert.equal(result.amount, 350)
  assert.equal(params.get('metadata[terms_version]'), TERMS_VERSION)
  assert.ok(params.get('metadata[withdrawal_waiver_at]'))
  assert.equal(params.get('line_items[0][price_data][unit_amount]'), '200')
  assert.equal(params.get('line_items[1][price_data][unit_amount]'), '50')
  assert.equal(params.get('line_items[1][quantity]'), '3')
  assert.equal(params.get('allowed_payment_method_types[0]'), 'card')
  assert.equal(params.get('payment_method_types[0]'), null)
  assert.equal(params.get('metadata[count]'), '3')
  assert.equal(params.get('success_url'), 'http://localhost:3000/payment-return?session_id={CHECKOUT_SESSION_ID}')
  assert.ok(!String(params).includes('sk_test_fake'))
})
test('no checkout without every consent for the current terms', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
  let called = false
  globalThis.fetch = async () => { called = true; return { ok:true, json:async () => ({}) } }
  for (const missing of [undefined, { ...consent, waiver:false }, { ...consent, risks:undefined }, { ...consent, age:'true' }, { ...consent, version:'ancienne' }]) await assert.rejects(createCheckout({ request, ids, nonce, consent:missing }), /Accepte les conditions/)
  assert.equal(called, false)
})
test('a real payment session is accepted and confirmed', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_live_fake'
  let params
  globalThis.fetch = async (_url, options) => { params = new URLSearchParams(options.body); return { ok:true, json:async () => ({ id:'cs_live_a1B2c3D4e5F6g7H8', url:'https://checkout.stripe.com/c/pay/live' }) } }
  await createCheckout({ request, ids, nonce, consent })
  globalThis.fetch = async () => ({ ok:true, json:async () => ({ mode:'payment', payment_status:'paid', status:'complete', currency:'eur', amount_total:350, metadata:Object.fromEntries([...params].filter(([key]) => key.startsWith('metadata[')).map(([key, value]) => [key.slice(9, -1), value])) }) })
  assert.equal((await verifyCheckout({ sessionId:'cs_live_a1B2c3D4e5F6g7H8', ids, nonce })).paid, true)
})
test('production refuses a test key, so a fake card cannot unlock real sending', async () => {
  const previous = process.env.RENDER
  process.env.RENDER = 'true'
  try {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
    await assert.rejects(createCheckout({ request, ids, nonce, consent }), /pas encore configuré/)
    process.env.STRIPE_SECRET_KEY = 'sk_live_fake'
    globalThis.fetch = async () => ({ ok:true, json:async () => ({ id:'cs_live_a1B2c3D4e5F6g7H8', url:'https://checkout.stripe.com/c/pay/live' }) })
    assert.equal((await createCheckout({ request, ids, nonce, consent })).sessionId, 'cs_live_a1B2c3D4e5F6g7H8')
  } finally { if (previous === undefined) delete process.env.RENDER; else process.env.RENDER = previous }
})
test('Stripe checkout rejects duplicate selections and mismatched origins', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
  await assert.rejects(createCheckout({ request, ids:[ids[0],ids[0]], nonce }), /double/)
  await assert.rejects(createCheckout({ request:{ headers:{ origin:'https://evil.example', host:'localhost:3000' } }, ids, nonce }), /Origine/)
})
test('no Stripe key cannot create a fake paid session', async () => {
  delete process.env.STRIPE_SECRET_KEY
  await assert.rejects(createCheckout({ request, ids, nonce, consent }), /pas encore configuré/)
})
test('verification requires paid status, matching amount, currency, selection and nonce', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
  let params
  globalThis.fetch = async (_url, options) => { params = new URLSearchParams(options.body); return { ok:true, json:async () => ({ id:'cs_test_123456789012345', url:'https://checkout.stripe.com/c/pay/test' }) } }
  await createCheckout({ request, ids, nonce, consent })
  const session = { metadata:{ count:'3', selection_hash:params.get('metadata[selection_hash]'), nonce_hash:params.get('metadata[nonce_hash]') }, mode:'payment', payment_status:'paid', status:'complete', currency:'eur', amount_total:350 }
  globalThis.fetch = async () => ({ ok:true, json:async () => session })
  const verify = values => verifyCheckout({ sessionId:'cs_test_123456789012345', ids, nonce, ...values })
  assert.equal((await verify()).paid, true)
  assert.equal((await verify({ nonce:'b'.repeat(48) })).paid, false)
  assert.equal((await verify({ ids:ids.slice(0,2) })).paid, false)
  for (const change of [{ amount_total:300 }, { currency:'usd' }, { payment_status:'unpaid' }, { status:'open' }]) {
    Object.assign(session, change)
    assert.equal((await verify()).paid, false)
    Object.assign(session, { amount_total:350, currency:'eur', payment_status:'paid', status:'complete' })
  }
})
test('cancelling a pending checkout expires it at Stripe before unlocking edits', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
  let params, expired = 0
  globalThis.fetch = async (_url, options) => { params = new URLSearchParams(options.body); return { ok:true, json:async () => ({ id:'cs_test_123456789012345', url:'https://checkout.stripe.com/c/pay/test' }) } }
  await createCheckout({ request, ids, nonce, consent })
  const session = { metadata:{ count:'3', selection_hash:params.get('metadata[selection_hash]'), nonce_hash:params.get('metadata[nonce_hash]') }, mode:'payment', payment_status:'unpaid', status:'open', currency:'eur', amount_total:350 }
  globalThis.fetch = async (url) => { if (String(url).endsWith('/expire')) { expired++; return { ok:true, json:async () => ({ status:'expired' }) } } return { ok:true, json:async () => session } }
  assert.deepEqual(await cancelCheckout({ sessionId:'cs_test_123456789012345', ids, nonce }), { cancelled:true })
  assert.equal(expired, 1)
  session.payment_status = 'paid'; session.status = 'complete'
  await assert.rejects(cancelCheckout({ sessionId:'cs_test_123456789012345', ids, nonce }), /déjà confirmé/)
  assert.equal(expired, 1)
})
test('Google step cannot be reached without a verified payment for the same selection', () => {
  const paymentStep = STEPS.indexOf('payment'), emailStep = STEPS.indexOf('email')
  const state = { ...initial, view:'flow', step:paymentStep, selected:ids }
  assert.equal(reducer(state, { type:'next' }).step, paymentStep)
  const paid = { ...state, payment:{ status:'paid', selectionKey:selectionKey(ids) } }
  assert.equal(reducer(paid, { type:'next' }).step, emailStep)
  assert.equal(reducer(paid, { type:'toggle', id:ids[0] }).payment, null)
})
