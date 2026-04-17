// Design Ref: §2.2 트랜스크립트 파이프라인 → analyzer/failed-retry.ts
// Plan FR-07: 동일 도구+인자 조합 오류 후 3회+ 재시도 탐지
// Test: §8.2 #9

import type { Inefficiency, ParsedSession } from '@refinery/shared'

const THRESHOLD = 3

function buildKey(name: string, input: Record<string, unknown>): string {
  const primary =
    (input.file_path as string | undefined) ??
    (input.command as string | undefined) ??
    (input.pattern as string | undefined) ??
    JSON.stringify(input)
  return `${name}::${primary}`
}

export function detectFailedRetry(session: ParsedSession): Inefficiency[] {
  // key → all tool call IDs in order
  const groups = new Map<string, { id: string; isError: boolean }[]>()

  for (const tc of session.toolCalls) {
    const key = buildKey(tc.name, tc.input)
    const list = groups.get(key) ?? []
    list.push({ id: tc.id, isError: tc.isError })
    groups.set(key, list)
  }

  const results: Inefficiency[] = []

  for (const [key, calls] of groups) {
    if (calls.length < THRESHOLD) continue

    const hasError = calls.some((c) => c.isError)
    if (!hasError) continue

    const [name, label] = key.split('::')

    results.push({
      type: 'failed-retry',
      severity: calls.length >= 5 ? 'high' : 'medium',
      description: `${name} (${label}) 동일 호출을 ${calls.length}회 반복 (오류 포함)`,
      evidence: calls.map((c) => c.id),
      count: calls.length,
    })
  }

  return results
}
