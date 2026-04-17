// Design Ref: §8.2 L1 단위 테스트
// #7 repeat-read 3회 → 반환, #8 2회 → 미반환
// #9 failed-retry 동일 도구 실패+3회 재시도 → 반환
// #10 bash-antipattern cat → 반환, #11 grep → 반환

import type { ParsedSession, ParsedToolCall } from '@refinery/shared'
import { describe, expect, it } from 'vitest'

import { detectBashAntipattern } from './bash-antipattern'
import { detectContextWaste } from './context-waste'
import { detectFailedRetry } from './failed-retry'
import { detectRepeatRead } from './repeat-read'

const TS = new Date('2026-04-17T09:00:00.000Z')
const SESSION_ID = '550e8400-e29b-41d4-a716-446655440000'
const PROJECT_PATH = '/Users/user/projects/myapp'

function makeSession(toolCalls: ParsedToolCall[]): ParsedSession {
  return {
    sessionId: SESSION_ID,
    projectPath: PROJECT_PATH,
    startedAt: TS,
    endedAt: TS,
    messages: [],
    toolCalls,
  }
}

function makeToolCall(
  id: string,
  name: string,
  input: Record<string, unknown>,
  isError = false,
): ParsedToolCall {
  return { id, name, input, resultText: '', isError, timestamp: TS }
}

// ─── §8.2 #7, #8: repeat-read ──────────────────────────────────────────────

describe('detectRepeatRead', () => {
  it('동일 파일을 3회 Read하면 Inefficiency를 반환한다 (#7)', () => {
    const session = makeSession([
      makeToolCall('t1', 'Read', { file_path: '/src/app.ts' }),
      makeToolCall('t2', 'Read', { file_path: '/src/app.ts' }),
      makeToolCall('t3', 'Read', { file_path: '/src/app.ts' }),
    ])
    const result = detectRepeatRead(session)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('repeat-read')
    expect(result[0].count).toBe(3)
    expect(result[0].evidence).toEqual(['t1', 't2', 't3'])
  })

  it('동일 파일을 2회만 Read하면 Inefficiency를 반환하지 않는다 (#8)', () => {
    const session = makeSession([
      makeToolCall('t1', 'Read', { file_path: '/src/app.ts' }),
      makeToolCall('t2', 'Read', { file_path: '/src/app.ts' }),
    ])
    expect(detectRepeatRead(session)).toHaveLength(0)
  })

  it('5회 이상이면 severity가 high다', () => {
    const session = makeSession(
      Array.from({ length: 5 }, (_, i) =>
        makeToolCall(`t${i}`, 'Read', { file_path: '/src/app.ts' }),
      ),
    )
    expect(detectRepeatRead(session)[0].severity).toBe('high')
  })

  it('서로 다른 파일은 개별적으로 집계한다', () => {
    const session = makeSession([
      makeToolCall('t1', 'Read', { file_path: '/a.ts' }),
      makeToolCall('t2', 'Read', { file_path: '/a.ts' }),
      makeToolCall('t3', 'Read', { file_path: '/a.ts' }),
      makeToolCall('t4', 'Read', { file_path: '/b.ts' }),
      makeToolCall('t5', 'Read', { file_path: '/b.ts' }),
    ])
    const result = detectRepeatRead(session)
    expect(result).toHaveLength(1)
    expect(result[0].description).toContain('/a.ts')
  })

  it('Read가 아닌 도구는 집계에서 제외한다', () => {
    const session = makeSession([
      makeToolCall('t1', 'Edit', { file_path: '/src/app.ts' }),
      makeToolCall('t2', 'Edit', { file_path: '/src/app.ts' }),
      makeToolCall('t3', 'Edit', { file_path: '/src/app.ts' }),
    ])
    expect(detectRepeatRead(session)).toHaveLength(0)
  })
})

// ─── §8.2 #9: failed-retry ───────────────────────────────────────────────────

