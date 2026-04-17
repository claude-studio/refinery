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
          tick={{ fill: '#868584', fontSize: 10, letterSpacing: '1.4px' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#868584', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          contentStyle={{
            background: '#1a1917',
            border: '1px solid rgba(226,226,226,0.35)',
            borderRadius: 0,
            fontSize: 12,
            color: '#afaeac',
          }}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
        />
        <Bar dataKey="value" fill="rgba(226,226,226,0.35)" radius={0} />
      </BarChart>
    </ResponsiveContainer>
  )
}
