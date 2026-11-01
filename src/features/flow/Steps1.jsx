import { useEffect, useRef, useState } from 'react'
import { Field, Button } from '../../components/ui.jsx'
import { searchCompanies, citySuggestions, findCompanyEmail, findCompanyEmails, safeWebsite, fold } from '../../services/companies.js'
import { DOMAIN_CONFIG, DOMAIN_PARENT } from '../../services/domainConfig.js'

const DOMAINS = Object.keys(DOMAIN_CONFIG).sort((a,b)=>a.localeCompare(b,'fr'))
const DEFAULT_CENTER = { latitude:48.8566, longitude:2.3522 }

function SearchMap({ location, companies }) {
  const ref = useRef(null)
  const [aspect, setAspect] = useState(1.4)
  useEffect(() => { const element = ref.current; if (!element) return undefined; const update = () => setAspect(element.clientWidth / element.clientHeight || 1.4); update(); const observer = new ResizeObserver(update); observer.observe(element); return () => observer.disconnect() }, [])
  const latitude = location.latitude ?? DEFAULT_CENTER.latitude, longitude = location.longitude ?? DEFAULT_CENTER.longitude, radius = location.radius
  const latDelta = (radius * 1.35) / 111.32, lonDelta = (radius * 1.35 * aspect) / (111.32 * Math.cos(latitude * Math.PI / 180))
  const url = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - lonDelta}%2C${latitude - latDelta}%2C${longitude + lonDelta}%2C${latitude + latDelta}&layer=mapnik&marker=${latitude}%2C${longitude}`
  const position = (company) => ({ left:Math.max(2, Math.min(98, ((company.longitude - (longitude - lonDelta)) / (2 * lonDelta)) * 100)), top:Math.max(2, Math.min(98, ((latitude + latDelta - company.latitude) / (2 * latDelta)) * 100)) })
  return <div className="search-map" ref={ref}><iframe title="Entreprises possibles dans votre zone" src={url} /><div className="search-zone" />{companies.map((company, index) => { const point = position(company); return <span key={company.id} className="building-pin" style={{ left:`${point.left}%`, top:`${point.top}%`, '--delay':`${Math.min(index, 8) * 120}ms` }} title={company.name}><i /></span> })}<div className="search-map-label">Entreprises dans un rayon de <b>{radius} km</b></div></div>
}

function MailEditor({ value, onChange }) {
  const backdrop = useRef(null)
  const content = String(value || '')
  return <div className="mail-editor mail-editor-simple">
    <div className="mail-editor-input">
      <div ref={backdrop} className="mail-editor-backdrop" aria-hidden="true">{content.split(/(\[ENTREPRISE\])/g).map((part, index) => part === '[ENTREPRISE]' ? <span key={index} className="intelligence-token" data-label="Personnalisé">{part}</span> : part)}{content.endsWith('\n') && '\u200b'}</div>
      <textarea required rows="8" aria-label="Contenu du mail" value={value} onChange={onChange} onScroll={event => { if (backdrop.current) { backdrop.current.scrollTop = event.currentTarget.scrollTop; backdrop.current.scrollLeft = event.currentTarget.scrollLeft } }} placeholder={'Bonjour [ENTREPRISE],\n\nJe vous contacte pour vous proposer ma candidature de stage…\n\nCordialement,'} />
    </div>
    {content.includes('[ENTREPRISE]') && <small className="mail-live-preview">[ENTREPRISE] sera remplacé par le nom de chaque entreprise à l’envoi.</small>}
  </div>
}

export function Profile({ s, d }) {
  const p = s.profile, [domainQuery, setDomainQuery] = useState(''), set = (k) => (e) => d({ type:'set', key:'profile', value:{ [k]: e.target.value } })
  const matchingDomains = DOMAINS.filter(domain => fold(domain).includes(fold(domainQuery)) || domain === p.domain)
  return (<>
    <h2>Parle-nous de ton stage</h2><p className="sub">Quelques infos pour cibler les bonnes entreprises.</p>
    <div className="form">
      <Field label="Nom et prénom"><input required value={p.name} onChange={set('name')} placeholder="Prénom Nom" /></Field>
      <Field label="Formation / classe"><input required value={p.level} onChange={set('level')} placeholder="Seconde, BTS SIO, L2…" /></Field>
      <Field label={`Domaine recherché (${matchingDomains.length} résultats)`}><div className="domain-search"><span aria-hidden="true">⌕</span><input aria-label="Rechercher un domaine" value={domainQuery} onChange={(e)=>setDomainQuery(e.target.value)} placeholder="Rechercher un domaine…" /></div><select required value={p.domain} onChange={set('domain')}><option value="">Choisis un domaine</option>{matchingDomains.map((domain)=><option key={domain} value={domain}>{domain}</option>)}</select></Field>
      {DOMAIN_PARENT[p.domain] && <small>Recherche fondée sur l’activité du secteur « {DOMAIN_PARENT[p.domain]} ». Vérifie la spécialité de chaque entreprise avant de postuler.</small>}
      <div className="row"><Field label="Début"><input required type="date" value={p.start} onChange={set('start')} /></Field>
        <Field label="Fin"><input required type="date" min={p.start || undefined} value={p.end} onChange={set('end')} /></Field></div>
      <Field label="Contenu du mail"><MailEditor value={p.description} onChange={set('description')} /></Field>
      {!p.description && <Button variant="ghost" onClick={() => d({ type:'set', key:'profile', value:{ description:`Bonjour [ENTREPRISE],\n\nActuellement en ${p.level || 'formation'}, je recherche un stage dans le domaine ${p.domain || 'qui m’intéresse'}. Je souhaiterais découvrir votre activité et contribuer aux missions de votre équipe.\n\nSeriez-vous disponible pour échanger sur les possibilités de stage ?\n\nMerci pour votre attention,\n${p.name}` } })}>Partir d’un modèle de message</Button>}
      <small className="mail-token-help">Écris <code>[ENTREPRISE]</code> dans ton message : il sera automatiquement remplacé par le nom de chaque entreprise lors de l’envoi.</small>
      <small>Tu ajouteras ton CV et ta lettre après avoir trouvé les entreprises.</small>
    </div></>)
}

export function Location({ s, d }) {
  const location = s.location
  const [suggestions, setSuggestions] = useState([]), [status, setStatus] = useState(''), [busy, setBusy] = useState(false)
  const request = useRef(0)
  const set = value => d({ type: 'set', key: 'location', value })
  useEffect(() => {
    const generation = ++request.current
    if (location.latitude != null) { setSuggestions([]); return }
    const timer = setTimeout(() => citySuggestions(location.city).then(rows => { if (request.current === generation) setSuggestions(rows) }).catch(() => { if (request.current === generation) setStatus('Suggestions indisponibles. Réessaie dans un instant.') }), 350)
    return () => { clearTimeout(timer); request.current++ }
  }, [location.city, location.latitude])
  const choose = row => { request.current++; set(row); setSuggestions([]); setStatus('Zone confirmée. À toi de régler le rayon !') }
  const locate = () => {
    if (!navigator.geolocation) { setStatus('Saisis une ville pour choisir ta zone.'); return }
    const generation = ++request.current
    setBusy(true); setStatus('On cherche ta position…')
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setBusy(false)
      if (generation !== request.current) return
      choose({ city: 'ma position', latitude: coords.latitude, longitude: coords.longitude })
    }, () => { setBusy(false); setStatus('Position inaccessible. Choisis une ville ci-dessous.'); }, { timeout: 10000, maximumAge: 300000 })
  }
  return <>
    <span className="eyebrow">Ton terrain de jeu</span><h2>Trouver mon stage !</h2>
    <p className="sub">Ta ville, ton rayon, tes possibilités. Le prochain arrêt, c’est peut-être ton stage.</p>
    {location.latitude != null ? <SearchMap location={location} companies={[]} /> : <div className="location-placeholder"><span aria-hidden="true">⌖</span><b>Tout commence par une bonne adresse.</b><p>Choisis ta ville pour afficher ta zone.</p></div>}
    <div className="form">
      <Field label="Ville ou code postal"><input autoComplete="off" value={location.city} onChange={event => { request.current++; set({ city: event.target.value, latitude: null, longitude: null }); setStatus('') }} placeholder="Paris, Lyon, 33000…" /></Field>
      {!!suggestions.length && <div className="city-suggestions" aria-label="Villes proposées">{suggestions.map(row => <button key={`${row.latitude}:${row.longitude}`} onClick={() => choose(row)}>{row.label}<span>Choisir →</span></button>)}</div>}
      <div><Button variant="ghost" onClick={locate} disabled={busy}>{busy ? 'Localisation…' : '⌖ Utiliser ma position'}</Button></div>
      {status && <p role="status" className="helper-text">{status}</p>}
      <Field label={`Rayon de recherche : ${location.radius} km`}><input type="range" min="1" max="50" value={location.radius} onChange={event => set({ radius: Number(event.target.value) })} /></Field>
      <Field label="Nom d’une entreprise (facultatif)"><input maxLength="80" value={location.keyword || ''} onChange={event => set({ keyword: event.target.value })} placeholder="Nom d’une entreprise…" /></Field>
      <p className="helper-text">L’entreprise recherchée doit aussi correspondre au domaine choisi.</p>
    </div>
  </>
}

export function Companies({ s, d }) {
  const [loading, setLoading] = useState(true), [progress, setProgress] = useState({ value: 5, message: 'On prépare le terrain…' })
  const [error, setError] = useState(''), [partial, setPartial] = useState(false), [unavailableSource, setUnavailableSource] = useState(null), [attempt, setAttempt] = useState(0)
  const [center, setCenter] = useState(s.location), [query, setQuery] = useState(''), [emailOnly, setEmailOnly] = useState(false)
  const [visibleCount, setVisibleCount] = useState(0), [contactScan, setContactScan] = useState({ total:0, done:0, found:0, running:false }), [searchLimited, setSearchLimited] = useState(false)
  const [activeId, setActiveId] = useState(null), [contactBusy, setContactBusy] = useState(false), [contactMessage, setContactMessage] = useState(''), [manualEmail, setManualEmail] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setVisibleCount(0); setContactScan({ total:0, done:0, found:0, running:false }); setProgress({ value: 5, message: 'On prépare le terrain…' })
    d({ type: 'put', key: 'selected', value: [] }); d({ type: 'put', key: 'companies', value: [] })
    searchCompanies(s.location, s.profile.domain, value => {
      if (!active) return
      setProgress({ value:value.value, message:value.message })
      if (value.companies) { d({ type:'put', key:'companies', value:value.companies }); setCenter({ ...s.location, ...value.center }) }
    }).then(result => {
      if (!active) return
      d({ type: 'put', key: 'companies', value: result.companies }); setCenter({ ...s.location, ...result.center }); setPartial(result.partial); setUnavailableSource(result.unavailableSource); setLoading(false)
    }).catch(reason => { if (active) { setError(reason.message); setLoading(false) } })
    return () => { active = false }
  }, [s.location.city, s.location.radius, s.location.latitude, s.location.longitude, s.location.keyword, s.profile.domain, attempt])
  useEffect(() => {
    if (visibleCount >= s.companies.length) return undefined
    const timer = setTimeout(() => setVisibleCount(count => Math.min(s.companies.length, count + 2)), 90)
    return () => clearTimeout(timer)
  }, [s.companies.length, visibleCount])
  useEffect(() => {
    if (loading || error) return undefined
    // Known websites first: they are the most likely to yield an address.
    const withoutEmail = s.companies.filter(company => !company.email)
    const candidates = [...withoutEmail.filter(company => company.website), ...withoutEmail.filter(company => !company.website)].slice(0, 40)
    setSearchLimited(false)
    if (!candidates.length) return undefined
    const controller = new AbortController()
    let active = true, next = 0, done = 0, found = 0
    setContactScan({ total:candidates.length, done:0, found:0, running:true })
    const worker = async () => {
      while (active && next < candidates.length) {
        const batch = candidates.slice(next, next + 5)
        next += batch.length
        try {
          const results = await findCompanyEmails(batch, controller.signal, () => { if (active) setSearchLimited(true) })
          if (active) for (const result of results) if (result.email) { found++; d({ type:'company', value:result }) }
        } catch { /* A site may be unavailable; the other searches continue. */ }
        if (active) { done += batch.length; setContactScan({ total:candidates.length, done, found, running:done < candidates.length }) }
      }
    }
    Promise.all(Array.from({ length:Math.min(2, Math.ceil(candidates.length / 5)) }, worker))
    return () => { active = false; controller.abort() }
  }, [loading, error, attempt])
  const rows = s.companies.slice(0, visibleCount).filter(company => fold(`${company.name} ${company.address || ''}`).includes(fold(query)) && (!emailOnly || company.email))
  const emailsAvailable = s.companies.filter(company => company.email).length
  const activeCompany = s.companies.find(company => company.id === activeId)
  const addEmail = () => {
    const email = manualEmail.trim().toLowerCase()
    if (!/^[^\s<>@,;]+@[^\s<>@,;]+\.[a-z]{2,}$/i.test(email)) { setContactMessage('Saisis une adresse e-mail valide.'); return }
    d({ type:'company', value:{ ...activeCompany, email, contactSource:'Ajouté par toi' } })
    setManualEmail(''); setContactMessage('Adresse ajoutée. Vérifie bien qu’elle accepte les candidatures avant l’envoi.')
  }
  const findContact = async () => {
    setContactBusy(true); setContactMessage('Lecture du site de l’entreprise…')
    try {
      const company = await findCompanyEmail(activeCompany)
      d({ type: 'company', value: company })
      setContactMessage(company.email ? 'Adresse publique trouvée. Vérifie qu’elle convient aux candidatures.' : 'Aucun e-mail public trouvé. Le formulaire de contact du site reste une bonne piste.')
    } catch (reason) { setContactMessage(reason.name === 'AbortError' ? 'Le site met trop de temps à répondre. Tu peux le consulter directement.' : reason.message) }
    finally { setContactBusy(false) }
  }
  return <>
    <span className="eyebrow">Les bonnes pistes, près de toi</span><h2>{loading ? 'On fait chauffer la carte…' : `À toi de jouer, ${s.profile.name.split(' ')[0] || 'explorateur'} !`}</h2>
    <p className="sub">{s.profile.domain} · {s.location.city} · {s.location.radius} km{!error && s.companies.length > 0 && <> · <b>{s.companies.length} entreprises repérées</b></>}</p>
    {loading && <div className="search-progress" role="status"><div className="search-radar" aria-hidden="true"><span className="radar-sweep" /><i /><i /><i /><b /></div><div className="search-progress-head"><b>{progress.value}%</b><span>{progress.message}</span></div><div className="search-progress-track loading"><i style={{ width: `${progress.value}%` }} /></div><small>On croise l’activité et la distance. Les bonnes adresses méritent quelques secondes.</small></div>}
    {error && <div className="empty-state" role="alert"><h3>La carte a besoin d’un second essai.</h3><p>{error}</p><Button onClick={() => setAttempt(value => value + 1)}>Réessayer</Button></div>}
    {(!loading || s.companies.length > 0) && !error && <>
      {!loading && partial && <p className="notice" role="status">{unavailableSource === 'annuaire' ? 'L’annuaire officiel est momentanément indisponible. Voici les résultats de la carte OpenStreetMap.' : 'La carte des contacts est momentanément indisponible. Voici les entreprises de l’annuaire officiel.'} <button onClick={() => setAttempt(value => value + 1)}>Relancer la recherche</button></p>}
      {contactScan.total > 0 && <p className="contact-scan" role="status">{contactScan.running ? 'Recherche approfondie des contacts publics…' : 'Recherche des contacts terminée.'} {contactScan.done}/{contactScan.total} entreprises traitées · {emailsAvailable} adresse{emailsAvailable > 1 ? 's' : ''} publique{emailsAvailable > 1 ? 's' : ''} disponible{emailsAvailable > 1 ? 's' : ''}, dont {contactScan.found} trouvée{contactScan.found > 1 ? 's' : ''} sur les sites.</p>}
      {searchLimited && <p className="notice" role="status">La recherche web est momentanément indisponible : seuls les sites déjà connus ont été lus. Pour les autres, tu peux ajouter une adresse depuis « Voir les coordonnées ».</p>}
      <SearchMap location={center} companies={rows} />
      <div className="results-tools"><input aria-label="Filtrer les entreprises" placeholder="Filtrer par nom ou adresse…" value={query} onChange={event => setQuery(event.target.value)} /><label><input type="checkbox" checked={emailOnly} onChange={event => setEmailOnly(event.target.checked)} /> Avec e-mail public</label></div>
      <p className="helper-text">{rows.length} affichées · {emailsAvailable} avec e-mail · {s.selected.length} sélectionnée{s.selected.length > 1 ? 's' : ''}. Clique sur « + Sélectionner » pour choisir celles à contacter. Une adresse e-mail est nécessaire pour l’envoi automatique. Les résultats sont des pistes, pas des offres de stage confirmées.</p>
      {!loading && visibleCount >= s.companies.length && !rows.length && <div className="empty-state"><h3>Pas encore la bonne prise.</h3><p>{s.companies.length ? 'Essaie sans filtre pour retrouver toutes les entreprises.' : 'Élargis le rayon ou retire le filtre d’enseigne. Vérifie aussi le domaine choisi.'}</p><Button variant="ghost" onClick={() => s.companies.length ? (setQuery(''), setEmailOnly(false)) : d({ type: 'back' })}>{s.companies.length ? 'Effacer les filtres' : 'Ajuster ma recherche'}</Button></div>}
      <div className="list">{rows.map((company, index) => <article key={company.id} className={`company live-card ${s.selected.includes(company.id) ? 'on' : ''}`} style={{ '--i': Math.min(index, 8) }}>
        <div className="company-content"><div className="company-heading"><h3>{company.name}</h3><span>{company.distance} km</span></div><p>{company.address || company.location || 'Adresse à consulter sur la fiche source'}</p><small>{company.relevance}</small><div className="company-tags"><span className={company.email ? 'available' : ''}>{company.email ? `✉ ${company.email}` : company.website ? '↗ Site disponible' : '⌖ Fiche entreprise'}</span><span>{company.source === 'annuaire' ? 'Annuaire officiel' : 'OpenStreetMap'}</span></div><div className="company-actions"><button onClick={() => { setActiveId(company.id); setContactMessage(''); setManualEmail('') }}>Voir les coordonnées ↗</button><button disabled={!company.email} aria-pressed={s.selected.includes(company.id)} onClick={() => d({ type: 'toggle', id: company.id })}>{s.selected.includes(company.id) ? '✓ Sélectionnée' : company.email ? '+ Sélectionner' : 'Adresse e-mail requise'}</button></div></div>
      </article>)}</div>
      <p className="source-note">Données publiques : <a href="https://annuaire-entreprises.data.gouv.fr/" target="_blank" rel="noreferrer">Annuaire des Entreprises</a> et <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>. Liste limitée aux 100 premières correspondances ; recherche automatique sur les 40 premiers sites renseignés. Les données et les adresses publiées peuvent être incomplètes.</p>
    </>}
    {activeCompany && <div className="sheet-backdrop" onClick={() => setActiveId(null)}><section className="company-sheet card" role="dialog" aria-modal="true" aria-label={`Coordonnées de ${activeCompany.name}`} onKeyDown={event => { if (event.key === 'Escape') setActiveId(null) }} onClick={event => event.stopPropagation()}><button autoFocus aria-label="Fermer les coordonnées" onClick={() => setActiveId(null)}>×</button><span className="eyebrow">{activeCompany.relevance}</span><h3>{activeCompany.name}</h3><p>{activeCompany.address || 'Adresse non renseignée'} · {activeCompany.distance} km</p><div><b>Site</b><span>{safeWebsite(activeCompany.website) ? <a href={safeWebsite(activeCompany.website)} target="_blank" rel="noreferrer">Consulter le site ↗</a> : 'Non renseigné'}</span></div><div><b>E-mail</b><span>{activeCompany.email ? <a href={`mailto:${activeCompany.email}`}>{activeCompany.email}</a> : 'Non publié'}</span></div><div><b>Téléphone</b><span>{activeCompany.phone || 'Non renseigné'}</span></div><div><b>Source</b><a href={activeCompany.sourceUrl} target="_blank" rel="noreferrer">Vérifier la fiche ↗</a></div>{!activeCompany.email && activeCompany.website && <Button disabled={contactBusy} onClick={findContact}>{contactBusy ? 'Recherche…' : 'Chercher l’e-mail sur ce site'}</Button>}{!activeCompany.email && <div className="manual-contact"><label htmlFor="manual-company-email">Adresse e-mail trouvée pour cette entreprise</label><input id="manual-company-email" type="email" value={manualEmail} onChange={event => setManualEmail(event.target.value)} placeholder="contact@entreprise.fr"/><Button onClick={addEmail}>Ajouter l’adresse</Button></div>}{contactMessage && <p role="status">{contactMessage}</p>}<small>Un contact publié n’est pas une confirmation de recrutement. Vérifie le destinataire avant de postuler.</small></section></div>}
  </>
}

