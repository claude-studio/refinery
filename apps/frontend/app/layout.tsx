import type { Metadata } from 'next'
import Link from 'next/link'

import './globals.css'

export const metadata: Metadata = {
  title: 'Refinery',
  description: 'Claude Code 세션 분석 대시보드',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-deep-void min-h-screen">
        <header className="border-b border-[rgba(226,226,226,0.35)]">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-warm-parchment text-sm tracking-[2px]">
              REFINERY
            </Link>
            <div className="flex items-center gap-6">
              <Link
                href="/sessions"
                className="text-stone-gray hover:text-ash-gray text-[10px] tracking-[1.4px] transition-colors"
              >
                SESSIONS
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </body>
    </html>
  )
}
