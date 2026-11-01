import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { api } from './server/api.js'
import { loadLocalEnv } from './server/localEnv.js'

loadLocalEnv()

const middleware = server => { server.middlewares.use(api) }
export default defineConfig({ plugins: [react(), { name: 'stagefinder-api', configureServer: middleware, configurePreviewServer: middleware }] })
