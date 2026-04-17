'use client'
import type { SseEvent } from '@refinery/shared'
import { useEffect, useRef } from 'react'

export function useSse(onEvent: (event: SseEvent) => void) {
  const ref = useRef(onEvent)
  ref.current = onEvent

  useEffect(() => {
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/events`
    const es = new EventSource(url)

    const handler = (e: MessageEvent) => {
      try {
        ref.current(JSON.parse(e.data) as SseEvent)
      } catch {
        // malformed event 무시
      }
    }

    es.addEventListener('session.analyzed', handler)
    return () => {
      es.removeEventListener('session.analyzed', handler)
      es.close()
    }
  }, [])
}
