// Configurazione per gli strumenti in `scripts/`, che non sono test di
// comportamento e non devono girare con `npm run test`.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/**/*.test.ts'],
  },
})
