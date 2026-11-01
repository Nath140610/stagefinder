const storageKey = 'stagefinder-anonymous-session'

export function analyticsSessionId() {
  try {
    let id = sessionStorage.getItem(storageKey)
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(storageKey, id) }
    return id
  } catch { return crypto.randomUUID() }
}

export function trackEvent(type) {
  const id = analyticsSessionId()
  fetch('/api/analytics/event', {
    method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ type, id }), keepalive:true
  }).catch(() => {})
}
