import { SessionCard } from '@/components/session-card'
import { WeeklyInsightCard } from '@/components/weekly-insight-card'
import { fetchSessions, fetchWeeklyReport } from '@/lib/api'

export default async function HomePage() {
  const [reportRes, sessionsRes] = await Promise.allSettled([
    fetchWeeklyReport(),
    fetchSessions({ limit: 5 }),
  ])

  const report = reportRes.status === 'fulfilled' ? reportRes.value?.data : null
  const sessions = sessionsRes.status === 'fulfilled' ? sessionsRes.value.data : []

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-warm-parchment text-2xl">주간 리포트</h1>
        <div className="mt-8">
          {report ? <WeeklyInsightCard report={report} /> : <EmptyWeekly />}
        </div>
      </section>

      {sessions.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between">
            <p className="text-stone-gray text-[10px] tracking-[2.4px]">최근 세션</p>
            <a
              href="/sessions"
              className="text-muted-purple text-[10px] tracking-[1.4px] underline underline-offset-2"
            >
              전체 보기
            </a>
          </div>
          <div className="mt-4 space-y-px">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function EmptyWeekly() {
  return (
    <div className="border border-[rgba(226,226,226,0.35)] px-8 py-12 text-center">
      <p className="text-stone-gray text-sm">아직 주간 리포트가 없습니다.</p>
      <p className="text-stone-gray mt-2 text-xs">
        에이전트를 실행하고 세션을 마치면 자동으로 생성됩니다.
      </p>
    </div>
  )
}
