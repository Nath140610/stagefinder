const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client'
const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send'
const GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'

let identityLoading
export function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google)
  if (identityLoading) return identityLoading
  identityLoading = new Promise((resolve, reject) => {
    document.querySelector(`script[src="${GOOGLE_SCRIPT}"]`)?.remove()
    const script = document.createElement('script')
    script.src = GOOGLE_SCRIPT
    script.async = true
    script.defer = true
    const fail = () => { clearTimeout(timer); script.remove(); reject(new Error('Google ne répond pas. Vérifie ta connexion puis réessaie.')) }
    const timer = setTimeout(fail, 15000)
    script.onload = () => { clearTimeout(timer); window.google?.accounts?.oauth2 ? resolve(window.google) : fail() }
    script.onerror = fail
    document.head.appendChild(script)
  }).catch(error => { identityLoading = null; throw error })
  return identityLoading
}

export async function connectGoogleAccount({ readReplies = false } = {}) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('La connexion Google n’est pas encore configurée pour ce site.')
  // Load the library beforehand so opening the popup stays inside the click.
  const google = window.google
  if (!google?.accounts?.oauth2) throw new Error('Google est encore en cours de chargement. Réessaie dans un instant.')
  const scopes = ['openid', 'email', 'profile', GMAIL_SEND_SCOPE, ...(readReplies ? [GMAIL_READ_SCOPE] : [])]
  const token = await new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: scopes.join(' '),
      error_callback: () => reject(new Error('La fenêtre Google a été fermée ou bloquée. Réessaie.')),
      callback: result => {
        if (result.error) return reject(new Error('Google n’a pas autorisé la connexion. Vérifie les autorisations puis réessaie.'))
        if (!google.accounts.oauth2.hasGrantedAllScopes(result, GMAIL_SEND_SCOPE, ...(readReplies ? [GMAIL_READ_SCOPE] : []))) return reject(new Error('Autorise l’envoi des e-mails dans la fenêtre Google pour continuer.'))
        resolve(result)
      }
    })
    client.requestAccessToken({ prompt:'select_account' })
  })
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers:{ authorization:`Bearer ${token.access_token}` } })
  if (!response.ok) throw new Error('Impossible de récupérer le profil Google.')
  const profile = await response.json()
  if (!profile.email || profile.email_verified === false) throw new Error('Google n’a pas confirmé cette adresse e-mail.')
  return { provider:'Google', email:profile.email, name:profile.name || profile.email, picture:profile.picture || null, accessToken:token.access_token, expiresAt:Date.now() + Number(token.expires_in || 3600) * 1000, canReadReplies:google.accounts.oauth2.hasGrantedAllScopes(token, GMAIL_READ_SCOPE) }
}

export const accountExpired = account => !account?.accessToken || !account.expiresAt || account.expiresAt <= Date.now() + 30000

