import type { WeeklyReportData } from '@refinery/shared'

interface Props {
  report: WeeklyReportData
}

function formatWeek(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

export function WeeklyInsightCard({ report }: Props) {
  const { stats } = report

  return (
    <div className="space-y-8">
      <div className="flex items-baseline gap-4">
        <span className="text-stone-gray text-[10px] tracking-[2.4px]">
          WEEK OF {formatWeek(report.weekStart).toUpperCase()}
        </span>
        <span className="text-stone-gray text-xs">
          생성 {new Date(report.generatedAt).toLocaleDateString('ko-KR')}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-px border border-[rgba(226,226,226,0.35)]">
        <StatCell label="총 세션" value={stats.totalSessions} />
        <StatCell label="비효율 건수" value={stats.totalInefficiencies} />
        <StatCell
          label="세션당 평균"
          value={
            stats.totalSessions > 0
              ? (stats.totalInefficiencies / stats.totalSessions).toFixed(1)
              : '0'
          }
        />
      </div>

      {report.insights.length > 0 && (
        <div className="space-y-4">
          <p className="text-stone-gray text-[10px] tracking-[2.4px]">INSIGHTS</p>
          <ol className="space-y-3">
            {report.insights.map((insight, i) => (
              <li key={i} className="flex gap-4">
                <span className="text-stone-gray shrink-0 text-xs tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="text-ash-gray text-sm leading-relaxed">{insight}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {Object.keys(stats.byType).length > 0 && (
        <div className="space-y-3">
          <p className="text-stone-gray text-[10px] tracking-[2.4px]">BY TYPE</p>
          <div className="space-y-2">
            {Object.entries(stats.byType).map(([type, count]) => (
              <TypeBar key={type} type={type} count={count} total={stats.totalInefficiencies} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[rgba(255,255,255,0.04)] px-5 py-4">
      <p className="text-stone-gray text-[10px] tracking-[1.4px]">{label.toUpperCase()}</p>
      <p className="text-warm-parchment mt-1 text-2xl">{value}</p>
    </div>
  )
}

function TypeBar({ type, count, total }: { type: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  const label = type.replace(/-/g, ' ').toUpperCase()

  return (
    <div className="flex items-center gap-4">
      <span className="text-stone-gray w-36 shrink-0 text-[10px] tracking-[1.4px]">{label}</span>
      <div className="h-px flex-1 bg-[rgba(226,226,226,0.12)]">
        <div className="h-px bg-[rgba(226,226,226,0.5)]" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-ash-gray w-6 text-right text-xs tabular-nums">{count}</span>
    </div>
  )
}
