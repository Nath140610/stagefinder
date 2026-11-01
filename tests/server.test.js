import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { server } from '../server/index.js'
import { emailsIn, emailMatchesWebsite, rankSearchResults, resetSearchState, searchResultCandidates } from '../server/emailCrawler.js'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

let base, analyticsDir, previousAnalyticsFile
before(async () => {
  analyticsDir = await mkdtemp(join(tmpdir(), 'stagefinder-server-'))
  previousAnalyticsFile = process.env.ANALYTICS_DATA_FILE
  process.env.ANALYTICS_DATA_FILE = join(analyticsDir, 'analytics.json')
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  await new Promise(resolve => server.close(resolve))
  if (previousAnalyticsFile == null) delete process.env.ANALYTICS_DATA_FILE; else process.env.ANALYTICS_DATA_FILE = previousAnalyticsFile
  await rm(analyticsDir, { recursive:true, force:true })
})
test('production serves the application and all initial assets', async () => {
  const response = await fetch(base)
  assert.equal(response.status, 200)
  const html = await response.text()
  assert.match(html, /Ton prochain stage/)
  for (const asset of [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(match => match[1]).concat(['/logo-mark.png', '/Bannier.png'])) {
    assert.equal((await fetch(base + asset)).status, 200, asset)
  }
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
})
test('health endpoint is ready for hosting checks', async () => assert.deepEqual(await (await fetch(base + '/api/health')).json(), { status:'ok' }))
test('private files, source files, and missing assets are never served', async () => {
  for (const path of ['/.env.local', '/package.json', '/server/index.js', '/src/App.jsx', '/assets/missing.js']) assert.equal((await fetch(base + path)).status, 404, path)
})
test('crawler rejects unsupported methods and cross-origin requests', async () => {
  assert.equal((await fetch(base + '/api/find-emails')).status, 405)
  assert.equal((await fetch(base + '/api/find-emails', { method:'POST', headers:{ origin:'https://unrelated.example', 'content-type':'application/json' }, body:'{}' })).status, 403)
})

test('contact research reads an encoded email published only in a mailto link', () => {
  assert.deepEqual(emailsIn('<a href="mailto:bonjour%40atelier.fr?subject=Stage"><img src="contact.png" alt="Écrire"></a>'), ['bonjour@atelier.fr'])
  assert.equal(emailMatchesWebsite('contact@sfr.fr', 'boutique.sfr.fr'), true)
  assert.equal(emailMatchesWebsite('promo@unrelated.fr', 'boutique.sfr.fr'), false)
})

test('website discovery keeps a matching official site and rejects directories', () => {
  const html = `<a class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent('https://www.atelier-alpha.fr/contact')}">Atelier Alpha à Lyon — site officiel</a>
    <a class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent('https://www.pagesjaunes.fr/pros/123')}">Atelier Alpha</a>
    <a class="result__a" href="https://unrelated.example/">Entreprise sans rapport</a>`
  const rows = searchResultCandidates(html, { name:'Atelier Alpha', location:'Lyon' })
  assert.equal(rows.length, 1)
  assert.equal(new URL(rows[0].url).hostname, 'www.atelier-alpha.fr')
})
test('contact research ignores profile URLs and addresses not meant for applications', () => {
  assert.deepEqual(emailsIn('<script>{"tiktok":"https://www.tiktok.com/@ldlc.com"}</script> <a href="mailto:dpo@dawex.com">DPO</a> <a href="mailto:contact@dawex.com">Contact</a>'), ['contact@dawex.com'])
})
test('search results keep the company site and drop directories that mention it', () => {
  const company = { name:'Photo Service', location:'Ecully' }
  assert.deepEqual(rankSearchResults([
    { url:'https://www.horaires-commerces.fr/69/ecully/photo-service', title:'Photo Service Ecully' },
    { url:'https://www.lyon-entreprises.com/entreprise/photo-service', title:'Photo Service' },
    { url:'https://www.photo-ecully.fr/', title:'Photo Service Ecully' }
  ], company).map(row => new URL(row.url).hostname), ['www.photo-ecully.fr'])
})
test('a blocked search engine is reported and not queried again', async () => {
  const realFetch = globalThis.fetch, previousKey = process.env.BRAVE_SEARCH_API_KEY
  delete process.env.BRAVE_SEARCH_API_KEY
  let searches = 0
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('duckduckgo.com')) { searches++; return new Response('<html>challenge</html>', { status:202, headers:{ 'content-type':'text/html' } }) }
    return realFetch(url, options)
  }
  try {
    resetSearchState()
    const post = () => realFetch(base + '/api/find-emails', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ companies:[{ id:'one', name:'Atelier Alpha' }] }) }).then(response => response.json())
    assert.equal((await post()).searchLimited, true)
    assert.equal((await post()).searchLimited, true)
    assert.equal(searches, 1)
  } finally {
    globalThis.fetch = realFetch; resetSearchState()
    if (previousKey !== undefined) process.env.BRAVE_SEARCH_API_KEY = previousKey
  }
})
test('Brave search finds the site with the configured key', async () => {
  const realFetch = globalThis.fetch, previousKey = process.env.BRAVE_SEARCH_API_KEY
  process.env.BRAVE_SEARCH_API_KEY = 'test-key'
  let header
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('api.search.brave.com')) { header = options.headers['x-subscription-token']; return Response.json({ web:{ results:[{ url:'https://127.0.0.1/', title:'Atelier Alpha' }, { url:'https://www.pagesjaunes.fr/atelier-alpha', title:'Atelier Alpha' }] } }) }
    return realFetch(url, options)
  }
  try {
    resetSearchState()
    const response = await realFetch(base + '/api/find-emails', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ companies:[{ id:'one', name:'Atelier Alpha' }] }) })
    assert.deepEqual(await response.json(), { results:[], searchLimited:false })
    assert.equal(header, 'test-key')
  } finally {
    globalThis.fetch = realFetch; resetSearchState()
    if (previousKey === undefined) delete process.env.BRAVE_SEARCH_API_KEY
    else process.env.BRAVE_SEARCH_API_KEY = previousKey
  }
})
test('crawler refuses loopback websites and never discovers guessed domains', async () => {
  for (const company of [{ id:'one', name:'Example', website:'http://127.0.0.1/' }, { id:'two', name:'Example' }]) {
    const response = await fetch(base + '/api/find-emails', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ companies:[company] }) })
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).results, [])
  }
})
test('tracking tokens record image loads without exposing registration cross-origin', async () => {
  assert.equal((await fetch(base + '/api/tracking/status')).status, 405)
  assert.equal((await fetch(base + '/api/tracking/register', { method:'POST', headers:{ origin:'https://unrelated.example', 'content-type':'application/json' }, body:'{}' })).status, 403)
  const registration = await fetch(base + '/api/tracking/register', { method:'POST', headers:{ origin:base, 'content-type':'application/json' }, body:JSON.stringify({ applications:[{ id:'company-1' }] }) })
  assert.equal(registration.status, 200)
  const token = (await registration.json()).trackers[0].token
  const pixel = await fetch(base + `/api/tracking/pixel/${token}`)
  assert.equal(pixel.status, 200)
  assert.equal(pixel.headers.get('content-type'), 'image/gif')
  const status = await fetch(base + '/api/tracking/status', { method:'POST', headers:{ origin:base, 'content-type':'application/json' }, body:JSON.stringify({ tokens:[token] }) })
  const trackers = (await status.json()).trackers
  assert.equal(trackers[0].opens, 1)
  assert.ok(trackers[0].openedAt)
})

