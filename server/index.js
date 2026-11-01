import http from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { api } from './api.js'
import { paymentReturn } from './payment.js'
import { loadLocalEnv } from './localEnv.js'
import { analytics, referralRedirect } from './analytics.js'
import { supabaseConfigured } from './database.js'

loadLocalEnv()

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2' }
export const server = http.createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.setHeader('X-Frame-Options', 'SAMEORIGIN')
  response.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()')
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname
    if (pathname.startsWith('/r/')) return referralRedirect(request, response, pathname.slice(3))
    if (request.url?.split('?')[0] === '/payment-return') return paymentReturn(request, response)
    await api(request, response, async () => {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); return response.end() }
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
      const target = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`)
      if (!target.startsWith(resolve(root) + sep)) { response.writeHead(403); return response.end() }
      let file = target
      try { if (!(await stat(file)).isFile()) throw new Error('Not a file') }
      catch {
        // Never serve source, credentials, or HTML for a missing script/API.
        if (extname(pathname) || pathname.includes('/.')) { response.writeHead(404); return response.end('Introuvable') }
        file = resolve(root, 'index.html')
      }
      response.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache' })
      if (request.method === 'HEAD') return response.end()
      createReadStream(file).on('error', () => response.destroy()).pipe(response)
    })
  } catch {
    if (!response.headersSent) response.writeHead(400)
    response.end('Requête invalide')
  }
})
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000)
  server.listen(port, '0.0.0.0', () => {
    console.log(`Stage Finder prêt : http://localhost:${port}`)
    if (process.env.RENDER === 'true' && !supabaseConfigured()) console.warn('SUPABASE_URL ou SUPABASE_SECRET_KEY manquant : les statistiques seront perdues au prochain déploiement.')
    analytics.ready().then(name => console.log(`Statistiques : ${name}`)).catch(error => console.error(`Statistiques indisponibles : ${error.message}`))
  })
}
