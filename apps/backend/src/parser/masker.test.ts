// Design Ref: §8.2 — L1 단위 테스트 #1~3: masker 패턴 검증
import { describe, expect, it } from 'vitest'

import { mask, maskObject } from './masker'

describe('mask()', () => {
  // §8.2 #1 — AWS Access Key ID
  it('AWS Access Key ID를 [REDACTED]로 치환한다', () => {
    const input = 'my key is AKIAIOSFODNN7EXAMPLE and more'
    expect(mask(input)).toBe('my key is [REDACTED] and more')
  })

  // §8.2 #2 — GitHub Personal Access Token (classic)
  it('GitHub PAT(classic)를 [REDACTED]로 치환한다', () => {
    const token = 'ghp_' + 'A'.repeat(36)
    const input = `Authorization: token ${token}`
    expect(mask(input)).not.toContain(token)
    expect(mask(input)).toContain('[REDACTED]')
  })

  // §8.2 #3 — 고엔트로피 문자열 탐지
  it('고엔트로피 32자 이상 랜덤 문자열을 [REDACTED]로 치환한다', () => {
    // Base64처럼 생긴 고엔트로피 문자열
    const highEntropy = 'xK9mP2nQ8rT5vW1yA6bD4cF7gH3jL0eI'
    expect(mask(highEntropy)).toBe('[REDACTED]')
  })

  it('일반 텍스트(낮은 엔트로피)는 마스킹하지 않는다', () => {
    const normal = 'Hello world this is a normal sentence'
    expect(mask(normal)).toBe(normal)
  })

  it('JWT 토큰을 [REDACTED]로 치환한다', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    expect(mask(jwt)).toBe('[REDACTED]')
  })

  it('Anthropic API Key를 [REDACTED]로 치환한다', () => {
    const apiKey = 'sk-ant-api03-' + 'A'.repeat(90)
    expect(mask(apiKey)).toBe('[REDACTED]')
  })

  it('파일 경로는 마스킹하지 않는다', () => {
    const path = '/Users/user/projects/myapp/src/index.ts'
    expect(mask(path)).toBe(path)
  })

  it('UUID는 마스킹하지 않는다', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    expect(mask(uuid)).toBe(uuid)
  })
})

describe('maskObject()', () => {
  it('중첩 객체의 모든 문자열 값에 mask를 적용한다', () => {
    const input = {
      user: 'alice',
      config: {
        apiKey: 'AKIAIOSFODNN7EXAMPLE',
        nested: { token: 'normal-value' },
      },
      items: ['ghp_' + 'B'.repeat(36), 'safe'],
    }
    const result = maskObject(input) as typeof input
    expect(result.config.apiKey).toBe('[REDACTED]')
    expect(result.items[0]).toBe('[REDACTED]')
    expect(result.items[1]).toBe('safe')
    expect(result.user).toBe('alice')
  })

  it('문자열 직접 전달 시 mask()와 동일하게 동작한다', () => {
    const secret = 'AKIAIOSFODNN7EXAMPLE'
    expect(maskObject(secret)).toBe('[REDACTED]')
  })

  it('숫자/불리언 값은 그대로 반환한다', () => {
    expect(maskObject(42)).toBe(42)
    expect(maskObject(true)).toBe(true)
    expect(maskObject(null)).toBe(null)
  })
})
