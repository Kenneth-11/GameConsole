import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const proxyTarget = (target: string, prefix: string) => ({
  target,
  changeOrigin: true,
  rewrite: (path: string) => path.replace(new RegExp(`^${prefix}`), ''),
})

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': proxyTarget('http://localhost:8080', '/api'),
      '/prolog': proxyTarget('http://localhost:8090', '/prolog'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
