// Design Ref: §2.2 주간 리포트 — stats 집계 + LLM 인사이트 (ANTHROPIC_API_KEY 있으면 LLM, 없으면 규칙 기반)
// Plan FR-11: 주간 인사이트 생성 인사이트 ≥ 3개
import type { WeeklyReportData } from '@refinery/shared'

import { prisma } from '../db/client.js'

import { generateLlmInsights, isLlmAvailable } from './llm.js'

export function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export async function generateWeeklyReport(weekStart: Date): Promise<WeeklyReportData> {
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

  const sessions = await prisma.session.findMany({
    where: { startedAt: { gte: weekStart, lt: weekEnd } },
    include: { inefficiencies: true },
  })

  const totalInefficiencies = sessions.reduce((sum, s) => sum + s.inefficiencyCount, 0)

  const byType: Record<string, number> = {
    'repeat-read': 0,
    'failed-retry': 0,
    'bash-antipattern': 0,
    'context-waste': 0,
  }
  for (const s of sessions) {
    for (const ineff of s.inefficiencies) {
      byType[ineff.type] = (byType[ineff.type] ?? 0) + 1
    }
  }

  const stats: WeeklyReportData['stats'] = {
    totalSessions: sessions.length,
    totalInefficiencies,
    byType: byType as WeeklyReportData['stats']['byType'],
  }

  let insights: string[]
  if (isLlmAvailable() && sessions.length > 0) {
    insights = await generateLlmInsights({
      weekStart: weekStart.toISOString(),
      totalSessions: sessions.length,
      totalInefficiencies,
      byType,
      sessionSamples: sessions.map((s) => ({
        taskType: (s.taskType as string) ?? 'unknown',
        inefficiencyCount: s.inefficiencyCount,
        durationMin: s.durationMin ?? 0,
      })),
    })
  } else {
    insights = buildInsights(sessions.length, totalInefficiencies, byType)
  }

  const report = await prisma.weeklyReport.upsert({
    where: { weekStart },
    create: { weekStart, insights, stats },
    update: { insights, stats, generatedAt: new Date() },
  })

  return {
    id: report.id,
    weekStart: report.weekStart.toISOString(),
    insights: report.insights as string[],
    stats: report.stats as WeeklyReportData['stats'],
    generatedAt: report.generatedAt.toISOString(),
  }
}

function buildInsights(
  sessionCount: number,
  totalInefficiencies: number,
  byType: Record<string, number>,
): string[] {
  if (sessionCount === 0) {
    return [
      '이번 주 세션 데이터가 없습니다.',
      '에이전트가 실행 중인지 확인해주세요.',
      '첫 세션 후 자동으로 분석됩니다.',
    ]
  }

  const insights: string[] = [
    `이번 주 ${sessionCount}개 세션에서 총 ${totalInefficiencies}건의 비효율 패턴이 감지되었습니다.`,
  ]

  const topType = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .find(([, count]) => count > 0)

  const typeNames: Record<string, string> = {
    'repeat-read': '반복 Read',
    'failed-retry': '실패 재시도',
    'bash-antipattern': 'Bash 안티패턴',
    'context-waste': '컨텍스트 낭비',
  }

  if (topType) {
    insights.push(
      `가장 빈번한 패턴: ${typeNames[topType[0]] ?? topType[0]} (${topType[1]}건) — 해당 패턴을 줄이면 세션 효율이 향상됩니다.`,
    )
  } else {
    insights.push('이번 주는 감지된 비효율 패턴이 없습니다. 훌륭한 세션이었습니다!')
  }

  const avgPerSession = (totalInefficiencies / sessionCount).toFixed(1)
  insights.push(`세션당 평균 비효율 건수: ${avgPerSession}건`)

  return insights
}
