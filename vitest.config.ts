import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/costCalc.ts'],
      thresholds: {
        lines: 95,
        functions: 100,
        branches: 90,
      },
    },
  },
})
