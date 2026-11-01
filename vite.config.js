import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { api } from './server/api.js'
import { loadLocalEnv } from './server/localEnv.js'

loadLocalEnv()

const middleware = server => { server.middlewares.use(api) }
// Proves ownership of the site to Google Search Console, without a paid domain.
const siteVerification = {
  name:'stagefinder-site-verification',
  transformIndexHtml() {
    const code = String(process.env.GOOGLE_SITE_VERIFICATION || '').trim()
    return /^[\w-]+$/.test(code) ? [{ tag:'meta', attrs:{ name:'google-site-verification', content:code }, injectTo:'head' }] : []
  }
}
export default defineConfig({ plugins: [react(), siteVerification, { name: 'stagefinder-api', configureServer: middleware, configurePreviewServer: middleware }] })
