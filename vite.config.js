import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/omok-master/',
  plugins: [react()],
  test: {
    // engine/ai 는 Node 환경(빠름), UI 컴포넌트만 jsdom
    environment: 'node',
    environmentMatchGlobs: [
      ['src/ui/**', 'jsdom'],
    ],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/engine/**', 'src/ai/**'],
    },
    setupFiles: ['./src/test-setup.js'],
  },
})
