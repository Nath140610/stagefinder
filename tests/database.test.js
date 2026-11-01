import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createAnalyticsStore } from '../server/analytics.js'
import { createSupabaseBackend } from '../server/database.js'
import { clientAddress } from '../server/clientAddress.js'

// A minimal stand-in for Supabase's REST API, with its 1000-row response cap.
function fakeSupabase() {
  const tables = {}, calls = []
  let failWrites = false
  const handler = async (url, options = {}) => {
    const parsed = new URL(url), table = parsed.pathname.split('/').pop()
    calls.push({ method:options.method || 'GET', table, headers:options.headers, body:options.body })
    if (options.method === 'POST') {
      if (failWrites) return new Response('indisponible', { status:503 })
      const key = parsed.searchParams.get('on_conflict'), rows = tables[table] ||= new Map()
      for (const row of JSON.parse(options.body)) rows.set(row[key], row)
      return new Response(null, { status:201 })
    }
    if (options.method === 'DELETE') {
      const [column, filter] = [...parsed.searchParams.entries()][0]
      for (const [id, row] of tables[table] || []) if (Date.parse(row[column]) < Date.parse(filter.slice(3))) tables[table].delete(id)
      return new Response(null, { status:204 })
    }
    const offset = Number(parsed.searchParams.get('offset')), limit = Math.min(Number(parsed.searchParams.get('limit')), 1000)
    return Response.json([...(tables[table]?.values() || [])].slice(offset, offset + limit))
  }
  return { tables, calls, handler, failWrites:value => { failWrites = value } }
}
async function withFake(run) {
  const fake = fakeSupabase(), realFetch = globalThis.fetch
  globalThis.fetch = fake.handler
  try { await run(fake) } finally { globalThis.fetch = realFetch }
}
const open = () => createAnalyticsStore(null, createSupabaseBackend('https://projet.supabase.co/', 'sb_secret_test'))

test('statistics survive a restart through Supabase', () => withFake(async () => {
  const store = open(), id = randomUUID()
  const link = await store.createLink('Lycée')
  await store.event('flow_started', id)
  await store.event('visit', id, link.code)
  await store.event('payment_viewed', id)
  await store.checkout('cs_test_abc', 350, 3, id, 'test')
  await store.paid('cs_test_abc', 350)
  const [tracker] = await store.registerTrackers([{ id:'company-1' }])
  assert.equal((await store.trackerStatuses([tracker.token]))[0].openedAt, null)
  await store.trackOpen(tracker.token)

  const restarted = open(), stats = await restarted.stats()
  assert.equal(stats.visits, 1)
  assert.equal(stats.payments, 1)
  assert.equal(stats.testRevenueCents, 350)
  assert.equal(stats.links[0].visits, 1)
  assert.equal(stats.links[0].label, 'Lycée')
  const [status] = await restarted.trackerStatuses([tracker.token])
  assert.equal(status.opens, 1)
  assert.ok(status.openedAt)
  // A referral already counted is not counted twice after the restart.
  await restarted.event('visit', id, link.code)
  assert.equal((await restarted.stats()).links[0].visits, 1)
}))

test('only changed rows are written, with the key in the apikey header only', () => withFake(async fake => {
  const store = open()
  await store.event('visit', randomUUID())
  fake.calls.length = 0
  await store.event('visit', randomUUID())
  const writes = fake.calls.filter(call => call.method === 'POST')
  assert.deepEqual(writes.map(call => call.table), ['visits', 'flows'])
  for (const write of writes) assert.equal(JSON.parse(write.body).length, 1)
  assert.equal(writes[0].headers.apikey, 'sb_secret_test')
  assert.equal(writes[0].headers.authorization, undefined)
}))

test('a failed write is retried with the next change', () => withFake(async fake => {
  const store = open(), first = randomUUID()
  fake.failWrites(true)
  await assert.rejects(store.event('visit', first))
  fake.failWrites(false)
  await store.event('visit', randomUUID())
  assert.equal(fake.tables.visits.size, 2)
  assert.ok(fake.tables.visits.has(first))
}))

test('tables above the 1000-row response cap load completely', () => withFake(async fake => {
  const rows = fake.tables.visits = new Map()
  for (let index = 0; index < 2500; index++) { const id = randomUUID(); rows.set(id, { flow_id:id, visited_at:new Date().toISOString() }) }
  assert.equal((await open().stats()).visits, 2500)
}))

test('data older than the announced retention is erased, orders are kept', () => withFake(async fake => {
  const old = new Date(Date.now() - 500 * 86400000).toISOString(), recent = new Date().toISOString()
  fake.tables.visits = new Map([['old', { flow_id:'old', visited_at:old }], ['new', { flow_id:'new', visited_at:recent }]])
  fake.tables.checkouts = new Map([['cs_old', { session_id:'cs_old', amount_cents:250, company_count:1, mode:'live', created_at:old, paid_at:old }]])
  const stats = await open().stats()
  assert.equal(stats.visits, 1)
  assert.equal(stats.liveRevenueCents, 250)
  assert.deepEqual(fake.calls.filter(call => call.method === 'DELETE').map(call => call.table).sort(), ['flows', 'trackers', 'visits'])
}))

test('a failed load is retried instead of starting empty', async () => {
  let attempts = 0
  const store = createAnalyticsStore(null, { name:'test', load:async () => { if (!attempts++) throw new Error('hors ligne'); return { visits:{ a:1 } } }, save:async () => {} })
  await assert.rejects(store.ready())
  assert.equal(await store.ready(), 'test')
  assert.equal((await store.stats()).visits, 1)
})

test('the forwarded address is trusted only on Render', () => {
  const request = { headers:{ 'x-forwarded-for':'203.0.113.9, 10.0.0.1' }, socket:{ remoteAddress:'10.0.0.1' } }
  const previous = process.env.RENDER
  try {
    delete process.env.RENDER
    assert.equal(clientAddress(request), '10.0.0.1')
    process.env.RENDER = 'true'
    assert.equal(clientAddress(request), '203.0.113.9')
  } finally {
    if (previous === undefined) delete process.env.RENDER; else process.env.RENDER = previous
  }
})
