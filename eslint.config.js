// Design Ref: §10.0 — ESLint 공통 설정 (backend·agent·shared에 적용)
// tailwindcss 규칙은 apps/frontend/eslint.config.js 로 분리
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import importPlugin from 'eslint-plugin-import'
import prettier from 'eslint-config-prettier'

export default [
  {
    ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/coverage/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
        },
      ],
    },
  },
  prettier,
]
