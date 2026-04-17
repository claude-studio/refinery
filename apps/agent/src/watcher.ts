// Plan FR-30: chokidar 파일 감시 + 주기적 배치 전송 (5분)

import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

import type { IngestTranscriptPayload, TranscriptLine } from '@refinery/shared'
import chokidar from 'chokidar'

import { maskSecrets } from './masker.js'
import { drainQueue, send } from './sender.js'

interface Config {
  serverUrl: string
  apiKey: string
  transcriptDir?: string
}

const BATCH_INTERVAL_MS = 5 * 60 * 1000
const AGENT_VERSION = '0.1.0'

function defaultTranscriptDir(): string {
  return join(homedir(), '.claude', 'projects')
}

function parseSessionId(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/').pop()?.replace('.jsonl', '') ?? 'unknown'
}

function parseProjectPath(filePath: string, transcriptDir: string): string {
  const rel = filePath.replace(transcriptDir, '').replace(/\/[^/]+\.jsonl$/, '')
  return rel.replace(/^\//, '').replace(/-/g, '/') || '/'
}

function readLines(filePath: string): TranscriptLine[] {
  try {
    const raw = readFileSync(filePath, 'utf-8')
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const masked = maskSecrets(line)
        return JSON.parse(masked) as TranscriptLine
      })
  } catch {
    return []
  }
}

export function startWatcher(config: Config) {
  const transcriptDir = config.transcriptDir ?? defaultTranscriptDir()

  if (!existsSync(transcriptDir)) {
    console.log(`[agent] 트랜스크립트 디렉토리 없음: ${transcriptDir}`)
    return
  }

  const watcher = chokidar.watch(`${transcriptDir}/**/*.jsonl`, {
    ignoreInitial: false,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 200 },
  })

  const pending = new Set<string>()

  watcher.on('add', (path) => pending.add(path))
  watcher.on('change', (path) => pending.add(path))

  async function flush() {
    const paths = [...pending]
    pending.clear()

    for (const filePath of paths) {
      const lines = readLines(filePath)
      if (lines.length === 0) continue

      const payload: IngestTranscriptPayload = {
        sessionId: parseSessionId(filePath),
        projectPath: parseProjectPath(filePath, transcriptDir),
        lines,
        agentVersion: AGENT_VERSION,
      }

      await send(config, payload)
    }

    await drainQueue(config)
  }

  setInterval(() => {
    flush().catch((err) => console.error('[agent] flush error:', err))
  }, BATCH_INTERVAL_MS)

  console.log(`[agent] 감시 시작: ${transcriptDir}`)
  console.log(`[agent] 전송 간격: 5분`)

  return watcher
}
