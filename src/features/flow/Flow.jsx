import Logo from '../../components/Logo.jsx'
import { Button } from '../../components/ui.jsx'
import { STEPS } from '../../state/flow.js'
import { Profile, Location, Companies } from './Steps1.jsx'
import { Summary, EmailConnect, Preparation, Success } from './Steps2.jsx'
import Payment from './Payment.jsx'
import Dashboard from '../dashboard/Dashboard.jsx'

export default function Flow({ s, d }) {
  const id = STEPS[s.step], p = { s, d }
  const profileComplete = Boolean(
    s.profile.name.trim() && s.profile.level.trim() && s.profile.domain &&
    s.profile.start && s.profile.end && s.profile.end >= s.profile.start &&
    s.profile.description.trim()
  )
  const locationComplete = Boolean(s.location.city.trim() && s.location.radius > 0 && s.location.latitude != null && s.location.longitude != null)
  const cannotContinue =
    (id === 'profile' && !profileComplete) ||
    (id === 'location' && !locationComplete) ||
    (id === 'companies' && !s.selected.length) ||
    (id === 'prepare' && !s.prepared)
  const body = { profile:<Profile {...p}/>, location:<Location {...p}/>, companies:<Companies {...p}/>, summary:<Summary {...p}/>, payment:<Payment {...p}/>, email:<EmailConnect {...p}/>, prepare:<Preparation {...p}/>, success:<Success s={s} d={d} onNext={()=>d({type:'next'})}/>, dashboard:<Dashboard s={s} d={d}/> }[id]
  const hideNav = id === 'success' || id === 'dashboard' || id === 'email' || id === 'payment'
  return (
    <div className="flow">
      <header className="top"><Logo />{!hideNav && <div className="progress"><i style={{ width: `${(s.step+1) / STEPS.indexOf('success') * 100}%` }} /></div>}</header>
      <main key={id} className={`stage ${s.dir>0?'fwd':'back'}`}>{body}</main>
      {!hideNav && <footer className="nav">{!(id === 'summary' && s.payment?.status === 'paid') ? <Button variant="ghost" onClick={()=>d({type:'back'})}>Retour</Button> : <span />}
        <Button disabled={cannotContinue} onClick={()=>d({type:'next'})}>{id === 'location' ? 'Trouver les bonnes pistes ↗' : 'Continuer'}</Button></footer>}
    </div>)
}
