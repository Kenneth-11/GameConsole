import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameStatsClient, GameStatsError } from '../GameStatsClient'
import type { GameEvent } from '../types'

const sample: GameEvent = {
  eventId: 'evt-1',
  timestamp: '2026-11-18T12:00:00.000Z',
  gameId: 'connect4',
  gameVersion: '1.0.0',
  matchId: 'gc-connect4-test',
  playerId: '',
  type: 'MATCH_STARTED',
  action: 'start',
  data: null,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GameStatsClient', () => {
  it('acepta 202', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 202 })))
    const client = new GameStatsClient('http://test/api')
    await expect(client.sendEvent(sample)).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith(
      'http://test/api/events',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('trata un 422 de duplicado como entregado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('evento duplicado: evt-1', { status: 422 })),
    )
    const client = new GameStatsClient('http://test/api')
    await expect(client.sendEvent(sample)).resolves.toBeUndefined()
  })

  it('propaga errores de validación', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('gameId inválido', { status: 400 })),
    )
    const client = new GameStatsClient('http://test/api')
    await expect(client.sendEvent(sample)).rejects.toBeInstanceOf(GameStatsError)
  })

  it('interpreta 202 de análisis como pendiente', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 202 })))
    const client = new GameStatsClient('http://test/api')
    await expect(client.getAnalysis('gc-1')).resolves.toEqual({ status: 'pending' })
  })
})
