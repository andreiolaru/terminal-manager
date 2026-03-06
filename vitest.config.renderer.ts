import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/renderer/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['src/renderer/__tests__/setup.ts']
  }
})
