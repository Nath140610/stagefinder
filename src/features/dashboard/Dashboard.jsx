import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui.jsx'
import { STEPS } from '../../state/flow.js'
import { refreshOpenStatuses } from '../../services/googleAuth.js'

const STATUS_CLASS = { 'En attente':'pending', 'Accepté':'accepted', 'Refusé':'refused' }
const dateTime = (value) => value ? new Intl.DateTimeFormat('fr-FR', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value)) : ''

export default function Dashboard({ s, d }) {
  const [activeId, setActiveId] = useState(null)
  const [checkingOpens, setCheckingOpens] = useState(false)
  const [message, setMessage] = useState('')
  const applications = s.applications || []
  const latestApplications = useRef(applications)
  useEffect(() => { latestApplications.current = applications }, [applications])
  const hasPublicTracker = applications.some(application => application.trackingToken)
  const active = applications.find((application) => application.companyId === activeId)
  const totals = {
    pending:applications.filter((application) => application.status === 'En attente').length,
    accepted:applications.filter((application) => application.status === 'Accepté').length,
    refused:applications.filter((application) => application.status === 'Refusé').length,
    seen:applications.filter((application) => application.seenAt).length
  }
  const stats = [
    ['En attente', totals.pending, 'pending'],
    ['Acceptées', totals.accepted, 'accepted'],
    ['Refusées', totals.refused, 'refused'],
    ['Signaux d’ouverture', totals.seen, 'seen']
  ]

  const checkOpens = async (silent = false) => {
    const current = latestApplications.current
    if (!current.some(application => application.trackingToken)) return
    if (!silent) setCheckingOpens(true)
    try {
      const refreshed = await refreshOpenStatuses(current)
      if (refreshed.some((application, index) => application.seenAt !== current[index].seenAt || application.opens !== current[index].opens)) d({ type:'put', key:'applications', value:refreshed })
      if (!silent) setMessage('Signaux d’ouverture actualisés.')
    } catch (error) { if (!silent) setMessage(error.message || 'Suivi indisponible.') }
    finally { if (!silent) setCheckingOpens(false) }
  }
  useEffect(() => {
    checkOpens(true)
    const timer = setInterval(() => checkOpens(true), 30000)
    return () => clearInterval(timer)
  }, [])

  const setStatus = (companyId, status) => d({ type:'put', key:'applications', value:applications.map(application => application.companyId === companyId ? { ...application, status } : application) })

  return <>
    <Button variant="ghost" onClick={() => d({ type:"goto", step:STEPS.indexOf("success") })}>Retour à mes messages</Button>
    <div className="dashboard-heading"><div><h2>Tes candidatures</h2><p className="sub">Les réponses arrivent directement dans ta boîte Gmail ; les ouvertures sont des signaux liés au chargement des images.</p></div><div className="dashboard-actions"><Button variant="ghost" onClick={() => checkOpens()} disabled={checkingOpens || !hasPublicTracker}>{checkingOpens ? 'Vérification…' : '↻ Vérifier les ouvertures'}</Button><a className="gmail-link" href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noreferrer">Voir mes réponses dans Gmail ↗</a></div></div>
    {message && <p className={/^Signaux/.test(message) ? 'dashboard-message' : 'auth-error'}>{message}</p>}
    {!applications.length ? <div className="card dashboard-empty"><b>Aucun e-mail n’a encore été envoyé.</b><p>Envoie d’abord les candidatures depuis l’écran final pour suivre les ouvertures et les réponses.</p></div> : <>
      <div className="stats">{stats.map(([label, value, kind], index) => <div key={label} className={`card rise stat-${kind}`} style={{ '--i':index }}><span>{label}</span><b>{value}</b><div className="bar"><i style={{ '--w':`${applications.length ? value / applications.length * 100 : 0}%` }}/></div></div>)}</div>
      <p className="tracking-note">Stage Finder ne lit pas ta boîte mail : ouvre une candidature pour indiquer toi-même la réponse reçue. {hasPublicTracker ? 'Un signal d’ouverture signifie que l’image du message a été chargée ; son absence ne prouve pas que le message n’a pas été lu.' : 'Aucun pixel actif pour ces envois. Le suivi nécessite un domaine public en HTTPS.'}</p>
      <h3 className="dashboard-title">Suivi des entreprises</h3>
      <div className="application-list">{applications.map((application) => <button className={`application ${activeId === application.companyId ? 'active' : ''}`} key={application.companyId} onClick={() => setActiveId(application.companyId)}><div><b>{application.companyName}</b><p>Envoyée le {dateTime(application.sentAt)}</p></div><div className="application-badges"><span className={`status status-${STATUS_CLASS[application.status] || 'pending'}`}>{application.status || 'En attente'}</span><span className={`open-status ${application.seenAt ? 'opened' : ''}`}>{application.seenAt ? 'Image chargée' : 'Aucun signal'}</span></div></button>)}</div>
    </>}
    {active && <div className="application-detail card"><button className="detail-close" onClick={() => setActiveId(null)}>×</button><span className="eyebrow">Candidature {active.status?.toLowerCase()}</span><h3>{active.companyName}</h3><div><b>Signal d’ouverture</b><span>{active.seenAt ? `Image chargée le ${dateTime(active.seenAt)}` : 'Aucun chargement détecté'}</span></div><div><b>Réponse reçue</b><span>{Object.keys(STATUS_CLASS).map(status => <button key={status} className="status-choice" aria-pressed={(active.status || 'En attente') === status} onClick={() => setStatus(active.companyId, status)}>{(active.status || 'En attente') === status ? `✓ ${status}` : status}</button>)}</span></div><div><b>Compte Google</b><span>{s.emailAccount?.email || s.emailProvider || 'Non défini'}</span></div></div>}
  </>
}
