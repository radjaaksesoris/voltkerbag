import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'

const base = process.env.GITHUB_ACTIONS ? '/voltkerbag/' : '/'

const availabilityPath = resolve(process.cwd(), 'src/appAvailability.js')

function lazyAppDisabledNotice() {
  return {
    name: 'lazy-app-disabled-notice',
    enforce: 'pre',
    resolveId(source, importer) {
      if (importer?.includes('appAvailability.js')) return null
      if (
        source === './components/AppDisabledNotice.jsx' ||
        source === '../components/AppDisabledNotice.jsx'
      ) {
        return availabilityPath
      }
      return null
    }
  }
}

function versionServiceWorkers() {
  let outDir
  let buildVersion

  return {
    name: 'version-service-workers',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
      buildVersion = process.env.GITHUB_SHA || Date.now().toString(36)
    },
    async closeBundle() {
      for (const worker of ['sw.js', 'chat/sw.js']) {
        const workerPath = resolve(outDir, worker)
        const source = await readFile(workerPath, 'utf8')
        if (!source.includes('__BUILD_VERSION__')) {
          throw new Error(`Penanda versi build tidak ditemukan di service worker: ${worker}`)
        }
        await writeFile(workerPath, source.replaceAll('__BUILD_VERSION__', buildVersion))
      }
    }
  }
}

export default defineConfig({
  base,
  plugins: [react(), lazyAppDisabledNotice(), versionServiceWorkers()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        chat: resolve(process.cwd(), 'chat/index.html')
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor'
          if (id.includes('node_modules/@supabase/')) return 'supabase-js'
        }
      }
    }
  },
  server: { port: 5173, host: true }
})
