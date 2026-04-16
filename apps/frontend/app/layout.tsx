import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'Refinery',
  description: 'Claude Code 세션 분석 대시보드',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
