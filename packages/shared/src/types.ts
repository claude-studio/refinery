// Design Ref: §3.1 — 공통 엔티티 타입 정의 (백엔드↔프론트↔에이전트 공유)

// ─── 파싱된 세션 (백엔드 내부 처리 단위) ─────────────────────────────────────

export interface ParsedSession {
  sessionId: string
  projectPath: string
  startedAt: Date
  endedAt: Date
  messages: ParsedMessage[]
  toolCalls: ParsedToolCall[]
}

export interface ParsedMessage {
  uuid: string
  parentUuid: string | null
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isSidechain: boolean
}

export interface ParsedToolCall {
  id: string // tool_use_id
  name: string // Read, Bash, Grep, Edit, Write, etc.
  input: Record<string, unknown>
  resultText: string
  isError: boolean
  timestamp: Date
}

// ─── 비효율 패턴 검출 결과 ──────────────────────────────────────────────────

export type InefficiencyType = 'repeat-read' | 'failed-retry' | 'bash-antipattern' | 'context-waste'
export type InefficiencySeverity = 'high' | 'medium' | 'low'

export interface Inefficiency {
  type: InefficiencyType
  severity: InefficiencySeverity
  description: string
  evidence: string[] // 근거 (파일경로, 도구호출ID 등)
  count: number
}

// ─── 세션 요약 (DB 저장 + API 응답) ──────────────────────────────────────────

export type TaskType = 'bug-fix' | 'feature' | 'refactor' | 'exploration' | 'config'

export interface SessionSummary {
  sessionId: string
  projectPath: string
  startedAt: Date
  endedAt: Date
  durationMin: number
  taskType: TaskType
  taskDescription: string
  inefficiencies: Inefficiency[]
  inefficiencyCount: number
  topFiles: string[]
  totalToolCalls: number
}

// ─── 에이전트 → 백엔드 트랜스크립트 인제스트 페이로드 ──────────────────────────

export interface TranscriptLine {
  uuid: string
  parentUuid: string | null
  type: 'user' | 'assistant'
  message: Record<string, unknown>
  timestamp: string
}

export interface IngestTranscriptPayload {
  sessionId: string
  projectPath: string
  lines: TranscriptLine[]
  agentVersion: string
}

// ─── API 응답 표준 ──────────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiSuccess<T> {
  data: T
  meta?: PaginationMeta
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ─── API 응답 타입 (프론트엔드 사용) ─────────────────────────────────────────

export interface SessionListItem {
  id: string
  sessionId: string
  projectPath: string
  startedAt: string
  endedAt: string | null
  durationMin: number | null
  taskType: TaskType | null
  taskDescription: string | null
  inefficiencyCount: number
  totalToolCalls: number
}

export interface SessionDetail {
  session: SessionListItem
  inefficiencies: Inefficiency[]
  toolCallTimeline: {
    name: string
    input: Record<string, unknown>
    isError: boolean
    timestamp: string
  }[]
  otelMetrics: {
    totalTokens: number | null
    avgLatencyMs: number | null
  }
}

export interface WeeklyReportData {
  id: string
  weekStart: string
  insights: string[]
  stats: {
    totalSessions: number
    totalInefficiencies: number
    byType: Record<InefficiencyType, number>
  }
  generatedAt: string
}

export interface SseEvent {
  sessionId: string
  inefficiencyCount: number
  taskType: TaskType | null
}
