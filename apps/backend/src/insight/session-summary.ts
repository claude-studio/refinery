// Design Ref: §2.2 파이프라인: summarize() 단계
// Plan FR-10: 세션 요약 생성 — 작업 목록 + 비효율 건수 + 주요 파일 목록

import type { Inefficiency, ParsedSession, SessionSummary } from '@refinery/shared'

import type { ClassificationResult } from '../parser/classifier.js'
import { computeTopFiles } from '../parser/transcript.js'

const TOP_FILES_LIMIT = 10

export function summarize(
  session: ParsedSession,
  classification: ClassificationResult,
  inefficiencies: Inefficiency[],
): SessionSummary {
  const durationMin = (session.endedAt.getTime() - session.startedAt.getTime()) / 1000 / 60

  return {
    sessionId: session.sessionId,
    projectPath: session.projectPath,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMin: Math.round(durationMin * 10) / 10,
    taskType: classification.taskType,
    taskDescription: classification.taskDescription,
    inefficiencies,
    inefficiencyCount: inefficiencies.length,
    topFiles: computeTopFiles(session, TOP_FILES_LIMIT),
    totalToolCalls: session.toolCalls.length,
  }
}
