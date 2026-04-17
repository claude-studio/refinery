import type {
  PaginationMeta,
  SessionDetail,
  SessionListItem,
  WeeklyReportData,
} from '@refinery/shared'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function apiHeaders(): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' }
  if (process.env.API_KEY) h['X-API-Key'] = process.env.API_KEY
  return h
}

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, BASE_URL)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: apiHeaders(),
    next: { revalidate: 30 },
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  return res.json()
}

export interface SessionListParams {
  page?: number
  limit?: number
  taskType?: string
  hasInefficiency?: string
  from?: string
  to?: string
}

export interface SessionListResponse {
  data: SessionListItem[]
  meta: PaginationMeta
}

export interface SessionDetailResponse {
  data: SessionDetail
}

export interface WeeklyReportResponse {
  data: WeeklyReportData
}

export async function fetchSessions(params: SessionListParams = {}): Promise<SessionListResponse> {
  const p: Record<string, string> = {}
  if (params.page) p.page = String(params.page)
  if (params.limit) p.limit = String(params.limit)
  if (params.taskType) p.taskType = params.taskType
  if (params.hasInefficiency) p.hasInefficiency = params.hasInefficiency
  if (params.from) p.from = params.from
  if (params.to) p.to = params.to
  return apiFetch('/sessions', p)
}

export async function fetchSession(id: string): Promise<SessionDetailResponse> {
  return apiFetch(`/sessions/${id}`)
}

export async function fetchWeeklyReport(): Promise<WeeklyReportResponse | null> {
  try {
    return await apiFetch('/insights/weekly')
  } catch {
    return null
  }
}
