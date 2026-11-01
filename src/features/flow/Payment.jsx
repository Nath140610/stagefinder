import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui.jsx'
import { selectionKey } from '../../state/flow.js'
import { analyticsSessionId } from '../../services/analytics.js'

const euro = cents => new Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR' }).format(cents / 100)
const endpoint = async (url, payload) => {
  const response = await fetch(url, payload ? { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(payload) } : undefined)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Paiement indisponible.')
  return result
}
const draftKey = 'stagefinder-checkout-draft'
const idsFor = selected => [...selected].sort()

export default function Payment({ s, d }) {
  const [configured, setConfigured] = useState(null), [mode, setMode] = useState('test'), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const verifying = useRef(false), creating = useRef(false), selected = idsFor(s.selected), count = selected.length, key = selectionKey(selected)
  const payment = s.payment?.selectionKey === key ? s.payment : null
  useEffect(() => {
    endpoint('/api/payment/config').then(result => { setConfigured(result.configured); setMode(result.mode) }).catch(() => { setConfigured(false); setError('Le service de paiement ne répond pas.') })
  }, [])
  useEffect(() => {
    if (!payment?.sessionId || payment.status === 'paid') return
    let mounted = true
    const verify = async () => {
      if (verifying.current || document.visibilityState === 'hidden') return
      verifying.current = true
      try {
        const result = await endpoint('/api/payment/verify', { sessionId:payment.sessionId, ids:selected, nonce:payment.nonce })
        if (!mounted) return
        if (result.paid) {
          const confirmed = { ...payment, status:'paid' }
          d({ type:'put', key:'payment', value:confirmed })
          const raw = sessionStorage.getItem(draftKey)
          if (raw) { try { const draft = JSON.parse(raw); sessionStorage.setItem(draftKey, JSON.stringify({ ...draft, payment:confirmed })) } catch {} }
          setError('')
        } else if (result.status === 'mismatch') setError('Ce paiement ne correspond pas à ta sélection. Reviens à la recherche avant de réessayer.')
        else if (result.sessionStatus === 'expired') { d({ type:'put', key:'payment', value:null }); setError('La session Stripe a expiré. Ouvre un nouveau paiement.') }
      } catch (reason) { if (mounted) setError(reason.message) }
      finally { verifying.current = false }
    }
    verify()
    const timer = setInterval(verify, 3500)
    window.addEventListener('focus', verify)
    return () => { mounted = false; clearInterval(timer); window.removeEventListener('focus', verify) }
  }, [payment?.sessionId, payment?.status, key])
  const checkout = async () => {
    if (!count || creating.current || !configured) return
    creating.current = true
    const popup = window.open('about:blank', '_blank')
    if (!popup) { creating.current = false; setError('Autorise les fenêtres de ce site pour ouvrir Stripe.'); return }
    popup.opener = null
    popup.document.write('<!doctype html><html lang="fr"><meta charset="utf-8"><title>Stripe</title><p style="font:18px system-ui;padding:40px">Ouverture du paiement Stripe…</p></html>')
    setBusy(true); setError('')
    try {
      const nonce = [...crypto.getRandomValues(new Uint8Array(24))].map(byte => byte.toString(16).padStart(2, '0')).join('')
      const result = await endpoint('/api/payment/checkout', { ids:selected, nonce, flowId:analyticsSessionId() })
      const details = { sessionId:result.sessionId, url:result.url, nonce, selectionKey:key, status:'checkout' }
      sessionStorage.setItem(draftKey, JSON.stringify({ profile:s.profile, location:s.location, companies:s.companies, selected:s.selected, payment:details, savedAt:Date.now() }))
      d({ type:'put', key:'payment', value:details })
      popup.location.href = result.url
    } catch (reason) { popup.close(); setError(reason.message) }
    finally { creating.current = false; setBusy(false) }
  }
  const cancel = async () => {
    if (!payment) return d({ type:'back' })
    if (payment.status === 'paid') return d({ type:'back' })
    setBusy(true); setError('')
    try {
      await endpoint('/api/payment/cancel', { sessionId:payment.sessionId, ids:selected, nonce:payment.nonce })
      d({ type:'put', key:'payment', value:null })
      sessionStorage.removeItem(draftKey)
      d({ type:'back' })
    } catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }
  const reopen = () => {
    const popup = window.open(payment.url, '_blank')
    if (!popup) setError('Autorise les fenêtres de ce site pour rouvrir Stripe.')
  }
  return <div className="payment stripe-payment">
    <span className="eyebrow">Avant la connexion Google</span>
    <h2>Prêt à passer à l’action ?</h2>
    <p className="sub">Vérifie ta sélection et règle tes candidatures sur la page sécurisée Stripe.</p>
    <div className="card pay"><div className="pay-line"><span>Préparation</span><b>{euro(200)}</b></div><div className="pay-line"><span>{count} entreprise{count > 1 ? 's' : ''} × {euro(50)}</span><b>{euro(50 * count)}</b></div><div className="pay-total"><span>Total à régler</span><b>{euro(200 + 50 * count)}</b></div><small>Un paiement unique, sans abonnement.</small>
      {mode === 'test' && configured && <p className="notice">Stripe fonctionne en mode test : aucun prélèvement réel.</p>}
      {configured === false && <p className="auth-error">Le paiement Stripe doit être configuré sur le serveur avant de pouvoir continuer.</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {payment?.status === 'paid' ? <><p className="success-message">Paiement confirmé directement auprès de Stripe.</p><Button onClick={() => !s.cv || !s.letter ? d({ type:'goto', step:3 }) : d({ type:'next' })}>{!s.cv || !s.letter ? 'Réajouter CV et lettre pour continuer' : 'Continuer vers Google ↗'}</Button></> : <><Button disabled={configured !== true || busy || !count} onClick={payment?.url ? reopen : checkout}>{busy ? 'Ouverture de Stripe…' : payment ? 'Rouvrir la page Stripe' : `Payer ${euro(200 + 50 * count)} avec Stripe ↗`}</Button>{payment && <p className="helper-text">Après le paiement, reviens ici. La confirmation se fait automatiquement. Garde cet onglet ouvert.</p>}</>}
    </div><Button variant="ghost" disabled={busy} onClick={cancel}>{payment?.status === 'checkout' ? 'Annuler ce paiement et modifier la sélection' : 'Retour au récapitulatif'}</Button>
  </div>
}

export function restoreCheckoutDraft() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null')
    if (!draft || Date.now() - draft.savedAt > 24 * 3600 * 1000 || !draft.payment?.sessionId) return null
    return { ...draft, payment:{ ...draft.payment, status:'checkout' } }
  } catch { return null }
}
