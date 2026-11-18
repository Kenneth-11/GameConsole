import { useState } from 'react'
import type { BaseGame } from '../core/BaseGame'
import { GAME_DESCRIPTIONS, GAME_TITLES, phaseLabel, type GameId } from '../core/types'

interface Props {
  starting: boolean
  error: string
  sessions: BaseGame[]
  onCreate: (gameId: GameId, depth: number) => void
  onOpen: (matchId: string) => void
}

const GAME_IDS: GameId[] = ['racing', 'combat', 'connect4']

export function Lobby({ starting, error, sessions, onCreate, onOpen }: Props) {
  const [depth, setDepth] = useState(4)

  return (
    <section className="page">
      <div className="hero">
        <p className="eyebrow">Proyecto 2 · Lenguajes de Programación</p>
        <h1>GameConsole</h1>
        <p className="lead">
          Tres juegos, partidas simultáneas y una IA real en SWI-Prolog. Cada movimiento se
          entrega ordenadamente a GameStats, que conserva la validación y el análisis.
        </p>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="cards">
        {GAME_IDS.map((gameId) => (
          <article className="card" key={gameId}>
            <div className="card-top">
              <span className={`game-badge ${gameId}`}>{gameId}</span>
              {gameId === 'connect4' ? <span className="pill small">IA Prolog</span> : null}
            </div>
            <h2>{GAME_TITLES[gameId]}</h2>
            <p>{GAME_DESCRIPTIONS[gameId]}</p>

            {gameId === 'connect4' ? (
              <label className="depth">
                Profundidad de la IA
                <select
                  value={depth}
                  onChange={(event) => setDepth(Number(event.target.value))}
                  disabled={starting}
                >
                  <option value={3}>3 · rápida</option>
                  <option value={4}>4</option>
                  <option value={5}>5 · lenta</option>
                  <option value={6}>6 · muy lenta</option>
                </select>
              </label>
            ) : null}

            <button
              className="primary"
              disabled={starting}
              onClick={() => onCreate(gameId, depth)}
            >
              {starting ? 'Creando partida...' : 'Crear partida'}
            </button>
          </article>
        ))}
      </div>

      {sessions.length > 0 ? (
        <div className="panel">
          <div className="panel-head">
            <h3>Partidas abiertas en esta pestaña</h3>
            <span className="pill small">{sessions.length}</span>
          </div>
          <div className="session-list">
            {sessions.map((game) => {
              const snapshot = game.snapshot
              return (
                <button
                  className="session-row"
                  key={game.matchId}
                  onClick={() => onOpen(game.matchId)}
                >
                  <span>
                    <strong>{game.title}</strong>
                    <small className="muted tiny">
                      <code>{game.matchId}</code>
                    </small>
                  </span>
                  <span className={`pill small ${snapshot.phase === 'finished' ? 'ok' : ''}`}>
                    {phaseLabel(snapshot.phase)}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="muted tiny">
            Puedes alternar entre partidas activas; cada una mantiene su propio{' '}
            <code>matchId</code> y su cola FIFO.
          </p>
        </div>
      ) : null}

      <div className="notes">
        <h3>Cómo funciona</h3>
        <ul>
          <li>
            <strong>Partidas simultáneas:</strong> puedes alternar varias partidas en esta
            pestaña; el registro se comparte entre pestañas por <code>localStorage</code>.
          </li>
          <li>
            <strong>Orden garantizado:</strong> una cola FIFO por partida espera el{' '}
            <code>MATCH_STARTED</code> y nunca envía eventos después de{' '}
            <code>MATCH_FINISHED</code>.
          </li>
          <li>
            <strong>Sin CORS:</strong> Nginx sirve la SPA y hace proxy de <code>/api</code> y{' '}
            <code>/prolog</code>.
          </li>
          <li>
            <strong>Panel:</strong> consulta <code>/api/stats</code> y{' '}
            <code>/api/matches/&#123;id&#125;/analysis</code>; no calcula estadísticas.
          </li>
        </ul>
      </div>
    </section>
  )
}
