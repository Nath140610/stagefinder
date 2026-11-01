import { useEffect, useReducer } from 'react'
import { reducer, initial } from './state/flow.js'
import Landing from './features/landing/Landing.jsx'
import Flow from './features/flow/Flow.jsx'
import { restoreCheckoutDraft } from './features/flow/Payment.jsx'
import { trackEvent } from './services/analytics.js'
import Admin from './features/admin/Admin.jsx'
export default function App() {
  const [s, d] = useReducer(reducer, initial)
  const isAdmin = window.location.pathname.toLowerCase() === '/admin'
  useEffect(() => {
    if (isAdmin) return
    const draft = restoreCheckoutDraft()
    if (draft) d({ type:'restore', value:draft })
    trackEvent('visit')
  }, [isAdmin])
  useEffect(() => {
    if (isAdmin || s.view !== 'flow') return
    trackEvent('flow_started')
    if (s.step >= 3) trackEvent('form_completed')
    if (s.step === 4) trackEvent('payment_viewed')
  }, [isAdmin, s.view, s.step])
  return isAdmin ? <Admin /> : s.view === 'landing' ? <Landing onStart={() => d({ type:'start' })} /> : <Flow s={s} d={d} />
}
