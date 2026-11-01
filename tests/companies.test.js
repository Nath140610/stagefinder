import test from 'node:test'
import assert from 'node:assert/strict'
import { normaliseOsm, normaliseAnnuaire, dedupe, overpassQuery, searchCompanies, resolveCity } from '../src/services/companies.js'

const center = { latitude: 48.8566, longitude: 2.3522 }
const restaurant = { type: 'node', id: 1, lat: center.latitude, lon: center.longitude, tags: { name: 'Burger King', amenity: 'fast_food' } }
const sector = 'Hôtellerie et restauration'
test('a matching company without email is retained', () => {
  const result = normaliseOsm(restaurant, center, 10, sector, 'burger king')
  assert.equal(result.name, 'Burger King'); assert.equal(result.email, null)
})
test('a brand does not bypass the chosen sector', () => assert.equal(normaliseOsm(restaurant, center, 10, 'Informatique et numérique', 'Burger King'), null))
test('street names, substring it, or unrelated metadata do not match IT', () => {
  for (const tags of [{ name: 'Petit Bistrot', amenity: 'restaurant' }, { name: 'Garage', shop: 'car_repair', 'addr:street': 'Rue du software', website: 'https://computer.fr' }]) {
    assert.equal(normaliseOsm({ ...restaurant, tags }, center, 10, 'Informatique et numérique'), null)
  }
})
test('closed and outside-radius businesses are removed before rounding distance', () => {
  assert.equal(normaliseOsm({ ...restaurant, lat: 49.5 }, center, 10, sector), null)
  assert.equal(normaliseOsm({ ...restaurant, tags: { ...restaurant.tags, 'disused:amenity': 'fast_food' } }, center, 10, sector), null)
})
test('different branches with a shared SIREN survive deduplication', () => {
  const first = { id:'siret-1', companyId:'123', name:'Burger King', ...center }
  assert.equal(dedupe([first, { ...first, id:'siret-2', latitude:48.87 }]).length, 2)
})
test('nearby companies do not inherit their neighbour’s email', () => {
  const first = { id:'1', name:'Agence Alpha', ...center, email:null }
  const rows = dedupe([first, { ...first, id:'2', name:'Restaurant Bravo', email:'contact@bravo.fr' }])
  assert.equal(rows.length, 2); assert.equal(rows[0].email, null)
})
test('official establishment activity and active status are mandatory', () => {
  const company = { siren:'123', nom_complet:'Example', activite_principale:'62.01Z' }
  const site = { siret:'12300001', ...center, etat_administratif:'A', activite_principale:'56.10C' }
  assert.equal(normaliseAnnuaire(company, site, center, 10, 'Informatique et numérique'), null)
  assert.equal(normaliseAnnuaire(company, { ...site, etat_administratif:'F' }, center, 10, sector), null)
  assert.equal(normaliseAnnuaire(company, { ...site, latitude:null }, center, 10, sector), null)
})
test('employers rank ahead of sole traders at the same distance', () => {
  const site = { siret:'12300001', ...center, etat_administratif:'A', activite_principale:'62.01Z' }
  const solo = normaliseAnnuaire({ nom_complet:'Individual', nature_juridique:'1000' }, site, center, 10, 'Informatique et numérique')
  const employer = normaliseAnnuaire({ nom_complet:'Studio', categorie_entreprise:'PME' }, { ...site, siret:'12300002', caractere_employeur:'O' }, center, 10, 'Informatique et numérique')
  assert.ok(employer._score > solo._score)
})
test('Overpass activity expressions are anchored and brand input is escaped', () => {
  assert.match(overpassQuery(center, 10, 'Informatique et numérique'), /\^\(it\|computer/)
  assert.ok(overpassQuery(center, 10, sector, 'A.*"B').includes('A\\.\\*\\"B'))
})
test('invalid search criteria never call upstream services', async () => {
  await assert.rejects(searchCompanies({ ...center, radius:10 }, 'Unknown'), /domaine/)
  await assert.rejects(searchCompanies({ ...center, radius:100 }, sector), /rayon/)
})
test('partial failures retain available results and disclose the failure', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async url => {
    if (url.includes('recherche-entreprises')) throw new Error('offline')
    return { ok:true, json:async () => ({ elements:[restaurant] }) }
  }
  try {
    const result = await searchCompanies({ ...center, radius:3, keyword:'Burger King' }, sector)
    assert.equal(result.companies.length, 1); assert.equal(result.partial, true)
  } finally { globalThis.fetch = original }
})

