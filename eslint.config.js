import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Ignore build output, coverage, Rust target, and the transient agent
  // worktrees under .claude/ — linting those (esp. minified build artifacts)
  // floods the report with thousands of irrelevant errors.
  globalIgnores(['dist', 'coverage', 'src-tauri/target', '.claude/worktrees']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // eslint-plugin-react-hooks@7's "recommended" preset turns on React
      // Compiler "rules of React" that flag working, pre-existing patterns this
      // (non-Compiler) codebase was not written against. rules-of-hooks and
      // exhaustive-deps stay as real signal; the Compiler + fast-refresh rules
      // are downgraded to warnings so they remain visible (a backlog to adopt
      // later) without failing `npm run lint`. See the 2026-06-15 audit.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/globals': 'warn',
      'react-refresh/only-export-components': 'warn',
      // Honor the `_` prefix convention for intentionally-unused vars/args.
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
])
