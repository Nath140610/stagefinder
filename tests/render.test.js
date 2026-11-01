import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { initial, STEPS } from '../src/state/flow.js'
import { DOMAIN_CONFIG, DOMAIN_TAG_VALUES, DOMAIN_NAF, DOMAIN_PARENT } from '../src/services/domainConfig.js'

test('every offered domain has both activity and map filters', () => {
  for (const domain of Object.keys(DOMAIN_CONFIG)) {
    assert.ok(DOMAIN_NAF[domain], domain)
    assert.ok(DOMAIN_TAG_VALUES[domain]?.length, domain)
  }
})

test('200 additional specialties appear in the domain list', () => {
  assert.equal(Object.keys(DOMAIN_PARENT).length, 200)
  assert.equal(Object.keys(DOMAIN_CONFIG).length, 266)
  assert.equal(new Set(Object.keys(DOMAIN_CONFIG)).size, 266)
})
test('landing and all flow screens render without runtime errors', async () => {
  const vite = await createServer({ server:{ middlewareMode:true, hmr:false }, appType:'custom' })
  try {
    const { default:Landing } = await vite.ssrLoadModule('/src/features/landing/Landing.jsx')
    const { default:Flow } = await vite.ssrLoadModule('/src/features/flow/Flow.jsx')
    const { Profile } = await vite.ssrLoadModule('/src/features/flow/Steps1.jsx')
    const landing = renderToStaticMarkup(React.createElement(Landing, { onStart:()=>{} }))
    assert.match(landing, /Trouver mon stage !/)
    assert.doesNotMatch(landing, /Se connecter avec Google/)
    const editor = renderToStaticMarkup(React.createElement(Profile, { s:{ ...initial, profile:{ ...initial.profile, description:'Bonjour [ENTREPRISE] et après ce mot' } }, d:()=>{} }))
    assert.match(editor, /Bonjour \[ENTREPRISE\] et après ce mot/)
    assert.match(editor, /mail-editor-backdrop/)
    assert.match(editor, /class="intelligence-token"/)
    assert.match(editor, /<textarea[^>]*>Bonjour \[ENTREPRISE\] et après ce mot<\/textarea>/)
    const company = { id:'one', name:'Entreprise Exemple', sourceUrl:'https://example.com', distance:1 }
    for (let step = 0; step < STEPS.length; step++) {
      const state = { ...initial, view:'flow', step, profile:{ ...initial.profile, name:'Camille', domain:'Hôtellerie et restauration', description:'Bonjour [ENTREPRISE]' }, companies:[company], selected:['one'], emailProvider:'manual' }
      const html = renderToStaticMarkup(React.createElement(Flow, { s:state, d:()=>{} }))
      assert.ok(html.length > 100, STEPS[step])
      const visibleText = html.replace(/<[^>]*>/g, '')
      assert.doesNotMatch(visibleText, /[a-zA-Z]\?[a-zA-Z]/, STEPS[step])
      assert.doesNotMatch(visibleText, /Paiement simulé|Payer avec/, STEPS[step])
      assert.doesNotMatch(visibleText, /Continuer sans connexion/, STEPS[step])
    }
  } finally { await vite.close() }
})
test('legal pages and purchase warnings are published', async () => {
  const vite = await createServer({ server:{ middlewareMode:true, hmr:false }, appType:'custom' })
  try {
    const { default:LegalPage, LEGAL_PATHS } = await vite.ssrLoadModule('/src/features/legal/Legal.jsx')
    const { default:Payment } = await vite.ssrLoadModule('/src/features/flow/Payment.jsx')
    assert.deepEqual(Object.keys(LEGAL_PATHS), ['/mentions-legales', '/cgv', '/confidentialite'])
    const terms = renderToStaticMarkup(React.createElement(LegalPage, { path:'/cgv' }))
    assert.match(terms, /Formulaire de rétractation/)
    assert.match(terms, /médiateur de la consommation/)
    assert.match(renderToStaticMarkup(React.createElement(LegalPage, { path:'/confidentialite' })), /Limited Use/)
    const payment = renderToStaticMarkup(React.createElement(Payment, { s:{ ...initial, selected:['a'] }, d:()=>{} }))
    assert.match(payment, /Aucune garantie de résultat/)
    assert.match(payment, /Ton compte Google est indispensable/)
    assert.match(payment, /Commander avec obligation de paiement/)
    assert.equal(payment.match(/type="checkbox"/g).length, 4)
    assert.doesNotMatch(payment, /checked=/)
  } finally { await vite.close() }
})
test('the dashboard works without reading the mailbox', async () => {
  const vite = await createServer({ server:{ middlewareMode:true, hmr:false }, appType:'custom' })
  try {
    const { default:Dashboard } = await vite.ssrLoadModule('/src/features/dashboard/Dashboard.jsx')
    const html = renderToStaticMarkup(React.createElement(Dashboard, { s:{ ...initial, applications:[{ companyId:'a', companyName:'Alpha', status:'En attente', sentAt:'2026-11-01T10:00:00Z' }] }, d:()=>{} }))
    assert.match(html, /Alpha/)
    assert.match(html, /Voir mes réponses dans Gmail/)
    assert.doesNotMatch(html, /Vérifier les réponses/)
  } finally { await vite.close() }
})
