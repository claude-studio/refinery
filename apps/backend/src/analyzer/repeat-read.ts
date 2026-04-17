// Design Ref: §2.2 트랜스크립트 파이프라인 → analyzer/repeat-read.ts
// Plan FR-06: 세션 내 동일 파일 경로 3회+ Read 탐지
// Test: §8.2 #7 (3회 → 반환), #8 (2회 → 미반환)

import type { Inefficiency, ParsedSession } from '@refinery/shared'

const THRESHOLD = 3

export function detectRepeatRead(session: ParsedSession): Inefficiency[] {
  const freq = new Map<string, string[]>()

  for (const tc of session.toolCalls) {
    if (tc.name !== 'Read') continue
    const path = tc.input.file_path as string | undefined
    if (!path) continue
    const ids = freq.get(path) ?? []
    ids.push(tc.id)
    freq.set(path, ids)
  }

  const results: Inefficiency[] = []

  for (const [path, ids] of freq) {
    if (ids.length < THRESHOLD) continue

    results.push({
      type: 'repeat-read',
      severity: ids.length >= 5 ? 'high' : 'medium',
      description: `${path} 파일을 ${ids.length}회 반복 Read`,
      evidence: ids,
      count: ids.length,
    })
  }

  return results
}
