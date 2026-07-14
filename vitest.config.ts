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
    // Phase 43-05: security regression tests live under tests/security/ (not
    // src/) since they exercise the Vercel Function + raw PostgREST, not app
    // components. Each such file forces `// @vitest-environment node` since
    // it needs Node's Request/Response/fetch globals, not jsdom's window.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/costCalc.ts', 'src/hooks/useCostDerivedValues.ts'],
      thresholds: {
        lines: 95,
        functions: 100,
        branches: 90,
      },
    },
  },
})
