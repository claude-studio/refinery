// Design Ref: §2.2 트랜스크립트 파이프라인: parse() 단계
// Plan §10.1: 실제 JSONL 스키마 기반 파싱
// Test: §8.2 #4 정상 파싱, #5 isSidechain 필터링, #6 tool_use↔tool_result 매핑

import type { ParsedMessage, ParsedSession, ParsedToolCall } from '@refinery/shared'

// ─── 내부 content 아이템 타입 ────────────────────────────────────────────────

interface ToolUseItem {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

interface ToolResultItem {
  type: 'tool_result'
  tool_use_id: string
  content: Array<{ type: string; text?: string }> | string
  is_error?: boolean
}

interface TextItem {
  type: 'text' | 'thinking'
  text: string
}

type ContentItem = ToolUseItem | ToolResultItem | TextItem | { type: string }

// ─── 입력 라인 타입 (IngestPayload.lines 와 동일) ────────────────────────────

export interface RawTranscriptLine {
  uuid: string
  parentUuid: string | null
  isSidechain: boolean
  type: string
  message: Record<string, unknown>
  timestamp: string
}

// ─── 파서 ────────────────────────────────────────────────────────────────────

/**
 * JSONL 라인 배열을 ParsedSession으로 변환한다.
 * - isSidechain=true 라인 제거 (서브에이전트 대화 제외)
 * - tool_use ↔ tool_result 연결 (tool_use_id 기준)
 * - 마스킹은 이미 적용된 상태로 전달받아야 한다
 */
export function parseTranscript(
  sessionId: string,
  projectPath: string,
  lines: RawTranscriptLine[],
): ParsedSession {
  // Step 1: 메인 라인만 추출 (isSidechain 제거, user/assistant 타입만)
  const mainLines = lines.filter(
    (l) => !l.isSidechain && (l.type === 'user' || l.type === 'assistant'),
  )

  // Step 2: tool_use 맵 (id → { toolUse, timestamp })
  //         tool_result 맵 (tool_use_id → ToolResultItem)
  const toolUseMap = new Map<string, { toolUse: ToolUseItem; timestamp: Date }>()
  const toolResultMap = new Map<string, ToolResultItem>()
  const messages: ParsedMessage[] = []

  for (const line of mainLines) {
    const timestamp = new Date(line.timestamp)
    const content = line.message.content

    if (line.type === 'assistant' && Array.isArray(content)) {
      const textParts: string[] = []

      for (const item of content as ContentItem[]) {
        if (item.type === 'tool_use') {
          const tu = item as ToolUseItem
          toolUseMap.set(tu.id, { toolUse: tu, timestamp })
        } else if (item.type === 'text' || item.type === 'thinking') {
          const t = item as TextItem
          if (t.text) textParts.push(t.text)
        }
      }

      if (textParts.length > 0) {
        messages.push({
          uuid: line.uuid,
          parentUuid: line.parentUuid,
          role: 'assistant',
          content: textParts.join('\n'),
          timestamp,
          isSidechain: false,
        })
      }
    } else if (line.type === 'user') {
      if (typeof content === 'string') {
        // 단순 텍스트 메시지
        messages.push({
          uuid: line.uuid,
          parentUuid: line.parentUuid,
          role: 'user',
          content,
          timestamp,
          isSidechain: false,
        })
      } else if (Array.isArray(content)) {
        const textParts: string[] = []

        for (const item of content as ContentItem[]) {
          if (item.type === 'tool_result') {
            const tr = item as ToolResultItem
            toolResultMap.set(tr.tool_use_id, tr)
          } else if (item.type === 'text') {
            const t = item as TextItem
            if (t.text) textParts.push(t.text)
          }
        }

        if (textParts.length > 0) {
          messages.push({
            uuid: line.uuid,
            parentUuid: line.parentUuid,
            role: 'user',
            content: textParts.join('\n'),
            timestamp,
            isSidechain: false,
          })
        }
      }
    }
  }

  // Step 3: tool_use + tool_result 매핑 → ParsedToolCall 목록
  const toolCalls: ParsedToolCall[] = []

  for (const [toolUseId, { toolUse, timestamp }] of toolUseMap) {
    const result = toolResultMap.get(toolUseId)

    let resultText = ''
    let isError = false

    if (result) {
      isError = result.is_error ?? false
      if (typeof result.content === 'string') {
        resultText = result.content
      } else if (Array.isArray(result.content)) {
        resultText = result.content
          .filter((c) => c.type === 'text')
          .map((c) => c.text ?? '')
          .join('\n')
      }
    }

    toolCalls.push({
      id: toolUseId,
      name: toolUse.name,
      input: toolUse.input,
      resultText,
      isError,
      timestamp,
    })
  }

  // 타임스탬프 순 정렬
  toolCalls.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  // 세션 시작/종료 시간 산출
  const allTimes = [
    ...messages.map((m) => m.timestamp.getTime()),
    ...toolCalls.map((t) => t.timestamp.getTime()),
  ]
  const startedAt = allTimes.length > 0 ? new Date(Math.min(...allTimes)) : new Date()
  const endedAt = allTimes.length > 0 ? new Date(Math.max(...allTimes)) : new Date()

  return { sessionId, projectPath, startedAt, endedAt, messages, toolCalls }
}

/**
 * 세션에서 가장 많이 접근된 파일 경로 상위 N개 반환
 */
export function computeTopFiles(session: ParsedSession, limit: number): string[] {
  const freq = new Map<string, number>()

  for (const tc of session.toolCalls) {
    const path = tc.input.file_path as string | undefined
    if (path) freq.set(path, (freq.get(path) ?? 0) + 1)
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([path]) => path)
}
