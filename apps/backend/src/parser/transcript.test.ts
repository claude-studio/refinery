// Design Ref: §8.2 L1 단위 테스트
// #4 정상 JSONL 파싱 → ParsedSession 구조 검증
// #5 isSidechain=true 라인 필터링 → 서브에이전트 메시지 제외
// #6 tool_use ↔ tool_result 매핑 → toolUseId 기준 연결 확인
// #12 classifier → taskType 정확도 검증

import { describe, expect, it } from 'vitest'

import { classify } from './classifier'
import { computeTopFiles, parseTranscript, type RawTranscriptLine } from './transcript'

// ─── 공통 픽스처 ─────────────────────────────────────────────────────────────

const SESSION_ID = '550e8400-e29b-41d4-a716-446655440000'
const PROJECT_PATH = '/Users/user/projects/myapp'
const TS = '2026-04-17T09:00:00.000Z'

function makeLine(overrides: Partial<RawTranscriptLine> & { type: string }): RawTranscriptLine {
  return {
    uuid: 'line-uuid',
    parentUuid: null,
    isSidechain: false,
    message: {},
    timestamp: TS,
    ...overrides,
  }
}

// ─── §8.2 #4: 정상 JSONL 파싱 ────────────────────────────────────────────────

describe('parseTranscript — 정상 파싱', () => {
  it('사용자 문자열 메시지를 ParsedMessage로 변환한다', () => {
    const lines: RawTranscriptLine[] = [
      makeLine({ uuid: 'u1', type: 'user', message: { role: 'user', content: '파일 읽어줘' } }),
    ]
    const session = parseTranscript(SESSION_ID, PROJECT_PATH, lines)

    expect(session.sessionId).toBe(SESSION_ID)
    expect(session.projectPath).toBe(PROJECT_PATH)
    expect(session.messages).toHaveLength(1)
    expect(session.messages[0].role).toBe('user')
    expect(session.messages[0].content).toBe('파일 읽어줘')
    expect(session.messages[0].isSidechain).toBe(false)
  })

  it('assistant 텍스트 content 배열에서 메시지를 추출한다', () => {
    const lines: RawTranscriptLine[] = [
      makeLine({
        uuid: 'a1',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'thinking', text: '생각 중...' },
            { type: 'text', text: '파일을 읽겠습니다.' },
          ],
        },
      }),
    ]
    const session = parseTranscript(SESSION_ID, PROJECT_PATH, lines)

    expect(session.messages).toHaveLength(1)
    expect(session.messages[0].role).toBe('assistant')
    expect(session.messages[0].content).toContain('파일을 읽겠습니다.')
  })

  it('빈 라인 배열이면 빈 messages/toolCalls를 반환한다', () => {
    const session = parseTranscript(SESSION_ID, PROJECT_PATH, [])
    expect(session.messages).toHaveLength(0)
    expect(session.toolCalls).toHaveLength(0)
  })

  it('permission-mode, attachment 등 비메시지 타입은 무시한다', () => {
    const lines: RawTranscriptLine[] = [
      makeLine({ uuid: 'p1', type: 'permission-mode', message: { permissionMode: 'default' } }),
      makeLine({ uuid: 'u1', type: 'user', message: { role: 'user', content: '안녕' } }),
    ]
    const session = parseTranscript(SESSION_ID, PROJECT_PATH, lines)
    expect(session.messages).toHaveLength(1)
  })
})

// ─── §8.2 #5: isSidechain 필터링 ──────────────────────────────────────────────

