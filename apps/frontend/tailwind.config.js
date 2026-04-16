// ESLint eslint-plugin-tailwindcss 전용 설정
// Tailwind v4 빌드는 globals.css @theme 블록을 사용하므로 이 파일은 빌드에 영향 없음
// Design Ref: §2 Color Palette — DESIGN.md 토큰과 동일하게 유지
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'warm-parchment': '#faf9f6',
        'ash-gray': '#afaeac',
        'stone-gray': '#868584',
        'earth-gray': '#353534',
        'muted-purple': '#666469',
        'deep-void': '#1a1917',
        'frosted-veil': 'rgba(255,255,255,0.04)',
      },
    },
  },
}
