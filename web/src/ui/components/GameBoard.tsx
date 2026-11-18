import type { GameSnapshot } from '../../core/types'
import { CombatBoard } from './CombatBoard'
import { Connect4Board } from './Connect4Board'
import { RacingBoard } from './RacingBoard'

interface Props {
  snapshot: GameSnapshot
  disabled: boolean
  onAction: (action: string, payload?: unknown) => void
}

export function GameBoard({ snapshot, disabled, onAction }: Props) {
  if (snapshot.kind === 'racing') {
    return <RacingBoard snapshot={snapshot} disabled={disabled} onAction={onAction} />
  }
  if (snapshot.kind === 'combat') {
    return <CombatBoard snapshot={snapshot} disabled={disabled} onAction={onAction} />
  }
  return <Connect4Board snapshot={snapshot} disabled={disabled} onAction={onAction} />
}