describe('parseTranscript — isSidechain 필터링', () => {
  it('isSidechain=true 라인은 messages/toolCalls에서 제외한다', () => {
    const lines: RawTranscriptLine[] = [
      makeLine({
        uuid: 'main-1',
        type: 'user',
        isSidechain: false,
        message: { role: 'user', content: '메인 메시지' },
      }),
      makeLine({
        uuid: 'side-1',
        type: 'user',
        isSidechain: true,
        message: { role: 'user', content: '서브에이전트 메시지 (제외되어야 함)' },
      }),
      makeLine({
        uuid: 'side-2',
        type: 'assistant',
        isSidechain: true,
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: '서브에이전트 응답 (제외되어야 함)' }],
        },
      }),
    ]
    const session = parseTranscript(SESSION_ID, PROJECT_PATH, lines)

    expect(session.messages).toHaveLength(1)
    expect(session.messages[0].uuid).toBe('main-1')
  })

  it('모든 라인이 sidechain이면 빈 결과를 반환한다', () => {
    const lines: RawTranscriptLine[] = [
      makeLine({ uuid: 's1', type: 'user', isSidechain: true, message: { content: '서브' } }),
      makeLine({ uuid: 's2', type: 'assistant', isSidechain: true, message: { content: [] } }),
    ]
    const session = parseTranscript(SESSION_ID, PROJECT_PATH, lines)
    expect(session.messages).toHaveLength(0)
    expect(session.toolCalls).toHaveLength(0)
  })
})

// ─── §8.2 #6: tool_use ↔ tool_result 매핑 ─────────────────────────────────────

describe('parseTranscript — tool_use↔tool_result 매핑', () => {
  it('tool_use_id 기준으로 tool_use와 tool_result를 연결한다', () => {
    const lines: RawTranscriptLine[] = [
      // assistant: tool_use 발행
      makeLine({
        uuid: 'a1',
        type: 'assistant',
        timestamp: '2026-04-17T09:00:00.000Z',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_01abc',
              name: 'Read',
              input: { file_path: '/src/app.ts' },
            },
          ],
        },
      }),
      // user: tool_result 반환
      makeLine({
        uuid: 'u1',
        type: 'user',
        timestamp: '2026-04-17T09:00:01.000Z',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_01abc',
              content: [{ type: 'text', text: 'export const app = ...' }],
              is_error: false,
            },
          ],
        },
      }),
    ]
    const session = parseTranscript(SESSION_ID, PROJECT_PATH, lines)

    expect(session.toolCalls).toHaveLength(1)
    const tc = session.toolCalls[0]
    expect(tc.id).toBe('toolu_01abc')
    expect(tc.name).toBe('Read')
    expect(tc.input).toEqual({ file_path: '/src/app.ts' })
    expect(tc.resultText).toBe('export const app = ...')
    expect(tc.isError).toBe(false)
  })

  it('is_error=true인 tool_result는 isError=true로 매핑된다', () => {
    const lines: RawTranscriptLine[] = [
      makeLine({
        uuid: 'a1',
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 'toolu_err', name: 'Bash', input: { command: 'bad cmd' } },
          ],
        },
      }),
      makeLine({
        uuid: 'u1',
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_err',
              content: [{ type: 'text', text: 'command not found' }],
              is_error: true,
            },
          ],
        },
      }),
    ]
    const session = parseTranscript(SESSION_ID, PROJECT_PATH, lines)

    expect(session.toolCalls[0].isError).toBe(true)
    expect(session.toolCalls[0].resultText).toBe('command not found')
  })

  it('tool_result가 없는 tool_use는 빈 resultText로 포함된다', () => {
    const lines: RawTranscriptLine[] = [
      makeLine({
        uuid: 'a1',
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'toolu_no_result',
              name: 'Write',
              input: { file_path: '/new.ts', content: '...' },
            },
          ],
        },
      }),
    ]
    const session = parseTranscript(SESSION_ID, PROJECT_PATH, lines)
    expect(session.toolCalls).toHaveLength(1)
    expect(session.toolCalls[0].resultText).toBe('')
    expect(session.toolCalls[0].isError).toBe(false)
  })

  it('여러 tool_use가 있을 때 각각 올바른 tool_result에 연결된다', () => {
    const lines: RawTranscriptLine[] = [
      makeLine({
        uuid: 'a1',
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 'tc1', name: 'Read', input: { file_path: '/a.ts' } },
            { type: 'tool_use', id: 'tc2', name: 'Grep', input: { pattern: 'export' } },
          ],
        },
      }),
      makeLine({
        uuid: 'u1',
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tc1',
              content: [{ type: 'text', text: 'content of a.ts' }],
            },
            {
              type: 'tool_result',
              tool_use_id: 'tc2',
              content: [{ type: 'text', text: 'grep results' }],
            },
          ],
        },
      }),
    ]
    const session = parseTranscript(SESSION_ID, PROJECT_PATH, lines)

    expect(session.toolCalls).toHaveLength(2)
    const tc1 = session.toolCalls.find((t) => t.id === 'tc1')!
    const tc2 = session.toolCalls.find((t) => t.id === 'tc2')!
    expect(tc1.resultText).toBe('content of a.ts')
    expect(tc2.resultText).toBe('grep results')
  })
})