const toBase64Url = (value) => btoa(unescape(encodeURIComponent(value))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')

const toBase64 = (bytes) => {
  let binary = ''
  const view = new Uint8Array(bytes)
  for (let index = 0; index < view.length; index += 0x8000) binary += String.fromCharCode(...view.subarray(index, index + 0x8000))
  return btoa(binary)
}
const wrapBase64 = (value) => value.replace(/.{1,76}/g, '$&\r\n')
const safeFilename = (value) => String(value || 'Candidat').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ') || 'Candidat'
const attachmentName = (label, name) => `${label}_${safeFilename(name)}.pdf`
const encodeHeader = (value) => `=?UTF-8?B?${toBase64(new TextEncoder().encode(value))}?=`
const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
const trackingBaseUrl = () => String(import.meta.env.VITE_TRACKING_BASE_URL || (typeof window !== 'undefined' ? window.location?.origin : '') || '').trim().replace(/\/+$/, '')
const trackerUrl = (path) => new URL(path, `${trackingBaseUrl()}/`).href
export function trackingEnabled() {
  try {
    const url = new URL(trackingBaseUrl())
    return url.protocol === 'https:' && !['localhost','127.0.0.1','::1'].includes(url.hostname) && !url.hostname.endsWith('.local')
  } catch { return false }
}

export const personaliseMail = (content, companyName) => String(content || '').replaceAll('[ENTREPRISE]', companyName)

async function registerTrackers(applications) {
  const response = await fetch(trackerUrl('/api/tracking/register'), {
    method:'POST',
    headers:{ 'content-type':'application/json' },
    body:JSON.stringify({ applications:applications.map(({ id }) => ({ id })) })
  })
  if (!response.ok) throw new Error('Impossible de préparer le suivi d’ouverture des e-mails.')
  const payload = await response.json()
  const trackers = new Map((payload.trackers || []).map((tracker) => [tracker.applicationId, tracker.token]))
  if (trackers.size !== applications.length) throw new Error('Impossible de préparer tous les pixels de suivi.')
  return trackers
}

export async function buildApplicationMessage({ to, companyName, candidateName, content, cv, letter, trackingToken }) {
  if (!/^[^\s<>@,;]+@[^\s<>@,;]+\.[a-z]{2,}$/i.test(to || '')) throw new Error('Adresse e-mail du destinataire invalide.')
  if (!cv?.file || !letter?.file) throw new Error('Ajoute le CV et la lettre de motivation au format PDF avant l’envoi.')
  const boundary = `stagefinder-${crypto.randomUUID()}`
  const alternativeBoundary = `stagefinder-text-${crypto.randomUUID()}`
  const attachments = await Promise.all([
    { file:cv.file, filename:attachmentName('CV', candidateName) },
    { file:letter.file, filename:attachmentName('Lettre de motivation', candidateName) }
  ].map(async ({ file, filename }) => ({ filename, content:wrapBase64(toBase64(await file.arrayBuffer())) })))
  const body = personaliseMail(content, companyName)
  const trackingImage = trackingEnabled() && /^[a-zA-Z0-9_-]{32}$/.test(trackingToken || '') ? `<img src="${escapeHtml(trackerUrl(`/api/tracking/pixel/${trackingToken}`))}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px"/>` : ''
  const htmlBody = `<div>${escapeHtml(body).replaceAll('\n', '<br>')}</div>${trackingImage}`
  const lines = [
    `To: ${to}`,
    `Subject: ${encodeHeader(`Candidature de ${candidateName}`)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    '',
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(toBase64(new TextEncoder().encode(body))),
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(toBase64(new TextEncoder().encode(htmlBody))),
    `--${alternativeBoundary}--`,
    ...attachments.flatMap(({ filename, content }) => [
      `--${boundary}`,
      `Content-Type: application/pdf; name*=UTF-8''${encodeURIComponent(filename)}`,
      `Content-Disposition: attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Transfer-Encoding: base64',
      '',
      content
    ]),
    `--${boundary}--`,
    ''
  ]
  return toBase64Url(lines.join('\r\n'))
}

async function sendRawMessage(accessToken, raw) {
  let response
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000)
  try { response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method:'POST',
    signal:controller.signal,
    headers:{ authorization:`Bearer ${accessToken}`, 'content-type':'application/json' },
    body:JSON.stringify({ raw })
  }) } catch {
    throw Object.assign(new Error('La connexion a été interrompue. Vérifie le dossier « Envoyés » de Gmail avant de réessayer : le dernier message a peut-être été envoyé.'), { uncertain:true })
  } finally { clearTimeout(timer) }
  if (!response.ok) {
    const messages = { 401:'Ta session Google a expiré. Reconnecte ton compte pour reprendre les envois restants.', 403:'Google refuse l’envoi. Vérifie que l’API Gmail est activée et que l’autorisation d’envoi a été accordée.', 429:'Gmail limite temporairement les envois. Patiente avant de reprendre les candidatures restantes.' }
    throw Object.assign(new Error(messages[response.status] || 'Gmail a rencontré une erreur. Vérifie les messages envoyés avant de reprendre.'), { reconnect:response.status === 401, uncertain:response.status >= 500 })
  }
  try {
    const result = await response.json()
    if (!result.id) throw new Error('No message ID')
    return result
  } catch { throw Object.assign(new Error('Gmail n’a pas confirmé l’envoi. Vérifie tes messages envoyés avant de réessayer.'), { uncertain:true }) }
}