test('France cartography uses the working Overpass endpoint without triggering the outage notice', async () => {
  const original = globalThis.fetch, requested = []
  globalThis.fetch = async url => {
    requested.push(String(url))
    return { ok:true, json:async () => url.includes('api-overpass.pikamap.fr') ? { elements:[restaurant] } : { results:[] } }
  }
  try {
    const result = await searchCompanies({ ...center, radius:4, keyword:'Burger King' }, sector)
    assert.equal(result.partial, false)
    assert.equal(result.companies[0].name, 'Burger King')
    assert.ok(requested.some(url => url.includes('api-overpass.pikamap.fr')))
    assert.ok(!requested.some(url => url.includes('overpass-api.de')))
  } finally { globalThis.fetch = original }
})

test('official companies appear before the slower map source finishes', async () => {
  const original = globalThis.fetch, updates = []
  let finishMap
  globalThis.fetch = url => url.includes('api-overpass.pikamap.fr')
    ? new Promise(resolve => { finishMap = resolve })
    : Promise.resolve({ ok:true, json:async () => ({ results:[{ nom_complet:'Restaurant du Centre', matching_etablissements:[{ siret:'progress-1', etat_administratif:'A', activite_principale:'56.10C', ...center }] }] }) })
  try {
    const pending = searchCompanies({ ...center, radius:7 }, sector, update => updates.push(update))
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.equal(updates.find(update => update.companies?.length)?.companies[0].name, 'Restaurant du Centre')
    finishMap({ ok:true, json:async () => ({ elements:[] }) })
    assert.equal((await pending).companies.length, 1)
  } finally { globalThis.fetch = original }
})

test('public contacts remain visible when official results fill the 100-place limit', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async url => url.includes('api-overpass.pikamap.fr')
    ? { ok:true, json:async () => ({ elements:[{ ...restaurant, tags:{ ...restaurant.tags, email:'contact@burgerking.example' } }] }) }
    : { ok:true, json:async () => ({ results:[{ nom_complet:'Restaurants', matching_etablissements:Array.from({ length:101 }, (_, index) => ({ siret:`restaurant-${index}`, nom_commercial:`Restaurant ${index}`, etat_administratif:'A', activite_principale:'56.10C', caractere_employeur:'O', ...center })) }] }) }
  try {
    const result = await searchCompanies({ ...center, radius:8 }, sector)
    assert.equal(result.companies.length, 100)
    assert.equal(result.companies[0].email, 'contact@burgerking.example')
  } finally { globalThis.fetch = original }
})
test('brand searches send the name upstream and still enforce the geographic radius', async () => {
  const original = globalThis.fetch, requested = []
  globalThis.fetch = async url => {
    requested.push(String(url))
    if (url.includes('overpass')) return { ok:true, json:async () => ({ elements:[] }) }
    return { ok:true, json:async () => ({ results:[{ nom_complet:'Burger King', matching_etablissements:[{ siret:'a', etat_administratif:'A', activite_principale:'56.10C', ...center }, { siret:'b', etat_administratif:'A', activite_principale:'56.10C', latitude:43, longitude:2 }] }] }) }
  }
  try {
    const result = await searchCompanies({ ...center, radius:2, keyword:'Burger King' }, sector)
    assert.equal(result.companies.length, 1)
    assert.ok(requested.some(url => url.includes('/search?') && new URL(url).searchParams.get('q') === 'Burger King'))
  } finally { globalThis.fetch = original }
})
test('a total outage is an error, not an empty success', async () => {
  const original = globalThis.fetch; globalThis.fetch = async () => { throw new Error('offline') }
  try { await assert.rejects(searchCompanies({ ...center, radius:4 }, sector), /indisponibles/) }
  finally { globalThis.fetch = original }
})
test('ambiguous city names require an explicit selection', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => ({ ok:true, json:async () => [1,2].map(id => ({ nom:'Saint-Pierre', centre:{ coordinates:[id,48] }, codesPostaux:['12345'] })) })
  try { await assert.rejects(resolveCity('Saint-Pierre'), /Plusieurs villes/) }
  finally { globalThis.fetch = original }
})
