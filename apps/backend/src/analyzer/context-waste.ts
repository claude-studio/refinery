// Design Ref: §2.2 트랜스크립트 파이프라인 → analyzer/context-waste.ts
// Plan FR-09: 이미 로드된 파일/정보 재로드 패턴 탐지
// repeat-read(3회+)와 구별: Edit/Write 없이 동일 파일을 재로드하는 쌍 탐지

import type { Inefficiency, ParsedSession } from '@refinery/shared'

export function detectContextWaste(session: ParsedSession): Inefficiency[] {
  // 파일별로 마지막 Read 이후 Edit/Write가 없는 상태에서 다시 Read하는 경우를 탐지
  const lastReadId = new Map<string, string>()
  const modifiedSinceLastRead = new Set<string>()
  const wastePairs: { first: string; second: string; path: string }[] = []

  for (const tc of session.toolCalls) {
    const path = tc.input.file_path as string | undefined

    if (tc.name === 'Read' && path) {
      if (lastReadId.has(path) && !modifiedSinceLastRead.has(path)) {
        wastePairs.push({ first: lastReadId.get(path)!, second: tc.id, path })
      }
      lastReadId.set(path, tc.id)
      modifiedSinceLastRead.delete(path)
    } else if ((tc.name === 'Edit' || tc.name === 'Write') && path) {
      modifiedSinceLastRead.add(path)
    }
  }

  if (wastePairs.length === 0) return []

  return [
    {
      type: 'context-waste',
      severity: wastePairs.length >= 5 ? 'high' : wastePairs.length >= 3 ? 'medium' : 'low',
      description: `변경 없이 동일 파일을 재로드한 패턴 ${wastePairs.length}건 검출`,
      evidence: wastePairs.map(
        (p) => `${p.first} → ${p.second} (${p.path.split('/').pop() ?? p.path})`,
      ),
      count: wastePairs.length,
    },
  ]
}
