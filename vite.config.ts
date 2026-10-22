import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import { createAiHandler } from './server/ai'
import react from '@vitejs/plugin-react'

/**
 * This project can sit on an external volume mounted `noowners`, where creating
 * Vite's dependency-cache directory intermittently fails with EACCES and takes
 * the dev server down mid-session. Keeping that cache on the local disk avoids
 * the flaky mount entirely (and is faster than an external drive besides).
 * Hashing the project path keeps separate checkouts from sharing a cache.
 */
const cacheDir = join(
  tmpdir(),
  `vite-style-clone-${createHash('sha1').update(process.cwd()).digest('hex').slice(0, 10)}`,
)

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const api = createAiHandler(env)
  return {
  plugins: [react(), {
    name: 'local-studio-api',
    configureServer(server) { server.middlewares.use(api) },
    configurePreviewServer(server) { server.middlewares.use(api) },
  }],
  cacheDir,
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1' },
  build: { chunkSizeWarningLimit: 1600 },
  }
})
