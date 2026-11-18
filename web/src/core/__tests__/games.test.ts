import { describe, expect, it } from 'vitest'
import { makeDeps } from './helpers'
import { CombatGame } from '../games/CombatGame'
import { Connect4Game } from '../games/Connect4Game'
import { RacingGame } from '../games/RacingGame'
import type { GameEvent } from '../types'

function matchId(prefix: string): string {
  return `gc-${prefix}-0000-1111`
}

function assertContract(events: GameEvent[], gameId: string, matchIdValue: string): void {
  const ids = new Set<string>()
  for (const event of events) {
    expect(event.gameId).toBe(gameId)
    expect(event.matchId).toBe(matchIdValue)
    expect(event.gameVersion).toBe('1.0.0')
    expect(event.eventId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(ids.has(event.eventId)).toBe(false)
    ids.add(event.eventId)
  }
}

describe('RacingGame', () => {
  it('emite eventos válidos y termina la carrera', async () => {
    const { deps, sent } = makeDeps()
    const game = new RacingGame(matchId('racing'), deps)
    await game.start()
    expect(game.snapshot.kind).toBe('racing')
    expect(sent.map((e) => e.type)).toEqual(['MATCH_STARTED', 'PLAYER_JOINED', 'PLAYER_JOINED'])

    for (let i = 0; i < 12 && game.snapshot.phase !== 'finished'; i += 1) {
      await game.play('advance')
    }
    expect(game.snapshot.phase).toBe('finished')
    expect(sent[sent.length - 1].type).toBe('MATCH_FINISHED')
    expect(sent.some((e) => e.type === 'LAP_COMPLETED')).toBe(true)
    assertContract(sent, 'racing', game.matchId)

    const lapEvents = sent.filter((e) => e.type === 'LAP_COMPLETED')
    for (const lap of lapEvents) {
      expect(lap.data).toMatchObject({
        lapNumber: expect.any(Number),
        lapTimeMs: expect.any(Number),
        averageSpeed: expect.any(Number),
        position: expect.any(Number),
      })
    }
  })
})

describe('CombatGame', () => {
  it('emite ataques, eliminación y fin de partida', async () => {
    const { deps, sent } = makeDeps()
    const game = new CombatGame(matchId('combat'), deps)
    await game.start()
    for (let i = 0; i < 10 && game.snapshot.phase !== 'finished'; i += 1) {
      await game.play('heavy')
    }
    expect(game.snapshot.phase).toBe('finished')
    expect(sent.some((e) => e.type === 'PLAYER_ATTACKED')).toBe(true)
    expect(sent.some((e) => e.type === 'PLAYER_ELIMINATED')).toBe(true)
    expect(sent[sent.length - 1].type).toBe('MATCH_FINISHED')
    assertContract(sent, 'combat', game.matchId)

    for (const attack of sent.filter((e) => e.type === 'PLAYER_ATTACKED')) {
      expect(attack.data).toMatchObject({
        attacker: expect.any(String),
        target: expect.any(String),
        damage: expect.any(Number),
        weapon: expect.any(String),
        distance: expect.any(Number),
      })
    }
  })
})

describe('Connect4Game', () => {
  it('gana el humano y no consulta a la IA tras el cuarto en línea', async () => {
    const { deps, sent, prologCalls } = makeDeps([7, 7, 7])
    const game = new Connect4Game(matchId('connect4'), deps, 4)
    await game.start()

    for (const column of [1, 2, 3, 4]) {
      if (game.snapshot.phase === 'finished') {
        break
      }
      await game.play('drop', { column })
    }

    expect(game.snapshot.phase).toBe('finished')
    expect(game.snapshot.kind).toBe('connect4')
    if (game.snapshot.kind === 'connect4') {
      expect(game.snapshot.winner).toBe(1)
      expect(game.snapshot.thinking).toBe(false)
    }
    expect(prologCalls).toHaveLength(3)
    expect(sent.some((e) => e.type === 'AI_DECISION')).toBe(true)
    expect(sent[sent.length - 1].type).toBe('MATCH_FINISHED')
    expect(sent[sent.length - 1].data).toMatchObject({ winnerPlayerId: 'p-human' })
    assertContract(sent, 'connect4', game.matchId)
  })

  it('permite que la IA gane', async () => {
    const { deps } = makeDeps([1, 2, 3, 4])
    const game = new Connect4Game(matchId('connect4'), deps, 4)
    await game.start()

    for (const column of [7, 6, 7, 6]) {
      await game.play('drop', { column })
    }

    if (game.snapshot.kind === 'connect4') {
      expect(game.snapshot.winner).toBe(2)
    }
    expect(game.snapshot.phase).toBe('finished')
  })

  it('rechaza columnas llenas o fuera de rango', async () => {
    const { deps } = makeDeps()
    const game = new Connect4Game(matchId('connect4'), deps, 3)
    await game.start()
    await expect(game.play('drop', { column: 0 })).rejects.toThrow('columna')
    await expect(game.play('drop', { column: 8 })).rejects.toThrow('columna')
  })
})