test('admin data needs a password, and a referral link counts an actual visit', async () => {
  const oldPassword = process.env.ADMIN_PASSWORD
  process.env.ADMIN_PASSWORD = 'mot-de-passe-de-test'
  try {
    assert.equal((await fetch(base + '/ADMIN')).status, 200)
    assert.equal((await fetch(base + '/api/admin/stats')).status, 401)
    assert.equal((await fetch(base + '/api/admin/login', { method:'POST', headers:{ origin:'https://unrelated.example', 'content-type':'application/json' }, body:JSON.stringify({ password:process.env.ADMIN_PASSWORD }) })).status, 403)
    const login = await fetch(base + '/api/admin/login', { method:'POST', headers:{ origin:base, 'content-type':'application/json' }, body:JSON.stringify({ password:process.env.ADMIN_PASSWORD }) })
    assert.equal(login.status, 200)
    const adminCookie = login.headers.get('set-cookie').split(';')[0]
    assert.match(login.headers.get('set-cookie'), /HttpOnly/)
    const created = await fetch(base + '/api/admin/links', { method:'POST', headers:{ origin:base, cookie:adminCookie, 'content-type':'application/json' }, body:JSON.stringify({ label:'Réseaux sociaux' }) })
    assert.equal(created.status, 201)
    const link = await created.json()
    const redirect = await fetch(base + `/r/${link.code}`, { redirect:'manual' })
    assert.equal(redirect.status, 302)
    assert.equal(redirect.headers.get('location'), '/')
    const referralCookie = redirect.headers.get('set-cookie').split(';')[0]
    const event = await fetch(base + '/api/analytics/event', { method:'POST', headers:{ origin:base, cookie:referralCookie, 'content-type':'application/json' }, body:JSON.stringify({ type:'visit', id:randomUUID() }) })
    assert.equal(event.status, 200)
    const stats = await (await fetch(base + '/api/admin/stats', { headers:{ cookie:adminCookie } })).json()
    assert.equal(stats.visits, 1)
    assert.equal(stats.links[0].visits, 1)
  } finally {
    if (oldPassword == null) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = oldPassword
  }
})
