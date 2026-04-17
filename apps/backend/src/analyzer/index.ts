// Design Ref: §2.2 파이프라인: analyze() 단계
// 4종 검출기를 순차 실행하고 결과를 병합한다. 개별 검출기 실패 시 해당 결과 제외 후 계속.

import type { Inefficiency, ParsedSession } from '@refinery/shared'

import { detectBashAntipattern } from './bash-antipattern.js'
import { detectContextWaste } from './context-waste.js'
import { detectFailedRetry } from './failed-retry.js'
import { detectRepeatRead } from './repeat-read.js'

type Detector = (session: ParsedSession) => Inefficiency[]

const DETECTORS: Detector[] = [
  detectRepeatRead,
  detectFailedRetry,
  detectBashAntipattern,
  detectContextWaste,
]

export function analyze(session: ParsedSession): Inefficiency[] {
  const results: Inefficiency[] = []

  for (const detect of DETECTORS) {
    try {
      results.push(...detect(session))
    } catch {
      // 개별 검출기 실패 시 해당 결과 제외, 나머지 계속 (Design §6.3)
    }
  }

  return results
}
