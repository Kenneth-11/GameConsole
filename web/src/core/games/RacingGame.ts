import { BaseGame, Player, type GameDeps } from '../BaseGame'
import { GAME_TITLES, type RacingSnapshot } from '../types'

interface Racer {
  player: Player
  distance: number
  laps: number
  position: number
  finished: boolean
  lastLapAt: number
}

export class RacingGame extends BaseGame {
  private readonly lapLength: number
  private readonly totalLaps: number
  private readonly racers: Racer[]
  private turn = 0
  private message = 'Pulsa Avanzar o arriesga Turbo.'

  constructor(matchId: string, deps: GameDeps) {
    super(
      'racing',
      matchId,
      GAME_TITLES.racing,
      deps,
      [new Player('p-human', 'Tú', 'human', 'blue'), new Player('p-cpu', 'CPU', 'cpu', 'red')],
    )
    this.lapLength = 12
    this.totalLaps = 2
    this.racers = this.players.map((player) => ({
      player,
      distance: 0,
      laps: 0,
      position: player.kind === 'human' ? 1 : 2,
      finished: false,
      lastLapAt: 0,
    }))
  }

  get snapshot(): RacingSnapshot {
    return {
      kind: 'racing',
      phase: this.phase,
      lapLength: this.lapLength,
      totalLaps: this.totalLaps,
      turn: this.turn,
      message: this.message,
      errorMessage: this.errorMessage,
      racers: this.racers.map((racer) => ({
        id: racer.player.id,
        name: racer.player.name,
        kind: racer.player.kind,
        team: racer.player.team,
        distance: racer.distance,
        laps: racer.laps,
        position: racer.position,
        finished: racer.finished,
      })),
    }
  }

  protected override startData(): Record<string, unknown> {
    return { mode: 'pve', lapLength: this.lapLength, totalLaps: this.totalLaps }
  }

  protected override onStarted(): void {
    for (const racer of this.racers) {
      racer.lastLapAt = this.startedAt
      racer.position = this.positionOf(racer.player.id)
    }
  }

  async play(action: string): Promise<void> {
    this.ensurePlaying()
    if (action !== 'advance' && action !== 'turbo') {
      throw new Error(`acción desconocida: ${action}`)
    }
    this.turn += 1
    const human = this.racers[0]
    const cpu = this.racers[1]

    const turbo = action === 'turbo'
    const spunOut = turbo && this.rng() < 0.33
    const humanGain = spunOut ? 0 : turbo ? 4 + Math.floor(this.rng() * 3) : 1 + Math.floor(this.rng() * 3)
    human.distance += humanGain
    this.message = spunOut
      ? 'El turbo patinó: esta vez no avanzaste.'
      : `Avanzaste ${humanGain} casilla(s).`
    await this.processProgress(human)

    if (!this.finishedSent) {
      const cpuGain = 1 + Math.floor(this.rng() * 3)
      cpu.distance += cpuGain
      this.message += ` La CPU avanzó ${cpuGain}.`
      await this.processProgress(cpu)
    }

    if (!this.finishedSent) {
      this.notify()
    }
  }

  private positionOf(playerId: string): number {
    const sorted = [...this.racers].sort((a, b) =>
      a.distance === b.distance ? 0 : b.distance - a.distance,
    )
    return sorted.findIndex((racer) => racer.player.id === playerId) + 1
  }

  private async processProgress(racer: Racer): Promise<void> {
    const reachedLaps = Math.min(this.totalLaps, Math.floor(racer.distance / this.lapLength))
    const newPosition = this.positionOf(racer.player.id)
    if (newPosition !== racer.position) {
      await this.emit('POSITION_CHANGED', racer.player.id, 'position', {
        fromPosition: racer.position,
        toPosition: newPosition,
      })
      racer.position = newPosition
    }

    while (racer.laps < reachedLaps) {
      racer.laps += 1
      const now = this.clock()
      const lapTimeMs = Math.max(1, Math.round(now - racer.lastLapAt))
      racer.lastLapAt = now
      await this.emit('LAP_COMPLETED', racer.player.id, 'lap', {
        lapNumber: racer.laps,
        lapTimeMs,
        averageSpeed: Math.max(1, Math.round((this.lapLength * 10000) / lapTimeMs)),
        position: this.positionOf(racer.player.id),
      })
      if (racer.laps >= this.totalLaps) {
        racer.finished = true
        racer.position = this.positionOf(racer.player.id)
        await this.finish(racer.player.id, {
          totalLaps: this.totalLaps,
          winnerLaps: racer.laps,
          winnerDistance: racer.distance,
        })
        return
      }
    }
  }
}
