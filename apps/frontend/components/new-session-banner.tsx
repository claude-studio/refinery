'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

import { useSse } from '@/lib/sse'

export function NewSessionBanner() {
  const [count, setCount] = useState(0)
  const router = useRouter()

  useSse(
    useCallback(() => {
      setCount((c) => c + 1)
    }, []),
  )

  if (count === 0) return null

  return (
    <button
      onClick={() => {
        setCount(0)
        router.refresh()
      }}
      className="text-ash-gray w-full border border-[rgba(226,226,226,0.35)] bg-[rgba(255,255,255,0.04)] py-2.5 text-center text-xs transition-colors hover:bg-[rgba(255,255,255,0.07)]"
    >
      새 세션 {count}개 분석 완료 — 클릭하여 갱신
    </button>
  )
}
