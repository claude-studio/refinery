#!/bin/bash
# PostToolUse hook — Write/Edit 직후 실행
# Claude Code가 파일을 수정할 때마다 자동으로 ESLint를 실행한다.
# lint 오류 발생 시 exit 2로 종료해 stderr를 Claude에게 전달하고,
# Claude가 오류를 인지해 스스로 재수정하도록 유도한다.
#
# stdin: Claude Code가 JSON으로 tool 실행 정보를 전달
# {
#   "tool_name": "Edit",
#   "tool_input": { "file_path": "apps/backend/src/foo.ts", ... },
#   "tool_result": { ... }
# }
# exit 0 → 정상 (stdout은 트랜스크립트에 표시)
# exit 2 → 오류 (stderr가 Claude에게 에러로 전달됨)

set -euo pipefail

# jq 없으면 lint 건너뜀
if ! command -v jq &>/dev/null; then
  exit 0
fi

input=$(cat)

# tool_input.file_path 파싱 — 없으면 건너뜀
file=$(echo "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[[ -z "$file" ]] && exit 0

# .ts/.tsx 파일만 대상 (js, json, md 등은 건너뜀)
[[ "$file" =~ \.(ts|tsx)$ ]] || exit 0

# 패키지 내부 파일은 lint 불필요
[[ "$file" == *node_modules* ]] && exit 0

# 삭제된 파일이면 건너뜀
[[ -f "$file" ]] || exit 0

# $CLAUDE_PROJECT_DIR: Claude Code가 주입하는 프로젝트 루트 경로
ROOT="$CLAUDE_PROJECT_DIR"
cd "$ROOT"

# lint 실패 시 stderr로 출력 후 exit 2 → Claude가 오류 수신
if ! result=$(pnpm exec eslint "$file" 2>&1); then
  echo "$result" >&2
  exit 2
fi

exit 0
