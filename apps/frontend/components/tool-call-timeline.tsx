import type { SessionDetail } from '@refinery/shared'

type TimelineItem = SessionDetail['toolCallTimeline'][number]

const TOOL_ABBR: Record<string, string> = {
  Read: 'R',
  Write: 'W',
  Edit: 'E',
  Bash: 'B',
  Grep: 'G',
  Glob: 'GL',
  Agent: 'A',
  WebFetch: 'WF',
  WebSearch: 'WS',
}

function summarizeInput(name: string, input: Record<string, unknown>): string {
  if (name === 'Read' && input.file_path) return String(input.file_path).split('/').pop() ?? ''
  if (name === 'Edit' && input.file_path) return String(input.file_path).split('/').pop() ?? ''
  if (name === 'Write' && input.file_path) return String(input.file_path).split('/').pop() ?? ''
  if (name === 'Bash' && input.command) {
    const cmd = String(input.command)
    return cmd.length > 40 ? cmd.slice(0, 40) + '…' : cmd
  }
  if (name === 'Grep' && input.pattern) return String(input.pattern)
  if (name === 'Glob' && input.pattern) return String(input.pattern)
  return ''
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

interface Props {
  timeline: TimelineItem[]
}

export function ToolCallTimeline({ timeline }: Props) {
  if (timeline.length === 0) {
    return <p className="text-stone-gray text-sm">도구 호출 기록이 없습니다.</p>
  }

  return (
    <div className="space-y-0">
      {timeline.map((item, i) => {
        const abbr = TOOL_ABBR[item.name] ?? item.name.slice(0, 2).toUpperCase()
        const summary = summarizeInput(item.name, item.input)

        return (
          <div
            key={i}
            className="flex items-start gap-4 border-b border-[rgba(226,226,226,0.12)] py-2.5 last:border-0"
          >
            <span
              className={`w-7 shrink-0 text-center font-[family-name:var(--font-family-geist-mono)] text-[10px] ${item.isError ? 'text-stone-gray line-through' : 'text-ash-gray'}`}
            >
              {abbr}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className={`text-xs ${item.isError ? 'text-stone-gray' : 'text-ash-gray'}`}>
                  {item.name}
                </span>
                {item.isError && (
                  <span className="text-stone-gray text-[10px] tracking-[1px]">ERR</span>
                )}
              </div>
              {summary && (
                <p className="font-family-geist-mono text-stone-gray mt-0.5 truncate text-[11px]">
                  {summary}
                </p>
              )}
            </div>

            <span className="text-stone-gray shrink-0 font-[family-name:var(--font-family-geist-mono)] text-[10px]">
              {formatTime(item.timestamp)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
