// Plan FR-33: 로컬 큐 — 전송 실패 시 파일 기반 persistence

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

import type { IngestTranscriptPayload } from '@refinery/shared'

export interface QueueItem {
  id: string
  payload: IngestTranscriptPayload
  attempts: number
  nextRetryAt: number
}

const QUEUE_DIR = join(homedir(), '.cc-insights-agent')
const QUEUE_PATH = join(QUEUE_DIR, 'queue.json')
const MAX_ATTEMPTS = 5

function ensureDir() {
  if (!existsSync(QUEUE_DIR)) mkdirSync(QUEUE_DIR, { recursive: true })
}

export function readQueue(): QueueItem[] {
  ensureDir()
  if (!existsSync(QUEUE_PATH)) return []
  try {
    return JSON.parse(readFileSync(QUEUE_PATH, 'utf-8')) as QueueItem[]
  } catch {
    return []
  }
}

function writeQueue(items: QueueItem[]) {
  ensureDir()
  writeFileSync(QUEUE_PATH, JSON.stringify(items, null, 2))
}

export function enqueue(payload: IngestTranscriptPayload) {
  const items = readQueue()
  items.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    payload,
    attempts: 0,
    nextRetryAt: 0,
  })
  writeQueue(items)
}

export function dequeueReady(): QueueItem[] {
  const now = Date.now()
  return readQueue().filter((item) => item.attempts < MAX_ATTEMPTS && item.nextRetryAt <= now)
}

export function markSuccess(id: string) {
  writeQueue(readQueue().filter((item) => item.id !== id))
}

export function markFailed(id: string) {
  const items = readQueue()
  const item = items.find((i) => i.id === id)
  if (!item) return
  item.attempts += 1
  if (item.attempts >= MAX_ATTEMPTS) {
    writeQueue(items.filter((i) => i.id !== id))
  } else {
    item.nextRetryAt = Date.now() + Math.pow(2, item.attempts) * 10_000
    writeQueue(items)
  }
}
