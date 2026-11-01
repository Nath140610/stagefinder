import test, { before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

let vite, googleAuth
const originalFetch = globalThis.fetch, originalWindow = globalThis.window
before(async () => {
  vite = await createServer({ define:{ 'import.meta.env.VITE_GOOGLE_CLIENT_ID':JSON.stringify('test-client.apps.googleusercontent.com') }, server:{ middlewareMode:true, hmr:false }, appType:'custom' })
  googleAuth = await vite.ssrLoadModule('/src/services/googleAuth.js')
})
afterEach(() => { globalThis.fetch = originalFetch; globalThis.window = originalWindow })
after(async () => { await vite.close() })
const attachment = () => ({ name:'document.pdf', file:new File(['%PDF-1.4\nTest'], 'document.pdf', { type:'application/pdf' }) })
const companies = [{ id:'one', name:'Atelier Alpha', email:'stage@alpha.example' }, { id:'two', name:'Studio Beta', email:'contact@beta.example' }]
const options = () => ({ accessToken:'mock-token', applications:companies, candidateName:'Camille Étudiant', content:'Bonjour [ENTREPRISE],\nVoici ma candidature.', cv:attachment(), letter:attachment() })
const decode = raw => Buffer.from(raw, 'base64url').toString('utf8')

test('Google asks for send access without reading the inbox and records token expiry', async () => {
  let requested
  globalThis.window = { google:{ accounts:{ oauth2:{
    initTokenClient(config) { requested = config; return { requestAccessToken() { config.callback({ access_token:'mock-token', expires_in:3600, scope:'https://www.googleapis.com/auth/gmail.send' }) } } },
    hasGrantedAllScopes(token, ...scopes) { return scopes.every(scope => token.scope.split(' ').includes(scope)) }
  } } } }
  globalThis.fetch = async () => ({ ok:true, json:async () => ({ email:'student@example.com', email_verified:true, name:'Student' }) })
  const account = await googleAuth.connectGoogleAccount()
  assert.match(requested.scope, /gmail.send/); assert.doesNotMatch(requested.scope, /gmail.readonly/)
  assert.equal(account.email, 'student@example.com')
  assert.ok(account.expiresAt > Date.now() + 3500000)
})
test('declined Gmail permission cannot masquerade as successful connection', async () => {
  globalThis.window = { google:{ accounts:{ oauth2:{ initTokenClient(config) { return { requestAccessToken() { config.callback({ access_token:'mock', scope:'email' }) } } }, hasGrantedAllScopes:() => false } } } }
  await assert.rejects(googleAuth.connectGoogleAccount(), /Autorise l’envoi/)
})
test('batch sends separate personalized messages with both PDF attachments', async () => {
  const requests = [], progress = []
  globalThis.fetch = async (url, options) => { requests.push({ url, ...options }); return { ok:true, json:async () => ({ id:`msg-${requests.length}`, threadId:`thread-${requests.length}` }) } }
  const result = await googleAuth.sendApplications({ ...options(), onProgress:value => progress.push(value) })
  assert.equal(result.sent, 2); assert.equal(requests.length, 2); assert.equal(progress[1].applications.length, 2)
  requests.forEach((request, index) => {
    assert.equal(request.url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send')
    const mime = decode(JSON.parse(request.body).raw)
    assert.ok(mime.includes(`To: ${companies[index].email}\r\n`))
    assert.ok(mime.includes(Buffer.from(`Bonjour ${companies[index].name},\nVoici ma candidature.`).toString('base64')))
    assert.equal((mime.match(/Content-Disposition: attachment/g) || []).length, 2)
    assert.doesNotMatch(mime, /tracking\/pixel/)
  })
})

test('every message goes to the company, with no way to redirect it to a test inbox', async () => {
  const requests = []
  globalThis.fetch = async (url, options) => { requests.push({ url, ...options }); return { ok:true, json:async () => ({ id:`test-${requests.length}` }) } }
  const result = await googleAuth.sendApplications({ ...options(), testRecipient:'destinataire.test@example.com' })
  assert.equal(requests.length, 2)
  assert.deepEqual(result.applications.map(row => row.recipientEmail), requests.map(request => decode(JSON.parse(request.body).raw).match(/To: (.+)\r\n/)[1]))
  const mimes = requests.map(request => decode(JSON.parse(request.body).raw))
  assert.match(mimes[0], /To: stage@alpha\.example\r\n/)
  assert.match(mimes[1], /To: contact@beta\.example\r\n/)
})

test('a public HTTPS send embeds one unique tracking image in the HTML message', async () => {
  globalThis.window = { location:{ origin:'https://stagefinder.example' } }
  const token = 'a'.repeat(32), requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url:String(url), options })
    return String(url).endsWith('/api/tracking/register')
      ? { ok:true, json:async () => ({ trackers:[{ applicationId:'one', token }] }) }
      : { ok:true, json:async () => ({ id:'sent-1', threadId:'thread-1' }) }
  }
  const result = await googleAuth.sendApplications({ ...options(), applications:[companies[0]] })
  assert.equal(result.applications[0].trackingToken, token)
  assert.equal(requests[0].url, 'https://stagefinder.example/api/tracking/register')
  const mime = decode(JSON.parse(requests[1].options.body).raw)
  const encodedHtml = mime.match(/Content-Type: text\/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([a-zA-Z0-9+/=\r\n]+)/)[1]
  const html = Buffer.from(encodedHtml.replaceAll('\r\n', ''), 'base64').toString('utf8')
  assert.match(html, /https:\/\/stagefinder\.example\/api\/tracking\/pixel\/a{32}/)
  assert.match(html, /envoyée avec Stage Finder/)
  assert.match(html, /image de suivi/)
  assert.match(html, /https:\/\/stagefinder\.example\/confidentialite/)
})
test('resume excludes confirmed deliveries and duplicate company selections', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; return { ok:true, json:async () => ({ id:'msg' }) } }
  const result = await googleAuth.sendApplications({ ...options(), applications:[...companies, companies[1]], alreadySent:[{ companyId:'one' }] })
  assert.equal(result.sent, 1); assert.equal(calls, 1); assert.equal(result.applications[0].companyId, 'two')
})
test('partial failure preserves deliveries and asks to reconnect on expired token', async () => {
  let calls = 0
  globalThis.fetch = async () => ++calls === 1 ? { ok:true, json:async () => ({ id:'msg-1' }) } : { ok:false, status:401 }
  await assert.rejects(googleAuth.sendApplications(options()), error => {
    assert.equal(error.sentApplications.length, 1); assert.equal(error.companyId, 'two'); assert.equal(error.reconnect, true); return true
  })
  assert.equal(calls, 2)
})
test('network ambiguity stops the batch without silently retrying a possible delivery', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('Lost connection') }
  await assert.rejects(googleAuth.sendApplications(options()), error => error.uncertain === true && error.companyId === 'one')
  assert.equal(calls, 1)
})
test('invalid recipients and missing attachments block the whole batch before any send', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('Must not send') }
  await assert.rejects(googleAuth.sendApplications({ ...options(), applications:[companies[0], { ...companies[1], email:'a@example.com\r\nBcc: other@example.com' }] }), /invalide/)
  await assert.rejects(googleAuth.sendApplications({ ...options(), cv:null }), /CV/)
  assert.equal(calls, 0)
})
test('expired or absent tokens require reconnecting', () => {
  assert.equal(googleAuth.accountExpired(null), true)
  assert.equal(googleAuth.accountExpired({ accessToken:'mock', expiresAt:Date.now() - 1 }), true)
  assert.equal(googleAuth.accountExpired({ accessToken:'mock', expiresAt:Date.now() + 3600000 }), false)
})
