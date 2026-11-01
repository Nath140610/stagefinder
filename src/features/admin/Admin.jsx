import { useEffect, useState } from 'react'
import Logo from '../../components/Logo.jsx'
import { Button } from '../../components/ui.jsx'

const euro = cents => new Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR' }).format(cents / 100)
async function request(path, body) {
  const response = await fetch(`/api/admin/${path}`, body ? { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(body) } : undefined)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Service indisponible.')
  return result
}

export default function Admin() {
  const [password, setPassword] = useState(''), [label, setLabel] = useState('')
  const [stats, setStats] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [copied, setCopied] = useState('')
  const refresh = () => request('stats').then(data => { setStats(data); setError('') }).catch(reason => { setError(reason.message); setStats(null) }).finally(() => setLoading(false))
  useEffect(() => { refresh() }, [])
  const login = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try { await request('login', { password }); setPassword(''); await refresh() }
    catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }
  const logout = async () => { await request('logout', {}).catch(() => {}); setStats(null); setError('') }
  const create = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try { await request('links', { label }); setLabel(''); await refresh() }
    catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }
  const copy = async code => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/r/${code}`); setCopied(code); setTimeout(() => setCopied(''), 1800) }
    catch { setError('Copie impossible. Sélectionne le lien affiché.') }
  }
  const maxVisits = Math.max(1, ...(stats?.byDay || []).map(day => day.visits))
  return <div className="admin-page">
    <header className="admin-header"><Logo /><a href="/">Voir le site ↗</a></header>
    <main className="admin-main">
      <div className="admin-heading"><div><span className="eyebrow">Stage Finder</span><h1>Administration</h1><p>Visites, formulaires et paiements confirmés.</p></div>{stats && <Button variant="ghost" onClick={logout}>Déconnexion</Button>}</div>
      {loading ? <p role="status">Chargement des statistiques…</p> : !stats ? <form className="admin-login card" onSubmit={login}><h2>Accès protégé</h2><p>Saisis le mot de passe administrateur.</p><label htmlFor="admin-password">Mot de passe</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /><Button disabled={busy} type="submit">{busy ? 'Connexion…' : 'Se connecter'}</Button>{error && <p className="auth-error" role="alert">{error}</p>}</form> : <>
        <div className="admin-toolbar"><p>Visites uniques par onglet · abandon au paiement après 30 minutes ou annulation.</p><Button variant="ghost" onClick={refresh}>Actualiser</Button></div>
        <section className="admin-metrics" aria-label="Indicateurs"><article><span>Visites</span><strong>{stats.visits}</strong></article><article><span>Formulaires commencés</span><strong>{stats.formsStarted}</strong></article><article><span>Formulaires remplis</span><strong>{stats.formsCompleted}</strong></article><article><span>Arrivées au paiement</span><strong>{stats.paymentViewed}</strong></article><article><span>Abandons au paiement</span><strong>{stats.abandonedAtPayment}</strong></article><article><span>Paiements réels</span><strong>{stats.livePayments}</strong></article><article><span>Total payé (brut)</span><strong>{euro(stats.liveRevenueCents)}</strong></article><article><span>Paiements test</span><strong>{stats.testPayments}</strong></article><article><span>Montant test</span><strong>{euro(stats.testRevenueCents)}</strong></article></section>
        <section className="admin-panel"><div className="admin-section-heading"><div><h2>Les 14 derniers jours</h2><p>Visites par jour, sans données personnelles.</p></div></div><div className="admin-chart" role="img" aria-label="Visites des 14 derniers jours">{stats.byDay.map(day => <div key={day.date} title={`${day.date} · ${day.visits} visite(s) · ${day.forms} formulaire(s) · ${day.payments} paiement(s)`}><span style={{ height:`${Math.max(4, day.visits / maxVisits * 100)}%` }} /><small>{day.date.slice(8)}</small></div>)}</div></section>
        <section className="admin-panel"><div className="admin-section-heading"><div><h2>Liens de visite</h2><p>Chaque lien affiche ses visites dans ce tableau.</p></div></div><form className="admin-link-form" onSubmit={create}><label htmlFor="link-label">Nom du lien</label><div><input id="link-label" maxLength="60" value={label} onChange={event => setLabel(event.target.value)} placeholder="Exemple : Instagram novembre" required /><Button disabled={busy || label.trim().length < 2} type="submit">Créer un lien</Button></div></form>{error && <p className="auth-error" role="alert">{error}</p>}<div className="admin-link-list">{stats.links.length ? stats.links.map(link => <article key={link.code}><div><b>{link.label}</b><span>{link.visits} visite{link.visits > 1 ? 's' : ''} depuis ce lien</span><code>{window.location.origin}/r/{link.code}</code></div><Button variant="ghost" onClick={() => copy(link.code)}>{copied === link.code ? 'Copié ✓' : 'Copier'}</Button></article>) : <p>Aucun lien créé pour le moment.</p>}</div></section>
        <p className="admin-footnote">Les chiffres de visite et de formulaire sont indicatifs. Les paiements sont enregistrés après vérification de la session auprès de Stripe. {stats.pendingAtPayment} personne{stats.pendingAtPayment > 1 ? 's' : ''} au paiement depuis moins de 30 minutes ; {stats.checkouts} page{stats.checkouts > 1 ? 's' : ''} Stripe ouverte{stats.checkouts > 1 ? 's' : ''}.</p>
      </>}
    </main>
  </div>
}
