// Design Ref: §4.1 GET /events SSE — 신규 세션 분석 완료 이벤트 발행용 내부 버스
import { EventEmitter } from 'node:events'

import type { SseEvent } from '@refinery/shared'

class EventBus extends EventEmitter {
  emitSessionAnalyzed(event: SseEvent): void {
    this.emit('session.analyzed', event)
  }
}

export const eventBus = new EventBus()
