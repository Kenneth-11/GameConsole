import { EventQueue } from './EventQueue'
import type { GameStatsClient } from './GameStatsClient'
import { newEventId } from './ids'
import type { MatchRegistry } from './MatchRegistry'
import type { PrologClient } from './PrologClient'
import {
  GAME_VERSION,
  type GameEvent,
  type GameId,
  type GameSnapshot,
  type PlayerKind,
} from './types'

export type GamePhase = 'idle' | 'starting' | 'playing' | 'finished' | 'error'

export interface GameDeps {
  stats: GameStatsClient
  prolog: PrologClient
  registry: MatchRegistry
  rng?: () => number
  clock?: () => number
}

export class Player {
  readonly id: string
  readonly name: string
  readonly kind: PlayerKind
  readonly team: string

  constructor(id: string, name: string, kind: PlayerKind, team: string) {
    this.id = id
    this.name = name
    this.kind = kind
    this.team = team
  }
}

export abstract class BaseGame {
  readonly matchId: string
  readonly gameId: GameId
  readonly title: string
  protected readonly stats: GameStatsClient
  protected readonly prolog: PrologClient
  protected readonly registry: MatchRegistry
  protected readonly rng: () => number
  protected readonly clock: () => number
  protected readonly queue: EventQueue
  protected readonly players: Player[]
  protected readonly events: GameEvent[] = []
  protected phase: GamePhase = 'idle'
  protected startedAt = 0
  protected finishedSent = false
  protected sequence = 0
  protected errorMessage = ''

  private readonly listeners = new Set<() => void>()

  constructor(gameId: GameId, matchId: string, title: string, deps: GameDeps, players: Player[]) {
    this.gameId = gameId
    this.matchId = matchId
    this.title = title
    this.stats = deps.stats
    this.prolog = deps.prolog
    this.registry = deps.registry
    this.rng = deps.rng ?? Math.random
    this.clock = deps.clock ?? Date.now
    this.queue = new EventQueue(deps.stats)
    this.players = players
  }

  abstract get snapshot(): GameSnapshot

  abstract play(action: string, payload?: unknown): Promise<void>

  get eventLog(): readonly GameEvent[] {
    return this.events
  }

  get sentCount(): number {
    return this.queue.sentCount
  }

  get queueError(): Error | null {
    return this.queue.failed
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async start(): Promise<void> {
    if (this.phase !== 'idle') {
      throw new Error('la partida ya fue iniciada')
    }
    this.phase = 'starting'
    this.notify()
    try {
      await this.emit('MATCH_STARTED', '', 'start', this.startData())
      for (const player of this.players) {
        await this.emit('PLAYER_JOINED', player.id, 'join', {
          playerName: player.name,
          team: player.team,
        })
      }
      this.startedAt = this.clock()
      this.phase = 'playing'
      this.registry.upsert({
        matchId: this.matchId,
        gameId: this.gameId,
        title: this.title,
        createdAt: new Date(this.startedAt).toISOString(),
        updatedAt: new Date(this.startedAt).toISOString(),
        status: 'in_progress',
      })
      this.onStarted()
      this.notify()
    } catch (error) {
      this.fail(error)
      throw error
    }
  }

  protected startData(): Record<string, unknown> | null {
    return null
  }

  protected onStarted(): void {
    // Hook para subclases.
  }

  protected ensurePlaying(): void {
    if (this.phase !== 'playing') {
      throw new Error('la partida no está en juego')
    }
  }

  protected async emit(
    type: string,
    playerId: string,
    action: string,
    data: Record<string, unknown> | null = null,
  ): Promise<GameEvent> {
    if (this.finishedSent) {
      throw new Error('la partida ya terminó; no se envían más eventos')
    }
    this.sequence += 1
    const event: GameEvent = {
      eventId: newEventId(),
      timestamp: new Date(this.clock()).toISOString(),
      gameId: this.gameId,
      gameVersion: GAME_VERSION,
      matchId: this.matchId,
      playerId,
      type,
      action,
      data,
    }
    this.events.push(event)
    await this.queue.enqueue(event)
    return event
  }

  protected async finish(
    winnerPlayerId: string | null,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    if (this.finishedSent) {
      return
    }
    const finishedAt = this.clock()
    await this.emit('MATCH_FINISHED', '', 'finish', {
      winnerPlayerId: winnerPlayerId ?? 'draw',
      durationMs: Math.max(0, finishedAt - this.startedAt),
      ...extra,
    })
    this.finishedSent = true
    this.phase = 'finished'
    this.registry.update(this.matchId, {
      status: 'finished',
      winnerPlayerId: winnerPlayerId ?? undefined,
      updatedAt: new Date(finishedAt).toISOString(),
    })
    this.notify()
  }

  protected fail(error: unknown): void {
    this.phase = 'error'
    this.errorMessage = error instanceof Error ? error.message : String(error)
    this.notify()
  }

  protected notify(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}
