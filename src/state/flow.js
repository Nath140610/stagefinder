export const STEPS = ['profile','location','companies','summary','payment','email','prepare','success','dashboard']
export const selectionKey = selected => [...selected].sort().join('|')
export const initial = { view:'landing', step:0, dir:1,
  profile:{ name:'', level:'', domain:'', start:'', end:'', description:'' },
  location:{ city:'Paris', radius:10, latitude:null, longitude:null, keyword:'' }, companies:[], selected:[], applications:[], cv:null, letter:null, emailProvider:null, emailAccount:null, prepared:false, testEmailSent:false, payment:null }
export function reducer(s, a) {
  switch (a.type) {
    case 'start': return { ...s, view:'flow', step:0, dir:1 }
    case 'restore': return { ...s, ...a.value, view:'flow', step:STEPS.indexOf('payment'), dir:1, emailAccount:null, emailProvider:null, cv:null, letter:null, applications:[] }
    case 'next': {
      const target = Math.min(s.step+1, STEPS.length-1)
      if (STEPS[target] === 'email' && (s.payment?.status !== 'paid' || s.payment.selectionKey !== selectionKey(s.selected))) return s
      return { ...s, step:target, dir:1 }
    }
    case 'back': return s.payment?.status === 'paid' && s.step <= STEPS.indexOf('summary') ? s : s.step===0 ? { ...s, view:'landing' } : { ...s, step:s.step-1, dir:-1 }
    case 'set': return { ...s, [a.key]: { ...s[a.key], ...a.value } }
    case 'put': return { ...s, [a.key]: a.value, ...(a.key === 'selected' ? { payment:null } : {}) }
    case 'company': return { ...s, companies:s.companies.map(company=>company.id===a.value.id?a.value:company) }
    case 'goto': {
      const target = Math.max(0, Math.min(a.step, STEPS.length-1))
      if (s.payment?.status === 'paid' && target < STEPS.indexOf('summary')) return { ...s, step:STEPS.indexOf('summary'), dir:-1 }
      if (target > STEPS.indexOf('payment') && (s.payment?.status !== 'paid' || s.payment.selectionKey !== selectionKey(s.selected))) return { ...s, step:STEPS.indexOf('payment'), dir:-1 }
      return { ...s, step:target, dir:a.step < s.step ? -1 : 1 }
    }
    case 'toggle': return { ...s, payment:null, prepared:false, testEmailSent:false, selected: s.selected.includes(a.id) ? s.selected.filter(i=>i!==a.id) : [...s.selected, a.id] }
    default: return s
  }
}
