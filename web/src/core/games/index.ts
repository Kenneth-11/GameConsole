import type { BaseGame, GameDeps } from '../BaseGame'
import { newMatchId } from '../ids'
import type { GameId } from '../types'
import { CombatGame } from './CombatGame'
import { Connect4Game } from './Connect4Game'
import { RacingGame } from './RacingGame'

export interface GameOptions {
  connect4Depth?: number
}

export function createGame(gameId: GameId, deps: GameDeps, options: GameOptions = {}): BaseGame {
  const matchId = newMatchId(gameId)
  switch (gameId) {
    case 'racing':
      return new RacingGame(matchId, deps)
    case 'combat':
      return new CombatGame(matchId, deps)
    case 'connect4':
      return new Connect4Game(matchId, deps, options.connect4Depth ?? 4)
    default:
      throw new Error(`juego desconocido: ${String(gameId)}`)
  }
}

export { CombatGame, Connect4Game, RacingGame }
