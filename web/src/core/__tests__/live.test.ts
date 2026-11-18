import { describe, expect, it } from 'vitest'
import type { GameDeps } from '../BaseGame'
import { GameStatsClient } from '../GameStatsClient'
import { MatchRegistry } from '../MatchRegistry'
import { PrologClient } from '../PrologClient'
import { CombatGame } from '../games/CombatGame'
import { Connect4Game } from '../games/Connect4Game'
import { RacingGame } from '../games/RacingGame'
import type { AnalysisResponse } from '../types'
import { fakeStorage } from './helpers'

const liveBase = process.env.LIVE_BASE
const live = liveBase ? describe : describe.skip

function matchId(gameId: string): string {
  return `gc-${gameId}-live-${crypto.randomUUID()}`
}

function deps(): GameDeps {
  return {
    stats: new GameStatsClient(`${liveBase}/api`),
    prolog: new PrologClient(`${liveBase}/prolog`),
    registry: new MatchRegistry(fakeStorage()),
    rng: () => 0.99,
  }
}

async function waitForAnalysis(client: GameStatsClient, id: string): Promise<AnalysisResponse> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const analysis = await client.getAnalysis(id)
    if (analysis.status === 'analyzed') {
      return analysis
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`el análisis de ${id} no terminó`)
}

live('integración real con GameStats y Prolog', () => {
  it(
    'racing: acepta todos los eventos y Scala analiza la partida',
    async () => {
      const gameDeps = deps()
      const game = new RacingGame(matchId('racing'), gameDeps)
      await game.start()
      for (let i = 0; i < 20 && game.snapshot.phase !== 'finished'; i += 1) {
        await game.play('advance')
      }
      expect(game.snapshot.phase).toBe('finished')
      expect(game.queueError).toBeNull()
      expect(game.sentCount).toBe(game.eventLog.length)

      const analysis = await waitForAnalysis(gameDeps.stats, game.matchId)
      expect(analysis.status).toBe('analyzed')
      expect(analysis.gameId).toBe('racing')
      expect(analysis.statistics).toBeTruthy()
    },
    30000,
  )

  it(
    'combat: acepta ataques, curación desconocida y eliminación',
    async () => {
      const gameDeps = deps()
      const game = new CombatGame(matchId('combat'), gameDeps)
      await game.start()
      await game.play('heal')
      for (let i = 0; i < 12 && game.snapshot.phase !== 'finished'; i += 1) {
        await game.play('heavy')
      }
      expect(game.snapshot.phase).toBe('finished')
      expect(game.queueError).toBeNull()
      expect(game.eventLog.some((event) => event.type === 'PLAYER_HEALED')).toBe(true)
      expect(game.eventLog.some((event) => event.type === 'PLAYER_ELIMINATED')).toBe(true)

      const analysis = await waitForAnalysis(gameDeps.stats, game.matchId)
      expect(analysis.status).toBe('analyzed')
      expect(analysis.gameId).toBe('combat')
      expect(analysis.statistics).toBeTruthy()
    },
    30000,
  )

  it(
    'connect4: la IA responde y los eventos son aceptados',
    async () => {
      const gameDeps = deps()
      const game = new Connect4Game(matchId('connect4'), gameDeps, 3)
      await game.start()
      await game.play('drop', { column: 4 })
      expect(game.queueError).toBeNull()
      expect(game.eventLog.some((event) => event.type === 'AI_DECISION')).toBe(true)
      expect(game.sentCount).toBe(game.eventLog.length)
      if (game.snapshot.kind === 'connect4') {
        expect(game.snapshot.aiInfo).not.toBeNull()
        expect(game.snapshot.board.flat().filter((cell) => cell !== 0)).toHaveLength(2)
      }
    },
    30000,
  )
})
