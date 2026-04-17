import { notFound } from 'next/navigation'

import { InefficiencyBadge } from '@/components/inefficiency-badge'
import { MetricChart } from '@/components/metric-chart'
import { ToolCallTimeline } from '@/components/tool-call-timeline'
import { fetchSession } from '@/lib/api'

interface Props {
  params: Promise<{ id: string }>
}

const TASK_LABELS: Record<string, string> = {
  'bug-fix': 'BUG FIX',
  feature: 'FEATURE',
  refactor: 'REFACTOR',
  exploration: 'EXPLORATION',
  config: 'CONFIG',
}

function formatDuration(min: number | null): string {
  if (min === null) return '—'
  if (min < 60) return `${Math.round(min)}분`
  return `${Math.floor(min / 60)}시간 ${Math.round(min % 60)}분`
}

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function SessionDetailPage({ params }: Props) {
  const { id } = await params

  let res
  try {
    res = await fetchSession(id)
  } catch {
    notFound()
  }

  const { session, inefficiencies, toolCallTimeline, otelMetrics } = res.data

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center gap-3">
          <a
            href="/sessions"
            className="text-stone-gray hover:text-ash-gray text-[10px] tracking-[1.4px]"
          >
            SESSIONS
          </a>
          <span className="text-stone-gray">/</span>
          <span className="text-stone-gray font-[family-name:var(--font-family-geist-mono)] text-[10px]">
            {session.sessionId.slice(0, 8)}
          </span>
        </div>
        <h1 className="text-warm-parchment mt-3 text-2xl">
          {session.taskDescription ?? `/${session.projectPath.split('/').pop()}`}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-px border border-[rgba(226,226,226,0.35)] sm:grid-cols-4">
        <MetaCell
          label="작업 유형"
          value={session.taskType ? (TASK_LABELS[session.taskType] ?? session.taskType) : '—'}
        />
        <MetaCell label="소요 시간" value={formatDuration(session.durationMin)} />
        <MetaCell label="도구 호출" value={`${session.totalToolCalls}회`} />
        <MetaCell
          label="비효율"
          value={`${session.inefficiencyCount}건`}
          highlight={session.inefficiencyCount > 0}
        />
      </div>

      <div className="text-stone-gray space-y-1 text-xs">
        <p>{session.projectPath}</p>
        <p>
          {formatDatetime(session.startedAt)}
          {session.endedAt ? ` — ${formatDatetime(session.endedAt)}` : ''}
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-8">
          <section>
            <p className="text-stone-gray text-[10px] tracking-[2.4px]">INEFFICIENCIES</p>
            <div className="mt-4">
              {inefficiencies.length === 0 ? (
                <p className="text-stone-gray text-sm">비효율 패턴 없음</p>
              ) : (
                <div className="space-y-4">
                  {inefficiencies.map((item, i) => (
                    <div key={i} className="space-y-1.5">
                      <InefficiencyBadge type={item.type} severity={item.severity} />
                      <p className="text-ash-gray text-sm">{item.description}</p>
                      {item.evidence.length > 0 && (
                        <ul className="space-y-0.5">
                          {item.evidence.slice(0, 3).map((e, j) => (
                            <li
                              key={j}
                              className="text-stone-gray font-[family-name:var(--font-family-geist-mono)] text-[11px]"
                            >
                              {e}
                            </li>
                          ))}
                          {item.evidence.length > 3 && (
                            <li className="text-stone-gray text-[11px]">
                              +{item.evidence.length - 3}개
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section>
            <p className="text-stone-gray text-[10px] tracking-[2.4px]">OTEL METRICS</p>
            <div className="mt-4">
              <MetricChart
                totalTokens={otelMetrics.totalTokens}
                avgLatencyMs={otelMetrics.avgLatencyMs}
              />
            </div>
          </section>
        </div>

        <section>
          <p className="text-stone-gray text-[10px] tracking-[2.4px]">
            TOOL CALL TIMELINE — {toolCallTimeline.length}
          </p>
          <div className="mt-4">
            <ToolCallTimeline timeline={toolCallTimeline} />
          </div>
        </section>
      </div>
    </div>
  )
}

function MetaCell({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="bg-[rgba(255,255,255,0.04)] px-5 py-4">
      <p className="text-stone-gray text-[10px] tracking-[1.4px]">{label.toUpperCase()}</p>
      <p className={`mt-1 text-lg ${highlight ? 'text-warm-parchment' : 'text-ash-gray'}`}>
        {value}
      </p>
    </div>
  )
}
