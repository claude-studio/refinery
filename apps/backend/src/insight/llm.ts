// Design Ref: §2.2 주간 리포트 — Claude Code SDK (구독 과금) 인사이트 생성
// Plan FR-11: LLM 인사이트 ≥ 3개, claude login 인증으로 구독 과금 동작
import { query } from '@anthropic-ai/claude-agent-sdk'

interface LlmInsightInput {
  weekStart: string
  totalSessions: number
  totalInefficiencies: number
  byType: Record<string, number>
  sessionSamples: Array<{
    taskType: string
    inefficiencyCount: number
    durationMin: number
  }>
}

export function isLlmAvailable(): boolean {
  // DISABLE_LLM_INSIGHTS=1 로 명시적 비활성화 가능
  return process.env.DISABLE_LLM_INSIGHTS !== '1'
}

export async function generateLlmInsights(input: LlmInsightInput): Promise<string[]> {
  const typeNames: Record<string, string> = {
    'repeat-read': '반복 Read',
    'failed-retry': '실패 재시도',
    'bash-antipattern': 'Bash 안티패턴',
    'context-waste': '컨텍스트 낭비',
  }

  const byTypeText = Object.entries(input.byType)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `  - ${typeNames[type] ?? type}: ${count}건`)
    .join('\n')

  const prompt = `당신은 Claude Code 사용 패턴 분석 전문가입니다.
아래 주간 세션 통계를 분석하여 개발자가 실질적으로 개선할 수 있는 인사이트를 제공해주세요.

주간 세션 통계 (${input.weekStart} 시작 주):
- 총 세션 수: ${input.totalSessions}개
- 총 비효율 패턴: ${input.totalInefficiencies}건
- 비효율 유형별:
${byTypeText || '  없음'}

세션 샘플 (최대 5개):
${input.sessionSamples
  .slice(0, 5)
  .map(
    (s, i) =>
      `  ${i + 1}. 작업유형: ${s.taskType}, 비효율: ${s.inefficiencyCount}건, 소요시간: ${s.durationMin}분`,
  )
  .join('\n')}

응답 형식: JSON만 출력, 다른 텍스트 없이. 각 인사이트는 관찰 + 구체적 개선 제안 포함.
{"insights":["인사이트1","인사이트2","인사이트3"]}`

  let resultText: string | null = null

  for await (const message of query({
    prompt,
    options: { maxTurns: 1 },
  })) {
    if (message.type === 'result' && message.subtype === 'success') {
      resultText = message.result ?? null
    }
  }

  if (!resultText) {
    throw new Error('LLM 인사이트 생성 실패: 응답 없음 (claude login 상태를 확인하세요)')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(resultText)
  } catch {
    throw new Error(`LLM 응답 JSON 파싱 실패: ${resultText.slice(0, 200)}`)
  }

  const raw = parsed as Record<string, unknown>
  if (!Array.isArray(raw.insights)) {
    throw new Error('LLM 인사이트 형식 오류: insights 배열이 없습니다')
  }

  const insights = raw.insights.filter((s): s is string => typeof s === 'string')
  if (insights.length < 3) {
    throw new Error(`LLM 인사이트 부족: ${insights.length}개 (최소 3개 필요)`)
  }

  return insights
}
