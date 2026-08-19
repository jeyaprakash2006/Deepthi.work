import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'vite'
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

export default defineConfig({
  plugins: [react()],
  cacheDir,
  server: { port: 5173 },
  build: { chunkSizeWarningLimit: 1600 },
})
