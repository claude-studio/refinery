'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@refinery/ui/components/select'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

export function SessionFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === 'all') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  return (
    <div className="flex items-center gap-3">
      <span className="text-stone-gray text-[10px] tracking-[2px]">FILTER</span>

      <Select
        value={searchParams.get('taskType') ?? 'all'}
        onValueChange={(v) => updateParam('taskType', v)}
      >
        <SelectTrigger className="text-ash-gray h-7 w-36 border-[rgba(226,226,226,0.35)] bg-transparent text-xs focus:ring-0">
          <SelectValue placeholder="작업 유형" />
        </SelectTrigger>
        <SelectContent className="text-ash-gray border-[rgba(226,226,226,0.35)] bg-[#1a1917] text-xs">
          <SelectItem value="all">전체</SelectItem>
          <SelectItem value="bug-fix">Bug Fix</SelectItem>
          <SelectItem value="feature">Feature</SelectItem>
          <SelectItem value="refactor">Refactor</SelectItem>
          <SelectItem value="exploration">Exploration</SelectItem>
          <SelectItem value="config">Config</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get('hasInefficiency') ?? 'all'}
        onValueChange={(v) => updateParam('hasInefficiency', v)}
      >
        <SelectTrigger className="text-ash-gray h-7 w-32 border-[rgba(226,226,226,0.35)] bg-transparent text-xs focus:ring-0">
          <SelectValue placeholder="비효율" />
        </SelectTrigger>
        <SelectContent className="text-ash-gray border-[rgba(226,226,226,0.35)] bg-[#1a1917] text-xs">
          <SelectItem value="all">전체</SelectItem>
          <SelectItem value="true">비효율 있음</SelectItem>
          <SelectItem value="false">비효율 없음</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