describe('detectFailedRetry', () => {
  it('동일 도구+인자가 3회 호출되고 오류 포함이면 Inefficiency를 반환한다 (#9)', () => {
    const session = makeSession([
      makeToolCall('t1', 'Bash', { command: 'npm test' }, true),
      makeToolCall('t2', 'Bash', { command: 'npm test' }),
      makeToolCall('t3', 'Bash', { command: 'npm test' }),
    ])
    const result = detectFailedRetry(session)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('failed-retry')
    expect(result[0].count).toBe(3)
  })

  it('오류 없이 3회 반복이면 Inefficiency를 반환하지 않는다', () => {
    const session = makeSession([
      makeToolCall('t1', 'Bash', { command: 'npm test' }),
      makeToolCall('t2', 'Bash', { command: 'npm test' }),
      makeToolCall('t3', 'Bash', { command: 'npm test' }),
    ])
    expect(detectFailedRetry(session)).toHaveLength(0)
  })

  it('2회 호출이면 Inefficiency를 반환하지 않는다', () => {
    const session = makeSession([
      makeToolCall('t1', 'Bash', { command: 'npm test' }, true),
      makeToolCall('t2', 'Bash', { command: 'npm test' }),
    ])
    expect(detectFailedRetry(session)).toHaveLength(0)
  })
})

// ─── §8.2 #10, #11: bash-antipattern ────────────────────────────────────────

describe('detectBashAntipattern', () => {
  it('cat 명령은 Read 대체 제안을 반환한다 (#10)', () => {
    const session = makeSession([makeToolCall('t1', 'Bash', { command: 'cat /src/app.ts' })])
    const result = detectBashAntipattern(session)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('bash-antipattern')
    expect(result[0].evidence[0]).toContain('Read 도구로 대체 가능')
  })

  it('grep 명령은 Grep 대체 제안을 반환한다 (#11)', () => {
    const session = makeSession([makeToolCall('t1', 'Bash', { command: 'grep "export" src/' })])
    const result = detectBashAntipattern(session)
    expect(result).toHaveLength(1)
    expect(result[0].evidence[0]).toContain('Grep 도구로 대체 가능')
  })

  it('find 명령은 Glob 대체 제안을 반환한다', () => {
    const session = makeSession([makeToolCall('t1', 'Bash', { command: 'find . -name "*.ts"' })])
    const result = detectBashAntipattern(session)
    expect(result[0].evidence[0]).toContain('Glob 도구로 대체 가능')
  })

  it('안티패턴 없는 Bash는 빈 배열을 반환한다', () => {
    const session = makeSession([makeToolCall('t1', 'Bash', { command: 'npm run build' })])
    expect(detectBashAntipattern(session)).toHaveLength(0)
  })

  it('Bash 도구가 없으면 빈 배열을 반환한다', () => {
    const session = makeSession([makeToolCall('t1', 'Read', { file_path: '/a.ts' })])
    expect(detectBashAntipattern(session)).toHaveLength(0)
  })

  it('안티패턴 5건 이상이면 severity가 high다', () => {
    const session = makeSession(
      Array.from({ length: 5 }, (_, i) =>
        makeToolCall(`t${i}`, 'Bash', { command: `cat /file${i}.ts` }),
      ),
    )
    expect(detectBashAntipattern(session)[0].severity).toBe('high')
  })
})

// ─── context-waste ────────────────────────────────────────────────────────────

describe('detectContextWaste', () => {
  it('Edit 없이 동일 파일을 두 번 Read하면 Inefficiency를 반환한다', () => {
    const session = makeSession([
      makeToolCall('t1', 'Read', { file_path: '/a.ts' }),
      makeToolCall('t2', 'Bash', { command: 'echo hi' }),
      makeToolCall('t3', 'Read', { file_path: '/a.ts' }),
    ])
    const result = detectContextWaste(session)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('context-waste')
    expect(result[0].count).toBe(1)
  })

  it('Read 사이에 Edit이 있으면 waste로 탐지하지 않는다', () => {
    const session = makeSession([
      makeToolCall('t1', 'Read', { file_path: '/a.ts' }),
      makeToolCall('t2', 'Edit', { file_path: '/a.ts' }),
      makeToolCall('t3', 'Read', { file_path: '/a.ts' }),
    ])
    expect(detectContextWaste(session)).toHaveLength(0)
  })

  it('파일 경로가 없는 도구 호출은 무시한다', () => {
    const session = makeSession([
      makeToolCall('t1', 'Bash', { command: 'ls' }),
      makeToolCall('t2', 'Grep', { pattern: 'export' }),
    ])
    expect(detectContextWaste(session)).toHaveLength(0)
  })
})
