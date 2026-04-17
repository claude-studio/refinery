// Design Ref: §2.2 트랜스크립트 파이프라인 → analyzer/bash-antipattern.ts
// Plan FR-08: cat/grep/find → Read/Grep/Glob 대체 가능 판단
// Test: §8.2 #10 (cat), #11 (grep)

import type { Inefficiency, ParsedSession } from '@refinery/shared'

interface Pattern {
  re: RegExp
  suggestion: string
}

const PATTERNS: Pattern[] = [
  { re: /^\s*cat\s+\S/, suggestion: 'Read 도구로 대체 가능' },
  { re: /^\s*grep\s+/, suggestion: 'Grep 도구로 대체 가능' },
  { re: /^\s*find\s+/, suggestion: 'Glob 도구로 대체 가능' },
  { re: /^\s*head\s+/, suggestion: 'Read 도구(limit 파라미터)로 대체 가능' },
  { re: /^\s*tail\s+/, suggestion: 'Read 도구(offset 파라미터)로 대체 가능' },
]

export function detectBashAntipattern(session: ParsedSession): Inefficiency[] {
  const hits: { id: string; command: string; suggestion: string }[] = []

  for (const tc of session.toolCalls) {
    if (tc.name !== 'Bash') continue
    const command = tc.input.command as string | undefined
    if (!command) continue

    for (const { re, suggestion } of PATTERNS) {
      if (re.test(command)) {
        hits.push({ id: tc.id, command: command.trim().slice(0, 80), suggestion })
        break
      }
    }
  }

  if (hits.length === 0) return []

  return [
    {
      type: 'bash-antipattern',
      severity: hits.length >= 5 ? 'high' : hits.length >= 3 ? 'medium' : 'low',
      description: `전용 도구로 대체 가능한 Bash 명령 ${hits.length}건 검출`,
      evidence: hits.map((h) => `${h.id}: ${h.command} → ${h.suggestion}`),
      count: hits.length,
    },
  ]
}
