// Plan FR-12: PII/시크릿 마스킹 — 전송 전 1차 처리

const SECRET_PATTERNS: RegExp[] = [
  /sk-ant-[a-zA-Z0-9\-_]{20,}/g,
  /sk-[a-zA-Z0-9]{32,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /ghp_[a-zA-Z0-9]{36}/g,
  /ghs_[a-zA-Z0-9]{36}/g,
  /eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+/g,
  /(?:API_KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_KEY)\s*=\s*["']?([^\s"']{8,})["']?/gi,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----/g,
]

function shannonEntropy(s: string): number {
  const freq = new Map<string, number>()
  for (const c of s) freq.set(c, (freq.get(c) ?? 0) + 1)
  let h = 0
  for (const count of freq.values()) {
    const p = count / s.length
    h -= p * Math.log2(p)
  }
  return h
}

function maskHighEntropy(text: string): string {
  return text.replace(/[a-zA-Z0-9+/=_\-]{24,}/g, (match) => {
    if (shannonEntropy(match) > 4.5) return '[REDACTED]'
    return match
  })
}

export function maskSecrets(text: string): string {
  let result = text
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]')
  }
  result = maskHighEntropy(result)
  return result
}
