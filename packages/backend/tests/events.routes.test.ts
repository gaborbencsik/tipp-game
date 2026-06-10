import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { eventBus } from '../src/services/event-bus.service.js'
import { writeSseEvent, writeSseHeartbeat, formatSsePayload } from '../src/routes/events.routes.js'

interface MockSocket {
  writes: string[]
  ended: boolean
  closeListeners: Array<() => void>
}

function makeSocket(): MockSocket {
  return { writes: [], ended: false, closeListeners: [] }
}

describe('SSE event formatting', () => {
  it('serializes an event with name + JSON payload + double newline', () => {
    const out = formatSsePayload('match.update', { matchId: 'm1', status: 'live' })
    expect(out).toBe('event: match.update\ndata: {"matchId":"m1","status":"live"}\n\n')
  })

  it('writes the formatted payload to the stream', () => {
    const sock = makeSocket()
    const fakeRes = {
      write: (chunk: string): boolean => { sock.writes.push(chunk); return true },
    }
    writeSseEvent(fakeRes as unknown as NodeJS.WritableStream, 'match.update', { foo: 1 })
    expect(sock.writes).toHaveLength(1)
    expect(sock.writes[0]).toContain('event: match.update')
    expect(sock.writes[0]).toContain('"foo":1')
  })

  it('writes a heartbeat as an SSE comment line', () => {
    const sock = makeSocket()
    const fakeRes = {
      write: (chunk: string): boolean => { sock.writes.push(chunk); return true },
    }
    writeSseHeartbeat(fakeRes as unknown as NodeJS.WritableStream)
    expect(sock.writes[0]).toBe(': ping\n\n')
  })
})

describe('eventBus → SSE bridge (integration via event subscription)', () => {
  beforeEach(() => {
    eventBus.removeAllListeners()
  })

  afterEach(() => {
    eventBus.removeAllListeners()
  })

  it('match.update subscriber receives payload', () => {
    const received: unknown[] = []
    eventBus.on('match.update', (e) => received.push(e))

    eventBus.emit('match.update', {
      matchId: 'm1',
      status: 'live',
      homeScore: 2,
      awayScore: 1,
      updatedAt: '2026-06-10T10:00:00.000Z',
    })

    expect(received).toHaveLength(1)
  })

  it('virtualPoints.update subscribers can filter by userId', () => {
    const userAReceived: unknown[] = []
    const userBReceived: unknown[] = []

    eventBus.on('virtualPoints.update', (e) => {
      if (e.userId === 'A') userAReceived.push(e)
      if (e.userId === 'B') userBReceived.push(e)
    })

    eventBus.emit('virtualPoints.update', {
      groupId: 'g1', userId: 'A', points: 10, updatedAt: 'now',
    })

    expect(userAReceived).toHaveLength(1)
    expect(userBReceived).toHaveLength(0)
  })
})
