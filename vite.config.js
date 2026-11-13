import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'

const base = process.env.GITHUB_ACTIONS ? '/voltkerbag/' : '/'

function versionServiceWorker() {
  let outDir
  let buildVersion

  return {
    name: 'version-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
      buildVersion = process.env.GITHUB_SHA || Date.now().toString(36)
    },
    async closeBundle() {
      const serviceWorkerPath = resolve(outDir, 'sw.js')
      const serviceWorker = await readFile(serviceWorkerPath, 'utf8')
      if (!serviceWorker.includes('__BUILD_VERSION__')) {
        throw new Error('Penanda versi build tidak ditemukan di service worker.')
      }
      await writeFile(
        serviceWorkerPath,
        serviceWorker.replaceAll('__BUILD_VERSION__', buildVersion)
      )
    }
  }
}

export default defineConfig({
  base,
  plugins: [react(), versionServiceWorker()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        chat: resolve(process.cwd(), 'chat/index.html')
      }
    }
  },
  server: { port: 5173, host: true }
})
