import { BaseGame, Player, type GameDeps } from '../BaseGame'
import { GAME_TITLES, type CombatSnapshot } from '../types'

interface Fighter {
  player: Player
  hp: number
  maxHp: number
  defending: boolean
}

export class CombatGame extends BaseGame {
  private readonly fighters: Fighter[]
  private turn = 0
  private healsLeft = 2
  private cpuHeals = 1
  private message = 'Elige una acción para atacar o defenderte.'

  constructor(matchId: string, deps: GameDeps) {
    super(
      'combat',
      matchId,
      GAME_TITLES.combat,
      deps,
      [new Player('p-human', 'Tú', 'human', 'green'), new Player('p-cpu', 'CPU', 'cpu', 'red')],
    )
    this.fighters = this.players.map((player) => ({
      player,
      hp: 100,
      maxHp: 100,
      defending: false,
    }))
  }

  get snapshot(): CombatSnapshot {
    return {
      kind: 'combat',
      phase: this.phase,
      turn: this.turn,
      healsLeft: this.healsLeft,
      message: this.message,
      errorMessage: this.errorMessage,
      fighters: this.fighters.map((fighter) => ({
        id: fighter.player.id,
        name: fighter.player.name,
        kind: fighter.player.kind,
        team: fighter.player.team,
        hp: fighter.hp,
        maxHp: fighter.maxHp,
        defending: fighter.defending,
      })),
    }
  }

  protected override startData(): Record<string, unknown> {
    return { mode: 'pve', maxHp: 100 }
  }

  async play(action: string): Promise<void> {
    this.ensurePlaying()
    this.turn += 1
    const human = this.fighters[0]
    const cpu = this.fighters[1]

    switch (action) {
      case 'attack':
        await this.hit(human, cpu, 12 + Math.floor(this.rng() * 10), 'rifle')
        break
      case 'heavy':
        if (this.rng() < 0.35) {
          this.message = 'Tu escopeta falló y perdiste el turno.'
        } else {
          await this.hit(human, cpu, 25 + Math.floor(this.rng() * 16), 'shotgun')
        }
        break
      case 'defend':
        human.defending = true
        this.message = 'Te pones en guardia: el próximo daño se reduce.'
        break
      case 'heal':
        if (this.healsLeft <= 0) {
          this.message = 'No te quedan curaciones.'
        } else {
          const healed = Math.min(18, human.maxHp - human.hp)
          human.hp += healed
          this.healsLeft -= 1
          this.message = `Recuperaste ${healed} de vida.`
          await this.emit('PLAYER_HEALED', human.player.id, 'heal', {
            amount: healed,
            hp: human.hp,
          })
        }
        break
      default:
        throw new Error(`acción desconocida: ${action}`)
    }

    if (!this.finishedSent) {
      await this.cpuTurn(cpu, human)
    }
    if (!this.finishedSent) {
      this.notify()
    }
  }

  private async cpuTurn(cpu: Fighter, human: Fighter): Promise<void> {
    if (cpu.hp <= 40 && this.cpuHeals > 0 && this.rng() < 0.5) {
      const healed = Math.min(15, cpu.maxHp - cpu.hp)
      cpu.hp += healed
      this.cpuHeals -= 1
      this.message += ` La CPU se curó ${healed}.`
      await this.emit('PLAYER_HEALED', cpu.player.id, 'heal', { amount: healed, hp: cpu.hp })
      return
    }
    if (this.rng() < 0.15) {
      cpu.defending = true
      this.message += ' La CPU se puso en guardia.'
      return
    }
    await this.hit(cpu, human, 10 + Math.floor(this.rng() * 12), 'rifle')
  }

  private async hit(attacker: Fighter, target: Fighter, rawDamage: number, weapon: string): Promise<void> {
    let damage = rawDamage
    if (target.defending) {
      damage = Math.floor(rawDamage * 0.4)
      target.defending = false
      this.message = `${target.player.name} bloqueó parte del daño.`
    }
    const distance = 20 + Math.floor(this.rng() * 60)
    await this.emit('PLAYER_ATTACKED', '', 'attack', {
      attacker: attacker.player.id,
      target: target.player.id,
      damage,
      weapon,
      distance,
    })
    target.hp = Math.max(0, target.hp - damage)
    this.message = `${attacker.player.name} usó ${weapon} e hizo ${damage} de daño.`

    if (target.hp <= 0) {
      await this.emit('PLAYER_ELIMINATED', '', 'eliminate', {
        victim: target.player.id,
        killer: attacker.player.id,
        weapon,
      })
      await this.finish(attacker.player.id, {
        totalMoves: this.turn,
        winnerHp: attacker.hp,
        weapon,
      })
    }
  }
}
