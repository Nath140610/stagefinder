import { useEffect, useRef, useState } from 'react'
import { Button, Check } from '../../components/ui.jsx'
import { STEPS } from '../../state/flow.js'
import { accountExpired, sendApplications, personaliseMail, trackingEnabled } from '../../services/googleAuth.js'
import GoogleSignIn from '../../components/GoogleSignIn.jsx'

function Drop({ label, file, onFile }) {
  const ref = useRef()
  const [status, setStatus] = useState('')
  const [preview, setPreview] = useState('')

  useEffect(() => {
    if (!file?.file) return undefined
    const url = URL.createObjectURL(file.file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const add = async (incomingFile) => {
    if (!incomingFile) return
    setStatus('Conversion en PDF…')
    try {
      if (incomingFile.size > 8 * 1024 * 1024) throw new Error('Choisis un fichier de moins de 8 Mo.')
      const { convertToPdf } = await import('../../services/pdf.js')
      const result = await convertToPdf(incomingFile)
      onFile({ name:result.file.name, file:result.file, converted:result.converted })
      setStatus(result.converted ? 'Converti en PDF' : 'PDF prêt')
    } catch (error) {
      setStatus(error.message)
    }
  }

  return <div className={`drop ${file ? 'done' : ''}`} role="button" tabIndex={0} aria-label={`Ajouter ${label}`} onKeyDown={event => { if (event.target === event.currentTarget && ['Enter',' '].includes(event.key)) { event.preventDefault(); ref.current.click() } }} onClick={() => ref.current.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); add(event.dataTransfer.files[0]) }}>
    <input ref={ref} type="file" hidden accept=".pdf,.docx,.txt,image/*" onChange={(event) => add(event.target.files[0])}/>
    {file ? <><Check/><div><h4>{label}</h4><p>{file.name}</p></div></> : <div><h4>{label}</h4><p>Glisse un fichier ou clique pour parcourir</p></div>}
    {status && <span className="file-status">{status}</span>}
    {preview && <div className="document-preview" onClick={(event) => event.stopPropagation()}><div className="preview-label"><span>Aperçu de {label}</span><a href={preview} target="_blank" rel="noreferrer">Ouvrir</a></div><iframe title={`Aperçu ${label}`} src={preview}/></div>}
  </div>
}

export function Documents({ s, d, embedded=false }) {
  return <section className={embedded ? 'documents-section' : ''}>
    {embedded ? <div className="documents-heading"><h3>Tes pièces jointes</h3><p>Ajoute-les pour l’envoi Gmail, ou joins-les toi-même dans ta messagerie.</p></div> : <><h2>Tes pièces jointes</h2><p className="sub">Ajoute-les pour l’envoi Gmail, ou joins-les toi-même dans ta messagerie.</p></>}
    <div className="form">
      <Drop label="CV (PDF requis)" file={s.cv} onFile={(value) => d({ type:'put', key:'cv', value })}/>
      <Drop label="Lettre de motivation (PDF requise)" file={s.letter} onFile={(value) => d({ type:'put', key:'letter', value })}/>
      <small className="document-names">À l’envoi : <b>CV_{s.profile.name || 'Nom de la personne'}.pdf</b> et <b>Lettre de motivation_{s.profile.name || 'Nom de la personne'}.pdf</b>.</small>
    </div>
  </section>
}

export function Summary({ s, d }) {
  const p = s.profile
  const rows = [
    ['Nom', p.name || '—', 0],
    ['Profil', `${p.level || '—'} · ${p.domain || '—'}`, 0],
    ['Dates', p.start ? `${p.start} → ${p.end || '…'}` : '—', 0],
    ['Contenu du mail', p.description ? 'Prêt à être personnalisé' : 'Non renseigné', 0],
    ['Zone', `${s.location.city} · ${s.location.radius} km`, 1],
    ['Entreprises', `${s.selected.length} sélectionnée${s.selected.length > 1 ? 's' : ''}`, 2],
    ['CV', s.cv?.name || 'Non ajouté', STEPS.indexOf('summary')],
    ['Lettre', s.letter?.name || 'Non ajoutée', STEPS.indexOf('summary')]
  ]
  return <><h2>Récapitulatif</h2><p className="sub">{s.payment?.status === 'paid' ? 'Paiement confirmé. Tu peux encore ajouter tes documents.' : 'Tu peux modifier chaque partie avant de continuer.'}</p><div className="card sum recap">{rows.map(([key, value, step], index) => <div key={key} className="rise" style={{ '--i':index }}><span>{key}</span><b>{value}</b>{s.payment?.status !== 'paid' && <button className="edit-link" onClick={() => d({ type:'goto', step })}>Modifier</button>}</div>)}</div><Documents s={s} d={d} embedded /></>
}

export function EmailConnect({ s, d }) {
  const gmailEnabled = import.meta.env.VITE_ENABLE_GMAIL === 'true' || import.meta.env.DEV
  const connected = !accountExpired(s.emailAccount)
  const connect = account => {
    d({ type:'put', key:'emailProvider', value:'Google' })
    d({ type:'put', key:'emailAccount', value:account })
  }
  return <div className="email-connect"><div className="mail-orbit">✉</div><h2>Ton compte. Tes candidatures. Un seul envoi.</h2><p className="sub">Paiement confirmé. Connecte Google : Stage Finder enverra un e-mail personnalisé à chaque entreprise sélectionnée, avec ton CV et ta lettre, lorsque tu lanceras l’envoi.</p>{gmailEnabled && <>{connected && <p className="notice">Compte connecté : <b>{s.emailAccount.email}</b></p>}<GoogleSignIn onConnect={connect} label={connected ? 'Changer de compte Google' : 'Se connecter avec Google'} />{connected && <Button disabled={!s.cv || !s.letter} onClick={() => { d({ type:'put', key:'emailProvider', value:'Google' }); d({ type:'next' }) }}>Vérifier mes candidatures avant l’envoi</Button>}{(!s.cv || !s.letter) && <small>Ajoute ton CV et ta lettre dans le récapitulatif pour l’envoi automatique.</small>}<small>Seule l’autorisation d’envoyer des e-mails est demandée. Garde cette page ouverte pendant les envois.</small></>}<Button variant="ghost" onClick={() => d({ type:'back' })}>Retour au paiement</Button></div>
}

export function Preparation({ s, d }) {
  const total = s.selected.length
  const [done, setDone] = useState(0)
  useEffect(() => {
    setDone(total)
    d({ type:'put', key:'prepared', value:total > 0 })
  }, [total, d])
  const text = done === total ? 'Tout est prêt !' : done ? 'Vérification des entreprises…' : 'Préparation de tes candidatures…'
  return <div className="prepare"><div className="findy-worker"><span>●</span><b>✉</b></div><h2>{text}</h2><p className="sub">Findy prépare tes documents, sans envoyer d’e-mail.</p><div className="prepare-count"><b>{done}</b><span> / {total}</span></div><div className="prepare-track"><i style={{ width:`${total ? done / total * 100 : 0}%` }}/></div><div className="prepare-list">{s.companies.filter((company) => s.selected.includes(company.id)).map((company, index) => <div key={company.id} className={index < done ? 'ready' : ''}>{index < done ? '✓' : '○'} {company.name}</div>)}</div></div>
}

export function Success({ s, d, onNext }) {
  const sendingRef = useRef(false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('')
  const [issue, setIssue] = useState(null)
  useEffect(() => {
    if (!sending) return
    const warn = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [sending])
  const applications = s.companies.filter((company) => s.selected.includes(company.id))
  const pending = applications.filter(company => company.email && !s.applications.some(sent => sent.companyId === company.id))
  const manual = s.emailProvider === 'manual'
  const copyMessage = async company => {
    try { await navigator.clipboard.writeText(personaliseMail(s.profile.description, company.name)); setStatus(`Message pour ${company.name} copié. Pense aux pièces jointes !`) }
    catch { setStatus('Copie indisponible : sélectionne le texte du message ci-dessous.') }
  }

  const send = async () => {
    if (sendingRef.current || issue?.uncertain) return
    if (accountExpired(s.emailAccount)) { setIssue({ reconnect:true }); setStatus('Reconnecte ton compte Google pour lancer les envois restants.'); return }
    sendingRef.current = true
    setSending(true)
    setIssue(null)
    setStatus('')
    try {
      const result = await sendApplications({
        accessToken:s.emailAccount?.accessToken,
        applications:pending,
        alreadySent:s.applications,
        candidateName:s.profile.name,
        content:s.profile.description,
        cv:s.cv,
        letter:s.letter,
        onProgress:({ sent, total, company, applications:sentSoFar }) => { d({ type:'put', key:'applications', value:[...s.applications, ...sentSoFar] }); setStatus(`Envoi ${sent}/${total} : ${company}`) }
      })
      d({ type:'put', key:'applications', value:[...s.applications, ...result.applications] })
      d({ type:'put', key:'testEmailSent', value:true })
      setStatus(`${result.sent} candidature${result.sent > 1 ? 's' : ''} envoyée${result.sent > 1 ? 's' : ''}.` + (result.trackingWarning ? ` ${result.trackingWarning}` : ''))
    } catch (reason) {
      setIssue(reason)
      setStatus(reason.message || 'Les e-mails n’ont pas pu être envoyés.')
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  if (manual) return <><span className="eyebrow">Le prochain pas est à toi</span><h2>Prêt à faire bonne impression ?</h2><p className="sub">Copie ton message, ouvre le contact et ajoute ton CV et ta lettre avant d’envoyer.</p><div className="manual-list">{applications.map(company => <article className="card" key={company.id}><h3>{company.name}</h3><p>{company.email || 'Pas d’e-mail public : consulte la fiche ou le site.'}</p><details><summary>Voir mon message personnalisé</summary><p className="mail-preview">{personaliseMail(s.profile.description, company.name)}</p></details><div className="manual-actions"><Button onClick={() => copyMessage(company)}>Copier le message</Button><a href={company.email ? `mailto:${company.email}?subject=${encodeURIComponent(`Candidature de stage — ${s.profile.name}`)}&body=${encodeURIComponent(personaliseMail(s.profile.description, company.name))}` : company.website || company.sourceUrl} target="_blank" rel="noreferrer">{company.email ? 'Ouvrir ma messagerie ↗' : 'Contacter l’entreprise ↗'}</a></div><small>Les pièces jointes doivent être ajoutées dans ta messagerie. Aucun envoi automatique.</small></article>)}</div>{status && <p role="status" className="notice">{status}</p>}<Button variant="ghost" onClick={() => d({ type:'goto', step:STEPS.indexOf('summary') })}>Modifier ma candidature</Button></>

  const complete = !pending.length && s.applications.length > 0
  return <div className="center success">
    <div className="findy-success">{complete ? '✓' : '✉'}</div>
    <h2>{complete ? 'Tes candidatures sont parties !' : 'Prêt à envoyer la première ?'}</h2>
    <p className="sub">Compte expéditeur : <b>{s.emailAccount?.email}</b></p>
    <div className={`test-send ${sending ? 'is-sending' : ''}`}>
      <b>{complete ? `${s.applications.length} candidature(s) envoyée(s)` : `${pending.length} candidature(s) à envoyer automatiquement`}</b>
      <p>Un e-mail par entreprise, ton message personnalisé et tes deux pièces jointes. Les pistes sans e-mail public restent disponibles en mode manuel.</p>
      <p className="helper-text">{trackingEnabled() ? 'Chaque e-mail contient une image de suivi pour détecter un chargement dans la messagerie du destinataire.' : 'Le suivi d’ouverture nécessite un site public en HTTPS ; il n’est pas actif sur localhost.'}</p>
      {pending.length > 0 && <p className="notice"><b>Envoi réel :</b> ces e-mails partiront de ton compte vers les entreprises ci-dessous et ne pourront pas être annulés.</p>}
      <details><summary>Vérifier les destinataires et les messages</summary>{pending.map(company => <div key={company.id}><b>{company.name} · {company.email}</b><p className="mail-preview">{personaliseMail(s.profile.description, company.name)}</p></div>)}</details>
      <p>Pièces jointes : {s.cv?.name || 'CV manquant'} · {s.letter?.name || 'Lettre manquante'}</p>
      {sending && <div className="mail-send-scene" aria-live="polite"><span className="send-envelope">✉</span><strong>Envoi des candidatures, une par une…</strong></div>}
      {status && <p role="status" className={issue ? 'auth-error' : 'success-message'}>{status}</p>}
      {issue?.uncertain && <div className="notice"><a href="https://mail.google.com/mail/u/0/#sent" target="_blank" rel="noreferrer">Vérifier mes messages envoyés dans Gmail ↗</a><p>Vérifie dans le compte {s.emailAccount?.email} si le dernier destinataire a déjà reçu sa candidature.</p><Button variant="ghost" onClick={() => { const company = applications.find(row => row.id === issue.companyId); if (company) d({ type:'put', key:'applications', value:[...s.applications, { companyId:company.id, companyName:company.name, companyEmail:company.email, recipientEmail:company.email, status:'En attente', sentAt:new Date().toISOString(), confirmedManually:true }] }); setIssue(null); setStatus('Message marqué comme envoyé après ta vérification.') }}>Oui, ce message figure dans mes envois</Button><Button variant="ghost" onClick={() => { setIssue(null); setStatus('Tu peux relancer les candidatures restantes.') }}>J’ai vérifié : ce message n’a pas été envoyé</Button></div>}
      {(issue?.reconnect || accountExpired(s.emailAccount)) && !sending && <GoogleSignIn label="Reconnecter Google" onConnect={account => { d({ type:'put', key:'emailAccount', value:account }); setIssue(null); setStatus(`Compte connecté : ${account.email}. Tu peux reprendre l’envoi.`) }} />}
      <Button onClick={send} disabled={sending || !pending.length || issue?.uncertain || accountExpired(s.emailAccount) || !s.cv || !s.letter}>{complete ? 'Envoi terminé' : sending ? 'Envoi en cours…' : s.applications.length ? 'Envoyer les candidatures restantes' : 'Lancer l’envoi automatique'}</Button>
      {!pending.length && !complete && <p>Aucune adresse e-mail publique parmi les entreprises sélectionnées. Consulte leurs sites ou leurs fiches ci-dessous.</p>}
      <small>Garde cet onglet ouvert jusqu’à la fin. Les envois confirmés ne sont pas répétés lors d’une reprise.</small>
    </div>
    <Button variant="ghost" disabled={sending || issue?.uncertain} onClick={() => d({ type:'goto', step:STEPS.indexOf('email') })}>Changer de compte ou revenir</Button>
    <Button variant="ghost" disabled={sending || issue?.uncertain} onClick={() => d({ type:'put', key:'emailProvider', value:'manual' })}>Contacter mes autres pistes manuellement</Button>
    <Button variant="ghost" disabled={sending || issue?.uncertain} onClick={onNext}>Voir mes candidatures envoyées</Button>
  </div>
}
