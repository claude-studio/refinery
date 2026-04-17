import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

export interface AgentConfig {
  serverUrl: string
  apiKey: string
  transcriptDir?: string
}

const CONFIG_DIR = join(homedir(), '.cc-insights-agent')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

export function loadConfig(): AgentConfig | null {
  if (!existsSync(CONFIG_PATH)) return null
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as AgentConfig
  } catch {
    return null
  }
}

export function saveConfig(config: AgentConfig) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

export function configPath(): string {
  return CONFIG_PATH
}
