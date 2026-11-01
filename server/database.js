const PAGE_SIZE = 1000
const TIMEOUT_MS = 8000
// The retention announced in the privacy policy. Orders are kept for accounting.
const RETENTION_MS = 13 * 30.44 * 24 * 3600 * 1000
const EXPIRING = { visits:'visited_at', flows:'first_seen', trackers:'created_at' }

const time = {
  write:value => value == null ? null : new Date(value).toISOString(),
  read:value => value == null ? undefined : Date.parse(value)
}
const plain = { write:value => value ?? null, read:value => value ?? undefined }
const nullable = { write:value => value ?? null, read:value => value ?? null }

// Each collection of the in-memory state, with the matching table and columns.
const COLLECTIONS = {
  flows:{ table:'flows', key:'id', columns:{ firstSeen:['first_seen', time], startedAt:['started_at', time], completedAt:['completed_at', time], paymentViewedAt:['payment_viewed_at', time], paidAt:['paid_at', time], cancelledAt:['cancelled_at', time], referrals:['referrals', plain] } },
  links:{ table:'links', key:'code', columns:{ label:['label', plain], visits:['visits', plain], createdAt:['created_at', time] } },
  checkouts:{ table:'checkouts', key:'session_id', columns:{ amount:['amount_cents', plain], count:['company_count', plain], mode:['mode', plain], flowId:['flow_id', nullable], createdAt:['created_at', time], paidAt:['paid_at', time], cancelledAt:['cancelled_at', time], checkedAt:['checked_at', time] } },
  trackers:{ table:'trackers', key:'token', columns:{ createdAt:['created_at', time], openedAt:['opened_at', nullable], opens:['opens', plain] } }
}

function toRow(collection, key, record) {
  const { key:keyColumn, columns } = COLLECTIONS[collection], row = { [keyColumn]:key }
  for (const [field, [column, type]] of Object.entries(columns)) row[column] = type.write(record[field])
  return row
}
function fromRow(collection, row) {
  const record = {}
  for (const [field, [column, type]] of Object.entries(COLLECTIONS[collection].columns)) {
    const value = type.read(row[column])
    if (value !== undefined) record[field] = value
  }
  return record
}
const rowsFor = (collection, key, value) => collection === 'visits' ? { flow_id:key, visited_at:time.write(value) } : toRow(collection, key, value)
const keyColumn = collection => collection === 'visits' ? 'flow_id' : COLLECTIONS[collection].key
const tableName = collection => collection === 'visits' ? 'visits' : COLLECTIONS[collection].table

export const supabaseConfigured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)

export function createSupabaseBackend(url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY) {
  const base = `${String(url).trim().replace(/\/+$/, '')}/rest/v1`
  // New sb_secret_ keys are refused in the Authorization header; legacy JWT keys need it.
  const headers = { apikey:key, ...(String(key).startsWith('eyJ') ? { authorization:`Bearer ${key}` } : {}) }
  const request = async (path, options = {}) => {
    const response = await fetch(`${base}/${path}`, { ...options, signal:AbortSignal.timeout(TIMEOUT_MS), headers:{ ...headers, ...options.headers } })
    if (!response.ok) throw new Error(`Supabase ${path.split('?')[0]} : ${response.status} ${(await response.text()).slice(0, 200)}`)
    return response
  }
  const saved = new Map()
  const remember = (collection, id, value) => saved.set(`${collection}:${id}`, JSON.stringify(value))
  return {
    name:'Supabase',
    async load() {
      const cutoff = new Date(Date.now() - RETENTION_MS).toISOString()
      for (const [table, column] of Object.entries(EXPIRING)) {
        await request(`${table}?${column}=lt.${cutoff}`, { method:'DELETE', headers:{ prefer:'return=minimal' } }).catch(error => console.error(`Purge impossible : ${error.message}`))
      }
      const data = {}
      for (const collection of ['visits', ...Object.keys(COLLECTIONS)]) {
        data[collection] = {}
        const column = keyColumn(collection)
        // Supabase caps each response, so a table has to be read page by page.
        for (let offset = 0; ; offset += PAGE_SIZE) {
          const rows = await (await request(`${tableName(collection)}?select=*&order=${column}.asc&limit=${PAGE_SIZE}&offset=${offset}`)).json()
          for (const row of rows) {
            const value = collection === 'visits' ? Date.parse(row.visited_at) : fromRow(collection, row)
            data[collection][row[column]] = value
            remember(collection, row[column], value)
          }
          if (rows.length < PAGE_SIZE) break
        }
      }
      return data
    },
    // Writes only what changed. A failed table stays unsaved and is retried on the next change.
    async save(data) {
      for (const collection of ['visits', ...Object.keys(COLLECTIONS)]) {
        const changed = Object.entries(data[collection]).filter(([id, value]) => saved.get(`${collection}:${id}`) !== JSON.stringify(value))
        if (!changed.length) continue
        const body = JSON.stringify(changed.map(([id, value]) => rowsFor(collection, id, value)))
        await request(`${tableName(collection)}?on_conflict=${keyColumn(collection)}`, { method:'POST', headers:{ 'content-type':'application/json', prefer:'resolution=merge-duplicates,return=minimal' }, body })
        for (const [id, value] of changed) remember(collection, id, value)
      }
    }
  }
}
