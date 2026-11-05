import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { randomUUID } from 'node:crypto'

const builtAt = new Date().toISOString()
const buildVersion = `${Date.now()}-${randomUUID().slice(0, 8)}`
const buildVersionPlugin = {
  name: 'app-build-version',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: buildVersion, builtAt }) })
  },
  transformIndexHtml() {
    return [{ tag: 'meta', attrs: { name: 'app-build', content: buildVersion }, injectTo: 'head' }]
  },
}

export default defineConfig({
  plugins: [react(), buildVersionPlugin],
  define: { __APP_BUILD_ID__: JSON.stringify(buildVersion) },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
})
