import { EventEmitter } from 'node:events'
import type { MatchStatus } from '../types/index.js'

export interface MatchUpdateEvent {
  readonly matchId: string
  readonly status: MatchStatus
  readonly homeScore: number | null
  readonly awayScore: number | null
  readonly updatedAt: string
}

export interface VirtualPointsUpdateEvent {
  readonly groupId: string
  readonly userId: string
  readonly points: number
  readonly updatedAt: string
}

interface EventMap {
  readonly 'match.update': MatchUpdateEvent
  readonly 'virtualPoints.update': VirtualPointsUpdateEvent
}

type EventName = keyof EventMap

class TypedEventBus {
  private readonly emitter = new EventEmitter()

  constructor() {
    // Lift the default 10-listener cap; SSE clients all attach as listeners
    // and we expect dozens-to-hundreds during the tournament.
    this.emitter.setMaxListeners(0)
  }

  on<E extends EventName>(event: E, handler: (payload: EventMap[E]) => void): void {
    this.emitter.on(event, handler as (payload: unknown) => void)
  }

  off<E extends EventName>(event: E, handler: (payload: EventMap[E]) => void): void {
    this.emitter.off(event, handler as (payload: unknown) => void)
  }

  emit<E extends EventName>(event: E, payload: EventMap[E]): void {
    this.emitter.emit(event, payload)
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners()
  }
}

// MULTI-INSTANCE TODO: switch to Redis pub/sub if we ever scale beyond a single
// Render web instance. Today everything runs in-process, so an in-memory
// EventEmitter is enough.
export const eventBus = new TypedEventBus()
