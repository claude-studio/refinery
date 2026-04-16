#!/usr/bin/env node
/**
 * 커밋 메시지 한글 컨벤셔널 커밋 형식 검증 스크립트
 *
 * PreToolUse hook (if: "Bash(git commit *)") 에서만 호출된다.
 *
 * 규칙:
 *   1. 첫 줄: `<type>: <한글 제목>` (영문 제목 금지)
 *   2. 허용 type: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert
 *   3. 두 번째 줄: 빈 줄 (본문이 있을 경우)
 *   4. 세 번째 줄 이후: `- ` 로 시작하는 리스트 (본문이 있을 경우)
 */

const ALLOWED_TYPES = [
  'feat', 'fix', 'docs', 'style', 'refactor',
  'test', 'chore', 'perf', 'ci', 'build', 'revert',
];

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let hookInput = {};
  try {
    hookInput = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const command = hookInput?.tool_input?.command ?? '';
  const message = extractCommitMessage(command);

  if (!message) {
    // -m 없이 편집기로 작성하는 경우 → 통과 (git이 직접 검증)
    process.exit(0);
  }

  const result = validateMessage(message);
  if (!result.valid) {
    const output = {
      continue: false,
      stopReason: [
        '커밋 메시지 형식 오류:',
        ...result.errors,
        '',
        '올바른 형식:',
        '  <type>: <한글 제목>',
        '',
        '  - 변경 내용 1',
        '  - 변경 내용 2',
        '',
        `허용 type: ${ALLOWED_TYPES.join(', ')}`,
      ].join('\n'),
    };
    process.stdout.write(JSON.stringify(output));
  }

  process.exit(0);
});

function extractCommitMessage(command) {
  // -m "..." 또는 -m '...'
  const mFlag = command.match(/-m\s+["']([\s\S]*?)["'](?:\s|$)/);
  if (mFlag) return mFlag[1];

  // heredoc: $(cat <<'EOF' ... EOF)
  const heredoc = command.match(/\$\(cat\s+<<['"]?EOF['"]?\s*([\s\S]*?)\s*EOF\s*\)/);
  if (heredoc) return heredoc[1];

  return null;
}

function validateMessage(message) {
  const lines = message.replace(/\r\n/g, '\n').split('\n');
  const errors = [];

  // 1. 첫 줄: <type>: <한글 제목>
  const title = lines[0] ?? '';
  const typeMatch = title.match(/^([a-z]+):\s*(.+)$/);

  if (!typeMatch) {
    errors.push(`✗ 첫 줄 형식이 잘못되었습니다. "<type>: <한글 제목>" 형식이어야 합니다.`);
    errors.push(`  현재: "${title}"`);
  } else {
    const [, type, subject] = typeMatch;

    if (!ALLOWED_TYPES.includes(type)) {
      errors.push(`✗ 허용되지 않는 type: "${type}"`);
      errors.push(`  허용 목록: ${ALLOWED_TYPES.join(', ')}`);
    }

    if (!/[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/.test(subject)) {
      errors.push(`✗ 제목에 한글이 없습니다. 제목은 한글로 작성해야 합니다.`);
      errors.push(`  현재: "${subject}"`);
    }
  }

  // 2. 본문이 있을 경우: 두 번째 줄은 빈 줄
  if (lines.length > 1 && lines[1].trim() !== '') {
    errors.push(`✗ 제목 다음 줄은 빈 줄이어야 합니다.`);
  }

  // 3. 본문이 있을 경우: "- " 로 시작
  if (lines.length > 2) {
    const bodyLines = lines.slice(2).filter((l) => l.trim() !== '');
    const badLines = bodyLines.filter((l) => !l.startsWith('- '));
    if (badLines.length > 0) {
      errors.push(`✗ 본문 항목은 "- " 로 시작해야 합니다.`);
      badLines.forEach((l) => errors.push(`  현재: "${l}"`));
    }
  }

  return { valid: errors.length === 0, errors };
}
