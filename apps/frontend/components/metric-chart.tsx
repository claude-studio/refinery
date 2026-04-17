'use client'

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface Props {
  totalTokens: number | null
  avgLatencyMs: number | null
}

export function MetricChart({ totalTokens, avgLatencyMs }: Props) {
  if (totalTokens === null && avgLatencyMs === null) {
    return (
      <p className="text-stone-gray text-sm">
        OTel 메트릭 없음 — CLAUDE_CODE_ENABLE_TELEMETRY=1 설정 후 재시도
      </p>
    )
  }

  const data = [
    ...(totalTokens !== null ? [{ name: 'Tokens', value: totalTokens }] : []),
    ...(avgLatencyMs !== null ? [{ name: 'Latency (ms)', value: Math.round(avgLatencyMs) }] : []),
  ]

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} barSize={24}>
        <XAxis
          dataKey="name"
          tick={{ fill: 'var(--color-stone-gray)', fontSize: 10, letterSpacing: '1.4px' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--color-stone-gray)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--color-deep-void)',
            border: '1px solid var(--color-mist-border)',
            borderRadius: 0,
            fontSize: 12,
            color: 'var(--color-ash-gray)',
          }}
          cursor={{ fill: 'var(--color-frosted-veil)' }}
        />
        <Bar dataKey="value" fill="var(--color-mist-border)" radius={0} />
      </BarChart>
    </ResponsiveContainer>
  )
}
