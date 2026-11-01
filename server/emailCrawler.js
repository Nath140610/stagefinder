import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_HTML_BYTES = 900_000
const EMAIL_PATTERN = /(?<![a-z0-9._%+/-])[a-z0-9][a-z0-9._%+-]*@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi
const NOT_FOR_APPLICATIONS = /^(?:dpo|dsa|rgpd|gdpr|privacy|donnees-?personnelles|abuse|postmaster|webmaster|no-?reply|ne-?pas-?repondre)@/i
const SEARCH_BLOCK_COOLDOWN_MS = 10 * 60_000
const BRAVE_MIN_GAP_MS = 1100
const CONTACT_PATHS = ['/contact', '/contactez-nous', '/nous-contacter', '/recrutement', '/carrieres', '/mentions-legales', '/about', '/qui-sommes-nous']
const PLACEHOLDERS = new Set(['example.com', 'email.com', 'domain.com', 'yourdomain.com', 'sentry.io', 'wixpress.com', 'wordpress.org'])
const DIRECTORY_HOSTS = ['facebook.com', 'instagram.com', 'linkedin.com', 'tiktok.com', 'youtube.com', 'wikipedia.org', 'societe.com', 'pappers.fr', 'verif.com', 'infogreffe.fr', 'pagesjaunes.fr', 'duckduckgo.com']
const NAME_STOPWORDS = new Set(['de','du','des','la','le','les','et','en','a','au','aux','sa','sas','sarl','eurl','sasu','ste','societe','france','groupe','company','entreprise','service','services','conseil','club','centre','ctre','distribution'])

const foldText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const nameTokens = value => foldText(value).split(' ').filter(token => token.length > 2 && !NAME_STOPWORDS.has(token))
const directoryHost = hostname => DIRECTORY_HOSTS.some(host => hostname === host || hostname.endsWith(`.${host}`))

// A directory page publishes its own address, not the company's: the company
// name has to appear in the hostname for a result to count as its website.
export function rankSearchResults(results, company) {
  const wanted = [...new Set(nameTokens(company.name))], location = foldText(company.location || company.address)
  if (!wanted.length) return []
  const rows = []
  for (const result of results) {
    try {
      const url = new URL(result.url)
      if (!['http:', 'https:'].includes(url.protocol) || directoryHost(url.hostname.toLowerCase())) continue
      const hostname = foldText(url.hostname).replaceAll(' ', ''), title = foldText(result.title)
      const overlap = wanted.filter(token => hostname.includes(token)).length / wanted.length
      if (overlap < 0.5) continue
      const locationHit = location && title.split(' ').some(token => token.length > 3 && location.includes(token))
      rows.push({ url:url.href, score:overlap + (locationHit ? 0.2 : 0), title:result.title })
    } catch {}
  }
  return rows.sort((a, b) => b.score - a.score).filter((row, index, all) => all.findIndex(other => new URL(other.url).hostname === new URL(row.url).hostname) === index).slice(0, 2)
}

