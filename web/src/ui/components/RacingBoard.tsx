import type { RacingSnapshot } from '../../core/types'

interface Props {
  snapshot: RacingSnapshot
  disabled: boolean
  onAction: (action: string) => void
}

export function RacingBoard({ snapshot, disabled, onAction }: Props) {
  const total = snapshot.lapLength * snapshot.totalLaps
  const finished = snapshot.phase === 'finished'
  const winner = snapshot.racers.find((racer) => racer.laps >= snapshot.totalLaps)

  return (
    <div className="board">
      <div className="board-head">
        <div>
          <h2>Carrera por turnos</h2>
          <p className="muted">
            Vuelta {Math.min(snapshot.totalLaps, Math.max(...snapshot.racers.map((r) => r.laps)) + 1)} de{' '}
            {snapshot.totalLaps} · pista de {snapshot.lapLength} casillas
          </p>
        </div>
        <span className="pill">Turno {snapshot.turn}</span>
      </div>

      <div className="racers">
        {snapshot.racers.map((racer) => {
          const percent = Math.min(100, Math.round((racer.distance / total) * 100))
          return (
            <div className="racer" key={racer.id}>
              <div className="racer-head">
                <strong>
                  {racer.name} <span className={`tag ${racer.kind}`}>{racer.kind === 'human' ? 'humano' : 'CPU'}</span>
                </strong>
                <span>
                  P{racer.position} · {racer.laps}/{snapshot.totalLaps} vueltas
                </span>
              </div>
              <div className="track">
                <div className={`track-fill ${racer.kind}`} style={{ width: `${percent}%` }} />
              </div>
              <div className="muted small">
                {racer.distance} / {total} casillas {racer.finished ? '· meta' : ''}
              </div>
            </div>
          )
        })}
      </div>

      <p className="message">{snapshot.message}</p>
      {finished && winner ? <p className="result">Ganador: {winner.name}</p> : null}

      <div className="actions">
        <button disabled={disabled} onClick={() => onAction('advance')}>
          Avanzar
        </button>
        <button className="warning" disabled={disabled} onClick={() => onAction('turbo')}>
          Turbo (riesgo)
        </button>
      </div>
    </div>
  )
}
