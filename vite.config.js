import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

const base = process.env.GITHUB_ACTIONS ? '/voltkerbag/' : '/'

export default defineConfig({
  base,
  plugins: [react()],
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
