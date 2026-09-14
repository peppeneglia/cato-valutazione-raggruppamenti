import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // I test del motore girano in node; quelli dei componenti dichiarano
    // `// @vitest-environment jsdom` in testa al file.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
