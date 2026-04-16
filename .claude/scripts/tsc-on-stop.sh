#!/bin/bash
# Stop hook — 세션 종료 직전 실행
# git diff로 수정된 .ts/.tsx 파일을 감지하고,
# 해당 파일이 속한 앱/패키지 단위로 tsc --noEmit을 실행한다.
# 타입 오류 발생 시 exit 2로 종료해 Claude가 수정 후 재종료하도록 유도한다.
#
# stdin: Claude Code가 JSON으로 세션 정보를 전달 (이 스크립트에서는 미사용)
# exit 0 → 수정 없음 또는 타입 오류 없음 (조용히 통과)
# exit 2 → 타입 오류 있음 (stderr가 Claude에게 에러로 전달됨)

# $CLAUDE_PROJECT_DIR: Claude Code가 주입하는 프로젝트 루트 경로
ROOT="$CLAUDE_PROJECT_DIR"
cd "$ROOT"

# 커밋되지 않은 수정 파일과 스테이징된 파일 모두 수집
modified=$(git diff --name-only HEAD 2>/dev/null | grep -E '\.(ts|tsx)$' || true)
staged=$(git diff --cached --name-only 2>/dev/null | grep -E '\.(ts|tsx)$' || true)
all_modified=$(printf '%s\n%s' "$modified" "$staged" | sort -u | grep -v '^$' || true)

# 수정된 .ts/.tsx 파일 없으면 바로 종료
[[ -z "$all_modified" ]] && exit 0

# 이미 검사한 앱/패키지 디렉토리 추적 (중복 실행 방지)
checked_dirs=""

while IFS= read -r file; do
  # 파일 경로에서 앱/패키지 디렉토리 추출 (예: apps/backend/src/foo.ts → apps/backend)
  dir=$(echo "$file" | awk -F/ '{if(NF>=2) print $1"/"$2}')
  [[ -z "$dir" ]] && continue

  # 이미 검사한 디렉토리면 스킵
  echo "$checked_dirs" | grep -qF "$dir" && continue

  # tsconfig.json 없으면 tsc 실행 불가 → 스킵
  [[ -f "$ROOT/$dir/tsconfig.json" ]] || continue

  checked_dirs="$checked_dirs $dir"

  # 해당 앱/패키지 디렉토리에서 타입 체크 실행
  result=$(cd "$ROOT/$dir" && pnpm exec tsc --noEmit 2>&1)
  if [[ $? -ne 0 ]]; then
    echo "[$dir] 타입 오류:" >&2
    echo "$result" | head -30 >&2
    exit 2
  fi
done <<< "$all_modified"

exit 0
