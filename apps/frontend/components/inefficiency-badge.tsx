import type { InefficiencySeverity, InefficiencyType } from '@refinery/shared'
import { cn } from '@refinery/ui/lib/utils'

const TYPE_LABELS: Record<InefficiencyType, string> = {
  'repeat-read': 'REPEAT READ',
  'failed-retry': 'FAILED RETRY',
  'bash-antipattern': 'BASH ANTIPATTERN',
  'context-waste': 'CONTEXT WASTE',
}

interface Props {
  type: InefficiencyType
  severity: InefficiencySeverity
  className?: string
}

export function InefficiencyBadge({ type, severity, className }: Props) {
  return (
    <span
      className={cn(
        'inline-block border px-2 py-0.5 text-[10px] tracking-[1.4px]',
        'border-[rgba(226,226,226,0.35)]',
        severity === 'high' && 'text-warm-parchment',
        severity === 'medium' && 'text-ash-gray',
        severity === 'low' && 'text-stone-gray',
        className,
      )}
    >
      {TYPE_LABELS[type]}
    </span>
  )
}