export function searchResultCandidates(html, company) {
  const results = []
  for (const match of html.matchAll(/<a\b[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const href = decodeHtml(match[1]).replace(/^\/\//, 'https://')
      const redirect = new URL(href)
      const destination = redirect.hostname.endsWith('duckduckgo.com') ? redirect.searchParams.get('uddg') : href
      if (destination) results.push({ url:destination, title:decodeHtml(match[2].replace(/<[^>]*>/g, ' ')) })
    } catch {}
  }
  return rankSearchResults(results, company)
}

let searchBlockedUntil = 0, braveSlot = Promise.resolve()
const searchIsBlocked = () => Date.now() < searchBlockedUntil
export const resetSearchState = () => { searchBlockedUntil = 0; braveSlot = Promise.resolve() }

// Brave plans cap requests per second, so every lookup waits for its own slot.
function nextBraveSlot() {
  const slot = braveSlot
  braveSlot = slot.then(() => new Promise(resolve => setTimeout(resolve, BRAVE_MIN_GAP_MS)))
  return slot
}

async function searchBrave(query, company, key) {
  await nextBraveSlot()
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 7000)
  try {
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${new URLSearchParams({ q:query, country:'FR', search_lang:'fr', count:'10' })}`, { signal:controller.signal, headers:{ accept:'application/json', 'x-subscription-token':key } })
    if (response.status === 401 || response.status === 402 || response.status === 403 || response.status === 429) { searchBlockedUntil = Date.now() + SEARCH_BLOCK_COOLDOWN_MS; return [] }
    if (!response.ok) return []
    const payload = await response.json()
    return rankSearchResults(payload.web?.results || [], company)
  } catch { return [] } finally { clearTimeout(timer) }
}

async function searchDuckDuckGo(query, company) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 7000)
  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { signal:controller.signal, headers:{ 'user-agent':'StageFinderContactResearch/1.0 (+public business contact lookup)', accept:'text/html' } })
    // DuckDuckGo answers automated traffic with a 202 challenge page: back off instead of insisting.
    if (response.status !== 200) { await response.body?.cancel(); searchBlockedUntil = Date.now() + SEARCH_BLOCK_COOLDOWN_MS; return [] }
    if (!/text\/html/i.test(response.headers.get('content-type') || '')) return []
    const html = await response.text()
    if (html.length > MAX_HTML_BYTES) return []
    return searchResultCandidates(html, company)
  } catch { return [] } finally { clearTimeout(timer) }
}

async function discoverWebsites(company) {
  if (searchIsBlocked()) return []
  const query = `"${company.name}" ${company.location || company.address || ''} contact site officiel`
  const key = process.env.BRAVE_SEARCH_API_KEY
  return key ? searchBrave(query, company, key) : searchDuckDuckGo(query, company)
}

function blockedAddress(address) {
  const value = address.toLowerCase().split('%')[0]
  if (value.startsWith('::ffff:')) return true
  if (value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd') || /^fe[89ab]/.test(value) || value.startsWith('ff')) return true
  const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return blockedAddress(mapped[1])
  if (isIP(value) !== 4) return false
  const parts = value.split('.').map(Number)
  return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || parts[0] >= 224 ||
    (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
}

async function resolvePublicHost(hostname) {
  let timer
  try {
    return await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DNS timeout')), 2500) })
    ])
  } finally { clearTimeout(timer) }
}

async function publicUrl(value) {
  let url
  try { url = new URL(/^https?:\/\//i.test(String(value || '').trim()) ? String(value).trim() : `https://${String(value || '').trim()}`) }
  catch { return null }
  if (!['http:', 'https:'].includes(url.protocol) || (url.port && !['80', '443'].includes(url.port)) || url.username || url.password || !url.hostname || url.hostname === 'localhost' || url.hostname.endsWith('.local') || url.hostname.endsWith('.internal')) return null
  const literal = isIP(url.hostname)
  if (literal) return null
  if (!literal) {
    try {
      const addresses = await resolvePublicHost(url.hostname)
      if (!addresses.length || addresses.some(record => blockedAddress(record.address))) return null
    } catch { return null }
  }
  return url
}

async function readHtmlResponse(url, timeoutMs = 5000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let current = url
    for (let redirects = 0; redirects <= 2; redirects++) {
      const checked = await publicUrl(current.href)
      if (!checked) return null
      const response = await fetch(checked, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'user-agent': 'StageFinderContactResearch/1.0 (+public business contact lookup)', accept: 'text/html,application/xhtml+xml' }
      })
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location')
        await response.body?.cancel()
        if (!location || redirects === 2) return null
        const destination = new URL(location, checked)
        const oldHost = checked.hostname.toLowerCase(), newHost = destination.hostname.toLowerCase()
        if (!(newHost === oldHost || newHost.endsWith(`.${oldHost}`) || oldHost.endsWith(`.${newHost}`))) return null
        current = destination
        continue
      }
      if (!response.ok || !/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type') || '')) {
        await response.body?.cancel()
        return null
      }
      const declaredSize = Number(response.headers.get('content-length') || 0)
      if (declaredSize > MAX_HTML_BYTES || !response.body) {
        await response.body?.cancel()
        return null
      }
      const reader = response.body.getReader(), chunks = []
      let size = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > MAX_HTML_BYTES) { await reader.cancel(); return null }
        chunks.push(value)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      return { html: new TextDecoder('utf-8').decode(bytes), url: checked }
    }
    return null
  } catch { return null } finally { clearTimeout(timer) }
}

function decodeHtml(value) {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#([0-9]+);?/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&commat;/gi, '@').replace(/&period;/gi, '.').replace(/&colon;/gi, ':')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
}

function mailtoEmailsIn(html) {
  return [...html.matchAll(/href\s*=\s*["']mailto:([^"']+)["']/gi)].flatMap(([, address]) => {
    try { return decodeURIComponent(decodeHtml(address).split('?')[0]).match(EMAIL_PATTERN) || [] } catch { return [] }
  }).map(email => email.toLowerCase())
}

export function emailsIn(html) {
  const cloudflare = [...html.matchAll(/data-cfemail=["']([a-f0-9]+)["']/gi)].map(([, encoded]) => {
    const bytes = encoded.match(/../g)?.map(value => parseInt(value, 16)) || []
    return bytes.length ? bytes.slice(1).map(value => String.fromCharCode(value ^ bytes[0])).join('') : ''
  })
  const mailto = mailtoEmailsIn(html)
  const decoded = decodeHtml(`${html} ${cloudflare.join(' ')} ${mailto.join(' ')}`).replace(/<[^>]*>/g, ' ')
    .replace(/[\[(]\s*(?:at|arroba)\s*[\])]/gi, '@').replace(/\s+at\s+/gi, '@')
    .replace(/[\[(]\s*(?:dot|punto)\s*[\])]/gi, '.').replace(/\s+dot\s+/gi, '.')
  return [...new Set((decoded.match(EMAIL_PATTERN) || []).map(email => email.replace(/[),.;:]+$/, '').toLowerCase()))]
    .filter(email => !PLACEHOLDERS.has(email.split('@')[1]) && !/\.(?:png|jpe?g|gif|svg|webp)$/i.test(email) && !NOT_FOR_APPLICATIONS.test(email))
}

