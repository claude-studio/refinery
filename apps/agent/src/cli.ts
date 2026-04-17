// Plan FR-32: npx cc-insights-agent init --server <URL> --api-key <KEY>

import { configPath, loadConfig, saveConfig } from './config.js'
import { startWatcher } from './watcher.js'

const VERSION = '0.1.0'

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
      result[key] = val
    }
  }
  return result
}

function cmdInit(args: Record<string, string>) {
  const serverUrl = args['server']
  const apiKey = args['api-key'] ?? ''

  if (!serverUrl) {
    console.error('오류: --server <URL> 필수')
    console.error('예시: cc-insights-agent init --server http://homeserver:3001 --api-key <KEY>')
    process.exit(1)
  }

  saveConfig({ serverUrl, apiKey })
  console.log(`설정 저장: ${configPath()}`)
  console.log(`서버: ${serverUrl}`)
  console.log('')
  console.log('시작 방법:')
  console.log('  cc-insights-agent start')
}

function cmdStart() {
  const config = loadConfig()
  if (!config) {
    console.error('설정 파일 없음. 먼저 init을 실행하세요:')
    console.error('  cc-insights-agent init --server <URL> --api-key <KEY>')
    process.exit(1)
  }

  console.log(`cc-insights-agent v${VERSION} 시작`)
  console.log(`서버: ${config.serverUrl}`)

  startWatcher(config)
}

function cmdStatus() {
  const config = loadConfig()
  if (!config) {
    console.log('상태: 미설정')
    console.log(`설정 파일 없음 (${configPath()})`)
    return
  }
  console.log(`상태: 설정됨`)
  console.log(`서버: ${config.serverUrl}`)
  console.log(`설정 경로: ${configPath()}`)
}

function main() {
  const [, , cmd, ...rest] = process.argv
  const args = parseArgs(rest)

  switch (cmd) {
    case 'init':
      cmdInit(args)
      break
    case 'start':
      cmdStart()
      break
    case 'status':
      cmdStatus()
      break
    default:
      console.log(`cc-insights-agent v${VERSION}`)
      console.log('')
      console.log('사용법:')
      console.log('  cc-insights-agent init --server <URL> [--api-key <KEY>]')
      console.log('  cc-insights-agent start')
      console.log('  cc-insights-agent status')
  }
}

main()
