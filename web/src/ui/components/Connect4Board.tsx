import { phaseLabel, type Connect4Snapshot } from '../../core/types'

interface Props {
  snapshot: Connect4Snapshot
  disabled: boolean
  onAction: (action: string, payload?: unknown) => void
}

export function Connect4Board({ snapshot, disabled, onAction }: Props) {
  const locked =
    disabled ||
    snapshot.phase === 'finished' ||
    snapshot.thinking ||
    snapshot.turn !== 'human'
  const topRow = snapshot.board[0]

  return (
    <div className="board">
      <div className="board-head">
        <div>
          <h2>Conecta 4 · IA en Prolog</h2>
          <p className="muted">
            Profundidad {snapshot.depth} · {snapshot.moves} movimientos ·{' '}
            {snapshot.turn === 'human' ? 'tu turno' : 'turno de la IA'}
          </p>
        </div>
        <span className="pill">
          {snapshot.thinking ? 'IA pensando...' : phaseLabel(snapshot.phase)}
        </span>
      </div>

      <div className="c4-grid" role="grid" aria-label="Tablero de Conecta 4">
        {snapshot.board.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isLast =
              snapshot.lastMove?.row === rowIndex && snapshot.lastMove?.column === colIndex + 1
            const fullColumn = topRow[colIndex] !== 0
            return (
              <button
                key={`${rowIndex}-${colIndex}`}
                className={`c4-cell ${cell === 1 ? 'p1' : cell === 2 ? 'p2' : ''} ${
                  isLast ? 'last' : ''
                }`}
                disabled={locked || fullColumn}
                onClick={() => onAction('drop', { column: colIndex + 1 })}
                aria-label={`Fila ${rowIndex + 1}, columna ${colIndex + 1}`}
              >
                <span />
              </button>
            )
          }),
        )}
      </div>

      <p className="message">{snapshot.message}</p>
      {snapshot.aiInfo ? (
        <p className="muted small">
          IA: columna {snapshot.aiInfo.column} · score {snapshot.aiInfo.score} ·{' '}
          {snapshot.aiInfo.nodes} nodos · {snapshot.aiInfo.ms} ms
        </p>
      ) : null}
      {snapshot.winner === 1 ? <p className="result">Ganaste la partida.</p> : null}
      {snapshot.winner === 2 ? <p className="result">Ganó la IA de Prolog.</p> : null}
      {snapshot.draw ? <p className="result">Empate.</p> : null}

      {snapshot.phase === 'error' ? (
        <div className="actions">
          <button onClick={() => onAction('retry-ai')}>Reintentar IA</button>
        </div>
      ) : null}
    </div>
  )
}