function contactPages(html, base) {
  const candidates = []
  const anchors = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi
  let match
  while ((match = anchors.exec(html)) !== null) {
    const href = decodeHtml(match[2]).trim(), text = decodeHtml(match[3].replace(/<[^>]*>/g, ' '))
    if (!/(contact|contacter|coordonn|mention|legal|équipe|equipe|about|apropos|qui-sommes|nous-joindre|recrut|carri[eè]re|emploi)/i.test(`${href} ${text}`)) continue
    try {
      const url = new URL(href, base)
      if (url.origin !== base.origin || !/^https?:$/.test(url.protocol)) continue
      url.hash = ''; url.search = ''
      if (!candidates.includes(url.href)) candidates.push(url.href)
    } catch {}
  }
  for (const path of CONTACT_PATHS) {
    const url = new URL(path, base).href
    if (!candidates.includes(url)) candidates.push(url)
  }
  const selected = []
  for (const pattern of [/recrut|carri[eè]re|emploi/i, /contact|contacter/i, /mention|legal/i, /about|qui-sommes|[eé]quipe/i]) {
    const match = candidates.find(url => pattern.test(url) && !selected.includes(url))
    if (match) selected.push(match)
  }
  for (const url of candidates) if (selected.length < 4 && !selected.includes(url)) selected.push(url)
  return selected
}

export function emailMatchesWebsite(email, hostname) {
  const domain = email.split('@')[1], host = hostname.replace(/^www\./, '')
  return domain === host || host.endsWith(`.${domain}`) && !/^(?:co|com|org|net|gov)\.[a-z]{2}$/i.test(domain) || domain.endsWith(`.${host}`) || ['gmail.com','orange.fr','wanadoo.fr','outlook.fr','outlook.com','hotmail.fr','yahoo.fr','laposte.net'].includes(domain)
}

async function crawlCompany(company) {
  const starts = []
  if (company.website) {
    const supplied = await publicUrl(company.website)
    if (supplied) starts.push(supplied)
  } else for (const candidate of await discoverWebsites(company)) {
    const discovered = await publicUrl(candidate.url)
    if (discovered) starts.push(discovered)
  }
  if (!starts.length) return null
  for (const start of starts) {
  const pages = [], checked = new Set(), found = new Set(), explicitContacts = new Set()
  const homepage = await readHtmlResponse(start)
  if (homepage) {
    checked.add(homepage.url.href)
    for (const email of emailsIn(homepage.html)) found.add(email)
    for (const email of mailtoEmailsIn(homepage.html)) explicitContacts.add(email)
    pages.push(...contactPages(homepage.html, homepage.url))
  }
  if (!pages.length) pages.push(...contactPages('', start))
  const contactResults = await Promise.all(pages.filter(page => !checked.has(page)).slice(0, 4).map(page => readHtmlResponse(new URL(page), 3500)))
  for (const result of contactResults) if (result) {
    for (const email of emailsIn(result.html)) found.add(email)
    for (const email of mailtoEmailsIn(result.html)) explicitContacts.add(email)
  }
    const emails = rankEmails([...found].filter(email => emailMatchesWebsite(email, start.hostname) || explicitContacts.has(email)))
    if (emails.length || company.website || starts.length === 1) return { id:company.id, website:start.href, emails, source:contactResults.find(result => result && emailsIn(result.html).length)?.url.href || start.href }
  }
  return null
}

function rankEmails(emails) {
  const preferred = /^(contact|bonjour|accueil|info|stage|stages|recrutement|rh|emploi|jobs|careers|candidature)@/i
  return emails.sort((a, b) => Number(preferred.test(b)) - Number(preferred.test(a))).slice(0, 5)
}

async function readBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 100_000) throw new Error('Requête trop volumineuse')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export async function handleEmailSearch(request, response) {
  if (request.method !== 'POST') {
    response.writeHead(405, { 'content-type': 'application/json; charset=utf-8', allow: 'POST' })
    response.end(JSON.stringify({ error: 'Méthode non autorisée' }))
    return
  }
  try {
    const payload = await readBody(request)
    const companies = Array.isArray(payload.companies) ? payload.companies.slice(0, 5) : []
    const output = new Array(companies.length)
    let next = 0
    await Promise.all(Array.from({ length: Math.min(5, companies.length) }, async () => {
      while (next < companies.length) {
        const index = next++
        const company = companies[index]
        output[index] = company?.id && company?.name ? await crawlCompany(company) : null
      }
    }))
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    response.end(JSON.stringify({ results: output.filter(Boolean), searchLimited: searchIsBlocked() }))
  } catch (error) {
    response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify({ error: error.message || 'Recherche des e-mails impossible' }))
  }
}
