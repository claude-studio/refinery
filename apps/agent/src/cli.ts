// Design Ref: §2.3 apps/agent — 개발 PC 실행 에이전트 진입점
// module-7에서 구현: watcher, masker, sender, CLI init
// Plan SC: FR-30 chokidar 파일 감시 + FR-31 트랜스크립트 전송

const version = '0.1.0'

function main() {
  const cmd = process.argv[2]
  if (cmd === 'init') {
    console.log(`cc-insights-agent v${version} — init`)
    console.log('module-7에서 구현 예정')
  } else {
    console.log(`cc-insights-agent v${version}`)
    console.log('Usage: cc-insights-agent init --server <url>')
  }
}

main()
