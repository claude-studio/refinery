import type { SessionListItem } from '@refinery/shared'
import Link from 'next/link'

const TASK_LABELS: Record<string, string> = {
  'bug-fix': 'BUG FIX',
  feature: 'FEATURE',
  refactor: 'REFACTOR',
  exploration: 'EXPLORE',
  config: 'CONFIG',
}

function formatDuration(min: number | null): string {
  if (min === null) return '—'
  if (min < 60) return `${Math.round(min)}m`
  return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface Props {
  session: SessionListItem
}

export function SessionCard({ session }: Props) {
  const projectName = session.projectPath.split('/').pop() ?? session.projectPath

  return (
    <Link
      href={`/sessions/${session.id}`}
      className="group border-mist-border bg-frosted-veil block border p-5 transition-colors hover:bg-[rgba(255,255,255,0.07)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-stone-gray text-[10px] tracking-[2px]">
              {session.taskType ? (TASK_LABELS[session.taskType] ?? session.taskType) : '—'}
            </span>
            <span className="text-stone-gray">·</span>
            <span className="text-stone-gray text-xs">{formatDate(session.startedAt)}</span>
          </div>
          <p className="text-warm-parchment mt-1.5 truncate text-sm">
            {session.taskDescription ?? `/${projectName}`}
          </p>
          <p className="text-stone-gray mt-0.5 truncate text-xs">{session.projectPath}</p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-ash-gray text-xs">{formatDuration(session.durationMin)}</span>
          <div className="text-stone-gray flex items-center gap-2 text-xs">
            <span>{session.totalToolCalls} calls</span>
            {session.inefficiencyCount > 0 && (
              <>
                <span>·</span>
                <span className="text-warm-parchment">{session.inefficiencyCount} issues</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