export async function sendApplications({ accessToken, applications, alreadySent = [], candidateName, content, cv, letter, testRecipient, onProgress=()=>{} }) {
  if (!accessToken) throw new Error('Reconnecte ton compte Google avant d’envoyer les candidatures.')
  const seen = new Set(alreadySent.map(row => row.companyId))
  const targets = applications.filter(company => { if (!company.email || seen.has(company.id)) return false; seen.add(company.id); return true })
  if (!targets.length) throw new Error('Aucune candidature avec e-mail public ne reste à envoyer.')
  if (!content?.trim() || !candidateName?.trim()) throw new Error('Complète ton nom et ton message avant l’envoi.')
  // Validate all destinations before sending any message.
  for (const file of [cv?.file, letter?.file]) if (!file || file.size > 8 * 1024 * 1024) throw new Error('Ajoute un CV et une lettre PDF de moins de 8 Mo chacun.')
  let trackers = new Map(), trackingWarning = null
  const sentApplications = []
  for (const company of targets) if (!/^[^\s<>@,;]+@[^\s<>@,;]+\.[a-z]{2,}$/i.test(testRecipient || company.email)) throw new Error(`Adresse e-mail invalide pour ${company.name}.`)
  if (trackingEnabled()) {
    try { trackers = await registerTrackers(targets) }
    catch { trackingWarning = 'Le suivi des ouvertures est indisponible pour cet envoi.' }
  }
  for (const company of targets) {
    const raw = await buildApplicationMessage({
      to:testRecipient || company.email,
      companyName:company.name,
      candidateName,
      content,
      cv,
      letter,
      trackingToken:trackers.get(String(company.id))
    })

    let gmailMessage
    try { gmailMessage = await sendRawMessage(accessToken, raw) }
    catch (error) { error.companyId = company.id; error.sentApplications = [...sentApplications]; throw error }
    sentApplications.push({
      companyId:company.id,
      companyName:company.name,
      companyEmail:company.email,
      recipientEmail:testRecipient || company.email,
      trackingToken:trackers.get(String(company.id)),
      gmailMessageId:gmailMessage.id,
      gmailThreadId:gmailMessage.threadId,
      status:'En attente',
      seenAt:null,
      responseReceivedAt:null,
      replyPreview:'',
      sentAt:new Date().toISOString()
    })
    onProgress({ sent:sentApplications.length, total:targets.length, company:company.name, applications:[...sentApplications] })
  }
  return { sent:sentApplications.length, total:targets.length, testMode:Boolean(testRecipient), applications:sentApplications, trackingWarning }
}

function fromBase64Url(value) {
  const base64 = String(value || '').replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
  try { return new TextDecoder().decode(Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))) } catch { return '' }
}

function textFromPayload(payload) {
  if (!payload) return ''
  if (payload.mimeType === 'text/plain' && payload.body?.data) return fromBase64Url(payload.body.data)
  return (payload.parts || []).map(textFromPayload).join('\n')
}

function headerValue(payload, name) {
  return (payload?.headers || []).find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value || ''
}

function classifyReply(text) {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/(mail delivery subsystem|votre message n.{0,10}pas ete envoye|delivery (?:has )?failed|undeliverable|address not found|adresse introuvable)/.test(normalized)) return { status:'En attente', deliveryError:true }
  if (/(refus|malheureusement|ne pouvons pas|ne pas donner suite|pas retenu|pas poursuivre|pas de possibilite|candidature non retenue)/.test(normalized)) return { status:'Refusé', deliveryError:false }
  if (/(accepte|retenu|bienvenue|heureux de|ravis de|entretien|rendez-vous|convocation|prochaine etape)/.test(normalized)) return { status:'Accepté', deliveryError:false }
  return { status:'En attente', deliveryError:false }
}

