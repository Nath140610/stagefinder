import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createAnalyticsStore } from '../server/analytics.js'

test('referral visits, form milestones and verified payments persist without personal data', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'stagefinder-analytics-'))
  try {
    const file = join(dir, 'analytics.json'), store = createAnalyticsStore(file), id = randomUUID()
    const link = await store.createLink('Campagne novembre')
    await store.event('visit', id)
    await store.event('visit', id, link.code)
    await store.event('visit', id, link.code)
    await store.event('flow_started', id)
    await store.event('form_completed', id)
    await store.event('payment_viewed', id)
    await store.checkout('cs_test_analytics123456', 350, 3, id)
    assert.equal((await store.stats()).pendingAtPayment, 1)
    await store.cancelled('cs_test_analytics123456')
    assert.equal((await store.stats()).abandonedAtPayment, 1)
    await store.paid('cs_test_analytics123456', 350)
    await store.paid('cs_test_analytics123456', 350)
    const result = await createAnalyticsStore(file).stats()
    assert.equal(result.visits, 1)
    assert.equal(result.links[0].visits, 1)
    assert.equal(result.formsCompleted, 1)
    assert.equal(result.abandonedAtPayment, 0)
    assert.equal(result.payments, 1)
    assert.equal(result.revenueCents, 350)
    assert.equal(result.livePayments, 0)
    assert.equal(result.testPayments, 1)
    const trackers = await store.registerTrackers([{ id:'company-1' }])
    const token = trackers[0].token
    assert.match(token, /^[a-zA-Z0-9_-]{32}$/)
    assert.equal((await store.trackerStatuses([token]))[0].openedAt, null)
    await store.trackOpen(token)
    await store.trackOpen(token)
    const persisted = await createAnalyticsStore(file).trackerStatuses([token])
    assert.equal(persisted[0].opens, 2)
    assert.ok(persisted[0].openedAt)
  } finally { await rm(dir, { recursive:true, force:true }) }
})