// ─── computeTopFiles ─────────────────────────────────────────────────────────

describe('computeTopFiles', () => {
  it('접근 횟수 기준 상위 N개 파일 경로를 반환한다', () => {
    const session = parseTranscript(SESSION_ID, PROJECT_PATH, [
      makeLine({
        uuid: 'a1',
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/a.ts' } },
            { type: 'tool_use', id: 't2', name: 'Read', input: { file_path: '/a.ts' } },
            { type: 'tool_use', id: 't3', name: 'Read', input: { file_path: '/b.ts' } },
            { type: 'tool_use', id: 't4', name: 'Edit', input: { file_path: '/c.ts' } },
          ],
        },
      }),
    ])

    const top2 = computeTopFiles(session, 2)
    expect(top2[0]).toBe('/a.ts') // 2회
    expect(top2).toHaveLength(2)
  })
})

// ─── §8.2 #12: classifier 분류 정확도 ─────────────────────────────────────────

describe('classify — taskType 분류', () => {
  function makeSession(toolCallDefs: { name: string; filePath?: string; isError?: boolean }[]) {
    const toolCalls = toolCallDefs.map((d, i) => ({
      id: `tc${i}`,
      name: d.name,
      input: d.filePath ? { file_path: d.filePath } : {},
      resultText: '',
      isError: d.isError ?? false,
      timestamp: new Date(TS),
    }))
    return {
      sessionId: SESSION_ID,
      projectPath: PROJECT_PATH,
      startedAt: new Date(TS),
      endedAt: new Date(TS),
      messages: [],
      toolCalls,
    }
  }

  it('설정 파일 비중이 높으면 config로 분류한다', () => {
    const session = makeSession([
      { name: 'Read', filePath: 'package.json' },
      { name: 'Edit', filePath: 'tsconfig.json' },
      { name: 'Edit', filePath: '.env' },
    ])
    expect(classify(session).taskType).toBe('config')
  })

  it('오류 비율이 높으면 bug-fix로 분류한다', () => {
    const session = makeSession([
      { name: 'Bash', isError: true },
      { name: 'Bash', isError: true },
      { name: 'Read' },
      { name: 'Edit' },
    ])
    expect(classify(session).taskType).toBe('bug-fix')
  })

  it('Write 비중이 높으면 feature로 분류한다', () => {
    const session = makeSession([
      { name: 'Write', filePath: '/src/new-feature.ts' },
      { name: 'Write', filePath: '/src/new-types.ts' },
      { name: 'Edit', filePath: '/src/index.ts' },
      { name: 'Read', filePath: '/src/existing.ts' },
    ])
    expect(classify(session).taskType).toBe('feature')
  })

  it('Read+Edit 혼합이면 refactor로 분류한다', () => {
    const session = makeSession([
      { name: 'Read', filePath: '/a.ts' },
      { name: 'Read', filePath: '/b.ts' },
      { name: 'Read', filePath: '/c.ts' },
      { name: 'Edit', filePath: '/a.ts' },
    ])
    expect(classify(session).taskType).toBe('refactor')
  })

  it('Read 위주이면 exploration으로 분류한다', () => {
    const session = makeSession([
      { name: 'Read', filePath: '/a.ts' },
      { name: 'Read', filePath: '/b.ts' },
      { name: 'Grep' },
      { name: 'Glob' },
    ])
    expect(classify(session).taskType).toBe('exploration')
  })

  it('도구 호출이 없으면 exploration으로 분류한다', () => {
    const session = makeSession([])
    expect(classify(session).taskType).toBe('exploration')
  })
})
