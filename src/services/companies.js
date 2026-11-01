import { DOMAIN_CONFIG, DOMAIN_TAG_VALUES, DOMAIN_NAF, DOMAIN_PARENT } from './domainConfig.js'

const cache = new Map()
export const fold = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export function distance(a, b, c, d) {
  const r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r
  const h = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
}
async function json(url, timeout = 12000) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout)
  try {
    const headers = typeof window === 'undefined' ? { 'User-Agent': 'StageFinder/1.0 (internship business directory)', Accept: 'application/json' } : { Accept: 'application/json' }
    const response = await fetch(url, { signal: controller.signal, headers })
    if (!response.ok) throw new Error(`Source indisponible (${response.status})`)
    return await response.json()
  } finally { clearTimeout(timer) }
}
export async function citySuggestions(query) {
  const value = query.trim()
  if (value.length < 2) return []
  const field = /^\d{5}$/.test(value) ? 'codePostal' : 'nom'
  const rows = await json(`https://geo.api.gouv.fr/communes?${field}=${encodeURIComponent(value)}&fields=nom,centre,codesPostaux,departement&boost=population&limit=6`)
  return rows.filter(row => row.centre?.coordinates).map(row => ({ city: row.nom, label: `${row.nom} (${row.codesPostaux?.[0] || row.departement?.code || ''})`, latitude: row.centre.coordinates[1], longitude: row.centre.coordinates[0] }))
}
export async function resolveCity(city) {
  const results = await citySuggestions(city), exact = results.filter(row => fold(row.city) === fold(city))
  if (!results.length) throw new Error('Ville introuvable. Essaie le nom complet ou le code postal.')
  if (exact.length > 1 || (!exact.length && results.length > 1)) throw new Error('Plusieurs villes correspondent. Choisis une ville dans les suggestions.')
  return exact[0] || results[0]
}
export function safeWebsite(value) {
  if (!value) return null
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}
function contacts(tags) {
  const candidate = String(tags.email || tags['contact:email'] || '').replace(/^mailto:/i, '').split(/[;,\s]+/).find(value => /^[\w.!#$%&'*+/=?^`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value))
  return { email: candidate || null, website: safeWebsite(tags.website || tags['contact:website']), phone: tags.phone || tags['contact:phone'] || null }
}
const categoryKeys = ['office', 'shop', 'craft', 'industrial', 'amenity', 'tourism', 'healthcare', 'leisure', 'sport', 'professional']
const phraseMatch = (text, term) => (` ${fold(text)} `).includes(` ${fold(term)} `)
export const matchesKeyword = (name, keyword) => !keyword.trim() || fold(name).includes(fold(keyword))
export function normaliseOsm(raw, center, radius, domain, keyword = '') {
  const tags = raw.tags || {}, lat = raw.lat ?? raw.center?.lat, lon = raw.lon ?? raw.center?.lon, name = tags.name || tags.brand
  if (!name || lat == null || lon == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null
  if (Object.keys(tags).some(key => /^(disused:|abandoned:|demolished:|removed:|was:)/.test(key)) || ['disused', 'abandoned', 'demolished'].some(key => tags[key] === 'yes') || tags.operational_status === 'closed') return null
  const km = distance(center.latitude, center.longitude, +lat, +lon)
  if (km > radius || !matchesKeyword(`${name} ${tags.brand || ''}`, keyword)) return null
  const values = DOMAIN_TAG_VALUES[domain] || [], tagHit = categoryKeys.some(key => values.includes(tags[key]))
  const nameHit = (DOMAIN_CONFIG[domain] || []).some(term => term.length > 3 && phraseMatch(`${name} ${tags.description || ''}`, term))
  if (domain !== 'Autre' && !tagHit && !nameHit) return null
  if (domain === 'Autre' && !categoryKeys.some(key => tags[key])) return null
  return { id: `osm-${raw.type}-${raw.id}`, name, sector: domain, location: tags['addr:city'] || '', address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ') || null, latitude: +lat, longitude: +lon, distance: Math.round(km * 10) / 10, ...contacts(tags), relevance: tagHit ? (DOMAIN_PARENT[domain] ? `Activité du secteur ${DOMAIN_PARENT[domain]}` : 'Activité correspondante') : 'À vérifier', _score: tagHit ? 5 : 2, source: 'openstreetmap', sourceUrl: `https://www.openstreetmap.org/${raw.type}/${raw.id}` }
}
export function normaliseAnnuaire(company, site, center, radius, domain, keyword = '') {
  if (site.etat_administratif !== 'A' || company.etat_administratif === 'C' || site.latitude == null || site.longitude == null || site.latitude === '' || site.longitude === '') return null
  const lat = Number(site.latitude), lon = Number(site.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const km = distance(center.latitude, center.longitude, lat, lon), config = DOMAIN_NAF[domain], code = site.activite_principale || ''
  if (km > radius || !config || (config.prefixes.length && !config.prefixes.some(prefix => code.startsWith(prefix)))) return null
  const name = site.nom_commercial || site.liste_enseignes?.[0] || company.nom_complet || company.nom_raison_sociale
  if (!name || !matchesKeyword(name, keyword)) return null
  const employer = site.caractere_employeur === 'O', soleTrader = company.nature_juridique === '1000'
  return { id: `siret-${site.siret}`, companyId: company.siren, name, officialName: company.nom_complet, sector: domain, nafCode: code, location: site.libelle_commune || '', address: site.adresse || null, latitude: lat, longitude: lon, distance: Math.round(km * 10) / 10, website: null, email: null, phone: null, relevance: DOMAIN_PARENT[domain] ? `Activité NAF du secteur ${DOMAIN_PARENT[domain]}` : employer ? 'Établissement employeur · activité NAF' : 'Établissement actif · activité NAF', _score: 5 + (employer ? 2 : 0) + (['ETI','GE'].includes(company.categorie_entreprise) ? 1 : 0) - (soleTrader && !employer ? 2 : 0), source: 'annuaire', sourceUrl: `https://annuaire-entreprises.data.gouv.fr/etablissement/${site.siret}` }
}
export function dedupe(items) {
  const unique = []
  for (const item of items) {
    // Keep separate branches, even when they share a SIREN.
    const previous = unique.find(row => row.id === item.id || (fold(row.name) === fold(item.name) && distance(row.latitude, row.longitude, item.latitude, item.longitude) < 0.08))
    if (!previous) unique.push({ ...item })
    else for (const key of ['email', 'website', 'phone', 'address']) previous[key] ||= item[key]
  }
  return unique
}
async function annuaire(center, radius, domain, keyword) {
  const config = DOMAIN_NAF[domain]
  if (!config) throw new Error('Secteur disponible via la cartographie uniquement')
  const params = new URLSearchParams({ lat: center.latitude, long: center.longitude, radius, per_page: '25', limite_matching_etablissements: '100', minimal: 'true', include: 'matching_etablissements' })
  // A geographic page is not a brand search: large chains can fill the first
  // pages before the requested name appears. Search the name upstream as well.
  if (keyword) {
    for (const key of ['lat', 'long', 'radius']) params.delete(key)
    params.set('q', keyword); params.set('etat_administratif', 'A')
  }
  if (config.codes?.length) params.set('activite_principale', config.codes.join(','))
  else if (config.sections.length) params.set('section_activite_principale', config.sections.join(','))
  const rows = []
  for (let page = 1; page <= 3; page++) {
    params.set('page', String(page))
    const payload = await json(`https://recherche-entreprises.api.gouv.fr/${keyword ? 'search' : 'near_point'}?${params}`, 10000)
    for (const company of payload.results || []) for (const site of company.matching_etablissements || []) {
      const result = normaliseAnnuaire(company, site, center, radius, domain, keyword)
      if (result) rows.push(result)
    }
    if ((payload.results || []).length < 25 || page >= payload.total_pages) break
  }
  return rows
}
export function overpassQuery(center, radius, domain, keyword = '') {
  const escape = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ')
  const values = (DOMAIN_TAG_VALUES[domain] || []).map(escape).join('|'), around = `around:${radius * 1000},${center.latitude},${center.longitude}`
  if (keyword.trim()) return `[out:json][timeout:15];(nwr(${around})["name"~"${escape(keyword.trim())}",i];nwr(${around})["brand"~"${escape(keyword.trim())}",i];);out center tags 300;`
  const selector = domain === 'Autre' ? '[~"^(office|shop|craft|amenity)$"~"."]' : `[~"^(${categoryKeys.join('|')})$"~"^(${values})$",i]`
  return `[out:json][timeout:15];nwr(${around})["name"]${selector};out center tags 500;`
}
async function osm(center, radius, domain, keyword) {
  const query = overpassQuery(center, radius, domain, keyword)
  // PikaMap hosts a France-wide Overpass extract and allows browser requests.
  // Query it first; the global instances are fallbacks when it is unavailable.
  const endpoints = ['https://api-overpass.pikamap.fr/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
  for (const endpoint of endpoints) {
    try {
      const payload = await json(`${endpoint}?data=${encodeURIComponent(query)}`, 9000)
      if (!Array.isArray(payload.elements)) throw new Error('Réponse cartographique invalide')
      return payload.elements.map(row => normaliseOsm(row, center, radius, domain, keyword)).filter(Boolean)
    } catch (error) {
      if (endpoint === endpoints.at(-1)) throw error
    }
  }
}
export async function searchCompanies(location, domain, onProgress = () => {}) {
  if (!DOMAIN_CONFIG[domain]) throw new Error('Choisis un domaine dans la liste pour cibler ta recherche.')
  const radius = Number(location.radius), keyword = String(location.keyword || '').trim().slice(0, 80)
  if (!Number.isFinite(radius) || radius < 1 || radius > 50) throw new Error('Choisis un rayon entre 1 et 50 km.')
  const center = location.latitude == null || location.longitude == null ? await resolveCity(location.city) : { latitude: Number(location.latitude), longitude: Number(location.longitude) }
  if (!Number.isFinite(center.latitude) || !Number.isFinite(center.longitude) || Math.abs(center.latitude) > 90 || Math.abs(center.longitude) > 180) throw new Error('Position invalide. Sélectionne à nouveau une ville.')
  const key = JSON.stringify([center.latitude, center.longitude, radius, domain, fold(keyword)]), cached = cache.get(key)
  if (cached && Date.now() - cached.time < 300000) return cached.value
  onProgress({ value: 15, message: 'On fait chauffer la carte…' })
  const sources = new Array(2)
  const publish = () => {
    const ready = sources.filter(Boolean)
    const companies = rankCompanies(dedupe(ready.flatMap(result => result.status === 'fulfilled' ? result.value : [])))
    onProgress({ value: 15 + ready.length * 35, message: `${companies.length} entreprise${companies.length > 1 ? 's' : ''} repérée${companies.length > 1 ? 's' : ''}…`, companies, center })
  }
  await Promise.all([annuaire(center, radius, domain, keyword), osm(center, radius, domain, keyword)].map((promise, index) => promise.then(
    value => { sources[index] = { status:'fulfilled', value }; publish() },
    reason => { sources[index] = { status:'rejected', reason }; publish() }
  )))
  if (sources.every(result => result.status === 'rejected')) throw new Error('Les sources sont momentanément indisponibles. Réessaie dans un instant.')
  onProgress({ value: 85, message: 'On garde les bonnes adresses.' })
  const companies = rankCompanies(dedupe(sources.flatMap(result => result.status === 'fulfilled' ? result.value : [])))
  const value = { companies, center, partial: sources.some(result => result.status === 'rejected'), unavailableSource:sources[0].status === 'rejected' ? 'annuaire' : sources[1].status === 'rejected' ? 'cartographie' : null }
  if (!value.partial) cache.set(key, { time: Date.now(), value })
  onProgress({ value: 100, message: 'À toi de jouer !' })
  return value
}
export const rankCompanies = companies => companies.sort((a, b) =>
  (b._score + (b.email ? 5 : b.website ? 2 : 0)) - (a._score + (a.email ? 5 : a.website ? 2 : 0)) || a.distance - b.distance
).slice(0, 100)
export async function findCompanyEmails(companies, signal, onSearchLimited = () => {}) {
  if (!companies.length || companies.length > 5) throw new Error('Choisis jusqu’à cinq entreprises à rechercher.')
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch('/api/find-emails', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ companies }), signal: signal ? AbortSignal.any([controller.signal, signal]) : controller.signal })
    if (!response.ok) throw new Error('Recherche de contact indisponible. Consulte directement le site de l’entreprise.')
    const payload = await response.json(), results = new Map((payload.results || []).map(result => [result.id, result]))
    if (payload.searchLimited) onSearchLimited()
    return companies.map(company => {
      const result = results.get(company.id)
      return result?.emails?.length ? { ...company, website:result.website || company.website, email:result.emails[0], contactSource:result.source } : result?.website ? { ...company, website:result.website } : company
    })
  } finally { clearTimeout(timer) }
}

export async function findCompanyEmail(company, signal) {
  if (!company.website) throw new Error('Aucun site officiel renseigné. Consulte la fiche source pour contacter cette entreprise.')
  return (await findCompanyEmails([company], signal))[0]
}
