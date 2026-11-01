import { useEffect, useState } from 'react'
import { Button } from './ui.jsx'
import { connectGoogleAccount, loadGoogleIdentity } from '../services/googleAuth.js'

export default function GoogleSignIn({ onConnect, label = 'Se connecter avec Google', disabled = false }) {
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    loadGoogleIdentity().then(() => { if (active) setReady(true) }).catch(reason => { if (active) setError(reason.message) })
    return () => { active = false }
  }, [attempt])
  const connect = async () => {
    if (busy) return
    setBusy(true); setError('')
    try { onConnect(await connectGoogleAccount()) }
    catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }
  return <div className="google-signin"><Button variant="ghost" disabled={!ready || busy || disabled} onClick={connect}><span className="google-letter" aria-hidden="true">G</span>{busy ? 'Connexion…' : ready ? label : 'Chargement de Google…'}</Button>{error && <div className="auth-error" role="alert"><p>{error}</p>{!ready && <button onClick={() => { setError(''); setAttempt(value => value + 1) }}>Réessayer</button>}</div>}</div>
}
