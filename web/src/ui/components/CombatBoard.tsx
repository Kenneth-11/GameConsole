import type { CombatSnapshot } from '../../core/types'

interface Props {
  snapshot: CombatSnapshot
  disabled: boolean
  onAction: (action: string) => void
}

export function CombatBoard({ snapshot, disabled, onAction }: Props) {
  const finished = snapshot.phase === 'finished'
  const human = snapshot.fighters[0]
  const winner = finished
    ? snapshot.fighters.find((fighter) => fighter.hp > 0)
    : undefined

  return (
    <div className="board">
      <div className="board-head">
        <div>
          <h2>Duelo táctico</h2>
          <p className="muted">Turno {snapshot.turn} · curaciones restantes: {snapshot.healsLeft}</p>
        </div>
        <span className="pill">HP {human.hp}</span>
      </div>

      <div className="fighters">
        {snapshot.fighters.map((fighter) => {
          const percent = Math.max(0, Math.round((fighter.hp / fighter.maxHp) * 100))
          return (
            <div className="fighter" key={fighter.id}>
              <div className="racer-head">
                <strong>
                  {fighter.name}{' '}
                  <span className={`tag ${fighter.kind}`}>
                    {fighter.kind === 'human' ? 'humano' : 'CPU'}
                  </span>
                </strong>
                <span>
                  {fighter.hp}/{fighter.maxHp} HP {fighter.defending ? '· en guardia' : ''}
                </span>
              </div>
              <div className="track">
                <div
                  className={`track-fill hp ${percent < 35 ? 'low' : ''}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <p className="message">{snapshot.message}</p>
      {finished && winner ? <p className="result">Ganador: {winner.name}</p> : null}

      <div className="actions">
        <button disabled={disabled} onClick={() => onAction('attack')}>
          Atacar
        </button>
        <button className="warning" disabled={disabled} onClick={() => onAction('heavy')}>
          Escopeta (riesgo)
        </button>
        <button disabled={disabled} onClick={() => onAction('defend')}>
          Defender
        </button>
        <button disabled={disabled || snapshot.healsLeft <= 0} onClick={() => onAction('heal')}>
          Curar
        </button>
      </div>
    </div>
  )
}
