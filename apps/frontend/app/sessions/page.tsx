import { Suspense } from 'react'

import { NewSessionBanner } from '@/components/new-session-banner'
import { SessionCard } from '@/components/session-card'
import { SessionFilter } from '@/components/session-filter'
import { fetchSessions } from '@/lib/api'

interface Props {
  searchParams: Promise<{
    page?: string
    taskType?: string
    hasInefficiency?: string
  }>
}

export default async function SessionsPage({ searchParams }: Props) {
  const params = await searchParams
  const page = Number(params.page ?? 1)

  const res = await fetchSessions({
    page,
    limit: 20,
    taskType: params.taskType,
    hasInefficiency: params.hasInefficiency,
  })

  const { data: sessions, meta } = res

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-warm-parchment text-2xl">Sessions</h1>
        <span className="text-stone-gray text-xs">{meta.total}개</span>
      </div>

      <NewSessionBanner />

      <Suspense>
        <SessionFilter />
      </Suspense>

      {sessions.length === 0 ? (
        <div className="border border-[rgba(226,226,226,0.35)] px-8 py-12 text-center">
          <p className="text-stone-gray text-sm">세션이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-px">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      )}

      {meta.totalPages > 1 && (
        <Pagination page={page} totalPages={meta.totalPages} params={params} />
      )}
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number
  totalPages: number
  params: Record<string, string | undefined>
}) {
  const qs = (p: number) => {
    const q = new URLSearchParams()
    if (params.taskType) q.set('taskType', params.taskType)
    if (params.hasInefficiency) q.set('hasInefficiency', params.hasInefficiency)
    q.set('page', String(p))
    return `?${q.toString()}`
  }

  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-stone-gray text-xs">
        {page} / {totalPages}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <a
            href={qs(page - 1)}
            className="text-ash-gray border border-[rgba(226,226,226,0.35)] px-3 py-1 text-xs hover:bg-[rgba(255,255,255,0.04)]"
          >
            이전
          </a>
        )}
        {page < totalPages && (
          <a
            href={qs(page + 1)}
            className="text-ash-gray border border-[rgba(226,226,226,0.35)] px-3 py-1 text-xs hover:bg-[rgba(255,255,255,0.04)]"
          >
            다음
          </a>
        )}
      </div>
    </div>
  )
}
