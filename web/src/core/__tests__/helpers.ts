import type { GameDeps } from '../BaseGame'
import type { GameStatsClient } from '../GameStatsClient'
import { MatchRegistry, type StorageLike } from '../MatchRegistry'
import type { PrologClient, PrologDecision } from '../PrologClient'
import type { GameEvent } from '../types'

export function fakeStorage(): StorageLike {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
    keys: () => [...data.keys()],
  }
}

export interface TestDeps {
  deps: GameDeps
  sent: GameEvent[]
  prologCalls: number[][][]
  registry: MatchRegistry
}

export function makeDeps(prologColumns: number[] = [4, 4, 4, 4, 4, 4, 4, 4]): TestDeps {
  const sent: GameEvent[] = []
  const prologCalls: number[][][] = []
  let call = 0
  const stats = {
    sendEvent: async (event: GameEvent) => {
      sent.push(event)
    },
  } as unknown as GameStatsClient
  const prolog = {
    decide: async (board: number[][], _player: 1 | 2, depth: number): Promise<PrologDecision> => {
      prologCalls.push(board.map((row) => [...row]))
      const column = prologColumns[call] ?? 4
      call += 1
      return { column, score: 10, depth, nodes: 100, ms: 5 }
    },
  } as unknown as PrologClient
  const registry = new MatchRegistry(fakeStorage())
  let now = Date.parse('2026-11-18T12:00:00.000Z')
  const deps: GameDeps = {
    stats,
    prolog,
    registry,
    rng: () => 0.99,
    clock: () => {
      now += 500
      return now
    },
  }
  return { deps, sent, prologCalls, registry }
}
