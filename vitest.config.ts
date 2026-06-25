import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      // vite-plugin-pwa's virtual module only exists in the production build,
      // not under vitest — alias it to a test stub so component tests resolve.
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/stubs/pwaRegister.ts', import.meta.url)
      ),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
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
