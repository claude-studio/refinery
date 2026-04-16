#!/usr/bin/env node
// husky commit-msg hook에서 호출 — git이 $1으로 커밋 메시지 파일 경로를 전달
import { readFileSync } from 'fs'

const ALLOWED_TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'test',
  'chore',
  'perf',
  'ci',
  'build',
  'revert',
]

const msgFile = process.argv[2]
if (!msgFile) process.exit(0)

const message = readFileSync(msgFile, 'utf8').trim()
const result = validateMessage(message)

if (!result.valid) {
  console.error('\n커밋 메시지 형식 오류:')
  result.errors.forEach((e) => console.error(e))
  console.error('\n올바른 형식:')
  console.error('  <type>: <한글 제목>\n')
  console.error('  - 변경 내용 1')
  console.error('  - 변경 내용 2\n')
  console.error(`허용 type: ${ALLOWED_TYPES.join(', ')}\n`)
  process.exit(1)
}

process.exit(0)

function validateMessage(message) {
  const lines = message.replace(/\r\n/g, '\n').split('\n')
  const errors = []

  const title = lines[0] ?? ''
  const typeMatch = title.match(/^([a-z]+):\s*(.+)$/)

  if (!typeMatch) {
    errors.push(`✗ 첫 줄 형식이 잘못되었습니다. "<type>: <한글 제목>" 형식이어야 합니다.`)
    errors.push(`  현재: "${title}"`)
  } else {
    const [, type, subject] = typeMatch

    if (!ALLOWED_TYPES.includes(type)) {
      errors.push(`✗ 허용되지 않는 type: "${type}"`)
      errors.push(`  허용 목록: ${ALLOWED_TYPES.join(', ')}`)
    }

    if (!/[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/.test(subject)) {
      errors.push(`✗ 제목에 한글이 없습니다. 제목은 한글로 작성해야 합니다.`)
      errors.push(`  현재: "${subject}"`)
    }
  }

  if (lines.length > 1 && lines[1].trim() !== '') {
    errors.push(`✗ 제목 다음 줄은 빈 줄이어야 합니다.`)
  }

  if (lines.length > 2) {
    const isTrailer = (l) => /^[A-Za-z][A-Za-z-]+: .+/.test(l)
    const bodyLines = lines.slice(2).filter((l) => l.trim() !== '' && !isTrailer(l))
    const badLines = bodyLines.filter((l) => !l.startsWith('- '))
    if (badLines.length > 0) {
      errors.push(`✗ 본문 항목은 "- " 로 시작해야 합니다.`)
      badLines.forEach((l) => errors.push(`  현재: "${l}"`))
    }
  }

  return { valid: errors.length === 0, errors }
}
