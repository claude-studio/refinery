// Design Ref: §3.1 TaskType 의미적 작업 분류
// Plan SC: FR-05 — bug-fix / feature / refactor / exploration / config 분류
// Test: §8.2 #12 tool 호출 패턴 기반 분류 정확도 검증

import type { ParsedMessage, ParsedSession, TaskType } from '@refinery/shared'

export interface ClassificationResult {
  taskType: TaskType
  taskDescription: string
}

/**
 * ParsedSession의 도구 호출 패턴과 사용자 메시지 키워드를 분석해 작업 유형을 분류한다.
 */
export function classify(session: ParsedSession): ClassificationResult {
  const { toolCalls, messages } = session

  if (toolCalls.length === 0) {
    return { taskType: 'exploration', taskDescription: '코드 탐색' }
  }

  const counts = countByName(toolCalls.map((t) => t.name))
  const total = toolCalls.length

  // Read/Edit/Write 대상 파일 경로
  const filePaths = toolCalls
    .filter((t) => ['Read', 'Edit', 'Write'].includes(t.name))
    .flatMap((t) => {
      const p = t.input.file_path as string | undefined
      return p ? [p] : []
    })

  const configRatio = calcConfigFileRatio(filePaths)
  const errorRatio = toolCalls.filter((t) => t.isError).length / total
  const writeCount = (counts['Write'] ?? 0) + (counts['Edit'] ?? 0)
  const writeRatio = writeCount / total
  const readRatio = (counts['Read'] ?? 0) / total
  const hasNewFiles = (counts['Write'] ?? 0) > 0

  let taskType: TaskType

  if (configRatio > 0.4) {
    // 설정 파일 비중이 높으면 config
    taskType = 'config'
  } else if (errorRatio > 0.15 || hasFixKeywords(messages)) {
    // 오류 비율이 높거나 사용자 메시지에 수정 키워드
    taskType = 'bug-fix'
  } else if (writeRatio > 0.3 && hasNewFiles) {
    // 새 파일 생성 + 쓰기 비율이 높으면 feature
    taskType = 'feature'
  } else if (writeRatio > 0.15 && readRatio > 0.3) {
    // 읽기 + 수정 혼합이면 refactor
    taskType = 'refactor'
  } else {
    // 읽기/검색 위주면 exploration
    taskType = 'exploration'
  }

  return {
    taskType,
    taskDescription: buildDescription(taskType, filePaths),
  }
}

// ─── 내부 헬퍼 ───────────────────────────────────────────────────────────────

function countByName(names: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const name of names) {
    counts[name] = (counts[name] ?? 0) + 1
  }
  return counts
}

const CONFIG_FILE_RE =
  /package\.json|tsconfig|\.env|docker-compose|prettier|eslint|tailwind|vite\.config|next\.config|turbo\.json/i

function calcConfigFileRatio(filePaths: string[]): number {
  if (filePaths.length === 0) return 0
  return filePaths.filter((f) => CONFIG_FILE_RE.test(f)).length / filePaths.length
}

function hasFixKeywords(messages: ParsedMessage[]): boolean {
  const userContent = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join(' ')
    .toLowerCase()
  return /fix|bug|error|오류|버그|수정|broken|crash|fail/.test(userContent)
}

function buildDescription(taskType: TaskType, filePaths: string[]): string {
  const labels: Record<TaskType, string> = {
    'bug-fix': '버그 수정',
    feature: '기능 개발',
    refactor: '리팩토링',
    exploration: '코드 탐색',
    config: '설정 변경',
  }

  const topFiles = [...new Set(filePaths)]
    .slice(0, 3)
    .map((f) => f.split('/').pop() ?? f)
    .join(', ')

  return topFiles ? `${labels[taskType]}: ${topFiles}` : labels[taskType]
}
