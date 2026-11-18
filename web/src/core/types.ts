export function phaseLabel(phase: string): string {
  switch (phase) {
    case 'idle':
      return 'creada'
    case 'starting':
      return 'iniciando'
    case 'playing':
      return 'en juego'
    case 'finished':
      return 'finalizada'
    case 'error':
      return 'error'
    default:
      return phase
  }
}

export type GameId = 'racing' | 'combat' | 'connect4'

export const GAME_VERSION = '1.0.0'

export const GAME_TITLES: Record<GameId, string> = {
  racing: 'Carrera por turnos',
  combat: 'Duelo táctico',
  connect4: 'Conecta 4',
}

export const GAME_DESCRIPTIONS: Record<GameId, string> = {
  racing: 'Avanza y arriesga turbo para completar dos vueltas contra la CPU.',
  combat: 'Administra tu vida y ataca, defiende o cura para vencer a la CPU.',
  connect4: 'Alinea cuatro fichas contra la IA implementada en SWI-Prolog.',
}

export interface GameEvent {
  eventId: string
  timestamp: string
  gameId: GameId
  gameVersion: string
  matchId: string
  playerId: string
  type: string
  action: string
  data: Record<string, unknown> | null
}

export type MatchStatus = 'in_progress' | 'finished'

export interface MatchRecord {
  matchId: string
  gameId: GameId
  title: string
  createdAt: string
  updatedAt: string
  status: MatchStatus
  winnerPlayerId?: string
}

export type PlayerKind = 'human' | 'cpu'

export interface PlayerView {
  id: string
  name: string
  kind: PlayerKind
  team: string
}

export interface GameAggregate {
  matches: number
  finished: number
  analyzed: number
  active: number
  events: number
  players: number
}

export interface StatsResponse {
  status: string
  totalMatches: number
  totalPlayers: number
  totalEvents: number
  racingMatches: number
  combatMatches: number
  byGame: Record<string, GameAggregate>
  processed: number
  rejectedEvents: number
}

export interface AnalysisPattern {
  type: string
  playerId?: string
  detail?: string
  detected?: boolean
}

export interface AnalysisResponse {
  status: 'pending' | 'analyzed'
  gameId?: string
  matchId?: string
  patterns?: AnalysisPattern[] | null
  statistics?: Record<string, unknown> | null
}

export interface RacerView extends PlayerView {
  distance: number
  laps: number
  position: number
  finished: boolean
}

export interface RacingSnapshot {
  kind: 'racing'
  phase: string
  lapLength: number
  totalLaps: number
  racers: RacerView[]
  turn: number
  message: string
  errorMessage: string
}

export interface FighterView extends PlayerView {
  hp: number
  maxHp: number
  defending: boolean
}

export interface CombatSnapshot {
  kind: 'combat'
  phase: string
  fighters: FighterView[]
  turn: number
  healsLeft: number
  message: string
  errorMessage: string
}

export interface Connect4Snapshot {
  kind: 'connect4'
  phase: string
  board: number[][]
  turn: 'human' | 'ai'
  depth: number
  thinking: boolean
  moves: number
  lastMove: { column: number; row: number; player: number } | null
  winner: number | null
  draw: boolean
  aiInfo: { column: number; score: number; nodes: number; ms: number } | null
  message: string
  errorMessage: string
}

export type GameSnapshot = RacingSnapshot | CombatSnapshot | Connect4Snapshot
