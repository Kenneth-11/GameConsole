import { BaseGame, Player, type GameDeps } from '../BaseGame'
import { GAME_TITLES, type Connect4Snapshot } from '../types'

const ROWS = 6
const COLUMNS = 7
const HUMAN = 1
const AI = 2

function emptyBoard(): number[][] {
  return Array.from({ length: ROWS }, () => Array<number>(COLUMNS).fill(0))
}

export class Connect4Game extends BaseGame {
  private readonly board: number[][] = emptyBoard()
  private readonly depth: number
  private turn: 'human' | 'ai' = 'human'
  private thinking = false
  private moves = 0
  private lastMove: { column: number; row: number; player: number } | null = null
  private winner: number | null = null
  private draw = false
  private aiInfo: { column: number; score: number; nodes: number; ms: number } | null = null
  private message = 'Tu turno: elige una columna.'

  constructor(matchId: string, deps: GameDeps, depth = 4) {
    super(
      'connect4',
      matchId,
      GAME_TITLES.connect4,
      deps,
      [
        new Player('p-human', 'Tú', 'human', 'yellow'),
        new Player('p-ai', 'IA Prolog', 'cpu', 'red'),
      ],
    )
    this.depth = Math.min(7, Math.max(1, Math.round(depth)))
  }

  get snapshot(): Connect4Snapshot {
    return {
      kind: 'connect4',
      phase: this.phase,
      board: this.board.map((row) => [...row]),
      turn: this.turn,
      depth: this.depth,
      thinking: this.thinking,
      moves: this.moves,
      lastMove: this.lastMove ? { ...this.lastMove } : null,
      winner: this.winner,
      draw: this.draw,
      aiInfo: this.aiInfo ? { ...this.aiInfo } : null,
      message: this.message,
      errorMessage: this.errorMessage,
    }
  }

  protected override startData(): Record<string, unknown> {
    return { mode: 'pve', rows: ROWS, columns: COLUMNS, depth: this.depth }
  }

  async play(action: string, payload?: unknown): Promise<void> {
    if (action === 'retry-ai') {
      if (this.turn !== 'ai' || this.thinking) {
        return
      }
      if (this.phase === 'error') {
        this.phase = 'playing'
        this.errorMessage = ''
      }
      await this.aiTurn()
      return
    }

    this.ensurePlaying()
    if (action !== 'drop') {
      throw new Error(`acción desconocida: ${action}`)
    }
    if (this.turn !== 'human' || this.thinking) {
      throw new Error('espera el turno de la IA')
    }
    const column = Number((payload as { column?: number } | undefined)?.column)
    const row = this.drop(column, HUMAN)
    if (row === null) {
      throw new Error('columna inválida o llena')
    }

    this.moves += 1
    this.lastMove = { column, row, player: HUMAN }
    this.message = `Jugaste en la columna ${column}.`
    await this.emit('MOVE', 'p-human', 'drop', {
      column,
      row: row + 1,
      moveIndex: this.moves,
      source: 'human',
    })

    if (this.checkWin(HUMAN)) {
      this.winner = HUMAN
      this.message = '¡Ganaste!'
      await this.finish('p-human', { moves: this.moves, rows: ROWS, columns: COLUMNS })
      return
    }
    if (this.isFull()) {
      this.draw = true
      this.message = 'Empate: el tablero se llenó.'
      await this.finish(null, { moves: this.moves, draw: true })
      return
    }

    this.turn = 'ai'
    this.thinking = true
    this.message = 'La IA de Prolog está pensando...'
    this.notify()
    await this.aiTurn()
  }

  private async aiTurn(): Promise<void> {
    if (this.finishedSent) {
      return
    }
    this.thinking = true
    this.notify()
    try {
      const decision = await this.prolog.decide(
        this.board.map((row) => [...row]),
        AI,
        this.depth,
      )
      const row = this.drop(decision.column, AI)
      if (row === null) {
        throw new Error(`la IA devolvió una columna ilegal: ${decision.column}`)
      }
      this.moves += 1
      this.lastMove = { column: decision.column, row, player: AI }
      this.aiInfo = {
        column: decision.column,
        score: decision.score,
        nodes: decision.nodes,
        ms: decision.ms,
      }
      await this.emit('AI_DECISION', 'p-ai', 'decide', {
        column: decision.column,
        score: decision.score,
        nodes: decision.nodes,
        depth: decision.depth,
        ms: decision.ms,
      })
      await this.emit('MOVE', 'p-ai', 'drop', {
        column: decision.column,
        row: row + 1,
        moveIndex: this.moves,
        source: 'ai',
      })
      this.thinking = false

      if (this.checkWin(AI)) {
        this.winner = AI
        this.message = 'La IA ganó. Intenta de nuevo.'
        await this.finish('p-ai', { moves: this.moves, rows: ROWS, columns: COLUMNS })
        return
      }
      if (this.isFull()) {
        this.draw = true
        this.message = 'Empate: el tablero se llenó.'
        await this.finish(null, { moves: this.moves, draw: true })
        return
      }
      this.turn = 'human'
      this.message = 'Tu turno: elige una columna.'
      this.notify()
    } catch (error) {
      this.thinking = false
      this.fail(error)
      throw error
    }
  }

  private drop(column: number, player: number): number | null {
    if (!Number.isInteger(column) || column < 1 || column > COLUMNS) {
      return null
    }
    for (let row = ROWS - 1; row >= 0; row -= 1) {
      if (this.board[row][column - 1] === 0) {
        this.board[row][column - 1] = player
        return row
      }
    }
    return null
  }

  private isFull(): boolean {
    return this.board.every((row) => row.every((cell) => cell !== 0))
  }

  private checkWin(player: number): boolean {
    const board = this.board
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLUMNS; col += 1) {
        if (board[row][col] !== player) {
          continue
        }
        if (col + 3 < COLUMNS && [1, 2, 3].every((i) => board[row][col + i] === player)) {
          return true
        }
        if (row + 3 < ROWS && [1, 2, 3].every((i) => board[row + i][col] === player)) {
          return true
        }
        if (
          row + 3 < ROWS &&
          col + 3 < COLUMNS &&
          [1, 2, 3].every((i) => board[row + i][col + i] === player)
        ) {
          return true
        }
        if (
          row + 3 < ROWS &&
          col - 3 >= 0 &&
          [1, 2, 3].every((i) => board[row + i][col - i] === player)
        ) {
          return true
        }
      }
    }
    return false
  }
}
