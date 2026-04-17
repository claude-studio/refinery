// Plan FR-31: HTTP POST 전송 + FR-33 큐 드레인

import type { IngestTranscriptPayload } from '@refinery/shared'

import { dequeueReady, enqueue, markFailed, markSuccess } from './queue.js'

interface Config {
  serverUrl: string
  apiKey: string
}

async function postTranscript(config: Config, payload: IngestTranscriptPayload): Promise<void> {
  const res = await fetch(`${config.serverUrl}/ingest/transcript`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': config.apiKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

export async function send(config: Config, payload: IngestTranscriptPayload) {
  try {
    await postTranscript(config, payload)
  } catch {
    enqueue(payload)
  }
}

export async function drainQueue(config: Config) {
  const ready = dequeueReady()
  for (const item of ready) {
    try {
      await postTranscript(config, item.payload)
      markSuccess(item.id)
    } catch {
      markFailed(item.id)
    }
  }
}