async function getTrackerStatuses(applications) {
  const tokens = applications.map((application) => application.trackingToken).filter(Boolean)
  if (!tokens.length) return new Map()
  try {
    const response = await fetch(trackerUrl('/api/tracking/status'), { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ tokens }) })
    if (!response.ok) return new Map()
    const payload = await response.json()
    return new Map((payload.trackers || []).map((tracker) => [tracker.token, tracker]))
  } catch {
    return new Map()
  }
}

export async function refreshOpenStatuses(applications) {
  const trackers = await getTrackerStatuses(applications)
  return applications.map(application => {
    const tracker = trackers.get(application.trackingToken)
    return { ...application, seenAt:application.seenAt || tracker?.openedAt || null, opens:Math.max(application.opens || 0, tracker?.opens || 0) }
  })
}

function replyFromThread(thread, application) {
  const sentAt = new Date(application.sentAt || 0).getTime()
  const received = (thread.messages || []).filter((message) => {
    if (message.id === application.gmailMessageId) return false
    return Number(message.internalDate || 0) > sentAt + 500
  }).at(-1)
  if (!received) return null
  const subject = headerValue(received.payload, 'Subject')
  const text = textFromPayload(received.payload).replace(/\s+/g, ' ').trim()
  const analysed = `${subject}\n${text}`
  return { ...classifyReply(analysed), receivedAt:new Date(Number(received.internalDate || Date.now())).toISOString(), preview:(text || subject).slice(0, 180) }
}

async function getReplyFromThread(accessToken, application, threadId=application.gmailThreadId) {
  if (!threadId) return null
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=full`, { headers:{ authorization:`Bearer ${accessToken}` } })
  if (!response.ok) throw new Error('Gmail a refusé la lecture des réponses. Reconnecte ton compte Google et accepte l’accès aux e-mails.')
  const thread = await response.json()
  return replyFromThread(thread, application)
}

async function findReplyOutsideThread(accessToken, application) {
  const replyAddress = application.recipientEmail || import.meta.env.VITE_GMAIL_TEST_RECIPIENT || application.companyEmail
  if (!replyAddress) return null
  const since = new Date(application.sentAt || Date.now())
  const date = `${since.getFullYear()}/${String(since.getMonth() + 1).padStart(2, '0')}/${String(since.getDate()).padStart(2, '0')}`
  const query = `from:${replyAddress} after:${date}`
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(query)}&maxResults=5`, { headers:{ authorization:`Bearer ${accessToken}` } })
  if (!response.ok) return null
  const payload = await response.json()
  for (const thread of payload.threads || []) {
    const reply = await getReplyFromThread(accessToken, application, thread.id)
    if (reply) return reply
  }
  return null
}

export async function refreshApplications({ accessToken, applications }) {
  if (!accessToken) throw new Error('Reconnecte ton compte Google pour actualiser les statistiques.')
  const trackers = await getTrackerStatuses(applications)
  const refreshed = []
  for (const application of applications) {
    const tracker = trackers.get(application.trackingToken)
    const reply = await getReplyFromThread(accessToken, application) || await findReplyOutsideThread(accessToken, application)
    refreshed.push({
      ...application,
      seenAt:application.seenAt || tracker?.openedAt || null,
      opens:tracker?.opens || application.opens || 0,
      status:reply?.status || application.status || 'En attente',
      deliveryError:Boolean(reply?.deliveryError || application.deliveryError),
      responseReceivedAt:reply?.receivedAt || application.responseReceivedAt || null,
      replyPreview:reply?.preview || application.replyPreview || ''
    })
  }
  return refreshed
}
