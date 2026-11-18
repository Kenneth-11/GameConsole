import { describe, expect, it } from 'vitest'
import { EventQueue } from '../EventQueue'
import type { GameStatsClient } from '../GameStatsClient'
import type { GameEvent } from '../types'

function event(id: string): GameEvent {
  return {
    eventId: id,
    timestamp: '2026-11-18T12:00:00.000Z',
    gameId: 'connect4',
    gameVersion: '1.0.0',
    matchId: 'gc-connect4-test',
    playerId: '',
    type: 'MOVE',
    action: 'drop',
    data: null,
  }
}

function fakeClient(delayMs = 0, failOn?: string) {
  const sent: string[] = []
  const client = {
    sendEvent: async (incoming: GameEvent) => {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      if (incoming.eventId === failOn) {
        throw new Error('falló el envío')
      }
      sent.push(incoming.eventId)
    },
  } as unknown as GameStatsClient
  return { client, sent }
}

describe('EventQueue', () => {
  it('envía en orden FIFO aunque el primero tarde más', async () => {
    const { client, sent } = fakeClient(20)
    const queue = new EventQueue(client)
    await Promise.all([queue.enqueue(event('a')), queue.enqueue(event('b')), queue.enqueue(event('c'))])
    expect(sent).toEqual(['a', 'b', 'c'])
    expect(queue.sentCount).toBe(3)
  })

  it('bloquea los envíos posteriores cuando uno falla', async () => {
    const { client, sent } = fakeClient(0, 'b')
    const queue = new EventQueue(client)
    await expect(queue.enqueue(event('a'))).resolves.toBeUndefined()
    await expect(queue.enqueue(event('b'))).rejects.toThrow('falló el envío')
    await expect(queue.enqueue(event('c'))).rejects.toThrow('falló el envío')
    expect(sent).toEqual(['a'])
    expect(queue.failed).toBeInstanceOf(Error)
  })
})
