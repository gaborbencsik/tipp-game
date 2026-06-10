import { describe, it, expect, vi, beforeEach } from 'vitest'
import { eventBus, type MatchUpdateEvent, type VirtualPointsUpdateEvent } from '../src/services/event-bus.service.js'

describe('eventBus', () => {
  beforeEach(() => {
    eventBus.removeAllListeners()
  })

  it('delivers match.update events to subscribers', () => {
    const received: MatchUpdateEvent[] = []
    eventBus.on('match.update', (e) => received.push(e))

    const payload: MatchUpdateEvent = {
      matchId: 'm1',
      status: 'live',
      homeScore: 1,
      awayScore: 0,
      updatedAt: '2026-06-10T10:00:00.000Z',
    }
    eventBus.emit('match.update', payload)

    expect(received).toHaveLength(1)
    expect(received[0]).toEqual(payload)
  })

  it('delivers virtualPoints.update events to subscribers', () => {
    const received: VirtualPointsUpdateEvent[] = []
    eventBus.on('virtualPoints.update', (e) => received.push(e))

    const payload: VirtualPointsUpdateEvent = {
      groupId: 'g1',
      userId: 'u1',
      points: 5,
      updatedAt: '2026-06-10T10:00:00.000Z',
    }
    eventBus.emit('virtualPoints.update', payload)

    expect(received).toHaveLength(1)
    expect(received[0]).toEqual(payload)
  })

  it('supports multiple subscribers for the same event', () => {
    const a = vi.fn()
    const b = vi.fn()
    eventBus.on('match.update', a)
    eventBus.on('match.update', b)

    eventBus.emit('match.update', {
      matchId: 'm1', status: 'finished', homeScore: 2, awayScore: 1, updatedAt: 'now',
    })

    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('off() unsubscribes', () => {
    const handler = vi.fn()
    eventBus.on('match.update', handler)
    eventBus.off('match.update', handler)

    eventBus.emit('match.update', {
      matchId: 'm1', status: 'live', homeScore: 0, awayScore: 0, updatedAt: 'now',
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('does not throw when emitting with no listeners', () => {
    expect(() => eventBus.emit('match.update', {
      matchId: 'm1', status: 'live', homeScore: 0, awayScore: 0, updatedAt: 'now',
    })).not.toThrow()
  })
})
