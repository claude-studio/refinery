// Design Ref: §7 — PII/시크릿 마스킹. 수신 즉시 적용 필수 (파이프라인 최우선)
// Plan SC: FR-12 — regex + high-entropy 탐지 → [REDACTED] 치환. recall ≥ 99%

const REDACTED = '[REDACTED]'

// 우선순위 높은 시크릿 패턴 (순서 중요 — 구체적인 것부터)
const SECRET_PATTERNS: RegExp[] = [
  // AWS Access Key ID
  /\bAKIA[0-9A-Z]{16}\b/g,
  // AWS Secret Access Key (40자 base64-like, 키워드 뒤)
  /(?:aws[_-]?secret[_-]?access[_-]?key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*["']?[A-Za-z0-9/+]{40}["']?/gi,
  // GitHub Personal Access Token (classic)
  /\bghp_[A-Za-z0-9]{36}\b/g,
  // GitHub PAT (fine-grained)
  /\bgithub_pat_[A-Za-z0-9_]{82}\b/g,
  // GitHub OAuth Token
  /\bgho_[A-Za-z0-9]{36}\b/g,
  // OpenAI API Key
  /\bsk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}\b/g,
  // OpenAI API Key (새 형식)
  /\bsk-proj-[A-Za-z0-9_-]{40,}\b/g,
  // Anthropic API Key
  /\bsk-ant-(?:api03-)?[A-Za-z0-9_-]{80,}\b/g,
  // JWT (header.payload.signature)
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  // PEM 개인키 블록 전체
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
  // 일반 secret=/token=/password= 패턴 (값 20자 이상)
  /(?:^|[\s,{(["'])(?:secret|token|password|passwd|api[_-]?key|access[_-]?key|private[_-]?key)\s*[=:]\s*["']?([A-Za-z0-9_\-+/=]{20,})["']?/gim,
]

function shannonEntropy(str: string): number {
  const freq = new Map<string, number>()
  for (const ch of str) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1)
  }
  let entropy = 0
  for (const count of freq.values()) {
    const p = count / str.length
    entropy -= p * Math.log2(p)
  }
  return entropy
}

// 고엔트로피 문자열 탐지 — 공백/슬래시/점 없는 32자 이상 랜덤 문자열
const HIGH_ENTROPY_PATTERN = /[A-Za-z0-9+/=_~-]{32,}/g
const HIGH_ENTROPY_THRESHOLD = 4.5

function maskHighEntropy(text: string): string {
  return text.replace(HIGH_ENTROPY_PATTERN, (match) => {
    // 파일 경로, UUID, URL 패턴 제외
    if (match.includes('/') || match.includes('.')) return match
    // UUID 형식 (소문자 hex + 하이픈 4개) 제외
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(match)) return match
    if (shannonEntropy(match) >= HIGH_ENTROPY_THRESHOLD) {
      return REDACTED
    }
    return match
  })
}

/**
 * 문자열에서 PII/시크릿을 [REDACTED]로 치환한다.
 * 파이프라인 최우선 적용 필수: mask() → parse() → analyze() → db.save()
 */
export function mask(text: string): string {
  let result = text
  for (const pattern of SECRET_PATTERNS) {
    // 플래그 리셋 (global 패턴 재사용 시 lastIndex 초기화)
    pattern.lastIndex = 0
    result = result.replace(pattern, REDACTED)
  }
  result = maskHighEntropy(result)
  return result
}

/**
 * 객체(중첩 포함)의 모든 문자열 값에 mask()를 재귀 적용한다.
 */
export function maskObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return mask(obj)
  }
  if (Array.isArray(obj)) {
    return obj.map(maskObject)
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = maskObject(value)
    }
    return result
  }
  return obj
}
