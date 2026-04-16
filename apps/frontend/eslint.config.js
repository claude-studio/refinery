// Design Ref: §10.0 — 프론트엔드 전용 ESLint (Tailwind v4 규칙 포함)
// tailwind-api-utils의 resolveModule은 절대경로가 필요하므로 import.meta.url 사용
import path from 'path'
import { fileURLToPath } from 'url'

import tailwindPlugin from 'eslint-plugin-tailwindcss'

import rootConfig from '../../eslint.config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default [
  ...rootConfig,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      tailwindcss: tailwindPlugin,
    },
    settings: {
      tailwindcss: {
        // Tailwind v4: CSS 파일이 설계 시스템 소스. 절대경로 필수 (상대경로 '.'은 worker에서 해석 불가)
        config: path.resolve(__dirname, './app/globals.css'),
      },
    },
    rules: {
      'tailwindcss/classnames-order': 'error',
      'tailwindcss/no-custom-classname': 'error',
      'tailwindcss/no-contradicting-classname': 'error',
    },
  },
]
